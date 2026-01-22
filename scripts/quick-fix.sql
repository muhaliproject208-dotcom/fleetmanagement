-- QUICK FIX: Run this immediately in Supabase SQL Editor

-- First, disable RLS temporarily to allow profile creation
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Allow the signup to work
-- Then re-enable with proper policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create simple, working policies
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Allow authenticated users to do everything (for now)
CREATE POLICY "Enable all for authenticated users" ON users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON profiles FOR ALL USING (auth.role() = 'authenticated');

-- Test the policy by checking current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'profiles')
ORDER BY schemaname, tablename, policyname;
