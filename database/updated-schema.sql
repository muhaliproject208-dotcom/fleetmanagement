-- Enhanced Fleet Safety Management System Schema

-- Companies/Organizations
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_number TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  industry TEXT,
  fleet_size INTEGER DEFAULT 0,
  safety_rating TEXT CHECK (safety_rating IN ('excellent', 'good', 'fair', 'poor')),
  insurance_provider TEXT,
  regulatory_compliance BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'company_admin', 'safety_manager', 'fleet_manager', 'supervisor', 
    'dispatcher', 'driver', 'vehicle_owner', 'mechanic', 'inspector',
    'system_admin', 'auditor', 'insurance_rep', 'regulator'
  )),
  company_id UUID REFERENCES companies(id),
  employee_id TEXT UNIQUE,
  license_number TEXT,
  license_expiry DATE,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced Profiles Table
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  department TEXT,
  position TEXT,
  hire_date DATE,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Vehicles Table
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT UNIQUE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  vehicle_type TEXT CHECK (vehicle_type IN ('truck', 'van', 'bus', 'car', 'motorcycle', 'other')),
  capacity INTEGER,
  fuel_type TEXT CHECK (fuel_type IN ('diesel', 'petrol', 'electric', 'hybrid', 'lpg')),
  owner_id UUID REFERENCES users(id), -- Vehicle Owner
  company_id UUID REFERENCES companies(id),
  insurance_policy_number TEXT,
  insurance_expiry DATE,
  registration_expiry DATE,
  last_maintenance DATE,
  next_maintenance DATE,
  status TEXT CHECK (status IN ('active', 'maintenance', 'retired', 'accident', 'inspection_required')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced Trips Table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES users(id),
  vehicle_id UUID REFERENCES vehicles(id),
  supervisor_id UUID REFERENCES users(id), -- Supervisor overseeing
  dispatcher_id UUID REFERENCES users(id), -- Who dispatched
  company_id UUID REFERENCES companies(id),
  trip_date TIMESTAMP NOT NULL,
  start_location TEXT NOT NULL,
  end_location TEXT NOT NULL,
  route TEXT,
  distance_km REAL,
  estimated_duration INTEGER, -- in minutes
  actual_duration INTEGER, -- in minutes
  purpose TEXT,
  cargo_description TEXT,
  cargo_weight REAL,
  status TEXT CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled', 'incident')) DEFAULT 'planned',
  aggregate_score INTEGER,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  critical_override BOOLEAN DEFAULT FALSE,
  weather_conditions TEXT,
  road_conditions TEXT,
  incident_report TEXT,
  completion_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trip Modules (11-Module Pre-Trip Inspection)
CREATE TABLE trip_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id),
  name TEXT NOT NULL,
  step INTEGER NOT NULL,
  score INTEGER,
  max_score INTEGER DEFAULT 100,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  status TEXT CHECK (status IN ('incomplete', 'complete', 'failed', 'skipped')) DEFAULT 'incomplete',
  inspector_id UUID REFERENCES users(id), -- Who inspected this module
  inspected_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Module Items (Detailed inspection items within modules)
