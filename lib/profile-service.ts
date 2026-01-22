import { createClient } from '@supabase/supabase-js'

export interface DriverProfile {
  id: string
  user_id: string
  full_name: string
  email: string
  phone?: string
  national_id?: string
  employee_id?: string
  role: string
  org_id?: string
  license_number?: string
  license_class?: string
  license_expiry?: string
  medical_fitness_status: 'valid' | 'expired' | 'expiring_soon'
  last_medical_check?: string
  assigned_vehicle_id?: string
  vehicle_plate?: string
  vehicle_type?: string
  depot_unit?: string
  primary_route?: string
  account_status: 'active' | 'suspended' | 'terminated'
  access_level: 'driver' | 'supervisor' | 'mechanic' | 'admin'
  last_login?: string
  last_action?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Certification {
  id: string
  driver_id: string
  certification_type: string
  certification_number?: string
  issue_date?: string
  expiry_date?: string
  status: 'valid' | 'expired' | 'suspended' | 'revoked'
  issuing_authority?: string
  document_url?: string
}

export interface Schedule {
  id: string
  driver_id: string
  route_name: string
  shift_date: string
  start_time: string
  end_time: string
  vehicle_id?: string
  vehicle_plate?: string
  vehicle_type?: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
}

export interface Organization {
  id: string
  name: string
  type: 'fleet' | 'depot' | 'company'
  address?: string
  contact_phone?: string
  contact_email?: string
}

export interface SafetySummary {
  total_inspections: number
  completed_inspections: number
  pending_inspections: number
  approval_rate: number
  risk_distribution: {
    low: number
    medium: number
    high: number
    critical: number
  }
  last_inspection_date?: string
  last_risk_level?: string
}

export interface CriticalFailure {
  id: string
  driver_id: string
  failure_category: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'unresolved' | 'resolved'
  created_at: string
  resolved_at?: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  resource_type?: string
  resource_id?: string
  old_values?: any
  new_values?: any
  created_at: string
}

export class ProfileService {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // Get comprehensive driver profile
  async getDriverProfile(userId: string): Promise<DriverProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select(`
          *,
          users!inner(email),
          organizations(id, name, type)
        `)
        .eq('user_id', userId)
        .single()

      if (error) throw error
      
