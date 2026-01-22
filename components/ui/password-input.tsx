"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface PasswordInputProps {
  id: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  className?: string
  required?: boolean
}

export function PasswordInput({ 
  id, 
  placeholder, 
  value, 
  onChange, 
  className = "",
  required = false 
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pr-10 ${className}`}
        required={required}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
        onClick={() => setShowPassword(!showPassword)}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4 text-gray-400" />
        ) : (
          <Eye className="h-4 w-4 text-gray-400" />
        )}
      </Button>
    </div>
  )
}
