-- ============================================
-- EVENT MARKETPLACE MIGRATION
-- Multi-artist booking, event planning, team builder
-- ============================================

-- ============================================
-- PART 1: EVENT BOOKINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.event_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT NOT NULL,
  guest_count INTEGER NOT NULL,
  total_budget INTEGER NOT NULL,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for customer's events
CREATE INDEX IF NOT EXISTS idx_event_bookings_customer 
ON public.event_bookings (customer_id, created_at DESC);

-- Index for event date
CREATE INDEX IF NOT EXISTS idx_event_bookings_date 
ON public.event_bookings (event_date);

-- ============================================
-- PART 2: ARTIST BOOKINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.artist_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event_bookings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'negotiating', 'cancelled')),
  negotiation_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, provider_id)
);

-- Index for event's artist bookings
CREATE INDEX IF NOT EXISTS idx_artist_bookings_event 
ON public.artist_bookings (event_id, status);

-- Index for provider's bookings
CREATE INDEX IF NOT EXISTS idx_artist_bookings_provider 
ON public.artist_bookings (provider_id, status);

-- ============================================
-- PART 3: BUDGET ALLOCATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.budget_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event_bookings(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('essential', 'recommended', 'optional')),
  budget_percentage INTEGER NOT NULL,
  allocated_budget INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, category)
);

-- Index for event's budget allocations
CREATE INDEX IF NOT EXISTS idx_budget_allocations_event 
ON public.budget_allocations (event_id);

-- ============================================
-- PART 4: TRIGGER FOR UPDATED_AT
-- ============================================

DROP TRIGGER IF EXISTS update_event_bookings_updated_at ON public.event_bookings;
CREATE TRIGGER update_event_bookings_updated_at 
BEFORE UPDATE ON public.event_bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_artist_bookings_updated_at ON public.artist_bookings;
CREATE TRIGGER update_artist_bookings_updated_at 
BEFORE UPDATE ON public.artist_bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_budget_allocations_updated_at ON public.budget_allocations;
CREATE TRIGGER update_budget_allocations_updated_at 
BEFORE UPDATE ON public.budget_allocations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PART 5: RLS POLICIES
-- ============================================

-- Event bookings policies
ALTER TABLE public.event_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own events" ON public.event_bookings;
CREATE POLICY "Customers can view own events" ON public.event_bookings
FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can insert own events" ON public.event_bookings;
CREATE POLICY "Customers can insert own events" ON public.event_bookings
FOR INSERT WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can update own events" ON public.event_bookings;
CREATE POLICY "Customers can update own events" ON public.event_bookings
FOR UPDATE USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can delete own events" ON public.event_bookings;
CREATE POLICY "Customers can delete own events" ON public.event_bookings
FOR DELETE USING (auth.uid() = customer_id);

-- Artist bookings policies
ALTER TABLE public.artist_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view artist bookings for own events" ON public.artist_bookings;
CREATE POLICY "Customers can view artist bookings for own events" ON public.artist_bookings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.event_bookings 
    WHERE id = event_id AND customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers can insert artist bookings for own events" ON public.artist_bookings;
CREATE POLICY "Customers can insert artist bookings for own events" ON public.artist_bookings
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.event_bookings 
    WHERE id = event_id AND customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Providers can view own bookings" ON public.artist_bookings;
CREATE POLICY "Providers can view own bookings" ON public.artist_bookings
FOR SELECT USING (provider_id IN (
  SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS "Providers can update own bookings" ON public.artist_bookings;
CREATE POLICY "Providers can update own bookings" ON public.artist_bookings
FOR UPDATE USING (provider_id IN (
  SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()
));

-- Budget allocations policies
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view budget for own events" ON public.budget_allocations;
CREATE POLICY "Customers can view budget for own events" ON public.budget_allocations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.event_bookings 
    WHERE id = event_id AND customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers can insert budget for own events" ON public.budget_allocations;
CREATE POLICY "Customers can insert budget for own events" ON public.budget_allocations
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.event_bookings 
    WHERE id = event_id AND customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers can update budget for own events" ON public.budget_allocations;
CREATE POLICY "Customers can update budget for own events" ON public.budget_allocations
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.event_bookings 
    WHERE id = event_id AND customer_id = auth.uid()
  )
);

-- ============================================
-- PART 6: FUNCTION TO CREATE EVENT WITH BOOKINGS
-- ============================================

CREATE OR REPLACE FUNCTION public.create_event_booking(
  p_customer_id UUID,
  p_event_name TEXT,
  p_event_type TEXT,
  p_event_date DATE,
  p_location TEXT,
  p_guest_count INTEGER,
  p_total_budget INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.event_bookings (
    customer_id,
    event_name,
    event_type,
    event_date,
    location,
    guest_count,
    total_budget,
    notes
  ) VALUES (
    p_customer_id,
    p_event_name,
    p_event_type,
    p_event_date,
    p_location,
    p_guest_count,
    p_total_budget,
    p_notes
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 7: FUNCTION TO ADD ARTIST TO EVENT
-- ============================================

CREATE OR REPLACE FUNCTION public.add_artist_to_event(
  p_event_id UUID,
  p_provider_id UUID,
  p_provider_name TEXT,
  p_category TEXT,
  p_price INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  INSERT INTO public.artist_bookings (
    event_id,
    provider_id,
    provider_name,
    category,
    price
  ) VALUES (
    p_event_id,
    p_provider_id,
    p_provider_name,
    p_category,
    p_price
  ) RETURNING id INTO v_booking_id;
  
  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 8: FUNCTION TO UPDATE ARTIST BOOKING STATUS
-- ============================================

CREATE OR REPLACE FUNCTION public.update_artist_booking_status(
  p_booking_id UUID,
  p_status TEXT,
  p_negotiation_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.artist_bookings
  SET status = p_status,
      negotiation_message = p_negotiation_message,
      updated_at = now()
  WHERE id = p_booking_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify tables were created
SELECT 'event_bookings' as table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'event_bookings'
UNION ALL
SELECT 'artist_bookings' FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'artist_bookings'
UNION ALL
SELECT 'budget_allocations' FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'budget_allocations';

-- Verify indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
AND tablename IN ('event_bookings', 'artist_bookings', 'budget_allocations')
ORDER BY tablename, indexname;
