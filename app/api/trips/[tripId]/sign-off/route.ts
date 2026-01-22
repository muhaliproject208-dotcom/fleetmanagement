import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError, auditLog } from "@/lib/api-helpers"

/**
 * POST /api/trips/[tripId]/sign-off - Add digital signature
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

    // Get user role
    const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

    // Create sign-off
    const { data: signOff, error } = await supabase
      .from("sign_offs")
      .insert({
        trip_id: tripId,
        role: userData?.role,
        name: body.name,
        signature: body.signature, // Base64 or URL
        signed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    await auditLog(user.id, tripId, "sign_off_added", {
      role: userData?.role,
      signer_name: body.name,
    })

    return NextResponse.json({
      success: true,
      data: signOff,
      message: "Signature recorded",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to record signature"), { status: 500 })
  }
}
