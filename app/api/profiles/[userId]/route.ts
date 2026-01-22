import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ userId: string }>
}

/**
 * GET /api/profiles/[userId] - Fetch specific user's profile
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await params
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
    const hasPermission = await checkPermission(user.id, currentUser.role, "profile", "view")
    if (!hasPermission && userId !== user.id) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Fetch profile with user info
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(`
        *,
        users:user_id (
          id,
          email,
          role,
          org_id,
          created_at
        )
      `)
      .eq("user_id", userId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 })
      }
      throw error
    }

    // Additional org-based filtering for non-admins
    if (!["admin", "org_admin"].includes(currentUser.role) && 
        profile.users.org_id !== currentUser.org_id && 
        userId !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: profile,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch profile"), { status: 500 })
  }
}

/**
 * PUT /api/profiles/[userId] - Update profile
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await params
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
    const canUpdate = userId === user.id || await checkPermission(user.id, currentUser.role, "profile", "edit")
    if (!canUpdate) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Update profile
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update({
        full_name: body.full_name,
        phone: body.phone,
        license_number: body.license_number,
        vehicle_id: body.vehicle_id,
        vehicle_plate: body.vehicle_plate,
      })
      .eq("user_id", userId)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 })
      }
      throw error
    }

    // Log action
    await auditLog(user.id, null, "profile_updated", { 
      userId, 
      changes: body 
    })

    return NextResponse.json({
      success: true,
      data: updatedProfile,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to update profile"), { status: 500 })
  }
}

/**
 * DELETE /api/profiles/[userId] - Delete profile (admin only)
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await params
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
    if (userId === user.id) {
      return NextResponse.json({ success: false, error: "Cannot delete your own profile" }, { status: 400 })
    }

    // Delete profile
    const { error } = await supabase.from("profiles").delete().eq("user_id", userId)

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 })
      }
      throw error
    }

    // Log action
    await auditLog(user.id, null, "profile_deleted", { userId })

    return NextResponse.json({
      success: true,
      message: "Profile deleted successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to delete profile"), { status: 500 })
  }
}
