import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { getSupabaseServer } from "@/lib/supabase-server"

/**
 * GET /api/audit/logs - Fetch audit logs
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
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0
    const userId = searchParams.get("user_id")
    const tripId = searchParams.get("trip_id")
    const action = searchParams.get("action")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    // Get current user's role and org
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Build query
    let query = supabase
      .from("audit_logs")
      .select(`
        *,
        users:user_id (
          email,
          role
        ),
        trips:trip_id (
          id,
          trip_date,
          route
        )
      `, { count: "exact" })

    // Apply role-based filtering
    if (currentUser.role === "driver") {
      query = query.eq("user_id", user.id)
    } else if (currentUser.role === "supervisor" || currentUser.role === "mechanic" || currentUser.role === "org_admin") {
      query = query.in("user_id", 
        supabase.from("users").select("id").eq("org_id", currentUser.org_id)
      )
    }
    // Admins see all logs

    // Apply additional filters
    if (userId) {
      // Only admins can filter by specific user_id
      if (currentUser.role !== "admin") {
        return NextResponse.json({ 
          success: false, 
          error: "Only admins can filter by user ID" 
        }, { status: 403 })
      }
      query = query.eq("user_id", userId)
    }

    if (tripId) {
      query = query.eq("trip_id", tripId)
    }

    if (action) {
      query = query.eq("action", action)
    }

    if (startDate) {
      query = query.gte("created_at", startDate)
    }

    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    // Apply pagination
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: logs, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        logs: logs || [],
        total: count || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0)
      }
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch audit logs"), { status: 500 })
  }
}

/**
 * POST /api/audit/logs - Create audit log entry (for manual logging)
 */
export async function POST(req: NextRequest) {
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
    const body = await req.json()

    // Validate required fields
    if (!body.action) {
      return NextResponse.json({ 
        success: false, 
        error: "Action is required" 
      }, { status: 400 })
    }

    // Get user's role to check permissions
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check if user can log for the specified trip (if provided)
    if (body.trip_id) {
      const { data: trip } = await supabase
        .from("trips")
        .select("id, user_id, org_id")
        .eq("id", body.trip_id)
        .single()

      if (!trip) {
        return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
      }

      const canLogForTrip = 
        currentUser.role === "admin" ||
        (currentUser.role === "driver" && trip.user_id === user.id) ||
        ((currentUser.role === "supervisor" || currentUser.role === "mechanic" || currentUser.role === "org_admin") && 
         trip.org_id === currentUser.org_id)

      if (!canLogForTrip) {
        return NextResponse.json({ 
          success: false, 
          error: "Cannot create audit log for this trip" 
        }, { status: 403 })
      }
    }

    // Create audit log entry
    const { data: newLog, error } = await supabase
      .from("audit_logs")
      .insert({
        user_id: user.id,
        trip_id: body.trip_id || null,
        action: body.action,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: newLog,
      message: "Audit log created successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create audit log"), { status: 500 })
  }
}
