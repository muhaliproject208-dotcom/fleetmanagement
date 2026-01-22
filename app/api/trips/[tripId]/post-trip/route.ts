import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ tripId: string }>
}

/**
 * GET /api/trips/[tripId]/post-trip - Get post-trip inspection data
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "post_trip")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const includeItems = searchParams.get("include_items") === "true"
    const includeFuel = searchParams.get("include_fuel") === "true"

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
    let tripQuery = supabase.from("trips").select("id, driver_id, org_id, status, vehicle_id").eq("id", tripId)
    
    if (currentUser.role === "driver") {
      tripQuery = tripQuery.eq("driver_id", user.id)
    } else if (["supervisor", "mechanic", "org_admin"].includes(currentUser.role)) {
      tripQuery = tripQuery.eq("org_id", currentUser.org_id)
    }
    // Admins see all

    const { data: trip, error: tripError } = await tripQuery.single()
    if (tripError || !trip) {
      return NextResponse.json({ success: false, error: "Trip not found or access denied" }, { status: 404 })
    }

    const result: any = { tripId, tripStatus: trip.status }

    // Get post-trip inspection
    let inspectionQuery = supabase
      .from("post_trip_inspections")
      .select(`
        *,
        inspector:inspector_id (
          full_name,
          email
        )
      `)
      .eq("trip_id", tripId)

    if (includeItems) {
      inspectionQuery = supabase
        .from("post_trip_inspections")
        .select(`
          *,
          inspector:inspector_id (
            full_name,
            email
          ),
          post_trip_inspection_items (
            id,
            category,
            item_label,
            inspection_type,
            condition_status,
            measurement_value,
            measurement_unit,
            notes,
            photo_url,
            requires_maintenance,
            maintenance_priority,
            points_deducted,
            critical
          )
        `)
        .eq("trip_id", tripId)
    }

    const { data: inspection, error: inspectionError } = await inspectionQuery.single()

    if (inspectionError && inspectionError.code !== "PGRST116") {
      throw inspectionError
    }

    result.inspection = inspection

    // Get fuel tracking data
    if (includeFuel) {
      const { data: fuelData } = await supabase
        .from("fuel_tracking")
        .select("*")
        .eq("trip_id", tripId)
        .single()

      result.fuelTracking = fuelData
    }

    // Get trip summary for context
    const { data: tripSummary } = await supabase
      .from("trip_compliance_summary")
      .select("*")
      .eq("trip_id", tripId)
      .single()

    result.tripSummary = tripSummary

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch post-trip data"), { status: 500 })
  }
}

/**
 * POST /api/trips/[tripId]/post-trip - Create or update post-trip inspection
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "post_trip_create")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const body = await req.json()

    // Get current user's role and verify trip access
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check trip access and status
    const { data: trip } = await supabase
      .from("trips")
      .select("id, driver_id, org_id, status, vehicle_id")
      .eq("id", tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check permissions - drivers, mechanics, supervisors, and admins can create post-trip inspections
    const canCreateInspection = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && trip.driver_id === user.id) ||
      (["supervisor", "mechanic", "org_admin"].includes(currentUser.role) && trip.org_id === currentUser.org_id)

    if (!canCreateInspection) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Trip should be completed or in approved status for post-trip inspection
    if (!["completed", "approved"].includes(trip.status)) {
      return NextResponse.json({ 
        success: false, 
        error: "Trip must be completed or approved before post-trip inspection" 
      }, { status: 400 })
    }

    // Check if inspection already exists
    const { data: existingInspection } = await supabase
      .from("post_trip_inspections")
      .select("id")
      .eq("trip_id", tripId)
      .single()

    if (existingInspection) {
      return NextResponse.json({ 
        success: false, 
        error: "Post-trip inspection already exists. Use PUT to update." 
      }, { status: 409 })
    }

    // Calculate total score from inspection items
    let totalScore = 0
    let riskLevel = "low"

    if (body.inspectionItems && Array.isArray(body.inspectionItems)) {
      totalScore = body.inspectionItems.reduce((sum: number, item: { pointsDeducted?: number }) => {
        return sum + (item.pointsDeducted || 0)
      }, 0)

      // Determine risk level based on total score
      if (totalScore <= 3) {
        riskLevel = "low"
      } else if (totalScore <= 8) {
        riskLevel = "medium"
      } else {
        riskLevel = "high"
      }
    }

    // Create post-trip inspection
    const inspectionData = {
      trip_id: tripId,
      vehicle_id: trip.vehicle_id,
      driver_id: trip.driver_id,
      inspector_id: user.id,
      inspection_date: body.inspectionDate || new Date().toISOString(),
      journey_completion_verified: body.journeyCompletionVerified || false,
      total_distance_km: body.totalDistanceKm,
      fuel_consumed_liters: body.fuelConsumedLiters,
      average_fuel_consumption: body.averageFuelConsumption,
      engine_hours: body.engineHours,
      total_score: totalScore,
      risk_level: riskLevel,
      status: "in_progress",
      findings_summary: body.findingsSummary,
      recommendations: body.recommendations,
      next_maintenance_date: body.nextMaintenanceDate,
    }

    const { data: newInspection, error: inspectionError } = await supabase
      .from("post_trip_inspections")
      .insert(inspectionData)
      .select()
      .single()

    if (inspectionError) throw inspectionError

    // Create inspection items
    if (body.inspectionItems && Array.isArray(body.inspectionItems)) {
      const itemsData = body.inspectionItems.map((item: any) => ({
        inspection_id: newInspection.id,
        category: item.category,
        item_label: item.itemLabel,
        inspection_type: item.inspectionType,
        condition_status: item.conditionStatus,
        measurement_value: item.measurementValue,
        measurement_unit: item.measurementUnit,
        notes: item.notes,
        photo_url: item.photoUrl,
        requires_maintenance: item.requiresMaintenance || false,
        maintenance_priority: item.maintenancePriority || "low",
        points_deducted: item.pointsDeducted || 0,
        critical: item.critical || false,
      }))

      const { error: itemsError } = await supabase
        .from("post_trip_inspection_items")
        .insert(itemsData)

      if (itemsError) throw itemsError
    }

    // Create fuel tracking record
    if (body.fuelData) {
      const fuelData = {
        trip_id: tripId,
        vehicle_id: trip.vehicle_id,
        driver_id: trip.driver_id,
        fuel_type: body.fuelData.fuelType || "diesel",
        fuel_before_trip_liters: body.fuelData.fuelBeforeTrip,
        fuel_after_trip_liters: body.fuelData.fuelAfterTrip,
        fuel_added_during_trip: body.fuelData.fuelAddedDuringTrip || 0,
        total_fuel_consumed: body.fuelData.totalFuelConsumed,
        distance_km: body.fuelData.distanceKm,
        average_consumption_l_per_100km: body.fuelData.averageConsumption,
        fuel_cost: body.fuelData.fuelCost,
        fuel_station: body.fuelData.fuelStation,
        fuel_receipt_url: body.fuelData.fuelReceiptUrl,
        consumption_anomaly: body.fuelData.consumptionAnomaly || false,
        anomaly_reason: body.fuelData.anomalyReason,
      }

      await supabase.from("fuel_tracking").insert(fuelData)
    }

    // Update trip status to include post-trip completion
    await supabase
      .from("trips")
      .update({
        status: "post_trip_completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)

    // Log post-trip inspection creation
    await auditLog(user.id, tripId, "post_trip_inspection_created", {
      inspectionId: newInspection.id,
      totalScore,
      riskLevel,
      itemCount: body.inspectionItems?.length || 0,
    })

    return NextResponse.json({
      success: true,
      data: newInspection,
      message: "Post-trip inspection created successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create post-trip inspection"), { status: 500 })
  }
}

/**
 * PUT /api/trips/[tripId]/post-trip - Update post-trip inspection
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
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

    // Get existing inspection and verify access
    const { data: existingInspection } = await supabase
      .from("post_trip_inspections")
      .select(`
        *,
        trips:trip_id (
          driver_id,
          org_id
        )
      `)
      .eq("trip_id", tripId)
      .single()

    if (!existingInspection) {
      return NextResponse.json({ success: false, error: "Post-trip inspection not found" }, { status: 404 })
    }

    // Check permissions
    const canUpdateInspection = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && existingInspection.trips.driver_id === user.id) ||
      (["supervisor", "mechanic", "org_admin"].includes(currentUser.role) && 
       existingInspection.trips.org_id === currentUser.org_id)

    if (!canUpdateInspection) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Calculate updated score if items are provided
    let totalScore = existingInspection.total_score
    let riskLevel = existingInspection.risk_level

    if (body.inspectionItems && Array.isArray(body.inspectionItems)) {
      // Delete existing items
      await supabase
        .from("post_trip_inspection_items")
        .delete()
        .eq("inspection_id", existingInspection.id)

      // Insert new items
      totalScore = body.inspectionItems.reduce((sum: number, item: any) => {
        return sum + (item.pointsDeducted || 0)
      }, 0)

      // Determine risk level based on total score
      if (totalScore <= 3) {
        riskLevel = "low"
      } else if (totalScore <= 8) {
        riskLevel = "medium"
      } else {
        riskLevel = "high"
      }

      const itemsData = body.inspectionItems.map((item: any) => ({
        inspection_id: existingInspection.id,
        category: item.category,
        item_label: item.itemLabel,
        inspection_type: item.inspectionType,
        condition_status: item.conditionStatus,
        measurement_value: item.measurementValue,
        measurement_unit: item.measurementUnit,
        notes: item.notes,
        photo_url: item.photoUrl,
        requires_maintenance: item.requiresMaintenance || false,
        maintenance_priority: item.maintenancePriority || "low",
        points_deducted: item.pointsDeducted || 0,
        critical: item.critical || false,
      }))

      await supabase.from("post_trip_inspection_items").insert(itemsData)
    }

    // Update inspection
    const updateData: any = {
      total_score: totalScore,
      risk_level: riskLevel,
      updated_at: new Date().toISOString(),
    }

    if (body.journeyCompletionVerified !== undefined) {
      updateData.journey_completion_verified = body.journeyCompletionVerified
    }

    if (body.findingsSummary !== undefined) {
      updateData.findings_summary = body.findingsSummary
    }

    if (body.recommendations !== undefined) {
      updateData.recommendations = body.recommendations
    }

    if (body.status !== undefined) {
      updateData.status = body.status
    }

    if (body.nextMaintenanceDate !== undefined) {
      updateData.next_maintenance_date = body.nextMaintenanceDate
    }

    const { data: updatedInspection, error } = await supabase
      .from("post_trip_inspections")
      .update(updateData)
      .eq("id", existingInspection.id)
      .select()
      .single()

    if (error) throw error

    // Update fuel tracking if provided
    if (body.fuelData) {
      await supabase
        .from("fuel_tracking")
        .upsert({
          trip_id: tripId,
          vehicle_id: existingInspection.vehicle_id,
          driver_id: existingInspection.driver_id,
          fuel_type: body.fuelData.fuelType || "diesel",
          fuel_before_trip_liters: body.fuelData.fuelBeforeTrip,
          fuel_after_trip_liters: body.fuelData.fuelAfterTrip,
          fuel_added_during_trip: body.fuelData.fuelAddedDuringTrip || 0,
          total_fuel_consumed: body.fuelData.totalFuelConsumed,
          distance_km: body.fuelData.distanceKm,
          average_consumption_l_per_100km: body.fuelData.averageConsumption,
          fuel_cost: body.fuelData.fuelCost,
          fuel_station: body.fuelData.fuelStation,
          fuel_receipt_url: body.fuelData.fuelReceiptUrl,
          consumption_anomaly: body.fuelData.consumptionAnomaly || false,
          anomaly_reason: body.fuelData.anomalyReason,
        }, {
          onConflict: "trip_id"
        })
    }

    // Log inspection update
    await auditLog(user.id, tripId, "post_trip_inspection_updated", {
      inspectionId: existingInspection.id,
      totalScore,
      riskLevel,
      changes: Object.keys(updateData),
    })

    return NextResponse.json({
      success: true,
      data: updatedInspection,
      message: "Post-trip inspection updated successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to update post-trip inspection"), { status: 500 })
  }
}

/**
 * POST /api/trips/[tripId]/post-trip/complete - Complete post-trip inspection
 */
