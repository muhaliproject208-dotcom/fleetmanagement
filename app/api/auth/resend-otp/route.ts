import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/auth/resend-otp - Resend OTP to user's email
 * 
 * Uses Supabase's built-in OTP system
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey
      })
      return NextResponse.json(
        { success: false, error: 'Server configuration error. Please contact support.' },
        { status: 500 }
      )
    }

    // Create admin client with service role key for sending emails
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Attempting to resend OTP for email:', email)

    // Resend OTP using Supabase's built-in system
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: req.headers.get('origin') 
          ? `${req.headers.get('origin')}/auth/check-email`
          : '/auth/check-email',
      }
    })

    if (error) {
      console.error('Resend OTP error details:', {
        message: error.message,
        status: error.status,
        name: error.name,
        email: email
      })
      
      // Provide more helpful error messages
      let errorMessage = error.message || 'Failed to resend OTP'
      
      if (error.message?.includes('rate limit')) {
        errorMessage = 'Too many requests. Please wait a few minutes before requesting another OTP.'
      } else if (error.message?.includes('already confirmed')) {
        errorMessage = 'This email is already verified. Please try logging in.'
      } else if (error.message?.includes('not found')) {
        errorMessage = 'No account found with this email. Please sign up first.'
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      )
    }

    console.log('OTP resend successful for email:', email)

    return NextResponse.json({
      success: true,
      message: 'OTP has been resent to your email. Please check your inbox (and spam folder).'
    })
  } catch (error: any) {
    console.error('Resend OTP exception:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resend OTP. Please try again.' },
      { status: 500 }
    )
  }
}
