-- Catering category management system. Idempotent. Isolated from all other categories.
-- Pattern: same as Water Supplier and Photographer — dedicated tables, RLS, ownership guards.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Ownership functions ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_caterer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text='catering_services');
$$;
CREATE OR REPLACE FUNCTION public.owns_caterer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text='catering_services');
$$;

-- ─── Catering Packages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  description text,
  cuisine_types text[] NOT NULL DEFAULT '{}',
  service_types text[] NOT NULL DEFAULT '{}',
  serving_styles text[] NOT NULL DEFAULT '{}',
  meal_types text[] NOT NULL DEFAULT '{}',
  price_per_plate numeric(12,2) CHECK (price_per_plate >= 0),
  starting_price numeric(12,2) CHECK (starting_price >= 0),
  min_guests integer NOT NULL DEFAULT 50 CHECK (min_guests > 0),
  max_guests integer CHECK (max_guests IS NULL OR max_guests >= min_guests),
  recommended_guests integer,
  advance_percentage integer DEFAULT 30 CHECK (advance_percentage BETWEEN 0 AND 100),
  preparation_days integer DEFAULT 3,
  cancellation_policy text,
  service_duration text,
  is_veg boolean NOT NULL DEFAULT true,
  is_nonveg boolean NOT NULL DEFAULT false,
  is_jain boolean NOT NULL DEFAULT false,
  is_vegan boolean NOT NULL DEFAULT false,
  travel_within_city boolean NOT NULL DEFAULT true,
  travel_outside_city boolean NOT NULL DEFAULT false,
  max_travel_km integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_packages_provider_idx ON public.catering_packages(provider_id, status);

-- ─── Menu Sections ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.catering_packages(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_sections_package_idx ON public.catering_menu_sections(package_id, sort_order);

-- ─── Menu Items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.catering_menu_sections(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  description text,
  is_veg boolean NOT NULL DEFAULT true,
  is_jain boolean NOT NULL DEFAULT false,
  is_premium boolean NOT NULL DEFAULT false,
  is_bestseller boolean NOT NULL DEFAULT false,
  is_unlimited boolean NOT NULL DEFAULT true,
  spicy_level integer DEFAULT 1 CHECK (spicy_level BETWEEN 0 AND 5),
  extra_cost numeric(12,2) DEFAULT 0 CHECK (extra_cost >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_items_section_idx ON public.catering_menu_items(section_id, sort_order);

-- ─── Package Add-ons ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.catering_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_addons_package_idx ON public.catering_addons(package_id);

-- ─── Package Gallery ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.catering_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  alt_text text,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catering_gallery_one_cover ON public.catering_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS catering_gallery_package_idx ON public.catering_gallery(package_id, sort_order);

-- ─── Catering Bookings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.catering_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  guest_count integer NOT NULL CHECK (guest_count > 0),
  meal_type text,
  venue text,
  special_requests text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','preparing','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_bookings_provider_idx ON public.catering_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catering_bookings_customer_idx ON public.catering_bookings(customer_id, created_at DESC);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.catering_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS catering_packages_updated_at ON public.catering_packages;
CREATE TRIGGER catering_packages_updated_at BEFORE UPDATE ON public.catering_packages FOR EACH ROW EXECUTE FUNCTION public.catering_updated_at();

CREATE OR REPLACE FUNCTION public.catering_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_caterer(NEW.provider_id) THEN RAISE EXCEPTION 'Catering data is restricted to catering_services providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS catering_package_guard ON public.catering_packages;
CREATE TRIGGER catering_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.catering_packages FOR EACH ROW EXECUTE FUNCTION public.catering_guard();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['catering_packages','catering_menu_sections','catering_menu_items','catering_addons','catering_gallery','catering_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS catering_packages_read ON public.catering_packages;
DROP POLICY IF EXISTS catering_packages_owner ON public.catering_packages;
CREATE POLICY catering_packages_read ON public.catering_packages FOR SELECT USING ((status='active') OR public.owns_caterer(provider_id));
CREATE POLICY catering_packages_owner ON public.catering_packages FOR ALL USING (public.owns_caterer(provider_id)) WITH CHECK (public.owns_caterer(provider_id));

DROP POLICY IF EXISTS catering_sections_read ON public.catering_menu_sections;
DROP POLICY IF EXISTS catering_sections_owner ON public.catering_menu_sections;
CREATE POLICY catering_sections_read ON public.catering_menu_sections FOR SELECT USING (true);
CREATE POLICY catering_sections_owner ON public.catering_menu_sections FOR ALL USING (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id)));

DROP POLICY IF EXISTS catering_items_read ON public.catering_menu_items;
DROP POLICY IF EXISTS catering_items_owner ON public.catering_menu_items;
CREATE POLICY catering_items_read ON public.catering_menu_items FOR SELECT USING (true);
CREATE POLICY catering_items_owner ON public.catering_menu_items FOR ALL USING (EXISTS(SELECT 1 FROM public.catering_menu_sections s JOIN public.catering_packages p ON p.id=s.package_id WHERE s.id=section_id AND public.owns_caterer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.catering_menu_sections s JOIN public.catering_packages p ON p.id=s.package_id WHERE s.id=section_id AND public.owns_caterer(p.provider_id)));

DROP POLICY IF EXISTS catering_addons_read ON public.catering_addons;
DROP POLICY IF EXISTS catering_addons_owner ON public.catering_addons;
CREATE POLICY catering_addons_read ON public.catering_addons FOR SELECT USING (true);
CREATE POLICY catering_addons_owner ON public.catering_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id)));

DROP POLICY IF EXISTS catering_gallery_read ON public.catering_gallery;
DROP POLICY IF EXISTS catering_gallery_owner ON public.catering_gallery;
CREATE POLICY catering_gallery_read ON public.catering_gallery FOR SELECT USING (true);
CREATE POLICY catering_gallery_owner ON public.catering_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id)));

DROP POLICY IF EXISTS catering_bookings_read ON public.catering_bookings;
CREATE POLICY catering_bookings_read ON public.catering_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_caterer(provider_id));

-- ─── Storage ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets(id,name,public) VALUES('catering-images','catering-images',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS catering_images_read ON storage.objects;
DROP POLICY IF EXISTS catering_images_owner ON storage.objects;
CREATE POLICY catering_images_read ON storage.objects FOR SELECT USING(bucket_id='catering-images');
CREATE POLICY catering_images_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='catering-images' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='catering-images' AND auth.uid()::text=(storage.foldername(name))[1]);

-- ─── Realtime ────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['catering_packages','catering_menu_sections','catering_menu_items','catering_addons','catering_gallery','catering_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
