"use client"

import type React from "react"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { isSupabaseConfigured } from '@/lib/supabase-client'
import { ROLE_DASHBOARD_ROUTES, getDashboardRoute } from '@/lib/constants/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PasswordInput } from '@/components/ui/password-input'
import { useToast } from '@/components/ui/use-toast'
import { ROLES, ROLE_DISPLAY_NAMES, SIGNUP_ROLES } from '@/lib/role-definitions'
import { Truck, Users, Shield, Building, Wrench, Eye, EyeOff, ClipboardList, Car, HardHat, FileText, Settings, Gavel, User, Mail, Lock, UserPlus, BarChart3 } from 'lucide-react'
import { PasswordStrengthMeter } from "@/components/password-strength-meter"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface LoginData {
  email: string
  password: string
  otp?: string
}

interface SignUpData {
  email: string
  password: string
  confirmPassword: string
  fullName: string
  organization: string
  role: string
}

export default function AuthPage() {
  // Check if Supabase is configured (for build-time rendering)
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication System</h1>
          <p className="text-gray-600">Please configure environment variables to enable authentication.</p>
        </div>
      </div>
    )
  }

  const [loginData, setLoginData] = useState<LoginData>({
    email: "",
    password: "",
    otp: ""
  })
  const [useOTP, setUseOTP] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [signUpData, setSignUpData] = useState<SignUpData>({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    organization: "",
    role: ""
  })
  const [activeTab, setActiveTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()
  const supabase = getSupabaseClient()
  const { toast } = useToast()

  const setSignupContext = async (email: string, role: string) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('signup_email', email)
    window.localStorage.setItem('signup_role', role)
  }

  const getSignupContext = async () => {
    if (typeof window === 'undefined') return { email: null as string | null, role: null as string | null }
    const email = window.localStorage.getItem('signup_email')
    const role = window.localStorage.getItem('signup_role')
    return { email, role }
  }

  const clearSignupContext = async () => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem('signup_email')
    window.localStorage.removeItem('signup_role')
  }

  // Helper function to get role icon
  const getRoleIcon = (role: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      driver: <Car className="h-4 w-4" />,
      admin: <Shield className="h-4 w-4" />,
      fleet_manager: <Truck className="h-4 w-4" />,
      supervisor: <Users className="h-4 w-4" />,
      mechanic: <Wrench className="h-4 w-4" />,
      inspector: <ClipboardList className="h-4 w-4" />,
      safety_officer: <HardHat className="h-4 w-4" />,
      compliance_officer: <FileText className="h-4 w-4" />,
      operations_manager: <Settings className="h-4 w-4" />,
      legal_counsel: <Gavel className="h-4 w-4" />
    }
    return iconMap[role] || <User className="h-4 w-4" />
  }

  // Handle URL error parameters
  useEffect(() => {
    if (typeof window === 'undefined') return

    const urlParams = new URLSearchParams(window.location.search)
    const error = urlParams.get('error')
    const message = urlParams.get('message')
    const verified = urlParams.get('verified')

    if (error) {
      switch (error) {
        case 'email_link_expired':
          setErrors({ login: 'Email confirmation link has expired. Please request a new one.' })
          toast({
            title: 'Link Expired',
            description: 'Your email confirmation link has expired. Please sign up again.',
            variant: 'destructive',
          })
          break
        case 'auth_failed':
          setErrors({ login: message || 'Authentication failed. Please try again.' })
          toast({
            title: 'Authentication Failed',
            description: message || 'Please check your credentials and try again.',
            variant: 'destructive',
          })
          break
      }

      router.push(window.location.pathname)
    }

    if (verified) {
      toast({
        title: 'Email Verified!',
        description: 'Your email has been successfully confirmed.',
      })
      router.push(window.location.pathname)
    }

    if (urlParams.get('signup') === 'success') {
      toast({
        title: 'Account Created!',
        description: 'Your account has been successfully created.',
      })
      router.push(window.location.pathname)
    }
  }, [toast, router]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateLogin = () => {
    const newErrors: Record<string, string> = {}

    if (!validateEmail(loginData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (useOTP) {
      if (!loginData.otp) {
        newErrors.otp = "OTP code is required"
      } else if (loginData.otp.length < 6) {
        newErrors.otp = "OTP code must be 6 digits"
      }
    } else {
      if (!loginData.password) {
        newErrors.password = "Password is required"
      } else if (loginData.password.length < 1) {
        newErrors.password = "Password cannot be empty"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateSignUp = () => {
    const newErrors: Record<string, string> = {}

    if (!validateEmail(signUpData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (signUpData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    }

    if (passwordStrength < 60) {
      newErrors.passwordStrength = "Password is too weak"
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    if (!signUpData.fullName.trim()) {
      newErrors.fullName = "Full name is required"
    }

    if (!signUpData.role) {
      newErrors.role = "Please select a role"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateLogin()) {
      return
    }

    setLoading(true)
    setErrors({})

    try {
      // If OTP is provided, verify OTP instead of password
      if (loginData.otp) {
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          email: loginData.email,
          token: loginData.otp,
          type: 'signup'
        })

        if (verifyError) {
          setErrors({ login: 'Invalid OTP code' })
          return
        }

        if (verifyData.user) {
          // OTP verified successfully - fetch user role
          const { data: userDetails, error: roleError } = await supabase
            .from('users')
            .select('role, is_verified')
            .eq('id', verifyData.user.id)
            .single()

          if (roleError) {
            console.error('Error fetching user role:', roleError)
            toast({
              title: "Login Successful!",
              description: "OTP verified successfully.",
            })
            
            // Get user role and redirect to appropriate dashboard
            const { data: profile } = await supabase
              .from('users')
              .select('role')
              .eq('id', verifyData.user.id)
              .maybeSingle();

            const redirectUrl = getDashboardRoute(profile?.role)
            router.push(redirectUrl)
            return
          }

          // Check if user is verified
          if (!userDetails?.is_verified) {
            setErrors({ login: 'Please complete email verification first.' })
            return
          }

          toast({
            title: "Login Successful!",
            description: "OTP verified successfully.",
          })

          // Redirect to role-specific dashboard
          const redirectUrl = getDashboardRoute(userDetails?.role)
          if (redirectUrl) {
            router.replace(redirectUrl)
          } else {
            setErrors({ login: 'User role not found. Please contact support.' })
          }
          return
        }
      }

      // Regular password login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      })

      if (authError) {
        setErrors({ login: authError.message })
        return
      }

      if (authData.user) {
        // Get user profile with verification status
        console.log('Fetching profile for user ID:', authData.user.id)
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('role, org_id, is_verified')
          .eq('id', authData.user.id)
          .maybeSingle()

        console.log('Profile fetch result:', { profile, profileError })
        
        // Handle case where query succeeds but returns no data
        if (!profile && !profileError) {
          console.log('No profile found for user, treating as missing profile')
          // User exists in auth but not in users table, create user profile from metadata if available
          console.log('Creating user profile for existing auth user...')
          const roleFromMeta = authData.user.user_metadata?.role || (typeof window !== 'undefined' ? window.localStorage.getItem('signup_role') : null)
          if (!roleFromMeta) {
            console.warn('No role metadata found for user; redirecting to setup to choose role', { userId: authData.user.id })
            router.replace(`/auth/setup?user_id=${authData.user.id}`)
            return
          }

          const response = await fetch('/api/create-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: authData.user.id,
              email: authData.user.email,
              role: roleFromMeta,
              fullName: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0],
              isVerified: true, // Assume existing users are verified
            }),
          })

          if (response.ok) {
            // Redirect to default driver dashboard
            const dashboardRoute = ROLE_DASHBOARD_ROUTES['driver']
            if (dashboardRoute) {
              router.replace(dashboardRoute)
            } else {
              setErrors({ login: 'Default role dashboard not found. Please contact support.' })
            }
            return
          } else {
            setErrors({ login: 'Profile setup required. Please contact support.' })
          }
        } else if (profileError) {
          // Debug the profileError object to understand its structure
          console.log('Debug - profileError type:', typeof profileError)
          console.log('Debug - profileError keys:', Object.keys(profileError))
          console.log('Debug - profileError length:', Object.keys(profileError).length)
          console.log('Debug - profileError value:', JSON.stringify(profileError, null, 2))
          
          // Check if this is an empty error object (RLS issue) or a real error
          const isEmptyError = profileError && Object.keys(profileError).length === 0
          
          console.log('Debug - isEmptyError:', isEmptyError)
          
          // Handle empty error objects (likely 500 RLS issues) or HTTP 500 errors or RLS recursion errors
          if (isEmptyError || profileError?.message?.includes('500') || profileError?.status === 500 || profileError?.code === '42P17') {
            console.log('Empty error object, 500 error, or RLS recursion detected - treating as missing profile')
            // User exists in auth but can't access users table due to RLS, create profile via API
            console.log('Creating user profile via API due to RLS restrictions...')
            const roleFromMeta = authData.user.user_metadata?.role || (typeof window !== 'undefined' ? window.localStorage.getItem('signup_role') : null)
            if (!roleFromMeta) {
              console.warn('No role metadata found for user (RLS case); redirecting to setup to choose role', { userId: authData.user.id })
              router.replace(`/auth/setup?user_id=${authData.user.id}`)
              return
            }

            const response = await fetch('/api/create-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: authData.user.id,
                email: authData.user.email,
                role: roleFromMeta,
                fullName: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0],
                isVerified: true, // Assume existing users are verified
              }),
            })

            if (response.ok) {
              // Redirect to role-specific dashboard
              const dashboardRoute = getDashboardRoute(roleFromMeta || 'driver')
              if (dashboardRoute) {
                router.replace(dashboardRoute)
              } else {
                setErrors({ login: 'Default role dashboard not found. Please contact support.' })
              }
              return
            } else if (response.status === 409) {
              // 409 Conflict means user already exists - this is actually success
              console.log('User profile already exists (409), proceeding to dashboard')
              const dashboardRoute = getDashboardRoute(roleFromMeta || 'driver')
              if (dashboardRoute) {
                router.replace(dashboardRoute)
              } else {
                setErrors({ login: 'Default role dashboard not found. Please contact support.' })
              }
              return
            } else {
              setErrors({ login: 'Profile setup required. Please contact support.' })
            }
            return
          }
          
          // Handle real database errors
          const errorMessage = profileError?.message || 'Unknown database error'
          const errorCode = profileError?.code || 'UNKNOWN'
          
          console.error('Error fetching profile:', profileError)
          console.error('Profile error details:', {
            code: profileError?.code || 'UNKNOWN',
            message: errorMessage,
            details: profileError?.details || null,
            hint: profileError?.hint || null,
            errorObject: profileError
          })
          
          // Handle different types of database errors
          if (profileError.code === 'PGRST116' || profileError.message?.includes('No rows found')) {
            // User exists in auth but not in users table, create user profile from metadata if available
            console.log('Creating user profile for existing auth user...')
            const roleFromMeta = authData.user.user_metadata?.role || (typeof window !== 'undefined' ? window.localStorage.getItem('signup_role') : null)
            if (!roleFromMeta) {
              console.warn('No role metadata found for user; redirecting to setup to choose role', { userId: authData.user.id })
              router.replace(`/auth/setup?user_id=${authData.user.id}`)
              return
            }

            const response = await fetch('/api/create-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: authData.user.id,
                email: authData.user.email,
                role: roleFromMeta,
                fullName: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0],
                isVerified: true, // Assume existing users are verified
              }),
            })

            if (response.ok) {
              // Redirect to role-specific dashboard
              const dashboardRoute = getDashboardRoute(roleFromMeta || 'driver')
              if (dashboardRoute) {
                router.replace(dashboardRoute)
              } else {
                setErrors({ login: 'Default role dashboard not found. Please contact support.' })
              }
              return
            } else {
              setErrors({ login: 'Profile setup required. Please contact support.' })
              return
            }
          } else if (profileError.code === '42501' || profileError.message?.includes('permission denied')) {
            setErrors({ login: 'Permission denied accessing user profile. Please contact support.' })
          } else if (profileError.code === 'PGRST301' || profileError.message?.includes('insufficient_privilege')) {
            setErrors({ login: 'Insufficient privileges to access user data. Please contact support.' })
          } else {
            setErrors({ login: `Database error (${profileError.code}): ${profileError.message || 'Unknown error'}. Please try again or contact support.` })
          }
          return
        } else {
          // Profile exists, proceed with verification
          console.log('User profile found:', profile)
          
          // Check if user is verified
          if (!profile?.is_verified) {
            // If the Supabase auth user shows email_confirmed_at, try to sync that to the users table
            const authConfirmed = authData.user?.email_confirmed_at
            if (authConfirmed) {
              try {
                const resp = await fetch('/api/auth/mark-verified', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: authData.user.id, email_confirmed_at: authConfirmed })
                })

                if (resp.ok) {
                  console.log('Synchronized verification status from auth to users table')
                  // proceed as verified
                } else {
                  console.warn('Failed to synchronize verification status, but allowing login if auth indicates verified', await resp.text())
                }
              } catch (e) {
                console.error('Error calling mark-verified endpoint:', e)
              }
            } else {
              setErrors({ login: 'Your email is not verified. Please check your inbox for OTP.' })
              return
            }
          }
          
          // Redirect based on role (normalize role and use helper)
          const role = profile?.role || 'driver' // Default fallback
          const dashboardRoute = getDashboardRoute(role) || '/dashboard'
          
          if (!dashboardRoute) {
            setErrors({ login: 'Invalid user role. Please contact support.' })
            return
          }
          
          toast({
            title: 'Login Successful!',
            description: 'OTP verified successfully.',
          })

          // Clear login form on successful login
          setLoginData({ email: '', password: '', otp: '' })
          setErrors({})
          
          // Clean up stored data
          await clearSignupContext()

          // Use router.replace to prevent going back to OTP page
          router.replace(dashboardRoute)
        }
      }
    } catch (err) {
      setErrors({ login: "An unexpected error occurred. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateSignUp()) {
      return
    }

    setLoading(true)

    try {
      // 1️⃣ Sign up user with email confirmation link (not OTP)
      // Email template in Supabase will send confirmation link
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: {
          data: {
            full_name: signUpData.fullName,
            role: signUpData.role, // Store role in metadata for callback handler
          },
          // Redirect to callback route when user clicks email confirmation link
          emailRedirectTo: typeof window !== 'undefined' 
            ? `${window.location.origin}/auth/callback` 
            : '/auth/callback',
        }
      })

      if (authError) {
        setErrors({ signup: authError.message })
        return
      }

      // Check if user was created successfully
      if (!authData.user) {
        setErrors({ signup: 'Failed to create user account' })
        return
      }

      console.log('Signup successful, requesting confirmation email for:', signUpData.email)

      // 2️⃣ Explicitly request confirmation email if not sent automatically
      // This ensures email is sent even if email confirmation is disabled in Supabase
      let emailSent = false
      try {
        const resendResponse = await fetch('/api/auth/resend-confirmation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: signUpData.email }),
        })

        const resendResult = await resendResponse.json()
        
        if (!resendResponse.ok) {
          console.warn('Failed to send confirmation email:', resendResult)
          // Show warning but don't fail signup - user can request manually
          toast({
            title: "Account Created",
            description: "Account created but confirmation email failed. Please use 'Resend Email' button.",
            variant: "destructive"
          })
        } else {
          console.log('Confirmation email sent successfully')
          emailSent = true
        }
      } catch (resendError) {
        console.error('Error sending confirmation email:', resendError)
        // Don't fail signup if resend fails, user can request it manually
        toast({
          title: "Account Created",
          description: "Account created. If you don't receive email, use 'Resend Email' button.",
          variant: "default"
        })
      }

      // Show success message if email was sent
      if (emailSent) {
        toast({
          title: "Account Created!",
          description: "Please check your email (and spam folder) for the confirmation link.",
        })
      }

      // 3️⃣ Temporarily store signup context (OTP step needs this)
      await setSignupContext(signUpData.email, signUpData.role)

      // 4️⃣ Create user profile (idempotent)
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: authData.user.id,
          email: signUpData.email,
          role: signUpData.role,
          fullName: signUpData.fullName,
          isVerified: false, // User is not verified yet
        }),
      })

      const result = await response.json()
      
      if (!response.ok || result.error) {
        console.error('Profile creation error:', result.error)
        // Don't fail the signup if profile creation fails, but log it
        // The callback handler will try to create the profile automatically if needed
        console.log('Profile creation failed, but user was created successfully. Profile will be created on email confirmation.')
      }

      // 5️⃣ Redirect to check-email page (for email link confirmation)
      // OTP verification page is still available at /auth/verify-otp if needed
      router.push(`/auth/check-email?email=${encodeURIComponent(signUpData.email)}`)

      // Don't clear form yet - let check-email page handle cleanup after successful verification
    } catch (err) {
      setErrors({ signup: "An unexpected error occurred. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Auth Forms */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="mb-8 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
              <div className="bg-green-600 rounded-xl p-2">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">IFSM</h1>
                <p className="text-xs text-gray-500 font-medium">Fleet Safety System</p>
              </div>
            </div>
            <h2 className="text-xl text-gray-900 font-semibold mt-4">Welcome Back</h2>
            <p className="text-sm text-gray-600 mt-1">Sign in to access your fleet dashboard</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
            <div className="p-8">
              <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">Sign In</h3>
              <p className="text-center text-gray-600 mb-8">Choose your preferred sign-in method</p>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-100 p-1 rounded-xl">
                  <TabsTrigger 
                    value="login" 
                    className="font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 text-gray-600"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup" 
                    className="font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 text-gray-600"
                  >
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-5">
                    {/* Google Sign-In - Primary Option */}
                    <div className="space-y-4">
                      {/* <GoogleSignInButton 
                        onSuccess={() => {
                          toast({
                            title: "Google Sign-In",
                            description: "Redirecting to Google...",
                          })
                        }}
                        onError={(error) => {
                          toast({
                            title: "Google Sign-In Failed",
                            description: error.message,
                            variant: "destructive",
                          })
                        }}
                      /> */}
                      
                      <div className="relative">
                        <span className="w-full border-t border-gray-200"></span>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-3 text-gray-500 font-medium">
                            Or continue with email
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Email Sign-In */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-sm font-medium text-gray-700">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="login-email"
                            type="email"
                            placeholder="Enter your email address"
                            value={loginData.email}
                            onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                            className="pl-10 h-11 bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500/20"
                            required
                          />
                        </div>
                        {errors.email && (
                          <p className="text-sm text-red-600 flex items-center gap-1">
                            <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                            {errors.email}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-sm font-medium text-gray-700">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="login-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            value={loginData.password}
                            onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                            className="pl-10 pr-10 h-11 bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500/20"
                            required
                            disabled={useOTP}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                            disabled={useOTP}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {errors.password && (
                          <p className="text-sm text-red-600 font-sans flex items-center gap-1">
                            <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                            {errors.password}
                          </p>
                        )}
                      </div>

                      {/* OTP Option - Enhanced */}
                      <div className="flex items-center justify-between pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-sm text-green-600 hover:text-green-700 hover:bg-green-50 p-0 h-auto font-sans"
                          onClick={() => setUseOTP(!useOTP)}
                        >
                          {useOTP ? "Use password instead" : "Use OTP code instead"}
                        </Button>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 p-0 h-auto font-sans"
                          onClick={() => {
                            toast({
                              title: "Password Reset",
                              description: "Password reset functionality coming soon. Please contact support.",
                            })
                          }}
                        >
                          Forgot password?
                        </Button>
                      </div>

                      {useOTP && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                          <Label htmlFor="login-otp" className="font-sans text-sm font-medium text-gray-700">OTP Code</Label>
                          <div className="relative">
                            <ClipboardList className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id="login-otp"
                              type="text"
                              placeholder="Enter 6-digit code"
                              value={loginData.otp}
                              onChange={(e) => setLoginData(prev => ({ ...prev, otp: e.target.value }))}
                              className="pl-10 font-sans h-11 border-gray-200 focus:border-green-500 focus:ring-green-500/20 text-center tracking-widest"
                              required={useOTP}
                              maxLength={6}
                            />
                          </div>
                          {errors.otp && (
                            <p className="text-sm text-red-600 font-sans flex items-center gap-1">
                              <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                              {errors.otp}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 font-sans flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            Check your email for the OTP code
                          </p>
                        </div>
                      )}

                      {errors.login && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-sans">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                            </div>
                            {errors.login}
                          </div>
                        </div>
                      )}

                      <Button type="submit" className="w-full font-sans h-11 bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200" disabled={loading}>
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Signing in...
                          </div>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-5">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name" className="font-sans text-sm font-medium text-gray-700">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="signup-name"
                            type="text"
                            placeholder="Enter your full name"
                            value={signUpData.fullName}
                            onChange={(e) => setSignUpData(prev => ({ ...prev, fullName: e.target.value }))}
                            className="pl-10 font-sans h-11 border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                            required
                          />
                        </div>
                        {errors.fullName && (
                          <p className="text-sm text-red-600 font-sans flex items-center gap-1">
                            <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                            {errors.fullName}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="font-sans text-sm font-medium text-gray-700">Email Address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="Enter your email address"
                            value={signUpData.email}
                            onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                            className="pl-10 font-sans h-11 border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                            required
                          />
                        </div>
                        {errors.email && (
                          <p className="text-sm text-red-600 font-sans flex items-center gap-1">
                            <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                            {errors.email}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="font-sans text-sm font-medium text-gray-700">Password</Label>
                        <PasswordInput
                          id="signup-password"
                          placeholder="Create a strong password"
                          value={signUpData.password}
                          onChange={(value) => setSignUpData(prev => ({ ...prev, password: value }))}
                          className="font-sans h-11 border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                          required
                        />
                        <PasswordStrengthMeter 
                          password={signUpData.password} 
                          onStrengthChange={setPasswordStrength}
                        />
                        {errors.password && (
                          <p className="text-sm text-red-600 font-sans flex items-center gap-1">
                            <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                            {errors.password}
                          </p>
                        )}
                        {errors.passwordStrength && (
                          <p className="text-sm text-red-600 font-sans flex items-center gap-1">
                            <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                            {errors.passwordStrength}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm" className="font-sans text-sm font-medium text-gray-700">Confirm Password</Label>
                        <PasswordInput
                          id="signup-confirm"
                          placeholder="Confirm your password"
                          value={signUpData.confirmPassword}
                          onChange={(value) => setSignUpData(prev => ({ ...prev, confirmPassword: value }))}
                          className="font-sans h-11 border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                          required
                        />
                        {errors.confirmPassword && (
                          <p className="text-sm text-red-600 font-sans flex items-center gap-1">
                            <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                            {errors.confirmPassword}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-role" className="font-sans text-sm font-medium text-gray-700">Role</Label>
                        <Select value={signUpData.role} onValueChange={(value) => setSignUpData(prev => ({ ...prev, role: value }))}>
                          <SelectTrigger className="font-sans h-11 border-gray-200 focus:border-green-500 focus:ring-green-500/20">
                            <SelectValue placeholder="Select your role" />
                          </SelectTrigger>
                          <SelectContent>
                            {SIGNUP_ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value} className="font-sans">
                                <div className="flex items-center gap-2">
                                  {getRoleIcon(role.value)}
                                  {role.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.role && (
                          <p className="text-sm text-red-600 font-sans flex items-center gap-1">
                            <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                            {errors.role}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-org" className="font-sans text-sm font-medium text-gray-700">Organization (Optional)</Label>
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="signup-org"
                            type="text"
                            placeholder="Enter organization name"
                            value={signUpData.organization}
                            onChange={(e) => setSignUpData(prev => ({ ...prev, organization: e.target.value }))}
                            className="pl-10 font-sans h-11 border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                          />
                        </div>
                      </div>
                    </div>

                    {errors.signup && (
                      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-sans">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                          </div>
                          {errors.signup}
                        </div>
                      </div>
                    )}

                    <Button type="submit" className="w-full font-sans h-11 bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200" disabled={loading}>
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Creating account...
                        </div>
                      ) : (
                        "Create Account"
                      )}
                    </Button>

                    <div className="text-center">
                      <p className="text-xs text-gray-500 font-sans">
                        By creating an account, you agree to our
                        <button type="button" className="text-green-600 hover:text-green-700 underline ml-1">
                          Terms of Service
                        </button>
                        {' '}and{' '}
                        <button type="button" className="text-green-600 hover:text-green-700 underline ml-1">
                          Privacy Policy
                        </button>
                      </p>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          </div>

        </div>

        {/* Right side - Features */}
        <div className="hidden lg:block">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Why Choose IFSM?</h3>
              <p className="text-gray-600">Complete fleet safety management solution</p>
            </div>
            
            <div className="space-y-6">
              <div className="group">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-green-50 border border-green-100 group-hover:bg-green-100 transition-all duration-200">
                  <div className="bg-green-600 p-2 rounded-lg">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">Comprehensive Safety</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">11-module pre-trip inspection system covering all critical safety aspects</p>
                  </div>
                </div>
              </div>

              <div className="group">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 group-hover:bg-emerald-100 transition-all duration-200">
                  <div className="bg-emerald-600 p-2 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">Real-Time Analytics</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">Track compliance metrics and risk distribution across your fleet</p>
                  </div>
                </div>
              </div>

              <div className="group">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-teal-50 border border-teal-100 group-hover:bg-teal-100 transition-all duration-200">
                  <div className="bg-teal-600 p-2 rounded-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">Role-Based Access</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">Tailored dashboards for drivers, admins, and supervisors</p>
                  </div>
                </div>
              </div>

              <div className="group">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-lime-50 border border-lime-100 group-hover:bg-lime-100 transition-all duration-200">
                  <div className="bg-lime-600 p-2 rounded-lg">
                    <Truck className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">Fleet Management</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">Complete oversight of trips, drafts, and critical failures</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="bg-linear-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-green-800">Enterprise-Grade Security</h4>
                </div>
                <p className="text-sm text-green-700 leading-relaxed">
                  Built with advanced security features, audit logging, and compliance with industry standards for complete peace of mind.
                </p>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 bg-green-600 rounded-full border-2 border-white"></div>
                  <div className="w-8 h-8 bg-emerald-600 rounded-full border-2 border-white"></div>
                  <div className="w-8 h-8 bg-teal-600 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Trusted by Industry Leaders</p>
                  <p className="text-xs text-gray-600">Join 500+ fleet operators worldwide</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
