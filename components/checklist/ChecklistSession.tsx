'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'
import { CHECKLIST_MODULES, ModuleKey, calculateRiskLevel, ChecklistSession as ChecklistSessionType } from '@/lib/checklist-mapping'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { 
  Save, 
  ArrowLeft, 
  ArrowRight, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  FileText,
  Send
} from 'lucide-react'
import { AppInlineLoader } from '@/components/ui/app-loader'

interface ChecklistSessionProps {
  driverId: string
  orgId: string
  onComplete?: (tripId: string) => void
  onSaveDraft?: () => void
}

export default function ChecklistSession({ driverId, orgId, onComplete, onSaveDraft }: ChecklistSessionProps) {
  const [session, setSession] = useState<ChecklistSessionType | null>(null)
  const [tripId, setTripId] = useState<string | null>(null)
  const [currentModule, setCurrentModule] = useState<ModuleKey>('DRIVER_INFO')
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [startTime] = useState(new Date())
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  const moduleKeys = Object.keys(CHECKLIST_MODULES) as ModuleKey[]
  const currentModuleIndex = moduleKeys.indexOf(currentModule)
  const progress = ((currentModuleIndex + 1) / moduleKeys.length) * 100

  // Initialize session
  useEffect(() => {
    initializeSession()
  }, [])

  const initializeSession = async () => {
    try {
      // Create trip record
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert({
          user_id: driverId,
          org_id: orgId,
          trip_date: new Date().toISOString().split('T')[0],
          status: 'pending',
          aggregate_score: 0,
          risk_level: 'low'
        })
        .select()
        .single()

      if (tripError) {
        console.error('Error creating trip:', tripError)
        toast({
          title: "Error",
          description: "Failed to initialize checklist session",
          variant: "destructive"
        })
        return
      }

      setTripId(trip.id)
      
      // Create modules for this trip
      const moduleData = moduleKeys.map((key, index) => ({
        trip_id: trip.id,
        name: CHECKLIST_MODULES[key].name,
        step: index + 1,
        status: 'pending',
        risk_level: 'low',
        score: 0
      }))

      const { error: modulesError } = await supabase
        .from('trip_modules')
        .insert(moduleData)

      if (modulesError) {
        console.error('Error creating modules:', modulesError)
      }

      setSession({
        tripId: trip.id,
        currentModule: 'DRIVER_INFO',
        currentStep: 1,
        answers: {},
        startTime: new Date(),
        lastActivity: new Date(),
        status: 'in_progress'
      })

    } catch (error) {
      console.error('Session initialization error:', error)
      toast({
        title: "Error",
        description: "Failed to start checklist",
        variant: "destructive"
      })
    }
  }

  // Auto-save draft
  const saveDraft = useCallback(async () => {
    if (!tripId || !session) return

    setSaving(true)
    try {
      const draftData = {
        user_id: driverId,
        org_id: orgId,
        draft_data: {
          currentModule,
          currentStep: currentModuleIndex + 1,
          answers,
          lastActivity: new Date().toISOString()
        }
      }

      await supabase
        .from('trip_drafts')
        .upsert(draftData, {
          onConflict: 'user_id'
        })

      onSaveDraft?.()
      
    } catch (error) {
      console.error('Error saving draft:', error)
    } finally {
      setSaving(false)
    }
  }, [tripId, session, currentModule, currentModuleIndex, answers, driverId, orgId, onSaveDraft])

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(saveDraft, 30000)
    return () => clearInterval(interval)
  }, [saveDraft])

  const handleAnswerChange = (itemLabel: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [itemLabel]: value
    }))
  }

  const calculateModuleScore = (moduleKey: ModuleKey): number => {
    const module = CHECKLIST_MODULES[moduleKey]
    let score = 0
    
    module.items.forEach(item => {
      const answer = answers[item.label]
      if (item.field_type === 'pass_fail' && answer === 'fail') {
        score += item.points
      } else if (item.field_type === 'yes_no' && answer === 'no') {
        score += item.points
      } else if (item.field_type === 'number' && answer > 0) {
        score += answer
      }
    })
    
    return score
  }

  const saveModuleAnswers = async () => {
    if (!tripId) return

    try {
      const module = CHECKLIST_MODULES[currentModule]
      const moduleScore = calculateModuleScore(currentModule)
      const riskLevel = calculateRiskLevel(moduleScore)

      // Get module ID
      const { data: moduleData } = await supabase
        .from('trip_modules')
        .select('id')
        .eq('trip_id', tripId)
        .eq('step', currentModuleIndex + 1)
        .single()

      if (moduleData) {
        // Update module status and score
        await supabase
          .from('trip_modules')
          .update({
            status: moduleScore > 0 ? 'failed' : 'completed',
            score: moduleScore,
            risk_level: riskLevel
          })
          .eq('id', moduleData.id)

        // Save all module items
        const itemData = module.items.map(item => ({
          module_id: moduleData.id,
          label: item.label,
          field_type: item.field_type,
          critical: item.critical,
          points: item.points,
          value: answers[item.label] || null
        }))

        // Delete existing items and insert new ones
        await supabase
          .from('module_items')
          .delete()
          .eq('module_id', moduleData.id)

        await supabase
          .from('module_items')
          .insert(itemData)

        // Record critical failures
        const criticalFailures = module.items.filter(item => 
          item.critical && (
            (item.field_type === 'pass_fail' && answers[item.label] === 'fail') ||
            (item.field_type === 'yes_no' && answers[item.label] === 'no')
          )
        )

        if (criticalFailures.length > 0) {
          const failureData = criticalFailures.map(item => ({
            trip_id: tripId,
            module_item_id: moduleData.id, // This would need adjustment
            description: `${item.label}: ${answers[item.label]}`,
            points: item.points,
            resolved: false
          }))

          await supabase
            .from('critical_failures')
            .insert(failureData)
        }
      }
    } catch (error) {
      console.error('Error saving module answers:', error)
    }
  }

  const handleNext = async () => {
    await saveModuleAnswers()
    
    if (currentModuleIndex < moduleKeys.length - 1) {
      const nextModule = moduleKeys[currentModuleIndex + 1]
      setCurrentModule(nextModule)
      setSession(prev => prev ? {
        ...prev,
        currentModule: nextModule,
        currentStep: currentModuleIndex + 2,
        lastActivity: new Date()
      } : null)
    }
  }

  const handlePrevious = () => {
    if (currentModuleIndex > 0) {
      const prevModule = moduleKeys[currentModuleIndex - 1]
      setCurrentModule(prevModule)
      setSession(prev => prev ? {
        ...prev,
        currentModule: prevModule,
        currentStep: currentModuleIndex,
        lastActivity: new Date()
      } : null)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    
    try {
      // Save current module
      await saveModuleAnswers()

      // Calculate total score and risk level
      let totalScore = 0
      moduleKeys.forEach(moduleKey => {
        totalScore += calculateModuleScore(moduleKey)
      })

      const finalRiskLevel = calculateRiskLevel(totalScore)

      // Update trip with final results
      const { data: updatedTrip } = await supabase
        .from('trips')
        .update({
          status: totalScore > 8 ? 'failed' : 'approved',
          aggregate_score: totalScore,
          risk_level: finalRiskLevel,
          critical_override: false
        })
        .eq('id', tripId)
        .select()
        .single()

      // Clean up draft
      await supabase
        .from('trip_drafts')
        .delete()
        .eq('user_id', driverId)

      toast({
        title: "Checklist Completed!",
        description: `Total score: ${totalScore} points. Risk level: ${finalRiskLevel}`,
      })

      onComplete?.(tripId!)

    } catch (error) {
      console.error('Error submitting checklist:', error)
      toast({
        title: "Error",
        description: "Failed to submit checklist",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const renderQuestionInput = (item: any) => {
    const value = answers[item.label] || ''

    switch (item.field_type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAnswerChange(item.label, e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Enter value..."
          />
        )
      
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleAnswerChange(item.label, e.target.value)}
            className="w-full p-2 border rounded"
          />
        )
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleAnswerChange(item.label, e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select...</option>
            <option value="Freight Truck">Freight Truck</option>
            <option value="Van">Van</option>
            <option value="Tanker">Tanker</option>
          </select>
        )
      
      case 'pass_fail':
        return (
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="pass"
                checked={value === 'pass'}
                onChange={(e) => handleAnswerChange(item.label, e.target.value)}
                className="mr-2"
              />
              Pass
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="fail"
                checked={value === 'fail'}
                onChange={(e) => handleAnswerChange(item.label, e.target.value)}
                className="mr-2"
              />
              Fail
            </label>
            {item.field_type === 'pass_fail_na' && (
              <label className="flex items-center">
                <input
                  type="radio"
                  value="na"
                  checked={value === 'na'}
                  onChange={(e) => handleAnswerChange(item.label, e.target.value)}
                  className="mr-2"
                />
                N/A
              </label>
            )}
          </div>
        )
      
      case 'yes_no':
        return (
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="yes"
                checked={value === 'yes'}
                onChange={(e) => handleAnswerChange(item.label, e.target.value)}
                className="mr-2"
              />
              Yes
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="no"
                checked={value === 'no'}
                onChange={(e) => handleAnswerChange(item.label, e.target.value)}
                className="mr-2"
              />
              No
            </label>
          </div>
        )
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleAnswerChange(item.label, parseInt(e.target.value) || 0)}
            className="w-full p-2 border rounded"
            placeholder="Enter number..."
          />
        )
      
      case 'signature':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded p-4 text-center">
            <p className="text-gray-500">Signature field</p>
            <button
              type="button"
              onClick={() => handleAnswerChange(item.label, `Signed at ${new Date().toLocaleString()}`)}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Add Signature
            </button>
          </div>
        )
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAnswerChange(item.label, e.target.value)}
            className="w-full p-2 border rounded"
          />
        )
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-2">Initializing checklist...</span>
      </div>
    )
  }

  const currentModuleData = CHECKLIST_MODULES[currentModule]

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Pre-Trip Safety Checklist</h1>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm text-gray-600">
              {Math.floor((new Date().getTime() - startTime.getTime()) / 60000)}m
            </span>
            {saving && <span className="text-sm text-blue-600">Saving...</span>}
          </div>
        </div>
        
        {/* Progress */}
        <div className="mb-2">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Module {currentModuleIndex + 1} of {moduleKeys.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Module Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{currentModuleData.name}</span>
            <Badge variant="outline">
              Step {currentModuleData.step}
            </Badge>
          </CardTitle>
          <CardDescription>
            Complete all items in this section before proceeding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentModuleData.items.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-medium">
                  {item.label}
                  {item.critical && (
                    <Badge variant="destructive" className="ml-2">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Critical
                    </Badge>
                  )}
                  {item.points > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {item.points} pts
                    </Badge>
                  )}
                </label>
              </div>
              {renderQuestionInput(item)}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentModuleIndex === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={saveDraft}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>

          {currentModuleIndex === moduleKeys.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <AppInlineLoader label="Submitting..." className="text-white" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Checklist
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
