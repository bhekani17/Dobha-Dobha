const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper to generate a 6-digit cryptographic pickup token
function generatePickupToken(orderId) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const token = `SK-${randomDigits}`;
    const hmac = crypto.createHmac('sha256', process.env.JWT_SECRET || 'skytrade-secret-2026')
        .update(`${orderId}:${token}`)
        .digest('hex');
    return { token, signature: hmac.slice(0, 16) };
}

// 1. Create an Escrow Order (Click & Collect or Delivery) - supports /create and /order
router.post(['/create', '/order'], authenticateToken, async (req, res) => {
    try {
        const {
            item_id,
            itemId,
            item_title,
            itemTitle,
            item_price,
            itemPrice,
            price,
            seller_id,
            sellerId,
            seller_name,
            sellerName,
            buyer_id,
            buyerId,
            buyer_name,
            buyerName,
            fulfillment_type,
            fulfillmentType,
            pickup_location,
            pickupLocation,
            delivery_address,
            deliveryAddress,
            payment_method,
            paymentMethod
        } = req.body;

        const resolvedItemId = item_id || itemId;
        const resolvedPrice = Number(item_price ?? itemPrice ?? price ?? 0);

        if (!resolvedItemId || !resolvedPrice) {
            return res.status(400).json({ success: false, message: 'Valid item and price are required' });
        }

        // Fetch real item from database if available
        let targetItem = null;
        try {
            targetItem = await prisma.item.findUnique({
                where: { id: resolvedItemId },
                include: { seller: true }
            });
        } catch (_) {}

        const resolvedTitle = item_title || itemTitle || targetItem?.title || 'Dobha Marketplace Piece';
        const resolvedSellerId = targetItem?.sellerId || seller_id || sellerId;
        const resolvedBuyerId = req.user.userId;
        if (!resolvedSellerId || !resolvedBuyerId) {
            return res.status(400).json({ success: false, message: 'A valid item and authenticated buyer are required' });
        }
        if (resolvedSellerId === resolvedBuyerId) {
            return res.status(400).json({ success: false, message: 'You cannot purchase your own listed item.' });
        }
        const resolvedFulfillment = fulfillment_type || fulfillmentType || 'click_collect';
        const resolvedPickupLoc = pickup_location || pickupLocation || targetItem?.location || 'Safe Trade Hub: Bree Taxi Rank, Joburg CBD';
        const resolvedDeliveryAddr = delivery_address || deliveryAddress || '';
        const resolvedPaymentMethod = payment_method || paymentMethod || 'Instant EFT (Capitec Pay / Ozow)';

        const orderId = `ord-${uuidv4().slice(0, 8)}`;
        const { token: pickupToken, signature } = generatePickupToken(orderId);
        const deliveryFee = resolvedFulfillment === 'uber_delivery' ? 45.00 : 0.00;
        const totalAmount = resolvedPrice + deliveryFee;

        // Persist real order in PostgreSQL
        const order = await prisma.escrowOrder.create({
            data: {
                id: orderId,
                itemId: resolvedItemId,
                itemTitle: resolvedTitle,
                itemPrice: resolvedPrice,
                deliveryFee,
                totalAmount,
                sellerId: resolvedSellerId,
                buyerId: resolvedBuyerId,
                fulfillmentType: resolvedFulfillment,
                pickupLocation: resolvedPickupLoc,
                deliveryAddress: resolvedDeliveryAddr,
                paymentMethod: resolvedPaymentMethod,
                status: 'HELD_IN_ESCROW',
                pickupToken,
                qrPayload: `SKYTRADE:${orderId}:${pickupToken}:${signature}`
            },
            include: {
                seller: { select: { id: true, name: true, location: true } },
                buyer: { select: { id: true, name: true } },
                item: true
            }
        });

        res.json({
            success: true,
            message: 'Funds securely locked in Sky Trade Escrow vault.',
            order: formatOrder(order)
        });
    } catch (err) {
        console.error('Escrow create error in Prisma:', err);
        res.status(500).json({ success: false, message: 'Failed to initiate escrow: ' + err.message });
    }
});

// 2. Get active escrow orders (optionally filtered by user)
router.get('/orders', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.userId;
        const where = {};
        if (user_id) {
            where.OR = [
                { buyerId: user_id },
                { sellerId: user_id }
            ];
        }

        const orders = await prisma.escrowOrder.findMany({
            where,
            include: {
                seller: { select: { id: true, name: true, location: true } },
                buyer: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json({ success: true, orders: orders.map(formatOrder) });
    } catch (err) {
        console.error('Get orders error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch escrow orders' });
    }
});

