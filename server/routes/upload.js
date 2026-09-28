const express = require('express');
const path = require('path');
const fs = require('fs');
const { uploadBase64ToS3 } = require('../s3');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Ensure local upload directories exist for resilient fallback
const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
['images', 'videos', 'documents'].forEach(sub => {
    const dir = path.join(UPLOAD_ROOT, sub);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

function getBase64Payload(body) {
    if (!body) return null;
    if (typeof body === 'string') return body;
    if (body.data && typeof body.data === 'string') return body.data;
    if (body.file && typeof body.file === 'string') return body.file;
    if (body.base64 && typeof body.base64 === 'string') return body.base64;
    return null;
}

function parseBase64(input, defaultType = 'image/jpeg') {
    if (!input) return null;
    const trimmed = input.trim();
    const matches = trimmed.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/i);
    if (matches) {
        let contentType = matches[1].toLowerCase();
        if (contentType === 'image/jpg') contentType = 'image/jpeg';
        return { contentType, data: matches[2] };
    }
    let contentType = defaultType.toLowerCase();
    if (contentType === 'image/jpg') contentType = 'image/jpeg';
    return { contentType, data: trimmed };
}

const ALLOWED_TYPES = {
    images: new Set([
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
    ]),
    videos: new Set([
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg', 'video/3gpp', 'video/x-m4v'
    ]),
    documents: new Set([
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'
    ])
};
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Neon Object Storage handler for media uploads
 */
async function processMediaUpload({ base64Data, folder = 'images', customName, defaultContentType = 'image/jpeg' }) {
    const parsed = parseBase64(base64Data, defaultContentType);
    if (!parsed || !parsed.data) {
        throw new Error('Invalid base64 payload');
    }

    if (!ALLOWED_TYPES[folder]) {
        throw new Error('Unsupported upload folder');
    }
    if (!ALLOWED_TYPES[folder].has(parsed.contentType.toLowerCase())) {
        throw new Error('Unsupported file type');
    }

    const estimatedBytes = Math.floor((parsed.data.length * 3) / 4);
    if (estimatedBytes > MAX_BYTES) {
        throw new Error('File exceeds the 10 MB upload limit');
    }

    const ext = parsed.contentType.split('/')[1]?.split('+')[0] || (folder === 'videos' ? 'mp4' : 'jpg');
    const safeName = customName || `${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const targetKey = `${folder}/${safeName}`;

    // Upload to Neon Object Storage (S3-compatible)
    try {
        if (process.env.AWS_S3_BUCKET_NAME || process.env.AWS_ENDPOINT_URL_S3) {
            const s3Res = await uploadBase64ToS3({
                base64Data: parsed.data,
                key: targetKey,
                contentType: parsed.contentType
            });
            if (s3Res && s3Res.url) {
                return { url: s3Res.url, key: targetKey, storage: 's3' };
            }
        }
        throw new Error('Neon Object Storage not configured');
    } catch (s3Err) {
        console.warn('Neon Object Storage upload fallback to local disk:', s3Err.message);
        // Resilient disk fallback: save to uploads/<folder>/<safeName>
        const targetDir = path.join(UPLOAD_ROOT, folder);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const filePath = path.join(targetDir, safeName);
        fs.writeFileSync(filePath, Buffer.from(parsed.data, 'base64'));
        const localUrl = `/uploads/${folder}/${safeName}`;
        return { url: localUrl, key: targetKey, storage: 'disk' };
    }
}

// 1. Upload Photo / Image
router.post('/image', authenticateToken, async (req, res) => {
    try {
        const base64Data = getBase64Payload(req.body);
        if (!base64Data) {
            return res.status(400).json({ success: false, message: 'Image payload is required' });
        }

        const result = await processMediaUpload({
            base64Data,
            folder: 'images',
            customName: req.body.fileName || req.body.name,
            defaultContentType: req.body.contentType || 'image/jpeg'
        });

        res.status(201).json({
            success: true,
            message: 'Image uploaded successfully',
            url: result.url,
            key: result.key
        });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({ success: false, message: error.message || 'Image upload failed' });
    }
});

// 2. Upload Video / Reel
router.post('/video', authenticateToken, async (req, res) => {
    try {
        const base64Data = getBase64Payload(req.body);
        if (!base64Data) {
            return res.status(400).json({ success: false, message: 'Video payload is required' });
        }

        const result = await processMediaUpload({
            base64Data,
            folder: 'videos',
            customName: req.body.fileName || req.body.name,
            defaultContentType: req.body.contentType || 'video/mp4'
        });

        res.status(201).json({
            success: true,
            message: 'Video uploaded successfully',
            url: result.url,
            key: result.key
        });
    } catch (error) {
        console.error('Upload video error:', error);
        res.status(500).json({ success: false, message: error.message || 'Video upload failed' });
    }
});

// 3. Upload KYC Document / ID Photo
router.post('/document', authenticateToken, async (req, res) => {
    try {
        const base64Data = getBase64Payload(req.body);
        if (!base64Data) {
            return res.status(400).json({ success: false, message: 'Document payload is required' });
        }

        const result = await processMediaUpload({
            base64Data,
            folder: 'documents',
            customName: req.body.fileName || req.body.name,
            defaultContentType: 'application/pdf'
        });

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully',
            url: result.url,
            key: result.key
        });
    } catch (error) {
        console.error('Upload document error:', error);
        res.status(500).json({ success: false, message: error.message || 'Document upload failed' });
    }
});

// 4. General Upload Route
router.post('/', authenticateToken, async (req, res) => {
    try {
        const base64Data = getBase64Payload(req.body);
        if (!base64Data) {
            return res.status(400).json({ success: false, message: 'File payload is required' });
        }

        const folder = req.body.folder || (req.body.type?.includes('video') ? 'videos' : 'images');
        const result = await processMediaUpload({
            base64Data,
            folder,
            customName: req.body.fileName || req.body.name
        });

        res.status(201).json({
            success: true,
            message: 'Uploaded successfully',
            url: result.url,
            key: result.key
        });
    } catch (error) {
        console.error('General upload error:', error);
        res.status(500).json({ success: false, message: error.message || 'Upload failed' });
    }
});

module.exports = router;
