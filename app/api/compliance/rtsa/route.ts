import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { auditLog, handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/compliance/rtsa - Get RTSA submissions and certificates
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "rtsa")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const submissionType = searchParams.get("submission_type")
    const status = searchParams.get("status")
    const certificateType = searchParams.get("certificate_type")
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

    // Get RTSA submissions
    let submissionsQuery = supabase
      .from("rtsa_submissions")
      .select(`
        *,
        trips:trip_id (
          trip_date,
          route,
          status
        )
      `)

    // Apply role-based filtering
    if (currentUser.role === "driver") {
      submissionsQuery = submissionsQuery.in(
        "trip_id",
        supabase.from("trips").select("id").eq("driver_id", user.id)
      )
    } else if (["supervisor", "mechanic", "org_admin"].includes(currentUser.role)) {
      submissionsQuery = submissionsQuery.in(
        "trip_id",
        supabase.from("trips").select("id").eq("org_id", currentUser.org_id)
      )
    }
    // Admins see all

    // Apply filters
    if (submissionType) {
      submissionsQuery = submissionsQuery.eq("submission_type", submissionType)
    }

    if (status) {
      submissionsQuery = submissionsQuery.eq("submission_status", status)
    }

    if (tripId) {
      submissionsQuery = submissionsQuery.eq("trip_id", tripId)
    }

    const { data: submissions, error: submissionsError } = await submissionsQuery
      .order("created_at", { ascending: false })
      .limit(limit)

    if (submissionsError) throw submissionsError
    result.submissions = submissions || []

    // Get RTSA certificates
    let certificatesQuery = supabase
      .from("rtsa_certificates")
      .select(`
        *,
        trips:trip_id (
          trip_date,
          route
        ),
        vehicles:vehicle_id (
          registration_number,
          make,
          model
        )
      `)

    // Apply role-based filtering
    if (currentUser.role === "driver") {
      certificatesQuery = certificatesQuery.in(
        "trip_id",
        supabase.from("trips").select("id").eq("driver_id", user.id)
      )
    } else if (["supervisor", "mechanic", "org_admin"].includes(currentUser.role)) {
      certificatesQuery = certificatesQuery.in(
        "trip_id",
        supabase.from("trips").select("id").eq("org_id", currentUser.org_id)
      )
    }

    // Apply filters
    if (certificateType) {
      certificatesQuery = certificatesQuery.eq("certificate_type", certificateType)
    }

    if (tripId) {
      certificatesQuery = certificatesQuery.eq("trip_id", tripId)
    }

    const { data: certificates, error: certificatesError } = await certificatesQuery
      .order("issue_date", { ascending: false })
      .limit(limit)

    if (certificatesError) throw certificatesError
    result.certificates = certificates || []

    // Get violation reports
    let violationsQuery = supabase
      .from("violation_reports")
      .select(`
        *,
        trips:trip_id (
          trip_date,
          route
        ),
        speed_violations:violation_id (
          recorded_speed,
          speed_limit,
          violation_type
        )
      `)

    // Apply role-based filtering
    if (currentUser.role === "driver") {
      violationsQuery = violationsQuery.in(
        "trip_id",
        supabase.from("trips").select("id").eq("driver_id", user.id)
      )
    } else if (["supervisor", "mechanic", "org_admin"].includes(currentUser.role)) {
      violationsQuery = violationsQuery.in(
        "trip_id",
        supabase.from("trips").select("id").eq("org_id", currentUser.org_id)
      )
    }

    const { data: violations, error: violationsError } = await violationsQuery
      .order("created_at", { ascending: false })
      .limit(limit)

    if (violationsError) throw violationsError
    result.violationReports = violations || []

    // Summary statistics
    result.summary = {
      totalSubmissions: submissions?.length || 0,
      pendingSubmissions: submissions?.filter((s: any) => s.submission_status === "pending").length || 0,
      acceptedSubmissions: submissions?.filter((s: any) => s.submission_status === "accepted").length || 0,
      activeCertificates: certificates?.filter((c: any) => c.status === "active").length || 0,
      unpaidViolations: violations?.filter((v: any) => v.payment_status === "pending").length || 0,
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch RTSA data"), { status: 500 })
  }
}

