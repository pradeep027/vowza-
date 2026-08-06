-- Photographer package/cart upgrade. Idempotent and isolated from all other categories.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Structured package fields; legacy columns remain so existing packages and bookings continue to work.
ALTER TABLE public.photography_packages
  ADD COLUMN IF NOT EXISTS photography_type text,
  ADD COLUMN IF NOT EXISTS team_size integer,
  ADD COLUMN IF NOT EXISTS team_size_custom integer,
  ADD COLUMN IF NOT EXISTS edited_photos integer,
  ADD COLUMN IF NOT EXISTS raw_photos_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS album_type text,
  ADD COLUMN IF NOT EXISTS album_size text,
  ADD COLUMN IF NOT EXISTS album_pages integer,
  ADD COLUMN IF NOT EXISTS travel_radius_km numeric(8,2),
  ADD COLUMN IF NOT EXISTS travel_extra_charge numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_time text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- Existing live packages remain customer-visible after status is introduced.
UPDATE public.photography_packages
SET status = 'published'
WHERE status = 'draft' AND is_active AND is_visible;

ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_status_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_status_check CHECK (status IN ('draft', 'published', 'archived'));
ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_team_size_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_team_size_check CHECK (team_size IS NULL OR team_size > 0);
ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_team_size_custom_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_team_size_custom_check CHECK (team_size_custom IS NULL OR team_size_custom > 0);
ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_edited_photos_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_edited_photos_check CHECK (edited_photos IS NULL OR edited_photos >= 0);
ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_album_pages_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_album_pages_check CHECK (album_pages IS NULL OR album_pages > 0);
ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_travel_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_travel_check CHECK ((travel_radius_km IS NULL OR travel_radius_km >= 0) AND (travel_extra_charge IS NULL OR travel_extra_charge >= 0));
CREATE INDEX IF NOT EXISTS photography_packages_public_idx ON public.photography_packages (photographer_id, status, is_active, is_visible);

CREATE TABLE IF NOT EXISTS public.photography_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photographer_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','checked_out','abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.photography_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cart_id uuid NOT NULL REFERENCES public.photography_carts(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.photography_packages(id), addon_ids uuid[] NOT NULL DEFAULT '{}', quantity integer NOT NULL DEFAULT 1 CHECK(quantity > 0), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cart_id, package_id)
);
CREATE TABLE IF NOT EXISTS public.photography_package_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL UNIQUE REFERENCES public.photography_package_bookings(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK(amount >= 0), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','refunded')), payment_method text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.photography_package_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL UNIQUE REFERENCES public.photography_package_bookings(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE, amount numeric(12,2) NOT NULL CHECK(amount >= 0), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','void')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.photography_booking_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES public.photography_package_bookings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, event_type text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photography_carts_customer_idx ON public.photography_carts(customer_id, status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS photography_active_cart_provider_idx ON public.photography_carts(customer_id, photographer_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS photography_cart_items_cart_idx ON public.photography_cart_items(cart_id);
CREATE INDEX IF NOT EXISTS photography_timeline_booking_idx ON public.photography_booking_timeline(booking_id, created_at);

CREATE OR REPLACE FUNCTION public.photography_cart_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS photography_carts_updated_at ON public.photography_carts;
CREATE TRIGGER photography_carts_updated_at BEFORE UPDATE ON public.photography_carts FOR EACH ROW EXECUTE FUNCTION public.photography_cart_updated_at();
CREATE OR REPLACE FUNCTION public.photography_cart_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.is_photographer(NEW.photographer_id) THEN RAISE EXCEPTION 'Photography carts are restricted to photographer providers'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS photography_cart_guard ON public.photography_carts;
CREATE TRIGGER photography_cart_guard BEFORE INSERT OR UPDATE OF photographer_id ON public.photography_carts FOR EACH ROW EXECUTE FUNCTION public.photography_cart_guard();

ALTER TABLE public.photography_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photography_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photography_booking_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS photography_carts_customer ON public.photography_carts;
DROP POLICY IF EXISTS photography_carts_provider ON public.photography_carts;
DROP POLICY IF EXISTS photography_cart_items_customer ON public.photography_cart_items;
DROP POLICY IF EXISTS photography_cart_items_provider ON public.photography_cart_items;
DROP POLICY IF EXISTS photography_payments_read ON public.photography_package_payments;
DROP POLICY IF EXISTS photography_invoices_read ON public.photography_package_invoices;
DROP POLICY IF EXISTS photography_timeline_read ON public.photography_booking_timeline;
CREATE POLICY photography_carts_customer ON public.photography_carts FOR SELECT USING(customer_id = auth.uid());
CREATE POLICY photography_carts_provider ON public.photography_carts FOR SELECT USING(public.owns_photographer(photographer_id));
CREATE POLICY photography_cart_items_customer ON public.photography_cart_items FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_carts c WHERE c.id=cart_id AND c.customer_id=auth.uid()));
CREATE POLICY photography_cart_items_provider ON public.photography_cart_items FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_carts c WHERE c.id=cart_id AND public.owns_photographer(c.photographer_id)));
CREATE POLICY photography_payments_read ON public.photography_package_payments FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_package_bookings b WHERE b.id=booking_id AND (b.customer_id=auth.uid() OR public.owns_photographer(b.photographer_id))));
CREATE POLICY photography_invoices_read ON public.photography_package_invoices FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_package_bookings b WHERE b.id=booking_id AND (b.customer_id=auth.uid() OR public.owns_photographer(b.photographer_id))));
CREATE POLICY photography_timeline_read ON public.photography_booking_timeline FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_package_bookings b WHERE b.id=booking_id AND (b.customer_id=auth.uid() OR public.owns_photographer(b.photographer_id))));