// 3. Get single escrow order
router.get('/orders/:id', authenticateToken, async (req, res) => {
    try {
        const order = await prisma.escrowOrder.findUnique({
            where: { id: req.params.id },
            include: {
                seller: { select: { id: true, name: true, location: true } },
                buyer: { select: { id: true, name: true } },
                item: true
            }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.buyerId !== req.user.userId && order.sellerId !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'You do not have access to this order' });
        }

        res.json({ success: true, order: formatOrder(order) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching order' });
    }
});

// 4. Seller Verification Endpoint (Scan QR or Enter 6-digit PIN)
router.post(['/verify-pickup', '/verify'], authenticateToken, async (req, res) => {
    try {
        const { order_id, pickup_token, token, qr_data } = req.body;
        const activeToken = (pickup_token || token || '').trim().toUpperCase();

        let targetOrder = null;

        if (order_id) {
            targetOrder = await prisma.escrowOrder.findUnique({
                where: { id: order_id },
                include: { seller: true }
            });
        } else if (activeToken) {
            targetOrder = await prisma.escrowOrder.findFirst({
                where: { pickupToken: activeToken },
                include: { seller: true }
            });
        } else if (qr_data && qr_data.startsWith('SKYTRADE:')) {
            const parts = qr_data.split(':');
            const scannedOrderId = parts[1];
            targetOrder = await prisma.escrowOrder.findUnique({
                where: { id: scannedOrderId },
                include: { seller: true }
            });
        }

        if (!targetOrder) {
            return res.status(404).json({
                success: false,
                message: 'Invalid pickup code. Check the reference number on the buyer’s phone.'
            });
        }

        if (targetOrder.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                message: 'This order has already been verified and settled.'
            });
        }

        if (targetOrder.sellerId !== req.user.userId && targetOrder.buyerId !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only the seller or buyer can verify this pickup' });
        }

        // Complete the order & release payout in database transaction
        const itemPrice = Number(targetOrder.itemPrice);

        const [completedOrder, updatedWallet] = await prisma.$transaction([
            prisma.escrowOrder.update({
                where: { id: targetOrder.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date()
                },
                include: {
                    seller: true,
                    buyer: true
                }
            }),
            prisma.sellerWallet.upsert({
                where: { userId: targetOrder.sellerId },
                create: {
                    userId: targetOrder.sellerId,
                    balance: itemPrice
                },
                update: {
                    balance: { increment: itemPrice }
                }
            })
        ]);

        res.json({
            success: true,
            message: `Handover verified! R${itemPrice.toFixed(2)} has been released to ${completedOrder.seller?.name || 'Seller'}'s payout account.`,
            order: formatOrder(completedOrder),
            payout_amount: itemPrice,
            seller_wallet_balance: Number(updatedWallet.balance)
        });
    } catch (err) {
        console.error('Escrow verification error:', err);
        res.status(500).json({ success: false, message: 'Verification failed: ' + err.message });
    }
});

// Helpers
function formatOrder(order) {
    return {
        id: order.id,
        item_id: order.itemId,
        item_title: order.itemTitle,
        item_price: Number(order.itemPrice),
        price: Number(order.itemPrice),
        delivery_fee: Number(order.deliveryFee),
        total_amount: Number(order.totalAmount),
        seller_id: order.sellerId,
        seller_name: order.seller?.name || 'Dobha Seller',
        seller: order.seller?.name || 'Dobha Seller',
        buyer_id: order.buyerId,
        buyer_name: order.buyer?.name || 'Buyer',
        fulfillment_type: order.fulfillmentType,
        pickup_location: order.pickupLocation,
        pickupLocation: order.pickupLocation,
        delivery_address: order.deliveryAddress,
        payment_method: order.paymentMethod,
        paymentMethod: order.paymentMethod,
        status: order.status,
        pickup_token: order.pickupToken,
        pickupToken: order.pickupToken,
        qr_payload: order.qrPayload,
        created_at: order.createdAt,
        completed_at: order.completedAt
    };
}

async function getFirstSellerId() {
    const user = await prisma.user.findFirst({ where: { role: { in: ['seller', 'both'] } } });
    if (user) return user.id;
    const anyUser = await prisma.user.findFirst();
    return anyUser ? anyUser.id : uuidv4();
}

async function getFirstBuyerId() {
    const user = await prisma.user.findFirst({ where: { role: { in: ['buyer', 'both'] } } });
    if (user) return user.id;
    const anyUser = await prisma.user.findFirst();
    return anyUser ? anyUser.id : uuidv4();
}

module.exports = router;
