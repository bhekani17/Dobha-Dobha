import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createTransaction,
  getTransaction,
  isEscrowSandboxEnabled,
  isTransactionSecured,
  matchesOrder,
} = require('../src/orders/escrow.js');

const credentials = { email: 'partner@example.test', apiKey: 'sandbox-api-key' };
const order = { id: 'ord_test', item_title: 'Test item', total_cents: 12500 };

describe('Escrow sandbox helper', () => {
  it('only enables in dev with explicit opt-in', () => {
    assert.equal(isEscrowSandboxEnabled({ STAGE: 'dev', ESCROW_SANDBOX_ENABLED: 'true' }), true);
    assert.equal(isEscrowSandboxEnabled({ STAGE: 'prod', ESCROW_SANDBOX_ENABLED: 'true' }), false);
    assert.equal(isEscrowSandboxEnabled({ STAGE: 'dev', ESCROW_SANDBOX_ENABLED: 'false' }), false);
  });

  it('creates a ZAR test transaction using the fixed Escrow sandbox host', async () => {
    const transaction = await createTransaction({
      credentials,
      order,
      buyerEmail: 'buyer@example.test',
      sellerEmail: 'seller@example.test',
    }, async (url, options) => {
      assert.equal(url, 'https://api.escrow-sandbox.com/2017-09-01/transaction');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, `Basic ${Buffer.from('partner@example.test:sandbox-api-key').toString('base64')}`);
      const body = JSON.parse(options.body);
      assert.equal(body.currency, 'zar');
      assert.equal(body.items[0].schedule[0].amount, '125.00');
      assert.equal(body.items[0].schedule[0].payer_customer, 'buyer@example.test');
      assert.equal(body.items[0].schedule[0].beneficiary_customer, 'seller@example.test');
      return { ok: true, text: async () => JSON.stringify({ id: 12345 }) };
    });
    assert.equal(transaction.id, 12345);
  });

  it('fetches transaction status from the sandbox and only recognizes secured schedules', async () => {
    const transaction = await getTransaction('12345', credentials, async (url, options) => {
      assert.equal(url, 'https://api.escrow-sandbox.com/2017-09-01/transaction/12345');
      assert.equal(options.method, 'GET');
      return {
        ok: true,
        text: async () => JSON.stringify({
          id: 12345,
          items: [{ schedule: [{ status: { secured: true } }] }],
        }),
      };
    });
    assert.equal(isTransactionSecured(transaction), true);
    assert.equal(isTransactionSecured({ items: [{ schedule: [{ status: { secured: false } }] }] }), false);
    assert.equal(isTransactionSecured({ items: [] }), false);
  });

  it('matches Escrow status to the order currency, parties, and exact amount', () => {
    const transaction = {
      currency: 'ZAR',
      parties: [
        { role: 'buyer', customer: 'buyer@example.test' },
        { role: 'seller', customer: 'seller@example.test' },
      ],
      items: [{
        schedule: [{
          amount: '125.00',
          payer_customer: 'buyer@example.test',
          beneficiary_customer: 'seller@example.test',
          status: { secured: true },
        }],
      }],
    };
    assert.equal(matchesOrder(transaction, {
      ...order,
      buyer_email: 'buyer@example.test',
      seller_email: 'seller@example.test',
    }), true);
    assert.equal(matchesOrder(transaction, {
      ...order,
      buyer_email: 'other@example.test',
      seller_email: 'seller@example.test',
    }), false);
  });
});
