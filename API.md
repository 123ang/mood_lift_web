# MoodLift API Documentation

**Production base URL:** `https://moodlift.suntzutechnologies.com/api`

For deployment (Nginx, PM2, PostgreSQL), see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Authentication

Most endpoints require a JWT. Send it in the request header:

```
Authorization: Bearer <your_jwt_token>
```

You get a token from **Register** or **Login**. Use it for all subsequent requests that require auth.

---

## Rate limits

| Path | Limit |
|------|--------|
| `/api/auth/*` (login, register) | 20 requests per 15 minutes |
| All other `/api/*` | 100 requests per 15 minutes |

When exceeded, the API returns `429` with: `{ "error": "Too many requests, please try again later." }`.

---

## Endpoints

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Server health check |

**Response:** `200`

```json
{
  "status": "ok",
  "timestamp": "2025-02-13T12:00:00.000Z"
}
```

---

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/login` | No | Log in |
| GET | `/api/auth/profile` | Yes | Get current user profile |
| PUT | `/api/auth/profile` | Yes | Update profile |
| POST | `/api/auth/change-password` | Yes | Change password |

#### POST `/api/auth/register`

**Body:**

```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securePassword123"
}
```

| Field | Type | Required | Description |
|-------|------|-----------|-------------|
| email | string | Yes | Unique email |
| username | string | Yes | Unique username |
| password | string | Yes | Plain password |

**Success:** `201`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "points": 5,
    "points_balance": 5,
    "current_streak": 0,
    "last_checkin": null,
    "total_checkins": 0,
    "total_points_earned": 5,
    "notification_time": "08:00:00",
    "notifications_enabled": true,
    "is_admin": false,
    "created_at": "2025-02-13T12:00:00.000Z"
  }
}
```

**Errors:** `400` – missing fields; `409` – email or username already exists.

---

#### POST `/api/auth/login`

**Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Success:** `200` – same shape as register (`token`, `user`; `user` does not include `password_hash`).

**Errors:** `400` – missing fields; `401` – invalid credentials.

---

#### GET `/api/auth/profile`

**Headers:** `Authorization: Bearer <token>`

**Success:** `200`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "points": 15,
  "points_balance": 15,
  "current_streak": 3,
  "last_checkin": "2025-02-13T00:00:00.000Z",
  "total_checkins": 10,
  "total_points_earned": 50,
  "notification_time": "08:00:00",
  "notifications_enabled": true,
  "is_admin": false,
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

**Errors:** `401` – no/invalid token; `404` – user not found.

---

#### PUT `/api/auth/profile`

**Headers:** `Authorization: Bearer <token>`

**Body:** All fields optional; only send what you want to change.

```json
{
  "username": "newname",
  "notification_time": "09:00:00",
  "notifications_enabled": false
}
```

**Success:** `200` – full profile object (same shape as GET profile).

---

#### POST `/api/auth/change-password`

**Headers:** `Authorization: Bearer <token>`

**Body:**

```json
{
  "currentPassword": "oldPassword",
  "newPassword": "newSecurePassword"
}
```

**Success:** `200` – `{ "message": "Password updated successfully" }`

**Errors:** `400` – missing fields; `401` – current password incorrect.

---

### Content (`/api/content`)

