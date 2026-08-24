-- Add state and organization_name columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS organization_name TEXT;

-- Add phone_verified column for OTP verification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add index for phone_verified queries
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON public.profiles(phone_verified);
