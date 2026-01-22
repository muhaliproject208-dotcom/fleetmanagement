-- Add is_verified column to users table
ALTER TABLE users 
ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX idx_users_is_verified ON users(is_verified);

-- Add comment
COMMENT ON COLUMN users.is_verified IS 'Flag to track if user has verified their email via OTP';
