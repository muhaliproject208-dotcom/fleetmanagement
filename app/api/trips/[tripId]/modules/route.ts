import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ tripId: string }>
}

/**
 * GET /api/trips/[tripId]/modules - Fetch modules for a specific trip
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

    // Check trip access permissions
    let tripQuery = supabase.from("trips").select("id, user_id, org_id").eq("id", tripId)
    
    if (currentUser.role === "driver") {
      tripQuery = tripQuery.eq("user_id", user.id)
    } else if (currentUser.role === "supervisor" || currentUser.role === "mechanic") {
      tripQuery = tripQuery.eq("org_id", currentUser.org_id)
    }
    // Admins see all

    const { data: trip, error: tripError } = await tripQuery.single()
    if (tripError || !trip) {
      return NextResponse.json({ success: false, error: "Trip not found or access denied" }, { status: 404 })
    }

    // Fetch modules
    let query = supabase.from("trip_modules").select("*").eq("trip_id", tripId)
    
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
      `).eq("trip_id", tripId)
    }

    const { data: modules, error } = await query.order("step", { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: modules,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch modules"), { status: 500 })
  }
}

/**
 * POST /api/trips/[tripId]/modules - Create new module for trip
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

    // Get current user's role
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check permissions - only drivers can create modules, or admins
    if (!["driver", "admin"].includes(currentUser.role)) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
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

    if (currentUser.role === "driver" && trip.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Validate required fields
    if (!body.name || !body.step) {
      return NextResponse.json({ success: false, error: "Module name and step are required" }, { status: 400 })
    }

    // Check if step already exists for this trip
    const { data: existingModule } = await supabase
      .from("trip_modules")
      .select("id")
      .eq("trip_id", tripId)
      .eq("step", body.step)
      .single()

    if (existingModule) {
      return NextResponse.json({ success: false, error: "Module step already exists" }, { status: 409 })
    }

    // Create module
    const { data: newModule, error } = await supabase
      .from("trip_modules")
      .insert({
        trip_id: tripId,
        name: body.name,
        step: body.step,
        score: 0,
        risk_level: "low",
        status: "incomplete",
      })
      .select()
      .single()

    if (error) throw error

    // Create module items if provided
    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        await supabase.from("module_items").insert({
          module_id: newModule.id,
          label: item.label,
          field_type: item.field_type,
          critical: item.critical || false,
          points: item.points || 1,
          value: item.value || null,
        })
      }
    }

    // Log action
    await auditLog(user.id, tripId, "module_created", { 
      moduleId: newModule.id,
      name: body.name,
      step: body.step 
    })

    return NextResponse.json({
      success: true,
      data: newModule,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create module"), { status: 500 })
  }
}
