import { getSupabaseServer } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"
import type { User, Trip, UserRole } from "@/lib/types"

/**
 * Fetch current authenticated user with profile
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await getSupabaseServer()
    
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      return null
    }

    // Get user details with profile
    const { data: userData, error } = await supabase
      .from("users")
      .select(`
        *,
        profiles:user_id (
          full_name,
          phone,
          license_number,
          vehicle_id,
          vehicle_plate
        )
      `)
      .eq("id", authData.user.id)
      .single()

    if (error) {
      console.error("Error fetching user data:", error)
      return null
    }

    return userData as User
  } catch (error) {
    console.error("Error in getCurrentUser:", error)
    return null
  }
}

/**
 * Fetch user role with organization details
 */
export async function getUserRole(userId: string): Promise<{
  role: UserRole;
  orgId?: string;
  orgName?: string;
} | null> {
  try {
    const supabase = await getSupabaseServer()
    
    const { data, error } = await supabase
      .from("users")
      .select(`
        role,
        org_id,
        organizations:org_id (
          name
        )
      `)
      .eq("id", userId)
      .single()

    if (error) {
      console.error("Error fetching user role:", error)
      return null
    }

    return {
      role: data.role as UserRole,
      orgId: data.org_id || undefined,
      orgName: data.organizations?.name || undefined
    }
  } catch (error) {
    console.error("Error in getUserRole:", error)
    return null
  }
}

/**
 * Fetch trips based on user role and organization
 */
export async function getTripsByRole(
  userId: string, 
  userRole: UserRole, 
  orgId?: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
    includeModules?: boolean;
  }
): Promise<{ trips: Trip[]; total: number }> {
  try {
    const supabase = await getSupabaseServer()
    
    let query = supabase.from("trips").select(`
      *,
      profiles:user_id (
        full_name,
        vehicle_plate
      )
      ${options?.includeModules ? `,
      trip_modules (
        id,
        name,
        step,
        score,
        risk_level,
        status
      )
      ` : ""},
      { count: "exact" }
    `)

    // Apply role-based filtering
    if (userRole === "driver") {
      query = query.eq("user_id", userId)
    } else if (userRole === "supervisor" || userRole === "mechanic") {
      query = query.eq("org_id", orgId)
    }
    // Admins see all trips

    // Apply status filter if provided
    if (options?.status) {
      query = query.eq("status", options.status)
    }

    // Apply pagination
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.offset(options.offset)
    }

    // Order by creation date
    query = query.order("created_at", { ascending: false })

    const { data: trips, error, count } = await query

    if (error) {
      console.error("Error fetching trips:", error)
      return { trips: [], total: 0 }
    }

    return { 
      trips: (trips || []) as Trip[], 
      total: count || 0 
    }
  } catch (error) {
    console.error("Error in getTripsByRole:", error)
    return { trips: [], total: 0 }
  }
}

/**
 * Fetch trips requiring approval for supervisors
 */
export async function getTripsForApproval(
  orgId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ trips: Trip[]; total: number }> {
  try {
    const supabase = await getSupabaseServer()
    
    let query = supabase.from("trips").select(`
      *,
      profiles:user_id (
        full_name,
        phone,
        vehicle_plate
      ),
      trip_modules (
        id,
        name,
        step,
        score,
        risk_level,
        status
      ),
      sign_offs (
        id,
        role,
        name,
        signed_at
      ),
      critical_failures (
        id,
        description,
        points,
        resolved
      ),
      { count: "exact" }
    `)
      .eq("org_id", orgId)
      .in("status", ["submitted", "under_review"])

    // Apply additional status filter if provided
    if (options?.status) {
      query = query.eq("status", options.status)
    }

    // Apply pagination
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.offset(options.offset)
    }

    // Order by submission date
    query = query.order("updated_at", { ascending: false })

    const { data: trips, error, count } = await query

    if (error) {
      console.error("Error fetching trips for approval:", error)
      return { trips: [], total: 0 }
    }

    return { 
      trips: (trips || []) as Trip[], 
      total: count || 0 
    }
  } catch (error) {
    console.error("Error in getTripsForApproval:", error)
    return { trips: [], total: 0 }
  }
}

/**
 * Check if user can access specific trip
 */
export async function canAccessTrip(
  userId: string, 
  userRole: UserRole, 
  userOrgId: string | undefined,
  tripId: string
): Promise<boolean> {
  try {
    const supabase = await getSupabaseServer()
    
    const { data: trip, error } = await supabase
      .from("trips")
      .select("id, user_id, org_id, status")
      .eq("id", tripId)
      .single()

    if (error || !trip) {
      return false
    }

    // Admins can access all trips
    if (userRole === "admin") {
      return true
    }

    // Drivers can only access their own trips
    if (userRole === "driver") {
      return trip.user_id === userId
    }

    // Supervisors and mechanics can access trips in their organization
    if (userRole === "supervisor" || userRole === "mechanic") {
      return trip.org_id === userOrgId
    }

    // Org admins can access trips in their organization
    if (userRole === "org_admin") {
      return trip.org_id === userOrgId
    }

    return false
  } catch (error) {
    console.error("Error in canAccessTrip:", error)
    return false
  }
}

/**
 * Get trip statistics for dashboard
 */
export async function getTripStatistics(
  userId: string,
  userRole: UserRole,
  orgId?: string,
  dateRange?: { start: string; end: string }
) {
  try {
    const supabase = await getSupabaseServer()
    
    let query = supabase.from("trips").select(`
      status,
      risk_level,
      aggregate_score,
      created_at,
      trip_date
    `)

    // Apply role-based filtering
    if (userRole === "driver") {
      query = query.eq("user_id", userId)
    } else if (userRole === "supervisor" || userRole === "mechanic" || userRole === "org_admin") {
      query = query.eq("org_id", orgId)
    }
    // Admins see all trips

    // Apply date range filter if provided
    if (dateRange) {
      query = query
        .gte("trip_date", dateRange.start)
        .lte("trip_date", dateRange.end)
    }

    const { data: trips, error } = await query

    if (error) {
      console.error("Error fetching trip statistics:", error)
      return null
    }

    // Calculate statistics
    const totalTrips = trips?.length || 0
    const approvedTrips = trips?.filter((t: any) => t.status === "approved").length || 0
    const rejectedTrips = trips?.filter((t: any) => t.status === "rejected").length || 0
    const pendingTrips = trips?.filter((t: any) => t.status === "submitted" || t.status === "under_review").length || 0
    
    const riskLevels = {
      low: trips?.filter((t: any) => t.risk_level === "low").length || 0,
      medium: trips?.filter((t: any) => t.risk_level === "medium").length || 0,
      high: trips?.filter((t: any) => t.risk_level === "high").length || 0,
      critical: trips?.filter((t: any) => t.risk_level === "critical").length || 0
    }

    const averageScore = trips?.reduce((sum: number, t: any) => sum + (t.aggregate_score || 0), 0) / (totalTrips || 0) || 0

    return {
      totalTrips,
      approvedTrips,
      rejectedTrips,
      pendingTrips,
      riskLevels,
      averageScore: Math.round(averageScore),
      approvalRate: totalTrips > 0 ? Math.round((approvedTrips / totalTrips) * 100) : 0
    }
  } catch (error) {
    console.error("Error in getTripStatistics:", error)
    return null
  }
}
