'use strict';

const { randomUUID } = require('node:crypto');

const categories = [
  'Clothing & Accessories',
  'Shoes',
  'Electronics',
  'Home & Living',
  'Books & Media',
  'Sports & Outdoors',
  'Toys & Games',
  'Beauty & Personal Care',
  'Collectibles',
  'Other',
];
const mediaTypes = {
  'image/jpeg': { ext: 'jpg', max: 8 * 1024 * 1024 },
  'image/png': { ext: 'png', max: 8 * 1024 * 1024 },
  'image/webp': { ext: 'webp', max: 8 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', max: 60 * 1024 * 1024 },
  'video/quicktime': { ext: 'mov', max: 60 * 1024 * 1024 },
  'video/webm': { ext: 'webm', max: 60 * 1024 * 1024 },
};
const mediaUrl = (key) => `/api/media/${key.split('/').map(encodeURIComponent).join('/')}`;
const table = () => process.env.TABLE_NAME;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const response = (statusCode, body, extra = {}) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    ...(process.env.ALLOWED_ORIGIN ? { 'access-control-allow-origin': process.env.ALLOWED_ORIGIN, vary: 'Origin' } : {}),
    'cache-control': 'no-store',
    'access-control-allow-headers': 'Content-Type,Authorization',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    ...extra,
  },
  body: statusCode === 204 ? '' : JSON.stringify(body),
});

let sdk;
function clients() {
  if (sdk) return sdk;
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
  const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand, ChangePasswordCommand, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
  sdk = {
    db: DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } }),
    s3: new S3Client({}),
    cognito: new CognitoIdentityProviderClient({}),
    dbCommands: { DeleteCommand, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand },
    s3Commands: { GetObjectCommand, PutObjectCommand, DeleteObjectCommand },
    s3Presign: { createPresignedPost, getSignedUrl },
    authCommands: { SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand, ChangePasswordCommand, AdminDeleteUserCommand },
  };
  return sdk;
}

