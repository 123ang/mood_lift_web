const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate, requireAdmin);

// DELETE /content/:id
router.delete('/content/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      "UPDATE content SET status = 'deleted' WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json({ message: 'Content deleted', id: result.rows[0].id });
  } catch (err) {
    console.error('Delete content error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /reported
router.get('/reported', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, u.username AS submitted_by_username,
              json_agg(json_build_object(
                'id', cr.id,
                'user_id', cr.user_id,
                'reason', cr.reason,
                'created_at', cr.created_at
              )) AS reports
       FROM content c
       LEFT JOIN users u ON u.id = c.submitted_by
       JOIN content_reports cr ON cr.content_id = c.id
       WHERE c.report_count > 0
       GROUP BY c.id, u.username
       ORDER BY c.report_count DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get reported content error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /stats
router.get('/stats', async (req, res) => {
  try {
    const usersCount = await query('SELECT COUNT(*) FROM users');
    const contentCount = await query('SELECT COUNT(*) FROM content');
    const reportsCount = await query('SELECT COUNT(*) FROM content_reports');
    const activeContentCount = await query(
      "SELECT COUNT(*) FROM content WHERE status = 'active'"
    );

    res.json({
      total_users: parseInt(usersCount.rows[0].count),
      total_content: parseInt(contentCount.rows[0].count),
      total_reports: parseInt(reportsCount.rows[0].count),
      active_content: parseInt(activeContentCount.rows[0].count)
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
