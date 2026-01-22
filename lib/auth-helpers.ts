import { getSupabaseClient } from "./supabase-client"
import { getSupabaseServer } from "./supabase-server"

export async function getCurrentUser() {
  const supabase = getSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getCurrentUserServer() {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getUserRole(userId: string) {
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase.from("users").select("role").eq("id", userId).single()

  if (error) {
    console.error("Error fetching user role:", error)
    return null
  }

  return data?.role || null
}

export async function signInWithGoogle() {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    console.error("Google sign in error:", error)
    throw error
  }

  return data
}

export async function signOut() {
  const supabase = getSupabaseClient()
  return await supabase.auth.signOut()
}

export async function getProfileByUserId(userId: string) {
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single()

  if (error) {
    console.error("Error fetching profile:", error)
    return null
  }

  return data
}

// New: Sign up without email confirmation
export async function signUpWithoutConfirmation(email: string, password: string, metadata?: any) {
  const supabase = await getSupabaseServer()
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: undefined, // No email confirmation required
    }
  })

  if (error) {
    console.error("Sign up error:", error)
    throw error
  }

  return data
}

// New: Login with email and password
export async function signInWithEmail(email: string, password: string) {
  const supabase = await getSupabaseServer()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error("Login error:", error)
    throw error
  }

  return data
}

// New: Create user profile after signup
export async function createUserProfile(userId: string, profileData: any) {
  const supabase = await getSupabaseServer()
  
  // Create user record
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: userId,
      email: profileData.email,
      role: profileData.role || 'driver',
      org_id: profileData.org_id || null,
    })

  if (userError) {
    console.error("Error creating user record:", userError)
    throw userError
  }

  // Create profile record
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      full_name: profileData.full_name,
      phone: profileData.phone || null,
      license_number: profileData.license_number || null,
      vehicle_id: profileData.vehicle_id || null,
      vehicle_plate: profileData.vehicle_plate || null,
    })

  if (profileError) {
    console.error("Error creating profile:", profileError)
    throw profileError
  }

  return { success: true }
}

// New: Check if user needs email confirmation
export async function checkEmailConfirmation(userId: string) {
  const supabase = await getSupabaseServer()
  
  const { data, error } = await supabase
    .from('users')
    .select('email_confirmed_at')
    .eq('id', userId)
    .single()

  if (error) {
    console.error("Error checking email confirmation:", error)
    return { needsConfirmation: false, confirmed: false }
  }

  const confirmed = !!data?.email_confirmed_at
  return { needsConfirmation: !confirmed, confirmed }
}
