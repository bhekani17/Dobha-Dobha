'use strict';

const crypto = require('crypto');
const dynamo = require('./dynamo');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function extractBearer(event) {
  const headers = event.headers || {};
  const auth = headers.Authorization || headers.authorization || headers.AUTHORIZATION;
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return auth;
}

async function getUser(event) {
  const usersTable = process.env.USERS_TABLE;
  const sessionsTable = process.env.SESSIONS_TABLE;

  // 1. Check Cognito Authorizer claims in requestContext
  const authorizer = event.requestContext && event.requestContext.authorizer;
  if (authorizer && authorizer.claims) {
    const claims = authorizer.claims;
    const sub = claims.sub;
    const email = claims.email;

    if (usersTable && sub) {
      const user = await dynamo.get(usersTable, { id: sub });
      if (user) return user;
    }

    if (usersTable && email) {
      const res = await dynamo.query({
        TableName: usersTable,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email.toLowerCase() },
        Limit: 1,
      });
      if (res.items.length > 0) return res.items[0];
    }

    // If not found in DynamoDB yet, return synthesized user from claims
    return {
      id: sub || `usr_${claims.username || 'unknown'}`,
      email: (email || '').toLowerCase(),
      name: claims.name || claims['cognito:username'] || 'User',
      handle: (claims.email ? claims.email.split('@')[0] : 'user').toLowerCase(),
      role: 'buyer',
    };
  }

  // 2. Check Bearer token against SessionsTable
  const token = extractBearer(event);
  if (!token) return null;

  if (sessionsTable && usersTable) {
    const tokenHash = hashToken(token);
    const session = await dynamo.get(sessionsTable, { token_hash: tokenHash });
    if (session) {
      if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
        return null;
      }
      return await dynamo.get(usersTable, { id: session.user_id });
    }
  }

  return null;
}

async function requireUser(event) {
  const user = await getUser(event);
  if (!user) {
    const err = new Error('Sign in required');
    err.statusCode = 401;
    throw err;
  }
  return user;
}

function isAdmin(user) {
  if (!user || !user.email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || 'ndlovubhekani17@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase());
  return adminEmails.includes(user.email.toLowerCase()) || user.role === 'admin';
}

function requireAdmin(user) {
  if (!isAdmin(user)) {
    const err = new Error('Admin access required');
    err.statusCode = 403;
    throw err;
  }
  return user;
}

module.exports = {
  hashToken,
  extractBearer,
  getUser,
  requireUser,
  isAdmin,
  requireAdmin,
};
