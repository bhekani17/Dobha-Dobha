// Listings, photos, likes, saves and comments.
import { requireUser } from './auth.js';
import { HttpError, id, iso, json, now, rands, readJson, str, zar } from './http.js';

const CATEGORIES = ['Jackets', 'Denim', 'Sneakers', 'Workwear', 'Vintage Tees', 'Knitwear', 'Other'];
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

// Everything an item card needs, with per-viewer liked/saved flags (? = viewer id).
const ITEM_SELECT = `
  SELECT i.*, u.name AS seller_name, u.handle AS seller_handle, u.shop_name, u.stall_location,
    (SELECT COUNT(*) FROM likes l WHERE l.item_id = i.id) AS likes_count,
    (SELECT COUNT(*) FROM comments c WHERE c.item_id = i.id) AS comments_count,
    EXISTS (SELECT 1 FROM likes l WHERE l.item_id = i.id AND l.user_id = ?1) AS is_liked,
    EXISTS (SELECT 1 FROM saves s WHERE s.item_id = i.id AND s.user_id = ?1) AS is_saved
  FROM items i JOIN users u ON u.id = i.seller_id`;

export function itemJson(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    haulCaption: r.caption,
    priceZar: zar(r.price_cents),
    originalPriceZar: zar(r.original_price_cents),
    condition: r.condition,
    size: r.size,
    category: r.category,
    photoUrl: r.photo_key ? `/photos/${r.photo_key}` : null,
    sellerId: r.seller_id,
    sellerName: r.shop_name || r.seller_name,
    sellerHandle: `@${r.seller_handle}`,
    sellerLocation: r.stall_location,
    likesCount: r.likes_count ?? 0,
    commentsCount: r.comments_count ?? 0,
    isLiked: Boolean(r.is_liked),
    isSaved: Boolean(r.is_saved),
    isClaimed: r.status === 'sold',
    createdAt: iso(r.created_at),
  };
}

async function loadItem(env, itemId, viewerId) {
  const row = await env.DB.prepare(`${ITEM_SELECT} WHERE i.id = ?2`).bind(viewerId, itemId).first();
  if (!row || row.status === 'removed') throw new HttpError(404, 'Item not found');
  return row;
}

/** GET /api/items: the feed of available pieces, newest first. `before` pages by created time. */
export async function listItems(request, env) {
  const user = await requireUser(request, env);
  const q = new URL(request.url).searchParams;
  const limit = Math.min(Number(q.get('limit')) || 30, 50);
  const before = Number(q.get('before')) || Number.MAX_SAFE_INTEGER;
  const { results } = await env.DB.prepare(
    `${ITEM_SELECT} WHERE i.status = 'available' AND i.created_at < ?2 ORDER BY i.created_at DESC LIMIT ?3`,
  )
    .bind(user.id, before, limit)
    .all();
  return json({ items: results.map(itemJson) });
}

/** GET /api/items/:id */
export async function getItem(request, env, itemId) {
  const user = await requireUser(request, env);
  return json({ item: itemJson(await loadItem(env, itemId, user.id)) });
}

/** GET /api/items/mine: a vendor's own listings, sold ones included. */
export async function myItems(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    `${ITEM_SELECT} WHERE i.seller_id = ?1 AND i.status != 'removed' ORDER BY i.created_at DESC`,
  )
    .bind(user.id)
    .all();
  return json({ items: results.map(itemJson) });
}

/** GET /api/saved */
export async function savedItems(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    `${ITEM_SELECT} JOIN saves sv ON sv.item_id = i.id AND sv.user_id = ?1
     WHERE i.status != 'removed' ORDER BY sv.created_at DESC`,
  )
    .bind(user.id)
    .all();
  return json({ items: results.map(itemJson) });
}

