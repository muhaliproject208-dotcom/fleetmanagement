'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { testSessionManager, TestSession } from '@/lib/test-session-manager'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { AppPageLoader } from '@/components/ui/app-loader'
import { 
  Truck, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  User,
  Heart,
  FileText,
  Car,
  Settings,
  Shield,
  CheckSquare,
  Activity
} from 'lucide-react'

interface TestQuestion {
  id: string
  question: string
  type: 'multiple_choice' | 'yes_no' | 'text' | 'pass_fail' | 'checkbox'
  options?: string[]
  required: boolean
  section?: string
  subsection?: string
  points?: number
  critical?: boolean
}

interface TestSection {
  id: string
  name: string
  description: string
  icon?: React.ReactNode
  questions: TestQuestion[]
}

interface TestModule {
  id: string
  name: string
  description: string
  sections: TestSection[]
}

function DriverTestPage() {
  const [user, setUser] = useState<any>(null)
  const [testModule, setTestModule] = useState<TestModule | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [startTime] = useState(Date.now())
  const [currentStep, setCurrentStep] = useState(0)
  const [testSession, setTestSession] = useState<TestSession | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  const testType = searchParams.get('type') || 'pre-trip'

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/auth')
        return
      }

      setUser(session.user)
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/auth')
    }
  }

  const loadTestModule = useCallback(async () => {
    try {
      // Comprehensive Pre-Trip Checklist organized into specific modules
      const mockTestModules: Record<string, TestModule> = {
        'pre-trip': {
          id: '1',
          name: 'Pre-Trip Safety Inspection',
          description: 'Complete this comprehensive safety inspection before starting your trip',
          sections: [
            {
              id: 'driver-info',
              name: 'Driver & Trip Information',
              description: 'Personal details and trip information',
              icon: <User className="h-5 w-5" />,
              questions: [
                {
                  id: 'operator-name',
                  question: "Operator's Name",
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'area-operation',
                  question: 'Area of Operation',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'station',
                  question: 'Station',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'routes',
                  question: 'Route/s',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'driver-name',
                  question: 'Driver Name',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'driver-id',
                  question: 'Driver ID',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'license-number',
                  question: 'License Number',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'vehicle-id',
                  question: 'Vehicle ID / Plate',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'vehicle-type',
                  question: 'Vehicle Type',
                  type: 'multiple_choice',
                  options: ['Freight Truck', 'Van', 'Bus', 'Car', 'Motorcycle', 'Other'],
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'date-of-trip',
                  question: 'Date of Trip',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'route',
                  question: 'Route',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'trip-duration',
                  question: 'Total Trip Duration',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'driving-hours',
                  question: 'Driving Hours',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                },
                {
                  id: 'rest-breaks',
                  question: 'Rest Breaks',
                  type: 'text',
                  required: true,
                  section: 'driver-info'
                }
              ]
            },
            {
              id: 'health-fitness',
              name: 'Health Fitness',
              description: 'Medical and fitness checks',
              icon: <Heart className="h-5 w-5" />,
              questions: [
                {
                  id: 'alcohol-test',
                  question: 'Alcohol Breath Test/Drugs',
                  type: 'pass_fail',
                  required: true,
                  section: 'health-fitness',
                  critical: true
                },
                {
                  id: 'temperature-check',
                  question: 'Temperature Check',
                  type: 'pass_fail',
                  required: true,
                  section: 'health-fitness'
                },
                {
                  id: 'vehicle-inspection-completed',
                  question: 'Vehicle Inspection Completed',
                  type: 'pass_fail',
                  required: true,
                  section: 'health-fitness'
                },
                {
                  id: 'fit-for-duty',
                  question: 'Driver Fit for Duty Declaration',
                  type: 'pass_fail',
                  required: true,
                  section: 'health-fitness',
                  critical: true
                },
                {
                  id: 'medication',
                  question: 'Medication',
                  type: 'yes_no',
                  required: true,
                  section: 'health-fitness'
                },
                {
                  id: 'no-health-issues',
                  question: 'No health issues that may impair driving',
                  type: 'pass_fail',
                  required: true,
                  section: 'health-fitness',
                  critical: true
                },
                {
                  id: 'fatigue-checklist',
                  question: 'Fatigue checklist completed',
                  type: 'pass_fail',
                  required: true,
                  section: 'health-fitness'
                },
                {
                  id: 'weather-road-checked',
                  question: 'Weather and road condition checked and acknowledged',
                  type: 'pass_fail',
                  required: true,
                  section: 'health-fitness'
                }
              ]
            },
            {
              id: 'documentation',
              name: 'Documentation/Compliance',
              description: 'Vehicle and driver paperwork verification',
              icon: <FileText className="h-5 w-5" />,
              questions: [
                {
                  id: 'certificate-of-fitness',
                  question: 'Certificate of fitness',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation',
                  critical: true
                },
                {
                  id: 'road-tax',
                  question: 'Road Tax (valid)',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'insurance',
                  question: 'Insurance',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation',
                  critical: true
                },
                {
                  id: 'trip-authorization',
                  question: 'Trip authorization form completed and signed',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'logbook',
                  question: 'Logbook',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'driver-handbook',
                  question: 'Driver Handbook',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'permits',
                  question: 'Permits',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'emergency-contacts',
                  question: 'Emergency Contacts and risk mitigation plan communicated',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'ppe',
                  question: 'Personal Protective Equipment (PPE)',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'route-familiarity',
                  question: 'Route Familiarity',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'emergency-procedures',
                  question: 'Emergency Procedures',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'gps-activated',
                  question: 'GPS/Trip monitoring system activated',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'safety-briefing',
                  question: 'Safety briefing provided',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                },
                {
                  id: 'rtsa-cleared',
                  question: 'Driver, vehicle & documentation cleared at the gate by RTSA',
                  type: 'pass_fail',
                  required: true,
                  section: 'documentation'
                }
              ]
            },
            {
              id: 'exterior-checks',
              name: 'Vehicle Checklist: Pre-trip Exterior Checks',
              description: 'External vehicle inspection',
              icon: <Car className="h-5 w-5" />,
              questions: [
                {
                  id: 'tires-check',
                  question: 'Tires: Check for proper inflation, tread depth, and visible damage',
                  type: 'pass_fail',
                  required: true,
                  section: 'exterior-checks',
                  critical: true
                },
                {
                  id: 'lights-check',
                  question: 'Lights: Ensure headlights, taillights, brake lights, turn signals, and hazard lights are operational',
                  type: 'pass_fail',
                  required: true,
                  section: 'exterior-checks',
                  critical: true
                },
                {
                  id: 'mirrors-check',
                  question: 'Mirrors: Verify mirrors are clean, properly adjusted, and free of damage',
                  type: 'pass_fail',
                  required: true,
                  section: 'exterior-checks',
                  critical: true
                },
                {
                  id: 'windshield-check',
                  question: 'Windshield: Check for cracks or chips; ensure wipers and washer fluid are functioning',
                  type: 'pass_fail',
                  required: true,
                  section: 'exterior-checks',
                  critical: true
                },
                {
                  id: 'body-condition',
                  question: 'Body Condition: Inspect for any visible damage',
                  type: 'pass_fail',
                  required: true,
                  section: 'exterior-checks'
                },
                {
                  id: 'loose-parts',
                  question: 'Loose parts',
                  type: 'pass_fail',
                  required: true,
                  section: 'exterior-checks',
                  critical: true
                },
                {
                  id: 'leaks-check',
                  question: 'Leaks',
                  type: 'pass_fail',
                  required: true,
                  section: 'exterior-checks',
                  critical: true
                }
              ]
            },
            {
              id: 'engine-fluids',
              name: 'Engine & Fluids',
              description: 'Engine and fluid system checks',
              icon: <Settings className="h-5 w-5" />,
              questions: [
                {
                  id: 'engine-oil',
                  question: 'Engine Oil: Check oil level and quality',
                  type: 'pass_fail',
                  required: true,
                  section: 'engine-fluids',
                  critical: true
                },
                {
                  id: 'coolant',
                  question: 'Coolant: Verify coolant levels and inspect for leaks',
                  type: 'pass_fail',
                  required: true,
                  section: 'engine-fluids',
                  critical: true
                },
                {
                  id: 'brake-fluid',
                  question: 'Brake Fluid: Ensure brake fluid is at the proper level',
                  type: 'pass_fail',
                  required: true,
                  section: 'engine-fluids',
                  critical: true
                },
                {
                  id: 'transmission-fluid',
                  question: 'Transmission Fluid: Check level and condition',
                  type: 'pass_fail',
                  required: true,
                  section: 'engine-fluids'
                },
                {
                  id: 'power-steering-fluid',
                  question: 'Power Steering Fluid: Ensure it is at the correct level',
                  type: 'pass_fail',
                  required: true,
                  section: 'engine-fluids'
                },
                {
                  id: 'battery',
                  question: 'Battery: Inspect battery terminals and ensure the battery is secure',
                  type: 'pass_fail',
                  required: true,
                  section: 'engine-fluids',
                  critical: true
                }
              ]
            },
            {
              id: 'interior-cabin',
              name: 'Interior & Cabin',
              description: 'Interior vehicle checks',
              icon: <Truck className="h-5 w-5" />,
              questions: [
                {
                  id: 'dashboard-indicators',
                  question: 'Dashboard Indicators: Ensure all warning lights are functioning properly',
                  type: 'pass_fail',
                  required: true,
                  section: 'interior-cabin',
                  critical: true
                },
                {
                  id: 'seatbelts',
                  question: 'Seatbelts: Verify seatbelts are operational and free from wear or damage',
                  type: 'pass_fail',
                  required: true,
                  section: 'interior-cabin',
                  critical: true
                },
                {
                  id: 'horn',
                  question: 'Horn: Test the horn to ensure it is working',
                  type: 'pass_fail',
                  required: true,
                  section: 'interior-cabin',
                  critical: true
                },
                {
                  id: 'fire-extinguisher',
                  question: 'Fire Extinguisher',
                  type: 'pass_fail',
                  required: true,
                  section: 'interior-cabin',
                  critical: true
                },
                {
                  id: 'first-aid-kit',
                  question: 'First Aid Kit',
                  type: 'pass_fail',
                  required: true,
                  section: 'interior-cabin',
                  critical: true
                },
                {
                  id: 'safety-triangles',
                  question: 'Safety Triangles',
                  type: 'pass_fail',
                  required: true,
                  section: 'interior-cabin',
                  critical: true
                }
              ]
            },
            {
              id: 'functional-checks',
              name: 'Functional Checks',
              description: 'Vehicle functional testing',
              icon: <Activity className="h-5 w-5" />,
              questions: [
                {
                  id: 'brakes-test',
                  question: 'Brakes: Test brake function for responsiveness and effectiveness',
                  type: 'pass_fail',
                  required: true,
                  section: 'functional-checks',
                  critical: true
                },
                {
                  id: 'suspension',
                  question: 'Suspension: Check for any unusual noises or handling issues',
                  type: 'pass_fail',
                  required: true,
                  section: 'functional-checks'
                },
                {
                  id: 'heating-ac',
                  question: 'Heating and Air Conditioning: Test to ensure both systems are operational',
                  type: 'pass_fail',
                  required: true,
                  section: 'functional-checks'
                }
              ]
            },
            {
              id: 'safety-equipment',
              name: 'Safety Equipment',
              description: 'Safety equipment verification',
              icon: <Shield className="h-5 w-5" />,
              questions: [
                {
                  id: 'fire-extinguisher-charged',
                  question: 'Fire extinguisher (charged & tagged)',
                  type: 'pass_fail',
                  required: true,
                  section: 'safety-equipment',
                  critical: true
                },
                {
                  id: 'first-aid-stock',
                  question: 'First aid kit (stock verified)',
                  type: 'pass_fail',
                  required: true,
                  section: 'safety-equipment',
                  critical: true
                },
                {
                  id: 'reflective-triangles',
                  question: 'Reflective triangles (2)',
                  type: 'pass_fail',
                  required: true,
                  section: 'safety-equipment',
                  critical: true
                },
                {
                  id: 'wheel-chocks',
                  question: 'Wheel chocks',
                  type: 'pass_fail',
                  required: true,
                  section: 'safety-equipment'
                },
                {
                  id: 'spare-tyre-jack',
                  question: 'Spare tyre and jack',
                  type: 'pass_fail',
                  required: true,
                  section: 'safety-equipment',
                  critical: true
                },
                {
                  id: 'torch-flashlight',
                  question: 'Torch / flashlight',
                  type: 'pass_fail',
                  required: true,
                  section: 'safety-equipment'
                },
                {
                  id: 'emergency-contact-list',
                  question: 'Emergency contact list',
                  type: 'pass_fail',
                  required: true,
                  section: 'safety-equipment'
                },
                {
                  id: 'gps-tracker',
                  question: 'GPS tracker operational',
                  type: 'pass_fail',
                  required: true,
                  section: 'safety-equipment'
                }
              ]
            },
            {
              id: 'final-verification',
              name: 'Final Verification',
              description: 'Final safety checks and clearance',
              icon: <CheckSquare className="h-5 w-5" />,
              questions: [
                {
                  id: 'critical-defects-rectified',
                  question: 'All critical defects rectified before departure?',
                  type: 'yes_no',
                  required: true,
                  section: 'final-verification',
                  critical: true
                },
                {
                  id: 'driver-briefed',
                  question: 'Driver briefed on trip hazards and route plan?',
                  type: 'yes_no',
                  required: true,
                  section: 'final-verification'
                },
                {
                  id: 'vehicle-safe-dispatch',
                  question: 'Vehicle safe and ready for dispatch?',
                  type: 'yes_no',
                  required: true,
                  section: 'final-verification',
                  critical: true
                }
              ]
            }
          ]
        }
      }

      const module = mockTestModules[testType]
      if (module) {
        setTestModule(module)
      } else {
        toast({
          title: "Error",
          description: "Test type not found",
          variant: "destructive"
        })
        router.push('/dashboard/driver')
      }
    } catch (error) {
      console.error('Error loading test module:', error)
      toast({
        title: "Error", 
        description: "Failed to load test module",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [testType]) // Add testType dependency here instead of in}, [testType])

  // Session management functions
  const initializeTestSession = async () => {
    if (!user || !testModule) return
    
    setSessionLoading(true)
    try {
      // Check for existing active session
      const existingSession = await testSessionManager.getActiveSession(user.id, testType)
      
      if (existingSession) {
        setTestSession(existingSession)
        setAnswers(existingSession.answers)
        setCurrentStep(existingSession.current_step)
        toast({
          title: 'Session Restored',
          description: 'Your previous test progress has been restored.',
        })
      } else {
        // Create new session
        const newSession = await testSessionManager.createSession(
          user.id,
          testType,
          testModule.sections.length,
          testModule
        )
        setTestSession(newSession)
        toast({
          title: 'Test Started',
          description: 'Your test session has been created.',
        })
      }
    } catch (error) {
      console.error('Error initializing test session:', error)
      toast({
        title: 'Error',
        description: 'Failed to initialize test session.',
        variant: 'destructive'
      })
    } finally {
      setSessionLoading(false)
    }
  }

  const saveProgress = async (step: number, currentAnswers: Record<string, any>) => {
    if (!testSession || sessionLoading) return
    
    try {
      await testSessionManager.saveProgress(testSession.id, step, currentAnswers)
      setTestSession(prev => prev ? { ...prev, current_step: step, answers: currentAnswers } : null)
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  useEffect(() => {
    checkAuth()
    loadTestModule()
  }, [loadTestModule])

  // Initialize session when user and test module are loaded
  useEffect(() => {
    if (user && testModule && !testSession) {
      initializeTestSession()
    }
  }, [user, testModule, testSession])

  // Auto-save progress when answers change
  useEffect(() => {
    if (testSession && !sessionLoading) {
      const timeoutId = setTimeout(() => {
        saveProgress(currentStep, answers)
      }, 1000) // Save after 1 second of inactivity
      
      return () => clearTimeout(timeoutId)
    }
  }, [answers, currentStep, testSession, sessionLoading])

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const validateAnswers = () => {
    if (!testModule) return false

    // Get all required questions from all sections
    const allRequiredQuestions = testModule.sections.flatMap(section => 
      section.questions.filter(q => q.required)
    )
    
    const answeredQuestions = allRequiredQuestions.filter(q => 
      answers[q.id] !== undefined && answers[q.id] !== ''
    )
    
    return answeredQuestions.length === allRequiredQuestions.length
  }

  const getCriticalFailures = () => {
    if (!testModule) return []

    const allQuestions = testModule.sections.flatMap(section => section.questions)
    const criticalQuestions = allQuestions.filter(q => q.critical)
    
    return criticalQuestions.filter(q => answers[q.id] === 'fail')
  }

  const calculateRiskScore = () => {
    if (!testModule) {
      return {
        totalScore: 0,
        maxScore: 210,
        riskLevel: 'Very Low',
        grade: 'A',
        dispatchStatus: 'Cleared' as const,
        criticalFailures: [] as string[]
      }
    }

    const allQuestions = testModule.sections.flatMap(section => section.questions)

    let totalRiskScore = 0
    const criticalFailures: string[] = []

    for (const q of allQuestions) {
      const a = answers[q.id]
      if (a === undefined || a === '') continue

      const isFail = (q.type === 'pass_fail' && a === 'fail') || (q.type === 'yes_no' && a === 'no')
      if (!isFail) continue

      const points = q.critical ? 10 : 3
      totalRiskScore += points
      if (q.critical) criticalFailures.push(q.id)
    }

    let riskLevel: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Critical' = 'Very Low'
    if (totalRiskScore >= 121) riskLevel = 'Critical'
    else if (totalRiskScore >= 81) riskLevel = 'High'
    else if (totalRiskScore >= 46) riskLevel = 'Medium'
    else if (totalRiskScore >= 21) riskLevel = 'Low'

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A'
    if (riskLevel === 'Critical' || riskLevel === 'High') grade = 'F'
    else if (riskLevel === 'Medium') grade = 'C'
    else if (riskLevel === 'Low') grade = 'B'

    const dispatchStatus = criticalFailures.length > 0 || riskLevel === 'High' || riskLevel === 'Critical'
      ? ('Not Cleared' as const)
      : ('Cleared' as const)

    return {
      totalScore: totalRiskScore,
      maxScore: 210,
      riskLevel,
      grade,
      dispatchStatus,
      criticalFailures
    }
  }

  const handleSubmitTest = async () => {
    console.log('Submit test button clicked')
    
    if (isSubmitted) {
      console.log('Test already submitted')
      return
    }
    
    if (!testModule || !user || !testSession) {
      console.error('Missing test module, user, or session')
      return
    }

    if (!validateAnswers()) {
      toast({
        title: 'Validation Error',
        description: 'Please answer all required questions before submitting.',
        variant: 'destructive'
      })
      return
    }

    const criticalFailures = getCriticalFailures()
    if (criticalFailures.length > 0) {
      const failureList = criticalFailures.map(f => f.question).join(', ')
      toast({
        title: 'Critical Issues Detected',
        description: `Critical failures found: ${failureList}. Please address these issues before proceeding.`,
        variant: 'destructive'
      })
      return
    }

    console.log('Starting test submission...')
    setIsSubmitted(true)
    setSubmitting(true)
    try {
      const risk = calculateRiskScore()
      const completionTime = Date.now() - startTime

      // Complete the session
      const completedSession = await testSessionManager.completeSession(
        testSession.id,
        risk.totalScore,
        risk.grade
      )

      // Save test result
      const testResult = await testSessionManager.saveTestResult({
        session_id: testSession.id,
        driver_id: user.id,
        test_type: testModule.name,
        status: risk.dispatchStatus,
        score: risk.totalScore,
        max_score: 210,
        percentage: Math.round((risk.totalScore / 210) * 100),
        risk_level: risk.riskLevel,
        dispatch_status: risk.dispatchStatus,
        answers,
        sections: testModule.sections.map(section => ({
          id: section.id,
          name: section.name,
          questions: section.questions.map(q => ({
            id: q.id,
            question: q.question,
            answer: answers[q.id],
            critical: q.critical,
            points: q.points || 10
          }))
        })),
        completion_time_ms: completionTime,
        started_at: testSession.started_at,
        completed_at: new Date().toISOString()
      })

      // Add to history
      await testSessionManager.addToHistory(
        user.id,
        testSession.id,
        testResult.id,
        risk.totalScore,
        risk.grade
      )

      console.log('Test successfully saved to database')

      toast({
        title: 'Test Completed!',
        description: `Score: ${risk.totalScore}/210 (${risk.grade}). Redirecting to results...`,
      })

      console.log('Redirecting to results page...')
      // Redirect to results page with the result ID
      router.push(`/dashboard/driver/test/results?resultId=${testResult.id}`)
    } catch (error) {
      console.error('Error submitting test:', error)
      toast({
        title: 'Error',
        description: 'Failed to save test results. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

// ...

  const nextStep = () => {
    // Check if current step is completed before allowing navigation
    if (!testModule) return
    
    const currentSectionQuestions = testModule.sections[currentStep].questions.filter(q => q.required)
    const answeredQuestions = currentSectionQuestions.filter(q => 
      answers[q.id] !== undefined && answers[q.id] !== ''
    )
    
    // Only allow next step if all required questions are answered
    if (answeredQuestions.length === currentSectionQuestions.length && currentStep < testModule.sections.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    // Allow going back to review previous steps
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const goToStep = (step: number) => {
    // Only allow going to steps that are already completed or the current step
    if (!testModule) return
    
    // Check if the target step is the current step or a previously completed step
    if (step === currentStep) {
      return // Already on this step
    }
    
    // Check if all previous steps are completed
    let canNavigate = true
    for (let i = 0; i < step; i++) {
      const sectionQuestions = testModule.sections[i].questions.filter(q => q.required)
      const answeredQuestions = sectionQuestions.filter(q => 
        answers[q.id] !== undefined && answers[q.id] !== ''
      )
      if (answeredQuestions.length !== sectionQuestions.length) {
        canNavigate = false
        break
      }
    }
    
    if (canNavigate && step >= 0 && step < testModule.sections.length) {
      setCurrentStep(step)
    }
  }

  const isCurrentStepCompleted = () => {
    if (!testModule) return false
    
    const currentSectionQuestions = testModule.sections[currentStep].questions.filter(q => q.required)
    const answeredQuestions = currentSectionQuestions.filter(q => 
      answers[q.id] !== undefined && answers[q.id] !== ''
    )
    
    return answeredQuestions.length === currentSectionQuestions.length
  }

  const isStepUnlocked = (stepIndex: number) => {
    if (!testModule) return false
    
    // Current step is always unlocked
    if (stepIndex === currentStep) return true
    
    // Check if all previous steps are completed
    for (let i = 0; i < stepIndex; i++) {
      const sectionQuestions = testModule.sections[i].questions.filter(q => q.required)
      const answeredQuestions = sectionQuestions.filter(q => 
        answers[q.id] !== undefined && answers[q.id] !== ''
      )
      if (answeredQuestions.length !== sectionQuestions.length) {
        return false
      }
    }
    
    return true
  }

  if (loading) {
    return <AppPageLoader label="Loading test..." spinnerClassName="text-green-600" />
  }

  if (!testModule) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Test Not Found</h2>
          <p className="text-gray-600 mb-4">The requested test module could not be loaded.</p>
          <Button onClick={() => router.push('/dashboard/driver')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const currentSection = testModule?.sections[currentStep]
  const progress = testModule ? ((currentStep + 1) / testModule.sections.length) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/driver')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-xl font-bold text-gray-900">{testModule.name}</h1>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Time: {Math.floor((Date.now() - startTime) / 60000)}m</span>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {testModule.sections.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Test Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 text-green-600 p-2 rounded-lg">
                {currentSection.icon}
              </div>
              <div>
                <CardTitle className="text-xl">{currentSection.name}</CardTitle>
                <CardDescription>{currentSection.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              {currentSection.questions.map((question, index) => (
                <div key={question.id} className="border-l-4 border-green-200 pl-4">
                  <div className="flex items-start gap-2 mb-3">
                    <h3 className="font-medium text-gray-900">
                      {index + 1}. {question.question}
                    </h3>
                    {question.required && <span className="text-red-500">*</span>}
                    {question.critical && (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-xs font-medium">
                        Critical
                      </span>
                    )}
                  </div>
                  
                  <div className="ml-4">
                    {question.type === 'yes_no' && (
                      <div className="space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name={question.id}
                            value="yes"
                            checked={answers[question.id] === 'yes'}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="w-4 h-4 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-gray-700">Yes</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name={question.id}
                            value="no"
                            checked={answers[question.id] === 'no'}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="w-4 h-4 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-gray-700">No</span>
                        </label>
                      </div>
                    )}

                    {question.type === 'pass_fail' && (
                      <div className="space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name={question.id}
                            value="pass"
                            checked={answers[question.id] === 'pass'}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="w-4 h-4 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-gray-700">Pass</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name={question.id}
                            value="fail"
                            checked={answers[question.id] === 'fail'}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="w-4 h-4 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-gray-700">Fail</span>
                        </label>
                      </div>
                    )}

                    {question.type === 'multiple_choice' && (
                      <select
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="">Select an option</option>
                        {question.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}

                    {question.type === 'text' && (
                      <input
                        type="text"
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Enter your answer"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center mt-8">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>

          {currentStep === testModule.sections.length - 1 ? (
            <Button
              onClick={handleSubmitTest}
              disabled={submitting || !isCurrentStepCompleted()}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting...' : 'Submit Test'}
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!isCurrentStepCompleted()}
              className={`flex items-center space-x-2 ${
                isCurrentStepCompleted()
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isCurrentStepCompleted() ? (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Complete Required Questions
                  <CheckCircle className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* Progress Summary */}
        <div className="mt-8 bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Required Questions: {currentSection.questions.filter(q => q.required).length}
            </div>
            <div className="text-sm text-gray-600">
              Answered: {currentSection.questions.filter(q => q.required && answers[q.id]).length}
            </div>
          </div>
          {!isCurrentStepCompleted() && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2 text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Please answer all required questions to proceed to the next step
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function DriverTestPageWrapper() {
  return (
    <Suspense fallback={<div>Loading test...</div>}>
      <DriverTestPage />
    </Suspense>
  )
}

export default DriverTestPageWrapper
