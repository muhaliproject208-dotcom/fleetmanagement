-- Database functions for comprehensive reporting and session management
-- These functions support the enterprise-grade checklist system

-- =====================================================
-- GET LAST TEST WITH DETAILS
-- Returns the most recent test for a driver with all module details
-- =====================================================
CREATE OR REPLACE FUNCTION get_last_test_with_details(driver_id UUID)
RETURNS TABLE (
  id UUID,
  trip_date DATE,
  route TEXT,
  aggregate_score INTEGER,
  risk_level TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  driver_full_name TEXT,
  driver_email TEXT,
  driver_role TEXT,
  step INTEGER,
  name TEXT,
  label TEXT,
  value TEXT,
  points INTEGER,
  critical BOOLEAN,
  field_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.trip_date,
    t.route,
    t.aggregate_score,
    t.risk_level,
    t.status,
    t.created_at,
    t.updated_at as completed_at,
    u.full_name as driver_full_name,
    u.email as driver_email,
    u.role as driver_role,
    tm.step,
    tm.name,
    mi.label,
    mi.value,
    mi.points,
    mi.critical,
    mi.field_type
  FROM trips t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN trip_modules tm ON tm.trip_id = t.id
  LEFT JOIN module_items mi ON mi.module_id = tm.id
  WHERE t.user_id = get_last_test_with_details.driver_id
  ORDER BY t.created_at DESC, tm.step ASC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GET FULL CHECKLIST REPORT
-- Returns complete checklist data for a specific trip
-- =====================================================
CREATE OR REPLACE FUNCTION get_full_checklist_report(trip_id UUID)
RETURNS TABLE (
  id UUID,
  trip_date DATE,
  route TEXT,
  aggregate_score INTEGER,
  risk_level TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  driver_full_name TEXT,
  driver_email TEXT,
  driver_role TEXT,
  step INTEGER,
  name TEXT,
  label TEXT,
  value TEXT,
  points INTEGER,
  critical BOOLEAN,
  field_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.trip_date,
    t.route,
    t.aggregate_score,
    t.risk_level,
    t.status,
    t.created_at,
    u.full_name as driver_full_name,
    u.email as driver_email,
    u.role as driver_role,
    tm.step,
    tm.name,
    mi.label,
    mi.value,
    mi.points,
    mi.critical,
    mi.field_type
  FROM trips t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN trip_modules tm ON tm.trip_id = t.id
  LEFT JOIN module_items mi ON mi.module_id = tm.id
  WHERE t.id = get_full_checklist_report.trip_id
  ORDER BY tm.step ASC, mi.id ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GET DRIVER PERFORMANCE SUMMARY
-- Returns performance metrics for a driver over time
-- =====================================================
CREATE OR REPLACE FUNCTION get_driver_performance_summary(driver_id UUID, days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_trips INTEGER,
  approved_trips INTEGER,
  failed_trips INTEGER,
  pending_trips INTEGER,
  compliance_rate DECIMAL,
  average_score DECIMAL,
  risk_distribution JSONB,
  last_trip_date DATE,
  current_risk_level TEXT
) AS $$
DECLARE
  total INTEGER;
  approved INTEGER;
  failed INTEGER;
  pending INTEGER;
  avg_score DECIMAL;
  last_date DATE;
  current_risk TEXT;
  risk_dist JSONB;
BEGIN
  -- Get trip counts
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'approved') as approved,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    ROUND(AVG(aggregate_score), 2) as avg_score,
    MAX(trip_date) as last_date,
    risk_level
  INTO total, approved, failed, pending, avg_score, last_date, current_risk
  FROM trips
  WHERE user_id = get_driver_performance_summary.driver_id
    AND trip_date >= CURRENT_DATE - INTERVAL '1 day' * get_driver_performance_summary.days
  ORDER BY created_at DESC
  LIMIT 1;

  -- Calculate risk distribution
  SELECT jsonb_build_object(
    'low', COUNT(*) FILTER (WHERE risk_level = 'low'),
    'medium', COUNT(*) FILTER (WHERE risk_level = 'medium'),
    'high', COUNT(*) FILTER (WHERE risk_level = 'high')
  )
  INTO risk_dist
  FROM trips
  WHERE user_id = get_driver_performance_summary.driver_id
    AND trip_date >= CURRENT_DATE - INTERVAL '1 day' * get_driver_performance_summary.days;

  -- Return results
  RETURN QUERY
  SELECT 
    total,
    approved,
    failed,
    pending,
    CASE WHEN total > 0 THEN ROUND((approved::DECIMAL / total::DECIMAL) * 100, 2) ELSE 0 END as compliance_rate,
    COALESCE(avg_score, 0) as average_score,
    COALESCE(risk_dist, '{}'::jsonb) as risk_distribution,
    last_date,
    COALESCE(current_risk, 'low') as current_risk_level;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GET ORGANIZATION COMPLIANCE REPORT
-- Returns comprehensive compliance metrics for an organization
-- =====================================================
CREATE OR REPLACE FUNCTION get_organization_compliance_report(org_id UUID, days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_trips INTEGER,
  approved_trips INTEGER,
  failed_trips INTEGER,
  pending_trips INTEGER,
  compliance_rate DECIMAL,
  failure_rate DECIMAL,
  average_score DECIMAL,
  risk_distribution JSONB,
  role_performance JSONB,
  top_violations JSONB
) AS $$
DECLARE
  total INTEGER;
  approved INTEGER;
  failed INTEGER;
  pending INTEGER;
  avg_score DECIMAL;
  risk_dist JSONB;
  role_perf JSONB;
  top_violations JSONB;
BEGIN
  -- Get basic metrics
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'approved') as approved,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    ROUND(AVG(aggregate_score), 2) as avg_score
  INTO total, approved, failed, pending, avg_score
  FROM trips
  WHERE org_id = get_organization_compliance_report.org_id
    AND trip_date >= CURRENT_DATE - INTERVAL '1 day' * get_organization_compliance_report.days;

  -- Calculate risk distribution
  SELECT jsonb_build_object(
    'low', COUNT(*) FILTER (WHERE risk_level = 'low'),
    'medium', COUNT(*) FILTER (WHERE risk_level = 'medium'),
    'high', COUNT(*) FILTER (WHERE risk_level = 'high')
  )
  INTO risk_dist
  FROM trips
  WHERE org_id = get_organization_compliance_report.org_id
    AND trip_date >= CURRENT_DATE - INTERVAL '1 day' * get_organization_compliance_report.days;

  -- Calculate performance by role
  SELECT jsonb_object_agg(u.role, role_stats)
  INTO role_perf
  FROM (
    SELECT 
      u.role,
      jsonb_build_object(
        'trips', COUNT(*),
        'average_score', ROUND(AVG(t.aggregate_score), 2),
        'compliance_rate', ROUND((COUNT(*) FILTER (WHERE t.status = 'approved')::DECIMAL / COUNT(*)) * 100, 2)
      ) as role_stats
    FROM trips t
    JOIN users u ON u.id = t.user_id
    WHERE t.org_id = get_organization_compliance_report.org_id
      AND t.trip_date >= CURRENT_DATE - INTERVAL '1 day' * get_organization_compliance_report.days
    GROUP BY u.role
  ) role_data;

  -- Get top violations
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', mi.label,
      'count', COUNT(*),
      'points', SUM(mi.points),
      'critical_failures', COUNT(*) FILTER (WHERE mi.critical = true)
    )
    ORDER BY COUNT(*) DESC
    LIMIT 10
  )
  INTO top_violations
  FROM module_items mi
  JOIN trip_modules tm ON tm.id = mi.module_id
  JOIN trips t ON t.id = tm.trip_id
  WHERE t.org_id = get_organization_compliance_report.org_id
    AND t.trip_date >= CURRENT_DATE - INTERVAL '1 day' * get_organization_compliance_report.days
    AND mi.points > 0
  GROUP BY mi.label
  HAVING COUNT(*) > 0
  ORDER BY COUNT(*) DESC
  LIMIT 10;

  -- Return results
  RETURN QUERY
  SELECT 
    total,
    approved,
    failed,
    pending,
    CASE WHEN total > 0 THEN ROUND((approved::DECIMAL / total::DECIMAL) * 100, 2) ELSE 0 END as compliance_rate,
    CASE WHEN total > 0 THEN ROUND((failed::DECIMAL / total::DECIMAL) * 100, 2) ELSE 0 END as failure_rate,
    COALESCE(avg_score, 0) as average_score,
    COALESCE(risk_dist, '{}'::jsonb) as risk_distribution,
    COALESCE(role_perf, '{}'::jsonb) as role_performance,
    COALESCE(top_violations, '[]'::jsonb) as top_violations;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAVE CHECKLIST SESSION
