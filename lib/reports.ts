import { getSupabaseClient } from '@/lib/supabase-client'
import { REPORT_QUERIES } from './checklist-mapping'

export interface ReportData {
  tripId: string
  driverId: string
  orgId?: string
  dateRange?: { start: string; end: string }
}

export interface ChecklistReport {
  trip: {
    id: string
    trip_date: string
    route: string
    aggregate_score: number
    risk_level: string
    status: string
    created_at: string
  }
  modules: Array<{
    step: number
    name: string
    items: Array<{
      label: string
      value: any
      points: number
      critical: boolean
      field_type: string
    }>
    score: number
    risk_level: string
  }>
  driver: {
    full_name: string
    email: string
    role: string
  }
}

export interface LastTestReport {
  trip: ChecklistReport['trip']
  modules: ChecklistReport['modules']
  summary: {
    totalPoints: number
    riskLevel: string
    criticalFailures: number
    completionTime: number
  }
}

export interface RiskTrendData {
  date: string
  aggregate_score: number
  risk_level: string
  status: string
}

export interface ViolationReport {
  trip_date: string
  route: string
  driver_name: string
  driver_email: string
  label: string
  value: any
  points: number
  module_name: string
}

export interface OrgTripSummary {
  id: string
  trip_date: string
  route: string
  aggregate_score: number
  risk_level: string
  status: string
  driver_name: string
  driver_email: string
  created_at: string
}

export class ReportGenerator {
  private supabase = getSupabaseClient()

  // Get last test for a driver
  async getLastTest(driverId: string): Promise<LastTestReport | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_last_test_with_details', { driver_id: driverId })

      if (error) {
        console.error('Error fetching last test:', error)
        return null
      }

      if (!data || data.length === 0) {
        return null
      }

      const trip = data[0]
      const modules = this.groupItemsByModule(data)

      const summary = {
        totalPoints: trip.aggregate_score,
        riskLevel: trip.risk_level,
        criticalFailures: data.filter((item: any) => item.critical && item.points > 0).length,
        completionTime: this.calculateCompletionTime(trip.created_at, trip.completed_at)
      }

