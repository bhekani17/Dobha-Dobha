// Escrow orders and the wallet. Payment providers are simulated: a "payment"
// succeeds instantly and moves balances between wallet columns. Everything
// else (orders, statuses, who owes whom) is real and stored in D1.
import { isAdmin, requireUser } from './auth.js';
import { HttpError, id, iso, json, now, rands, readJson, str, zar } from './http.js';
import { itemJson, loadItem } from './items.js';
import { notify } from './notifications.js';

const DELIVERY = {
  'PUDO Locker-to-Locker': 5000,
  'Courier Guy Door-to-Door': 6500,
  'Downtown Joburg Safe Hub': 0,
};
const PAYMENT_METHODS = ['Capitec Pay (Instant)', 'Ozow Instant EFT', 'Debit / Credit Card', 'Dobha In-App Wallet'];
const WALLET = 'Dobha In-App Wallet';
const SAFE_HUB = 'Downtown Joburg Safe Hub';
const COMMISSION = 0.05;

const rand = (n) => Math.floor(Math.random() * n);
const money = (cents) => `R ${(cents / 100).toFixed(0)}`;
const txn = (env, userId, t) =>
  env.DB.prepare(
    'INSERT INTO transactions (id, user_id, title, subtitle, amount_cents, type, status, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id('txn'), userId, t.title, t.subtitle, t.amount, t.type, t.status, t.reference, now());

export async function orderJson(env, o, viewerId) {
  const [item, review] = await Promise.all([
    env.DB.prepare(
      `SELECT i.*, u.name AS seller_name, u.handle AS seller_handle, u.shop_name, u.stall_location
       FROM items i JOIN users u ON u.id = i.seller_id WHERE i.id = ?`,
    )
      .bind(o.item_id)
      .first(),
    env.DB.prepare('SELECT rating, text FROM reviews WHERE order_id = ?').bind(o.id).first(),
  ]);
  return {
    review: review ? { rating: review.rating, text: review.text } : null,
    canReview: !review && o.buyer_id === viewerId && o.status === 'payoutReleased',
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
  const o = await env.DB.prepare(
    `SELECT o.*, b.name AS buyer_name, i.title AS item_title FROM orders o
     JOIN users b ON b.id = o.buyer_id JOIN items i ON i.id = o.item_id WHERE o.id = ?`,
  )
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

/** Delivery, payment and address from a checkout body, validated. */
function checkoutDetails(body) {
  const deliveryMethod = str(body, 'deliveryMethod', { max: 60 });
  const paymentMethod = str(body, 'paymentMethod', { max: 60 });
  const address = str(body, 'deliveryAddress', { min: 5, max: 200 });
  if (!(deliveryMethod in DELIVERY)) throw new HttpError(400, 'Unknown delivery method');
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new HttpError(400, 'Unknown payment method');
  return { deliveryMethod, paymentMethod, address };
}

/**
 * Buys one piece for `user` and returns the new order id. The item flips to sold
 * atomically, so only one buyer wins. With `offerId`, the buyer's accepted offer
 * sets the price instead of the listing price.
 */
async function placeOrder(env, user, itemId, { deliveryMethod, paymentMethod, address }, offerId = null) {
  const item = await loadItem(env, itemId, user.id);
  if (item.seller_id === user.id) throw new HttpError(400, "You can't buy your own item");
  if (item.status !== 'available') throw new HttpError(409, 'Someone already bought this piece');

  let price = item.price_cents;
  if (offerId) {
    const offer = await env.DB.prepare(
      "SELECT * FROM offers WHERE id = ? AND buyer_id = ? AND item_id = ? AND status = 'accepted' AND expires_at > ?",
    )
      .bind(offerId, user.id, itemId, now())
      .first();
    if (!offer) throw new HttpError(409, 'That offer is no longer valid');
    price = offer.amount_cents;
  }

  const shipping = DELIVERY[deliveryMethod];
  const total = price + shipping;

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
    throw new HttpError(409, 'Someone already bought this piece');
  }

  const order = {
    id: `DB-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
    vault: `ESC-ZAR-${100000 + rand(900000)}`,
    // Couriers: the seller adds the real tracking number when they dispatch.
    tracking: deliveryMethod === SAFE_HUB ? 'Collect at hub' : '',
  };
  // The batch is one transaction; if it fails, undo the claim and the wallet charge above
  // so the item isn't left sold with no order.
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO orders (id, item_id, buyer_id, seller_id, amount_cents, shipping_cents, delivery_method, delivery_address, payment_method, status, vault_ref, tracking, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paymentHeld', ?, ?, ?)`,
      ).bind(order.id, itemId, user.id, item.seller_id, price, shipping, deliveryMethod, address, paymentMethod, order.vault, order.tracking, now()),
      env.DB.prepare('UPDATE wallets SET locked_cents = locked_cents + ? WHERE user_id = ?').bind(total, user.id),
      env.DB.prepare('UPDATE wallets SET pending_cents = pending_cents + ? WHERE user_id = ?').bind(price, item.seller_id),
      txn(env, user.id, {
        title: `Paid for ${item.title}`,
        subtitle: `On hold until you have it (${paymentMethod})`,
        amount: total,
        type: 'escrowHold',
        status: 'Held in escrow',
        reference: order.vault,
      }),
      notify(env, item.seller_id, {
        kind: 'sale',
        title: 'You made a sale',
        body: `${user.name} bought "${item.title}" for ${money(price)}. Send it, then tap "I've sent it" in Orders.`,
        orderId: order.id,
        itemId,
      }),
      // Sold pieces leave every cart, and other offers on them are closed.
      env.DB.prepare('DELETE FROM cart_items WHERE item_id = ?').bind(itemId),
      env.DB.prepare(
        "UPDATE offers SET status = CASE WHEN id = ?2 THEN 'used' ELSE 'declined' END, updated_at = ?3 WHERE item_id = ?1 AND status IN ('pending', 'countered', 'accepted')",
      ).bind(itemId, offerId, now()),
    ]);
  } catch (e) {
    await env.DB.batch([
      env.DB.prepare("UPDATE items SET status = 'available', buyer_id = NULL WHERE id = ? AND buyer_id = ?").bind(itemId, user.id),
      ...(paymentMethod === WALLET
        ? [env.DB.prepare('UPDATE wallets SET available_cents = available_cents + ? WHERE user_id = ?').bind(total, user.id)]
        : []),
    ]);
    throw e;
  }
  return order.id;
}