      return {
        ...data,
        email: data.users.email,
        organization: data.organizations
      } as DriverProfile
    } catch (error) {
      console.error('Error fetching driver profile:', error)
      return null
    }
  }

  // Update driver profile
  async updateDriverProfile(userId: string, updates: Partial<DriverProfile>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error

      // Log the update
      await this.logAuditAction(userId, 'profile_update', 'profile', userId, null, updates)
    } catch (error) {
      console.error('Error updating driver profile:', error)
      throw error
    }
  }

  // Get driver certifications
  async getDriverCertifications(userId: string): Promise<Certification[]> {
    try {
      const { data, error } = await this.supabase
        .from('certifications')
        .select('*')
        .eq('driver_id', userId)
        .order('expiry_date', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching certifications:', error)
      return []
    }
  }

  // Add or update certification
  async upsertCertification(userId: string, certification: Partial<Certification>): Promise<Certification> {
    try {
      const { data, error } = await this.supabase
        .from('certifications')
        .upsert({
          ...certification,
          driver_id: userId,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error upserting certification:', error)
      throw error
    }
  }

  // Get safety summary
  async getSafetySummary(userId: string): Promise<SafetySummary> {
    try {
      // Fetch trips data for safety metrics
      const { data: trips, error: tripsError } = await this.supabase
        .from('trips')
        .select('status, aggregate_score, created_at, risk_level')
        .or(`user_id.eq.${userId},driver_id.eq.${userId}`)

      if (tripsError) throw tripsError

      const totalInspections = trips?.length || 0
      const completedInspections = trips?.filter((t: any) => t.status === 'approved').length || 0
      const pendingInspections = trips?.filter((t: any) => t.status === 'pending' || t.status === 'under_review').length || 0
      const approvalRate = totalInspections > 0 ? Math.round((completedInspections / totalInspections) * 100) : 0

      // Calculate risk distribution
      const riskDistribution = {
        low: trips?.filter((t: any) => t.risk_level === 'low').length || 0,
        medium: trips?.filter((t: any) => t.risk_level === 'medium').length || 0,
        high: trips?.filter((t: any) => t.risk_level === 'high').length || 0,
        critical: trips?.filter((t: any) => t.risk_level === 'critical').length || 0
      }

      const lastInspection = trips?.length > 0 ? 
        trips.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null

      return {
        total_inspections: totalInspections,
        completed_inspections: completedInspections,
        pending_inspections: pendingInspections,
        approval_rate: approvalRate,
        risk_distribution: riskDistribution,
        last_inspection_date: lastInspection?.created_at,
        last_risk_level: lastInspection?.risk_level
      }
    } catch (error) {
      console.error('Error fetching safety summary:', error)
      return {
        total_inspections: 0,
        completed_inspections: 0,
        pending_inspections: 0,
        approval_rate: 0,
        risk_distribution: { low: 0, medium: 0, high: 0, critical: 0 }
      }
    }
  }

  // Get user schedules
  async getUserSchedules(userId: string): Promise<Schedule[]> {
    try {
      const { data, error } = await this.supabase
        .from('schedules')
        .select('*')
        .eq('driver_id', userId)
        .eq('status', 'scheduled')
        .order('shift_date', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching user schedules:', error)
      return []
    }
  }

  // Get critical failures
  async getCriticalFailures(userId: string): Promise<CriticalFailure[]> {
    try {
      const { data, error } = await this.supabase
        .from('critical_failures')
        .select('*')
        .eq('driver_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching critical failures:', error)
      return []
    }
  }

  // Get audit logs
  async getAuditLogs(userId: string, limit: number = 50): Promise<AuditLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      return []
    }
  }

  // Log audit action
  async logAuditAction(
    userId: string, 
    action: string, 
    resourceType?: string, 
    resourceId?: string,
    oldValues?: any,
    newValues?: any
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('audit_logs')
        .insert({
          user_id: userId,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          old_values: oldValues,
          new_values: newValues,
          created_at: new Date().toISOString()
        })

      if (error) throw error
    } catch (error) {
      console.error('Error logging audit action:', error)
    }
  }

  // Update last login
  async updateLastLogin(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating last login:', error)
    }
  }

  // Check compliance status
  async checkComplianceStatus(userId: string): Promise<{
    compliant: boolean
    issues: string[]
  }> {
    try {
      const profile = await this.getDriverProfile(userId)
      const certifications = await this.getDriverCertifications(userId)
      
      const issues: string[] = []

      // Check license expiry
      if (profile?.license_expiry) {
        const expiryDate = new Date(profile.license_expiry)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysUntilExpiry < 0) {
          issues.push('License has expired')
        } else if (daysUntilExpiry < 30) {
          issues.push('License expires soon')
        }
      }

      // Check medical fitness
      if (profile?.last_medical_check) {
        const lastMedical = new Date(profile.last_medical_check)
        const today = new Date()
        const daysSinceMedical = Math.ceil((today.getTime() - lastMedical.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysSinceMedical > 365) {
          issues.push('Medical check required')
        }
      }

      // Check certifications
      const expiredCertifications = certifications.filter(cert => 
        cert.expiry_date && new Date(cert.expiry_date) < new Date()
      )
      
      if (expiredCertifications.length > 0) {
        issues.push(`${expiredCertifications.length} certification(s) expired`)
      }

      return {
        compliant: issues.length === 0,
        issues
      }
    } catch (error) {
      console.error('Error checking compliance status:', error)
      return { compliant: false, issues: ['Unable to verify compliance'] }
    }
  }

  // Get organizations
  async getOrganizations(): Promise<Organization[]> {
    try {
      const { data, error } = await this.supabase
        .from('organizations')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching organizations:', error)
      return []
    }
  }
}
