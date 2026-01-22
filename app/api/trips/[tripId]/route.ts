import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError, auditLog } from "@/lib/api-helpers"

/**
 * GET /api/trips/[tripId] - Fetch specific trip
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await getSupabaseServer()
    const { tripId } = await params

    // Fetch trip with modules
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select(`
        *,
        trip_modules(*)
      `)
      .eq("id", tripId)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check permission
    const { data: userData } = await supabase.from("users").select("role, org_id").eq("id", user.id).single()

    if (userData?.role === "driver" && trip.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    if ((userData?.role === "supervisor" || userData?.role === "mechanic") && trip.org_id !== userData.org_id) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: trip,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch trip"), { status: 500 })
  }
}

/**
 * PATCH /api/trips/[tripId] - Update trip
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const supabase = await getSupabaseServer()
    const { tripId } = await params

    // Get trip
    const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check permission
    if (trip.user_id !== user.id && trip.status !== "submitted") {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Update trip
    const { data: updated, error } = await supabase
      .from("trips")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .select()
      .single()

    if (error) throw error

    await auditLog(user.id, tripId, "trip_updated", body)

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to update trip"), { status: 500 })
  }
}