/** POST /api/orders { itemId, deliveryMethod, paymentMethod, deliveryAddress, offerId? } */
export async function createOrder(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const itemId = str(body, 'itemId', { max: 40 });
  const offerId = typeof body.offerId === 'string' && body.offerId ? body.offerId.slice(0, 40) : null;
  const orderId = await placeOrder(env, user, itemId, checkoutDetails(body), offerId);
  return json({ order: await orderJson(env, await loadOrder(env, orderId), user.id) }, 201);
}

/**
 * POST /api/cart/checkout { deliveryMethod, paymentMethod, deliveryAddress }: one order per
 * piece in the cart (each seller sends separately). Pieces that can't be bought stay in the
 * cart and are listed in `failed`.
 */
export async function checkoutCart(request, env) {
  const user = await requireUser(request, env);
  const details = checkoutDetails(await readJson(request));
  const { results } = await env.DB.prepare('SELECT item_id FROM cart_items WHERE user_id = ? ORDER BY created_at')
    .bind(user.id)
    .all();
  if (!results.length) throw new HttpError(400, 'Your cart is empty');

  const orders = [];
  const failed = [];
  for (const { item_id: itemId } of results) {
    try {
      const orderId = await placeOrder(env, user, itemId, details);
      orders.push(await orderJson(env, await loadOrder(env, orderId), user.id));
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      failed.push({ itemId, error: e.message });
    }
  }
  return json({ orders, failed }, orders.length ? 201 : 200);
}

/** POST /api/orders/:id/dispatch (seller) { trackingNumber }: required unless collected at the Safe Hub. */
export async function dispatchOrder(request, env, orderId) {
  const user = await requireUser(request, env);
  const o = await loadOrder(env, orderId);
  if (o.seller_id !== user.id) throw new HttpError(403, 'Only the seller can dispatch this order');

  let tracking = o.tracking;
  if (o.delivery_method !== SAFE_HUB) {
    const body = await request.json().catch(() => null);
    tracking = str(body && typeof body === 'object' ? body : {}, 'trackingNumber', { min: 4, max: 40 });
  }
  const res = await env.DB.prepare(
    "UPDATE orders SET status = 'vendorDispatched', dispatched_at = ?, tracking = ? WHERE id = ? AND status = 'paymentHeld'",
  )
    .bind(now(), tracking, orderId)
    .run();
  if (!res.meta.changes) throw new HttpError(409, 'This order cannot be marked as dispatched');

  await notify(env, o.buyer_id, {
    kind: 'dispatched',
    title: `"${o.item_title}" is on its way`,
    body:
      o.delivery_method === SAFE_HUB
        ? 'It is ready to collect at the Downtown Joburg Safe Hub.'
        : `Sent with ${o.delivery_method}, tracking number ${tracking}.`,
    orderId,
    itemId: o.item_id,
  }).run();
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

  await env.DB.batch(releaseToSeller(env, o, 'The buyer received it'));
  return json({ order: await orderJson(env, await loadOrder(env, orderId), user.id) });
}

