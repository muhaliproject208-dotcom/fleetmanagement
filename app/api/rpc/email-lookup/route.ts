import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError, checkPermission } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { 
  getUserByEmail, 
  checkUserPermission, 
  calculateTripScore, 
  checkCriticalFailureOverride 
} from "@/lib/rpc-functions"

/**
 * POST /api/rpc/email-lookup - Lookup user by email
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

    if (!body.email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    // Check permissions
    const { hasPermission } = await checkUserPermission(user.id, "user", "view")
    if (!hasPermission) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 })
    }

    const result = await getUserByEmail(body.email)

    if (!result.success) {
      return NextResponse.json(result, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to lookup email"), { status: 500 })
  }
}
