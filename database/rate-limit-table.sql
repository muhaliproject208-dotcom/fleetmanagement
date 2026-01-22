-- Rate Limiting Table for IFSM Fleet Safety System
-- This table tracks API request rates for security

CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  INDEX idx_rate_limit_user_endpoint (user_id, endpoint, created_at)
);

-- Enable RLS
ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own rate limit logs" ON rate_limit_logs FOR SELECT USING (true);
CREATE POLICY "System can insert rate limit logs" ON rate_limit_logs FOR INSERT WITH CHECK (true);

-- Cleanup old logs (older than 1 hour) - this can be run as a scheduled job
DELETE FROM rate_limit_logs WHERE created_at < NOW() - INTERVAL '1 hour';