-- Handles saving checklist progress and creating proper records
-- =====================================================
CREATE OR REPLACE FUNCTION save_checklist_session(
  trip_id UUID,
  module_step INTEGER,
  answers JSONB,
  status TEXT DEFAULT 'in_progress'
)
RETURNS BOOLEAN AS $$
DECLARE
  module_id UUID;
  module_score INTEGER := 0;
  risk_level TEXT := 'low';
BEGIN
  -- Get module ID
  SELECT id INTO module_id
  FROM trip_modules
  WHERE trip_id = save_checklist_session.trip_id
    AND step = save_checklist_session.module_step;

  IF module_id IS NULL THEN
    RAISE EXCEPTION 'Module not found for trip % and step %', trip_id, module_step;
  END IF;

  -- Delete existing items for this module
  DELETE FROM module_items WHERE module_id = module_id;

  -- Insert new items from answers
  INSERT INTO module_items (module_id, label, field_type, critical, points, value)
  SELECT 
    module_id,
    key,
    'text', -- This should be determined from checklist mapping
    false,  -- This should be determined from checklist mapping
    0,     -- This should be determined from checklist mapping
    value
  FROM jsonb_each_text(answers);

  -- Calculate module score based on critical failures
  SELECT COALESCE(SUM(points), 0) INTO module_score
  FROM module_items
  WHERE module_id = module_id
    AND critical = true
    AND (
      (field_type = 'pass_fail' AND value = 'fail') OR
      (field_type = 'yes_no' AND value = 'no')
    );

  -- Determine risk level
  IF module_score <= 3 THEN
    risk_level := 'low';
  ELSIF module_score <= 8 THEN
    risk_level := 'medium';
  ELSE
    risk_level := 'high';
  END IF;

  -- Update module status
  UPDATE trip_modules
  SET 
    status = CASE WHEN module_score > 0 THEN 'failed' ELSE 'completed' END,
    score = module_score,
    risk_level = risk_level,
    updated_at = NOW()
  WHERE id = module_id;

  -- Record critical failures
  INSERT INTO critical_failures (trip_id, module_item_id, description, points, resolved)
  SELECT 
    trip_id,
    mi.id,
    mi.label || ': ' || mi.value,
    mi.points,
    false
  FROM module_items mi
  WHERE mi.module_id = module_id
    AND mi.critical = true
    AND mi.points > 0;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error saving checklist session: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMPLETE CHECKLIST TRIP
