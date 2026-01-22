"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Users, AlertTriangle, CheckCircle, Clock, TrendingUp, Eye, 
  ClipboardList, Calendar, Filter, Download, Search
} from "lucide-react"

interface Driver {
  id: string
  email: string
  full_name: string
  role: string
  total_trips: number
  avg_score: number
  risk_level: string
  last_trip_date: string
  last_activity: string
}

interface PendingApproval {
  id: string
  driver_name: string
  trip_date: string
  route: string
  risk_score: number
  critical_failures: number
  submitted_at: string
  status: 'pending' | 'approved' | 'rejected'
}

export default function SupervisorDashboard() {
  const [user, setUser] = useState<any>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const router = useRouter()
  const supabase = getSupabaseClient()

  // Quick stats
  const [stats, setStats] = useState({
    totalTripsSupervised: 0,
    pendingApprovals: 0,
    criticalFailuresWeek: 0,
    highRiskDrivers: 0
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/auth')
        return
      }
      setUser(currentUser)

      // Fetch drivers supervised
      const { data: driversData } = await supabase
        .from('users')
        .select(`
          id, 
          email, 
          role,
          profiles(full_name),
          trips(count, aggregate_score, risk_level, trip_date)
        `)
        .eq('role', 'driver')
        .limit(50)

      // Process drivers data
      const processedDrivers = driversData?.map((driver: any) => ({
        id: driver.id,
        email: driver.email,
        full_name: driver.profiles?.full_name || 'Unknown',
        role: driver.role,
        total_trips: driver.trips?.length || 0,
        avg_score: driver.trips?.reduce((acc: number, trip: any) => acc + (trip.aggregate_score || 0), 0) / (driver.trips?.length || 1) || 0,
        risk_level: calculateRiskLevel(driver.trips || []),
        last_trip_date: driver.trips?.[0]?.trip_date || '',
        last_activity: driver.trips?.[0]?.trip_date || ''
      })) || []

      setDrivers(processedDrivers)

      // Fetch pending approvals
      const { data: approvalsData } = await supabase
        .from('trips')
        .select(`
          id,
          trip_date,
          route,
          aggregate_score,
          critical_failures,
          created_at,
          users!inner(profiles(full_name))
        `)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false })
        .limit(20)

      const processedApprovals = approvalsData?.map((trip: any) => ({
        id: trip.id,
        driver_name: trip.users.profiles.full_name,
        trip_date: trip.trip_date,
        route: trip.route,
        risk_score: trip.aggregate_score || 0,
        critical_failures: trip.critical_failures || 0,
        submitted_at: trip.created_at,
        status: 'pending' as const
      })) || []

      setPendingApprovals(processedApprovals)

      // Calculate stats
      setStats({
        totalTripsSupervised: processedDrivers.reduce((acc: number, driver: any) => acc + driver.total_trips, 0),
        pendingApprovals: processedApprovals.length,
        criticalFailuresWeek: 0, // TODO: Calculate from last 7 days
        highRiskDrivers: processedDrivers.filter((driver: any) => driver.risk_level === 'high').length
      })

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateRiskLevel = (trips: any[]): string => {
    if (!trips.length) return 'medium'
    const avgScore = trips.reduce((acc, trip) => acc + (trip.aggregate_score || 0), 0) / trips.length
    if (avgScore >= 90) return 'low'
    if (avgScore >= 70) return 'medium'
    return 'high'
  }

  const handleApproveChecklist = async (tripId: string) => {
    try {
      await supabase
        .from('trips')
        .update({ status: 'approved' })
        .eq('id', tripId)
      
      fetchDashboardData()
    } catch (error) {
      console.error('Error approving checklist:', error)
    }
  }

  const handleRejectChecklist = async (tripId: string) => {
    try {
      await supabase
        .from('trips')
        .update({ status: 'rejected' })
        .eq('id', tripId)
      
      fetchDashboardData()
    } catch (error) {
      console.error('Error rejecting checklist:', error)
    }
  }

  const filteredDrivers = drivers.filter(driver =>
    driver.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Supervisor Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={() => router.push('/auth')}>
                Sign Out
              </Button>
              <Avatar>
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>
                  {user?.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trips Supervised</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTripsSupervised}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingApprovals}</div>
              <p className="text-xs text-muted-foreground">Need review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Failures This Week</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalFailuresWeek}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Risk Drivers</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.highRiskDrivers}</div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Driver Monitoring Table */}
          <Card>
            <CardHeader>
              <CardTitle>Driver Monitoring</CardTitle>
              <CardDescription>Overview of all drivers and their performance</CardDescription>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    placeholder="Search drivers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-2 w-full border rounded-md text-sm"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredDrivers.slice(0, 5).map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>{driver.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{driver.full_name}</p>
                        <p className="text-sm text-gray-500">{driver.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={driver.risk_level === 'high' ? 'destructive' : driver.risk_level === 'medium' ? 'default' : 'secondary'}>
                        {driver.risk_level} risk
                      </Badge>
                      <p className="text-sm text-gray-500 mt-1">Score: {driver.avg_score.toFixed(1)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Checklists waiting for supervisor review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingApprovals.slice(0, 5).map((approval) => (
                  <div key={approval.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{approval.driver_name}</p>
                        <p className="text-sm text-gray-500">{approval.route}</p>
                        <p className="text-xs text-gray-400">{approval.trip_date}</p>
                      </div>
                      <Badge variant={approval.critical_failures > 0 ? 'destructive' : 'secondary'}>
                        {approval.critical_failures} critical
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Score: {approval.risk_score}</span>
                      <div className="flex space-x-2">
                        <Button size="sm" onClick={() => handleApproveChecklist(approval.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRejectChecklist(approval.id)}>
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Performance Analytics</CardTitle>
            <CardDescription>Risk trends and compliance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <h4 className="font-medium mb-2">Risk Distribution</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Low Risk</span>
                    <span className="text-sm font-medium">{drivers.filter(d => d.risk_level === 'low').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Medium Risk</span>
                    <span className="text-sm font-medium">{drivers.filter(d => d.risk_level === 'medium').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">High Risk</span>
                    <span className="text-sm font-medium text-red-600">{drivers.filter(d => d.risk_level === 'high').length}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium mb-2">Average Score</h4>
                <div className="text-3xl font-bold text-green-600">
                  {drivers.length > 0 ? (drivers.reduce((acc, d) => acc + d.avg_score, 0) / drivers.length).toFixed(1) : '0'}
                </div>
                <p className="text-sm text-gray-500">Across all drivers</p>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium mb-2">Approval Rate</h4>
                <div className="text-3xl font-bold text-blue-600">
                  {stats.pendingApprovals > 0 ? '85%' : '100%'}
                </div>
                <p className="text-sm text-gray-500">Last 30 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
