// Cloudflare Worker: the Dobha API (accounts, listings, orders, wallet, live
// streaming tokens) plus item photos. The Flutter web app (mobile/build/web) is
// served by Workers assets before this runs.
import * as auth from './auth.js';
import * as google from './google.js';
import { HttpError, json } from './http.js';
import * as items from './items.js';
import * as live from './live.js';
import * as orders from './orders.js';

export { StreamClaims } from './live.js';

// [method, pattern, handler]; `:id` segments are passed to the handler in order.
const ROUTES = [
  ['POST', '/api/auth/register', auth.register],
  ['POST', '/api/auth/login', auth.login],
  ['POST', '/api/auth/google', google.googleSignIn],
  ['POST', '/api/auth/logout', auth.logout],
  ['GET', '/api/me', auth.me],
  ['PATCH', '/api/me', auth.updateMe],
  ['PUT', '/api/me/avatar', auth.setAvatar],
  ['DELETE', '/api/me/avatar', auth.setAvatar],

  ['GET', '/api/items', items.listItems],
  ['POST', '/api/items', items.createItem],
  ['GET', '/api/items/mine', items.myItems],
  ['GET', '/api/items/:id', items.getItem],
  ['DELETE', '/api/items/:id', items.removeItem],
  ['POST', '/api/items/:id/like', items.toggleLike],
  ['POST', '/api/items/:id/save', items.toggleSave],
  ['GET', '/api/items/:id/comments', items.listComments],
  ['POST', '/api/items/:id/comments', items.addComment],
  ['GET', '/api/saved', items.savedItems],
  ['POST', '/api/uploads', items.uploadMedia],

  ['GET', '/api/orders', orders.listOrders],
  ['POST', '/api/orders', orders.createOrder],
  ['POST', '/api/orders/:id/dispatch', orders.dispatchOrder],
  ['POST', '/api/orders/:id/confirm', orders.confirmOrder],
  ['POST', '/api/orders/:id/dispute', orders.disputeOrder],
  ['GET', '/api/wallet', orders.wallet],
  ['POST', '/api/wallet/topup', orders.topUp],
  ['POST', '/api/wallet/withdraw', orders.withdraw],

  ['GET', '/api/rooms', live.rooms],
  ['GET', '/api/token', live.token],
].map(([method, pattern, handler]) => [method, new RegExp(`^${pattern.replaceAll(':id', '([\\w-]+)')}$`), handler]);

// The deployed web app is same-origin; this only lets `flutter run -d chrome`
// (served from localhost) call a deployed Worker during development.
const DEV_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

async function handle(request, env) {
  const { pathname } = new URL(request.url);
  const media = /^\/(media|photos)\/(.+)$/.exec(pathname);
  if ((request.method === 'GET' || request.method === 'HEAD') && media) {
    return items.serveMedia(request, env, decodeURIComponent(media[2]));
  }
  for (const [method, re, handler] of ROUTES) {
    const m = re.exec(pathname);
    if (m && method === request.method) return handler(request, env, ...m.slice(1));
  }
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin');
    const devOrigin = origin && DEV_ORIGIN_RE.test(origin);
    if (request.method === 'OPTIONS' && devOrigin) {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
          'access-control-allow-headers': 'authorization, content-type, range',
          'access-control-max-age': '600',
        },
      });
    }

    let res;
    try {
      res = await handle(request, env);
    } catch (e) {
      if (e instanceof HttpError) {
        res = json({ error: e.message }, e.status);
      } else {
        console.error(e);
        res = json({ error: 'Something went wrong, please try again' }, 500);
      }
    }
    if (devOrigin) {
      res = new Response(res.body, res);
      res.headers.set('access-control-allow-origin', origin);
    }
    return res;
  },
};
