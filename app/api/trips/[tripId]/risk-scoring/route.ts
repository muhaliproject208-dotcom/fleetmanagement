import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { 
  calculateComprehensiveRiskScore, 
  getModuleRiskScores, 
  calculateRiskTrend,
  RiskScoreBreakdown,
  ModuleRiskScore
} from "@/lib/enhanced-risk-scoring"

interface Params {
  params: Promise<{ tripId: string }>
}

/**
 * GET /api/trips/[tripId]/risk-scoring - Get comprehensive risk scoring
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "risk_scoring")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const includeModules = searchParams.get("include_modules") === "true"
    const includeTrend = searchParams.get("include_trend") === "true"
    const trendDays = searchParams.get("trend_days") ? parseInt(searchParams.get("trend_days")!) : 30

    // Get current user's role and verify trip access
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check trip access permissions
    let tripQuery = supabase.from("trips").select("id, driver_id, org_id, status").eq("id", tripId)
    
    if (currentUser.role === "driver") {
      tripQuery = tripQuery.eq("driver_id", user.id)
    } else if (["supervisor", "mechanic", "org_admin"].includes(currentUser.role)) {
      tripQuery = tripQuery.eq("org_id", currentUser.org_id)
    }
    // Admins see all

    const { data: trip, error: tripError } = await tripQuery.single()
    if (tripError || !trip) {
      return NextResponse.json({ success: false, error: "Trip not found or access denied" }, { status: 404 })
    }

    const result: any = {}

    // Calculate comprehensive risk score
    const riskScore = await calculateComprehensiveRiskScore(tripId, supabase)
    result.comprehensiveRiskScore = riskScore

    // Get module risk scores
    if (includeModules) {
      const moduleScores = await getModuleRiskScores(tripId, supabase)
      result.moduleRiskScores = moduleScores

      // Add module summary
      result.moduleSummary = {
        totalModules: moduleScores.length,
        completedModules: moduleScores.filter(m => m.completionRate === 1.0).length,
        averageModuleScore: moduleScores.reduce((sum: number, m: ModuleRiskScore) => sum + m.score, 0) / moduleScores.length,
        criticalModules: moduleScores.filter(m => m.riskLevel === 'critical').length,
        highRiskModules: moduleScores.filter(m => m.riskLevel === 'high').length,
      }
    }

    // Get risk trend
    if (includeTrend && trip.driver_id) {
      const riskTrend = await calculateRiskTrend(trip.driver_id, trendDays, supabase)
      result.riskTrend = riskTrend
    }

    // Get current trip status for context
    const { data: tripDetails } = await supabase
      .from("trips")
      .select(`
        trip_date,
        route,
        status,
        aggregate_score,
        risk_level,
        created_at,
        updated_at,
        users:driver_id (
          full_name,
          email
        ),
        vehicles:vehicle_id (
          registration_number,
          make,
          model
        )
      `)
      .eq("id", tripId)
      .single()

    result.tripDetails = tripDetails

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to calculate risk scoring"), { status: 500 })
  }
}

/**
 * POST /api/trips/[tripId]/risk-scoring/recalculate - Recalculate risk scores
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "risk_scoring_recalculate")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const body = await req.json()

    // Get current user's role and verify trip access
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check trip access
    const { data: trip } = await supabase
      .from("trips")
      .select("id, driver_id, org_id, status")
      .eq("id", tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check permissions - supervisors, org_admins, and admins can recalculate
    const canRecalculate = 
      currentUser.role === "admin" ||
      (["supervisor", "org_admin"].includes(currentUser.role) && trip.org_id === currentUser.org_id)

    if (!canRecalculate) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Force recalculation of comprehensive risk score
    const newRiskScore = await calculateComprehensiveRiskScore(tripId, supabase)

    // Update trip with new risk data
    const updateData: any = {
      aggregate_score: newRiskScore.totalScore,
      risk_level: newRiskScore.riskLevel,
      updated_at: new Date().toISOString(),
    }

    // Add compliance status to trip metadata if needed
    if (body.updateComplianceStatus) {
      // You might want to add a compliance_status field to the trips table
      // For now, we'll store it in audit logs
    }

    const { data: updatedTrip, error } = await supabase
      .from("trips")
      .update(updateData)
      .eq("id", tripId)
      .select()
      .single()

    if (error) throw error

    // Get updated module scores
    const moduleScores = await getModuleRiskScores(tripId, supabase)

    // Log recalculation
    await auditLog(user.id, tripId, "risk_score_recalculated", {
      previousScore: trip.aggregate_score,
      newScore: newRiskScore.totalScore,
      previousRiskLevel: trip.risk_level,
      newRiskLevel: newRiskScore.riskLevel,
      complianceStatus: newRiskScore.complianceStatus,
      factorsCount: newRiskScore.factors.length,
    })

    return NextResponse.json({
      success: true,
      data: {
        updatedTrip,
        comprehensiveRiskScore: newRiskScore,
        moduleRiskScores: moduleScores,
        changes: {
          previousScore: trip.aggregate_score,
          newScore: newRiskScore.totalScore,
          scoreChange: newRiskScore.totalScore - (trip.aggregate_score || 0),
          previousRiskLevel: trip.risk_level,
          newRiskLevel: newRiskScore.riskLevel,
          riskLevelChanged: trip.risk_level !== newRiskScore.riskLevel,
        },
      },
      message: "Risk scores recalculated successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to recalculate risk scores"), { status: 500 })
  }
}

/**
 * GET /api/trips/[tripId]/risk-scoring/factors - Get detailed risk factors
 */
