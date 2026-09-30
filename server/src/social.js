// Cart, offers, seller pages and follows, chat, and reviews.
import { requireUser } from './auth.js';
import { HttpError, id, iso, json, limited, now, rands, readJson, str, zar } from './http.js';
import { ITEM_SELECT, itemJson, loadItem } from './items.js';
import { notify } from './notifications.js';

const OFFER_VALID_MS = 48 * 60 * 60 * 1000;
const money = (cents) => `R ${(cents / 100).toFixed(0)}`;

// ---- Cart ----

/** GET /api/cart: pieces in the cart; sold or removed ones come back with `available: false`. */
export async function getCart(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    `${ITEM_SELECT} JOIN cart_items c ON c.item_id = i.id AND c.user_id = ?1 ORDER BY c.created_at DESC`,
  )
    .bind(user.id)
    .all();
  return json({ items: results.map((r) => ({ ...itemJson(r), available: r.status === 'available' })) });
}

/** POST /api/cart/:itemId */
export async function addToCart(request, env, itemId) {
  const user = await requireUser(request, env);
  await limited(env.ACTION_LIMIT, request, user.id);
  const item = await loadItem(env, itemId, user.id);
  if (item.seller_id === user.id) throw new HttpError(400, "You can't buy your own item");
  if (item.status !== 'available') throw new HttpError(409, 'Someone already bought this piece');
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM cart_items WHERE user_id = ?').bind(user.id).first();
  if (n >= 30) throw new HttpError(400, 'Your cart is full (30 pieces)');
  await env.DB.prepare('INSERT OR IGNORE INTO cart_items (user_id, item_id, created_at) VALUES (?, ?, ?)').bind(user.id, itemId, now()).run();
  return getCart(request, env);
}

/** DELETE /api/cart/:itemId */
export async function removeFromCart(request, env, itemId) {
  const user = await requireUser(request, env);
  await env.DB.prepare('DELETE FROM cart_items WHERE user_id = ? AND item_id = ?').bind(user.id, itemId).run();
  return getCart(request, env);
}

/// ---- Offers ----

async function loadOffer(env, offerId, viewerId) {
  const o = await env.DB.prepare('SELECT f.*, b.name AS buyer_name FROM offers f JOIN users b ON b.id = f.buyer_id WHERE f.id = ?')
    .bind(offerId)
    .first();
  if (!o || (o.buyer_id !== viewerId && o.seller_id !== viewerId)) throw new HttpError(404, 'Offer not found');
  return o;
}

/** The offer with its listing, as the app sees it. */
async function offerJson(env, o, viewerId) {
  const item = await env.DB.prepare(`${ITEM_SELECT} WHERE i.id = ?2`).bind(viewerId, o.item_id).first();
  // An accepted offer past its time can't be used any more.
  const expired = o.status === 'accepted' && o.expires_at && o.expires_at < now();
  return {
    id: o.id,
    item: itemJson(item),
    itemAvailable: item.status === 'available',
    amountZar: zar(o.amount_cents),
    status: expired ? 'expired' : o.status,
    isSeller: o.seller_id === viewerId,
    buyerName: o.buyer_name,
    expiresAt: iso(o.expires_at),
    updatedAt: iso(o.updated_at),
  };
}

/** GET /api/offers: offers you made and offers on your listings from the last 30 days, newest first. */
export async function listOffers(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    `SELECT f.*, b.name AS buyer_name FROM offers f JOIN users b ON b.id = f.buyer_id
     WHERE (f.buyer_id = ?1 OR f.seller_id = ?1) AND f.updated_at > ?2 ORDER BY f.updated_at DESC LIMIT 100`,
  )
    .bind(user.id, now() - 30 * 24 * 60 * 60 * 1000)
    .all();
  return json({ offers: await Promise.all(results.map((o) => offerJson(env, o, user.id))) });
}

