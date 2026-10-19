'use strict';

const crypto = require('crypto');
const dynamo = require('../utils/dynamo');
const { json, error, handleCors, parseBody } = require('../utils/response');
const { id, now, zar } = require('../utils/id');
const { hashToken, getUser, requireUser, extractBearer } = require('../utils/auth');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function verifyPassword(password, hash, salt) {
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

async function createSession(userId, sessionsTable) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const ttlSeconds = Math.floor(Date.now() / 1000) + 30 * 24 * 3600; // 30 days

  if (sessionsTable) {
    await dynamo.put(sessionsTable, {
      token_hash: tokenHash,
      user_id: userId,
      created_at: now(),
      expires_at: ttlSeconds,
    });
  }

  return token;
}

function sanitizeUser(user, wallet = null) {
  if (!user) return null;
  const result = {
    id: user.id,
    name: user.name,
    email: user.email,
    handle: user.handle,
    role: user.role || 'buyer',
    avatarUrl: user.avatar_key ? `/media/${user.avatar_key}` : (user.avatar_url || null),
    bio: user.bio || '',
    shopName: user.shop_name || '',
    stallLocation: user.stall_location || '',
    phone: user.phone || '',
    createdAt: user.created_at,
  };
  if (wallet) {
    result.wallet = {
      availableZar: zar(wallet.available_cents || 0),
      lockedZar: zar(wallet.locked_cents || 0),
      pendingZar: zar(wallet.pending_cents || 0),
    };
  }
  return result;
}

