import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dynamo = require('../src/utils/dynamo.js');
const auth = require('../src/utils/auth.js');
const originalAuth = auth.requireUser;
const originalQuery = dynamo.query;
const originalNotificationsTable = process.env.NOTIFICATIONS_TABLE;
const user = { id: 'usr-notifications' };

auth.requireUser = async () => user;
process.env.NOTIFICATIONS_TABLE = 'notifications';
const { handler } = require('../src/notifications/handler.js');

before(() => {
  dynamo.query = async ({ TableName }) => {
    assert.equal(TableName, 'notifications');
    return {
      items: [
        {
          id: 'notification-unread',
          user_id: user.id,
          kind: 'sale',
          title: 'An item sold',
          body: 'A buyer purchased your item.',
          read: false,
          created_at: '2026-10-23T03:00:00.000Z',
        },
        {
          id: 'notification-read',
          user_id: user.id,
          kind: 'offer',
          title: 'Offer received',
          body: 'A buyer made an offer.',
          read: true,
          created_at: '2026-10-22T03:00:00.000Z',
        },
      ],
    };
  };
});

after(() => {
  auth.requireUser = originalAuth;
  dynamo.query = originalQuery;
  if (originalNotificationsTable === undefined) {
    delete process.env.NOTIFICATIONS_TABLE;
  } else {
    process.env.NOTIFICATIONS_TABLE = originalNotificationsTable;
  }
});

describe('notifications handler', () => {
  it('includes the unread count with the notification list', async () => {
    const response = await handler({
      path: '/api/notifications',
      httpMethod: 'GET',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.unread, 1);
    assert.equal(body.notifications.length, 2);
    assert.equal(body.notifications[0].read, false);
  });
});