function bodyOf(event) {
  if (!event.body) return {};
  try {
    const body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

function str(body, key, { min = 1, max = 500, optional = false } = {}) {
  const value = body[key];
  if (optional && value == null) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${key} is required`);
  const result = value.trim();
  if (optional && !result) return '';
  if (result.length < min || result.length > max) throw new HttpError(400, `${key} must be between ${min} and ${max} characters`);
  return result;
}

function money(body, key, max = 100000) {
  const value = Number(body[key]);
  if (!Number.isFinite(value) || Math.round(value * 100) < 1 || value > max) throw new HttpError(400, `${key} must be a valid positive amount`);
  return Math.round(value * 100);
}

function getUser(event, required = true) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims || {};
  if (!claims.sub) {
    if (required) throw new HttpError(401, 'Please sign in');
    return null;
  }
  let groups = claims['cognito:groups'] || [];
  if (typeof groups === 'string') {
    try { groups = JSON.parse(groups); } catch {
      groups = groups.replace(/^\[|\]$/g, '').split(',').map((value) => value.trim());
    }
  }
  return { id: claims.sub, email: claims.email || '', name: claims.name || '',
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    groups: Array.isArray(groups) ? groups : [] };
}

function requireAdmin(user) {
  if (!user.emailVerified || !user.groups.includes('administrators')) {
    throw new HttpError(403, 'A verified administrator account is required');
  }
}

function pathOf(event) {
  let path;
  try {
    path = decodeURIComponent(event.path || '/');
  } catch {
    throw new HttpError(400, 'Invalid request path');
  }
  const stage = event.requestContext?.stage;
  if (stage && (path === `/${stage}` || path.startsWith(`/${stage}/`))) path = path.slice(stage.length + 1) || '/';
  if (path.startsWith('/api/private/')) return path.slice('/api/private'.length);
  return path.startsWith('/api/') ? path.slice(4) : path;
}

function key(pk, sk) {
  return { pk, sk };
}
const itemKey = (id) => key(`ITEM#${id}`, 'META');
const profileKey = (id) => key(`USER#${id}`, 'PROFILE');

async function get(pk, sk) {
  const { db, dbCommands: { GetCommand } } = clients();
  return (await db.send(new GetCommand({ TableName: table(), Key: key(pk, sk), ConsistentRead: true }))).Item;
}
async function put(item, conditionExpression) {
  const { db, dbCommands: { PutCommand } } = clients();
  await db.send(new PutCommand({ TableName: table(), Item: item, ...(conditionExpression ? { ConditionExpression: conditionExpression } : {}) }));
}
async function deleteItem(pk, sk) {
  const { db, dbCommands: { DeleteCommand } } = clients();
  await db.send(new DeleteCommand({ TableName: table(), Key: key(pk, sk) }));
}
async function queryAll(params) {
  const { db, dbCommands: { QueryCommand } } = clients();
  const items = [];
  let ExclusiveStartKey = params.ExclusiveStartKey;
  do {
    const result = await db.send(new QueryCommand({
      TableName: table(),
      ...params,
      ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
    }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}
async function transact(items) {
  const { db, dbCommands: { TransactWriteCommand } } = clients();
  await db.send(new TransactWriteCommand({ TransactItems: items }));
}
function putTx(item, conditionExpression) {
  return { Put: { TableName: table(), Item: item, ...(conditionExpression ? { ConditionExpression: conditionExpression } : {}) } };
}
function updateTx(Key, UpdateExpression, ConditionExpression, ExpressionAttributeValues, ExpressionAttributeNames) {
  return {
    Update: {
      TableName: table(), Key, UpdateExpression,
      ...(ConditionExpression ? { ConditionExpression } : {}),
      ExpressionAttributeValues,
      ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {}),
    },
  };
}

function userOutbox(userId, content) {
  const id = randomUUID();
  return putTx({
    pk: `OUTBOX#${id}`, sk: 'META', id, userId, ...content,
    createdAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  }, 'attribute_not_exists(pk)');
}

function publicItem(item, seller) {
  return {
    id: item.id,
    title: item.title,
    description: item.description || '',
    haulCaption: item.caption || '',
    priceZar: item.priceCents / 100,
    originalPriceZar: item.originalPriceCents ? item.originalPriceCents / 100 : null,
    condition: item.condition,
    size: item.size,
    category: item.category,
    photoUrl: item.photoKey ? mediaUrl(item.photoKey) : null,
    media: (item.media || []).map(({ key: mediaKey, kind }) => ({ kind, url: mediaUrl(mediaKey) })),
    sellerId: item.sellerId,
    sellerName: seller?.shopName || seller?.name || item.sellerName || 'Dobha seller',
    sellerHandle: seller?.handle ? `@${seller.handle}` : '',
    sellerLocation: seller?.stallLocation || '',
    quantity: item.quantity,
    isClaimed: item.status === 'sold',
    createdAt: item.createdAt,
  };
}

async function itemById(id, allowSold = true) {
  const item = await get(`ITEM#${id}`, 'META');
  if (!item || item.status === 'removed' || (!allowSold && item.status !== 'available')) throw new HttpError(404, 'Listing not found');
  return item;
}

async function itemJson(item) {
  const seller = await get(`USER#${item.sellerId}`, 'PROFILE');
  return publicItem(item, seller);
}

async function feed(event) {
  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(Number(params.limit) || 24, 1), 50);
  const { db, dbCommands: { QueryCommand } } = clients();
  let ExclusiveStartKey;
  if (params.cursor) {
    try {
      ExclusiveStartKey = JSON.parse(Buffer.from(params.cursor, 'base64url').toString());
    } catch {
      throw new HttpError(400, 'Invalid page cursor');
    }
  }
  const result = await db.send(new QueryCommand({
    TableName: table(),
    IndexName: 'MarketFeedIndex',
    KeyConditionExpression: 'GSI1PK = :feed',
    ExpressionAttributeValues: { ':feed': 'MARKET#AVAILABLE' },
    ScanIndexForward: false,
    Limit: limit,
    ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
  }));
  const query = String(params.q || '').toLowerCase().slice(0, 60);
  const category = String(params.category || '');
  const location = String(params.location || '').toLowerCase().slice(0, 60);
  const items = await Promise.all((result.Items || []).map(async (row) => {
    const item = row;
    if (!item || item.status !== 'available') return null;
    const seller = await get(`USER#${item.sellerId}`, 'PROFILE');
    if (category && category !== 'All' && item.category !== category) return null;
    if (location && !`${seller?.stallLocation || ''}`.toLowerCase().includes(location)) return null;
    const searchable = `${item.title} ${item.description} ${item.caption} ${item.category} ${seller?.shopName || ''} ${seller?.name || ''}`.toLowerCase();
    if (query && !searchable.includes(query)) return null;
    return publicItem(item, seller);
  }));
  return response(200, { items: items.filter(Boolean), ...(result.LastEvaluatedKey ? { nextCursor: Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') } : {}) });
}

async function register(body) {
  const email = str(body, 'email', { max: 120 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
  const password = str(body, 'password', { min: 10, max: 256 });
  const name = str(body, 'name', { min: 2, max: 60 });
  const { cognito, authCommands: { SignUpCommand } } = clients();
  const result = await cognito.send(new SignUpCommand({
    ClientId: process.env.CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }, { Name: 'name', Value: name }],
  }));
  await put({ ...profileKey(result.UserSub), id: result.UserSub, email, name, role: 'shopper', createdAt: new Date().toISOString() }, 'attribute_not_exists(pk)');
  return response(201, { confirmationRequired: !result.UserConfirmed, email, message: 'Check your email for a confirmation code.' });
}
async function confirmRegistration(body) {
  const { cognito, authCommands: { ConfirmSignUpCommand } } = clients();
  await cognito.send(new ConfirmSignUpCommand({
    ClientId: process.env.CLIENT_ID,
    Username: str(body, 'email', { max: 120 }).toLowerCase(),
    ConfirmationCode: str(body, 'code', { min: 4, max: 20 }),
  }));
  return response(200, { confirmed: true });
}
function tokenClaims(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) throw new Error();
    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    throw new HttpError(502, 'Cognito returned an invalid token');
  }
}
async function login(body) {
  const { cognito, authCommands: { InitiateAuthCommand } } = clients();
  const result = await cognito.send(new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: process.env.CLIENT_ID,
    AuthParameters: {
      USERNAME: str(body, 'email', { max: 120 }).toLowerCase(),
      PASSWORD: str(body, 'password', { min: 1, max: 256 }),
    },
  }));
  const auth = result.AuthenticationResult;
  if (!auth?.IdToken) throw new HttpError(401, 'Complete the requested sign-in challenge');
  const claims = tokenClaims(auth.IdToken);
  const profile = await ensureProfile({
    id: claims.sub,
    email: claims.email,
    name: claims.name || claims.email,
  });
  return response(200, {
    token: auth.IdToken,
    refreshToken: auth.RefreshToken,
    expiresIn: auth.ExpiresIn,
    user: publicProfile(profile, getUser({ requestContext: { authorizer: { claims } } })),
  });
}
async function refresh(body) {
  const { cognito, authCommands: { InitiateAuthCommand } } = clients();
  const result = await cognito.send(new InitiateAuthCommand({
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: process.env.CLIENT_ID,
    AuthParameters: { REFRESH_TOKEN: str(body, 'refreshToken', { max: 4096 }) },
  }));
  const auth = result.AuthenticationResult;
  if (!auth?.IdToken) throw new HttpError(401, 'Please sign in again');
  return response(200, { token: auth.IdToken, expiresIn: auth.ExpiresIn });
}
async function forgot(body) {
  const { cognito, authCommands: { ForgotPasswordCommand } } = clients();
  const email = str(body, 'email', { max: 120 }).toLowerCase();
  try {
    await cognito.send(new ForgotPasswordCommand({ ClientId: process.env.CLIENT_ID, Username: email }));
  } catch (error) {
    if (!['UserNotFoundException', 'InvalidParameterException'].includes(error.name)) throw error;
  }
  return response(200, { ok: true });
}
async function reset(body) {
  const { cognito, authCommands: { ConfirmForgotPasswordCommand } } = clients();
  await cognito.send(new ConfirmForgotPasswordCommand({
    ClientId: process.env.CLIENT_ID,
    Username: str(body, 'email', { max: 120 }).toLowerCase(),
    ConfirmationCode: str(body, 'code', { min: 4, max: 20 }),
    Password: str(body, 'password', { min: 10, max: 256 }),
  }));
  return login(body);
}
async function changePassword(event, user, body) {
  const current = str(body, 'current', { min: 1, max: 256 });
  const password = str(body, 'password', { min: 10, max: 256 });
  const { cognito, authCommands: { InitiateAuthCommand, ChangePasswordCommand } } = clients();
  let auth;
  try {
    const result = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.CLIENT_ID,
      AuthParameters: {
        USERNAME: str(user, 'email', { max: 120 }).toLowerCase(),
        PASSWORD: current,
      },
    }));
    auth = result.AuthenticationResult;
  } catch (error) {
    if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
      throw new HttpError(401, 'Current password is incorrect.');
    }
    if (error.name === 'UserNotConfirmedException') throw new HttpError(403, 'Confirm your email before changing your password.');
    throw error;
  }
  if (!auth?.AccessToken || !auth.IdToken || tokenClaims(auth.IdToken).sub !== user.id) {
    throw new HttpError(401, 'Could not verify the signed-in account.');
  }
  try {
    await cognito.send(new ChangePasswordCommand({
      AccessToken: auth.AccessToken,
      PreviousPassword: current,
      ProposedPassword: password,
    }));
  } catch (error) {
    if (error.name === 'InvalidPasswordException') {
      throw new HttpError(400, 'Password must be 10+ characters and include uppercase, lowercase, a number, and a symbol.');
    }
    if (error.name === 'NotAuthorizedException') throw new HttpError(401, 'Current password is incorrect.');
    throw error;
  }
  return response(200, { ok: true });
}

