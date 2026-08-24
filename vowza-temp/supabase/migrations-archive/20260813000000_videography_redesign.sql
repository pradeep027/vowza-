-- Videography package redesign: event-based packages with simplified pricing.
-- Adds missing columns, keeps existing data intact.

-- Add new columns for event-based model
ALTER TABLE public.videography_packages
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS package_price numeric(12,2) CHECK (package_price >= 0),
  ADD COLUMN IF NOT EXISTS travel_charges numeric(12,2) DEFAULT 0 CHECK (travel_charges >= 0),
  ADD COLUMN IF NOT EXISTS extra_coverage_cost numeric(12,2) DEFAULT 0 CHECK (extra_coverage_cost >= 0),
  ADD COLUMN IF NOT EXISTS num_cameras integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS coverage_includes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS live_streaming boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_4k boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS multi_camera boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cinematic_coverage boolean DEFAULT true;

-- Update advance_percentage default to 20
ALTER TABLE public.videography_packages ALTER COLUMN advance_percentage SET DEFAULT 20;

-- Add 'accepted' and 'in_progress' to videography_bookings status
ALTER TABLE public.videography_bookings DROP CONSTRAINT IF EXISTS videography_bookings_status_check;
ALTER TABLE public.videography_bookings ADD CONSTRAINT videography_bookings_status_check
  CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled'));

-- Add advance payment columns to videography_bookings
ALTER TABLE public.videography_bookings
  ADD COLUMN IF NOT EXISTS advance_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS advance_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_locked boolean NOT NULL DEFAULT false;

-- Add UPDATE policies for videography_bookings (was missing like catering/photography)
DROP POLICY IF EXISTS videography_bookings_customer_insert ON public.videography_bookings;
CREATE POLICY videography_bookings_customer_insert ON public.videography_bookings
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS videography_bookings_customer_update ON public.videography_bookings;
CREATE POLICY videography_bookings_customer_update ON public.videography_bookings
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS videography_bookings_provider_update ON public.videography_bookings;
CREATE POLICY videography_bookings_provider_update ON public.videography_bookings
  FOR UPDATE TO authenticated
  USING (public.owns_videographer(provider_id))
  WITH CHECK (public.owns_videographer(provider_id));
