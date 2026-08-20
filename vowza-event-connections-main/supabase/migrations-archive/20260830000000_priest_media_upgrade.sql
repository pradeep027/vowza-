-- Add media_type to priest_gallery if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='priest_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.priest_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
