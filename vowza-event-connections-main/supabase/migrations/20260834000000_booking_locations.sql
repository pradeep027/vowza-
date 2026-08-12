-- Universal booking locations table
CREATE TABLE IF NOT EXISTS public.booking_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Polymorphic reference: booking_table + booking_id
  booking_table text NOT NULL,
  booking_id uuid NOT NULL,
  -- Location fields
  state text,
  district text,
  town_city text,
  exact_address text,
  pincode text,
  landmark text,
  latitude double precision,
  longitude double precision,
  formatted_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_locations_booking_idx ON public.booking_locations(booking_table, booking_id);

-- RLS
ALTER TABLE public.booking_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_locations_insert ON public.booking_locations;
DROP POLICY IF EXISTS booking_locations_read ON public.booking_locations;

CREATE POLICY booking_locations_insert ON public.booking_locations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY booking_locations_read ON public.booking_locations FOR SELECT TO authenticated USING (true);

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='booking_locations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_locations;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
