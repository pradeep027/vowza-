-- Pandits & Priests category system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Category gate functions
CREATE OR REPLACE FUNCTION public.is_priest(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('priest','pandit','purohit','pujari','panditji','astrologer_priest','temple_priest','hindu_priest','muslim_priest','christian_priest','vedic_pandit'));
$$;
CREATE OR REPLACE FUNCTION public.owns_priest(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('priest','pandit','purohit','pujari','panditji','astrologer_priest','temple_priest','hindu_priest','muslim_priest','christian_priest','vedic_pandit'));
$$;

-- Main packages table
CREATE TABLE IF NOT EXISTS public.priest_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  package_type text NOT NULL,
  description text,
  -- Pricing
  service_price numeric(12,2) CHECK (service_price >= 0),
  advance_percentage integer DEFAULT 20,
  dakshina_included boolean DEFAULT false,
  travel_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  extra_ritual_charges numeric(12,2) DEFAULT 0,
  extra_hours_charges numeric(12,2) DEFAULT 0,
  materials_included boolean DEFAULT false,
  -- Service details (JSONB for dynamic fields per package_type)
  service_details jsonb NOT NULL DEFAULT '{}',
  -- Ritual info
  duration text,
  required_materials text[] NOT NULL DEFAULT '{}',
  temple_required boolean DEFAULT false,
  -- Languages & experience
  languages text[] NOT NULL DEFAULT '{}',
  years_of_experience integer,
  -- Included services
  included_services text[] NOT NULL DEFAULT '{}',
  -- Availability
  available_cities text[] NOT NULL DEFAULT '{}',
  travel_distance text,
  daily_capacity integer DEFAULT 2,
  max_bookings_per_day integer DEFAULT 2,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS priest_packages_provider_idx ON public.priest_packages(provider_id, status);

-- Gallery
CREATE TABLE IF NOT EXISTS public.priest_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.priest_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS priest_gallery_one_cover ON public.priest_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS priest_gallery_package_idx ON public.priest_gallery(package_id, sort_order);

-- Add-ons
CREATE TABLE IF NOT EXISTS public.priest_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.priest_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS priest_addons_package_idx ON public.priest_addons(package_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.priest_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.priest_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  special_instructions text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS priest_bookings_provider_idx ON public.priest_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS priest_bookings_customer_idx ON public.priest_bookings(customer_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.priest_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS priest_packages_updated_at ON public.priest_packages;
CREATE TRIGGER priest_packages_updated_at BEFORE UPDATE ON public.priest_packages FOR EACH ROW EXECUTE FUNCTION public.priest_updated_at();

-- Category guard trigger
CREATE OR REPLACE FUNCTION public.priest_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_priest(NEW.provider_id) THEN RAISE EXCEPTION 'Priest data restricted to priest/pandit providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS priest_package_guard ON public.priest_packages;
CREATE TRIGGER priest_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.priest_packages FOR EACH ROW EXECUTE FUNCTION public.priest_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['priest_packages','priest_gallery','priest_addons','priest_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS priest_packages_read ON public.priest_packages;
DROP POLICY IF EXISTS priest_packages_owner ON public.priest_packages;
CREATE POLICY priest_packages_read ON public.priest_packages FOR SELECT USING ((status='active') OR public.owns_priest(provider_id));
CREATE POLICY priest_packages_owner ON public.priest_packages FOR ALL USING (public.owns_priest(provider_id)) WITH CHECK (public.owns_priest(provider_id));

DROP POLICY IF EXISTS priest_gallery_read ON public.priest_gallery;
DROP POLICY IF EXISTS priest_gallery_owner ON public.priest_gallery;
CREATE POLICY priest_gallery_read ON public.priest_gallery FOR SELECT USING (true);
CREATE POLICY priest_gallery_owner ON public.priest_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.priest_packages p WHERE p.id=package_id AND public.owns_priest(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.priest_packages p WHERE p.id=package_id AND public.owns_priest(p.provider_id)));

DROP POLICY IF EXISTS priest_addons_read ON public.priest_addons;
DROP POLICY IF EXISTS priest_addons_owner ON public.priest_addons;
CREATE POLICY priest_addons_read ON public.priest_addons FOR SELECT USING (true);
CREATE POLICY priest_addons_owner ON public.priest_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.priest_packages p WHERE p.id=package_id AND public.owns_priest(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.priest_packages p WHERE p.id=package_id AND public.owns_priest(p.provider_id)));

DROP POLICY IF EXISTS priest_bookings_read ON public.priest_bookings;
DROP POLICY IF EXISTS priest_bookings_customer_insert ON public.priest_bookings;
DROP POLICY IF EXISTS priest_bookings_customer_update ON public.priest_bookings;
DROP POLICY IF EXISTS priest_bookings_provider_update ON public.priest_bookings;
CREATE POLICY priest_bookings_read ON public.priest_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_priest(provider_id));
CREATE POLICY priest_bookings_customer_insert ON public.priest_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY priest_bookings_customer_update ON public.priest_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY priest_bookings_provider_update ON public.priest_bookings FOR UPDATE TO authenticated USING (public.owns_priest(provider_id)) WITH CHECK (public.owns_priest(provider_id));

-- Storage bucket
INSERT INTO storage.buckets(id,name,public) VALUES('priest-media','priest-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS priest_media_read ON storage.objects;
DROP POLICY IF EXISTS priest_media_owner ON storage.objects;
CREATE POLICY priest_media_read ON storage.objects FOR SELECT USING(bucket_id='priest-media');
CREATE POLICY priest_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='priest-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='priest-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['priest_packages','priest_gallery','priest_addons','priest_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