CREATE TABLE module_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES trip_modules(id),
  label TEXT NOT NULL,
  field_type TEXT CHECK (field_type IN ('checkbox', 'text', 'number', 'photo', 'signature', 'measurement')),
  critical BOOLEAN DEFAULT FALSE,
  points INTEGER DEFAULT 0,
  value TEXT,
  remarks TEXT,
  photo_url TEXT,
  signature_url TEXT,
  measurement_value REAL,
  measurement_unit TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance Records
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id),
  mechanic_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  maintenance_type TEXT CHECK (maintenance_type IN ('routine', 'repair', 'inspection', 'emergency')),
  description TEXT NOT NULL,
  cost REAL,
  parts_used TEXT,
  labor_hours REAL,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  status TEXT CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'scheduled',
  next_maintenance_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inspections Table (Official inspections)
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id),
  inspector_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  inspection_type TEXT CHECK (inspection_type IN ('pre_trip', 'post_trip', 'monthly', 'annual', 'incident', 'random')),
  result TEXT CHECK (result IN ('pass', 'fail', 'conditional_pass')) NOT NULL,
  score INTEGER,
  findings TEXT,
  recommendations TEXT,
  next_inspection_date TIMESTAMP,
  certificate_number TEXT,
  status TEXT CHECK (status IN ('scheduled', 'in_progress', 'completed', 'failed')) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Incidents/Accidents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id),
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  incident_type TEXT CHECK (incident_type IN ('accident', 'breakdown', 'traffic_violation', 'near_miss', 'cargo_issue', 'other')),
  severity TEXT CHECK (severity IN ('minor', 'major', 'critical', 'fatal')),
  description TEXT NOT NULL,
  location TEXT,
  date_time TIMESTAMP NOT NULL,
  weather_conditions TEXT,
  road_conditions TEXT,
  injuries TEXT,
  fatalities INTEGER DEFAULT 0,
  property_damage REAL,
  police_report_number TEXT,
  insurance_claim_number TEXT,
  status TEXT CHECK (status IN ('reported', 'investigating', 'resolved', 'closed')) DEFAULT 'reported',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Documents Management
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT CHECK (entity_type IN ('user', 'vehicle', 'company', 'trip', 'incident')),
  entity_id UUID NOT NULL,
  document_type TEXT CHECK (document_type IN ('license', 'registration', 'insurance', 'inspection', 'training', 'certification', 'other')),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  expiry_date TIMESTAMP,
  issued_by TEXT,
  uploaded_by UUID REFERENCES users(id),
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Training Records
CREATE TABLE training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  training_type TEXT CHECK (training_type IN ('safety', 'defensive_driving', 'hazardous_materials', 'vehicle_operation', 'emergency_procedures', 'other')),
  title TEXT NOT NULL,
  provider TEXT,
  completion_date DATE NOT NULL,
  expiry_date DATE,
  certificate_url TEXT,
  score INTEGER,
  status TEXT CHECK (status IN ('completed', 'expired', 'in_progress')) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs (Enhanced)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('info', 'warning', 'error', 'success', 'reminder')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  is_read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Company Settings
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, setting_key)
);

-- Vehicle Assignments
CREATE TABLE vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  assigned_by UUID REFERENCES users(id),
  assigned_date TIMESTAMP NOT NULL,
  return_date TIMESTAMP,
  status TEXT CHECK (status IN ('active', 'returned', 'transferred')) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Critical Failures (Enhanced)
CREATE TABLE critical_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id),
  module_item_id UUID REFERENCES module_items(id),
  inspection_id UUID REFERENCES inspections(id),
  vehicle_id UUID REFERENCES vehicles(id),
  reported_by UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
  points_deducted INTEGER DEFAULT 0,
  resolution_required BOOLEAN DEFAULT TRUE,
  resolution_plan TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_vehicles_company_id ON vehicles(company_id);
CREATE INDEX idx_vehicles_owner_id ON vehicles(owner_id);
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_company_id ON trips(company_id);
CREATE INDEX idx_trips_date ON trips(trip_date);
CREATE INDEX idx_trip_modules_trip_id ON trip_modules(trip_id);
CREATE INDEX idx_maintenance_vehicle_id ON maintenance_records(vehicle_id);
CREATE INDEX idx_inspections_vehicle_id ON inspections(vehicle_id);
CREATE INDEX idx_incidents_company_id ON incidents(company_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Example RLS Policies (These would be expanded based on specific requirements)
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Company users can view company data" ON users FOR SELECT USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Drivers can view own trips" ON trips FOR SELECT USING (driver_id = auth.uid());
CREATE POLICY "Company users can view company trips" ON trips FOR SELECT USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);
