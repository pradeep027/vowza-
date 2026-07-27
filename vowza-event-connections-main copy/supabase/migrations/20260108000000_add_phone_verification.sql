-- Add phone verification column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON profiles(phone_verified);

-- Add OTP verifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for otp_verifications
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert OTP verifications" 
ON otp_verifications FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Anyone can read OTP verifications" 
ON otp_verifications FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Anyone can update OTP verifications" 
ON otp_verifications FOR UPDATE 
TO anon, authenticated 
USING (true);

-- Add index for phone lookup
CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone ON otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON otp_verifications(expires_at);

-- Clean up expired OTPs automatically (run this as a scheduled job)
-- DELETE FROM otp_verifications WHERE expires_at < NOW();
