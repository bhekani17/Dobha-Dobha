// "Contact support": people write in from the app (signed in, or from the login screen when they can't get in),
// admins answer from the admin website, and the answer arrives as an in-app notification.
import { isAdmin, requireUser } from './auth.js';
import { HttpError, id, iso, json, limited, now, readJson, str } from './http.js';
import { notify } from './notifications.js';

const TOPICS = ['order', 'payment', 'selling', 'account', 'safety', 'bug', 'other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_OPEN = 5;

const requestJson = (r) => ({
  id: r.id,
  topic: r.topic,
  message: r.message,
  orderId: r.order_id,
  status: r.status,
  reply: r.reply,
  repliedAt: iso(r.replied_at),
  createdAt: iso(r.created_at),
});

/** POST /api/support { topic, message, orderId?, email? }: email is only needed when signed out. */
export async function createRequest(request, env) {
  const signedIn = (request.headers.get('authorization') || '').startsWith('Bearer ');
  const user = signedIn ? await requireUser(request, env) : null;
  await limited(user ? env.ACTION_LIMIT : env.AUTH_LIMIT, request, user ? `support:${user.id}` : undefined);
  const body = await readJson(request);

  const topic = str(body, 'topic', { max: 20 });
  if (!TOPICS.includes(topic)) throw new HttpError(400, 'Pick what your question is about');
  const message = str(body, 'message', { min: 10, max: 2000 });
  const email = user ? user.email : str(body, 'email', { max: 120 }).toLowerCase();
  if (!user && !EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address so we can answer you');

  let orderId = str(body, 'orderId', { max: 40, optional: true }) || null;
  if (orderId) {
    const order = user && (await env.DB.prepare('SELECT id FROM orders WHERE id = ?1 AND (buyer_id = ?2 OR seller_id = ?2)').bind(orderId, user.id).first());
    if (!order) orderId = null;
  }

  const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM support_requests WHERE (user_id = ? OR email = ?) AND status = 'open'")
    .bind(user?.id ?? '', email)
    .first();
  if (open.n >= MAX_OPEN) throw new HttpError(429, 'You already have several questions waiting. We will answer those first.');

  const row = { id: id('sup'), user_id: user?.id ?? null, email, topic, message, order_id: orderId, status: 'open', reply: null, replied_at: null, created_at: now() };
  await env.DB.prepare(
    'INSERT INTO support_requests (id, user_id, email, topic, message, order_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(row.id, row.user_id, email, topic, message, orderId, 'open', row.created_at)
    .run();
  return json({ request: requestJson(row) }, 201);
}

/** GET /api/support: the signed-in user's questions and our answers, newest first. */
export async function myRequests(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare('SELECT * FROM support_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(user.id)
    .all();
  return json({ requests: results.map(requestJson) });
}

async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (!isAdmin(env, user)) throw new HttpError(403, 'Admins only');
  return user;
}

/** GET /api/admin/support (admins): open questions, oldest first, with who asked. */
export async function listOpen(request, env) {
  await requireAdmin(request, env);
  const { results } = await env.DB.prepare(
    `SELECT s.*, u.name AS user_name, u.handle AS user_handle FROM support_requests s LEFT JOIN users u ON u.id = s.user_id
     WHERE s.status = 'open' ORDER BY s.created_at LIMIT 200`,
  ).all();
  return json({
    requests: results.map((r) => ({
      ...requestJson(r),
      email: r.email,
      userName: r.user_name,
      userHandle: r.user_handle ? `@${r.user_handle}` : null,
    })),
  });
}

/** POST /api/admin/support/:id/reply { reply } or /close (admins). */
export async function answer(request, env, requestId, action) {
  await requireAdmin(request, env);
  const row = await env.DB.prepare('SELECT * FROM support_requests WHERE id = ?').bind(requestId).first();
  if (!row) throw new HttpError(404, 'Question not found');
  if (row.status !== 'open') throw new HttpError(409, 'This question was already handled');

  if (action === 'close') {
    await env.DB.prepare("UPDATE support_requests SET status = 'closed' WHERE id = ?").bind(row.id).run();
    return json({ ok: true });
  }

  const reply = str(await readJson(request), 'reply', { min: 2, max: 2000 });
  const t = now();
  const writes = [env.DB.prepare("UPDATE support_requests SET status = 'answered', reply = ?, replied_at = ? WHERE id = ?").bind(reply, t, row.id)];
  if (row.user_id) {
    writes.push(notify(env, row.user_id, { kind: 'support', title: 'Dobha support answered you', body: reply.slice(0, 280), orderId: row.order_id }));
  }
  await env.DB.batch(writes);

  // Someone who wrote in signed out only has their email; send the answer there when email is set up.
  if (!row.user_id && env.EMAIL && env.EMAIL_FROM) {
    await env.EMAIL.send({
      to: row.email,
      from: env.EMAIL_FROM,
      subject: 'Dobha-Dobha support',
      text: `${reply}\n\nYou wrote:\n${row.message}`,
    });
  }
  return json({ ok: true, emailed: !row.user_id && Boolean(env.EMAIL && env.EMAIL_FROM) });
}
