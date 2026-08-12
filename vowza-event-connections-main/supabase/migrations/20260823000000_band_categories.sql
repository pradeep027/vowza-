-- Band Categories system. Idempotent.

-- Band categories lookup table
CREATE TABLE IF NOT EXISTS public.band_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS band_categories_active_idx ON public.band_categories(is_active, sort_order);

-- Seed the 14 band categories
INSERT INTO public.band_categories (name, slug, description, sort_order) VALUES
  ('Wedding Band', 'wedding_band', 'General band baja for wedding processions', 1),
  ('Brass Band', 'brass_band', 'Brass instrument ensemble for celebrations', 2),
  ('Pad Band', 'pad_band', 'Electronic pad-based band performance', 3),
  ('Baraat Band', 'baraat_band', 'Specialized baraat procession band', 4),
  ('Punjabi Dhol Band', 'punjabi_dhol', 'Energetic Punjabi dhol performers', 5),
  ('Nashik Dhol Band', 'nashik_dhol', 'Famous Nashik-style dhol tasha band', 6),
  ('Tamil Melam', 'tamil_melam', 'Traditional Tamil percussion ensemble', 7),
  ('Chenda Melam', 'chenda_melam', 'Kerala chenda percussion band', 8),
  ('Marfa Band', 'marfa_band', 'Hyderabadi marfa drum band', 9),
  ('Shivaji Maharashtrian Band', 'shivaji_band', 'Maharashtrian traditional Shivaji band', 10),
  ('Traditional Folk Band', 'folk_band', 'Regional folk music ensemble', 11),
  ('Devotional Band', 'devotional_band', 'Bhajan and devotional music band', 12),
  ('Shehnai & Nadaswaram Band', 'shehnai_nadaswaram', 'Classical shehnai and nadaswaram players', 13),
  ('Live Music Band', 'live_music_band', 'Live performance band with vocals and instruments', 14)
ON CONFLICT (slug) DO NOTHING;

-- Add band_category column to provider_profiles if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='provider_profiles' AND column_name='band_category') THEN
    ALTER TABLE public.provider_profiles ADD COLUMN band_category text;
  END IF;
END $$;

-- Index for filtering bands by category
CREATE INDEX IF NOT EXISTS provider_profiles_band_category_idx ON public.provider_profiles(band_category) WHERE band_category IS NOT NULL;

-- RLS for band_categories (public read, admin write)
DO $$ BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.band_categories'::regclass) THEN
    ALTER TABLE public.band_categories ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS band_categories_read ON public.band_categories;
CREATE POLICY band_categories_read ON public.band_categories FOR SELECT USING (true);

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='band_categories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.band_categories;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
