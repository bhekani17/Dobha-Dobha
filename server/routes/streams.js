const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const Stream = require('../models/Stream');
const StreamChat = require('../models/StreamChat');

const router = express.Router();

const RTMP_HOST = process.env.RTMP_SERVER_URL || 'localhost';

function getRtmpIngestUrl(streamKey) {
    return `rtmp://${RTMP_HOST}/live/${streamKey}`;
}

function getHlsPlaybackUrl(streamKey) {
    return `http://${RTMP_HOST}/hls/${streamKey}.m3u8`;
}

function formatStream(stream, chats = []) {
    const seller = stream.seller && typeof stream.seller === 'object' ? stream.seller : null;
    return {
        id: stream.id,
        title: stream.title,
        seller_id: seller ? seller._id.toString() : stream.seller?.toString(),
        seller_name: seller?.name,
        seller_avatar: seller?.avatarUrl,
        location: stream.location,
        viewer_count: stream.viewerCount,
        status: stream.status,
        started_at: stream.startedAt,
        playback_url: stream.playbackUrl,
        poster_url: stream.posterUrl,
        featured_item: stream.featuredItem,
        chat_messages: chats.map(chat => ({
            id: chat.id,
            user: chat.userName,
            text: chat.text,
            reaction: chat.reaction,
            time: 'Just now'
        }))
    };
}

// 1. Get all active live streams
router.get('/', async (req, res, next) => {
    try {
        const streams = await Stream.find({ status: 'live' })
            .populate('seller', 'name avatarUrl location')
            .sort({ createdAt: -1 });

        const result = await Promise.all(streams.map(async stream => {
            const chats = await StreamChat.find({ stream: stream._id })
                .sort({ createdAt: -1 })
                .limit(20);
            return formatStream(stream, chats);
        }));

        res.json({ success: true, streams: result });
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

        const newStream = new Stream({
            seller: req.user.userId,
            title: title.trim(),
            location: location || 'Bree Taxi Rank, Joburg CBD',
            status: 'live',
            viewerCount: 1,
            playbackUrl: playback_url || null,
            posterUrl: poster_url || null,
            featuredItem: featured_item || null
        });
        await newStream.save();
        await newStream.populate('seller', 'name avatarUrl location');

        await StreamChat.create({
            stream: newStream._id,
            userName: 'SYSTEM',
            text: `Broadcast started by ${newStream.seller.name} live from ${newStream.location}.`
        });

        const streamKey = uuidv4().replace(/-/g, '');
        const playbackUrl = getHlsPlaybackUrl(streamKey);
        await Stream.findByIdAndUpdate(newStream._id, { streamKey, playbackUrl });

        res.status(201).json({
            success: true,
            stream: {
                ...formatStream(newStream),
                playback_url: playbackUrl,
                stream_key: streamKey,
                rtmp_url: getRtmpIngestUrl(streamKey)
            }
        });
    } catch (error) {
        next(error);
    }
});

// 3. End a live stream
router.post('/:id/end', authenticateToken, async (req, res, next) => {
    try {
        const stream = await Stream.findById(req.params.id);

        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found or already ended' });
        }

        if (stream.seller.toString() !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized to end this stream' });
        }

        await Stream.findByIdAndUpdate(req.params.id, { status: 'ended', endedAt: new Date() });
        res.json({ success: true, message: 'Live stream ended successfully' });
    } catch (error) {
        next(error);
    }
});

// 4. Get single stream details & chat
router.get('/:id', async (req, res, next) => {
    try {
        const stream = await Stream.findById(req.params.id)
            .populate('seller', 'name avatarUrl location');

        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found or ended' });
        }

        const chats = await StreamChat.find({ stream: stream._id })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, stream: formatStream(stream, chats) });
    } catch (error) {
        next(error);
    }
});

// 5. Trigger 90-Second Dibs Reservation
router.post('/:id/dibs', authenticateToken, async (req, res, next) => {
    try {
        const stream = await Stream.findById(req.params.id);

        if (!stream || !stream.featuredItem) {
            return res.status(404).json({ success: false, message: 'No item available for Dibs' });
        }

        if (stream.seller.toString() === req.user.userId) {
            return res.status(400).json({ success: false, message: 'You cannot claim Dibs on your own live stream item.' });
        }

        const featuredItem = stream.featuredItem;
        const buyerName = req.user.name || 'Shopper';

        if (featuredItem.dibs_status === 'locked' && featuredItem.lock_expires_at) {
            const remainingMs = new Date(featuredItem.lock_expires_at).getTime() - Date.now();
            if (remainingMs > 0) {
                const secondsLeft = Math.ceil(remainingMs / 1000);
                return res.status(400).json({
                    success: false,
                    message: `Someone just claimed Dibs on this piece! Locked for ${secondsLeft}s.`
                });
            }
        }

        const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();
        const updatedFeaturedItem = { ...featuredItem, dibs_status: 'locked', lock_expires_at: expiresAt, locked_by: buyerName };

        await Stream.findByIdAndUpdate(req.params.id, { featuredItem: updatedFeaturedItem });
        await StreamChat.create({
            stream: req.params.id,
            userName: 'ESCROW BOT',
            text: `DIBS CLAIMED! ${buyerName} locked ${featuredItem.title} for 90s!`
        });

        res.json({
            success: true,
            message: 'DIBS CLAIMED! You have 90 seconds to lock in this piece.',
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
        const stream = await Stream.findById(req.params.id);

        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found' });
        }

        if (stream.seller.toString() !== req.user.userId && req.user.role !== 'admin') {
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

        await Stream.findByIdAndUpdate(req.params.id, { featuredItem: dropItem });
        await StreamChat.create({
            stream: req.params.id,
            userName: 'LIVE DROP',
            text: `NEW PIECE UNBOXED: ${dropItem.title} - R${dropItem.price.toFixed(2)}! Tap Dibs to claim!`
        });

        res.json({ success: true, message: 'Item dropped to live stream', featured_item: dropItem });
    } catch (error) {
        next(error);
    }
});

// 7. Send a live chat comment or reaction
router.post('/:id/chat', authenticateToken, async (req, res, next) => {
    try {
        const stream = await Stream.findById(req.params.id);

        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found' });
        }

        const { text = '', reaction = null } = req.body;
        if (!text.trim() && !reaction) {
            return res.status(400).json({ success: false, message: 'Message text or reaction required' });
        }

        const chatMessage = await StreamChat.create({
            stream: req.params.id,
            userId: req.user.userId,
            userName: req.user.name || 'Shopper',
            text: text.trim() || (reaction ? `Sent ${reaction}` : ''),
            reaction
        });

        res.json({
            success: true,
            message: {
                id: chatMessage.id,
                user: chatMessage.userName,
                text: chatMessage.text,
                reaction: chatMessage.reaction,
                time: 'Just now'
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
