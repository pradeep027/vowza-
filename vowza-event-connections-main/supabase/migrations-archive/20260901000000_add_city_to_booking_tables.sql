-- Add missing 'city' column to booking tables that don't have it
-- Tables created later (decorator, makeup, mehendi, anchor, etc.) already have city.
-- This fixes: videography_bookings, photography_package_bookings, catering_bookings, drone_bookings

DO $$ BEGIN
  -- videography_bookings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videography_bookings' AND column_name='city') THEN
    ALTER TABLE public.videography_bookings ADD COLUMN city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videography_bookings' AND column_name='special_requirements') THEN
    ALTER TABLE public.videography_bookings ADD COLUMN special_requirements text;
  END IF;

  -- photography_package_bookings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='photography_package_bookings' AND column_name='city') THEN
    ALTER TABLE public.photography_package_bookings ADD COLUMN city text;
  END IF;

  -- catering_bookings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='catering_bookings' AND column_name='city') THEN
    ALTER TABLE public.catering_bookings ADD COLUMN city text;
  END IF;

  -- drone_bookings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='drone_bookings' AND column_name='city') THEN
    ALTER TABLE public.drone_bookings ADD COLUMN city text;
  END IF;
END $$;
