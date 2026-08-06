-- Photographer-only optional albums and image ordering. Safe to apply repeatedly.
CREATE TABLE IF NOT EXISTS public.photography_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.photography_packages(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (char_length(trim(type)) BETWEEN 1 AND 120),
  size text NOT NULL CHECK (char_length(trim(size)) BETWEEN 1 AND 80),
  pages integer NOT NULL CHECK (pages > 0),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photography_albums_package_active_idx ON public.photography_albums(package_id, is_active, sort_order);
ALTER TABLE public.photography_albums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS photography_albums_read ON public.photography_albums;
DROP POLICY IF EXISTS photography_albums_owner ON public.photography_albums;
CREATE POLICY photography_albums_read ON public.photography_albums FOR SELECT USING (EXISTS (SELECT 1 FROM public.photography_packages p WHERE p.id = package_id AND ((p.is_active AND p.is_visible AND p.status = 'published') OR public.owns_photographer(p.photographer_id))));
CREATE POLICY photography_albums_owner ON public.photography_albums FOR ALL USING (EXISTS (SELECT 1 FROM public.photography_packages p WHERE p.id = package_id AND public.owns_photographer(p.photographer_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.photography_packages p WHERE p.id = package_id AND public.owns_photographer(p.photographer_id)));

-- Preserve legacy included-album data as a selectable, zero-cost option; no package price changes.
INSERT INTO public.photography_albums(package_id, type, size, pages, price, is_active, sort_order)
SELECT p.id, COALESCE(NULLIF(trim(p.album_type), ''), 'Album'), COALESCE(NULLIF(trim(p.album_size), ''), 'Standard'), COALESCE(p.album_pages, 20), 0, true, 0
FROM public.photography_packages p
WHERE p.album_included AND NOT EXISTS (SELECT 1 FROM public.photography_albums a WHERE a.package_id = p.id);

ALTER TABLE public.photography_cart_items ADD COLUMN IF NOT EXISTS album_id uuid REFERENCES public.photography_albums(id) ON DELETE SET NULL;
ALTER TABLE public.photography_package_bookings ADD COLUMN IF NOT EXISTS selected_album_id uuid REFERENCES public.photography_albums(id) ON DELETE SET NULL;
ALTER TABLE public.photography_package_bookings ADD COLUMN IF NOT EXISTS album_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (album_amount >= 0);
ALTER TABLE public.photography_package_bookings ADD COLUMN IF NOT EXISTS selected_album_details jsonb;
CREATE INDEX IF NOT EXISTS photography_cart_items_album_idx ON public.photography_cart_items(album_id);

-- Replace the earlier two-argument RPC so all client calls use this album-aware implementation.
DROP FUNCTION IF EXISTS public.add_photography_cart_item(uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.add_photography_cart_item(p_package_id uuid, p_addon_ids uuid[] DEFAULT '{}', p_album_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.photography_packages%ROWTYPE; v_cart_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO p FROM public.photography_packages WHERE id=p_package_id AND is_active AND is_visible AND status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Package is unavailable'; END IF;
  IF p_album_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.photography_albums WHERE id=p_album_id AND package_id=p.id AND is_active) THEN RAISE EXCEPTION 'The selected album is unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.photography_package_addons WHERE id=ANY(p_addon_ids) AND package_id<>p.id) OR (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(p_addon_ids) AND is_active) <> coalesce(array_length(p_addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF;
  INSERT INTO public.photography_carts(customer_id, photographer_id) VALUES(auth.uid(),p.photographer_id) ON CONFLICT (customer_id,photographer_id) WHERE status='active' DO UPDATE SET updated_at=now() RETURNING id INTO v_cart_id;
  INSERT INTO public.photography_cart_items(cart_id,package_id,addon_ids,album_id) VALUES(v_cart_id,p.id,p_addon_ids,p_album_id) ON CONFLICT(cart_id,package_id) DO UPDATE SET addon_ids=EXCLUDED.addon_ids, album_id=EXCLUDED.album_id;
  RETURN v_cart_id;
END $$;

CREATE OR REPLACE FUNCTION public.checkout_photography_cart(p_cart_id uuid, p_event_date date, p_event_time text DEFAULT NULL, p_venue text DEFAULT NULL, p_notes text DEFAULT NULL) RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.photography_carts%ROWTYPE; item record; p public.photography_packages%ROWTYPE; v_addons numeric; v_album public.photography_albums%ROWTYPE; v_booking uuid; v_bookings uuid[] := '{}'; v_provider_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO c FROM public.photography_carts WHERE id=p_cart_id AND customer_id=auth.uid() AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active photography cart not found'; END IF;
  FOR item IN SELECT * FROM public.photography_cart_items WHERE cart_id=c.id LOOP
    v_album := NULL;
    SELECT * INTO p FROM public.photography_packages WHERE id=item.package_id AND photographer_id=c.photographer_id AND is_active AND is_visible AND status='published' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A package is no longer available'; END IF;
    IF EXISTS(SELECT 1 FROM public.photographer_availability WHERE photographer_id=p.photographer_id AND available_date=p_event_date AND NOT is_available) THEN RAISE EXCEPTION 'Photographer is unavailable on this date'; END IF;
    SELECT coalesce(sum(price),0) INTO v_addons FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(item.addon_ids) AND is_active;
    IF (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(item.addon_ids) AND is_active) <> coalesce(array_length(item.addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF;
    IF item.album_id IS NOT NULL THEN SELECT * INTO v_album FROM public.photography_albums WHERE id=item.album_id AND package_id=p.id AND is_active; IF NOT FOUND THEN RAISE EXCEPTION 'The selected album is unavailable'; END IF; END IF;
    INSERT INTO public.photography_package_bookings(package_id,photographer_id,customer_id,event_date,event_time,venue,notes,selected_addon_ids,selected_album_id,selected_album_details,base_amount,addons_amount,album_amount,total_amount) VALUES(p.id,p.photographer_id,auth.uid(),p_event_date,p_event_time,nullif(trim(p_venue),''),nullif(trim(p_notes),''),item.addon_ids,item.album_id,CASE WHEN item.album_id IS NULL THEN NULL ELSE jsonb_build_object('type',v_album.type,'size',v_album.size,'pages',v_album.pages,'price',v_album.price) END,p.price,v_addons,coalesce(v_album.price,0),p.price+v_addons+coalesce(v_album.price,0)) RETURNING id INTO v_booking;
    INSERT INTO public.photography_package_payments(booking_id,amount) VALUES(v_booking,p.price+v_addons+coalesce(v_album.price,0));
    INSERT INTO public.photography_package_invoices(booking_id,invoice_number,amount) VALUES(v_booking,'PH-' || upper(replace(v_booking::text,'-','')),p.price+v_addons+coalesce(v_album.price,0));
    INSERT INTO public.photography_booking_timeline(booking_id,actor_id,event_type,message) VALUES(v_booking,auth.uid(),'booking_requested','Photography booking requested');
    SELECT user_id INTO v_provider_user FROM public.provider_profiles WHERE id=p.photographer_id;
    INSERT INTO public.notifications(user_id,title,message,type,reference_id) VALUES (auth.uid(),'Photography booking requested','Your photography booking request was created.','booking',v_booking),(v_provider_user,'New photography booking','You have a new photography package booking request.','booking',v_booking);
    v_bookings := array_append(v_bookings,v_booking);
  END LOOP;
  IF coalesce(array_length(v_bookings,1),0)=0 THEN RAISE EXCEPTION 'Your photography cart is empty'; END IF;
  UPDATE public.photography_carts SET status='checked_out' WHERE id=c.id;
  RETURN v_bookings;
END $$;
GRANT EXECUTE ON FUNCTION public.add_photography_cart_item(uuid,uuid[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_photography_cart(uuid,date,text,text,text) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='photography_albums') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.photography_albums; END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
