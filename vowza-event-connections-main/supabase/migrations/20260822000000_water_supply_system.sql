-- Water Suppliers package & booking system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Main packages table
CREATE TABLE IF NOT EXISTS public.water_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  package_type text NOT NULL,
  description text,
  -- Pricing
  pricing_type text NOT NULL DEFAULT 'per_can' CHECK (pricing_type IN ('per_can','per_litre','per_tanker','per_event','custom_quote')),
  base_price numeric(12,2) CHECK (base_price >= 0),
  advance_percentage integer DEFAULT 20,
  transportation_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  night_delivery_charges numeric(12,2) DEFAULT 0,
  emergency_delivery_charges numeric(12,2) DEFAULT 0,
  additional_tank_charges numeric(12,2) DEFAULT 0,
  discount_percentage integer DEFAULT 0,
  -- Supply details (JSONB for dynamic fields per package_type)
  supply_details jsonb NOT NULL DEFAULT '{}',
  -- Features
  supply_features text[] NOT NULL DEFAULT '{}',
  -- Availability
  available_cities text[] NOT NULL DEFAULT '{}',
  delivery_radius text,
  available_time_slots text[] NOT NULL DEFAULT '{}',
  max_deliveries_per_day integer DEFAULT 10,
  fleet_capacity text,
  -- Equipment & Delivery
  vehicle_type text,
  delivery_team_size text,
  delivery_time text,
  installation_included boolean DEFAULT false,
  water_dispenser_available boolean DEFAULT false,
  stand_included boolean DEFAULT false,
  cooling_unit_available boolean DEFAULT false,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS water_packages_provider_idx ON public.water_packages(provider_id, status);

-- Gallery
CREATE TABLE IF NOT EXISTS public.water_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.water_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS water_gallery_one_cover ON public.water_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS water_gallery_package_idx ON public.water_gallery(package_id, sort_order);

-- Add-ons
CREATE TABLE IF NOT EXISTS public.water_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.water_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS water_addons_package_idx ON public.water_addons(package_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.water_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.water_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  delivery_time text,
  delivery_address text,
  city text,
  quantity_required text,
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
CREATE INDEX IF NOT EXISTS water_bookings_provider_idx ON public.water_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS water_bookings_customer_idx ON public.water_bookings(customer_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.water_pkg_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS water_packages_updated_at ON public.water_packages;
CREATE TRIGGER water_packages_updated_at BEFORE UPDATE ON public.water_packages FOR EACH ROW EXECUTE FUNCTION public.water_pkg_updated_at();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['water_packages','water_gallery','water_addons','water_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

-- water_packages policies (use existing is_water_supplier or inline check)
DROP POLICY IF EXISTS water_packages_read ON public.water_packages;
DROP POLICY IF EXISTS water_packages_owner ON public.water_packages;
CREATE POLICY water_packages_read ON public.water_packages FOR SELECT USING ((status='active') OR (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())));
CREATE POLICY water_packages_owner ON public.water_packages FOR ALL USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS water_gallery_read ON public.water_gallery;
DROP POLICY IF EXISTS water_gallery_owner ON public.water_gallery;
CREATE POLICY water_gallery_read ON public.water_gallery FOR SELECT USING (true);
CREATE POLICY water_gallery_owner ON public.water_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.water_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.water_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS water_addons_read ON public.water_addons;
DROP POLICY IF EXISTS water_addons_owner ON public.water_addons;
CREATE POLICY water_addons_read ON public.water_addons FOR SELECT USING (true);
CREATE POLICY water_addons_owner ON public.water_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.water_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.water_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS water_bookings_read ON public.water_bookings;
DROP POLICY IF EXISTS water_bookings_customer_insert ON public.water_bookings;
DROP POLICY IF EXISTS water_bookings_customer_update ON public.water_bookings;
DROP POLICY IF EXISTS water_bookings_provider_update ON public.water_bookings;
CREATE POLICY water_bookings_read ON public.water_bookings FOR SELECT USING (customer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));
CREATE POLICY water_bookings_customer_insert ON public.water_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY water_bookings_customer_update ON public.water_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY water_bookings_provider_update ON public.water_bookings FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets(id,name,public) VALUES('water-media','water-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS water_media_read ON storage.objects;
DROP POLICY IF EXISTS water_media_owner ON storage.objects;
CREATE POLICY water_media_read ON storage.objects FOR SELECT USING(bucket_id='water-media');
CREATE POLICY water_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='water-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='water-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['water_packages','water_gallery','water_addons','water_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
