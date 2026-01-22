import { getSupabaseServer } from "./supabase-server"
import type { UserRole } from "./types"
import { NextResponse } from "next/server"
import { logger } from "./logger"

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Calculate aggregate trip score based on module scores
 */
export function calculateAggregateScore(moduleScores: number[]): number {
  if (moduleScores.length === 0) return 0
  
  const totalScore = moduleScores.reduce((sum, score) => sum + score, 0)
  return Math.round(totalScore / moduleScores.length)
}

/**
 * Determine risk level based on score percentage
 */
export function getRiskLevelFromScore(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 90) return 'low'
  if (score >= 75) return 'medium'
  if (score >= 60) return 'high'
  return 'critical'
}

/**
 * Check if user has permission for action
 */
export async function checkPermission(userId: string, role: UserRole, resource: string, action: string) {
  const permissions: Record<UserRole, Record<string, string[]>> = {
    driver: { trip: ["create", "view_own", "edit_own"], draft: ["create", "view_own", "edit_own"] },
    supervisor: {
      trip: ["view_org", "approve"],
      draft: ["view_org"],
      user: ["view_org"],
    },
    mechanic: { trip: ["view_org", "sign_off"] },
    org_admin: { trip: ["view_org", "manage"], user: ["view_org", "manage"] },
    admin: { "*": ["*"] },
  }

  const allowedActions = permissions[role]?.[resource] || []
  return allowedActions.includes(action) || allowedActions.includes("*")
}

/**
 * Log audit trail
 */
export async function auditLog(userId: string, tripId: string | null, action: string, metadata: any) {
  const supabase = await getSupabaseServer()
  await supabase.from("audit_logs").insert({
    user_id: userId,
    trip_id: tripId,
    action,
    metadata,
    created_at: new Date().toISOString(),
  })
}

/**
 * Handle API errors consistently
 */
export function handleError(error: any, defaultMessage = "An error occurred"): ApiResponse<null> {
  console.error(error)
  return {
    success: false,
    error: error?.message || defaultMessage,
  }
}
