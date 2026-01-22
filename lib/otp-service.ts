import { createClient } from '@supabase/supabase-js'

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Store OTP in database (temporary solution)
async function storeOTP(email: string, otp: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Store OTP with 10-minute expiry
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  
  await supabase
    .from('otp_codes')
    .upsert({
      email,
      code: otp,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'email'
    })
}

// Send OTP using Resend
async function sendOTPEmail(email: string, otp: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: [email],
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your Verification Code</h2>
          <p style="font-size: 18px; color: #666;">Use the code below to verify your email address:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333;">${otp}</span>
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send OTP: ${error}`)
  }
}

export async function sendOTP(email: string): Promise<void> {
  const otp = generateOTP()
  
  try {
    await storeOTP(email, otp)
    await sendOTPEmail(email, otp)
    console.log('OTP sent successfully to:', email)
  } catch (error) {
    console.error('Error sending OTP:', error)
    throw error
  }
}

export async function verifyOTP(email: string, providedOTP: string): Promise<boolean> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('otp_codes')
    .select('code, expires_at')
    .eq('email', email)
    .single()

  if (error || !data) {
    return false
  }

  // Check if OTP is expired
  const now = new Date()
  const expiresAt = new Date(data.expires_at)
  
  if (now > expiresAt) {
    return false
  }

  // Verify OTP
  const isValid = data.code === providedOTP
  
  if (isValid) {
    // Clean up used OTP
    await supabase
      .from('otp_codes')
      .delete()
      .eq('email', email)
  }

  return isValid
}
