import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

interface RateLimitConfig {
  maxRequests: number
  windowSeconds: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { maxRequests: 100, windowSeconds: 60 },
  auth: { maxRequests: 5, windowSeconds: 60 },
  approve: { maxRequests: 20, windowSeconds: 60 },
  upload: { maxRequests: 10, windowSeconds: 60 },
  export: { maxRequests: 5, windowSeconds: 300 }, // 5 minutes
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  req: NextRequest,
  endpoint: string = "default"
): Promise<{ allowed: boolean; remaining: number; resetTime?: Date }> {
  try {
    // Get user ID from request headers or session
    const userId = req.headers.get("x-user-id") || 
                   req.headers.get("authorization")?.replace("Bearer ", "") ||
                   "anonymous"

    const supabase = await getSupabaseServer()
    const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default
    const now = new Date()
    const windowStart = new Date(now.getTime() - config.windowSeconds * 1000)

    // Clean up old entries periodically (every 10 minutes)
    if (Math.random() < 0.001) { // 0.1% chance to cleanup
      await cleanupOldRateLimitEntries(supabase)
    }

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
    const resetTime = new Date(windowStart.getTime() + config.windowSeconds * 1000)

    if (allowed) {
      // Log this request
      await supabase.from("rate_limit_logs").insert({
        user_id: userId,
        endpoint,
        ip_address: (req as any).ip || req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
        created_at: now.toISOString(),
      })
    }

    return { allowed, remaining, resetTime }
  } catch (error) {
    console.error("Rate limiting middleware error:", error)
    // Fail open - allow request if rate limiting fails
    return { allowed: true, remaining: 100 }
  }
}

/**
 * Clean up old rate limit entries
 */
async function cleanupOldRateLimitEntries(supabase: any) {
  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    await supabase
      .from("rate_limit_logs")
      .delete()
      .lt("created_at", cutoffTime.toISOString())
  } catch (error) {
    console.error("Error cleaning up rate limit entries:", error)
  }
}

/**
 * Apply rate limiting to API routes
 */
export function withRateLimit(endpoint: string) {
  return async (req: NextRequest) => {
    const rateLimitResult = await rateLimitMiddleware(req, endpoint)
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Rate limit exceeded",
          message: `Too many requests. Try again in ${Math.ceil((rateLimitResult.resetTime?.getTime() || 0 - Date.now()) / 1000)} seconds.`,
          retryAfter: rateLimitResult.resetTime?.getTime() ? Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000) : 60
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(RATE_LIMITS[endpoint]?.maxRequests || RATE_LIMITS.default.maxRequests),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            "X-RateLimit-Reset": String(rateLimitResult.resetTime?.getTime() || 0),
            "Retry-After": String(rateLimitResult.resetTime?.getTime() ? Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000) : 60)
          }
        }
      )
    }

    // Add rate limit headers to successful responses
    const response = NextResponse.next()
    response.headers.set("X-RateLimit-Limit", String(RATE_LIMITS[endpoint]?.maxRequests || RATE_LIMITS.default.maxRequests))
    response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining))
    response.headers.set("X-RateLimit-Reset", String(rateLimitResult.resetTime?.getTime() || 0))
    
    return response
  }
}

/**
 * Get rate limit status for a user
 */
export async function getRateLimitStatus(userId: string, endpoint: string = "default") {
  try {
    const supabase = await getSupabaseServer()
    const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default
    const now = new Date()
    const windowStart = new Date(now.getTime() - config.windowSeconds * 1000)

    const { count, error } = await supabase
      .from("rate_limit_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("endpoint", endpoint)
      .gte("created_at", windowStart.toISOString())

    if (error) {
      return { error: "Failed to check rate limit status" }
    }

    const requestCount = count || 0
    const remaining = Math.max(0, config.maxRequests - requestCount)
    const resetTime = new Date(windowStart.getTime() + config.windowSeconds * 1000)

    return {
      endpoint,
      maxRequests: config.maxRequests,
      currentRequests: requestCount,
      remaining,
      windowSeconds: config.windowSeconds,
      resetTime: resetTime.toISOString(),
      allowed: requestCount < config.maxRequests
    }
  } catch (error) {
    console.error("Error getting rate limit status:", error)
    return { error: "Failed to get rate limit status" }
  }
}
