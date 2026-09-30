// Listings, their photos and videos, likes, saves and comments.
import { isAdmin, requireUser } from './auth.js';
import { HttpError, id, iso, json, limited, now, rands, readJson, str, zar } from './http.js';
import { notify } from './notifications.js';

const CATEGORIES = ['Jackets', 'Denim', 'Sneakers', 'Workwear', 'Vintage Tees', 'Knitwear', 'Other'];
const MEDIA_TYPES = {
  'image/jpeg': ['image', 'jpg'],
  'image/png': ['image', 'png'],
  'image/webp': ['image', 'webp'],
  'video/mp4': ['video', 'mp4'],
  'video/quicktime': ['video', 'mov'],
  'video/webm': ['video', 'webm'],
};
const MAX_BYTES = { image: 8 * 1024 * 1024, video: 60 * 1024 * 1024 };
const MAX_MEDIA = 10;
const MAX_VIDEOS = 3;

// Everything an item card needs, with per-viewer liked/saved flags (? = viewer id).
const ITEM_SELECT = `
  SELECT i.*, u.name AS seller_name, u.handle AS seller_handle, u.shop_name, u.stall_location, u.avatar_key AS seller_avatar_key,
    (SELECT COUNT(*) FROM likes l WHERE l.item_id = i.id) AS likes_count,
    (SELECT COUNT(*) FROM comments c WHERE c.item_id = i.id) AS comments_count,
    EXISTS (SELECT 1 FROM likes l WHERE l.item_id = i.id AND l.user_id = ?1) AS is_liked,
    EXISTS (SELECT 1 FROM saves s WHERE s.item_id = i.id AND s.user_id = ?1) AS is_saved,
    (SELECT json_group_array(json_object('kind', m.kind, 'key', m.media_key))
       FROM (SELECT kind, media_key FROM item_media WHERE item_id = i.id ORDER BY position) m) AS media_json
  FROM items i JOIN users u ON u.id = i.seller_id`;

const mediaUrl = (key) => `/media/${key}`;

