const express = require('express');
const { query } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /feed - Community feed (all user submissions)
router.get('/feed', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sort = req.query.sort || 'newest';
    const offset = (page - 1) * limit;

    let orderClause = 'c.created_at DESC';
    if (sort === 'top_rated') {
      orderClause = '(c.upvotes - c.downvotes) DESC';
    }

    let selectExtra = '';
    let joinExtra = '';
    const params = [limit, offset];

    if (req.user) {
      selectExtra = `, cv.vote_type AS user_vote,
                       CASE WHEN uu.id IS NOT NULL THEN true ELSE false END AS is_unlocked`;
      joinExtra = `LEFT JOIN content_votes cv ON cv.content_id = c.id AND cv.user_id = $3
                   LEFT JOIN user_unlocks uu ON uu.content_id = c.id AND uu.user_id = $3`;
      params.push(req.user.id);
    }

    const result = await query(
      `SELECT c.*, u.username AS submitter_username${selectExtra}
       FROM content c
       LEFT JOIN users u ON u.id = c.submitted_by
       ${joinExtra}
       WHERE c.submitted_by IS NOT NULL AND c.status = 'active'
       ORDER BY ${orderClause}
       LIMIT $1 OFFSET $2`,
      params
    );

    const countResult = await query(
      "SELECT COUNT(*) FROM content WHERE submitted_by IS NOT NULL AND status = 'active'"
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      total,
      page,
      total_pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Get feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /mine - Current user's submissions
router.get('/mine', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT c.*, u.username AS submitter_username,
              cv.vote_type AS user_vote,
              CASE WHEN uu.id IS NOT NULL THEN true ELSE false END AS is_unlocked
       FROM content c
       LEFT JOIN users u ON u.id = c.submitted_by
       LEFT JOIN content_votes cv ON cv.content_id = c.id AND cv.user_id = $1
       LEFT JOIN user_unlocks uu ON uu.content_id = c.id AND uu.user_id = $1
       WHERE c.submitted_by = $1
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM content WHERE submitted_by = $1',
      [req.user.id]
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      total,
      page,
      total_pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Get my content error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /:category
router.get('/:category', optionalAuth, async (req, res) => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sort = req.query.sort || 'newest';
    const offset = (page - 1) * limit;

    let orderClause = 'c.created_at DESC';
    if (sort === 'top_rated') {
      orderClause = '(c.upvotes - c.downvotes) DESC';
    }

    let selectExtra = '';
    let joinExtra = '';
    const params = [category, limit, offset];

    if (req.user) {
      selectExtra = `, cv.vote_type AS user_vote,
                       CASE WHEN uu.id IS NOT NULL THEN true ELSE false END AS is_unlocked`;
      joinExtra = `LEFT JOIN content_votes cv ON cv.content_id = c.id AND cv.user_id = $4
                   LEFT JOIN user_unlocks uu ON uu.content_id = c.id AND uu.user_id = $4`;
      params.push(req.user.id);
    }

    const result = await query(
      `SELECT c.*, u.username AS submitter_username${selectExtra}
       FROM content c
       LEFT JOIN users u ON u.id = c.submitted_by
       ${joinExtra}
       WHERE c.category = $1 AND c.status = 'active'
       ORDER BY ${orderClause}
       LIMIT $2 OFFSET $3`,
      params
    );

    const countResult = await query(
      "SELECT COUNT(*) FROM content WHERE category = $1 AND status = 'active'",
      [category]
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      total,
      page,
      total_pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Get content error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: build nested daily content items from flat rows
function buildDailyItems(rows) {
  return rows.map(row => ({
    id: row.id,
    content_id: row.content_id,
    category: row.dca_category || row.category,
    position_in_day: row.position_in_day,
    is_unlocked: row.is_unlocked,
    content: {
      id: row.c_id,
      content_text: row.content_text,
      question: row.question,
      answer: row.answer,
      option_a: row.option_a,
      option_b: row.option_b,
      option_c: row.option_c,
      option_d: row.option_d,
      correct_option: row.correct_option,
      author: row.author,
      category: row.c_category,
      content_type: row.content_type,
      submitted_by: row.submitted_by,
      submitter_username: row.submitter_username,
      status: row.status,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      report_count: row.report_count,
      user_vote: row.user_vote || null,
      is_unlocked: row.is_unlocked,
      created_at: row.c_created_at
    }
  }));
}

// Daily content SQL
const DAILY_SELECT_SQL = `
  SELECT dca.id, dca.content_id, dca.category AS dca_category, dca.position_in_day,
         CASE WHEN uu.id IS NOT NULL THEN true ELSE false END AS is_unlocked,
         c.id AS c_id, c.content_text, c.question, c.answer, c.option_a, c.option_b,
         c.option_c, c.option_d, c.correct_option, c.author, c.category AS c_category,
         c.content_type, c.submitted_by, c.status, c.upvotes, c.downvotes, c.report_count,
         c.created_at AS c_created_at,
         u.username AS submitter_username,
         cv.vote_type AS user_vote
  FROM daily_content_assignments dca
  JOIN content c ON c.id = dca.content_id
  LEFT JOIN users u ON u.id = c.submitted_by
  LEFT JOIN user_unlocks uu ON uu.content_id = c.id AND uu.user_id = $1
  LEFT JOIN content_votes cv ON cv.content_id = c.id AND cv.user_id = $1
  WHERE dca.user_id = $1 AND dca.category = $2
    AND dca.assignment_date = CURRENT_DATE
  ORDER BY dca.position_in_day ASC`;

// GET /:category/daily
router.get('/:category/daily', authenticate, async (req, res) => {
  try {
    const { category } = req.params;
    const userId = req.user.id;

    // Check for existing daily assignments today
    const existing = await query(DAILY_SELECT_SQL, [userId, category]);

    if (existing.rows.length > 0) {
      return res.json(buildDailyItems(existing.rows));
    }

    // Create new daily assignments
    const available = await query(
      `SELECT c.id FROM content c
       WHERE c.category = $1 AND c.status = 'active'
         AND c.id NOT IN (
           SELECT content_id FROM user_viewed_content WHERE user_id = $2
         )
       ORDER BY RANDOM()
       LIMIT 10`,
      [category, userId]
    );

    if (available.rows.length === 0) {
      return res.json([]);
    }

    const insertValues = [];
    const insertParams = [];
    let paramIndex = 1;

    for (let i = 0; i < available.rows.length; i++) {
      insertValues.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, CURRENT_DATE)`);
      insertParams.push(userId, available.rows[i].id, category, i + 1);
      paramIndex += 4;
    }

    await query(
      `INSERT INTO daily_content_assignments (user_id, content_id, category, position_in_day, assignment_date)
       VALUES ${insertValues.join(', ')}`,
      insertParams
    );

    // Fetch the newly created assignments
    const assignments = await query(DAILY_SELECT_SQL, [userId, category]);

    res.json(buildDailyItems(assignments.rows));
  } catch (err) {
    console.error('Get daily content error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /submit
router.post('/submit', authenticate, async (req, res) => {
  try {
    const {
      content_text, question, answer, option_a, option_b, option_c, option_d,
      correct_option, author, category, content_type
    } = req.body;

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const result = await query(
      `INSERT INTO content (content_text, question, answer, option_a, option_b, option_c, option_d,
                            correct_option, author, category, content_type, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        content_text, question, answer, option_a, option_b, option_c, option_d,
        correct_option, author, category, content_type || 'text', req.user.id
      ]
    );

    // Award 1 point for content submission
    await query(
      `UPDATE users
       SET points_balance = points_balance + 1,
           total_points_earned = total_points_earned + 1
       WHERE id = $1`,
      [req.user.id]
    );

    // Record the transaction
    await query(
      `INSERT INTO points_transactions (user_id, transaction_type, points_amount, description)
       VALUES ($1, 'earned', 1, 'Content submission')`,
      [req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Submit content error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:id/vote
router.post('/:id/vote', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { vote_type } = req.body;

    if (!vote_type || !['up', 'down'].includes(vote_type)) {
      return res.status(400).json({ error: 'vote_type must be "up" or "down"' });
    }

    await query(
      `INSERT INTO content_votes (user_id, content_id, vote_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, content_id) DO UPDATE SET vote_type = $3`,
      [req.user.id, id, vote_type]
    );

    // Recount votes
    const upResult = await query(
      "SELECT COUNT(*) FROM content_votes WHERE content_id = $1 AND vote_type = 'up'",
      [id]
    );
    const downResult = await query(
      "SELECT COUNT(*) FROM content_votes WHERE content_id = $1 AND vote_type = 'down'",
      [id]
    );

    const upvotes = parseInt(upResult.rows[0].count);
    const downvotes = parseInt(downResult.rows[0].count);

    await query(
      'UPDATE content SET upvotes = $1, downvotes = $2 WHERE id = $3',
      [upvotes, downvotes, id]
    );

    // Return the full updated content item
    const result = await query(
      `SELECT c.*, u.username AS submitter_username,
              cv.vote_type AS user_vote,
              CASE WHEN uu.id IS NOT NULL THEN true ELSE false END AS is_unlocked
       FROM content c
       LEFT JOIN users u ON u.id = c.submitted_by
       LEFT JOIN content_votes cv ON cv.content_id = c.id AND cv.user_id = $2
       LEFT JOIN user_unlocks uu ON uu.content_id = c.id AND uu.user_id = $2
       WHERE c.id = $1`,
      [id, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:id/report
router.post('/:id/report', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    await query(
      `INSERT INTO content_reports (user_id, content_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, content_id) DO NOTHING`,
      [req.user.id, id, reason]
    );

    res.json({ message: 'Report submitted' });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:id/unlock
router.post('/:id/unlock', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if already unlocked
    const existingUnlock = await query(
      'SELECT id FROM user_unlocks WHERE user_id = $1 AND content_id = $2',
      [userId, id]
    );
    if (existingUnlock.rows.length > 0) {
      return res.status(400).json({ error: 'Content already unlocked' });
    }

    // Calculate cost based on total unlocks
    const unlockCount = await query(
      'SELECT COUNT(*) FROM user_unlocks WHERE user_id = $1',
      [userId]
    );
    const totalUnlocks = parseInt(unlockCount.rows[0].count);
    const cost = totalUnlocks === 0 ? 5 : 15;

    // Check balance
    const userResult = await query(
      'SELECT points_balance FROM users WHERE id = $1',
      [userId]
    );
    const balance = userResult.rows[0].points_balance;

    if (balance < cost) {
      return res.status(400).json({ error: 'Not enough points', required: cost, balance });
    }

    // Deduct points
    await query(
      'UPDATE users SET points_balance = points_balance - $1 WHERE id = $2',
      [cost, userId]
    );

    // Create unlock record
    await query(
      'INSERT INTO user_unlocks (user_id, content_id) VALUES ($1, $2)',
      [userId, id]
    );

    // Create points transaction
    await query(
      `INSERT INTO points_transactions (user_id, points_amount, transaction_type, description)
       VALUES ($1, $2, 'spent', 'Unlocked content')`,
      [userId, -cost]
    );

    res.json({ message: 'Content unlocked', points_spent: cost, remaining_balance: balance - cost });
  } catch (err) {
    console.error('Unlock error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