/** POST /api/items/:id/offers { amountZar } (buyers) */
export async function makeOffer(request, env, itemId) {
  const user = await requireUser(request, env);
  await limited(env.ACTION_LIMIT, request, user.id);
  const item = await loadItem(env, itemId, user.id);
  if (item.seller_id === user.id) throw new HttpError(400, "You can't make an offer on your own item");
  if (item.status !== 'available') throw new HttpError(409, 'Someone already bought this piece');
  const amount = rands(await readJson(request), 'amountZar');
  if (amount >= item.price_cents) throw new HttpError(400, `Offer less than the price (${money(item.price_cents)}), or just buy it`);
  if (amount < item.price_cents * 0.3) throw new HttpError(400, 'That offer is too low. Try at least 30% of the price.');

  const open = await env.DB.prepare("SELECT 1 FROM offers WHERE item_id = ? AND buyer_id = ? AND status IN ('pending', 'countered')")
    .bind(itemId, user.id)
    .first();
  if (open) throw new HttpError(409, 'You already have an offer waiting on this piece');

  const offerId = id('ofr');
  const t = now();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO offers (id, item_id, buyer_id, seller_id, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
    ).bind(offerId, itemId, user.id, item.seller_id, amount, t, t),
    notify(env, item.seller_id, {
      kind: 'offer',
      title: `Offer on "${item.title}"`,
      body: `${user.name} offered ${money(amount)} (listed at ${money(item.price_cents)}). Answer it in Orders.`,
      itemId,
    }),
  ]);
  return json({ offer: await offerJson(env, await loadOffer(env, offerId, user.id), user.id) }, 201);
}

/**
 * POST /api/offers/:id/(accept|decline|counter|cancel)
 * Seller: accept, decline or counter { amountZar } a pending offer.
 * Buyer: accept or decline a counter, or cancel their pending offer.
 */
export async function respondToOffer(request, env, offerId, action) {
  const user = await requireUser(request, env);
  const o = await loadOffer(env, offerId, user.id);
  const item = await env.DB.prepare('SELECT title, price_cents, status FROM items WHERE id = ?').bind(o.item_id).first();
  if (item.status !== 'available') throw new HttpError(409, 'This piece has already been sold');
  const isSeller = o.seller_id === user.id;
  const t = now();

  const move = async (status, amount = o.amount_cents) => {
    const res = await env.DB.prepare('UPDATE offers SET status = ?, amount_cents = ?, updated_at = ?, expires_at = ? WHERE id = ? AND status = ?')
      .bind(status, amount, t, status === 'accepted' ? t + OFFER_VALID_MS : null, offerId, o.status)
      .run();
    if (!res.meta.changes) throw new HttpError(409, 'This offer has already changed, pull to refresh');
  };
  const tell = (to, kind, title, body) => notify(env, to, { kind, title, body, itemId: o.item_id }).run();

  if (isSeller && o.status === 'pending' && action === 'accept') {
    await move('accepted');
    await tell(o.buyer_id, 'offer_accepted', 'Offer accepted',
      `The seller accepted ${money(o.amount_cents)} for "${item.title}". Buy it within 48 hours from Orders.`);
  } else if (isSeller && o.status === 'pending' && action === 'decline') {
    await move('declined');
    await tell(o.buyer_id, 'offer_declined', 'Offer declined', `The seller declined your offer on "${item.title}".`);
  } else if (isSeller && o.status === 'pending' && action === 'counter') {
    const amount = rands(await readJson(request), 'amountZar');
    if (amount <= o.amount_cents) throw new HttpError(400, 'A counter offer should be more than their offer');
    if (amount >= item.price_cents) throw new HttpError(400, 'A counter offer should be less than your listed price');
    await move('countered', amount);
    await tell(o.buyer_id, 'offer_countered', 'The seller made a counter offer',
      `${money(amount)} for "${item.title}". Accept or decline it in Orders.`);
  } else if (!isSeller && o.status === 'countered' && (action === 'accept' || action === 'decline')) {
    await move(action === 'accept' ? 'accepted' : 'declined');
    await tell(
      o.seller_id,
      action === 'accept' ? 'offer_accepted' : 'offer_declined',
      action === 'accept' ? 'Counter offer accepted' : 'Counter offer declined',
      action === 'accept'
        ? `${user.name} accepted ${money(o.amount_cents)} for "${item.title}". They have 48 hours to buy it.`
        : `${user.name} declined your counter offer on "${item.title}".`,
    );
  } else if (!isSeller && o.status === 'pending' && action === 'cancel') {
    await move('cancelled');
  } else {
    throw new HttpError(409, 'You cannot do that with this offer');
  }
  return json({ offer: await offerJson(env, await loadOffer(env, offerId, user.id), user.id) });
}

