// Escrow orders and the wallet. Payment providers are simulated: a "payment"
// succeeds instantly and moves balances between wallet columns. Everything
// else (orders, statuses, who owes whom) is real and stored in D1.
import { requireUser } from './auth.js';
import { HttpError, id, iso, json, now, rands, readJson, str, zar } from './http.js';
import { itemJson, loadItem } from './items.js';

const DELIVERY = {
  'PUDO Locker-to-Locker': 5000,
  'Courier Guy Door-to-Door': 6500,
  'Downtown Joburg Safe Hub': 0,
};
const PAYMENT_METHODS = ['Capitec Pay (Instant)', 'Ozow Instant EFT', 'Debit / Credit Card', 'Dobha In-App Wallet'];
const WALLET = 'Dobha In-App Wallet';
const COMMISSION = 0.05;

const rand = (n) => Math.floor(Math.random() * n);
const txn = (env, userId, t) =>
  env.DB.prepare(
    'INSERT INTO transactions (id, user_id, title, subtitle, amount_cents, type, status, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id('txn'), userId, t.title, t.subtitle, t.amount, t.type, t.status, t.reference, now());

async function orderJson(env, o, viewerId) {
  const item = await env.DB.prepare(
    `SELECT i.*, u.name AS seller_name, u.handle AS seller_handle, u.shop_name, u.stall_location
     FROM items i JOIN users u ON u.id = i.seller_id WHERE i.id = ?`,
  )
    .bind(o.item_id)
    .first();
  return {
    id: o.id,
    item: itemJson(item),
    amountZar: zar(o.amount_cents),
    shippingFeeZar: zar(o.shipping_cents),
    status: o.status,
    deliveryMethod: o.delivery_method,
    deliveryAddress: o.delivery_address,
    paymentMethod: o.payment_method,
    createdAt: iso(o.created_at),
    dispatchedAt: iso(o.dispatched_at),
    confirmedAt: iso(o.confirmed_at),
    escrowVaultRef: o.vault_ref,
    trackingNumber: o.tracking,
    buyerName: o.buyer_name,
    isSeller: o.seller_id === viewerId,
  };
}

async function loadOrder(env, orderId) {
  const o = await env.DB.prepare('SELECT o.*, b.name AS buyer_name FROM orders o JOIN users b ON b.id = o.buyer_id WHERE o.id = ?')
    .bind(orderId)
    .first();
  if (!o) throw new HttpError(404, 'Order not found');
  return o;
}

/** GET /api/orders: purchases and sales, newest first. */
export async function listOrders(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    `SELECT o.*, b.name AS buyer_name FROM orders o JOIN users b ON b.id = o.buyer_id
     WHERE o.buyer_id = ?1 OR o.seller_id = ?1 ORDER BY o.created_at DESC LIMIT 100`,
  )
    .bind(user.id)
    .all();
  return json({ orders: await Promise.all(results.map((o) => orderJson(env, o, user.id))) });
}

/** POST /api/orders: claim an item. The item flips to sold atomically, so only one buyer wins. */
export async function createOrder(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const itemId = str(body, 'itemId', { max: 40 });
  const deliveryMethod = str(body, 'deliveryMethod', { max: 60 });
  const paymentMethod = str(body, 'paymentMethod', { max: 60 });
  const address = str(body, 'deliveryAddress', { min: 5, max: 200 });
  if (!(deliveryMethod in DELIVERY)) throw new HttpError(400, 'Unknown delivery method');
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new HttpError(400, 'Unknown payment method');

  const item = await loadItem(env, itemId, user.id);
  if (item.seller_id === user.id) throw new HttpError(400, "You can't buy your own item");
  if (item.status !== 'available') throw new HttpError(409, 'Someone already claimed this piece');

  const shipping = DELIVERY[deliveryMethod];
  const total = item.price_cents + shipping;

  // Wallet payments need the balance; other methods are simulated as paid.
  if (paymentMethod === WALLET) {
    const res = await env.DB.prepare('UPDATE wallets SET available_cents = available_cents - ?1 WHERE user_id = ?2 AND available_cents >= ?1')
      .bind(total, user.id)
      .run();
    if (!res.meta.changes) throw new HttpError(402, 'Not enough in your wallet, top up or pick another payment method');
  }

  const claimed = await env.DB.prepare("UPDATE items SET status = 'sold', buyer_id = ? WHERE id = ? AND status = 'available'")
    .bind(user.id, itemId)
    .run();
  if (!claimed.meta.changes) {
    if (paymentMethod === WALLET) {
      await env.DB.prepare('UPDATE wallets SET available_cents = available_cents + ? WHERE user_id = ?').bind(total, user.id).run();
    }
    throw new HttpError(409, 'Someone already claimed this piece');
  }

  const order = {
    id: `DB-${Date.now().toString(36).toUpperCase()}${rand(1000)}`,
    vault: `ESC-ZAR-${100000 + rand(900000)}`,
    tracking: deliveryMethod === 'Downtown Joburg Safe Hub' ? 'Collect at hub' : `PUDO-ZA-${10000 + rand(90000)}`,
  };
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO orders (id, item_id, buyer_id, seller_id, amount_cents, shipping_cents, delivery_method, delivery_address, payment_method, status, vault_ref, tracking, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paymentHeld', ?, ?, ?)`,
    ).bind(order.id, itemId, user.id, item.seller_id, item.price_cents, shipping, deliveryMethod, address, paymentMethod, order.vault, order.tracking, now()),
    env.DB.prepare('UPDATE wallets SET locked_cents = locked_cents + ? WHERE user_id = ?').bind(total, user.id),
    env.DB.prepare('UPDATE wallets SET pending_cents = pending_cents + ? WHERE user_id = ?').bind(item.price_cents, item.seller_id),
    txn(env, user.id, {
      title: `Escrow: ${item.title}`,
      subtitle: `Held until you confirm (${paymentMethod})`,
      amount: total,
      type: 'escrowHold',
      status: 'Held in escrow',
      reference: order.vault,
    }),
  ]);

  return json({ order: await orderJson(env, await loadOrder(env, order.id), user.id) }, 201);
}

