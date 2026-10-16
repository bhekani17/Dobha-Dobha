'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { handler } = require('../src/app');

const item = {
  pk: 'ITEM#item-1', sk: 'META', id: 'item-1', sellerId: 'seller-1', title: 'Jacket',
  priceCents: 10000, quantity: 2, status: 'available', category: 'Clothing & Accessories',
  condition: 'Good', size: 'M', photoKey: 'items/seller-1/photo.jpg',
  createdAt: '2026-10-16T00:00:00.000Z',
};
const order = {
  pk: 'ORDER#order-1', sk: 'META', id: 'order-1', itemId: 'item-1', itemTitle: 'Jacket',
  buyerId: 'buyer-1', sellerId: 'seller-1', amountCents: 10000, shippingCents: 5000,
  status: 'vendorDispatched', deliveryMethod: 'PUDO Locker-to-Locker', deliveryAddress: 'Synthetic Street',
  paymentMethod: 'Dobha In-App Wallet', vaultRef: 'ESC-test', createdAt: '2026-10-16T00:00:00.000Z', item,
};
function event(path, { user = 'buyer-1', body = {}, claims = {}, method = 'POST' } = {}) {
  return { httpMethod: method, path: `/api${path}`, body: JSON.stringify(body), requestContext: {
    authorizer: { claims: { sub: user, email: `${user}@example.test`, name: 'Synthetic User', ...claims } },
  } };
}
async function withStore(fn, run) {
  const original = DynamoDBDocumentClient.prototype.send;
  DynamoDBDocumentClient.prototype.send = fn;
  try { await run(); } finally { DynamoDBDocumentClient.prototype.send = original; }
}
function reads(command, currentOrder = order) {
  if (command.constructor.name !== 'GetCommand') return undefined;
  const key = command.input.Key;
  if (key.pk === 'ITEM#item-1') return { Item: { ...item } };
  if (key.pk === 'ORDER#order-1') return { Item: { ...currentOrder } };
  if (key.sk === 'WALLET') return { Item: { availableCents: 20000, lockedCents: 15000, pendingCents: 10000 } };
  return { Item: { id: key.pk.slice(5), role: 'shopper', name: 'Synthetic User', handle: 'synthetic' } };
}
const checkout = { itemId: 'item-1', deliveryMethod: 'PUDO Locker-to-Locker', deliveryAddress: 'Synthetic Street', paymentMethod: 'Dobha In-App Wallet' };

test('checkout writes stock, order, both wallets and ledger in one transaction', async () => {
  const transactions = [];
  await withStore(async (command) => {
    const result = reads(command);
    if (result) return result;
    assert.equal(command.constructor.name, 'TransactWriteCommand');
    transactions.push(command.input.TransactItems);
    return {};
  }, async () => {
    const result = await handler(event('/orders', { body: checkout }));
    assert.equal(result.statusCode, 201);
    const placed = JSON.parse(result.body).order;
    assert.equal(placed.status, 'paymentHeld');
    assert.equal(placed.shippingFeeZar, 50);
    assert.equal(placed.item.priceZar, 100);
    assert.equal(placed.isSeller, false);
    assert.equal(transactions.length, 1);
    const writes = transactions[0];
    const stock = writes.find((write) => write.Update?.Key.pk === 'ITEM#item-1').Update;
    assert.match(stock.ConditionExpression, /quantity = :expected/);
    assert.equal(stock.ExpressionAttributeValues[':expected'], 2);
    assert.equal(stock.ExpressionAttributeValues[':remaining'], 1);
    const buyer = writes.find((write) => write.Update?.Key.pk === 'USER#buyer-1').Update;
    assert.match(buyer.ConditionExpression, /availableCents >= :total/);
    assert.equal(buyer.ExpressionAttributeValues[':total'], 15000);
    assert.equal(writes.filter((write) => write.ConditionCheck).length, 2);
    const references = writes.filter((write) => write.Put?.Item.sk.startsWith('ORDER#')).map((write) => write.Put.Item);
    assert.deepEqual(references.map((entry) => entry.pk).sort(), ['USER#buyer-1', 'USER#seller-1']);
    assert.ok(references.every((entry) => entry.orderId === placed.id));
    assert.ok(writes.some((write) => write.Put?.Item.sk.startsWith('TRANSACTION#')));
    assert.ok(writes.some((write) => write.Put?.Item.pk.startsWith('OUTBOX#')));
  });
});