-- Finalizes a trip with calculated scores and risk levels
-- =====================================================
CREATE OR REPLACE FUNCTION complete_checklist_trip(trip_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_score INTEGER := 0;
  final_risk_level TEXT := 'low';
  final_status TEXT := 'approved';
BEGIN
  -- Calculate total score from all modules
  SELECT COALESCE(SUM(score), 0) INTO total_score
  FROM trip_modules
  WHERE trip_id = complete_checklist_trip.trip_id;

  -- Determine final risk level
  IF total_score <= 3 THEN
    final_risk_level := 'low';
  ELSIF total_score <= 8 THEN
    final_risk_level := 'medium';
  ELSE
    final_risk_level := 'high';
  END IF;

  -- Determine final status
  IF total_score > 8 THEN
    final_status := 'failed';
  ELSIF total_score > 0 THEN
    final_status := 'approved';
  ELSE
    final_status := 'approved';
  END IF;

  -- Update trip with final results
  UPDATE trips
  SET 
    status = final_status,
    aggregate_score = total_score,
    risk_level = final_risk_level,
    updated_at = NOW()
  WHERE id = complete_checklist_trip.trip_id;

  -- Clean up any draft data
  DELETE FROM trip_drafts
  WHERE user_id = (SELECT user_id FROM trips WHERE id = trip_id);

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error completing checklist trip: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for trip queries
CREATE INDEX IF NOT EXISTS idx_trips_user_date ON trips(user_id, trip_date DESC);
CREATE INDEX IF NOT EXISTS idx_trips_org_date ON trips(org_id, trip_date DESC);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_risk_level ON trips(risk_level);

-- Indexes for module items
CREATE INDEX IF NOT EXISTS idx_module_items_module ON module_items(module_id);
CREATE INDEX IF NOT EXISTS idx_module_items_critical ON module_items(critical, points);
CREATE INDEX IF NOT EXISTS idx_module_items_points ON module_items(points) WHERE points > 0;

-- Indexes for critical failures
CREATE INDEX IF NOT EXISTS idx_critical_failures_trip ON critical_failures(trip_id);
CREATE INDEX IF NOT EXISTS idx_critical_failures_resolved ON critical_failures(resolved);

-- Indexes for drafts
CREATE INDEX IF NOT EXISTS idx_trip_drafts_user ON trip_drafts(user_id);
