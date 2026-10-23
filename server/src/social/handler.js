'use strict';

const dynamo = require('../utils/dynamo');
const { json, error, handleCors, withCors, parseBody } = require('../utils/response');
const { getUser, requireUser } = require('../utils/auth');
const { id, now, zar, toCents } = require('../utils/id');

function formatPeer(user, id) {
  return user
    ? {
        id: user.id,
        name: user.shop_name || user.name,
        handle: user.handle || '',
        avatarUrl: user.avatar_key ? `/media/${user.avatar_key}` : (user.avatar_url || null),
      }
    : { id, name: 'Dobha User', handle: '', avatarUrl: null };
}

function formatMessage(message, viewerId, item = null) {
  const purchaseRequest = message.purchase_request
    ? {
        status: message.buyer_confirmed_at && message.seller_confirmed_at
          ? 'reported_complete'
          : message.buyer_confirmed_at
            ? 'buyer_confirmed'
            : message.seller_confirmed_at
              ? 'seller_confirmed'
              : 'requested',
        buyerConfirmed: Boolean(message.buyer_confirmed_at),
        sellerConfirmed: Boolean(message.seller_confirmed_at),
        confirmedByMe: viewerId === message.buyer_id
          ? Boolean(message.buyer_confirmed_at)
          : Boolean(message.seller_confirmed_at),
        paymentVerified: false,
      }
    : null;
  return {
    id: message.id,
    senderId: message.sender_id,
    recipientId: message.recipient_id,
    text: message.text,
    fromMe: message.sender_id === viewerId,
    createdAt: new Date(message.created_at).toISOString(),
    ...(purchaseRequest ? { purchaseRequest } : {}),
    ...(item
      ? {
          item: {
            id: item.id,
            title: item.title,
            priceZar: Number(((item.price_cents || 0) / 100).toFixed(2)),
            photoUrl: item.photos?.[0] || (item.photo_keys?.[0] ? `/media/${item.photo_keys[0]}` : null),
          },
        }
      : {}),
  };
}

