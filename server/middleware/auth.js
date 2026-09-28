const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const NEON_AUTH_JWKS_URL = process.env.NEON_AUTH_JWKS_URL;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured before the server starts');
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    });
}

// Support for Neon Auth token verification (for future implementation)
// This would verify tokens issued directly by Neon Auth using JWKS
async function verifyNeonAuthToken(token) {
    if (!NEON_AUTH_JWKS_URL) {
        throw new Error('NEON_AUTH_JWKS_URL is not configured');
    }

    // Placeholder for proper JWKS verification
    // In production, use 'jwks-rsa' or similar library
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        throw new Error('Invalid Neon Auth token');
    }
}

module.exports = { authenticateToken, verifyNeonAuthToken };
