'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
const { S3Client } = require('@aws-sdk/client-s3');
const { handler } = require('../src/app');

async function withDatabaseMock(mockSend, run) {
  const originalSend = DynamoDBDocumentClient.prototype.send;
  DynamoDBDocumentClient.prototype.send = mockSend;
  try {
    await run();
  } finally {
    DynamoDBDocumentClient.prototype.send = originalSend;
  }
}

async function withClientMocks(mocks, run) {
  const originals = mocks.map(([client, mock]) => [client, client.prototype.send, mock]);
  for (const [client, , mock] of originals) client.prototype.send = mock;
  try {
    await run();
  } finally {
    for (const [client, original] of originals) client.prototype.send = original;
  }
}

test('health check is public and identifies the marketplace service', async () => {
  const result = await handler({ httpMethod: 'GET', path: '/dev/api/health', requestContext: { stage: 'dev' } });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { status: 'healthy', service: 'dobha-marketplace' });
});

test('profile endpoint returns the fields required by the mobile client', async () => {
  await withDatabaseMock(async (command) => {
    assert.equal(command.constructor.name, 'GetCommand');
    return {
      Item: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Dobha User',
        handle: 'dobha_user',
        phone: '',
        role: 'shopper',
        shopName: '',
        stallLocation: '',
        bio: '',
        location: '',
        createdAt: '2026-10-15T00:00:00.000Z',
      },
    };
  }, async () => {
    const result = await handler({
      httpMethod: 'GET',
      path: '/dev/api/private/me',
      requestContext: { stage: 'dev', authorizer: { claims: { sub: 'user-1', email: 'user@example.com' } } },
    });
    const user = JSON.parse(result.body).user;

    assert.equal(result.statusCode, 200);
    assert.equal(user.handle, '@dobha_user');
    assert.equal(user.createdAt, '2026-10-15T00:00:00.000Z');
    assert.equal(user.phone, '');
    assert.equal(user.avatarUrl, null);
    assert.equal(user.hasPassword, true);
  });
});

