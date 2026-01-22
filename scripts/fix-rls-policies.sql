-- Fix RLS Policies for User Profile Creation
-- Run this in your Supabase SQL Editor to fix the "new row violates row-level security policy" error

-- Drop existing policies that are too restrictive
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Create proper policies for user table
CREATE POLICY "Allow user profile reads" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow user profile inserts" ON users FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Allow user profile updates" ON users FOR UPDATE USING (id = auth.uid());

-- Drop existing restrictive policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile data" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile data" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile data" ON profiles;

-- Create proper policies for profiles table
CREATE POLICY "Allow profile reads" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow profile inserts" ON profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow profile updates" ON profiles FOR UPDATE USING (user_id = auth.uid());

-- Verify policies are created
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
