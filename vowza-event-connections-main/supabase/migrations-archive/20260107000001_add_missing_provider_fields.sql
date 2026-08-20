-- Add missing fields to provider_profiles table for enhanced registration
ALTER TABLE public.provider_profiles 
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS youtube TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS gst_number TEXT,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS languages TEXT,
ADD COLUMN IF NOT EXISTS available_dates TEXT;

-- Add missing fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Create bank_details table for provider bank information
CREATE TABLE IF NOT EXISTS public.bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  upi_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on bank_details
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

-- RLS policies for bank_details
CREATE POLICY "Providers can manage own bank details" ON public.bank_details FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Add updated_at trigger for bank_details
CREATE TRIGGER update_bank_details_updated_at BEFORE UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update OTP verification policy to allow authenticated users to insert
DROP POLICY IF EXISTS "No direct access to OTP" ON public.otp_verifications;

CREATE POLICY "Users can insert OTP verifications" ON public.otp_verifications FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can verify OTP" ON public.otp_verifications FOR SELECT 
  USING (true);

CREATE POLICY "Users can update OTP verifications" ON public.otp_verifications FOR UPDATE 
  USING (true);
