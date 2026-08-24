-- Photographer-only package commerce. Idempotent: safe on fresh and existing databases.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_photographer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text='photographer'); $$;
CREATE OR REPLACE FUNCTION public.owns_photographer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text='photographer'); $$;

CREATE TABLE IF NOT EXISTS public.photography_packages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), photographer_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE, name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120), description text, price numeric(12,2) NOT NULL CHECK(price>=0), duration text, album_included boolean NOT NULL DEFAULT false, album_details text, travel_included boolean NOT NULL DEFAULT false, travel_details text, is_active boolean NOT NULL DEFAULT true, is_visible boolean NOT NULL DEFAULT true, view_count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.photography_package_images (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.photography_packages(id) ON DELETE CASCADE, storage_path text NOT NULL, public_url text NOT NULL, alt_text text, is_cover boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.photography_package_highlights (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.photography_packages(id) ON DELETE CASCADE, text text NOT NULL, sort_order integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS public.photography_package_addons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.photography_packages(id) ON DELETE CASCADE, name text NOT NULL, description text, price numeric(12,2) NOT NULL CHECK(price>=0), is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS public.photography_package_bookings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.photography_packages(id), photographer_id uuid NOT NULL REFERENCES public.provider_profiles(id), customer_id uuid NOT NULL REFERENCES public.profiles(id), event_date date NOT NULL, event_time text, venue text, notes text, selected_addon_ids uuid[] NOT NULL DEFAULT '{}', base_amount numeric(12,2) NOT NULL, addons_amount numeric(12,2) NOT NULL DEFAULT 0, total_amount numeric(12,2) NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.photography_package_reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.photography_packages(id) ON DELETE CASCADE, booking_id uuid NOT NULL UNIQUE REFERENCES public.photography_package_bookings(id) ON DELETE CASCADE, customer_id uuid NOT NULL REFERENCES public.profiles(id), rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5), review_text text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.photographer_availability (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), photographer_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE, available_date date NOT NULL, is_available boolean NOT NULL DEFAULT true, note text, UNIQUE(photographer_id,available_date));
CREATE UNIQUE INDEX IF NOT EXISTS photography_package_one_cover ON public.photography_package_images(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS photography_packages_photographer_idx ON public.photography_packages(photographer_id,is_active,is_visible);
CREATE INDEX IF NOT EXISTS photography_bookings_photographer_idx ON public.photography_package_bookings(photographer_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.photography_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT public.is_photographer(NEW.photographer_id) THEN RAISE EXCEPTION 'Photography package data is restricted to photographer providers'; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.photography_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS photography_package_guard ON public.photography_packages;
CREATE TRIGGER photography_package_guard BEFORE INSERT OR UPDATE OF photographer_id ON public.photography_packages FOR EACH ROW EXECUTE FUNCTION public.photography_guard();
DROP TRIGGER IF EXISTS photography_availability_guard ON public.photographer_availability;
CREATE TRIGGER photography_availability_guard BEFORE INSERT OR UPDATE OF photographer_id ON public.photographer_availability FOR EACH ROW EXECUTE FUNCTION public.photography_guard();
DROP TRIGGER IF EXISTS photography_packages_updated_at ON public.photography_packages;
CREATE TRIGGER photography_packages_updated_at BEFORE UPDATE ON public.photography_packages FOR EACH ROW EXECUTE FUNCTION public.photography_updated_at();

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['photography_packages','photography_package_images','photography_package_highlights','photography_package_addons','photography_package_bookings','photography_package_reviews','photographer_availability'] LOOP IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF; END LOOP; END $$;

DROP POLICY IF EXISTS photography_packages_read ON public.photography_packages;
DROP POLICY IF EXISTS photography_packages_owner ON public.photography_packages;
DROP POLICY IF EXISTS photography_images_read ON public.photography_package_images;
DROP POLICY IF EXISTS photography_images_owner ON public.photography_package_images;
DROP POLICY IF EXISTS photography_highlights_read ON public.photography_package_highlights;
DROP POLICY IF EXISTS photography_highlights_owner ON public.photography_package_highlights;
DROP POLICY IF EXISTS photography_addons_read ON public.photography_package_addons;
DROP POLICY IF EXISTS photography_addons_owner ON public.photography_package_addons;
DROP POLICY IF EXISTS photography_availability_read ON public.photographer_availability;
DROP POLICY IF EXISTS photography_availability_owner ON public.photographer_availability;
DROP POLICY IF EXISTS photography_bookings_read ON public.photography_package_bookings;
DROP POLICY IF EXISTS photography_reviews_read ON public.photography_package_reviews;
DROP POLICY IF EXISTS photography_reviews_create ON public.photography_package_reviews;
CREATE POLICY photography_packages_read ON public.photography_packages FOR SELECT USING ((is_active AND is_visible) OR public.owns_photographer(photographer_id));
CREATE POLICY photography_packages_owner ON public.photography_packages FOR ALL USING(public.owns_photographer(photographer_id)) WITH CHECK(public.owns_photographer(photographer_id));
CREATE POLICY photography_images_read ON public.photography_package_images FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND ((p.is_active AND p.is_visible) OR public.owns_photographer(p.photographer_id))));
CREATE POLICY photography_images_owner ON public.photography_package_images FOR ALL USING(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id)));
CREATE POLICY photography_highlights_read ON public.photography_package_highlights FOR SELECT USING(true);
CREATE POLICY photography_highlights_owner ON public.photography_package_highlights FOR ALL USING(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id)));
CREATE POLICY photography_addons_read ON public.photography_package_addons FOR SELECT USING(true);
CREATE POLICY photography_addons_owner ON public.photography_package_addons FOR ALL USING(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id)));
CREATE POLICY photography_availability_read ON public.photographer_availability FOR SELECT USING(true);
CREATE POLICY photography_availability_owner ON public.photographer_availability FOR ALL USING(public.owns_photographer(photographer_id)) WITH CHECK(public.owns_photographer(photographer_id));
CREATE POLICY photography_bookings_read ON public.photography_package_bookings FOR SELECT USING(customer_id=auth.uid() OR public.owns_photographer(photographer_id));
CREATE POLICY photography_reviews_read ON public.photography_package_reviews FOR SELECT USING(true);
CREATE POLICY photography_reviews_create ON public.photography_package_reviews FOR INSERT WITH CHECK(customer_id=auth.uid() AND EXISTS(SELECT 1 FROM public.photography_package_bookings b WHERE b.id=booking_id AND b.customer_id=auth.uid() AND b.status='completed'));

