-- Fix: remove ::text cast from v_booking when inserting into notifications.reference_id (uuid column)
-- This caused: "column reference_id is of type uuid but expression is of type text"

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

GRANT EXECUTE ON FUNCTION public.checkout_photography_cart(uuid,date,text,text,text) TO authenticated;
