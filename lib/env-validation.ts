// Environment variable validation for production safety
export function validateEnvironmentVariables() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  const optional = [
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  const missing: string[] = []
  const warnings: string[] = []

  // Check required variables
  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }

  // Check optional variables
  for (const envVar of optional) {
    if (!process.env[envVar]) {
      warnings.push(envVar)
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    hasWarnings: warnings.length > 0
  }
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey) {
    throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return {
    url: url!,
    anonKey: anonKey!,
    serviceKey,
    hasServiceKey: !!serviceKey
  }
}
