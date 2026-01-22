import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ moduleId: string; itemId: string }>
}

/**
 * GET /api/modules/[moduleId]/items/[itemId] - Fetch specific module item
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { moduleId, itemId } = await params
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

    // Fetch module item
    const { data: item, error } = await supabase
      .from("module_items")
      .select("*")
      .eq("id", itemId)
      .eq("module_id", moduleId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Module item not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch module item"), { status: 500 })
  }
}

/**
 * PUT /api/modules/[moduleId]/items/[itemId] - Update module item
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { moduleId, itemId } = await params
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
    const canEdit = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && module.trips.user_id === user.id && module.trips.status === "draft") ||
      (currentUser.role === "supervisor" && module.trips.org_id === currentUser.org_id)

    if (!canEdit) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Get current item to check if it's critical
    const { data: currentItem } = await supabase
      .from("module_items")
      .select("critical, value")
      .eq("id", itemId)
      .eq("module_id", moduleId)
      .single()

    if (!currentItem) {
      return NextResponse.json({ success: false, error: "Module item not found" }, { status: 404 })
    }

    // Update module item
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const { data: updatedItem, error } = await supabase
      .from("module_items")
      .update({
        label: body.label,
        field_type: body.field_type,
        critical: body.critical,
        points: body.points,
        value: body.value,
        remarks: body.remarks,
      })
      .eq("id", itemId)
      .eq("module_id", moduleId)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Module item not found" }, { status: 404 })
      }
      throw error
    }

    // Handle critical failures
    if (body.critical && body.value === "fail" && currentItem.value !== "fail") {
      // New critical failure
      await supabase.from("critical_failures").insert({
        trip_id: module.trip_id,
        module_item_id: itemId,
        description: `Critical item failed: ${body.label}`,
        points: body.points || 1,
        resolved: false,
      })
    } else if (body.critical && body.value !== "fail" && currentItem.value === "fail") {
      // Resolve critical failure
      await supabase
        .from("critical_failures")
        .update({ resolved: true })
        .eq("module_item_id", itemId)
        .eq("resolved", false)
    }

    // Log action
    await auditLog(user.id, module.trip_id, "module_item_updated", { 
      moduleId,
      itemId,
      changes: body 
    })

    return NextResponse.json({
      success: true,
      data: updatedItem,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to update module item"), { status: 500 })
  }
}

/**
 * DELETE /api/modules/[moduleId]/items/[itemId] - Delete module item
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { moduleId, itemId } = await params
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
      .select("role")
      .eq("id", user.id)
      .single()

    if (!currentUser || !["admin", "driver"].includes(currentUser.role)) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify module access through trip
    const { data: module } = await supabase
      .from("trip_modules")
      .select(`
        *,
        trips:trip_id (
          id,
          user_id,
          status
        )
      `)
      .eq("id", moduleId)
      .single()

    if (!module) {
      return NextResponse.json({ success: false, error: "Module not found" }, { status: 404 })
    }

    if (currentUser.role === "driver" && (module.trips.user_id !== user.id || module.trips.status !== "draft")) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Delete module item
    const { error } = await supabase
      .from("module_items")
      .delete()
      .eq("id", itemId)
      .eq("module_id", moduleId)

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: false, error: "Module item not found" }, { status: 404 })
      }
      throw error
    }

    // Clean up any related critical failures
    await supabase
      .from("critical_failures")
      .delete()
      .eq("module_item_id", itemId)

    // Log action
    await auditLog(user.id, module.trip_id, "module_item_deleted", { 
      moduleId,
      itemId 
    })

    return NextResponse.json({
      success: true,
      message: "Module item deleted successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to delete module item"), { status: 500 })
  }
}