export function itemJson(r) {
  // Rows loaded without the media subquery (e.g. inside orders) fall back to the cover photo.
  const media = r.media_json
    ? JSON.parse(r.media_json).map((m) => ({ kind: m.kind, url: mediaUrl(m.key) }))
    : r.photo_key
      ? [{ kind: 'image', url: mediaUrl(r.photo_key) }]
      : [];
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
    // Cover image for thumbnails; `media` is the full ordered gallery.
    photoUrl: r.photo_key ? mediaUrl(r.photo_key) : null,
    media,
    sellerId: r.seller_id,
    sellerName: r.shop_name || r.seller_name,
    sellerHandle: `@${r.seller_handle}`,
    sellerLocation: r.stall_location,
    sellerAvatarUrl: r.seller_avatar_key ? mediaUrl(r.seller_avatar_key) : null,
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

/**
 * GET /api/items: available pieces, newest first, minus ones the viewer reported.
 * Optional filters: q (title, description, caption, seller), category, location (stall area).
 * `before` pages by created time.
 */
export async function listItems(request, env) {
  const user = await requireUser(request, env);
  const q = new URL(request.url).searchParams;
  const limit = Math.min(Number(q.get('limit')) || 30, 50);
  const before = Number(q.get('before')) || Number.MAX_SAFE_INTEGER;

  const where = [
    "i.status = 'available'",
    'i.created_at < ?2',
    'NOT EXISTS (SELECT 1 FROM reports r WHERE r.item_id = i.id AND r.user_id = ?1)',
  ];
  const binds = [user.id, before, limit];
  // instr() rather than LIKE, so % and _ in a search are matched literally.
  const contains = (expr, value) => {
    binds.push(value.toLowerCase());
    where.push(`instr(lower(${expr}), ?${binds.length}) > 0`);
  };
  const search = (q.get('q') || '').trim().slice(0, 60);
  if (search) contains("i.title || ' ' || i.description || ' ' || i.caption || ' ' || u.name || ' ' || u.shop_name || ' ' || u.handle", search);
  const category = q.get('category') || '';
  if (CATEGORIES.includes(category)) {
    binds.push(category);
    where.push(`i.category = ?${binds.length}`);
  }
  const location = (q.get('location') || '').trim().slice(0, 60);
  if (location) contains('u.stall_location', location);

  const { results } = await env.DB.prepare(`${ITEM_SELECT} WHERE ${where.join(' AND ')} ORDER BY i.created_at DESC LIMIT ?3`)
    .bind(...binds)
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

/**
 * The listing's gallery from `media: [{ key }]` (or a legacy single `photoKey`).
 * Keys must be this vendor's uploads; the kind comes from the key's extension.
 */
function parseMedia(body, userId) {
  const raw = Array.isArray(body.media) ? body.media : typeof body.photoKey === 'string' ? [{ key: body.photoKey }] : [];
  if (raw.length > MAX_MEDIA) throw new HttpError(400, `Add at most ${MAX_MEDIA} photos and videos`);
  const exts = Object.fromEntries(Object.values(MEDIA_TYPES).map(([kind, ext]) => [ext, kind]));
  const media = raw.map((m) => {
    const key = typeof m?.key === 'string' ? m.key : '';
    const kind = exts[key.split('.').pop()];
    if (!key.startsWith(`items/${userId}/`) || key.includes('..') || !kind) throw new HttpError(400, 'Invalid photo or video');
    return { key, kind };
  });
  if (media.filter((m) => m.kind === 'video').length > MAX_VIDEOS) throw new HttpError(400, `Add at most ${MAX_VIDEOS} videos`);
  return media;
}

/** POST /api/items (vendors only) */
export async function createItem(request, env) {
  const user = await requireUser(request, env);
  if (user.role !== 'vendor') throw new HttpError(403, 'Switch to vendor mode to list items');
  const body = await readJson(request);

  const category = str(body, 'category', { max: 30 });
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Unknown category');
  const media = parseMedia(body, user.id);
  const cover = media.find((m) => m.kind === 'image')?.key ?? null;

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

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO items (id, seller_id, title, description, caption, price_cents, original_price_cents, condition, size, category, photo_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(item.id, user.id, item.title, item.description, item.caption, item.price, item.original, item.condition, item.size, category, cover, now()),
    ...media.map((m, position) =>
      env.DB.prepare('INSERT INTO item_media (id, item_id, kind, media_key, position) VALUES (?, ?, ?, ?, ?)').bind(
        id('med'),
        item.id,
        m.kind,
        m.key,
        position,
      ),
    ),
  ]);

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

/** POST /api/uploads: raw photo or video body -> R2 key to attach to an item. */
export async function uploadMedia(request, env) {
  const user = await requireUser(request, env);
  if (user.role !== 'vendor') throw new HttpError(403, 'Switch to vendor mode to upload photos and videos');
  await limited(env.UPLOAD_LIMIT, request, user.id);
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const [kind, ext] = MEDIA_TYPES[type] || [];
  if (!kind) throw new HttpError(415, 'Use JPEG, PNG or WebP photos and MP4, MOV or WebM videos');

  const length = Number(request.headers.get('content-length'));
  const limitMb = MAX_BYTES[kind] / 1024 / 1024;
  if (!length) throw new HttpError(411, 'Upload size is missing');
  if (length > MAX_BYTES[kind]) throw new HttpError(413, `That ${kind} is too large (max ${limitMb} MB)`);

  // Stream the body into R2 rather than buffering a whole video in memory.
  const key = `items/${user.id}/${crypto.randomUUID()}.${ext}`;
  await env.PHOTOS.put(key, request.body, { httpMetadata: { contentType: type } });
  // Recorded so uploads never attached to a listing can be deleted (see cleanup()).
  await env.DB.prepare('INSERT INTO uploads (media_key, user_id, created_at) VALUES (?, ?, ?)').bind(key, user.id, now()).run();
  return json({ key, kind, url: mediaUrl(key) }, 201);
}

/**
 * GET /media/:key (and legacy /photos/:key): public and immutable, since keys
 * are never reused. Supports Range requests, which video players rely on.
 */
export async function serveMedia(request, env, key) {
  if (!/^(items|avatars)\//.test(key) || key.includes('..')) throw new HttpError(404, 'Not found');
  // bytes=start-end, bytes=start- or bytes=-suffix (single ranges only).
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  let range;
  if (m && m[1]) range = m[2] && +m[2] >= +m[1] ? { offset: +m[1], length: +m[2] - +m[1] + 1 } : { offset: +m[1] };
  else if (m && m[2]) range = { suffix: +m[2] };
  const obj = await env.PHOTOS.get(key, range ? { range } : undefined);
  if (!obj) throw new HttpError(404, 'Not found');

  const headers = new Headers({
    'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
    etag: obj.httpEtag,
  });
  if (range) {
    const size = obj.size;
    const offset = range.suffix !== undefined ? Math.max(size - range.suffix, 0) : range.offset;
    if (offset >= size) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    }
    const length = Math.min(range.length ?? size - offset, size - offset);
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${size}`);
    headers.set('content-length', String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(obj.body, { headers });
}

async function toggle(request, env, itemId, table) {
  const user = await requireUser(request, env);
  await limited(env.ACTION_LIMIT, request, user.id);
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
  const user = await requireUser(request, env);
  await loadItem(env, itemId, user.id);
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
  await limited(env.ACTION_LIMIT, request, user.id);
  const item = await loadItem(env, itemId, user.id);
  const text = str(await readJson(request), 'text', { max: 300 });
  const comment = { id: id('cmt'), created_at: now() };
  await env.DB.batch([
    env.DB.prepare('INSERT INTO comments (id, item_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)').bind(
      comment.id,
      itemId,
      user.id,
      text,
      comment.created_at,
    ),
    ...(item.seller_id === user.id
      ? []
      : [
          notify(env, item.seller_id, {
            kind: 'comment',
            title: `New comment on "${item.title}"`,
            body: `${user.name}: ${text.length > 120 ? `${text.slice(0, 117)}...` : text}`,
            itemId,
          }),
        ]),
  ]);
  return json({ comment: { id: comment.id, text, name: user.name, handle: `@${user.handle}`, createdAt: iso(comment.created_at) } }, 201);
}

const REPORT_REASONS = ['Fake or counterfeit', 'Misleading photos or description', 'Prohibited item', 'Scam or spam', 'Offensive'];

/** POST /api/items/:id/report { reason }: hides the listing for the reporter and queues it for admins. */
export async function reportItem(request, env, itemId) {
  const user = await requireUser(request, env);
  await limited(env.ACTION_LIMIT, request, user.id);
  const item = await loadItem(env, itemId, user.id);
  if (item.seller_id === user.id) throw new HttpError(400, "You can't report your own listing");
  const reason = str(await readJson(request), 'reason', { max: 60 });
  if (!REPORT_REASONS.includes(reason)) throw new HttpError(400, 'Pick a reason');
  await env.DB.prepare('INSERT OR IGNORE INTO reports (item_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)')
    .bind(itemId, user.id, reason, now())
    .run();
  return json({ ok: true });
}

/** GET /api/admin/reports (admins): reported listings still up, most reported first. */
export async function listReports(request, env) {
  const user = await requireUser(request, env);
  if (!isAdmin(env, user)) throw new HttpError(403, 'Admins only');
  const [{ results: counts }, { results: rows }] = await env.DB.batch([
    env.DB.prepare('SELECT item_id, COUNT(*) AS n, group_concat(DISTINCT reason) AS reasons FROM reports GROUP BY item_id'),
    env.DB.prepare(`${ITEM_SELECT} WHERE i.status = 'available' AND i.id IN (SELECT item_id FROM reports)`).bind(user.id),
  ]);
  const byItem = new Map(counts.map((c) => [c.item_id, c]));
  const items = rows
    .map((r) => ({ ...itemJson(r), reports: byItem.get(r.id).n, reportReasons: byItem.get(r.id).reasons.split(',') }))
    .sort((a, b) => b.reports - a.reports)
    .slice(0, 100);
  return json({ items });
}

/** POST /api/admin/items/:id/remove or /dismiss (admins): take a reported listing down, or clear its reports. */
export async function moderateItem(request, env, itemId, action) {
  const user = await requireUser(request, env);
  if (!isAdmin(env, user)) throw new HttpError(403, 'Admins only');
  const item = await loadItem(env, itemId, user.id);
  await env.DB.batch([
    ...(action === 'remove'
      ? [
          env.DB.prepare("UPDATE items SET status = 'removed' WHERE id = ? AND status = 'available'").bind(itemId),
          notify(env, item.seller_id, {
            kind: 'removed',
            title: 'Listing removed',
            body: `"${item.title}" was taken down after reports from other users.`,
            itemId,
          }),
        ]
      : []),
    env.DB.prepare('DELETE FROM reports WHERE item_id = ?').bind(itemId),
  ]);
  return json({ ok: true });
}

/**
 * Daily (the cron in wrangler.jsonc): deletes expired sessions, and uploads
 * not attached to a listing within a day.
 */
export async function cleanup(env) {
  const dayAgo = now() - 24 * 60 * 60 * 1000;
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()).run();
  const { results } = await env.DB.prepare(
    `SELECT media_key FROM uploads u WHERE u.created_at < ?
       AND NOT EXISTS (SELECT 1 FROM item_media m WHERE m.media_key = u.media_key) LIMIT 500`,
  )
    .bind(dayAgo)
    .all();
  const orphans = results.map((r) => r.media_key);
  if (orphans.length) {
    await env.PHOTOS.delete(orphans);
    await env.DB.batch(orphans.map((k) => env.DB.prepare('DELETE FROM uploads WHERE media_key = ?').bind(k)));
  }
  // Attached uploads no longer need tracking.
  await env.DB.prepare(
    'DELETE FROM uploads WHERE created_at < ? AND EXISTS (SELECT 1 FROM item_media m WHERE m.media_key = uploads.media_key)',
  )
    .bind(dayAgo)
    .run();
  return orphans.length;
}

export { loadItem };
