-- Create test_attempts table for proper test lifecycle management
CREATE TABLE IF NOT EXISTS public.test_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id UUID REFERENCES tests(id) ON DELETE SET NULL,
  test_type TEXT NOT NULL DEFAULT 'Pre-Trip Inspection',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  pass BOOLEAN,
  answers JSONB DEFAULT '[]',
  currentQuestion INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_id ON public.test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_status ON public.test_attempts(status);
CREATE INDEX IF NOT EXISTS idx_test_attempts_test_type ON public.test_attempts(test_type);
CREATE INDEX IF NOT EXISTS idx_test_attempts_started_at ON public.test_attempts(started_at);

-- Enable RLS
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own test attempts" ON public.test_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own test attempts" ON public.test_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own test attempts" ON public.test_attempts
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_test_attempts_updated_at
  BEFORE UPDATE ON public.test_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create schedules table for Quick Actions
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_name TEXT NOT NULL,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  vehicle_id TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for schedules
CREATE INDEX IF NOT EXISTS idx_schedules_driver_id ON public.schedules(driver_id);
CREATE INDEX IF NOT EXISTS idx_schedules_shift_date ON public.schedules(shift_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON public.schedules(status);

-- Enable RLS for schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedules
CREATE POLICY "Drivers can view their own schedules" ON public.schedules
  FOR SELECT USING (auth.uid() = driver_id);

-- Trigger to auto-update schedules updated_at
CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
