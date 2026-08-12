-- Banquet Hall category system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Category gate functions
CREATE OR REPLACE FUNCTION public.is_banquet_hall(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('banquet_hall','banquet','venue','hall','function_hall','convention_hall','wedding_hall','event_venue'));
$$;
CREATE OR REPLACE FUNCTION public.owns_banquet_hall(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('banquet_hall','banquet','venue','hall','function_hall','convention_hall','wedding_hall','event_venue'));
$$;

-- Main packages table
CREATE TABLE IF NOT EXISTS public.banquet_halls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  venue_type text NOT NULL,
  description text,
  hall_rental_price numeric(12,2) CHECK (hall_rental_price >= 0),
  advance_percentage integer DEFAULT 20,
  security_deposit numeric(12,2) DEFAULT 0,
  cleaning_charges numeric(12,2) DEFAULT 0,
  decoration_permission_fee numeric(12,2) DEFAULT 0,
  generator_charges numeric(12,2) DEFAULT 0,
  extra_hour_charges numeric(12,2) DEFAULT 0,
  outside_catering_charges numeric(12,2) DEFAULT 0,
  hall_capacity text,
  seating_styles text[] NOT NULL DEFAULT '{}',
  venue_features text[] NOT NULL DEFAULT '{}',
  facilities_included text[] NOT NULL DEFAULT '{}',
  event_types_supported text[] NOT NULL DEFAULT '{}',
  -- Rules
  allowed_time text,
  noise_restrictions text,
  outside_decoration_allowed boolean DEFAULT true,
  outside_catering_allowed boolean DEFAULT true,
  alcohol_allowed boolean DEFAULT false,
  fireworks_allowed boolean DEFAULT false,
  smoking_policy text,
  cancellation_policy text,
  advance_refund_policy text,
  -- Media
  virtual_tour_url text,
  google_maps_url text,
  address text,
  city text,
  state text,
  pincode text,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS banquet_halls_provider_idx ON public.banquet_halls(provider_id, status);

-- Gallery
CREATE TABLE IF NOT EXISTS public.hall_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.banquet_halls(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video','360','drone')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hall_gallery_one_cover ON public.hall_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS hall_gallery_package_idx ON public.hall_gallery(package_id, sort_order);

-- Add-ons
CREATE TABLE IF NOT EXISTS public.hall_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.banquet_halls(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hall_addons_package_idx ON public.hall_addons(package_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.banquet_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.banquet_halls(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  guest_count text,
  venue text,
  city text,
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
CREATE INDEX IF NOT EXISTS banquet_bookings_provider_idx ON public.banquet_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS banquet_bookings_customer_idx ON public.banquet_bookings(customer_id, created_at DESC);
-- Prevent double booking same venue same date
CREATE UNIQUE INDEX IF NOT EXISTS banquet_bookings_no_double ON public.banquet_bookings(package_id, event_date) WHERE status IN ('accepted','confirmed','in_progress');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.banquet_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS banquet_halls_updated_at ON public.banquet_halls;
CREATE TRIGGER banquet_halls_updated_at BEFORE UPDATE ON public.banquet_halls FOR EACH ROW EXECUTE FUNCTION public.banquet_updated_at();

-- Category guard trigger
CREATE OR REPLACE FUNCTION public.banquet_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_banquet_hall(NEW.provider_id) THEN RAISE EXCEPTION 'Banquet data restricted to banquet hall providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS banquet_hall_guard ON public.banquet_halls;
CREATE TRIGGER banquet_hall_guard BEFORE INSERT OR UPDATE OF provider_id ON public.banquet_halls FOR EACH ROW EXECUTE FUNCTION public.banquet_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['banquet_halls','hall_gallery','hall_addons','banquet_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

-- banquet_halls policies
DROP POLICY IF EXISTS banquet_halls_read ON public.banquet_halls;
DROP POLICY IF EXISTS banquet_halls_owner ON public.banquet_halls;
CREATE POLICY banquet_halls_read ON public.banquet_halls FOR SELECT USING ((status='active') OR public.owns_banquet_hall(provider_id));
CREATE POLICY banquet_halls_owner ON public.banquet_halls FOR ALL USING (public.owns_banquet_hall(provider_id)) WITH CHECK (public.owns_banquet_hall(provider_id));

-- hall_gallery policies
DROP POLICY IF EXISTS hall_gallery_read ON public.hall_gallery;
DROP POLICY IF EXISTS hall_gallery_owner ON public.hall_gallery;
CREATE POLICY hall_gallery_read ON public.hall_gallery FOR SELECT USING (true);
CREATE POLICY hall_gallery_owner ON public.hall_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.banquet_halls p WHERE p.id=package_id AND public.owns_banquet_hall(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.banquet_halls p WHERE p.id=package_id AND public.owns_banquet_hall(p.provider_id)));

-- hall_addons policies
DROP POLICY IF EXISTS hall_addons_read ON public.hall_addons;
DROP POLICY IF EXISTS hall_addons_owner ON public.hall_addons;
CREATE POLICY hall_addons_read ON public.hall_addons FOR SELECT USING (true);
CREATE POLICY hall_addons_owner ON public.hall_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.banquet_halls p WHERE p.id=package_id AND public.owns_banquet_hall(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.banquet_halls p WHERE p.id=package_id AND public.owns_banquet_hall(p.provider_id)));

-- banquet_bookings policies
DROP POLICY IF EXISTS banquet_bookings_read ON public.banquet_bookings;
DROP POLICY IF EXISTS banquet_bookings_customer_insert ON public.banquet_bookings;
DROP POLICY IF EXISTS banquet_bookings_customer_update ON public.banquet_bookings;
DROP POLICY IF EXISTS banquet_bookings_provider_update ON public.banquet_bookings;
CREATE POLICY banquet_bookings_read ON public.banquet_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_banquet_hall(provider_id));
CREATE POLICY banquet_bookings_customer_insert ON public.banquet_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY banquet_bookings_customer_update ON public.banquet_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY banquet_bookings_provider_update ON public.banquet_bookings FOR UPDATE TO authenticated USING (public.owns_banquet_hall(provider_id)) WITH CHECK (public.owns_banquet_hall(provider_id));

-- Storage bucket
INSERT INTO storage.buckets(id,name,public) VALUES('banquet-media','banquet-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS banquet_media_read ON storage.objects;
DROP POLICY IF EXISTS banquet_media_owner ON storage.objects;
CREATE POLICY banquet_media_read ON storage.objects FOR SELECT USING(bucket_id='banquet-media');
CREATE POLICY banquet_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='banquet-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='banquet-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['banquet_halls','hall_gallery','hall_addons','banquet_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
