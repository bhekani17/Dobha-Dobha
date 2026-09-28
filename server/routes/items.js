const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { prisma } = require('../prisma');

const router = express.Router();

// Helper to format item response cleanly
function formatItem(item) {
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
        seller: item.seller ? {
            id: item.seller.id,
            name: item.seller.name,
            avatar_url: item.seller.avatarUrl,
            location: item.seller.location,
            verification_status: item.seller.verificationStatus
        } : null,
        seller_id: item.sellerId,
        seller_name: item.seller ? item.seller.name : 'Verified Seller',
        images: item.images && item.images.length > 0
            ? item.images.map(img => img.imageUrl)
            : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80']
    };
}

// 1. List items with optional filtering and sorting
router.get('/', async (req, res, next) => {
    try {
        const {
            category,
            location,
            condition,
            min_price,
            max_price,
            search,
            sort = 'newest',
            page = 1,
            limit = 20,
            seller_id,
            sellerId,
            status
        } = req.query;

        const where = {};
        if (status && status !== 'all') {
            where.status = status;
        } else if (!status) {
            where.status = 'active';
        }

        const targetSeller = seller_id || sellerId;
        if (targetSeller) {
            where.sellerId = targetSeller;
        }

        if (category && category !== 'all') {
            where.category = { equals: category, mode: 'insensitive' };
        }
        if (location) {
            where.location = { contains: location, mode: 'insensitive' };
        }
        if (condition && condition !== 'all') {
            where.condition = { equals: condition, mode: 'insensitive' };
        }
        if (min_price || max_price) {
            where.price = {};
            if (min_price) where.price.gte = Number(min_price);
            if (max_price) where.price.lte = Number(max_price);
        }
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } }
            ];
        }

        let orderBy = { createdAt: 'desc' };
        if (sort === 'price-low') {
            orderBy = { price: 'asc' };
        } else if (sort === 'price-high') {
            orderBy = { price: 'desc' };
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        const [items, total] = await Promise.all([
            prisma.item.findMany({
                where,
                include: {
                    images: true,
                    seller: {
                        select: {
                            id: true,
                            name: true,
                            avatarUrl: true,
                            location: true,
                            verificationStatus: true
                        }
                    }
                },
                orderBy,
                skip,
                take: limitNum
            }),
            prisma.item.count({ where })
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
        if (!q) {
            return res.status(400).json({ success: false, message: 'Search query required' });
        }

        const items = await prisma.item.findMany({
            where: {
                status: 'active',
                OR: [
                    { title: { contains: q, mode: 'insensitive' } },
                    { description: { contains: q, mode: 'insensitive' } },
                    { category: { contains: q, mode: 'insensitive' } }
                ]
            },
            include: {
                images: true,
                seller: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        location: true,
                        verificationStatus: true
                    }
                }
            },
            take: 50,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, items: items.map(formatItem) });
    } catch (error) {
        next(error);
    }
});

// 3. Get single item
router.get('/:id', async (req, res, next) => {
    try {
        const item = await prisma.item.findUnique({
            where: { id: req.params.id },
            include: {
                images: true,
                seller: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        location: true,
                        verificationStatus: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!item || item.status === 'deleted') {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        res.json({ success: true, item: formatItem(item) });
    } catch (error) {
        next(error);
    }
});

// 4. Create item (Requires Authentication)
router.post('/', authenticateToken, async (req, res, next) => {
    try {
        const { title, description, category, condition, price, original_price, location, images } = req.body;

        if (!title || !description || !category || !condition || !price) {
            return res.status(400).json({
                success: false,
                message: 'Title, description, category, condition, and price are required'
            });
        }

        const imageList = Array.isArray(images) && images.length > 0
            ? images
            : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80'];

        const newItem = await prisma.item.create({
            data: {
                title: title.trim(),
                description: description.trim(),
                category: category.toLowerCase().trim(),
                condition: condition.trim(),
                price: Number(price),
                originalPrice: original_price ? Number(original_price) : null,
                location: location ? location.trim() : null,
                sellerId: req.user.userId,
                status: 'active',
                images: {
                    create: imageList.map((url, idx) => ({
                        imageUrl: url,
                        isPrimary: idx === 0
                    }))
                }
            },
            include: {
                images: true,
                seller: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        location: true,
                        verificationStatus: true
                    }
                }
            }
        });

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
        const existing = await prisma.item.findUnique({ where: { id: req.params.id } });

        if (!existing || existing.status === 'deleted') {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (existing.sellerId !== req.user.userId && req.user.role !== 'admin') {
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

        const updated = await prisma.item.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                images: true,
                seller: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        location: true,
                        verificationStatus: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'Item updated successfully',
            item: formatItem(updated)
        });
    } catch (error) {
        next(error);
    }
});

// 6. Delete item (Soft delete)
router.delete('/:id', authenticateToken, async (req, res, next) => {
    try {
        const existing = await prisma.item.findUnique({ where: { id: req.params.id } });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (existing.sellerId !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this item' });
        }

        await prisma.item.update({
            where: { id: req.params.id },
            data: { status: 'deleted' }
        });

        res.json({ success: true, message: 'Item removed from marketplace' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
