import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const corsOrigin = process.env.ALLOWED_WEB_ORIGINS;
process.env.ALLOWED_WEB_ORIGINS = '*';
const { handler } = require('../src/live/handler.js');
const { RoomServiceClient } = require('livekit-server-sdk');
if (corsOrigin === undefined) delete process.env.ALLOWED_WEB_ORIGINS;
else process.env.ALLOWED_WEB_ORIGINS = corsOrigin;
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
    assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
    assert.match(JSON.parse(response.body).error, /LiveKit is configured/);
  });
});

describe('live hosting authorization', () => {
  it('issues a publish token to a signed-in buyer', async () => {
    process.env.LIVEKIT_URL = 'wss://live.example.test';
    process.env.LIVEKIT_API_KEY = 'test-key';
    process.env.LIVEKIT_API_SECRET = 'test-secret';

    const response = await handler({
      path: '/api/token',
      httpMethod: 'GET',
      queryStringParameters: { room: 'community-stream', role: 'host' },
      requestContext: {
        authorizer: {
          claims: {
            sub: 'buyer-123',
            email: 'buyer@example.test',
            name: 'Dobha Buyer',
          },
        },
      },
    });

    assert.equal(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.equal(result.role, 'host');
    assert.equal(result.room, 'community-stream');
    const claims = JSON.parse(Buffer.from(result.token.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(claims.video.room, 'community-stream');
    assert.equal(claims.video.canPublish, true);
    assert.equal(claims.name, 'Dobha Buyer');
  });

  it('still requires sign-in to host', async () => {
    process.env.LIVEKIT_URL = 'wss://live.example.test';
    process.env.LIVEKIT_API_KEY = 'test-key';
    process.env.LIVEKIT_API_SECRET = 'test-secret';

    const response = await handler({
      path: '/api/token',
      httpMethod: 'GET',
      queryStringParameters: { room: 'community-stream', role: 'host' },
    });

    assert.equal(response.statusCode, 401);
  });
});

describe('live stream ending authorization', () => {
  async function runEndRequest({ callerId, hostId }) {
    process.env.LIVEKIT_URL = 'wss://live.example.test';
    process.env.LIVEKIT_API_KEY = 'test-key';
    process.env.LIVEKIT_API_SECRET = 'test-secret';
    const originalListParticipants = RoomServiceClient.prototype.listParticipants;
    const originalDeleteRoom = RoomServiceClient.prototype.deleteRoom;
    let deleted = false;
    RoomServiceClient.prototype.listParticipants = async () => [
      { metadata: JSON.stringify({ role: 'host', userId: hostId }) },
    ];
    RoomServiceClient.prototype.deleteRoom = async () => {
      deleted = true;
    };

    try {
      const response = await handler({
        path: '/api/rooms/end',
        httpMethod: 'POST',
        body: JSON.stringify({ room: 'community-stream' }),
        requestContext: {
          authorizer: { claims: { sub: callerId, email: `${callerId}@example.test` } },
        },
      });
      return { response, deleted };
    } finally {
      RoomServiceClient.prototype.listParticipants = originalListParticipants;
      RoomServiceClient.prototype.deleteRoom = originalDeleteRoom;
    }
  }

  it('does not let another signed-in user end the host stream', async () => {
    const { response, deleted } = await runEndRequest({ callerId: 'buyer-123', hostId: 'host-456' });

    assert.equal(response.statusCode, 403);
    assert.equal(deleted, false);
  });

  it('allows the active host to end their own stream', async () => {
    const { response, deleted } = await runEndRequest({ callerId: 'host-456', hostId: 'host-456' });

    assert.equal(response.statusCode, 200);
    assert.equal(deleted, true);
  });
});
