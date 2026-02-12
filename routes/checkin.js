const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function calculatePoints(streak) {
  let points = 0;
  if (streak >= 1 && streak <= 6) {
    points = 1;
  } else if (streak >= 7) {
    points = Math.round((5 / 7) * streak);
  }
  // Bonus for every 30th day
  if (streak > 0 && streak % 30 === 0) {
    points += 10;
  }
  return points;
}

function canCheckinToday(lastCheckin) {
  if (!lastCheckin) return true;
  const last = new Date(lastCheckin);
  const today = new Date();
  return (
    last.getFullYear() !== today.getFullYear() ||
    last.getMonth() !== today.getMonth() ||
    last.getDate() !== today.getDate()
  );
}

function wasYesterday(lastCheckin) {
  if (!lastCheckin) return false;
  const last = new Date(lastCheckin);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    last.getFullYear() === yesterday.getFullYear() &&
    last.getMonth() === yesterday.getMonth() &&
    last.getDate() === yesterday.getDate()
  );
}

// GET /info
router.get('/info', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT current_streak, last_checkin, total_checkins FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const can_checkin = canCheckinToday(user.last_checkin);

    // Calculate next points: based on what the streak would be after check-in
    let nextStreak;
    if (wasYesterday(user.last_checkin)) {
      nextStreak = user.current_streak + 1;
    } else if (can_checkin) {
      nextStreak = 1;
    } else {
      nextStreak = user.current_streak;
    }
    const next_points = calculatePoints(nextStreak);

    res.json({
      current_streak: user.current_streak,
      last_checkin: user.last_checkin,
      total_checkins: user.total_checkins,
      can_checkin,
      next_points
    });
  } catch (err) {
    console.error('Check-in info error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /
router.post('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT current_streak, last_checkin, total_checkins, points_balance, total_points_earned FROM users WHERE id = $1',
      [req.user.id]
    );

    const user = result.rows[0];

    if (!canCheckinToday(user.last_checkin)) {
      return res.status(400).json({ error: 'Already checked in today' });
    }

    // Calculate new streak
    let newStreak;
    if (wasYesterday(user.last_checkin)) {
      newStreak = user.current_streak + 1;
    } else {
      newStreak = 1;
    }

    const pointsEarned = calculatePoints(newStreak);

    const updated = await query(
      `UPDATE users
       SET points_balance = points_balance + $1,
           total_points_earned = total_points_earned + $1,
           current_streak = $2,
           last_checkin = NOW(),
           total_checkins = total_checkins + 1
       WHERE id = $3
       RETURNING current_streak, last_checkin, total_checkins, points_balance, total_points_earned`,
      [pointsEarned, newStreak, req.user.id]
    );

    await query(
      `INSERT INTO points_transactions (user_id, amount, type, description)
       VALUES ($1, $2, 'earned', $3)`,
      [req.user.id, pointsEarned, `Daily check-in day ${newStreak}`]
    );

    const updatedUser = updated.rows[0];

    res.json({
      current_streak: updatedUser.current_streak,
      last_checkin: updatedUser.last_checkin,
      total_checkins: updatedUser.total_checkins,
      points_earned: pointsEarned,
      points_balance: updatedUser.points_balance,
      can_checkin: false
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
