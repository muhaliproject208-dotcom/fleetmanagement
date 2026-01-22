import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { getCurrentUser, getUserRole } from "@/lib/server-helpers"

/**
 * GET /api/helpers/current-user - Fetch current authenticated user
 */
export async function GET(req: NextRequest) {
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

    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: currentUser,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch current user"), { status: 500 })
  }
}
