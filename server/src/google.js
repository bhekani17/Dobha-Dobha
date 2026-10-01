// "Continue with Google": the app sends Google's ID token, we verify its
// signature against Google's public keys and sign the user in, creating or
// linking their Dobha account by Google id or verified email.
import { createSession, withStats } from './auth.js';
import { HttpError, id, json, limited, now, readJson, str } from './http.js';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

// Google rotates keys every few weeks; cache them per isolate for an hour.
let jwks = { at: 0, keys: [] };

async function googleKey(kid) {
  if (Date.now() - jwks.at > 3600_000 || !jwks.keys.some((k) => k.kid === kid)) {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new HttpError(502, 'Could not reach Google, try again');
    jwks = { at: Date.now(), keys: (await res.json()).keys };
  }
  const jwk = jwks.keys.find((k) => k.kid === kid);
  if (!jwk) throw new HttpError(401, 'Google sign-in failed, try again');
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

const fromB64url = (s) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
const decodePart = (s) => JSON.parse(new TextDecoder().decode(fromB64url(s)));

/** Verified claims from a Google ID token, or a 401. */
async function verifyIdToken(token, env) {
  const audiences = (env.GOOGLE_CLIENT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!audiences.length) throw new HttpError(500, 'Google sign-in is not configured on the server');

  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Google sign-in failed, try again');
  let header, claims;
  try {
    header = decodePart(parts[0]);
    claims = decodePart(parts[1]);
  } catch {
    throw new HttpError(401, 'Google sign-in failed, try again');
  }
  if (header.alg !== 'RS256') throw new HttpError(401, 'Google sign-in failed, try again');

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    await googleKey(header.kid),
    fromB64url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  const nowSec = Date.now() / 1000;
  if (!valid || !ISSUERS.includes(claims.iss) || !audiences.includes(claims.aud) || !(claims.exp > nowSec - 60)) {
    throw new HttpError(401, 'Google sign-in failed, try again');
  }
  if (!claims.email || claims.email_verified !== true) {
    throw new HttpError(401, 'Your Google account email is not verified');
  }
  return claims;
}

/** A free handle based on the email, e.g. "thabo.m@gmail.com" -> "thabom" or "thabom4821". */
async function freeHandle(env, email) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14).padEnd(3, '0');
  for (let i = 0; i < 5; i++) {
    const handle = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await env.DB.prepare('SELECT 1 FROM users WHERE handle = ?').bind(handle).first())) return handle;
  }
  return `user${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

/** POST /api/auth/google { idToken } */
export async function googleSignIn(request, env) {
  await limited(env.AUTH_LIMIT, request);
  const body = await readJson(request);
  const claims = await verifyIdToken(str(body, 'idToken', { max: 4096 }), env);
  // The app shows the terms next to the Google button; a new account accepts that version.
  const termsVersion = str(body, 'termsVersion', { max: 20, optional: true }) || null;
  const email = claims.email.toLowerCase();

  let user = await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(claims.sub).first();
  if (!user) {
    // Google has verified this email, so the account is theirs. Registration never verified it, though, so
    // someone else may have signed up with it first: drop that password and its sessions so they're locked out.
    user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (user) {
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET google_sub = ?, password_hash = '', password_salt = '' WHERE id = ?").bind(claims.sub, user.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      ]);
    }
  }

  let created = false;
  if (!user) {
    const name = (claims.name || email.split('@')[0]).trim().slice(0, 40);
    user = {
      id: id('usr'),
      email,
      name: name.length >= 2 ? name : 'Dobha User',
      handle: await freeHandle(env, email),
      phone: '',
      role: 'shopper',
      shop_name: '',
      stall_location: '',
      created_at: now(),
    };
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (id, email, password_hash, password_salt, name, handle, phone, role, shop_name, stall_location, created_at, google_sub,
           terms_version, terms_accepted_at)
         VALUES (?, ?, '', '', ?, ?, '', 'shopper', '', '', ?, ?, ?, ?)`,
      ).bind(user.id, email, user.name, user.handle, user.created_at, claims.sub, termsVersion, termsVersion ? user.created_at : null),
      env.DB.prepare('INSERT INTO wallets (user_id) VALUES (?)').bind(user.id),
    ]);
    created = true;
  }

  return json({ token: await createSession(env, user.id), user: await withStats(env, user), created }, created ? 201 : 200);
}
