'use strict';

const dynamo = require('../utils/dynamo');
const { json, error, handleCors, parseBody } = require('../utils/response');
const { getUser, requireUser } = require('../utils/auth');
const { id, now, zar, toCents } = require('../utils/id');

function formatItem(item, seller = null, viewerId = null, isLiked = false, isSaved = false) {
  const sellerInfo = seller || {
    id: item.seller_id,
    name: item.seller_name || 'Vendor',
    handle: item.seller_handle || 'vendor',
    shopName: item.shop_name || '',
    stallLocation: item.stall_location || '',
    avatarUrl: item.seller_avatar ? `/media/${item.seller_avatar}` : null,
  };

  return {
    id: item.id,
    title: item.title,
    description: item.description || '',
    priceCents: item.price_cents,
    priceZar: zar(item.price_cents),
    photos: item.photos || (item.photo_keys ? item.photo_keys.map((k) => `/media/${k}`) : []),
    category: item.category || 'General',
    condition: item.condition || 'Pre-loved',
    size: item.size || 'One Size',
    brand: item.brand || 'Vintage',
    status: item.status || 'available',
    quantity: item.quantity !== undefined ? item.quantity : 1,
    tags: item.tags || [],
    isPromoted: Boolean(item.is_promoted && (!item.promoted_until || item.promoted_until > now())),
    promotedUntil: item.promoted_until || null,
    liveRoom: item.live_room || null,
    likesCount: item.likes_count || 0,
    isLiked: Boolean(isLiked),
    isSaved: Boolean(isSaved),
    createdAt: item.created_at ? new Date(item.created_at).toISOString() : null,
    seller: sellerInfo,
  };
}

