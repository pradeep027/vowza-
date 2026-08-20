-- Add media_type to water_gallery if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='water_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.water_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
