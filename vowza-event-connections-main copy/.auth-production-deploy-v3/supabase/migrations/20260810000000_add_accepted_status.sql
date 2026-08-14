-- Add 'accepted' and 'in_progress' to catering_bookings status CHECK constraint
-- and 'accepted'/'in_progress' to photography_package_bookings if needed.
-- This allows the unified booking lifecycle to use 'accepted' across all tables.

-- Drop and recreate the catering_bookings status constraint
ALTER TABLE public.catering_bookings DROP CONSTRAINT IF EXISTS catering_bookings_status_check;
ALTER TABLE public.catering_bookings ADD CONSTRAINT catering_bookings_status_check
  CHECK (status IN ('pending','accepted','confirmed','in_progress','preparing','completed','cancelled'));

-- Drop and recreate the photography_package_bookings status constraint (if exists)
DO $$ BEGIN
  ALTER TABLE public.photography_package_bookings DROP CONSTRAINT IF EXISTS photography_package_bookings_status_check;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.photography_package_bookings ADD CONSTRAINT photography_package_bookings_status_check
    CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled'));
EXCEPTION WHEN undefined_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
