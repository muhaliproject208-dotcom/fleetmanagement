"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building, Users, Truck, AlertTriangle, TrendingUp, Shield } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase-client"
import { AppPageLoader } from '@/components/ui/app-loader'

interface Organization {
  id: string
  name?: string
  user_count: number
  trip_count: number
}

interface User {
  id: string
  email: string
  role: string
  full_name?: string
  org_id?: string
  created_at: string
}

type UserRow = User & {
  profiles?: {
    full_name?: string | null
  } | null
}

interface Trip {
  id: string
  status: string
  aggregate_score: number
  risk_level: string
  trip_date: string
  route: string
  org_id: string
}

export default function SuperAdminDashboard() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    fetchGlobalData()
  }, [])

  const fetchGlobalData = async () => {
    try {
      // Fetch all users
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          role,
          org_id,
          created_at,
          profiles!inner (
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      // Fetch all trips
      const { data: allTrips, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (usersError) console.error('Error fetching users:', usersError)
      if (tripsError) console.error('Error fetching trips:', tripsError)

      // Process organizations data
      const orgMap = new Map<string, Organization>()
      ;(allUsers as UserRow[] | null)?.forEach((user: UserRow) => {
        if (user.org_id) {
          const existing = orgMap.get(user.org_id) || {
            id: user.org_id,
            user_count: 0,
            trip_count: 0
          }
          existing.user_count++
          orgMap.set(user.org_id, existing)
        }
      })

      ;(allTrips as Trip[] | null)?.forEach((trip: Trip) => {
        if (trip.org_id) {
          const existing = orgMap.get(trip.org_id) || {
            id: trip.org_id,
            user_count: 0,
            trip_count: 0
          }
          existing.trip_count++
          orgMap.set(trip.org_id, existing)
        }
      })

      setUsers((allUsers as UserRow[] | null) || [])
      setTrips((allTrips as Trip[] | null) || [])
      setOrganizations(Array.from(orgMap.values()))
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'driver': return 'bg-blue-100 text-blue-800'
      case 'org_admin': return 'bg-purple-100 text-purple-800'
      case 'admin': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <AppPageLoader label="Loading global data..." />
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Global Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">System-wide overview and administration</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Organizations</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organizations.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trips</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trips.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {trips.filter(t => t.risk_level === 'critical').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Users</CardTitle>
              <CardDescription>Latest user registrations across all organizations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.slice(0, 8).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {user.profiles?.full_name?.[0] || user.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.profiles?.full_name || user.email}
                        </p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4" variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Manage All Users
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Overall system status and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">System Status</span>
                  <Badge className="bg-green-100 text-green-800">
                    <Shield className="h-3 w-3 mr-1" />
                    Operational
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg Trip Score</span>
                  <span className="text-sm font-medium">
                    {trips.length > 0 
                      ? Math.round(trips.reduce((sum, t) => sum + (t.aggregate_score || 0), 0) / trips.length)
                      : 0
                    }
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">High Risk Trips</span>
                  <span className="text-sm font-medium text-orange-600">
                    {trips.filter(t => t.risk_level === 'high').length}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Critical Risk</span>
                  <span className="text-sm font-medium text-red-600">
                    {trips.filter(t => t.risk_level === 'critical').length}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pending Reviews</span>
                  <span className="text-sm font-medium text-yellow-600">
                    {trips.filter(t => t.status === 'submitted').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Organizations Overview</CardTitle>
            <CardDescription>Active organizations and their statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {organizations.length === 0 ? (
                <div className="text-center py-8">
                  <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No organizations found</p>
                </div>
              ) : (
                organizations.map((org) => (
                  <div key={org.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          Organization {org.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {org.user_count} users • {org.trip_count} trips
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
