-- Drone Photography category system. Idempotent. Isolated from all other categories.
-- Pattern: same as Catering/Photography — dedicated tables, RLS, ownership guards.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Ownership functions ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_drone_operator(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('drone_photography','drone_operator','drone_videography'));
$$;
CREATE OR REPLACE FUNCTION public.owns_drone_operator(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('drone_photography','drone_operator','drone_videography'));
$$;

-- ─── Drone Packages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drone_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  description text,
  -- Pricing
  starting_price numeric(12,2) CHECK (starting_price >= 0),
  fixed_price numeric(12,2) CHECK (fixed_price >= 0),
  hourly_price numeric(12,2) CHECK (hourly_price >= 0),
  half_day_price numeric(12,2) CHECK (half_day_price >= 0),
  full_day_price numeric(12,2) CHECK (full_day_price >= 0),
  -- Coverage
  service_types text[] NOT NULL DEFAULT '{}',
  coverage_type text DEFAULT 'photos_videos' CHECK (coverage_type IN ('photos_only','videos_only','photos_videos')),
  coverage_durations text[] NOT NULL DEFAULT '{}',
  -- Drone details
  drone_brand text,
  drone_model text,
  camera_resolution text DEFAULT '4K',
  drone_features text[] NOT NULL DEFAULT '{}',
  -- Deliverables
  deliverables text[] NOT NULL DEFAULT '{}',
  delivery_time text,
  -- Coverage includes
  coverage_includes text[] NOT NULL DEFAULT '{}',
  -- Travel
  travel_within_city boolean NOT NULL DEFAULT true,
  travel_outside_city boolean NOT NULL DEFAULT false,
  max_travel_km integer,
  -- Policies
  cancellation_policy text,
  weather_policy text,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drone_packages_provider_idx ON public.drone_packages(provider_id, status);

-- ─── Drone Gallery ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drone_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.drone_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  alt_text text,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS drone_gallery_one_cover ON public.drone_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS drone_gallery_package_idx ON public.drone_gallery(package_id, sort_order);

-- ─── Drone Add-ons ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drone_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.drone_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drone_addons_package_idx ON public.drone_addons(package_id);

-- ─── Drone Bookings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drone_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.drone_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  coverage_duration text,
  venue text,
  indoor_outdoor text DEFAULT 'outdoor',
  drone_permission_available boolean DEFAULT false,
  restricted_area boolean DEFAULT false,
  special_requests text,
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
CREATE INDEX IF NOT EXISTS drone_bookings_provider_idx ON public.drone_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS drone_bookings_customer_idx ON public.drone_bookings(customer_id, created_at DESC);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.drone_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS drone_packages_updated_at ON public.drone_packages;
CREATE TRIGGER drone_packages_updated_at BEFORE UPDATE ON public.drone_packages FOR EACH ROW EXECUTE FUNCTION public.drone_updated_at();

CREATE OR REPLACE FUNCTION public.drone_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_drone_operator(NEW.provider_id) THEN RAISE EXCEPTION 'Drone data is restricted to drone_photography providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS drone_package_guard ON public.drone_packages;
CREATE TRIGGER drone_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.drone_packages FOR EACH ROW EXECUTE FUNCTION public.drone_guard();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['drone_packages','drone_gallery','drone_addons','drone_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS drone_packages_read ON public.drone_packages;
DROP POLICY IF EXISTS drone_packages_owner ON public.drone_packages;
CREATE POLICY drone_packages_read ON public.drone_packages FOR SELECT USING ((status='active') OR public.owns_drone_operator(provider_id));
CREATE POLICY drone_packages_owner ON public.drone_packages FOR ALL USING (public.owns_drone_operator(provider_id)) WITH CHECK (public.owns_drone_operator(provider_id));

DROP POLICY IF EXISTS drone_gallery_read ON public.drone_gallery;
DROP POLICY IF EXISTS drone_gallery_owner ON public.drone_gallery;
CREATE POLICY drone_gallery_read ON public.drone_gallery FOR SELECT USING (true);
CREATE POLICY drone_gallery_owner ON public.drone_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.drone_packages p WHERE p.id=package_id AND public.owns_drone_operator(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.drone_packages p WHERE p.id=package_id AND public.owns_drone_operator(p.provider_id)));

DROP POLICY IF EXISTS drone_addons_read ON public.drone_addons;
DROP POLICY IF EXISTS drone_addons_owner ON public.drone_addons;
CREATE POLICY drone_addons_read ON public.drone_addons FOR SELECT USING (true);
CREATE POLICY drone_addons_owner ON public.drone_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.drone_packages p WHERE p.id=package_id AND public.owns_drone_operator(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.drone_packages p WHERE p.id=package_id AND public.owns_drone_operator(p.provider_id)));

DROP POLICY IF EXISTS drone_bookings_read ON public.drone_bookings;
DROP POLICY IF EXISTS drone_bookings_customer_insert ON public.drone_bookings;
CREATE POLICY drone_bookings_read ON public.drone_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_drone_operator(provider_id));
CREATE POLICY drone_bookings_customer_insert ON public.drone_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY drone_bookings_customer_update ON public.drone_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid() OR public.owns_drone_operator(provider_id));

-- ─── Storage ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets(id,name,public) VALUES('drone-media','drone-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS drone_media_read ON storage.objects;
DROP POLICY IF EXISTS drone_media_owner ON storage.objects;
CREATE POLICY drone_media_read ON storage.objects FOR SELECT USING(bucket_id='drone-media');
CREATE POLICY drone_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='drone-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='drone-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- ─── Realtime ────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['drone_packages','drone_gallery','drone_addons','drone_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