/** POST /api/orders/:id/dispatch (seller) */
export async function dispatchOrder(request, env, orderId) {
  const user = await requireUser(request, env);
  const res = await env.DB.prepare(
    "UPDATE orders SET status = 'vendorDispatched', dispatched_at = ? WHERE id = ? AND seller_id = ? AND status = 'paymentHeld'",
  )
    .bind(now(), orderId, user.id)
    .run();
  if (!res.meta.changes) throw new HttpError(409, 'This order cannot be marked as dispatched');
  return json({ order: await orderJson(env, await loadOrder(env, orderId), user.id) });
}

/** POST /api/orders/:id/confirm (buyer): releases escrow to the seller minus commission. */
export async function confirmOrder(request, env, orderId) {
  const user = await requireUser(request, env);
  const o = await loadOrder(env, orderId);
  if (o.buyer_id !== user.id) throw new HttpError(403, 'Only the buyer can confirm');

  const res = await env.DB.prepare(
    "UPDATE orders SET status = 'payoutReleased', confirmed_at = ? WHERE id = ? AND status = 'vendorDispatched'",
  )
    .bind(now(), orderId)
    .run();
  if (!res.meta.changes) throw new HttpError(409, 'This order cannot be confirmed yet');

  const total = o.amount_cents + o.shipping_cents;
  const payout = Math.round(o.amount_cents * (1 - COMMISSION));
  await env.DB.batch([
    env.DB.prepare('UPDATE wallets SET locked_cents = MAX(locked_cents - ?, 0) WHERE user_id = ?').bind(total, o.buyer_id),
    env.DB.prepare('UPDATE wallets SET pending_cents = MAX(pending_cents - ?, 0), available_cents = available_cents + ? WHERE user_id = ?').bind(
      o.amount_cents,
      payout,
      o.seller_id,
    ),
    txn(env, o.seller_id, {
      title: 'Escrow released',
      subtitle: `Buyer confirmed order ${o.id} (5% Dobha fee)`,
      amount: payout,
      type: 'escrowRelease',
      status: 'Paid out',
      reference: o.vault_ref,
    }),
  ]);
  return json({ order: await orderJson(env, await loadOrder(env, orderId), user.id) });
}

/** POST /api/orders/:id/dispute (buyer): freezes the order for support to resolve. */
export async function disputeOrder(request, env, orderId) {
  const user = await requireUser(request, env);
  const res = await env.DB.prepare(
    "UPDATE orders SET status = 'disputed' WHERE id = ? AND buyer_id = ? AND status IN ('paymentHeld', 'vendorDispatched')",
  )
    .bind(orderId, user.id)
    .run();
  if (!res.meta.changes) throw new HttpError(409, 'This order cannot be disputed');
  return json({ order: await orderJson(env, await loadOrder(env, orderId), user.id) });
}

/** GET /api/wallet */
export async function wallet(request, env) {
  const user = await requireUser(request, env);
  const w = (await env.DB.prepare('SELECT * FROM wallets WHERE user_id = ?').bind(user.id).first()) || {};
  const { results } = await env.DB.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(user.id)
    .all();
  return json({
    availableZar: zar(w.available_cents ?? 0),
    lockedZar: zar(w.locked_cents ?? 0),
    pendingZar: zar(w.pending_cents ?? 0),
    transactions: results.map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: t.subtitle,
      amountZar: zar(t.amount_cents),
      type: t.type,
      status: t.status,
      reference: t.reference,
      date: iso(t.created_at),
    })),
  });
}

/** POST /api/wallet/topup (simulated payment) */
export async function topUp(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const amount = rands(body, 'amountZar', { max: 50_000 });
  const method = str(body, 'method', { max: 60 });
  await env.DB.batch([
    env.DB.prepare('UPDATE wallets SET available_cents = available_cents + ? WHERE user_id = ?').bind(amount, user.id),
    txn(env, user.id, {
      title: `Top-up (${method})`,
      subtitle: 'Added to your Dobha wallet',
      amount,
      type: 'topup',
      status: 'Completed',
      reference: `TOP-${10000 + rand(90000)}`,
    }),
  ]);
  return wallet(request, env);
}

/** POST /api/wallet/withdraw (simulated payout) */
export async function withdraw(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const amount = rands(body, 'amountZar');
  const bank = str(body, 'bank', { max: 60 });
  const account = str(body, 'account', { min: 6, max: 20 });
  const res = await env.DB.prepare('UPDATE wallets SET available_cents = available_cents - ?1 WHERE user_id = ?2 AND available_cents >= ?1')
    .bind(amount, user.id)
    .run();
  if (!res.meta.changes) throw new HttpError(402, 'Insufficient available balance');
  await txn(env, user.id, {
    title: `Withdrawal to ${bank}`,
    subtitle: `Account ending ${account.slice(-4)}`,
    amount,
    type: 'withdrawal',
    status: 'Processing',
    reference: `WDR-${10000 + rand(90000)}`,
  }).run();
  return wallet(request, env);
}
