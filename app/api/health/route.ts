import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

/**
 * GET /api/health - Database and system health check
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer()
    const health: any = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "unknown",
      tables: {}
    }

    // Test database connection
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count', { count: 'exact', head: true })
      
      if (error) {
        health.database = "error"
        health.database_error = error.message
      } else {
        health.database = "connected"
        health.user_count = data
      }
    } catch (dbError) {
      health.database = "failed"
      health.database_error = dbError instanceof Error ? dbError.message : "Unknown error"
    }

    // Test key tables
    const tables = ['users', 'profiles', 'trips', 'trip_modules']
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count', { count: 'exact', head: true })
        
        health.tables[table] = {
          status: error ? "error" : "ok",
          count: data || 0,
          error: error?.message
        }
      } catch (tableError) {
        health.tables[table] = {
          status: "failed",
          error: tableError instanceof Error ? tableError.message : "Unknown error"
        }
      }
    }

    // Test RLS policies
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1)
      
      health.rls_test = {
        status: error ? "active" : "warning",
        message: error ? "RLS policies are working" : "RLS may not be properly configured",
        error: error?.message
      }
    } catch (rlsError) {
      health.rls_test = {
        status: "failed",
        error: rlsError instanceof Error ? rlsError.message : "Unknown error"
      }
    }

    return NextResponse.json(health)
  } catch (error) {
    return NextResponse.json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
