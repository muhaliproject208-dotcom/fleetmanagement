-- DISABLE RLS TEMPORARILY - Run this in Supabase SQL Editor
-- This will allow profile creation to work immediately

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Disable RLS on profiles table  
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Check current status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'profiles');

-- Test insert (you can run this to verify it works)
-- INSERT INTO users (id, email, role) VALUES ('test-id', 'test@example.com', 'driver');

-- Re-enable RLS with permissive policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create very permissive policies for testing
DROP POLICY IF EXISTS "Enable all for authenticated users" ON users;
CREATE POLICY "Enable all for authenticated users" ON users FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all for authenticated users" ON profiles;
CREATE POLICY "Enable all for authenticated users" ON profiles FOR ALL USING (auth.role() = 'authenticated');

-- Verify policies are active
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'profiles');
