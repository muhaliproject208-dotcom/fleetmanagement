'use client'; // MUST be first

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROLE_DASHBOARD_ROUTES } from '@/lib/constants/roles';
import { getSupabaseClient } from '@/lib/supabase-client';

// Ensure this page is fully dynamic (no prerendering)
export const dynamic = 'force-dynamic';

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || ''; // fallback to empty string

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: otp }),
      });

      const data = await response.json();

      if (response.ok) {
        // After successful OTP verification, get user role and redirect appropriately
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Get user profile to determine role
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          // Redirect to role-specific dashboard
          const dashboardRoute = ROLE_DASHBOARD_ROUTES[profile?.role as keyof typeof ROLE_DASHBOARD_ROUTES];
          const redirectUrl = dashboardRoute || '/dashboard/driver'; // fallback to driver
          router.push(redirectUrl);
        } else {
          router.push('/dashboard/driver'); // fallback
        }
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch (err) {
      setError('Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!email) {
      setError('Email is required to resend OTP');
      return;
    }

    setResending(true);
    setError('');
    setResendSuccess(false);

    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        setError(data.error || 'Failed to resend OTP');
      }
    } catch (err) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold text-center">Verify OTP</h2>
        <p className="text-center text-gray-600">
          Enter code sent to <span className="font-medium">{email}</span>
        </p>
        
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
          />
          
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          
          {resendSuccess && (
            <p className="text-green-600 text-sm font-medium">OTP has been resent to your email!</p>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>

          <div className="pt-2 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-3">
              Didn't receive the code?
            </p>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resending || !email}
              className="w-full bg-green-50 text-green-700 border border-green-300 py-2 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {resending ? 'Sending OTP...' : 'Resend OTP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyOTPContent />
    </Suspense>
  );
}
