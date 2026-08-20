-- Add media_type to hall_gallery if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hall_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.hall_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
