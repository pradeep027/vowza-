-- ============================================================
-- Dynamic Marketplace V2 — Vowza
-- Fully idempotent. 100% compatible with Supabase PostgreSQL.
--
-- FIXES:
--   • Removed public.has_role() — function does not exist in
--     this project's schema.
--   • Admin write policies use a subquery on public.user_roles
--     (role = 'admin') which IS present in this project.
--   • CREATE POLICY IF NOT EXISTS replaced with
--     DROP POLICY IF EXISTS → CREATE POLICY everywhere.
--   • ON CONFLICT target made explicit via UNIQUE constraint.
--   • Enum ADD VALUE wrapped in individual DO blocks.
-- ============================================================

-- ── 1. Extend profession_type enum ────────────────────────────────────────
DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'banquet_hall';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'pandit';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'water_supplier';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'rentals';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'wedding_band';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'dhol_band';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'brass_band';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. subcategories ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subcategories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  sort_order    INTEGER     DEFAULT 0,
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subcategories_slug
  ON public.subcategories (category_slug);

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Anyone can read subcategories
DROP POLICY IF EXISTS "subcategories_public_read" ON public.subcategories;
CREATE POLICY "subcategories_public_read"
  ON public.subcategories
  FOR SELECT
  USING (true);

-- Only admins (row in user_roles with role = 'admin') can write
-- TODO: replace with a proper admin check if your role system changes
DROP POLICY IF EXISTS "subcategories_admin_write" ON public.subcategories;
CREATE POLICY "subcategories_admin_write"
  ON public.subcategories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- ── 3. Extend provider_profiles ───────────────────────────────────────────
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS subcategory         TEXT,
  ADD COLUMN IF NOT EXISTS vendor_details      JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS faqs                JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS social_links        JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS business_hours      JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_areas       TEXT[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS verification_status TEXT         DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_featured         BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_until      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS instant_booking     BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp            TEXT,
  ADD COLUMN IF NOT EXISTS gallery_urls        TEXT[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_urls          TEXT[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_radius      INTEGER      DEFAULT 50,
  ADD COLUMN IF NOT EXISTS total_bookings      INTEGER      DEFAULT 0;

-- ── 4. pricing_packages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID        NOT NULL
                REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  price       NUMERIC     NOT NULL DEFAULT 0,
  duration    TEXT,
  features    TEXT[]      DEFAULT '{}',
  sort_order  INTEGER     DEFAULT 0,
  is_active   BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_packages_provider
  ON public.pricing_packages (provider_id);

ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packages_public_read" ON public.pricing_packages;
CREATE POLICY "packages_public_read"
  ON public.pricing_packages
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "packages_owner_write" ON public.pricing_packages;
CREATE POLICY "packages_owner_write"
  ON public.pricing_packages
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── 5. menu_items (caterers) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID        NOT NULL
                    REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  dish_name       TEXT        NOT NULL,
  category        TEXT,
  description     TEXT,
  image_url       TEXT,
  price_per_plate NUMERIC     DEFAULT 0,
  min_order       INTEGER     DEFAULT 1,
  max_capacity    INTEGER,
  is_available    BOOLEAN     DEFAULT TRUE,
  sort_order      INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_provider
  ON public.menu_items (provider_id);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_public_read" ON public.menu_items;
CREATE POLICY "menu_public_read"
  ON public.menu_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "menu_owner_write" ON public.menu_items;
CREATE POLICY "menu_owner_write"
  ON public.menu_items
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── 6. rental_items ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         UUID        NOT NULL
                        REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  item_name           TEXT        NOT NULL,
  category            TEXT,
  image_url           TEXT,
  description         TEXT,
  quantity_available  INTEGER     DEFAULT 1,
  price_per_day       NUMERIC     DEFAULT 0,
  price_per_event     NUMERIC     DEFAULT 0,
  security_deposit    NUMERIC     DEFAULT 0,
  delivery_charges    NUMERIC     DEFAULT 0,
  available_locations TEXT[]      DEFAULT '{}',
  is_available        BOOLEAN     DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_items_provider
  ON public.rental_items (provider_id);

ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rentals_public_read" ON public.rental_items;
CREATE POLICY "rentals_public_read"
  ON public.rental_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "rentals_owner_write" ON public.rental_items;
CREATE POLICY "rentals_owner_write"
  ON public.rental_items
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── 7. pooja_services (pandits) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pooja_services (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id        UUID        NOT NULL
                       REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  pooja_name         TEXT        NOT NULL,
  religion           TEXT        DEFAULT 'Hindu',
  description        TEXT,
  price              NUMERIC     DEFAULT 0,
  duration_minutes   INTEGER,
  materials_included BOOLEAN     DEFAULT FALSE,
  materials_note     TEXT,
  image_url          TEXT,
  is_available       BOOLEAN     DEFAULT TRUE,
  sort_order         INTEGER     DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pooja_services_provider
  ON public.pooja_services (provider_id);

ALTER TABLE public.pooja_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pooja_public_read" ON public.pooja_services;
CREATE POLICY "pooja_public_read"
  ON public.pooja_services
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pooja_owner_write" ON public.pooja_services;
CREATE POLICY "pooja_owner_write"
  ON public.pooja_services
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── 8. provider_faqs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provider_faqs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID        NOT NULL
                REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  sort_order  INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_faqs_provider
  ON public.provider_faqs (provider_id);

ALTER TABLE public.provider_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faqs_public_read" ON public.provider_faqs;
CREATE POLICY "faqs_public_read"
  ON public.provider_faqs
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "faqs_owner_write" ON public.provider_faqs;
CREATE POLICY "faqs_owner_write"
  ON public.provider_faqs
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── 9. Indexes on provider_profiles ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_provider_profession_status
  ON public.provider_profiles (profession, verification_status);

CREATE INDEX IF NOT EXISTS idx_provider_subcategory
  ON public.provider_profiles (subcategory);

CREATE INDEX IF NOT EXISTS idx_provider_city_status
  ON public.provider_profiles (verification_status);

-- ── 10. Seed subcategories ────────────────────────────────────────────────
-- Unique constraint required for ON CONFLICT (category_slug, name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.subcategories'::regclass
      AND conname  = 'subcategories_slug_name_key'
  ) THEN
    ALTER TABLE public.subcategories
      ADD CONSTRAINT subcategories_slug_name_key
      UNIQUE (category_slug, name);
  END IF;
END $$;

INSERT INTO public.subcategories (category_slug, name, sort_order) VALUES
  ('music_band',         'Wedding Band',            1),
  ('music_band',         'Dhol Band',               2),
  ('music_band',         'Brass Band',              3),
  ('music_band',         'Chenda Melam',            4),
  ('music_band',         'Traditional Band',        5),
  ('music_band',         'DJ Band',                 6),
  ('dj',                 'Wedding DJ',              1),
  ('dj',                 'Club DJ',                 2),
  ('dj',                 'Birthday DJ',             3),
  ('dj',                 'Corporate DJ',            4),
  ('dj',                 'Sangeet DJ',              5),
  ('singer',             'Classical',               1),
  ('singer',             'Carnatic',                2),
  ('singer',             'Hindustani',              3),
  ('singer',             'Folk',                    4),
  ('singer',             'Devotional',              5),
  ('singer',             'Melody',                  6),
  ('singer',             'Cine Songs',              7),
  ('singer',             'Ghazal',                  8),
  ('singer',             'Sufi',                    9),
  ('dancer',             'Bharatanatyam',           1),
  ('dancer',             'Kuchipudi',               2),
  ('dancer',             'Kathak',                  3),
  ('dancer',             'Western',                 4),
  ('dancer',             'Hip Hop',                 5),
  ('dancer',             'Contemporary',            6),
  ('dancer',             'Bhangra',                 7),
  ('dancer',             'Garba',                   8),
  ('dancer',             'Sangeet Dance',           9),
  ('choreographer',      'Wedding',                 1),
  ('choreographer',      'Sangeet',                 2),
  ('choreographer',      'Classical',               3),
  ('choreographer',      'Western',                 4),
  ('wedding_decorator',  'Wedding Decoration',      1),
  ('wedding_decorator',  'Birthday Decoration',     2),
  ('wedding_decorator',  'Stage Decoration',        3),
  ('wedding_decorator',  'Floral Decoration',       4),
  ('wedding_decorator',  'Balloon Decoration',      5),
  ('wedding_decorator',  'Mandap Decoration',       6),
  ('makeup_artist',      'Bridal',                  1),
  ('makeup_artist',      'Groom',                   2),
  ('makeup_artist',      'Party',                   3),
  ('makeup_artist',      'HD Makeup',               4),
  ('makeup_artist',      'Airbrush',                5),
  ('mehendi_artist',     'Bridal Mehendi',          1),
  ('mehendi_artist',     'Arabic',                  2),
  ('mehendi_artist',     'Rajasthani',              3),
  ('mehendi_artist',     'Indo Arabic',             4),
  ('magician',           'Stage Magic',             1),
  ('magician',           'Kids Magic',              2),
  ('magician',           'Illusion',                3),
  ('magician',           'Close Up Magic',          4),
  ('anchor',             'Wedding',                 1),
  ('anchor',             'Corporate',               2),
  ('anchor',             'Birthday',                3),
  ('anchor',             'Stage Shows',             4),
  ('catering_services',  'Veg Meals',               1),
  ('catering_services',  'Non Veg Meals',           2),
  ('catering_services',  'Biryani',                 3),
  ('catering_services',  'Buffet',                  4),
  ('catering_services',  'Live Counters',           5),
  ('catering_services',  'Snacks',                  6),
  ('lighting_services',  'Stage Lighting',          1),
  ('lighting_services',  'Wedding Lighting',        2),
  ('lighting_services',  'LED Lighting',            3),
  ('lighting_services',  'Laser Lights',            4),
  ('sound_services',     'Wedding Sound',           1),
  ('sound_services',     'Concert Sound',           2),
  ('sound_services',     'Corporate Audio',         3),
  ('pandit',             'Marriage',                1),
  ('pandit',             'Gruhapravesam',           2),
  ('pandit',             'Satyanaryana Vratham',    3),
  ('pandit',             'Ganapathi Homam',         4),
  ('pandit',             'Rudrabhishekam',          5),
  ('pandit',             'Upanayanam',              6),
  ('pandit',             'Navagraha Pooja',         7),
  ('pandit',             'Ayush Homam',             8),
  ('pandit',             'Nikah',                   9),
  ('pandit',             'Christian Wedding',      10),
  ('rentals',            'Tent & Shamiana',         1),
  ('rentals',            'Stage',                   2),
  ('rentals',            'Chairs & Tables',         3),
  ('rentals',            'Furniture',               4),
  ('rentals',            'Generator',               5),
  ('rentals',            'AC Cooler',               6),
  ('rentals',            'LED Wall',                7),
  ('water_supplier',     'Cool Water',              1),
  ('water_supplier',     'RO Water',                2),
  ('water_supplier',     'Mineral Water',           3),
  ('water_supplier',     'Water Tankers',           4),
  ('banquet_hall',       'AC Hall',                 1),
  ('banquet_hall',       'Non AC Hall',             2),
  ('banquet_hall',       'Outdoor Venue',           3),
  ('banquet_hall',       'Terrace',                 4),
  ('photographer',       'Wedding Photography',     1),
  ('photographer',       'Pre-Wedding',             2),
  ('photographer',       'Candid',                  3),
  ('photographer',       'Traditional',             4),
  ('photographer',       'Baby Shoot',              5),
  ('photographer',       'Corporate',               6),
  ('videographer',       'Traditional Video',       1),
  ('videographer',       'Cinematic Film',          2),
  ('videographer',       'Wedding Film',            3),
  ('videographer',       'Reel Package',            4),
  ('videographer',       'Live Streaming',          5),
  ('drone_operator',     'Wedding Drone',           1),
  ('drone_operator',     'Real Estate',             2),
  ('drone_operator',     'Event Aerial',            3),
  ('mehendi_artist',     'Portrait Mehendi',        5)
ON CONFLICT (category_slug, name) DO NOTHING;
