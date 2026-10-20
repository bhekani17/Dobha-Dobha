'use strict';

const Fastify = require('fastify');

function buildApp({ database, logger = true } = {}) {
  if (!database || typeof database.$queryRaw !== 'function') {
    throw new Error('A Prisma database client is required');
  }

  const app = Fastify({ logger, trustProxy: true });

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (request, reply) => {
    try {
      await database.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch (error) {
      request.log.error({ err: error }, 'Database readiness check failed');
      return reply.code(503).send({ status: 'not_ready' });
    }
  });

  return app;
}

module.exports = { buildApp };
