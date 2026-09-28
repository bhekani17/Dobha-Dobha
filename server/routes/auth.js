const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL;
const NEON_AUTH_JWKS_URL = process.env.NEON_AUTH_JWKS_URL;

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

// 1. Register new real user
router.post('/register', async (req, res, next) => {
    try {
        const { email, password, name, fullName, location, role = 'buyer', phone, sa_id, idNumber } = req.body;
        const resolvedName = name || fullName;

        if (!email || !password || !resolvedName) {
            return res.status(400).json({ success: false, message: 'Email, password and name are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists
        const existing = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (existing) {
            return res.status(409).json({ success: false, message: 'An account with this email already exists. Please sign in.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const resolvedIdNumber = sa_id || idNumber || null;
        const isVerified = resolvedIdNumber && resolvedIdNumber.length === 13;

        const newUser = await prisma.user.create({
            data: {
                email: normalizedEmail,
                passwordHash,
                name: resolvedName.trim(),
                role: role || 'buyer',
                phone: phone ? phone.trim() : null,
                location: location || 'South Africa',
                verificationStatus: isVerified ? 'verified' : 'pending',
                wallet: {
                    create: {
                        balance: 0.00
                    }
                },
                ...(resolvedIdNumber ? {
                    verification: {
                        create: {
                            idNumber: resolvedIdNumber,
                            documentType: 'South African Smart ID / Green Book',
                            status: isVerified ? 'verified' : 'pending'
                        }
                    }
                } : {})
            },
            include: {
                wallet: true,
                verification: true
            }
        });

        const tokens = generateTokens(newUser);

        // Sanitize sensitive fields
        const safeUser = {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            phone: newUser.phone,
            location: newUser.location,
            verification_status: newUser.verificationStatus,
            created_at: newUser.createdAt
        };

        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome to DOBHA DOBHA.',
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: safeUser
        });
    } catch (error) {
        console.error('Registration error in Prisma:', error);
        next(error);
    }
});

// 2. Login user
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            include: {
                wallet: true,
                verification: true
            }
        });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const tokens = generateTokens(user);

        const safeUser = {
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

        res.json({
            success: true,
            message: 'Login successful',
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: safeUser
        });
    } catch (error) {
        console.error('Login error in Prisma:', error);
        next(error);
    }
});

// 3. Logout
router.post('/logout', async (req, res) => {
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

            const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const token = jwt.sign(
                { userId: user.id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: ACCESS_TOKEN_EXPIRY }
            );

            res.json({ success: true, token });
        });
    } catch (error) {
        next(error);
    }
});

// 5. Google OAuth callback (for Neon Auth integration)
router.post('/google/callback', async (req, res, next) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, message: 'Authorization code required' });
        }

        // Exchange code with Neon Auth
        const neonAuthResponse = await fetch(`${NEON_AUTH_BASE_URL}/callback/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });

        const neonAuthData = await neonAuthResponse.json();

        if (!neonAuthResponse.ok) {
            return res.status(neonAuthResponse.status).json({
                success: false,
                message: neonAuthData.message || 'Failed to authenticate with Neon Auth'
            });
        }

        // Get or create user in our database based on Neon Auth user data
        const { user: neonUser, token: neonToken, refreshToken: neonRefreshToken } = neonAuthData;

        // Check if user exists in our database by email
        let user = await prisma.user.findUnique({
            where: { email: neonUser.email },
            include: {
                wallet: true,
                verification: true
            }
        });

        if (!user) {
            // Create new user from Google auth data
            user = await prisma.user.create({
                data: {
                    email: neonUser.email,
                    passwordHash: '', // No password for OAuth users
                    name: neonUser.name || neonUser.email.split('@')[0],
                    role: 'buyer',
                    verificationStatus: 'verified', // OAuth users are pre-verified
                    wallet: {
                        create: {
                            balance: 0.00
                        }
                    }
                },
                include: {
                    wallet: true,
                    verification: true
                }
            });
        }

        // Generate our own JWT tokens
        const tokens = generateTokens(user);

        const safeUser = {
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

        res.json({
            success: true,
            message: 'Google authentication successful',
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: safeUser
        });
    } catch (error) {
        console.error('Google OAuth callback error:', error);
        next(error);
    }
});

module.exports = router;
