'use strict';

const dynamo = require('../utils/dynamo');
const { json, error, handleCors, parseBody } = require('../utils/response');
const { requireUser } = require('../utils/auth');
const { now } = require('../utils/id');

exports.handler = async (event) => {
  const cors = handleCors(event);
  if (cors) return cors;

  const notificationsTable = process.env.NOTIFICATIONS_TABLE;
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const method = (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '').toUpperCase();

  try {
    const user = await requireUser(event);

    // -------------------------------------------------------------
    // GET /api/notifications: List notifications
    // -------------------------------------------------------------
    if (path === '/api/notifications' && method === 'GET') {
      const res = await dynamo.query({
        TableName: notificationsTable,
        IndexName: 'UserIndex',
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: { ':uid': user.id },
        ScanIndexForward: false,
        Limit: 50,
      });

      return json(200, {
        notifications: res.items.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          body: n.body,
          orderId: n.order_id,
          itemId: n.item_id,
          read: Boolean(n.read),
          createdAt: n.created_at ? new Date(n.created_at).toISOString() : null,
        })),
      });
    }

    // -------------------------------------------------------------
    // GET /api/notifications/unread: Unread count
    // -------------------------------------------------------------
    if (path.endsWith('/api/notifications/unread') && method === 'GET') {
      const res = await dynamo.query({
        TableName: notificationsTable,
        IndexName: 'UserIndex',
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: { ':uid': user.id },
        ScanIndexForward: false,
        Limit: 50,
      });

      const unreadCount = res.items.filter((n) => !n.read).length;
      return json(200, { unreadCount });
    }

    // -------------------------------------------------------------
    // POST /api/notifications/read: Mark notifications as read
    // -------------------------------------------------------------
    if (path.endsWith('/api/notifications/read') && method === 'POST') {
      const body = parseBody(event);
      const notificationId = body.notificationId || body.id;

      if (notificationId) {
        await dynamo.update({
          TableName: notificationsTable,
          Key: { id: notificationId },
          UpdateExpression: 'SET #rd = :true, read_at = :time',
          ExpressionAttributeNames: { '#rd': 'read' },
          ExpressionAttributeValues: { ':true': true, ':time': now() },
        });
      } else {
        // Mark all top 50 unread as read
        const res = await dynamo.query({
          TableName: notificationsTable,
          IndexName: 'UserIndex',
          KeyConditionExpression: 'user_id = :uid',
          ExpressionAttributeValues: { ':uid': user.id },
          Limit: 50,
        });
        await Promise.all(
          res.items.filter((n) => !n.read).map((n) =>
            dynamo.update({
              TableName: notificationsTable,
              Key: { id: n.id },
              UpdateExpression: 'SET #rd = :true, read_at = :time',
              ExpressionAttributeNames: { '#rd': 'read' },
              ExpressionAttributeValues: { ':true': true, ':time': now() },
            })
          )
        );
      }

      return json(200, { message: 'Notifications marked as read' });
    }

    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Notifications handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
};
