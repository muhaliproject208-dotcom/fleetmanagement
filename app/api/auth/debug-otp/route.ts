import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/auth/debug-otp - Debug OTP email configuration
 * 
 * This endpoint helps diagnose OTP email issues by checking:
 * - Environment variables
 * - Supabase connection
 * - User status
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')

    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      environment: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
          process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) + '...' : 'MISSING',
      },
      supabase: {
        connected: false,
        error: null,
      },
    }

    // Test Supabase connection
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase environment variables',
        debug: debugInfo
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Test connection by checking auth users
    try {
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
      debugInfo.supabase.connected = !usersError
      debugInfo.supabase.error = usersError?.message || null
      debugInfo.supabase.userCount = users?.users?.length || 0
    } catch (err: any) {
      debugInfo.supabase.error = err.message
    }

    // If email provided, check user status
    if (email) {
      try {
        // Use listUsers to find user by email since getUserByEmail doesn't exist
        const { data: usersData, error: userError } = await supabase.auth.admin.listUsers()
        const userData = usersData.users.find(user => user.email === email)
        
        debugInfo.user = {
          found: !!userData,
          email: userData?.email || null,
          emailConfirmed: !!userData?.email_confirmed_at,
          createdAt: userData?.created_at || null,
          lastSignIn: userData?.last_sign_in_at || null,
          error: userError?.message || null,
        }
      } catch (err: any) {
        debugInfo.user = {
          error: err.message
        }
      }
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo,
      recommendations: [
        !debugInfo.environment.hasServiceKey && 'Set SUPABASE_SERVICE_ROLE_KEY in .env.local',
        !debugInfo.environment.hasSupabaseUrl && 'Set NEXT_PUBLIC_SUPABASE_URL in .env.local',
        debugInfo.supabase.error && 'Check Supabase project is active and credentials are correct',
        email && debugInfo.user?.found && !debugInfo.user?.emailConfirmed && 'User exists but email not confirmed - OTP should be sent',
        email && !debugInfo.user?.found && 'User not found - signup may have failed',
      ].filter(Boolean)
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