/** POST /api/items (vendors only) */
export async function createItem(request, env) {
  const user = await requireUser(request, env);
  if (user.role !== 'vendor') throw new HttpError(403, 'Switch to vendor mode to list items');
  const body = await readJson(request);

  const category = str(body, 'category', { max: 30 });
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Unknown category');
  const photoKey = typeof body.photoKey === 'string' ? body.photoKey : null;
  // Only accept photos this vendor uploaded.
  if (photoKey && !photoKey.startsWith(`items/${user.id}/`)) throw new HttpError(400, 'Invalid photo');

  const item = {
    id: id('itm'),
    title: str(body, 'title', { min: 3, max: 80 }),
    description: str(body, 'description', { max: 1000, optional: true }),
    caption: str(body, 'caption', { max: 200, optional: true }),
    price: rands(body, 'priceZar'),
    original: body.originalPriceZar ? rands(body, 'originalPriceZar') : null,
    condition: str(body, 'condition', { max: 40 }),
    size: str(body, 'size', { max: 20 }),
  };

  await env.DB.prepare(
    `INSERT INTO items (id, seller_id, title, description, caption, price_cents, original_price_cents, condition, size, category, photo_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(item.id, user.id, item.title, item.description, item.caption, item.price, item.original, item.condition, item.size, category, photoKey, now())
    .run();

  return json({ item: itemJson(await loadItem(env, item.id, user.id)) }, 201);
}

/** DELETE /api/items/:id (the seller, while unsold) */
export async function removeItem(request, env, itemId) {
  const user = await requireUser(request, env);
  const res = await env.DB.prepare("UPDATE items SET status = 'removed' WHERE id = ? AND seller_id = ? AND status = 'available'")
    .bind(itemId, user.id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Item not found or already sold');
  return json({ ok: true });
}

/** POST /api/uploads: raw image body -> R2 key to attach to an item. */
export async function uploadPhoto(request, env) {
  const user = await requireUser(request, env);
  if (user.role !== 'vendor') throw new HttpError(403, 'Switch to vendor mode to upload photos');
  const type = (request.headers.get('content-type') || '').split(';')[0].trim();
  const ext = PHOTO_TYPES[type];
  if (!ext) throw new HttpError(415, 'Photos must be JPEG, PNG or WebP');
  if (Number(request.headers.get('content-length')) > PHOTO_MAX_BYTES) throw new HttpError(413, 'Photo is too large (max 5 MB)');

  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) throw new HttpError(400, 'Empty photo');
  if (bytes.byteLength > PHOTO_MAX_BYTES) throw new HttpError(413, 'Photo is too large (max 5 MB)');

  const key = `items/${user.id}/${crypto.randomUUID()}.${ext}`;
  await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: type } });
  return json({ key, url: `/photos/${key}` }, 201);
}

/** GET /photos/:key: public, immutable (keys are never reused). */
export async function servePhoto(env, key) {
  if (!key.startsWith('items/')) throw new HttpError(404, 'Not found');
  const obj = await env.PHOTOS.get(key);
  if (!obj) throw new HttpError(404, 'Not found');
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      etag: obj.httpEtag,
    },
  });
}

async function toggle(request, env, itemId, table) {
  const user = await requireUser(request, env);
  await loadItem(env, itemId, user.id);
  const existing = await env.DB.prepare(`SELECT 1 FROM ${table} WHERE user_id = ? AND item_id = ?`).bind(user.id, itemId).first();
  if (existing) {
    await env.DB.prepare(`DELETE FROM ${table} WHERE user_id = ? AND item_id = ?`).bind(user.id, itemId).run();
  } else if (table === 'saves') {
    await env.DB.prepare('INSERT INTO saves (user_id, item_id, created_at) VALUES (?, ?, ?)').bind(user.id, itemId, now()).run();
  } else {
    await env.DB.prepare('INSERT INTO likes (user_id, item_id) VALUES (?, ?)').bind(user.id, itemId).run();
  }
  return json({ item: itemJson(await loadItem(env, itemId, user.id)) });
}

export const toggleLike = (request, env, itemId) => toggle(request, env, itemId, 'likes');
export const toggleSave = (request, env, itemId) => toggle(request, env, itemId, 'saves');

/** GET /api/items/:id/comments */
export async function listComments(request, env, itemId) {
  await requireUser(request, env);
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.text, c.created_at, u.name, u.handle FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.item_id = ? ORDER BY c.created_at DESC LIMIT 100`,
  )
    .bind(itemId)
    .all();
  return json({
    comments: results.map((c) => ({ id: c.id, text: c.text, name: c.name, handle: `@${c.handle}`, createdAt: iso(c.created_at) })),
  });
}

/** POST /api/items/:id/comments */
export async function addComment(request, env, itemId) {
  const user = await requireUser(request, env);
  await loadItem(env, itemId, user.id);
  const text = str(await readJson(request), 'text', { max: 300 });
  const comment = { id: id('cmt'), created_at: now() };
  await env.DB.prepare('INSERT INTO comments (id, item_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(comment.id, itemId, user.id, text, comment.created_at)
    .run();
  return json({ comment: { id: comment.id, text, name: user.name, handle: `@${user.handle}`, createdAt: iso(comment.created_at) } }, 201);
}

export { loadItem };
