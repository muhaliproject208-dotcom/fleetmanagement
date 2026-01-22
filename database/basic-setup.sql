-- Basic Fleet Safety System Database Setup
-- Run this in your Supabase SQL Editor if tables don't exist

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE,
  role TEXT CHECK (role IN ('driver', 'supervisor', 'mechanic', 'org_admin', 'admin')),
  org_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  full_name TEXT,
  phone TEXT,
  license_number TEXT,
  vehicle_id TEXT,
  vehicle_plate TEXT,
  avatar_url TEXT
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  org_id UUID,
  trip_date TIMESTAMP,
  route TEXT,
  status TEXT CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'completed')),
  aggregate_score INT,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  critical_override BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trip Modules table
CREATE TABLE IF NOT EXISTS trip_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id),
  name TEXT,
  step INT,
  score INT,
  risk_level TEXT,
  status TEXT CHECK (status IN ('incomplete', 'complete', 'failed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Module Items table
CREATE TABLE IF NOT EXISTS module_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES trip_modules(id),
  label TEXT,
  field_type TEXT,
  critical BOOLEAN,
  points INT,
  value TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_items ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (you may want to customize these)
-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (id = auth.uid());

-- Allow users to update their own profile  
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = auth.uid());

-- Allow authenticated users to read all user profiles (needed for signup flow)
CREATE POLICY "Allow profile reads for authenticated users" ON users FOR SELECT USING (auth.role() = 'authenticated');

-- Allow users to view own profile data
CREATE POLICY "Users can view own profile data" ON profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile data" ON profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile data" ON profiles FOR UPDATE USING (user_id = auth.uid());

-- Allow authenticated users to read all profiles (needed for signup flow)
CREATE POLICY "Allow profile reads for authenticated users" ON profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view own trips" ON trips FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own trips" ON trips FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own trips" ON trips FOR UPDATE USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trip_modules_trip_id ON trip_modules(trip_id);
CREATE INDEX IF NOT EXISTS idx_module_items_module_id ON module_items(module_id);

-- Grant necessary permissions
GRANT ALL ON users TO authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON trips TO authenticated;
GRANT ALL ON trip_modules TO authenticated;
GRANT ALL ON module_items TO authenticated;

GRANT SELECT ON users TO anon;
GRANT SELECT ON profiles TO anon;
GRANT SELECT ON trips TO anon;
GRANT SELECT ON trip_modules TO anon;
GRANT SELECT ON module_items TO anon;
