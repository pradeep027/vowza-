-- Add teardown_time to decorator_packages and media_type to decorator_gallery
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='decorator_packages' AND column_name='teardown_time') THEN
    ALTER TABLE public.decorator_packages ADD COLUMN teardown_time text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='decorator_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.decorator_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