test('profile updates accept the current mobile fields and enforce vendor details', async () => {
  const writes = [];
  await withDatabaseMock(async (command) => {
    if (command.constructor.name === 'GetCommand') {
      return {
        Item: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Dobha User',
          handle: 'dobha_user',
          role: 'shopper',
          createdAt: '2026-10-15T00:00:00.000Z',
        },
      };
    }
    writes.push(command.input.Item);
    return {};
  }, async () => {
    const result = await handler({
      httpMethod: 'PATCH',
      path: '/dev/api/private/me',
      body: JSON.stringify({
        name: 'Seller Name',
        phone: '+27123456789',
        bio: 'Vintage finds',
        location: 'Johannesburg',
        shopName: 'Good Finds',
        stallLocation: 'Small Street',
        role: 'vendor',
      }),
      requestContext: { stage: 'dev', authorizer: { claims: { sub: 'user-1', email: 'user@example.com' } } },
    });
    const user = JSON.parse(result.body).user;

    assert.equal(result.statusCode, 200);
    assert.equal(user.name, 'Seller Name');
    assert.equal(user.role, 'vendor');
    assert.equal(user.shopName, 'Good Finds');
    assert.equal(user.stallLocation, 'Small Street');
    assert.equal(writes.length, 1);
    const invalid = await handler({
      httpMethod: 'PATCH',
      path: '/dev/api/private/me',
      body: JSON.stringify({ role: 'vendor' }),
      requestContext: { stage: 'dev', authorizer: { claims: { sub: 'user-1', email: 'user@example.com' } } },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(writes.length, 1);
  });
});

test('password change verifies the current account before changing the Cognito password', async () => {
  const commands = [];
  const originalClientId = process.env.CLIENT_ID;
  process.env.CLIENT_ID = 'test-client';
  await withClientMocks([[CognitoIdentityProviderClient, async (command) => {
    commands.push(command);
    if (command.constructor.name === 'InitiateAuthCommand') {
      const claims = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url');
      return { AuthenticationResult: { AccessToken: 'access-token', IdToken: `header.${claims}.signature` } };
    }
    return {};
  }]], async () => {
    try {
      const result = await handler({
        httpMethod: 'POST',
        path: '/dev/api/private/me/password',
        body: JSON.stringify({ current: 'OldPassword1!', password: 'NewPassword2!' }),
        requestContext: { stage: 'dev', authorizer: { claims: { sub: 'user-1', email: 'user@example.com' } } },
      });

      assert.equal(result.statusCode, 200);
      assert.deepEqual(JSON.parse(result.body), { ok: true });
      assert.equal(commands[0].input.AuthParameters.PASSWORD, 'OldPassword1!');
      assert.equal(commands[1].constructor.name, 'ChangePasswordCommand');
      assert.equal(commands[1].input.AccessToken, 'access-token');
      assert.equal(commands[1].input.ProposedPassword, 'NewPassword2!');
    } finally {
      if (originalClientId === undefined) delete process.env.CLIENT_ID;
      else process.env.CLIENT_ID = originalClientId;
    }
  });
});

test('avatar upload stores bytes privately and returns the public profile URL', async () => {
  const writes = [];
  const s3Commands = [];
  const originalBucket = process.env.MEDIA_BUCKET;
  process.env.MEDIA_BUCKET = 'test-media';
  await withClientMocks([
    [DynamoDBDocumentClient, async (command) => {
      if (command.constructor.name === 'GetCommand') {
        return {
          Item: {
            id: 'user-1',
            email: 'user@example.com',
            name: 'User',
            handle: 'user_12345678',
            role: 'shopper',
            avatarKey: 'avatars/user-1/old.jpg',
            createdAt: '2026-10-15T00:00:00.000Z',
          },
        };
      }
      writes.push(command.input.Item);
      return {};
    }],
    [S3Client, async (command) => {
      s3Commands.push(command);
      return {};
    }],
  ], async () => {
    try {
      const bytes = Buffer.from('test-image-bytes');
      const result = await handler({
        httpMethod: 'PUT',
        path: '/dev/api/private/me/avatar',
        headers: { 'content-type': 'image/png' },
        isBase64Encoded: true,
        body: bytes.toString('base64'),
        requestContext: { stage: 'dev', authorizer: { claims: { sub: 'user-1', email: 'user@example.com' } } },
      });
      const user = JSON.parse(result.body).user;

      assert.equal(result.statusCode, 200);
      assert.match(user.avatarUrl, /^\/api\/media\/avatars\/user-1\/.+\.png$/);
      assert.deepEqual(s3Commands.map((command) => command.constructor.name), ['PutObjectCommand', 'DeleteObjectCommand']);
      assert.deepEqual(s3Commands[0].input.Body, bytes);
      assert.equal(s3Commands[1].input.Key, 'avatars/user-1/old.jpg');
      assert.equal(writes[0].avatarKey, user.avatarUrl.slice('/api/media/'.length));
    } finally {
      if (originalBucket === undefined) delete process.env.MEDIA_BUCKET;
      else process.env.MEDIA_BUCKET = originalBucket;
    }
  });
});

test('avatar removal clears the profile reference and deletes the stored object', async () => {
  const writes = [];
  const s3Commands = [];
  const originalBucket = process.env.MEDIA_BUCKET;
  process.env.MEDIA_BUCKET = 'test-media';
  await withClientMocks([
    [DynamoDBDocumentClient, async (command) => {
      if (command.constructor.name === 'GetCommand') {
        return {
          Item: {
            id: 'user-1',
            email: 'user@example.com',
            name: 'User',
            handle: 'user_12345678',
            role: 'shopper',
            avatarKey: 'avatars/user-1/current.webp',
            createdAt: '2026-10-15T00:00:00.000Z',
          },
        };
      }
      writes.push(command.input.Item);
      return {};
    }],
    [S3Client, async (command) => {
      s3Commands.push(command);
      return {};
    }],
  ], async () => {
    try {
      const result = await handler({
        httpMethod: 'DELETE',
        path: '/dev/api/private/me/avatar',
        requestContext: { stage: 'dev', authorizer: { claims: { sub: 'user-1', email: 'user@example.com' } } },
      });

      assert.equal(result.statusCode, 200);
      assert.equal(JSON.parse(result.body).user.avatarUrl, null);
      assert.equal(writes[0].avatarKey, undefined);
      assert.equal(s3Commands[0].constructor.name, 'DeleteObjectCommand');
      assert.equal(s3Commands[0].input.Key, 'avatars/user-1/current.webp');
    } finally {
      if (originalBucket === undefined) delete process.env.MEDIA_BUCKET;
      else process.env.MEDIA_BUCKET = originalBucket;
    }
  });
});

test('account deletion requires a reauthenticated password and refuses unsettled orders', async () => {
  const cognitoCommands = [];
  const originalClientId = process.env.CLIENT_ID;
  process.env.CLIENT_ID = 'test-client';
  await withClientMocks([
    [DynamoDBDocumentClient, async (command) => {
      if (command.constructor.name === 'GetCommand') {
        return { Item: { id: 'user-1', email: 'user@example.com', hasPassword: true } };
      }
      if (command.constructor.name === 'QueryCommand' && command.input.IndexName === 'MarketFeedIndex') {
        return { Items: [{ id: 'order-1', status: 'paymentPending', buyerId: 'user-1' }] };
      }
      return { Items: [] };
    }],
    [CognitoIdentityProviderClient, async (command) => {
      cognitoCommands.push(command);
      const claims = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url');
      return { AuthenticationResult: { IdToken: `header.${claims}.signature` } };
    }],
  ], async () => {
    try {
      const result = await handler({
        httpMethod: 'DELETE',
        path: '/dev/api/private/me',
        body: JSON.stringify({ password: 'CurrentPassword1!' }),
        requestContext: {
          stage: 'dev',
          authorizer: { claims: { sub: 'user-1', email: 'user@example.com' } },
        },
      });

      assert.equal(result.statusCode, 409);
      assert.deepEqual(JSON.parse(result.body), { error: 'Finish or settle all orders before deleting your account.' });
      assert.equal(cognitoCommands.length, 1);
      assert.equal(cognitoCommands[0].constructor.name, 'InitiateAuthCommand');
    } finally {
      if (originalClientId === undefined) delete process.env.CLIENT_ID;
      else process.env.CLIENT_ID = originalClientId;
    }
  });
});

test('account deletion anonymizes settled history and removes unsold listings and personal media', async () => {
  const dbCommands = [];
  const cognitoCommands = [];
  const s3Commands = [];
  const originalEnv = {
    CLIENT_ID: process.env.CLIENT_ID,
    USER_POOL_ID: process.env.USER_POOL_ID,
    MEDIA_BUCKET: process.env.MEDIA_BUCKET,
  };
  process.env.CLIENT_ID = 'test-client';
  process.env.USER_POOL_ID = 'test-pool';
  process.env.MEDIA_BUCKET = 'test-media';
  const buyerOrder = {
    pk: 'ORDER#buyer-order', sk: 'META', id: 'buyer-order', itemId: 'other-item',
    buyerId: 'user-1', sellerId: 'seller-2', status: 'payoutReleased',
    deliveryAddress: '1 Private Street',
  };
  const sellerOrder = {
    pk: 'ORDER#seller-order', sk: 'META', id: 'seller-order', itemId: 'sold-item',
    buyerId: 'buyer-2', sellerId: 'user-1', status: 'payoutReleased',
  };
  const soldListing = {
    pk: 'ITEM#sold-item', sk: 'META', id: 'sold-item', sellerId: 'user-1',
    sellerName: 'User Name', photoKey: 'items/user-1/sold.jpg',
    media: [{ key: 'items/user-1/sold.jpg', kind: 'image' }],
  };
  const unsoldListing = {
    pk: 'ITEM#unsold-item', sk: 'META', id: 'unsold-item', sellerId: 'user-1',
    photoKey: 'items/user-1/unsold.jpg',
    media: [{ key: 'items/user-1/unsold.jpg', kind: 'image' }],
  };
  await withClientMocks([
    [DynamoDBDocumentClient, async (command) => {
      dbCommands.push(command);
      if (command.constructor.name === 'GetCommand') {
        return {
          Item: {
            pk: 'USER#user-1', sk: 'PROFILE',
            id: 'user-1', email: 'user@example.com', name: 'User Name',
            handle: 'user_name', role: 'vendor', avatarKey: 'avatars/user-1/avatar.jpg',
            hasPassword: true, createdAt: '2026-10-15T00:00:00.000Z',
          },
        };
      }
      if (command.constructor.name === 'QueryCommand') {
        const values = command.input.ExpressionAttributeValues;
        if (command.input.IndexName === 'MarketFeedIndex') return { Items: [buyerOrder] };
        if (command.input.IndexName === 'SellerActivityIndex' && values[':prefix'] === 'ORDER#') {
          return { Items: [sellerOrder] };
        }
        if (command.input.IndexName === 'SellerActivityIndex' && values[':prefix'] === 'ITEM#') {
          return { Items: [soldListing, unsoldListing] };
        }
        if (values[':prefix'] === 'NOTIFICATION#') {
          return { Items: [{ pk: 'USER#user-1', sk: 'NOTIFICATION#1' }] };
        }
        return { Items: [] };
      }
      return {};
    }],
    [CognitoIdentityProviderClient, async (command) => {
      cognitoCommands.push(command);
      if (command.constructor.name === 'InitiateAuthCommand') {
        const claims = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url');
        return { AuthenticationResult: { IdToken: `header.${claims}.signature` } };
      }
      return {};
    }],
    [S3Client, async (command) => {
      s3Commands.push(command);
      return {};
    }],
  ], async () => {
    try {
      const result = await handler({
        httpMethod: 'DELETE',
        path: '/dev/api/private/me',
        body: JSON.stringify({ password: 'CurrentPassword1!' }),
        requestContext: {
          stage: 'dev',
          authorizer: { claims: { sub: 'user-1', email: 'user@example.com' } },
        },
      });

      assert.equal(result.statusCode, 200);
      assert.deepEqual(JSON.parse(result.body), { ok: true });
      const puts = dbCommands.filter((command) => command.constructor.name === 'PutCommand').map((command) => command.input.Item);
      const anonymizedProfile = puts.find((item) => item.sk === 'PROFILE');
      const anonymizedListing = puts.find((item) => item.id === 'sold-item');
      assert.equal(anonymizedProfile.name, 'Deleted account');
      assert.match(anonymizedProfile.email, /^deleted-.+@deleted\.invalid$/);
      assert.equal(anonymizedProfile.avatarKey, undefined);
      assert.equal(anonymizedListing.sellerName, 'Deleted account');
      assert.deepEqual(
        dbCommands.filter((command) => command.constructor.name === 'DeleteCommand').map((command) => command.input.Key),
        [
          { pk: 'ITEM#unsold-item', sk: 'META' },
          { pk: 'USER#user-1', sk: 'NOTIFICATION#1' },
        ],
      );
      const addressUpdate = dbCommands.find((command) =>
        command.constructor.name === 'UpdateCommand' && command.input.Key.pk === 'ORDER#buyer-order');
      assert.equal(addressUpdate.input.UpdateExpression, 'REMOVE deliveryAddress');
      const deletedMedia = s3Commands.map((command) => command.input.Key).sort();
      assert.deepEqual(deletedMedia, ['avatars/user-1/avatar.jpg', 'items/user-1/unsold.jpg']);
      assert.equal(cognitoCommands.at(-1).constructor.name, 'AdminDeleteUserCommand');
      assert.equal(cognitoCommands.at(-1).input.UserPoolId, 'test-pool');
      assert.equal(cognitoCommands.at(-1).input.Username, 'user@example.com');
    } finally {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});

test('anonymized accounts cannot continue using existing authenticated sessions', async () => {
  await withDatabaseMock(async (command) => {
    assert.equal(command.constructor.name, 'GetCommand');
    return { Item: { id: 'user-1', deletedAt: '2026-10-15T00:00:00.000Z' } };
  }, async () => {
    const result = await handler({
      httpMethod: 'GET',
      path: '/dev/api/private/me',
      requestContext: { stage: 'dev', authorizer: { claims: { sub: 'user-1', email: 'user@example.com' } } },
    });

    assert.equal(result.statusCode, 410);
    assert.deepEqual(JSON.parse(result.body), {
      error: 'This account is being deleted and can no longer be used.',
    });
  });
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
