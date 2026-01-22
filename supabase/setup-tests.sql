-- Create tests table for storing test results
CREATE TABLE IF NOT EXISTS public.tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  test_type TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER NOT NULL,
  answers JSONB NOT NULL,
  sections JSONB NOT NULL,
  completion_time_ms INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tests_driver_id ON public.tests(driver_id);
CREATE INDEX IF NOT EXISTS idx_tests_test_type ON public.tests(test_type);
CREATE INDEX IF NOT EXISTS idx_tests_created_at ON public.tests(created_at DESC);

-- Enable RLS
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own tests" ON public.tests
  FOR SELECT USING (auth.uid()::text = driver_id);

CREATE POLICY "Users can insert their own tests" ON public.tests
  FOR INSERT WITH CHECK (auth.uid()::text = driver_id);

CREATE POLICY "Users can update their own tests" ON public.tests
  FOR UPDATE USING (auth.uid()::text = driver_id);

-- Grant permissions
GRANT ALL ON public.tests TO authenticated;
GRANT SELECT ON public.tests TO anon;
