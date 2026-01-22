export interface FormModule {
  id: string
  step: number
  title: string
  description: string
  sections: FormSection[]
  maxScore: number
}

export interface FormSection {
  id: string
  title: string
  items: FormItem[]
}

export interface FormItem {
  id: string
  label: string
  type: "checkbox" | "radio" | "select" | "text" | "textarea" | "number"
  critical: boolean
  points: number
  required: boolean
  options?: { label: string; value: string | number }[]
  validation?: (value: any) => string | null
}

export const FORM_MODULES: FormModule[] = [
  {
    id: "driver-info",
    step: 1,
    title: "Driver & Trip Information",
    description: "Operator details and trip routing",
    maxScore: 90,
    sections: [
      {
        id: "personal-details",
        title: "Personal Details",
        items: [
          { id: "driver-name", label: "Driver Name", type: "text", critical: false, points: 0, required: true },
          { id: "driver-id", label: "Driver ID", type: "text", critical: false, points: 0, required: true },
          { id: "license-number", label: "License Number", type: "text", critical: true, points: 10, required: true },
          { id: "vehicle-id", label: "Vehicle ID / Plate", type: "text", critical: true, points: 10, required: true },
          {
            id: "vehicle-type",
            label: "Vehicle Type",
            type: "select",
            critical: false,
            points: 0,
            required: true,
            options: [
              { label: "Car", value: "car" },
              { label: "Truck", value: "truck" },
              { label: "Bus", value: "bus" },
              { label: "Motorcycle", value: "motorcycle" },
            ],
          },
          { id: "trip-date", label: "Date of Trip", type: "text", critical: false, points: 0, required: true },
          { id: "route", label: "Route", type: "text", critical: false, points: 0, required: true },
        ],
      },
    ],
  },
  {
    id: "health-fitness",
    step: 2,
    title: "Health & Fitness",
    description: "Driver health checks and medical clearance",
    maxScore: 90,
    sections: [
      {
        id: "health-checks",
        title: "Health Checks",
        items: [
          {
            id: "breath-test",
            label: "Alcohol Breath Test/Drugs",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Passed", value: "passed" },
              { label: "Failed", value: "failed" },
            ],
          },
          {
            id: "temperature",
            label: "Temperature Check",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Passed", value: "passed" },
              { label: "Failed", value: "failed" },
            ],
          },
          {
            id: "vehicle-inspection",
            label: "Vehicle Inspection Completed",
            type: "checkbox",
            critical: true,
            points: 15,
            required: true,
          },
          {
            id: "fit-duty",
            label: "Driver Fit for Duty Declaration",
            type: "checkbox",
            critical: true,
            points: 15,
            required: true,
          },
          {
            id: "medication",
            label: "On Medication",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "no-health-issues",
            label: "No health issues impairing driving",
            type: "checkbox",
            critical: true,
            points: 15,
            required: true,
          },
          {
            id: "fatigue-checklist",
            label: "Fatigue checklist completed",
            type: "checkbox",
            critical: false,
            points: 5,
            required: true,
          },
          {
            id: "weather-check",
            label: "Weather and road condition acknowledged",
            type: "checkbox",
            critical: false,
            points: 5,
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "documentation",
    step: 3,
    title: "Documentation & Compliance",
    description: "Verify registration, permits, and compliance docs",
    maxScore: 90,
    sections: [
      {
        id: "compliance-docs",
        title: "Compliance Documentation",
        items: [
          {
            id: "certificate-fitness",
            label: "Certificate of Fitness",
            type: "checkbox",
            critical: true,
            points: 10,
            required: true,
          },
          { id: "road-tax", label: "Road Tax (valid)", type: "checkbox", critical: true, points: 10, required: true },
          { id: "insurance", label: "Insurance", type: "checkbox", critical: true, points: 10, required: true },
          {
            id: "trip-auth",
            label: "Trip authorization form signed",
            type: "checkbox",
            critical: false,
            points: 5,
            required: true,
          },
          { id: "logbook", label: "Logbook", type: "checkbox", critical: false, points: 5, required: true },
          { id: "handbook", label: "Driver Handbook", type: "checkbox", critical: false, points: 5, required: true },
          { id: "permits", label: "Permits", type: "checkbox", critical: false, points: 5, required: true },
          {
            id: "emergency-contacts",
            label: "Emergency contacts communicated",
            type: "checkbox",
            critical: false,
            points: 5,
            required: true,
          },
          {
            id: "ppe",
            label: "Personal Protective Equipment (PPE)",
            type: "checkbox",
            critical: false,
            points: 5,
            required: true,
          },
          {
            id: "route-familiarity",
            label: "Route Familiarity",
            type: "checkbox",
            critical: false,
            points: 5,
            required: true,
          },
          {
            id: "emergency-procedures",
            label: "Emergency Procedures Known",
            type: "checkbox",
            critical: false,
            points: 5,
            required: true,
          },
          {
            id: "gps-activated",
            label: "GPS/Trip monitoring system activated",
            type: "checkbox",
            critical: false,
            points: 5,
            required: true,
          },
          {
            id: "safety-briefing",
            label: "Safety briefing provided",
            type: "checkbox",
            critical: false,
            points: 5,
            required: true,
          },
          {
            id: "rtsa-clearance",
            label: "RTSA clearance at gate",
            type: "checkbox",
            critical: false,
            points: 5,
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "vehicle-exterior",
    step: 4,
    title: "Vehicle Exterior Checklist",
    description: "Pre-trip exterior vehicle inspections",
    maxScore: 90,
    sections: [
      {
        id: "exterior-checks",
        title: "Exterior Checks",
        items: [
          {
            id: "tires",
            label: "Tires: Proper inflation, tread, damage",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "lights",
            label: "Lights: Headlights, taillights, signals operational",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "mirrors",
            label: "Mirrors: Clean, adjusted, no damage",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "windshield",
            label: "Windshield: No cracks, wipers functional",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "body-condition",
            label: "Body Condition: No visible damage",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "loose-parts",
            label: "Loose parts",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "leaks",
            label: "Leaks",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "engine-fluids",
    step: 5,
    title: "Engine & Fluids Check",
    description: "Engine oil, coolant, brake fluid, battery checks",
    maxScore: 90,
    sections: [
      {
        id: "fluid-checks",
        title: "Fluid & Battery Checks",
        items: [
          {
            id: "engine-oil",
            label: "Engine Oil: Level and quality",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "coolant",
            label: "Coolant: Levels and leaks",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "brake-fluid",
            label: "Brake Fluid: Proper level",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "transmission-fluid",
            label: "Transmission Fluid: Level and condition",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "steering-fluid",
            label: "Power Steering Fluid: Correct level",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "battery",
            label: "Battery: Terminals secure, battery healthy",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "interior-cabin",
    step: 6,
    title: "Interior & Safety Equipment",
    description: "Interior checks and emergency equipment",
    maxScore: 90,
    sections: [
      {
        id: "interior-checks",
        title: "Interior & Cabin",
        items: [
          {
            id: "dashboard",
            label: "Dashboard indicators functional",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "seatbelts",
            label: "Seatbelts: Operational and secure",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "horn",
            label: "Horn: Working",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
        ],
      },
      {
        id: "safety-equipment",
        title: "Safety Equipment",
        items: [
          {
            id: "fire-extinguisher",
            label: "Fire extinguisher (charged & tagged)",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "first-aid",
            label: "First aid kit (stock verified)",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "triangles",
            label: "Reflective triangles",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "wheel-chocks",
            label: "Wheel chocks",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "spare-tire",
            label: "Spare tire and jack",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "flashlight",
            label: "Torch/flashlight",
            type: "radio",
            critical: false,
            points: 5,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "functional-checks",
    step: 7,
    title: "Functional Checks",
    description: "Test braking, suspension, climate control",
    maxScore: 90,
    sections: [
      {
        id: "functional-tests",
        title: "Functional Tests",
        items: [
          {
            id: "brakes",
            label: "Brakes: Responsive and effective",
            type: "radio",
            critical: true,
            points: 20,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "suspension",
            label: "Suspension: No unusual noises/handling issues",
            type: "radio",
            critical: true,
            points: 20,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "climate",
            label: "Heating and A/C: Both operational",
            type: "radio",
            critical: false,
            points: 10,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
          {
            id: "steering",
            label: "Steering: Smooth and responsive",
            type: "radio",
            critical: true,
            points: 20,
            required: true,
            options: [
              { label: "Pass", value: "pass" },
              { label: "Fail", value: "fail" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "final-verification",
    step: 8,
    title: "Final Verification",
    description: "Final checks before departure",
    maxScore: 90,
    sections: [
      {
        id: "final-checks",
        title: "Final Verification",
        items: [
          {
            id: "critical-defects",
            label: "All critical defects rectified?",
            type: "radio",
            critical: true,
            points: 30,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "driver-briefed",
            label: "Driver briefed on trip hazards?",
            type: "radio",
            critical: false,
            points: 30,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "safe-ready",
            label: "Vehicle safe and ready for dispatch?",
            type: "radio",
            critical: true,
            points: 30,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "trip-compliance",
    step: 9,
    title: "Trip Compliance Monitoring",
    description: "During-trip behavior and compliance checks",
    maxScore: 90,
    sections: [
      {
        id: "driving-behavior",
        title: "Driving Behavior",
        items: [
          {
            id: "traffic-rules",
            label: "Obeys all traffic rules and road signs",
            type: "radio",
            critical: false,
            points: 10,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "safe-speed",
            label: "Maintains safe speed and following distance",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "smooth-driving",
            label: "Avoids harsh acceleration/braking/cornering",
            type: "radio",
            critical: false,
            points: 10,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "no-distraction",
            label: "Avoids phone use/distraction while driving",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "headlights",
            label: "Keeps headlights on during poor visibility",
            type: "radio",
            critical: false,
            points: 10,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "school-zone",
            label: "Speed in school zones (≤40 km/hr)",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Compliant", value: "compliant" },
              { label: "Violation", value: "violation" },
            ],
          },
        ],
      },
      {
        id: "vehicle-monitoring",
        title: "Vehicle & Load Monitoring",
        items: [
          {
            id: "monitor-instruments",
            label: "Monitors temperature/oil/warning lights",
            type: "radio",
            critical: false,
            points: 10,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "load-security",
            label: "Checks load security at rest stops",
            type: "radio",
            critical: false,
            points: 10,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "abnormal-sounds",
            label: "Reports abnormal sounds/vibrations/smoke",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "no-overload",
            label: "Avoids overloading or unauthorized passengers",
            type: "radio",
            critical: true,
            points: 15,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "post-trip",
    step: 10,
    title: "Post-Trip Reporting",
    description: "Document trip completion and issues",
    maxScore: 90,
    sections: [
      {
        id: "post-trip-items",
        title: "Post-Trip Items",
        items: [
          {
            id: "fault-report",
            label: "Vehicle Fault Report Submitted",
            type: "radio",
            critical: false,
            points: 18,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "final-inspection",
            label: "Final Inspection Signed Off",
            type: "radio",
            critical: false,
            points: 18,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "company-policy",
            label: "Compliance with company safety policy",
            type: "radio",
            critical: false,
            points: 18,
            required: true,
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "attitude",
            label: "Attitude and cooperation during journey",
            type: "radio",
            critical: false,
            points: 18,
            required: true,
            options: [
              { label: "Excellent", value: "excellent" },
              { label: "Good", value: "good" },
              { label: "Needs Improvement", value: "poor" },
            ],
          },
          {
            id: "incidents",
            label: "Incidents/Near Misses/Accidents Recorded",
            type: "radio",
            critical: true,
            points: 18,
            required: true,
            options: [
              { label: "None", value: "none" },
              { label: "Minor", value: "minor" },
              { label: "Serious", value: "serious" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sign-off",
    step: 11,
    title: "Digital Sign-Off",
    description: "Final approvals and digital signatures",
    maxScore: 0,
    sections: [
      {
        id: "signatures",
        title: "Sign-Offs",
        items: [
          {
            id: "driver-signature",
            label: "Driver Signature",
            type: "text",
            critical: true,
            points: 0,
            required: true,
          },
          {
            id: "supervisor-signature",
            label: "Supervisor Signature",
            type: "text",
            critical: true,
            points: 0,
            required: true,
          },
          {
            id: "mechanic-signature",
            label: "Mechanic Signature (if repairs done)",
            type: "text",
            critical: false,
            points: 0,
            required: false,
          },
        ],
      },
    ],
  },
]

export function getRiskLevel(percentage: number): "low" | "medium" | "high" | "critical" {
  if (percentage >= 90) return "low"
  if (percentage >= 75) return "medium"
  if (percentage >= 60) return "high"
  return "critical"
}