test('checkout conflict does not issue compensating stock or wallet writes', async () => {
  const writes = [];
  await withStore(async (command) => {
    const result = reads(command);
    if (result) return result;
    writes.push(command);
    throw Object.assign(new Error('Conflict'), { name: 'TransactionCanceledException' });
  }, async () => {
    const result = await handler(event('/orders', { body: checkout }));
    assert.equal(result.statusCode, 409);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].constructor.name, 'TransactWriteCommand');
  });
});

test('confirmation atomically commits the status, balances, ledger and notification', async () => {
  let current = { ...order };
  const writes = [];
  await withStore(async (command) => {
    const result = reads(command, current);
    if (result) return result;
    assert.equal(command.constructor.name, 'TransactWriteCommand');
    writes.push(command.input.TransactItems);
    current = { ...current, status: 'payoutReleased' };
    return {};
  }, async () => {
    const result = await handler(event('/orders/order-1/confirm'));
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).order.status, 'payoutReleased');
    const tx = writes[0];
    assert.equal(tx.length, 5);
    const transition = tx.find((w) => w.Update?.Key.pk === 'ORDER#order-1').Update;
    assert.equal(transition.ExpressionAttributeValues[':expected'], 'vendorDispatched');
    const payout = tx.find((w) => w.Update?.Key.pk === 'USER#seller-1').Update;
    assert.equal(payout.ExpressionAttributeValues[':payout'], 9500);
    assert.match(payout.ConditionExpression, /pendingCents >= :amount/);
    assert.equal((await handler(event('/orders/order-1/confirm'))).statusCode, 200);
    assert.equal(writes.length, 1, 'retry must not pay twice');
  });
});

test('failed settlement remains retryable without a separate status write', async () => {
  let attempts = 0;
  await withStore(async (command) => {
    const result = reads(command);
    if (result) return result;
    assert.equal(command.constructor.name, 'TransactWriteCommand');
    attempts++;
    throw Object.assign(new Error('Injected transaction failure'), { name: 'TransactionCanceledException' });
  }, async () => {
    assert.equal((await handler(event('/orders/order-1/confirm'))).statusCode, 409);
    assert.equal((await handler(event('/orders/order-1/confirm'))).statusCode, 409);
    assert.equal(attempts, 2);
  });
});

test('seller cannot confirm buyer receipt', async () => {
  await withStore(async (command) => {
    const result = reads(command);
    if (result) return result;
    assert.fail('Unauthorized caller must not write');
  }, async () => assert.equal((await handler(event('/orders/order-1/confirm', { user: 'seller-1' }))).statusCode, 403));
});

test('dispute settlement requires both verified email and explicit Cognito group membership', async () => {
  const cases = [
    { email_verified: 'true', email: 'admin@example.test' },
    { email_verified: 'false', 'cognito:groups': 'administrators' },
    { email_verified: 'true', 'cognito:groups': 'not-administrators' },
  ];
  await withStore(async (command) => {
    const result = reads(command, { ...order, status: 'disputed' });
    if (result) return result;
    assert.fail('Unauthorized administrator must not write');
  }, async () => {
    for (const claims of cases) assert.equal((await handler(event('/orders/order-1/resolve', { user: 'admin-1', claims, body: { outcome: 'release' } }))).statusCode, 403);
  });
});

test('verified administrator refunds disputed escrow within one transaction', async () => {
  let transaction;
  await withStore(async (command) => {
    const result = reads(command, { ...order, status: 'disputed' });
    if (result) return result;
    assert.equal(command.constructor.name, 'TransactWriteCommand');
    transaction = command.input.TransactItems;
    return {};
  }, async () => {
    const result = await handler(event('/orders/order-1/resolve', { user: 'admin-1', claims: { email_verified: 'true', 'cognito:groups': '[administrators]' }, body: { outcome: 'refund' } }));
    assert.equal(result.statusCode, 200);
    const buyer = transaction.find((w) => w.Update?.Key.pk === 'USER#buyer-1').Update;
    assert.match(buyer.UpdateExpression, /availableCents = availableCents \+ :total/);
    assert.equal(buyer.ExpressionAttributeValues[':total'], 15000);
    assert.equal(transaction.find((w) => w.Update?.Key.pk === 'ORDER#order-1').Update.ExpressionAttributeValues[':expected'], 'disputed');
  });
});

