"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { AppPageLoader } from '@/components/ui/app-loader'
import { getSupabaseClient } from "@/lib/supabase-client"
import { 
  Truck,
  MapPin,
  AlertTriangle, 
  CheckCircle, 
  Clock 
} from "lucide-react"

interface Trip {
  id: string
  status: string
  aggregate_score: number
  risk_level: string
  trip_date: string
  route: string
}

export default function DriverTripsDashboard() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    fetchTrips()
  }, [])

  const fetchTrips = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching trips:', error)
      } else {
        setTrips(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="h-4 w-4" />
      case 'submitted': return <AlertTriangle className="h-4 w-4" />
      case 'approved': return <CheckCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  if (loading) {
    return <AppPageLoader label="Loading your trips..." />
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Trips</h1>
          <p className="text-gray-600 mt-2">Manage your pre-trip safety inspections</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {trips.filter(t => t.status === 'draft').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submitted</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {trips.filter(t => t.status === 'submitted').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {trips.filter(t => t.status === 'approved').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Trips</CardTitle>
            <CardDescription>Your latest pre-trip safety inspections</CardDescription>
          </CardHeader>
          <CardContent>
            {trips.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No trips yet</h3>
                <p className="text-gray-600 mb-4">Start your first pre-trip safety inspection</p>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Truck className="h-4 w-4 mr-2" />
                  Start New Trip
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {trips.map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(trip.status)}
                      <div>
                        <p className="font-medium text-gray-900">
                          {trip.route || `Trip ${trip.id.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(trip.trip_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(trip.risk_level)}`}>
                        {trip.risk_level?.toUpperCase() || 'UNKNOWN'}
                      </span>
                      <span className="text-sm font-medium">
                        Score: {trip.aggregate_score || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
