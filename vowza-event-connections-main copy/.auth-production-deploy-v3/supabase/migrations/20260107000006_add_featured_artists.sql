-- Add featured artists functionality
ALTER TABLE public.provider_profiles 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

-- Create featured_artists table for managing featured status
CREATE TABLE IF NOT EXISTS public.featured_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  featured_by UUID REFERENCES auth.users(id),
  featured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on featured_artists
ALTER TABLE public.featured_artists ENABLE ROW LEVEL SECURITY;

-- RLS policies for featured_artists
CREATE POLICY "Everyone can view featured artists" ON public.featured_artists FOR SELECT USING (true);
CREATE POLICY "Admins can manage featured artists" ON public.featured_artists FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_featured_artists_provider_id ON public.featured_artists(provider_id);
CREATE INDEX IF NOT EXISTS idx_featured_artists_expires_at ON public.featured_artists(expires_at);

-- Function to automatically expire featured status
CREATE OR REPLACE FUNCTION expire_featured_artists()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at < NOW() THEN
    UPDATE public.provider_profiles SET is_featured = false WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check featured status
CREATE TRIGGER check_featured_expiry
  BEFORE INSERT OR UPDATE ON public.featured_artists
  FOR EACH ROW EXECUTE FUNCTION expire_featured_artists();
