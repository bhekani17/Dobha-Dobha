'use strict';

const ALLOWED_TRANSITIONS = Object.freeze({
  PENDING: new Set(['HELD']),
  HELD: new Set(['DISPUTED', 'RELEASED', 'REFUNDED']),
  DISPUTED: new Set(['RELEASED', 'REFUNDED']),
  RELEASED: new Set(),
  REFUNDED: new Set(),
});

const ACTION_TARGET = Object.freeze({
  FUND: 'HELD',
  DISPUTE: 'DISPUTED',
  RELEASE: 'RELEASED',
  REFUND: 'REFUNDED',
});
const SERIALIZATION_RETRIES = 3;

class EscrowServiceError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.name = 'EscrowServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function invalid(code, message, statusCode) {
  throw new EscrowServiceError(code, message, statusCode);
}

function validateIdempotencyKey(key) {
  if (typeof key !== 'string' || key.length < 8 || key.length > 128) {
    invalid('INVALID_IDEMPOTENCY_KEY', 'A valid idempotency key is required', 400);
  }
}

function assertTransition(fromStatus, toStatus) {
  if (!ALLOWED_TRANSITIONS[fromStatus]?.has(toStatus)) {
    invalid(
      'INVALID_ESCROW_TRANSITION',
      `Escrow cannot transition from ${fromStatus} to ${toStatus}`,
      409,
    );
  }
}

function verifyExistingTransition(transition, {
  action,
  orderId,
  escrowId,
  actorUserId,
}) {
  if (!transition) return null;
  if (
    transition.action !== action ||
    transition.actorUserId !== actorUserId ||
    (orderId && transition.escrow.orderId !== orderId) ||
    (escrowId && transition.escrowId !== escrowId)
  ) {
    invalid(
      'IDEMPOTENCY_KEY_REUSED',
      'The idempotency key was already used for a different escrow operation',
      409,
    );
  }
  return transition.escrow;
}

async function findPriorTransition(db, idempotencyKey, expected) {
  const transition = await db.escrowTransition.findUnique({
    where: { idempotencyKey },
    include: { escrow: true },
  });
  return verifyExistingTransition(transition, expected);
}

async function serializableTransaction(prisma, operation, idempotencyKey, expected) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (error?.code !== 'P2034' || attempt >= SERIALIZATION_RETRIES) throw error;
      const existing = await findPriorTransition(prisma, idempotencyKey, expected);
      if (existing) return existing;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}

async function recoverIdempotentResult(prisma, error, idempotencyKey, expected) {
  if (!['P2002', 'P2034'].includes(error?.code)) throw error;
  const existing = await findPriorTransition(prisma, idempotencyKey, expected);
  if (existing) return existing;
  throw error;
}

async function findAdminRole(tx, userId) {
  const role = await tx.userRole.findUnique({
    where: { userId_role: { userId, role: 'ADMIN' } },
  });
  return Boolean(role);
}

async function recordTransition(tx, {
  escrow,
  actorUserId,
  action,
  toStatus,
  idempotencyKey,
  ledgerEntries = [],
}) {
  assertTransition(escrow.status, toStatus);

  const updated = await tx.escrowTransaction.updateMany({
    where: { id: escrow.id, status: escrow.status },
    data: { status: toStatus },
  });
  if (updated.count !== 1) {
    invalid('ESCROW_STATE_CHANGED', 'Escrow state changed; reload and retry', 409);
  }

  const transition = await tx.escrowTransition.create({
    data: {
      escrowId: escrow.id,
      actorUserId,
      action,
      fromStatus: escrow.status,
      toStatus,
      idempotencyKey,
    },
  });

  if (ledgerEntries.length) {
    await tx.ledgerEntry.createMany({
      data: ledgerEntries.map((entry) => ({
        ...entry,
        escrowId: escrow.id,
        transitionId: transition.id,
      })),
    });
  }

  return transition;
}

