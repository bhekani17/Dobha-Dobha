import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dynamo = require('../src/utils/dynamo.js');
const auth = require('../src/utils/auth.js');
const user = { id: 'usr-current', name: 'Current User', handle: 'current_user', role: 'buyer' };
const originalAuth = { getUser: auth.getUser, requireUser: auth.requireUser };
auth.getUser = async () => user;
auth.requireUser = async () => user;
const { handler: itemsHandler } = require('../src/items/handler.js');
const { handler: socialHandler } = require('../src/social/handler.js');

const tables = {
  ITEMS_TABLE: 'items',
  LIKES_TABLE: 'likes',
  SAVES_TABLE: 'saves',
  COMMENTS_TABLE: 'comments',
  MESSAGES_TABLE: 'messages',
  USERS_TABLE: 'users',
};
const originalEnv = Object.fromEntries(Object.keys(tables).map((key) => [key, process.env[key]]));
const originalDynamo = Object.fromEntries(['get', 'put', 'delete', 'update', 'query', 'transactWrite'].map((key) => [key, dynamo[key]]));

let items;
let likes;
let saves;
let comments;
let messages;
let users;

function conditionFailed() {
  const error = new Error('Transaction condition failed');
  error.name = 'TransactionCanceledException';
  return error;
}

before(() => {
  Object.assign(process.env, tables);

  dynamo.get = async (table, key) => {
    if (table === tables.ITEMS_TABLE) return items.get(key.id) || null;
    if (table === tables.USERS_TABLE) return users.get(key.id) || null;
    if (table === tables.LIKES_TABLE) return likes.get(`${key.user_id}:${key.item_id}`) || null;
    if (table === tables.SAVES_TABLE) return saves.get(`${key.user_id}:${key.item_id}`) || null;
    if (table === tables.MESSAGES_TABLE) return messages.find((message) => message.id === key.id) || null;
    return null;
  };
  dynamo.put = async (table, value) => {
    if (table === tables.COMMENTS_TABLE) comments.push(value);
    if (table === tables.MESSAGES_TABLE) messages.push(value);
    if (table === tables.SAVES_TABLE) saves.set(`${value.user_id}:${value.item_id}`, value);
  };
  dynamo.delete = async (table, key) => {
    if (table === tables.SAVES_TABLE) saves.delete(`${key.user_id}:${key.item_id}`);
  };
  dynamo.update = async ({ TableName, Key, ExpressionAttributeValues, UpdateExpression, ConditionExpression }) => {
    if (TableName === tables.ITEMS_TABLE) {
      const item = items.get(Key.id);
      if (UpdateExpression.includes('likes_count')) {
        item.likes_count = (item.likes_count || 0) + (ExpressionAttributeValues[':decrement'] || ExpressionAttributeValues[':one']);
      } else {
        if (ConditionExpression && item.status !== ExpressionAttributeValues[':available']) {
          throw conditionFailed();
        }
        item.status = ExpressionAttributeValues[':sold'];
        item.off_app_sale_reported_at = ExpressionAttributeValues[':time'];
        item.off_app_sale_buyer_id = ExpressionAttributeValues[':buyer'];
      }
    }
    if (TableName === tables.MESSAGES_TABLE) {
      const message = messages.find((entry) => entry.id === Key.id);
      const confirmationField = UpdateExpression.match(/SET (buyer_confirmed_at|seller_confirmed_at)/)?.[1];
      if (confirmationField) {
        if (ConditionExpression && message[confirmationField]) throw conditionFailed();
        message[confirmationField] = ExpressionAttributeValues[':time'];
      } else {
        message.read_at = ExpressionAttributeValues[':time'];
      }
      return { Attributes: { ...message } };
    }
  };
  dynamo.query = async ({ TableName, IndexName, ExpressionAttributeValues, KeyConditionExpression }) => {
    if (TableName === tables.COMMENTS_TABLE) {
      const result = comments.filter((comment) => comment.item_id === ExpressionAttributeValues[':iid']);
      return { items: result, count: result.length };
    }
    if (TableName === tables.MESSAGES_TABLE && IndexName === 'PairIndex') {
      if (KeyConditionExpression.includes('AND')) {
        return {
          items: messages.filter((message) =>
            message.sender_id === ExpressionAttributeValues[':sid'] &&
            message.recipient_id === ExpressionAttributeValues[':rid']),
        };
      }
      return { items: messages.filter((message) => message.sender_id === ExpressionAttributeValues[':uid']) };
    }
    if (TableName === tables.MESSAGES_TABLE && IndexName === 'RecipientIndex') {
      return { items: messages.filter((message) => message.recipient_id === ExpressionAttributeValues[':uid']) };
    }
    return { items: [] };
  };
  dynamo.transactWrite = async (transactions) => {
    for (const transaction of transactions) {
      if (transaction.Put) {
        const value = transaction.Put.Item;
        const key = `${value.user_id}:${value.item_id}`;
        if (likes.has(key)) throw conditionFailed();
      }
      if (transaction.Delete) {
        const key = `${transaction.Delete.Key.user_id}:${transaction.Delete.Key.item_id}`;
        if (!likes.has(key)) throw conditionFailed();
      }
    }
    for (const transaction of transactions) {
      if (transaction.Put) {
        const value = transaction.Put.Item;
        likes.set(`${value.user_id}:${value.item_id}`, value);
      }
      if (transaction.Delete) {
        const key = `${transaction.Delete.Key.user_id}:${transaction.Delete.Key.item_id}`;
        likes.delete(key);
      }
      if (transaction.Update) {
        const item = items.get(transaction.Update.Key.id);
        if (!item) throw conditionFailed();
        const delta = transaction.Update.ExpressionAttributeValues[':decrement'] ??
          transaction.Update.ExpressionAttributeValues[':one'];
        item.likes_count = (item.likes_count || 0) + delta;
      }
    }
  };
});

