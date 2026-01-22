import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/enforcement - Get enforcement rules and actions
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "enforcement")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const ruleType = searchParams.get("rule_type")
    const active = searchParams.get("active")
    const tripId = searchParams.get("trip_id")
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50

    // Get current user's role and org
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const result: any = {}

    // Get enforcement rules
    let rulesQuery = supabase.from("enforcement_rules").select("*")

    // Apply role-based filtering
    if (currentUser.role !== "admin") {
      rulesQuery = rulesQuery.eq("company_id", currentUser.org_id)
    }

    // Apply filters
    if (ruleType) {
      rulesQuery = rulesQuery.eq("rule_type", ruleType)
    }

    if (active !== null) {
      rulesQuery = rulesQuery.eq("is_active", active === "true")
    }

    const { data: rules, error: rulesError } = await rulesQuery
      .order("created_at", { ascending: false })
      .limit(limit)

    if (rulesError) throw rulesError
    result.rules = rules || []

    // Get enforcement actions
    let actionsQuery = supabase
      .from("enforcement_actions")
      .select(`
        *,
        trips:trip_id (
          trip_date,
          route
        ),
        users:driver_id (
          full_name,
          email
        ),
        vehicles:vehicle_id (
          registration_number,
          make,
          model
        )
      `)

    // Apply role-based filtering
    if (currentUser.role === "driver") {
      actionsQuery = actionsQuery.in(
        "trip_id",
        supabase.from("trips").select("id").eq("driver_id", user.id)
      )
    } else if (["supervisor", "mechanic", "org_admin"].includes(currentUser.role)) {
      actionsQuery = actionsQuery.in(
        "trip_id",
        supabase.from("trips").select("id").eq("org_id", currentUser.org_id)
      )
    }
    // Admins see all

    if (tripId) {
      actionsQuery = actionsQuery.eq("trip_id", tripId)
    }

    const { data: actions, error: actionsError } = await actionsQuery
      .order("execution_timestamp", { ascending: false })
      .limit(limit)

    if (actionsError) throw actionsError
    result.actions = actions || []

    // Get escalation workflows
    let workflowsQuery = supabase.from("escalation_workflows").select("*")

    if (currentUser.role !== "admin") {
      workflowsQuery = workflowsQuery.eq("company_id", currentUser.org_id)
    }

    const { data: workflows, error: workflowsError } = await workflowsQuery
      .order("created_at", { ascending: false })

    if (workflowsError) throw workflowsError
    result.escalationWorkflows = workflows || []

    // Summary statistics
    result.summary = {
      totalRules: rules?.length || 0,
      activeRules: rules?.filter((r: any) => r.is_active).length || 0,
      totalActions: actions?.length || 0,
      criticalActions: actions?.filter((a: any) => a.action_severity === "critical").length || 0,
      automatedActions: actions?.filter((a: any) => a.automated).length || 0,
      activeWorkflows: workflows?.filter((w: any) => w.is_active).length || 0,
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch enforcement data"), { status: 500 })
  }
}

/**
 * POST /api/enforcement/rules - Create enforcement rule
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "enforcement_create")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const body = await req.json()

    // Validate required fields
    if (!body.ruleName || !body.ruleType || !body.thresholdValue || !body.actionTriggered) {
      return NextResponse.json({ 
        success: false, 
        error: "Rule name, type, threshold value, and action triggered are required" 
      }, { status: 400 })
    }

    // Get current user's role and org
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check permissions - only admins and org_admins can create rules
    if (!["admin", "org_admin"].includes(currentUser.role)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Create enforcement rule
    const ruleData = {
      company_id: currentUser.role === "admin" ? body.companyId : currentUser.org_id,
      rule_name: body.ruleName,
      rule_type: body.ruleType,
      threshold_value: body.thresholdValue,
      threshold_unit: body.thresholdUnit,
      action_triggered: body.actionTriggered,
      severity_levels: body.severityLevels || {},
      is_active: body.isActive !== undefined ? body.isActive : true,
      applies_to_vehicle_types: body.appliesToVehicleTypes || [],
      applies_to_driver_roles: body.appliesToDriverRoles || [],
      created_by: user.id,
      created_at: new Date().toISOString(),
    }

    const { data: newRule, error } = await supabase
      .from("enforcement_rules")
      .insert(ruleData)
      .select()
      .single()

    if (error) throw error

    // Log rule creation
    await auditLog(user.id, null, "enforcement_rule_created", {
      ruleId: newRule.id,
      ruleName: body.ruleName,
      ruleType: body.ruleType,
      thresholdValue: body.thresholdValue,
    })

    return NextResponse.json({
      success: true,
      data: newRule,
      message: "Enforcement rule created successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create enforcement rule"), { status: 500 })
  }
}

/**
 * POST /api/enforcement/escalation - Create escalation workflow
 */
