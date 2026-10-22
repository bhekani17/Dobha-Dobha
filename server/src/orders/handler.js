'use strict';

const dynamo = require('../utils/dynamo');
const { json, error, handleCors, withCors } = require('../utils/response');
const { requireUser } = require('../utils/auth');
const { id, now, zar } = require('../utils/id');
const {
  buildCheckoutFields,
  getCredentials,
  isPayFastSandboxEnabled,
  validateItn,
} = require('./payfast');
const {
  createTransaction: createEscrowTransaction,
  getCredentials: getEscrowCredentials,
  getTransaction: getEscrowTransaction,
  isEscrowSandboxEnabled,
  matchesOrder: escrowMatchesOrder,
  isTransactionSecured,
} = require('./escrow');

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
    deliveryMethod: ({
      uber_direct_test: 'Courier (manual test)',
      seller_pickup: 'Seller pickup (manual test)',
    })[order.delivery_method] || order.delivery_method,
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
    paymentStatus: order.payment_status || 'legacy_unverified',
    sandbox: order.sandbox_mode === true,
    providerTransactionId: order.escrow_transaction_id || null,
    item: item || {
      id: order.item_id,
      title: order.item_title || 'Thrift item',
      photos: order.item_photos || [],
    },
  };
}

exports.handler = withCors(async (event) => {
  const cors = handleCors(event);
  if (cors) return cors;

  const ordersTable = process.env.ORDERS_TABLE;
  const walletsTable = process.env.WALLET_TABLE || process.env.WALLETS_TABLE;
  const transactionsTable = process.env.TRANSACTIONS_TABLE;
  const notificationsTable = process.env.NOTIFICATIONS_TABLE;
  const itemsTable = process.env.ITEMS_TABLE;
  const sandboxEnabled = isPayFastSandboxEnabled();
  const escrowSandboxEnabled = isEscrowSandboxEnabled();
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const method = (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '').toUpperCase();

  if (path === '/api/payments/payfast/itn' && method === 'POST') {
    if (!sandboxEnabled) return error(503, 'PayFast sandbox notifications are disabled');
    try {
      const credentials = await getCredentials();
      const result = await validateItn(event, credentials);
      if (!result.valid) return error(400, 'PayFast sandbox notification was not validated');

      const { fields } = result;
      if (
        fields.merchant_id !== credentials.merchantId ||
        fields.payment_status !== 'COMPLETE' ||
        !fields.m_payment_id ||
        !fields.pf_payment_id
      ) {
        return error(400, 'PayFast sandbox notification does not match a completed order');
      }

      const order = await dynamo.get(ordersTable, { id: fields.m_payment_id });
      if (
        !order ||
        order.sandbox_mode !== true ||
        order.payment_method !== 'payfast_sandbox' ||
        Number(fields.amount_gross).toFixed(2) !== (order.total_cents / 100).toFixed(2)
      ) {
        return error(409, 'PayFast sandbox notification does not match an eligible order');
      }
      if (
        order.status === 'sandboxPaymentVerified' &&
        order.payment_status === 'sandbox_verified' &&
        order.provider_payment_id === fields.pf_payment_id
      ) {
        return json(200, { message: 'Sandbox notification was already recorded; no real funds were moved' });
      }
      if (order.status !== 'sellerAccepted' || order.payment_status !== 'checkout_created') {
        return error(409, 'PayFast sandbox notification does not match an eligible order');
      }

      await dynamo.update({
        TableName: ordersTable,
        Key: { id: order.id },
        UpdateExpression: 'SET #st = :status, payment_status = :payment, provider_payment_id = :provider, paid_at = :time',
        ConditionExpression: '#st = :expected AND payment_status = :expected_payment AND attribute_not_exists(provider_payment_id)',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':status': 'sandboxPaymentVerified',
          ':payment': 'sandbox_verified',
          ':provider': fields.pf_payment_id,
          ':time': now(),
          ':expected': 'sellerAccepted',
          ':expected_payment': 'checkout_created',
        },
      });

      await sendNotification(notificationsTable, order.seller_id, {
        kind: 'order_paid_sandbox',
        title: 'Sandbox payment confirmed',
        body: `A PayFast sandbox payment was confirmed for "${order.item_title}". This is a test only; no funds were received or paid out.`,
        orderId: order.id,
        itemId: order.item_id,
      });
      return json(200, { message: 'Sandbox notification validated; no real funds were moved' });
    } catch (err) {
      console.error('PayFast sandbox notification failed:', err);
      return error(err.statusCode || 503, 'PayFast sandbox notification could not be validated');
    }
  }

  if (method === 'POST') {
    if (path === '/api/orders' && !sandboxEnabled && !escrowSandboxEnabled) {
      return error(503, 'Payments are disabled until verified payment processing is integrated');
    }
    if (/^\/api\/orders\/[^/]+\/dispatch$/.test(path)) {
      return error(503, 'Order fulfillment is disabled until verified payment processing is integrated');
    }
    if (/^\/api\/orders\/[^/]+\/dispute$/.test(path)) {
      return error(503, 'Order disputes are unavailable until verified payment processing is integrated');
    }
    if (/^\/api\/orders\/[^/]+\/confirm$/.test(path)) {
      return error(503, 'Escrow settlement is disabled until verified payment processing is integrated');
    }
    if (/^\/api\/orders\/[^/]+\/resolve$/.test(path)) {
      return error(503, 'Escrow resolution is disabled until verified payment processing is integrated');
    }
    if (path === '/api/wallet/topup') {
      return error(503, 'Wallet deposits are disabled until verified payment processing is integrated');
    }
    if (path === '/api/wallet/withdraw') {
      return error(503, 'Wallet withdrawals are disabled until verified payment processing is integrated');
    }
  }

  try {
    // -------------------------------------------------------------
    if (path === '/api/payments/sandbox-capabilities' && method === 'GET') {
      const providers = [];
      if (sandboxEnabled) providers.push('payfast_sandbox');
      if (escrowSandboxEnabled) providers.push('escrow_sandbox');
      return json(200, { providers, sandboxOnly: true });
    }

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
      const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';
      const deliveryMethod = body.deliveryMethod;
      const deliveryAddress = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : '';
      if (!itemId) return error(400, 'Choose one item to request');
      if (!['uber_direct_test', 'seller_pickup'].includes(deliveryMethod)) {
        return error(400, 'Choose a supported test delivery option');
      }
      if (deliveryAddress.length < 8 || deliveryAddress.length > 500) {
        return error(400, 'Enter a delivery or agreed pickup address');
      }
      if (!['payfast_sandbox', 'escrow_sandbox'].includes(body.paymentMethod)) {
        return error(400, 'Choose a supported test payment provider');
      }
      if (body.paymentMethod === 'payfast_sandbox' && !sandboxEnabled) {
        return error(503, 'PayFast sandbox is disabled');
      }
      if (body.paymentMethod === 'escrow_sandbox' && !escrowSandboxEnabled) {
        return error(503, 'Escrow sandbox is disabled');
      }

      const itemData = await dynamo.get(itemsTable, { id: itemId });
      if (!itemData) return error(404, 'Item not found');
      if (itemData.seller_id === user.id) return error(400, 'You cannot buy your own listing');
      const availableQuantity = itemData.quantity === undefined ? 1 : Number(itemData.quantity);
      if (
        itemData.status !== 'available' ||
        !Number.isSafeInteger(availableQuantity) ||
        availableQuantity < 1
      ) {
        return error(409, 'This listing is no longer available');
      }
      const totalCents = Number(itemData.price_cents);
      if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
        return error(409, 'This listing has an invalid price');
      }
      const orderId = id('ord');
      const order = {
        id: orderId,
        buyer_id: user.id,
        buyer_name: user.name,
        seller_id: itemData.seller_id,
        item_id: itemData.id,
        item_title: itemData.title || 'Thrift item',
        item_photos: itemData.photos || [],
        amount_cents: totalCents,
        shipping_cents: 0,
        total_cents: totalCents,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress,
        payment_method: 'payfast_sandbox',
        payment_status: 'not_started',
        status: 'sellerApprovalPending',
        sandbox_mode: true,
        created_at: now(),
      };
      order.payment_method = body.paymentMethod;
      if (body.paymentMethod === 'escrow_sandbox') {
        const buyer = await dynamo.get(process.env.USERS_TABLE, { id: user.id });
        const seller = await dynamo.get(process.env.USERS_TABLE, { id: itemData.seller_id });
        if (!buyer?.email || !seller?.email) {
          return error(409, 'Buyer and seller accounts need email addresses for Escrow sandbox');
        }
      }

      await dynamo.put(ordersTable, order, 'attribute_not_exists(id)');

      await sendNotification(notificationsTable, order.seller_id, {
        kind: 'order_placed',
        title: 'Sandbox order request',
        body: `A test order request was made for "${order.item_title}". Accept or decline it; no payment has been made.`,
        orderId: orderId,
        itemId: order.item_id,
      });

      return json(201, { order: formatOrder(order, user.id, itemData) });
    }

    const sandboxOrderAction = path.match(/^\/api\/orders\/([^/]+)\/(accept|decline|cancel-test|prepare|ready|dispatch-test|deliver-test|confirm-test|payment-session|escrow-refresh-test)$/);
    if (sandboxOrderAction && method === 'POST') {
      if (!sandboxEnabled && !escrowSandboxEnabled) return error(503, 'Sandbox order workflow is disabled');
      const user = await requireUser(event);
      const [, targetOrderId, action] = sandboxOrderAction;
      const order = await dynamo.get(ordersTable, { id: targetOrderId });
      if (!order || order.sandbox_mode !== true) return error(404, 'Sandbox order not found');

      if (action === 'payment-session') {
        if (order.buyer_id !== user.id) return error(403, 'Only the buyer can start payment');
        if (order.payment_method === 'escrow_sandbox') {
          if (!escrowSandboxEnabled) return error(503, 'Escrow sandbox is disabled');
          if (order.status === 'escrowSandboxTransactionCreated' && order.escrow_transaction_id) {
            return json(200, {
              sandbox: true,
              transactionId: String(order.escrow_transaction_id),
              paymentStatus: order.payment_status,
              message: 'Escrow sandbox transaction already exists. Funding and release are handled by Escrow, not Dobha.',
            });
          }
          if (order.status !== 'sellerAccepted' || order.payment_status !== 'not_started') {
            return error(409, 'The seller must accept the order before creating an Escrow sandbox transaction');
          }
          const credentials = await getEscrowCredentials();
          const buyer = await dynamo.get(process.env.USERS_TABLE, { id: order.buyer_id });
          const seller = await dynamo.get(process.env.USERS_TABLE, { id: order.seller_id });
          if (!buyer?.email || !seller?.email) {
            return error(409, 'Buyer and seller accounts need email addresses for Escrow sandbox');
          }
          await dynamo.update({
            TableName: ordersTable,
            Key: { id: order.id },
            UpdateExpression: 'SET payment_status = :creating, updated_at = :time',
            ConditionExpression: '#st = :status AND payment_status = :pending',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
              ':creating': 'escrow_sandbox_creating',
              ':time': now(),
              ':status': 'sellerAccepted',
              ':pending': 'not_started',
            },
          });
          const transaction = await createEscrowTransaction({
            credentials,
            order,
            buyerEmail: buyer.email.toLowerCase(),
            sellerEmail: seller.email.toLowerCase(),
          });
          await dynamo.update({
            TableName: ordersTable,
            Key: { id: order.id },
            UpdateExpression: 'SET #st = :created, payment_status = :pending, escrow_transaction_id = :transaction_id, updated_at = :time',
            ConditionExpression: 'payment_status = :creating',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
              ':created': 'escrowSandboxTransactionCreated',
              ':pending': 'escrow_sandbox_pending',
              ':creating': 'escrow_sandbox_creating',
              ':transaction_id': String(transaction.id),
              ':time': now(),
            },
          });
          return json(200, {
            sandbox: true,
            transactionId: String(transaction.id),
            paymentStatus: 'escrow_sandbox_pending',
            message: 'Escrow sandbox transaction created. Confirm/fund it in Escrow sandbox; Dobha has not verified payment or moved funds.',
          });
        }
        if (!sandboxEnabled || order.status !== 'sellerAccepted' || !['not_started', 'checkout_created'].includes(order.payment_status)) {
          return error(409, 'The seller must accept the order before sandbox payment');
        }
        const credentials = await getCredentials();
        const checkout = buildCheckoutFields({
          credentials,
          order,
          siteUrl: process.env.SITE_BASE_URL,
          apiUrl: process.env.API_BASE_URL,
        });
        if (order.payment_status === 'not_started') {
          await dynamo.update({
            TableName: ordersTable,
            Key: { id: order.id },
            UpdateExpression: 'SET payment_status = :checkout, updated_at = :time',
            ConditionExpression: '#st = :status AND payment_status = :pending',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
              ':checkout': 'checkout_created',
              ':time': now(),
              ':status': 'sellerAccepted',
              ':pending': 'not_started',
            },
          });
        }
        return json(200, { ...checkout, sandbox: true });
      }
      if (action === 'escrow-refresh-test') {
        if (!escrowSandboxEnabled) return error(503, 'Escrow sandbox is disabled');
        if (![order.buyer_id, order.seller_id].includes(user.id)) {
          return error(403, 'Only the buyer or seller can refresh this test transaction');
        }
        if (!order.escrow_transaction_id || order.payment_method !== 'escrow_sandbox') {
          return error(409, 'This order has no Escrow sandbox transaction');
        }
        const credentials = await getEscrowCredentials();
        const transaction = await getEscrowTransaction(order.escrow_transaction_id, credentials);
        if (String(transaction.id) !== String(order.escrow_transaction_id)) {
          return error(502, 'Escrow returned a different transaction than the order references');
        }
        const buyer = await dynamo.get(process.env.USERS_TABLE, { id: order.buyer_id });
        const seller = await dynamo.get(process.env.USERS_TABLE, { id: order.seller_id });
        if (!buyer?.email || !seller?.email) {
          return error(409, 'Buyer and seller accounts need email addresses for Escrow sandbox');
        }
        if (!escrowMatchesOrder(transaction, {
          ...order,
          buyer_email: buyer.email,
          seller_email: seller.email,
        })) {
          return error(409, 'Escrow sandbox transaction does not match this order');
        }
        const secured = isTransactionSecured(transaction);
        if (secured && order.payment_status !== 'escrow_sandbox_secured') {
          await dynamo.update({
            TableName: ordersTable,
            Key: { id: order.id },
            UpdateExpression: 'SET #st = :verified, payment_status = :secured, paid_at = :time, updated_at = :time',
            ConditionExpression: '#st = :created AND payment_status = :pending',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
              ':verified': 'sandboxPaymentVerified',
              ':secured': 'escrow_sandbox_secured',
              ':created': 'escrowSandboxTransactionCreated',
              ':pending': 'escrow_sandbox_pending',
              ':time': now(),
            },
          });
          order.status = 'sandboxPaymentVerified';
          order.payment_status = 'escrow_sandbox_secured';
        }
        return json(200, {
          sandbox: true,
          secured,
          paymentStatus: order.payment_status,
          message: secured
            ? 'Escrow sandbox reports funds secured. This is test-only and does not cause a Dobha wallet credit or seller payout.'
            : 'Escrow sandbox does not report secured funds yet. No payment or payout is recorded by Dobha.',
        });
      }

      let expectedStatus;
      let nextStatus;
      let actorId;
      if (action === 'accept') {
        if (order.seller_id !== user.id) return error(403, 'Only the seller can accept this order');
        if (order.status !== 'sellerApprovalPending') return error(409, 'This order is no longer awaiting seller approval');
        const listing = await dynamo.get(itemsTable, { id: order.item_id });
        if (!listing || listing.status !== 'available') return error(409, 'This listing is no longer available');
        const quantity = listing.quantity === undefined ? 1 : Number(listing.quantity);
        if (!Number.isSafeInteger(quantity) || quantity < 1) return error(409, 'This listing has no available stock');
        const quantityCondition = listing.quantity === undefined
          ? 'attribute_not_exists(quantity)'
          : 'quantity = :quantity';
        const reserveListing = quantity === 1
          ? {
            Update: {
              TableName: itemsTable,
              Key: { id: listing.id },
              UpdateExpression: 'SET #st = :reserved, reserved_order_id = :order',
              ConditionExpression: `#st = :available AND ${quantityCondition}`,
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':reserved': 'reserved',
                ':available': 'available',
                ...(listing.quantity === undefined ? {} : { ':quantity': quantity }),
                ':order': order.id,
              },
            },
          }
          : {
            Update: {
              TableName: itemsTable,
              Key: { id: listing.id },
              UpdateExpression: 'ADD quantity :decrement',
              ConditionExpression: `#st = :available AND ${quantityCondition}`,
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':decrement': -1,
                ':available': 'available',
                ':quantity': quantity,
              },
            },
          };
        await dynamo.transactWrite([
          reserveListing,
          {
            Update: {
              TableName: ordersTable,
              Key: { id: order.id },
              UpdateExpression: 'SET #st = :accepted, inventory_action = :inventory_action, updated_at = :time',
              ConditionExpression: '#st = :pending',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':accepted': 'sellerAccepted',
                ':pending': 'sellerApprovalPending',
                ':inventory_action': quantity === 1 ? 'reserved' : 'decremented',
                ':time': now(),
              },
            },
          },
        ]);
        order.status = 'sellerAccepted';
        order.inventory_action = quantity === 1 ? 'reserved' : 'decremented';
        await sendNotification(notificationsTable, order.buyer_id, {
          kind: 'order_seller_accepted',
          title: 'Seller accepted your test order',
          body: `The seller accepted "${order.item_title}". Continue to PayFast sandbox; no payment has been made yet.`,
          orderId: order.id,
          itemId: order.item_id,
        });
        return json(200, {
          message: 'Seller accepted the sandbox order; the listing was reserved, but no payment or payout occurred',
          order: formatOrder(order, user.id),
        });
      } else if (action === 'decline') {
        if (order.seller_id !== user.id) return error(403, 'Only the seller can decline this order');
        expectedStatus = 'sellerApprovalPending';
        nextStatus = 'sellerDeclined';
        actorId = order.seller_id;
      } else if (action === 'cancel-test') {
        if (![order.seller_id, order.buyer_id].includes(user.id)) return error(403, 'Only the buyer or seller can cancel this order');
        if (order.status !== 'sellerAccepted' || order.payment_status !== 'not_started') {
          return error(409, 'This order can no longer be cancelled in the sandbox workflow');
        }
        const listingUpdate = order.inventory_action === 'reserved'
          ? {
            Update: {
              TableName: itemsTable,
              Key: { id: order.item_id },
              UpdateExpression: 'SET #st = :available REMOVE reserved_order_id',
              ConditionExpression: '#st = :reserved AND reserved_order_id = :order',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':available': 'available',
                ':reserved': 'reserved',
                ':order': order.id,
              },
            },
          }
          : {
            Update: {
              TableName: itemsTable,
              Key: { id: order.item_id },
              UpdateExpression: 'ADD quantity :increment',
              ConditionExpression: '#st = :available',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: { ':increment': 1, ':available': 'available' },
            },
          };
        await dynamo.transactWrite([
          listingUpdate,
          {
            Update: {
              TableName: ordersTable,
              Key: { id: order.id },
              UpdateExpression: 'SET #st = :cancelled, updated_at = :time',
              ConditionExpression: '#st = :accepted AND payment_status = :pending',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':cancelled': 'cancelled',
                ':accepted': 'sellerAccepted',
                ':pending': 'not_started',
                ':time': now(),
              },
            },
          },
        ]);
        order.status = 'cancelled';
        return json(200, {
          message: 'Sandbox order cancelled and listing availability restored; no payment or payout occurred',
          order: formatOrder(order, user.id),
        });
      } else if (action === 'prepare') {
        expectedStatus = 'sandboxPaymentVerified';
        nextStatus = 'preparingTest';
        actorId = order.seller_id;
      } else if (action === 'ready') {
        expectedStatus = 'preparingTest';
        nextStatus = order.delivery_method === 'seller_pickup' ? 'readyForCollectionTest' : 'readyForCourierTest';
        actorId = order.seller_id;
      } else if (action === 'dispatch-test') {
        expectedStatus = 'readyForCourierTest';
        nextStatus = 'inTransitTest';
        actorId = order.seller_id;
      } else if (action === 'deliver-test') {
        expectedStatus = order.delivery_method === 'seller_pickup' ? 'readyForCollectionTest' : 'inTransitTest';
        nextStatus = 'deliveryReportedTest';
        actorId = order.seller_id;
      } else {
        expectedStatus = 'deliveryReportedTest';
        nextStatus = 'buyerConfirmedTest';
        actorId = order.buyer_id;
      }
      if (user.id !== actorId) {
        return error(403, action === 'confirm-test' ? 'Only the buyer can confirm collection' : 'Only the assigned party can update this order');
      }

      const updateValues = {
        ':expected': expectedStatus,
        ':status': nextStatus,
        ':time': now(),
      };
      let updateExpression = 'SET #st = :status, updated_at = :time';
      if (action === 'dispatch-test') {
        const body = JSON.parse(event.body || '{}');
        const tracking = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim().slice(0, 100) : '';
        updateExpression += ', tracking = :tracking, dispatched_at = :time';
        updateValues[':tracking'] = tracking;
      }
      if (action === 'confirm-test' && order.inventory_action === 'reserved') {
        await dynamo.transactWrite([
          {
            Update: {
              TableName: ordersTable,
              Key: { id: order.id },
              UpdateExpression: `${updateExpression}, buyer_completion_reported = :confirmed, confirmed_at = :time`,
              ConditionExpression: '#st = :expected',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: { ...updateValues, ':confirmed': true },
            },
          },
          {
            Update: {
              TableName: itemsTable,
              Key: { id: order.item_id },
              UpdateExpression: 'SET #st = :sold REMOVE reserved_order_id',
              ConditionExpression: '#st = :reserved AND reserved_order_id = :order',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':sold': 'sold',
                ':reserved': 'reserved',
                ':order': order.id,
              },
            },
          },
        ]);
      } else {
        await dynamo.update({
          TableName: ordersTable,
          Key: { id: order.id },
          UpdateExpression: action === 'deliver-test'
            ? `${updateExpression}, seller_completion_reported = :reported`
            : action === 'confirm-test'
              ? `${updateExpression}, buyer_completion_reported = :reported, confirmed_at = :time`
              : updateExpression,
          ConditionExpression: '#st = :expected',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: action === 'deliver-test' || action === 'confirm-test'
            ? { ...updateValues, ':reported': true }
            : updateValues,
        });
      }

      order.status = nextStatus;
      if (action === 'dispatch-test') order.tracking = updateValues[':tracking'];
      await sendNotification(notificationsTable, actorId === order.seller_id ? order.buyer_id : order.seller_id, {
        kind: `order_${nextStatus}`,
        title: 'Sandbox order updated',
        body: `Test order for "${order.item_title}" is now ${nextStatus}. Delivery and payment are not live; no seller payout was made.`,
        orderId: order.id,
        itemId: order.item_id,
      });
      return json(200, {
        message: 'Sandbox order updated; no real payment, delivery verification, or seller payout occurred',
        order: formatOrder(order, user.id),
      });
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
    if (err.name === 'ConditionalCheckFailedException' || err.name === 'TransactionCanceledException') {
      return error(409, 'This sandbox order or listing changed; refresh and try again');
    }
    return error(err.statusCode || 500, err.message || 'Internal Server Error');
  }
});
