"use client"

import type { FormModule } from "@/lib/form-config"
import FormSection from "./form-section"
import { useEffect } from "react"

interface FormModuleProps {
  module: FormModule
  formData: { [key: string]: any }
  onFieldChange: (fieldId: string, value: any) => void
  onModuleComplete: (moduleId: string, score: number) => void
}

export default function FormModuleComponent({ module, formData, onFieldChange, onModuleComplete }: FormModuleProps) {
  const calculateScore = (sectionItems: any[]) => {
    let score = 0
    sectionItems.forEach((item) => {
      const value = formData[item.id]
      if (value === true || value === "pass" || value === "yes" || value === "compliant" || value === "excellent") {
        score += item.points
      }
    })
    return score
  }

  const totalScore = module.sections.reduce((sum, section) => sum + calculateScore(section.items), 0)

  useEffect(() => {
    onModuleComplete(module.id, totalScore)
  }, [totalScore])

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Step {module.step}: {module.title}
            </h2>
            <p className="text-gray-600 mt-2">{module.description}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Module Score</p>
            <p className="text-3xl font-bold text-green-600">
              {totalScore}/{module.maxScore}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {module.sections.map((section) => (
          <FormSection key={section.id} section={section} formData={formData} onFieldChange={onFieldChange} />
        ))}
      </div>
    </div>
  )
}