export async function ESCALATE(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await getSupabaseServer()
    const body = await req.json()

    // Validate required fields
    if (!body.workflowName || !body.triggerCondition || !body.escalationLevels) {
      return NextResponse.json({ 
        success: false, 
        error: "Workflow name, trigger condition, and escalation levels are required" 
      }, { status: 400 })
    }

    // Get current user's role and org
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check permissions
    if (!["admin", "org_admin"].includes(currentUser.role)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Create escalation workflow
    const workflowData = {
      company_id: currentUser.role === "admin" ? body.companyId : currentUser.org_id,
      workflow_name: body.workflowName,
      trigger_condition: body.triggerCondition,
      escalation_levels: body.escalationLevels,
      notification_channels: body.notificationChannels || ["email"],
      auto_escalate: body.autoEscalate !== undefined ? body.autoEscalate : true,
      escalation_intervals: body.escalationIntervals || [5, 15, 30], // minutes
      is_active: body.isActive !== undefined ? body.isActive : true,
      created_by: user.id,
      created_at: new Date().toISOString(),
    }

    const { data: newWorkflow, error } = await supabase
      .from("escalation_workflows")
      .insert(workflowData)
      .select()
      .single()

    if (error) throw error

    // Log workflow creation
    await auditLog(user.id, null, "escalation_workflow_created", {
      workflowId: newWorkflow.id,
      workflowName: body.workflowName,
      triggerCondition: body.triggerCondition,
    })

    return NextResponse.json({
      success: true,
      data: newWorkflow,
      message: "Escalation workflow created successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create escalation workflow"), { status: 500 })
  }
}

/**
 * POST /api/enforcement/trigger - Manually trigger enforcement action
 */
