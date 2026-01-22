import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ tripId: string }>
}

/**
 * GET /api/trips/[tripId]/monitoring - Get real-time monitoring data
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "monitoring")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const includeGPS = searchParams.get("include_gps") === "true"
    const includeViolations = searchParams.get("include_violations") === "true"
    const includeFatigue = searchParams.get("include_fatigue") === "true"
    const includeAlerts = searchParams.get("include_alerts") === "true"
    const timeRange = searchParams.get("time_range") || "1h" // 1h, 6h, 24h

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
    let tripQuery = supabase.from("trips").select("id, driver_id, org_id, status").eq("id", tripId)
    
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

    // Calculate time range
    const timeRangeMap: Record<string, number> = { "1h": 1, "6h": 6, "24h": 24 }
    const hoursBack = timeRangeMap[timeRange] || 1
    const timeThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

    // Get GPS tracking data
    if (includeGPS) {
      const { data: gpsData } = await supabase
        .from("gps_tracking")
        .select("*")
        .eq("trip_id", tripId)
        .gte("timestamp", timeThreshold)
        .order("timestamp", { ascending: false })
        .limit(100)

      result.gpsTracking = gpsData || []
      result.currentLocation = gpsData?.[0] || null
    }

    // Get speed violations
    if (includeViolations) {
      const { data: violations } = await supabase
        .from("speed_violations")
        .select("*")
        .eq("trip_id", tripId)
        .gte("violation_timestamp", timeThreshold)
        .order("violation_timestamp", { ascending: false })

      result.speedViolations = violations || []
      result.violationSummary = {
        total: violations?.length || 0,
        critical: violations?.filter((v: any) => v.severity === "critical").length || 0,
        major: violations?.filter((v: any) => v.severity === "major").length || 0,
        minor: violations?.filter((v: any) => v.severity === "minor").length || 0,
      }
    }

    // Get fatigue monitoring
    if (includeFatigue) {
      const { data: fatigueData } = await supabase
        .from("fatigue_monitoring")
        .select("*")
        .eq("trip_id", tripId)
        .gte("timestamp", timeThreshold)
        .order("timestamp", { ascending: false })
        .limit(50)

      result.fatigueMonitoring = fatigueData || []
      result.currentFatigueLevel = fatigueData?.[0]?.alert_level || "normal"
    }

    // Get real-time alerts
    if (includeAlerts) {
      const { data: alerts } = await supabase
        .from("real_time_alerts")
        .select("*")
        .eq("trip_id", tripId)
        .eq("acknowledged", false)
        .order("alert_timestamp", { ascending: false })
        .limit(20)

      result.activeAlerts = alerts || []
      result.alertSummary = {
        total: alerts?.length || 0,
        critical: alerts?.filter((a: any) => a.severity === "critical").length || 0,
        warning: alerts?.filter((a: any) => a.severity === "warning").length || 0,
        info: alerts?.filter((a: any) => a.severity === "info").length || 0,
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch monitoring data"), { status: 500 })
  }
}

/**
 * POST /api/trips/[tripId]/monitoring - Update monitoring data (GPS, etc.)
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting for monitoring updates
    const rateLimit = await checkRateLimit(user.id, "monitoring_update")
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

    // Only drivers can update their own monitoring data, or admins
    if (currentUser.role !== "admin" && trip.driver_id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Trip must be in progress to accept monitoring data
    if (!["in_progress", "submitted"].includes(trip.status)) {
      return NextResponse.json({ success: false, error: "Trip is not in progress" }, { status: 400 })
    }

    const results: any = {}

    // Process GPS tracking data
    if (body.gpsData) {
      const gpsData = {
        trip_id: tripId,
        vehicle_id: trip.vehicle_id,
        driver_id: trip.driver_id,
        latitude: body.gpsData.latitude,
        longitude: body.gpsData.longitude,
        speed_kmh: body.gpsData.speed,
        heading: body.gpsData.heading,
        altitude: body.gpsData.altitude,
        accuracy: body.gpsData.accuracy,
        location_source: body.gpsData.source || "gps",
        timestamp: body.gpsData.timestamp || new Date().toISOString(),
      }

      const { data: newGPS, error: gpsError } = await supabase
        .from("gps_tracking")
        .insert(gpsData)
        .select()
        .single()

      if (gpsError) throw gpsError
      results.gpsTracking = newGPS

      // Check for speed violations
      if (body.gpsData.speed && body.gpsData.speedLimit) {
        await checkSpeedViolation(supabase, {
          tripId,
          vehicleId: trip.vehicle_id,
          driverId: trip.driver_id,
          speed: body.gpsData.speed,
          speedLimit: body.gpsData.speedLimit,
          location: { lat: body.gpsData.latitude, lng: body.gpsData.longitude },
          violationType: body.gpsData.violationType || "highway",
        })
      }
    }

    // Process fatigue monitoring data
    if (body.fatigueData) {
      const fatigueData = {
        trip_id: tripId,
        driver_id: trip.driver_id,
        monitoring_type: body.fatigueData.monitoringType || "hours_of_service",
        hours_driven: body.fatigueData.hoursDriven,
        hours_on_duty: body.fatigueData.hoursOnDuty,
        rest_hours: body.fatigueData.restHours,
        fatigue_score: body.fatigueData.fatigueScore,
        alert_level: body.fatigueData.alertLevel || "normal",
        biometric_data: body.fatigueData.biometricData,
        behavioral_indicators: body.fatigueData.behavioralIndicators,
        recommendation: body.fatigueData.recommendation,
        timestamp: body.fatigueData.timestamp || new Date().toISOString(),
      }

      const { data: newFatigue, error: fatigueError } = await supabase
        .from("fatigue_monitoring")
        .insert(fatigueData)
        .select()
        .single()

      if (fatigueError) throw fatigueError
      results.fatigueMonitoring = newFatigue

      // Create fatigue alert if needed
      if (body.fatigueData.alertLevel && body.fatigueData.alertLevel !== "normal") {
        await createFatigueAlert(supabase, {
          tripId,
          driverId: trip.driver_id,
          alertLevel: body.fatigueData.alertLevel,
          fatigueScore: body.fatigueData.fatigueScore,
          recommendation: body.fatigueData.recommendation,
        })
      }
    }

    // Process incident reports
    if (body.incidentData) {
      const incidentData = {
        trip_id: tripId,
        vehicle_id: trip.vehicle_id,
        driver_id: trip.driver_id,
        incident_type: body.incidentData.incidentType,
        severity: body.incidentData.severity,
        location_lat: body.incidentData.location?.lat,
        location_lng: body.incidentData.location?.lng,
        description: body.incidentData.description,
        immediate_actions_taken: body.incidentData.immediateActions,
        injuries_reported: body.incidentData.injuries,
        property_damage: body.incidentData.propertyDamage,
        police_report_number: body.incidentData.policeReportNumber,
        emergency_services_called: body.incidentData.emergencyServicesCalled || false,
        response_time_minutes: body.incidentData.responseTime,
        incident_timestamp: body.incidentData.timestamp || new Date().toISOString(),
      }

      const { data: newIncident, error: incidentError } = await supabase
        .from("in_trip_incidents")
        .insert(incidentData)
        .select()
        .single()

      if (incidentError) throw incidentError
      results.incidentReport = newIncident

      // Create emergency alert for critical incidents
      if (body.incidentData.severity === "critical" || body.incidentData.severity === "fatal") {
        await createEmergencyAlert(supabase, {
          tripId,
          driverId: trip.driver_id,
          incidentType: body.incidentData.incidentType,
          severity: body.incidentData.severity,
          location: body.incidentData.location,
          description: body.incidentData.description,
        })
      }
    }

    // Log monitoring update
    await auditLog(user.id, tripId, "monitoring_data_updated", {
      updateTypes: Object.keys(body),
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      data: results,
      message: "Monitoring data updated successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to update monitoring data"), { status: 500 })
  }
}

/**
 * Check for speed violations and create records if needed
 */