export async function FACTORS(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await getSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const category = searchParams.get("category")
    const impact = searchParams.get("impact")

    // Get current user's role and verify trip access
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check trip access permissions
    let tripQuery = supabase.from("trips").select("id, driver_id, org_id").eq("id", tripId)
    
    if (currentUser.role === "driver") {
      tripQuery = tripQuery.eq("driver_id", user.id)
    } else if (["supervisor", "mechanic", "org_admin"].includes(currentUser.role)) {
      tripQuery = tripQuery.eq("org_id", currentUser.org_id)
    }
    // Admins see all

    const { data: trip, error: tripError } = await tripQuery.single()
    if (tripError || !trip) {
      return NextResponse.json({ success: false, error: "Trip not found or access denied" }, { status: 404 })
    }

    // Calculate comprehensive risk score to get factors
    const riskScore = await calculateComprehensiveRiskScore(tripId, supabase)
    let factors = riskScore.factors

    // Apply filters
    if (category) {
      factors = factors.filter(f => f.category.toLowerCase().includes(category.toLowerCase()))
    }

    if (impact) {
      factors = factors.filter(f => f.impact === impact)
    }

    // Group factors by category
    const groupedFactors = factors.reduce((groups: any, factor) => {
      if (!groups[factor.category]) {
        groups[factor.category] = []
      }
      groups[factor.category].push(factor)
      return groups
    }, {})

    // Calculate category summaries
    const categorySummaries = Object.keys(groupedFactors).map(category => {
      const categoryFactors = groupedFactors[category]
      const totalScore = categoryFactors.reduce((sum: number, f: any) => sum + f.score, 0)
      const maxImpact = categoryFactors.reduce((max: string, f: any) => 
        f.impact === 'critical' ? 'critical' :
        f.impact === 'high' ? 'high' :
        f.impact === 'medium' ? 'medium' : 'low', 'low')

      return {
        category,
        factorCount: categoryFactors.length,
        totalScore,
        averageScore: totalScore / categoryFactors.length,
        maxImpact,
        factors: categoryFactors,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        factors,
        groupedFactors,
        categorySummaries,
        summary: {
          totalFactors: factors.length,
          criticalFactors: factors.filter(f => f.impact === 'critical').length,
          highFactors: factors.filter(f => f.impact === 'high').length,
          mediumFactors: factors.filter(f => f.impact === 'medium').length,
          lowFactors: factors.filter(f => f.impact === 'low').length,
          totalScore: factors.reduce((sum: number, f: any) => sum + f.score, 0),
        },
      },
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch risk factors"), { status: 500 })
  }
}

/**
 * GET /api/trips/[tripId]/risk-scoring/dashboard - Get risk scoring dashboard data
 */
export async function DASHBOARD(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await getSupabaseServer()

    // Get current user's role and verify trip access
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check trip access permissions
    let tripQuery = supabase.from("trips").select("id, driver_id, org_id, status").eq("id", tripId)
    
    if (currentUser.role === "driver") {
      tripQuery = tripQuery.eq("driver_id", user.id)
    } else if (["supervisor", "mechanic", "org_admin"].includes(currentUser.role)) {
      tripQuery = tripQuery.eq("org_id", currentUser.org_id)
    }
    // Admins see all

    const { data: trip, error: tripError } = await tripQuery.single()
    if (tripError || !trip) {
      return NextResponse.json({ success: false, error: "Trip not found or access denied" }, { status: 404 })
    }

    // Get comprehensive risk data
    const riskScore = await calculateComprehensiveRiskScore(tripId, supabase)
    const moduleScores = await getModuleRiskScores(tripId, supabase)

    // Get real-time alerts
    const { data: activeAlerts } = await supabase
      .from("real_time_alerts")
      .select("*")
      .eq("trip_id", tripId)
      .eq("acknowledged", false)
      .order("alert_timestamp", { ascending: false })
      .limit(10)

    // Get recent violations
    const { data: recentViolations } = await supabase
      .from("speed_violations")
      .select("*")
      .eq("trip_id", tripId)
      .order("violation_timestamp", { ascending: false })
      .limit(5)

    // Get trip details
    const { data: tripDetails } = await supabase
      .from("trips")
      .select(`
        trip_date,
        route,
        status,
        users:driver_id (
          full_name,
          email
        ),
        vehicles:vehicle_id (
          registration_number,
          make,
          model
        )
      `)
      .eq("id", tripId)
      .single()

    // Prepare dashboard data
    const dashboardData = {
      overview: {
        totalScore: riskScore.totalScore,
        riskLevel: riskScore.riskLevel,
        complianceStatus: riskScore.complianceStatus,
        preTripScore: riskScore.preTripScore,
        inTripScore: riskScore.inTripScore,
        postTripScore: riskScore.postTripScore,
      },
      moduleBreakdown: {
        totalModules: moduleScores.length,
        completedModules: moduleScores.filter((m: any) => m.completionRate === 1.0).length,
        criticalModules: moduleScores.filter((m: any) => m.riskLevel === 'critical').length,
        highRiskModules: moduleScores.filter((m: any) => m.riskLevel === 'high').length,
        modules: moduleScores,
      },
      alerts: {
        activeCount: activeAlerts?.length || 0,
        criticalCount: activeAlerts?.filter((a: any) => a.severity === 'critical').length || 0,
        warningCount: activeAlerts?.filter((a: any) => a.severity === 'warning').length || 0,
        recentAlerts: activeAlerts || [],
      },
      violations: {
        totalViolations: recentViolations?.length || 0,
        criticalViolations: recentViolations?.filter((v: any) => v.severity === 'critical').length || 0,
        majorViolations: recentViolations?.filter((v: any) => v.severity === 'major').length || 0,
        recentViolations: recentViolations || [],
      },
      riskFactors: {
        totalFactors: riskScore.factors.length,
        criticalFactors: riskScore.factors.filter(f => f.impact === 'critical').length,
        highFactors: riskScore.factors.filter(f => f.impact === 'high').length,
        topFactors: riskScore.factors
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 5),
      },
      tripDetails,
    }

    return NextResponse.json({
      success: true,
      data: dashboardData,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch risk dashboard"), { status: 500 })
  }
}
