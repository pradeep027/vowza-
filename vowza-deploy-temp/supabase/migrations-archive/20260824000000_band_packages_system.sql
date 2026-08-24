-- Band Packages & Booking system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Main packages table
CREATE TABLE IF NOT EXISTS public.band_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  band_category text,
  description text,
  event_type text,
  -- Pricing
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20,
  travel_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  extra_hour_charges numeric(12,2) DEFAULT 0,
  additional_performer_charges numeric(12,2) DEFAULT 0,
  additional_equipment_charges numeric(12,2) DEFAULT 0,
  -- Performance details
  performance_duration text,
  number_of_performers text,
  instruments text[] NOT NULL DEFAULT '{}',
  music_genres text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  -- Event coverage
  event_types_supported text[] NOT NULL DEFAULT '{}',
  -- Equipment & inclusions
  equipment_included text[] NOT NULL DEFAULT '{}',
  -- Team
  band_members text,
  lead_performer text,
  drummers text,
  instrumentalists text,
  singers text,
  support_staff text,
  sound_engineer text,
  -- Deliverables
  deliverables text[] NOT NULL DEFAULT '{}',
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS band_packages_provider_idx ON public.band_packages(provider_id, status);

-- Gallery
CREATE TABLE IF NOT EXISTS public.band_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.band_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS band_gallery_one_cover ON public.band_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS band_gallery_package_idx ON public.band_gallery(package_id, sort_order);

-- Add-ons
CREATE TABLE IF NOT EXISTS public.band_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.band_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS band_addons_package_idx ON public.band_addons(package_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.band_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.band_packages(id),
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
CREATE INDEX IF NOT EXISTS band_bookings_provider_idx ON public.band_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS band_bookings_customer_idx ON public.band_bookings(customer_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.band_pkg_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS band_packages_updated_at ON public.band_packages;
CREATE TRIGGER band_packages_updated_at BEFORE UPDATE ON public.band_packages FOR EACH ROW EXECUTE FUNCTION public.band_pkg_updated_at();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['band_packages','band_gallery','band_addons','band_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

-- band_packages policies
DROP POLICY IF EXISTS band_packages_read ON public.band_packages;
DROP POLICY IF EXISTS band_packages_owner ON public.band_packages;
CREATE POLICY band_packages_read ON public.band_packages FOR SELECT USING ((status='active') OR (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())));
CREATE POLICY band_packages_owner ON public.band_packages FOR ALL USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

-- band_gallery policies
DROP POLICY IF EXISTS band_gallery_read ON public.band_gallery;
DROP POLICY IF EXISTS band_gallery_owner ON public.band_gallery;
CREATE POLICY band_gallery_read ON public.band_gallery FOR SELECT USING (true);
CREATE POLICY band_gallery_owner ON public.band_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.band_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.band_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

-- band_addons policies
DROP POLICY IF EXISTS band_addons_read ON public.band_addons;
DROP POLICY IF EXISTS band_addons_owner ON public.band_addons;
CREATE POLICY band_addons_read ON public.band_addons FOR SELECT USING (true);
CREATE POLICY band_addons_owner ON public.band_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.band_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.band_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

-- band_bookings policies
DROP POLICY IF EXISTS band_bookings_read ON public.band_bookings;
DROP POLICY IF EXISTS band_bookings_customer_insert ON public.band_bookings;
DROP POLICY IF EXISTS band_bookings_customer_update ON public.band_bookings;
DROP POLICY IF EXISTS band_bookings_provider_update ON public.band_bookings;
CREATE POLICY band_bookings_read ON public.band_bookings FOR SELECT USING (customer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));
CREATE POLICY band_bookings_customer_insert ON public.band_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY band_bookings_customer_update ON public.band_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY band_bookings_provider_update ON public.band_bookings FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets(id,name,public) VALUES('band-media','band-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS band_media_read ON storage.objects;
DROP POLICY IF EXISTS band_media_owner ON storage.objects;
CREATE POLICY band_media_read ON storage.objects FOR SELECT USING(bucket_id='band-media');
CREATE POLICY band_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='band-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='band-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['band_packages','band_gallery','band_addons','band_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
