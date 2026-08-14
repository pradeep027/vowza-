-- DJ Services category system. Idempotent. Isolated from all other categories.
-- Pattern: same as Drone/Catering/Videography — dedicated tables, RLS, ownership guards.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Ownership functions ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_dj(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('dj','disc_jockey','dj_services'));
$$;
CREATE OR REPLACE FUNCTION public.owns_dj(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('dj','disc_jockey','dj_services'));
$$;

-- ─── DJ Packages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dj_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  description text,
  event_type text,
  -- Pricing
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20 CHECK (advance_percentage BETWEEN 0 AND 100),
  travel_charges numeric(12,2) DEFAULT 0,
  extra_hour_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  equipment_transport_charges numeric(12,2) DEFAULT 0,
  -- Performance
  performance_duration text DEFAULT '4 Hours',
  music_genres text[] NOT NULL DEFAULT '{}',
  event_coverage text[] NOT NULL DEFAULT '{}',
  -- Equipment
  equipment text[] NOT NULL DEFAULT '{}',
  -- Team
  dj_count integer DEFAULT 1,
  assistant_djs integer DEFAULT 0,
  sound_engineers integer DEFAULT 0,
  lighting_operators integer DEFAULT 0,
  technicians integer DEFAULT 0,
  stage_crew integer DEFAULT 0,
  mc_host boolean DEFAULT false,
  -- Deliverables
  deliverables text[] NOT NULL DEFAULT '{}',
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dj_packages_provider_idx ON public.dj_packages(provider_id, status);

-- ─── DJ Gallery ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dj_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dj_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dj_gallery_one_cover ON public.dj_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS dj_gallery_package_idx ON public.dj_gallery(package_id, sort_order);

-- ─── DJ Add-ons ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dj_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dj_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dj_addons_package_idx ON public.dj_addons(package_id);

-- ─── DJ Bookings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dj_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dj_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  expected_audience integer,
  song_requests text,
  special_instructions text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dj_bookings_provider_idx ON public.dj_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dj_bookings_customer_idx ON public.dj_bookings(customer_id, created_at DESC);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dj_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS dj_packages_updated_at ON public.dj_packages;
CREATE TRIGGER dj_packages_updated_at BEFORE UPDATE ON public.dj_packages FOR EACH ROW EXECUTE FUNCTION public.dj_updated_at();

CREATE OR REPLACE FUNCTION public.dj_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_dj(NEW.provider_id) THEN RAISE EXCEPTION 'DJ data is restricted to dj providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS dj_package_guard ON public.dj_packages;
CREATE TRIGGER dj_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.dj_packages FOR EACH ROW EXECUTE FUNCTION public.dj_guard();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['dj_packages','dj_gallery','dj_addons','dj_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS dj_packages_read ON public.dj_packages;
DROP POLICY IF EXISTS dj_packages_owner ON public.dj_packages;
CREATE POLICY dj_packages_read ON public.dj_packages FOR SELECT USING ((status='active') OR public.owns_dj(provider_id));
CREATE POLICY dj_packages_owner ON public.dj_packages FOR ALL USING (public.owns_dj(provider_id)) WITH CHECK (public.owns_dj(provider_id));

DROP POLICY IF EXISTS dj_gallery_read ON public.dj_gallery;
DROP POLICY IF EXISTS dj_gallery_owner ON public.dj_gallery;
CREATE POLICY dj_gallery_read ON public.dj_gallery FOR SELECT USING (true);
CREATE POLICY dj_gallery_owner ON public.dj_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.dj_packages p WHERE p.id=package_id AND public.owns_dj(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.dj_packages p WHERE p.id=package_id AND public.owns_dj(p.provider_id)));

DROP POLICY IF EXISTS dj_addons_read ON public.dj_addons;
DROP POLICY IF EXISTS dj_addons_owner ON public.dj_addons;
CREATE POLICY dj_addons_read ON public.dj_addons FOR SELECT USING (true);
CREATE POLICY dj_addons_owner ON public.dj_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.dj_packages p WHERE p.id=package_id AND public.owns_dj(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.dj_packages p WHERE p.id=package_id AND public.owns_dj(p.provider_id)));

DROP POLICY IF EXISTS dj_bookings_read ON public.dj_bookings;
DROP POLICY IF EXISTS dj_bookings_customer_insert ON public.dj_bookings;
DROP POLICY IF EXISTS dj_bookings_customer_update ON public.dj_bookings;
DROP POLICY IF EXISTS dj_bookings_provider_update ON public.dj_bookings;
CREATE POLICY dj_bookings_read ON public.dj_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_dj(provider_id));
CREATE POLICY dj_bookings_customer_insert ON public.dj_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY dj_bookings_customer_update ON public.dj_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY dj_bookings_provider_update ON public.dj_bookings FOR UPDATE TO authenticated USING (public.owns_dj(provider_id)) WITH CHECK (public.owns_dj(provider_id));

-- ─── Storage ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets(id,name,public) VALUES('dj-media','dj-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS dj_media_read ON storage.objects;
DROP POLICY IF EXISTS dj_media_owner ON storage.objects;
CREATE POLICY dj_media_read ON storage.objects FOR SELECT USING(bucket_id='dj-media');
CREATE POLICY dj_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='dj-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='dj-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- ─── Realtime ────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['dj_packages','dj_gallery','dj_addons','dj_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