/// ---- Profiles and follows ----
// Anyone can follow anyone. In the follows table, seller_id is the person being followed.

async function profileJson(env, profile, viewerId) {
  const [stats, rating, followers, following, iFollow, followsMe] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status = 'payoutReleased'").bind(profile.id),
    env.DB.prepare('SELECT ROUND(AVG(rating), 1) AS avg, COUNT(*) AS n FROM reviews WHERE seller_id = ?').bind(profile.id),
    env.DB.prepare('SELECT COUNT(*) AS n FROM follows WHERE seller_id = ?').bind(profile.id),
    env.DB.prepare('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?').bind(profile.id),
    env.DB.prepare('SELECT 1 AS yes FROM follows WHERE follower_id = ? AND seller_id = ?').bind(viewerId, profile.id),
    env.DB.prepare('SELECT 1 AS yes FROM follows WHERE follower_id = ? AND seller_id = ?').bind(profile.id, viewerId),
  ]);
  return {
    id: profile.id,
    name: profile.name,
    handle: `@${profile.handle}`,
    shopName: profile.shop_name,
    stallLocation: profile.stall_location,
    avatarUrl: profile.avatar_key ? `/media/${profile.avatar_key}` : null,
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    isVendor: profile.role === 'vendor',
    createdAt: iso(profile.created_at),
    salesCount: stats.results[0]?.n ?? 0,
    rating: rating.results[0]?.avg ?? null,
    reviewCount: rating.results[0]?.n ?? 0,
    followerCount: followers.results[0]?.n ?? 0,
    followingCount: following.results[0]?.n ?? 0,
    isFollowing: iFollow.results.length > 0,
    followsYou: followsMe.results.length > 0,
    isMe: profile.id === viewerId,
  };
}

/** A short person row for lists (followers, following, search). */
const personSql = (viewer) => `u.id, u.name, u.handle, u.shop_name, u.avatar_key, u.role,
  EXISTS (SELECT 1 FROM follows x WHERE x.follower_id = ${viewer} AND x.seller_id = u.id) AS i_follow,
  EXISTS (SELECT 1 FROM follows x WHERE x.follower_id = u.id AND x.seller_id = ${viewer}) AS follows_me`;
const personJson = (u, viewerId) => ({
  id: u.id,
  name: u.shop_name || u.name,
  handle: `@${u.handle}`,
  avatarUrl: u.avatar_key ? `/media/${u.avatar_key}` : null,
  isVendor: u.role === 'vendor',
  isFollowing: Boolean(u.i_follow),
  followsYou: Boolean(u.follows_me),
  isMe: u.id === viewerId,
});

/** GET /api/users/:id: anyone's page; sellers also show their listings and reviews. */
export async function getProfile(request, env, userId) {
  const user = await requireUser(request, env);
  const profile = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!profile) throw new HttpError(404, 'User not found');
  const [{ results: items }, { results: reviews }] = await env.DB.batch([
    env.DB.prepare(`${ITEM_SELECT} WHERE i.seller_id = ?2 AND i.status = 'available' ORDER BY i.created_at DESC LIMIT 60`).bind(user.id, userId),
    env.DB.prepare(
      `SELECT r.rating, r.text, r.created_at, b.name AS buyer_name, i.title AS item_title
       FROM reviews r JOIN users b ON b.id = r.buyer_id JOIN orders o ON o.id = r.order_id JOIN items i ON i.id = o.item_id
       WHERE r.seller_id = ? ORDER BY r.created_at DESC LIMIT 30`,
    ).bind(userId),
  ]);
  return json({
    profile: await profileJson(env, profile, user.id),
    items: items.map(itemJson),
    reviews: reviews.map((r) => ({ rating: r.rating, text: r.text, buyerName: r.buyer_name, itemTitle: r.item_title, createdAt: iso(r.created_at) })),
  });
}

