import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ moduleId: string }>
}

/**
 * GET /api/modules/[moduleId]/items - Fetch items for a specific module
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { moduleId } = await params
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

    // Verify module access through trip
    const { data: module } = await supabase
      .from("trip_modules")
      .select(`
        *,
        trips:trip_id (
          id,
          user_id,
          org_id
        )
      `)
      .eq("id", moduleId)
      .single()

    if (!module) {
      return NextResponse.json({ success: false, error: "Module not found" }, { status: 404 })
    }

    // Check access permissions
    const hasAccess = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && module.trips.user_id === user.id) ||
      ((currentUser.role === "supervisor" || currentUser.role === "mechanic") && 
       module.trips.org_id === currentUser.org_id)

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Fetch module items
    const { data: items, error } = await supabase
      .from("module_items")
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: items,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch module items"), { status: 500 })
  }
}

/**
 * POST /api/modules/[moduleId]/items - Create new item for module
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { moduleId } = await params
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

    // Verify module access through trip
    const { data: module } = await supabase
      .from("trip_modules")
      .select(`
        *,
        trips:trip_id (
          id,
          user_id,
          org_id,
          status
        )
      `)
      .eq("id", moduleId)
      .single()

    if (!module) {
      return NextResponse.json({ success: false, error: "Module not found" }, { status: 404 })
    }

    // Check permissions
    const canCreate = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && module.trips.user_id === user.id && module.trips.status === "draft")

    if (!canCreate) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Validate required fields
    if (!body.label || !body.field_type) {
      return NextResponse.json({ success: false, error: "Label and field_type are required" }, { status: 400 })
    }

    // Validate field_type
    const validFieldTypes = ["checkbox", "radio", "text", "textarea", "number", "select", "passfailna", "date"]
    if (!validFieldTypes.includes(body.field_type)) {
      return NextResponse.json({ success: false, error: "Invalid field_type" }, { status: 400 })
    }

    // Create module item
    const { data: newItem, error } = await supabase
      .from("module_items")
      .insert({
        module_id: moduleId,
        label: body.label,
        field_type: body.field_type,
        critical: body.critical || false,
        points: body.points || 1,
        value: body.value || null,
        remarks: body.remarks || null,
      })
      .select()
      .single()

    if (error) throw error

    // Track critical failures if item is critical and failed
    if (body.critical && body.value === "fail") {
      await supabase.from("critical_failures").insert({
        trip_id: module.trip_id,
        module_item_id: newItem.id,
        description: `Critical item failed: ${body.label}`,
        points: body.points || 1,
        resolved: false,
      })
    }

    // Log action
    await auditLog(user.id, module.trip_id, "module_item_created", { 
      moduleId,
      itemId: newItem.id,
      label: body.label,
      critical: body.critical 
    })

    return NextResponse.json({
      success: true,
      data: newItem,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create module item"), { status: 500 })
  }
}
