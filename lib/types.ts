export type UserRole = "driver" | "supervisor" | "mechanic" | "admin" | "org_admin"

export interface User {
  id: string
  email: string
  role: UserRole
  org_id: string
  created_at: string
  updated_at: string
}

export interface Profile {
  user_id: string
  full_name: string
  phone: string
  license_number: string
  vehicle_id: string
  vehicle_plate: string
  avatar_url?: string
}

export interface Organization {
  id: string
  name: string
  depot_location: string
  created_at: string
  updated_at: string
}

export interface Trip {
  id: string
  user_id: string
  org_id: string
  trip_date: string
  route: string
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "completed"
  aggregate_score: number
  risk_level: "low" | "medium" | "high" | "critical"
  critical_override: boolean
  created_at: string
  updated_at: string
}

export interface TripModule {
  id: string
  trip_id: string
  name: string
  step: number
  score: number
  risk_level: "low" | "medium" | "high"
  status: "incomplete" | "complete" | "failed"
}

export interface ModuleItem {
  id: string
  module_id: string
  label: string
  field_type: "checkbox" | "radio" | "text" | "textarea" | "number" | "select"
  critical: boolean
  points: number
  value: string | boolean | number | null
  remarks?: string
}

export interface SignOff {
  id: string
  trip_id: string
  role: UserRole
  name: string
  signature: string // Base64 or URL
  signed_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  trip_id?: string
  action: string
  metadata: Record<string, any>
  created_at: string
}

export interface CriticalFailure {
  id: string
  trip_id: string
  module_item_id: string
  description: string
  points: number
  resolved: boolean
  created_at: string
}

export interface TripDraft {
  user_id: string
  org_id: string
  trip_id?: string
  draft_data: Record<string, any>
  saved_at: string
}
