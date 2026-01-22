'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { useToast } from '@/components/ui/use-toast'
import { TestService, TestAttempt, TestMetrics, Schedule } from '@/lib/test-service'
import { 
  Truck, 
  FileText, 
  User, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Play,
  BarChart3,
  Settings,
  Bell,
  TrendingUp,
  Shield,
  MapPin,
  Calendar,
  Activity,
  Award,
  Zap,
  Navigation
} from 'lucide-react'

interface Test {
  id: string
  driver_id: string
  test_type: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  score?: number
  created_at: string
  completed_at?: string
}

interface UserProfile {
  id: string
  email: string
  full_name: string
  phone?: string
  license_number?: string
  role: string
  created_at: string
  avatar_url?: string
}

export default function DriverDashboard() {
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [tests, setTests] = useState<TestAttempt[]>([])
  const [metrics, setMetrics] = useState<TestMetrics>({
    totalTests: 0,
    completedTests: 0,
    pendingTests: 0,
    successRate: 0
  })
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const supabase = getSupabaseClient()
  const testService = new TestService()

  useEffect(() => {
    checkAuth()
  }, [])

  const fetchSchedules = async (driverId: string) => {
    try {
      setLoadingSchedules(true)
      const userSchedules = await testService.getUserSchedules(driverId)
      setSchedules(userSchedules)
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoadingSchedules(false)
    }
  }

  const fetchTests = async (driverId: string) => {
    try {
      const testHistory = await testService.getComprehensiveTestHistory(driverId)
      setTests(testHistory)
      setMetrics(testService.calculateMetrics(testHistory))
    } catch (error) {
      console.error('Error fetching tests:', error)
      toast({
        title: "Error",
        description: "Failed to load test history",
        variant: "destructive"
      })
    }
  }

  const refreshData = async () => {
    if (!user) return
    setRefreshing(true)
    await fetchTests(user.id)
    setRefreshing(false)
  }

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/auth')
        return
      }

      setUser(session.user)
      
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      const profileErrorObj = profileError as unknown as Record<string, unknown> | null
      const profileErrorHasMessage = !!profileErrorObj && typeof profileErrorObj.message === 'string' && profileErrorObj.message.length > 0
      const profileErrorHasCode = !!profileErrorObj && typeof profileErrorObj.code === 'string' && profileErrorObj.code.length > 0
      const profileErrorHasMeaningfulInfo = profileErrorHasMessage || profileErrorHasCode
      const isEmptyProfileError = !!profileErrorObj && !profileErrorHasMeaningfulInfo && Object.keys(profileErrorObj).length === 0

      if ((profileError && !isEmptyProfileError) || !profile) {
        if (profileError && !isEmptyProfileError) {
          console.error('Profile fetch error:', profileError)
        }
        
        // Handle RLS recursion error (42P17) by using API fallback
        if (profileError?.code === '42P17') {
          console.log('RLS recursion detected in dashboard, using API fallback')
          try {
            const response = await fetch(`/api/users?id=${session.user.id}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            })

            if (response.ok) {
              const data = await response.json()
              if (data.success && data.users && data.users.length > 0) {
                setUserProfile(data.users[0])
                await fetchTests(session.user.id)
                return
              }
            }
          } catch (apiError) {
            console.error('API fallback failed:', apiError)
          }
        }
        
        // Fallback to user metadata if profile fetch fails
        console.log('Using user metadata as fallback')
        const fallbackProfile = {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Driver',
          phone: session.user.user_metadata?.phone || '',
          license_number: session.user.user_metadata?.license_number || '',
          role: session.user.user_metadata?.role || 'driver',
          created_at: session.user.created_at || new Date().toISOString()
        }
        setUserProfile(fallbackProfile)
        
        // Don't show error toast for profile issues, just use fallback
        console.log('Using fallback profile data')
      } else {
        // If profile exists but no full_name, try to get it from profiles table
        if (!profile.profiles) {
          const { data: profileData, error: profileDataError } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('user_id', session.user.id)
            .single()
          
          if (!profileDataError && profileData) {
            profile.full_name = profileData.full_name
            profile.avatar_url = profileData.avatar_url
          }
        } else {
          profile.full_name = profile.profiles
        }
        
        setUserProfile(profile)
      }

      // Fetch comprehensive test history
      await fetchTests(session.user.id)
      
      // Fetch schedules for Quick Actions
      await fetchSchedules(session.user.id)

      // Set up real-time subscription for test updates
      const subscription = testService.subscribeToTestUpdates(session.user.id, (updatedTest) => {
        setTests(prevTests => {
          const newTests = prevTests.map(test => 
            test.id === updatedTest.id ? updatedTest : test
          )
          setMetrics(testService.calculateMetrics(newTests))
          return newTests
        })
      })

      return () => {
        subscription.unsubscribe()
      }

    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/auth')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarChange = (avatarUrl: string) => {
    if (userProfile) {
      setUserProfile({ ...userProfile, avatar_url: avatarUrl })
    }
  }

  const handleStartTest = async (testType: string) => {
    console.log('handleStartTest called with testType:', testType)
    console.log('User state:', user)
    
    if (!user) {
      console.error('No user found')
      toast({
        title: "Error",
        description: "User not authenticated. Please log in again.",
        variant: "destructive"
      })
      return
    }
    
    try {
      console.log('Creating test attempt for user:', user.id)
      // Create or resume a test attempt
      const testAttempt = await testService.createOrResumeTestAttempt(user.id, testType)
      console.log('Test attempt created:', testAttempt)
      
      // Refresh data to show the new test
      await refreshData()
      
      // Navigate to test page with attempt ID
      console.log('Navigating to test page with ID:', testAttempt.id)
      router.push(`/dashboard/driver/test?id=${testAttempt.id}&type=${testType}`)
    } catch (error) {
      console.error('Error starting test:', error)
      toast({
        title: "Error",
        description: "Failed to start test. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'failed': return <AlertCircle className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      case 'pending': return <Clock className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const handleViewTestReport = async (testId: string) => {
    router.push(`/dashboard/driver/test-report/${testId}`)
  }

  const handleViewSchedule = () => {
    router.push('/dashboard/driver/schedule')
  }

  const handleViewSafetyRecords = () => {
    router.push('/dashboard/driver/safety-records')
  }

  const handleResumeTest = async (testId: string) => {
    router.push(`/dashboard/driver/test?id=${testId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="bg-green-600 rounded-lg p-2">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">IFSM Driver Portal</h1>
                  <p className="text-xs text-gray-500">Fleet Safety Management</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Skeleton className="h-9 w-28 rounded-md" />
                <div className="h-8 w-px bg-gray-300"></div>
                <Skeleton className="h-9 w-20 rounded-md" />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="bg-green-600 rounded-lg p-2">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">IFSM Driver Portal</h1>
                <p className="text-xs text-gray-500">Fleet Safety Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Button>
              <div className="h-8 w-px bg-gray-300"></div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                {/* Avatar Section - Far Left */}
                <div className="flex-shrink-0">
                  <AvatarUpload
                    currentAvatar={userProfile?.avatar_url}
                    userId={user?.id || ''}
                    onAvatarChange={handleAvatarChange}
                    size="xl"
                  />
                </div>
                
                {/* Welcome Content */}
                <div>
                  <h2 className="text-3xl font-bold mb-2">
                    Welcome back, {userProfile?.full_name || 'Driver'}! 👋
                  </h2>
                  <p className="text-green-50 text-lg">
                    Ready for today's journey? Your safety is our priority.
                  </p>
                  <div className="flex items-center space-x-4 mt-4">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-green-100" />
                      <span className="text-sm text-green-100">Safety First</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-5 w-5 text-green-100" />
                      <span className="text-sm text-green-100">Route Optimized</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Zap className="h-5 w-5 text-green-100" />
                      <span className="text-sm text-green-100">Efficient Driving</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="hidden lg:block">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 border border-white/30">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white mb-1">
                      {metrics.completedTests}
                    </div>
                    <div className="text-sm text-green-100">Tests Completed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
            <nav className="flex space-x-1">
              {[{ id: 'overview', label: 'Overview', icon: BarChart3 }, { id: 'tests', label: 'My Tests', icon: FileText }, { id: 'profile', label: 'Profile', icon: User }].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  disabled={refreshing}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    activeTab === tab.id
                      ? 'bg-green-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Modern Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-green-100 rounded-lg p-3">
                    <FileText className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{metrics.totalTests}</span>
                </div>
                <h3 className="text-gray-900 font-semibold mb-1">Total Tests</h3>
                <p className="text-gray-500 text-sm">All time assessments</p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-green-100 rounded-lg p-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {metrics.completedTests}
                  </span>
                </div>
                <h3 className="text-gray-900 font-semibold mb-1">Completed</h3>
                <p className="text-gray-500 text-sm">Successfully passed</p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-yellow-100 rounded-lg p-3">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {metrics.pendingTests}
                  </span>
                </div>
                <h3 className="text-gray-900 font-semibold mb-1">Pending</h3>
                <p className="text-gray-500 text-sm">Awaiting completion</p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-emerald-100 rounded-lg p-3">
                    <TrendingUp className="h-6 w-6 text-emerald-600" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {metrics.successRate}%
                  </span>
                </div>
                <h3 className="text-gray-900 font-semibold mb-1">Success Rate</h3>
                <p className="text-gray-500 text-sm">Pass rate</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => handleStartTest('pre-trip')}
                  className="bg-green-600 hover:bg-green-700 text-white h-12"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Pre-Trip Test
                </Button>
                <Button 
                  onClick={handleViewSchedule}
                  variant="outline"
                  disabled={loadingSchedules}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 h-12"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {loadingSchedules ? 'Loading...' : schedules.length > 0 ? `View Schedule (${schedules.length})` : 'View Schedule'}
                </Button>
                <Button 
                  onClick={handleViewSafetyRecords}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 h-12"
                >
                  <Award className="h-4 w-4 mr-2" />
                  Safety Records
                </Button>
              </div>
              
              {/* Schedule Preview */}
              {schedules.length > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Upcoming Schedule</h4>
                  <div className="space-y-2">
                    {schedules.slice(0, 2).map((schedule) => (
                      <div key={schedule.id} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{schedule.route_name}</span>
                        <span className="text-gray-900">
                          {new Date(schedule.shift_date).toLocaleDateString()} • {schedule.start_time}
                        </span>
                      </div>
                    ))}
                    {schedules.length > 2 && (
                      <div className="text-sm text-gray-500">
                        +{schedules.length - 2} more assignments
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Test History</h3>
                <p className="text-gray-600">Track your safety assessments and progress</p>
              </div>
              <Button 
                onClick={() => handleStartTest('pre-trip')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Play className="h-4 w-4 mr-2" />
                Start New Test
              </Button>
            </div>

            {tests.length === 0 ? (
              <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
                <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Tests Yet</h3>
                <p className="text-gray-600 mb-6">Start your first pre-trip safety assessment to begin tracking your compliance.</p>
                <Button 
                  onClick={() => handleStartTest('pre-trip')}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Pre-Trip Test
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tests.map((test) => (
                  <div key={test.id} className="bg-white rounded-xl border border-gray-200 hover:border-green-300 transition-all hover:shadow-md">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-1">{test.test_type}</h4>
                          <p className="text-gray-500 text-sm">
                            {new Date(test.created_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${
                          test.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                          test.status === 'failed' ? 'bg-red-100 text-red-700 border border-red-200' :
                          test.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        }`}>
                          {getStatusIcon(test.status)}
                          <span className="capitalize">{test.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {test.score && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">Score</span>
                            <span className={`font-semibold ${
                              test.score >= 80 ? 'text-green-600' : 
                              test.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>{test.score}%</span>
                          </div>
                        )}
                        {test.completed_at && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">Completed</span>
                            <span className="text-gray-900 text-sm">
                              {new Date(test.completed_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {test.progress && test.progress > 0 && test.status === 'pending' && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">Progress</span>
                            <span className="text-gray-900 text-sm">{test.progress}%</span>
                          </div>
                        )}
                        <Button 
                          variant="outline" 
                          className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                          onClick={() => test.status === 'pending' ? handleResumeTest(test.id) : handleViewTestReport(test.id)}
                        >
                          {test.status === 'pending' ? 'Resume Test' : 'View Report'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && userProfile && (
          <div className="max-w-4xl">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <AvatarUpload
                      currentAvatar={userProfile?.avatar_url}
                      userId={user?.id || ''}
                      onAvatarChange={handleAvatarChange}
                      size="lg"
                    />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Driver Profile</h3>
                      <p className="text-gray-600">Manage your personal information</p>
                    </div>
                  </div>
                  <Button className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900">
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Full Name</label>
                    <p className="text-gray-900 font-medium">{userProfile.full_name}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Email Address</label>
                    <p className="text-gray-900 font-medium">{userProfile.email}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Phone Number</label>
                    <p className="text-gray-900 font-medium">{userProfile.phone || 'Not provided'}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">License Number</label>
                    <p className="text-gray-900 font-medium">{userProfile.license_number || 'Not provided'}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Role</label>
                    <p className="text-gray-900 font-medium capitalize">{userProfile.role}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Member Since</label>
                    <p className="text-gray-900 font-medium">
                      {new Date(userProfile.created_at).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animation-delay-150 {
          animation-delay: 150ms;
        }
      `}</style>
    </div>
  )
}