/**
 * POST /api/compliance/rtsa/submit - Submit data to RTSA
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "rtsa_submit")
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await getSupabaseServer()
    const body = await req.json()

    // Validate required fields
    if (!body.submissionType || !body.tripId) {
      return NextResponse.json({ 
        success: false, 
        error: "Submission type and trip ID are required" 
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
      .select("id, driver_id, org_id, status, vehicle_id")
      .eq("id", body.tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Check permissions
    const canSubmit = 
      currentUser.role === "admin" ||
      (currentUser.role === "driver" && trip.driver_id === user.id) ||
      (["supervisor", "org_admin"].includes(currentUser.role) && trip.org_id === currentUser.org_id)

    if (!canSubmit) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Prepare submission data based on type
    let submissionData: any = {
      trip_id: body.tripId,
      company_id: trip.org_id,
      submission_type: body.submissionType,
      submission_data: body.submissionData || {},
      submission_status: "pending",
      created_at: new Date().toISOString(),
    }

    // Generate RTSA reference number
    const referenceNumber = await generateRTSAReferenceNumber(body.submissionType)
    submissionData.rtsa_reference_number = referenceNumber

    // Create submission record
    const { data: submission, error: submissionError } = await supabase
      .from("rtsa_submissions")
      .insert(submissionData)
      .select()
      .single()

    if (submissionError) throw submissionError

    // Process different submission types
    let processResult: any = {}

    switch (body.submissionType) {
      case "pre_trip_report":
        processResult = await processPreTripReport(supabase, body.tripId, submission)
        break
      case "violation_report":
        processResult = await processViolationReport(supabase, body.tripId, body.violationId, submission)
        break
      case "incident_report":
        processResult = await processIncidentReport(supabase, body.tripId, submission)
        break
      case "compliance_certificate":
        processResult = await generateComplianceCertificate(supabase, body.tripId, submission)
        break
      case "audit_request":
        processResult = await processAuditRequest(supabase, body.tripId, submission)
        break
      default:
        throw new Error(`Unknown submission type: ${body.submissionType}`)
    }

    // Log submission
    await auditLog(user.id, body.tripId, "rtsa_submission_created", {
      submissionId: submission.id,
      submissionType: body.submissionType,
      referenceNumber,
    })

    return NextResponse.json({
      success: true,
      data: {
        submission,
        processResult,
        referenceNumber,
      },
      message: "RTSA submission created successfully",
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to create RTSA submission"), { status: 500 })
  }
}

/**
 * Generate RTSA reference number
 */
async function generateRTSAReferenceNumber(submissionType: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12)
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  const typeCode = submissionType.substring(0, 3).toUpperCase()
  return `RTSA-${typeCode}-${timestamp}-${random}`
}

/**
 * Process pre-trip report submission
 */
async function processPreTripReport(
  supabase: any, 
  tripId: string, 
  submission: any
): Promise<any> {
  try {
    // Get trip and pre-trip data
    const { data: tripData } = await supabase
      .from("trip_compliance_summary")
      .select("*")
      .eq("trip_id", tripId)
      .single()

    if (!tripData) {
      throw new Error("Trip data not found")
    }

    // Prepare pre-trip report data for RTSA
    const reportData = {
      tripDetails: {
        tripId: tripId,
        tripDate: tripData.trip_date,
        route: tripData.route || "Not specified",
        driverName: tripData.driver_name,
        vehicleDetails: {
          plate: tripData.vehicle_plate,
          make: tripData.vehicle_make,
          model: tripData.vehicle_model,
        },
      },
      preTripCompliance: {
        modulesCompleted: tripData.pre_trip_modules_completed,
        totalModules: tripData.total_pre_trip_modules,
        aggregateScore: tripData.aggregate_score,
        riskLevel: tripData.risk_level,
      },
      documentation: {
        certificates: tripData.active_certificates,
        complianceStatus: tripData.overall_compliance_status,
      },
      submissionTimestamp: new Date().toISOString(),
    }

    // Simulate RTSA API call (in real implementation, this would be an actual API call)
    const rtsaResponse = await simulateRTSAApiCall("pre_trip_report", reportData)

    // Update submission with RTSA response
    await supabase
      .from("rtsa_submissions")
      .update({
        submission_status: rtsaResponse.success ? "submitted" : "rejected",
        submitted_at: new Date().toISOString(),
        rtsa_response_at: new Date().toISOString(),
        rtsa_response_data: rtsaResponse,
        rejection_reason: rtsaResponse.success ? null : rtsaResponse.error,
      })
      .eq("id", submission.id)

    return rtsaResponse
  } catch (error) {
    console.error("Error processing pre-trip report:", error)
    throw error
  }
}

