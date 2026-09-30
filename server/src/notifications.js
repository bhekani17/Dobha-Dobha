// In-app notifications: sales, dispatches, payouts, disputes and comments.
// The app polls the unread count; push (Firebase) can later be sent from notify().
import { requireUser } from './auth.js';
import { id, iso, json, now } from './http.js';
import { unreadMessages } from './social.js';

/** A prepared insert, so callers can put it in the same batch as the change it announces. */
export function notify(env, userId, { kind, title, body, orderId = null, itemId = null }) {
  return env.DB.prepare(
    'INSERT INTO notifications (id, user_id, kind, title, body, order_id, item_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id('ntf'), userId, kind, title, body, orderId, itemId, now());
}

/** GET /api/notifications: the latest 50 and how many are unread. */
export async function listNotifications(request, env) {
  const user = await requireUser(request, env);
  const [{ results }, unread] = await Promise.all([
    env.DB.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(user.id).first(),
  ]);
  return json({
    unread: unread?.n ?? 0,
    notifications: results.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      orderId: n.order_id,
      itemId: n.item_id,
      read: n.read_at != null,
      createdAt: iso(n.created_at),
    })),
  });
}

/** GET /api/notifications/unread: unread notifications and chat messages; cheap enough to poll. */
export async function unreadCount(request, env) {
  const user = await requireUser(request, env);
  const [row, messages] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(user.id).first(),
    unreadMessages(env, user.id),
  ]);
  return json({ unread: row?.n ?? 0, messages });
}

/** POST /api/notifications/read: marks everything read. */
export async function markRead(request, env) {
  const user = await requireUser(request, env);
  await env.DB.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').bind(now(), user.id).run();
  return json({ ok: true });
}
