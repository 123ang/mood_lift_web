const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /
router.get('/', authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    let sql = `
      SELECT si.id, si.saved_at, c.id AS content_id, c.category, c.content_text,
             c.question, c.answer, c.option_a, c.option_b, c.option_c, c.option_d,
             c.correct_option, c.author, c.content_type
      FROM saved_items si
      JOIN content c ON c.id = si.content_id
      WHERE si.user_id = $1
    `;
    const params = [req.user.id];

    if (category) {
      sql += ' AND c.category = $2';
      params.push(category);
    }

    sql += ' ORDER BY si.saved_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get saved items error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:contentId
router.post('/:contentId', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;

    await query(
      `INSERT INTO saved_items (user_id, content_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, content_id) DO NOTHING`,
      [req.user.id, contentId]
    );

    res.status(201).json({ message: 'Content saved' });
  } catch (err) {
    console.error('Save item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /:contentId
router.delete('/:contentId', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;

    await query(
      'DELETE FROM saved_items WHERE user_id = $1 AND content_id = $2',
      [req.user.id, contentId]
    );

    res.json({ message: 'Saved item removed' });
  } catch (err) {
    console.error('Delete saved item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
