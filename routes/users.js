const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /points-history
router.get('/points-history', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT id, amount, type, description, created_at
       FROM points_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM points_transactions WHERE user_id = $1',
      [req.user.id]
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Points history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userResult = await query(
      `SELECT points_balance, current_streak, total_checkins, total_points_earned, created_at AS member_since
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    const contentCount = await query(
      'SELECT COUNT(*) FROM content WHERE submitted_by = $1',
      [req.user.id]
    );

    const savedCount = await query(
      'SELECT COUNT(*) FROM saved_items WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      points_balance: user.points_balance,
      current_streak: user.current_streak,
      total_checkins: user.total_checkins,
      total_points_earned: user.total_points_earned,
      total_content_submitted: parseInt(contentCount.rows[0].count),
      total_saved: parseInt(savedCount.rows[0].count),
      member_since: user.member_since
    });
  } catch (err) {
    console.error('User stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
