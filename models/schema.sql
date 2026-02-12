-- MoodLift Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    points INTEGER DEFAULT 5,
    points_balance INTEGER DEFAULT 5,
    current_streak INTEGER DEFAULT 0,
    last_checkin TIMESTAMPTZ,
    total_checkins INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 5,
    notification_time TIME DEFAULT '08:00:00',
    notifications_enabled BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTENT TABLE (Crowdsourced)
-- ============================================
CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_text TEXT,
    question TEXT,
    answer TEXT,
    option_a VARCHAR(255),
    option_b VARCHAR(255),
    option_c VARCHAR(255),
    option_d VARCHAR(255),
    correct_option VARCHAR(1),
    author VARCHAR(255),
    category VARCHAR(50) NOT NULL CHECK (category IN ('encouragement', 'inspiration', 'jokes', 'facts')),
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'quiz', 'qa')),
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'auto_removed')),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    report_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_category ON content(category);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_submitted_by ON content(submitted_by);
CREATE INDEX idx_content_upvotes ON content(upvotes DESC);

-- ============================================
-- CONTENT VOTES TABLE
-- ============================================
CREATE TABLE content_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, content_id)
);

CREATE INDEX idx_content_votes_content ON content_votes(content_id);
CREATE INDEX idx_content_votes_user ON content_votes(user_id);

-- ============================================
-- CONTENT REPORTS TABLE
-- ============================================
CREATE TABLE content_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, content_id)
);

CREATE INDEX idx_content_reports_content ON content_reports(content_id);

-- ============================================
-- USER UNLOCKS TABLE
-- ============================================
CREATE TABLE user_unlocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    points_spent INTEGER DEFAULT 0,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, content_id)
);

CREATE INDEX idx_user_unlocks_user ON user_unlocks(user_id);

-- ============================================
-- SAVED ITEMS TABLE
-- ============================================
CREATE TABLE saved_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, content_id)
);

CREATE INDEX idx_saved_items_user ON saved_items(user_id);

-- ============================================
-- POINTS TRANSACTIONS TABLE
-- ============================================
CREATE TABLE points_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('earned', 'spent')),
    points_amount INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_transactions_user ON points_transactions(user_id);
CREATE INDEX idx_points_transactions_created ON points_transactions(created_at DESC);

-- ============================================
-- DAILY CONTENT ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE daily_content_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    position_in_day INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, content_id, assignment_date)
);

CREATE INDEX idx_daily_assignments_user_date ON daily_content_assignments(user_id, assignment_date);

-- ============================================
-- USER VIEWED CONTENT TABLE
-- ============================================
CREATE TABLE user_viewed_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    view_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, content_id, view_date)
);

CREATE INDEX idx_user_viewed_user ON user_viewed_content(user_id);

-- ============================================
-- HELPER FUNCTION: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at
    BEFORE UPDATE ON content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTION: Auto-remove content at 5+ reports
-- ============================================
CREATE OR REPLACE FUNCTION check_report_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE content 
    SET status = 'auto_removed', report_count = (
        SELECT COUNT(*) FROM content_reports WHERE content_id = NEW.content_id
    )
    WHERE id = NEW.content_id 
    AND (SELECT COUNT(*) FROM content_reports WHERE content_id = NEW.content_id) >= 5;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER auto_remove_reported_content
    AFTER INSERT ON content_reports
    FOR EACH ROW EXECUTE FUNCTION check_report_count();
