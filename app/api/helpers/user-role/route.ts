import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserServer } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"
import { getUserRole } from "@/lib/server-helpers"
import { getSupabaseServer } from "@/lib/supabase-server"

/**
 * GET /api/helpers/user-role - Fetch user role and organization
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
    const userId = searchParams.get("user_id") || user.id

    // Users can only check their own role unless they're admins
    if (userId !== user.id) {
      const supabase = await getSupabaseServer()
      const { data: currentUser } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      if (!currentUser || currentUser.role !== "admin") {
        return NextResponse.json({ 
          success: false, 
          error: "Can only check your own role" 
        }, { status: 403 })
      }
    }

    const userRoleData = await getUserRole(userId)

    if (!userRoleData) {
      return NextResponse.json({ success: false, error: "User role not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: userRoleData,
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to fetch user role"), { status: 500 })
  }
}
