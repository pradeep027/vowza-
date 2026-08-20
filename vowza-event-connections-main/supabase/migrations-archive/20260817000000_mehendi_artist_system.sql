-- Mehendi Artist category system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_mehendi_artist(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('mehendi_artist','mehndi_artist','mehendi','henna_artist'));
$$;
CREATE OR REPLACE FUNCTION public.owns_mehendi_artist(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('mehendi_artist','mehndi_artist','mehendi','henna_artist'));
$$;

CREATE TABLE IF NOT EXISTS public.mehendi_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  package_type text NOT NULL,
  description text,
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20,
  price_per_hand numeric(12,2) DEFAULT 0,
  price_per_person numeric(12,2) DEFAULT 0,
  travel_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  group_discount numeric(12,2) DEFAULT 0,
  festival_charges numeric(12,2) DEFAULT 0,
  design_styles text[] NOT NULL DEFAULT '{}',
  coverage text[] NOT NULL DEFAULT '{}',
  clients_included integer DEFAULT 1,
  inclusions text[] NOT NULL DEFAULT '{}',
  deliverables text[] NOT NULL DEFAULT '{}',
  lead_artist integer DEFAULT 1,
  assistant_artists integer DEFAULT 0,
  max_clients integer DEFAULT 5,
  bridal_specialist boolean DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mehendi_packages_provider_idx ON public.mehendi_packages(provider_id, status);

CREATE TABLE IF NOT EXISTS public.mehendi_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.mehendi_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mehendi_gallery_one_cover ON public.mehendi_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS mehendi_gallery_package_idx ON public.mehendi_gallery(package_id, sort_order);

CREATE TABLE IF NOT EXISTS public.mehendi_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.mehendi_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mehendi_addons_package_idx ON public.mehendi_addons(package_id);

CREATE TABLE IF NOT EXISTS public.mehendi_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.mehendi_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  num_clients integer DEFAULT 1,
  special_requirements text,
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
CREATE INDEX IF NOT EXISTS mehendi_bookings_provider_idx ON public.mehendi_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mehendi_bookings_customer_idx ON public.mehendi_bookings(customer_id, created_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION public.mehendi_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS mehendi_packages_updated_at ON public.mehendi_packages;
CREATE TRIGGER mehendi_packages_updated_at BEFORE UPDATE ON public.mehendi_packages FOR EACH ROW EXECUTE FUNCTION public.mehendi_updated_at();

CREATE OR REPLACE FUNCTION public.mehendi_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_mehendi_artist(NEW.provider_id) THEN RAISE EXCEPTION 'Mehendi data restricted to mehendi_artist providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS mehendi_package_guard ON public.mehendi_packages;
CREATE TRIGGER mehendi_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.mehendi_packages FOR EACH ROW EXECUTE FUNCTION public.mehendi_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['mehendi_packages','mehendi_gallery','mehendi_addons','mehendi_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS mehendi_packages_read ON public.mehendi_packages;
DROP POLICY IF EXISTS mehendi_packages_owner ON public.mehendi_packages;
CREATE POLICY mehendi_packages_read ON public.mehendi_packages FOR SELECT USING ((status='active') OR public.owns_mehendi_artist(provider_id));
CREATE POLICY mehendi_packages_owner ON public.mehendi_packages FOR ALL USING (public.owns_mehendi_artist(provider_id)) WITH CHECK (public.owns_mehendi_artist(provider_id));

DROP POLICY IF EXISTS mehendi_gallery_read ON public.mehendi_gallery;
DROP POLICY IF EXISTS mehendi_gallery_owner ON public.mehendi_gallery;
CREATE POLICY mehendi_gallery_read ON public.mehendi_gallery FOR SELECT USING (true);
CREATE POLICY mehendi_gallery_owner ON public.mehendi_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.mehendi_packages p WHERE p.id=package_id AND public.owns_mehendi_artist(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.mehendi_packages p WHERE p.id=package_id AND public.owns_mehendi_artist(p.provider_id)));

DROP POLICY IF EXISTS mehendi_addons_read ON public.mehendi_addons;
DROP POLICY IF EXISTS mehendi_addons_owner ON public.mehendi_addons;
CREATE POLICY mehendi_addons_read ON public.mehendi_addons FOR SELECT USING (true);
CREATE POLICY mehendi_addons_owner ON public.mehendi_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.mehendi_packages p WHERE p.id=package_id AND public.owns_mehendi_artist(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.mehendi_packages p WHERE p.id=package_id AND public.owns_mehendi_artist(p.provider_id)));

DROP POLICY IF EXISTS mehendi_bookings_read ON public.mehendi_bookings;
DROP POLICY IF EXISTS mehendi_bookings_customer_insert ON public.mehendi_bookings;
DROP POLICY IF EXISTS mehendi_bookings_customer_update ON public.mehendi_bookings;
DROP POLICY IF EXISTS mehendi_bookings_provider_update ON public.mehendi_bookings;
CREATE POLICY mehendi_bookings_read ON public.mehendi_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_mehendi_artist(provider_id));
CREATE POLICY mehendi_bookings_customer_insert ON public.mehendi_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY mehendi_bookings_customer_update ON public.mehendi_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY mehendi_bookings_provider_update ON public.mehendi_bookings FOR UPDATE TO authenticated USING (public.owns_mehendi_artist(provider_id)) WITH CHECK (public.owns_mehendi_artist(provider_id));

-- Storage
INSERT INTO storage.buckets(id,name,public) VALUES('mehendi-media','mehendi-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS mehendi_media_read ON storage.objects;
DROP POLICY IF EXISTS mehendi_media_owner ON storage.objects;
CREATE POLICY mehendi_media_read ON storage.objects FOR SELECT USING(bucket_id='mehendi-media');
CREATE POLICY mehendi_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='mehendi-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='mehendi-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['mehendi_packages','mehendi_gallery','mehendi_addons','mehendi_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
