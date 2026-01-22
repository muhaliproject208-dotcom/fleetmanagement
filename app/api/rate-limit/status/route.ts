import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { getRateLimitStatus } from "@/lib/rate-limit-middleware"

/**
 * GET /api/rate-limit/status - Get rate limit status for current user
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserServer()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const endpoint = searchParams.get("endpoint") || "default"

    const status = await getRateLimitStatus(user.id, endpoint)

    if ("error" in status) {
      return NextResponse.json({ success: false, error: status.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: status,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to get rate limit status"), { status: 500 })
  }
}
