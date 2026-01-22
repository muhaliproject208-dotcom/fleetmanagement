import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/profiles - Fetch profiles based on role permissions
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
    const userId = searchParams.get("user_id")

    // Get current user's role
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    let query = supabase
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

    // Filter based on role and permissions
    if (userId) {
      // Fetching specific profile
      const hasPermission = await checkPermission(user.id, currentUser.role, "profile", "view")
      if (!hasPermission && userId !== user.id) {
        return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
      }
      query = query.eq("user_id", userId)
    } else {
      // Listing profiles
      if (currentUser.role === "driver") {
        query = query.eq("user_id", user.id) // Drivers can only see themselves
      } else if (currentUser.role === "supervisor" || currentUser.role === "mechanic") {
        query = query.in("user_id", 
          supabase.from("users").select("id").eq("org_id", currentUser.org_id)
        ) // See org profiles
      }
      // Admins see all profiles
    }

    const { data: profiles, error } = await query.order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: profiles,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch profiles"), { status: 500 })
  }
}

/**
 * POST /api/profiles - Create new profile
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
    if (!body.user_id) {
      return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 })
    }

    // Check permissions - users can create their own profile, admins can create for others
    const { data: currentUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const canCreate = body.user_id === user.id || await checkPermission(user.id, currentUser.role, "profile", "create")
    if (!canCreate) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Check if user exists
    const { data: userExists } = await supabase
      .from("users")
      .select("id")
      .eq("id", body.user_id)
      .single()

    if (!userExists) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Create profile
    const { data: newProfile, error } = await supabase
      .from("profiles")
      .insert({
        user_id: body.user_id,
        full_name: body.full_name,
        phone: body.phone,
        license_number: body.license_number,
        vehicle_id: body.vehicle_id,
        vehicle_plate: body.vehicle_plate,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: false, error: "Profile already exists for this user" }, { status: 409 })
      }
      throw error
    }

    // Log action
    await auditLog(user.id, null, "profile_created", { 
      userId: body.user_id,
      fullName: body.full_name 
    })

    return NextResponse.json({
      success: true,
      data: newProfile,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create profile"), { status: 500 })
  }
}
