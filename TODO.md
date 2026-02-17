# MoodLift Backend – TODO

Based on: `BACKEND.md`, `BACKEND_FEED_FIX.md`, `BACKEND_LOGIN_IDENTITY_FIX.md`

---

## 1. Add `GET /content/feed` route

**File:** `routes/content.js`
**Priority:** High
**Status:** [ ] Not started

The feed endpoint is completely missing. If you call `/content/feed` today, the `/:category` catch-all treats `"feed"` as a category name, which matches nothing in the DB.

**What to do:**

- Add a `GET /feed` route **before** the `GET /:category` catch-all in `routes/content.js`.
- Query the `content` table: `WHERE submitted_by IS NOT NULL AND status = 'active'`, ordered by `created_at DESC`.
- **Do NOT** filter by the current user — the feed shows everyone's posts.
- Support `?page=1&limit=20&sort=newest` query params.
- JOIN with `users` to get `submitter_username`, and optionally JOIN `content_votes` / `user_unlocks` if the user is authenticated (for `user_vote`, `is_unlocked`).
- Return the standard paginated shape:

```json
{
  "data": [ ... ],
  "total": 42,
  "page": 1,
  "total_pages": 3
}
```

---

## 2. Add `GET /content/mine` route

**File:** `routes/content.js`
**Priority:** High
**Status:** [ ] Not started

There is no endpoint for the "My Content" screen. The app needs a way to fetch only the current user's submissions.

**What to do:**

- Add a `GET /mine` route **before** the `GET /:category` catch-all in `routes/content.js`.
- Requires authentication.
- Query: `WHERE submitted_by = $1` (current user's id from token), ordered by `created_at DESC`.
- Same paginated response shape as the feed.

---

## 3. Award 1 point on content submission

**File:** `routes/content.js` — `POST /submit` handler
**Priority:** High
**Status:** [ ] Not started

Currently `POST /content/submit` inserts the content row and returns it, but does **not** reward the user. The app expects 1 point for each submission.

**What to do (after the INSERT into content, before the response):**

1. Update the user's balance:

```sql
UPDATE users
SET points_balance = points_balance + 1,
    total_points_earned = total_points_earned + 1
WHERE id = $1;
```

2. Record the transaction:

```sql
INSERT INTO points_transactions (user_id, transaction_type, points_amount, description)
VALUES ($1, 'earned', 1, 'Content submission');
```

3. Return the created content as before (no response shape change needed).

---

## 4. Add debug logging to auth (optional, for troubleshooting)

**Files:** `routes/auth.js`
**Priority:** Low
**Status:** [ ] Not started

Add `console.log` statements so you can verify identity stability across login/logout cycles. Not a functional bug — the identity logic is already correct (UNIQUE email, single row per user, profile includes points).

**What to add:**

- **POST /register** — after creating the user:
  ```js
  console.log('[SIGNUP] resolved users.id for', email, ':', user.id);
  ```

- **POST /login** — after finding the user:
  ```js
  console.log('[LOGIN] resolved users.id for', email, ':', user.id);
  ```

- **GET /profile** — before returning:
  ```js
  console.log('[PROFILE] req.user.id:', req.user.id, '| DB row:', { id: row.id, email: row.email, points_balance: row.points_balance });
  ```

---

## Already done (no action needed)

These items from the three docs are already implemented correctly:

| Item | Status |
|------|--------|
| Single spendable balance (`points_balance`) used in profile, stats, unlock, check-in | Done |
| Login identity: same email = same `users` row (UNIQUE constraint) | Done |
| Register rejects duplicate email/username (409) | Done |
| Profile response includes `points`, `points_balance`, `total_points_earned` | Done |
| Login response returns full user object (minus password_hash) | Done |
| Check-in adds reward to `points_balance` + `total_points_earned`, records transaction | Done |
| Check-in response returns `message`, `points_earned`, `new_streak`, `total_points` | Done |
| Unlock checks balance, deducts points, records `spent` transaction | Done |
| Unlock cost: 5 first, 15 after (matches iOS app) | Done |
| Points history returns `{ data, total, page, total_pages }` with `transaction_type`, `points_amount` | Done |
| `points_transactions` table with correct columns | Done |
| Content list returns `{ data, total, page, total_pages }` with `submitter_username`, `report_count`, `is_unlocked` | Done |
| Daily content returns nested structure with `position_in_day`, `is_unlocked`, nested `content` object | Done |
| Vote returns full ContentItem | Done |
| SQL column names match schema (`transaction_type`, `points_amount`, `position_in_day`, `assignment_date`) | Done |
