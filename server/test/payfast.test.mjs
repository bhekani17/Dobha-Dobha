import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildCheckoutFields,
  parseItnBody,
  signatureFor,
  validateItn,
} = require('../src/orders/payfast.js');

const credentials = {
  merchantId: '10000100',
  merchantKey: 'sandbox-key',
  passphrase: 'test-passphrase',
};

describe('PayFast sandbox helper', () => {
  it('signs hosted checkout fields and excludes the signature field itself', () => {
    const checkout = buildCheckoutFields({
      credentials,
      order: { id: 'ord_test', item_title: 'Test item', total_cents: 12500 },
      siteUrl: 'https://dev.example.test/',
      apiUrl: 'https://api.example.test/dev/',
    });

    assert.equal(checkout.url, 'https://sandbox.payfast.co.za/eng/process');
    assert.equal(checkout.fields.amount, '125.00');
    assert.equal(checkout.fields.notify_url, 'https://api.example.test/dev/api/payments/payfast/itn');
    assert.equal(
      checkout.fields.signature,
      signatureFor(Object.fromEntries(Object.entries(checkout.fields).filter(([key]) => key !== 'signature')), credentials.passphrase),
    );
    assert.equal(checkout.fields.merchant_key, credentials.merchantKey);
    assert.equal(typeof checkout.fields.signature, 'string');
  });

  it('rejects insecure callback URLs and invalid totals', () => {
    assert.throws(() => buildCheckoutFields({
      credentials,
      order: { id: 'ord_test', item_title: 'Test item', total_cents: 100 },
      siteUrl: 'http://dev.example.test',
      apiUrl: 'https://api.example.test/dev',
    }), /must use HTTPS/);
    assert.throws(() => buildCheckoutFields({
      credentials,
      order: { id: 'ord_test', item_title: 'Test item', total_cents: 0 },
      siteUrl: 'https://dev.example.test',
      apiUrl: 'https://api.example.test/dev',
    }), /valid order total/);
  });

  it('rejects duplicate fields and verifies the raw ITN using the provider validator', async () => {
    assert.throws(() => parseItnBody({ body: 'payment_status=COMPLETE&payment_status=FAILED' }), /Duplicate/);

    const fields = {
      merchant_id: credentials.merchantId,
      m_payment_id: 'ord_test',
      payment_status: 'COMPLETE',
    };
    const signedFields = { ...fields, signature: signatureFor(fields, credentials.passphrase) };
    const rawBody = new URLSearchParams(signedFields).toString();
    const response = await validateItn(
      { body: rawBody },
      credentials,
      async (url, options) => {
        assert.equal(url.href, 'https://sandbox.payfast.co.za/eng/query/validate');
        assert.equal(options.body, rawBody);
        return { ok: true, text: async () => 'VALID' };
      },
    );

    assert.equal(response.valid, true);
    const invalid = await validateItn(
      { body: new URLSearchParams({ ...signedFields, signature: 'bad' }).toString() },
      credentials,
      async () => {
        throw new Error('Provider validation must not run for a bad signature');
      },
    );
    assert.equal(invalid.valid, false);
  });
});
