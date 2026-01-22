import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, email, email_confirmed_at } = body || {}

    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email is required' }, { status: 400 })
    }

    const matchField = userId ? 'id' : 'email'
    const matchValue = userId ?? email

    const updatePayload: any = { is_verified: true }
    if (email_confirmed_at) updatePayload.email_confirmed_at = email_confirmed_at

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq(matchField, matchValue)
      .select()

    if (error) {
      console.error('Error updating verification status:', error)
      return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 })
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return NextResponse.json({ error: 'No matching user found to update' }, { status: 404 })
    }

    return NextResponse.json({ success: true, updated: data })
  } catch (err: any) {
    console.error('mark-verified exception:', err)
    return NextResponse.json({ error: err?.message || 'Internal Error' }, { status: 500 })
  }
}
