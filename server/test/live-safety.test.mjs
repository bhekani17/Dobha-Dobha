import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handler } = require('../src/live/handler.js');
const liveKitEnvironment = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']
  .map((key) => [key, process.env[key]]);

for (const [key] of liveKitEnvironment) delete process.env[key];

after(() => {
  for (const [key, value] of liveKitEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('live streaming without provider configuration', () => {
  it('does not issue a fake viewer token', async () => {
    const response = await handler({
      path: '/api/token',
      httpMethod: 'GET',
      queryStringParameters: { room: 'dobha-live-room', role: 'viewer' },
    });

    assert.equal(response.statusCode, 503);
    assert.match(JSON.parse(response.body).error, /LiveKit is configured/);
  });
});
