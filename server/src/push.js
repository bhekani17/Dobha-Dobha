// Push notifications through Firebase Cloud Messaging (HTTP v1).
//
// The app registers its FCM token after signing in. Anything that writes a notification or a chat message
// doesn't need to know about push: after each successful change, index.js calls sendPending(), which claims
// rows not pushed yet and sends them. Until FCM_SERVICE_ACCOUNT is set
// (`npx wrangler secret put FCM_SERVICE_ACCOUNT` with the Firebase service account JSON), nothing is sent.
// Only rows from the last PUSH_WINDOW_MS are pushed, so turning push on never floods people with old news.
import { b64url, requireUser } from './auth.js';
import { json, now, readJson, str } from './http.js';

const PUSH_WINDOW_MS = 10 * 60 * 1000;
const BATCH = 50;
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** POST /api/me/devices { token, platform }: this phone gets the signed-in user's push notifications. */
export async function registerDevice(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const token = str(body, 'token', { max: 4096 });
  const platform = str(body, 'platform', { max: 20, optional: true }) || 'android';
  await env.DB.prepare(
    `INSERT INTO device_tokens (token, user_id, platform, updated_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(token) DO UPDATE SET user_id = ?2, platform = ?3, updated_at = ?4`,
  )
    .bind(token, user.id, platform, now())
    .run();
  return json({ ok: true });
}

/** DELETE /api/me/devices { token }: stop pushing to this phone (called before logging out). */
export async function unregisterDevice(request, env) {
  const user = await requireUser(request, env);
  const token = str(await readJson(request), 'token', { max: 4096 });
  await env.DB.prepare('DELETE FROM device_tokens WHERE token = ? AND user_id = ?').bind(token, user.id).run();
  return json({ ok: true });
}

// ---- Google OAuth for the service account (cached per isolate) ----

let access = { token: null, exp: 0 };

function pemToDer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function accessToken(sa) {
  if (access.token && access.exp - 60_000 > Date.now()) return access.token;
  const iat = Math.floor(Date.now() / 1000);
  const enc = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: sa.client_email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  })}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  access = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return access.token;
}

// ---- Sending ----

/** Pushes notifications and chat messages written in the last few minutes that haven't gone out yet. */
export async function sendPending(env) {
  if (!env.FCM_SERVICE_ACCOUNT) return;
  const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
  const t = now();
  const since = t - PUSH_WINDOW_MS;

  // Claiming with UPDATE ... RETURNING means two requests running at once never push the same row twice.
  const [notes, msgs] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE notifications SET pushed_at = ?1 WHERE id IN
         (SELECT id FROM notifications WHERE pushed_at IS NULL AND created_at > ?2 ORDER BY created_at LIMIT ${BATCH})
       RETURNING user_id, kind, title, body, order_id, item_id`,
    ).bind(t, since),
    env.DB.prepare(
      `UPDATE messages SET pushed_at = ?1 WHERE id IN
         (SELECT id FROM messages WHERE pushed_at IS NULL AND read_at IS NULL AND created_at > ?2 ORDER BY created_at LIMIT ${BATCH})
       RETURNING sender_id, recipient_id, text`,
    ).bind(t, since),
  ]);

  const pushes = notes.results.map((n) => ({
    userId: n.user_id,
    title: n.title,
    body: n.body,
    data: { kind: n.kind, ...(n.order_id ? { orderId: n.order_id } : {}), ...(n.item_id ? { itemId: n.item_id } : {}) },
  }));
  if (msgs.results.length) {
    const senders = [...new Set(msgs.results.map((m) => m.sender_id))];
    const { results } = await env.DB.prepare(`SELECT id, name FROM users WHERE id IN (${senders.map(() => '?').join(',')})`)
      .bind(...senders)
      .all();
    const names = Object.fromEntries(results.map((u) => [u.id, u.name]));
    for (const m of msgs.results) {
      pushes.push({ userId: m.recipient_id, title: names[m.sender_id] || 'New message', body: m.text.slice(0, 200), data: { kind: 'message', userId: m.sender_id } });
    }
  }
  if (!pushes.length) return;

  const users = [...new Set(pushes.map((p) => p.userId))];
  const { results: devices } = await env.DB.prepare(`SELECT token, user_id FROM device_tokens WHERE user_id IN (${users.map(() => '?').join(',')})`)
    .bind(...users)
    .all();
  if (!devices.length) return;

  const bearer = await accessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const dead = new Set();
  await Promise.all(
    pushes.flatMap((p) =>
      devices
        .filter((d) => d.user_id === p.userId)
        .map(async (d) => {
          const res = await fetch(url, {
            method: 'POST',
            headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              message: {
                token: d.token,
                notification: { title: p.title, body: p.body },
                data: p.data,
                android: { priority: 'high', notification: { channel_id: 'dobha', sound: 'default' } },
                apns: { payload: { aps: { sound: 'default' } } },
              },
            }),
          });
          // Uninstalled apps and expired tokens: forget them so we stop trying.
          if (res.status === 404 || res.status === 400) {
            const err = await res.text();
            if (res.status === 404 || err.includes('registration token')) dead.add(d.token);
          } else if (!res.ok) {
            console.error('FCM send failed', res.status, await res.text());
          }
        }),
    ),
  );
  if (dead.size) {
    await env.DB.batch([...dead].map((tok) => env.DB.prepare('DELETE FROM device_tokens WHERE token = ?').bind(tok)));
  }
}

/** Daily: rows too old to push are marked done, keeping the "not pushed yet" indexes small. */
export async function skipStale(env) {
  const before = now() - PUSH_WINDOW_MS;
  await env.DB.batch([
    env.DB.prepare('UPDATE notifications SET pushed_at = created_at WHERE pushed_at IS NULL AND created_at < ?').bind(before),
    env.DB.prepare('UPDATE messages SET pushed_at = created_at WHERE pushed_at IS NULL AND created_at < ?').bind(before),
  ]);
}
