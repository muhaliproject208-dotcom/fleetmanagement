import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission, calculateAggregateScore, getRiskLevelFromScore } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/trips - Fetch user's trips based on role
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
    const includeModules = searchParams.get("include_modules") === "true"

    // Fetch user role
    const { data: userData } = await supabase.from("users").select("role, org_id").eq("id", user.id).single()

    if (!userData) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    let query = supabase.from("trips").select(`
      *,
      profiles:user_id (
        full_name,
        vehicle_plate
      )
      ${includeModules ? `,
      trip_modules (
        id,
        name,
        step,
        score,
        risk_level,
        status,
        module_items (
          id,
          label,
          field_type,
          critical,
          points,
          value
        )
      )
      ` : ""}
    `)

    // Filter by role
    if (userData.role === "driver") {
      query = query.eq("user_id", user.id)
    } else if (userData.role === "supervisor" || userData.role === "mechanic") {
      query = query.eq("org_id", userData.org_id)
    }
    // admin sees all

    const { data: trips, error } = await query.order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: trips,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch trips"), { status: 500 })
  }
}

/**
 * POST /api/trips - Create new trip
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

    const body = await req.json()
    const supabase = await getSupabaseServer()

    // Get user role and org
    const { data: userData } = await supabase.from("users").select("role, org_id").eq("id", user.id).single()

    if (!userData || userData.role !== "driver") {
      return NextResponse.json({ success: false, error: "Only drivers can create trips" }, { status: 403 })
    }

    // Validate required fields
    if (!body.trip_date) {
      return NextResponse.json({ success: false, error: "Trip date is required" }, { status: 400 })
    }

    // Create trip
    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        org_id: userData.org_id,
        trip_date: body.trip_date,
        route: body.route,
        status: "draft",
        aggregate_score: 0,
        risk_level: "critical",
        critical_override: false,
      })
      .select()
      .single()

    if (error) throw error

    // Initialize trip modules if requested
    if (body.initialize_modules) {
      const moduleTemplates = [
        { name: "Driver Information", step: 1 },
        { name: "Health & Fitness", step: 2 },
        { name: "Trip Documentation", step: 3 },
        { name: "Vehicle Checklist", step: 4 },
        { name: "Functional Checks", step: 5 },
        { name: "Post-Trip Evaluation", step: 6 },
        { name: "Corrective Measures", step: 7 },
        { name: "Enforcement", step: 8 },
        { name: "Evaluation Summary", step: 9 },
        { name: "Final Aggregate", step: 10 },
        { name: "Sign-Off", step: 11 },
      ]

      for (const module of moduleTemplates) {
        await supabase.from("trip_modules").insert({
          trip_id: trip.id,
          name: module.name,
          step: module.step,
          score: 0,
          risk_level: "low",
          status: "incomplete",
        })
      }
    }

    // Log action
    await auditLog(user.id, trip.id, "trip_created", { 
      route: body.route,
      trip_date: body.trip_date 
    })

    return NextResponse.json({
      success: true,
      data: trip,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create trip"), { status: 500 })
  }
}
