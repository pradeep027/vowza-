-- ============================================================
-- Dynamic Marketplace Migration
-- Adds missing columns to support full marketplace features.
-- Idempotent — safe to run multiple times.
-- ============================================================

-- Add missing provider profile columns
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS stage_name           TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp             TEXT,
  ADD COLUMN IF NOT EXISTS service_radius       INTEGER DEFAULT 50,  -- km
  ADD COLUMN IF NOT EXISTS instant_booking      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gallery_urls         TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_urls           TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_featured          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_until       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_days       INTEGER[] DEFAULT '{}',  -- 0=Sun..6=Sat
  ADD COLUMN IF NOT EXISTS total_bookings       INTEGER DEFAULT 0;

-- Ensure artist_categories table exists and has real counts
-- The counts are computed live via a view for accuracy
CREATE OR REPLACE VIEW public.category_provider_counts AS
SELECT
  ac.id,
  ac.name,
  ac.profession_type,
  ac.description,
  ac.icon,
  ac.is_active,
  ac.sort_order,
  COUNT(pp.id) AS provider_count
FROM public.artist_categories ac
LEFT JOIN public.provider_profiles pp
  ON pp.profession::TEXT = ac.profession_type::TEXT
  AND pp.verification_status IN ('approved', 'verified')
GROUP BY ac.id, ac.name, ac.profession_type, ac.description, ac.icon, ac.is_active, ac.sort_order;

-- Grant access to the view
GRANT SELECT ON public.category_provider_counts TO authenticated, anon;

-- Index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_provider_profession_status
  ON public.provider_profiles(profession, verification_status);

CREATE INDEX IF NOT EXISTS idx_provider_featured
  ON public.provider_profiles(is_featured, verification_status);

CREATE INDEX IF NOT EXISTS idx_provider_city_status
  ON public.provider_profiles(verification_status);

-- RLS: view is readable by everyone
ALTER VIEW public.category_provider_counts OWNER TO postgres;
