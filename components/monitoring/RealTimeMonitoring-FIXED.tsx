'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Gauge,
  Activity,
  Bell,
  Eye,
  AlertCircle
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface RealTimeMonitoringProps {
  tripId: string
  driverId?: string
  className?: string
}

interface GPSData {
  latitude: number
  longitude: number
  speed: number
  heading: number
  timestamp: string
}

interface Alert {
  id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical' | 'emergency'
  title: string
  message: string
  acknowledged: boolean
  acknowledged_by?: string
  acknowledged_at?: string
  alert_timestamp: string
  driver_id: string
  supervisor_id?: string
}

interface Violation {
  id: string
  recorded_speed: number
  speed_limit: number
  violation_type: string
  severity: 'minor' | 'major' | 'critical'
  violation_timestamp: string
  driver_id: string
  auto_resolved: boolean
}

interface FatigueData {
  fatigue_score: number
  alert_level: 'normal' | 'caution' | 'warning' | 'critical'
  recommendation?: string
  hours_driven?: number
  hours_on_duty?: number
  rest_hours?: number
}

export default function RealTimeMonitoring({ 
  tripId, 
  driverId, 
  className 
}: RealTimeMonitoringProps) {
  const [gpsData, setGpsData] = useState<GPSData | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [violations, setViolations] = useState<Violation[]>([])
  const [fatigueData, setFatigueData] = useState<FatigueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [userRole, setUserRole] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  // Get current user session and role
  useEffect(() => {
    const getUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
        
        // Get user role from profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        if (profile) {
          setUserRole(profile.role)
        }
      }
    }
    
    getUserSession()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session?.user) {
        setUserId(session.user.id)
        getUserSession()
      } else {
        setUserId('')
        setUserRole('')
      }
    })
    
    return () => subscription.unsubscribe()
  }, [supabase])

  // Fetch real-time data with proper authentication
  const fetchMonitoringData = async () => {
    try {
      setLoading(true)
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('User not authenticated')
      }
      
      const response = await fetch(`/api/trips/${tripId}/monitoring?include_gps=true&include_violations=true&include_fatigue=true&include_alerts=true`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Validate data structure and permissions
        if (data.success && data.data) {
          setGpsData(data.data.currentLocation)
          setAlerts(data.data.activeAlerts || [])
          setViolations(data.data.speedViolations || [])
          setFatigueData(data.data.currentFatigueLevel)
          setLastUpdate(new Date())
        } else {
          throw new Error(data.error || 'Invalid response format')
        }
      } else if (response.status === 401) {
        throw new Error('Authentication failed - please log in again')
      } else if (response.status === 403) {
        throw new Error('Access denied - insufficient permissions')
      } else if (response.status === 404) {
        throw new Error('Trip not found or access denied')
      } else {
        throw new Error('Failed to fetch monitoring data')
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch real-time monitoring data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    if (tripId && userId) {
      fetchMonitoringData()
    }
  }, [tripId, userId])

  // Set up real-time subscription with proper RLS
  useEffect(() => {
    if (!tripId || !userId) return

    const channel = supabase
      .channel(`trip_${tripId}_monitoring_${userId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'real_time_alerts',
          filter: `trip_id=eq.${tripId}`
        }, 
        (payload: any) => {
          console.log('Real-time alert:', payload)
          // Only refresh if user has permission to see this alert
          if (payload.new && (
            payload.new.driver_id === userId || 
            payload.new.supervisor_id === userId ||
            userRole === 'admin'
          )) {
            fetchMonitoringData()
          }
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'speed_violations',
          filter: `trip_id=eq.${tripId}`
        },
        (payload: any) => {
          console.log('Real-time violation:', payload)
          // Only refresh if user has permission to see this violation
          if (payload.new && (
            payload.new.driver_id === userId ||
            userRole === 'admin'
          )) {
            fetchMonitoringData()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, userId, userRole, supabase])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!tripId || !userId) return

    const interval = setInterval(() => {
      fetchMonitoringData()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [tripId, userId])

  // Handle alert acknowledgment with proper permissions
  const acknowledgeAlert = async (alertId: string) => {
    try {
      // Check if user has permission to acknowledge this alert
      const alertToAcknowledge = alerts.find(a => a.id === alertId)
      if (!alertToAcknowledge) {
        throw new Error('Alert not found')
      }

      // Check permissions: drivers can acknowledge their own alerts, supervisors can acknowledge company alerts
      const canAcknowledge = 
        alertToAcknowledge.driver_id === userId ||
        alertToAcknowledge.supervisor_id === userId ||
        userRole === 'admin'

      if (!canAcknowledge) {
        throw new Error('You do not have permission to acknowledge this alert')
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('User not authenticated')
      }

      const response = await fetch(`/api/trips/${tripId}/monitoring/alerts/${alertId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          acknowledge: true,
          acknowledged_by: userId
        })
      })

      if (response.ok) {
        toast({
          title: "Alert Acknowledged",
          description: "Alert has been acknowledged successfully",
        })
        fetchMonitoringData()
      } else if (response.status === 403) {
        throw new Error('Access denied - insufficient permissions to acknowledge this alert')
      } else {
        throw new Error('Failed to acknowledge alert')
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to acknowledge alert",
        variant: "destructive"
      })
    }
  }

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'emergency': return 'bg-red-600 text-white'
      case 'critical': return 'bg-red-500 text-white'
      case 'warning': return 'bg-yellow-500 text-white'
      case 'major': return 'bg-orange-500 text-white'
      case 'minor': return 'bg-blue-500 text-white'
      case 'info': return 'bg-blue-400 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  // Get fatigue level color
  const getFatigueColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600'
      case 'warning': return 'text-orange-600'
      case 'caution': return 'text-yellow-600'
      default: return 'text-green-600'
    }
  }

  // Check if user can acknowledge alerts
  const canAcknowledgeAlerts = () => {
    return userRole && ['admin', 'supervisor', 'driver'].includes(userRole)
  }

  // Filter alerts based on user permissions
  const getFilteredAlerts = () => {
    if (userRole === 'admin') {
      return alerts
    }
    
    return alerts.filter(alert => 
      alert.driver_id === userId || 
      alert.supervisor_id === userId
    )
  }

  // Filter violations based on user permissions
  const getFilteredViolations = () => {
    if (userRole === 'admin') {
      return violations
    }
    
    return violations.filter(violation => violation.driver_id === userId)
  }

  if (!userId) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Please log in to view monitoring data</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading monitoring data...</span>
      </div>
    )
  }

  const filteredAlerts = getFilteredAlerts()
  const filteredViolations = getFilteredViolations()

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Real-Time Monitoring</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchMonitoringData}
            disabled={loading}
          >
            <Activity className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Current Location */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Location</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {gpsData ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {gpsData.speed.toFixed(1)} km/h
                </div>
                <div className="text-xs text-muted-foreground">
                  Heading: {gpsData.heading.toFixed(0)}°
                </div>
                <div className="text-xs text-muted-foreground">
                  Lat: {gpsData.latitude.toFixed(6)}, Lng: {gpsData.longitude.toFixed(6)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(gpsData.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No GPS data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fatigue Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Driver Fatigue</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {fatigueData ? (
              <div className="space-y-2">
                <div className={`text-2xl font-bold ${getFatigueColor(fatigueData.alert_level)}`}>
                  {fatigueData.alert_level.toUpperCase()}
                </div>
                <div className="text-xs text-muted-foreground">
                  Score: {fatigueData.fatigue_score.toFixed(1)}
                </div>
                {fatigueData.hours_driven && (
                  <div className="text-xs text-muted-foreground">
                    Hours driven: {fatigueData.hours_driven.toFixed(1)}
                  </div>
                )}
                {fatigueData.recommendation && (
                  <div className="text-xs text-muted-foreground">
                    {fatigueData.recommendation}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No fatigue data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {filteredAlerts.filter(a => !a.acknowledged).length}
              </div>
              <div className="text-xs text-muted-foreground">
                Unacknowledged alerts
              </div>
              <div className="flex flex-wrap gap-1">
                {filteredAlerts.slice(0, 3).map((alert) => (
                  <Badge 
                    key={alert.id} 
                    variant="secondary" 
                    className={`text-xs ${getSeverityColor(alert.severity)}`}
                  >
                    {alert.severity}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Speed Violations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Speed Violations</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {filteredViolations.length}
              </div>
              <div className="text-xs text-muted-foreground">
                Total violations
              </div>
              <div className="flex flex-wrap gap-1">
                {filteredViolations.filter(v => v.severity === 'critical').length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {filteredViolations.filter(v => v.severity === 'critical').length} Critical
                  </Badge>
                )}
                {filteredViolations.filter(v => v.severity === 'major').length > 0 && (
                  <Badge variant="secondary" className="text-xs bg-orange-500">
                    {filteredViolations.filter(v => v.severity === 'major').length} Major
                  </Badge>
                )}
                {filteredViolations.filter(v => v.severity === 'minor').length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {filteredViolations.filter(v => v.severity === 'minor').length} Minor
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Alerts</CardTitle>
            <CardDescription>
              Latest alerts and notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No active alerts
                </div>
              ) : (
                filteredAlerts.slice(0, 5).map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      alert.acknowledged ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${getSeverityColor(alert.severity)}`} />
                      <div>
                        <div className="font-medium text-sm">{alert.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(alert.alert_timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {!alert.acknowledged && canAcknowledgeAlerts() && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Acknowledge
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Violations */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Violations</CardTitle>
            <CardDescription>
              Latest speed violations and infractions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredViolations.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No violations recorded
                </div>
              ) : (
                filteredViolations.slice(0, 5).map((violation) => (
                  <div 
                    key={violation.id} 
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${getSeverityColor(violation.severity)}`} />
                      <div>
                        <div className="font-medium text-sm">
                          {violation.recorded_speed} km/h (Limit: {violation.speed_limit} km/h)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {violation.violation_type} • {new Date(violation.violation_timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getSeverityColor(violation.severity)}`}
                    >
                      {violation.severity}
                    </Badge>
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
