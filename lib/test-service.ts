import { createClient } from '@supabase/supabase-js'

export interface TestAttempt {
  id: string
  user_id: string
  test_id?: string
  test_type: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  score?: number
  pass?: boolean
  answers: any[]
  current_question: number
  progress: number
  created_at: string
  updated_at: string
}

export interface TestMetrics {
  totalTests: number
  completedTests: number
  pendingTests: number
  successRate: number
}

export interface Schedule {
  id: string
  driver_id: string
  route_name: string
  shift_date: string
  start_time: string
  end_time: string
  vehicle_id?: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
}

export class TestService {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // Create or resume a test attempt
  async createOrResumeTestAttempt(userId: string, testType: string): Promise<TestAttempt> {
    console.log('createOrResumeTestAttempt called with userId:', userId, 'testType:', testType)
    
    try {
      // First check if there's an existing pending test of this type
      console.log('Checking for existing pending test...')
      const { data: existingAttempt, error: fetchError } = await this.supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('test_type', testType)
        .eq('status', 'pending')
        .single()

      console.log('Existing attempt:', existingAttempt, 'Error:', fetchError)

      if (existingAttempt && !fetchError) {
        console.log('Resuming existing test attempt')
        return existingAttempt as TestAttempt
      }

      // Create new test attempt
      console.log('Creating new test attempt...')
      const { data, error } = await this.supabase
        .from('test_attempts')
        .insert({
          user_id: userId,
          test_type: testType,
          status: 'pending',
          started_at: new Date().toISOString(),
          answers: [],
          current_question: 0,
          progress: 0
        })
        .select()
        .single()

      console.log('New test attempt created:', data, 'Error:', error)

      if (error) {
        console.error('Database error details:', JSON.stringify(error, null, 2))
        console.error('Error type:', typeof error)
        console.error('Error keys:', Object.keys(error || {}))
        throw error
      }
      
      return data as TestAttempt
    } catch (error) {
      console.error('Error creating/resuming test attempt:', error)
      console.error('Caught error type:', typeof error)
      console.error('Caught error details:', JSON.stringify(error, null, 2))
      
      // Fallback: create a mock test attempt if table doesn't exist
      if (error && typeof error === 'object') {
        const dbError = error as any
        console.log('Database error code:', dbError.code)
        console.log('Database error message:', dbError.message)
        
        // Check for various table not found errors
        const isTableNotFoundError = 
          dbError.code === 'PGRST116' || 
          dbError.message?.includes('relation') || 
          dbError.message?.includes('does not exist') ||
          dbError.message?.includes('table') ||
          dbError.message?.includes('not found')
        
        if (isTableNotFoundError) {
          console.log('test_attempts table does not exist, creating fallback')
          
          const fallbackAttempt: TestAttempt = {
            id: `fallback-${Date.now()}`,
            user_id: userId,
            test_type: testType,
            status: 'pending',
            started_at: new Date().toISOString(),
            answers: [],
            current_question: 0,
            progress: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          
          console.log('Using fallback test attempt:', fallbackAttempt)
          return fallbackAttempt
        }
      }
      
      // If we can't create a fallback, still try to create a minimal one
      console.log('Creating emergency fallback test attempt')
      const emergencyFallback: TestAttempt = {
        id: `emergency-${Date.now()}`,
        user_id: userId,
        test_type: testType,
        status: 'pending',
        started_at: new Date().toISOString(),
        answers: [],
        current_question: 0,
        progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      console.log('Using emergency fallback test attempt:', emergencyFallback)
      return emergencyFallback
    }
  }

  // Update test attempt progress
  async updateTestProgress(attemptId: string, answers: any[], currentQuestion: number, progress: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('test_attempts')
        .update({
          answers,
          current_question: currentQuestion,
          progress,
          updated_at: new Date().toISOString()
        })
        .eq('id', attemptId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating test progress:', error)
      throw error
    }
  }

  // Complete a test attempt
  async completeTestAttempt(attemptId: string, score: number, pass: boolean, finalAnswers: any[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('test_attempts')
        .update({
          status: pass ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          score,
          pass,
          answers: finalAnswers,
          progress: 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', attemptId)

      if (error) throw error
    } catch (error) {
      console.error('Error completing test attempt:', error)
      throw error
    }
  }

  // Get all test attempts for a user
  async getUserTestAttempts(userId: string): Promise<TestAttempt[]> {
    try {
      const { data, error } = await this.supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching test attempts:', error)
      return []
    }
  }

  // Get comprehensive test history (including legacy data)
  async getComprehensiveTestHistory(userId: string): Promise<TestAttempt[]> {
    try {
      const allTests: TestAttempt[] = []

      // 1. Fetch from test_attempts table (new system)
      const { data: attempts, error: attemptsError } = await this.supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })

      if (!attemptsError && attempts) {
        allTests.push(...attempts)
      }

      // 2. Fetch from trips table (pre-trip inspections)
      const { data: trips, error: tripsError } = await this.supabase
        .from('trips')
        .select('*')
        .or(`user_id.eq.${userId},driver_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (!tripsError && trips) {
        allTests.push(...trips.map((trip: any) => ({
          id: trip.id,
          user_id: trip.user_id || trip.driver_id || userId,
          test_type: 'Pre-Trip Inspection',
          status: trip.status === 'approved' ? 'completed' : 
                 trip.status === 'rejected' || trip.status === 'failed' ? 'failed' :
                 trip.status === 'submitted' || trip.status === 'under_review' ? 'pending' : 'pending',
          started_at: trip.created_at,
          completed_at: trip.status === 'approved' || trip.status === 'rejected' ? trip.updated_at : undefined,
          score: trip.aggregate_score,
          pass: trip.status === 'approved',
          answers: [],
          current_question: 0,
          progress: trip.status === 'approved' ? 100 : trip.status === 'in_progress' ? 50 : 0,
          created_at: trip.created_at,
          updated_at: trip.updated_at || trip.created_at
        })))
      }

      // 3. Fetch from test_history table
      const { data: history, error: historyError } = await this.supabase
        .from('test_history')
        .select('*')
        .eq('driver_id', userId)
        .order('completed_at', { ascending: false })

      if (!historyError && history) {
        allTests.push(...history.map((h: any) => ({
          id: h.id,
          user_id: h.driver_id,
          test_type: h.test_type || 'Safety Test',
          status: h.status || 'completed',
          started_at: h.created_at,
          completed_at: h.completed_at,
          score: h.final_score,
          pass: (h.final_score || 0) >= 80,
          answers: [],
          current_question: 0,
          progress: 100,
          created_at: h.created_at,
          updated_at: h.completed_at || h.created_at
        })))
      }

      // 4. Fetch from test_results table
      const { data: results, error: resultsError } = await this.supabase
        .from('test_results')
        .select('*')
        .eq('driver_id', userId)
        .order('completed_at', { ascending: false })

      if (!resultsError && results) {
        allTests.push(...results.map((result: any) => ({
          id: result.id,
          user_id: result.driver_id,
          test_type: result.test_type || 'Safety Test',
          status: result.status || 'completed',
          started_at: result.created_at || result.started_at,
          completed_at: result.completed_at,
          score: result.score || result.percentage,
          pass: (result.score || result.percentage || 0) >= 80,
          answers: [],
          current_question: 0,
          progress: 100,
          created_at: result.created_at || result.started_at,
          updated_at: result.completed_at || result.created_at
        })))
      }

      // Remove duplicates and sort by date
      const uniqueTests = allTests
        .filter((test, index, self) => 
          index === self.findIndex((t) => t.id === test.id)
        )
        .sort((a, b) => 
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        )

      return uniqueTests
    } catch (error) {
      console.error('Error fetching comprehensive test history:', error)
      return []
    }
  }

  // Calculate real-time metrics based on test attempts
  calculateMetrics(tests: TestAttempt[]): TestMetrics {
    const totalTests = tests.length
    const completedTests = tests.filter(t => t.status === 'completed').length
    const pendingTests = tests.filter(t => t.status === 'pending').length
    const passedTests = tests.filter(t => t.pass === true).length
    const successRate = completedTests > 0 ? Math.round((passedTests / completedTests) * 100) : 0

    return {
      totalTests,
      completedTests,
      pendingTests,
      successRate
    }
  }

  // Get user schedules
  async getUserSchedules(userId: string): Promise<Schedule[]> {
    try {
      const { data, error } = await this.supabase
        .from('schedules')
        .select('*')
        .eq('driver_id', userId)
        .eq('status', 'scheduled')
        .order('shift_date', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching user schedules:', error)
      return []
    }
  }

  // Get test details for report
  async getTestDetails(testId: string): Promise<TestAttempt | null> {
    try {
      const { data, error } = await this.supabase
        .from('test_attempts')
        .select('*')
        .eq('id', testId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching test details:', error)
      return null
    }
  }

  // Real-time subscription for test updates
  subscribeToTestUpdates(userId: string, callback: (test: TestAttempt) => void) {
    return this.supabase
      .channel('test_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'test_attempts',
          filter: `user_id=eq.${userId}`
        },
        (payload: any) => {
          callback(payload.new as TestAttempt)
        }
      )
      .subscribe()
  }

  // Legacy methods for backward compatibility
  async getDriverTests(driverId: string): Promise<TestAttempt[]> {
    return this.getUserTestAttempts(driverId)
  }

  async createTest(driverId: string, testType: string): Promise<string> {
    const attempt = await this.createOrResumeTestAttempt(driverId, testType)
    return attempt.id
  }

  async updateTestResults(testId: string, results: {
    score: number
    status: 'completed' | 'failed'
    pass_fail_status: 'pass' | 'fail'
    questions: any[]
    answers: any[]
  }): Promise<void> {
    await this.completeTestAttempt(
      testId, 
      results.score, 
      results.pass_fail_status === 'pass', 
      results.answers
    )
  }
}
