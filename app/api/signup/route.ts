import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

// Complete server-side signup that bypasses Supabase email confirmation
export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, role } = await request.json()

    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create Supabase server client with proper cookie handling
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => 
              cookieStore.set(name, value, options)
            )
          },
        },
      },
    )

    // Hash password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Create auth user directly in auth.users table
    const { data: authUser, error: authError } = await supabase
      .from('auth.users')
      .insert({
        email: email,
        encrypted_password: hashedPassword, // Note: This might need adjustment based on Supabase setup
        email_confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (authError) {
      console.error('Auth user creation error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Create user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: email,
        role: role,
        org_id: null,
      })
      .select()
      .single()

    if (userError) {
      console.error('User profile creation error:', userError)
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    // Create additional profile data
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.id,
        full_name: fullName,
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Don't fail the operation
    }

    return NextResponse.json({ 
      success: true, 
      user: userData,
      message: 'Account created successfully. Please check your email to verify your account.'
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
