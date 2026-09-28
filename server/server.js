const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const itemRoutes = require('./routes/items');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');
const escrowRoutes = require('./routes/escrow');
const streamRoutes = require('./routes/streams');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false
}));
app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
});
app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((value) => value.trim()) : true,
    credentials: true
}));

// Request logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/streams', streamRoutes);

// Brand logo resolver using Logo.dev
app.get('/api/brand-logo/:domain', (req, res) => {
    const domain = req.params.domain.toLowerCase().trim();
    const token = process.env.LOGO_DEV_PUBLISHABLE_KEY || 'pk_YATscD2-Rx6ItVMsD1ElFw';
    res.redirect(`https://img.logo.dev/${domain}?token=${token}&size=80&format=png`);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(`[${req.requestId || 'unknown'}] Server error:`, err);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error'),
        requestId: req.requestId
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 SKY TRADE server running on http://localhost:${PORT}`);
});

module.exports = app;
