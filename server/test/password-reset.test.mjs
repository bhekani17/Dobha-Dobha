import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dynamo = require('../src/utils/dynamo.js');
const { SESClient } = require('@aws-sdk/client-ses');
const { handler } = require('../src/auth/handler.js');

const originalQuery = dynamo.query;
const originalUpdate = dynamo.update;
const originalSend = SESClient.prototype.send;
const originalEnv = {
  USERS_TABLE: process.env.USERS_TABLE,
  SESSIONS_TABLE: process.env.SESSIONS_TABLE,
  WALLET_TABLE: process.env.WALLET_TABLE,
  WALLETS_TABLE: process.env.WALLETS_TABLE,
  PASSWORD_RESET_SENDER: process.env.PASSWORD_RESET_SENDER,
};
const user = {
  id: 'usr_reset_test',
  email: 'buyer@example.test',
  name: 'Buyer',
  handle: 'buyer',
  reset_expires: Math.floor(Date.now() / 1000) + 900,
};

before(() => {
  process.env.USERS_TABLE = 'users';
  delete process.env.SESSIONS_TABLE;
  delete process.env.WALLET_TABLE;
  delete process.env.WALLETS_TABLE;
  process.env.PASSWORD_RESET_SENDER = 'no-reply@example.test';
});

after(() => {
  dynamo.query = originalQuery;
  dynamo.update = originalUpdate;
  SESClient.prototype.send = originalSend;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function forgotRequest(email = user.email) {
  return {
    path: '/api/auth/forgot',
    httpMethod: 'POST',
    body: JSON.stringify({ email }),
  };
}

function resetRequest(code) {
  return {
    path: '/api/auth/reset',
    httpMethod: 'POST',
    body: JSON.stringify({ email: user.email, code, password: 'new-password-123' }),
  };
}

describe('password reset email', () => {
  it('requires a configured sender before querying for an account', async () => {
    delete process.env.PASSWORD_RESET_SENDER;
    let queryCount = 0;
    dynamo.query = async () => {
      queryCount += 1;
      return { items: [] };
    };

    const response = await handler(forgotRequest());

    assert.equal(response.statusCode, 503);
    assert.equal(queryCount, 0);
  });

  it('emails a cryptographically generated code and stores only its digest', async () => {
    const updates = [];
    let command;
    process.env.PASSWORD_RESET_SENDER = 'no-reply@example.test';
    dynamo.query = async () => ({ items: [{ ...user }] });
    dynamo.update = async (update) => updates.push(update);
    SESClient.prototype.send = async (emailCommand) => {
      command = emailCommand;
    };

    const response = await handler(forgotRequest());
    const sentEmail = command.input;
    const code = sentEmail.Message.Body.Text.Data.match(/\b\d{6}\b/)?.[0];
    const storedHash = updates[0].ExpressionAttributeValues[':hash'];

    assert.equal(response.statusCode, 200);
    assert.equal(sentEmail.Source, 'no-reply@example.test');
    assert.deepEqual(sentEmail.Destination.ToAddresses, [user.email]);
    assert.ok(code);
    assert.equal(storedHash, createHash('sha256').update(`${user.email}:${code}`).digest('hex'));
    assert.notEqual(storedHash, code);
    assert.match(updates[0].UpdateExpression, /reset_code_hash/);
  });

  it('clears the reset code when SES delivery fails', async () => {
    const updates = [];
    process.env.PASSWORD_RESET_SENDER = 'no-reply@example.test';
    dynamo.query = async () => ({ items: [{ ...user }] });
    dynamo.update = async (update) => updates.push(update);
    SESClient.prototype.send = async () => {
      throw new Error('SES unavailable');
    };

    const response = await handler(forgotRequest());

    assert.equal(response.statusCode, 200);
    assert.equal(updates.length, 2);
    assert.match(updates[1].UpdateExpression, /REMOVE reset_code_hash, reset_expires/);
  });

  it('redeems a reset code only if it remains current and unexpired', async () => {
    const code = '123456';
    let update;
    const resetUser = {
      ...user,
      reset_code_hash: createHash('sha256').update(`${user.email}:${code}`).digest('hex'),
    };
    dynamo.query = async () => ({ items: [resetUser] });
    dynamo.update = async (value) => {
      update = value;
    };

    const response = await handler(resetRequest(code));

    assert.equal(response.statusCode, 200);
    assert.match(update.ConditionExpression, /reset_code_hash = :resetHash/);
    assert.match(update.ConditionExpression, /reset_expires > :nowTs/);
    assert.match(update.UpdateExpression, /REMOVE reset_code_hash, reset_expires/);
  });

  it('rejects a reset code consumed by a concurrent request', async () => {
    const code = '123456';
    const resetUser = {
      ...user,
      reset_code_hash: createHash('sha256').update(`${user.email}:${code}`).digest('hex'),
    };
    dynamo.query = async () => ({ items: [resetUser] });
    dynamo.update = async () => {
      const error = new Error('Reset code changed');
      error.name = 'ConditionalCheckFailedException';
      throw error;
    };

    const response = await handler(resetRequest(code));

    assert.equal(response.statusCode, 400);
    assert.match(JSON.parse(response.body).error, /Invalid or expired reset code/);
  });
});