function createEscrowService(prisma) {
  if (!prisma || typeof prisma.$transaction !== 'function') {
    throw new Error('A Prisma database client is required');
  }

  async function fundOrder({ orderId, buyerId, idempotencyKey }) {
    validateIdempotencyKey(idempotencyKey);
    const expected = { action: 'FUND', orderId, actorUserId: buyerId };
    const previous = await findPriorTransition(prisma, idempotencyKey, expected);
    if (previous) return previous;

    try {
      return await serializableTransaction(prisma, async (tx) => {
        const repeated = await findPriorTransition(tx, idempotencyKey, expected);
        if (repeated) return repeated;

        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (!order) invalid('ORDER_NOT_FOUND', 'Order was not found', 404);
        if (order.buyerId !== buyerId) {
          invalid('FORBIDDEN', 'Only the order buyer can fund escrow', 403);
        }
        if (order.status !== 'AWAITING_PAYMENT') {
          invalid('ORDER_NOT_PAYABLE', 'Order is not awaiting payment', 409);
        }
        if (order.amountCents <= 0n || order.buyerId === order.sellerId) {
          invalid('INVALID_ORDER', 'Order amount or parties are invalid', 409);
        }

        const buyerWallet = await tx.wallet.upsert({
          where: {
            userId_currency: { userId: order.buyerId, currency: order.currency },
          },
          create: { userId: order.buyerId, currency: order.currency },
          update: {},
        });
        const debited = await tx.wallet.updateMany({
          where: { id: buyerWallet.id, availableCents: { gte: order.amountCents } },
          data: {
            availableCents: { decrement: order.amountCents },
            heldCents: { increment: order.amountCents },
          },
        });
        if (debited.count !== 1) {
          invalid('INSUFFICIENT_FUNDS', 'Wallet has insufficient available funds', 409);
        }

        const escrow = await tx.escrowTransaction.create({
          data: {
            orderId: order.id,
            buyerId: order.buyerId,
            sellerId: order.sellerId,
            amountCents: order.amountCents,
            currency: order.currency,
          },
        });
        await recordTransition(tx, {
          escrow,
          actorUserId: buyerId,
          action: 'FUND',
          toStatus: ACTION_TARGET.FUND,
          idempotencyKey,
          ledgerEntries: [{
            walletId: buyerWallet.id,
            entryType: 'ESCROW_FUND',
            availableDeltaCents: -order.amountCents,
            heldDeltaCents: order.amountCents,
          }],
        });

        const orderUpdate = await tx.order.updateMany({
          where: { id: order.id, status: 'AWAITING_PAYMENT' },
          data: { status: 'PAID' },
        });
        if (orderUpdate.count !== 1) {
          invalid('ORDER_STATE_CHANGED', 'Order state changed; reload and retry', 409);
        }

        return { ...escrow, status: 'HELD' };
      }, idempotencyKey, expected);
    } catch (error) {
      if (error?.code === 'P2002') {
        const existing = await findPriorTransition(prisma, idempotencyKey, expected);
        if (existing) return existing;
        const fundedOrder = await prisma.escrowTransaction.findUnique({
          where: { orderId },
        });
        if (fundedOrder) {
          invalid('ORDER_ALREADY_FUNDED', 'Order already has an escrow transaction', 409);
        }
      }
      return recoverIdempotentResult(prisma, error, idempotencyKey, expected);
    }
  }

  async function disputeEscrow({ escrowId, actorUserId, idempotencyKey }) {
    validateIdempotencyKey(idempotencyKey);
    const expected = { action: 'DISPUTE', escrowId, actorUserId };
    const previous = await findPriorTransition(prisma, idempotencyKey, expected);
    if (previous) return previous;

    try {
      return await serializableTransaction(prisma, async (tx) => {
        const repeated = await findPriorTransition(tx, idempotencyKey, expected);
        if (repeated) return repeated;
        const escrow = await tx.escrowTransaction.findUnique({
          where: { id: escrowId },
          include: { order: true },
        });
        if (!escrow) invalid('ESCROW_NOT_FOUND', 'Escrow was not found', 404);
        if (
          escrow.buyerId !== actorUserId ||
          !['SHIPPED', 'DELIVERED'].includes(escrow.order.status)
        ) {
          invalid('FORBIDDEN', 'Only the buyer can dispute a shipped order', 403);
        }

        await recordTransition(tx, {
          escrow,
          actorUserId,
          action: 'DISPUTE',
          toStatus: ACTION_TARGET.DISPUTE,
          idempotencyKey,
        });
        return { ...escrow, status: 'DISPUTED' };
      }, idempotencyKey, expected);
    } catch (error) {
      return recoverIdempotentResult(prisma, error, idempotencyKey, expected);
    }
  }

  async function resolveEscrow({ escrowId, actorUserId, action, idempotencyKey }) {
    if (action !== 'RELEASE' && action !== 'REFUND') {
      invalid('INVALID_ESCROW_ACTION', 'Action must be RELEASE or REFUND', 400);
    }
    validateIdempotencyKey(idempotencyKey);
    const expected = { action, escrowId, actorUserId };
    const previous = await findPriorTransition(prisma, idempotencyKey, expected);
    if (previous) return previous;
    const toStatus = ACTION_TARGET[action];

    try {
      return await serializableTransaction(prisma, async (tx) => {
        const repeated = await findPriorTransition(tx, idempotencyKey, expected);
        if (repeated) return repeated;
        const escrow = await tx.escrowTransaction.findUnique({
          where: { id: escrowId },
          include: { order: true },
        });
        if (!escrow) invalid('ESCROW_NOT_FOUND', 'Escrow was not found', 404);

        const isAdmin = await findAdminRole(tx, actorUserId);
        const buyerMayRelease =
          action === 'RELEASE' &&
          escrow.status === 'HELD' &&
          actorUserId === escrow.buyerId &&
          escrow.order.status === 'DELIVERED';
        const buyerMayRefund =
          action === 'REFUND' &&
          escrow.status === 'HELD' &&
          actorUserId === escrow.buyerId &&
          escrow.order.status === 'CANCELLED';
        const adminMayResolve =
          isAdmin &&
          escrow.status === 'DISPUTED' &&
          ['SHIPPED', 'DELIVERED'].includes(escrow.order.status);
        if (!buyerMayRelease && !buyerMayRefund && !adminMayResolve) {
          invalid('FORBIDDEN', 'Actor is not allowed to resolve this escrow', 403);
        }

        assertTransition(escrow.status, toStatus);
        const buyerWallet = await tx.wallet.findUnique({
          where: {
            userId_currency: {
              userId: escrow.buyerId,
              currency: escrow.currency,
            },
          },
        });
        if (!buyerWallet) {
          invalid('WALLET_INVARIANT_FAILED', 'Escrow buyer wallet was not found', 500);
        }

        let ledgerEntries;
        if (action === 'RELEASE') {
          const sellerWallet = await tx.wallet.upsert({
            where: {
              userId_currency: {
                userId: escrow.sellerId,
                currency: escrow.currency,
              },
            },
            create: { userId: escrow.sellerId, currency: escrow.currency },
            update: {},
          });
          const released = await tx.wallet.updateMany({
            where: { id: buyerWallet.id, heldCents: { gte: escrow.amountCents } },
            data: { heldCents: { decrement: escrow.amountCents } },
          });
          if (released.count !== 1) {
            invalid('WALLET_INVARIANT_FAILED', 'Held escrow balance is insufficient', 500);
          }
          await tx.wallet.update({
            where: { id: sellerWallet.id },
            data: { availableCents: { increment: escrow.amountCents } },
          });
          ledgerEntries = [
            {
              walletId: buyerWallet.id,
              entryType: 'ESCROW_RELEASE',
              availableDeltaCents: 0n,
              heldDeltaCents: -escrow.amountCents,
            },
            {
              walletId: sellerWallet.id,
              entryType: 'ESCROW_RELEASE',
              availableDeltaCents: escrow.amountCents,
              heldDeltaCents: 0n,
            },
          ];
        } else {
          const refunded = await tx.wallet.updateMany({
            where: { id: buyerWallet.id, heldCents: { gte: escrow.amountCents } },
            data: {
              availableCents: { increment: escrow.amountCents },
              heldCents: { decrement: escrow.amountCents },
            },
          });
          if (refunded.count !== 1) {
            invalid('WALLET_INVARIANT_FAILED', 'Held escrow balance is insufficient', 500);
          }
          ledgerEntries = [{
            walletId: buyerWallet.id,
            entryType: 'ESCROW_REFUND',
            availableDeltaCents: escrow.amountCents,
            heldDeltaCents: -escrow.amountCents,
          }];
        }

        await recordTransition(tx, {
          escrow,
          actorUserId,
          action,
          toStatus,
          idempotencyKey,
          ledgerEntries,
        });

        const nextOrderStatus = action === 'RELEASE' ? 'COMPLETED' : 'CANCELLED';
        const orderUpdate = await tx.order.updateMany({
          where: { id: escrow.orderId, status: escrow.order.status },
          data: { status: nextOrderStatus },
        });
        if (orderUpdate.count !== 1) {
          invalid('ORDER_STATE_CHANGED', 'Order state changed; reload and retry', 409);
        }

        return { ...escrow, status: toStatus };
      }, idempotencyKey, expected);
    } catch (error) {
      return recoverIdempotentResult(prisma, error, idempotencyKey, expected);
    }
  }

  return { disputeEscrow, fundOrder, resolveEscrow };
}

module.exports = { createEscrowService, EscrowServiceError };
