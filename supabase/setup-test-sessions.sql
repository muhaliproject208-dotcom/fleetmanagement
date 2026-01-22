-- =====================================================
-- TEST SESSIONS (persistent progress)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.test_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  test_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,
  answers JSONB DEFAULT '{}'::jsonb,
  test_data JSONB,
  final_score INTEGER,
  final_grade TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TEST RESULTS (final immutable results)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.test_sessions(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL,
  test_type TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  dispatch_status TEXT NOT NULL,
  answers JSONB NOT NULL,
  sections JSONB NOT NULL,
  completion_time_ms INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TEST HISTORY (summary view for UI & PDFs)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.test_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  test_type TEXT NOT NULL,
  session_id UUID NOT NULL REFERENCES public.test_sessions(id) ON DELETE CASCADE,
  result_id UUID NOT NULL REFERENCES public.test_results(id) ON DELETE CASCADE,
  final_score INTEGER NOT NULL,
  final_grade TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES (performance)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_test_sessions_driver_id
  ON public.test_sessions(driver_id);

CREATE INDEX IF NOT EXISTS idx_test_sessions_status
  ON public.test_sessions(status);

CREATE INDEX IF NOT EXISTS idx_test_sessions_driver_type
  ON public.test_sessions(driver_id, test_type);

CREATE INDEX IF NOT EXISTS idx_test_results_driver_id
  ON public.test_results(driver_id);

CREATE INDEX IF NOT EXISTS idx_test_results_test_type
  ON public.test_results(test_type);

CREATE INDEX IF NOT EXISTS idx_test_history_driver_id
  ON public.test_history(driver_id);

-- =====================================================
-- ENABLE RLS
-- =====================================================
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES (CORRECT & SAFE)
-- =====================================================

-- test_sessions
CREATE POLICY "Users can view own test sessions"
  ON public.test_sessions
  FOR SELECT
  USING (auth.uid()::text = driver_id);

CREATE POLICY "Users can create own test sessions"
  ON public.test_sessions
  FOR INSERT
  WITH CHECK (auth.uid()::text = driver_id);

CREATE POLICY "Users can update own test sessions"
  ON public.test_sessions
  FOR UPDATE
  USING (auth.uid()::text = driver_id);

CREATE POLICY "Users can delete own test sessions"
  ON public.test_sessions
  FOR DELETE
  USING (auth.uid()::text = driver_id);

-- test_results
CREATE POLICY "Users can view own test results"
  ON public.test_results
  FOR SELECT
  USING (auth.uid()::text = driver_id);

CREATE POLICY "Users can create own test results"
  ON public.test_results
  FOR INSERT
  WITH CHECK (auth.uid()::text = driver_id);

CREATE POLICY "Users can update own test results"
  ON public.test_results
  FOR UPDATE
  USING (auth.uid()::text = driver_id);

CREATE POLICY "Users can delete own test results"
  ON public.test_results
  FOR DELETE
  USING (auth.uid()::text = driver_id);

-- test_history
CREATE POLICY "Users can view own test history"
  ON public.test_history
  FOR SELECT
  USING (auth.uid()::text = driver_id);

CREATE POLICY "Users can create own test history"
  ON public.test_history
  FOR INSERT
  WITH CHECK (auth.uid()::text = driver_id);

-- =====================================================
-- GRANTS
-- =====================================================
GRANT ALL ON public.test_sessions TO authenticated;
GRANT ALL ON public.test_results TO authenticated;
GRANT ALL ON public.test_history TO authenticated;
