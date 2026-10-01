// LiveKit tokens and the live stream list.
import { DurableObject } from 'cloudflare:workers';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

import { requireUser } from './auth.js';
import { HttpError, json, limited } from './http.js';

const ROOM_RE = /^[a-zA-Z0-9_-]{1,40}$/;
const ROOMS_CACHE_MS = 3000;
const CLAIM_MS = 30000;

// Every client polls /rooms, so share one LiveKit lookup per isolate instead of
// hitting the LiveKit API once per phone.
let roomsCache = { at: 0, promise: null };

// LiveKit Cloud settings, from Worker secrets.
export function livekitConfig(env) {
  const url = env.LIVEKIT_URL;
  const key = env.LIVEKIT_API_KEY;
  const secret = env.LIVEKIT_API_SECRET;
  // The LiveKit dev key/secret are public knowledge; never sign tokens with them.
  const ok = Boolean(url && key && secret) && key !== 'devkey' && secret !== 'secret';
  if (!ok) throw new HttpError(500, 'Live streaming is not configured on the server');
  return { url, key, secret };
}

function liveRooms(cfg) {
  if (!roomsCache.promise || Date.now() - roomsCache.at > ROOMS_CACHE_MS) {
    const service = new RoomServiceClient(cfg.url.replace(/^ws/, 'http'), cfg.key, cfg.secret);
    const promise = service.listRooms().then(async (rooms) => {
      const live = rooms.filter((r) => r.numPublishers > 0);
      // The host's Dobha user id rides in their token metadata; find it so the app can show who is live.
      return Promise.all(
        live.map(async (room) => {
          let hostId = null;
          try {
            for (const p of await service.listParticipants(room.name)) {
              const meta = JSON.parse(p.metadata || '{}');
              if (meta.role === 'host' && meta.userId) hostId = meta.userId;
            }
          } catch {
            // A room that just ended; show it without a host.
          }
          return { name: room.name, viewers: Math.max(room.numParticipants - room.numPublishers, 0), hostId };
        }),
      );
    });
    promise.catch(() => {
      if (roomsCache.promise === promise) roomsCache = { at: 0, promise: null };
    });
    roomsCache = { at: Date.now(), promise };
  }
  return roomsCache.promise;
}

async function liveRoomsOr502(cfg) {
  try {
    return await liveRooms(cfg);
  } catch {
    throw new HttpError(502, 'LiveKit server unreachable');
  }
}

/** GET /api/rooms: streams that are live right now, with who is hosting each one. */
export async function rooms(request, env) {
  const live = await liveRoomsOr502(livekitConfig(env));
  const ids = [...new Set(live.map((r) => r.hostId).filter(Boolean))];
  const hosts = new Map();
  if (ids.length) {
    const { results } = await env.DB.prepare(
      `SELECT id, name, shop_name, avatar_key FROM users WHERE id IN (${ids.map(() => '?').join(',')})`,
    )
      .bind(...ids)
      .all();
    for (const u of results) hosts.set(u.id, u);
  }
  return json(
    live.map((r) => {
      const h = hosts.get(r.hostId);
      return {
        name: r.name,
        viewers: r.viewers,
        host: h ? { id: h.id, name: h.shop_name || h.name, avatarUrl: h.avatar_key ? `/media/${h.avatar_key}` : null } : null,
      };
    }),
  );
}

/**
 * GET /api/token?room=bale-1&role=host|viewer
 * Signed-in users only. Hosts must be vendors. The LiveKit identity is the
 * user's handle plus a random suffix so two devices never kick each other out.
 */
export async function token(request, env) {
  await limited(env.TOKEN_LIMIT, request);
  const user = await requireUser(request, env);
  const cfg = livekitConfig(env);

  const q = new URL(request.url).searchParams;
  const room = (q.get('room') || '').trim();
  const role = q.get('role') === 'host' ? 'host' : 'viewer';

  if (!ROOM_RE.test(room)) throw new HttpError(400, 'Stream name can only use letters, numbers, - and _ (max 40)');
  if (role === 'host' && user.role !== 'vendor') throw new HttpError(403, 'Switch to vendor mode to go live');

  const live = (await liveRoomsOr502(cfg)).some((r) => r.name === room);
  if (role === 'host') {
    // One global Durable Object holds the claims, so two people can't take the
    // same stream name at the same moment from different Cloudflare locations.
    const claims = env.CLAIMS.get(env.CLAIMS.idFromName('global'));
    if (live || !(await claims.claim(room))) throw new HttpError(409, 'That stream name is already live, pick another');
  } else if (!live) {
    throw new HttpError(404, 'This stream has ended');
  }

  const at = new AccessToken(cfg.key, cfg.secret, {
    identity: `${user.handle}#${crypto.randomUUID().slice(0, 8)}`,
    name: user.name,
    ttl: '2h',
    metadata: JSON.stringify({ role, userId: user.id }),
  });
  at.addGrant({ roomJoin: true, room, canPublish: role === 'host', canSubscribe: true, canPublishData: true });

  return json({ url: cfg.url, token: await at.toJwt(), role });
}

// Rooms a host has just been given a token for but hasn't published in yet.
export class StreamClaims extends DurableObject {
  claims = new Map();

  claim(room) {
    const now = Date.now();
    for (const [r, until] of this.claims) if (until <= now) this.claims.delete(r);
    if (this.claims.has(room)) return false;
    this.claims.set(room, now + CLAIM_MS);
    return true;
  }
}
