'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { handler } = require('../src/api');

test('SAM API routes match the /api paths forwarded by CloudFront', () => {
  const template = fs.readFileSync(path.join(__dirname, '..', 'template.yaml'), 'utf8');
  for (const route of [
    '/api/units',
    '/api/reservations',
    '/api/reservations/{reservationId}',
    '/api/notifications',
  ]) {
    assert.ok(template.includes(`Path: ${route}`), `Missing API Gateway route ${route}`);
  }
});

function event({ method = 'GET', path = '/dev/api/units', claims, body } = {}) {
  return {
    httpMethod: method,
    path,
    body,
    requestContext: {
      stage: 'dev',
      ...(claims ? { authorizer: { claims } } : {}),
    },
  };
}

async function withDatabaseMock(mockSend, run) {
  const originalSend = DynamoDBDocumentClient.prototype.send;
  DynamoDBDocumentClient.prototype.send = mockSend;
  try {
    await run();
  } finally {
    DynamoDBDocumentClient.prototype.send = originalSend;
  }
}

test('storage API requires a Cognito identity', async () => {
  const result = await handler(event());

  assert.equal(result.statusCode, 401);
  assert.deepEqual(JSON.parse(result.body), { error: 'Sign in is required.' });
});

test('unknown authenticated routes return a client error', async () => {
  const result = await handler(event({
    path: '/dev/api/not-a-route',
    claims: { sub: 'user-1', email: 'user@example.com' },
  }));

  assert.equal(result.statusCode, 404);
  assert.deepEqual(JSON.parse(result.body), { error: 'Route not found.' });
});

test('unit creation is denied unless the signed-in email is configured as an administrator', async () => {
  const original = process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_EMAILS;
  try {
    const result = await handler(event({
      method: 'POST',
      claims: { sub: 'user-1', email: 'user@example.com' },
      body: JSON.stringify({ name: 'Unit A', size: '5 x 5 ft', monthlyPrice: 500 }),
    }));

    assert.equal(result.statusCode, 403);
    assert.deepEqual(JSON.parse(result.body), { error: 'Only a configured administrator can add storage units.' });
  } finally {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  }
});

test('an unverified administrator email cannot add units', async () => {
  const original = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'admin@example.com';
  try {
    const result = await handler(event({
      method: 'POST',
      claims: { sub: 'admin-1', email: 'admin@example.com', email_verified: 'false' },
      body: JSON.stringify({ name: 'Unit A', size: '5 x 5 ft', monthlyPrice: 500 }),
    }));

    assert.equal(result.statusCode, 403);
    assert.deepEqual(JSON.parse(result.body), { error: 'Only a configured administrator can add storage units.' });
  } finally {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  }
});

test('admin unit creation validates input before using AWS services', async () => {
  const original = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'admin@example.com';
  try {
    const result = await handler(event({
      method: 'POST',
      claims: { sub: 'admin-1', email: 'admin@example.com', email_verified: 'true' },
      body: JSON.stringify({ name: 'X', size: '5 x 5 ft', monthlyPrice: 500 }),
    }));

    assert.equal(result.statusCode, 400);
    assert.deepEqual(JSON.parse(result.body), { error: 'Unit name must be between 2 and 80 characters.' });
  } finally {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  }
});

test('invalid JSON is returned as a client error', async () => {
  const result = await handler(event({
    method: 'POST',
    path: '/dev/api/reservations',
    claims: { sub: 'user-1', email: 'user@example.com' },
    body: '{',
  }));

  assert.equal(result.statusCode, 400);
  assert.deepEqual(JSON.parse(result.body), { error: 'Request body must be valid JSON.' });
});

test('available unit results do not expose private reservation ownership fields', async () => {
  await withDatabaseMock(async (command) => ({
    Items: [{
      id: 'unit-1',
      name: 'Unit A',
      size: '5 x 5 ft',
      monthlyPriceCents: 50000,
      status: 'RESERVED',
      reservedBy: 'another-user',
      reservedAt: '2026-01-01T00:00:00.000Z',
    }],
  }), async () => {
    const result = await handler(event({
      claims: { sub: 'user-1', email: 'user@example.com' },
    }));
    const unit = JSON.parse(result.body).units[0];

    assert.equal(result.statusCode, 200);
    assert.equal(unit.status, 'RESERVED');
    assert.equal(unit.reservedBy, undefined);
    assert.equal(unit.reservedAt, undefined);
  });
});

test('reservation uses a conditional unit update and writes the user-owned reservation atomically', async () => {
  const commands = [];
  await withDatabaseMock(async (command) => {
    commands.push(command);
    if (command.constructor.name === 'GetCommand') {
      return {
        Item: {
          id: '12345678-1234-4234-8234-123456789abc',
          name: 'Unit A',
          size: '5 x 5 ft',
          monthlyPriceCents: 50000,
          status: 'AVAILABLE',
        },
      };
    }
    return {};
  }, async () => {
    const result = await handler(event({
      method: 'POST',
      path: '/dev/api/reservations',
      claims: { sub: 'user-1', email: 'user@example.com' },
      body: JSON.stringify({ unitId: '12345678-1234-4234-8234-123456789abc' }),
    }));
    const transaction = commands.find((command) => command.constructor.name === 'TransactWriteCommand');
    const writes = transaction.input.TransactItems;

    assert.equal(result.statusCode, 201);
    assert.equal(writes.length, 3);
    assert.match(writes[0].Update.ConditionExpression, /#status = :available/);
    assert.equal(writes[1].Put.Item.pk, 'USER#user-1');
    assert.equal(writes[1].Put.Item.status, 'ACTIVE');
    assert.equal(writes[2].Put.Item.pk.startsWith('OUTBOX#'), true);
  });
});

test('concurrent reservation conflicts return a conflict response', async () => {
  await withDatabaseMock(async (command) => {
    if (command.constructor.name === 'GetCommand') {
      return {
        Item: {
          id: '12345678-1234-4234-8234-123456789abc',
          name: 'Unit A',
          size: '5 x 5 ft',
          monthlyPriceCents: 50000,
          status: 'AVAILABLE',
        },
      };
    }
    const error = new Error('Transaction cancelled');
    error.name = 'TransactionCanceledException';
    throw error;
  }, async () => {
    const result = await handler(event({
      method: 'POST',
      path: '/dev/api/reservations',
      claims: { sub: 'user-1', email: 'user@example.com' },
      body: JSON.stringify({ unitId: '12345678-1234-4234-8234-123456789abc' }),
    }));

    assert.equal(result.statusCode, 409);
    assert.match(JSON.parse(result.body).error, /changed/);
  });
});
