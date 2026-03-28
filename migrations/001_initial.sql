-- Watson Claw Initial Database Schema
-- Migration 001: Create core tables

-- Users table (自動創建，第一次對話時)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    university TEXT,
    major TEXT,
    year_of_study INTEGER,
    timezone TEXT DEFAULT 'Asia/Hong_Kong',
    language TEXT DEFAULT 'zh-HK',
    status TEXT DEFAULT 'active',
    onboarding_step TEXT DEFAULT 'new',
    default_reminder_minutes INTEGER DEFAULT 15,
    morning_summary BOOLEAN DEFAULT 1,
    weekend_quiet BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME,
    metadata TEXT -- JSON string for flexible user data
);

-- Create index on phone for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Reminders/Tasks table
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_phone TEXT NOT NULL,
    task_content TEXT NOT NULL,
    reminder_time DATETIME NOT NULL,
    original_time DATETIME, -- 用戶說的時間（原始解析）
    status TEXT DEFAULT 'pending', -- pending, sent, cancelled, snoozed
    priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
    category TEXT, -- class, meeting, assignment, personal, etc.
    recurring_pattern TEXT, -- daily, weekly, monthly, or NULL
    source TEXT DEFAULT 'whatsapp', -- whatsapp, calendar_sync, etc.
    metadata TEXT, -- JSON for additional data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
);

-- Indexes for reminders
CREATE INDEX IF NOT EXISTS idx_reminders_user_phone ON reminders(user_phone);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(reminder_time);
CREATE INDEX IF NOT EXISTS idx_reminders_status_time ON reminders(status, reminder_time);

-- Conversations table (message history)
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'incoming' or 'outgoing'
    intent TEXT, -- AI parsed intent
    sentiment TEXT, -- positive, neutral, negative
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_phone ON conversations(user_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);

-- User preferences table (for flexible settings)
CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_phone TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
    UNIQUE(user_phone, key)
);

-- Analytics/events table
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_phone TEXT,
    event_type TEXT NOT NULL,
    event_data TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- Migration tracking
CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO _migrations (name) VALUES ('001_initial.sql');
