-- Add media_type to rental_gallery if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rental_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.rental_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