async function me(user) {
  return response(200, { user: publicProfile(await ensureProfile(user), user) });
}
async function assertAccountActive(user) {
  const profile = await get(`USER#${user.id}`, 'PROFILE');
  if (profile?.deletedAt || profile?.deletingAt) throw new HttpError(410, 'This account is being deleted and can no longer be used.');
}
function publicProfile(profile, user) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    handle: profile.handle.startsWith('@') ? profile.handle : `@${profile.handle}`,
    phone: profile.phone || '',
    role: profile.role || 'shopper',
    shopName: profile.shopName || '',
    stallLocation: profile.stallLocation || '',
    avatarUrl: profile.avatarKey ? mediaUrl(profile.avatarKey) : null,
    bio: profile.bio || '',
    location: profile.location || '',
    createdAt: profile.createdAt,
    salesCount: profile.salesCount || 0,
    hasPassword: profile.hasPassword !== false,
    isAdmin: Boolean(user?.emailVerified && user.groups?.includes('administrators')),
  };
}
async function ensureProfile(user) {
  let profile = await get(`USER#${user.id}`, 'PROFILE');
  if (profile) return {
    ...profile,
    email: profile.email || user.email || '',
    name: profile.name || user.name || user.email || 'Dobha User',
    handle: profile.handle || `user_${user.id.slice(-8)}`,
    createdAt: profile.createdAt || new Date().toISOString(),
  };
  profile = {
    ...profileKey(user.id),
    id: user.id,
    email: user.email || '',
    name: user.name || user.email || 'Dobha User',
    handle: `user_${user.id.slice(-8)}`,
    phone: '',
    role: 'shopper',
    shopName: '',
    stallLocation: '',
    bio: '',
    location: '',
    createdAt: new Date().toISOString(),
    hasPassword: true,
  };
  try {
    await put(profile, 'attribute_not_exists(pk)');
  } catch (error) {
    if (error.name !== 'ConditionalCheckFailedException') throw error;
    profile = await get(`USER#${user.id}`, 'PROFILE');
    if (!profile) throw error;
  }
  return profile;
}
async function updateMe(user, body) {
  const current = await ensureProfile(user);
  const next = { ...current };
  if ('name' in body) next.name = str(body, 'name', { min: 2, max: 40 });
  if ('phone' in body) next.phone = str(body, 'phone', { max: 20, optional: true });
  if ('bio' in body) next.bio = str(body, 'bio', { max: 160, optional: true });
  if ('location' in body) next.location = str(body, 'location', { max: 60, optional: true });
  if ('shopName' in body) next.shopName = str(body, 'shopName', { min: 2, max: 50, optional: true });
  if ('stallLocation' in body) next.stallLocation = str(body, 'stallLocation', { min: 2, max: 100, optional: true });
  if ('role' in body) {
    if (body.role !== 'shopper' && body.role !== 'vendor') throw new HttpError(400, 'Unknown role');
    next.role = body.role;
  }
  if (next.role === 'vendor' && (!next.shopName || !next.stallLocation)) {
    throw new HttpError(400, 'Add your shop name and stall location to start selling');
  }
  await put(next, 'attribute_not_exists(deletingAt) AND attribute_not_exists(deletedAt)');
  return response(200, { user: publicProfile(next, user) });
}
async function setAvatar(event, user) {
  const profile = await ensureProfile(user);
  const oldKey = profile.avatarKey;
  let updated;
  if (event.httpMethod === 'DELETE') {
    updated = { ...profile };
    delete updated.avatarKey;
    await put(updated, 'attribute_not_exists(deletingAt) AND attribute_not_exists(deletedAt)');
  } else {
    const headers = event.headers || {};
    const contentType = String(headers['content-type'] || headers['Content-Type'] || '')
      .split(';')[0].trim().toLowerCase();
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType];
    if (!ext) throw new HttpError(415, 'Profile pictures must be JPEG, PNG or WebP.');
    if (!event.body) throw new HttpError(400, 'A profile picture is required.');
    const bytes = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'binary');
    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) {
      throw new HttpError(413, 'Profile pictures must be no larger than 5 MB.');
    }
    const keyValue = `avatars/${user.id}/${randomUUID()}.${ext}`;
    const { s3, s3Commands: { PutObjectCommand } } = clients();
    await s3.send(new PutObjectCommand({
      Bucket: process.env.MEDIA_BUCKET,
      Key: keyValue,
      Body: bytes,
      ContentType: contentType,
    }));
    updated = { ...profile, avatarKey: keyValue };
    await put(updated, 'attribute_not_exists(deletingAt) AND attribute_not_exists(deletedAt)');
  }
  if (oldKey) {
    const { s3, s3Commands: { DeleteObjectCommand } } = clients();
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: oldKey }));
  }
  return response(200, { user: publicProfile(updated, user) });
}
async function deleteAccount(user, body) {
  const profile = await get(`USER#${user.id}`, 'PROFILE');
  if (!profile) throw new HttpError(404, 'Profile not found');

  const { cognito, authCommands: { InitiateAuthCommand, AdminDeleteUserCommand } } = clients();
  if (profile.hasPassword !== false) {
    const password = str(body, 'password', { min: 1, max: 256 });
    let auth;
    try {
      const result = await cognito.send(new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.CLIENT_ID,
        AuthParameters: { USERNAME: str(user, 'email', { max: 120 }).toLowerCase(), PASSWORD: password },
      }));
      auth = result.AuthenticationResult;
    } catch (error) {
      if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
        throw new HttpError(401, 'Current password is incorrect.');
      }
      if (error.name === 'UserNotConfirmedException') throw new HttpError(403, 'Confirm your email before deleting your account.');
      throw error;
    }
    if (!auth?.IdToken || tokenClaims(auth.IdToken).sub !== user.id) {
      throw new HttpError(401, 'Could not verify the signed-in account.');
    }
  } else if (body.confirm !== 'DELETE') {
    throw new HttpError(400, 'Type DELETE to confirm');
  }

  const wallet = await get(`USER#${user.id}`, 'WALLET');
  if (wallet && ['availableCents', 'lockedCents', 'pendingCents'].some((field) => Number(wallet[field] || 0) !== 0)) {
    throw new HttpError(409, 'Settle orders and withdraw your wallet balance before deleting your account.');
  }

  const buyerOrders = await queryAll({
    IndexName: 'MarketFeedIndex',
    KeyConditionExpression: 'GSI1PK = :user AND begins_with(GSI1SK, :prefix)',
    ExpressionAttributeValues: { ':user': `BUYER#${user.id}`, ':prefix': 'ORDER#' },
  });
  const sellerOrders = await queryAll({
    IndexName: 'SellerActivityIndex',
    KeyConditionExpression: 'GSI2PK = :user AND begins_with(GSI2SK, :prefix)',
    ExpressionAttributeValues: { ':user': `SELLER#${user.id}`, ':prefix': 'ORDER#' },
  });
  // Base-table references are written with every new order, so deletion does
  // not depend on eventually consistent GSIs finding newly settled history.
  const references = await queryAll({
    KeyConditionExpression: 'pk = :user AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':user': `USER#${user.id}`, ':prefix': 'ORDER#' }, ConsistentRead: true,
  });
  const referencedOrders = await Promise.all(references.map((entry) => get(`ORDER#${entry.orderId}`, 'META')));
  const orders = [...new Map([...buyerOrders, ...sellerOrders, ...referencedOrders.filter(Boolean)].map((order) => [order.id, order])).values()];
  const settledStatuses = new Set(['payoutReleased', 'refunded', 'cancelled']);
  if (orders.some((order) => !settledStatuses.has(order.status))) {
    throw new HttpError(409, 'Finish or settle all orders before deleting your account.');
  }

  await transact([
    updateTx(profileKey(user.id), 'SET deletingAt = :now', 'attribute_exists(pk)', { ':now': new Date().toISOString() }),
    { ConditionCheck: { TableName: table(), Key: { pk: `USER#${user.id}`, sk: 'WALLET' },
      ConditionExpression: 'attribute_not_exists(pk) OR (availableCents = :zero AND lockedCents = :zero AND pendingCents = :zero)',
      ExpressionAttributeValues: { ':zero': 0 } } },
  ]);

  const listings = await queryAll({
    IndexName: 'SellerActivityIndex',
    KeyConditionExpression: 'GSI2PK = :seller AND begins_with(GSI2SK, :prefix)',
    ExpressionAttributeValues: { ':seller': `SELLER#${user.id}`, ':prefix': 'ITEM#' },
  });
  const orderedItemIds = new Set(orders.map((order) => order.itemId));
  const mediaToDelete = new Set(profile.avatarKey ? [profile.avatarKey] : []);
  const retainedListings = [];
  const listingsToDelete = [];
  for (const item of listings) {
    if (orderedItemIds.has(item.id)) {
      retainedListings.push(item);
      continue;
    }
    if (item.photoKey) mediaToDelete.add(item.photoKey);
    for (const media of item.media || []) {
      if (media.key) mediaToDelete.add(media.key);
    }
    listingsToDelete.push(item);
  }
  const { s3, s3Commands: { DeleteObjectCommand } } = clients();
  for (const mediaKey of mediaToDelete) {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: mediaKey }));
  }

  const notifications = await queryAll({
    KeyConditionExpression: 'pk = :user AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':user': `USER#${user.id}`, ':prefix': 'NOTIFICATION#' },
  });
  for (const item of retainedListings) await put({ ...item, sellerName: 'Deleted account' });
  for (const item of listingsToDelete) await deleteItem(item.pk, item.sk);
  for (const notification of notifications) await deleteItem(notification.pk, notification.sk);

  const { db, dbCommands: { UpdateCommand } } = clients();
  for (const order of orders) {
    if (order.buyerId === user.id && order.deliveryAddress) {
      await db.send(new UpdateCommand({
        TableName: table(),
        Key: key(order.pk, order.sk),
        UpdateExpression: 'REMOVE deliveryAddress',
      }));
    }
  }

  const deletedId = randomUUID();
  const anonymizedProfile = {
    ...profile,
    email: `deleted-${deletedId}@deleted.invalid`,
    name: 'Deleted account',
    handle: `deleted_${deletedId.replaceAll('-', '').slice(0, 12)}`,
    phone: '',
    role: 'shopper',
    shopName: '',
    stallLocation: '',
    bio: '',
    location: '',
    deletedAt: new Date().toISOString(),
  };
  delete anonymizedProfile.avatarKey;
  await put(anonymizedProfile);

  try {
    await cognito.send(new AdminDeleteUserCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: user.email || user.id,
    }));
  } catch (error) {
    if (error.name === 'AccessDeniedException' || error.name === 'NotAuthorizedException') {
      throw new HttpError(502, 'The AWS sign-in account could not be removed. Retry account deletion or contact support.');
    }
    throw error;
  }
  return response(200, { ok: true });
}
async function becomeVendor(user, body) {
  const shopName = str(body, 'shopName', { min: 2, max: 60 });
  const stallLocation = str(body, 'stallLocation', { min: 2, max: 80 });
  const profile = await get(`USER#${user.id}`, 'PROFILE');
  if (!profile) throw new HttpError(404, 'Profile not found');
  const updated = { ...profile, role: 'vendor', shopName, stallLocation };
  await put(updated, 'attribute_not_exists(deletingAt) AND attribute_not_exists(deletedAt)');
  return response(200, { user: { id: user.id, email: user.email, name: updated.name, role: 'vendor', shopName, stallLocation } });
}

