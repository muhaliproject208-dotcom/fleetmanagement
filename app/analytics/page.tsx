"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, signOut } from "@/lib/auth-helpers"
import DashboardHeader from "@/components/dashboard-header"
import AnalyticsCards from "@/components/analytics-cards"
import RiskDistributionChart from "@/components/risk-distribution-chart"
import TripStatusChart from "@/components/trip-status-chart"
import ComplianceMetrics from "@/components/compliance-metrics"

export default function AnalyticsPage() {
  const [user, setUser] = useState<any>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        router.push("/auth")
        return
      }
      setUser(currentUser)
      await fetchAnalytics()
    }
    checkAuth()
  }, [router])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch("/api/analytics/trips")
      const data = await response.json()
      if (data.success) {
        setAnalytics(data.data)
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push("/auth")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={user} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Analytics & Reports</h2>
          <p className="text-gray-600 mt-1">Trip performance and compliance metrics</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        ) : (
          <div className="space-y-8">
            <AnalyticsCards data={analytics} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <RiskDistributionChart data={analytics?.risk_distribution} />
              <TripStatusChart
                data={{
                  approved: analytics?.approved,
                  pending: analytics?.pending,
                  rejected: analytics?.rejected,
                }}
              />
            </div>

            <ComplianceMetrics data={analytics} />
          </div>
        )}
      </div>
    </div>
  )
}
