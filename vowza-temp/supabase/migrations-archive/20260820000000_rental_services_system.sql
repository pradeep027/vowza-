-- Rental Services category system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Category gate functions
CREATE OR REPLACE FUNCTION public.is_rental_service(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('rental','rentals','rental_services','tent_house','shamiana','stage_rental','furniture_rental','generator_rental','sound_rental','lighting_rental','equipment_rental'));
$$;
CREATE OR REPLACE FUNCTION public.owns_rental_service(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('rental','rentals','rental_services','tent_house','shamiana','stage_rental','furniture_rental','generator_rental','sound_rental','lighting_rental','equipment_rental'));
$$;

-- Main packages table
CREATE TABLE IF NOT EXISTS public.rental_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  package_type text NOT NULL,
  description text,
  -- Pricing
  rental_type text NOT NULL DEFAULT 'per_event' CHECK (rental_type IN ('per_event','per_day','per_hour','package_price')),
  price numeric(12,2) CHECK (price >= 0),
  advance_percentage integer DEFAULT 20,
  security_deposit numeric(12,2) DEFAULT 0,
  transportation_charges numeric(12,2) DEFAULT 0,
  installation_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  extra_hour_charges numeric(12,2) DEFAULT 0,
  late_return_charges numeric(12,2) DEFAULT 0,
  -- Dynamic rental details (JSONB for flexibility per package_type)
  rental_details jsonb NOT NULL DEFAULT '{}',
  -- Included items
  included_items text[] NOT NULL DEFAULT '{}',
  -- Availability
  inventory_quantity integer DEFAULT 1,
  available_units integer DEFAULT 1,
  delivery_radius text,
  available_cities text[] NOT NULL DEFAULT '{}',
  -- Delivery & Setup
  setup_time text,
  delivery_time text,
  pickup_time text,
  installation_team text,
  support_contact text,
  emergency_contact text,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rental_packages_provider_idx ON public.rental_packages(provider_id, status);

-- Gallery
CREATE TABLE IF NOT EXISTS public.rental_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.rental_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video','setup')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rental_gallery_one_cover ON public.rental_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS rental_gallery_package_idx ON public.rental_gallery(package_id, sort_order);

-- Add-ons
CREATE TABLE IF NOT EXISTS public.rental_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.rental_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rental_addons_package_idx ON public.rental_addons(package_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.rental_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.rental_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  rental_duration text,
  delivery_address text,
  city text,
  quantity_required integer NOT NULL DEFAULT 1,
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
  inventory_reserved boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rental_bookings_provider_idx ON public.rental_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rental_bookings_customer_idx ON public.rental_bookings(customer_id, created_at DESC);

-- Inventory management: decrement on confirm, increment on cancel/complete
CREATE OR REPLACE FUNCTION public.rental_inventory_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- On status change to confirmed → reserve inventory
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' AND NOT NEW.inventory_reserved THEN
    UPDATE public.rental_packages SET available_units = GREATEST(available_units - NEW.quantity_required, 0) WHERE id = NEW.package_id;
    NEW.inventory_reserved := true;
  END IF;
  -- On cancel/complete after reservation → release inventory
  IF NEW.status IN ('cancelled', 'completed') AND OLD.inventory_reserved AND OLD.status NOT IN ('cancelled', 'completed') THEN
    UPDATE public.rental_packages SET available_units = LEAST(available_units + OLD.quantity_required, inventory_quantity) WHERE id = NEW.package_id;
    NEW.inventory_reserved := false;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rental_inventory_trigger ON public.rental_bookings;
CREATE TRIGGER rental_inventory_trigger BEFORE UPDATE ON public.rental_bookings FOR EACH ROW EXECUTE FUNCTION public.rental_inventory_update();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.rental_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS rental_packages_updated_at ON public.rental_packages;
CREATE TRIGGER rental_packages_updated_at BEFORE UPDATE ON public.rental_packages FOR EACH ROW EXECUTE FUNCTION public.rental_updated_at();

-- Category guard trigger
CREATE OR REPLACE FUNCTION public.rental_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_rental_service(NEW.provider_id) THEN RAISE EXCEPTION 'Rental data restricted to rental service providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS rental_package_guard ON public.rental_packages;
CREATE TRIGGER rental_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.rental_packages FOR EACH ROW EXECUTE FUNCTION public.rental_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['rental_packages','rental_gallery','rental_addons','rental_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

-- rental_packages policies
DROP POLICY IF EXISTS rental_packages_read ON public.rental_packages;
DROP POLICY IF EXISTS rental_packages_owner ON public.rental_packages;
CREATE POLICY rental_packages_read ON public.rental_packages FOR SELECT USING ((status='active') OR public.owns_rental_service(provider_id));
CREATE POLICY rental_packages_owner ON public.rental_packages FOR ALL USING (public.owns_rental_service(provider_id)) WITH CHECK (public.owns_rental_service(provider_id));

-- rental_gallery policies
DROP POLICY IF EXISTS rental_gallery_read ON public.rental_gallery;
DROP POLICY IF EXISTS rental_gallery_owner ON public.rental_gallery;
CREATE POLICY rental_gallery_read ON public.rental_gallery FOR SELECT USING (true);
CREATE POLICY rental_gallery_owner ON public.rental_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.rental_packages p WHERE p.id=package_id AND public.owns_rental_service(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.rental_packages p WHERE p.id=package_id AND public.owns_rental_service(p.provider_id)));

-- rental_addons policies
DROP POLICY IF EXISTS rental_addons_read ON public.rental_addons;
DROP POLICY IF EXISTS rental_addons_owner ON public.rental_addons;
CREATE POLICY rental_addons_read ON public.rental_addons FOR SELECT USING (true);
CREATE POLICY rental_addons_owner ON public.rental_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.rental_packages p WHERE p.id=package_id AND public.owns_rental_service(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.rental_packages p WHERE p.id=package_id AND public.owns_rental_service(p.provider_id)));

-- rental_bookings policies
DROP POLICY IF EXISTS rental_bookings_read ON public.rental_bookings;
DROP POLICY IF EXISTS rental_bookings_customer_insert ON public.rental_bookings;
DROP POLICY IF EXISTS rental_bookings_customer_update ON public.rental_bookings;
DROP POLICY IF EXISTS rental_bookings_provider_update ON public.rental_bookings;
CREATE POLICY rental_bookings_read ON public.rental_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_rental_service(provider_id));
CREATE POLICY rental_bookings_customer_insert ON public.rental_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY rental_bookings_customer_update ON public.rental_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY rental_bookings_provider_update ON public.rental_bookings FOR UPDATE TO authenticated USING (public.owns_rental_service(provider_id)) WITH CHECK (public.owns_rental_service(provider_id));

-- Storage bucket
INSERT INTO storage.buckets(id,name,public) VALUES('rental-media','rental-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS rental_media_read ON storage.objects;
DROP POLICY IF EXISTS rental_media_owner ON storage.objects;
CREATE POLICY rental_media_read ON storage.objects FOR SELECT USING(bucket_id='rental-media');
CREATE POLICY rental_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='rental-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='rental-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['rental_packages','rental_gallery','rental_addons','rental_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
