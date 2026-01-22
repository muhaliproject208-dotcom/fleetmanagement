import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError, auditLog, calculateAggregateScore, getRiskLevelFromScore } from "@/lib/api-helpers"

/**
 * POST /api/trips/[tripId]/submit - Submit trip for approval
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await getSupabaseServer()
    const { tripId } = await params

    // Get trip
    const { data: trip } = await supabase.from("trips").select("*, trip_modules(*)").eq("id", tripId).single()

    if (!trip || trip.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Trip not found or access denied" }, { status: 404 })
    }

    if (trip.status !== "draft") {
      return NextResponse.json({ success: false, error: "Trip is not in draft state" }, { status: 400 })
    }

    // Calculate scores
    const moduleScores: Record<string, number> = {}
    const maxScores: Record<string, number> = {}

    trip.trip_modules?.forEach((module: any) => {
      moduleScores[module.id] = module.score || 0
      // Default max score per module
      maxScores[module.id] = 90
    })

    const aggregateScore = calculateAggregateScore(Object.values(moduleScores))
    const riskLevel = getRiskLevelFromScore(aggregateScore)

    // Check for critical failures
    const { data: criticalItems } = await supabase
      .from("module_items")
      .select("*")
      .in("id", trip.trip_modules?.flatMap((m: any) => m.module_items?.map((i: any) => i.id) || []) || [])
      .eq("critical", true)

    const hasCriticalFailures = criticalItems?.some((item: any) => !item.value)

    // Update trip status
    const { data: updated, error } = await supabase
      .from("trips")
      .update({
        status: "submitted",
        aggregate_score: aggregateScore,
        risk_level: riskLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .select()
      .single()

    if (error) throw error

    await auditLog(user.id, tripId, "trip_submitted", {
      aggregate_score: aggregateScore,
      risk_level: riskLevel,
      has_critical_failures: hasCriticalFailures,
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Trip submitted for approval",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to submit trip"), { status: 500 })
  }
}