async function checkSpeedViolation(
  supabase: any,
  data: {
    tripId: string
    vehicleId: string
    driverId: string
    speed: number
    speedLimit: number
    location: { lat: number; lng: number }
    violationType: string
  }
) {
  const speedOverLimit = data.speed - data.speedLimit
  
  if (speedOverLimit <= 0) return // No violation

  // Determine severity based on how much over the limit
  let severity: "minor" | "major" | "critical"
  let pointsDeducted: number
  
  if (speedOverLimit <= 10) {
    severity = "minor"
    pointsDeducted = 1
  } else if (speedOverLimit <= 20) {
    severity = "major"
    pointsDeducted = 3
  } else {
    severity = "critical"
    pointsDeducted = 5
  }

  // Check if this violation already exists (to avoid duplicates)
  const existingViolation = await supabase
    .from("speed_violations")
    .select("id")
    .eq("trip_id", data.tripId)
    .eq("violation_timestamp", new Date().toISOString().slice(0, 16)) // Same minute
    .single()

  if (existingViolation.data) return // Already recorded

  // Create violation record
  await supabase.from("speed_violations").insert({
    trip_id: data.tripId,
    vehicle_id: data.vehicleId,
    driver_id: data.driverId,
    location_lat: data.location.lat,
    location_lng: data.location.lng,
    recorded_speed: data.speed,
    speed_limit: data.speedLimit,
    violation_type: data.violationType,
    severity,
    points_deducted: pointsDeducted,
    violation_timestamp: new Date().toISOString(),
  })
}

/**
 * Create fatigue alert
 */
async function createFatigueAlert(
  supabase: any,
  data: {
    tripId: string
    driverId: string
    alertLevel: string
    fatigueScore: number
    recommendation?: string
  }
) {
  const alertSeverity = data.alertLevel === "critical" ? "critical" : 
                      data.alertLevel === "warning" ? "warning" : "info"

  await supabase.from("real_time_alerts").insert({
    trip_id: data.tripId,
    driver_id: data.driverId,
    alert_type: "fatigue_warning",
    severity: alertSeverity,
    title: `Fatigue ${data.alertLevel.charAt(0).toUpperCase() + data.alertLevel.slice(1)}`,
    message: data.recommendation || `Fatigue level: ${data.alertLevel} (Score: ${data.fatigueScore})`,
    auto_generated: true,
    alert_timestamp: new Date().toISOString(),
  })
}

/**
 * Create emergency alert
 */
async function createEmergencyAlert(
  supabase: any,
  data: {
    tripId: string
    driverId: string
    incidentType: string
    severity: string
    location: { lat: number; lng: number }
    description: string
  }
) {
  await supabase.from("real_time_alerts").insert({
    trip_id: data.tripId,
    driver_id: data.driverId,
    alert_type: "emergency",
    severity: "emergency",
    title: `Emergency: ${data.incidentType.replace("_", " ").toUpperCase()}`,
    message: data.description,
    location_lat: data.location.lat,
    location_lng: data.location.lng,
    auto_generated: true,
    alert_timestamp: new Date().toISOString(),
  })
}
