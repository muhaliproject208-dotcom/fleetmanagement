-- Fix RLS Policy Recursion Issue
-- Run this in your Supabase SQL Editor to fix the infinite recursion error
-- This replaces the existing problematic policies with non-recursive versions

-- Drop existing recursive policies
DROP POLICY IF EXISTS "Allow user profile reads" ON users;
DROP POLICY IF EXISTS "Allow user profile inserts" ON users;
DROP POLICY IF EXISTS "Allow user profile updates" ON users;

-- Create corrected, non-recursive RLS policies for users table
-- These policies allow users to manage their own data without circular references

CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (id = auth.uid()));
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = auth.uid()));

-- Also fix any similar issues with profiles table if they exist
DROP POLICY IF EXISTS "Allow profile reads" ON profiles;
DROP POLICY IF EXISTS "Allow profile inserts" ON profiles;
DROP POLICY IF EXISTS "Allow profile updates" ON profiles;

CREATE POLICY "Users can view own profile data" ON profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow profile inserts" ON profiles FOR INSERT WITH CHECK (user_id = auth.uid()));
CREATE POLICY "Users can update own profile data" ON profiles FOR UPDATE USING (user_id = auth.uid()));

-- Verify the policies are created correctly
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
