'use strict';

const dynamo = require('../utils/dynamo');
const { json, error, handleCors } = require('../utils/response');
const { requireUser } = require('../utils/auth');
const { id, now, zar } = require('../utils/id');

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
    // POST /api/orders: Create a new order
    if (path === '/api/orders' && method === 'POST') {
      const user = await requireUser(event);
      const body = JSON.parse(event.body || '{}');
      const { items, paymentMethod, deliveryMethod, deliveryAddress } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return error(400, 'Order must contain at least one item');
      }

      // Calculate total amount
      let totalCents = 0;
      for (const item of items) {
        const itemData = await dynamo.get(ordersTable, { id: item.id });
        if (!itemData) return error(404, `Item ${item.id} not found`);
        totalCents += (itemData.price_cents || 0) * (item.quantity || 1);
      }

      const orderId = id('ord');
      const order = {
        id: orderId,
        buyer_id: user.id,
        buyer_name: user.name,
        seller_id: items[0].seller_id, // Simplified: assume single seller
        item_id: items[0].id,
        item_title: items[0].title || 'Thrift item',
        amount_cents: totalCents,
        shipping_cents: 0, // Calculate based on delivery method
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress,
        payment_method: paymentMethod,
        status: 'paymentHeld',
        created_at: now(),
      };

      await dynamo.put(ordersTable, order);

      // Notify seller
      await sendNotification(notificationsTable, order.seller_id, {
        kind: 'order_placed',
        title: 'New order received',
        body: `You have a new order for "${order.item_title}". Amount: ${zar(totalCents)}`,
        orderId: orderId,
        itemId: order.item_id,
      });

      return json(201, { order: formatOrder(order, user.id) });
    }

    // -------------------------------------------------------------
    // POST /api/orders/{id}/dispatch: Seller dispatches the order
    const dispatchMatch = path.match(/^\/api\/orders\/([^\/]+)\/dispatch$/);
    if (dispatchMatch && method === 'POST') {
      const user = await requireUser(event);
      const targetOrderId = dispatchMatch[1];

      const order = await dynamo.get(ordersTable, { id: targetOrderId });
      if (!order) return error(404, 'Order not found');
      if (order.seller_id !== user.id) return error(403, 'Only the seller can dispatch this order');
      if (order.status !== 'paymentHeld') {
        return error(409, 'This order cannot be dispatched in its current status');
      }

      const body = JSON.parse(event.body || '{}');
      const { tracking } = body;

      await dynamo.update({
        TableName: ordersTable,
        Key: { id: targetOrderId },
        UpdateExpression: 'SET #st = :st, tracking = :track, dispatched_at = :time',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':st': 'vendorDispatched',
          ':track': tracking || '',
          ':time': now(),
        },
      });

      order.status = 'vendorDispatched';
      order.tracking = tracking || '';
      order.dispatched_at = now();

      // Notify buyer
      await sendNotification(notificationsTable, order.buyer_id, {
        kind: 'order_dispatched',
        title: 'Order dispatched',
        body: `Your order for "${order.item_title}" has been dispatched${tracking ? `. Tracking: ${tracking}` : ''}`,
        orderId: targetOrderId,
        itemId: order.item_id,
      });

      return json(200, {
        message: 'Order dispatched successfully',
        order: formatOrder(order, user.id),
      });
    }

    // -------------------------------------------------------------
    // POST /api/orders/{id}/confirm: Buyer confirms receipt
    const confirmMatch = path.match(/^\/api\/orders\/([^\/]+)\/confirm$/);
    if (confirmMatch && method === 'POST') {
      const user = await requireUser(event);
      const targetOrderId = confirmMatch[1];

      const order = await dynamo.get(ordersTable, { id: targetOrderId });
      if (!order) return error(404, 'Order not found');
      if (order.buyer_id !== user.id) return error(403, 'Only the buyer can confirm this order');
      if (order.status !== 'vendorDispatched') {
        return error(409, 'This order cannot be confirmed in its current status');
      }

      await dynamo.update({
        TableName: ordersTable,
        Key: { id: targetOrderId },
        UpdateExpression: 'SET #st = :st, confirmed_at = :time',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':st': 'buyerConfirmed',
          ':time': now(),
        },
      });

      order.status = 'buyerConfirmed';
      order.confirmed_at = now();

      // Release funds to seller wallet
      const sellerWallet = await getOrCreateWallet(order.seller_id, walletsTable);
      await dynamo.update({
        TableName: walletsTable,
        Key: { user_id: order.seller_id },
        UpdateExpression: 'SET available_cents = available_cents + :amount, updated_at = :time',
        ExpressionAttributeValues: {
          ':amount': order.amount_cents,
          ':time': now(),
        },
      });

      // Record transaction
      if (transactionsTable) {
        const txId = id('txn');
        await dynamo.put(transactionsTable, {
          id: txId,
          user_id: order.seller_id,
          title: `Sale: ${order.item_title}`,
          subtitle: `Order ${targetOrderId}`,
          amount_cents: order.amount_cents,
          type: 'escrowRelease',
          status: 'completed',
          reference: targetOrderId,
          created_at: now(),
        });
      }

      // Notify seller
      await sendNotification(notificationsTable, order.seller_id, {
        kind: 'order_confirmed',
        title: 'Order confirmed - Payment released',
        body: `Buyer confirmed receipt of "${order.item_title}". Payment has been released to your wallet.`,
        orderId: targetOrderId,
        itemId: order.item_id,
      });

      return json(200, {
        message: 'Order confirmed and payment released to seller',
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
    // POST /api/orders/{id}/resolve: Admin resolves dispute
    const resolveMatch = path.match(/^\/api\/orders\/([^\/]+)\/resolve$/);
    if (resolveMatch && method === 'POST') {
      const user = await requireUser(event);
      const targetOrderId = resolveMatch[1];

      const order = await dynamo.get(ordersTable, { id: targetOrderId });
      if (!order) return error(404, 'Order not found');
      if (order.status !== 'disputed') {
        return error(409, 'This order cannot be resolved in its current status');
      }

      const body = JSON.parse(event.body || '{}');
      const { resolution } = body; // 'refund_buyer' or 'pay_seller'

      if (resolution === 'refund_buyer') {
        // Refund buyer
        const buyerWallet = await getOrCreateWallet(order.buyer_id, walletsTable);
        await dynamo.update({
          TableName: walletsTable,
          Key: { user_id: order.buyer_id },
          UpdateExpression: 'SET available_cents = available_cents + :amount, updated_at = :time',
          ExpressionAttributeValues: {
            ':amount': order.amount_cents,
            ':time': now(),
          },
        });

        // Record transaction
        if (transactionsTable) {
          const txId = id('txn');
          await dynamo.put(transactionsTable, {
            id: txId,
            user_id: order.buyer_id,
            title: `Refund: ${order.item_title}`,
            subtitle: `Dispute resolution for order ${targetOrderId}`,
            amount_cents: order.amount_cents,
            type: 'refund',
            status: 'completed',
            reference: targetOrderId,
            created_at: now(),
          });
        }

        await dynamo.update({
          TableName: ordersTable,
          Key: { id: targetOrderId },
          UpdateExpression: 'SET #st = :st',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: { ':st': 'refunded' },
        });

        // Notify both parties
        await sendNotification(notificationsTable, order.buyer_id, {
          kind: 'dispute_resolved',
          title: 'Dispute resolved - Refund issued',
          body: `Your refund for "${order.item_title}" has been issued to your wallet.`,
          orderId: targetOrderId,
          itemId: order.item_id,
        });

        await sendNotification(notificationsTable, order.seller_id, {
          kind: 'dispute_resolved',
          title: 'Dispute resolved - Refund to buyer',
          body: `The dispute for "${order.item_title}" was resolved in favor of the buyer. No payment was released.`,
          orderId: targetOrderId,
          itemId: order.item_id,
        });
      } else if (resolution === 'pay_seller') {
        // Pay seller
        const sellerWallet = await getOrCreateWallet(order.seller_id, walletsTable);
        await dynamo.update({
          TableName: walletsTable,
          Key: { user_id: order.seller_id },
          UpdateExpression: 'SET available_cents = available_cents + :amount, updated_at = :time',
          ExpressionAttributeValues: {
            ':amount': order.amount_cents,
            ':time': now(),
          },
        });

        // Record transaction
        if (transactionsTable) {
          const txId = id('txn');
          await dynamo.put(transactionsTable, {
            id: txId,
            user_id: order.seller_id,
            title: `Sale: ${order.item_title}`,
            subtitle: `Dispute resolution for order ${targetOrderId}`,
            amount_cents: order.amount_cents,
            type: 'escrowRelease',
            status: 'completed',
            reference: targetOrderId,
            created_at: now(),
          });
        }

        await dynamo.update({
          TableName: ordersTable,
          Key: { id: targetOrderId },
          UpdateExpression: 'SET #st = :st',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: { ':st': 'sellerPaid' },
        });

        // Notify both parties
        await sendNotification(notificationsTable, order.seller_id, {
          kind: 'dispute_resolved',
          title: 'Dispute resolved - Payment released',
          body: `The dispute for "${order.item_title}" was resolved in your favor. Payment has been released to your wallet.`,
          orderId: targetOrderId,
          itemId: order.item_id,
        });

        await sendNotification(notificationsTable, order.buyer_id, {
          kind: 'dispute_resolved',
          title: 'Dispute resolved - Payment to seller',
          body: `The dispute for "${order.item_title}" was resolved in favor of the seller.`,
          orderId: targetOrderId,
          itemId: order.item_id,
        });
      } else {
        return error(400, 'Invalid resolution. Must be "refund_buyer" or "pay_seller"');
      }

      return json(200, {
        message: 'Dispute resolved successfully',
        order: formatOrder(order, user.id),
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
    if (path.endsWith('/api/wallet/topup') && method === 'POST') {
      const user = await requireUser(event);
      const body = JSON.parse(event.body || '{}');
      const { amountZar, method } = body;

      if (!amountZar || amountZar <= 0) {
        return error(400, 'Amount must be greater than 0');
      }

      const amountCents = Math.round(amountZar * 100);
      const wallet = await getOrCreateWallet(user.id, walletsTable);

      // In production, integrate with payment provider here
      // For now, simulate the deposit
      await dynamo.update({
        TableName: walletsTable,
        Key: { user_id: user.id },
        UpdateExpression: 'SET available_cents = available_cents + :amount, updated_at = :time',
        ExpressionAttributeValues: {
          ':amount': amountCents,
          ':time': now(),
        },
      });

      // Record transaction
      if (transactionsTable) {
        const txId = id('txn');
        await dynamo.put(transactionsTable, {
          id: txId,
          user_id: user.id,
          title: 'Wallet deposit',
          subtitle: `Deposit via ${method || 'card'}`,
          amount_cents: amountCents,
          type: 'topup',
          status: 'completed',
          reference: `DEPOSIT-${Date.now()}`,
          created_at: now(),
        });
      }

      return json(200, {
        message: 'Wallet topped up successfully',
        availableZar: zar((wallet.available_cents || 0) + amountCents),
      });
    }

    // -------------------------------------------------------------
    // POST /api/wallet/withdraw: Seamless bank withdrawal of earnings
    if (path.endsWith('/api/wallet/withdraw') && method === 'POST') {
      const user = await requireUser(event);
      const body = JSON.parse(event.body || '{}');
      const { amountZar, bank, account } = body;

      if (!amountZar || amountZar <= 0) {
        return error(400, 'Amount must be greater than 0');
      }

      const amountCents = Math.round(amountZar * 100);
      const wallet = await getOrCreateWallet(user.id, walletsTable);

      if ((wallet.available_cents || 0) < amountCents) {
        return error(400, 'Insufficient funds');
      }

      // In production, integrate with payout provider here
      // For now, simulate the withdrawal
      await dynamo.update({
        TableName: walletsTable,
        Key: { user_id: user.id },
        UpdateExpression: 'SET available_cents = available_cents - :amount, updated_at = :time',
        ExpressionAttributeValues: {
          ':amount': amountCents,
          ':time': now(),
        },
      });

      // Record transaction
      if (transactionsTable) {
        const txId = id('txn');
        await dynamo.put(transactionsTable, {
          id: txId,
          user_id: user.id,
          title: 'Bank withdrawal',
          subtitle: `Withdrawal to ${bank} account ending in ${account?.slice(-4) || '****'}`,
          amount_cents: amountCents,
          type: 'withdrawal',
          status: 'completed',
          reference: `WITHDRAW-${Date.now()}`,
          created_at: now(),
        });
      }

      return json(200, {
        message: 'Withdrawal processed successfully',
        availableZar: zar((wallet.available_cents || 0) - amountCents),
      });
    }

    // -------------------------------------------------------------
    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Orders handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
};