/** GET /api/users/:id/followers and /following */
export async function followList(request, env, userId, which) {
  const user = await requireUser(request, env);
  const [join, match] = which === 'followers' ? ['f.follower_id', 'f.seller_id'] : ['f.seller_id', 'f.follower_id'];
  const { results } = await env.DB.prepare(
    `SELECT ${personSql('?1')} FROM follows f JOIN users u ON u.id = ${join} WHERE ${match} = ?2 ORDER BY f.created_at DESC LIMIT 200`,
  )
    .bind(user.id, userId)
    .all();
  return json({ users: results.map((u) => personJson(u, user.id)) });
}

/** GET /api/users?q=: people by name, shop name or @handle. */
export async function searchPeople(request, env) {
  const user = await requireUser(request, env);
  const q = (new URL(request.url).searchParams.get('q') || '').trim().replace(/^@/, '').toLowerCase().slice(0, 40);
  if (q.length < 2) return json({ users: [] });
  const { results } = await env.DB.prepare(
    `SELECT ${personSql('?1')} FROM users u
     WHERE instr(lower(u.name || ' ' || u.handle || ' ' || u.shop_name), ?2) > 0
     ORDER BY (lower(u.handle) = ?2) DESC, u.role = 'vendor' DESC, u.created_at LIMIT 20`,
  )
    .bind(user.id, q)
    .all();
  return json({ users: results.map((u) => personJson(u, user.id)) });
}

/** POST or DELETE /api/users/:id/follow */
export async function follow(request, env, userId) {
  const user = await requireUser(request, env);
  await limited(env.ACTION_LIMIT, request, user.id);
  if (userId === user.id) throw new HttpError(400, "You can't follow yourself");
  const profile = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!profile) throw new HttpError(404, 'User not found');
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND seller_id = ?').bind(user.id, userId).run();
  } else {
    const res = await env.DB.prepare('INSERT OR IGNORE INTO follows (follower_id, seller_id, created_at) VALUES (?, ?, ?)')
      .bind(user.id, userId, now())
      .run();
    // Only a brand-new follow is announced, so following and unfollowing again doesn't spam.
    const recent = await env.DB.prepare(
      "SELECT 1 FROM notifications WHERE user_id = ? AND kind = 'follow' AND body LIKE ? AND created_at > ?",
    )
      .bind(userId, `%@${user.handle}%`, now() - 24 * 60 * 60 * 1000)
      .first();
    if (res.meta.changes && !recent) {
      await notify(env, userId, {
        kind: 'follow',
        title: `${user.shop_name || user.name} followed you`,
        body: `@${user.handle} will see your new listings. Follow back from their profile.`,
      }).run();
    }
  }
  return json({ profile: await profileJson(env, profile, user.id) });
}

// ---- Reviews ----