CREATE OR REPLACE FUNCTION public.add_photography_cart_item(p_package_id uuid, p_addon_ids uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.photography_packages%ROWTYPE; v_cart_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO p FROM public.photography_packages WHERE id=p_package_id AND is_active AND is_visible AND status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Package is unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.photography_package_addons WHERE id=ANY(p_addon_ids) AND package_id<>p.id) OR (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(p_addon_ids) AND is_active) <> coalesce(array_length(p_addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF;
  INSERT INTO public.photography_carts(customer_id, photographer_id) VALUES(auth.uid(),p.photographer_id) ON CONFLICT (customer_id,photographer_id) WHERE status='active' DO UPDATE SET updated_at=now() RETURNING id INTO v_cart_id;
  INSERT INTO public.photography_cart_items(cart_id,package_id,addon_ids) VALUES(v_cart_id,p.id,p_addon_ids) ON CONFLICT(cart_id,package_id) DO UPDATE SET addon_ids=EXCLUDED.addon_ids;
  RETURN v_cart_id;
END $$;

CREATE OR REPLACE FUNCTION public.checkout_photography_cart(p_cart_id uuid, p_event_date date, p_event_time text DEFAULT NULL, p_venue text DEFAULT NULL, p_notes text DEFAULT NULL) RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.photography_carts%ROWTYPE; item record; p public.photography_packages%ROWTYPE; v_addons numeric; v_booking uuid; v_bookings uuid[] := '{}'; v_provider_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO c FROM public.photography_carts WHERE id=p_cart_id AND customer_id=auth.uid() AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active photography cart not found'; END IF;
  FOR item IN SELECT * FROM public.photography_cart_items WHERE cart_id=c.id LOOP
    SELECT * INTO p FROM public.photography_packages WHERE id=item.package_id AND photographer_id=c.photographer_id AND is_active AND is_visible AND status='published' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A package is no longer available'; END IF;
    IF EXISTS(SELECT 1 FROM public.photographer_availability WHERE photographer_id=p.photographer_id AND available_date=p_event_date AND NOT is_available) THEN RAISE EXCEPTION 'Photographer is unavailable on this date'; END IF;
    SELECT coalesce(sum(price),0) INTO v_addons FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(item.addon_ids) AND is_active;
    IF (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(item.addon_ids) AND is_active) <> coalesce(array_length(item.addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF;
    INSERT INTO public.photography_package_bookings(package_id,photographer_id,customer_id,event_date,event_time,venue,notes,selected_addon_ids,base_amount,addons_amount,total_amount) VALUES(p.id,p.photographer_id,auth.uid(),p_event_date,p_event_time,nullif(trim(p_venue),''),nullif(trim(p_notes),''),item.addon_ids,p.price,v_addons,p.price+v_addons) RETURNING id INTO v_booking;
    INSERT INTO public.photography_package_payments(booking_id,amount) VALUES(v_booking,p.price+v_addons);
    INSERT INTO public.photography_package_invoices(booking_id,invoice_number,amount) VALUES(v_booking,'PH-' || upper(replace(v_booking::text,'-','')),p.price+v_addons);
    INSERT INTO public.photography_booking_timeline(booking_id,actor_id,event_type,message) VALUES(v_booking,auth.uid(),'booking_requested','Photography booking requested');
    SELECT user_id INTO v_provider_user FROM public.provider_profiles WHERE id=p.photographer_id;
    INSERT INTO public.notifications(user_id,title,message,type,reference_id) VALUES (auth.uid(),'Photography booking requested','Your photography booking request was created.','booking',v_booking::text),(v_provider_user,'New photography booking','You have a new photography package booking request.','booking',v_booking::text);
    v_bookings := array_append(v_bookings,v_booking);
  END LOOP;
  IF coalesce(array_length(v_bookings,1),0)=0 THEN RAISE EXCEPTION 'Your photography cart is empty'; END IF;
  UPDATE public.photography_carts SET status='checked_out' WHERE id=c.id;
  RETURN v_bookings;
END $$;
GRANT EXECUTE ON FUNCTION public.add_photography_cart_item(uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_photography_cart(uuid,date,text,text,text) TO authenticated;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['photography_carts','photography_cart_items','photography_package_payments','photography_package_invoices','photography_booking_timeline'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
