import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side auth utilities
export async function getServerSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    },
  )

  const { data: { session } } = await supabase.auth.getSession()
  return { session, supabase }
}

export async function getServerUser() {
  const { session } = await getServerSession()
  return session?.user || null
}

// Helper functions to replace localStorage usage
export async function setSignupContext(email: string, role: string) {
  const cookieStore = await cookies()
  cookieStore.set('signup_email', email, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 // 24 hours
  })
  cookieStore.set('signup_role', role, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 // 24 hours
  })
}

export async function getSignupContext() {
  const cookieStore = await cookies()
  const email = cookieStore.get('signup_email')?.value
  const role = cookieStore.get('signup_role')?.value
  
  return { email, role }
}

export async function clearSignupContext() {
  const cookieStore = await cookies()
  cookieStore.delete('signup_email')
  cookieStore.delete('signup_role')
}
