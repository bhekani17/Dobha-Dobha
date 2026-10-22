import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dynamo = require('../src/utils/dynamo.js');
const { handler } = require('../src/orders/handler.js');

const savedEnv = {};
for (const key of ['STAGE', 'PAYFAST_SANDBOX_ENABLED', 'ORDERS_TABLE', 'ITEMS_TABLE', 'NOTIFICATIONS_TABLE', 'USERS_TABLE']) {
  savedEnv[key] = process.env[key];
}
const originalDynamo = {
  get: dynamo.get,
  put: dynamo.put,
  update: dynamo.update,
  transactWrite: dynamo.transactWrite,
};
const listing = {
  id: 'item_test',
  seller_id: 'seller_test',
  title: 'Sandbox test item',
  price_cents: 12500,
  status: 'available',
  quantity: 1,
  photos: [],
};
const storedOrder = {
  id: 'ord_test',
  buyer_id: 'buyer_test',
  seller_id: 'seller_test',
  item_id: listing.id,
  item_title: listing.title,
  amount_cents: listing.price_cents,
  shipping_cents: 0,
  total_cents: listing.price_cents,
  delivery_method: 'seller_pickup',
  delivery_address: 'Agreed pickup location, Cape Town',
  payment_method: 'payfast_sandbox',
  payment_status: 'not_started',
  status: 'sellerApprovalPending',
  sandbox_mode: true,
  created_at: 1,
};
const writes = [];
const updates = [];
const transactions = [];

before(() => {
  process.env.STAGE = 'dev';
  process.env.PAYFAST_SANDBOX_ENABLED = 'true';
  process.env.ORDERS_TABLE = 'orders';
  process.env.ITEMS_TABLE = 'items';
  delete process.env.NOTIFICATIONS_TABLE;
  delete process.env.USERS_TABLE;
  dynamo.get = async (tableName) => tableName === 'items' ? listing : storedOrder;
  dynamo.put = async (...args) => writes.push(args);
  dynamo.update = async (params) => {
    updates.push(params);
    if (
      params.ExpressionAttributeValues?.[':expected'] &&
      params.ExpressionAttributeValues[':expected'] !== storedOrder.status
    ) {
      const error = new Error('Conditional update failed');
      error.name = 'ConditionalCheckFailedException';
      throw error;
    }
  };
  dynamo.transactWrite = async (params) => transactions.push(params);
});

after(() => {
  Object.assign(dynamo, originalDynamo);
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function request(path, userId, body = {}) {
  return {
    path,
    httpMethod: 'POST',
    body: JSON.stringify(body),
    requestContext: {
      authorizer: {
        claims: { sub: userId, email: `${userId}@example.test`, name: userId },
      },
    },
  };
}

describe('test-only order workflow', () => {
  it('reports only explicitly enabled test payment providers', async () => {
    const response = await handler({
      path: '/api/payments/sandbox-capabilities',
      httpMethod: 'GET',
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body).providers, ['payfast_sandbox']);
  });

  it('creates an unpaid sandbox order request from an available listing', async () => {
    writes.length = 0;
    const response = await handler(request('/api/orders', 'buyer_test', {
      itemId: listing.id,
      deliveryMethod: 'seller_pickup',
      deliveryAddress: 'Agreed pickup location, Cape Town',
      paymentMethod: 'payfast_sandbox',
    }));

    assert.equal(response.statusCode, 201);
    const order = writes[0][1];
    assert.equal(order.status, 'sellerApprovalPending');
    assert.equal(order.payment_status, 'not_started');
    assert.equal(order.sandbox_mode, true);
    assert.equal(order.total_cents, listing.price_cents);
  });

  it('allows the assigned seller to accept but keeps fulfillment blocked on payment verification', async () => {
    transactions.length = 0;
    const accepted = await handler(request('/api/orders/ord_test/accept', 'seller_test'));
    assert.equal(accepted.statusCode, 200);
    const orderUpdate = transactions[0][1].Update;
    assert.equal(orderUpdate.ConditionExpression, '#st = :pending');
    assert.equal(orderUpdate.ExpressionAttributeValues[':pending'], 'sellerApprovalPending');
    assert.equal(orderUpdate.ExpressionAttributeValues[':accepted'], 'sellerAccepted');

    const preparing = await handler(request('/api/orders/ord_test/prepare', 'seller_test'));
    assert.equal(preparing.statusCode, 409);
  });

  it('keeps legacy dispatch and escrow-confirmation endpoints disabled', async () => {
    for (const path of ['/api/orders/ord_test/dispatch', '/api/orders/ord_test/confirm']) {
      const response = await handler(request(path, 'seller_test'));
      assert.equal(response.statusCode, 503);
    }
  });
});
