'use strict';

const fs = require('node:fs');

function positiveInteger(value, name, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function loadConfig(env = process.env) {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  let parsedDatabaseUrl;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol');
  }

  const nodeEnv = env.NODE_ENV || 'development';
  let databaseCa;
  if (nodeEnv === 'production') {
    if (!env.DATABASE_CA_CERT_PATH) {
      throw new Error('DATABASE_CA_CERT_PATH is required in production');
    }
    databaseCa = fs.readFileSync(env.DATABASE_CA_CERT_PATH, 'utf8');
  }

  return {
    databaseUrl,
    databaseCa,
    dbPoolMax: positiveInteger(env.DB_POOL_MAX, 'DB_POOL_MAX', 5),
    dbConnectionTimeoutMs: positiveInteger(
      env.DB_CONNECTION_TIMEOUT_MS,
      'DB_CONNECTION_TIMEOUT_MS',
      5000,
    ),
    dbIdleTimeoutMs: positiveInteger(env.DB_IDLE_TIMEOUT_MS, 'DB_IDLE_TIMEOUT_MS', 10000),
    host: env.HOST || '0.0.0.0',
    nodeEnv,
    port: positiveInteger(env.PORT, 'PORT', 3000),
  };
}

module.exports = { loadConfig };
