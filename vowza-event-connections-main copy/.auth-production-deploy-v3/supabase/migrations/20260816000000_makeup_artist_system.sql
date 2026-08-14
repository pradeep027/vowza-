-- Makeup Artist category system. Idempotent. Isolated from all other categories.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_makeup_artist(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('makeup_artist','bridal_makeup','makeup'));
$$;
CREATE OR REPLACE FUNCTION public.owns_makeup_artist(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('makeup_artist','bridal_makeup','makeup'));
$$;

CREATE TABLE IF NOT EXISTS public.makeup_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  package_type text NOT NULL,
  description text,
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20 CHECK (advance_percentage BETWEEN 0 AND 100),
  travel_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  touchup_charges numeric(12,2) DEFAULT 0,
  early_morning_charges numeric(12,2) DEFAULT 0,
  late_night_charges numeric(12,2) DEFAULT 0,
  services_included text[] NOT NULL DEFAULT '{}',
  brands_used text[] NOT NULL DEFAULT '{}',
  skin_types text[] NOT NULL DEFAULT '{}',
  deliverables text[] NOT NULL DEFAULT '{}',
  lead_artist integer DEFAULT 1,
  assistant_artists integer DEFAULT 0,
  hair_stylists integer DEFAULT 0,
  saree_drapers integer DEFAULT 0,
  male_grooming_artist integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS makeup_packages_provider_idx ON public.makeup_packages(provider_id, status);
CREATE INDEX IF NOT EXISTS makeup_packages_type_idx ON public.makeup_packages(package_type);

CREATE TABLE IF NOT EXISTS public.makeup_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.makeup_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS makeup_gallery_one_cover ON public.makeup_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS makeup_gallery_package_idx ON public.makeup_gallery(package_id, sort_order);

CREATE TABLE IF NOT EXISTS public.makeup_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.makeup_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS makeup_addons_package_idx ON public.makeup_addons(package_id);

CREATE TABLE IF NOT EXISTS public.makeup_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.makeup_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  special_requirements text,
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
CREATE INDEX IF NOT EXISTS makeup_bookings_provider_idx ON public.makeup_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS makeup_bookings_customer_idx ON public.makeup_bookings(customer_id, created_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION public.makeup_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS makeup_packages_updated_at ON public.makeup_packages;
CREATE TRIGGER makeup_packages_updated_at BEFORE UPDATE ON public.makeup_packages FOR EACH ROW EXECUTE FUNCTION public.makeup_updated_at();

CREATE OR REPLACE FUNCTION public.makeup_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_makeup_artist(NEW.provider_id) THEN RAISE EXCEPTION 'Makeup data restricted to makeup_artist providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS makeup_package_guard ON public.makeup_packages;
CREATE TRIGGER makeup_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.makeup_packages FOR EACH ROW EXECUTE FUNCTION public.makeup_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['makeup_packages','makeup_gallery','makeup_addons','makeup_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS makeup_packages_read ON public.makeup_packages;
DROP POLICY IF EXISTS makeup_packages_owner ON public.makeup_packages;
CREATE POLICY makeup_packages_read ON public.makeup_packages FOR SELECT USING ((status='active') OR public.owns_makeup_artist(provider_id));
CREATE POLICY makeup_packages_owner ON public.makeup_packages FOR ALL USING (public.owns_makeup_artist(provider_id)) WITH CHECK (public.owns_makeup_artist(provider_id));

DROP POLICY IF EXISTS makeup_gallery_read ON public.makeup_gallery;
DROP POLICY IF EXISTS makeup_gallery_owner ON public.makeup_gallery;
CREATE POLICY makeup_gallery_read ON public.makeup_gallery FOR SELECT USING (true);
CREATE POLICY makeup_gallery_owner ON public.makeup_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.makeup_packages p WHERE p.id=package_id AND public.owns_makeup_artist(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.makeup_packages p WHERE p.id=package_id AND public.owns_makeup_artist(p.provider_id)));

DROP POLICY IF EXISTS makeup_addons_read ON public.makeup_addons;
DROP POLICY IF EXISTS makeup_addons_owner ON public.makeup_addons;
CREATE POLICY makeup_addons_read ON public.makeup_addons FOR SELECT USING (true);
CREATE POLICY makeup_addons_owner ON public.makeup_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.makeup_packages p WHERE p.id=package_id AND public.owns_makeup_artist(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.makeup_packages p WHERE p.id=package_id AND public.owns_makeup_artist(p.provider_id)));

DROP POLICY IF EXISTS makeup_bookings_read ON public.makeup_bookings;
DROP POLICY IF EXISTS makeup_bookings_customer_insert ON public.makeup_bookings;
DROP POLICY IF EXISTS makeup_bookings_customer_update ON public.makeup_bookings;
DROP POLICY IF EXISTS makeup_bookings_provider_update ON public.makeup_bookings;
CREATE POLICY makeup_bookings_read ON public.makeup_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_makeup_artist(provider_id));
CREATE POLICY makeup_bookings_customer_insert ON public.makeup_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY makeup_bookings_customer_update ON public.makeup_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY makeup_bookings_provider_update ON public.makeup_bookings FOR UPDATE TO authenticated USING (public.owns_makeup_artist(provider_id)) WITH CHECK (public.owns_makeup_artist(provider_id));

-- Storage
INSERT INTO storage.buckets(id,name,public) VALUES('makeup-media','makeup-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS makeup_media_read ON storage.objects;
DROP POLICY IF EXISTS makeup_media_owner ON storage.objects;
CREATE POLICY makeup_media_read ON storage.objects FOR SELECT USING(bucket_id='makeup-media');
CREATE POLICY makeup_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='makeup-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='makeup-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['makeup_packages','makeup_gallery','makeup_addons','makeup_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
