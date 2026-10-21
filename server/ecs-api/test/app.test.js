'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { buildApp } = require('../src/app');

describe('API health endpoints', () => {
  it('requires a Prisma client', () => {
    assert.throws(
      () => buildApp({ logger: false }),
      /A Prisma database client is required/,
    );
    assert.throws(
      () => buildApp({ database: {}, logger: false }),
      /A Prisma database client is required/,
    );
  });

  it('reports process liveness without querying the database', async (t) => {
    let queries = 0;
    const app = buildApp({
      database: {
        async $queryRaw() {
          queries += 1;
        },
      },
      logger: false,
    });
    t.after(() => app.close());

    const response = await app.inject({ method: 'GET', url: '/healthz' });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok' });
    assert.equal(queries, 0);
  });

  it('reports readiness when the database query succeeds', async (t) => {
    let queryParts;
    const app = buildApp({
      database: {
        async $queryRaw(strings, ...values) {
          queryParts = { strings: [...strings], values };
        },
      },
      logger: false,
    });
    t.after(() => app.close());

    const response = await app.inject({ method: 'GET', url: '/readyz' });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ready' });
    assert.deepEqual(queryParts, { strings: ['SELECT 1'], values: [] });
  });

  it('reports not-ready when the database query fails', async (t) => {
    const app = buildApp({
      database: {
        async $queryRaw() {
          throw new Error('database unavailable');
        },
      },
      logger: false,
    });
    t.after(() => app.close());

    const response = await app.inject({ method: 'GET', url: '/readyz' });

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { status: 'not_ready' });
  });
});
