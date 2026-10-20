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
    // No payment provider is configured, so checkout cannot create orders or reserve inventory.
    if (path === '/api/orders' && method === 'POST') {
      return error(503, 'Payments are disabled until verified payment processing is integrated');
    }

    // -------------------------------------------------------------
    // No payment provider is configured, so unpaid legacy orders cannot be fulfilled.
    const dispatchMatch = path.match(/^\/api\/orders\/([^\/]+)\/dispatch$/);
    if (dispatchMatch && method === 'POST') {
      return error(503, 'Order fulfillment is disabled until verified payment processing is integrated');
    }

    // -------------------------------------------------------------
    // Escrow settlement remains unavailable until verified payment processing exists.
    const confirmMatch = path.match(/^\/api\/orders\/([^\/]+)\/confirm$/);
    if (confirmMatch && method === 'POST') {
      return error(503, 'Escrow settlement is disabled until verified payment processing is integrated');
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
    // Dispute resolution must not move unverified wallet balances.
    const resolveMatch = path.match(/^\/api\/orders\/([^\/]+)\/resolve$/);
    if (resolveMatch && method === 'POST') {
      return error(503, 'Escrow resolution is disabled until verified payment processing is integrated');
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
      return error(503, 'Wallet deposits are disabled until verified payment processing is integrated');
    }

    // -------------------------------------------------------------
    // POST /api/wallet/withdraw: Seamless bank withdrawal of earnings
    if (path.endsWith('/api/wallet/withdraw') && method === 'POST') {
      return error(503, 'Wallet withdrawals are disabled until verified payout processing is integrated');
    }

    // -------------------------------------------------------------
    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error('Orders handler error:', err);
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
};