exports.handler = withCors(async (event) => {
  const cors = handleCors(event);
  if (cors) return cors;

  const cartTable = process.env.CART_TABLE;
  const offersTable = process.env.OFFERS_TABLE;
  const followsTable = process.env.FOLLOWS_TABLE;
  const messagesTable = process.env.MESSAGES_TABLE;
  const reviewsTable = process.env.REVIEWS_TABLE;
  const usersTable = process.env.USERS_TABLE;
  const itemsTable = process.env.ITEMS_TABLE;
  const subsTable = process.env.SUBSCRIPTIONS_TABLE;
  const storiesTable = process.env.STORIES_TABLE;

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
      const followingIds = new Set();
      if (user && followsTable) {
        const followingRes = await dynamo.query({
          TableName: followsTable,
          KeyConditionExpression: 'follower_id = :fid',
          ExpressionAttributeValues: { ':fid': user.id },
        });
        followingRes.items.forEach((follow) => followingIds.add(follow.seller_id));
      }

      return json(200, {
        users: profiles.map((u) => ({
          id: u.id,
          name: u.name,
          handle: u.handle,
          role: u.role || 'buyer',
          isVendor: u.role === 'vendor',
          isMe: user?.id === u.id,
          isFollowing: followingIds.has(u.id),
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
          followerCount: followersRes.items.length,
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
    // POST /api/users/{id}/subscribe: Subscribe/unsubscribe to a seller
    // -------------------------------------------------------------
    const subscribeMatch = path.match(/^\/api\/users\/([^\/]+)\/subscribe$/);
    if (subscribeMatch && method === 'POST') {
      const authUser = await requireUser(event);
      const targetId = subscribeMatch[1];
      if (targetId === authUser.id) return error(400, 'Cannot subscribe to yourself');

      if (!subsTable) return error(500, 'Subscriptions not configured');

      const key = `${authUser.id}#${targetId}`;
      const existing = await dynamo.get(subsTable, { sub_key: key });
      if (existing) {
        await dynamo.delete(subsTable, { sub_key: key });
        return json(200, { subscribed: false, message: 'Unsubscribed' });
      } else {
        await dynamo.put(subsTable, {
          sub_key: key,
          subscriber_id: authUser.id,
          seller_id: targetId,
          created_at: Date.now(),
        });
        return json(200, { subscribed: true, message: 'Subscribed! You will see their new drops.' });
      }
    }

    // -------------------------------------------------------------
    // GET /api/subscriptions: List who user subscribes to
    // -------------------------------------------------------------
    if (path === '/api/subscriptions' && method === 'GET') {
      const authUser = await requireUser(event);
      if (!subsTable) return json(200, { subscriptions: [] });
      const res = await dynamo.query({
        TableName: subsTable,
        IndexName: 'SubscriberIndex',
        KeyConditionExpression: 'subscriber_id = :uid',
        ExpressionAttributeValues: { ':uid': authUser.id },
      });
      return json(200, { subscriptions: res.items });
    }

    // -------------------------------------------------------------
    // GET /api/storefront/:handle: Public seller storefront
    // -------------------------------------------------------------
    const storefrontMatch = path.match(/^\/api\/storefront\/([^\/]+)$/);
    if (storefrontMatch && method === 'GET') {
      const handle = storefrontMatch[1];

      const res = await dynamo.query({
        TableName: usersTable,
        IndexName: 'HandleIndex',
        KeyConditionExpression: 'handle = :h',
        ExpressionAttributeValues: { ':h': handle.toLowerCase() },
        Limit: 1,
      });
      if (!res.items.length) return error(404, 'Storefront not found');
      const seller = res.items[0];

      // Check subscription status
      let isSubscribed = false;
      const viewingUser = await getUser(event);
      if (viewingUser && subsTable) {
        const sub = await dynamo.get(subsTable, { sub_key: `${viewingUser.id}#${seller.id}` });
        isSubscribed = Boolean(sub);
      }

      // Get subscriber count
      let subscriberCount = 0;
      if (subsTable) {
        const subsRes = await dynamo.query({
          TableName: subsTable,
          IndexName: 'SellerSubIndex',
          KeyConditionExpression: 'seller_id = :sid',
          ExpressionAttributeValues: { ':sid': seller.id },
        }).catch(() => ({ count: 0 }));
        subscriberCount = subsRes.count || 0;
      }

      return json(200, {
        storefront: {
          id: seller.id,
          name: seller.shop_name || seller.name,
          handle: seller.handle,
          bio: seller.bio || '',
          stallLocation: seller.stall_location || '',
          avatarUrl: seller.avatar_key ? `/media/${seller.avatar_key}` : null,
          bannerUrl: seller.banner_key ? `/media/${seller.banner_key}` : null,
          pinnedItems: seller.pinned_items || [],
          role: seller.role || 'vendor',
          isSubscribed,
          subscriberCount,
          createdAt: seller.created_at,
        },
      });
    }

    // -------------------------------------------------------------
    // GET /api/stories: List active stories (last 24 hours)
    // -------------------------------------------------------------
    if (path === '/api/stories' && method === 'GET') {
      if (!storiesTable) return json(200, { stories: [] });
      const cutoff = Date.now() - (24 * 3600 * 1000);
      const res = await dynamo.scan({
        TableName: storiesTable,
        FilterExpression: 'created_at > :cutoff AND expires_at > :now',
        ExpressionAttributeValues: { ':cutoff': cutoff, ':now': Date.now() },
      });

      // Group by user/seller
      const byUser = {};
      for (const s of res.items) {
        if (!byUser[s.user_id]) {
          byUser[s.user_id] = {
            userId: s.user_id,
            userName: s.user_name,
            userHandle: s.user_handle,
            avatarUrl: s.avatar_url || null,
            stories: [],
          };
        }
        byUser[s.user_id].stories.push({
          id: s.id,
          mediaUrl: s.media_url,
          mediaType: s.media_type || 'image',
          caption: s.caption || '',
          createdAt: s.created_at,
        });
      }

      return json(200, { stories: Object.values(byUser) });
    }

    // -------------------------------------------------------------
    // POST /api/stories: Post a new story (expires in 24h)
    // -------------------------------------------------------------
    if (path === '/api/stories' && method === 'POST') {
      const authUser = await requireUser(event);
      if (!storiesTable) return error(500, 'Stories not configured');
      const body = parseBody(event);
      const mediaUrl = body.mediaUrl || body.media_url;
      if (!mediaUrl) return error(400, 'mediaUrl is required');

      const storyId = `sto_${require('crypto').randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const ts = Date.now();
      const story = {
        id: storyId,
        user_id: authUser.id,
        user_name: authUser.shop_name || authUser.name,
        user_handle: authUser.handle,
        avatar_url: null,
        media_url: mediaUrl,
        media_type: body.mediaType || 'image',
        caption: (body.caption || '').slice(0, 200),
        created_at: ts,
        expires_at: ts + (24 * 3600 * 1000),
      };

      await dynamo.put(storiesTable, story);
      return json(201, { story, message: 'Story posted! It will disappear in 24 hours.' });
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
    // Bargaining / Offers: POST /api/offers, GET /api/offers
    // -------------------------------------------------------------
    const offerMatch = path.match(/^\/api\/items\/([^\/]+)\/offers$/);
    if ((offerMatch || path === '/api/offers') && method === 'POST') {
      const authUser = await requireUser(event);
      const body = parseBody(event);
      const itemId = offerMatch?.[1] || body.itemId;
      if (typeof itemId !== 'string' || !itemId.trim()) {
        return error(400, 'Item ID is required');
      }
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
      const [sent, received] = await Promise.all([
        dynamo.query({
          TableName: messagesTable,
          IndexName: 'PairIndex',
          KeyConditionExpression: 'sender_id = :uid',
          ExpressionAttributeValues: { ':uid': authUser.id },
          Limit: 100,
        }),
        dynamo.query({
          TableName: messagesTable,
          IndexName: 'RecipientIndex',
          KeyConditionExpression: 'recipient_id = :uid',
          ExpressionAttributeValues: { ':uid': authUser.id },
          Limit: 100,
        }),
      ]);

      const conversations = new Map();
      for (const message of [...sent.items, ...received.items]) {
        const peerId = message.sender_id === authUser.id ? message.recipient_id : message.sender_id;
        if (!peerId || peerId === authUser.id) continue;
        const current = conversations.get(peerId) || { unread: 0 };
        if (!current.latest || message.created_at > current.latest.created_at) current.latest = message;
        if (message.recipient_id === authUser.id && !message.read_at) current.unread++;
        conversations.set(peerId, current);
      }

      const chats = await Promise.all([...conversations.entries()].map(async ([peerId, conversation]) => {
        const peer = formatPeer(await dynamo.get(usersTable, { id: peerId }), peerId);
        const latest = conversation.latest;
        return {
          userId: peer.id,
          name: peer.name,
          handle: peer.handle,
          avatarUrl: peer.avatarUrl,
          lastMessage: latest?.text || '',
          lastFromMe: latest?.sender_id === authUser.id,
          unread: conversation.unread,
          updatedAt: new Date(latest?.created_at || 0).toISOString(),
        };
      }));
      chats.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      return json(200, { chats });
    }

    const purchaseConfirmationMatch = path.match(/^\/api\/chats\/([^\/]+)\/purchases\/([^\/]+)\/confirm$/);
    if (purchaseConfirmationMatch && method === 'POST') {
      const authUser = await requireUser(event);
      const [, peerId, messageId] = purchaseConfirmationMatch;
      if (peerId === authUser.id) return error(400, 'You cannot confirm a purchase with yourself');

      const purchase = await dynamo.get(messagesTable, { id: messageId });
      if (!purchase || !purchase.purchase_request) return error(404, 'Purchase request not found');
      const isBuyer = purchase.buyer_id === authUser.id && purchase.seller_id === peerId;
      const isSeller = purchase.seller_id === authUser.id && purchase.buyer_id === peerId;
      if (!isBuyer && !isSeller) return error(403, 'Only the buyer and seller can confirm this purchase');

      const confirmationField = isBuyer ? 'buyer_confirmed_at' : 'seller_confirmed_at';
      let updatedPurchase = purchase;
      if (!purchase[confirmationField]) {
        try {
          const result = await dynamo.update({
            TableName: messagesTable,
            Key: { id: messageId },
            UpdateExpression: `SET ${confirmationField} = :time`,
            ConditionExpression: `attribute_not_exists(${confirmationField})`,
            ExpressionAttributeValues: { ':time': now() },
            ReturnValues: 'ALL_NEW',
          });
          updatedPurchase = result.Attributes || await dynamo.get(messagesTable, { id: messageId });
        } catch (err) {
          if (err.name !== 'ConditionalCheckFailedException') throw err;
          updatedPurchase = await dynamo.get(messagesTable, { id: messageId });
        }
      }

      if (updatedPurchase.buyer_confirmed_at && updatedPurchase.seller_confirmed_at) {
        const item = await dynamo.get(itemsTable, { id: updatedPurchase.item_id });
        if (item && item.status === 'available') {
          try {
            await dynamo.update({
              TableName: itemsTable,
              Key: { id: updatedPurchase.item_id },
              UpdateExpression: 'SET #st = :sold, off_app_sale_reported_at = :time, off_app_sale_buyer_id = :buyer',
              ConditionExpression: '#st = :available',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':sold': 'sold',
                ':available': 'available',
                ':time': now(),
                ':buyer': updatedPurchase.buyer_id,
              },
            });
          } catch (err) {
            if (err.name !== 'ConditionalCheckFailedException') throw err;
          }
        }
      }

      return json(200, {
        message: 'Direct purchase confirmation recorded. Dobha has not verified payment.',
        purchaseRequest: formatMessage(updatedPurchase, authUser.id).purchaseRequest,
      });
    }

    const chatMatch = path.match(/^\/api\/chats\/([^\/]+)$/);
    if (chatMatch) {
      const authUser = await requireUser(event);
      const peerId = chatMatch[1];
      if (peerId === authUser.id) return error(400, 'You cannot message yourself');
      const peerUser = await dynamo.get(usersTable, { id: peerId });
      if (!peerUser || peerUser.is_deleted) return error(404, 'User not found');
      const peer = formatPeer(peerUser, peerId);

      if (method === 'GET') {
        const [sent, received] = await Promise.all([dynamo.query({
          TableName: messagesTable,
          IndexName: 'PairIndex',
          KeyConditionExpression: 'sender_id = :sid AND recipient_id = :rid',
          ExpressionAttributeValues: { ':sid': authUser.id, ':rid': peerId },
          Limit: 100,
        }), dynamo.query({
          TableName: messagesTable,
          IndexName: 'PairIndex',
          KeyConditionExpression: 'sender_id = :sid AND recipient_id = :rid',
          ExpressionAttributeValues: { ':sid': peerId, ':rid': authUser.id },
          Limit: 100,
        })]);

        const all = [...sent.items, ...received.items];
        all.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
        const unread = all.filter((message) => message.recipient_id === authUser.id && !message.read_at);
        await Promise.all(unread.map((message) => dynamo.update({
          TableName: messagesTable,
          Key: { id: message.id },
          UpdateExpression: 'SET read_at = :time',
          ExpressionAttributeValues: { ':time': now() },
        })));

        return json(200, {
          with: peer,
          messages: await Promise.all(all.map(async (message) => {
            const item = message.item_id ? await dynamo.get(itemsTable, { id: message.item_id }) : null;
            return formatMessage(message, authUser.id, item);
          })),
        });
      }

      if (method === 'POST') {
        const body = parseBody(event);
        const text = typeof body.text === 'string'
          ? body.text.trim()
          : typeof body.message === 'string' ? body.message.trim() : '';
        if (!text) return error(400, 'Message text is required');
        if (text.length > 1000) return error(400, 'Message must be 1000 characters or fewer');

        const messageId = id('msg');
        const timestamp = now();
        const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';
        const item = itemId ? await dynamo.get(itemsTable, { id: itemId }) : null;
        if (itemId && !item) return error(404, 'Item not found');
        if (body.purchaseRequest === true) {
          if (!itemId) return error(400, 'A listing is required for a purchase request');
          if (item.seller_id !== peerId) return error(400, 'Purchase requests must be sent to the listing seller');
          if (item.seller_id === authUser.id) return error(400, 'You cannot request to buy your own listing');
          if (item.status !== 'available') return error(409, 'This listing is no longer available');
        }
        const msg = {
          id: messageId,
          sender_id: authUser.id,
          recipient_id: peerId,
          text,
          ...(itemId ? { item_id: itemId } : {}),
          ...(body.purchaseRequest === true
            ? {
                purchase_request: true,
                buyer_id: authUser.id,
                seller_id: peerId,
              }
            : {}),
          created_at: timestamp,
          read_at: 0,
        };

        await dynamo.put(messagesTable, msg);
        return json(201, {
          message: formatMessage(msg, authUser.id, item),
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
});
