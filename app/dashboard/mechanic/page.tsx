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
import { Textarea } from "@/components/ui/textarea"
import { 
  Wrench, AlertTriangle, CheckCircle, Clock, Calendar, Filter, 
  Search, Wrench as Tool, Car, Settings, Activity, TrendingUp, FileText
} from "lucide-react"

interface VehicleFailure {
  id: string
  vehicle_id: string
  vehicle_name: string
  trip_date: string
  module: string
  failure_description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'in_progress' | 'resolved'
  reported_at: string
  resolved_at?: string
  mechanic_notes?: string
}

interface MaintenanceSchedule {
  id: string
  vehicle_id: string
  vehicle_name: string
  scheduled_date: string
  maintenance_type: string
  status: 'scheduled' | 'in_progress' | 'completed'
  estimated_duration: string
}

export default function MechanicDashboard() {
  const [user, setUser] = useState<any>(null)
  const [failures, setFailures] = useState<VehicleFailure[]>([])
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedFailure, setSelectedFailure] = useState<VehicleFailure | null>(null)
  const [mechanicNotes, setMechanicNotes] = useState("")
  const router = useRouter()
  const supabase = getSupabaseClient()

  // Quick stats
  const [stats, setStats] = useState({
    vehiclesAssigned: 0,
    criticalFailuresToday: 0,
    criticalFailuresWeek: 0,
    upcomingMaintenance: 0
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

      // Fetch vehicle failures
      const { data: failuresData } = await supabase
        .from('vehicle_failures')
        .select(`
          id,
          vehicle_id,
          vehicles(name),
          trip_date,
          module,
          failure_description,
          severity,
          status,
          reported_at,
          resolved_at,
          mechanic_notes
        `)
        .in('status', ['pending', 'in_progress'])
        .order('reported_at', { ascending: false })
        .limit(50)

      const processedFailures = failuresData?.map((failure: any) => ({
        id: failure.id,
        vehicle_id: failure.vehicle_id,
        vehicle_name: failure.vehicles?.name || 'Unknown Vehicle',
        trip_date: failure.trip_date,
        module: failure.module,
        failure_description: failure.failure_description,
        severity: failure.severity,
        status: failure.status,
        reported_at: failure.reported_at,
        resolved_at: failure.resolved_at,
        mechanic_notes: failure.mechanic_notes
      })) || []

      setFailures(processedFailures)

      // Fetch maintenance schedules
      const { data: schedulesData } = await supabase
        .from('maintenance_schedules')
        .select(`
          id,
          vehicle_id,
          vehicles(name),
          scheduled_date,
          maintenance_type,
          status,
          estimated_duration
        `)
        .gte('scheduled_date', new Date().toISOString())
        .order('scheduled_date', { ascending: true })
        .limit(20)

      const processedSchedules = schedulesData?.map((schedule: any) => ({
        id: schedule.id,
        vehicle_id: schedule.vehicle_id,
        vehicle_name: schedule.vehicles?.name || 'Unknown Vehicle',
        scheduled_date: schedule.scheduled_date,
        maintenance_type: schedule.maintenance_type,
        status: schedule.status,
        estimated_duration: schedule.estimated_duration
      })) || []

      setSchedules(processedSchedules)

      // Calculate stats
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      setStats({
        vehiclesAssigned: new Set(processedFailures.map((f: any) => f.vehicle_id)).size,
        criticalFailuresToday: processedFailures.filter((f: any) => 
          f.severity === 'critical' && f.reported_at.split('T')[0] === today
        ).length,
        criticalFailuresWeek: processedFailures.filter((f: any) => 
          f.severity === 'critical' && f.reported_at >= weekAgo
        ).length,
        upcomingMaintenance: processedSchedules.filter((s: any) => s.status === 'scheduled').length
      })

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateFailureStatus = async (failureId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus }
      
      if (newStatus === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
        updateData.mechanic_notes = mechanicNotes
      } else if (newStatus === 'in_progress') {
        updateData.mechanic_notes = mechanicNotes
      }

      await supabase
        .from('vehicle_failures')
        .update(updateData)
        .eq('id', failureId)
      
      fetchDashboardData()
      setSelectedFailure(null)
      setMechanicNotes("")
    } catch (error) {
      console.error('Error updating failure status:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'destructive'
      case 'in_progress': return 'default'
      case 'resolved': return 'secondary'
      case 'scheduled': return 'secondary'
      case 'completed': return 'secondary'
      default: return 'secondary'
    }
  }

  const filteredFailures = failures.filter(failure =>
    failure.vehicle_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    failure.failure_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    failure.module.toLowerCase().includes(searchTerm.toLowerCase())
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
              <Wrench className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Mechanic Dashboard</h1>
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
              <CardTitle className="text-sm font-medium">Vehicles Assigned</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.vehiclesAssigned}</div>
              <p className="text-xs text-muted-foreground">Active maintenance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Failures Today</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalFailuresToday}</div>
              <p className="text-xs text-muted-foreground">Need immediate attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Failures This Week</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.criticalFailuresWeek}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Maintenance</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.upcomingMaintenance}</div>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Vehicle Failure Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Failure Reports</CardTitle>
              <CardDescription>Reported issues requiring attention</CardDescription>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    placeholder="Search failures..."
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
                {filteredFailures.slice(0, 6).map((failure) => (
                  <div key={failure.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{failure.vehicle_name}</p>
                        <p className="text-sm text-gray-500">{failure.module}</p>
                        <p className="text-xs text-gray-400">{failure.trip_date}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Badge variant={getSeverityColor(failure.severity)}>
                          {failure.severity}
                        </Badge>
                        <Badge variant={getStatusColor(failure.status)}>
                          {failure.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{failure.failure_description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        Reported: {new Date(failure.reported_at).toLocaleDateString()}
                      </span>
                      <Button 
                        size="sm" 
                        onClick={() => setSelectedFailure(failure)}
                        variant={failure.status === 'pending' ? 'default' : 'outline'}
                      >
                        {failure.status === 'pending' ? 'Start Work' : 'Update'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Schedule</CardTitle>
              <CardDescription>Upcoming vehicle inspections and repairs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {schedules.slice(0, 6).map((schedule) => (
                  <div key={schedule.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{schedule.vehicle_name}</p>
                        <p className="text-sm text-gray-500">{schedule.maintenance_type}</p>
                        <p className="text-xs text-gray-400">
                          Scheduled: {new Date(schedule.scheduled_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={getStatusColor(schedule.status)}>
                          {schedule.status.replace('_', ' ')}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          Est. {schedule.estimated_duration}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {schedule.status === 'scheduled' ? 'Ready to start' : 'In progress'}
                      </span>
                      <Button size="sm" variant="outline">
                        <Tool className="h-4 w-4 mr-1" />
                        Manage
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Failure Details Modal */}
        {selectedFailure && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>Update Failure Status</CardTitle>
                <CardDescription>{selectedFailure.vehicle_name} - {selectedFailure.module}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Failure Description</Label>
                  <p className="text-sm text-gray-700 mt-1">{selectedFailure.failure_description}</p>
                </div>
                
                <div>
                  <Label htmlFor="notes">Mechanic Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Enter your notes about the repair work..."
                    value={mechanicNotes}
                    onChange={(e) => setMechanicNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex space-x-2">
                  {selectedFailure.status === 'pending' && (
                    <Button onClick={() => handleUpdateFailureStatus(selectedFailure.id, 'in_progress')}>
                      <Clock className="h-4 w-4 mr-2" />
                      Start Work
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => handleUpdateFailureStatus(selectedFailure.id, 'resolved')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Resolved
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedFailure(null)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Maintenance Analytics</CardTitle>
            <CardDescription>Failure patterns and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <h4 className="font-medium mb-2">Failure Distribution</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Critical</span>
                    <span className="text-sm font-medium text-red-600">
                      {failures.filter(f => f.severity === 'critical').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">High</span>
                    <span className="text-sm font-medium text-orange-600">
                      {failures.filter(f => f.severity === 'high').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Medium</span>
                    <span className="text-sm font-medium">
                      {failures.filter(f => f.severity === 'medium').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Low</span>
                    <span className="text-sm font-medium">
                      {failures.filter(f => f.severity === 'low').length}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium mb-2">Resolution Rate</h4>
                <div className="text-3xl font-bold text-green-600">
                  {failures.length > 0 ? 
                    Math.round((failures.filter(f => f.status === 'resolved').length / failures.length) * 100) : 0}%
                </div>
                <p className="text-sm text-gray-500">This month</p>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium mb-2">Avg Resolution Time</h4>
                <div className="text-3xl font-bold text-blue-600">2.5 days</div>
                <p className="text-sm text-gray-500">Across all failures</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
