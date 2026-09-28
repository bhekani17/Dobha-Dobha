const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { prisma } = require('../prisma');

const router = express.Router();

// 1. Get conversations for current user
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const currentUserId = req.user.userId;

        const allMessages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: currentUserId },
                    { receiverId: currentUserId }
                ]
            },
            include: {
                sender: { select: { id: true, name: true, avatarUrl: true } },
                receiver: { select: { id: true, name: true, avatarUrl: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Group by conversation partner
        const conversationMap = new Map();
        for (const msg of allMessages) {
            const isSender = msg.senderId === currentUserId;
            const partner = isSender ? msg.receiver : msg.sender;
            const partnerId = partner.id;

            if (!conversationMap.has(partnerId)) {
                conversationMap.set(partnerId, {
                    other_user: {
                        id: partner.id,
                        name: partner.name,
                        avatar_url: partner.avatarUrl
                    },
                    last_message: msg.content,
                    last_message_at: msg.createdAt,
                    unread_count: (!msg.isRead && !isSender) ? 1 : 0
                });
            } else if (!msg.isRead && !isSender) {
                const conv = conversationMap.get(partnerId);
                conv.unread_count += 1;
            }
        }

        res.json({ success: true, conversations: Array.from(conversationMap.values()) });
    } catch (error) {
        next(error);
    }
});

// 2. Get messages between current user and another user
router.get(['/thread/:userId', '/:userId'], authenticateToken, async (req, res, next) => {
    try {
        const currentUserId = req.user.userId;
        const otherId = req.params.userId;

        const thread = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: currentUserId, receiverId: otherId },
                    { senderId: otherId, receiverId: currentUserId }
                ]
            },
            include: {
                sender: { select: { id: true, name: true, avatarUrl: true } },
                receiver: { select: { id: true, name: true, avatarUrl: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Mark incoming messages as read
        await prisma.message.updateMany({
            where: {
                senderId: otherId,
                receiverId: currentUserId,
                isRead: false
            },
            data: { isRead: true }
        });

        const formatted = thread.map(msg => ({
            id: msg.id,
            sender_id: msg.senderId,
            sender_name: msg.sender?.name || 'User',
            receiver_id: msg.receiverId,
            receiver_name: msg.receiver?.name || 'User',
            item_id: msg.itemId,
            content: msg.content,
            is_read: msg.isRead,
            created_at: msg.createdAt
        }));

        res.json({ success: true, messages: formatted });
    } catch (error) {
        next(error);
    }
});

// 3. Send a message (supports POST /api/messages and POST /api/messages/send)
router.post(['/send', '/'], authenticateToken, async (req, res, next) => {
    try {
        const { receiver_id, receiverId, item_id, itemId, content } = req.body;
        const resolvedReceiverId = receiver_id || receiverId;
        const resolvedItemId = item_id || itemId || null;

        if (!resolvedReceiverId || !content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Receiver ID and content are required' });
        }

        const msg = await prisma.message.create({
            data: {
                senderId: req.user.userId,
                receiverId: resolvedReceiverId,
                itemId: resolvedItemId,
                content: content.trim(),
                isRead: false
            },
            include: {
                sender: { select: { id: true, name: true, avatarUrl: true } },
                receiver: { select: { id: true, name: true, avatarUrl: true } }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Message sent',
            data: {
                id: msg.id,
                sender_id: msg.senderId,
                sender_name: msg.sender?.name,
                receiver_id: msg.receiverId,
                receiver_name: msg.receiver?.name,
                item_id: msg.itemId,
                content: msg.content,
                is_read: msg.isRead,
                created_at: msg.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
});

// 4. Mark single message as read
router.put('/:id/read', authenticateToken, async (req, res, next) => {
    try {
        await prisma.message.updateMany({
            where: {
                id: req.params.id,
                receiverId: req.user.userId
            },
            data: { isRead: true }
        });
        res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
