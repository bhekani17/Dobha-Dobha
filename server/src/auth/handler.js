'use strict';

const crypto = require('crypto');
const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { OAuth2Client } = require('google-auth-library');
const dynamo = require('../utils/dynamo');
const { CORS_HEADERS, json, error, handleCors, parseBody } = require('../utils/response');
const { id, now, zar } = require('../utils/id');
const { hashToken, getUser, requireUser, extractBearer } = require('../utils/auth');

const s3 = new S3Client({});
const googleOAuthClient = new OAuth2Client();
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const MEDIA_MAX_BYTES = 60 * 1024 * 1024;
const DIRECT_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
const AVATAR_TYPES = {
  'image/jpeg': { extension: 'jpg', signature: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': {
    extension: 'png',
    signature: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extension: 'webp',
    signature: (bytes) => bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
  },
};
const MEDIA_TYPES = {
  ...AVATAR_TYPES,
  'video/mp4': { extension: 'mp4', signature: (bytes) => bytes.toString('ascii', 4, 8) === 'ftyp' },
  'video/quicktime': { extension: 'mov', signature: (bytes) => bytes.toString('ascii', 4, 8) === 'ftyp' },
  'video/webm': {
    extension: 'webm',
    signature: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  },
};

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
  const photosBucket = process.env.PHOTOS_BUCKET;
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const method = (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '').toUpperCase();

  try {
    const mediaMatch = path.match(/^\/media\/(.+)$/);
    if (mediaMatch && method === 'GET') {
      if (!photosBucket) return error(503, 'Media storage is not configured');
      let key;
      try {
        key = decodeURIComponent(mediaMatch[1]);
      } catch {
        return error(400, 'Invalid media key');
      }
      if (key.split('/').some((part) => !part || part === '.' || part === '..') || key.includes('\\')) {
        return error(400, 'Invalid media key');
      }
      const mediaUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: photosBucket, Key: key }),
        { expiresIn: 900 },
      );
      return {
        statusCode: 302,
        headers: {
          ...CORS_HEADERS,
          Location: mediaUrl,
          'Cache-Control': 'private, no-store',
        },
        body: '',
      };
    }

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
      const idToken = body.credential || body.idToken;
      if (typeof idToken !== 'string' || !idToken.trim()) {
        return error(400, 'A Google ID token is required');
      }

      const audiences = (process.env.GOOGLE_CLIENT_IDS || '')
        .split(',')
        .map((audience) => audience.trim())
        .filter(Boolean);
      if (audiences.length === 0) {
        return error(503, 'Google sign-in is not configured');
      }

      let claims;
      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken,
          audience: audiences,
        });
        claims = ticket.getPayload();
      } catch {
        return error(401, 'Google sign-in token is invalid or expired');
      }

      if (
        typeof claims?.sub !== 'string' ||
        typeof claims.email !== 'string' ||
        claims.email_verified !== true
      ) {
        return error(401, 'Google sign-in requires a verified email address');
      }

      const email = claims.email.trim().toLowerCase();
      const name = typeof claims.name === 'string' ? claims.name.trim() : '';
      const sub = claims.sub;

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

    // -------------------------------------------------------------
    // PUT /api/me/avatar and DELETE /api/me/avatar
    // -------------------------------------------------------------
    if (path.endsWith('/api/me/avatar') && (method === 'PUT' || method === 'DELETE')) {
      const user = await requireUser(event);
      if (!photosBucket) return error(503, 'Media storage is not configured');

      if (method === 'PUT') {
        const contentType = (event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').split(';')[0].trim().toLowerCase();
        const type = AVATAR_TYPES[contentType];
        if (!type) return error(400, 'Choose a JPEG, PNG or WebP image');
        if (!event.body) return error(400, 'An image file is required');
        if (event.isBase64Encoded && event.body.length > Math.ceil(AVATAR_MAX_BYTES * 4 / 3)) {
          return error(413, 'Profile photos must be 5 MB or smaller');
        }

        const image = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');
        if (image.length === 0) return error(400, 'An image file is required');
        if (image.length > AVATAR_MAX_BYTES) return error(413, 'Profile photos must be 5 MB or smaller');
        if (!type.signature(image)) return error(400, 'The image content does not match its file type');

        const avatarKey = `avatars/${user.id}/${id('img')}.${type.extension}`;
        await s3.send(new PutObjectCommand({
          Bucket: photosBucket,
          Key: avatarKey,
          Body: image,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }));
        await dynamo.update({
          TableName: usersTable,
          Key: { id: user.id },
          UpdateExpression: 'SET avatar_key = :key REMOVE avatar_url',
          ExpressionAttributeValues: { ':key': avatarKey },
        });
        if (user.avatar_key) {
          await s3.send(new DeleteObjectCommand({ Bucket: photosBucket, Key: user.avatar_key }));
        }
      } else {
        if (user.avatar_key) {
          await s3.send(new DeleteObjectCommand({ Bucket: photosBucket, Key: user.avatar_key }));
        }
        await dynamo.update({
          TableName: usersTable,
          Key: { id: user.id },
          UpdateExpression: 'REMOVE avatar_key, avatar_url',
        });
      }

      const updatedUser = await dynamo.get(usersTable, { id: user.id });
      let wallet = null;
      if (walletsTable) wallet = await dynamo.get(walletsTable, { user_id: user.id });
      return json(200, { user: sanitizeUser(updatedUser, wallet) });
    }

    // -------------------------------------------------------------
    // POST /api/uploads: issue a short-lived S3 upload URL or store a small legacy upload
    // -------------------------------------------------------------
    if (path.endsWith('/api/uploads') && method === 'POST') {
      const user = await requireUser(event);
      if (!photosBucket) return error(503, 'Media storage is not configured');

      const contentType = (event.headers?.['content-type'] || event.headers?.['Content-Type'] || '')
        .split(';')[0].trim().toLowerCase();

      if (contentType === 'application/json') {
        const body = parseBody(event);
        const requestedType = String(body.contentType || '').split(';')[0].trim().toLowerCase();
        const type = MEDIA_TYPES[requestedType];
        const size = Number(body.size);
        if (!type) return error(400, 'Unsupported media type');
        if (!Number.isSafeInteger(size) || size < 1) return error(400, 'A valid media size is required');
        if (size > MEDIA_MAX_BYTES) return error(413, 'Media must be 60 MB or smaller');

        const key = `uploads/${user.id}/${id('media')}.${type.extension}`;
        const uploadUrl = await getSignedUrl(
          s3,
          new PutObjectCommand({ Bucket: photosBucket, Key: key, ContentType: requestedType, ContentLength: size }),
          { expiresIn: 300 },
        );
        return json(200, { key, uploadUrl });
      }

      const mediaType = MEDIA_TYPES[contentType];
      if (!mediaType) return error(400, 'Choose a JPEG, PNG, WebP, MP4, MOV or WebM file');
      if (!event.body) return error(400, 'A media file is required');
      if (event.isBase64Encoded && event.body.length > Math.ceil(DIRECT_MEDIA_MAX_BYTES * 4 / 3)) {
        return error(413, 'Direct uploads must be 8 MB or smaller; request an upload URL for larger files');
      }
      const media = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');
      if (media.length === 0) return error(400, 'A media file is required');
      if (media.length > DIRECT_MEDIA_MAX_BYTES) {
        return error(413, 'Direct uploads must be 8 MB or smaller; request an upload URL for larger files');
      }
      if (!mediaType.signature(media)) return error(400, 'The file content does not match its media type');

      const key = `uploads/${user.id}/${id('media')}.${mediaType.extension}`;
      await s3.send(new PutObjectCommand({
        Bucket: photosBucket,
        Key: key,
        Body: media,
        ContentType: contentType,
      }));
      return json(201, { key });
    }

    // -------------------------------------------------------------
    // POST /api/auth/forgot  — send a 6-digit reset code via email
    // -------------------------------------------------------------
    if (path.endsWith('/api/auth/forgot') && method === 'POST') {
      const body = parseBody(event);
      const email = (body.email || '').trim().toLowerCase();
      if (!email) return error(400, 'Email is required');

      // Always respond success to prevent user enumeration
      const res = await dynamo.query({
        TableName: usersTable,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        Limit: 1,
      });

      if (res.items.length > 0) {
        const user = res.items[0];
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Math.floor(Date.now() / 1000) + 15 * 60; // 15 minutes

        // Store the reset code on the user record
        await dynamo.update({
          TableName: usersTable,
          Key: { id: user.id },
          UpdateExpression: 'SET reset_code = :code, reset_expires = :exp',
          ExpressionAttributeValues: { ':code': code, ':exp': expires },
        });

        // TODO: Send email via SES. For now, log the code (dev only).
        console.log(`[DEV] Password reset code for ${email}: ${code}`);
      }

      return json(200, { message: 'If the account exists, a reset code has been sent to its email address.' });
    }

    // -------------------------------------------------------------
    // POST /api/auth/reset  — verify code and set new password
    // -------------------------------------------------------------
    if (path.endsWith('/api/auth/reset') && method === 'POST') {
      const body = parseBody(event);
      const email = (body.email || '').trim().toLowerCase();
      const code = (body.code || '').trim();
      const password = body.password || '';

      if (!email || !code || !password) return error(400, 'Email, code and new password are required');
      if (password.length < 8) return error(400, 'Password must be at least 8 characters');

      const res = await dynamo.query({
        TableName: usersTable,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        Limit: 1,
      });

      if (res.items.length === 0) return error(400, 'Invalid or expired reset code');

      const user = res.items[0];
      const nowTs = Math.floor(Date.now() / 1000);

      if (!user.reset_code || user.reset_code !== code || !user.reset_expires || user.reset_expires < nowTs) {
        return error(400, 'Invalid or expired reset code');
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);

      await dynamo.update({
        TableName: usersTable,
        Key: { id: user.id },
        UpdateExpression: 'SET password_hash = :hash, password_salt = :salt, updated_at = :ts REMOVE reset_code, reset_expires',
        ExpressionAttributeValues: {
          ':hash': passwordHash,
          ':salt': salt,
          ':ts': now(),
        },
      });

      const token = await createSession(user.id, sessionsTable);
      let wallet = null;
      if (walletsTable) wallet = await dynamo.get(walletsTable, { user_id: user.id });

      return json(200, { token, user: sanitizeUser(user, wallet) });
    }

    // -------------------------------------------------------------
    // POST /api/me/password  — change password (must know current)
    // -------------------------------------------------------------
    if (path.endsWith('/api/me/password') && method === 'POST') {
      const user = await requireUser(event);
      const body = parseBody(event);
      const current = body.current || '';
      const password = body.password || '';

      if (!current || !password) return error(400, 'Current and new password are required');
      if (password.length < 8) return error(400, 'New password must be at least 8 characters');

      const fullUser = await dynamo.get(usersTable, { id: user.id });
      if (!fullUser.password_hash || !fullUser.password_salt) {
        return error(400, 'Account uses Google sign-in — no password to change');
      }

      const valid = verifyPassword(current, fullUser.password_hash, fullUser.password_salt);
      if (!valid) return error(401, 'Current password is incorrect');

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);

      await dynamo.update({
        TableName: usersTable,
        Key: { id: user.id },
        UpdateExpression: 'SET password_hash = :hash, password_salt = :salt, updated_at = :ts',
        ExpressionAttributeValues: { ':hash': passwordHash, ':salt': salt, ':ts': now() },
      });

      return json(200, { message: 'Password changed successfully' });
    }

    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Auth handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
};