/** POST /api/orders/:id/review { rating: 1-5, text? } (the buyer, once the order is done) */
export async function reviewOrder(request, env, orderId) {
  const user = await requireUser(request, env);
  const o = await env.DB.prepare('SELECT o.*, i.title FROM orders o JOIN items i ON i.id = o.item_id WHERE o.id = ?').bind(orderId).first();
  if (!o || o.buyer_id !== user.id) throw new HttpError(404, 'Order not found');
  if (o.status !== 'payoutReleased') throw new HttpError(409, 'You can rate the seller once you have confirmed you got it');
  const body = await readJson(request);
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Pick 1 to 5 stars');
  const text = str(body, 'text', { max: 300, optional: true });
  const res = await env.DB.prepare(
    'INSERT OR IGNORE INTO reviews (order_id, seller_id, buyer_id, rating, text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(orderId, o.seller_id, user.id, rating, text, now())
    .run();
  if (!res.meta.changes) throw new HttpError(409, 'You already rated this order');
  await notify(env, o.seller_id, {
    kind: 'review',
    title: `${rating} star${rating === 1 ? '' : 's'} from ${user.name}`,
    body: text ? `"${text}" (${o.title})` : `For "${o.title}".`,
    orderId,
    itemId: o.item_id,
  }).run();
  return json({ ok: true });
}

// ---- Chat ----

/** GET /api/chats: one row per person you have messaged, latest first, with unread counts. */
export async function listChats(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    `WITH mine AS (
       SELECT CASE WHEN sender_id = ?1 THEN recipient_id ELSE sender_id END AS other_id, text, created_at, sender_id, read_at, recipient_id
       FROM messages WHERE sender_id = ?1 OR recipient_id = ?1
     ),
     latest AS (
       SELECT other_id, MAX(created_at) AS at FROM mine GROUP BY other_id
     )
     SELECT l.other_id, l.at, m.text, m.sender_id,
       (SELECT COUNT(*) FROM messages x WHERE x.sender_id = l.other_id AND x.recipient_id = ?1 AND x.read_at IS NULL) AS unread,
       u.name, u.handle, u.shop_name, u.avatar_key
     FROM latest l JOIN mine m ON m.other_id = l.other_id AND m.created_at = l.at JOIN users u ON u.id = l.other_id
     GROUP BY l.other_id ORDER BY l.at DESC LIMIT 100`,
  )
    .bind(user.id)
    .all();
  return json({
    chats: results.map((c) => ({
      userId: c.other_id,
      name: c.shop_name || c.name,
      handle: `@${c.handle}`,
      avatarUrl: c.avatar_key ? `/media/${c.avatar_key}` : null,
      lastMessage: c.text,
      lastFromMe: c.sender_id === user.id,
      unread: c.unread,
      updatedAt: iso(c.at),
    })),
  });
}

/** GET /api/chats/:userId: the conversation (latest 200 messages); marks theirs as read. */
export async function getChat(request, env, otherId) {
  const user = await requireUser(request, env);
  const other = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(otherId).first();
  if (!other) throw new HttpError(404, 'User not found');
  const [{ results }] = await env.DB.batch([
    env.DB.prepare(
      `SELECT m.*, i.title AS item_title, i.price_cents AS item_price, i.photo_key AS item_photo FROM messages m
       LEFT JOIN items i ON i.id = m.item_id
       WHERE (m.sender_id = ?1 AND m.recipient_id = ?2) OR (m.sender_id = ?2 AND m.recipient_id = ?1)
       ORDER BY m.created_at DESC LIMIT 200`,
    ).bind(user.id, otherId),
    env.DB.prepare('UPDATE messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL').bind(now(), otherId, user.id),
  ]);
  return json({
    with: {
      userId: other.id,
      name: other.shop_name || other.name,
      handle: `@${other.handle}`,
      avatarUrl: other.avatar_key ? `/media/${other.avatar_key}` : null,
    },
    messages: results.reverse().map((m) => ({
      id: m.id,
      text: m.text,
      fromMe: m.sender_id === user.id,
      createdAt: iso(m.created_at),
      item: m.item_id
        ? { id: m.item_id, title: m.item_title, priceZar: zar(m.item_price), photoUrl: m.item_photo ? `/media/${m.item_photo}` : null }
        : null,
    })),
  });
}

/** POST /api/chats/:userId { text, itemId? } */
export async function sendMessage(request, env, otherId) {
  const user = await requireUser(request, env);
  await limited(env.ACTION_LIMIT, request, user.id);
  if (otherId === user.id) throw new HttpError(400, "You can't message yourself");
  const other = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(otherId).first();
  if (!other) throw new HttpError(404, 'User not found');
  const body = await readJson(request);
  const text = str(body, 'text', { max: 1000 });
  const itemId = typeof body.itemId === 'string' && body.itemId ? body.itemId.slice(0, 40) : null;
  if (itemId) await loadItem(env, itemId, user.id);
  const msgId = id('msg');
  await env.DB.prepare('INSERT INTO messages (id, sender_id, recipient_id, item_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(msgId, user.id, otherId, itemId, text, now())
    .run();
  return json({ ok: true, id: msgId }, 201);
}

/** Unread messages across all chats, for the app's badge. */
export async function unreadMessages(env, userId) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE recipient_id = ? AND read_at IS NULL').bind(userId).first();
  return row?.n ?? 0;
}
