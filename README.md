# MoodLift Web - Backend API & Landing Page

A Node.js/Express backend API with PostgreSQL database and a beautiful landing page for the MoodLift iOS app.

## Features

- **RESTful API** for the MoodLift iOS app
- **PostgreSQL** database with full schema
- **JWT authentication** with bcrypt password hashing
- **Crowdsourced content** - users submit, vote, and report content
- **Points & streak system** - daily check-ins with progressive rewards
- **Content categories** - Encouragement, Inspiration, Fun Facts, Jokes
- **Auto-moderation** - content auto-removed after 5+ reports
- **Admin dashboard** endpoints
- **Beautiful landing page** with responsive design
- **Rate limiting** and security headers (Helmet)

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Quick Start

### 1. Clone and install dependencies

```bash
cd mood_lift_web
npm install
```

### 2. Set up PostgreSQL database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE moodlift;"

# Run the schema
psql -U postgres -d moodlift -f models/schema.sql
```

### 3. Configure environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your database credentials
# Update DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
# Set a secure JWT_SECRET for production
```

### 4. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3000` (or the port in your `.env`).
- Landing page: `http://localhost:3000`
- API: `http://localhost:3000/api`
- Health check: `http://localhost:3000/api/health`

### 5. Test with the iOS app

The MoodLift iOS app is configured to use `http://localhost:3000/api` when running in the simulator. Keep this backend running, then open the iOS project and run the app (⌘R). Sign up and login will work against this local API.

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login | No |
| GET | `/api/auth/profile` | Get user profile | Yes |
| PUT | `/api/auth/profile` | Update profile | Yes |
| POST | `/api/auth/change-password` | Change password | Yes |

### Content (Crowdsourced)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/content/:category` | Get content list | Optional |
| GET | `/api/content/:category/daily` | Get daily assignments | Yes |
| POST | `/api/content/submit` | Submit new content | Yes |
| POST | `/api/content/:id/vote` | Vote on content | Yes |
| POST | `/api/content/:id/report` | Report content | Yes |
| POST | `/api/content/:id/unlock` | Unlock content | Yes |

### Daily Check-in
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/checkin/info` | Get check-in status | Yes |
| POST | `/api/checkin` | Perform check-in | Yes |

### Saved Items
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/saved` | Get saved items | Yes |
| POST | `/api/saved/:contentId` | Save content | Yes |
| DELETE | `/api/saved/:contentId` | Remove saved | Yes |

### User
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/users/points-history` | Points transactions | Yes |
| GET | `/api/users/stats` | User statistics | Yes |

### Admin
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| DELETE | `/api/admin/content/:id` | Delete content | Admin |
| GET | `/api/admin/reported` | Reported content | Admin |
| GET | `/api/admin/stats` | Dashboard stats | Admin |

## Points System

- **Daily check-in**: Days 1-6 = 1 point, Day 7+ = (5/7) * day (rounded)
- **30-day bonus**: +10 points every 30th day
- **First unlock**: 5 points
- **Subsequent unlocks**: 15 points
- **Initial signup**: 5 bonus points

## Content Moderation

- Users can report content with a reason
- Content is automatically removed (status: `auto_removed`) after 5+ unique reports
- Admins can manually delete any content
- Admins can view all reported content with details

## Database Schema

See `models/schema.sql` for the complete schema including:
- `users` - User accounts and points
- `content` - Crowdsourced content items
- `content_votes` - Upvotes/downvotes
- `content_reports` - User reports
- `user_unlocks` - Unlocked content
- `saved_items` - Bookmarked content
- `points_transactions` - Points history
- `daily_content_assignments` - Daily content per user
- `user_viewed_content` - View tracking

## Project Structure

```
mood_lift_web/
├── server.js              # Express app entry point
├── config/
│   └── database.js        # PostgreSQL connection pool
├── middleware/
│   ├── auth.js            # JWT authentication
│   └── admin.js           # Admin authorization
├── routes/
│   ├── auth.js            # Auth endpoints
│   ├── content.js         # Content CRUD & crowdsourcing
│   ├── checkin.js         # Daily check-in
│   ├── saved.js           # Saved items
│   ├── users.js           # User stats & history
│   └── admin.js           # Admin endpoints
├── models/
│   └── schema.sql         # Database schema
├── public/                # Landing page
│   ├── index.html
│   ├── css/style.css
│   └── js/main.js
├── package.json
├── .env.example
└── README.md
```

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use a strong `JWT_SECRET`
3. Set up PostgreSQL with proper credentials
4. Use a process manager like PM2
5. Set up HTTPS with a reverse proxy (Nginx)
6. Configure CORS for your domain
