'use strict';

const dynamo = require('../utils/dynamo');
const { json, error, handleCors, parseBody } = require('../utils/response');
const { getUser, requireUser } = require('../utils/auth');
const { id, now, zar, toCents } = require('../utils/id');

exports.handler = async (event) => {
  const cors = handleCors(event);
  if (cors) return cors;

  const cartTable = process.env.CART_TABLE;
  const offersTable = process.env.OFFERS_TABLE;
  const followsTable = process.env.FOLLOWS_TABLE;
  const messagesTable = process.env.MESSAGES_TABLE;
  const reviewsTable = process.env.REVIEWS_TABLE;
  const usersTable = process.env.USERS_TABLE;
  const itemsTable = process.env.ITEMS_TABLE;

  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const method = (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '').toUpperCase();
  const queryParams = event.queryStringParameters || {};

  try {
    const user = await getUser(event);

    // -------------------------------------------------------------
    // GET /api/users: Search vendor profiles & community members
    // -------------------------------------------------------------
    if (path === '/api/users' && method === 'GET') {
      const search = (queryParams.q || queryParams.search || '').toLowerCase();
      const roleFilter = queryParams.role; // 'vendor'

      const res = await dynamo.scan({
        TableName: usersTable,
        Limit: 100,
      });

      let profiles = res.items.filter((u) => !u.is_deleted);
      if (roleFilter) {
        profiles = profiles.filter((u) => u.role === roleFilter);
      }
      if (search) {
        profiles = profiles.filter((u) => {
          const n = (u.name || '').toLowerCase();
          const h = (u.handle || '').toLowerCase();
          const s = (u.shop_name || '').toLowerCase();
          const l = (u.stall_location || '').toLowerCase();
          return n.includes(search) || h.includes(search) || s.includes(search) || l.includes(search);
        });
      }

      return json(200, {
        users: profiles.map((u) => ({
          id: u.id,
          name: u.name,
          handle: u.handle,
          role: u.role || 'buyer',
          shopName: u.shop_name || '',
          stallLocation: u.stall_location || '',
          bio: u.bio || '',
          avatarUrl: u.avatar_key ? `/media/${u.avatar_key}` : (u.avatar_url || null),
        })),
      });
    }

    // -------------------------------------------------------------
    // GET /api/users/{id}: Detailed vendor digital storefront & profile
    // -------------------------------------------------------------
    const userMatch = path.match(/^\/api\/users\/([^\/]+)$/);
    if (userMatch && method === 'GET') {
      const targetUserId = userMatch[1];
      const targetUser = await dynamo.get(usersTable, { id: targetUserId });
      if (!targetUser || targetUser.is_deleted) return error(404, 'User profile not found');

      // Count followers and following
      const followersRes = await dynamo.query({
        TableName: followsTable,
        IndexName: 'SellerIndex',
        KeyConditionExpression: 'seller_id = :sid',
        ExpressionAttributeValues: { ':sid': targetUserId },
      });
      const followingRes = await dynamo.query({
        TableName: followsTable,
        KeyConditionExpression: 'follower_id = :fid',
        ExpressionAttributeValues: { ':fid': targetUserId },
      });

      // Reviews summary for vendor
      const reviewsRes = await dynamo.query({
        TableName: reviewsTable,
        IndexName: 'SellerIndex',
        KeyConditionExpression: 'seller_id = :sid',
        ExpressionAttributeValues: { ':sid': targetUserId },
      });

      let averageRating = null;
      if (reviewsRes.items.length > 0) {
        const sum = reviewsRes.items.reduce((acc, r) => acc + (r.rating || 5), 0);
        averageRating = Number((sum / reviewsRes.items.length).toFixed(1));
      }

      // Check if current user follows this profile
      let isFollowing = false;
      if (user) {
        const followRec = await dynamo.get(followsTable, {
          follower_id: user.id,
          seller_id: targetUserId,
        });
        isFollowing = Boolean(followRec);
      }

      // Get vendor's active listings
      let listings = [];
      if (itemsTable) {
        const itemsRes = await dynamo.query({
          TableName: itemsTable,
          IndexName: 'SellerIndex',
          KeyConditionExpression: 'seller_id = :sid',
          ExpressionAttributeValues: { ':sid': targetUserId },
          ScanIndexForward: false,
          Limit: 50,
        });
        listings = itemsRes.items.filter((i) => i.status === 'available');
      }

      return json(200, {
        profile: {
          id: targetUser.id,
          name: targetUser.name,
          handle: targetUser.handle,
          role: targetUser.role || 'buyer',
          shopName: targetUser.shop_name || '',
          stallLocation: targetUser.stall_location || '',
          bio: targetUser.bio || '',
          avatarUrl: targetUser.avatar_key ? `/media/${targetUser.avatar_key}` : (targetUser.avatar_url || null),
          followersCount: followersRes.items.length,
          followingCount: followingRes.items.length,
          reviewsCount: reviewsRes.items.length,
          averageRating,
          isFollowing,
          listingsCount: listings.length,
          listings: listings.map((i) => ({
            id: i.id,
            title: i.title,
            priceZar: zar(i.price_cents),
            photos: i.photos || [],
            status: i.status,
          })),
        },
      });
    }

    // -------------------------------------------------------------
    // POST /api/users/{id}/follow & DELETE /api/users/{id}/follow
    // -------------------------------------------------------------
    const followMatch = path.match(/^\/api\/users\/([^\/]+)\/follow$/);
    if (followMatch) {
      const authUser = await requireUser(event);
      const targetUserId = followMatch[1];
      if (authUser.id === targetUserId) return error(400, 'You cannot follow yourself');

      if (method === 'POST') {
        await dynamo.put(followsTable, {
          follower_id: authUser.id,
          seller_id: targetUserId,
          created_at: now(),
        });
        return json(200, { following: true, message: 'Vendor followed' });
      }

      if (method === 'DELETE') {
        await dynamo.delete(followsTable, {
          follower_id: authUser.id,
          seller_id: targetUserId,
        });
        return json(200, { following: false, message: 'Vendor unfollowed' });
      }
    }

    // -------------------------------------------------------------
    // Cart endpoints: GET /api/cart, POST /api/cart/{id}, DELETE /api/cart/{id}
    // -------------------------------------------------------------
    if (path === '/api/cart' && method === 'GET') {
      const authUser = await requireUser(event);
      const cartRes = await dynamo.query({
        TableName: cartTable,
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: { ':uid': authUser.id },
      });

      const items = [];
      for (const entry of cartRes.items) {
        const itm = await dynamo.get(itemsTable, { id: entry.item_id });
        if (itm) {
          items.push({
            id: itm.id,
            title: itm.title,
            priceCents: itm.price_cents,
            priceZar: zar(itm.price_cents),
            photos: itm.photos || [],
            status: itm.status,
            sellerId: itm.seller_id,
            sellerName: itm.seller_name || 'Vendor',
          });
        }
      }

      const totalCents = items.reduce((sum, i) => sum + (i.priceCents || 0), 0);
      return json(200, {
        items,
        totalZar: zar(totalCents),
        count: items.length,
      });
    }

    const cartItemMatch = path.match(/^\/api\/cart\/([^\/]+)$/);
    if (cartItemMatch) {
      const authUser = await requireUser(event);
      const itemId = cartItemMatch[1];

      if (method === 'POST') {
        const itm = await dynamo.get(itemsTable, { id: itemId });
        if (!itm) return error(404, 'Item not found');
        if (itm.seller_id === authUser.id) return error(400, 'Cannot add your own item to cart');
        if (itm.status === 'sold') return error(409, 'Item already sold');

        await dynamo.put(cartTable, {
          user_id: authUser.id,
          item_id: itemId,
          created_at: now(),
        });
        return json(200, { message: 'Item added to cart' });
      }

      if (method === 'DELETE') {
        await dynamo.delete(cartTable, {
          user_id: authUser.id,
          item_id: itemId,
        });
        return json(200, { message: 'Item removed from cart' });
      }
    }

    // -------------------------------------------------------------
    // Bargaining / Offers: POST /api/items/{id}/offers, GET /api/offers
    // -------------------------------------------------------------
    const offerMatch = path.match(/^\/api\/items\/([^\/]+)\/offers$/);
    if (offerMatch && method === 'POST') {
      const authUser = await requireUser(event);
      const itemId = offerMatch[1];
      const body = parseBody(event);
      const amountZar = body.amountZar || body.amount;
      const amountCents = body.amountCents || toCents(amountZar);

      if (!amountCents || amountCents < 500) {
        return error(400, 'Offer amount must be at least R5.00');
      }

      const itm = await dynamo.get(itemsTable, { id: itemId });
      if (!itm) return error(404, 'Item not found');
      if (itm.seller_id === authUser.id) return error(400, 'Cannot make offer on your own item');
      if (itm.status === 'sold') return error(409, 'Item already sold');

      const offerId = id('ofr');
      const timestamp = now();
      const newOffer = {
        id: offerId,
        item_id: itemId,
        item_title: itm.title,
        buyer_id: authUser.id,
        buyer_name: authUser.name,
        seller_id: itm.seller_id,
        amount_cents: amountCents,
        status: 'pending', // pending, accepted, declined, countered, used
        created_at: timestamp,
        updated_at: timestamp,
        expires_at: timestamp + (48 * 3600 * 1000), // 48h validity
      };

      await dynamo.put(offersTable, newOffer);
      return json(201, {
        message: 'Bargaining offer submitted to seller',
        offer: {
          ...newOffer,
          amountZar: zar(amountCents),
        },
      });
    }

    if (path === '/api/offers' && method === 'GET') {
      const authUser = await requireUser(event);

      // Offers received (as seller)
      const sellerOffers = await dynamo.query({
        TableName: offersTable,
        IndexName: 'SellerIndex',
        KeyConditionExpression: 'seller_id = :sid',
        ExpressionAttributeValues: { ':sid': authUser.id },
      });

      // Offers made (as buyer)
      const buyerOffers = await dynamo.query({
        TableName: offersTable,
        IndexName: 'BuyerIndex',
        KeyConditionExpression: 'buyer_id = :bid',
        ExpressionAttributeValues: { ':bid': authUser.id },
      });

      const all = [...sellerOffers.items, ...buyerOffers.items];
      all.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));

      return json(200, {
        offers: all.map((o) => ({
          id: o.id,
          itemId: o.item_id,
          itemTitle: o.item_title,
          buyerId: o.buyer_id,
          buyerName: o.buyer_name,
          sellerId: o.seller_id,
          amountZar: zar(o.amount_cents),
          status: o.status,
          isSeller: o.seller_id === authUser.id,
          expiresAt: o.expires_at ? new Date(o.expires_at).toISOString() : null,
          createdAt: o.created_at ? new Date(o.created_at).toISOString() : null,
        })),
      });
    }

    // Offer action: accept, decline, counter
    const offerActionMatch = path.match(/^\/api\/offers\/([^\/]+)\/(accept|decline|counter)$/);
    if (offerActionMatch && method === 'POST') {
      const authUser = await requireUser(event);
      const offerId = offerActionMatch[1];
      const action = offerActionMatch[2];
      const body = parseBody(event);

      const offer = await dynamo.get(offersTable, { id: offerId });
      if (!offer) return error(404, 'Offer not found');
      if (offer.seller_id !== authUser.id) return error(403, 'Only the seller can respond to this offer');

      let newStatus = action === 'accept' ? 'accepted' : (action === 'decline' ? 'declined' : 'countered');
      let counterCents = offer.amount_cents;

      if (action === 'counter') {
        const counterZar = body.amountZar || body.amount;
        counterCents = body.amountCents || toCents(counterZar);
        if (!counterCents) return error(400, 'Counter amount required');
      }

      await dynamo.update({
        TableName: offersTable,
        Key: { id: offerId },
        UpdateExpression: 'SET #st = :st, amount_cents = :amt, updated_at = :time',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':st': newStatus,
          ':amt': counterCents,
          ':time': now(),
        },
      });

      return json(200, {
        message: `Offer ${newStatus}`,
        offerId,
        status: newStatus,
        amountZar: zar(counterCents),
      });
    }

    // -------------------------------------------------------------
    // Direct Messaging & Chats: GET /api/chats, GET /api/chats/{id}, POST /api/chats/{id}
    // -------------------------------------------------------------
    if (path === '/api/chats' && method === 'GET') {
      const authUser = await requireUser(event);
      const res = await dynamo.query({
        TableName: messagesTable,
        IndexName: 'PairIndex',
        KeyConditionExpression: 'sender_id = :uid',
        ExpressionAttributeValues: { ':uid': authUser.id },
        Limit: 50,
      });

      // Find distinct peer conversation IDs
      const chatsMap = new Map();
      for (const m of res.items) {
        const peerId = m.recipient_id;
        if (!chatsMap.has(peerId)) {
          chatsMap.set(peerId, m);
        }
      }

      const chats = [];
      for (const [peerId, lastMsg] of chatsMap.entries()) {
        const peer = await dynamo.get(usersTable, { id: peerId });
        chats.push({
          id: peerId,
          peer: peer
            ? {
                id: peer.id,
                name: peer.shop_name || peer.name,
                handle: peer.handle,
                avatarUrl: peer.avatar_key ? `/media/${peer.avatar_key}` : (peer.avatar_url || null),
              }
            : { id: peerId, name: 'Dobha User' },
          lastMessage: lastMsg.text,
          lastMessageAt: new Date(lastMsg.created_at).toISOString(),
        });
      }

      return json(200, { chats });
    }

    const chatMatch = path.match(/^\/api\/chats\/([^\/]+)$/);
    if (chatMatch) {
      const authUser = await requireUser(event);
      const peerId = chatMatch[1];

      if (method === 'GET') {
        const sent = await dynamo.query({
          TableName: messagesTable,
          IndexName: 'PairIndex',
          KeyConditionExpression: 'sender_id = :sid AND recipient_id = :rid',
          ExpressionAttributeValues: { ':sid': authUser.id, ':rid': peerId },
          Limit: 50,
        });
        const received = await dynamo.query({
          TableName: messagesTable,
          IndexName: 'PairIndex',
          KeyConditionExpression: 'sender_id = :sid AND recipient_id = :rid',
          ExpressionAttributeValues: { ':sid': peerId, ':rid': authUser.id },
          Limit: 50,
        });

        const all = [...sent.items, ...received.items];
        all.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

        return json(200, {
          messages: all.map((m) => ({
            id: m.id,
            senderId: m.sender_id,
            recipientId: m.recipient_id,
            text: m.text,
            isMe: m.sender_id === authUser.id,
            createdAt: new Date(m.created_at).toISOString(),
          })),
        });
      }

      if (method === 'POST') {
        const body = parseBody(event);
        const text = (body.text || body.message || '').trim();
        if (!text) return error(400, 'Message text is required');

        const messageId = id('msg');
        const timestamp = now();
        const msg = {
          id: messageId,
          sender_id: authUser.id,
          recipient_id: peerId,
          text,
          created_at: timestamp,
          read_at: 0,
        };

        await dynamo.put(messagesTable, msg);
        return json(201, {
          message: {
            ...msg,
            isMe: true,
            createdAt: new Date(timestamp).toISOString(),
          },
        });
      }
    }

    // -------------------------------------------------------------
    // Reviews: POST /api/orders/{id}/review
    // -------------------------------------------------------------
    const reviewMatch = path.match(/^\/api\/orders\/([^\/]+)\/review$/);
    if (reviewMatch && method === 'POST') {
      const authUser = await requireUser(event);
      const orderId = reviewMatch[1];
      const body = parseBody(event);
      const rating = Math.min(5, Math.max(1, parseInt(body.rating || 5, 10)));
      const text = (body.text || '').trim();

      const newReview = {
        order_id: orderId,
        buyer_id: authUser.id,
        buyer_name: authUser.name,
        seller_id: body.sellerId || body.seller_id,
        rating,
        text,
        created_at: now(),
      };

      await dynamo.put(reviewsTable, newReview);
      return json(201, { message: 'Review submitted', review: newReview });
    }

    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Social handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
};