/** Wallet moves (and the seller's notification) that pay the seller out of escrow, minus commission. */
function releaseToSeller(env, o, reason) {
  const total = o.amount_cents + o.shipping_cents;
  const payout = Math.round(o.amount_cents * (1 - COMMISSION));
  return [
    env.DB.prepare('UPDATE wallets SET locked_cents = MAX(locked_cents - ?, 0) WHERE user_id = ?').bind(total, o.buyer_id),
    env.DB.prepare('UPDATE wallets SET pending_cents = MAX(pending_cents - ?, 0), available_cents = available_cents + ? WHERE user_id = ?').bind(
      o.amount_cents,
      payout,
      o.seller_id,
    ),
    txn(env, o.seller_id, {
      title: `Sold ${o.item_title}`,
      subtitle: `${reason} (after the 5% Dobha fee)`,
      amount: payout,
      type: 'escrowRelease',
      status: 'Paid out',
      reference: o.vault_ref,
    }),
    notify(env, o.seller_id, {
      kind: 'payout',
      title: 'You have been paid',
      body: `${money(payout)} for "${o.item_title}" is now in your wallet.`,
      orderId: o.id,
      itemId: o.item_id,
    }),
  ];
}

/** POST /api/orders/:id/dispute (buyer): freezes the order until an admin settles it. */
export async function disputeOrder(request, env, orderId) {
  const user = await requireUser(request, env);
  const res = await env.DB.prepare(
    "UPDATE orders SET status = 'disputed' WHERE id = ? AND buyer_id = ? AND status IN ('paymentHeld', 'vendorDispatched')",
  )
    .bind(orderId, user.id)
    .run();
  if (!res.meta.changes) throw new HttpError(409, 'This order cannot be disputed');
  const o = await loadOrder(env, orderId);
  await notify(env, o.seller_id, {
    kind: 'disputed',
    title: 'Buyer reported a problem',
    body: `The payment for "${o.item_title}" is on hold while Dobha support sorts it out.`,
    orderId,
    itemId: o.item_id,
  }).run();
  return json({ order: await orderJson(env, o, user.id) });
}

async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (!isAdmin(env, user)) throw new HttpError(403, 'Admins only');
  return user;
}

/** GET /api/admin/disputes (admins), oldest first. */
export async function listDisputes(request, env) {
  const admin = await requireAdmin(request, env);
  const { results } = await env.DB.prepare(
    `SELECT o.*, b.name AS buyer_name FROM orders o JOIN users b ON b.id = o.buyer_id
     WHERE o.status = 'disputed' ORDER BY o.created_at`,
  ).all();
  return json({ orders: await Promise.all(results.map((o) => orderJson(env, o, admin.id))) });
}

/**
 * POST /api/orders/:id/resolve { outcome: 'refund' | 'release' } (admins).
 * Refunds go back to the buyer's Dobha wallet, since payments are simulated.
 */
export async function resolveDispute(request, env, orderId) {
  const admin = await requireAdmin(request, env);
  const outcome = (await readJson(request)).outcome;
  if (outcome !== 'refund' && outcome !== 'release') throw new HttpError(400, 'Outcome must be refund or release');

  const o = await loadOrder(env, orderId);
  const res = await env.DB.prepare("UPDATE orders SET status = ?, confirmed_at = ? WHERE id = ? AND status = 'disputed'")
    .bind(outcome === 'refund' ? 'refunded' : 'payoutReleased', now(), orderId)
    .run();
  if (!res.meta.changes) throw new HttpError(409, 'This order is not in dispute');

  const total = o.amount_cents + o.shipping_cents;
  if (outcome === 'release') {
    await env.DB.batch([
      ...releaseToSeller(env, o, 'Dobha support settled the problem for you'),
      notify(env, o.buyer_id, {
        kind: 'resolved',
        title: 'Problem sorted',
        body: `Dobha support looked into "${o.item_title}" and paid the seller.`,
        orderId,
        itemId: o.item_id,
      }),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE wallets SET locked_cents = MAX(locked_cents - ?1, 0), available_cents = available_cents + ?1 WHERE user_id = ?2',
      ).bind(total, o.buyer_id),
      env.DB.prepare('UPDATE wallets SET pending_cents = MAX(pending_cents - ?, 0) WHERE user_id = ?').bind(o.amount_cents, o.seller_id),
      txn(env, o.buyer_id, {
        title: `Refund for ${o.item_title}`,
        subtitle: 'Dobha support settled the problem for you',
        amount: total,
        type: 'refund',
        status: 'Refunded',
        reference: o.vault_ref,
      }),
      notify(env, o.buyer_id, {
        kind: 'resolved',
        title: 'You have been refunded',
        body: `${money(total)} for "${o.item_title}" is back in your wallet.`,
        orderId,
        itemId: o.item_id,
      }),
      notify(env, o.seller_id, {
        kind: 'resolved',
        title: 'Buyer refunded',
        body: `Dobha support refunded the buyer for "${o.item_title}".`,
        orderId,
        itemId: o.item_id,
      }),
    ]);
  }
  return json({ order: await orderJson(env, await loadOrder(env, orderId), admin.id) });
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
