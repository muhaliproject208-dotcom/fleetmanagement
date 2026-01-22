-- IFSM Compliance Enhancement Schema
-- Adds in-trip monitoring, post-trip inspection, RTSA integration, and automated enforcement

-- =====================================================
-- IN-TRIP MONITORING TABLES
-- =====================================================

-- Real-time GPS tracking
CREATE TABLE IF NOT EXISTS gps_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES users(id),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed_kmh DECIMAL(5, 2),
  heading DECIMAL(5, 2),
  altitude DECIMAL(8, 2),
  accuracy DECIMAL(5, 2),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  location_source TEXT CHECK (location_source IN ('gps', 'network', 'manual')) DEFAULT 'gps',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Speed violations and alerts
CREATE TABLE IF NOT EXISTS speed_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES users(id),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  recorded_speed DECIMAL(5, 2) NOT NULL,
  speed_limit DECIMAL(5, 2) NOT NULL,
  violation_type TEXT CHECK (violation_type IN ('school_zone', 'highway', 'urban', 'hazardous_area', 'weather_condition')),
  severity TEXT CHECK (severity IN ('minor', 'major', 'critical')) NOT NULL,
  points_deducted INTEGER DEFAULT 0,
  auto_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  violation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Driver fatigue monitoring
CREATE TABLE IF NOT EXISTS fatigue_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id),
  monitoring_type TEXT CHECK (monitoring_type IN ('hours_of_service', 'biometric', 'behavioral')) NOT NULL,
  hours_driven DECIMAL(5, 2),
  hours_on_duty DECIMAL(5, 2),
  rest_hours DECIMAL(5, 2),
  fatigue_score DECIMAL(3, 2) CHECK (fatigue_score >= 0 AND fatigue_score <= 100),
  alert_level TEXT CHECK (alert_level IN ('normal', 'caution', 'warning', 'critical')) NOT NULL,
  biometric_data JSONB, -- Heart rate, eye tracking, etc.
  behavioral_indicators JSONB, -- Lane departure, hard braking, etc.
  recommendation TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- In-trip incidents and emergencies
CREATE TABLE IF NOT EXISTS in_trip_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES users(id),
  incident_type TEXT CHECK (incident_type IN ('accident', 'breakdown', 'medical_emergency', 'security_threat', 'cargo_issue', 'weather_hazard', 'road_hazard')) NOT NULL,
  severity TEXT CHECK (severity IN ('minor', 'major', 'critical', 'fatal')) NOT NULL,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  description TEXT NOT NULL,
  immediate_actions_taken TEXT,
  injuries_reported TEXT,
  property_damage DECIMAL(10, 2),
  police_report_number TEXT,
  emergency_services_called BOOLEAN DEFAULT FALSE,
  response_time_minutes INTEGER,
  status TEXT CHECK (status IN ('reported', 'responding', 'resolved', 'investigating')) DEFAULT 'reported',
  incident_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Real-time alerts and notifications
CREATE TABLE IF NOT EXISTS real_time_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id),
  supervisor_id UUID REFERENCES users(id),
  alert_type TEXT CHECK (alert_type IN ('speed_violation', 'fatigue_warning', 'geofence_breach', 'emergency', 'mechanical_issue', 'weather_alert')) NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical', 'emergency')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  auto_generated BOOLEAN DEFAULT TRUE,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  alert_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- POST-TRIP INSPECTION TABLES
-- =====================================================

-- Post-trip inspection records
CREATE TABLE IF NOT EXISTS post_trip_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES users(id),
  inspector_id UUID REFERENCES users(id),
  inspection_date TIMESTAMP WITH TIME ZONE NOT NULL,
  journey_completion_verified BOOLEAN DEFAULT FALSE,
  total_distance_km DECIMAL(8, 2),
  fuel_consumed_liters DECIMAL(8, 2),
  average_fuel_consumption DECIMAL(5, 2),
  engine_hours DECIMAL(6, 2),
  total_score INTEGER DEFAULT 0,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
  findings_summary TEXT,
  recommendations TEXT,
  next_maintenance_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Post-trip inspection items (detailed checklist)