async function uploadUrl(user, body) {
  const profile = await get(`USER#${user.id}`, 'PROFILE');
  if (profile?.role !== 'vendor') throw new HttpError(403, 'Create a seller profile before uploading listings');
  const contentType = str(body, 'contentType', { max: 80 }).toLowerCase();
  const mediaType = mediaTypes[contentType];
  if (!mediaType) throw new HttpError(415, 'Use JPEG, PNG, WebP, MP4, MOV, or WebM files');
  const length = Number(body.contentLength);
  if (!Number.isSafeInteger(length) || length <= 0 || length > mediaType.max) throw new HttpError(413, 'The selected file is empty or too large');
  const key = `items/${user.id}/${randomUUID()}.${mediaType.ext}`;
  const { s3, s3Presign: { createPresignedPost } } = clients();
  const signed = await createPresignedPost(s3, {
    Bucket: process.env.MEDIA_BUCKET,
    Key: key,
    Expires: 300,
    Fields: { 'Content-Type': contentType },
    Conditions: [['content-length-range', 1, mediaType.max], ['eq', '$Content-Type', contentType]],
  });
  return response(201, { key, kind: contentType.startsWith('video/') ? 'video' : 'image', uploadUrl: signed.url, fields: signed.fields, maxBytes: mediaType.max });
}

