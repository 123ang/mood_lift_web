const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');

const router = express.Router();

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username, and password are required' });
    }

    const existing = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (email, username, password_hash, points_balance, total_points_earned)
       VALUES ($1, $2, $3, 5, 5)
       RETURNING id, email, username, points, points_balance, current_streak, last_checkin,
                 total_checkins, total_points_earned, notification_time, notifications_enabled,
                 is_admin, created_at`,
      [email, username, password_hash]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    const message = process.env.NODE_ENV !== 'production' ? err.message : 'Server error';
    res.status(500).json({ error: message });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    delete user.password_hash;

    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    const message = process.env.NODE_ENV !== 'production' ? err.message : 'Server error';
    res.status(500).json({ error: message });
  }
});

// GET /profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, username, points, points_balance, current_streak, last_checkin,
              total_checkins, total_points_earned, notification_time, notifications_enabled,
              is_admin, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { username, notification_time, notifications_enabled } = req.body;

    const result = await query(
      `UPDATE users
       SET username = COALESCE($1, username),
           notification_time = COALESCE($2, notification_time),
           notifications_enabled = COALESCE($3, notifications_enabled)
       WHERE id = $4
       RETURNING id, email, username, points, points_balance, current_streak, last_checkin,
                 total_checkins, total_points_earned, notification_time, notifications_enabled,
                 is_admin, created_at`,
      [username, notification_time, notifications_enabled, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
