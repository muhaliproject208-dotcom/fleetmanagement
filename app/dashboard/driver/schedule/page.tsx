'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProfileService, Schedule } from '@/lib/profile-service'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Car, 
  AlertCircle,
  CheckCircle,
  Truck
} from 'lucide-react'

export default function SchedulePage() {
  const router = useRouter()
  const profileService = new ProfileService()
  
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId')
    if (storedUserId) {
      setUserId(storedUserId)
      fetchSchedules(storedUserId)
    } else {
      router.push('/auth')
    }
  }, [])

  const fetchSchedules = async (driverId: string) => {
    try {
      setLoading(true)
      const userSchedules = await profileService.getUserSchedules(driverId)
      setSchedules(userSchedules)
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Calendar className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'cancelled': return <AlertCircle className="h-4 w-4" />
      default: return <Calendar className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Driver Schedule</h1>
                <p className="text-sm text-gray-500">View your assigned routes and shifts</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {schedules.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Scheduled Assignments</h3>
              <p className="text-gray-600 mb-6">
                You don't have any scheduled assignments at this time. Please check back later or contact your supervisor.
              </p>
              <Button onClick={() => router.push('/dashboard/driver')}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Your Schedule</h2>
                <p className="text-gray-600">{schedules.length} upcoming assignments</p>
              </div>
              <Button onClick={() => fetchSchedules(userId)} variant="outline">
                Refresh
              </Button>
            </div>

            <div className="grid gap-6">
              {schedules.map((schedule) => (
                <Card key={schedule.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 rounded-lg p-2">
                          <Truck className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{schedule.route_name}</CardTitle>
                          <CardDescription>
                            {schedule.vehicle_type} • {schedule.vehicle_plate || 'No plate'}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className={getStatusColor(schedule.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(schedule.status)}
                          <span className="capitalize">{schedule.status}</span>
                        </div>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Date</p>
                          <p className="font-medium">{new Date(schedule.shift_date).toLocaleDateString('en-US', { 
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Shift Time</p>
                          <p className="font-medium">{schedule.start_time} - {schedule.end_time}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Depot</p>
                          <p className="font-medium">{schedule.vehicle_id || 'Not specified'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          {schedule.status === 'scheduled' && 'Assignment scheduled'}
                          {schedule.status === 'in_progress' && 'Currently in progress'}
                          {schedule.status === 'completed' && 'Completed on ' + new Date(schedule.shift_date).toLocaleDateString()}
                          {schedule.status === 'cancelled' && 'Assignment cancelled'}
                        </p>
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
