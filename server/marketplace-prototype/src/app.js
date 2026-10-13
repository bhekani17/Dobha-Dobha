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
    'access-control-allow-origin': process.env.ALLOWED_ORIGIN || '*',
    'access-control-allow-headers': 'Content-Type,Authorization',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    ...extra,
  },
  body: statusCode === 204 ? '' : JSON.stringify(body),
});

let sdk;
function clients() {
  if (sdk) return sdk;
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
  sdk = {
    db: DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } }),
    s3: new S3Client({}),
    cognito: new CognitoIdentityProviderClient({}),
    dbCommands: { GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand },
    s3Commands: { GetObjectCommand },
    s3Presign: { createPresignedPost, getSignedUrl },
    authCommands: { SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand },
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
  if (!Number.isFinite(value) || value <= 0 || value > max) throw new HttpError(400, `${key} must be a valid positive amount`);
  return Math.round(value * 100);
}

function getUser(event, required = true) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims || {};
  if (!claims.sub) {
    if (required) throw new HttpError(401, 'Please sign in');
    return null;
  }
  return { id: claims.sub, email: claims.email || '', name: claims.name || '' };
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
const orderKey = (id) => key(`ORDER#${id}`, 'META');

async function get(pk, sk) {
  const { db, dbCommands: { GetCommand } } = clients();
  return (await db.send(new GetCommand({ TableName: table(), Key: key(pk, sk), ConsistentRead: true }))).Item;
}
async function put(item, conditionExpression) {
  const { db, dbCommands: { PutCommand } } = clients();
  await db.send(new PutCommand({ TableName: table(), Item: item, ...(conditionExpression ? { ConditionExpression: conditionExpression } : {}) }));
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
  const profile = await get(`USER#${claims.sub}`, 'PROFILE');
  return response(200, {
    token: auth.IdToken,
    refreshToken: auth.RefreshToken,
    expiresIn: auth.ExpiresIn,
    user: { id: claims.sub, email: claims.email, name: profile?.name || claims.name || claims.email, role: profile?.role || 'shopper' },
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

async function me(user) {
  const profile = await get(`USER#${user.id}`, 'PROFILE');
  return response(200, { user: { id: user.id, email: user.email, name: profile?.name || user.name, role: profile?.role || 'shopper', shopName: profile?.shopName || '', stallLocation: profile?.stallLocation || '' } });
}
async function becomeVendor(user, body) {
  const shopName = str(body, 'shopName', { min: 2, max: 60 });
  const stallLocation = str(body, 'stallLocation', { min: 2, max: 80 });
  const profile = await get(`USER#${user.id}`, 'PROFILE');
  if (!profile) throw new HttpError(404, 'Profile not found');
  const updated = { ...profile, role: 'vendor', shopName, stallLocation };
  await put(updated);
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
    ConditionExpression: '#status = :available AND sellerId = :seller',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':available': 'available', ':seller': user.id },
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

async function createOrder(user, body) {
  const item = await itemById(str(body, 'itemId', { max: 80 }), false);
  if (item.sellerId === user.id) throw new HttpError(400, "You can't buy your own listing");
  const quantity = body.quantity == null ? 1 : Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) throw new HttpError(409, 'That quantity is no longer available');
  const orderId = `DB-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const createdAt = new Date().toISOString();
  const order = {
    pk: `ORDER#${orderId}`, sk: 'META', id: orderId, itemId: item.id,
    itemTitle: item.title, itemPhotoKey: item.photoKey, buyerId: user.id,
    sellerId: item.sellerId, quantity, amountCents: item.priceCents * quantity,
    status: 'paymentPending', deliveryAddress: str(body, 'deliveryAddress', { min: 5, max: 200 }),
    createdAt, GSI1PK: `BUYER#${user.id}`, GSI1SK: `ORDER#${createdAt}#${orderId}`,
    GSI2PK: `SELLER#${item.sellerId}`, GSI2SK: `ORDER#${createdAt}#${orderId}`,
  };
  const remaining = item.quantity - quantity;
  const writes = [
    updateTx(itemKey(item.id), remaining === 0
      ? 'SET quantity = :quantity, #status = :status REMOVE GSI1PK, GSI1SK'
      : 'SET quantity = :quantity, #status = :status', '#status = :available AND quantity >= :requested', {
      ':quantity': remaining, ':status': remaining === 0 ? 'sold' : 'available',
      ':available': 'available', ':requested': quantity,
    }, { '#status': 'status' }),
    putTx(order, 'attribute_not_exists(pk)'),
    userOutbox(item.sellerId, { kind: 'sale', title: 'New order', body: `${user.name || 'A customer'} ordered ${quantity} × ${item.title}.`, orderId }),
  ];
  await transact(writes);
  return response(201, { order: orderView(order) });
}

function orderView(order) {
  return {
    id: order.id,
    item: { id: order.itemId, title: order.itemTitle, photoUrl: order.itemPhotoKey ? mediaUrl(order.itemPhotoKey) : null },
    quantity: order.quantity,
    amountZar: order.amountCents / 100,
    status: order.status,
    deliveryAddress: order.deliveryAddress,
    createdAt: order.createdAt,
  };
}

async function myOrders(user) {
  const { db, dbCommands: { QueryCommand } } = clients();
  const [buyer, seller] = await Promise.all(['BUYER', 'SELLER'].map((role) => db.send(new QueryCommand({
    TableName: table(), IndexName: role === 'BUYER' ? 'MarketFeedIndex' : 'SellerActivityIndex',
    KeyConditionExpression: `${role === 'BUYER' ? 'GSI1PK' : 'GSI2PK'} = :user AND begins_with(${role === 'BUYER' ? 'GSI1SK' : 'GSI2SK'}, :prefix)`,
    ExpressionAttributeValues: { ':user': `${role}#${user.id}`, ':prefix': 'ORDER#' },
    ScanIndexForward: false, Limit: 100,
  }))));
  const distinct = new Map([...(buyer.Items || []), ...(seller.Items || [])].map((order) => [order.id, order]));
  return response(200, { orders: [...distinct.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(orderView) });
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
  if (!keyValue.startsWith('items/') || keyValue.includes('..')) throw new HttpError(404, 'Media not found');
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

async function route(event) {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return response(204, {});
  const path = pathOf(event);
  const body = ['POST', 'PATCH', 'PUT'].includes(method) ? bodyOf(event) : {};
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
  if (method === 'GET' && path === '/me') return me(user);
  if (method === 'PATCH' && path === '/me/vendor') return becomeVendor(user, body);
  if (method === 'POST' && path === '/uploads') return uploadUrl(user, body);
  if (method === 'GET' && path === '/items/mine') return myListings(user);
  if (method === 'POST' && path === '/items') return createListing(user, body);
  if (method === 'GET' && path === '/orders') return myOrders(user);
  if (method === 'POST' && path === '/orders') return createOrder(user, body);
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

function orderView(order) {
  return {
    id: order.id,
    itemId: order.itemId,
    itemTitle: order.itemTitle,
    photoUrl: order.itemPhotoKey ? mediaUrl(order.itemPhotoKey) : null,
    quantity: order.quantity,
    amountZar: order.amountCents / 100,
    status: order.status,
    createdAt: order.createdAt,
  };
}
