import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { getSupabaseServer } from "@/lib/supabase-server"

interface Params {
  params: Promise<{ logId: string }>
}

/**
 * GET /api/audit/logs/[logId] - Fetch specific audit log
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { logId } = await params
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

    // Get current user's role and org
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Fetch specific audit log
    const { data: log, error } = await supabase
      .from("audit_logs")
      .select(`
        *,
        users:user_id (
          email,
          role,
          profiles:user_id (
            full_name
          )
        ),
        trips:trip_id (
          id,
          trip_date,
          route,
          status
        )
      `)
      .eq("id", logId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Audit log not found" }, { status: 404 })
      }
      throw error
    }

    // Check access permissions
    const canAccess = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && log.user_id === user.id) ||
      ((currentUser.role === "supervisor" || currentUser.role === "mechanic" || currentUser.role === "org_admin") && 
       log.trips?.org_id === currentUser.org_id)

    if (!canAccess) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: log,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch audit log"), { status: 500 })
  }
}