function listingMedia(body, userId) {
  if (!Array.isArray(body.media) || body.media.length < 1 || body.media.length > 10) throw new HttpError(400, 'Add between 1 and 10 photos or videos');
  const media = body.media.map((entry) => {
    const key = typeof entry?.key === 'string' ? entry.key : '';
    const ext = key.split('.').pop().toLowerCase();
    const type = Object.values(mediaTypes).find((value) => value.ext === ext);
    if (!type || !key.startsWith(`items/${userId}/`) || key.includes('..')) throw new HttpError(400, 'Invalid listing media');
    return { key, kind: ext === 'mp4' || ext === 'mov' || ext === 'webm' ? 'video' : 'image' };
  });
  if (!media.some((value) => value.kind === 'image')) throw new HttpError(400, 'Add at least one product photo');
  return media;
}

async function createListing(user, body) {
  const profile = await get(`USER#${user.id}`, 'PROFILE');
  if (profile?.role !== 'vendor') throw new HttpError(403, 'Create a seller profile before listing items');
  const category = str(body, 'category', { max: 40 });
  if (!categories.includes(category)) throw new HttpError(400, 'Select a valid category');
  const media = listingMedia(body, user.id);
  const priceCents = money(body, 'priceZar');
  const quantity = body.quantity == null ? 1 : Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new HttpError(400, 'Quantity must be between 1 and 999');
  const id = `itm_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const item = {
    pk: `ITEM#${id}`, sk: 'META', id, sellerId: user.id,
    sellerName: profile.shopName || profile.name, title: str(body, 'title', { min: 3, max: 80 }),
    description: str(body, 'description', { max: 1000, optional: true }),
    caption: str(body, 'caption', { max: 200, optional: true }),
    priceCents, originalPriceCents: body.originalPriceZar ? money({ amount: body.originalPriceZar }, 'amount') : null,
    condition: str(body, 'condition', { max: 40 }), size: str(body, 'size', { max: 20, optional: true }) || 'N/A',
    category, quantity, media, photoKey: media.find((entry) => entry.kind === 'image').key,
    status: 'available', createdAt,
    GSI1PK: 'MARKET#AVAILABLE', GSI1SK: `ITEM#${createdAt}#${id}`,
    GSI2PK: `SELLER#${user.id}`, GSI2SK: `ITEM#${createdAt}#${id}`,
  };
  await transact([
    { ConditionCheck: { TableName: table(), Key: profileKey(user.id),
      ConditionExpression: 'attribute_exists(pk) AND attribute_not_exists(deletingAt) AND attribute_not_exists(deletedAt)' } },
    putTx(item, 'attribute_not_exists(pk)'),
    userOutbox(user.id, { kind: 'listing', title: 'Listing published', body: `${item.title} is now available in the marketplace.`, itemId: id }),
  ]);
  return response(201, { item: publicItem(item, profile) });
}

