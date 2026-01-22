import { createBrowserClient } from "@supabase/ssr"
import { getSupabaseConfig } from "./env-validation"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    const config = getSupabaseConfig()
    supabaseClient = createBrowserClient(
      config.url,
      config.anonKey,
    )
  }
  return supabaseClient
}

export function isSupabaseConfigured(): boolean {
  try {
    getSupabaseConfig()
    return true
  } catch {
    return false
  }
}

export type SupabaseClient = ReturnType<typeof createBrowserClient>
