'use strict';

const dynamo = require('../utils/dynamo');
const { json, error, handleCors, parseBody } = require('../utils/response');
const { requireUser, requireAdmin } = require('../utils/auth');
const { id, orderId, vaultRef, now, nowIso, zar, toCents } = require('../utils/id');

const DELIVERY_METHODS = {
  'PUDO Locker-to-Locker': 5000,
  'Courier Guy Door-to-Door': 6500,
  'Downtown Joburg Safe Hub': 0,
};

const PAYMENT_METHODS = [
  'Capitec Pay (Instant)',
  'Ozow Instant EFT',
  'Debit / Credit Card',
  'Dobha In-App Wallet',
];

const COMMISSION_RATE = 0.05; // 5% Dobha platform commission

async function getOrCreateWallet(userId, walletsTable) {
  if (!walletsTable) return { user_id: userId, available_cents: 0, locked_cents: 0, pending_cents: 0 };
  let wallet = await dynamo.get(walletsTable, { user_id: userId });
  if (!wallet) {
    wallet = {
      user_id: userId,
      available_cents: 0,
      locked_cents: 0,
      pending_cents: 0,
      updated_at: now(),
    };
    await dynamo.put(walletsTable, wallet);
  }
  return wallet;
}

async function recordTransaction(transactionsTable, userId, { title, subtitle, amount, type, status, reference }) {
  if (!transactionsTable) return;
  const txnId = id('txn');
  await dynamo.put(transactionsTable, {
    id: txnId,
    user_id: userId,
    title,
    subtitle,
    amount_cents: amount,
    type,
    status,
    reference,
    created_at: now(),
  });
}

async function sendNotification(notificationsTable, userId, { kind, title, body, orderId, itemId }) {
  if (!notificationsTable) return;
  const ntfId = id('ntf');
  await dynamo.put(notificationsTable, {
    id: ntfId,
    user_id: userId,
    kind,
    title,
    body,
    order_id: orderId || null,
    item_id: itemId || null,
    read: false,
    created_at: now(),
  });
}

function formatOrder(order, viewerId, item = null) {
  return {
    id: order.id,
    itemId: order.item_id,
    amountZar: zar(order.amount_cents),
    shippingFeeZar: zar(order.shipping_cents),
    totalZar: zar((order.amount_cents || 0) + (order.shipping_cents || 0)),
    status: order.status,
    deliveryMethod: order.delivery_method,
    deliveryAddress: order.delivery_address,
    paymentMethod: order.payment_method,
    escrowVaultRef: order.vault_ref,
    trackingNumber: order.tracking || '',
    buyerId: order.buyer_id,
    buyerName: order.buyer_name || '',
    sellerId: order.seller_id,
    isSeller: order.seller_id === viewerId,
    createdAt: order.created_at ? new Date(order.created_at).toISOString() : null,
    dispatchedAt: order.dispatched_at ? new Date(order.dispatched_at).toISOString() : null,
    confirmedAt: order.confirmed_at ? new Date(order.confirmed_at).toISOString() : null,
    item: item || {
      id: order.item_id,
      title: order.item_title || 'Thrift item',
      photos: order.item_photos || [],
    },
  };
}

