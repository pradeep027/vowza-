-- Add missing profession_type enum values
-- This migration adds profession_type values that are referenced in mainCategoryMapping.ts
-- but were missing from the enum definition in VOWZA_COMPLETE_MIGRATION.sql

BEGIN;

-- Pandit/Priest category
DO $$ BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'pandit'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'priest'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'religious_services'; EXCEPTION WHEN others THEN NULL; END $$;

-- Bands category (additional variants)
DO $$ BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'wedding_band'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'dhol_band'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'brass_band'; EXCEPTION WHEN others THEN NULL; END $$;

-- Banquet/Venue category
DO $$ BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'wedding_venue'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'event_venue'; EXCEPTION WHEN others THEN NULL; END $$;

-- Water supplier category
DO $$ BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'water_supplier'; EXCEPTION WHEN others THEN NULL; END $$;

-- Photography/Videography (ensure unified type exists)
DO $$ BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'photography_videography'; EXCEPTION WHEN others THEN NULL; END $$;

COMMIT;
