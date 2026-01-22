import { getSupabaseServer } from "@/lib/supabase-server"
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from "next/server"
import { ROLE_DASHBOARD_ROUTES, getDashboardRoute } from "@/lib/constants/roles"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const errorDescription = requestUrl.searchParams.get("error_description")

  // Handle errors from Supabase
  if (error) {
    console.error("Auth callback error:", error, errorDescription)
    return NextResponse.redirect(`${requestUrl.origin}/auth?error=auth_failed&message=${encodeURIComponent(errorDescription || 'Authentication failed')}`)
  }

  if (code) {
    const supabase = await getSupabaseServer()
    
    // Create admin client with service role key for profile creation (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables in callback:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey
      })
    }
    
    const adminSupabase = supabaseUrl && serviceRoleKey 
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })
      : null

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error("Error exchanging code for session:", error)
        return NextResponse.redirect(`${requestUrl.origin}/auth?error=auth_failed&message=${encodeURIComponent(error.message)}`)
      }

      if (data.user) {
        console.log("User authenticated:", data.user.email, "ID:", data.user.id)
        
        // Update user verification status in database when email is confirmed
        if (data.user.email_confirmed_at) {
          try {
            const updateClient = adminSupabase || supabase
            const clientType = adminSupabase ? 'adminSupabase' : 'serverSupabase'

            const { error: updateError } = await updateClient
              .from('users')
              .update({ 
                email_confirmed_at: data.user.email_confirmed_at,
                is_verified: true 
              })
              .eq('id', data.user.id)

            if (updateError) {
              console.error('Error updating user verification status with', clientType, updateError)
            } else {
              console.log('User email confirmed and verification status updated using', clientType)
            }
          } catch (e) {
            console.error('Exception updating user verification status:', e)
          }
        }
        
        // Check if user has a profile in the users table
        // Use admin client to bypass RLS when checking for profile
        const profileCheckClient = adminSupabase || supabase
        const { data: profile, error: profileError } = await profileCheckClient
          .from('users')
          .select('role, org_id')
          .eq('id', data.user.id)
          .single()

        console.log("Profile query result:", { 
          profile, 
          profileError,
          userId: data.user.id,
          email: data.user.email,
          userMetadata: data.user.user_metadata
        })

        if (profileError) {
          console.error('Error fetching user profile:', {
            message: profileError.message,
            code: profileError.code,
            details: profileError.details,
            hint: profileError.hint
          })
          
          // Only redirect to setup if profile truly doesn't exist, not if there's an access error
          if (profileError.message?.includes('No rows found') || profileError.code === 'PGRST116') {
            console.log("Profile doesn't exist, attempting to create from signup metadata")
            
            // Try to create profile from signup metadata or user metadata
            const fullName = data.user.user_metadata?.full_name || 
                           data.user.user_metadata?.name || 
                           data.user.email?.split('@')[0] || 
                           'User'
            
            // Try to get role from metadata or default to driver
            const role = data.user.user_metadata?.role || 'driver'
            
            // For Google OAuth users, create a basic profile automatically
            if (data.user.app_metadata?.provider === 'google') {
              // Use admin client to bypass RLS when creating profile
              if (!adminSupabase) {
                console.error('Admin Supabase client not available, cannot create Google profile')
                return NextResponse.redirect(`${requestUrl.origin}/auth?error=profile_creation_failed&message=${encodeURIComponent('Failed to create user profile')}`)
              }
              
              const { error: insertError } = await adminSupabase
                .from('users')
                .insert({
                  id: data.user.id,
                  email: data.user.email,
                  role: 'driver', // Default role for Google users
                  org_id: null,
                  is_verified: true, // Google users are pre-verified
                  created_at: new Date().toISOString(),
                })

              if (insertError) {
                // If duplicate, try to fetch existing profile
                if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
                  const { data: existingProfile } = await adminSupabase
                    .from('users')
                    .select('role, org_id')
                    .eq('id', data.user.id)
                    .single()
                  
                  if (existingProfile) {
                    const redirectUrl = getDashboardRoute(existingProfile.role)
                    return NextResponse.redirect(`${requestUrl.origin}${redirectUrl}`)
                  }
                }
                
                console.error('Error creating Google user profile:', insertError)
                return NextResponse.redirect(`${requestUrl.origin}/auth?error=profile_creation_failed&message=${encodeURIComponent('Failed to create user profile')}`)
              }

              // Create profile entry
              await adminSupabase
                .from('profiles')
                .insert({
                  user_id: data.user.id,
                  full_name: fullName,
                })

              console.log("Google user profile created successfully")
              return NextResponse.redirect(`${requestUrl.origin}/dashboard/driver`)
            } 
            
            // For email signup users, try to create profile automatically
            // This handles cases where profile creation failed during signup
            console.log("Attempting to create profile for email signup user:", {
              userId: data.user.id,
              email: data.user.email,
              fullName,
              role
            })
            
            // Use admin client to bypass RLS when creating profile
            if (!adminSupabase) {
              console.error('Admin Supabase client not available, cannot create profile', {
                hasUrl: !!supabaseUrl,
                hasServiceKey: !!serviceRoleKey
              })
              return NextResponse.redirect(`${requestUrl.origin}/auth/setup?user_id=${data.user.id}`)
            }
            
            console.log('Creating user profile with admin client:', {
              userId: data.user.id,
              email: data.user.email,
              role,
              fullName,
              isVerified: !!data.user.email_confirmed_at
            })
            
            const { data: insertedUser, error: insertError } = await adminSupabase
              .from('users')
              .insert({
                id: data.user.id,
                email: data.user.email,
                role: role,
                org_id: null,
                is_verified: !!data.user.email_confirmed_at,
                created_at: new Date().toISOString(),
              })
              .select()
              .single()

            if (insertError) {
              console.error('Error creating user profile:', {
                message: insertError.message,
                code: insertError.code,
                details: insertError.details,
                hint: insertError.hint
              })
              
              // If insert fails (e.g., duplicate key), try to fetch existing profile
              if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
                console.log("Profile already exists (duplicate key), fetching it")
                const { data: existingProfile, error: fetchError } = await adminSupabase
                  .from('users')
                  .select('role, org_id')
                  .eq('id', data.user.id)
                  .single()
                
                if (existingProfile && !fetchError) {
                  console.log("Found existing profile:", existingProfile)
                  const redirectUrl = getDashboardRoute(existingProfile.role)
                  return NextResponse.redirect(`${requestUrl.origin}${redirectUrl}`)
                }
              }
              
              // Log detailed error but still redirect to setup as fallback
              console.error('Failed to create profile automatically, redirecting to setup:', insertError)
              return NextResponse.redirect(`${requestUrl.origin}/auth/setup?user_id=${data.user.id}`)
            }
            
            console.log('User profile created successfully:', insertedUser)

            // Also create profile entry if it doesn't exist
            const { error: profileInsertError } = await adminSupabase
              .from('profiles')
              .insert({
                user_id: data.user.id,
                full_name: fullName,
              })

            if (profileInsertError && profileInsertError.code !== '23505') {
              console.error('Error creating profile entry:', profileInsertError)
              // Don't fail if profile entry creation fails, user record is more important
            }

            console.log("User profile created successfully from metadata")
            
            // Redirect to role-specific dashboard
            const redirectUrl = getDashboardRoute(role)
            return NextResponse.redirect(`${requestUrl.origin}${redirectUrl}`)
          } else {
            // This is likely a database access issue, redirect to auth with error
            console.log("Database access error, redirecting to auth")
            return NextResponse.redirect(`${requestUrl.origin}/auth?error=profile_access_failed&message=${encodeURIComponent('Unable to access user profile')}`)
          }
        }

        console.log("User profile found:", profile)
        
        // Redirect to role-specific dashboard (normalize role)
        const redirectUrl = getDashboardRoute(profile?.role)
        console.log("Redirecting to:", redirectUrl)
        return NextResponse.redirect(`${requestUrl.origin}${redirectUrl}`)
      }
    } catch (error) {
      console.error("Auth callback error:", error)
      return NextResponse.redirect(`${requestUrl.origin}/auth?error=auth_failed`)
    }
  }

  // If no code, redirect to auth page
  return NextResponse.redirect(`${requestUrl.origin}/auth`)
}