exports.handler = async (event) => {
  const cors = handleCors(event);
  if (cors) return cors;

  const ordersTable = process.env.ORDERS_TABLE;
  const walletsTable = process.env.WALLET_TABLE || process.env.WALLETS_TABLE;
  const transactionsTable = process.env.TRANSACTIONS_TABLE;
  const itemsTable = process.env.ITEMS_TABLE;
  const notificationsTable = process.env.NOTIFICATIONS_TABLE;
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const method = (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '').toUpperCase();

  try {
    // -------------------------------------------------------------
    // GET /api/orders: List user orders (as buyer or seller)
    // -------------------------------------------------------------
    if (path === '/api/orders' && method === 'GET') {
      const user = await requireUser(event);

      // Query as buyer
      const buyerOrders = await dynamo.query({
        TableName: ordersTable,
        IndexName: 'BuyerIndex',
        KeyConditionExpression: 'buyer_id = :uid',
        ExpressionAttributeValues: { ':uid': user.id },
        ScanIndexForward: false,
        Limit: 50,
      });

      // Query as seller
      const sellerOrders = await dynamo.query({
        TableName: ordersTable,
        IndexName: 'SellerIndex',
        KeyConditionExpression: 'seller_id = :uid',
        ExpressionAttributeValues: { ':uid': user.id },
        ScanIndexForward: false,
        Limit: 50,
      });

      const allOrders = [...buyerOrders.items, ...sellerOrders.items];
      // Sort newest first
      allOrders.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

      const formatted = allOrders.map((o) => formatOrder(o, user.id));
      return json(200, { orders: formatted });
    }

    // -------------------------------------------------------------
    // POST /api/orders: Place an escrow order for an item
    // -------------------------------------------------------------
    if (path === '/api/orders' && method === 'POST') {
      const user = await requireUser(event);
      const body = parseBody(event);

      const itemId = (body.itemId || body.item_id || '').trim();
      const deliveryMethod = (body.deliveryMethod || body.delivery_method || '').trim();
      const paymentMethod = (body.paymentMethod || body.payment_method || '').trim();
      const deliveryAddress = (body.deliveryAddress || body.delivery_address || '').trim();

      if (!itemId) return error(400, 'Item ID is required');
      if (!deliveryMethod || !(deliveryMethod in DELIVERY_METHODS)) {
        return error(400, `Invalid delivery method. Must be one of: ${Object.keys(DELIVERY_METHODS).join(', ')}`);
      }
      if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
        return error(400, `Invalid payment method. Must be one of: ${PAYMENT_METHODS.join(', ')}`);
      }
      if (deliveryMethod !== 'Downtown Joburg Safe Hub' && (!deliveryAddress || deliveryAddress.length < 5)) {
        return error(400, 'A valid delivery address is required');
      }

      const item = await dynamo.get(itemsTable, { id: itemId });
      if (!item) return error(404, 'Item not found');
      if (item.seller_id === user.id) return error(400, 'You cannot purchase your own item');
      if (item.status === 'sold' || (item.quantity !== undefined && item.quantity <= 0)) {
        return error(409, 'This piece has already been purchased');
      }

      const price = Number(item.price_cents || 0);
      const shipping = DELIVERY_METHODS[deliveryMethod];
      const total = price + shipping;

      // Check wallet balance if paying via in-app wallet
      if (paymentMethod === 'Dobha In-App Wallet') {
        const buyerWallet = await getOrCreateWallet(user.id, walletsTable);
        if ((buyerWallet.available_cents || 0) < total) {
          return error(402, `Insufficient wallet balance. You need ${zar(total)} but have ${zar(buyerWallet.available_cents || 0)}.`);
        }
        // Deduct from buyer available wallet
        await dynamo.update({
          TableName: walletsTable,
          Key: { user_id: user.id },
          UpdateExpression: 'SET available_cents = available_cents - :amount, updated_at = :time',
          ConditionExpression: 'available_cents >= :amount',
          ExpressionAttributeValues: { ':amount': total, ':time': now() },
        });
      }

      // Deduct item quantity or mark sold
      const newQuantity = (item.quantity !== undefined ? item.quantity : 1) - 1;
      const newStatus = newQuantity <= 0 ? 'sold' : 'available';

      await dynamo.update({
        TableName: itemsTable,
        Key: { id: itemId },
        UpdateExpression: 'SET quantity = :qty, #status = :st, buyer_id = :bid, updated_at = :time',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':qty': newQuantity,
          ':st': newStatus,
          ':bid': user.id,
          ':time': now(),
        },
      });

      const newOrderId = orderId();
      const vault = vaultRef();
      const orderRecord = {
        id: newOrderId,
        item_id: itemId,
        item_title: item.title,
        item_photos: item.photos || [],
        buyer_id: user.id,
        buyer_name: user.name || user.handle,
        seller_id: item.seller_id,
        amount_cents: price,
        shipping_cents: shipping,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress || 'Downtown Joburg Safe Hub',
        payment_method: paymentMethod,
        status: 'paymentHeld', // Escrow status
        vault_ref: vault,
        tracking: deliveryMethod === 'Downtown Joburg Safe Hub' ? 'Collect at Safe Hub' : '',
        created_at: now(),
      };

      await dynamo.put(ordersTable, orderRecord);

      // Lock funds into buyer's wallet escrow hold
      await dynamo.update({
        TableName: walletsTable,
        Key: { user_id: user.id },
        UpdateExpression: 'SET locked_cents = if_not_exists(locked_cents, :zero) + :total, updated_at = :time',
        ExpressionAttributeValues: { ':total': total, ':zero': 0, ':time': now() },
      });

      // Mark pending funds in seller's wallet
      await getOrCreateWallet(item.seller_id, walletsTable);
      await dynamo.update({
        TableName: walletsTable,
        Key: { user_id: item.seller_id },
        UpdateExpression: 'SET pending_cents = if_not_exists(pending_cents, :zero) + :price, updated_at = :time',
        ExpressionAttributeValues: { ':price': price, ':zero': 0, ':time': now() },
      });

      // Record transaction
      await recordTransaction(transactionsTable, user.id, {
        title: `Paid for "${item.title}"`,
        subtitle: `Held securely in Escrow (${vault})`,
        amount: total,
        type: 'escrowHold',
        status: 'Held in escrow',
        reference: vault,
      });

      // Notify seller
      await sendNotification(notificationsTable, item.seller_id, {
        kind: 'sale',
        title: 'Dobha Sale! Item Purchased',
        body: `${user.name || user.handle} bought "${item.title}" for ${zar(price)}. Deliver it to release funds!`,
        orderId: newOrderId,
        itemId,
      });

      return json(201, {
        message: 'Order created with escrow protection',
        order: formatOrder(orderRecord, user.id, item),
      });
    }

    // -------------------------------------------------------------
    // POST /api/orders/{id}/dispatch: Seller marks dispatched
    // -------------------------------------------------------------
    const dispatchMatch = path.match(/^\/api\/orders\/([^\/]+)\/dispatch$/);
    if (dispatchMatch && method === 'POST') {
      const user = await requireUser(event);
      const targetOrderId = dispatchMatch[1];

      const order = await dynamo.get(ordersTable, { id: targetOrderId });
      if (!order) return error(404, 'Order not found');
      if (order.seller_id !== user.id) return error(403, 'Only the seller can dispatch this order');
      if (order.status !== 'paymentHeld') {
        return error(409, `Order cannot be dispatched in status '${order.status}'`);
      }

      const body = parseBody(event);
      let trackingNumber = (body.trackingNumber || body.tracking || '').trim();
      if (order.delivery_method !== 'Downtown Joburg Safe Hub' && !trackingNumber) {
        return error(400, 'A courier tracking number is required');
      }

      const timestamp = now();
      await dynamo.update({
        TableName: ordersTable,
        Key: { id: targetOrderId },
        UpdateExpression: 'SET #st = :st, tracking = :trk, dispatched_at = :time',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':st': 'vendorDispatched',
          ':trk': trackingNumber || 'Collect at Safe Hub',
          ':time': timestamp,
        },
      });

      order.status = 'vendorDispatched';
      order.dispatched_at = timestamp;
      order.tracking = trackingNumber;

      // Notify buyer
      await sendNotification(notificationsTable, order.buyer_id, {
        kind: 'dispatched',
        title: 'Your order is on the way!',
        body: order.delivery_method === 'Downtown Joburg Safe Hub'
          ? `"${order.item_title}" is ready for pickup at Downtown Joburg Safe Hub.`
          : `"${order.item_title}" dispatched via ${order.delivery_method}. Tracking: ${trackingNumber}`,
        orderId: targetOrderId,
        itemId: order.item_id,
      });

      return json(200, {
        message: 'Order marked as dispatched',
        order: formatOrder(order, user.id),
      });
    }

    // -------------------------------------------------------------
    // POST /api/orders/{id}/confirm: Buyer confirms delivery -> Releases Escrow
    // -------------------------------------------------------------
    const confirmMatch = path.match(/^\/api\/orders\/([^\/]+)\/confirm$/);
    if (confirmMatch && method === 'POST') {
      const user = await requireUser(event);
      const targetOrderId = confirmMatch[1];

      const order = await dynamo.get(ordersTable, { id: targetOrderId });
      if (!order) return error(404, 'Order not found');
      if (order.buyer_id !== user.id) return error(403, 'Only the buyer can confirm order delivery');
      if (order.status !== 'vendorDispatched') {
        return error(409, `Order cannot be confirmed in current status '${order.status}'`);
      }

      const timestamp = now();
      const price = Number(order.amount_cents || 0);
      const shipping = Number(order.shipping_cents || 0);
      const total = price + shipping;
      const commission = Math.round(price * COMMISSION_RATE);
      const sellerPayout = price - commission;

      // 1. Update order status to payoutReleased
      await dynamo.update({
        TableName: ordersTable,
        Key: { id: targetOrderId },
        UpdateExpression: 'SET #st = :st, confirmed_at = :time',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':st': 'payoutReleased',
          ':time': timestamp,
        },
      });

      // 2. Unlock buyer's wallet escrow
      await dynamo.update({
        TableName: walletsTable,
        Key: { user_id: order.buyer_id },
        UpdateExpression: 'SET locked_cents = if_not_exists(locked_cents, :total) - :total, updated_at = :time',
        ExpressionAttributeValues: { ':total': total, ':time': timestamp },
      });

      // 3. Move seller funds from pending to available (minus 5% platform fee)
      await dynamo.update({
        TableName: walletsTable,
        Key: { user_id: order.seller_id },
        UpdateExpression: 'SET pending_cents = if_not_exists(pending_cents, :price) - :price, available_cents = if_not_exists(available_cents, :zero) + :payout, updated_at = :time',
        ExpressionAttributeValues: {
          ':price': price,
          ':payout': sellerPayout,
          ':zero': 0,
          ':time': timestamp,
        },
      });

      // 4. Record transaction for seller
      await recordTransaction(transactionsTable, order.seller_id, {
        title: `Payout for "${order.item_title}"`,
        subtitle: `Escrow released (${zar(sellerPayout)} after 5% Dobha fee)`,
        amount: sellerPayout,
        type: 'escrowRelease',
        status: 'Paid out',
        reference: order.vault_ref,
      });

      // 5. Notify seller
      await sendNotification(notificationsTable, order.seller_id, {
        kind: 'payout',
        title: 'Payment released to your wallet!',
        body: `Buyer confirmed delivery. ${zar(sellerPayout)} has been added to your Dobha Wallet available balance!`,
        orderId: targetOrderId,
        itemId: order.item_id,
      });

      order.status = 'payoutReleased';
      order.confirmed_at = timestamp;

      return json(200, {
        message: 'Delivery confirmed and escrow payment released to seller',
        order: formatOrder(order, user.id),
      });
    }

    // -------------------------------------------------------------
    // POST /api/orders/{id}/dispute: Buyer opens dispute
    // -------------------------------------------------------------
    const disputeMatch = path.match(/^\/api\/orders\/([^\/]+)\/dispute$/);
    if (disputeMatch && method === 'POST') {
      const user = await requireUser(event);
      const targetOrderId = disputeMatch[1];

      const order = await dynamo.get(ordersTable, { id: targetOrderId });
      if (!order) return error(404, 'Order not found');
      if (order.buyer_id !== user.id) return error(403, 'Only the buyer can dispute this order');
      if (order.status !== 'paymentHeld' && order.status !== 'vendorDispatched') {
        return error(409, 'This order cannot be disputed in its current status');
      }

      await dynamo.update({
        TableName: ordersTable,
        Key: { id: targetOrderId },
        UpdateExpression: 'SET #st = :st, disputed_at = :time',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':st': 'disputed',
          ':time': now(),
        },
      });

      order.status = 'disputed';

      // Notify seller
      await sendNotification(notificationsTable, order.seller_id, {
        kind: 'disputed',
        title: 'Order dispute raised',
        body: `Buyer reported a problem with "${order.item_title}". Payment is frozen while Dobha support reviews it.`,
        orderId: targetOrderId,
        itemId: order.item_id,
      });

      return json(200, {
        message: 'Order placed under dispute. Dobha support will mediate.',
        order: formatOrder(order, user.id),
      });
    }

    // -------------------------------------------------------------
    // POST /api/orders/{id}/resolve: Admin resolves dispute (refund or release)
    // -------------------------------------------------------------
    const resolveMatch = path.match(/^\/api\/orders\/([^\/]+)\/resolve$/);
    if (resolveMatch && method === 'POST') {
      const admin = await requireUser(event);
      requireAdmin(admin);

      const targetOrderId = resolveMatch[1];
      const body = parseBody(event);
      const outcome = body.outcome; // 'refund' or 'release'

      if (outcome !== 'refund' && outcome !== 'release') {
        return error(400, "Outcome must be either 'refund' or 'release'");
      }

      const order = await dynamo.get(ordersTable, { id: targetOrderId });
      if (!order) return error(404, 'Order not found');
      if (order.status !== 'disputed') return error(409, 'Order is not under dispute');

      const price = Number(order.amount_cents || 0);
      const shipping = Number(order.shipping_cents || 0);
      const total = price + shipping;
      const timestamp = now();

      if (outcome === 'refund') {
        // Refund buyer
        await dynamo.update({
          TableName: ordersTable,
          Key: { id: targetOrderId },
          UpdateExpression: 'SET #st = :st, resolved_at = :time',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: { ':st': 'refunded', ':time': timestamp },
        });

        // Unlock buyer locked_cents and add to available_cents
        await dynamo.update({
          TableName: walletsTable,
          Key: { user_id: order.buyer_id },
          UpdateExpression: 'SET locked_cents = if_not_exists(locked_cents, :total) - :total, available_cents = if_not_exists(available_cents, :zero) + :total, updated_at = :time',
          ExpressionAttributeValues: { ':total': total, ':zero': 0, ':time': timestamp },
        });

        // Deduct seller pending
        await dynamo.update({
          TableName: walletsTable,
          Key: { user_id: order.seller_id },
          UpdateExpression: 'SET pending_cents = if_not_exists(pending_cents, :price) - :price, updated_at = :time',
          ExpressionAttributeValues: { ':price': price, ':time': timestamp },
        });

        await recordTransaction(transactionsTable, order.buyer_id, {
          title: `Refund for "${order.item_title}"`,
          subtitle: 'Dispute resolved by Dobha Support',
          amount: total,
          type: 'refund',
          status: 'Refunded',
          reference: order.vault_ref,
        });

        await sendNotification(notificationsTable, order.buyer_id, {
          kind: 'resolved',
          title: 'Dispute resolved: Refunded',
          body: `${zar(total)} has been credited back to your Dobha Wallet.`,
          orderId: targetOrderId,
          itemId: order.item_id,
        });

        order.status = 'refunded';
      } else {
        // Release to seller
        const commission = Math.round(price * COMMISSION_RATE);
        const sellerPayout = price - commission;

        await dynamo.update({
          TableName: ordersTable,
          Key: { id: targetOrderId },
          UpdateExpression: 'SET #st = :st, resolved_at = :time, confirmed_at = :time',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: { ':st': 'payoutReleased', ':time': timestamp },
        });

        await dynamo.update({
          TableName: walletsTable,
          Key: { user_id: order.buyer_id },
          UpdateExpression: 'SET locked_cents = if_not_exists(locked_cents, :total) - :total, updated_at = :time',
          ExpressionAttributeValues: { ':total': total, ':time': timestamp },
        });

        await dynamo.update({
          TableName: walletsTable,
          Key: { user_id: order.seller_id },
          UpdateExpression: 'SET pending_cents = if_not_exists(pending_cents, :price) - :price, available_cents = if_not_exists(available_cents, :zero) + :payout, updated_at = :time',
          ExpressionAttributeValues: { ':price': price, ':payout': sellerPayout, ':zero': 0, ':time': timestamp },
        });

        await recordTransaction(transactionsTable, order.seller_id, {
          title: `Payout for "${order.item_title}"`,
          subtitle: `Dispute resolved in your favor (${zar(sellerPayout)})`,
          amount: sellerPayout,
          type: 'escrowRelease',
          status: 'Paid out',
          reference: order.vault_ref,
        });

        order.status = 'payoutReleased';
      }

      return json(200, {
        message: `Dispute resolved with outcome: ${outcome}`,
        order: formatOrder(order, admin.id),
      });
    }

    // -------------------------------------------------------------
    // GET /api/wallet: Integrated digital wallet balances & transactions
    // -------------------------------------------------------------
    if (path === '/api/wallet' && method === 'GET') {
      const user = await requireUser(event);
      const wallet = await getOrCreateWallet(user.id, walletsTable);

      let transactions = [];
      if (transactionsTable) {
        const res = await dynamo.query({
          TableName: transactionsTable,
          IndexName: 'UserIndex',
          KeyConditionExpression: 'user_id = :uid',
          ExpressionAttributeValues: { ':uid': user.id },
          ScanIndexForward: false,
          Limit: 50,
        });
        transactions = res.items.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.subtitle,
          amountZar: zar(t.amount_cents),
          type: t.type,
          status: t.status,
          reference: t.reference,
          date: t.created_at ? new Date(t.created_at).toISOString() : null,
        }));
      }

      return json(200, {
        availableZar: zar(wallet.available_cents || 0),
        lockedZar: zar(wallet.locked_cents || 0),
        pendingZar: zar(wallet.pending_cents || 0),
        transactions,
      });
    }

    // -------------------------------------------------------------
    // POST /api/wallet/topup: Top up in-app wallet balance
    // -------------------------------------------------------------
    if (path.endsWith('/api/wallet/topup') && method === 'POST') {
      const user = await requireUser(event);
      const body = parseBody(event);
      const amountZar = body.amountZar || body.amount || 0;
      const amountCents = toCents(amountZar);
      const methodUsed = body.method || 'Capitec Pay (Instant)';

      if (amountCents <= 0 || amountCents > 5000000) {
        return error(400, 'Top up amount must be between R10 and R50,000');
      }

      await getOrCreateWallet(user.id, walletsTable);
      await dynamo.update({
        TableName: walletsTable,
        Key: { user_id: user.id },
        UpdateExpression: 'SET available_cents = if_not_exists(available_cents, :zero) + :amount, updated_at = :time',
        ExpressionAttributeValues: { ':amount': amountCents, ':zero': 0, ':time': now() },
      });

      const ref = `TOP-${10000 + Math.floor(Math.random() * 90000)}`;
      await recordTransaction(transactionsTable, user.id, {
        title: `Wallet Top-Up (${methodUsed})`,
        subtitle: 'Added to your Dobha Wallet available balance',
        amount: amountCents,
        type: 'topup',
        status: 'Completed',
        reference: ref,
      });

      const updated = await getOrCreateWallet(user.id, walletsTable);
      return json(200, {
        message: `Successfully topped up ${zar(amountCents)}`,
        availableZar: zar(updated.available_cents || 0),
        lockedZar: zar(updated.locked_cents || 0),
        pendingZar: zar(updated.pending_cents || 0),
      });
    }

    // -------------------------------------------------------------
    // POST /api/wallet/withdraw: Seamless bank withdrawal of earnings
    // -------------------------------------------------------------
    if (path.endsWith('/api/wallet/withdraw') && method === 'POST') {
      const user = await requireUser(event);
      const body = parseBody(event);
      const amountZar = body.amountZar || body.amount || 0;
      const amountCents = toCents(amountZar);
      const bank = (body.bank || '').trim();
      const accountNumber = (body.account || body.accountNumber || '').trim();

      if (amountCents < 5000) {
        return error(400, 'Minimum withdrawal amount is R50.00');
      }
      if (!bank) {
        return error(400, 'South African bank name is required (e.g. Capitec, FNB, Standard Bank, Nedbank, Absa, TymeBank)');
      }
      if (!accountNumber || accountNumber.length < 6 || accountNumber.length > 20) {
        return error(400, 'Valid bank account number required');
      }

      const wallet = await getOrCreateWallet(user.id, walletsTable);
      if ((wallet.available_cents || 0) < amountCents) {
        return error(402, `Insufficient available balance. You have ${zar(wallet.available_cents || 0)} available to withdraw.`);
      }

      // Deduct from available balance
      await dynamo.update({
        TableName: walletsTable,
        Key: { user_id: user.id },
        UpdateExpression: 'SET available_cents = available_cents - :amount, updated_at = :time',
        ConditionExpression: 'available_cents >= :amount',
        ExpressionAttributeValues: { ':amount': amountCents, ':time': now() },
      });

      const ref = `WDR-${10000 + Math.floor(Math.random() * 90000)}`;
      await recordTransaction(transactionsTable, user.id, {
        title: `Withdrawal to ${bank}`,
        subtitle: `Account ending in ${accountNumber.slice(-4)}`,
        amount: amountCents,
        type: 'withdrawal',
        status: 'Processing',
        reference: ref,
      });

      const updated = await getOrCreateWallet(user.id, walletsTable);
      return json(200, {
        message: `Withdrawal of ${zar(amountCents)} to ${bank} is processing. Reference: ${ref}`,
        availableZar: zar(updated.available_cents || 0),
        lockedZar: zar(updated.locked_cents || 0),
        pendingZar: zar(updated.pending_cents || 0),
      });
    }

    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Orders handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
};
