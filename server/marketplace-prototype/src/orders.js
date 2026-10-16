'use strict';

// All stock, escrow, ledger and notification writes for an operation share one
// DynamoDB transaction. Retrying a transition cannot move the money twice.
exports.createOrders = (store) => {
  const { randomUUID } = require('node:crypto');
  const { get, queryAll, transact, putTx, updateTx, userOutbox, itemById, publicItem, response, HttpError, str, money, table } = store;
  const walletKey = (id) => ({ pk: `USER#${id}`, sk: 'WALLET' });
  const orderKey = (id) => ({ pk: `ORDER#${id}`, sk: 'META' });
  const hub = 'Downtown Joburg Safe Hub';
  const walletMethod = 'Dobha In-App Wallet';
  const delivery = { 'PUDO Locker-to-Locker': 5000, 'Courier Guy Door-to-Door': 6500, [hub]: 0 };
  const methods = [walletMethod, 'Capitec Pay (Instant)', 'Ozow Instant EFT', 'Debit / Credit Card'];
  const simulated = () => {
    if (process.env.ENABLE_SIMULATED_PAYMENTS !== 'true') throw new HttpError(503, 'Payments are not configured. Simulated payments are disabled.');
  };
  const active = (id) => ({ ConditionCheck: {
    TableName: table(), Key: { pk: `USER#${id}`, sk: 'PROFILE' },
    ConditionExpression: 'attribute_exists(pk) AND attribute_not_exists(deletedAt) AND attribute_not_exists(deletingAt)',
  } });
  const ledger = (userId, amount, type, title, reference) => {
    const createdAt = new Date().toISOString();
    const id = randomUUID();
    return putTx({ pk: `USER#${userId}`, sk: `TRANSACTION#${createdAt}#${id}`, id, amountCents: amount, type, title,
      subtitle: 'Simulated payment', status: 'Completed', reference, createdAt }, 'attribute_not_exists(pk)');
  };
  const emptyWallet = (id) => ({ ...walletKey(id), availableCents: 0, lockedCents: 0, pendingCents: 0 });
  async function wallet(user) {
    const [balance, entries] = await Promise.all([
      get(`USER#${user.id}`, 'WALLET'),
      queryAll({ KeyConditionExpression: 'pk = :user AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':user': `USER#${user.id}`, ':prefix': 'TRANSACTION#' }, ScanIndexForward: false }),
    ]);
    const w = balance || emptyWallet(user.id);
    return response(200, { availableZar: w.availableCents / 100, lockedZar: w.lockedCents / 100, pendingZar: w.pendingCents / 100,
      simulated: true, transactions: entries.slice(0, 50).map((entry) => ({ ...entry, amountZar: entry.amountCents / 100, date: entry.createdAt })) });
  }
  async function topUp(user, body) {
    simulated();
    const amount = money(body, 'amountZar', 50000);
    const method = str(body, 'method', { max: 60 });
    const reference = `TOP-${randomUUID()}`;
    await transact([active(user.id), updateTx(walletKey(user.id),
      'SET availableCents = if_not_exists(availableCents, :zero) + :amount, lockedCents = if_not_exists(lockedCents, :zero), pendingCents = if_not_exists(pendingCents, :zero)',
      undefined, { ':zero': 0, ':amount': amount }), ledger(user.id, amount, 'topup', `Top-up (${method})`, reference)]);
    return wallet(user);
  }
  async function withdraw(user, body) {
    simulated();
    const amount = money(body, 'amountZar');
    const bank = str(body, 'bank', { max: 60 });
    str(body, 'account', { min: 6, max: 20 });
    await transact([active(user.id), updateTx(walletKey(user.id), 'SET availableCents = availableCents - :amount',
      'availableCents >= :amount', { ':amount': amount }), ledger(user.id, amount, 'withdrawal', `Withdrawal to ${bank}`, `OUT-${randomUUID()}`)]);
    return wallet(user);
  }
  function details(body) {
    const deliveryMethod = str(body, 'deliveryMethod', { max: 60 });
    const paymentMethod = str(body, 'paymentMethod', { max: 60 });
    if (!Object.hasOwn(delivery, deliveryMethod)) throw new HttpError(400, 'Unknown delivery method');
    if (!methods.includes(paymentMethod)) throw new HttpError(400, 'Unknown payment method');
    if (paymentMethod !== walletMethod) simulated();
    return { deliveryMethod, paymentMethod, deliveryAddress: str(body, 'deliveryAddress', { min: 5, max: 200 }) };
  }
  async function place(user, body) {
    const checkout = details(body);
    const item = await itemById(str(body, 'itemId', { max: 80 }), false);
    if (item.sellerId === user.id) throw new HttpError(400, "You can't buy your own listing");
    const quantity = body.quantity == null ? 1 : Number(body.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.quantity) throw new HttpError(409, 'That quantity is no longer available');
    let price = item.priceCents;
    let offer;
    if (body.offerId) {
      offer = await get(`OFFER#${str(body, 'offerId', { max: 80 })}`, 'META');
      if (!offer || offer.buyerId !== user.id || offer.itemId !== item.id || offer.status !== 'accepted' ||
        !Number.isSafeInteger(offer.amountCents) || offer.amountCents < 1 || !offer.expiresAt || offer.expiresAt <= new Date().toISOString()) {
        throw new HttpError(409, 'That offer is no longer valid');
      }
      price = offer.amountCents;
    }
    const id = `DB-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const amount = price * quantity;
    const shipping = delivery[checkout.deliveryMethod];
    const total = amount + shipping;
    const order = { ...orderKey(id), id, itemId: item.id, itemTitle: item.title, itemPhotoKey: item.photoKey,
      // An immutable snapshot keeps order history independent of subsequent listing edits.
      item: publicItem(item), buyerId: user.id, buyerName: user.name || '', sellerId: item.sellerId, quantity,
      amountCents: amount, shippingCents: shipping, ...checkout, status: 'paymentHeld', vaultRef: `ESC-${id}`,
      tracking: checkout.deliveryMethod === hub ? 'Collect at hub' : '', createdAt,
      GSI1PK: `BUYER#${user.id}`, GSI1SK: `ORDER#${createdAt}#${id}`,
      GSI2PK: `SELLER#${item.sellerId}`, GSI2SK: `ORDER#${createdAt}#${id}` };
    const remaining = item.quantity - quantity;
    const writes = [active(user.id), active(item.sellerId),
      updateTx({ pk: item.pk, sk: item.sk }, remaining === 0
        ? 'SET quantity = :remaining, #status = :next REMOVE GSI1PK, GSI1SK'
        : 'SET quantity = :remaining, #status = :next',
      '#status = :available AND quantity = :expected AND priceCents = :price', {
        ':remaining': remaining, ':next': remaining === 0 ? 'sold' : 'available', ':available': 'available', ':expected': item.quantity, ':price': item.priceCents,
      }, { '#status': 'status' }),
      putTx(order, 'attribute_not_exists(pk)'),
      putTx({ pk: `USER#${user.id}`, sk: `ORDER#${id}`, orderId: id }, 'attribute_not_exists(pk)'),
      putTx({ pk: `USER#${item.sellerId}`, sk: `ORDER#${id}`, orderId: id }, 'attribute_not_exists(pk)'),
      updateTx(walletKey(user.id), checkout.paymentMethod === walletMethod
        ? 'SET availableCents = availableCents - :total, lockedCents = if_not_exists(lockedCents, :zero) + :total, pendingCents = if_not_exists(pendingCents, :zero)'
        : 'SET availableCents = if_not_exists(availableCents, :zero), lockedCents = if_not_exists(lockedCents, :zero) + :total, pendingCents = if_not_exists(pendingCents, :zero)',
      checkout.paymentMethod === walletMethod ? 'availableCents >= :total' : undefined, { ':zero': 0, ':total': total }),
      updateTx(walletKey(item.sellerId), 'SET availableCents = if_not_exists(availableCents, :zero), lockedCents = if_not_exists(lockedCents, :zero), pendingCents = if_not_exists(pendingCents, :zero) + :amount',
        undefined, { ':zero': 0, ':amount': amount }),
      ledger(user.id, total, 'escrowHold', `Paid for ${item.title}`, order.vaultRef),
      userOutbox(item.sellerId, { kind: 'sale', title: 'You made a sale', body: `${user.name || 'A customer'} bought ${item.title}.`, orderId: id, itemId: item.id }),
    ];
    if (offer) writes.push(updateTx({ pk: offer.pk, sk: offer.sk }, 'SET #status = :used',
      '#status = :accepted AND amountCents = :price AND expiresAt > :now',
      { ':used': 'used', ':accepted': 'accepted', ':price': price, ':now': createdAt }, { '#status': 'status' }));
    await transact(writes);
    return order;
  }
  function view(order, user) {
    return { id: order.id, item: order.item || { id: order.itemId, title: order.itemTitle, photoUrl: order.itemPhotoKey ? `/api/media/${order.itemPhotoKey}` : null },
      quantity: order.quantity, amountZar: order.amountCents / 100, shippingFeeZar: (order.shippingCents || 0) / 100,
      status: order.status, deliveryMethod: order.deliveryMethod, deliveryAddress: order.deliveryAddress || '', paymentMethod: order.paymentMethod,
      createdAt: order.createdAt, dispatchedAt: order.dispatchedAt || null, confirmedAt: order.confirmedAt || null,
      escrowVaultRef: order.vaultRef, trackingNumber: order.tracking || '', buyerName: order.buyerName || '',
      isSeller: order.sellerId === user.id, canReview: order.status === 'payoutReleased' && order.buyerId === user.id && !order.review,
      review: order.review || null };
  }
  async function createOrder(user, body) { return response(201, { order: view(await place(user, body), user) }); }
  async function myOrders(user) {
    const results = await Promise.all(['BUYER', 'SELLER'].map((role) => queryAll({
      IndexName: role === 'BUYER' ? 'MarketFeedIndex' : 'SellerActivityIndex',
      KeyConditionExpression: `${role === 'BUYER' ? 'GSI1PK' : 'GSI2PK'} = :user AND begins_with(${role === 'BUYER' ? 'GSI1SK' : 'GSI2SK'}, :prefix)`,
      ExpressionAttributeValues: { ':user': `${role}#${user.id}`, ':prefix': 'ORDER#' }, ScanIndexForward: false,
    })));
    const unique = [...new Map(results.flat().map((o) => [o.id, o])).values()];
    return response(200, { orders: unique.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100).map((o) => view(o, user)) });
  }
  async function load(id) {
    const order = await get(`ORDER#${id}`, 'META');
    if (!order) throw new HttpError(404, 'Order not found');
    return order;
  }
  async function transition(user, id, action, body) {
    const order = await load(id);
    if (action === 'dispatch') {
      if (order.sellerId !== user.id) throw new HttpError(403, 'Only the seller can dispatch');
      const tracking = order.deliveryMethod === hub ? 'Collect at hub' : str(body, 'trackingNumber', { min: 4, max: 40 });
      await transact([updateTx(orderKey(id), 'SET #status = :next, dispatchedAt = :now, tracking = :tracking', '#status = :expected',
        { ':next': 'vendorDispatched', ':expected': 'paymentHeld', ':now': new Date().toISOString(), ':tracking': tracking }, { '#status': 'status' }),
      userOutbox(order.buyerId, { kind: 'dispatched', title: 'Your order is on its way', body: tracking, orderId: id, itemId: order.itemId })]);
    } else if (action === 'dispute') {
      if (order.buyerId !== user.id) throw new HttpError(403, 'Only the buyer can dispute');
      await transact([updateTx(orderKey(id), 'SET #status = :next', '#status IN (:held, :sent)',
        { ':next': 'disputed', ':held': 'paymentHeld', ':sent': 'vendorDispatched' }, { '#status': 'status' }),
      userOutbox(order.sellerId, { kind: 'disputed', title: 'Buyer reported a problem', body: 'Payment is on hold for support.', orderId: id })]);
    } else {
      const resolving = action === 'resolve';
      if (resolving) store.requireAdmin(user);
      else if (order.buyerId !== user.id) throw new HttpError(403, 'Only the buyer can confirm');
      if (resolving && !['refund', 'release'].includes(body.outcome)) throw new HttpError(400, 'Outcome must be refund or release');
      const refund = resolving && body.outcome === 'refund';
      const next = refund ? 'refunded' : 'payoutReleased';
      if (order.status === next) return response(200, { order: view(order, user) });
      const total = order.amountCents + order.shippingCents;
      const payout = Math.round(order.amountCents * 0.95);
      await transact([
        updateTx(orderKey(id), 'SET #status = :next, confirmedAt = :now', '#status = :expected',
          { ':next': next, ':expected': resolving ? 'disputed' : 'vendorDispatched', ':now': new Date().toISOString() }, { '#status': 'status' }),
        updateTx(walletKey(order.buyerId), refund
          ? 'SET lockedCents = lockedCents - :total, availableCents = availableCents + :total'
          : 'SET lockedCents = lockedCents - :total', 'lockedCents >= :total', { ':total': total }),
        updateTx(walletKey(order.sellerId), refund
          ? 'SET pendingCents = pendingCents - :amount'
          : 'SET pendingCents = pendingCents - :amount, availableCents = availableCents + :payout',
        'pendingCents >= :amount', { ':amount': order.amountCents, ...(!refund ? { ':payout': payout } : {}) }),
        ledger(refund ? order.buyerId : order.sellerId, refund ? total : payout, refund ? 'refund' : 'escrowRelease', refund ? 'Order refunded' : 'Escrow released', order.vaultRef),
        userOutbox(refund ? order.buyerId : order.sellerId, { kind: refund ? 'resolved' : 'payout', title: refund ? 'You have been refunded' : 'You have been paid', body: order.itemTitle, orderId: id }),
      ]);
    }
    return response(200, { order: view(await load(id), user) });
  }
  return { wallet, topUp, withdraw, createOrder, myOrders, transition, view };
};
