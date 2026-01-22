import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ tripId: string }>
}

/**
 * GET /api/trips/[tripId]/signoffs - Fetch sign-offs for a trip
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

    // Fetch sign-offs
    const { data: signoffs, error } = await supabase
      .from("sign_offs")
      .select("*")
      .eq("trip_id", tripId)
      .order("signed_at", { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: signoffs || [],
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch sign-offs"), { status: 500 })
  }
}

/**
 * POST /api/trips/[tripId]/signoffs - Create new sign-off
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
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

    // Validate required fields
    if (!body.role || !body.name || !body.signature) {
      return NextResponse.json({ 
        success: false, 
        error: "Role, name, and signature are required" 
      }, { status: 400 })
    }

    // Validate role
    const validRoles = ["driver", "supervisor", "mechanic"]
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 })
    }

    // Get current user's role and profile
    const { data: currentUser } = await supabase
      .from("users")
      .select(`
        role,
        org_id,
        profiles:user_id (
          full_name
        )
      `)
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Verify trip access
    const { data: trip } = await supabase
      .from("trips")
      .select("id, user_id, org_id, status, aggregate_score, risk_level")
      .eq("id", tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check if user can sign off for this role
    const canSign = 
      (body.role === "driver" && currentUser.role === "driver" && trip.user_id === user.id) ||
      (body.role === "supervisor" && currentUser.role === "supervisor" && trip.org_id === currentUser.org_id) ||
      (body.role === "mechanic" && currentUser.role === "mechanic" && trip.org_id === currentUser.org_id) ||
      currentUser.role === "admin"

    if (!canSign) {
      return NextResponse.json({ 
        success: false, 
        error: "You cannot sign off for this role" 
      }, { status: 403 })
    }

    // Check if sign-off already exists for this role
    const { data: existingSignoff } = await supabase
      .from("sign_offs")
      .select("id")
      .eq("trip_id", tripId)
      .eq("role", body.role)
      .single()

    if (existingSignoff) {
      return NextResponse.json({ 
        success: false, 
        error: "Sign-off already exists for this role" 
      }, { status: 409 })
    }

    // Additional validation for supervisor sign-offs
    if (body.role === "supervisor" && trip.status !== "submitted") {
      return NextResponse.json({ 
        success: false, 
        error: "Trip must be submitted before supervisor sign-off" 
      }, { status: 400 })
    }

    // Create sign-off
    const { data: newSignoff, error } = await supabase
      .from("sign_offs")
      .insert({
        trip_id: tripId,
        role: body.role,
        name: body.name,
        signature: body.signature,
        signed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Update trip status if all required sign-offs are complete
    if (body.role === "supervisor") {
      await supabase
        .from("trips")
        .update({ 
          status: "approved",
          approved_at: new Date().toISOString()
        })
        .eq("id", tripId)
    }

    // Log action
    await auditLog(user.id, tripId, "sign_off_created", { 
      signoffId: newSignoff.id,
      role: body.role,
      name: body.name 
    })

    return NextResponse.json({
      success: true,
      data: newSignoff,
      message: "Sign-off created successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create sign-off"), { status: 500 })
  }
}
