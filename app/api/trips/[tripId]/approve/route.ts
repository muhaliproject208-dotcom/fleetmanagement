import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError, auditLog, checkPermission } from "@/lib/api-helpers"

/**
 * POST /api/trips/[tripId]/approve - Approve trip
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const supabase = await getSupabaseServer()
    const { tripId } = await params

    // Check user role
    const { data: userData } = await supabase.from("users").select("role, org_id").eq("id", user.id).single()

    const hasPermission = await checkPermission(user.id, userData?.role, "trip", "approve")
    if (!hasPermission) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Get trip
    const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    if (trip.status !== "submitted") {
      return NextResponse.json({ success: false, error: "Trip is not pending approval" }, { status: 400 })
    }

    // Update trip status
    const { data: updated, error } = await supabase
      .from("trips")
      .update({
        status: body.approved ? "approved" : "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .select()
      .single()

    if (error) throw error

    // Create sign-off record
    await supabase.from("sign_offs").insert({
      trip_id: tripId,
      role: userData?.role,
      name: body.approver_name,
      signature: body.signature || "",
      signed_at: new Date().toISOString(),
    })

    await auditLog(user.id, tripId, `trip_${body.approved ? "approved" : "rejected"}`, {
      approver_role: userData?.role,
      notes: body.notes,
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Trip ${body.approved ? "approved" : "rejected"}`,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to approve trip"), { status: 500 })
  }
}
