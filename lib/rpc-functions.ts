import { getSupabaseServer } from "@/lib/supabase-server"

/**
 * RPC: Email lookup - Find user by email
 */
export async function getUserByEmail(email: string) {
  try {
    const supabase = await getSupabaseServer()
    
    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        email,
        role,
        org_id,
        created_at,
        profiles:user_id (
          full_name,
          phone,
          license_number,
          vehicle_id,
          vehicle_plate
        )
      `)
      .eq("email", email)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "User not found" }
      }
      throw error
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error in getUserByEmail:", error)
    return { success: false, error: "Failed to lookup user by email" }
  }
}

/**
 * RPC: Check user permissions for specific action
 */
export async function checkUserPermission(
  userId: string, 
  resource: string, 
  action: string
): Promise<{ success: boolean; hasPermission: boolean; error?: string }> {
  try {
    const supabase = await getSupabaseServer()
    
    // Get user role
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", userId)
      .single()

    if (userError || !user) {
      return { success: false, hasPermission: false, error: "User not found" }
    }

    // Define permissions matrix
    const permissions: Record<string, Record<string, string[]>> = {
      driver: {
        trip: ["create", "view_own", "edit_own", "submit"],
        profile: ["view_own", "edit_own"],
        draft: ["create", "view_own", "edit_own", "delete_own"],
        signoff: ["create_own"],
        critical_failure: ["view_own", "create"],
      },
      supervisor: {
        trip: ["view_org", "review", "approve", "reject"],
        profile: ["view_org"],
        user: ["view_org"],
        signoff: ["create"],
        critical_failure: ["view_org", "resolve"],
        audit_log: ["view_org"],
      },
      mechanic: {
        trip: ["view_org", "sign_off"],
        profile: ["view_org"],
        signoff: ["create"],
        critical_failure: ["view_org"],
      },
      org_admin: {
        trip: ["view_org", "manage"],
        user: ["view_org", "manage"],
        profile: ["view_org", "manage"],
        organization: ["manage"],
        audit_log: ["view_org"],
      },
      admin: {
        "*": ["*"] // Full access
      }
    }

    const userPermissions = permissions[user.role] || {}
    const allowedActions = userPermissions[resource] || userPermissions["*"] || []

    const hasPermission = allowedActions.includes("*") || allowedActions.includes(action)

    return { success: true, hasPermission }
  } catch (error) {
    console.error("Error in checkUserPermission:", error)
    return { success: false, hasPermission: false, error: "Failed to check permissions" }
  }
}

/**
 * RPC: Calculate aggregate trip score based on modules
 */
export async function calculateTripScore(tripId: string) {
  try {
    const supabase = await getSupabaseServer()
    
    // Get all modules for the trip with their items
    const { data: modules, error: modulesError } = await supabase
      .from("trip_modules")
      .select(`
        id,
        name,
        step,
        score,
        risk_level,
        status,
        module_items (
          id,
          points,
          value,
          critical
        )
      `)
      .eq("trip_id", tripId)

    if (modulesError) throw modulesError

    if (!modules || modules.length === 0) {
      return { 
        success: true, 
        data: {
          aggregateScore: 0,
          totalPoints: 0,
          earnedPoints: 0,
          moduleScores: [],
          riskLevel: "critical"
        }
      }
    }

    let totalPoints = 0
    let earnedPoints = 0
    const moduleScores: any[] = []

    // Calculate scores for each module
    for (const module of modules) {
      let moduleTotalPoints = 0
      let moduleEarnedPoints = 0

      for (const item of module.module_items || []) {
        moduleTotalPoints += item.points || 0
        
        // Calculate earned points based on item value
        if (item.value === "pass" || item.value === "yes" || item.value === "complete") {
          moduleEarnedPoints += item.points || 0
        } else if (item.value === "partial") {
          moduleEarnedPoints += Math.floor((item.points || 0) * 0.5)
        }
        // For "fail", "no", "incomplete" - 0 points
      }

      const moduleScorePercentage = moduleTotalPoints > 0 
        ? Math.round((moduleEarnedPoints / moduleTotalPoints) * 100)
        : 0

      moduleScores.push({
        moduleId: module.id,
        moduleName: module.name,
        step: module.step,
        totalPoints: moduleTotalPoints,
        earnedPoints: moduleEarnedPoints,
        scorePercentage: moduleScorePercentage,
        riskLevel: getRiskLevelFromScore(moduleScorePercentage)
      })

      totalPoints += moduleTotalPoints
      earnedPoints += moduleEarnedPoints
    }

    // Calculate aggregate score
    const aggregateScore = totalPoints > 0 
      ? Math.round((earnedPoints / totalPoints) * 100)
      : 0

    const riskLevel = getRiskLevelFromScore(aggregateScore)

    return { 
      success: true, 
      data: {
        aggregateScore,
        totalPoints,
        earnedPoints,
        moduleScores,
        riskLevel
      }
    }
  } catch (error) {
    console.error("Error in calculateTripScore:", error)
    return { success: false, error: "Failed to calculate trip score" }
  }
}

/**
 * RPC: Check critical failure override status
 */
export async function checkCriticalFailureOverride(tripId: string) {
  try {
    const supabase = await getSupabaseServer()
    
    // Get trip details
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, risk_level, critical_override, status")
      .eq("id", tripId)
      .single()

    if (tripError) throw tripError

    // Get unresolved critical failures
    const { data: criticalFailures, error: failuresError } = await supabase
      .from("critical_failures")
      .select(`
        id,
        description,
        points,
        created_at,
        module_items:module_item_id (
          label,
          critical
        )
      `)
      .eq("trip_id", tripId)
      .eq("resolved", false)

    if (failuresError) throw failuresError

    // Calculate total critical points
    const totalCriticalPoints = criticalFailures?.reduce((sum: number, failure: any) => sum + (failure.points || 0), 0) || 0

    // Determine if override is needed
    const needsOverride = totalCriticalPoints >= 5 || criticalFailures?.some((f: any) => f.points >= 5)
    const hasHighImpactFailure = criticalFailures?.some((f: any) => f.points >= 10)

    return {
      success: true,
      data: {
        tripId,
        currentRiskLevel: trip?.risk_level,
        currentOverride: trip?.critical_override,
        needsOverride,
        hasHighImpactFailure,
        totalCriticalPoints,
        unresolvedFailures: criticalFailures || [],
        canApprove: !needsOverride && trip?.status === "submitted",
        recommendations: {
          requiresSupervisorApproval: needsOverride,
          requiresMechanicReview: criticalFailures?.some((f: any) => 
            f.module_items?.label?.toLowerCase().includes("vehicle") ||
            f.module_items?.label?.toLowerCase().includes("mechanical")
          ),
          blockApproval: hasHighImpactFailure
        }
      }
    }
  } catch (error) {
    console.error("Error in checkCriticalFailureOverride:", error)
    return { success: false, error: "Failed to check critical failure override" }
  }
}

/**
 * Helper function to determine risk level from score percentage
 */
function getRiskLevelFromScore(percentage: number): "low" | "medium" | "high" | "critical" {
  if (percentage >= 90) return "low"
  if (percentage >= 75) return "medium"
  if (percentage >= 60) return "high"
  return "critical"
}