CREATE TABLE IF NOT EXISTS post_trip_inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES post_trip_inspections(id) ON DELETE CASCADE,
  category TEXT CHECK (category IN ('exterior', 'interior', 'engine', 'tires', 'brakes', 'lights', 'safety_equipment', 'cargo', 'documentation')) NOT NULL,
  item_label TEXT NOT NULL,
  inspection_type TEXT CHECK (inspection_type IN ('visual', 'measurement', 'operational', 'document_check')) NOT NULL,
  condition_status TEXT CHECK (condition_status IN ('excellent', 'good', 'fair', 'poor', 'critical')) NOT NULL,
  measurement_value DECIMAL(10, 2),
  measurement_unit TEXT,
  notes TEXT,
  photo_url TEXT,
  requires_maintenance BOOLEAN DEFAULT FALSE,
  maintenance_priority TEXT CHECK (maintenance_priority IN ('low', 'medium', 'high', 'urgent')),
  points_deducted INTEGER DEFAULT 0,
  critical BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Fuel and consumption tracking
CREATE TABLE IF NOT EXISTS fuel_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES users(id),
  fuel_type TEXT CHECK (fuel_type IN ('diesel', 'petrol', 'electric', 'hybrid', 'lpg')),
  fuel_before_trip_liters DECIMAL(8, 2),
  fuel_after_trip_liters DECIMAL(8, 2),
  fuel_added_during_trip DECIMAL(8, 2) DEFAULT 0,
  total_fuel_consumed DECIMAL(8, 2),
  distance_km DECIMAL(8, 2),
  average_consumption_l_per_100km DECIMAL(5, 2),
  fuel_cost DECIMAL(10, 2),
  fuel_station TEXT,
  fuel_receipt_url TEXT,
  consumption_anomaly BOOLEAN DEFAULT FALSE,
  anomaly_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- RTSA INTEGRATION TABLES
-- =====================================================

-- RTSA compliance submissions
CREATE TABLE IF NOT EXISTS rtsa_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  submission_type TEXT CHECK (submission_type IN ('pre_trip_report', 'violation_report', 'incident_report', 'compliance_certificate', 'audit_request')) NOT NULL,
  submission_data JSONB NOT NULL,
  rtsa_reference_number TEXT UNIQUE,
  submission_status TEXT CHECK (submission_status IN ('pending', 'submitted', 'accepted', 'rejected', 'requires_resubmission')) DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE,
  rtsa_response_at TIMESTAMP WITH TIME ZONE,
  rtsa_response_data JSONB,
  rejection_reason TEXT,
  certificate_url TEXT,
  certificate_valid_until TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RTSA compliance certificates
CREATE TABLE IF NOT EXISTS rtsa_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  certificate_type TEXT CHECK (certificate_type IN ('road_worthiness', 'driver_compliance', 'trip_clearance', 'safety_clearance')) NOT NULL,
  certificate_number TEXT UNIQUE NOT NULL,
  issue_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  issuing_authority TEXT DEFAULT 'RTSA',
  certificate_data JSONB,
  certificate_url TEXT,
  status TEXT CHECK (status IN ('active', 'expired', 'revoked', 'suspended')) DEFAULT 'active',
  verification_code TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Automated violation reporting to RTSA
CREATE TABLE IF NOT EXISTS violation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  violation_id UUID REFERENCES speed_violations(id),
  driver_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  report_type TEXT CHECK (report_type IN ('speed_violation', 'documentation_violation', 'safety_violation', 'hours_violation')) NOT NULL,
  severity TEXT CHECK (severity IN ('minor', 'major', 'critical')) NOT NULL,
  violation_details JSONB NOT NULL,
  auto_reported BOOLEAN DEFAULT TRUE,
  reported_to_rtsa BOOLEAN DEFAULT FALSE,
  rtsa_report_reference TEXT,
  rtsa_reported_at TIMESTAMP WITH TIME ZONE,
  fine_amount DECIMAL(8, 2),
  points_deducted INTEGER DEFAULT 0,
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'disputed', 'waived')) DEFAULT 'pending',
  payment_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- AUTOMATED ENFORCEMENT TABLES
-- =====================================================