/**
 * Process violation report submission
 */
async function processViolationReport(
  supabase: any, 
  tripId: string, 
  violationId: string,
  submission: any
): Promise<any> {
  try {
    // Get violation details
    const { data: violation } = await supabase
      .from("speed_violations")
      .select(`
        *,
        trips:trip_id (
          trip_date,
          route
        ),
        vehicles:vehicle_id (
          registration_number,
          make,
          model
        ),
        users:driver_id (
          full_name,
          license_number
        )
      `)
      .eq("id", violationId)
      .eq("trip_id", tripId)
      .single()

    if (!violation) {
      throw new Error("Violation not found")
    }

    // Prepare violation report for RTSA
    const reportData = {
      violationDetails: {
        violationId: violation.id,
        timestamp: violation.violation_timestamp,
        location: {
          latitude: violation.location_lat,
          longitude: violation.location_lng,
        },
        speed: {
          recorded: violation.recorded_speed,
          limit: violation.speed_limit,
          overLimit: violation.recorded_speed - violation.speed_limit,
        },
        violationType: violation.violation_type,
        severity: violation.severity,
        pointsDeducted: violation.points_deducted,
      },
      vehicleDetails: {
        registrationNumber: violation.vehicles.registration_number,
        make: violation.vehicles.make,
        model: violation.vehicles.model,
      },
      driverDetails: {
        name: violation.users.full_name,
        licenseNumber: violation.users.license_number,
      },
      tripDetails: {
        tripId: tripId,
        date: violation.trips.trip_date,
        route: violation.trips.route,
      },
      submissionTimestamp: new Date().toISOString(),
    }

    // Simulate RTSA API call
    const rtsaResponse = await simulateRTSAApiCall("violation_report", reportData)

    // Create violation report record
    if (rtsaResponse.success) {
      await supabase.from("violation_reports").insert({
        trip_id: tripId,
        violation_id: violationId,
        driver_id: violation.driver_id,
        company_id: violation.trips.org_id,
        report_type: "speed_violation",
        severity: violation.severity,
        violation_details: reportData,
        auto_reported: true,
        reported_to_rtsa: true,
        rtsa_report_reference: rtsaResponse.referenceNumber,
        rtsa_reported_at: new Date().toISOString(),
        fine_amount: rtsaResponse.fineAmount,
        points_deducted: violation.points_deducted,
      })
    }

    // Update submission
    await supabase
      .from("rtsa_submissions")
      .update({
        submission_status: rtsaResponse.success ? "submitted" : "rejected",
        submitted_at: new Date().toISOString(),
        rtsa_response_at: new Date().toISOString(),
        rtsa_response_data: rtsaResponse,
        rejection_reason: rtsaResponse.success ? null : rtsaResponse.error,
      })
      .eq("id", submission.id)

    return rtsaResponse
  } catch (error) {
    console.error("Error processing violation report:", error)
    throw error
  }
}

/**
 * Process incident report submission
 */
