'use strict';

const { randomUUID } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.TABLE_NAME;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const MAX_PRICE_CENTS = 100000000;
const OUTBOX_TTL_SECONDS = 7 * 24 * 60 * 60;

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: statusCode === 204 ? '' : JSON.stringify(body),
  };
}

function currentUser(event) {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims?.sub) throw new HttpError(401, 'Sign in is required.');
  return {
    id: claims.sub,
    email: String(claims.email || '').toLowerCase(),
    emailVerified: claims.email_verified === 'true',
  };
}

function bodyOf(event) {
  if (!event.body) throw new HttpError(400, 'A JSON request body is required.');
  let body;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  return body;
}

function outbox(userId, kind, unitId, unitName) {
  const id = randomUUID();
  return {
    Put: {
      TableName: TABLE_NAME,
      Item: {
        pk: `OUTBOX#${id}`,
        sk: 'META',
        id,
        userId,
        kind,
        unitId,
        unitName,
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + OUTBOX_TTL_SECONDS,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    },
  };
}

function isConditionalFailure(error) {
  return error.name === 'ConditionalCheckFailedException'
    || error.name === 'TransactionCanceledException';
}

async function listUnits() {
  const result = await db.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'UnitsByName',
    KeyConditionExpression: 'GSI1PK = :units',
    ExpressionAttributeValues: { ':units': 'UNITS' },
    Limit: 100,
    ScanIndexForward: true,
  }));
  const units = (result.Items || []).map((unit) => ({
    id: unit.id,
    name: unit.name,
    size: unit.size,
    monthlyPriceCents: unit.monthlyPriceCents,
    status: unit.status,
    createdAt: unit.createdAt,
  }));
  return response(200, { units });
}

async function createUnit(event, user) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!user.emailVerified || !adminEmails.includes(user.email)) {
    throw new HttpError(403, 'Only a configured administrator can add storage units.');
  }

  const body = bodyOf(event);
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) {
    throw new HttpError(400, 'Unit name must be between 2 and 80 characters.');
  }
  if (typeof body.size !== 'string' || body.size.trim().length < 2 || body.size.trim().length > 60) {
    throw new HttpError(400, 'Unit size must be between 2 and 60 characters.');
  }
  if (typeof body.monthlyPrice !== 'number' || !Number.isFinite(body.monthlyPrice)
    || body.monthlyPrice <= 0 || body.monthlyPrice * 100 > MAX_PRICE_CENTS) {
    throw new HttpError(400, 'Monthly price must be a positive amount no greater than 1,000,000.');
  }

  const unit = {
    pk: `UNIT#${randomUUID()}`,
    sk: 'META',
    id: '',
    name: body.name.trim(),
    size: body.size.trim(),
    monthlyPriceCents: Math.round(body.monthlyPrice * 100),
    status: 'AVAILABLE',
    GSI1PK: 'UNITS',
    GSI1SK: `${body.name.trim().toLowerCase()}#${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  unit.id = unit.pk.slice('UNIT#'.length);
  await db.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: unit,
    ConditionExpression: 'attribute_not_exists(pk)',
  }));
  return response(201, { unit });
}

async function createReservation(event, user) {
  const body = bodyOf(event);
  if (typeof body.unitId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.unitId)) {
    throw new HttpError(400, 'A valid unitId is required.');
  }

  const unitKey = { pk: `UNIT#${body.unitId}`, sk: 'META' };
  const result = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: unitKey,
    ConsistentRead: true,
  }));
  if (!result.Item) throw new HttpError(404, 'Storage unit was not found.');
  const unit = result.Item;
  if (unit.status !== 'AVAILABLE') throw new HttpError(409, 'This storage unit is not available.');

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const reservation = {
    pk: `USER#${user.id}`,
    sk: `RESERVATION#${id}`,
    id,
    userId: user.id,
    unitId: body.unitId,
    unitName: unit.name,
    monthlyPriceCents: unit.monthlyPriceCents,
    status: 'ACTIVE',
    createdAt,
  };

  await db.send(new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: TABLE_NAME,
          Key: unitKey,
          UpdateExpression: 'SET #status = :reserved, reservedBy = :userId, reservedAt = :createdAt',
          ConditionExpression: 'attribute_exists(pk) AND #status = :available',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':reserved': 'RESERVED',
            ':available': 'AVAILABLE',
            ':userId': user.id,
            ':createdAt': createdAt,
          },
        },
      },
      {
        Put: {
          TableName: TABLE_NAME,
          Item: reservation,
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
      outbox(user.id, 'RESERVATION_CREATED', body.unitId, unit.name),
    ],
  }));
  return response(201, { reservation });
}

