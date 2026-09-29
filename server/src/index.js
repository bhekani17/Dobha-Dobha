// Cloudflare Worker: LiveKit token server + live stream list.
// Static host/viewer pages in public/ are served by Workers assets before this runs.
import { DurableObject } from 'cloudflare:workers';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

const LOCAL_RE = /\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/;
const ROOM_RE = /^[a-zA-Z0-9_-]{1,40}$/;
const NAME_MAX = 30;
const ROOMS_CACHE_MS = 3000;
const CLAIM_MS = 30000;

// Every client polls /rooms, so share one LiveKit lookup per isolate instead of
// hitting the LiveKit API once per phone.
let roomsCache = { at: 0, promise: null };

function config(env) {
  const url = env.LIVEKIT_URL || 'ws://localhost:7880';
  const key = env.LIVEKIT_API_KEY || 'devkey';
  const secret = env.LIVEKIT_API_SECRET || 'secret';
  const local = LOCAL_RE.test(url);
  // The dev key/secret are public knowledge; never sign tokens for a real LiveKit server with them.
  const ok = local || (key !== 'devkey' && secret !== 'secret');
  return { url, key, secret, local, ok };
}

function liveRooms(cfg) {
  if (!roomsCache.promise || Date.now() - roomsCache.at > ROOMS_CACHE_MS) {
    const service = new RoomServiceClient(cfg.url.replace(/^ws/, 'http'), cfg.key, cfg.secret);
    const promise = service.listRooms().then((rooms) => rooms.filter((r) => r.numPublishers > 0));
    promise.catch(() => {
      if (roomsCache.promise === promise) roomsCache = { at: 0, promise: null };
    });
    roomsCache = { at: Date.now(), promise };
  }
  return roomsCache.promise;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

// GET /rooms -> rooms that are currently live, for the viewer page
async function rooms(cfg) {
  try {
    const live = await liveRooms(cfg);
    return json(live.map((r) => ({ name: r.name, viewers: Math.max(r.numParticipants - r.numPublishers, 0) })));
  } catch {
    return json({ error: 'LiveKit server unreachable' }, 502);
  }
}

// GET /token?room=bale-1&identity=thabo&role=host|viewer
// Hosts can publish camera/mic; viewers can only watch and send chat (data).
// `identity` is the display name; the real LiveKit identity gets a random suffix
// so two people with the same name never kick each other out.
async function token(request, env, cfg) {
  // Generous limit: many South African phones share one carrier IP.
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (env.TOKEN_LIMIT && !(await env.TOKEN_LIMIT.limit({ key: ip })).success) {
    return json({ error: 'Too many requests, try again in a minute' }, 429);
  }

  const q = new URL(request.url).searchParams;
  const room = (q.get('room') || '').trim();
  const name = (q.get('identity') || '').trim().slice(0, NAME_MAX);
  const role = q.get('role') === 'host' ? 'host' : 'viewer';

  if (!room || !name) {
    return json({ error: 'room and identity are required' }, 400);
  }
  if (!ROOM_RE.test(room)) {
    return json({ error: 'Stream name can only use letters, numbers, - and _ (max 40)' }, 400);
  }

  let live;
  try {
    live = (await liveRooms(cfg)).some((r) => r.name === room);
  } catch {
    return json({ error: 'LiveKit server unreachable' }, 502);
  }

  if (role === 'host') {
    // One global Durable Object holds the claims, so two people can't take the
    // same stream name at the same moment from different Cloudflare locations.
    const claims = env.CLAIMS.get(env.CLAIMS.idFromName('global'));
    if (live || !(await claims.claim(room))) {
      return json({ error: 'That stream name is already live, pick another' }, 409);
    }
  } else if (!live) {
    return json({ error: 'This stream has ended' }, 404);
  }

  const at = new AccessToken(cfg.key, cfg.secret, {
    identity: `${name}#${crypto.randomUUID().slice(0, 8)}`,
    name,
    ttl: '2h',
    metadata: JSON.stringify({ role }),
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: role === 'host',
    canSubscribe: true,
    canPublishData: true,
  });

  // A local LiveKit URL is useless to a phone ("localhost" is the phone itself),
  // so point it at whatever host the client used to reach this server.
  const url = cfg.local ? cfg.url.replace(LOCAL_RE, `//${new URL(request.url).hostname}`) : cfg.url;

  return json({ url, token: await at.toJwt(), role });
}

export default {
  async fetch(request, env) {
    const cfg = config(env);
    if (!cfg.ok) {
      return json({ error: 'Server not configured: set LIVEKIT_API_KEY and LIVEKIT_API_SECRET' }, 500);
    }
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/rooms') return rooms(cfg);
    if (request.method === 'GET' && pathname === '/token') return token(request, env, cfg);
    return json({ error: 'Not found' }, 404);
  },
};

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