async function processIncidentReport(
  supabase: any, 
  tripId: string, 
  submission: any
): Promise<any> {
  try {
    // Get trip and incident data
    const { data: tripData } = await supabase
      .from("trips")
      .select(`
        *,
        trip_modules(*),
        module_items(*)
      `)
      .eq("id", tripId)
      .single()

    if (!tripData) {
      throw new Error("Trip data not found")
    }

    // Get incident details from submission data
    const incidentData = submission.submission_data || {}

    // Prepare incident report data for RTSA
    const reportData = {
      incidentDetails: {
        incidentId: incidentData.incidentId || `INC-${tripId.substring(0, 8)}`,
        incidentType: incidentData.incidentType || "unknown",
        incidentDate: incidentData.incidentDate || tripData.trip_date,
        location: {
          latitude: incidentData.latitude,
          longitude: incidentData.longitude,
          address: incidentData.address,
        },
        description: incidentData.description,
        severity: incidentData.severity || "medium",
        injuries: incidentData.injuries || false,
        fatalities: incidentData.fatalities || false,
        propertyDamage: incidentData.propertyDamage || false,
      },
      tripDetails: {
        tripId: tripId,
        tripDate: tripData.trip_date,
        route: tripData.route,
        driverId: tripData.user_id,
      },
      vehicleDetails: {
        vehicleId: tripData.vehicle_id,
        vehiclePlate: tripData.vehicle_plate,
      },
      submissionTimestamp: new Date().toISOString(),
    }

    // Simulate RTSA API call
    const rtsaResponse = await simulateRTSAApiCall("incident_report", reportData)

    // Create incident report record if successful
    if (rtsaResponse.success) {
      await supabase.from("incident_reports").insert({
        trip_id: tripId,
        driver_id: tripData.user_id,
        company_id: tripData.org_id,
        incident_type: reportData.incidentDetails.incidentType,
        incident_date: reportData.incidentDetails.incidentDate,
        location_lat: reportData.incidentDetails.location.latitude,
        location_lng: reportData.incidentDetails.location.longitude,
        location_address: reportData.incidentDetails.location.address,
        description: reportData.incidentDetails.description,
        severity: reportData.incidentDetails.severity,
        injuries: reportData.incidentDetails.injuries,
        fatalities: reportData.incidentDetails.fatalities,
        property_damage: reportData.incidentDetails.propertyDamage,
        reported_to_rtsa: true,
        rtsa_report_reference: rtsaResponse.referenceNumber,
        rtsa_reported_at: new Date().toISOString(),
        incident_details: reportData,
      })
    }

    // Update submission
    await supabase
      .from("rtsa_submissions")
      .update({
        submission_status: rtsaResponse.success ? "submitted" : "rejected",
        submitted_at: new Date().toISOString(),
        rtsa_response_at: new Date().toISOString(),
        rtsa_response_data: rtsaResponse,
        rejection_reason: rtsaResponse.success ? null : rtsaResponse.error,
      })
      .eq("id", submission.id)

    return rtsaResponse
  } catch (error) {
    console.error("Error processing incident report:", error)
    throw error
  }
}

/**
 * Generate compliance certificate
 */
