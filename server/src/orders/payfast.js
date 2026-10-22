'use strict';

const crypto = require('node:crypto');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({});
let cachedCredentials;
let cachedSecretArn;
let cachedAt = 0;

function isPayFastSandboxEnabled(env = process.env) {
  return env.STAGE === 'dev' && env.PAYFAST_SANDBOX_ENABLED === 'true';
}

async function getCredentials(env = process.env) {
  if (!isPayFastSandboxEnabled(env)) {
    throw new Error('PayFast sandbox is not enabled for this environment');
  }
  if (!env.PAYFAST_SECRET_ARN) {
    throw new Error('PAYFAST_SECRET_ARN is required for the PayFast sandbox');
  }
  if (
    !cachedCredentials ||
    cachedSecretArn !== env.PAYFAST_SECRET_ARN ||
    Date.now() - cachedAt > 300_000
  ) {
    const secret = await secretsClient.send(new GetSecretValueCommand({
      SecretId: env.PAYFAST_SECRET_ARN,
    }));
    if (!secret.SecretString) throw new Error('PayFast sandbox secret has no SecretString');
    const credentials = JSON.parse(secret.SecretString);
    for (const key of ['merchantId', 'merchantKey', 'passphrase']) {
      if (typeof credentials[key] !== 'string' || !credentials[key]) {
        throw new Error(`PayFast sandbox secret is missing ${key}`);
      }
    }
    cachedCredentials = credentials;
    cachedSecretArn = env.PAYFAST_SECRET_ARN;
    cachedAt = Date.now();
  }
  return cachedCredentials;
}

function signatureFor(fields, passphrase) {
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (key !== 'signature' && value !== '') values.append(key, String(value).trim());
  }
  if (passphrase) values.append('passphrase', passphrase.trim());
  return crypto.createHash('md5').update(values.toString()).digest('hex');
}

function parseItnBody(event) {
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';
  const params = new URLSearchParams(rawBody);
  const fields = {};
  for (const [key, value] of params) {
    if (Object.hasOwn(fields, key)) throw new Error('Duplicate PayFast ITN field');
    fields[key] = value;
  }
  return { rawBody, fields };
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function validateItn(event, credentials, fetchImpl = fetch) {
  const { rawBody, fields } = parseItnBody(event);
  if (!fields.signature || !constantTimeEqual(
    signatureFor(fields, credentials.passphrase),
    fields.signature,
  )) {
    return { valid: false, fields };
  }

  const endpoint = new URL('https://sandbox.payfast.co.za/eng/query/validate');
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: rawBody,
    signal: AbortSignal.timeout(5000),
  });
  const confirmation = (await response.text()).trim();
  return { valid: response.ok && confirmation === 'VALID', fields };
}

function buildCheckoutFields({ credentials, order, siteUrl, apiUrl }) {
  const site = new URL(siteUrl);
  const api = new URL(apiUrl);
  if (site.protocol !== 'https:' || api.protocol !== 'https:') {
    throw new Error('PayFast sandbox callback URLs must use HTTPS');
  }
  if (site.username || site.password || site.search || site.hash || api.username || api.password || api.search || api.hash) {
    throw new Error('PayFast sandbox callback URLs must not contain credentials, a query, or a fragment');
  }
  if (!Number.isSafeInteger(order.total_cents) || order.total_cents <= 0) {
    throw new Error('A valid order total is required for PayFast sandbox checkout');
  }
  const fields = {
    merchant_id: credentials.merchantId,
    merchant_key: credentials.merchantKey,
    return_url: `${site.origin}${site.pathname.replace(/\/+$/, '')}/#orders`,
    cancel_url: `${site.origin}${site.pathname.replace(/\/+$/, '')}/#orders`,
    notify_url: `${api.origin}${api.pathname.replace(/\/+$/, '')}/api/payments/payfast/itn`,
    m_payment_id: order.id,
    amount: (order.total_cents / 100).toFixed(2),
    item_name: order.item_title.slice(0, 100),
    item_description: `Dobha sandbox order ${order.id}`.slice(0, 255),
  };
  return {
    url: 'https://sandbox.payfast.co.za/eng/process',
    fields: { ...fields, signature: signatureFor(fields, credentials.passphrase) },
  };
}

function resetCredentialCacheForTests() {
  cachedCredentials = undefined;
  cachedSecretArn = undefined;
  cachedAt = 0;
}

module.exports = {
  buildCheckoutFields,
  constantTimeEqual,
  getCredentials,
  isPayFastSandboxEnabled,
  parseItnBody,
  resetCredentialCacheForTests,
  signatureFor,
  validateItn,
};