INSERT INTO storage.buckets(id,name,public) VALUES('photography-package-images','photography-package-images',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS photography_storage_read ON storage.objects;
DROP POLICY IF EXISTS photography_storage_owner ON storage.objects;
CREATE POLICY photography_storage_read ON storage.objects FOR SELECT USING(bucket_id='photography-package-images');
CREATE POLICY photography_storage_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='photography-package-images' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='photography-package-images' AND auth.uid()::text=(storage.foldername(name))[1]);

CREATE OR REPLACE FUNCTION public.create_photography_package_booking(p_package_id uuid,p_event_date date,p_event_time text DEFAULT NULL,p_venue text DEFAULT NULL,p_notes text DEFAULT NULL,p_addon_ids uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p record; addon_total numeric:=0; booking_id uuid; BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF; SELECT * INTO p FROM public.photography_packages WHERE id=p_package_id AND is_active AND is_visible FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Package is unavailable'; END IF; IF EXISTS(SELECT 1 FROM public.photographer_availability WHERE photographer_id=p.photographer_id AND available_date=p_event_date AND NOT is_available) THEN RAISE EXCEPTION 'Photographer is unavailable on this date'; END IF; SELECT coalesce(sum(price),0) INTO addon_total FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(p_addon_ids) AND is_active; IF (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(p_addon_ids) AND is_active) <> coalesce(array_length(p_addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF; INSERT INTO public.photography_package_bookings(package_id,photographer_id,customer_id,event_date,event_time,venue,notes,selected_addon_ids,base_amount,addons_amount,total_amount) VALUES(p.id,p.photographer_id,auth.uid(),p_event_date,p_event_time,nullif(trim(p_venue),''),nullif(trim(p_notes),''),p_addon_ids,p.price,addon_total,p.price+addon_total) RETURNING id INTO booking_id; RETURN booking_id; END $$;
GRANT EXECUTE ON FUNCTION public.create_photography_package_booking(uuid,date,text,text,text,uuid[]) TO authenticated;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['photography_packages','photography_package_images','photography_package_highlights','photography_package_addons','photography_package_reviews','photography_package_bookings','photographer_availability'] LOOP IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF; END LOOP; END $$;
