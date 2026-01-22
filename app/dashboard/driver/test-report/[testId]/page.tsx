'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TestService } from '@/lib/test-service'
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Download,
  Calendar,
  User,
  Award,
  TrendingUp
} from 'lucide-react'

export default function TestReportPage() {
  const [test, setTest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const router = useRouter()
  const params = useParams()
  const testService = new TestService()

  useEffect(() => {
    if (params.testId) {
      fetchTestReport(params.testId as string)
    }
  }, [params.testId])

  const fetchTestReport = async (testId: string) => {
    try {
      const testDetails = await testService.getTestDetails(testId)
      setTest(testDetails)
    } catch (error) {
      console.error('Error fetching test report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!test) return
    
    setDownloading(true)
    try {
      // Generate PDF content
      const pdfContent = generatePDFContent(test)
      
      // Create blob and download
      const blob = new Blob([pdfContent], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${test.test_type.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading PDF:', error)
    } finally {
      setDownloading(false)
    }
  }

  const generatePDFContent = (testData: any) => {
    // Simple PDF-like content (in a real app, you'd use a PDF library)
    return `
Test Report - ${testData.test_type}
=====================================

Test Information:
- Test ID: ${testData.id}
- Test Type: ${testData.test_type}
- Date Taken: ${new Date(testData.created_at).toLocaleDateString()}
- Completed: ${testData.completed_at ? new Date(testData.completed_at).toLocaleDateString() : 'N/A'}

Results:
- Status: ${testData.status}
- Score: ${testData.score || 'N/A'}%
- Pass/Fail: ${testData.pass_fail_status || 'N/A'}

Questions and Answers:
${testData.questions?.map((q: any, index: number) => `
Q${index + 1}: ${q.question}
Your Answer: ${testData.answers?.[index] || 'Not answered'}
Correct Answer: ${q.correct_answer}
${testData.answers?.[index] === q.correct_answer ? '✓ Correct' : '✗ Incorrect'}
`).join('\n') || 'No detailed questions available'}

Generated on: ${new Date().toLocaleString()}
    `
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Test Not Found</h2>
          <p className="text-gray-600 mb-6">The requested test report could not be found.</p>
          <Button onClick={() => router.push('/dashboard/driver')}>
            Back to Dashboard
          </Button>
        </div>
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
                <h1 className="text-xl font-bold text-gray-900">Test Report</h1>
                <p className="text-sm text-gray-500">{test.test_type}</p>
              </div>
            </div>
            <Button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Test Overview */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{test.test_type}</CardTitle>
                <CardDescription className="flex items-center space-x-4">
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(test.created_at).toLocaleDateString()}
                  </span>
                  {test.completed_at && (
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Completed {new Date(test.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </CardDescription>
              </div>
              <Badge className={`flex items-center space-x-1 ${getStatusColor(test.status)}`}>
                {getStatusIcon(test.status)}
                <span className="capitalize">{test.status.replace('_', ' ')}</span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className={`text-3xl font-bold mb-1 ${
                  test.score && test.score >= 80 ? 'text-green-600' : 
                  test.score && test.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {test.score || 'N/A'}%
                </div>
                <div className="text-sm text-gray-500">Score</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold mb-1 ${
                  test.pass_fail_status === 'pass' ? 'text-green-600' : 
                  test.pass_fail_status === 'fail' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {test.pass_fail_status ? test.pass_fail_status.toUpperCase() : 'N/A'}
                </div>
                <div className="text-sm text-gray-500">Result</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1 text-gray-900">
                  {test.questions?.length || 'N/A'}
                </div>
                <div className="text-sm text-gray-500">Questions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Questions */}
        {test.questions && test.questions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Question Details
              </CardTitle>
              <CardDescription>
                Review your answers and the correct responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {test.questions.map((question: any, index: number) => {
                  const userAnswer = test.answers?.[index]
                  const isCorrect = userAnswer === question.correct_answer
                  
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-2">
                            Question {index + 1}
                          </h4>
                          <p className="text-gray-700">{question.question}</p>
                        </div>
                        <Badge className={`ml-4 ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Your Answer: </span>
                          <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                            {userAnswer || 'Not answered'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Correct Answer: </span>
                          <span className="text-green-700">{question.correct_answer}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Summary */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Test Statistics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Questions:</span>
                    <span className="font-medium">{test.questions?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Correct Answers:</span>
                    <span className="font-medium text-green-600">
                      {test.questions?.filter((q: any, i: number) => test.answers?.[i] === q.correct_answer).length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy:</span>
                    <span className="font-medium">
                      {test.questions?.length ? 
                        Math.round((test.questions.filter((q: any, i: number) => test.answers?.[i] === q.correct_answer).length / test.questions.length) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Recommendations</h4>
                <div className="space-y-2">
                  {test.score && test.score >= 80 ? (
                    <p className="text-green-700 text-sm">
                      ✓ Excellent performance! Keep up the great work.
                    </p>
                  ) : test.score && test.score >= 60 ? (
                    <p className="text-yellow-700 text-sm">
                      ⚠ Good effort. Review the incorrect answers to improve.
                    </p>
                  ) : (
                    <p className="text-red-700 text-sm">
                      ⚠ Additional training recommended. Please review all materials.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
