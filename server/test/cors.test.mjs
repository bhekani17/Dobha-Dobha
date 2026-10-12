import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCors } from '../src/cors.mjs';
import { listItems } from '../src/items.js';

const preflight = (origin, allowedOrigins) => applyCors(
  new Request('https://api.example/api/items', {
    method: 'OPTIONS',
    headers: {
      ...(origin ? { Origin: origin } : {}),
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  }),
  { ALLOWED_WEB_ORIGINS: allowedOrigins },
  new Response(null, { status: 204 }),
);

test('preflight allows only an explicitly configured website origin', async () => {
  const response = await preflight('https://market.example', 'https://market.example,https://preview.example');

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://market.example');
  assert.match(response.headers.get('access-control-allow-methods'), /POST/);
  assert.match(response.headers.get('access-control-allow-headers'), /Authorization/);
});

test('preflight rejects unconfigured origins', async () => {
  const response = await preflight('https://attacker.example', 'https://market.example');

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('preflight does not grant access when the allowlist is empty', async () => {
  const response = await preflight('https://market.example', '');

  assert.equal(response.status, 403);
});

test('public marketplace browsing supports general categories and offset pagination', async () => {
  let query;
  let bindings;
  const env = {
    DB: {
      prepare(sql) {
        query = sql;
        return {
          bind(...args) {
            bindings = args;
            return this;
          },
          async all() {
            return { results: [] };
          },
        };
      },
    },
  };
  const response = await listItems(
    new Request('https://api.example/api/items?category=Electronics&limit=40&offset=40'),
    env,
  );

  assert.match(query, /LIMIT \?3 OFFSET \?4/);
  assert.match(query, /i\.category = \?5/);
  assert.deepEqual(bindings, [null, Number.MAX_SAFE_INTEGER, 41, 40, 'Electronics']);
  assert.deepEqual(await response.json(), { items: [], nextCursor: null });
});
