import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dynamo = require('../src/utils/dynamo.js');
const { handler } = require('../src/orders/handler.js');
const { handler: itemsHandler } = require('../src/items/handler.js');

const original = {
  get: dynamo.get,
  put: dynamo.put,
  query: dynamo.query,
  update: dynamo.update,
};
let mutations;

before(() => {
  mutations = [];
  for (const method of ['get', 'put', 'query', 'update']) {
    dynamo[method] = async (...args) => {
      mutations.push({ method, args });
      return method === 'query' ? { items: [] } : null;
    };
  }
});

after(() => {
  Object.assign(dynamo, original);
});

describe('financial operations without a payment provider', () => {
  const blockedOperations = [
    ['/api/orders', 'Payments are disabled'],
    ['/api/orders/order-1/dispatch', 'Order fulfillment is disabled'],
    ['/api/orders/order-1/dispute', 'Order disputes are unavailable'],
    ['/api/orders/order-1/confirm', 'Escrow settlement is disabled'],
    ['/api/orders/order-1/resolve', 'Escrow resolution is disabled'],
    ['/api/wallet/topup', 'Wallet deposits are disabled'],
    ['/api/wallet/withdraw', 'Wallet withdrawals are disabled'],
    ['/api/items/item-1/promote', 'Paid listing promotion is disabled'],
    ['/api/ads', 'Paid listing promotion is disabled'],
  ];

  for (const [path, message] of blockedOperations) {
    it(`rejects ${path} without touching persistence`, async () => {
      mutations = [];
      const endpoint = path.includes('/items/') || path === '/api/ads' ? itemsHandler : handler;
      const response = await endpoint({ path, httpMethod: 'POST', body: '{}' });

      assert.equal(response.statusCode, 503);
      assert.match(JSON.parse(response.body).error, new RegExp(message));
      assert.deepEqual(mutations, []);
    });
  }
});

describe('listing media fields', () => {
  it('stores listing photos and video URLs for the Reels feed', async () => {
    mutations = [];
    const response = await itemsHandler({
      path: '/api/items',
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Vintage jacket',
        priceZar: 100,
        photos: ['/media/uploads/usr_test/photo.jpg'],
        videoUrl: '/media/uploads/usr_test/video.mp4',
      }),
      requestContext: { authorizer: { claims: { sub: 'usr_test', email: 'seller@example.com', role: 'vendor' } } },
    });

    assert.equal(response.statusCode, 201);
    const storedItem = mutations.find((mutation) => mutation.method === 'put').args[1];
    assert.deepEqual(storedItem.photos, ['/media/uploads/usr_test/photo.jpg']);
    assert.equal(storedItem.video_url, '/media/uploads/usr_test/video.mp4');
    assert.equal(JSON.parse(response.body).item.videoUrl, '/media/uploads/usr_test/video.mp4');
  });
});
