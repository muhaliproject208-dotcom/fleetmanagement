import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"

/**
 * GET /api/analytics/trips - Get trip analytics
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await getSupabaseServer()

    // Get user role
    const { data: userData } = await supabase.from("users").select("role, org_id").eq("id", user.id).single()

    let query = supabase.from("trips").select("*")

    if (userData?.role === "driver") {
      query = query.eq("user_id", user.id)
    } else if (userData?.role === "supervisor" || userData?.role === "org_admin") {
      query = query.eq("org_id", userData.org_id)
    }

    const { data: trips } = await query

    // Calculate analytics
    const analytics = {
      total_trips: trips?.length || 0,
      approved: trips?.filter((t: any) => t.status === "approved").length || 0,
      pending: trips?.filter((t: any) => t.status === "submitted").length || 0,
      rejected: trips?.filter((t: any) => t.status === "rejected").length || 0,
      average_score: Math.round(
        (trips?.reduce((sum: number, t: any) => sum + (t.aggregate_score || 0), 0) || 0) / (trips?.length || 1),
      ),
      risk_distribution: {
        low: trips?.filter((t: any) => t.risk_level === "low").length || 0,
        medium: trips?.filter((t: any) => t.risk_level === "medium").length || 0,
        high: trips?.filter((t: any) => t.risk_level === "high").length || 0,
        critical: trips?.filter((t: any) => t.risk_level === "critical").length || 0,
      },
    }

    return NextResponse.json({
      success: true,
      data: analytics,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch analytics"), { status: 500 })
  }
}
