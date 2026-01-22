import { createServerClient } from "@supabase/ssr"
import { createSupabaseServerClient } from "./supabase-server-client"

export async function getSupabaseServer() {
  return createSupabaseServerClient()
}
