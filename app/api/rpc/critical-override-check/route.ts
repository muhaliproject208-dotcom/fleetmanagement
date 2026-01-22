import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { checkCriticalFailureOverride, checkUserPermission } from "@/lib/rpc-functions"

/**
 * POST /api/rpc/critical-override-check - Check critical failure override status
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "approve")
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

    // Check permissions - supervisors and admins can check override status
    const permissionResult = await checkUserPermission(user.id, "trip", "review")
    if (!permissionResult.success || !permissionResult.hasPermission) {
      return NextResponse.json({ 
        success: false, 
        error: "Insufficient permissions" 
      }, { status: 403 })
    }

    const result = await checkCriticalFailureOverride(body.trip_id)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to check critical override"), { status: 500 })
  }
}
