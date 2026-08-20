-- ═══════════════════════════════════════════════════════════════════════════════
-- DANCER SYSTEM — Packages, Addons, Gallery, Bookings
-- Follows the same architecture as singer_system, band_packages_system, etc.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Dancer Packages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dancer_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  dance_type text,
  package_type text,
  performance_style text,
  team_size integer DEFAULT 1,
  duration text,
  services_included text[] NOT NULL DEFAULT '{}',
  deliverables text[] NOT NULL DEFAULT '{}',
  package_price numeric(12,2) NOT NULL CHECK (package_price >= 0),
  advance_percentage integer NOT NULL DEFAULT 20 CHECK (advance_percentage >= 0 AND advance_percentage <= 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dancer_packages_provider_idx ON public.dancer_packages(provider_id, created_at DESC);

-- ─── Dancer Addons ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dancer_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dancer_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS dancer_addons_package_idx ON public.dancer_addons(package_id);

-- ─── Dancer Gallery ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dancer_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dancer_packages(id) ON DELETE CASCADE,
  public_url text NOT NULL,
  is_cover boolean NOT NULL DEFAULT false,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  title text,
  dance_type text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dancer_gallery_package_idx ON public.dancer_gallery(package_id);

-- ─── Dancer Bookings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dancer_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dancer_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  dance_type text,
  number_of_dancers integer DEFAULT 1,
  performance_duration text,
  special_requirements text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dancer_bookings_provider_idx ON public.dancer_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dancer_bookings_customer_idx ON public.dancer_bookings(customer_id, created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['dancer_packages','dancer_addons','dancer_gallery','dancer_bookings'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    END IF;
  END LOOP;
END $$;

-- Packages: public read, owner write
DROP POLICY IF EXISTS dancer_packages_public_read ON public.dancer_packages;
CREATE POLICY dancer_packages_public_read ON public.dancer_packages FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS dancer_packages_owner ON public.dancer_packages;
CREATE POLICY dancer_packages_owner ON public.dancer_packages FOR ALL
  USING (provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()));

-- Addons: public read via package, owner write
DROP POLICY IF EXISTS dancer_addons_public_read ON public.dancer_addons;
CREATE POLICY dancer_addons_public_read ON public.dancer_addons FOR SELECT USING (true);

DROP POLICY IF EXISTS dancer_addons_owner ON public.dancer_addons;
CREATE POLICY dancer_addons_owner ON public.dancer_addons FOR ALL
  USING (EXISTS(SELECT 1 FROM public.dancer_packages p WHERE p.id = package_id AND p.provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())))
  WITH CHECK (EXISTS(SELECT 1 FROM public.dancer_packages p WHERE p.id = package_id AND p.provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())));

-- Gallery: public read, owner write
DROP POLICY IF EXISTS dancer_gallery_public_read ON public.dancer_gallery;
CREATE POLICY dancer_gallery_public_read ON public.dancer_gallery FOR SELECT USING (true);

DROP POLICY IF EXISTS dancer_gallery_owner ON public.dancer_gallery;
CREATE POLICY dancer_gallery_owner ON public.dancer_gallery FOR ALL
  USING (EXISTS(SELECT 1 FROM public.dancer_packages p WHERE p.id = package_id AND p.provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())))
  WITH CHECK (EXISTS(SELECT 1 FROM public.dancer_packages p WHERE p.id = package_id AND p.provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())));

-- Bookings: customer + provider read, customer insert
DROP POLICY IF EXISTS dancer_bookings_read ON public.dancer_bookings;
CREATE POLICY dancer_bookings_read ON public.dancer_bookings FOR SELECT
  USING (customer_id = auth.uid() OR provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS dancer_bookings_customer_insert ON public.dancer_bookings;
CREATE POLICY dancer_bookings_customer_insert ON public.dancer_bookings FOR INSERT
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS dancer_bookings_provider_update ON public.dancer_bookings;
CREATE POLICY dancer_bookings_provider_update ON public.dancer_bookings FOR UPDATE
  USING (provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()));
