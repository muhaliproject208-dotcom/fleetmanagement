import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ tripId: string; moduleId: string }>
}

/**
 * GET /api/trips/[tripId]/modules/[moduleId] - Fetch specific module
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { tripId, moduleId } = await params
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
    const includeItems = searchParams.get("include_items") === "true"

    // Get current user's role and verify trip access
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Verify trip access
    let tripQuery = supabase.from("trips").select("id, user_id, org_id").eq("id", tripId)
    
    if (currentUser.role === "driver") {
      tripQuery = tripQuery.eq("user_id", user.id)
    } else if (currentUser.role === "supervisor" || currentUser.role === "mechanic") {
      tripQuery = tripQuery.eq("org_id", currentUser.org_id)
    }

    const { data: trip, error: tripError } = await tripQuery.single()
    if (tripError || !trip) {
      return NextResponse.json({ success: false, error: "Trip not found or access denied" }, { status: 404 })
    }

    // Fetch module
    let query = supabase.from("trip_modules").select("*").eq("id", moduleId).eq("trip_id", tripId)
    
    if (includeItems) {
      query = supabase.from("trip_modules").select(`
        *,
        module_items (
          id,
          label,
          field_type,
          critical,
          points,
          value,
          remarks
        )
      `).eq("id", moduleId).eq("trip_id", tripId)
    }

    const { data: module, error } = await query.single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Module not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data: module,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch module"), { status: 500 })
  }
}

/**
 * PUT /api/trips/[tripId]/modules/[moduleId] - Update module
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { tripId, moduleId } = await params
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
    const canEdit = 
      (currentUser.role === "driver" && trip.user_id === user.id) ||
      ["admin", "supervisor"].includes(currentUser.role)

    if (!canEdit) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Prevent editing if trip is submitted/approved (except for admins)
    if (!["admin"].includes(currentUser.role) && !["draft"].includes(trip.status)) {
      return NextResponse.json({ success: false, error: "Cannot edit module in submitted trip" }, { status: 400 })
    }

    // Update module
    const { data: updatedModule, error } = await supabase
      .from("trip_modules")
      .update({
        name: body.name,
        score: body.score,
        risk_level: body.risk_level,
        status: body.status,
      })
      .eq("id", moduleId)
      .eq("trip_id", tripId)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Module not found" }, { status: 404 })
      }
      throw error
    }

    // Update module items if provided
    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        if (item.id) {
          // Update existing item
          await supabase.from("module_items").update({
            label: item.label,
            field_type: item.field_type,
            critical: item.critical,
            points: item.points,
            value: item.value,
            remarks: item.remarks,
          }).eq("id", item.id).eq("module_id", moduleId)
        } else {
          // Create new item
          await supabase.from("module_items").insert({
            module_id: moduleId,
            label: item.label,
            field_type: item.field_type,
            critical: item.critical || false,
            points: item.points || 1,
            value: item.value || null,
            remarks: item.remarks,
          })
        }
      }
    }

    // Log action
    await auditLog(user.id, tripId, "module_updated", { 
      moduleId,
      changes: body 
    })

    return NextResponse.json({
      success: true,
      data: updatedModule,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to update module"), { status: 500 })
  }
}

/**
 * DELETE /api/trips/[tripId]/modules/[moduleId] - Delete module
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { tripId, moduleId } = await params
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

    // Get current user's role
    const { data: currentUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!currentUser || !["admin", "driver"].includes(currentUser.role)) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify trip access
    const { data: trip } = await supabase
      .from("trips")
      .select("id, user_id, status")
      .eq("id", tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    if (currentUser.role === "driver" && trip.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Prevent deletion if trip is submitted/approved (except for admins)
    if (!["admin"].includes(currentUser.role) && !["draft"].includes(trip.status)) {
      return NextResponse.json({ success: false, error: "Cannot delete module in submitted trip" }, { status: 400 })
    }

    // Delete module (cascade will handle module items)
    const { error } = await supabase
      .from("trip_modules")
      .delete()
      .eq("id", moduleId)
      .eq("trip_id", tripId)

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Module not found" }, { status: 404 })
      }
      throw error
    }

    // Log action
    await auditLog(user.id, tripId, "module_deleted", { moduleId })

    return NextResponse.json({
      success: true,
      message: "Module deleted successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to delete module"), { status: 500 })
  }
}
