"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { ROLE_DASHBOARD_ROUTES } from "@/lib/constants/roles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PasswordInput } from "@/components/ui/password-input"
import { useToast } from "@/components/ui/use-toast"
import { AppPageLoader } from '@/components/ui/app-loader'
import { ROLES, ROLE_DISPLAY_NAMES, SIGNUP_ROLES } from "@/lib/role-definitions"
import { Truck, Users, Shield, Building, Wrench, Eye, ClipboardList, Car, HardHat, FileText, Settings, Gavel, User } from "lucide-react"

function AuthSetupContent() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    organization: "",
    role: ""
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  useEffect(() => {
    const userIdParam = searchParams.get("user_id")
    if (userIdParam) {
      setUserId(userIdParam)
    } else {
      // Redirect to auth if no user ID
      router.push("/auth")
    }
  }, [searchParams, router])

  const getRoleIcon = (role: string) => {
    switch (role) {
      case ROLES.DRIVER:
        return <Truck className="h-4 w-4" />
      case ROLES.MECHANIC:
        return <Wrench className="h-4 w-4" />
      case ROLES.SUPERVISOR:
        return <HardHat className="h-4 w-4" />
      case ROLES.ORG_ADMIN:
        return <Building className="h-4 w-4" />
      case ROLES.SUPER_ADMIN:
        return <Settings className="h-4 w-4" />
      case ROLES.STAFF:
        return <User className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required"
    }

    if (!formData.role) {
      newErrors.role = "Please select a role"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || !userId) {
      return
    }

    setLoading(true)

    try {
      // Get user data from auth
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        setErrors({ submit: "Failed to get user information" })
        return
      }

      // Create user profile using API endpoint (bypasses RLS with service role key)
      const profileResponse = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          role: formData.role,
          fullName: formData.fullName,
          isVerified: true, // User is already authenticated
        }),
      })

      const profileResult = await profileResponse.json()

      if (!profileResponse.ok || profileResult.error) {
        console.error('Error creating user profile:', profileResult.error)
        setErrors({ submit: profileResult.error || 'Failed to create user profile' })
        return
      }

      toast({
        title: "Setup Complete!",
        description: "Your account has been configured successfully.",
      })

      // Redirect based on role using centralized routing
      const redirectUrl = ROLE_DASHBOARD_ROUTES[formData.role] || '/auth'

      router.push(redirectUrl)
    } catch (err) {
      setErrors({ submit: "An unexpected error occurred. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  if (!userId) {
    return <AppPageLoader label="Loading setup..." className="bg-gradient-to-br from-green-50 to-green-100" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Truck className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">IFSM</h1>
          </div>
          <h2 className="text-xl text-gray-600">Complete Your Profile</h2>
          <p className="text-sm text-gray-500 mt-2">Please provide some additional information to set up your account</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">Account Setup</CardTitle>
            <CardDescription className="text-center">
              Complete your profile to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full-name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="full-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="pl-10"
                    required
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-red-600">{errors.fullName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNUP_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(role.value)}
                          {role.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-red-600">{errors.role}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization">Organization (Optional)</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="organization"
                    type="text"
                    placeholder="Enter organization name"
                    value={formData.organization}
                    onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              {errors.submit && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {errors.submit}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Setting up..." : "Complete Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AuthSetupPage() {
  return (
    <Suspense fallback={
      <AppPageLoader label="Loading setup..." className="bg-gradient-to-br from-green-50 to-green-100" />
    }>
      <AuthSetupContent />
    </Suspense>
  )
}
