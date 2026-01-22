import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { getTripsByRole, getUserRole } from "@/lib/server-helpers"

/**
 * GET /api/helpers/trips-by-role - Fetch trips based on user role
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
    const status = searchParams.get("status") || undefined
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined
    const includeModules = searchParams.get("include_modules") === "true"

    // Get user role and organization
    const userRoleData = await getUserRole(user.id)

    if (!userRoleData) {
      return NextResponse.json({ success: false, error: "User role not found" }, { status: 404 })
    }

    const { trips, total } = await getTripsByRole(
      user.id,
      userRoleData.role,
      userRoleData.orgId,
      {
        status,
        limit,
        offset,
        includeModules
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        trips,
        total,
        limit,
        offset,
        hasMore: limit ? (offset || 0) + trips.length < total : false
      }
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch trips"), { status: 500 })
  }
}
