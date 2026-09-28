const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be configured before the server starts');
}

const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY = '30d';

function generateTokens(user) {
    const payload = { userId: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
    return { token, refreshToken };
}

function safeUser(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        location: user.location,
        avatar_url: user.avatarUrl,
        verification_status: user.verificationStatus,
        wallet_balance: user.wallet ? Number(user.wallet.balance) : 0,
        created_at: user.createdAt
    };
}

// 1. Register
router.post('/register', async (req, res, next) => {
    try {
        const { email, password, name, fullName, location, role = 'buyer', phone, sa_id, idNumber } = req.body;
        const resolvedName = name || fullName;

        if (!email || !password || !resolvedName) {
            return res.status(400).json({ success: false, message: 'Email, password and name are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(409).json({ success: false, message: 'An account with this email already exists. Please sign in.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const resolvedIdNumber = sa_id || idNumber || null;
        const isVerified = resolvedIdNumber && resolvedIdNumber.length === 13;

        const newUser = new User({
            email: normalizedEmail,
            passwordHash,
            name: resolvedName.trim(),
            role: role || 'buyer',
            phone: phone ? phone.trim() : null,
            location: location || 'South Africa',
            verificationStatus: isVerified ? 'verified' : 'pending',
            wallet: { balance: 0 },
            ...(resolvedIdNumber ? {
                verification: {
                    idNumber: resolvedIdNumber,
                    documentType: 'South African Smart ID / Green Book',
                    status: isVerified ? 'verified' : 'pending'
                }
            } : {})
        });
        await newUser.save();

        const tokens = generateTokens(newUser);
        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome to DOBHA DOBHA.',
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: safeUser(newUser)
        });
    } catch (error) {
        console.error('Registration error:', error);
        next(error);
    }
});

// 2. Login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const tokens = generateTokens(user);
        res.json({
            success: true,
            message: 'Login successful',
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: safeUser(user)
        });
    } catch (error) {
        console.error('Login error:', error);
        next(error);
    }
});

// 3. Logout
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// 4. Refresh token
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'Refresh token required' });
        }

        jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
            }
            try {
                const user = await User.findById(decoded.userId);
                if (!user) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }

                const token = jwt.sign(
                    { userId: user.id, email: user.email, role: user.role },
                    JWT_SECRET,
                    { expiresIn: ACCESS_TOKEN_EXPIRY }
                );

                res.json({ success: true, token });
            } catch (innerErr) {
                next(innerErr);
            }
        });
    } catch (error) {
        next(error);
    }
});

// 5. Google OAuth callback — accepts Google user data from the mobile client
router.post('/google/callback', async (req, res, next) => {
    try {
        const { email, name } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Google user email required' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        let user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            user = new User({
                email: normalizedEmail,
                passwordHash: '',
                name: name || normalizedEmail.split('@')[0],
                role: 'buyer',
                verificationStatus: 'verified',
                wallet: { balance: 0 }
            });
            await user.save();
        }

        const tokens = generateTokens(user);
        res.json({
            success: true,
            message: 'Google authentication successful',
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: safeUser(user)
        });
    } catch (error) {
        console.error('Google OAuth callback error:', error);
        next(error);
    }
});

module.exports = router;
