import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError, auditLog, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/trips/draft - Fetch user's draft
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
    const tripId = searchParams.get("trip_id")

    // Get user's role and org
    const { data: userData } = await supabase.from("users").select("role, org_id").eq("id", user.id).single()

    if (!userData) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    let query = supabase.from("trip_drafts").select("*")

    if (tripId) {
      // Fetch specific draft for a trip
      const { data: trip } = await supabase.from("trips").select("user_id, org_id").eq("id", tripId).single()
      
      if (!trip) {
        return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
      }

      // Check access permissions
      const hasAccess = 
        userData.role === "admin" ||
        (userData.role === "driver" && trip.user_id === user.id) ||
        ((userData.role === "supervisor" || userData.role === "mechanic") && trip.org_id === userData.org_id)

      if (!hasAccess) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
      }

      query = query.eq("trip_id", tripId)
    } else {
      // Fetch user's own drafts
      query = query.eq("user_id", user.id)
    }

    const { data: drafts, error } = await query.order("saved_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: drafts || [],
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch drafts"), { status: 500 })
  }
}

/**
 * POST /api/trips/draft - Save draft
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

    // Validate required fields
    if (!body.draft_data || typeof body.draft_data !== "object") {
      return NextResponse.json({ success: false, error: "Draft data is required and must be an object" }, { status: 400 })
    }

    // Get user's role and org
    const { data: userData } = await supabase.from("users").select("role, org_id").eq("id", user.id).single()

    if (!userData) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // If trip_id is provided, verify access
    if (body.trip_id) {
      const { data: trip } = await supabase.from("trips").select("user_id, org_id, status").eq("id", body.trip_id).single()
      
      if (!trip) {
        return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
      }

      // Check if user can save draft for this trip
      const canSave = 
        userData.role === "admin" ||
        (userData.role === "driver" && trip.user_id === user.id && ["draft", "submitted"].includes(trip.status))

      if (!canSave) {
        return NextResponse.json({ success: false, error: "Cannot save draft for this trip" }, { status: 403 })
      }
    }

    // Check for existing draft
    const { data: existing } = await supabase
      .from("trip_drafts")
      .select("*")
      .eq("user_id", user.id)
      .eq("trip_id", body.trip_id || null)
      .single()

    let result

    if (existing) {
      // Update existing draft
      const { data, error } = await supabase
        .from("trip_drafts")
        .update({
          draft_data: body.draft_data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // Create new draft
      const { data, error } = await supabase
        .from("trip_drafts")
        .insert({
          user_id: user.id,
          org_id: userData.org_id,
          trip_id: body.trip_id || null,
          draft_data: body.draft_data,
        })
        .select()
        .single()

      if (error) throw error
      result = data
    }

    // Log action
    await auditLog(user.id, body.trip_id || null, "draft_saved", {
      draftId: result.id,
      fieldCount: Object.keys(body.draft_data).length,
      tripId: body.trip_id,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: "Draft saved successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to save draft"), { status: 500 })
  }
}

/**
 * DELETE /api/trips/draft - Delete draft
 */
export async function DELETE(req: NextRequest) {
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
    const draftId = searchParams.get("draft_id")
    const tripId = searchParams.get("trip_id")

    if (!draftId && !tripId) {
      return NextResponse.json({ success: false, error: "Draft ID or Trip ID is required" }, { status: 400 })
    }

    // Get user's role
    const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

    if (!userData) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    let query = supabase.from("trip_drafts").delete()

    if (draftId) {
      // Delete specific draft by ID
      const { data: draft } = await supabase.from("trip_drafts").select("user_id").eq("id", draftId).single()
      
      if (!draft) {
        return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 })
      }

      // Check permissions
      if (userData.role !== "admin" && draft.user_id !== user.id) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
      }

      query = query.eq("id", draftId)
    } else {
      // Delete drafts by trip ID
      if (userData.role !== "admin") {
        query = query.eq("user_id", user.id)
      }
      query = query.eq("trip_id", tripId)
    }

    const { error } = await query

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 })
      }
      throw error
    }

    // Log action
    await auditLog(user.id, tripId || null, "draft_deleted", { 
      draftId,
      tripId 
    })

    return NextResponse.json({
      success: true,
      message: "Draft deleted successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to delete draft"), { status: 500 })
  }
}
