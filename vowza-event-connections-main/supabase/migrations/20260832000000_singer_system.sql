-- Singer packages & booking system
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.singer_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  package_type text,
  description text,
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20,
  performance_duration text,
  number_of_sets text,
  set_duration text,
  break_duration text,
  performance_style text,
  event_types text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  music_styles text[] NOT NULL DEFAULT '{}',
  equipment_included text[] NOT NULL DEFAULT '{}',
  team_members text,
  lead_singer text,
  supporting_vocalist text,
  guitarist text,
  keyboardist text,
  percussionist text,
  deliverables text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS singer_packages_provider_idx ON public.singer_packages(provider_id, status);

CREATE TABLE IF NOT EXISTS public.singer_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.singer_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS singer_gallery_package_idx ON public.singer_gallery(package_id, sort_order);

CREATE TABLE IF NOT EXISTS public.singer_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.singer_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS singer_addons_package_idx ON public.singer_addons(package_id);

CREATE TABLE IF NOT EXISTS public.singer_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.singer_packages(id),
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
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS singer_bookings_provider_idx ON public.singer_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS singer_bookings_customer_idx ON public.singer_bookings(customer_id, created_at DESC);

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['singer_packages','singer_gallery','singer_addons','singer_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS singer_packages_read ON public.singer_packages;
DROP POLICY IF EXISTS singer_packages_owner ON public.singer_packages;
CREATE POLICY singer_packages_read ON public.singer_packages FOR SELECT USING ((status='active') OR (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())));
CREATE POLICY singer_packages_owner ON public.singer_packages FOR ALL USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS singer_gallery_read ON public.singer_gallery;
DROP POLICY IF EXISTS singer_gallery_owner ON public.singer_gallery;
CREATE POLICY singer_gallery_read ON public.singer_gallery FOR SELECT USING (true);
CREATE POLICY singer_gallery_owner ON public.singer_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.singer_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.singer_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS singer_addons_read ON public.singer_addons;
DROP POLICY IF EXISTS singer_addons_owner ON public.singer_addons;
CREATE POLICY singer_addons_read ON public.singer_addons FOR SELECT USING (true);
CREATE POLICY singer_addons_owner ON public.singer_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.singer_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.singer_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS singer_bookings_read ON public.singer_bookings;
DROP POLICY IF EXISTS singer_bookings_customer_insert ON public.singer_bookings;
DROP POLICY IF EXISTS singer_bookings_customer_update ON public.singer_bookings;
DROP POLICY IF EXISTS singer_bookings_provider_update ON public.singer_bookings;
CREATE POLICY singer_bookings_read ON public.singer_bookings FOR SELECT USING (customer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));
CREATE POLICY singer_bookings_customer_insert ON public.singer_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY singer_bookings_customer_update ON public.singer_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY singer_bookings_provider_update ON public.singer_bookings FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

INSERT INTO storage.buckets(id,name,public) VALUES('singer-media','singer-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS singer_media_read ON storage.objects;
DROP POLICY IF EXISTS singer_media_owner ON storage.objects;
CREATE POLICY singer_media_read ON storage.objects FOR SELECT USING(bucket_id='singer-media');
CREATE POLICY singer_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='singer-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='singer-media' AND auth.uid()::text=(storage.foldername(name))[1]);

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['singer_packages','singer_gallery','singer_addons','singer_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
