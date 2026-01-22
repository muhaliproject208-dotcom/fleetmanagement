-- Enhanced profiles table for comprehensive driver data
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS national_id TEXT,
ADD COLUMN IF NOT EXISTS employee_id TEXT,
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id),
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS license_class TEXT,
ADD COLUMN IF NOT EXISTS license_expiry DATE,
ADD COLUMN IF NOT EXISTS medical_fitness_status TEXT DEFAULT 'valid',
ADD COLUMN IF NOT EXISTS last_medical_check DATE,
ADD COLUMN IF NOT EXISTS assigned_vehicle_id TEXT,
ADD COLUMN IF NOT EXISTS vehicle_plate TEXT,
ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
ADD COLUMN IF NOT EXISTS depot_unit TEXT,
ADD COLUMN IF NOT EXISTS primary_route TEXT,
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'terminated')),
ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'driver' CHECK (access_level IN ('driver', 'supervisor', 'mechanic', 'admin')),
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_action TIMESTAMP WITH TIME ZONE;

-- Create certifications table
CREATE TABLE IF NOT EXISTS public.certifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certification_type TEXT NOT NULL,
  certification_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'suspended', 'revoked')),
  issuing_authority TEXT,
  document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'fleet' CHECK (type IN ('fleet', 'depot', 'company')),
  address TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_logs table for activity tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_certifications_driver_id ON public.certifications(driver_id);
CREATE INDEX IF NOT EXISTS idx_certifications_expiry ON public.certifications(expiry_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- Enable RLS
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for certifications
CREATE POLICY "Drivers can view their own certifications" ON public.certifications
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own certifications" ON public.certifications
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their own certifications" ON public.certifications
  FOR UPDATE USING (auth.uid() = driver_id);

-- RLS Policies for organizations
CREATE POLICY "Anyone can view organizations" ON public.organizations
  FOR SELECT USING (true);

-- RLS Policies for audit_logs
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Trigger to auto-update timestamps
CREATE TRIGGER update_certifications_updated_at
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default organization if none exists
INSERT INTO public.organizations (name, type) 
VALUES ('Default Fleet', 'fleet')
ON CONFLICT DO NOTHING;
