-- Add missing columns to videography_bookings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videography_bookings' AND column_name='city') THEN
    ALTER TABLE public.videography_bookings ADD COLUMN city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videography_bookings' AND column_name='special_requirements') THEN
    ALTER TABLE public.videography_bookings ADD COLUMN special_requirements text;
  END IF;
END $$;
