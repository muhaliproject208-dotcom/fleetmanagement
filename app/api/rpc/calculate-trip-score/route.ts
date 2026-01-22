import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer, getUserRole } from "@/lib/auth-helpers"
import { handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { calculateTripScore } from "@/lib/rpc-functions"

/**
 * POST /api/rpc/calculate-trip-score - Calculate aggregate trip score
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

    if (!body.trip_id) {
      return NextResponse.json({ 
        success: false, 
        error: "Trip ID is required" 
      }, { status: 400 })
    }

    // Check permissions - users can calculate scores for trips they can access
    const userRole = await getUserRole(user.id)
    if (!userRole) {
      return NextResponse.json({ 
        success: false, 
        error: "User role not found" 
      }, { status: 403 })
    }
    
    const hasPermission = await checkPermission(user.id, userRole, "trip", "view")
    if (!hasPermission) {
      return NextResponse.json({ 
        success: false, 
        error: "Insufficient permissions" 
      }, { status: 403 })
    }

    const result = await calculateTripScore(body.trip_id)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to calculate trip score"), { status: 500 })
  }
}