exports.handler = async (event) => {
  const cors = handleCors(event);
  if (cors) return cors;

  const itemsTable = process.env.ITEMS_TABLE;
  const usersTable = process.env.USERS_TABLE;
  const likesTable = process.env.LIKES_TABLE;
  const savesTable = process.env.SAVES_TABLE;
  const commentsTable = process.env.COMMENTS_TABLE;
  const walletsTable = process.env.WALLET_TABLE || process.env.WALLETS_TABLE;
  const transactionsTable = process.env.TRANSACTIONS_TABLE;

  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const method = (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '').toUpperCase();
  const queryParams = event.queryStringParameters || {};

  try {
    const user = await getUser(event);

    // -------------------------------------------------------------
    // GET /api/items: Explore feed & digital storefront items
    // -------------------------------------------------------------
    if (path === '/api/items' && method === 'GET') {
      const sellerId = queryParams.sellerId || queryParams.seller_id;
      const category = queryParams.category;
      const search = (queryParams.q || queryParams.search || '').toLowerCase();
      const status = queryParams.status || 'available';

      let items = [];

      if (sellerId) {
        // Query items for specific digital storefront
        const res = await dynamo.query({
          TableName: itemsTable,
          IndexName: 'SellerIndex',
          KeyConditionExpression: 'seller_id = :sid',
          ExpressionAttributeValues: { ':sid': sellerId },
          ScanIndexForward: false,
          Limit: 100,
        });
        items = res.items;
      } else {
        // Feed query
        const res = await dynamo.query({
          TableName: itemsTable,
          IndexName: 'FeedIndex',
          KeyConditionExpression: '#st = :status',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: { ':status': status },
          ScanIndexForward: false,
          Limit: 100,
        });
        items = res.items;
      }

      // Filter by category if requested
      if (category) {
        items = items.filter((i) => (i.category || '').toLowerCase() === category.toLowerCase());
      }

      // Filter by keyword search if requested
      if (search) {
        items = items.filter((i) => {
          const t = (i.title || '').toLowerCase();
          const d = (i.description || '').toLowerCase();
          const b = (i.brand || '').toLowerCase();
          const tags = Array.isArray(i.tags) ? i.tags.join(' ').toLowerCase() : '';
          return t.includes(search) || d.includes(search) || b.includes(search) || tags.includes(search);
        });
      }

      // Sort promoted / ad placements to top
      items.sort((a, b) => {
        const aPromo = a.is_promoted && (!a.promoted_until || a.promoted_until > now()) ? 1 : 0;
        const bPromo = b.is_promoted && (!b.promoted_until || b.promoted_until > now()) ? 1 : 0;
        if (aPromo !== bPromo) return bPromo - aPromo;
        return (b.created_at || 0) - (a.created_at || 0);
      });

      // Enrich with like/save status if user signed in
      const formatted = await Promise.all(
        items.map(async (item) => {
          let isLiked = false;
          let isSaved = false;
          if (user) {
            if (likesTable) {
              const lk = await dynamo.get(likesTable, { user_id: user.id, item_id: item.id });
              isLiked = Boolean(lk);
            }
            if (savesTable) {
              const sv = await dynamo.get(savesTable, { user_id: user.id, item_id: item.id });
              isSaved = Boolean(sv);
            }
          }
          return formatItem(item, null, user ? user.id : null, isLiked, isSaved);
        })
      );

      return json(200, { items: formatted });
    }

    // -------------------------------------------------------------
    // POST /api/items: Create a new thrift listing
    // -------------------------------------------------------------
    if (path === '/api/items' && method === 'POST') {
      const authUser = await requireUser(event);
      const body = parseBody(event);

      const title = (body.title || '').trim();
      const description = (body.description || '').trim();
      const priceZar = body.priceZar || body.price;
      const priceCents = body.priceCents || toCents(priceZar);
      const photos = Array.isArray(body.photos) ? body.photos : [];
      const category = (body.category || 'Vintage').trim();
      const condition = (body.condition || 'Grade A Thrift').trim();
      const size = (body.size || 'M').trim();
      const brand = (body.brand || 'Vintage').trim();
      const quantity = Math.max(1, parseInt(body.quantity || 1, 10));
      const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim().toLowerCase()) : [];
      const liveRoom = body.liveRoom || body.live_room || null;

      if (!title || title.length < 3) return error(400, 'Title must be at least 3 characters');
      if (priceCents < 500) return error(400, 'Price must be at least R5.00');

      const itemId = id('itm');
      const timestamp = now();

      const newItem = {
        id: itemId,
        seller_id: authUser.id,
        seller_name: authUser.shop_name || authUser.name,
        seller_handle: authUser.handle,
        shop_name: authUser.shop_name || '',
        stall_location: authUser.stall_location || '',
        title,
        description,
        price_cents: priceCents,
        photos,
        category,
        condition,
        size,
        brand,
        quantity,
        status: 'available',
        tags,
        live_room: liveRoom,
        likes_count: 0,
        is_promoted: false,
        created_at: timestamp,
        updated_at: timestamp,
      };

      await dynamo.put(itemsTable, newItem);

      return json(201, {
        message: 'Item listed successfully',
        item: formatItem(newItem, {
          id: authUser.id,
          name: authUser.shop_name || authUser.name,
          handle: authUser.handle,
          shopName: authUser.shop_name || '',
          stallLocation: authUser.stall_location || '',
        }, authUser.id),
      });
    }

    // -------------------------------------------------------------
    // GET /api/items/mine: List authenticated vendor's listings
    // -------------------------------------------------------------
    if (path === '/api/items/mine' && method === 'GET') {
      const authUser = await requireUser(event);
      const res = await dynamo.query({
        TableName: itemsTable,
        IndexName: 'SellerIndex',
        KeyConditionExpression: 'seller_id = :sid',
        ExpressionAttributeValues: { ':sid': authUser.id },
        ScanIndexForward: false,
      });

      const formatted = res.items.map((i) => formatItem(i, null, authUser.id));
      return json(200, { items: formatted });
    }

    // -------------------------------------------------------------
    // GET /api/items/{id}: View item details & seller storefront
    // -------------------------------------------------------------
    const itemMatch = path.match(/^\/api\/items\/([^\/]+)$/);
    if (itemMatch && method === 'GET') {
      const itemId = itemMatch[1];
      const item = await dynamo.get(itemsTable, { id: itemId });
      if (!item) return error(404, 'Item not found');

      let seller = null;
      if (usersTable) {
        seller = await dynamo.get(usersTable, { id: item.seller_id });
      }

      let isLiked = false;
      let isSaved = false;
      if (user) {
        if (likesTable) {
          const lk = await dynamo.get(likesTable, { user_id: user.id, item_id: item.id });
          isLiked = Boolean(lk);
        }
        if (savesTable) {
          const sv = await dynamo.get(savesTable, { user_id: user.id, item_id: item.id });
          isSaved = Boolean(sv);
        }
      }

      return json(200, {
        item: formatItem(item, seller, user ? user.id : null, isLiked, isSaved),
      });
    }

    // -------------------------------------------------------------
    // PATCH /api/items/{id}: Update listing details
    // -------------------------------------------------------------
    if (itemMatch && method === 'PATCH') {
      const authUser = await requireUser(event);
      const itemId = itemMatch[1];
      const item = await dynamo.get(itemsTable, { id: itemId });
      if (!item) return error(404, 'Item not found');
      if (item.seller_id !== authUser.id && authUser.role !== 'admin') {
        return error(403, 'You can only update your own listings');
      }

      const body = parseBody(event);
      const updates = [];
      const attrNames = {};
      const attrValues = { ':time': now() };

      if (body.title !== undefined) {
        updates.push('#title = :title');
        attrNames['#title'] = 'title';
        attrValues[':title'] = String(body.title).trim();
      }
      if (body.description !== undefined) {
        updates.push('#description = :description');
        attrNames['#description'] = 'description';
        attrValues[':description'] = String(body.description).trim();
      }
      if (body.priceZar !== undefined || body.priceCents !== undefined) {
        const cents = body.priceCents || toCents(body.priceZar);
        updates.push('price_cents = :price');
        attrValues[':price'] = cents;
      }
      if (body.quantity !== undefined) {
        updates.push('quantity = :qty');
        attrValues[':qty'] = Number(body.quantity);
      }
      if (body.status !== undefined) {
        updates.push('#st = :status');
        attrNames['#st'] = 'status';
        attrValues[':status'] = body.status;
      }
      if (body.photos !== undefined && Array.isArray(body.photos)) {
        updates.push('photos = :photos');
        attrValues[':photos'] = body.photos;
      }

      if (updates.length > 0) {
        updates.push('updated_at = :time');
        await dynamo.update({
          TableName: itemsTable,
          Key: { id: itemId },
          UpdateExpression: 'SET ' + updates.join(', '),
          ExpressionAttributeNames: Object.keys(attrNames).length ? attrNames : undefined,
          ExpressionAttributeValues: attrValues,
        });
      }

      const updated = await dynamo.get(itemsTable, { id: itemId });
      return json(200, {
        message: 'Item updated successfully',
        item: formatItem(updated, null, authUser.id),
      });
    }

    // -------------------------------------------------------------
    // DELETE /api/items/{id}: Remove listing
    // -------------------------------------------------------------
    if (itemMatch && method === 'DELETE') {
      const authUser = await requireUser(event);
      const itemId = itemMatch[1];
      const item = await dynamo.get(itemsTable, { id: itemId });
      if (!item) return error(404, 'Item not found');
      if (item.seller_id !== authUser.id && authUser.role !== 'admin') {
        return error(403, 'You can only delete your own listings');
      }

      await dynamo.delete(itemsTable, { id: itemId });
      return json(200, { message: 'Item deleted successfully' });
    }

    // -------------------------------------------------------------
    // POST /api/items/{id}/like: Toggle like
    // -------------------------------------------------------------
    const likeMatch = path.match(/^\/api\/items\/([^\/]+)\/like$/);
    if (likeMatch && method === 'POST') {
      const authUser = await requireUser(event);
      const itemId = likeMatch[1];

      const existing = await dynamo.get(likesTable, { user_id: authUser.id, item_id: itemId });
      if (existing) {
        // Unlike
        await dynamo.delete(likesTable, { user_id: authUser.id, item_id: itemId });
        await dynamo.update({
          TableName: itemsTable,
          Key: { id: itemId },
          UpdateExpression: 'SET likes_count = if_not_exists(likes_count, :one) - :one',
          ExpressionAttributeValues: { ':one': 1 },
        }).catch(() => {});
        return json(200, { liked: false });
      } else {
        // Like
        await dynamo.put(likesTable, {
          user_id: authUser.id,
          item_id: itemId,
          created_at: now(),
        });
        await dynamo.update({
          TableName: itemsTable,
          Key: { id: itemId },
          UpdateExpression: 'SET likes_count = if_not_exists(likes_count, :zero) + :one',
          ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
        }).catch(() => {});
        return json(200, { liked: true });
      }
    }

    // -------------------------------------------------------------
    // POST /api/items/{id}/save: Toggle saved piece
    // -------------------------------------------------------------
    const saveMatch = path.match(/^\/api\/items\/([^\/]+)\/save$/);
    if (saveMatch && method === 'POST') {
      const authUser = await requireUser(event);
      const itemId = saveMatch[1];

      const existing = await dynamo.get(savesTable, { user_id: authUser.id, item_id: itemId });
      if (existing) {
        await dynamo.delete(savesTable, { user_id: authUser.id, item_id: itemId });
        return json(200, { saved: false });
      } else {
        await dynamo.put(savesTable, {
          user_id: authUser.id,
          item_id: itemId,
          created_at: now(),
        });
        return json(200, { saved: true });
      }
    }

    // -------------------------------------------------------------
    // POST /api/items/{id}/promote: Promotional Ad Placement (Feature 4)
    // -------------------------------------------------------------
    const promoteMatch = path.match(/^\/api\/items\/([^\/]+)\/promote$/);
    if (promoteMatch && method === 'POST') {
      const authUser = await requireUser(event);
      const itemId = promoteMatch[1];
      const item = await dynamo.get(itemsTable, { id: itemId });
      if (!item) return error(404, 'Item not found');
      if (item.seller_id !== authUser.id) return error(403, 'You can only promote your own listings');

      const body = parseBody(event);
      const durationDays = parseInt(body.durationDays || body.days || 7, 10);
      const costPerDayCents = 1500; // R15.00/day ad placement
      const totalCostCents = durationDays * costPerDayCents;

      // Deduct from wallet if available
      if (walletsTable) {
        const wallet = await dynamo.get(walletsTable, { user_id: authUser.id });
        if (!wallet || (wallet.available_cents || 0) < totalCostCents) {
          return error(402, `Insufficient wallet balance to promote. Cost is ${zar(totalCostCents)} for ${durationDays} days.`);
        }

        await dynamo.update({
          TableName: walletsTable,
          Key: { user_id: authUser.id },
          UpdateExpression: 'SET available_cents = available_cents - :cost, updated_at = :time',
          ConditionExpression: 'available_cents >= :cost',
          ExpressionAttributeValues: { ':cost': totalCostCents, ':time': now() },
        });

        if (transactionsTable) {
          await dynamo.put(transactionsTable, {
            id: id('txn'),
            user_id: authUser.id,
            title: `Ad Placement: Promoted "${item.title}"`,
            subtitle: `${durationDays} days featured boost in feed`,
            amount_cents: totalCostCents,
            type: 'ad_placement',
            status: 'Completed',
            reference: `AD-${10000 + Math.floor(Math.random() * 90000)}`,
            created_at: now(),
          });
        }
      }

      const promotedUntil = now() + (durationDays * 24 * 3600 * 1000);
      await dynamo.update({
        TableName: itemsTable,
        Key: { id: itemId },
        UpdateExpression: 'SET is_promoted = :promoted, promoted_until = :until, updated_at = :time',
        ExpressionAttributeValues: {
          ':promoted': true,
          ':until': promotedUntil,
          ':time': now(),
        },
      });

      return json(200, {
        message: `Listing promoted for ${durationDays} days! Increased visibility in feed.`,
        promotedUntil: new Date(promotedUntil).toISOString(),
      });
    }

    // -------------------------------------------------------------
    // GET /api/items/{id}/comments & POST /api/items/{id}/comments
    // -------------------------------------------------------------
    const commentsMatch = path.match(/^\/api\/items\/([^\/]+)\/comments$/);
    if (commentsMatch) {
      const itemId = commentsMatch[1];
      if (method === 'GET') {
        const res = await dynamo.query({
          TableName: commentsTable,
          IndexName: 'ItemIndex',
          KeyConditionExpression: 'item_id = :iid',
          ExpressionAttributeValues: { ':iid': itemId },
          ScanIndexForward: true,
          Limit: 100,
        });
        return json(200, { comments: res.items });
      }

      if (method === 'POST') {
        const authUser = await requireUser(event);
        const body = parseBody(event);
        const text = (body.text || '').trim();
        if (!text) return error(400, 'Comment text is required');

        const commentId = id('cmt');
        const newComment = {
          id: commentId,
          item_id: itemId,
          user_id: authUser.id,
          user_name: authUser.shop_name || authUser.name,
          user_handle: authUser.handle,
          text,
          created_at: now(),
        };

        await dynamo.put(commentsTable, newComment);
        return json(201, { comment: newComment });
      }
    }

    // -------------------------------------------------------------
    // GET /api/saved: List user saved thrift pieces
    // -------------------------------------------------------------
    if (path === '/api/saved' && method === 'GET') {
      const authUser = await requireUser(event);
      const res = await dynamo.query({
        TableName: savesTable,
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: { ':uid': authUser.id },
      });

      const itemIds = res.items.map((s) => s.item_id);
      const items = [];
      for (const iid of itemIds) {
        const itm = await dynamo.get(itemsTable, { id: iid });
        if (itm) items.push(formatItem(itm, null, authUser.id, false, true));
      }

      return json(200, { items });
    }

    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Items handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
};
