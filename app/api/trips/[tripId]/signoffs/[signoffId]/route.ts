import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ tripId: string; signoffId: string }>
}

/**
 * GET /api/trips/[tripId]/signoffs/[signoffId] - Fetch specific sign-off
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { tripId, signoffId } = await params
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

    // Fetch specific sign-off
    const { data: signoff, error } = await supabase
      .from("sign_offs")
      .select("*")
      .eq("id", signoffId)
      .eq("trip_id", tripId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Sign-off not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data: signoff,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch sign-off"), { status: 500 })
  }
}

/**
 * PUT /api/trips/[tripId]/signoffs/[signoffId] - Update sign-off (admin only)
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { tripId, signoffId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "approve")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const body = await req.json()

    // Check admin permissions
    const { data: currentUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ 
        success: false, 
        error: "Only admins can update sign-offs" 
      }, { status: 403 })
    }

    // Verify sign-off exists
    const { data: existingSignoff } = await supabase
      .from("sign_offs")
      .select("*")
      .eq("id", signoffId)
      .eq("trip_id", tripId)
      .single()

    if (!existingSignoff) {
      return NextResponse.json({ success: false, error: "Sign-off not found" }, { status: 404 })
    }

    // Update sign-off
    const { data: updatedSignoff, error } = await supabase
      .from("sign_offs")
      .update({
        name: body.name,
        signature: body.signature,
        signed_at: body.signed_at || existingSignoff.signed_at,
      })
      .eq("id", signoffId)
      .eq("trip_id", tripId)
      .select()
      .single()

    if (error) throw error

    // Log action
    await auditLog(user.id, tripId, "sign_off_updated", { 
      signoffId,
      changes: body 
    })

    return NextResponse.json({
      success: true,
      data: updatedSignoff,
      message: "Sign-off updated successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to update sign-off"), { status: 500 })
  }
}

/**
 * DELETE /api/trips/[tripId]/signoffs/[signoffId] - Delete sign-off (admin only)
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { tripId, signoffId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "approve")
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
        error: "Only admins can delete sign-offs" 
      }, { status: 403 })
    }

    // Verify sign-off exists
    const { data: existingSignoff } = await supabase
      .from("sign_offs")
      .select("role")
      .eq("id", signoffId)
      .eq("trip_id", tripId)
      .single()

    if (!existingSignoff) {
      return NextResponse.json({ success: false, error: "Sign-off not found" }, { status: 404 })
    }

    // Delete sign-off
    const { error } = await supabase
      .from("sign_offs")
      .delete()
      .eq("id", signoffId)
      .eq("trip_id", tripId)

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Sign-off not found" }, { status: 404 })
      }
      throw error
    }

    // Update trip status if supervisor sign-off was deleted
    if (existingSignoff.role === "supervisor") {
      await supabase
        .from("trips")
        .update({ status: "submitted" })
        .eq("id", tripId)
    }

    // Log action
    await auditLog(user.id, tripId, "sign_off_deleted", { 
      signoffId,
      role: existingSignoff.role 
    })

    return NextResponse.json({
      success: true,
      message: "Sign-off deleted successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to delete sign-off"), { status: 500 })
  }
}
