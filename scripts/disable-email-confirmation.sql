-- DISABLE EMAIL CONFIRMATION IN SUPABASE
-- Run this in your Supabase SQL Editor to completely disable email confirmation

-- Method 1: Update auth.users table to mark all emails as confirmed
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

-- Method 2: Disable email confirmation requirement (if supported)
-- This removes the need for email confirmation at the project level
ALTER TABLE auth.users ALTER COLUMN email_confirmed_at DROP NOT NULL SET DEFAULT NOW();

-- Method 3: Create a trigger to auto-confirm new users
CREATE OR REPLACE FUNCTION auto_confirm_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_email();

-- Verify changes
SELECT 
  email,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN 'Confirmed'
    ELSE 'Not Confirmed'
  END as confirmation_status
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;
