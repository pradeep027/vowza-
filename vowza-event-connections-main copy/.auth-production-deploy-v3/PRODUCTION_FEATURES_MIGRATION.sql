-- ============================================
-- PRODUCTION FEATURES MIGRATION
-- Enhanced marketplace, search, and availability features
-- ============================================

-- ============================================
-- PART 1: ENHANCED INDEXES FOR PERFORMANCE
-- ============================================

-- Composite indexes for common search/filter combinations
CREATE INDEX IF NOT EXISTS idx_provider_search 
ON public.provider_profiles (profession, is_verified, is_available, price_min, price_max);

-- Note: provider_profiles does NOT have service_city or service_area columns
-- Location data is stored in the profiles table (city, area, state)
-- This index uses profiles city joined via user_id
CREATE INDEX IF NOT EXISTS idx_provider_location 
ON public.provider_profiles (user_id, is_verified);

CREATE INDEX IF NOT EXISTS idx_provider_rating 
ON public.provider_profiles (average_rating DESC, total_reviews DESC);

CREATE INDEX IF NOT EXISTS idx_provider_featured 
ON public.provider_profiles (is_featured, featured_until) 
WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_provider_experience 
ON public.provider_profiles (experience_years DESC);

-- Index for availability calendar
CREATE INDEX IF NOT EXISTS idx_availability_provider_date 
ON public.provider_availability (provider_id, unavailable_date);

-- Index for bookings to check availability
CREATE INDEX IF NOT EXISTS idx_bookings_provider_date 
ON public.bookings (provider_id, event_date, status)
WHERE status NOT IN ('cancelled', 'rejected');

-- Index for artist categories
CREATE INDEX IF NOT EXISTS idx_categories_active 
ON public.artist_categories (is_active, sort_order)
WHERE is_active = true;

-- ============================================
-- PART 2: AVAILABILITY CALENDAR ENHANCEMENTS
-- ============================================

-- Add availability calendar table if not exists
CREATE TABLE IF NOT EXISTS public.provider_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, date)
);

-- Create index for calendar lookups
CREATE INDEX IF NOT EXISTS idx_calendar_provider_date 
ON public.provider_calendar (provider_id, date, is_available);

-- ============================================
-- PART 3: ENHANCED ARTIST CATEGORIES
-- ============================================

-- Update artist categories with additional metadata
ALTER TABLE public.artist_categories 
ADD COLUMN IF NOT EXISTS min_price INTEGER,
ADD COLUMN IF NOT EXISTS max_price INTEGER,
ADD COLUMN IF NOT EXISTS popular_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS icon_lucide TEXT;

-- ============================================
-- PART 4: SEARCH HISTORY (for personalized recommendations)
-- ============================================

CREATE TABLE IF NOT EXISTS public.search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user 
ON public.search_history (user_id, created_at DESC);

-- ============================================
-- PART 5: VIEWS FOR OPTIMIZED QUERIES
-- ============================================

-- View for approved artists with all necessary data
CREATE OR REPLACE VIEW public.approved_artists_view AS
SELECT 
  pp.id,
  pp.user_id,
  pp.profession,
  pp.experience_years,
  pp.price_min,
  pp.price_max,
  pp.bio,
  pp.is_verified,
  pp.is_available,
  pp.is_featured,
  pp.featured_until,
  pp.average_rating,
  pp.total_reviews,
  pp.total_bookings,
  pp.specialties,
  pp.languages,
  pp.cover_image_url,
  -- Use profiles table for location data (provider_profiles doesn't have service_city/service_area)
  p.city as service_city,
  p.area as service_area,
  p.state,
  p.full_name,
  p.avatar_url,
  ac.name as category_name,
  ac.icon as category_icon
FROM public.provider_profiles pp
LEFT JOIN public.profiles p ON pp.user_id = p.id
LEFT JOIN public.artist_categories ac ON pp.profession = ac.profession_type
WHERE pp.verification_status IN ('approved', 'verified')
  AND pp.is_available = true;

-- ============================================
-- PART 6: FUNCTIONS FOR AVAILABILITY CHECKS
-- ============================================

-- Function to check if provider is available on a specific date
CREATE OR REPLACE FUNCTION public.check_provider_availability(
  p_provider_id UUID,
  p_event_date DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_booked BOOLEAN;
  v_calendar_available BOOLEAN;
BEGIN
  -- Check if provider has a booking on that date
  SELECT EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE provider_id = p_provider_id 
      AND event_date = p_event_date 
      AND status NOT IN ('cancelled', 'rejected')
  ) INTO v_is_booked;
  
  IF v_is_booked THEN
    RETURN FALSE;
  END IF;
  
  -- Check calendar availability
  SELECT COALESCE(is_available, TRUE) INTO v_calendar_available
  FROM public.provider_calendar
  WHERE provider_id = p_provider_id AND date = p_event_date;
  
  -- If no calendar entry, assume available
  IF v_calendar_available IS NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN v_calendar_available;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 7: TRIGGER FOR UPDATED_AT
-- ============================================

DROP TRIGGER IF EXISTS update_provider_calendar_updated_at ON public.provider_calendar;
CREATE TRIGGER update_provider_calendar_updated_at 
BEFORE UPDATE ON public.provider_calendar
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PART 8: RLS POLICIES FOR NEW TABLES
-- ============================================

-- Provider calendar policies
DROP POLICY IF EXISTS "Providers can manage own calendar" ON public.provider_calendar;
CREATE POLICY "Providers can manage own calendar" ON public.provider_calendar
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.provider_profiles 
    WHERE id = provider_id AND user_id = auth.uid()
  )
);

-- Search history policies
DROP POLICY IF EXISTS "Users can view own search history" ON public.search_history;
CREATE POLICY "Users can view own search history" ON public.search_history
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own search history" ON public.search_history;
CREATE POLICY "Users can insert own search history" ON public.search_history
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PART 9: ENABLE RLS ON NEW TABLES
-- ============================================

ALTER TABLE public.provider_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify the view was created
SELECT 'View created successfully' as status FROM information_schema.views 
WHERE table_schema = 'public' AND table_name = 'approved_artists_view';

-- Verify indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
