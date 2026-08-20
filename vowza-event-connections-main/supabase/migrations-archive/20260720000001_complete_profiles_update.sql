-- ============================================
-- COMPLETE PROFILES TABLE UPDATE
-- Add all required columns for production
-- ============================================

-- Add state column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT;

-- Add organization_name column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization_name TEXT;

-- Add phone_verified column for OTP verification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add date_of_birth column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add alternate_phone column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS alternate_phone TEXT;

-- Add whatsapp_enabled column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT true;

-- Add notification preferences
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT TRUE;

-- Add profile completion status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0;

-- Add last_active timestamp
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- Add is_active column for account status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add account_verified_at timestamp
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_verified_at TIMESTAMPTZ;

-- Add preferences JSONB for flexible user preferences
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Add metadata JSONB for additional flexible data
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_state ON public.profiles(state);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_area ON public.profiles(area);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON public.profiles(phone_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to update last_active_at on profile update
DROP TRIGGER IF EXISTS update_profiles_last_active ON public.profiles;
CREATE TRIGGER update_profiles_last_active
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION (
  UPDATE public.profiles 
  SET last_active_at = now() 
  WHERE id = NEW.id
)();
