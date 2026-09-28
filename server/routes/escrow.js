const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const EscrowOrder = require('../models/EscrowOrder');
const Item = require('../models/Item');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function generatePickupToken(orderId) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const token = `SK-${randomDigits}`;
    const hmac = crypto.createHmac('sha256', process.env.JWT_SECRET || 'skytrade-secret-2026')
        .update(`${orderId}:${token}`)
        .digest('hex');
    return { token, signature: hmac.slice(0, 16) };
}

function formatOrder(order) {
    const seller = order.seller && typeof order.seller === 'object' ? order.seller : null;
    const buyer = order.buyer && typeof order.buyer === 'object' ? order.buyer : null;
    return {
        id: order._id,
        item_id: order.itemId,
        item_title: order.itemTitle,
        item_price: Number(order.itemPrice),
        price: Number(order.itemPrice),
        delivery_fee: Number(order.deliveryFee),
        total_amount: Number(order.totalAmount),
        seller_id: seller ? seller._id.toString() : order.seller?.toString(),
        seller_name: seller?.name || 'Dobha Seller',
        seller: seller?.name || 'Dobha Seller',
        buyer_id: buyer ? buyer._id.toString() : order.buyer?.toString(),
        buyer_name: buyer?.name || 'Buyer',
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

// 1. Create Escrow Order
router.post(['/create', '/order'], authenticateToken, async (req, res) => {
    try {
        const {
            item_id, itemId, item_title, itemTitle, item_price, itemPrice, price,
            seller_id, sellerId, fulfillment_type, fulfillmentType,
            pickup_location, pickupLocation, delivery_address, deliveryAddress,
            payment_method, paymentMethod
        } = req.body;

        const resolvedItemId = item_id || itemId;
        const resolvedPrice = Number(item_price ?? itemPrice ?? price ?? 0);

        if (!resolvedItemId || !resolvedPrice) {
            return res.status(400).json({ success: false, message: 'Valid item and price are required' });
        }

        let targetItem = null;
        try { targetItem = await Item.findById(resolvedItemId); } catch (_) {}

        const resolvedTitle = item_title || itemTitle || targetItem?.title || 'Dobha Marketplace Piece';
        const resolvedSellerId = targetItem?.seller?.toString() || seller_id || sellerId;
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

        const order = new EscrowOrder({
            _id: orderId,
            itemId: resolvedItemId,
            itemTitle: resolvedTitle,
            itemPrice: resolvedPrice,
            deliveryFee,
            totalAmount,
            seller: resolvedSellerId,
            buyer: resolvedBuyerId,
            fulfillmentType: resolvedFulfillment,
            pickupLocation: resolvedPickupLoc,
            deliveryAddress: resolvedDeliveryAddr,
            paymentMethod: resolvedPaymentMethod,
            status: 'HELD_IN_ESCROW',
            pickupToken,
            qrPayload: `SKYTRADE:${orderId}:${pickupToken}:${signature}`
        });
        await order.save();
        await order.populate('seller', 'name location');
        await order.populate('buyer', 'name');

        res.json({
            success: true,
            message: 'Funds securely locked in Sky Trade Escrow vault.',
            order: formatOrder(order)
        });
    } catch (err) {
        console.error('Escrow create error:', err);
        res.status(500).json({ success: false, message: 'Failed to initiate escrow: ' + err.message });
    }
});

// 2. Get active escrow orders
router.get('/orders', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const orders = await EscrowOrder.find({
            $or: [{ buyer: userId }, { seller: userId }]
        })
            .populate('seller', 'name location')
            .populate('buyer', 'name')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, orders: orders.map(formatOrder) });
    } catch (err) {
        console.error('Get orders error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch escrow orders' });
    }
});

// 3. Get single escrow order
router.get('/orders/:id', authenticateToken, async (req, res) => {
    try {
        const order = await EscrowOrder.findById(req.params.id)
            .populate('seller', 'name location')
            .populate('buyer', 'name');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const buyerId = order.buyer._id?.toString() || order.buyer.toString();
        const sellerId = order.seller._id?.toString() || order.seller.toString();
        if (buyerId !== req.user.userId && sellerId !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'You do not have access to this order' });
        }

        res.json({ success: true, order: formatOrder(order) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching order' });
    }
});

// 4. Seller Verification (Scan QR or Enter 6-digit PIN)
router.post(['/verify-pickup', '/verify'], authenticateToken, async (req, res) => {
    try {
        const { order_id, pickup_token, token, qr_data } = req.body;
        const activeToken = (pickup_token || token || '').trim().toUpperCase();

        let targetOrder = null;

        if (order_id) {
            targetOrder = await EscrowOrder.findById(order_id).populate('seller').populate('buyer');
        } else if (activeToken) {
            targetOrder = await EscrowOrder.findOne({ pickupToken: activeToken }).populate('seller').populate('buyer');
        } else if (qr_data && qr_data.startsWith('SKYTRADE:')) {
            const scannedOrderId = qr_data.split(':')[1];
            targetOrder = await EscrowOrder.findById(scannedOrderId).populate('seller').populate('buyer');
        }

        if (!targetOrder) {
            return res.status(404).json({ success: false, message: "Invalid pickup code. Check the reference number on the buyer's phone." });
        }

        if (targetOrder.status === 'COMPLETED') {
            return res.status(400).json({ success: false, message: 'This order has already been verified and settled.' });
        }

        const sellerId = targetOrder.seller._id?.toString() || targetOrder.seller.toString();
        const buyerId = targetOrder.buyer._id?.toString() || targetOrder.buyer.toString();
        if (sellerId !== req.user.userId && buyerId !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only the seller or buyer can verify this pickup' });
        }

        const itemPrice = Number(targetOrder.itemPrice);

        const [completedOrder] = await Promise.all([
            EscrowOrder.findByIdAndUpdate(
                targetOrder._id,
                { status: 'COMPLETED', completedAt: new Date() },
                { new: true }
            ).populate('seller').populate('buyer'),
            User.findByIdAndUpdate(sellerId, { $inc: { 'wallet.balance': itemPrice } })
        ]);

        const sellerName = completedOrder.seller?.name || 'Seller';
        res.json({
            success: true,
            message: `Handover verified! R${itemPrice.toFixed(2)} has been released to ${sellerName}'s payout account.`,
            order: formatOrder(completedOrder),
            payout_amount: itemPrice
        });
    } catch (err) {
        console.error('Escrow verification error:', err);
        res.status(500).json({ success: false, message: 'Verification failed: ' + err.message });
    }
});

module.exports = router;
