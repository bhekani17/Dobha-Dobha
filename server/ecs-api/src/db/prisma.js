'use strict';

const { Pool } = require('pg');
const { loadConfig } = require('../config');

async function createDatabase(config = loadConfig()) {
  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import('@prisma/adapter-pg'),
    import('../generated/prisma/client.ts'),
  ]);
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
