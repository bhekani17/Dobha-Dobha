const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const Message = require('../models/Message');

const router = express.Router();

// 1. Get conversations for current user
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const currentUserId = req.user.userId;

        const allMessages = await Message.find({
            $or: [{ sender: currentUserId }, { receiver: currentUserId }]
        })
            .populate('sender', 'name avatarUrl')
            .populate('receiver', 'name avatarUrl')
            .sort({ createdAt: -1 });

        const conversationMap = new Map();
        for (const msg of allMessages) {
            const isSender = msg.sender._id.toString() === currentUserId;
            const partner = isSender ? msg.receiver : msg.sender;
            const partnerId = partner._id.toString();

            if (!conversationMap.has(partnerId)) {
                conversationMap.set(partnerId, {
                    other_user: { id: partnerId, name: partner.name, avatar_url: partner.avatarUrl },
                    last_message: msg.content,
                    last_message_at: msg.createdAt,
                    unread_count: (!msg.isRead && !isSender) ? 1 : 0
                });
            } else if (!msg.isRead && !isSender) {
                conversationMap.get(partnerId).unread_count += 1;
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

        const thread = await Message.find({
            $or: [
                { sender: currentUserId, receiver: otherId },
                { sender: otherId, receiver: currentUserId }
            ]
        })
            .populate('sender', 'name avatarUrl')
            .populate('receiver', 'name avatarUrl')
            .sort({ createdAt: 1 });

        await Message.updateMany(
            { sender: otherId, receiver: currentUserId, isRead: false },
            { isRead: true }
        );

        const formatted = thread.map(msg => ({
            id: msg.id,
            sender_id: msg.sender._id.toString(),
            sender_name: msg.sender?.name || 'User',
            receiver_id: msg.receiver._id.toString(),
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

// 3. Send a message
router.post(['/send', '/'], authenticateToken, async (req, res, next) => {
    try {
        const { receiver_id, receiverId, item_id, itemId, content } = req.body;
        const resolvedReceiverId = receiver_id || receiverId;
        const resolvedItemId = item_id || itemId || null;

        if (!resolvedReceiverId || !content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Receiver ID and content are required' });
        }

        const msg = new Message({
            sender: req.user.userId,
            receiver: resolvedReceiverId,
            itemId: resolvedItemId,
            content: content.trim(),
            isRead: false
        });
        await msg.save();
        await msg.populate('sender', 'name avatarUrl');
        await msg.populate('receiver', 'name avatarUrl');

        res.status(201).json({
            success: true,
            message: 'Message sent',
            data: {
                id: msg.id,
                sender_id: msg.sender._id.toString(),
                sender_name: msg.sender?.name,
                receiver_id: msg.receiver._id.toString(),
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
        await Message.updateOne({ _id: req.params.id, receiver: req.user.userId }, { isRead: true });
        res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