-- Enforcement rules and thresholds
CREATE TABLE IF NOT EXISTS enforcement_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  rule_name TEXT NOT NULL,
  rule_type TEXT CHECK (rule_type IN ('speed_limit', 'hours_of_service', 'vehicle_condition', 'documentation', 'safety_equipment')) NOT NULL,
  threshold_value DECIMAL(10, 2) NOT NULL,
  threshold_unit TEXT,
  action_triggered TEXT CHECK (action_triggered IN ('alert', 'warning', 'trip_suspension', 'immediate_stop', 'report_to_supervisor', 'auto_report_rtsa')) NOT NULL,
  severity_levels JSONB, -- Define severity based on threshold breaches
  is_active BOOLEAN DEFAULT TRUE,
  applies_to_vehicle_types TEXT[],
  applies_to_driver_roles TEXT[],
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Automated enforcement actions
CREATE TABLE IF NOT EXISTS enforcement_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES enforcement_rules(id),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id),
  vehicle_id UUID REFERENCES vehicles(id),
  violation_type TEXT NOT NULL,
  violation_value DECIMAL(10, 2),
  threshold_value DECIMAL(10, 2),
  action_taken TEXT NOT NULL,
  action_severity TEXT CHECK (action_severity IN ('info', 'warning', 'critical', 'emergency')) NOT NULL,
  automated BOOLEAN DEFAULT TRUE,
  executed_by UUID REFERENCES users(id), -- NULL if fully automated
  execution_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  action_result TEXT,
  escalation_level INTEGER DEFAULT 1,
  parent_action_id UUID REFERENCES enforcement_actions(id), -- For escalation chains
  created_at TIMESTAMP DEFAULT NOW()
);

-- Escalation workflows
CREATE TABLE IF NOT EXISTS escalation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  workflow_name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  escalation_levels JSONB NOT NULL, -- Array of escalation steps
  notification_channels JSONB, -- Email, SMS, push, etc.
  auto_escalate BOOLEAN DEFAULT TRUE,
  escalation_intervals JSONB, -- Time intervals for escalation
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ENHANCED INDEXES FOR PERFORMANCE
-- =====================================================

