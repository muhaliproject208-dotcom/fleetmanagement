import { getSupabaseServer } from "./supabase-server"
import type { AuditLog } from "./types"

export type AuditAction =
  | "trip_created"
  | "trip_submitted"
  | "trip_approved"
  | "trip_rejected"
  | "trip_signed_off"
  | "critical_override"
  | "corrective_assigned"
  | "draft_saved"
  | "draft_loaded"

/**
 * Log an audit event
 */
export async function logAuditEvent(
  userId: string,
  action: AuditAction,
  tripId?: string,
  metadata?: Record<string, any>,
) {
  const supabase = await getSupabaseServer()

  try {
    const auditLog: Omit<AuditLog, "id" | "created_at"> = {
      user_id: userId,
      trip_id: tripId,
      action,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "server",
      },
    }

    await supabase.from("audit_logs").insert(auditLog)
  } catch (error) {
    console.error("[Audit] Failed to log event:", error)
  }
}

/**
 * Get audit trail for a trip
 */
export async function getTripAuditTrail(tripId: string) {
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching audit trail:", error)
    return []
  }

  return (data || []) as AuditLog[]
}
