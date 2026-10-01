// Email + password accounts (Google sign-in lives in google.js) with opaque bearer tokens. Only a SHA-256 of each
// token is stored, so a leaked database can't be used to log in.
import { HttpError, id, json, limited, now, readJson, str } from './http.js';

const PBKDF2_ITERATIONS = 100_000; // the Workers runtime maximum
const SESSION_MS = 60 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return b64url(bits);
}

export async function sha256(text) {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

// Constant-time compare so response timing doesn't leak how much of a hash matched.
export function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(env, userId) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const t = now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, t, t + SESSION_MS)
    .run();
  return token;
}

export function publicUser(u, stats = {}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    handle: `@${u.handle}`,
    phone: u.phone,
    role: u.role,
    shopName: u.shop_name,
    stallLocation: u.stall_location,
    avatarUrl: u.avatar_key ? `/media/${u.avatar_key}` : null,
    bio: u.bio ?? '',
    location: u.location ?? '',
    createdAt: new Date(u.created_at).toISOString(),
    salesCount: stats.salesCount ?? 0,
    isAdmin: stats.isAdmin ?? false,
    // Google-only accounts have no password to change or confirm with.
    hasPassword: Boolean(u.password_hash),
  };
}

/** Admins settle disputes and review reported listings. Set ADMIN_EMAILS (comma-separated) in wrangler.jsonc. */
export function isAdmin(env, user) {
  const emails = (env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return emails.includes(user.email.toLowerCase());
}

/** The signed-in user, or a 401. */
export async function requireUser(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Please log in');
  const row = await env.DB.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
  )
    .bind(await sha256(token), now())
    .first();
  if (!row) throw new HttpError(401, 'Your session has expired, please log in again');
  return row;
}

export async function register(request, env) {
  await limited(env.AUTH_LIMIT, request);
  const body = await readJson(request);
  const email = str(body, 'email', { max: 120 }).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const name = str(body, 'name', { min: 2, max: 40 });
  const handle = str(body, 'handle', { max: 20 }).toLowerCase().replace(/^@/, '');
  const phone = str(body, 'phone', { max: 20, optional: true });

  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address');
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Password must be at least 8 characters');
  if (!HANDLE_RE.test(handle)) throw new HttpError(400, 'Username: 3-20 lowercase letters, numbers or _');
  if (body.acceptTerms !== true) throw new HttpError(400, 'Please read and agree to the Terms and Conditions');
  const termsVersion = str(body, 'termsVersion', { max: 20 });

  const taken = await env.DB.prepare('SELECT email, handle FROM users WHERE email = ? OR handle = ?').bind(email, handle).first();
  if (taken) {
    throw new HttpError(409, taken.email === email ? 'An account with this email already exists' : 'That username is taken');
  }

  const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const user = {
    id: id('usr'),
    email,
    password_hash: await hashPassword(password, salt),
    password_salt: salt,
    name,
    handle,
    phone,
    role: 'shopper',
    shop_name: '',
    stall_location: '',
    created_at: now(),
  };
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, password_salt, name, handle, phone, role, shop_name, stall_location, created_at, terms_version, terms_accepted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(user.id, email, user.password_hash, salt, name, handle, phone, 'shopper', '', '', user.created_at, termsVersion, user.created_at),
    env.DB.prepare('INSERT INTO wallets (user_id) VALUES (?)').bind(user.id),
  ]);

  return json({ token: await createSession(env, user.id), user: await withStats(env, user) }, 201);
}

export async function login(request, env) {
  await limited(env.AUTH_LIMIT, request);
  const body = await readJson(request);
  const email = str(body, 'email', { max: 120 }).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (user && !user.password_hash) throw new HttpError(401, 'This account uses Google. Tap "Continue with Google".');
  // Hash even when the email is unknown so both failures take the same time.
  const hash = await hashPassword(password, user?.password_salt ?? 'no-such-user');
  if (!user || !same(hash, user.password_hash)) throw new HttpError(401, 'Wrong email or password');

  return json({ token: await createSession(env, user.id), user: await withStats(env, user) });
}

export async function logout(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true });
}

export async function withStats(env, user) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status = 'payoutReleased'")
    .bind(user.id)
    .first();
  return publicUser(user, { salesCount: row?.n ?? 0, isAdmin: isAdmin(env, user) });
}

export async function me(request, env) {
  return json({ user: await withStats(env, await requireUser(request, env)) });
}

const AVATAR_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** PUT /api/me/avatar: raw image body. DELETE /api/me/avatar removes it. */
export async function setAvatar(request, env) {
  const user = await requireUser(request, env);
  let key = null;
  if (request.method === 'PUT') {
    const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = AVATAR_TYPES[type];
    if (!ext) throw new HttpError(415, 'Profile pictures must be JPEG, PNG or WebP');
    const length = Number(request.headers.get('content-length'));
    if (!length) throw new HttpError(411, 'Upload size is missing');
    if (length > AVATAR_MAX_BYTES) throw new HttpError(413, 'Picture is too large (max 5 MB)');
    key = `avatars/${user.id}/${crypto.randomUUID()}.${ext}`;
    await env.PHOTOS.put(key, request.body, { httpMetadata: { contentType: type } });
  }
  await env.DB.prepare('UPDATE users SET avatar_key = ? WHERE id = ?').bind(key, user.id).run();
  if (user.avatar_key) await env.PHOTOS.delete(user.avatar_key);
  return json({ user: await withStats(env, { ...user, avatar_key: key }) });
}

/** PATCH /api/me: profile fields, and switching to vendor (needs a shop name and stall). */
export async function updateMe(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const next = { ...user };

  if ('name' in body) next.name = str(body, 'name', { min: 2, max: 40 });
  if ('phone' in body) next.phone = str(body, 'phone', { max: 20, optional: true });
  if ('bio' in body) next.bio = str(body, 'bio', { max: 160, optional: true });
  if ('location' in body) next.location = str(body, 'location', { max: 60, optional: true });
  if ('shopName' in body) next.shop_name = str(body, 'shopName', { min: 2, max: 50, optional: true });
  if ('stallLocation' in body) next.stall_location = str(body, 'stallLocation', { min: 2, max: 100, optional: true });
  if ('role' in body) {
    if (body.role !== 'shopper' && body.role !== 'vendor') throw new HttpError(400, 'Unknown role');
    next.role = body.role;
  }
  if (next.role === 'vendor' && (!next.shop_name || !next.stall_location)) {
    throw new HttpError(400, 'Add your shop name and stall location to start selling');
  }

  await env.DB.prepare(
    'UPDATE users SET name = ?, phone = ?, role = ?, shop_name = ?, stall_location = ?, bio = ?, location = ? WHERE id = ?',
  )
    .bind(next.name, next.phone, next.role, next.shop_name, next.stall_location, next.bio ?? '', next.location ?? '', user.id)
    .run();
  return json({ user: await withStats(env, next) });
}