-- GPS tracking indexes
CREATE INDEX IF NOT EXISTS idx_gps_tracking_trip_timestamp ON gps_tracking(trip_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_vehicle_timestamp ON gps_tracking(vehicle_id, timestamp DESC);

-- Speed violations indexes
CREATE INDEX IF NOT EXISTS idx_speed_violations_trip_timestamp ON speed_violations(trip_id, violation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_speed_violations_severity ON speed_violations(severity, resolved);

-- Fatigue monitoring indexes
CREATE INDEX IF NOT EXISTS idx_fatigue_monitoring_trip_alert ON fatigue_monitoring(trip_id, alert_level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fatigue_monitoring_driver_score ON fatigue_monitoring(driver_id, fatigue_score DESC);

-- In-trip incidents indexes
CREATE INDEX IF NOT EXISTS idx_in_trip_incidents_trip_severity ON in_trip_incidents(trip_id, severity, incident_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_in_trip_incidents_status ON in_trip_incidents(status, incident_timestamp DESC);

-- Real-time alerts indexes
CREATE INDEX IF NOT EXISTS idx_real_time_alerts_trip_severity ON real_time_alerts(trip_id, severity, acknowledged, resolved);
CREATE INDEX IF NOT EXISTS idx_real_time_alerts_driver_unack ON real_time_alerts(driver_id, acknowledged, alert_timestamp DESC);

-- Post-trip inspection indexes
CREATE INDEX IF NOT EXISTS idx_post_trip_inspections_trip ON post_trip_inspections(trip_id);
CREATE INDEX IF NOT EXISTS idx_post_trip_inspections_vehicle_date ON post_trip_inspections(vehicle_id, inspection_date DESC);

-- RTSA integration indexes
CREATE INDEX IF NOT EXISTS idx_rtsa_submissions_trip_status ON rtsa_submissions(trip_id, submission_status);
CREATE INDEX IF NOT EXISTS idx_rtsa_certificates_vehicle_expiry ON rtsa_certificates(vehicle_id, expiry_date);

-- Enforcement indexes
CREATE INDEX IF NOT EXISTS idx_enforcement_actions_trip_timestamp ON enforcement_actions(trip_id, execution_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_enforcement_actions_severity ON enforcement_actions(action_severity, escalation_level);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE gps_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatigue_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE in_trip_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_trip_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_trip_inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE rtsa_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rtsa_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE enforcement_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE enforcement_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for GPS tracking
CREATE POLICY "Drivers can view own GPS tracking" ON gps_tracking FOR SELECT USING (driver_id = auth.uid());
CREATE POLICY "Supervisors can view company GPS tracking" ON gps_tracking FOR SELECT USING (
  driver_id IN (SELECT id FROM users WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
);
CREATE POLICY "Admins can view all GPS tracking" ON gps_tracking FOR SELECT USING (auth.role() = 'admin');

-- RLS Policies for speed violations
CREATE POLICY "Drivers can view own speed violations" ON speed_violations FOR SELECT USING (driver_id = auth.uid());
CREATE POLICY "Supervisors can view company speed violations" ON speed_violations FOR SELECT USING (
  driver_id IN (SELECT id FROM users WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
);
CREATE POLICY "Admins can view all speed violations" ON speed_violations FOR SELECT USING (auth.role() = 'admin');

-- RLS Policies for real-time alerts
CREATE POLICY "Users can view own alerts" ON real_time_alerts FOR SELECT USING (driver_id = auth.uid() OR supervisor_id = auth.uid());
CREATE POLICY "Supervisors can view company alerts" ON real_time_alerts FOR SELECT USING (
  driver_id IN (SELECT id FROM users WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
);
CREATE POLICY "Admins can view all alerts" ON real_time_alerts FOR SELECT USING (auth.role() = 'admin');

-- Similar policies for other tables... (omitted for brevity but would follow same pattern)

-- =====================================================
-- TRIGGERS FOR AUTOMATED PROCESSES
-- =====================================================

-- Trigger to automatically create alerts for critical violations
CREATE OR REPLACE FUNCTION trigger_critical_violation_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert real-time alert for critical violations
  IF NEW.severity = 'critical' THEN
    INSERT INTO real_time_alerts (
      trip_id, driver_id, alert_type, severity, title, message, 
      location_lat, location_lng, auto_generated, alert_timestamp
    ) VALUES (
      NEW.trip_id, NEW.driver_id, 'speed_violation', 'critical',
      'Critical Speed Violation Detected',
      format('Speed of %s km/h detected in %s zone. Immediate action required.', NEW.recorded_speed, NEW.violation_type),
      NEW.location_lat, NEW.location_lng, TRUE, NEW.violation_timestamp
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER critical_violation_alert_trigger
  AFTER INSERT ON speed_violations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_critical_violation_alert();

-- Trigger to update trip risk level based on violations
CREATE OR REPLACE FUNCTION update_trip_risk_level()
RETURNS TRIGGER AS $$
BEGIN
  -- Update trip risk level based on critical violations
  UPDATE trips 
  SET 
    risk_level = CASE 
      WHEN EXISTS(SELECT 1 FROM speed_violations WHERE trip_id = NEW.trip_id AND severity = 'critical') THEN 'critical'
      WHEN EXISTS(SELECT 1 FROM speed_violations WHERE trip_id = NEW.trip_id AND severity = 'major') THEN 'high'
      WHEN EXISTS(SELECT 1 FROM speed_violations WHERE trip_id = NEW.trip_id AND severity = 'minor') THEN 'medium'
      ELSE 'low'
    END,
    updated_at = NOW()
  WHERE id = NEW.trip_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trip_risk_level_update_trigger
  AFTER INSERT ON speed_violations
  FOR EACH ROW
  EXECUTE FUNCTION update_trip_risk_level();

-- =====================================================
-- VIEWS FOR COMPLIANCE REPORTING
-- =====================================================

-- Comprehensive trip compliance view
CREATE OR REPLACE VIEW trip_compliance_summary AS
SELECT 
  t.id as trip_id,
  t.trip_date,
  t.status as trip_status,
  t.aggregate_score,
  t.risk_level,
  u.full_name as driver_name,
  v.registration_number as vehicle_plate,
  v.make as vehicle_make,
  v.model as vehicle_model,
  
  -- Pre-trip compliance
  (SELECT COUNT(*) FROM trip_modules tm WHERE tm.trip_id = t.id AND tm.status = 'completed') as pre_trip_modules_completed,
  (SELECT COUNT(*) FROM trip_modules tm WHERE tm.trip_id = t.id) as total_pre_trip_modules,
  
  -- In-trip monitoring
  (SELECT COUNT(*) FROM speed_violations sv WHERE sv.trip_id = t.id AND sv.severity = 'critical') as critical_violations,
  (SELECT COUNT(*) FROM speed_violations sv WHERE sv.trip_id = t.id) as total_violations,
  (SELECT MAX(fatigue_score) FROM fatigue_monitoring fm WHERE fm.trip_id = t.id) as max_fatigue_score,
  (SELECT COUNT(*) FROM in_trip_incidents iti WHERE iti.trip_id = t.id AND iti.severity = 'critical') as critical_incidents,
  
  -- Post-trip inspection
  (SELECT COALESCE(pti.total_score, 0) FROM post_trip_inspections pti WHERE pti.trip_id = t.id) as post_trip_score,
  (SELECT COALESCE(pti.risk_level, 'low') FROM post_trip_inspections pti WHERE pti.trip_id = t.id) as post_trip_risk_level,
  
  -- RTSA compliance
  (SELECT COUNT(*) FROM rtsa_submissions rs WHERE rs.trip_id = t.id AND rs.submission_status = 'accepted') as rtsa_submissions_accepted,
  (SELECT COUNT(*) FROM rtsa_certificates rc WHERE rc.trip_id = t.id AND rc.status = 'active') as active_certificates,
  
  -- Overall compliance score
  CASE 
    WHEN (SELECT COUNT(*) FROM trip_modules tm WHERE tm.trip_id = t.id AND tm.status = 'completed') = (SELECT COUNT(*) FROM trip_modules tm WHERE tm.trip_id = t.id)
     AND (SELECT COUNT(*) FROM speed_violations sv WHERE sv.trip_id = t.id AND sv.severity IN ('critical', 'major')) = 0
     AND EXISTS(SELECT 1 FROM post_trip_inspections pti WHERE pti.trip_id = t.id AND pti.status = 'completed')
    THEN 'compliant'
    WHEN (SELECT COUNT(*) FROM speed_violations sv WHERE sv.trip_id = t.id AND sv.severity = 'critical') > 0
    THEN 'non_compliant_critical'
    ELSE 'non_compliant_minor'
  END as overall_compliance_status,
  
  t.created_at,
  t.updated_at
FROM trips t
JOIN users u ON t.driver_id = u.id
JOIN vehicles v ON t.vehicle_id = v.id;

-- Real-time monitoring dashboard view
CREATE OR REPLACE VIEW real_time_monitoring_dashboard AS
SELECT 
  t.id as trip_id,
  t.trip_date,
  u.full_name as driver_name,
  v.registration_number as vehicle_plate,
  
  -- Current GPS location
  (SELECT json_build_object(
    'latitude', latitude, 'longitude', longitude, 'speed', speed_kmh, 
    'heading', heading, 'timestamp', timestamp
  ) FROM gps_tracking gt WHERE gt.trip_id = t.id ORDER BY timestamp DESC LIMIT 1) as current_location,
  
  -- Latest alerts
  (SELECT json_agg(json_build_object(
    'type', alert_type, 'severity', severity, 'title', title, 
    'message', message, 'timestamp', alert_timestamp, 'acknowledged', acknowledged
  )) FROM real_time_alerts rta WHERE rta.trip_id = t.id AND acknowledged = FALSE ORDER BY alert_timestamp DESC LIMIT 5) as active_alerts,
  
  -- Fatigue status
  (SELECT json_build_object(
    'score', fatigue_score, 'alert_level', alert_level, 'recommendation', recommendation
  ) FROM fatigue_monitoring fm WHERE fm.trip_id = t.id ORDER BY timestamp DESC LIMIT 1) as fatigue_status,
  
  -- Violation summary
  (SELECT json_build_object(
    'total', COUNT(*), 'critical', COUNT(*) FILTER (WHERE severity = 'critical'),
    'major', COUNT(*) FILTER (WHERE severity = 'major'), 'minor', COUNT(*) FILTER (WHERE severity = 'minor')
  ) FROM speed_violations sv WHERE sv.trip_id = t.id) as violation_summary,
  
  t.status as trip_status,
  t.risk_level
FROM trips t
JOIN users u ON t.driver_id = u.id
JOIN vehicles v ON t.vehicle_id = v.id
WHERE t.status IN ('in_progress', 'submitted', 'under_review', 'approved');
