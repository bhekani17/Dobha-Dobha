'use strict';

const dynamo = require('../utils/dynamo');
const { json, error, handleCors, withCors, parseBody } = require('../utils/response');
const { requireUser, requireAdmin } = require('../utils/auth');
const { id, now } = require('../utils/id');

exports.handler = withCors(async (event) => {
  const cors = handleCors(event);
  if (cors) return cors;

  const supportTable = process.env.SUPPORT_TABLE;
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const method = (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '').toUpperCase();

  try {
    const user = await requireUser(event);

    // -------------------------------------------------------------
    // GET /api/support: List user support tickets
    // -------------------------------------------------------------
    if (path === '/api/support' && method === 'GET') {
      const res = await dynamo.scan({
        TableName: supportTable,
        Limit: 50,
      });

      const userTickets = res.items.filter((t) => t.user_id === user.id);
      userTickets.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

      return json(200, { tickets: userTickets });
    }

    // -------------------------------------------------------------
    // POST /api/support: Create ticket
    // -------------------------------------------------------------
    if (path === '/api/support' && method === 'POST') {
      const body = parseBody(event);
      const subject = (body.subject || '').trim();
      const message = (body.message || '').trim();
      const orderId = body.orderId || null;

      if (!subject || !message) {
        return error(400, 'Subject and message are required');
      }

      const ticketId = id('spt');
      const ticket = {
        id: ticketId,
        user_id: user.id,
        user_email: user.email,
        user_name: user.name,
        subject,
        message,
        order_id: orderId,
        status: 'open',
        replies: [],
        created_at: now(),
        updated_at: now(),
      };

      await dynamo.put(supportTable, ticket);
      return json(201, { message: 'Support ticket submitted', ticket });
    }

    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Support handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
});