async function updateListing(user, id, body) {
  const item = await itemById(id);
  if (item.sellerId !== user.id) throw new HttpError(403, 'Only the seller can edit this listing');
  if (item.status !== 'available') throw new HttpError(409, 'This listing is not available to edit');
  const next = { ...item };
  if ('title' in body) next.title = str(body, 'title', { min: 3, max: 80 });
  if ('description' in body) next.description = str(body, 'description', { max: 1000, optional: true });
  if ('priceZar' in body) next.priceCents = money(body, 'priceZar');
  if ('quantity' in body) {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new HttpError(400, 'Quantity must be between 1 and 999');
    next.quantity = quantity;
  }
  const { db, dbCommands: { PutCommand } } = clients();
  await db.send(new PutCommand({
    TableName: table(), Item: next,
    ConditionExpression: '#status = :available AND sellerId = :seller AND quantity = :quantity AND priceCents = :price',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':available': 'available', ':seller': user.id, ':quantity': item.quantity, ':price': item.priceCents },
  }));
  return response(200, { item: await itemJson(next) });
}

async function deleteListing(user, id) {
  const item = await itemById(id);
  if (item.sellerId !== user.id) throw new HttpError(403, 'Only the seller can remove this listing');
  if (item.status !== 'available') throw new HttpError(409, 'This listing has already sold');
  const { db, dbCommands: { UpdateCommand } } = clients();
  await db.send(new UpdateCommand({
    TableName: table(), Key: itemKey(id),
    UpdateExpression: 'SET #status = :removed REMOVE GSI1PK, GSI1SK',
    ConditionExpression: '#status = :available AND sellerId = :seller',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':removed': 'removed', ':available': 'available', ':seller': user.id },
  }));
  return response(200, { ok: true });
}

