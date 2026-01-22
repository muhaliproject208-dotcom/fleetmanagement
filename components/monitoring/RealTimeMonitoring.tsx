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
  alert_timestamp: string
}

interface Violation {
  id: string
  recorded_speed: number
  speed_limit: number
  violation_type: string
  severity: 'minor' | 'major' | 'critical'
  violation_timestamp: string
}

interface FatigueData {
  fatigue_score: number
  alert_level: 'normal' | 'caution' | 'warning' | 'critical'
  recommendation?: string
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
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  // Fetch real-time data
  const fetchMonitoringData = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/trips/${tripId}/monitoring?include_gps=true&include_violations=true&include_fatigue=true&include_alerts=true`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${await supabase.auth.getSession().then((s: any) => s.data.session?.access_token)}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setGpsData(data.data.currentLocation)
        setAlerts(data.data.activeAlerts || [])
        setViolations(data.data.speedViolations || [])
        setFatigueData(data.data.currentFatigueLevel)
        setLastUpdate(new Date())
      } else {
        throw new Error('Failed to fetch monitoring data')
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error)
      toast({
        title: "Error",
        description: "Failed to fetch real-time monitoring data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchMonitoringData()
  }, [tripId])

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`trip_${tripId}_monitoring`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'real_time_alerts',
          filter: `trip_id=eq.${tripId}`
        }, 
        (payload: any) => {
          console.log('Real-time alert:', payload)
          fetchMonitoringData() // Refresh data on changes
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
          fetchMonitoringData() // Refresh data on changes
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, supabase])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchMonitoringData, 30000)
    return () => clearInterval(interval)
  }, [tripId])

  // Handle alert acknowledgment
  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/trips/${tripId}/monitoring/alerts/${alertId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await supabase.auth.getSession().then((s: any) => s.data.session?.access_token)}`
        },
        body: JSON.stringify({ acknowledge: true })
      })

      if (response.ok) {
        toast({
          title: "Alert Acknowledged",
          description: "Alert has been acknowledged successfully",
        })
        fetchMonitoringData()
      } else {
        throw new Error('Failed to acknowledge alert')
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      toast({
        title: "Error",
        description: "Failed to acknowledge alert",
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

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading monitoring data...</span>
      </div>
    )
  }

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
            <MapPin className="h-4 w-4 text-muted-foreground" />
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
                {alerts.filter(a => !a.acknowledged).length}
              </div>
              <div className="text-xs text-muted-foreground">
                Unacknowledged alerts
              </div>
              <div className="flex flex-wrap gap-1">
                {alerts.slice(0, 3).map((alert) => (
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
                {violations.length}
              </div>
              <div className="text-xs text-muted-foreground">
                Total violations
              </div>
              <div className="flex flex-wrap gap-1">
                {violations.filter(v => v.severity === 'critical').length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {violations.filter(v => v.severity === 'critical').length} Critical
                  </Badge>
                )}
                {violations.filter(v => v.severity === 'major').length > 0 && (
                  <Badge variant="secondary" className="text-xs bg-orange-500">
                    {violations.filter(v => v.severity === 'major').length} Major
                  </Badge>
                )}
                {violations.filter(v => v.severity === 'minor').length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {violations.filter(v => v.severity === 'minor').length} Minor
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
              {alerts.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No active alerts
                </div>
              ) : (
                alerts.slice(0, 5).map((alert) => (
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
                    {!alert.acknowledged && (
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
              {violations.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No violations recorded
                </div>
              ) : (
                violations.slice(0, 5).map((violation) => (
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
