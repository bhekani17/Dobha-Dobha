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
    ['/api/orders/order-1/confirm', 'Escrow settlement is disabled'],
    ['/api/orders/order-1/resolve', 'Escrow resolution is disabled'],
    ['/api/wallet/topup', 'Wallet deposits are disabled'],
    ['/api/wallet/withdraw', 'Wallet withdrawals are disabled'],
    ['/api/items/item-1/promote', 'Paid listing promotion is disabled'],
  ];

  for (const [path, message] of blockedOperations) {
    it(`rejects ${path} without touching persistence`, async () => {
      mutations = [];
      const endpoint = path.includes('/items/') ? itemsHandler : handler;
      const response = await endpoint({ path, httpMethod: 'POST', body: '{}' });

      assert.equal(response.statusCode, 503);
      assert.match(JSON.parse(response.body).error, new RegExp(message));
      assert.deepEqual(mutations, []);
    });
  }
});