      return {
        trip: {
          id: trip.id,
          trip_date: trip.trip_date,
          route: trip.route,
          aggregate_score: trip.aggregate_score,
          risk_level: trip.risk_level,
          status: trip.status,
          created_at: trip.created_at
        },
        modules,
        summary
      }
    } catch (error) {
      console.error('Last test report error:', error)
      return null
    }
  }

  // Get full checklist report for a specific trip
  async getFullChecklistReport(tripId: string): Promise<ChecklistReport | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_full_checklist_report', { trip_id: tripId })

      if (error) {
        console.error('Error fetching checklist report:', error)
        return null
      }

      if (!data || data.length === 0) {
        return null
      }

      const trip = data[0]
      const modules = this.groupItemsByModule(data)
      const driver = {
        full_name: trip.driver_full_name,
        email: trip.driver_email,
        role: trip.driver_role
      }

      return {
        trip: {
          id: trip.id,
          trip_date: trip.trip_date,
          route: trip.route,
          aggregate_score: trip.aggregate_score,
          risk_level: trip.risk_level,
          status: trip.status,
          created_at: trip.created_at
        },
        modules,
        driver
      }
    } catch (error) {
      console.error('Checklist report error:', error)
      return null
    }
  }

  // Get risk trend for a driver (30 days)
  async getRiskTrend(driverId: string): Promise<RiskTrendData[]> {
    try {
      const { data, error } = await this.supabase
        .from('trips')
        .select('trip_date, aggregate_score, risk_level, status')
        .eq('user_id', driverId)
        .gte('trip_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('trip_date', { ascending: true })

      if (error) {
        console.error('Error fetching risk trend:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Risk trend error:', error)
      return []
    }
  }

  // Get violations report (for audits/RTSA)
  async getViolations(orgId?: string): Promise<ViolationReport[]> {
    try {
      let query = this.supabase
        .from('module_items')
        .select(`
          value,
          points,
          critical,
          label,
          field_type,
          trip_modules!inner(
            trip_id,
            step,
            name,
            trips!inner(
              trip_date,
              route,
              user_id,
              org_id,
              users!inner(
                full_name,
                email
              )
            )
          )
        `)
        .gt('points', 0)
        .eq('critical', true)

      if (orgId) {
        query = query.eq('trip_modules.trips.org_id', orgId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching violations:', error)
        return []
      }

      return (data || []).map((item: any) => ({
        trip_date: item.trip_modules?.trips?.trip_date || '',
        route: item.trip_modules?.trips?.route || '',
        driver_name: item.trip_modules?.trips?.users?.full_name || '',
        driver_email: item.trip_modules?.trips?.users?.email || '',
        label: item.label,
        value: item.value,
        points: item.points,
        module_name: item.trip_modules?.name || ''
      }))
    } catch (error) {
      console.error('Violations report error:', error)
      return []
    }
  }

  // Get organization trips summary (for supervisors)
  async getOrgTrips(orgId: string): Promise<OrgTripSummary[]> {
    try {
      const { data, error } = await this.supabase
        .from('trips')
        .select(`
          id,
          trip_date,
          route,
          aggregate_score,
          risk_level,
          status,
          created_at,
          users!inner(
            full_name,
            email
          )
        `)
        .eq('org_id', orgId)
        .order('trip_date', { ascending: false })

      if (error) {
        console.error('Error fetching org trips:', error)
        return []
      }

      return (data || []).map((trip: any) => ({
        id: trip.id,
        trip_date: trip.trip_date,
        route: trip.route,
        aggregate_score: trip.aggregate_score,
        risk_level: trip.risk_level,
        status: trip.status,
        driver_name: trip.users?.full_name || '',
        driver_email: trip.users?.email || '',
        created_at: trip.created_at
      }))
    } catch (error) {
      console.error('Org trips error:', error)
        return []
    }
  }

  // Generate compliance report (for management)
  async getComplianceReport(orgId?: string, dateRange?: { start: string; end: string }) {
    try {
      let query = this.supabase
        .from('trips')
        .select(`
          trip_date,
          aggregate_score,
          risk_level,
          status,
          org_id,
          users!inner(
            full_name,
            email,
            role
          )
        `)

      if (orgId) {
        query = query.eq('org_id', orgId)
      }

      if (dateRange) {
        query = query
          .gte('trip_date', dateRange.start)
          .lte('trip_date', dateRange.end)
      }

      const { data, error } = await query.order('trip_date', { ascending: false })

      if (error) {
        console.error('Error fetching compliance report:', error)
        return null
      }

      const trips = data || []
      
      // Calculate compliance metrics
      const totalTrips = trips.length
      const approvedTrips = trips.filter((trip: any) => trip.status === 'approved').length
      const failedTrips = trips.filter((trip: any) => trip.status === 'failed').length
      const pendingTrips = trips.filter((trip: any) => trip.status === 'pending').length
      
      const complianceRate = totalTrips > 0 ? (approvedTrips / totalTrips) * 100 : 0
      const failureRate = totalTrips > 0 ? (failedTrips / totalTrips) * 100 : 0

      // Risk distribution
      const riskDistribution = {
        low: trips.filter((trip: any) => trip.risk_level === 'low').length,
        medium: trips.filter((trip: any) => trip.risk_level === 'medium').length,
        high: trips.filter((trip: any) => trip.risk_level === 'high').length
      }

      // Average scores by role
      const scoresByRole = trips.reduce((acc: Record<string, { total: number; count: number; average: number }>, trip: any) => {
        const role = trip.users?.role || 'unknown'
        if (!acc[role]) {
          acc[role] = { total: 0, count: 0, average: 0 }
        }
        acc[role].total += trip.aggregate_score
        acc[role].count += 1
        acc[role].average = acc[role].total / acc[role].count
        return acc
      }, {} as Record<string, { total: number; count: number; average: number }>)

      return {
        summary: {
          totalTrips,
          approvedTrips,
          failedTrips,
          pendingTrips,
          complianceRate: Math.round(complianceRate),
          failureRate: Math.round(failureRate)
        },
        riskDistribution,
        scoresByRole,
        trips
      }
    } catch (error) {
      console.error('Compliance report error:', error)
      return null
    }
  }

  // Helper method to group items by module
  private groupItemsByModule(data: any[]): ChecklistReport['modules'] {
    const moduleMap = new Map()

    data.forEach((item: any) => {
      const moduleKey = `${item.step}_${item.name}`
      if (!moduleMap.has(moduleKey)) {
        moduleMap.set(moduleKey, {
          step: item.step,
          name: item.name,
          items: [],
          score: 0,
          risk_level: 'low'
        })
      }

      const module = moduleMap.get(moduleKey)
      module.items.push({
        label: item.label,
        value: item.value,
        points: item.points,
        critical: item.critical,
        field_type: item.field_type
      })

      // Calculate module score
      if (item.critical && item.points > 0) {
        module.score += item.points
      }
    })

    // Set risk levels for modules
    moduleMap.forEach((module: any) => {
      if (module.score <= 3) module.risk_level = 'low'
      else if (module.score <= 8) module.risk_level = 'medium'
      else module.risk_level = 'high'
    })

    return Array.from(moduleMap.values()).sort((a, b) => a.step - b.step)
  }

  // Helper method to calculate completion time
  private calculateCompletionTime(startTime: string, endTime?: string): number {
    if (!endTime) return 0
    
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    return Math.round((end - start) / 60000) // minutes
  }
}

export const reportGenerator = new ReportGenerator()
