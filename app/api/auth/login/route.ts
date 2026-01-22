import { type NextRequest, NextResponse } from "next/server"
import { signInWithEmail } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * POST /api/auth/login - Login with email and password
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json({
        success: false,
        error: "Email and password are required"
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({
        success: false,
        error: "Invalid email format"
      }, { status: 400 })
    }

    // Rate limiting (using a generic rate limit for login attempts)
    const rateLimitKey = `login_${body.email.replace(/[^a-zA-Z0-9]/g, '_')}`
    const rateLimit = await checkRateLimit(rateLimitKey, "login")
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        success: false, 
        error: "Too many login attempts. Please try again later." 
      }, { status: 429 })
    }

    // Sign in with email and password
    const { data, error } = await signInWithEmail(body.email, body.password)

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message || "Failed to login"
      }, { status: 401 })
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        error: "No data returned from login"
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        user: data.user,
        session: data.session
      },
      message: "Login successful"
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to login"), { status: 500 })
  }
}