async function myListings(user) {
  const { db, dbCommands: { QueryCommand } } = clients();
  const result = await db.send(new QueryCommand({
    TableName: table(), IndexName: 'SellerActivityIndex',
    KeyConditionExpression: 'GSI2PK = :seller AND begins_with(GSI2SK, :prefix)',
    ExpressionAttributeValues: { ':seller': `SELLER#${user.id}`, ':prefix': 'ITEM#' },
    ScanIndexForward: false, Limit: 100,
  }));
  return response(200, { items: await Promise.all((result.Items || []).map((item) => itemJson(item))) });
}

async function myNotifications(user) {
  const { db, dbCommands: { QueryCommand } } = clients();
  const result = await db.send(new QueryCommand({
    TableName: table(),
    KeyConditionExpression: 'pk = :user AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':user': `USER#${user.id}`, ':prefix': 'NOTIFICATION#' },
    ScanIndexForward: false, Limit: 100,
  }));
  const notifications = (result.Items || []).map(({ id, kind, title, body, orderId, itemId, readAt, createdAt }) => ({
    id, kind, title, body, orderId, itemId, read: !!readAt, createdAt,
  }));
  return response(200, { notifications, unread: notifications.filter((item) => !item.read).length, messages: 0 });
}

async function readMedia(keyValue) {
  if ((!keyValue.startsWith('items/') && !keyValue.startsWith('avatars/')) || keyValue.includes('..')) {
    throw new HttpError(404, 'Media not found');
  }
  const { s3, s3Commands: { GetObjectCommand }, s3Presign: { getSignedUrl } } = clients();
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: keyValue }), { expiresIn: 300 });
  return response(302, {}, { location: url, 'cache-control': 'private, max-age=0' });
}

async function listLiveRooms() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const liveUrl = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !liveUrl || apiKey === 'devkey' || apiSecret === 'secret') {
    throw new HttpError(503, 'Mobile live streaming is not configured');
  }
  const { RoomServiceClient } = require('livekit-server-sdk');
  try {
    const service = new RoomServiceClient(liveUrl.replace(/^ws/, 'http'), apiKey, apiSecret);
    const rooms = await service.listRooms();
    const live = rooms.filter((room) => room.numPublishers > 0);
    return response(200, { rooms: await Promise.all(live.map(async (room) => {
      let host = null;
      let participants = [];
      try {
        participants = await service.listParticipants(room.name);
      } catch {
        participants = [];
      }
      const hostParticipant = participants.find((participant) => {
        try {
          return JSON.parse(participant.metadata || '{}').role === 'host';
        } catch {
          return false;
        }
      });
      if (hostParticipant) host = { name: hostParticipant.name || hostParticipant.identity };
      return { name: room.name, viewers: Math.max(room.numParticipants - room.numPublishers, 0), host };
    })) });
  } catch (error) {
    console.error('LiveKit rooms query failed', error);
    throw new HttpError(502, 'Live streams are temporarily unavailable');
  }
}

async function liveViewerToken(event) {
  const room = str(event.queryStringParameters || {}, 'room', { max: 40 });
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(room)) throw new HttpError(400, 'Invalid live room name');
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_URL) throw new HttpError(503, 'Mobile live streaming is not configured');
  const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');
  try {
    const service = new RoomServiceClient(process.env.LIVEKIT_URL.replace(/^ws/, 'http'), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
    const activeRooms = await service.listRooms();
    if (!activeRooms.some((entry) => entry.name === room && entry.numPublishers > 0)) throw new HttpError(404, 'This stream has ended');
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: `viewer-${randomUUID()}`,
      name: 'Dobha viewer',
      ttl: '2h',
    });
    token.addGrant({ roomJoin: true, room, canPublish: false, canSubscribe: true, canPublishData: false });
    return response(200, { url: process.env.LIVEKIT_URL, token: await token.toJwt(), role: 'viewer' });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('Could not issue viewer token', error);
    throw new HttpError(502, 'Could not join this live stream');
  }
}

const orders = require('./orders').createOrders({
  get, queryAll, transact, putTx, updateTx, userOutbox, itemById, publicItem,
  response, HttpError, str, money, table, requireAdmin,
});

