import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { checkUserPermission } from "@/lib/rpc-functions"

/**
 * POST /api/rpc/permissions-check - Check user permissions
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

    if (!body.resource || !body.action) {
      return NextResponse.json({ 
        success: false, 
        error: "Resource and action are required" 
      }, { status: 400 })
    }

    // Users can only check their own permissions
    const targetUserId = body.user_id || user.id
    
    if (targetUserId !== user.id) {
      return NextResponse.json({ 
        success: false, 
        error: "Can only check your own permissions" 
      }, { status: 403 })
    }

    const result = await checkUserPermission(targetUserId, body.resource, body.action)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to check permissions"), { status: 500 })
  }
}
