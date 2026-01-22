import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/users - Fetch users based on role permissions
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
    const userId = searchParams.get("id")

    // Get current user's role
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    let query = supabase.from("users").select(`
      *,
      profiles:user_id (
        full_name,
        phone,
        license_number,
        vehicle_id,
        vehicle_plate
      )
    `)

    // Filter based on role and permissions
    if (userId) {
      // Fetching specific user
      const hasPermission = await checkPermission(user.id, currentUser.role, "user", "view")
      if (!hasPermission && userId !== user.id) {
        return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
      }
      query = query.eq("id", userId)
    } else {
      // Listing users
      if (currentUser.role === "driver") {
        query = query.eq("id", user.id) // Drivers can only see themselves
      } else if (currentUser.role === "supervisor" || currentUser.role === "mechanic") {
        query = query.eq("org_id", currentUser.org_id) // See org users
      }
      // Admins see all users
    }

    const { data: users, error } = await query.order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: users,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch users"), { status: 500 })
  }
}

/**
 * POST /api/users - Create new user (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "auth")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const body = await req.json()

    // Check permissions
    const { data: currentUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!currentUser || !["admin", "org_admin"].includes(currentUser.role)) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Validate required fields
    if (!body.email || !body.role) {
      return NextResponse.json({ success: false, error: "Email and role are required" }, { status: 400 })
    }

    // Create user
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        email: body.email,
        role: body.role,
        org_id: body.org_id || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: false, error: "Email already exists" }, { status: 409 })
      }
      throw error
    }

    // Create profile if provided
    if (body.profile) {
      await supabase.from("profiles").insert({
        user_id: newUser.id,
        ...body.profile,
      })
    }

    // Log action
    await auditLog(user.id, null, "user_created", { 
      userId: newUser.id, 
      email: body.email, 
      role: body.role 
    })

    return NextResponse.json({
      success: true,
      data: newUser,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create user"), { status: 500 })
  }
}
