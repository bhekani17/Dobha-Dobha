const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Mux = require('@mux/mux-node');
const { authenticateToken } = require('../middleware/auth');
const { prisma } = require('../prisma');
const router = express.Router();

function getMuxClient() {
    if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) return null;
    return new Mux({
        tokenId: process.env.MUX_TOKEN_ID,
        tokenSecret: process.env.MUX_TOKEN_SECRET
    });
}

// 1. Get all active live streams
router.get('/', async (req, res, next) => {
    try {
        const streams = await prisma.stream.findMany({
            where: { status: 'live' },
            include: {
                seller: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        location: true
                    }
                },
                chats: {
                    orderBy: { createdAt: 'desc' },
                    take: 20
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formattedStreams = streams.map(stream => ({
            id: stream.id,
            title: stream.title,
            seller_id: stream.sellerId,
            seller_name: stream.seller.name,
            seller_avatar: stream.seller.avatarUrl,
            location: stream.location,
            viewer_count: stream.viewerCount,
            status: stream.status,
            started_at: stream.startedAt,
            playback_url: stream.playbackUrl,
            poster_url: stream.posterUrl,
            featured_item: stream.featuredItem,
            chat_messages: stream.chats.map(chat => ({
                id: chat.id,
                user: chat.userName,
                text: chat.text,
                reaction: chat.reaction,
                time: 'Just now'
            }))
        }));

        res.json({ success: true, streams: formattedStreams });
    } catch (error) {
        next(error);
    }
});

// 2. Start a new live stream
router.post('/start', authenticateToken, async (req, res, next) => {
    try {
        const { title, location, playback_url, poster_url, featured_item } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Stream title is required' });
        }

        const newStream = await prisma.stream.create({
            data: {
                sellerId: req.user.userId,
                title: title.trim(),
                location: location || 'Bree Taxi Rank, Joburg CBD',
                status: 'live',
                viewerCount: 1,
                playbackUrl: playback_url || null,
                posterUrl: poster_url || null,
                featuredItem: featured_item || null
            },
            include: {
                seller: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        location: true
                    }
                }
            }
        });

        // Add system message
        await prisma.streamChat.create({
            data: {
                streamId: newStream.id,
                userName: 'SYSTEM',
                text: `Broadcast started by ${newStream.seller.name} live from ${newStream.location}.`
            }
        });

        let streamKey = null;
        let playbackUrl = newStream.playbackUrl;
        const mux = getMuxClient();
        if (mux) {
            try {
                const liveStream = await mux.video.liveStreams.create({
                    playback_policy: ['public'],
                    new_asset_settings: { playback_policy: ['public'] },
                    latency_mode: 'low'
                });
                streamKey = liveStream.stream_key;
                playbackUrl = `https://stream.mux.com/${liveStream.playback_id}.m3u8`;
                await prisma.stream.update({
                    where: { id: newStream.id },
                    data: { muxStreamId: liveStream.id, playbackUrl }
                });
            } catch (muxError) {
                console.error(`Mux live stream creation failed for stream ${newStream.id}:`, muxError.message);
            }
        }

        const formattedStream = {
            id: newStream.id,
            title: newStream.title,
            seller_id: newStream.sellerId,
            seller_name: newStream.seller.name,
            seller_avatar: newStream.seller.avatarUrl,
            location: newStream.location,
            viewer_count: newStream.viewerCount,
            status: newStream.status,
            started_at: newStream.startedAt,
            playback_url: playbackUrl,
            poster_url: newStream.posterUrl,
            featured_item: newStream.featuredItem,
            stream_key: streamKey,
            chat_messages: []
        };

        res.status(201).json({ success: true, stream: formattedStream });
    } catch (error) {
        next(error);
    }
});

// 3. End a live stream
router.post('/:id/end', authenticateToken, async (req, res, next) => {
    try {
        const stream = await prisma.stream.findUnique({
            where: { id: req.params.id }
        });

        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found or already ended' });
        }

        if (stream.sellerId !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized to end this stream' });
        }

        await prisma.stream.update({
            where: { id: req.params.id },
            data: { status: 'ended', endedAt: new Date() }
        });

        if (stream.muxStreamId) {
            const mux = getMuxClient();
            if (mux) {
                try {
                    await mux.video.liveStreams.disable(stream.muxStreamId);
                } catch (muxError) {
                    console.error(`Mux live stream disable failed for ${stream.muxStreamId}:`, muxError.message);
                }
            }
        }

        res.json({ success: true, message: 'Live stream ended successfully' });
    } catch (error) {
        next(error);
    }
});

