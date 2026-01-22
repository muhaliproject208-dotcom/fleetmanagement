import { type NextRequest, NextResponse } from "next/server"
import { signUpWithoutConfirmation, createUserProfile } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * POST /api/auth/signup-direct - Sign up without email confirmation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate required fields
    if (!body.email || !body.password || !body.full_name) {
      return NextResponse.json({
        success: false,
        error: "Email, password, and full name are required"
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

    // For development/testing, allow common test domains
    const isDevelopment = process.env.NODE_ENV === 'development'
    if (isDevelopment) {
      const allowedTestDomains = ['fleettest.com', 'test.local', 'example.dev', 'localhost']
      const emailDomain = body.email.split('@')[1]
      const isTestEmail = allowedTestDomains.includes(emailDomain)
      
      if (!isTestEmail && !emailDomain.match(/^(gmail\.com|yahoo\.com|hotmail\.com|outlook\.com)$/)) {
        return NextResponse.json({
          success: false,
          error: "In development, please use common email providers or test domains"
        }, { status: 400 })
      }
    }

    // Validate password strength (minimum 8 characters, at least one number and one letter)
    if (body.password.length < 8) {
      return NextResponse.json({
        success: false,
        error: "Password must be at least 8 characters long"
      }, { status: 400 })
    }

    const passwordStrength = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/
    if (!passwordStrength.test(body.password)) {
      return NextResponse.json({
        success: false,
        error: "Password must contain at least one letter and one number"
      }, { status: 400 })
    }

    // Rate limiting
    const rateLimitKey = `signup_${body.email.replace(/[^a-zA-Z0-9]/g, '_')}`
    const rateLimit = await checkRateLimit(rateLimitKey, "signup")
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        success: false, 
        error: "Too many signup attempts. Please try again later." 
      }, { status: 429 })
    }

    // Sign up without email confirmation
    const { data, error } = await signUpWithoutConfirmation(
      body.email,
      body.password,
      {
        full_name: body.full_name,
        role: body.role || 'driver',
        phone: body.phone,
      }
    )

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message || "Failed to sign up"
      }, { status: 400 })
    }

    if (!data || !data.user) {
      return NextResponse.json({
        success: false,
        error: "No user data returned from signup"
      }, { status: 500 })
    }

    // Create user profile in database
    try {
      await createUserProfile(data.user.id, {
        email: body.email,
        full_name: body.full_name,
        role: body.role || 'driver',
        phone: body.phone,
        license_number: body.license_number,
        vehicle_id: body.vehicle_id,
        vehicle_plate: body.vehicle_plate,
      })
    } catch (profileError) {
      console.error("Profile creation error:", profileError)
      // Don't fail the signup if profile creation fails, but log it
    }

    return NextResponse.json({
      success: true,
      data: {
        user: data.user,
        session: data.session
      },
      message: "Account created successfully"
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to sign up"), { status: 500 })
  }
}
