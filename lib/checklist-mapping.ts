// Comprehensive checklist mapping to database schema
// This maps every section of your pre-trip checklist to the database structure

export const CHECKLIST_MODULES = {
  // Module 1: Driver & Trip Information
  DRIVER_INFO: {
    name: 'Driver & Trip Information',
    step: 1,
    items: [
      { label: 'Operator Name', field_type: 'text', critical: false, points: 0 },
      { label: 'Area of Operation', field_type: 'text', critical: false, points: 0 },
      { label: 'Station', field_type: 'text', critical: false, points: 0 },
      { label: 'Route/s', field_type: 'text', critical: false, points: 0 },
      { label: 'Driver Name', field_type: 'text', critical: true, points: 1 },
      { label: 'Driver ID', field_type: 'text', critical: true, points: 1 },
      { label: 'License Number', field_type: 'text', critical: true, points: 2 },
      { label: 'Vehicle ID / Plate', field_type: 'text', critical: true, points: 1 },
      { label: 'Vehicle Type', field_type: 'select', critical: false, points: 0 },
      { label: 'Date of Trip', field_type: 'date', critical: true, points: 1 },
      { label: 'Route', field_type: 'text', critical: true, points: 1 },
      { label: 'Total Trip Duration', field_type: 'text', critical: false, points: 0 },
      { label: 'Driving Hours', field_type: 'text', critical: false, points: 0 },
      { label: 'Rest Breaks', field_type: 'text', critical: false, points: 0 }
    ]
  },

  // Module 2: Health & Fitness
  HEALTH_FITNESS: {
    name: 'Health & Fitness',
    step: 2,
    items: [
      { label: 'Alcohol Breath Test/Drugs', field_type: 'pass_fail_na', critical: true, points: 5 },
      { label: 'Temperature Check', field_type: 'pass_fail', critical: true, points: 3 },
      { label: 'Vehicle Inspection Completed', field_type: 'yes_no', critical: true, points: 2 },
      { label: 'Driver Fit for Duty Declaration', field_type: 'yes_no', critical: true, points: 3 },
      { label: 'Medication', field_type: 'yes_no', critical: false, points: 1 },
      { label: 'No health issues that may impair driving', field_type: 'yes_no', critical: true, points: 3 },
      { label: 'Fatigue checklist completed', field_type: 'yes_no', critical: true, points: 3 },
      { label: 'Weather and road condition checked', field_type: 'yes_no', critical: false, points: 1 }
    ]
  },

  // Module 3: Documentation & Compliance
  DOCUMENTATION: {
    name: 'Documentation & Compliance',
    step: 3,
    items: [
      { label: 'Certificate of fitness', field_type: 'yes_no', critical: true, points: 3 },
      { label: 'Road Tax (valid)', field_type: 'yes_no', critical: true, points: 2 },
      { label: 'Insurance', field_type: 'yes_no', critical: true, points: 3 },
      { label: 'Trip authorization form completed and signed', field_type: 'yes_no', critical: true, points: 2 },
      { label: 'Logbook', field_type: 'yes_no', critical: true, points: 1 },
      { label: 'Driver Handbook', field_type: 'yes_no', critical: false, points: 1 },
      { label: 'Permits', field_type: 'yes_no', critical: true, points: 2 },
      { label: 'Emergency Contacts and risk mitigation plan communicated', field_type: 'yes_no', critical: true, points: 2 },
      { label: 'Personal Protective Equipment (PPE)', field_type: 'yes_no', critical: true, points: 2 },
      { label: 'Route Familiarity', field_type: 'yes_no', critical: false, points: 1 },
      { label: 'Emergency Procedures', field_type: 'yes_no', critical: true, points: 2 },
      { label: 'GPS/Trip monitoring system activated', field_type: 'yes_no', critical: false, points: 1 },
      { label: 'Safety briefing provided', field_type: 'yes_no', critical: true, points: 2 },
      { label: 'Driver, vehicle & documentation cleared at gate by RTSA', field_type: 'yes_no', critical: false, points: 1 }
    ]
  },

  // Module 4: Exterior Inspection
  EXTERIOR_INSPECTION: {
    name: 'Exterior Inspection',
    step: 4,
    items: [
      { label: 'Tires: Check for proper inflation, tread depth, and visible damage', field_type: 'pass_fail', critical: true, points: 3 },
      { label: 'Lights: Ensure headlights, taillights, brake lights, turn signals, and hazard lights are operational', field_type: 'pass_fail', critical: true, points: 4 },
      { label: 'Mirrors: Verify mirrors are clean, properly adjusted, and free of damage', field_type: 'pass_fail', critical: true, points: 2 },
      { label: 'Windshield: Check for cracks or chips; ensure wipers and washer fluid are functioning', field_type: 'pass_fail', critical: true, points: 3 },
      { label: 'Body Condition: Loose parts', field_type: 'pass_fail', critical: false, points: 1 },
      { label: 'Body Condition: Leaks', field_type: 'pass_fail', critical: true, points: 2 }
    ]
  },

  // Module 5: Engine & Fluids
  ENGINE_FLUIDS: {
    name: 'Engine & Fluids',
    step: 5,
    items: [
      { label: 'Engine Oil: Check oil level and quality', field_type: 'pass_fail', critical: true, points: 3 },
      { label: 'Coolant: Verify coolant levels and inspect for leaks', field_type: 'pass_fail', critical: true, points: 3 },
      { label: 'Brake Fluid: Ensure brake fluid is at the proper level', field_type: 'pass_fail', critical: true, points: 4 },
      { label: 'Transmission Fluid: Check level and condition', field_type: 'pass_fail', critical: true, points: 2 },
      { label: 'Power Steering Fluid: Ensure it is at the correct level', field_type: 'pass_fail', critical: true, points: 2 },
      { label: 'Battery: Inspect battery terminals and ensure the battery is secure', field_type: 'pass_fail', critical: true, points: 2 }
    ]
  },

  // Module 6: Interior & Cabin
  INTERIOR_CABIN: {
    name: 'Interior & Cabin',
    step: 6,
    items: [
      { label: 'Dashboard Indicators: Ensure all warning lights are functioning properly', field_type: 'pass_fail', critical: true, points: 2 },
      { label: 'Seatbelts: Verify seatbelts are operational and free from wear or damage', field_type: 'pass_fail', critical: true, points: 3 },
      { label: 'Horn: Test the horn to ensure it is working', field_type: 'pass_fail', critical: true, points: 2 },
      { label: 'Fire Extinguisher', field_type: 'pass_fail', critical: true, points: 3 },
      { label: 'First Aid Kit', field_type: 'pass_fail', critical: true, points: 2 },
      { label: 'Safety Triangles', field_type: 'pass_fail', critical: true, points: 2 }
    ]
  },

  // Module 7: Functional Checks
  FUNCTIONAL_CHECKS: {
    name: 'Functional Checks',
    step: 7,
    items: [
      { label: 'Brakes: Test brake function for responsiveness and effectiveness', field_type: 'pass_fail', critical: true, points: 5 },
      { label: 'Suspension: Check for any unusual noises or handling issues', field_type: 'pass_fail', critical: true, points: 2 },
      { label: 'Heating and Air Conditioning: Test to ensure both systems are operational', field_type: 'pass_fail', critical: false, points: 1 }
    ]
  },

  // Module 8: Safety Equipment
  SAFETY_EQUIPMENT: {
    name: 'Safety Equipment',
    step: 8,
    items: [
      { label: 'Fire extinguisher (charged & tagged)', field_type: 'pass_fail', critical: true, points: 3 },
      { label: 'First aid kit (stock verified)', field_type: 'pass_fail', critical: true, points: 2 },
      { label: 'Reflective triangles (2)', field_type: 'pass_fail', critical: true, points: 2 },
      { label: 'Wheel chocks', field_type: 'pass_fail', critical: false, points: 1 },
      { label: 'Spare tyre and jack', field_type: 'pass_fail', critical: true, points: 2 },
      { label: 'Torch / flashlight', field_type: 'pass_fail', critical: false, points: 1 },
      { label: 'Emergency contact list', field_type: 'pass_fail', critical: false, points: 1 },
      { label: 'GPS tracker operational', field_type: 'pass_fail', critical: false, points: 1 }
    ]
  },

  // Module 9: Final Verification
  FINAL_VERIFICATION: {
    name: 'Final Verification',
    step: 9,
    items: [
      { label: 'All critical defects rectified before departure?', field_type: 'yes_no', critical: true, points: 5 },
      { label: 'Driver briefed on trip hazards and route plan?', field_type: 'yes_no', critical: true, points: 3 },
      { label: 'Vehicle safe and ready for dispatch?', field_type: 'yes_no', critical: true, points: 5 }
    ]
  },

  // Module 10: Risk Scoring
  RISK_SCORING: {
    name: 'Risk Scoring',
    step: 10,
    items: [
      { label: 'Speeding in School Zone', field_type: 'number', critical: true, points: 5 },
      { label: 'Speeding on Hazardous Bridge', field_type: 'number', critical: true, points: 3 },
      { label: 'Other Violations', field_type: 'number', critical: false, points: 0 }
    ]
  },

  // Module 11: Sign-off
  SIGN_OFF: {
    name: 'Final Sign-Off',
    step: 11,
    items: [
      { label: 'Driver Signature', field_type: 'signature', critical: true, points: 0 },
      { label: 'Supervisor Signature', field_type: 'signature', critical: true, points: 0 },
      { label: 'Mechanic Signature (if repairs done)', field_type: 'signature', critical: false, points: 0 }
    ]
  }
} as const

