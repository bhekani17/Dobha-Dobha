const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error('DATABASE_URL must be configured before the server starts');
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  // Neon connection pooling optimization
  ...(process.env.DATABASE_URL?.includes('pgbouncer=true') ? {
    // Use connection timeout for pooled connections
    connectionLimit: 1,
  } : {})
});

module.exports = { prisma };
