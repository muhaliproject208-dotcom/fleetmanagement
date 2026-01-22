"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Shield, Users, Building, Truck, AlertTriangle, TrendingUp, 
  Search, Filter, Download, Settings, Activity, Globe, 
  BarChart3, PieChart, FileText, Eye, Plus
} from "lucide-react"
import { ROLES, ROLE_DISPLAY_NAMES } from "@/lib/constants/roles"

interface Organization {
  id: string
  name: string
  location: string
  drivers_count: number
  vehicles_count: number
  trips_count: number
  compliance_rate: number
  created_at: string
}

interface User {
  id: string
  email: string
  role: string
  full_name?: string
  org_id?: string
  is_verified: boolean
  created_at: string
  last_sign_in?: string
}

interface GlobalStats {
  totalOrganizations: number
  totalUsers: number
  totalTrips: number
  overallCompliance: number
  criticalFailures30Days: number
}

export default function SuperAdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<GlobalStats>({
    totalOrganizations: 0,
    totalUsers: 0,
    totalTrips: 0,
    overallCompliance: 0,
    criticalFailures30Days: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [verificationFilter, setVerificationFilter] = useState<string>("all")
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newUser, setNewUser] = useState({
    email: "",
    role: "",
    full_name: ""
  })
  const router = useRouter()
  const supabase = getSupabaseClient()

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

      // Fetch organizations with stats
      const { data: orgsData } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          location,
          created_at,
          users!inner(role),
          trips(count),
          vehicles(count)
        `)
        .limit(50)

      const processedOrgs = orgsData?.map((org: any) => ({
        id: org.id,
        name: org.name,
        location: org.location,
        drivers_count: org.users?.filter((u: any) => u.role === 'driver').length || 0,
        vehicles_count: org.vehicles?.length || 0,
        trips_count: org.trips?.length || 0,
        compliance_rate: 85, // TODO: Calculate from actual compliance data
        created_at: org.created_at
      })) || []

      setOrganizations(processedOrgs)

      // Fetch all users
      const { data: usersData } = await supabase
        .from('users')
        .select(`
          id,
          email,
          role,
          org_id,
          is_verified,
          created_at,
          profiles(full_name),
          last_sign_in
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      const processedUsers = usersData?.map((user: any) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.profiles?.full_name,
        org_id: user.org_id,
        is_verified: user.is_verified,
        created_at: user.created_at,
        last_sign_in: user.last_sign_in
      })) || []

      setUsers(processedUsers)

      // Calculate global stats
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      
      const { count: totalTrips } = await supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })

      const { count: criticalFailures } = await supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })
        .eq('has_critical_failures', true)
        .gte('created_at', thirtyDaysAgo)

      setStats({
        totalOrganizations: processedOrgs.length,
        totalUsers: processedUsers.length,
        totalTrips: totalTrips || 0,
        overallCompliance: 87, // TODO: Calculate from actual data
        criticalFailures30Days: criticalFailures || 0
      })

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    try {
      if (!newUser.email || !newUser.role) {
        return
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newUser.email,
        email_confirm: true,
        user_metadata: {
          full_name: newUser.full_name,
          role: newUser.role
        }
      })

      if (authError) throw authError

      // Create user profile
      if (authData.user) {
        await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: newUser.email,
            role: newUser.role,
            is_verified: true // Admin-created users are pre-verified
          })

        // Create profile entry
        await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            full_name: newUser.full_name
          })
      }

      setShowAddUserModal(false)
      setNewUser({ email: "", role: "", full_name: "" })
      fetchDashboardData()

    } catch (error) {
      console.error('Error adding user:', error)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesVerification = verificationFilter === "all" || 
                              (verificationFilter === "verified" && user.is_verified) ||
                              (verificationFilter === "unverified" && !user.is_verified)
    
    return matchesSearch && matchesRole && matchesVerification
  })

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
              <Shield className="h-8 w-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={() => setShowAddUserModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add User
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
        {/* Global Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrganizations}</div>
              <p className="text-xs text-muted-foreground">Active fleets</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">All roles</p>
            </CardContent>
          </Card>

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
              <CardTitle className="text-sm font-medium">Overall Compliance</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.overallCompliance}%</div>
              <p className="text-xs text-muted-foreground">Platform average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Failures</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalFailures30Days}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Organizations Table */}
          <Card>
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>Fleet operations overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {organizations.slice(0, 5).map((org) => (
                  <div key={org.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-sm text-gray-500">{org.location}</p>
                      <p className="text-xs text-gray-400">
                        {org.drivers_count} drivers • {org.vehicles_count} vehicles • {org.trips_count} trips
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={org.compliance_rate >= 90 ? 'secondary' : org.compliance_rate >= 70 ? 'default' : 'destructive'}>
                        {org.compliance_rate}% compliant
                      </Badge>
                      <Button size="sm" variant="ghost" className="mt-1">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Platform users and verification status</CardDescription>
              <div className="flex space-x-2">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {Object.entries(ROLES).map(([key, value]) => (
                      <SelectItem key={value} value={value}>
                        {ROLE_DISPLAY_NAMES[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="unverified">Unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>{user.full_name?.charAt(0) || user.email.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.full_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <Badge variant={user.is_verified ? 'secondary' : 'destructive'}>
                          {user.is_verified ? 'Verified' : 'Unverified'}
                        </Badge>
                        <Badge variant="outline">
                          {ROLE_DISPLAY_NAMES[user.role as keyof typeof ROLE_DISPLAY_NAMES]}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Global Analytics */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Platform Analytics</CardTitle>
            <CardDescription>Global metrics and performance trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <h4 className="font-medium mb-2">User Distribution</h4>
                <div className="space-y-2">
                  {Object.entries(ROLES).map(([key, value]) => {
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
                <h4 className="font-medium mb-2">Verification Status</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Verified</span>
                    <span className="text-sm font-medium text-green-600">
                      {users.filter(u => u.is_verified).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Unverified</span>
                    <span className="text-sm font-medium text-red-600">
                      {users.filter(u => !u.is_verified).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Verification Rate</span>
                    <span className="text-sm font-medium">
                      {users.length > 0 ? Math.round((users.filter(u => u.is_verified).length / users.length) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium mb-2">Top Organizations</h4>
                <div className="space-y-2">
                  {organizations.slice(0, 3).map((org, index) => (
                    <div key={org.id} className="flex justify-between">
                      <span className="text-sm">{index + 1}. {org.name}</span>
                      <span className="text-sm font-medium">{org.trips_count} trips</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium mb-2">System Health</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">API Response</span>
                    <span className="text-sm font-medium text-green-600">Good</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Database</span>
                    <span className="text-sm font-medium text-green-600">Healthy</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Storage</span>
                    <span className="text-sm font-medium">45% used</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add New User</CardTitle>
              <CardDescription>Create a new user account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                  placeholder="Enter full name"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({...newUser, role: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLES).map(([key, value]) => (
                      <SelectItem key={value} value={value}>
                        {ROLE_DISPLAY_NAMES[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleAddUser} disabled={!newUser.email || !newUser.role}>
                  Create User
                </Button>
                <Button variant="ghost" onClick={() => setShowAddUserModal(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
