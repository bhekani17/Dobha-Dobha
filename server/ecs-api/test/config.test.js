'use strict';

const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');
const { loadConfig } = require('../src/config');

const validEnvironment = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/dobha',
};

describe('API configuration', () => {
  it('requires a PostgreSQL connection URL', () => {
    assert.throws(() => loadConfig({}), /DATABASE_URL is required/);
    assert.throws(
      () => loadConfig({ DATABASE_URL: 'not a url' }),
      /DATABASE_URL must be a valid PostgreSQL connection URL/,
    );
    assert.throws(
      () => loadConfig({ DATABASE_URL: 'https://example.com/database' }),
      /DATABASE_URL must use the postgres or postgresql protocol/,
    );
  });

  it('uses defaults and parses explicit positive integer settings', () => {
    assert.deepEqual(loadConfig(validEnvironment), {
      databaseUrl: validEnvironment.DATABASE_URL,
      databaseCa: undefined,
      dbPoolMax: 5,
      dbConnectionTimeoutMs: 5000,
      dbIdleTimeoutMs: 10000,
      host: '0.0.0.0',
      nodeEnv: 'development',
      port: 3000,
    });

    assert.deepEqual(
      loadConfig({
        ...validEnvironment,
        DB_POOL_MAX: '12',
        DB_CONNECTION_TIMEOUT_MS: '2500',
        DB_IDLE_TIMEOUT_MS: '15000',
        HOST: '127.0.0.1',
        NODE_ENV: 'test',
        PORT: '8080',
      }),
      {
        databaseUrl: validEnvironment.DATABASE_URL,
        databaseCa: undefined,
        dbPoolMax: 12,
        dbConnectionTimeoutMs: 2500,
        dbIdleTimeoutMs: 15000,
        host: '127.0.0.1',
        nodeEnv: 'test',
        port: 8080,
      },
    );
  });

  it('rejects invalid integer settings', () => {
    for (const [name, value] of [
      ['DB_POOL_MAX', '0'],
      ['DB_CONNECTION_TIMEOUT_MS', '-1'],
      ['DB_IDLE_TIMEOUT_MS', '1.5'],
      ['PORT', '9007199254740992'],
    ]) {
      assert.throws(
        () => loadConfig({ ...validEnvironment, [name]: value }),
        new RegExp(`${name} must be a positive integer`),
      );
    }
  });

  it('requires and loads a CA certificate in production', async (t) => {
    assert.throws(
      () => loadConfig({ ...validEnvironment, NODE_ENV: 'production' }),
      /DATABASE_CA_CERT_PATH is required in production/,
    );

    const directory = await mkdtemp(path.join(os.tmpdir(), 'dobha-ecs-api-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const caPath = path.join(directory, 'rds-ca.pem');
    await writeFile(caPath, 'trusted test CA');

    const config = loadConfig({
      ...validEnvironment,
      NODE_ENV: 'production',
      DATABASE_CA_CERT_PATH: caPath,
    });
    assert.equal(config.databaseCa, await readFile(caPath, 'utf8'));
  });
});