async function generateComplianceCertificate(
  supabase: any, 
  tripId: string, 
  submission: any
): Promise<any> {
  try {
    // Get trip compliance data
    const { data: complianceData } = await supabase
      .from("trip_compliance_summary")
      .select("*")
      .eq("trip_id", tripId)
      .single()

    if (!complianceData) {
      throw new Error("Compliance data not found")
    }

    // Only generate certificate if compliant
    if (complianceData.overall_compliance_status !== "compliant") {
      throw new Error("Trip is not compliant. Cannot generate certificate.")
    }

    // Generate certificate data
    const certificateData = {
      certificateType: "trip_clearance",
      certificateNumber: await generateCertificateNumber(),
      issueDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      tripDetails: {
        tripId: tripId,
        tripDate: complianceData.trip_date,
        route: complianceData.route,
      },
      driverDetails: {
        name: complianceData.driver_name,
      },
      vehicleDetails: {
        registrationNumber: complianceData.vehicle_plate,
        make: complianceData.vehicle_make,
        model: complianceData.vehicle_model,
      },
      complianceDetails: {
        preTripScore: complianceData.aggregate_score,
        riskLevel: complianceData.risk_level,
        violationsCount: complianceData.total_violations,
        criticalViolations: complianceData.critical_violations,
      },
      verificationCode: generateVerificationCode(),
    }

    // Simulate RTSA certificate generation
    const rtsaResponse = await simulateRTSAApiCall("generate_certificate", certificateData)

    if (rtsaResponse.success) {
      // Create certificate record
      await supabase.from("rtsa_certificates").insert({
        trip_id: tripId,
        vehicle_id: complianceData.vehicle_id,
        driver_id: complianceData.driver_id,
        company_id: complianceData.org_id,
        certificate_type: "trip_clearance",
        certificate_number: certificateData.certificateNumber,
        issue_date: certificateData.issueDate,
        expiry_date: certificateData.expiryDate,
        certificate_data: certificateData,
        certificate_url: rtsaResponse.certificateUrl,
        verification_code: certificateData.verificationCode,
        status: "active",
      })
    }

    // Update submission
    await supabase
      .from("rtsa_submissions")
      .update({
        submission_status: rtsaResponse.success ? "submitted" : "rejected",
        submitted_at: new Date().toISOString(),
        rtsa_response_at: new Date().toISOString(),
        rtsa_response_data: rtsaResponse,
        rejection_reason: rtsaResponse.success ? null : rtsaResponse.error,
        certificate_url: rtsaResponse.success ? rtsaResponse.certificateUrl : null,
        certificate_valid_until: rtsaResponse.success ? certificateData.expiryDate : null,
      })
      .eq("id", submission.id)

    return rtsaResponse
  } catch (error) {
    console.error("Error generating compliance certificate:", error)
    throw error
  }
}

/**
 * Process audit request
 */
async function processAuditRequest(
  supabase: any, 
  tripId: string, 
  submission: any
): Promise<any> {
  try {
    // Get comprehensive trip data for audit
    const { data: auditData } = await supabase
      .from("trip_compliance_summary")
      .select("*")
      .eq("trip_id", tripId)
      .single()

    if (!auditData) {
      throw new Error("Audit data not found")
    }

    // Prepare audit request data
    const requestData = {
      auditRequest: {
        tripId: tripId,
        requestDate: new Date().toISOString(),
        requestedBy: submission.created_by,
        auditScope: "full_trip_compliance",
      },
      tripSummary: auditData,
      submissionTimestamp: new Date().toISOString(),
    }

    // Simulate RTSA audit request
    const rtsaResponse = await simulateRTSAApiCall("audit_request", requestData)

    // Update submission
    await supabase
      .from("rtsa_submissions")
      .update({
        submission_status: rtsaResponse.success ? "submitted" : "rejected",
        submitted_at: new Date().toISOString(),
        rtsa_response_at: new Date().toISOString(),
        rtsa_response_data: rtsaResponse,
        rejection_reason: rtsaResponse.success ? null : rtsaResponse.error,
      })
      .eq("id", submission.id)

    return rtsaResponse
  } catch (error) {
    console.error("Error processing audit request:", error)
    throw error
  }
}

/**
 * Simulate RTSA API call (replace with actual RTSA integration)
 */
async function simulateRTSAApiCall(endpoint: string, data: any): Promise<any> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Simulate different response scenarios
  const successRate = 0.85 // 85% success rate
  
  if (Math.random() < successRate) {
    return {
      success: true,
      referenceNumber: `RTSA-${endpoint.toUpperCase()}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: "Submission processed successfully",
      ...(endpoint === "violation_report" && { fineAmount: Math.floor(Math.random() * 500) + 100 }),
      ...(endpoint === "generate_certificate" && { 
        certificateUrl: `https://rtsa.gov.zm/certificates/${Date.now()}.pdf` 
      }),
    }
  } else {
    return {
      success: false,
      error: "RTSA system temporarily unavailable. Please try again later.",
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Generate certificate number
 */
async function generateCertificateNumber(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 8)
  const random = Math.random().toString(36).substring(2, 10).toUpperCase()
  return `CERT-${timestamp}-${random}`
}

/**
 * Generate verification code
 */
function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 12).toUpperCase()
}
