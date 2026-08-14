-- Add district column to profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='district') THEN
    ALTER TABLE public.profiles ADD COLUMN district text;
  END IF;
END $$;
