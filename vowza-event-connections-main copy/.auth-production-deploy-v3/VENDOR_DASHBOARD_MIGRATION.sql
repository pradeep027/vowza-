-- ============================================================================
-- VENDOR_DASHBOARD_MIGRATION.sql
-- Run ONCE in Supabase SQL Editor.
-- Creates missing tables/columns and enables realtime so the Vendor Dashboard
-- can be fully data-driven with zero hardcoded values.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profile_views — tracks every time a customer opens a vendor profile
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID        NOT NULL,          -- references provider_profiles.id
  viewer_id   UUID,                          -- nullable: anonymous views allowed
  source      TEXT        DEFAULT 'direct',  -- direct | search | category | share
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_provider      ON public.profile_views(provider_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_provider_time ON public.profile_views(provider_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. inquiries — customer enquiries that have not yet become bookings
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inquiries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID        NOT NULL,         -- references provider_profiles.id
  customer_id  UUID,                         -- references profiles.id
  event_type   TEXT,
  event_date   DATE,
  guest_count  INTEGER,
  budget_min   NUMERIC(12,2),
  budget_max   NUMERIC(12,2),
  message      TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending',  -- pending | read | replied | closed
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  replied_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_provider        ON public.inquiries(provider_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_provider_status ON public.inquiries(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_inquiries_provider_read   ON public.inquiries(provider_id, is_read);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add missing columns to existing tables
-- ─────────────────────────────────────────────────────────────────────────────

-- reviews: comment text + vendor reply
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS comment    TEXT,
  ADD COLUMN IF NOT EXISTS reply      TEXT,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_hidden  BOOLEAN DEFAULT FALSE;

-- portfolio_items: cover flag + view counter + category
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS is_cover   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category   TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- payments: provider_id denormalised for fast vendor queries + payment type
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_id  UUID,
  ADD COLUMN IF NOT EXISTS customer_id  UUID,
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'advance',  -- advance | balance | full | refund
  ADD COLUMN IF NOT EXISTS method       TEXT,
  ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending'; -- pending | available | withdrawn

CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments(provider_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking  ON public.payments(booking_id);

-- Backfill payments.provider_id / customer_id from bookings
UPDATE public.payments p
SET provider_id = b.provider_id,
    customer_id = b.customer_id
FROM public.bookings b
WHERE p.booking_id = b.id
  AND p.provider_id IS NULL;

-- pricing_packages: booking counter for popularity/conversion metrics
ALTER TABLE public.pricing_packages
  ADD COLUMN IF NOT EXISTS booking_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier          TEXT,
  ADD COLUMN IF NOT EXISTS deliverables  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_popular    BOOLEAN DEFAULT FALSE;

-- bookings: package reference + advance tracking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS package_id    UUID,
  ADD COLUMN IF NOT EXISTS advance_paid  NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guest_count   INTEGER,
  ADD COLUMN IF NOT EXISTS responded_at  TIMESTAMPTZ;

-- provider_availability: explicit status for calendar colours
ALTER TABLE public.provider_availability
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'blocked';  -- available | tentative | blocked

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS — vendors read/write only their own rows
-- ─────────────────────────────────────────────────────────────────────────────

-- profile_views: anyone may INSERT a view; only the owning vendor may SELECT
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pv_insert_any   ON public.profile_views;
DROP POLICY IF EXISTS pv_select_owner ON public.profile_views;

CREATE POLICY pv_insert_any ON public.profile_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY pv_select_owner ON public.profile_views
  FOR SELECT USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

-- inquiries: customer may insert; vendor may read/update their own
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inq_insert_auth  ON public.inquiries;
DROP POLICY IF EXISTS inq_select_owner ON public.inquiries;
DROP POLICY IF EXISTS inq_update_owner ON public.inquiries;

CREATE POLICY inq_insert_auth ON public.inquiries
  FOR INSERT WITH CHECK (true);

CREATE POLICY inq_select_owner ON public.inquiries
  FOR SELECT USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR customer_id = auth.uid()
  );

CREATE POLICY inq_update_owner ON public.inquiries
  FOR UPDATE USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

-- Keep these open so the dashboard can read them (app-level filtering by provider_id)
ALTER TABLE public.bookings              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_packages      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_availability DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. GRANTS
-- ─────────────────────────────────────────────────────────────────────────────
GRANT ALL ON TABLE public.profile_views         TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.inquiries             TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.bookings              TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.payments              TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.reviews               TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.messages              TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.portfolio_items       TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.pricing_packages      TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.provider_availability TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. REALTIME — add every dashboard table to the realtime publication
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bookings','payments','reviews','messages','portfolio_items',
    'provider_availability','notifications','profile_views',
    'inquiries','pricing_packages','provider_profiles'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;   -- already in publication
      WHEN undefined_object THEN NULL;   -- publication missing
      WHEN undefined_table  THEN NULL;   -- table missing
    END;
  END LOOP;
END $$;

-- Full row data on UPDATE/DELETE events (needed for realtime payloads)
ALTER TABLE public.bookings              REPLICA IDENTITY FULL;
ALTER TABLE public.payments              REPLICA IDENTITY FULL;
ALTER TABLE public.reviews               REPLICA IDENTITY FULL;
ALTER TABLE public.messages              REPLICA IDENTITY FULL;
ALTER TABLE public.portfolio_items       REPLICA IDENTITY FULL;
ALTER TABLE public.provider_availability REPLICA IDENTITY FULL;
ALTER TABLE public.profile_views         REPLICA IDENTITY FULL;
ALTER TABLE public.inquiries             REPLICA IDENTITY FULL;
ALTER TABLE public.pricing_packages      REPLICA IDENTITY FULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Auto-increment pricing_packages.booking_count when a booking is confirmed
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bump_package_booking_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.package_id IS NOT NULL
     AND NEW.status IN ('confirmed','completed')
     AND (OLD.status IS NULL OR OLD.status <> NEW.status) THEN
    UPDATE public.pricing_packages
    SET booking_count = COALESCE(booking_count, 0) + 1
    WHERE id = NEW.package_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_package_count ON public.bookings;
CREATE TRIGGER trg_bump_package_count
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bump_package_booking_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. VERIFY
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'profile_views' AS tbl, COUNT(*) AS rows FROM public.profile_views
UNION ALL SELECT 'inquiries',        COUNT(*) FROM public.inquiries
UNION ALL SELECT 'bookings',         COUNT(*) FROM public.bookings
UNION ALL SELECT 'payments',         COUNT(*) FROM public.payments
UNION ALL SELECT 'reviews',          COUNT(*) FROM public.reviews
UNION ALL SELECT 'portfolio_items',  COUNT(*) FROM public.portfolio_items
UNION ALL SELECT 'pricing_packages', COUNT(*) FROM public.pricing_packages;

SELECT 'VENDOR_DASHBOARD_MIGRATION.sql completed successfully ✓' AS status;
