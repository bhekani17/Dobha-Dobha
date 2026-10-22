'use strict';

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({});
const baseUrl = 'https://api.escrow-sandbox.com/2017-09-01';
let cachedCredentials;
let cachedSecretArn;
let cachedAt = 0;

function isEscrowSandboxEnabled(env = process.env) {
  return env.STAGE === 'dev' && env.ESCROW_SANDBOX_ENABLED === 'true';
}

async function getCredentials(env = process.env) {
  if (!isEscrowSandboxEnabled(env)) {
    throw new Error('Escrow sandbox is not enabled for this environment');
  }
  if (!env.ESCROW_SECRET_ARN) {
    throw new Error('ESCROW_SECRET_ARN is required for Escrow sandbox');
  }
  if (
    !cachedCredentials ||
    cachedSecretArn !== env.ESCROW_SECRET_ARN ||
    Date.now() - cachedAt > 300_000
  ) {
    const secret = await secretsClient.send(new GetSecretValueCommand({
      SecretId: env.ESCROW_SECRET_ARN,
    }));
    if (!secret.SecretString) throw new Error('Escrow sandbox secret has no SecretString');
    const credentials = JSON.parse(secret.SecretString);
    for (const key of ['email', 'apiKey']) {
      if (typeof credentials[key] !== 'string' || !credentials[key]) {
        throw new Error(`Escrow sandbox secret is missing ${key}`);
      }
    }
    cachedCredentials = credentials;
    cachedSecretArn = env.ESCROW_SECRET_ARN;
    cachedAt = Date.now();
  }
  return cachedCredentials;
}

async function request(path, credentials, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.email}:${credentials.apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  const responseText = await response.text();
  let body;
  try {
    body = responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new Error('Escrow sandbox returned an invalid response');
  }
  if (!response.ok) {
    const error = new Error(`Escrow sandbox request failed with HTTP ${response.status}`);
    error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
    throw error;
  }
  return body;
}

async function createTransaction({ credentials, order, buyerEmail, sellerEmail }, fetchImpl) {
  if (!Number.isSafeInteger(order.total_cents) || order.total_cents <= 0) {
    throw new Error('A valid order total is required for Escrow sandbox');
  }
  if (!buyerEmail || !sellerEmail || buyerEmail === sellerEmail) {
    throw new Error('Distinct buyer and seller emails are required for Escrow sandbox');
  }
  const transaction = await request('/transaction', credentials, {
    method: 'POST',
    body: JSON.stringify({
      parties: [
        { role: 'buyer', customer: buyerEmail },
        { role: 'seller', customer: sellerEmail },
      ],
      currency: 'zar',
      description: `Dobha sandbox order ${order.id}`,
      items: [{
        title: String(order.item_title || 'Dobha item').slice(0, 100),
        description: `Test-only Dobha marketplace transaction ${order.id}`,
        type: 'general_merchandise',
        inspection_period: 86400,
        quantity: 1,
        schedule: [{
          amount: (order.total_cents / 100).toFixed(2),
          payer_customer: buyerEmail,
          beneficiary_customer: sellerEmail,
        }],
      }],
    }),
  }, fetchImpl);
  if (!transaction || !/^\d+$/.test(String(transaction.id))) {
    throw new Error('Escrow sandbox response did not include a transaction ID');
  }
  return transaction;
}

async function getTransaction(transactionId, credentials, fetchImpl) {
  if (!/^\d+$/.test(String(transactionId))) {
    throw new Error('A valid Escrow transaction ID is required');
  }
  return request(`/transaction/${encodeURIComponent(transactionId)}`, credentials, {
    method: 'GET',
  }, fetchImpl);
}

function isTransactionSecured(transaction) {
  const schedules = (transaction?.items || []).flatMap((item) => item.schedule || []);
  return schedules.length > 0 && schedules.every((schedule) => schedule.status?.secured === true);
}

function matchesOrder(transaction, order) {
  if (
    String(transaction?.currency || '').toLowerCase() !== 'zar' ||
    !Array.isArray(transaction.parties) ||
    !Array.isArray(transaction.items)
  ) {
    return false;
  }
  const buyer = transaction.parties.find((party) => party.role === 'buyer')?.customer;
  const seller = transaction.parties.find((party) => party.role === 'seller')?.customer;
  const schedules = transaction.items.flatMap((item) => item.schedule || []);
  return (
    String(buyer || '').toLowerCase() === String(order.buyer_email || '').toLowerCase() &&
    String(seller || '').toLowerCase() === String(order.seller_email || '').toLowerCase() &&
    schedules.length === 1 &&
    Number(schedules[0].amount).toFixed(2) === (order.total_cents / 100).toFixed(2) &&
    String(schedules[0].payer_customer || '').toLowerCase() === String(order.buyer_email || '').toLowerCase() &&
    String(schedules[0].beneficiary_customer || '').toLowerCase() === String(order.seller_email || '').toLowerCase()
  );
}

function resetCredentialCacheForTests() {
  cachedCredentials = undefined;
  cachedSecretArn = undefined;
  cachedAt = 0;
}

module.exports = {
  createTransaction,
  getCredentials,
  getTransaction,
  isEscrowSandboxEnabled,
  matchesOrder,
  isTransactionSecured,
  resetCredentialCacheForTests,
};
