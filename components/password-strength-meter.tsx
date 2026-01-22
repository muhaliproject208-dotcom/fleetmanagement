"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface PasswordStrengthMeterProps {
  password: string
  onStrengthChange?: (strength: number) => void
}

export function PasswordStrengthMeter({ password, onStrengthChange }: PasswordStrengthMeterProps) {
  const [strength, setStrength] = useState(0)
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    if (!password) {
      setStrength(0)
      setFeedback("")
      onStrengthChange?.(0)
      return
    }

    let score = 0
    const checks = []

    // Length check
    if (password.length >= 8) {
      score += 20
      checks.push("Length ✓")
    } else {
      checks.push("Length: 8+ characters")
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 20
      checks.push("Uppercase ✓")
    } else {
      checks.push("Uppercase letter")
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 20
      checks.push("Lowercase ✓")
    } else {
      checks.push("Lowercase letter")
    }

    // Number check
    if (/\d/.test(password)) {
      score += 20
      checks.push("Number ✓")
    } else {
      checks.push("Number")
    }

    // Special character check
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 20
      checks.push("Special char ✓")
    } else {
      checks.push("Special character")
    }

    setStrength(score)
    setFeedback(checks.join(" • "))
    onStrengthChange?.(score)
  }, [password, onStrengthChange])

  const getStrengthColor = () => {
    if (strength === 0) return "bg-gray-200"
    if (strength <= 40) return "bg-red-500"
    if (strength <= 60) return "bg-yellow-500"
    if (strength <= 80) return "bg-blue-500"
    return "bg-green-500"
  }

  const getStrengthText = () => {
    if (strength === 0) return ""
    if (strength <= 40) return "Weak"
    if (strength <= 60) return "Fair"
    if (strength <= 80) return "Good"
    return "Strong"
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">Password strength</span>
        <span className={cn(
          "text-xs font-medium",
          strength <= 40 ? "text-red-600" :
          strength <= 60 ? "text-yellow-600" :
          strength <= 80 ? "text-blue-600" :
          "text-green-600"
        )}>
          {getStrengthText()}
        </span>
      </div>
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300 ease-out", getStrengthColor())}
          style={{ width: `${strength}%` }}
        />
      </div>
      {password && (
        <p className="text-xs text-gray-500">{feedback}</p>
      )}
    </div>
  )
}
