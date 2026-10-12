'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../src/app');

test('health check is public and identifies the marketplace service', async () => {
  const result = await handler({ httpMethod: 'GET', path: '/dev/api/health', requestContext: { stage: 'dev' } });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { status: 'healthy', service: 'dobha-marketplace' });
});

test('protected routes reject requests without Cognito identity claims', async () => {
  const result = await handler({ httpMethod: 'GET', path: '/dev/api/private/items/mine', requestContext: { stage: 'dev' } });

  assert.equal(result.statusCode, 401);
  assert.deepEqual(JSON.parse(result.body), { error: 'Please sign in' });
});

test('malformed JSON receives a client error rather than a server error', async () => {
  const result = await handler({
    httpMethod: 'POST',
    path: '/dev/api/private/items',
    body: '{',
    requestContext: { stage: 'dev', authorizer: { claims: { sub: 'user-1' } } },
  });

  assert.equal(result.statusCode, 400);
  assert.deepEqual(JSON.parse(result.body), { error: 'Request body must be valid JSON' });
});

test('public viewer-token endpoint does not require a Cognito session', async () => {
  const original = {
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    LIVEKIT_URL: process.env.LIVEKIT_URL,
  };
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;
  delete process.env.LIVEKIT_URL;
  try {
    const result = await handler({
      httpMethod: 'GET',
      path: '/dev/api/live/token',
      queryStringParameters: { room: 'seller-room' },
      requestContext: { stage: 'dev' },
    });
    assert.equal(result.statusCode, 503);
    assert.deepEqual(JSON.parse(result.body), { error: 'Mobile live streaming is not configured' });
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
