'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { createDatabase } = require('../src/db/prisma');

describe('Prisma client initialization', () => {
  it('loads the generated Prisma 7 client and PostgreSQL adapter', async () => {
    const { pool, prisma } = await createDatabase({
      databaseUrl: 'postgresql://localhost:5432/dobha',
      dbPoolMax: 1,
      dbConnectionTimeoutMs: 100,
      dbIdleTimeoutMs: 100,
      nodeEnv: 'test',
    });

    try {
      assert.equal(typeof prisma.$queryRaw, 'function');
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  });
});
