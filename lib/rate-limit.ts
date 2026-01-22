import { getSupabaseServer } from "./supabase-server"

interface RateLimitConfig {
  maxRequests: number
  windowSeconds: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { maxRequests: 100, windowSeconds: 60 },
  auth: { maxRequests: 5, windowSeconds: 60 },
  signup: { maxRequests: 3, windowSeconds: 300 }, // 3 signups per 5 minutes
  login: { maxRequests: 10, windowSeconds: 300 }, // 10 logins per 5 minutes
  approve: { maxRequests: 20, windowSeconds: 60 },
}

// In-memory rate limit store for development
const inMemoryRateLimit = new Map<string, { count: number; resetTime: number }>()

/**
 * Check if user has exceeded rate limit
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default
  const now = Date.now()
  const key = `${userId}:${endpoint}`
  
  // Check in-memory store first (for development)
  const existing = inMemoryRateLimit.get(key)
  
  if (existing && now < existing.resetTime) {
    const allowed = existing.count < config.maxRequests
    const remaining = Math.max(0, config.maxRequests - existing.count)
    
    if (allowed) {
      existing.count++
    }
    
    return { allowed, remaining }
  }
  
  // Reset or create new entry
  inMemoryRateLimit.set(key, {
    count: 1,
    resetTime: now + (config.windowSeconds * 1000)
  })
  
  return { allowed: true, remaining: config.maxRequests - 1 }
}

/**
 * Database-backed rate limiting (for production)
 */
export async function checkRateLimitDB(
  userId: string,
  endpoint: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = await getSupabaseServer()
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowSeconds * 1000)

  // Get count of requests in the window
  const { count, error } = await supabase
    .from("rate_limit_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("created_at", windowStart.toISOString())

  if (error) {
    console.error("Rate limit check error:", error)
    return { allowed: true, remaining: config.maxRequests }
  }

  const requestCount = count || 0
  const allowed = requestCount < config.maxRequests
  const remaining = Math.max(0, config.maxRequests - requestCount)

  if (allowed) {
    await supabase.from("rate_limit_logs").insert({
      user_id: userId,
      endpoint,
      created_at: now.toISOString(),
    })
  }

  return { allowed, remaining }
}
