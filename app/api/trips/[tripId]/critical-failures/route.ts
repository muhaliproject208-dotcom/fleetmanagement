import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ tripId: string }>
}

/**
 * GET /api/trips/[tripId]/critical-failures - Fetch critical failures for a trip
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
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
    const resolved = searchParams.get("resolved")

    // Get current user's role
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Verify trip access
    const { data: trip } = await supabase
      .from("trips")
      .select("id, user_id, org_id")
      .eq("id", tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check access permissions
    const hasAccess = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && trip.user_id === user.id) ||
      ((currentUser.role === "supervisor" || currentUser.role === "mechanic") && 
       trip.org_id === currentUser.org_id)

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Build query
    let query = supabase
      .from("critical_failures")
      .select(`
        *,
        module_items:module_item_id (
          id,
          label,
          field_type,
          points
        ),
        trip_modules:module_item_id!inner (
          id,
          name,
          step
        )
      `)
      .eq("trip_id", tripId)

    // Filter by resolved status if specified
    if (resolved !== null) {
      const isResolved = resolved === "true"
      query = query.eq("resolved", isResolved)
    }

    const { data: criticalFailures, error } = await query.order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: criticalFailures || [],
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch critical failures"), { status: 500 })
  }
}

/**
 * POST /api/trips/[tripId]/critical-failures - Create new critical failure
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
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
    if (!body.description || !body.points) {
      return NextResponse.json({ 
        success: false, 
        error: "Description and points are required" 
      }, { status: 400 })
    }

    // Get current user's role
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Verify trip access
    const { data: trip } = await supabase
      .from("trips")
      .select("id, user_id, org_id, status")
      .eq("id", tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check permissions
    const canCreate = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && trip.user_id === user.id) ||
      (currentUser.role === "supervisor" && trip.org_id === currentUser.org_id)

    if (!canCreate) {
      return NextResponse.json({ 
        success: false, 
        error: "Insufficient permissions to create critical failure" 
      }, { status: 403 })
    }

    // If module_item_id is provided, verify it belongs to this trip
    if (body.module_item_id) {
      const { data: moduleItem } = await supabase
        .from("module_items")
        .select(`
          id,
          trip_modules:module_id (
            trip_id
          )
        `)
        .eq("id", body.module_item_id)
        .single()

      if (!moduleItem || moduleItem.trip_modules.trip_id !== tripId) {
        return NextResponse.json({ 
          success: false, 
          error: "Module item not found or doesn't belong to this trip" 
        }, { status: 404 })
      }
    }

    // Create critical failure
    const { data: newCriticalFailure, error } = await supabase
      .from("critical_failures")
      .insert({
        trip_id: tripId,
        module_item_id: body.module_item_id || null,
        description: body.description,
        points: body.points,
        resolved: false,
      })
      .select()
      .single()

    if (error) throw error

    // Update trip risk level if critical
    if (body.points >= 5) {
      await supabase
        .from("trips")
        .update({ 
          risk_level: "critical",
          critical_override: true 
        })
        .eq("id", tripId)
    }

    // Log action
    await auditLog(user.id, tripId, "critical_failure_created", { 
      failureId: newCriticalFailure.id,
      description: body.description,
      points: body.points,
      moduleItemId: body.module_item_id 
    })

    return NextResponse.json({
      success: true,
      data: newCriticalFailure,
      message: "Critical failure created successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create critical failure"), { status: 500 })
  }
}
