-- Add payment lifecycle columns to ALL category booking tables
-- These columns were originally only on bookings, catering_bookings, photography_package_bookings
-- Now adding to all remaining category tables for consistent lifecycle

DO $$ 
DECLARE 
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'videography_bookings', 'drone_bookings', 'dj_bookings',
    'decorator_bookings', 'makeup_bookings', 'mehendi_bookings',
    'anchor_bookings', 'banquet_bookings', 'rental_bookings',
    'priest_bookings', 'water_bookings', 'band_bookings',
    'singer_bookings', 'dancer_bookings'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS payment_deadline timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS accepted_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS advance_paid_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS confirmed_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS expired_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS calendar_locked boolean NOT NULL DEFAULT false', tbl);
  END LOOP;
END $$;

-- Create booking_events table for activity timeline/history
CREATE TABLE IF NOT EXISTS public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_table text NOT NULL,
  booking_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_id uuid,
  actor_role text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_events_booking_idx ON public.booking_events(booking_table, booking_id, created_at DESC);

-- RLS for booking_events
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_events_read ON public.booking_events;
CREATE POLICY booking_events_read ON public.booking_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS booking_events_insert ON public.booking_events;
CREATE POLICY booking_events_insert ON public.booking_events FOR INSERT TO authenticated WITH CHECK (true);
