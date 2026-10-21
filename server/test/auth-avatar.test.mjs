import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { S3Client } = require('@aws-sdk/client-s3');
const dynamo = require('../src/utils/dynamo.js');
const { handler } = require('../src/auth/handler.js');

const originalGet = dynamo.get;
const originalUpdate = dynamo.update;
const originalSend = S3Client.prototype.send;
const originalEnv = {
  USERS_TABLE: process.env.USERS_TABLE,
  PHOTOS_BUCKET: process.env.PHOTOS_BUCKET,
  WALLET_TABLE: process.env.WALLET_TABLE,
  WALLETS_TABLE: process.env.WALLETS_TABLE,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
};
const user = {
  id: 'usr_test',
  name: 'Test User',
  email: 'test@example.com',
  handle: 'test',
  role: 'buyer',
  avatar_key: 'avatars/usr_test/old.png',
};
let currentUser;
let commands;

before(() => {
  process.env.USERS_TABLE = 'users';
  process.env.PHOTOS_BUCKET = 'photos';
  delete process.env.WALLET_TABLE;
  delete process.env.WALLETS_TABLE;
  process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.AWS_REGION = 'af-south-1';
});

after(() => {
  dynamo.get = originalGet;
  dynamo.update = originalUpdate;
  S3Client.prototype.send = originalSend;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('avatar endpoints', () => {
  before(() => {
    dynamo.get = async (table, key) => (table === 'users' && key.id === currentUser.id ? { ...currentUser } : null);
    dynamo.update = async ({ UpdateExpression, ExpressionAttributeValues }) => {
      if (UpdateExpression.startsWith('SET avatar_key')) {
        currentUser.avatar_key = ExpressionAttributeValues[':key'];
        delete currentUser.avatar_url;
      } else {
        delete currentUser.avatar_key;
        delete currentUser.avatar_url;
      }
    };
    S3Client.prototype.send = async (command) => {
      commands.push(command);
      if (command.constructor.name === 'GetObjectCommand') {
        return {
          ContentType: 'image/png',
          Body: { transformToString: async (encoding) => Buffer.from('image').toString(encoding) },
        };
      }
      return {};
    };
  });

  beforeEach(() => {
    currentUser = { ...user };
    commands = [];
  });

  it('stores a validated avatar and returns the updated profile', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const response = await handler({
      path: '/api/me/avatar',
      httpMethod: 'PUT',
      headers: { 'content-type': 'image/png', authorization: 'Bearer test-session' },
      body: png.toString('base64'),
      isBase64Encoded: true,
      requestContext: { authorizer: { claims: { sub: user.id, email: user.email } } },
    });

    assert.equal(response.statusCode, 200);
    assert.match(JSON.parse(response.body).user.avatarUrl, /^\/media\/avatars\/usr_test\/img_[a-f0-9]+\.png$/);
    assert.equal(commands[0].constructor.name, 'PutObjectCommand');
    assert.deepEqual(commands[0].input.Body, png);
    assert.equal(commands[1].constructor.name, 'DeleteObjectCommand');
    assert.equal(commands[1].input.Key, user.avatar_key);
  });

  it('rejects a mismatched image signature without uploading', async () => {
    const response = await handler({
      path: '/api/me/avatar',
      httpMethod: 'PUT',
      headers: { 'content-type': 'image/png', authorization: 'Bearer test-session' },
      body: Buffer.from('not a PNG').toString('base64'),
      isBase64Encoded: true,
      requestContext: { authorizer: { claims: { sub: user.id, email: user.email } } },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(commands.length, 0);
  });

  it('removes the avatar from storage and the profile', async () => {
    const response = await handler({
      path: '/api/me/avatar',
      httpMethod: 'DELETE',
      headers: { authorization: 'Bearer test-session' },
      requestContext: { authorizer: { claims: { sub: user.id, email: user.email } } },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).user.avatarUrl, null);
    assert.equal(commands[0].constructor.name, 'DeleteObjectCommand');
    assert.equal(commands[0].input.Key, user.avatar_key);
  });

  it('redirects stored media to a short-lived S3 URL', async () => {
    const response = await handler({
      path: '/media/avatars/usr_test/photo.png',
      httpMethod: 'GET',
    });

    assert.equal(response.statusCode, 302);
    assert.match(response.headers.Location, /^https:\/\/photos\.s3\.af-south-1\.amazonaws\.com\/avatars\/usr_test\/photo\.png\?/);
    assert.match(response.headers.Location, /X-Amz-Expires=900/);
    assert.equal(response.headers['Cache-Control'], 'private, no-store');
    assert.equal(response.body, '');
    assert.equal(commands.length, 0);
  });

  it('creates a short-lived S3 upload URL for supported mobile media', async () => {
    const response = await handler({
      path: '/api/uploads',
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-session' },
      body: JSON.stringify({ contentType: 'video/mp4', size: 1024 }),
      requestContext: { authorizer: { claims: { sub: user.id, email: user.email } } },
    });

    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.match(body.key, /^uploads\/usr_test\/media_[a-f0-9]+\.mp4$/);
    assert.match(body.uploadUrl, /^https:\/\/photos\.s3\.af-south-1\.amazonaws\.com\/uploads\//);
    assert.match(body.uploadUrl, /X-Amz-Expires=300/);
    assert.match(new URL(body.uploadUrl).searchParams.get('X-Amz-SignedHeaders'), /content-length/);
  });

  it('stores valid small legacy uploads directly in S3', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const response = await handler({
      path: '/api/uploads',
      httpMethod: 'POST',
      headers: { 'content-type': 'image/png', authorization: 'Bearer test-session' },
      body: png.toString('base64'),
      isBase64Encoded: true,
      requestContext: { authorizer: { claims: { sub: user.id, email: user.email } } },
    });

    assert.equal(response.statusCode, 201);
    assert.match(JSON.parse(response.body).key, /^uploads\/usr_test\/media_[a-f0-9]+\.png$/);
    assert.equal(commands[0].constructor.name, 'PutObjectCommand');
    assert.deepEqual(commands[0].input.Body, png);
  });

  it('rejects upload URLs for media larger than the mobile limit', async () => {
    const response = await handler({
      path: '/api/uploads',
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-session' },
      body: JSON.stringify({ contentType: 'video/mp4', size: 60 * 1024 * 1024 + 1 }),
      requestContext: { authorizer: { claims: { sub: user.id, email: user.email } } },
    });

    assert.equal(response.statusCode, 413);
    assert.equal(commands.length, 0);
  });
});
