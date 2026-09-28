const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { prisma } = require('../prisma');

const router = express.Router();

// 1. Get current user profile
router.get('/profile', authenticateToken, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            include: {
                wallet: true,
                verification: true,
                items: {
                    where: { status: 'active' },
                    include: { images: true }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const safeUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone,
            location: user.location,
            bio: user.bio,
            avatar_url: user.avatarUrl,
            verification_status: user.verificationStatus,
            wallet_balance: user.wallet ? Number(user.wallet.balance) : 0,
            active_listings: user.items ? user.items.length : 0,
            created_at: user.createdAt
        };

        res.json({ success: true, user: safeUser });
    } catch (error) {
        next(error);
    }
});

// 2. Update current user profile
router.put('/profile', authenticateToken, async (req, res, next) => {
    try {
        const { name, phone, location, bio, avatar_url } = req.body;

        const updateData = {};
        if (name) updateData.name = name.trim();
        if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
        if (location !== undefined) updateData.location = location;
        if (bio !== undefined) updateData.bio = bio;
        if (avatar_url !== undefined) updateData.avatarUrl = avatar_url;

        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId },
            data: updateData,
            include: {
                wallet: true,
                verification: true
            }
        });

        const safeUser = {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            phone: updatedUser.phone,
            location: updatedUser.location,
            bio: updatedUser.bio,
            avatar_url: updatedUser.avatarUrl,
            verification_status: updatedUser.verificationStatus,
            wallet_balance: updatedUser.wallet ? Number(updatedUser.wallet.balance) : 0,
            created_at: updatedUser.createdAt
        };

        res.json({ success: true, message: 'Profile updated successfully', user: safeUser });
    } catch (error) {
        next(error);
    }
});

// 3. Submit KYC verification request (supports /verify and /kyc)
router.post(['/verify', '/kyc'], authenticateToken, async (req, res, next) => {
    try {
        const {
            id_number,
            idNumber,
            document_type,
            documentType,
            document_url,
            documentUrl,
            photo_url,
            photoUrl
        } = req.body;
        const resolvedIdNumber = id_number || idNumber || null;
        const resolvedDocType = document_type || documentType || 'South African Smart ID';
        const resolvedDocUrl = document_url || documentUrl || photo_url || photoUrl || null;

        const isVerified = resolvedIdNumber && resolvedIdNumber.trim().length === 13;

        await prisma.user.update({
            where: { id: req.user.userId },
            data: {
                verificationStatus: isVerified ? 'verified' : 'pending',
                verification: {
                    upsert: {
                        create: {
                            idNumber: resolvedIdNumber,
                            documentType: resolvedDocType,
                            documentUrl: resolvedDocUrl,
                            status: isVerified ? 'verified' : 'pending'
                        },
                        update: {
                            idNumber: resolvedIdNumber,
                            documentType: resolvedDocType,
                            documentUrl: resolvedDocUrl,
                            status: isVerified ? 'verified' : 'pending',
                            submittedAt: new Date()
                        }
                    }
                }
            }
        });

        res.json({
            success: true,
            message: isVerified
                ? 'Smart ID verified successfully! Green KYC Badge activated.'
                : 'Verification document submitted for review.'
        });
    } catch (error) {
        next(error);
    }
});

// 4. Get public seller profile
router.get('/seller/:id', async (req, res, next) => {
    try {
        const seller = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                verification: true,
                items: {
                    where: { status: 'active' },
                    include: { images: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!seller) {
            return res.status(404).json({ success: false, message: 'Seller not found' });
        }

        const safeSeller = {
            id: seller.id,
            name: seller.name,
            role: seller.role,
            location: seller.location,
            bio: seller.bio,
            avatar_url: seller.avatarUrl,
            verification_status: seller.verificationStatus,
            created_at: seller.createdAt
        };

        res.json({ success: true, seller: safeSeller, listings: seller.items || [] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
