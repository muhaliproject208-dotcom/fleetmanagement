import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

interface Params {
  params: Promise<{ tripId: string; alertId?: string }>
}

/**
 * GET /api/trips/[tripId]/monitoring/alerts - Get active alerts
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "alerts")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const acknowledged = searchParams.get("acknowledged")
    const severity = searchParams.get("severity")
    const alertType = searchParams.get("alert_type")
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50

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
    let tripQuery = supabase.from("trips").select("id, driver_id, org_id").eq("id", tripId)
    
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

    // Build alerts query
    let query = supabase
      .from("real_time_alerts")
      .select(`
        *,
        users:driver_id (
          full_name,
          email
        )
      `)
      .eq("trip_id", tripId)

    // Apply filters
    if (acknowledged !== null) {
      query = query.eq("acknowledged", acknowledged === "true")
    }

    if (severity) {
      query = query.eq("severity", severity)
    }

    if (alertType) {
      query = query.eq("alert_type", alertType)
    }

    const { data: alerts, error } = await query
      .order("alert_timestamp", { ascending: false })
      .limit(limit)

    if (error) throw error

    // Get supervisor for escalation
    let supervisorInfo = null
    if (currentUser.role === "driver") {
      const { data: supervisor } = await supabase
        .from("users")
        .select("id, full_name, email, phone")
        .eq("org_id", trip.org_id)
        .eq("role", "supervisor")
        .limit(1)
        .single()
      
      supervisorInfo = supervisor
    }

    return NextResponse.json({
      success: true,
      data: {
        alerts: alerts || [],
        supervisor: supervisorInfo,
        summary: {
          total: alerts?.length || 0,
          critical: alerts?.filter((a: any) => a.severity === "critical").length || 0,
          warning: alerts?.filter((a: any) => a.severity === "warning").length || 0,
          info: alerts?.filter((a: any) => a.severity === "info").length || 0,
          unacknowledged: alerts?.filter((a: any) => !a.acknowledged).length || 0,
        }
      },
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch alerts"), { status: 500 })
  }
}

/**
 * POST /api/trips/[tripId]/monitoring/alerts - Create new alert
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { tripId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "alerts_create")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const body = await req.json()

    // Validate required fields
    if (!body.alert_type || !body.severity || !body.title) {
      return NextResponse.json({ 
        success: false, 
        error: "Alert type, severity, and title are required" 
      }, { status: 400 })
    }

    // Get current user's role and verify trip access
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check trip access
    const { data: trip } = await supabase
      .from("trips")
      .select("id, driver_id, org_id")
      .eq("id", tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check permissions
    const canCreateAlert = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && trip.driver_id === user.id) ||
      (["supervisor", "mechanic", "org_admin"].includes(currentUser.role) && trip.org_id === currentUser.org_id)

    if (!canCreateAlert) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Get supervisor for escalation
    let supervisorId = null
    if (currentUser.role === "driver") {
      const { data: supervisor } = await supabase
        .from("users")
        .select("id")
        .eq("org_id", trip.org_id)
        .eq("role", "supervisor")
        .limit(1)
        .single()
      
      supervisorId = supervisor?.id
    }

    // Create alert
    const { data: newAlert, error } = await supabase
      .from("real_time_alerts")
      .insert({
        trip_id: tripId,
        driver_id: trip.driver_id,
        supervisor_id: supervisorId,
        alert_type: body.alert_type,
        severity: body.severity,
        title: body.title,
        message: body.message,
        location_lat: body.location?.lat,
        location_lng: body.location?.lng,
        auto_generated: body.auto_generated || false,
        alert_timestamp: body.timestamp || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Log alert creation
    await auditLog(user.id, tripId, "alert_created", {
      alertId: newAlert.id,
      alertType: body.alert_type,
      severity: body.severity,
      autoGenerated: body.auto_generated || false,
    })

    // Trigger escalation for critical alerts
    if (body.severity === "critical" || body.severity === "emergency") {
      await triggerAlertEscalation(supabase, newAlert, currentUser)
    }

    return NextResponse.json({
      success: true,
      data: newAlert,
      message: "Alert created successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create alert"), { status: 500 })
  }
}

/**
 * PUT /api/trips/[tripId]/monitoring/alerts/[alertId] - Acknowledge or resolve alert
 */
export async function PUT(
  req: NextRequest, 
  { params }: { params: Promise<{ tripId: string; alertId?: string }> }
) {
  try {
    const { tripId, alertId } = await params
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // If alertId is not provided, this is a general alerts endpoint
    if (!alertId) {
      return NextResponse.json({ 
        success: false, 
        error: "Alert ID is required for this endpoint" 
      }, { status: 400 })
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

    // Get alert and verify access
    const { data: alert } = await supabase
      .from("real_time_alerts")
      .select(`
        *,
        trips:trip_id (
          driver_id,
          org_id
        )
      `)
      .eq("id", alertId)
      .eq("trip_id", tripId)
      .single()

    if (!alert) {
      return NextResponse.json({ success: false, error: "Alert not found" }, { status: 404 })
    }

    // Check permissions
    const canUpdateAlert = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && alert.trips.driver_id === user.id) ||
      (["supervisor", "mechanic", "org_admin"].includes(currentUser.role) && 
       alert.trips.org_id === currentUser.org_id)

    if (!canUpdateAlert) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Update alert
    const updateData: any = {}
    
    if (body.acknowledge === true) {
      updateData.acknowledged = true
      updateData.acknowledged_by = user.id
      updateData.acknowledged_at = new Date().toISOString()
    }

    if (body.resolve === true) {
      updateData.resolved = true
      updateData.resolved_by = user.id
      updateData.resolved_at = new Date().toISOString()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "No valid update action provided" 
      }, { status: 400 })
    }

    const { data: updatedAlert, error } = await supabase
      .from("real_time_alerts")
      .update(updateData)
      .eq("id", alertId)
      .select()
      .single()

    if (error) throw error

    // Log alert update
    await auditLog(user.id, tripId, "alert_updated", {
      alertId,
      action: Object.keys(updateData),
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      data: updatedAlert,
      message: `Alert ${body.acknowledge ? "acknowledged" : "resolved"} successfully`,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to update alert"), { status: 500 })
  }
}

/**
 * Trigger alert escalation for critical alerts
 */
async function triggerAlertEscalation(
  supabase: any, 
  alert: any, 
  currentUser: any
) {
  try {
    // Get escalation workflow for the company
    const { data: workflow } = await supabase
      .from("escalation_workflows")
      .select("*")
      .eq("company_id", currentUser.org_id)
      .eq("trigger_condition", "critical_alert")
      .eq("is_active", true)
      .single()

    if (!workflow) return

    // Create enforcement action for escalation
    await supabase.from("enforcement_actions").insert({
      trip_id: alert.trip_id,
      driver_id: alert.driver_id,
      violation_type: "critical_alert",
      action_taken: "escalation_triggered",
      action_severity: "critical",
      automated: true,
      execution_timestamp: new Date().toISOString(),
      action_result: `Critical alert escalated: ${alert.title}`,
    })

    // Log escalation
    await supabase.from("audit_logs").insert({
      user_id: currentUser.id,
      trip_id: alert.trip_id,
      action: "alert_escalation_triggered",
      metadata: {
        alertId: alert.id,
        alertType: alert.alert_type,
        severity: alert.severity,
        workflowId: workflow.id,
      },
      created_at: new Date().toISOString(),
    })

  } catch (error) {
    console.error("Error triggering alert escalation:", error)
  }
}
