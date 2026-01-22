import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ tripId: string; failureId: string }>
}

/**
 * GET /api/trips/[tripId]/critical-failures/[failureId] - Fetch specific critical failure
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { tripId, failureId } = await params
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

    // Fetch specific critical failure
    const { data: criticalFailure, error } = await supabase
      .from("critical_failures")
      .select(`
        *,
        module_items:module_item_id (
          id,
          label,
          field_type,
          points,
          value
        ),
        trip_modules:module_item_id!inner (
          id,
          name,
          step
        )
      `)
      .eq("id", failureId)
      .eq("trip_id", tripId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Critical failure not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data: criticalFailure,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch critical failure"), { status: 500 })
  }
}

/**
 * PUT /api/trips/[tripId]/critical-failures/[failureId] - Update critical failure
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { tripId, failureId } = await params
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
      .select("id, user_id, org_id")
      .eq("id", tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check permissions
    const canUpdate = 
      currentUser.role === "admin" ||
      (currentUser.role === "supervisor" && trip.org_id === currentUser.org_id) ||
      (currentUser.role === "driver" && trip.user_id === user.id && body.resolved === true)

    if (!canUpdate) {
      return NextResponse.json({ 
        success: false, 
        error: "Insufficient permissions to update critical failure" 
      }, { status: 403 })
    }

    // Get current critical failure
    const { data: existingFailure } = await supabase
      .from("critical_failures")
      .select("*")
      .eq("id", failureId)
      .eq("trip_id", tripId)
      .single()

    if (!existingFailure) {
      return NextResponse.json({ success: false, error: "Critical failure not found" }, { status: 404 })
    }

    // Update critical failure
    const { data: updatedFailure, error } = await supabase
      .from("critical_failures")
      .update({
        description: body.description,
        points: body.points,
        resolved: body.resolved,
      })
      .eq("id", failureId)
      .eq("trip_id", tripId)
      .select()
      .single()

    if (error) throw error

    // If resolving a critical failure, check if all are resolved
    if (body.resolved && !existingFailure.resolved) {
      const { data: unresolvedFailures } = await supabase
        .from("critical_failures")
        .select("id")
        .eq("trip_id", tripId)
        .eq("resolved", false)

      // If no more unresolved critical failures, update trip risk level
      if (!unresolvedFailures || unresolvedFailures.length === 0) {
        // Recalculate trip risk level based on remaining factors
        await supabase
          .from("trips")
          .update({ 
            critical_override: false 
          })
          .eq("id", tripId)
      }
    }

    // Log action
    await auditLog(user.id, tripId, "critical_failure_updated", { 
      failureId,
      changes: body 
    })

    return NextResponse.json({
      success: true,
      data: updatedFailure,
      message: "Critical failure updated successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to update critical failure"), { status: 500 })
  }
}

/**
 * DELETE /api/trips/[tripId]/critical-failures/[failureId] - Delete critical failure (admin only)
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { tripId, failureId } = await params
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

    // Check admin permissions
    const { data: currentUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ 
        success: false, 
        error: "Only admins can delete critical failures" 
      }, { status: 403 })
    }

    // Verify critical failure exists
    const { data: existingFailure } = await supabase
      .from("critical_failures")
      .select("points")
      .eq("id", failureId)
      .eq("trip_id", tripId)
      .single()

    if (!existingFailure) {
      return NextResponse.json({ success: false, error: "Critical failure not found" }, { status: 404 })
    }

    // Delete critical failure
    const { error } = await supabase
      .from("critical_failures")
      .delete()
      .eq("id", failureId)
      .eq("trip_id", tripId)

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Critical failure not found" }, { status: 404 })
      }
      throw error
    }

    // Check if any critical failures remain
    const { data: remainingFailures } = await supabase
      .from("critical_failures")
      .select("id")
      .eq("trip_id", tripId)

    // If no more critical failures, remove critical override
    if (!remainingFailures || remainingFailures.length === 0) {
      await supabase
        .from("trips")
        .update({ 
          critical_override: false 
        })
        .eq("id", tripId)
    }

    // Log action
    await auditLog(user.id, tripId, "critical_failure_deleted", { 
      failureId,
      points: existingFailure.points 
    })

    return NextResponse.json({
      success: true,
      message: "Critical failure deleted successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to delete critical failure"), { status: 500 })
  }
}
