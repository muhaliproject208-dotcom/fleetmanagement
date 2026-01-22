"use client"
import { useState, useCallback, useEffect } from "react"
import { FORM_MODULES, getRiskLevel } from "@/lib/form-config"
import FormModule from "./form-module"
import FormSidebar from "./form-sidebar"

export interface FormData {
  [key: string]: any
}

export interface FormState {
  currentStep: number
  data: FormData
  scores: { [moduleId: string]: number }
  criticalFailures: string[]
}

export default function PreTripForm() {
  const [formState, setFormState] = useState<FormState>({
    currentStep: 1,
    data: {},
    scores: {},
    criticalFailures: [],
  })
  const [saving, setSaving] = useState(false)

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (Object.keys(formState.data).length > 0) {
        await saveDraft()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [formState])

  const saveDraft = async () => {
    setSaving(true)
    try {
      // API call to save draft
      await fetch("/api/trips/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_data: formState.data,
          trip_id: null, // will be set on first save
        }),
      })
    } catch (error) {
      console.error("Error saving draft:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    setFormState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        [fieldId]: value,
      },
    }))
  }, [])

  const handleModuleComplete = useCallback((moduleId: string, score: number) => {
    setFormState((prev) => ({
      ...prev,
      scores: {
        ...prev.scores,
        [moduleId]: score,
      },
    }))
  }, [])

  const handleNext = () => {
    if (formState.currentStep < FORM_MODULES.length) {
      setFormState((prev) => ({
        ...prev,
        currentStep: prev.currentStep + 1,
      }))
    }
  }

  const handlePrevious = () => {
    if (formState.currentStep > 1) {
      setFormState((prev) => ({
        ...prev,
        currentStep: prev.currentStep - 1,
      }))
    }
  }

  const currentModule = FORM_MODULES[formState.currentStep - 1]
  const totalScore = Object.values(formState.scores).reduce((a, b) => a + b, 0)
  const maxTotalScore = FORM_MODULES.reduce((sum, m) => sum + m.maxScore, 0)
  const percentage = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0
  const riskLevel = getRiskLevel(percentage)

  return (
    <div className="flex gap-6 h-screen bg-gray-50">
      <FormSidebar
        modules={FORM_MODULES}
        currentStep={formState.currentStep}
        scores={formState.scores}
        totalPercentage={percentage}
        riskLevel={riskLevel}
        saving={saving}
        onStepClick={(step) =>
          setFormState((prev) => ({
            ...prev,
            currentStep: step,
          }))
        }
      />

      <div className="flex-1 overflow-y-auto p-8">
        <FormModule
          module={currentModule}
          formData={formState.data}
          onFieldChange={handleFieldChange}
          onModuleComplete={handleModuleComplete}
        />

        <div className="flex justify-between mt-8 gap-4">
          <button
            onClick={handlePrevious}
            disabled={formState.currentStep === 1}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Previous
          </button>

          {formState.currentStep === FORM_MODULES.length ? (
            <button
              onClick={() => console.log("Submit form")}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Submit for Approval
            </button>
          ) : (
            <button onClick={handleNext} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