async function route(event) {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return response(204, {});
  const path = pathOf(event);
  const body = (['POST', 'PATCH', 'PUT'].includes(method) && !(method === 'PUT' && path === '/me/avatar')) ||
    (method === 'DELETE' && path === '/me')
    ? bodyOf(event)
    : {};
  if (method === 'GET' && path === '/health') return response(200, { status: 'healthy', service: 'dobha-marketplace' });
  if (method === 'POST' && path === '/auth/register') return register(body);
  if (method === 'POST' && path === '/auth/confirm') return confirmRegistration(body);
  if (method === 'POST' && path === '/auth/login') return login(body);
  if (method === 'POST' && path === '/auth/refresh') return refresh(body);
  if (method === 'POST' && path === '/auth/forgot') return forgot(body);
  if (method === 'POST' && path === '/auth/reset') return reset(body);
  if (method === 'GET' && path === '/items') return feed(event);
  const mediaMatch = /^\/media\/(.+)$/.exec(path);
  if (method === 'GET' && mediaMatch) return readMedia(mediaMatch[1]);
  if (method === 'GET' && path === '/rooms') return listLiveRooms();
  if (method === 'GET' && path === '/live/token') return liveViewerToken(event);
  const itemMatch = /^\/items\/([^/]+)$/.exec(path);
  if (method === 'GET' && itemMatch && itemMatch[1] !== 'mine') return response(200, { item: await itemJson(await itemById(itemMatch[1])) });

  const user = getUser(event);
  if (method !== 'DELETE' || path !== '/me') await assertAccountActive(user);
  if (method === 'GET' && path === '/me') return me(user);
  if (method === 'PATCH' && path === '/me') return updateMe(user, body);
  if (method === 'DELETE' && path === '/me') return deleteAccount(user, body);
  if ((method === 'PUT' || method === 'DELETE') && path === '/me/avatar') return setAvatar(event, user);
  if (method === 'PATCH' && path === '/me/vendor') return becomeVendor(user, body);
  if (method === 'POST' && path === '/uploads') return uploadUrl(user, body);
  if (method === 'GET' && path === '/items/mine') return myListings(user);
  if (method === 'POST' && path === '/items') return createListing(user, body);
  if (method === 'POST' && path === '/me/password') return changePassword(event, user, body);
  if (method === 'GET' && path === '/orders') return orders.myOrders(user);
  if (method === 'POST' && path === '/orders') return orders.createOrder(user, body);
  if (method === 'GET' && path === '/wallet') return orders.wallet(user);
  if (method === 'POST' && path === '/wallet/topup') return orders.topUp(user, body);
  if (method === 'POST' && path === '/wallet/withdraw') return orders.withdraw(user, body);
  const orderAction = /^\/orders\/([^/]+)\/(dispatch|confirm|dispute|resolve)$/.exec(path);
  if (method === 'POST' && orderAction) return orders.transition(user, orderAction[1], orderAction[2], body);
  if (method === 'GET' && path === '/notifications/unread') {
    const result = await myNotifications(user);
    const data = JSON.parse(result.body);
    return response(200, { unread: data.unread, messages: 0 });
  }
  if (method === 'GET' && path === '/notifications') return myNotifications(user);
  if (method === 'POST' && path === '/notifications/read') {
    const { db, dbCommands: { QueryCommand, UpdateCommand } } = clients();
    const result = await db.send(new QueryCommand({
      TableName: table(),
      KeyConditionExpression: 'pk = :user AND begins_with(sk, :prefix)',
      FilterExpression: 'attribute_not_exists(readAt)',
      ExpressionAttributeValues: { ':user': `USER#${user.id}`, ':prefix': 'NOTIFICATION#' },
      ProjectionExpression: 'pk, sk',
    }));
    await Promise.all((result.Items || []).map((entry) => db.send(new UpdateCommand({
      TableName: table(), Key: key(entry.pk, entry.sk),
      UpdateExpression: 'SET readAt = :now',
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
    }))));
    return response(200, { ok: true });
  }
  if (itemMatch && method === 'PATCH') return updateListing(user, itemMatch[1], body);
  if (itemMatch && method === 'DELETE') return deleteListing(user, itemMatch[1]);

  return response(404, { error: 'Route not found' });
}

exports.handler = async (event) => {
  try {
    return await route(event);
  } catch (error) {
    if (error instanceof HttpError) return response(error.status, { error: error.message });
    if (error.name === 'UsernameExistsException') return response(409, { error: 'An account with this email already exists' });
    if (error.name === 'InvalidPasswordException') return response(400, { error: 'Password must be 10+ characters and include uppercase, lowercase, a number, and a symbol' });
    if (error.name === 'UserNotConfirmedException') return response(403, { error: 'Confirm your email before signing in' });
    if (error.name === 'CodeMismatchException' || error.name === 'ExpiredCodeException') return response(400, { error: 'The code is invalid or expired' });
    if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') return response(401, { error: 'Email or password is incorrect' });
    if (error.name === 'ConditionalCheckFailedException' || error.name === 'TransactionCanceledException') return response(409, { error: 'Stock changed while you were checking out. Please refresh and try again.' });
    if (error.name === 'TooManyRequestsException' || error.name === 'LimitExceededException') return response(429, { error: 'Too many requests; try again shortly' });
    console.error('Unhandled marketplace API error', error);
    return response(500, { error: 'Something went wrong. Please try again.' });
  }
};
