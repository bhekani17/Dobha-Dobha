'use strict';

const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const crypto = require('crypto');
const dynamo = require('../utils/dynamo');
const { json, error, handleCors, parseBody } = require('../utils/response');
const { getUser, requireUser } = require('../utils/auth');
const { now, zar } = require('../utils/id');

const ROOM_NAME_REGEX = /^[a-zA-Z0-9_-]{1,40}$/;

// In-memory cache for live rooms list
let roomsCache = { at: 0, data: null };
const CACHE_TTL_MS = 3000;

function getLiveKitConfig() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;

  if (!url || !key || !secret || key === 'devkey' || secret === 'secret') {
    return null;
  }
  return { url, key, secret };
}

async function fetchLiveRooms(cfg) {
  if (!cfg) return [];

  if (roomsCache.data && Date.now() - roomsCache.at < CACHE_TTL_MS) {
    return roomsCache.data;
  }

  try {
    const service = new RoomServiceClient(cfg.url.replace(/^ws/, 'http'), cfg.key, cfg.secret);
    const rooms = await service.listRooms();
    const live = rooms.filter((r) => r.numPublishers > 0);

    const roomDetails = await Promise.all(
      live.map(async (room) => {
        let hostId = null;
        let hostName = 'Dobha Vendor';
        try {
          const participants = await service.listParticipants(room.name);
          for (const p of participants) {
            const meta = JSON.parse(p.metadata || '{}');
            if (meta.role === 'host') {
              if (meta.userId) hostId = meta.userId;
              if (meta.name) hostName = meta.name;
            }
          }
        } catch {
          // Room may have just closed
        }
        return {
          name: room.name,
          viewers: Math.max((room.numParticipants || 0) - (room.numPublishers || 0), 0),
          hostId,
          hostName,
        };
      })
    );

    roomsCache = { at: Date.now(), data: roomDetails };
    return roomDetails;
  } catch (err) {
    console.warn('LiveKit RoomServiceClient warning:', err.message);
    return roomsCache.data || [];
  }
}

exports.handler = async (event) => {
  const cors = handleCors(event);
  if (cors) return cors;

  const usersTable = process.env.USERS_TABLE;
  const itemsTable = process.env.ITEMS_TABLE;
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const method = (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '').toUpperCase();
  const queryParams = event.queryStringParameters || {};

  try {
    // -------------------------------------------------------------
    // GET /api/rooms: List active live streams
    // -------------------------------------------------------------
    if (path.endsWith('/api/rooms') && method === 'GET') {
      const cfg = getLiveKitConfig();
      const live = await fetchLiveRooms(cfg);

      // Collect host IDs to enrich with profile information
      const hostIds = [...new Set(live.map((r) => r.hostId).filter(Boolean))];
      const hostsMap = new Map();

      if (hostIds.length > 0 && usersTable) {
        await Promise.all(
          hostIds.map(async (uid) => {
            const user = await dynamo.get(usersTable, { id: uid });
            if (user) hostsMap.set(uid, user);
          })
        );
      }

      const responseRooms = live.map((r) => {
        const host = hostsMap.get(r.hostId);
        return {
          name: r.name,
          viewers: r.viewers,
          host: host
            ? {
                id: host.id,
                name: host.shop_name || host.name,
                handle: host.handle,
                stallLocation: host.stall_location || '',
                avatarUrl: host.avatar_key ? `/media/${host.avatar_key}` : (host.avatar_url || null),
              }
            : {
                id: r.hostId,
                name: r.hostName || 'Dobha Vendor',
              },
        };
      });

      return json(200, responseRooms);
    }

    // -------------------------------------------------------------
    // GET /api/token: Generate LiveKit token for host or viewer
    // -------------------------------------------------------------
    if (path.endsWith('/api/token') && method === 'GET') {
      const room = (queryParams.room || '').trim();
      const role = queryParams.role === 'host' ? 'host' : 'viewer';

      if (!room || !ROOM_NAME_REGEX.test(room)) {
        return error(400, 'Stream room name can only use letters, numbers, hyphens and underscores (max 40)');
      }

      const user = role === 'host' ? await requireUser(event) : await getUser(event);

      if (role === 'host' && user.role !== 'vendor') {
        return error(403, 'Switch your account to vendor mode to start a live stream');
      }

      const cfg = getLiveKitConfig();
      if (!cfg) {
        // Fallback simulated token when LiveKit Cloud is not yet bound
        return json(200, {
          url: 'wss://dobha-live.placeholder',
          token: `simulated-token-${crypto.randomUUID()}`,
          role,
          room,
        });
      }

      const identity = user
        ? `${user.handle || user.id}#${crypto.randomUUID().slice(0, 8)}`
        : `guest-${crypto.randomUUID().slice(0, 8)}`;

      const displayName = user
        ? (user.shop_name || user.name)
        : 'Guest Viewer';

      const metadata = JSON.stringify({
        role,
        userId: user ? user.id : null,
        name: displayName,
        shopName: user ? (user.shop_name || '') : '',
      });

      const at = new AccessToken(cfg.key, cfg.secret, {
        identity,
        name: displayName,
        ttl: '3h',
        metadata,
      });

      at.addGrant({
        roomJoin: true,
        room,
        canPublish: role === 'host',
        canSubscribe: true,
        canPublishData: true,
      });

      const jwtToken = await at.toJwt();

      return json(200, {
        url: cfg.url,
        token: jwtToken,
        role,
        room,
      });
    }

    // -------------------------------------------------------------
    // POST /api/rooms/pin: Pin a product during a live stream
    // -------------------------------------------------------------
    if ((path.endsWith('/api/rooms/pin') || path.endsWith('/api/live/pin')) && method === 'POST') {
      const user = await requireUser(event);
      if (user.role !== 'vendor') {
        return error(403, 'Only sellers can pin products in live streams');
      }

      const body = parseBody(event);
      const room = (body.room || '').trim();
      const itemId = (body.itemId || body.item_id || '').trim();

      if (!room || !itemId) {
        return error(400, 'Both room and itemId are required to pin a product');
      }

      let item = null;
      if (itemsTable) {
        item = await dynamo.get(itemsTable, { id: itemId });
      }

      if (!item) {
        return error(404, 'Item not found');
      }

      if (item.seller_id !== user.id) {
        return error(403, 'You can only pin your own storefront products');
      }

      // Format pinned product response
      const pinnedProduct = {
        room,
        pinnedAt: now(),
        item: {
          id: item.id,
          title: item.title,
          priceCents: item.price_cents,
          priceZar: zar(item.price_cents),
          photos: item.photos || [],
          status: item.status,
          quantity: item.quantity !== undefined ? item.quantity : 1,
          seller: {
            id: user.id,
            name: user.shop_name || user.name,
          },
        },
      };

      return json(200, {
        message: 'Product pinned successfully',
        pinnedProduct,
      });
    }

    // -------------------------------------------------------------
    // POST /api/rooms/end: End a live stream
    // -------------------------------------------------------------
    if (path.endsWith('/api/rooms/end') && method === 'POST') {
      const user = await requireUser(event);
      const body = parseBody(event);
      const room = (body.room || '').trim();

      if (!room) {
        return error(400, 'Room name is required');
      }

      const cfg = getLiveKitConfig();
      if (cfg) {
        try {
          const service = new RoomServiceClient(cfg.url.replace(/^ws/, 'http'), cfg.key, cfg.secret);
          await service.deleteRoom(room);
        } catch (e) {
          console.warn('Could not delete LiveKit room:', e.message);
        }
      }

      return json(200, { message: `Live stream ${room} ended successfully` });
    }

    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Live handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
};
