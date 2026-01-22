import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { getSupabaseServer } from "@/lib/supabase-server"

/**
 * GET /api/audit/statistics - Fetch audit log statistics
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "default")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const groupBy = searchParams.get("group_by") // "day", "week", "month", "action", "user"

    // Get current user's role and org
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Build base query
    let query = supabase
      .from("audit_logs")
      .select(`
        action,
        created_at,
        user_id,
        trip_id,
        users:user_id (
          email,
          role
        )
      `)

    // Apply role-based filtering
    if (currentUser.role === "driver") {
      query = query.eq("user_id", user.id)
    } else if (currentUser.role === "supervisor" || currentUser.role === "mechanic" || currentUser.role === "org_admin") {
      query = query.in("user_id", 
        supabase.from("users").select("id").eq("org_id", currentUser.org_id)
      )
    }
    // Admins see all logs

    // Apply date range filter
    if (startDate) {
      query = query.gte("created_at", startDate)
    }

    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    const { data: logs, error } = await query.order("created_at", { ascending: false })

    if (error) throw error

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalLogs: 0,
          actionCounts: {},
          userActivity: {},
          timeSeries: [],
          topActions: []
        }
      })
    }

    // Calculate statistics
    const totalLogs = logs.length

    // Count by action
    const actionCounts: Record<string, number> = {}
    logs.forEach((log: any) => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
    })

    // User activity (for supervisors/admins)
    let userActivity: Record<string, number> = {}
    if (currentUser.role !== "driver") {
      logs.forEach((log: any) => {
        const userEmail = log.users?.email || "unknown"
        userActivity[userEmail] = (userActivity[userEmail] || 0) + 1
      })
    }

    // Time series data (grouped by day)
    const timeSeries: Record<string, number> = {}
    logs.forEach((log: any) => {
      const date = new Date(log.created_at).toISOString().split('T')[0] // YYYY-MM-DD
      timeSeries[date] = (timeSeries[date] || 0) + 1
    })

    // Top actions
    const topActions = Object.entries(actionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }))

    // Additional grouping logic
    let groupedData: any = null
    if (groupBy === "action") {
      groupedData = actionCounts
    } else if (groupBy === "user" && currentUser.role !== "driver") {
      groupedData = userActivity
    } else if (groupBy === "day") {
      groupedData = timeSeries
    }

    return NextResponse.json({
      success: true,
      data: {
        totalLogs,
        actionCounts,
        userActivity,
        timeSeries,
        topActions,
        groupedData,
        dateRange: {
          start: startDate || logs[logs.length - 1]?.created_at,
          end: endDate || logs[0]?.created_at
        }
      }
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch audit statistics"), { status: 500 })
  }
}
