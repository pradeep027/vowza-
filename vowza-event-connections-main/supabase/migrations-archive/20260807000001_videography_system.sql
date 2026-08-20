-- Videography category management system. Idempotent. Isolated from all other categories.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_videographer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('videographer','cinematographer'));
$$;
CREATE OR REPLACE FUNCTION public.owns_videographer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('videographer','cinematographer'));
$$;

CREATE TABLE IF NOT EXISTS public.videography_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  description text,
  starting_price numeric(12,2) CHECK (starting_price >= 0),
  full_day_price numeric(12,2),
  half_day_price numeric(12,2),
  hourly_price numeric(12,2),
  extra_hour_cost numeric(12,2),
  advance_percentage integer DEFAULT 30 CHECK (advance_percentage BETWEEN 0 AND 100),
  coverage_hours text,
  event_types text[] NOT NULL DEFAULT '{}',
  included_services text[] NOT NULL DEFAULT '{}',
  deliverables text[] NOT NULL DEFAULT '{}',
  delivery_time text,
  equipment text[] NOT NULL DEFAULT '{}',
  editing_options text[] NOT NULL DEFAULT '{}',
  team_videographers integer DEFAULT 1,
  team_assistants integer DEFAULT 0,
  team_drone_operator boolean DEFAULT false,
  team_editor integer DEFAULT 1,
  team_live_operator boolean DEFAULT false,
  travel_within_city boolean DEFAULT true,
  travel_outside_city boolean DEFAULT false,
  max_travel_km integer,
  cancellation_policy text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videography_packages_provider_idx ON public.videography_packages(provider_id, status);

CREATE TABLE IF NOT EXISTS public.videography_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.videography_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videography_addons_package_idx ON public.videography_addons(package_id);

CREATE TABLE IF NOT EXISTS public.videography_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.videography_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videography_gallery_package_idx ON public.videography_gallery(package_id);

CREATE TABLE IF NOT EXISTS public.videography_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.videography_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  notes text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videography_bookings_provider_idx ON public.videography_bookings(provider_id, created_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION public.videography_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS videography_packages_updated_at ON public.videography_packages;
CREATE TRIGGER videography_packages_updated_at BEFORE UPDATE ON public.videography_packages FOR EACH ROW EXECUTE FUNCTION public.videography_updated_at();

CREATE OR REPLACE FUNCTION public.videography_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_videographer(NEW.provider_id) THEN RAISE EXCEPTION 'Videography data is restricted to videographer/cinematographer providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS videography_package_guard ON public.videography_packages;
CREATE TRIGGER videography_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.videography_packages FOR EACH ROW EXECUTE FUNCTION public.videography_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['videography_packages','videography_addons','videography_gallery','videography_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS videography_packages_read ON public.videography_packages;
DROP POLICY IF EXISTS videography_packages_owner ON public.videography_packages;
CREATE POLICY videography_packages_read ON public.videography_packages FOR SELECT USING ((status='active') OR public.owns_videographer(provider_id));
CREATE POLICY videography_packages_owner ON public.videography_packages FOR ALL USING (public.owns_videographer(provider_id)) WITH CHECK (public.owns_videographer(provider_id));

DROP POLICY IF EXISTS videography_addons_read ON public.videography_addons;
DROP POLICY IF EXISTS videography_addons_owner ON public.videography_addons;
CREATE POLICY videography_addons_read ON public.videography_addons FOR SELECT USING (true);
CREATE POLICY videography_addons_owner ON public.videography_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.videography_packages p WHERE p.id=package_id AND public.owns_videographer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.videography_packages p WHERE p.id=package_id AND public.owns_videographer(p.provider_id)));

DROP POLICY IF EXISTS videography_gallery_read ON public.videography_gallery;
DROP POLICY IF EXISTS videography_gallery_owner ON public.videography_gallery;
CREATE POLICY videography_gallery_read ON public.videography_gallery FOR SELECT USING (true);
CREATE POLICY videography_gallery_owner ON public.videography_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.videography_packages p WHERE p.id=package_id AND public.owns_videographer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.videography_packages p WHERE p.id=package_id AND public.owns_videographer(p.provider_id)));

DROP POLICY IF EXISTS videography_bookings_read ON public.videography_bookings;
CREATE POLICY videography_bookings_read ON public.videography_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_videographer(provider_id));

-- Storage
INSERT INTO storage.buckets(id,name,public) VALUES('videography-media','videography-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS videography_media_read ON storage.objects;
DROP POLICY IF EXISTS videography_media_owner ON storage.objects;
CREATE POLICY videography_media_read ON storage.objects FOR SELECT USING(bucket_id='videography-media');
CREATE POLICY videography_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='videography-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='videography-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['videography_packages','videography_addons','videography_gallery','videography_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