beforeEach(() => {
  items = new Map([['item-1', {
    id: 'item-1',
    title: 'Vintage jacket',
    price_cents: 25000,
    photos: ['/media/jacket.jpg'],
    category: 'Jackets',
    condition: 'Good',
    size: 'M',
    status: 'available',
    seller_id: 'usr-seller',
    seller_name: 'Seller Shop',
    seller_handle: 'seller_shop',
    likes_count: 0,
    created_at: Date.UTC(2026, 9, 20),
  }]]);
  likes = new Map();
  saves = new Map();
  comments = [];
  messages = [
    { id: 'msg-old', sender_id: user.id, recipient_id: 'usr-seller', text: 'Is it available?', created_at: 100, read_at: 0 },
    { id: 'msg-new', sender_id: 'usr-seller', recipient_id: user.id, text: 'Yes, it is.', created_at: 200, read_at: 0 },
  ];
  users = new Map([
    ['usr-current', user],
    ['usr-seller', { id: 'usr-seller', name: 'Seller', shop_name: 'Seller Shop', handle: 'seller_shop' }],
  ]);
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  Object.assign(dynamo, originalDynamo);
  Object.assign(auth, originalAuth);
});

describe('social interactions', () => {
  it('toggles listing likes and returns the updated listing for clients', async () => {
    const first = await itemsHandler({ path: '/api/items/item-1/like', httpMethod: 'POST' });
    const firstBody = JSON.parse(first.body);
    assert.equal(first.statusCode, 200);
    assert.equal(firstBody.liked, true);
    assert.equal(firstBody.item.isLiked, true);
    assert.equal(firstBody.item.likesCount, 1);

    const second = await itemsHandler({ path: '/api/items/item-1/like', httpMethod: 'POST' });
    const secondBody = JSON.parse(second.body);
    assert.equal(secondBody.liked, false);
    assert.equal(secondBody.item.isLiked, false);
    assert.equal(secondBody.item.likesCount, 0);
  });

  it('saves listings and returns the updated listing', async () => {
    const response = await itemsHandler({ path: '/api/items/item-1/save', httpMethod: 'POST' });
    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(body.saved, true);
    assert.equal(body.item.isSaved, true);
  });

  it('formats comments consistently for website and mobile clients', async () => {
    const created = await itemsHandler({
      path: '/api/items/item-1/comments',
      httpMethod: 'POST',
      body: JSON.stringify({ text: 'Lovely jacket!' }),
    });
    const createdComment = JSON.parse(created.body).comment;
    assert.equal(created.statusCode, 201);
    assert.equal(createdComment.userId, user.id);
    assert.equal(createdComment.name, user.name);
    assert.equal(createdComment.handle, user.handle);
    assert.equal(createdComment.text, 'Lovely jacket!');
    assert.equal(typeof createdComment.createdAt, 'string');

    const listed = await itemsHandler({ path: '/api/items/item-1/comments', httpMethod: 'GET' });
    assert.deepEqual(JSON.parse(listed.body).comments, [createdComment]);
  });

  it('includes received conversations, returns the latest message, and marks reads', async () => {
    const listed = await socialHandler({ path: '/api/chats', httpMethod: 'GET' });
    const chat = JSON.parse(listed.body).chats[0];
    assert.equal(chat.userId, 'usr-seller');
    assert.equal(chat.name, 'Seller Shop');
    assert.equal(chat.lastMessage, 'Yes, it is.');
    assert.equal(chat.lastFromMe, false);
    assert.equal(chat.unread, 1);

    const thread = await socialHandler({ path: '/api/chats/usr-seller', httpMethod: 'GET' });
    const threadBody = JSON.parse(thread.body);
    assert.equal(threadBody.with.name, 'Seller Shop');
    assert.equal(threadBody.messages.length, 2);
    assert.equal(threadBody.messages[0].fromMe, true);
    assert.equal(threadBody.messages[1].fromMe, false);
    assert.ok(messages.find((message) => message.id === 'msg-new').read_at > 0);
    assert.equal(messages.find((message) => message.id === 'msg-old').read_at, 0);
  });

  it('creates a message in the selected conversation', async () => {
    const response = await socialHandler({
      path: '/api/chats/usr-seller',
      httpMethod: 'POST',
      body: JSON.stringify({ text: 'Can I see another photo?', itemId: 'item-1' }),
    });
    const message = JSON.parse(response.body).message;
    assert.equal(response.statusCode, 201);
    assert.equal(message.text, 'Can I see another photo?');
    assert.equal(message.fromMe, true);
    assert.equal(message.item.id, 'item-1');
  });

  it('records a direct purchase only after both parties confirm, without verifying payment', async () => {
    const requestResponse = await socialHandler({
      path: '/api/chats/usr-seller',
      httpMethod: 'POST',
      body: JSON.stringify({
        text: 'I would like to buy this directly.',
        itemId: 'item-1',
        purchaseRequest: true,
      }),
    });
    const request = JSON.parse(requestResponse.body).message;
    assert.equal(requestResponse.statusCode, 201);
    assert.equal(request.purchaseRequest.status, 'requested');
    assert.equal(request.purchaseRequest.paymentVerified, false);

    const originalUser = { ...user };
    try {
      Object.assign(user, { id: 'usr-other', name: 'Other User', role: 'buyer' });
      const unauthorizedConfirmation = await socialHandler({
        path: `/api/chats/usr-current/purchases/${request.id}/confirm`,
        httpMethod: 'POST',
      });
      assert.equal(unauthorizedConfirmation.statusCode, 403);
    } finally {
      Object.assign(user, originalUser);
    }

    const buyerConfirmation = await socialHandler({
      path: `/api/chats/usr-seller/purchases/${request.id}/confirm`,
      httpMethod: 'POST',
    });
    assert.equal(buyerConfirmation.statusCode, 200);
    assert.equal(JSON.parse(buyerConfirmation.body).purchaseRequest.status, 'buyer_confirmed');
    assert.equal(items.get('item-1').status, 'available');

    try {
      Object.assign(user, users.get('usr-seller'));
      const sellerConfirmation = await socialHandler({
        path: `/api/chats/usr-current/purchases/${request.id}/confirm`,
        httpMethod: 'POST',
      });
      const result = JSON.parse(sellerConfirmation.body);
      assert.equal(sellerConfirmation.statusCode, 200);
      assert.equal(result.purchaseRequest.status, 'reported_complete');
      assert.equal(result.purchaseRequest.paymentVerified, false);
      assert.equal(items.get('item-1').status, 'sold');
      assert.equal(items.get('item-1').off_app_sale_buyer_id, 'usr-current');
    } finally {
      Object.assign(user, originalUser);
    }
  });

  it('rejects a purchase request sent to someone other than the listing seller', async () => {
    users.set('usr-other', { id: 'usr-other', name: 'Other User' });
    const response = await socialHandler({
      path: '/api/chats/usr-other',
      httpMethod: 'POST',
      body: JSON.stringify({
        text: 'I would like to buy this directly.',
        itemId: 'item-1',
        purchaseRequest: true,
      }),
    });
    assert.equal(response.statusCode, 400);
    assert.equal(messages.some((message) => message.purchase_request), false);
  });
});
