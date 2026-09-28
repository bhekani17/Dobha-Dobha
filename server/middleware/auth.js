const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET;

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
        // Reject legacy UUID tokens from the old Neon/Prisma system
        if (!mongoose.isValidObjectId(decoded.userId)) {
            return res.status(401).json({ success: false, message: 'Session expired, please sign in again' });
        }
        req.user = decoded;
        next();
    });
}

module.exports = { authenticateToken };