// 4. Get single stream details & chat
router.get('/:id', async (req, res, next) => {
    try {
        const stream = await prisma.stream.findUnique({
            where: { id: req.params.id },
            include: {
                seller: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        location: true
                    }
                },
                chats: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });

        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found or ended' });
        }

        const formattedStream = {
            id: stream.id,
            title: stream.title,
            seller_id: stream.sellerId,
            seller_name: stream.seller.name,
            seller_avatar: stream.seller.avatarUrl,
            location: stream.location,
            viewer_count: stream.viewerCount,
            status: stream.status,
            started_at: stream.startedAt,
            playback_url: stream.playbackUrl,
            poster_url: stream.posterUrl,
            featured_item: stream.featuredItem,
            chat_messages: stream.chats.map(chat => ({
                id: chat.id,
                user: chat.userName,
                text: chat.text,
                reaction: chat.reaction,
                time: 'Just now'
            }))
        };

        res.json({ success: true, stream: formattedStream });
    } catch (error) {
        next(error);
    }
});

// 5. Trigger 90-Second "Dibs" Reservation
router.post('/:id/dibs', authenticateToken, async (req, res, next) => {
    try {
        const stream = await prisma.stream.findUnique({
            where: { id: req.params.id }
        });

        if (!stream || !stream.featuredItem) {
            return res.status(404).json({ success: false, message: 'No item available for Dibs' });
        }

        if (stream.sellerId === req.user.userId) {
            return res.status(400).json({ success: false, message: 'You cannot claim Dibs on your own live stream item.' });
        }

        const featuredItem = stream.featuredItem;
        const buyerName = req.user.name || 'Shopper';

        // Check if already locked and not expired
        if (featuredItem.dibs_status === 'locked' && featuredItem.lock_expires_at) {
            const remainingMs = new Date(featuredItem.lock_expires_at).getTime() - Date.now();
            if (remainingMs > 0) {
                const secondsLeft = Math.ceil(remainingMs / 1000);
                return res.status(400).json({
                    success: false,
                    message: `Someone just claimed Dibs on this piece! Locked for ${secondsLeft}s. If they do not pay escrow, it re-opens.`
                });
            }
        }

        const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();
        const updatedFeaturedItem = {
            ...featuredItem,
            dibs_status: 'locked',
            lock_expires_at: expiresAt,
            locked_by: buyerName
        };

        await prisma.stream.update({
            where: { id: req.params.id },
            data: { featuredItem: updatedFeaturedItem }
        });

        // Add chat announcement
        await prisma.streamChat.create({
            data: {
                streamId: req.params.id,
                userName: 'ESCROW BOT',
                text: `DIBS CLAIMED! ${buyerName} locked ${featuredItem.title} for 90s!`
            }
        });

        res.json({
            success: true,
            message: 'DIBS CLAIMED! You have 90 seconds to lock in this piece before it returns to the live bale.',
            item: updatedFeaturedItem,
            expires_at: expiresAt,
            lock_seconds: 90
        });
    } catch (error) {
        next(error);
    }
});

// 6. Broadcaster drops a new piece onto the live stream
router.post('/:id/drop', authenticateToken, async (req, res, next) => {
    try {
        const stream = await prisma.stream.findUnique({
            where: { id: req.params.id }
        });

        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found' });
        }

        if (stream.sellerId !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only the broadcaster can drop items' });
        }

        const { title, price, image_url, condition, brand, brand_domain, original_price } = req.body;
        if (!title || !price) {
            return res.status(400).json({ success: false, message: 'Title and price are required for live drop' });
        }

        const dropItem = {
            id: `drop-${uuidv4().slice(0, 8)}`,
            title: title.trim(),
            price: parseFloat(price),
            original_price: original_price ? parseFloat(original_price) : parseFloat(price) * 3,
            image_url: image_url || null,
            condition: condition || 'Grade A Thrift',
            brand: brand || null,
            brand_domain: brand_domain || null,
            dibs_status: 'available',
            seller_name: req.user.name,
            location: stream.location
        };

        await prisma.stream.update({
            where: { id: req.params.id },
            data: { featuredItem: dropItem }
        });

        // Add chat announcement
        await prisma.streamChat.create({
            data: {
                streamId: req.params.id,
                userName: 'LIVE DROP',
                text: `NEW PIECE UNBOXED: ${dropItem.title} - R${dropItem.price.toFixed(2)}! Tap Dibs to claim!`
            }
        });

        res.json({ success: true, message: 'Item dropped to live stream', featured_item: dropItem });
    } catch (error) {
        next(error);
    }
});

// 7. Send a live chat comment or reaction
router.post('/:id/chat', authenticateToken, async (req, res, next) => {
    try {
        const stream = await prisma.stream.findUnique({
            where: { id: req.params.id }
        });

        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found' });
        }

        const { text = '', reaction = null } = req.body;
        if (!text.trim() && !reaction) {
            return res.status(400).json({ success: false, message: 'Message text or reaction required' });
        }

        const chatMessage = await prisma.streamChat.create({
            data: {
                streamId: req.params.id,
                userId: req.user.userId,
                userName: req.user.name || 'Shopper',
                text: text.trim() || (reaction ? `Sent ${reaction}` : ''),
                reaction
            }
        });

        const formattedMessage = {
            id: chatMessage.id,
            user: chatMessage.userName,
            text: chatMessage.text,
            reaction: chatMessage.reaction,
            time: 'Just now'
        };

        res.json({ success: true, message: formattedMessage });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
