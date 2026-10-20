import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { OAuth2Client } = require('google-auth-library');
const dynamo = require('../src/utils/dynamo.js');
const { handler } = require('../src/auth/handler.js');

const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
const originalQuery = dynamo.query;
const originalPut = dynamo.put;
const originalGet = dynamo.get;
const originalEnv = {
  GOOGLE_CLIENT_IDS: process.env.GOOGLE_CLIENT_IDS,
  USERS_TABLE: process.env.USERS_TABLE,
  SESSIONS_TABLE: process.env.SESSIONS_TABLE,
  WALLET_TABLE: process.env.WALLET_TABLE,
  WALLETS_TABLE: process.env.WALLETS_TABLE,
};

before(() => {
  process.env.GOOGLE_CLIENT_IDS = 'web-client-id,ios-client-id';
  process.env.USERS_TABLE = 'users';
  process.env.SESSIONS_TABLE = 'sessions';
  delete process.env.WALLET_TABLE;
  delete process.env.WALLETS_TABLE;
});

after(() => {
  OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
  dynamo.query = originalQuery;
  dynamo.put = originalPut;
  dynamo.get = originalGet;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function request(body) {
  return {
    path: '/api/auth/google',
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

describe('Google sign-in token verification', () => {
  it('reports missing server-side audience configuration', async () => {
    process.env.GOOGLE_CLIENT_IDS = '';

    const response = await handler(request({ idToken: 'valid.id.token' }));

    assert.equal(response.statusCode, 503);
    process.env.GOOGLE_CLIENT_IDS = 'web-client-id,ios-client-id';
  });

  it('rejects invalid tokens before reading or creating an account', async () => {
    let databaseCalls = 0;
    OAuth2Client.prototype.verifyIdToken = async () => {
      throw new Error('Invalid token');
    };
    dynamo.query = async () => { databaseCalls += 1; return { items: [] }; };
    dynamo.put = async () => { databaseCalls += 1; };

    const response = await handler(request({ idToken: 'forged.token.value' }));

    assert.equal(response.statusCode, 401);
    assert.equal(databaseCalls, 0);
  });

  it('validates the configured audience and uses only verified Google claims', async () => {
    let verificationOptions;
    const writes = [];
    OAuth2Client.prototype.verifyIdToken = async (options) => {
      verificationOptions = options;
      return {
        getPayload: () => ({
          sub: 'google-subject',
          email: 'Buyer@Example.com',
          email_verified: true,
          name: 'Verified Buyer',
        }),
      };
    };
    dynamo.query = async () => ({ items: [] });
    dynamo.put = async (table, item) => writes.push({ table, item });
    dynamo.get = async () => null;

    const response = await handler(request({
      idToken: 'valid.id.token',
      email: 'attacker@example.com',
      name: 'Unverified Name',
      sub: 'unverified-subject',
    }));
    const result = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(verificationOptions, {
      idToken: 'valid.id.token',
      audience: ['web-client-id', 'ios-client-id'],
    });
    assert.equal(result.user.email, 'buyer@example.com');
    assert.equal(result.user.name, 'Verified Buyer');
    assert.equal(writes[0].item.google_sub, 'google-subject');
    assert.equal(writes.some(({ table }) => table === 'sessions'), true);
  });

  it('requires Google to report the account email as verified', async () => {
    let databaseCalls = 0;
    OAuth2Client.prototype.verifyIdToken = async () => ({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'buyer@example.com',
        email_verified: false,
      }),
    });
    dynamo.query = async () => { databaseCalls += 1; return { items: [] }; };

    const response = await handler(request({ idToken: 'valid.but.unverified.token' }));

    assert.equal(response.statusCode, 401);
    assert.equal(databaseCalls, 0);
  });
});
