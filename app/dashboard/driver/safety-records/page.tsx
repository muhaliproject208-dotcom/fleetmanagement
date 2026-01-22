'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TestService, TestAttempt, TestMetrics } from '@/lib/test-service'
import { 
  ArrowLeft, 
  Shield, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  Award,
  Calendar,
  BarChart3,
  Activity
} from 'lucide-react'

export default function SafetyRecordsPage() {
  const router = useRouter()
  const testService = new TestService()
  
  const [tests, setTests] = useState<TestAttempt[]>([])
  const [metrics, setMetrics] = useState<TestMetrics>({
    totalTests: 0,
    completedTests: 0,
    pendingTests: 0,
    successRate: 0
  })
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId')
    if (storedUserId) {
      setUserId(storedUserId)
      fetchSafetyRecords(storedUserId)
    } else {
      router.push('/auth')
    }
  }, [])

  const fetchSafetyRecords = async (driverId: string) => {
    try {
      setLoading(true)
      const testHistory = await testService.getComprehensiveTestHistory(driverId)
      setTests(testHistory)
      setMetrics(testService.calculateMetrics(testHistory))
    } catch (error) {
      console.error('Error fetching safety records:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'failed': return <AlertTriangle className="h-4 w-4" />
      case 'pending': return <Clock className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const handleViewReport = (testId: string) => {
    router.push(`/dashboard/driver/test-report/${testId}`)
  }

  const handleResumeTest = (testId: string) => {
    router.push(`/dashboard/driver/test?id=${testId}`)
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
                <h1 className="text-xl font-bold text-gray-900">Safety Records</h1>
                <p className="text-sm text-gray-500">Your safety assessment history and compliance data</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 rounded-lg p-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{metrics.totalTests}</span>
              </div>
              <h3 className="text-gray-900 font-semibold mb-1">Total Tests</h3>
              <p className="text-gray-500 text-sm">All assessments</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 rounded-lg p-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{metrics.completedTests}</span>
              </div>
              <h3 className="text-gray-900 font-semibold mb-1">Completed</h3>
              <p className="text-gray-500 text-sm">Passed tests</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-yellow-100 rounded-lg p-3">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{metrics.pendingTests}</span>
              </div>
              <h3 className="text-gray-900 font-semibold mb-1">Pending</h3>
              <p className="text-gray-500 text-sm">In progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-emerald-100 rounded-lg p-3">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{metrics.successRate}%</span>
              </div>
              <h3 className="text-gray-900 font-semibold mb-1">Success Rate</h3>
              <p className="text-gray-500 text-sm">Pass percentage</p>
            </CardContent>
          </Card>
        </div>

        {/* Test History */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Test History</h2>
              <p className="text-gray-600">Your complete safety assessment record</p>
            </div>
            <Button onClick={() => fetchSafetyRecords(userId)} variant="outline">
              Refresh
            </Button>
          </div>

          {tests.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                  <Shield className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Safety Records Yet</h3>
                <p className="text-gray-600 mb-6">
                  Start your first safety assessment to begin building your compliance record.
                </p>
                <Button onClick={() => router.push('/dashboard/driver')} className="bg-green-600 hover:bg-green-700 text-white">
                  <FileText className="h-4 w-4 mr-2" />
                  Start Pre-Tip Test
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tests.map((test) => (
                <Card key={test.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-1">{test.test_type}</h4>
                        <p className="text-gray-500 text-sm">
                          {new Date(test.started_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(test.status)}`}>
                        {getStatusIcon(test.status)}
                        <span className="capitalize">{test.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {test.score && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-sm">Score</span>
                          <span className={`font-semibold ${getScoreColor(test.score)}`}>
                            {test.score}%
                          </span>
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
                        onClick={() => test.status === 'pending' ? handleResumeTest(test.id) : handleViewReport(test.id)}
                      >
                        {test.status === 'pending' ? 'Resume Test' : 'View Report'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
