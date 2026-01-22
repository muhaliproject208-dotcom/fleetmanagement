-- Create OTP codes table for storing verification codes
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON public.otp_codes(email);

-- Enable RLS (Row Level Security)
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage OTP codes
CREATE POLICY "Service role can manage OTP codes" ON public.otp_codes
  FOR ALL USING (auth.role() = 'service_role');