async function listReservations(user) {
  const result = await db.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :user AND begins_with(sk, :reservation)',
    ExpressionAttributeValues: {
      ':user': `USER#${user.id}`,
      ':reservation': 'RESERVATION#',
    },
    ScanIndexForward: false,
    Limit: 100,
  }));
  return response(200, { reservations: result.Items || [] });
}

async function releaseReservation(reservationId, user) {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId || '')) {
    throw new HttpError(400, 'A valid reservation ID is required.');
  }
  const reservationKey = {
    pk: `USER#${user.id}`,
    sk: `RESERVATION#${reservationId}`,
  };
  const result = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: reservationKey,
    ConsistentRead: true,
  }));
  if (!result.Item) throw new HttpError(404, 'Reservation was not found.');
  const reservation = result.Item;
  if (reservation.status === 'RELEASED') return response(200, { reservation });
  if (reservation.status !== 'ACTIVE') throw new HttpError(409, 'This reservation cannot be released.');

  const updatedAt = new Date().toISOString();
  const unitKey = { pk: `UNIT#${reservation.unitId}`, sk: 'META' };
  await db.send(new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: TABLE_NAME,
          Key: unitKey,
          UpdateExpression: 'SET #status = :available REMOVE reservedBy, reservedAt',
          ConditionExpression: '#status = :reserved AND reservedBy = :userId',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':available': 'AVAILABLE',
            ':reserved': 'RESERVED',
            ':userId': user.id,
          },
        },
      },
      {
        Update: {
          TableName: TABLE_NAME,
          Key: reservationKey,
          UpdateExpression: 'SET #status = :released, updatedAt = :updatedAt',
          ConditionExpression: '#status = :active',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':released': 'RELEASED',
            ':active': 'ACTIVE',
            ':updatedAt': updatedAt,
          },
        },
      },
      outbox(user.id, 'RESERVATION_RELEASED', reservation.unitId, reservation.unitName),
    ],
  }));
  return response(200, {
    reservation: { ...reservation, status: 'RELEASED', updatedAt },
  });
}

async function listNotifications(user) {
  const result = await db.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :user AND begins_with(sk, :notification)',
    ExpressionAttributeValues: {
      ':user': `USER#${user.id}`,
      ':notification': 'NOTIFICATION#',
    },
    ScanIndexForward: false,
    Limit: 50,
  }));
  return response(200, { notifications: result.Items || [] });
}

exports.handler = async (event) => {
  try {
    const user = currentUser(event);
    const method = event.httpMethod;
    const path = (event.path || '/').replace(/^\/[^/]+(?=\/api\/)/, '').replace(/^\/api/, '') || '/';

    if (path === '/units' && method === 'GET') return await listUnits();
    if (path === '/units' && method === 'POST') return await createUnit(event, user);
    if (path === '/reservations' && method === 'GET') return await listReservations(user);
    if (path === '/reservations' && method === 'POST') return await createReservation(event, user);
    if (path.startsWith('/reservations/') && method === 'DELETE') {
      return await releaseReservation(path.slice('/reservations/'.length), user);
    }
    if (path === '/notifications' && method === 'GET') return await listNotifications(user);
    return response(404, { error: 'Route not found.' });
  } catch (error) {
    if (error instanceof HttpError) return response(error.statusCode, { error: error.message });
    if (isConditionalFailure(error)) {
      return response(409, { error: 'The storage unit or reservation changed. Refresh and try again.' });
    }
    console.error('Self-storage API request failed', error);
    return response(500, { error: 'The request could not be completed.' });
  }
};
