import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { userId, email, role, fullName, isVerified = false } = await request.json()

    if (!userId || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
        { error: 'Server configuration error. Please contact support.' },
        { status: 500 }
      )
    }

    // Create admin client with service role key to bypass RLS
    // Use createClient (not createServerClient) for admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check if user already exists by ID or email
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role, is_verified')
      .or(`id.eq.${userId},email.eq.${email}`)
      .maybeSingle()

    if (existingUser) {
      // User already exists, return success
      return NextResponse.json({ 
        success: true, 
        user: existingUser,
        message: 'User profile already exists'
      })
    }

    // Create user profile with verification status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        role: role,
        org_id: null,
        is_verified: isVerified,
      })
      .select()
      .single()

    if (userError) {
      console.error('User creation error:', userError)
      
      // Handle duplicate key error gracefully - user already exists
      if (userError.code === '23505') {
        // Try to fetch the existing user and return success
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email, role, is_verified')
          .eq('id', userId)
          .maybeSingle()
          
        if (existingUser) {
          return NextResponse.json({ 
            success: true, 
            user: existingUser,
            message: 'User profile already exists'
          })
        }
      }
      
      let status = 500
      if (userError.message?.includes('duplicate key') || userError.code === '23505') {
        status = 409 // Conflict for duplicate entries
      }
      
      return NextResponse.json({ error: userError.message }, { status })
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('user_id', userId)
      .maybeSingle()

    if (!existingProfile) {
      // Create additional profile data only if it doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          full_name: fullName,
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Don't fail the whole operation if profile creation fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      user: userData 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
