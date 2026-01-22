import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, token } = await req.json()

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and token are required' },
        { status: 400 }
      )
    }

    // Verify OTP using Supabase's built-in system
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Update user verification status in database - prefer matching by user id
    try {
      const userId = data?.user?.id
      const matchField = userId ? 'id' : 'email'
      const matchValue = userId ?? email

      const { data: updatedRows, error: updateError } = await supabase
        .from('users')
        .update({ 
          email_confirmed_at: new Date().toISOString(),
          is_verified: true 
        })
        .eq(matchField, matchValue)
        .select()

      if (updateError) {
        console.error('Error updating user verification status:', updateError)
      } else if (!updatedRows || (Array.isArray(updatedRows) && updatedRows.length === 0)) {
        console.warn('No user rows updated when setting verification status', { matchField, matchValue })
      } else {
        console.log('Updated user verification status for', matchField, matchValue)
      }
    } catch (e) {
      console.error('Exception updating user verification status:', e)
    }

    // Fetch role using service-role client to avoid RLS restrictions in the browser
    try {
      const userId = data?.user?.id
      const idMatch = userId ? { field: 'id', value: userId } : { field: 'email', value: email }
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq(idMatch.field, idMatch.value)
        .maybeSingle()

      if (profileError) {
        console.error('Error fetching user role after verification:', profileError)
      }

      // Normalize role to avoid casing/whitespace mismatches
      const rawRole = profileData?.role ?? null
      const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : rawRole

      console.log('verify-otp: returning role for redirect', { role, userId: idMatch.value })

      return NextResponse.json({ success: true, data, role })
    } catch (e) {
      console.error('Error fetching role after verification:', e)
      return NextResponse.json({ success: true, data, role: null })
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 500 }
    )
  }
}
