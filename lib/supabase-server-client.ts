import { createServerClient } from "@supabase/ssr"
import { getSupabaseConfig } from "./env-validation"

// Cache the client to avoid recreating it on every call
let cachedClient: ReturnType<typeof createServerClient> | null = null

// This function should only be called from Server Components or API routes
export async function createSupabaseServerClient() {
  if (cachedClient) {
    return cachedClient
  }

  // Get validated config
  const config = getSupabaseConfig()
  
  // Dynamic import to avoid client-side bundling issues
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  
  cachedClient = createServerClient(
    config.url,
    config.serviceKey || config.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => 
              cookieStore.set(name, value, options)
            )
          } catch {
            // Handle cookie setting errors
          }
        },
      },
    },
  )
  
  return cachedClient
}
