-- Create worker verification status enum
CREATE TYPE public.verification_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');

-- Create worker_profiles table for service providers requiring verification
CREATE TABLE public.worker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  gender TEXT,
  profile_photo_url TEXT,
  
  -- Service Information
  service_type TEXT NOT NULL,
  experience_years INTEGER DEFAULT 0,
  service_city TEXT,
  service_area TEXT,
  
  -- Document Verification
  government_id_type TEXT, -- aadhaar, pan, driving_license
  government_id_url TEXT,
  address_proof_url TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_account_holder TEXT,
  portfolio_urls TEXT[] DEFAULT '{}',
  
  -- Verification Status
  verification_status verification_status DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create OTP table for phone verification
CREATE TABLE public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL, -- 'login', 'worker_join'
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Rate limiting table for OTP
CREATE TABLE public.otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  ip_address TEXT,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX idx_otp_phone_expires ON public.otp_verifications(phone, expires_at);
CREATE INDEX idx_rate_limit_phone ON public.otp_rate_limits(phone, window_start);
CREATE INDEX idx_worker_status ON public.worker_profiles(verification_status);
CREATE INDEX idx_worker_user ON public.worker_profiles(user_id);

-- Enable RLS
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Worker profiles policies
CREATE POLICY "Workers can view own profile"
ON public.worker_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Workers can update own profile"
ON public.worker_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert worker profile"
ON public.worker_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admin can view all workers
CREATE POLICY "Admins can view all workers"
ON public.worker_profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all workers"
ON public.worker_profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- OTP tables - service role only (edge functions)
CREATE POLICY "Service role can manage OTP"
ON public.otp_verifications FOR ALL
USING (true);

CREATE POLICY "Service role can manage rate limits"
ON public.otp_rate_limits FOR ALL
USING (true);

-- Create storage bucket for worker documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('worker-documents', 'worker-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for worker documents
CREATE POLICY "Workers can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Workers can view own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all worker documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-documents' AND public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_worker_profiles_updated_at
BEFORE UPDATE ON public.worker_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();