// "Forgot password" (an emailed 6-digit code) and deleting your own account.
import { b64url, createSession, hashPassword, requireUser, same, sha256, withStats } from './auth.js';
import { HttpError, json, limited, now, readJson, str } from './http.js';
import { canSendEmail, sendEmail } from './mail.js';

const CODE_MS = 15 * 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 5;
const MAX_ATTEMPTS = 5;

// Orders that still need the account: money is held or a dispute is open.
const OPEN_ORDER_STATUSES = "('paymentHeld', 'vendorDispatched', 'disputed')";

const codeHash = (userId, code) => sha256(`${userId}:${code}`);

function newCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}

async function sendResetEmail(env, to, code) {
  await sendEmail(env, {
    to,
    subject: `Your Dobha-Dobha code: ${code}`,
    text:
      `Your code to reset your Dobha-Dobha password is ${code}\n\n` +
      'It works for 15 minutes. If you did not ask for this, ignore this email; your password has not changed.',
    html:
      '<p>Your code to reset your Dobha-Dobha password is:</p>' +
      `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
      '<p>It works for 15 minutes. If you did not ask for this, ignore this email; your password has not changed.</p>',
  });
}

/** POST /api/auth/forgot { email }: emails a reset code. Answers the same whether or not the email has an account. */
export async function forgotPassword(request, env) {
  await limited(env.AUTH_LIMIT, request);
  const body = await readJson(request);
  const email = str(body, 'email', { max: 120 }).toLowerCase();
  // Say so up front, whether or not the email has an account, so the app can offer support instead.
  if (!canSendEmail(env)) throw new HttpError(503, 'Password reset by email is not available yet');

  const user = await env.DB.prepare('SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL').bind(email).first();
  if (user) {
    const t = now();
    const prev = await env.DB.prepare('SELECT sent_count, window_start FROM password_resets WHERE user_id = ?').bind(user.id).first();
    const inWindow = prev && t - prev.window_start < WINDOW_MS;
    if (inWindow && prev.sent_count >= MAX_CODES_PER_WINDOW) {
      throw new HttpError(429, 'Too many codes sent. Try again in an hour.');
    }
    const code = newCode();
    // A new code replaces the old one and gets a fresh set of attempts.
    await env.DB.prepare(
      `INSERT INTO password_resets (user_id, code_hash, expires_at, attempts, sent_count, window_start) VALUES (?1, ?2, ?3, 0, ?4, ?5)
       ON CONFLICT(user_id) DO UPDATE SET code_hash = ?2, expires_at = ?3, attempts = 0, sent_count = ?4, window_start = ?5`,
    )
      .bind(user.id, await codeHash(user.id, code), t + CODE_MS, inWindow ? prev.sent_count + 1 : 1, inWindow ? prev.window_start : t)
      .run();
    await sendResetEmail(env, user.email, code);
  }
  return json({ ok: true });
}

/** POST /api/auth/reset { email, code, password }: sets the new password, ends every other session and logs in. */
export async function resetPassword(request, env) {
  await limited(env.AUTH_LIMIT, request);
  const body = await readJson(request);
  const email = str(body, 'email', { max: 120 }).toLowerCase();
  const code = str(body, 'code', { max: 12 }).replace(/\s/g, '');
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Password must be at least 8 characters');

  const wrong = new HttpError(400, 'That code is wrong or has expired. Ask for a new one.');
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').bind(email).first();
  if (!user) throw wrong;
  const reset = await env.DB.prepare('SELECT * FROM password_resets WHERE user_id = ?').bind(user.id).first();
  if (!reset || reset.expires_at < now() || reset.attempts >= MAX_ATTEMPTS) throw wrong;

  if (!same(await codeHash(user.id, code), reset.code_hash)) {
    await env.DB.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?').bind(user.id).run();
    throw wrong;
  }

  const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(password, salt);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    // Keep the row (and its hourly count) but make the code unusable.
    env.DB.prepare('UPDATE password_resets SET attempts = ? WHERE user_id = ?').bind(MAX_ATTEMPTS, user.id),
  ]);
  const next = { ...user, password_hash: hash, password_salt: salt };
  return json({ token: await createSession(env, user.id), user: await withStats(env, next) });
}

/**
 * DELETE /api/me { password } (or { confirm: "DELETE" } for Google-only accounts).
 * Refused while orders are open or the wallet has money. Personal details, listings and activity are removed;
 * the user row stays, anonymised, so orders, messages and reviews on the other side still make sense.
 */
export async function deleteAccount(request, env) {
  const user = await requireUser(request, env);
  await limited(env.AUTH_LIMIT, request, `delete:${user.id}`);
  const body = await readJson(request);

  if (user.password_hash) {
    const password = typeof body.password === 'string' ? body.password : '';
    if (!same(await hashPassword(password, user.password_salt), user.password_hash)) throw new HttpError(401, 'Wrong password');
  } else if (body.confirm !== 'DELETE') {
    throw new HttpError(400, 'Type DELETE to confirm');
  }

  const [open, wallet] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM orders WHERE (buyer_id = ?1 OR seller_id = ?1) AND status IN ${OPEN_ORDER_STATUSES}`).bind(user.id),
    env.DB.prepare('SELECT available_cents, locked_cents, pending_cents FROM wallets WHERE user_id = ?').bind(user.id),
  ]);
  if (open.results[0].n > 0) {
    throw new HttpError(409, 'You have orders in progress. Finish or settle them before deleting your account.');
  }
  const w = wallet.results[0];
  if (w && w.available_cents + w.locked_cents + w.pending_cents > 0) {
    throw new HttpError(409, `Withdraw the R${(w.available_cents / 100).toFixed(2)} in your wallet before deleting your account.`);
  }

  // Photos and videos of listings nobody bought go; sold ones stay for the buyer's order history.
  const { results: media } = await env.DB.prepare(
    `SELECT m.media_key FROM item_media m JOIN items i ON i.id = m.item_id
     WHERE i.seller_id = ? AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.item_id = i.id)`,
  )
    .bind(user.id)
    .all();
  const keys = media.map((m) => m.media_key);
  if (user.avatar_key) keys.push(user.avatar_key);

  const anonHandle = `deleted_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const u = user.id;
  const run = (sql, ...args) => env.DB.prepare(sql).bind(u, ...args);
  await env.DB.batch([
    run("UPDATE offers SET status = 'cancelled', updated_at = ?2 WHERE (buyer_id = ?1 OR seller_id = ?1) AND status IN ('pending', 'countered', 'accepted')", now()),
    // Cascades to their media, likes, saves, comments, carts, offers and reports.
    run('DELETE FROM items WHERE seller_id = ?1 AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.item_id = items.id)'),
    run("UPDATE items SET status = 'removed' WHERE seller_id = ?1 AND status = 'available'"),
    run('DELETE FROM sessions WHERE user_id = ?1'),
    run('DELETE FROM device_tokens WHERE user_id = ?1'),
    run('DELETE FROM password_resets WHERE user_id = ?1'),
    run('DELETE FROM likes WHERE user_id = ?1'),
    run('DELETE FROM saves WHERE user_id = ?1'),
    run('DELETE FROM comments WHERE user_id = ?1'),
    run('DELETE FROM cart_items WHERE user_id = ?1'),
    run('DELETE FROM follows WHERE follower_id = ?1 OR seller_id = ?1'),
    run('DELETE FROM notifications WHERE user_id = ?1'),
    run('DELETE FROM reports WHERE user_id = ?1'),
    run(
      `UPDATE users SET email = ?2, name = 'Deleted account', handle = ?3, phone = '', bio = '', location = '', shop_name = '',
         stall_location = '', role = 'shopper', password_hash = '', password_salt = '', google_sub = NULL, avatar_key = NULL,
         deleted_at = ?4 WHERE id = ?1`,
      `${u}@deleted.invalid`,
      anonHandle,
      now(),
    ),
  ]);
  if (keys.length) await env.PHOTOS.delete(keys);
  return json({ ok: true });
}

/** POST /api/me/password { current, password }: changes the password and signs out every other device. */
export async function changePassword(request, env) {
  const user = await requireUser(request, env);
  await limited(env.AUTH_LIMIT, request, `password:${user.id}`);
  const body = await readJson(request);
  if (!user.password_hash) throw new HttpError(400, 'This account signs in with Google, so it has no password');
  const current = typeof body.current === 'string' ? body.current : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!same(await hashPassword(current, user.password_salt), user.password_hash)) throw new HttpError(401, 'Your current password is wrong');
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Password must be at least 8 characters');

  const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const token = (request.headers.get('authorization') || '').slice(7).trim();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(await hashPassword(password, salt), salt, user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, await sha256(token)),
  ]);
  return json({ ok: true });
}
