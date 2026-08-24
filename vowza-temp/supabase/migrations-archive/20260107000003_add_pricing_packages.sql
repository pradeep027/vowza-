-- Add pricing packages table for artists
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  duration TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on pricing_packages
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

-- RLS policies for pricing_packages
CREATE POLICY "Everyone can view pricing packages" ON public.pricing_packages FOR SELECT USING (true);
CREATE POLICY "Providers can manage own pricing packages" ON public.pricing_packages FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Add additional charges fields to provider_profiles
ALTER TABLE public.provider_profiles 
ADD COLUMN IF NOT EXISTS travel_charges INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_charges INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cover_banner_url TEXT;

-- Add updated_at trigger for pricing_packages
CREATE TRIGGER update_pricing_packages_updated_at BEFORE UPDATE ON public.pricing_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
