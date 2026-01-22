import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { getTripStatistics, getUserRole } from "@/lib/server-helpers"

/**
 * GET /api/helpers/trip-statistics - Fetch trip statistics for dashboard
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

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    // Get user role and organization
    const userRoleData = await getUserRole(user.id)

    if (!userRoleData) {
      return NextResponse.json({ success: false, error: "User role not found" }, { status: 404 })
    }

    const dateRange = startDate && endDate ? {
      start: startDate,
      end: endDate
    } : undefined

    const statistics = await getTripStatistics(
      user.id,
      userRoleData.role,
      userRoleData.orgId,
      dateRange
    )

    if (!statistics) {
      return NextResponse.json({ success: false, error: "Failed to calculate statistics" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: statistics,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch trip statistics"), { status: 500 })
  }
}
