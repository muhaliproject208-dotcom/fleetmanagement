import { getSupabaseClient } from './supabase-client'

export interface TestSession {
  id: string
  driver_id: string
  test_type: string
  status: 'in_progress' | 'completed' | 'abandoned'
  current_step: number
  total_steps: number
  answers: Record<string, any>
  started_at: string
  updated_at: string
  completed_at?: string
  test_data?: any
  final_score?: number
  final_grade?: string
}

export interface TestResult {
  id: string
  session_id: string
  driver_id: string
  test_type: string
  status: string
  score: number
  max_score: number
  percentage: number
  risk_level: string
  dispatch_status: string
  answers: Record<string, any>
  sections: any[]
  completion_time_ms: number
  started_at: string
  completed_at: string
}

export interface TestHistory {
  id: string
  driver_id: string
  test_type: string
  session_id: string
  result_id: string
  final_score: number
  final_grade: string
  completed_at: string
}

class TestSessionManager {
  private supabase = getSupabaseClient()

  async createSession(driverId: string, testType: string, totalSteps: number, testData: any): Promise<TestSession> {
    try {
      const { data, error } = await this.supabase
        .from('test_sessions')
        .insert({
          driver_id: driverId,
          test_type: testType,
          status: 'in_progress',
          current_step: 0,
          total_steps: totalSteps,
          answers: {},
          test_data: testData
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating test session:', error)
      throw error
    }
  }

  async getActiveSession(driverId: string, testType: string): Promise<TestSession | null> {
    try {
      const { data, error } = await this.supabase
        .from('test_sessions')
        .select('*')
        .eq('driver_id', driverId)
        .eq('test_type', testType)
        .eq('status', 'in_progress')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Error getting active session:', error)
      return null
    }
  }

  async updateSession(sessionId: string, updates: Partial<TestSession>): Promise<TestSession> {
    try {
      const { data, error } = await this.supabase
        .from('test_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating test session:', error)
      throw error
    }
  }

  async saveProgress(sessionId: string, currentStep: number, answers: Record<string, any>): Promise<void> {
    try {
      await this.updateSession(sessionId, {
        current_step: currentStep,
        answers: answers
      })
    } catch (error) {
      console.error('Error saving progress:', error)
      throw error
    }
  }

  async completeSession(sessionId: string, finalScore: number, finalGrade: string): Promise<TestSession> {
    try {
      const { data, error } = await this.supabase
        .from('test_sessions')
        .update({
          status: 'completed',
          final_score: finalScore,
          final_grade: finalGrade,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error completing test session:', error)
      throw error
    }
  }

  async saveTestResult(testData: any): Promise<TestResult> {
    try {
      const { data, error } = await this.supabase
        .from('test_results')
        .insert({
          session_id: testData.session_id,
          driver_id: testData.driver_id,
          test_type: testData.test_type,
          status: testData.status,
          score: testData.score,
          max_score: testData.max_score,
          percentage: testData.percentage,
          risk_level: testData.risk_level,
          dispatch_status: testData.dispatch_status,
          answers: testData.answers,
          sections: testData.sections,
          completion_time_ms: testData.completion_time_ms,
          started_at: testData.started_at,
          completed_at: testData.completed_at
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error saving test result:', error)
      throw error
    }
  }

  async addToHistory(driverId: string, sessionId: string, resultId: string, finalScore: number, finalGrade: string): Promise<TestHistory> {
    try {
      const { data, error } = await this.supabase
        .from('test_history')
        .insert({
          driver_id: driverId,
          test_type: 'pre-trip', // This should be dynamic based on the test
          session_id: sessionId,
          result_id: resultId,
          final_score: finalScore,
          final_grade: finalGrade,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding to test history:', error)
      throw error
    }
  }

  async getTestHistory(driverId: string): Promise<TestHistory[]> {
    try {
      const { data, error } = await this.supabase
        .from('test_history')
        .select('*')
        .eq('driver_id', driverId)
        .order('completed_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting test history:', error)
      return []
    }
  }

  async getTestResult(resultId: string): Promise<TestResult | null> {
    try {
      const { data, error } = await this.supabase
        .from('test_results')
        .select('*')
        .eq('id', resultId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Error getting test result:', error)
      return null
    }
  }

  async abandonSession(sessionId: string): Promise<void> {
    try {
      await this.updateSession(sessionId, {
        status: 'abandoned'
      })
    } catch (error) {
      console.error('Error abandoning test session:', error)
      throw error
    }
  }
}

export const testSessionManager = new TestSessionManager()
