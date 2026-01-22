'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Mail, CheckCircle, AlertCircle, Key, Loader2 } from 'lucide-react'
import { ROLE_DASHBOARD_ROUTES } from '@/lib/constants/roles'
import { getSupabaseClient } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'

function CheckEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [error, setError] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [otpStatus, setOtpStatus] = useState<'empty' | 'invalid' | 'valid' | 'validating'>('empty')

  const handleVerifyOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    setError('')
    setOtpStatus('validating')

    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: otp }),
      })

      const data = await response.json()

      if (response.ok) {
        setOtpStatus('valid')
        // After successful OTP verification, get user role and redirect appropriately
        const supabase = getSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Get user profile to determine role
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()

          // Redirect to role-specific dashboard
          const dashboardRoute = ROLE_DASHBOARD_ROUTES[profile?.role as keyof typeof ROLE_DASHBOARD_ROUTES]
          const redirectUrl = dashboardRoute || '/dashboard/driver'
          router.push(redirectUrl)
        } else {
          router.push('/dashboard/driver')
        }
      } else {
        setOtpStatus('invalid')
        setError(data.error || 'Invalid OTP')
      }
    } catch (err) {
      setOtpStatus('invalid')
      setError('Failed to verify OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 8)
    setOtp(cleanValue)
    
    // Update status based on length
    if (cleanValue.length === 0) {
      setOtpStatus('empty')
      setError('')
    } else if (cleanValue.length === 8) {
      // Auto-validate when 8 digits are entered
      setOtpStatus('validating')
      handleVerifyOTP() // Auto-submit
    } else {
      setOtpStatus('invalid')
      setError('')
    }
  }

  const handleResendOTP = async () => {
    if (!email) {
      setError('Email is required to resend OTP')
      return
    }

    setResending(true)
    setError('')
    setResendSuccess(false)

    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setResendSuccess(true)
        setTimeout(() => setResendSuccess(false), 5000)
      } else {
        setError(data.error || 'Failed to resend OTP')
      }
    } catch (err) {
      setError('Failed to resend OTP. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 bg-green-100 rounded-full p-3 w-16 h-16 flex items-center justify-center">
            <Key className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Enter Verification Code</CardTitle>
          <CardDescription>
            We've sent an 8-digit code to
          </CardDescription>
          <p className="font-medium text-gray-900 mt-2">{email}</p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="otp" className="text-sm font-medium text-gray-700">
                Verification Code
              </label>
              <div className="relative">
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => handleOtpChange(e.target.value)}
                  placeholder="Enter 8-digit code"
                  className={`text-center text-lg tracking-widest pr-10 ${
                    otpStatus === 'valid' ? 'border-green-500 bg-green-50' :
                    otpStatus === 'invalid' ? 'border-red-500 bg-red-50' :
                    otpStatus === 'validating' ? 'border-blue-500 bg-blue-50' :
                    'border-gray-300'
                  }`}
                  maxLength={8}
                  required
                  disabled={loading}
                />
                {otpStatus === 'validating' && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                  </div>
                )}
                {otpStatus === 'valid' && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                )}
                {otpStatus === 'invalid' && otp.length > 0 && otp.length < 8 && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </div>
                )}
              </div>
              {otp.length > 0 && otp.length < 8 && (
                <p className="text-xs text-gray-500">
                  {8 - otp.length} more digit{8 - otp.length !== 1 ? 's' : ''} needed
                </p>
              )}
              {otp.length === 8 && otpStatus !== 'validating' && otpStatus !== 'valid' && (
                <p className="text-xs text-blue-500">Verifying code...</p>
              )}
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {resendSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800 font-medium">
                    New verification code has been sent to your email!
                  </p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || otp.length !== 8 || otpStatus === 'validating'}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? 'Verifying...' : otpStatus === 'validating' ? 'Auto-verifying...' : 'Verify Code'}
            </Button>
          </form>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center mb-3">
              Didn't receive the code?
            </p>
            <Button
              onClick={handleResendOTP}
              disabled={resending || !email}
              variant="outline"
              className="w-full border-green-300 text-green-700 hover:bg-green-50"
            >
              {resending ? 'Sending...' : 'Resend Code'}
            </Button>
          </div>

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => router.push('/auth')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CheckEmailContent />
    </Suspense>
  )
}
