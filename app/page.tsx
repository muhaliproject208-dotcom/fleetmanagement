import { redirect } from "next/navigation"
import { isSupabaseConfigured } from "@/lib/supabase-client"
import { getCurrentUser, checkEmailConfirmation, getUserRole } from "@/lib/auth-helpers"
import { ROLE_DASHBOARD_ROUTES } from "@/lib/constants/roles"

export default async function Home() {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    redirect("/setup")
  }

  // Check if user is authenticated
  const user = await getCurrentUser()
  
  if (!user) {
    redirect("/auth")
  }

  // Check if user needs email confirmation
  const { needsConfirmation } = await checkEmailConfirmation(user.id)
  
  if (needsConfirmation) {
    redirect("/auth?message=email_confirmation_required")
  }

  // Get user role for role-based redirect
  const userRole = await getUserRole(user.id)
  
  // Redirect to role-specific dashboard
  const dashboardRoute = ROLE_DASHBOARD_ROUTES[userRole as keyof typeof ROLE_DASHBOARD_ROUTES]
  const redirectUrl = dashboardRoute || '/dashboard/driver' // fallback to driver
  redirect(redirectUrl)
}