exports.handler = async (event) => {
  const cors = handleCors(event);
  if (cors) return cors;

  const usersTable = process.env.USERS_TABLE;
  const sessionsTable = process.env.SESSIONS_TABLE;
  const walletsTable = process.env.WALLET_TABLE || process.env.WALLETS_TABLE;
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const method = (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '').toUpperCase();

  try {
    // -------------------------------------------------------------
    // POST /api/auth/register
    // -------------------------------------------------------------
    if (path.endsWith('/api/auth/register') && method === 'POST') {
      const body = parseBody(event);
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';
      const name = (body.name || '').trim();
      const handle = (body.handle || email.split('@')[0] || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const role = body.role === 'vendor' ? 'vendor' : 'buyer';
      const shopName = (body.shopName || body.shop_name || '').trim();
      const stallLocation = (body.stallLocation || body.stall_location || '').trim();

      if (!email || !email.includes('@')) {
        return error(400, 'A valid email address is required');
      }
      if (!password || password.length < 8) {
        return error(400, 'Password must be at least 8 characters long');
      }
      if (!name) {
        return error(400, 'Full name is required');
      }
      if (!handle) {
        return error(400, 'Valid handle is required');
      }

      // Check if email already registered
      const existingEmail = await dynamo.query({
        TableName: usersTable,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        Limit: 1,
      });
      if (existingEmail.items.length > 0) {
        return error(409, 'An account with this email already exists');
      }

      // Check if handle already taken
      const existingHandle = await dynamo.query({
        TableName: usersTable,
        IndexName: 'HandleIndex',
        KeyConditionExpression: 'handle = :handle',
        ExpressionAttributeValues: { ':handle': handle },
        Limit: 1,
      });
      if (existingHandle.items.length > 0) {
        return error(409, 'This username handle is already taken');
      }

      const userId = id('usr');
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const timestamp = now();

      const newUser = {
        id: userId,
        email,
        handle,
        name,
        role,
        shop_name: shopName,
        stall_location: stallLocation,
        password_hash: passwordHash,
        password_salt: salt,
        created_at: timestamp,
        updated_at: timestamp,
      };

      await dynamo.put(usersTable, newUser);

      // Initialize Wallet for the user
      if (walletsTable) {
        await dynamo.put(walletsTable, {
          user_id: userId,
          available_cents: 0,
          locked_cents: 0,
          pending_cents: 0,
          updated_at: timestamp,
        });
      }

      const token = await createSession(userId, sessionsTable);
      return json(201, {
        token,
        user: sanitizeUser(newUser, { available_cents: 0, locked_cents: 0, pending_cents: 0 }),
      });
    }

    // -------------------------------------------------------------
    // POST /api/auth/login
    // -------------------------------------------------------------
    if (path.endsWith('/api/auth/login') && method === 'POST') {
      const body = parseBody(event);
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      if (!email || !password) {
        return error(400, 'Email and password are required');
      }

      const res = await dynamo.query({
        TableName: usersTable,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        Limit: 1,
      });

      if (res.items.length === 0) {
        return error(401, 'Invalid email or password');
      }

      const user = res.items[0];
      if (!user.password_hash || !user.password_salt) {
        return error(401, 'Account uses third-party sign in');
      }

      const valid = verifyPassword(password, user.password_hash, user.password_salt);
      if (!valid) {
        return error(401, 'Invalid email or password');
      }

      const token = await createSession(user.id, sessionsTable);
      let wallet = null;
      if (walletsTable) {
        wallet = await dynamo.get(walletsTable, { user_id: user.id });
      }

      return json(200, {
        token,
        user: sanitizeUser(user, wallet),
      });
    }

    // -------------------------------------------------------------
    // POST /api/auth/google
    // -------------------------------------------------------------
    if (path.endsWith('/api/auth/google') && method === 'POST') {
      const body = parseBody(event);
      let email = (body.email || '').trim().toLowerCase();
      let name = (body.name || '').trim();
      const sub = body.sub || body.googleId;

      // In production, Google token can be decoded or passed directly
      if (!email && (body.credential || body.idToken)) {
        try {
          const token = body.credential || body.idToken;
          const parts = token.split('.');
          if (parts.length === 3) {
            const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
            email = (payload.email || '').toLowerCase();
            name = payload.name || name;
          }
        } catch {
          // Fall through
        }
      }

      if (!email) {
        return error(400, 'Google sign-in token could not be verified');
      }

      let user = null;
      const res = await dynamo.query({
        TableName: usersTable,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        Limit: 1,
      });

      if (res.items.length > 0) {
        user = res.items[0];
      } else {
        // Create new user for Google login
        const userId = id('usr');
        const handle = (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '') + Math.floor(Math.random() * 1000);
        const timestamp = now();
        user = {
          id: userId,
          email,
          name: name || handle,
          handle,
          role: 'buyer',
          google_sub: sub,
          created_at: timestamp,
          updated_at: timestamp,
        };
        await dynamo.put(usersTable, user);

        if (walletsTable) {
          await dynamo.put(walletsTable, {
            user_id: userId,
            available_cents: 0,
            locked_cents: 0,
            pending_cents: 0,
            updated_at: timestamp,
          });
        }
      }

      const token = await createSession(user.id, sessionsTable);
      let wallet = null;
      if (walletsTable) {
        wallet = await dynamo.get(walletsTable, { user_id: user.id });
      }

      return json(200, {
        token,
        user: sanitizeUser(user, wallet),
      });
    }

    // -------------------------------------------------------------
    // POST /api/auth/logout
    // -------------------------------------------------------------
    if (path.endsWith('/api/auth/logout') && method === 'POST') {
      const token = extractBearer(event);
      if (token && sessionsTable) {
        const tokenHash = hashToken(token);
        await dynamo.delete(sessionsTable, { token_hash: tokenHash });
      }
      return json(200, { message: 'Logged out successfully' });
    }

    // -------------------------------------------------------------
    // GET /api/me
    // -------------------------------------------------------------
    if (path.endsWith('/api/me') && method === 'GET') {
      const user = await requireUser(event);
      let wallet = null;
      if (walletsTable) {
        wallet = await dynamo.get(walletsTable, { user_id: user.id });
      }
      return json(200, {
        user: sanitizeUser(user, wallet),
      });
    }

    // -------------------------------------------------------------
    // PATCH /api/me
    // -------------------------------------------------------------
    if (path.endsWith('/api/me') && method === 'PATCH') {
      const user = await requireUser(event);
      const body = parseBody(event);

      const updates = [];
      const attrNames = {};
      const attrValues = { ':updated_at': now() };

      if (body.name !== undefined) {
        updates.push('#name = :name');
        attrNames['#name'] = 'name';
        attrValues[':name'] = String(body.name).trim();
      }
      if (body.role !== undefined && (body.role === 'buyer' || body.role === 'vendor')) {
        updates.push('#role = :role');
        attrNames['#role'] = 'role';
        attrValues[':role'] = body.role;
      }
      if (body.bio !== undefined) {
        updates.push('#bio = :bio');
        attrNames['#bio'] = 'bio';
        attrValues[':bio'] = String(body.bio).trim();
      }
      if (body.shopName !== undefined || body.shop_name !== undefined) {
        const shop = body.shopName !== undefined ? body.shopName : body.shop_name;
        updates.push('#shop_name = :shop_name');
        attrNames['#shop_name'] = 'shop_name';
        attrValues[':shop_name'] = String(shop).trim();
      }
      if (body.stallLocation !== undefined || body.stall_location !== undefined) {
        const stall = body.stallLocation !== undefined ? body.stallLocation : body.stall_location;
        updates.push('#stall_location = :stall_location');
        attrNames['#stall_location'] = 'stall_location';
        attrValues[':stall_location'] = String(stall).trim();
      }
      if (body.phone !== undefined) {
        updates.push('#phone = :phone');
        attrNames['#phone'] = 'phone';
        attrValues[':phone'] = String(body.phone).trim();
      }

      if (updates.length > 0) {
        updates.push('updated_at = :updated_at');
        await dynamo.update({
          TableName: usersTable,
          Key: { id: user.id },
          UpdateExpression: 'SET ' + updates.join(', '),
          ExpressionAttributeNames: attrNames,
          ExpressionAttributeValues: attrValues,
        });
      }

      const updatedUser = await dynamo.get(usersTable, { id: user.id });
      let wallet = null;
      if (walletsTable) {
        wallet = await dynamo.get(walletsTable, { user_id: user.id });
      }

      return json(200, {
        user: sanitizeUser(updatedUser, wallet),
      });
    }

    // -------------------------------------------------------------
    // DELETE /api/me
    // -------------------------------------------------------------
    if (path.endsWith('/api/me') && method === 'DELETE') {
      const user = await requireUser(event);

      // Verify no pending wallet balances
      if (walletsTable) {
        const wallet = await dynamo.get(walletsTable, { user_id: user.id });
        if (wallet && ((wallet.locked_cents && wallet.locked_cents > 0) || (wallet.pending_cents && wallet.pending_cents > 0))) {
          return error(409, 'Cannot delete account with orders still in escrow or pending payout');
        }
      }

      // Anonymize user record
      await dynamo.update({
        TableName: usersTable,
        Key: { id: user.id },
        UpdateExpression: 'SET #name = :name, email = :email, handle = :handle, is_deleted = :deleted, updated_at = :time',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: {
          ':name': 'Deleted User',
          ':email': `deleted_${user.id}@dobha.local`,
          ':handle': `deleted_${user.id}`,
          ':deleted': true,
          ':time': now(),
        },
      });

      return json(200, { message: 'Account deleted and anonymized successfully' });
    }

    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Auth handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
};
