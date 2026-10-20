'use strict';

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { loadConfig } = require('../config');

function createDatabase(config = loadConfig()) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
    connectionTimeoutMillis: config.dbConnectionTimeoutMs,
    idleTimeoutMillis: config.dbIdleTimeoutMs,
    keepAlive: true,
    ...(config.databaseCa
      ? { ssl: { ca: config.databaseCa, rejectUnauthorized: true } }
      : {}),
    application_name: 'dobha-ecs-api',
  });

  pool.on('error', (error) => {
    console.error('Unexpected idle PostgreSQL client error', error);
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });

  return { pool, prisma };
}

module.exports = { createDatabase };
