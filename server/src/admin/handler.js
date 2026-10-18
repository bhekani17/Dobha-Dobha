'use strict';

const dynamo = require('../utils/dynamo');
const { json, error, handleCors, parseBody } = require('../utils/response');
const { requireUser, requireAdmin } = require('../utils/auth');
const { now } = require('../utils/id');

exports.handler = async (event) => {
  const cors = handleCors(event);
  if (cors) return cors;

  const reportsTable = process.env.REPORTS_TABLE;
  const supportTable = process.env.SUPPORT_TABLE;
  const itemsTable = process.env.ITEMS_TABLE;
  const ordersTable = process.env.ORDERS_TABLE;

  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const method = (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '').toUpperCase();

  try {
    const user = await requireUser(event);
    requireAdmin(user);

    // -------------------------------------------------------------
    // GET /api/admin/reports: List reported items
    // -------------------------------------------------------------
    if (path.endsWith('/api/admin/reports') && method === 'GET') {
      const res = await dynamo.scan({
        TableName: reportsTable,
        Limit: 50,
      });
      return json(200, { reports: res.items });
    }

    // -------------------------------------------------------------
    // POST /api/admin/items/{id}/remove: Moderate & remove item
    // -------------------------------------------------------------
    const removeMatch = path.match(/^\/api\/admin\/items\/([^\/]+)\/remove$/);
    if (removeMatch && method === 'POST') {
      const itemId = removeMatch[1];
      if (itemsTable) {
        await dynamo.update({
          TableName: itemsTable,
          Key: { id: itemId },
          UpdateExpression: 'SET #st = :st, updated_at = :time',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: { ':st': 'removed_by_admin', ':time': now() },
        });
      }
      return json(200, { message: `Item ${itemId} removed by admin moderation` });
    }

    // -------------------------------------------------------------
    // GET /api/admin/support: Open support inquiries
    // -------------------------------------------------------------
    if (path.endsWith('/api/admin/support') && method === 'GET') {
      const res = await dynamo.scan({
        TableName: supportTable,
        Limit: 50,
      });
      return json(200, { tickets: res.items });
    }

    // -------------------------------------------------------------
    // POST /api/admin/support/{id}/reply: Reply to ticket
    // -------------------------------------------------------------
    const replyMatch = path.match(/^\/api\/admin\/support\/([^\/]+)\/reply$/);
    if (replyMatch && method === 'POST') {
      const ticketId = replyMatch[1];
      const body = parseBody(event);
      const replyText = (body.message || body.text || '').trim();

      const ticket = await dynamo.get(supportTable, { id: ticketId });
      if (!ticket) return error(404, 'Support ticket not found');

      const replies = ticket.replies || [];
      replies.push({
        from: 'Dobha Support',
        message: replyText,
        at: now(),
      });

      await dynamo.update({
        TableName: supportTable,
        Key: { id: ticketId },
        UpdateExpression: 'SET replies = :r, updated_at = :time',
        ExpressionAttributeValues: { ':r': replies, ':time': now() },
      });

      return json(200, { message: 'Reply sent', ticketId });
    }

    // -------------------------------------------------------------
    // POST /api/admin/support/{id}/close: Close ticket
    // -------------------------------------------------------------
    const closeMatch = path.match(/^\/api\/admin\/support\/([^\/]+)\/close$/);
    if (closeMatch && method === 'POST') {
      const ticketId = closeMatch[1];
      await dynamo.update({
        TableName: supportTable,
        Key: { id: ticketId },
        UpdateExpression: 'SET #st = :st, updated_at = :time',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: { ':st': 'closed', ':time': now() },
      });
      return json(200, { message: 'Ticket closed' });
    }

    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Admin handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
};
