-- Fix schema mismatch and add missing email auth columns

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source TEXT DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_date TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add user_id to sync_history for analytics tracking
ALTER TABLE sync_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Add missing mode column to sync_configs table
ALTER TABLE sync_configs ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'github';

-- Create verificationTokens table (for email verification)
CREATE TABLE IF NOT EXISTS "verificationTokens" (
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires TIMESTAMP NOT NULL
);

-- Create analytics table for user event tracking
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for analytics table
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_history_user_id ON sync_history(user_id);