export type ModuleKey = keyof typeof CHECKLIST_MODULES

// Risk level calculation based on total points
export const calculateRiskLevel = (totalPoints: number): 'low' | 'medium' | 'high' => {
  if (totalPoints <= 3) return 'low'
  if (totalPoints <= 8) return 'medium'
  return 'high'
}

// Session management types
export interface ChecklistSession {
  tripId: string
  currentModule: ModuleKey
  currentStep: number
  answers: Record<string, any>
  startTime: Date
  lastActivity: Date
  status: 'draft' | 'in_progress' | 'completed' | 'failed'
}

// Report generation helpers
export const REPORT_QUERIES = {
  // Last test for a driver
  getLastTest: (driverId: string) => `
    SELECT 
      t.*,
      tm.name as module_name,
      mi.label,
      mi.value,
      mi.points,
      mi.critical
    FROM trips t
    LEFT JOIN trip_modules tm ON tm.trip_id = t.id
    LEFT JOIN module_items mi ON mi.module_id = tm.id
    WHERE t.user_id = '${driverId}'
    ORDER BY t.created_at DESC
    LIMIT 1
  `,

  // Full checklist report (1 trip)
  getFullChecklist: (tripId: string) => `
    SELECT
      t.trip_date,
      t.route,
      tm.step,
      tm.name AS module,
      mi.label,
      mi.value,
      mi.points,
      mi.critical,
      mi.field_type
    FROM trips t
    JOIN trip_modules tm ON tm.trip_id = t.id
    JOIN module_items mi ON mi.module_id = tm.id
    WHERE t.id = '${tripId}'
    ORDER BY tm.step, mi.id
  `,

  // Risk trend (30 days)
  getRiskTrend: (driverId: string) => `
    SELECT
      DATE(trip_date) as date,
      aggregate_score,
      risk_level,
      status
    FROM trips
    WHERE user_id = '${driverId}'
    AND trip_date >= now() - INTERVAL '30 days'
    ORDER BY trip_date DESC
  `,

  // Violations report (Audit / RTSA)
  getViolations: (orgId?: string) => `
    SELECT
      t.trip_date,
      t.route,
      u.full_name as driver_name,
      u.email as driver_email,
      mi.label,
      mi.value,
      mi.points,
      tm.name as module_name
    FROM module_items mi
    JOIN trip_modules tm ON tm.id = mi.module_id
    JOIN trips t ON t.id = tm.trip_id
    JOIN users u ON u.id = t.user_id
    WHERE mi.points > 0 
    AND mi.critical = true
    ${orgId ? `AND t.org_id = '${orgId}'` : ''}
    ORDER BY t.trip_date DESC
  `,

  // Supervisor view - all trips in organization
  getOrgTrips: (orgId: string) => `
    SELECT
      t.id,
      t.trip_date,
      t.route,
      t.aggregate_score,
      t.risk_level,
      t.status,
      u.full_name as driver_name,
      u.email as driver_email,
      t.created_at
    FROM trips t
    JOIN users u ON u.id = t.user_id
    WHERE t.org_id = '${orgId}'
    ORDER BY t.trip_date DESC
  `
}

export default CHECKLIST_MODULES
