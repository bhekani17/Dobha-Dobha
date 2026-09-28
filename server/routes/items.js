const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const Item = require('../models/Item');

const router = express.Router();

function formatItem(item) {
    const seller = item.seller && typeof item.seller === 'object' ? item.seller : null;
    const sellerId = seller ? seller._id.toString() : item.seller?.toString();
    return {
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        condition: item.condition,
        price: Number(item.price),
        original_price: item.originalPrice ? Number(item.originalPrice) : null,
        location: item.location,
        status: item.status,
        is_verified: item.isVerified,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        seller: seller ? {
            id: seller._id.toString(),
            name: seller.name,
            avatar_url: seller.avatarUrl,
            location: seller.location,
            verification_status: seller.verificationStatus
        } : null,
        seller_id: sellerId,
        seller_name: seller ? seller.name : 'Verified Seller',
        images: item.images && item.images.length > 0
            ? item.images.map(img => img.imageUrl)
            : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80']
    };
}

// 1. List items
router.get('/', async (req, res, next) => {
    try {
        const { category, location, condition, min_price, max_price, search, sort = 'newest', page = 1, limit = 20, seller_id, sellerId, status } = req.query;

        const query = {};
        if (status && status !== 'all') query.status = status;
        else if (!status) query.status = 'active';

        const targetSeller = seller_id || sellerId;
        if (targetSeller) query.seller = targetSeller;

        if (category && category !== 'all') query.category = new RegExp(`^${category}$`, 'i');
        if (location) query.location = new RegExp(location, 'i');
        if (condition && condition !== 'all') query.condition = new RegExp(`^${condition}$`, 'i');
        if (min_price || max_price) {
            query.price = {};
            if (min_price) query.price.$gte = Number(min_price);
            if (max_price) query.price.$lte = Number(max_price);
        }
        if (search) {
            query.$or = [
                { title: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') },
                { category: new RegExp(search, 'i') }
            ];
        }

        let sortObj = { createdAt: -1 };
        if (sort === 'price-low') sortObj = { price: 1 };
        else if (sort === 'price-high') sortObj = { price: -1 };

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        const [items, total] = await Promise.all([
            Item.find(query)
                .populate('seller', 'name avatarUrl location verificationStatus')
                .sort(sortObj)
                .skip(skip)
                .limit(limitNum),
            Item.countDocuments(query)
        ]);

        res.json({
            success: true,
            items: items.map(formatItem),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum) || 1
            }
        });
    } catch (error) {
        console.error('List items error:', error);
        next(error);
    }
});

// 2. Search items
router.get('/search', async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Search query required' });

        const items = await Item.find({
            status: 'active',
            $or: [
                { title: new RegExp(q, 'i') },
                { description: new RegExp(q, 'i') },
                { category: new RegExp(q, 'i') }
            ]
        })
            .populate('seller', 'name avatarUrl location verificationStatus')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, items: items.map(formatItem) });
    } catch (error) {
        next(error);
    }
});

// 3. Get single item
router.get('/:id', async (req, res, next) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('seller', 'name avatarUrl location verificationStatus createdAt');

        if (!item || item.status === 'deleted') {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        res.json({ success: true, item: formatItem(item) });
    } catch (error) {
        next(error);
    }
});

// 4. Create item
router.post('/', authenticateToken, async (req, res, next) => {
    try {
        const { title, description, category, condition, price, original_price, location, images } = req.body;

        if (!title || !description || !category || !condition || !price) {
            return res.status(400).json({ success: false, message: 'Title, description, category, condition, and price are required' });
        }

        const imageList = Array.isArray(images) && images.length > 0
            ? images
            : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80'];

        const newItem = new Item({
            title: title.trim(),
            description: description.trim(),
            category: category.toLowerCase().trim(),
            condition: condition.trim(),
            price: Number(price),
            originalPrice: original_price ? Number(original_price) : null,
            location: location ? location.trim() : null,
            seller: req.user.userId,
            status: 'active',
            images: imageList.map((url, idx) => ({ imageUrl: url, isPrimary: idx === 0 }))
        });
        await newItem.save();
        await newItem.populate('seller', 'name avatarUrl location verificationStatus');

        res.status(201).json({
            success: true,
            message: 'Item listed successfully on DOBHA DOBHA',
            item: formatItem(newItem)
        });
    } catch (error) {
        console.error('Create item error:', error);
        next(error);
    }
});

// 5. Update item
router.put('/:id', authenticateToken, async (req, res, next) => {
    try {
        const existing = await Item.findById(req.params.id);

        if (!existing || existing.status === 'deleted') {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (existing.seller.toString() !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to edit this item' });
        }

        const { title, description, category, condition, price, original_price, location, status } = req.body;
        const updateData = {};
        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (category !== undefined) updateData.category = category.toLowerCase().trim();
        if (condition !== undefined) updateData.condition = condition.trim();
        if (price !== undefined) updateData.price = Number(price);
        if (original_price !== undefined) updateData.originalPrice = Number(original_price);
        if (location !== undefined) updateData.location = location;
        if (status !== undefined) updateData.status = status;

        const updated = await Item.findByIdAndUpdate(req.params.id, updateData, { new: true })
            .populate('seller', 'name avatarUrl location verificationStatus');

        res.json({ success: true, message: 'Item updated successfully', item: formatItem(updated) });
    } catch (error) {
        next(error);
    }
});

// 6. Delete item (soft delete)
router.delete('/:id', authenticateToken, async (req, res, next) => {
    try {
        const existing = await Item.findById(req.params.id);

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (existing.seller.toString() !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this item' });
        }

        await Item.findByIdAndUpdate(req.params.id, { status: 'deleted' });
        res.json({ success: true, message: 'Item removed from marketplace' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
