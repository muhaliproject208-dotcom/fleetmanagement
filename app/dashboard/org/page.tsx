"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { 
  Users, Truck, AlertTriangle, CheckCircle, TrendingUp, Building, 
  Calendar, Search, Filter, Download, Activity, BarChart3, 
  FileText, Eye, Plus, Settings
} from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase-client"
import { ROLES, ROLE_DISPLAY_NAMES } from "@/lib/constants/roles"

interface User {
  id: string
  email: string
  role: string
  full_name?: string
  total_trips: number
  avg_score: number
  risk_level: string
  last_trip_date: string
  created_at: string
  profiles?: {
    full_name: string
  }
}

interface Trip {
  id: string
  status: string
  aggregate_score: number
  risk_level: string
  trip_date: string
  route: string
  user_id: string
  users?: {
    email: string
    profiles?: {
      full_name: string
    }
  }
  has_critical_failures: boolean
}

interface OrgStats {
  totalTrips: number
  activeDrivers: number
  overallCompliance: number
  criticalFailures: number
  avgDriverScore: number
  completedTripsToday: number
}

export type Role = typeof ROLES[keyof typeof ROLES]

const getRiskColor = (level: string): string => {
  switch (level) {
    case 'low': return 'bg-green-100 text-green-800'
    case 'medium': return 'bg-yellow-100 text-yellow-800'
    case 'high': return 'bg-orange-100 text-orange-800'
    case 'critical': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

const getRoleBadgeColor = (role: string): string => {
  switch (role) {
    case 'driver': return 'bg-blue-100 text-blue-800'
    case 'supervisor': return 'bg-purple-100 text-purple-800'
    case 'mechanic': return 'bg-green-100 text-green-800'
    case 'org_admin': return 'bg-orange-100 text-orange-800'
    case 'super_admin': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export default function OrgAdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [users, setUsers] = useState<User[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [stats, setStats] = useState<OrgStats>({
    totalTrips: 0,
    activeDrivers: 0,
    overallCompliance: 0,
    criticalFailures: 0,
    avgDriverScore: 0,
    completedTripsToday: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const router = useRouter()
  const supabase = getSupabaseClient()

  useEffect(() => {
    fetchOrgData()
  }, [])

  const fetchOrgData = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/auth')
        return
      }
      setUser(currentUser)

      // Get current user's org_id
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', currentUser.id)
        .single()

      if (!userData?.org_id) return

      // Fetch organization users with their stats
      const { data: usersData } = await supabase
        .from('users')
        .select(`
          id,
          email,
          role,
          profiles(full_name),
          trips(count, aggregate_score, risk_level, trip_date, has_critical_failures),
          created_at
        `)
        .eq('org_id', userData.org_id)
        .order('created_at', { ascending: false })

      const processedUsers = usersData?.map((user: any) => {
        const userTrips = user.trips || []
        const totalTrips = userTrips.length
        const avgScore = totalTrips > 0 ? 
          userTrips.reduce((acc: number, trip: any) => acc + (trip.aggregate_score || 0), 0) / totalTrips : 0
        const riskLevel = calculateRiskLevel(userTrips)
        const lastTripDate = userTrips[0]?.trip_date || ''

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          full_name: user.profiles?.full_name || 'Unknown',
          total_trips: totalTrips,
          avg_score: avgScore,
          risk_level: riskLevel,
          last_trip_date: lastTripDate,
          created_at: user.created_at,
          profiles: user.profiles
        }
      }) || []

      setUsers(processedUsers)

      // Fetch organization trips
      const { data: tripsData } = await supabase
        .from('trips')
        .select(`
          id,
          status,
          aggregate_score,
          risk_level,
          trip_date,
          route,
          user_id,
          has_critical_failures,
          users!inner(email, profiles(full_name))
        `)
        .in('user_id', processedUsers.map((u: User) => u.id))
        .order('trip_date', { ascending: false })
        .limit(100)

      setTrips(tripsData || [])

      // Calculate organization stats
      const today = new Date().toISOString().split('T')[0]
      const totalTrips = tripsData?.length || 0
      const activeDrivers = processedUsers.filter((u: User) => u.role === 'driver').length
      const overallCompliance = totalTrips > 0 ? 
        Math.round((tripsData?.filter((t: any) => t.aggregate_score >= 70).length || 0) / totalTrips * 100) : 0
      const criticalFailures = tripsData?.filter((t: any) => t.has_critical_failures).length || 0
      const avgDriverScore = processedUsers.length > 0 ?
        processedUsers.reduce((acc: number, u: User) => acc + u.avg_score, 0) / processedUsers.length : 0
      const completedTripsToday = tripsData?.filter((t: any) => 
        t.trip_date.split('T')[0] === today && t.status === 'completed'
      ).length || 0

      setStats({
        totalTrips,
        activeDrivers,
        overallCompliance,
        criticalFailures,
        avgDriverScore,
        completedTripsToday
      })

    } catch (error) {
      console.error('Error fetching org data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateRiskLevel = (trips: any[]): string => {
    if (!trips.length) return 'medium'
    const avgScore = trips.reduce((acc: number, trip: any) => acc + (trip.aggregate_score || 0), 0) / trips.length
    if (avgScore >= 90) return 'low'
    if (avgScore >= 70) return 'medium'
    return 'high'
  }

  const filteredUsers = users.filter((user: User) =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
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
              <Building className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Organization Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Assign Trip
              </Button>
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
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trips</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTrips}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeDrivers}</div>
              <p className="text-xs text-muted-foreground">Current fleet</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.overallCompliance}%</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Failures</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalFailures}</div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Driver Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Driver Performance</CardTitle>
              <CardDescription>Overview of all drivers in your organization</CardDescription>
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
                {filteredUsers.slice(0, 6).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>{user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        <p className="text-xs text-gray-400">{user.total_trips} trips</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={user.risk_level === 'high' ? 'destructive' : user.risk_level === 'medium' ? 'default' : 'secondary'}>
                        {user.risk_level} risk
                      </Badge>
                      <p className="text-sm text-gray-500 mt-1">Score: {user.avg_score.toFixed(1)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Trip Monitoring */}
          <Card>
            <CardHeader>
              <CardTitle>Active Trips</CardTitle>
              <CardDescription>Real-time trip status and critical issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trips.slice(0, 6).map((trip) => (
                  <div key={trip.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{trip.users?.profiles?.full_name}</p>
                        <p className="text-sm text-gray-500">{trip.route}</p>
                        <p className="text-xs text-gray-400">{trip.trip_date}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={trip.has_critical_failures ? 'destructive' : trip.status === 'completed' ? 'secondary' : 'default'}>
                          {trip.has_critical_failures ? 'Critical Issues' : trip.status}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">Score: {trip.aggregate_score}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Risk: {trip.risk_level}
                      </span>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Organization Analytics</CardTitle>
            <CardDescription>Performance trends and compliance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <h4 className="font-medium mb-2">Driver Distribution</h4>
                <div className="space-y-2">
                  {Object.entries(ROLES).filter(([key, value]) => 
                    ['driver', 'supervisor', 'mechanic'].includes(value)
                  ).map(([key, value]) => {
                    const count = users.filter(u => u.role === value).length
                    return (
                      <div key={value} className="flex justify-between">
                        <span className="text-sm">{ROLE_DISPLAY_NAMES[value]}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium mb-2">Risk Distribution</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Low Risk</span>
                    <span className="text-sm font-medium text-green-600">
                      {users.filter(u => u.risk_level === 'low').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Medium Risk</span>
                    <span className="text-sm font-medium text-yellow-600">
                      {users.filter(u => u.risk_level === 'medium').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">High Risk</span>
                    <span className="text-sm font-medium text-red-600">
                      {users.filter(u => u.risk_level === 'high').length}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium mb-2">Performance</h4>
                <div className="text-3xl font-bold text-blue-600">
                  {stats.avgDriverScore.toFixed(1)}
                </div>
                <p className="text-sm text-gray-500">Average driver score</p>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium mb-2">Today's Activity</h4>
                <div className="text-3xl font-bold text-green-600">
                  {stats.completedTripsToday}
                </div>
                <p className="text-sm text-gray-500">Completed trips</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center space-x-4">
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Generate Reports
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Organization Settings
          </Button>
        </div>
      </main>
    </div>
  )
}