Content categories: `encouragement` | `inspiration` | `jokes` | `facts`  
Content types: `text` | `quiz` | `qa`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/content/:category` | Optional | List content by category (paginated) |
| GET | `/api/content/:category/daily` | Yes | Get or create today’s daily content for user |
| POST | `/api/content/submit` | Yes | Submit new content |
| POST | `/api/content/:id/vote` | Yes | Upvote or downvote |
| POST | `/api/content/:id/report` | Yes | Report content |
| POST | `/api/content/:id/unlock` | Yes | Unlock content with points |

---

#### GET `/api/content/:category`

**Path:** `:category` = `encouragement` | `inspiration` | `jokes` | `facts`

**Query:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| sort | string | `newest` | `newest` or `top_rated` |

**Headers:** `Authorization: Bearer <token>` optional. If sent, each content item includes `user_vote`: `"up"` | `"down"` | `null`, and `is_unlocked`: `true` | `false`.

**Success:** `200`

```json
{
  "data": [
    {
      "id": "uuid",
      "content_text": "Optional text",
      "question": "Optional",
      "answer": "Optional",
      "option_a": "Optional",
      "option_b": "Optional",
      "option_c": "Optional",
      "option_d": "Optional",
      "correct_option": "a",
      "author": "Author name",
      "category": "encouragement",
      "content_type": "text",
      "submitted_by": "uuid",
      "submitter_username": "johndoe",
      "status": "active",
      "upvotes": 10,
      "downvotes": 1,
      "report_count": 0,
      "user_vote": "up",
      "is_unlocked": true,
      "created_at": "2025-02-13T12:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "total_pages": 5
}
```

---

#### GET `/api/content/:category/daily`

Returns today’s daily content for the authenticated user. If none exist, new assignments are created (up to 10 items).

**Success:** `200`

```json
[
  {
    "id": "uuid",
    "content_id": "uuid",
    "category": "encouragement",
    "position_in_day": 1,
    "is_unlocked": false,
    "content": {
      "id": "uuid",
      "content_text": "...",
      "question": "...",
      "answer": "...",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_option": "a",
      "author": "...",
      "category": "encouragement",
      "content_type": "quiz",
      "submitted_by": "uuid",
      "submitter_username": "johndoe",
      "status": "active",
      "upvotes": 0,
      "downvotes": 0,
      "report_count": 0,
      "user_vote": null,
      "is_unlocked": false,
      "created_at": "2025-02-13T12:00:00.000Z"
    }
  }
]
```

---

#### POST `/api/content/submit`

**Body:** At least `category` required. Other fields depend on `content_type`.

```json
{
  "category": "encouragement",
  "content_type": "text",
  "content_text": "You've got this!",
  "author": "Anonymous",
  "question": null,
  "answer": null,
  "option_a": null,
  "option_b": null,
  "option_c": null,
  "option_d": null,
  "correct_option": null
}
```

For quiz/qa, set `question`, `answer`, and options as needed. `content_type` defaults to `text`.

**Success:** `201` – full content object as stored.

**Errors:** `400` – category missing.

---

#### POST `/api/content/:id/vote`

**Body:**

```json
{
  "vote_type": "up"
}
```

`vote_type`: `"up"` | `"down"`. Re-voting updates the vote.

**Success:** `200` – returns the full updated content item:

```json
{
  "id": "uuid",
  "content_text": "...",
  "question": null,
  "answer": null,
  "option_a": null,
  "option_b": null,
  "option_c": null,
  "option_d": null,
  "correct_option": null,
  "author": "...",
  "category": "encouragement",
  "content_type": "text",
  "submitted_by": "uuid",
  "submitter_username": "johndoe",
  "status": "active",
  "upvotes": 11,
  "downvotes": 1,
  "report_count": 0,
  "user_vote": "up",
  "is_unlocked": true,
  "created_at": "2025-02-13T12:00:00.000Z"
}
```

**Errors:** `400` – `vote_type` missing or not `"up"`/`"down"`.

---

#### POST `/api/content/:id/report`

**Body:**

```json
{
  "reason": "Spam or inappropriate content"
}
```

**Success:** `200` – `{ "message": "Report submitted" }`. One report per user per content (duplicate is no-op).

**Errors:** `400` – reason missing.

---

#### POST `/api/content/:id/unlock`

Unlocks content for the user. First unlock costs 5 points; each additional unlock costs 15 points.

**Success:** `200`

```json
{
  "message": "Content unlocked",
  "points_spent": 5,
  "remaining_balance": 10
}
```

**Errors:** `400` – already unlocked, or `{ "error": "Not enough points", "required": 15, "balance": 5 }`.

---

### Check-in (`/api/checkin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/checkin/info` | Yes | Check-in status and next points |
| POST | `/api/checkin` | Yes | Perform daily check-in |

---

#### GET `/api/checkin/info`

**Success:** `200`

```json
{
  "current_streak": 3,
  "last_checkin": "2025-02-12T00:00:00.000Z",
  "total_checkins": 10,
  "can_checkin": true,
  "next_points": 1
}
```

Points: 1 point for streaks 1–6 days; from day 7, `round((5/7) * streak)`; +10 bonus every 30 days.

---

#### POST `/api/checkin`

**Success:** `200`

```json
{
  "message": "Check-in successful",
  "points_earned": 2,
  "new_streak": 4,
  "total_points": 17
}
```

**Errors:** `400` – already checked in today.

---

### Saved (`/api/saved`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/saved` | Yes | List saved items |
| POST | `/api/saved/:contentId` | Yes | Save content |
| DELETE | `/api/saved/:contentId` | Yes | Remove saved item |

---

#### GET `/api/saved`

**Query:** `category` (optional) – filter by content category.

**Success:** `200` – array of saved items with joined content fields:

```json
[
  {
    "id": "uuid",
    "saved_at": "2025-02-13T12:00:00.000Z",
    "content_id": "uuid",
    "category": "encouragement",
    "content_text": "...",
    "question": null,
    "answer": null,
    "option_a": null,
    "option_b": null,
    "option_c": null,
    "option_d": null,
    "correct_option": null,
    "author": "...",
    "content_type": "text"
  }
]
```

---

#### POST `/api/saved/:contentId`

**Success:** `201` – `{ "message": "Content saved" }`. Duplicate save is no-op.

---

#### DELETE `/api/saved/:contentId`

**Success:** `200` – `{ "message": "Saved item removed" }`

---

### Users (`/api/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/points-history` | Yes | Points transaction history |
| GET | `/api/users/stats` | Yes | User stats summary |

---

#### GET `/api/users/points-history`

**Query:** `page` (default 1), `limit` (default 50).

**Success:** `200`

```json
{
  "data": [
    {
      "id": "uuid",
      "transaction_type": "earned",
      "points_amount": 5,
      "description": "Daily check-in day 7",
      "created_at": "2025-02-13T12:00:00.000Z"
    }
  ],
  "total": 20,
  "page": 1,
  "total_pages": 1
}
```

`transaction_type`: `earned` | `spent`. `points_amount` is positive for earned, negative for spent.

---

#### GET `/api/users/stats`

**Success:** `200`

```json
{
  "points_balance": 25,
  "current_streak": 5,
  "total_checkins": 30,
  "total_points_earned": 80,
  "total_content_submitted": 2,
  "total_saved": 5,
  "member_since": "2025-01-01T00:00:00.000Z"
}
```

---

### Admin (`/api/admin`)

All admin routes require **Bearer token** and **admin user** (`is_admin: true`). Non-admin gets `403`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Dashboard counts |
| GET | `/api/admin/reported` | Reported content with report details |
| DELETE | `/api/admin/content/:id` | Soft-delete content (status → deleted) |

---

#### GET `/api/admin/stats`

**Success:** `200`

```json
{
  "total_users": 100,
  "total_content": 50,
  "total_reports": 5,
  "active_content": 48
}
```

---

#### GET `/api/admin/reported`

**Success:** `200` – array of content items that have reports, each with a `reports` array (id, user_id, reason, created_at) and `submitted_by_username`.

---

#### DELETE `/api/admin/content/:id`

**Success:** `200` – `{ "message": "Content deleted", "id": "uuid" }`

**Errors:** `404` – content not found.

---

## Common error responses

| Status | Meaning |
|--------|--------|
| 400 | Bad request – missing/invalid body or params |
| 401 | Unauthorized – no token, invalid token, or token expired |
| 403 | Forbidden – e.g. admin required |
| 404 | Resource not found |
| 409 | Conflict – e.g. email/username already exists |
| 429 | Too many requests (rate limit) |
| 500 | Server error |

Error body shape: `{ "error": "Message" }`. Some endpoints add fields (e.g. `required`, `balance` for unlock).

---

## Auth error messages

- `No token provided` – missing or wrong `Authorization` format (use `Bearer <token>`).
- `Invalid token` – malformed or wrong secret.
- `Token expired` – JWT expired; user must log in again.
- `User not found` – token valid but user was deleted.