export async function TRIGGER(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await getSupabaseServer()
    const body = await req.json()

    // Validate required fields
    if (!body.tripId || !body.violationType || !body.actionTaken) {
      return NextResponse.json({ 
        success: false, 
        error: "Trip ID, violation type, and action taken are required" 
      }, { status: 400 })
    }

    // Get current user's role and org
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Verify trip access
    const { data: trip } = await supabase
      .from("trips")
      .select("id, driver_id, org_id, vehicle_id")
      .eq("id", body.tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check permissions
    const canTriggerEnforcement = 
      currentUser.role === "admin" ||
      (["supervisor", "org_admin"].includes(currentUser.role) && trip.org_id === currentUser.org_id)

    if (!canTriggerEnforcement) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Determine action severity
    let actionSeverity: "info" | "warning" | "critical" | "emergency" = "warning"
    if (body.actionSeverity) {
      actionSeverity = body.actionSeverity
    } else {
      // Auto-determine based on action type
      if (body.actionTaken.includes("immediate_stop") || body.actionTaken.includes("emergency")) {
        actionSeverity = "emergency"
      } else if (body.actionTaken.includes("trip_suspension") || body.actionTaken.includes("critical")) {
        actionSeverity = "critical"
      }
    }

    // Create enforcement action
    const actionData = {
      trip_id: body.tripId,
      driver_id: trip.driver_id,
      vehicle_id: trip.vehicle_id,
      violation_type: body.violationType,
      violation_value: body.violationValue,
      threshold_value: body.thresholdValue,
      action_taken: body.actionTaken,
      action_severity: actionSeverity,
      automated: false,
      executed_by: user.id,
      execution_timestamp: new Date().toISOString(),
      action_result: body.actionResult,
      escalation_level: body.escalationLevel || 1,
    }

    const { data: newAction, error } = await supabase
      .from("enforcement_actions")
      .insert(actionData)
      .select()
      .single()

    if (error) throw error

    // Update trip risk level if critical
    if (actionSeverity === "critical" || actionSeverity === "emergency") {
      await supabase
        .from("trips")
        .update({
          risk_level: "critical",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.tripId)
    }

    // Create real-time alert if needed
    if (actionSeverity === "critical" || actionSeverity === "emergency") {
      await supabase.from("real_time_alerts").insert({
        trip_id: body.tripId,
        driver_id: trip.driver_id,
        alert_type: "enforcement_action",
        severity: actionSeverity,
        title: `Enforcement Action: ${body.actionTaken}`,
        message: body.actionResult || `Enforcement action executed: ${body.actionTaken}`,
        auto_generated: true,
        alert_timestamp: new Date().toISOString(),
      })
    }

    // Log enforcement action
    await auditLog(user.id, body.tripId, "enforcement_action_triggered", {
      actionId: newAction.id,
      violationType: body.violationType,
      actionTaken: body.actionTaken,
      severity: actionSeverity,
      automated: false,
    })

    return NextResponse.json({
      success: true,
      data: newAction,
      message: "Enforcement action triggered successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to trigger enforcement action"), { status: 500 })
  }
}

/**
 * POST /api/enforcement/auto-check - Run automated enforcement checks
 */
export async function AUTO_CHECK(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await getSupabaseServer()
    const body = await req.json()

    // Get current user's role and org
    const { data: currentUser } = await supabase
      .from("users")
      .select("role, org_id")
      .eq("id", user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check permissions - only admins and supervisors can run auto-checks
    if (!["admin", "supervisor", "org_admin"].includes(currentUser.role)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    const results: any[] = []

    // Get active enforcement rules
    let rulesQuery = supabase.from("enforcement_rules").select("*").eq("is_active", true)
    
    if (currentUser.role !== "admin") {
      rulesQuery = rulesQuery.eq("company_id", currentUser.org_id)
    }

    const { data: rules } = await rulesQuery

    if (!rules || rules.length === 0) {
      return NextResponse.json({
        success: true,
        data: { results: [], message: "No active enforcement rules found" },
      })
    }

    // Check each rule against active trips
    for (const rule of rules) {
      const ruleResults = await checkEnforcementRule(supabase, rule, currentUser.org_id)
      results.push(...ruleResults)
    }

    // Log auto-check execution
    await auditLog(user.id, null, "enforcement_auto_check_executed", {
      rulesChecked: rules.length,
      actionsTriggered: results.length,
      orgId: currentUser.org_id,
    })

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          rulesChecked: rules.length,
          actionsTriggered: results.length,
          criticalActions: results.filter(r => r.action_severity === "critical").length,
        },
      },
      message: `Auto-check completed. ${results.length} enforcement actions triggered.`,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to run enforcement auto-check"), { status: 500 })
  }
}

/**
 * Check enforcement rule against active trips
 */