test('simulated payments are disabled unless explicitly enabled', async () => {
  const previous = process.env.ENABLE_SIMULATED_PAYMENTS;
  delete process.env.ENABLE_SIMULATED_PAYMENTS;
  await withStore(async (command) => reads(command), async () => {
    try {
      assert.equal((await handler(event('/wallet/topup', { body: { amountZar: 100, method: 'Card' } }))).statusCode, 503);
      assert.equal((await handler(event('/orders', { body: { ...checkout, paymentMethod: 'Debit / Credit Card' } }))).statusCode, 503);
    } finally {
      if (previous === undefined) delete process.env.ENABLE_SIMULATED_PAYMENTS;
      else process.env.ENABLE_SIMULATED_PAYMENTS = previous;
    }
  });
});

test('account deletion refuses any available, locked or pending wallet balance', async () => {
  for (const field of ['availableCents', 'lockedCents', 'pendingCents']) {
    await withStore(async (command) => {
      if (command.input.Key?.sk === 'WALLET') return { Item: { [field]: 1 } };
      if (command.constructor.name === 'GetCommand') return { Item: { id: 'buyer-1', hasPassword: false } };
      assert.fail('Deletion must stop before mutating account data');
    }, async () => assert.equal((await handler(event('/me', { method: 'DELETE', body: { confirm: 'DELETE' } }))).statusCode, 409));
  }
});

test('CloudFront forwards marketplace writes to authenticated API routes without caching', () => {
  const template = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'template.yaml'), 'utf8');
  assert.match(template, /Path: \/api\/\{proxy\+\}/);
  assert.match(template, /Authorizer: CognitoAuthorizer/);
  assert.match(template, /CachePolicyId: !Ref ApiCachePolicy/);
  assert.match(template, /GroupName: administrators/);
});

test('deletion locks the profile and checks zero wallet balances before deleting media', async () => {
  let lock;
  await withStore(async (command) => {
    if (command.constructor.name === 'GetCommand') {
      return command.input.Key.sk === 'WALLET'
        ? { Item: { availableCents: 0, lockedCents: 0, pendingCents: 0 } }
        : { Item: { id: 'buyer-1', hasPassword: false } };
    }
    if (command.constructor.name === 'QueryCommand') return { Items: [] };
    if (command.constructor.name === 'TransactWriteCommand') {
      lock = command.input.TransactItems;
      // Model a top-up winning between the initial wallet read and this lock.
      throw Object.assign(new Error('Wallet no longer empty'), { name: 'TransactionCanceledException' });
    }
    assert.fail('Destructive writes must not run after a failed deletion lock');
  }, async () => {
    const result = await handler(event('/me', { method: 'DELETE', body: { confirm: 'DELETE' } }));
    assert.equal(result.statusCode, 409);
    assert.match(lock[0].Update.UpdateExpression, /deletingAt/);
    assert.equal(lock[1].ConditionCheck.Key.sk, 'WALLET');
    assert.match(lock[1].ConditionCheck.ConditionExpression, /availableCents = :zero AND lockedCents = :zero AND pendingCents = :zero/);
  });
});

test('listing edits cannot overwrite stock changed by concurrent checkout', async () => {
  let attemptedEdit;
  await withStore(async (command) => {
    const result = reads(command);
    if (result) return result;
    assert.equal(command.constructor.name, 'PutCommand');
    attemptedEdit = command.input;
    throw Object.assign(new Error('Stock changed'), { name: 'ConditionalCheckFailedException' });
  }, async () => {
    const result = await handler(event('/items/item-1', { method: 'PATCH', user: 'seller-1', body: { title: 'Edited jacket' } }));
    assert.equal(result.statusCode, 409);
    assert.match(attemptedEdit.ConditionExpression, /quantity = :quantity AND priceCents = :price/);
    assert.equal(attemptedEdit.ExpressionAttributeValues[':quantity'], 2);
  });
});

test('checkout rejects inherited delivery properties and never writes an invalid amount', async () => {
  await withStore(async (command) => {
    const result = reads(command);
    if (result) return result;
    assert.fail('Invalid delivery option must not create an order');
  }, async () => {
    const result = await handler(event('/orders', { body: { ...checkout, deliveryMethod: '__proto__' } }));
    assert.equal(result.statusCode, 400);
  });
});
