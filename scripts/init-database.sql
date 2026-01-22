-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('driver', 'supervisor', 'mechanic', 'admin', 'org_admin')),
  org_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  license_number TEXT UNIQUE,
  vehicle_id TEXT,
  vehicle_plate TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  depot_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  trip_date DATE NOT NULL,
  route TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'completed')),
  aggregate_score INTEGER DEFAULT 0,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  critical_override BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trip modules table
CREATE TABLE IF NOT EXISTS trip_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  step INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'complete', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Module items table
CREATE TABLE IF NOT EXISTS module_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES trip_modules(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  critical BOOLEAN DEFAULT FALSE,
  points INTEGER DEFAULT 0,
  value TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Critical failures table
CREATE TABLE IF NOT EXISTS critical_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  module_item_id UUID REFERENCES module_items(id),
  description TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sign-offs table
CREATE TABLE IF NOT EXISTS sign_offs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  signature TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  trip_id UUID REFERENCES trips(id),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trip drafts table
CREATE TABLE IF NOT EXISTS trip_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  trip_id UUID REFERENCES trips(id),
  draft_data JSONB NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limit logs table
CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Corrective measures table
CREATE TABLE IF NOT EXISTS corrective_measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  measure_type TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES users(id),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_org_id ON trips(org_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_trip_id ON audit_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_corrective_measures_trip_id ON corrective_measures(trip_id);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sign_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrective_measures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drivers can only see their own trips
CREATE POLICY "drivers_view_own_trips" ON trips
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' IN ('admin', 'org_admin', 'supervisor'));

-- Supervisors can see trips from their org
CREATE POLICY "supervisors_view_org_trips" ON trips
  FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Only trip owner can update their draft
CREATE POLICY "drivers_update_own_drafts" ON trip_drafts
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can see everything
CREATE POLICY "admin_all_access" ON trips
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
