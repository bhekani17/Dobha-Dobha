'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { Prisma } = require('@prisma/client');
const { createEscrowService, EscrowServiceError } = require('../src/modules/escrow/escrow.service');

describe('escrow idempotency and transaction boundaries', () => {
  it('returns an idempotent result only to the original actor', async () => {
    const escrow = {
      id: 'escrow-1',
      orderId: 'order-1',
      status: 'HELD',
    };
    const prior = {
      action: 'FUND',
      actorUserId: 'buyer-1',
      escrowId: escrow.id,
      escrow,
    };
    const prisma = {
      escrowTransition: {
        findUnique: async () => prior,
      },
      $transaction: async () => {
        throw new Error('The idempotent result should not start a new transaction');
      },
    };
    const service = createEscrowService(prisma);

    assert.deepEqual(
      await service.fundOrder({
        orderId: 'order-1',
        buyerId: 'buyer-1',
        idempotencyKey: 'fund-order-1',
      }),
      escrow,
    );
    await assert.rejects(
      service.fundOrder({
        orderId: 'order-1',
        buyerId: 'buyer-2',
        idempotencyKey: 'fund-order-1',
      }),
      (error) => error instanceof EscrowServiceError && error.code === 'IDEMPOTENCY_KEY_REUSED',
    );
  });

  it('runs order funding inside a serializable database transaction', async () => {
    const sentinel = new Error('stop after transaction boundary check');
    let transactionOptions;
    const prisma = {
      escrowTransition: {
        findUnique: async () => null,
      },
      $transaction: async (_work, options) => {
        transactionOptions = options;
        throw sentinel;
      },
    };
    const service = createEscrowService(prisma);

    await assert.rejects(
      service.fundOrder({
        orderId: 'order-1',
        buyerId: 'buyer-1',
        idempotencyKey: 'fund-order-1',
      }),
      sentinel,
    );
    assert.equal(
      transactionOptions.isolationLevel,
      Prisma.TransactionIsolationLevel.Serializable,
    );
  });

  it('retries serialization conflicts with the same idempotency key', async () => {
    const result = { id: 'escrow-1', orderId: 'order-1', status: 'HELD' };
    let attempts = 0;
    const prisma = {
      escrowTransition: {
        findUnique: async () => null,
      },
      $transaction: async () => {
        attempts += 1;
        if (attempts < 3) {
          const conflict = new Error('serialization conflict');
          conflict.code = 'P2034';
          throw conflict;
        }
        return result;
      },
    };
    const service = createEscrowService(prisma);

    assert.deepEqual(
      await service.fundOrder({
        orderId: 'order-1',
        buyerId: 'buyer-1',
        idempotencyKey: 'fund-order-1',
      }),
      result,
    );
    assert.equal(attempts, 3);
  });
});
