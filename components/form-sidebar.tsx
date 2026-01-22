"use client"
import type { FormModule } from "@/lib/form-config"

interface FormSidebarProps {
  modules: FormModule[]
  currentStep: number
  scores: { [moduleId: string]: number }
  totalPercentage: number
  riskLevel: "low" | "medium" | "high" | "critical"
  saving: boolean
  onStepClick: (step: number) => void
}

export default function FormSidebar({
  modules,
  currentStep,
  scores,
  totalPercentage,
  riskLevel,
  saving,
  onStepClick,
}: FormSidebarProps) {
  const getRiskColor = () => {
    switch (riskLevel) {
      case "low":
        return "bg-green-100 text-green-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "high":
        return "bg-orange-100 text-orange-800"
      case "critical":
        return "bg-red-100 text-red-800"
    }
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-green-700">IFSM</h1>
        <p className="text-sm text-gray-600 mt-1">Fleet Safety System</p>
      </div>

      <div className={`p-4 rounded-lg mb-6 ${getRiskColor()}`}>
        <p className="text-sm font-medium mb-1">Overall Score</p>
        <p className="text-3xl font-bold">{totalPercentage}%</p>
        <p className="text-sm mt-2 capitalize">Risk Level: {riskLevel}</p>
      </div>

      <div className="space-y-2 mb-6">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => onStepClick(module.step)}
            className={`w-full text-left px-4 py-3 rounded-lg transition ${
              currentStep === module.step ? "bg-green-100 border-l-4 border-green-600" : "hover:bg-gray-100"
            }`}
          >
            <p className="font-medium text-gray-900">Step {module.step}</p>
            <p className="text-xs text-gray-600">{module.title}</p>
            {scores[module.id] !== undefined && (
              <p className="text-xs font-semibold text-green-600 mt-1">
                {scores[module.id]}/{module.maxScore}
              </p>
            )}
          </button>
        ))}
      </div>

      {saving && <p className="text-xs text-gray-500 text-center">Saving...</p>}
    </div>
  )
}
