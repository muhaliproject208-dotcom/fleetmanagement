import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/users/[id] - Fetch specific user
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
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

    // Check permissions
    const hasPermission = await checkPermission(user.id, currentUser.role, "user", "view")
    if (!hasPermission && id !== user.id) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Fetch user with profile
    const { data: userData, error } = await supabase
      .from("users")
      .select(`
        *,
        profiles:user_id (
          full_name,
          phone,
          license_number,
          vehicle_id,
          vehicle_plate
        )
      `)
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
      }
      throw error
    }

    // Additional org-based filtering for non-admins
    if (!["admin", "org_admin"].includes(currentUser.role) && 
        currentUser.org_id !== userData.org_id && 
        id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: userData,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch user"), { status: 500 })
  }
}

/**
 * PUT /api/users/[id] - Update user
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
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

    // Check permissions - users can update themselves, admins can update others
    const canUpdate = id === user.id || await checkPermission(user.id, currentUser.role, "user", "edit")
    if (!canUpdate) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Prevent role changes unless admin
    if (body.role && !["admin", "org_admin"].includes(currentUser.role)) {
      delete body.role
    }

    // Update user
    const { data: updatedUser, error } = await supabase
      .from("users")
      .update(body)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
      }
      throw error
    }

    // Update profile if provided
    if (body.profile) {
      await supabase
        .from("profiles")
        .upsert({
          user_id: id,
          ...body.profile,
        })
    }

    // Log action
    await auditLog(user.id, null, "user_updated", { 
      userId: id, 
      changes: body 
    })

    return NextResponse.json({
      success: true,
      data: updatedUser,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to update user"), { status: 500 })
  }
}

/**
 * DELETE /api/users/[id] - Delete user (admin only)
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
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

    // Check permissions
    const { data: currentUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!currentUser || !["admin"].includes(currentUser.role)) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Prevent self-deletion
    if (id === user.id) {
      return NextResponse.json({ success: false, error: "Cannot delete your own account" }, { status: 400 })
    }

    // Delete user (cascade will handle profile)
    const { error } = await supabase.from("users").delete().eq("id", id)

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
      }
      throw error
    }

    // Log action
    await auditLog(user.id, null, "user_deleted", { userId: id })

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to delete user"), { status: 500 })
  }
}
