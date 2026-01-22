import { getSupabaseServer } from "./supabase-server"
import type { CriticalFailure } from "./types"

/**
 * Calculate aggregate trip score with proper weighting
 */
export function calculateAggregateScore(moduleScores: Record<string, number>) {
  const scores = Object.values(moduleScores)
  if (scores.length === 0) return 0
  const sum = scores.reduce((a, b) => a + b, 0)
  const average = sum / scores.length
  return Math.round(average)
}

/**
 * Identify critical failures in a trip
 */
export async function getCriticalFailures(tripId: string) {
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase
    .from("critical_failures")
    .select("*")
    .eq("trip_id", tripId)
    .eq("resolved", false)

  if (error) {
    console.error("Error fetching critical failures:", error)
    return []
  }

  return (data || []) as CriticalFailure[]
}

/**
 * Calculate 30-day rolling risk score for driver
 */
export async function calculateDriverRiskScore(userId: string) {
  const supabase = await getSupabaseServer()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: trips, error } = await supabase
    .from("trips")
    .select("aggregate_score, critical_override")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo)
    .eq("status", "completed")

  if (error) return 0

  if (!trips || trips.length === 0) return 0

  const totalScore = trips.reduce((sum: number, trip: any) => {
    const penaltyMultiplier = trip.critical_override ? 1.5 : 1
    return sum + (100 - trip.aggregate_score) * penaltyMultiplier
  }, 0)

  return Math.min(Math.round(totalScore), 100)
}

/**
 * Check if critical failures block approval
 */
export async function hasCriticalBlockers(tripId: string): Promise<boolean> {
  const failures = await getCriticalFailures(tripId)
  return failures.length > 0
}
