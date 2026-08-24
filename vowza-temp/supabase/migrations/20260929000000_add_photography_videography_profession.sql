-- Add photography_videography profession type to the profession_type enum
-- This enables vendors to register as a unified Photography & Videography provider
-- Allows offering all three package types: photography_only, videography_only, photography_and_videography

BEGIN;

-- Safely add the new enum value if it doesn't already exist
DO $$ 
BEGIN 
  BEGIN 
    ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'photography_videography';
  EXCEPTION WHEN OTHERS THEN 
    NULL;
  END;
END $$;

COMMIT;
