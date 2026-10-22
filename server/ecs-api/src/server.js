'use strict';

const { buildApp } = require('./app');
const { loadConfig } = require('./config');
const { createDatabase } = require('./db/prisma');

async function start() {
  const config = loadConfig();
  const { pool, prisma } = await createDatabase(config);
  const app = buildApp({ database: prisma });
  let stopping = false;

  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    app.log.info({ signal }, 'Shutting down API');
    const cleanup = [
      ['Fastify', () => app.close()],
      ['Prisma', () => prisma.$disconnect()],
      ['PostgreSQL pool', () => pool.end()],
    ];
    for (const [resource, close] of cleanup) {
      try {
        await close();
      } catch (error) {
        app.log.error({ err: error, resource }, 'API shutdown failed');
        process.exitCode = 1;
      }
    }
  }

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error({ err: error }, 'API startup failed');
    await shutdown('startup failure');
    process.exitCode = 1;
  }
}

start().catch((error) => {
  console.error('API configuration or initialization failed', error);
  process.exitCode = 1;
});