export async function COMPLETE(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
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

    // Get existing inspection
    const { data: inspection } = await supabase
      .from("post_trip_inspections")
      .select(`
        *,
        trips:trip_id (
          driver_id,
          org_id
        )
      `)
      .eq("trip_id", tripId)
      .single()

    if (!inspection) {
      return NextResponse.json({ success: false, error: "Post-trip inspection not found" }, { status: 404 })
    }

    // Check permissions
    const canCompleteInspection = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && inspection.trips.driver_id === user.id) ||
      (["supervisor", "mechanic", "org_admin"].includes(currentUser.role) && 
       inspection.trips.org_id === currentUser.org_id)

    if (!canCompleteInspection) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Update inspection status to completed
    const { data: completedInspection, error } = await supabase
      .from("post_trip_inspections")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", inspection.id)
      .select()
      .single()

    if (error) throw error

    // Update trip status to fully completed
    await supabase
      .from("trips")
      .update({
        status: "fully_completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)

    // Create maintenance records for items that require maintenance
    const { data: maintenanceItems } = await supabase
      .from("post_trip_inspection_items")
      .select("*")
      .eq("inspection_id", inspection.id)
      .eq("requires_maintenance", true)

    if (maintenanceItems && maintenanceItems.length > 0) {
      const maintenanceRecords = maintenanceItems.map((item: { item_label: string; notes?: string }) => ({
        vehicle_id: inspection.vehicle_id,
        mechanic_id: user.id,
        company_id: inspection.trips.org_id,
        maintenance_type: "inspection",
        description: `Post-trip inspection: ${item.item_label}`,
        start_date: new Date().toISOString(),
        status: "scheduled",
        notes: item.notes,
        next_maintenance_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      }))

      await supabase.from("maintenance_records").insert(maintenanceRecords)
    }

    // Log completion
    await auditLog(user.id, tripId, "post_trip_inspection_completed", {
      inspectionId: inspection.id,
      totalScore: inspection.total_score,
      riskLevel: inspection.risk_level,
      maintenanceItemsCreated: maintenanceItems?.length || 0,
    })

    return NextResponse.json({
      success: true,
      data: completedInspection,
      message: "Post-trip inspection completed successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to complete post-trip inspection"), { status: 500 })
  }
}
