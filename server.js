require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline styles for landing page
}));
app.use(cors());

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many auth attempts, please try again later.' },
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (landing page)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');
const checkinRoutes = require('./routes/checkin');
const savedRoutes = require('./routes/saved');
const usersRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);

// Health check (includes DB connectivity in development)
const { query } = require('./config/database');
app.get('/api/health', async (req, res) => {
    const out = { status: 'ok', timestamp: new Date().toISOString() };
    if (process.env.NODE_ENV !== 'production') {
        try {
            await query('SELECT 1');
            out.database = 'ok';
        } catch (err) {
            out.database = 'error';
            out.databaseMessage = err.message;
        }
    }
    res.json(out);
});

// Landing page fallback
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`MoodLift server running on port ${PORT}`);
    console.log(`Landing page: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
});

module.exports = app;