async function checkEnforcementRule(
  supabase: any, 
  rule: any, 
  orgId: string
): Promise<any[]> {
  const results: any[] = []

  try {
    // Get active trips for the organization
    const { data: activeTrips } = await supabase
      .from("trips")
      .select("id, driver_id, vehicle_id, status")
      .eq("org_id", orgId)
      .in("status", ["in_progress", "submitted", "under_review"])

    if (!activeTrips || activeTrips.length === 0) {
      return results
    }

    // Check rule against each trip
    for (const trip of activeTrips) {
      const violation = await evaluateRuleForTrip(supabase, rule, trip)
      
      if (violation) {
        // Create enforcement action
        const actionData = {
          rule_id: rule.id,
          trip_id: trip.id,
          driver_id: trip.driver_id,
          vehicle_id: trip.vehicle_id,
          violation_type: rule.rule_type,
          violation_value: violation.value,
          threshold_value: rule.threshold_value,
          action_taken: rule.action_triggered,
          action_severity: violation.severity,
          automated: true,
          execution_timestamp: new Date().toISOString(),
          action_result: violation.description,
        }

        const { data: newAction } = await supabase
          .from("enforcement_actions")
          .insert(actionData)
          .select()
          .single()

        results.push(newAction)

        // Create real-time alert for critical violations
        if (violation.severity === "critical" || violation.severity === "emergency") {
          await supabase.from("real_time_alerts").insert({
            trip_id: trip.id,
            driver_id: trip.driver_id,
            alert_type: "automated_enforcement",
            severity: violation.severity,
            title: `Automated Enforcement: ${rule.rule_name}`,
            message: violation.description,
            auto_generated: true,
            alert_timestamp: new Date().toISOString(),
          })
        }
      }
    }

    return results
  } catch (error) {
    console.error(`Error checking enforcement rule ${rule.id}:`, error)
    return results
  }
}

/**
 * Evaluate rule for a specific trip
 */
async function evaluateRuleForTrip(
  supabase: any, 
  rule: any, 
  trip: any
): Promise<any> {
  try {
    let violation = null

    switch (rule.rule_type) {
      case "speed_limit":
        // Check for recent speed violations
        const { data: speedViolations } = await supabase
          .from("speed_violations")
          .select("recorded_speed, severity")
          .eq("trip_id", trip.id)
          .gte("violation_timestamp", new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
          .order("violation_timestamp", { ascending: false })
          .limit(1)

        if (speedViolations && speedViolations.length > 0) {
          const latestViolation = speedViolations[0]
          if (latestViolation.recorded_speed > rule.threshold_value) {
            violation = {
              value: latestViolation.recorded_speed,
              severity: latestViolation.severity === "critical" ? "critical" : "warning",
              description: `Speed violation detected: ${latestViolation.recorded_speed} km/h exceeds limit of ${rule.threshold_value} km/h`,
            }
          }
        }
        break

      case "hours_of_service":
        // Check fatigue monitoring
        const { data: fatigueData } = await supabase
          .from("fatigue_monitoring")
          .select("hours_driven, alert_level")
          .eq("trip_id", trip.id)
          .order("timestamp", { ascending: false })
          .limit(1)

        if (fatigueData && fatigueData.length > 0) {
          const latestFatigue = fatigueData[0]
          if (latestFatigue.hours_driven > rule.threshold_value) {
            violation = {
              value: latestFatigue.hours_driven,
              severity: latestFatigue.alert_level === "critical" ? "critical" : "warning",
              description: `Hours of service violation: ${latestFatigue.hours_driven} hours exceeds limit of ${rule.threshold_value} hours`,
            }
          }
        }
        break

      case "critical_alerts":
        // Check for critical alerts
        const { data: criticalAlerts } = await supabase
          .from("real_time_alerts")
          .select("severity")
          .eq("trip_id", trip.id)
          .eq("severity", "critical")
          .eq("acknowledged", false)
          .gte("alert_timestamp", new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes

        if (criticalAlerts && criticalAlerts.length >= rule.threshold_value) {
          violation = {
            value: criticalAlerts.length,
            severity: "critical",
            description: `${criticalAlerts.length} unacknowledged critical alerts detected`,
          }
        }
        break

      default:
        // Add more rule types as needed
        break
    }

    return violation
  } catch (error) {
    console.error(`Error evaluating rule for trip ${trip.id}:`, error)
    return null
  }
}
