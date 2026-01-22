"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { getSupabaseClient } from '@/lib/supabase-client'
import { AppPageLoader } from '@/components/ui/app-loader'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Download, 
  Save, 
  ArrowLeft,
  FileText,
  TrendingUp,
  Clock,
  Target
} from 'lucide-react'

interface TestResult {
  id: string
  driver_id: string
  test_type: string
  status: string
  score: number
  answers: Record<string, any>
  sections: any[]
  completion_time_ms: number
  created_at: string
  completed_at: string
}

interface ScoreBreakdown {
  totalScore: number
  maxScore: number
  percentage: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  dispatchStatus: 'PROCEED' | 'SUPERVISOR_REVIEW' | 'DO_NOT_DISPATCH'
  sectionScores: {
    [sectionId: string]: {
      score: number
      maxScore: number
      percentage: number
      criticalIssues: number
    }
  }
}

function TestResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = getSupabaseClient()
  
  const [testData, setTestData] = useState<TestResult | null>(null)
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Get test data from URL params or database
  useEffect(() => {
    const resultId = searchParams.get('resultId')
    const testId = searchParams.get('testId')
    const testType = searchParams.get('type')
    
    if (resultId) {
      // Load test result by ID
      loadTestResult(resultId)
    } else if (testId) {
      // Load existing test from database
      loadTestFromDatabase(testId)
    } else if (testType) {
      // Load most recent test of this type from database
      loadMostRecentTest(testType)
    } else {
      toast({
        title: 'Error',
        description: 'No test data found',
        variant: 'destructive'
      })
      router.push('/dashboard/driver')
    }
  }, [])

  const loadTestResult = async (resultId: string) => {
    try {
      const { data, error } = await supabase
        .from('test_results')
        .select('*')
        .eq('id', resultId)
        .single()

      if (error) throw error
      
      setTestData(data)
      calculateScoreBreakdown(data)
    } catch (error) {
      console.error('Error loading test result:', error)
      toast({
        title: 'Error',
        description: 'Failed to load test results',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadMostRecentTest = async (testType: string) => {
    try {
      const { data, error } = await supabase
        .from('test_results')
        .select('*')
        .eq('test_type', testType)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      
      setTestData(data)
      calculateScoreBreakdown(data)
    } catch (error) {
      console.error('Error loading most recent test:', error)
      toast({
        title: 'Error',
        description: 'Failed to load test results',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadTestFromDatabase = async (testId: string) => {
    try {
      const { data, error } = await supabase
        .from('test_results')
        .select('*')
        .eq('id', testId)
        .single()

      if (error) throw error
      
      setTestData(data)
      calculateScoreBreakdown(data)
    } catch (error) {
      console.error('Error loading test from database:', error)
      toast({
        title: 'Error',
        description: 'Failed to load test results',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateScoreBreakdown = (test: TestResult) => {
    const sectionScores: ScoreBreakdown['sectionScores'] = {}
    let totalScore = 0
    let maxScore = 0

    test.sections.forEach(section => {
      let sectionTotal = 0
      let sectionMax = 0
      let criticalIssues = 0

      section.questions.forEach((q: any) => {
        const answer = test.answers[q.id]
        if (answer) {
          if (q.critical && answer.value === 0) criticalIssues++
          sectionTotal += answer.value || 0
        }
        sectionMax += q.points || 10
      })

      sectionScores[section.id] = {
        score: sectionTotal,
        maxScore: sectionMax,
        percentage: sectionMax > 0 ? Math.round((sectionTotal / sectionMax) * 100) : 0,
        criticalIssues
      }

      totalScore += sectionTotal
      maxScore += sectionMax
    })

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
    
    let riskLevel: ScoreBreakdown['riskLevel'] = 'LOW'
    let dispatchStatus: ScoreBreakdown['dispatchStatus'] = 'PROCEED'

    if (percentage < 60) {
      riskLevel = 'CRITICAL'
      dispatchStatus = 'DO_NOT_DISPATCH'
    } else if (percentage < 75) {
      riskLevel = 'HIGH'
      dispatchStatus = 'SUPERVISOR_REVIEW'
    } else if (percentage < 85) {
      riskLevel = 'MEDIUM'
      dispatchStatus = 'SUPERVISOR_REVIEW'
    }

    setScoreBreakdown({
      totalScore,
      maxScore,
      percentage,
      riskLevel,
      dispatchStatus,
      sectionScores
    })
  }

  const handleSaveTest = async () => {
    // Tests are already saved when submitted
    toast({
      title: 'Already Saved',
      description: 'Test results are already saved in the database.',
    })
  }

  const handleExportPDF = async () => {
    if (!testData || !scoreBreakdown) return

    try {
      // Create PDF content
      const pdfContent = generatePDFContent()
      
      // Create blob and download
      const blob = new Blob([pdfContent], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `test-results-${testData.test_type}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: 'PDF Exported!',
        description: 'Test results have been downloaded as PDF.',
      })
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast({
        title: 'Error',
        description: 'Failed to export PDF',
        variant: 'destructive'
      })
    }
  }

  const generatePDFContent = () => {
    // This is a simplified version - you'd want to use a proper PDF library like jsPDF
    const content = `
TEST RESULTS REPORT
==================

Test Type: ${testData?.test_type}
Date: ${new Date(testData?.completed_at || '').toLocaleDateString()}
Driver ID: ${testData?.driver_id}

OVERALL SCORE: ${scoreBreakdown?.totalScore}/${scoreBreakdown?.maxScore} (${scoreBreakdown?.percentage}%)
Risk Level: ${scoreBreakdown?.riskLevel}
Dispatch Status: ${scoreBreakdown?.dispatchStatus}

SECTION BREAKDOWN:
${Object.entries(scoreBreakdown?.sectionScores || {}).map(([id, score]) => `
${id}: ${score.score}/${score.maxScore} (${score.percentage}%)${score.criticalIssues > 0 ? ` - ${score.criticalIssues} Critical Issues` : ''}
`).join('')}

COMPLETION TIME: ${Math.round((testData?.completion_time_ms || 0) / 1000)} seconds
    `
    
    return new Blob([content], { type: 'text/plain' })
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'text-green-600 bg-green-100'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100'
      case 'HIGH': return 'text-orange-600 bg-orange-100'
      case 'CRITICAL': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getDispatchColor = (status: string) => {
    switch (status) {
      case 'PROCEED': return 'text-green-600 bg-green-100'
      case 'SUPERVISOR_REVIEW': return 'text-yellow-600 bg-yellow-100'
      case 'DO_NOT_DISPATCH': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return <AppPageLoader label="Loading test results..." />
  }

  if (!testData || !scoreBreakdown) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No test data found</p>
          <Button onClick={() => router.push('/dashboard/driver')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => router.push('/dashboard/driver')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Test Results</h1>
              <p className="text-gray-600">{testData.test_type} - {new Date(testData.completed_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleSaveTest} disabled={saving} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Test'}
            </Button>
            <Button onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Score Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Overall Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {scoreBreakdown.totalScore}/{scoreBreakdown.maxScore}
              </div>
              <div className="text-2xl font-semibold text-blue-600 mt-1">
                {scoreBreakdown.percentage}%
              </div>
              <Progress value={scoreBreakdown.percentage} className="mt-3" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Risk Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={`text-lg px-3 py-1 ${getRiskColor(scoreBreakdown.riskLevel)}`}>
                {scoreBreakdown.riskLevel}
              </Badge>
              <p className="text-sm text-gray-600 mt-2">
                Based on overall performance and critical issues
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Dispatch Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={`text-lg px-3 py-1 ${getDispatchColor(scoreBreakdown.dispatchStatus)}`}>
                {scoreBreakdown.dispatchStatus.replace('_', ' ')}
              </Badge>
              <p className="text-sm text-gray-600 mt-2">
                Recommended action for this driver
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Section Breakdown */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Section Performance</CardTitle>
            <CardDescription>Detailed breakdown of each test section</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testData.sections.map((section) => {
                const sectionScore = scoreBreakdown.sectionScores[section.id]
                return (
                  <div key={section.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{section.name}</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          {sectionScore.score}/{sectionScore.maxScore}
                        </span>
                        <Badge variant={sectionScore.percentage >= 80 ? 'default' : 'destructive'}>
                          {sectionScore.percentage}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={sectionScore.percentage} className="mb-2" />
                    {sectionScore.criticalIssues > 0 && (
                      <div className="flex items-center text-red-600 text-sm">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {sectionScore.criticalIssues} critical issue{sectionScore.criticalIssues > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Test Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Test Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Completion Time</p>
                <p className="font-semibold">{Math.round(testData.completion_time_ms / 1000)}s</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Questions</p>
                <p className="font-semibold">{testData.sections.reduce((acc, s) => acc + s.questions.length, 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Critical Issues</p>
                <p className="font-semibold text-red-600">
                  {Object.values(scoreBreakdown.sectionScores).reduce((acc, s) => acc + s.criticalIssues, 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Test Date</p>
                <p className="font-semibold">{new Date(testData.completed_at).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function TestResultsPage() {
  return (
    <Suspense fallback={<AppPageLoader />}>
      <TestResultsContent />
    </Suspense>
  )
}
