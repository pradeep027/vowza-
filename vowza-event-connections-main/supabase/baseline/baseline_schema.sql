--
-- PostgreSQL database dump
--

\restrict k3chUfUSfaP0SrANjhhcTi0bZe2JbLSVFueGA9n0vmKSS4hYL29IHSTA7OfXMdK

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "auth";


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "storage";


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."app_role" AS ENUM (
    'customer',
    'provider',
    'admin',
    'super_admin'
);


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."booking_status" AS ENUM (
    'requested',
    'accepted',
    'in_progress',
    'completed',
    'cancelled',
    'rejected'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'paid',
    'refunded',
    'failed'
);


--
-- Name: profession_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."profession_type" AS ENUM (
    'music_band',
    'traditional_band',
    'maharashtra_band',
    'dj',
    'singer',
    'instrumental_artist',
    'classical_musician',
    'photographer',
    'videographer',
    'cinematographer',
    'drone_operator',
    'dancer',
    'choreographer',
    'kuchipudi_dancer',
    'classical_dancer',
    'western_dancer',
    'event_decorator',
    'wedding_decorator',
    'stage_decorator',
    'makeup_artist',
    'mehendi_artist',
    'anchor',
    'host',
    'magician',
    'stand_up_comedian',
    'celebrity_artist',
    'live_performer',
    'folk_artist',
    'lighting_services',
    'sound_services',
    'event_planner',
    'wedding_planner',
    'catering_services',
    'event_support',
    'banquet_hall',
    'pandit',
    'water_supplier',
    'rentals',
    'wedding_band',
    'dhol_band',
    'brass_band',
    'photography_videography'
);


--
-- Name: verification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."verification_status" AS ENUM (
    'pending',
    'under_review',
    'approved',
    'rejected'
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION "email"(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION "role"(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION "uid"(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: add_artist_to_event("uuid", "uuid", "text", "text", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."add_artist_to_event"("p_event_id" "uuid", "p_provider_id" "uuid", "p_provider_name" "text", "p_category" "text", "p_price" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  INSERT INTO public.artist_bookings (
    event_id,
    provider_id,
    provider_name,
    category,
    price
  ) VALUES (
    p_event_id,
    p_provider_id,
    p_provider_name,
    p_category,
    p_price
  ) RETURNING id INTO v_booking_id;
  
  RETURN v_booking_id;
END;
$$;


--
-- Name: add_photography_cart_item("uuid", "uuid"[], "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."add_photography_cart_item"("p_package_id" "uuid", "p_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[], "p_album_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


--
-- Name: anchor_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."anchor_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_anchor(NEW.provider_id) THEN RAISE EXCEPTION 'Anchor data restricted to anchor/host providers'; END IF; RETURN NEW; END $$;


--
-- Name: anchor_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."anchor_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: approve_artist("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."approve_artist"("p_provider_id" "uuid", "p_admin_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get artist user_id
  SELECT user_id INTO v_user_id
  FROM public.provider_profiles
  WHERE id = p_provider_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Provider not found');
  END IF;

  -- Update status
  UPDATE public.provider_profiles SET
    verification_status = 'approved',
    is_published        = TRUE,
    is_verified         = TRUE,
    verified_at         = NOW(),
    verified_by         = p_admin_user_id,
    rejection_reason    = NULL
  WHERE id = p_provider_id;

  -- Assign provider role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'provider')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Notify artist
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_user_id,
    'Account Approved',
    'Congratulations! Your artist account has been approved. You can now receive bookings.',
    'approval',
    p_provider_id::TEXT,
    FALSE
  );

  RETURN jsonb_build_object('success', true, 'message', 'approved');
END;
$$;


--
-- Name: assert_service_start_is_due("text", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assert_service_start_is_due"("p_booking_table" "text", "p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
DECLARE
  v_time_column TEXT;
  v_event_date DATE;
  v_event_time TEXT;
  v_event_start_at TIMESTAMPTZ;
BEGIN
  IF p_booking_table NOT IN (
    'bookings', 'photography_package_bookings', 'catering_bookings',
    'drone_bookings', 'videography_bookings', 'dj_bookings',
    'decorator_bookings', 'makeup_bookings', 'mehendi_bookings',
    'anchor_bookings', 'banquet_bookings', 'rental_bookings',
    'priest_bookings', 'water_bookings', 'band_bookings',
    'singer_bookings', 'dancer_bookings'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_BOOKING_SOURCE';
  END IF;

  v_time_column := CASE
    WHEN p_booking_table = 'water_bookings' THEN 'delivery_time'
    ELSE 'event_time'
  END;

  -- A time is mandatory for secure start-time enforcement. Catering currently
  -- has no event_time column, so it is rejected until its schedule is captured.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_booking_table
      AND column_name = v_time_column
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_TIME_REQUIRED';
  END IF;

  EXECUTE format(
    'SELECT b.event_date, NULLIF(btrim(b.%1$I::text), '''')
     FROM public.%2$I AS b
     WHERE b.id = $1',
    v_time_column,
    p_booking_table
  ) INTO v_event_date, v_event_time USING p_booking_id;

  IF v_event_date IS NULL OR v_event_time IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_TIME_REQUIRED';
  END IF;

  BEGIN
    v_event_start_at := (v_event_date::text || ' ' || v_event_time)::timestamp
      AT TIME ZONE 'Asia/Kolkata';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_TIME_INVALID';
  END;

  IF now() < v_event_start_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERVICE_START_NOT_DUE';
  END IF;
END;
$_$;


--
-- Name: band_pkg_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."band_pkg_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: banquet_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."banquet_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_banquet_hall(NEW.provider_id) THEN RAISE EXCEPTION 'Banquet data restricted to banquet hall providers'; END IF; RETURN NEW; END $$;


--
-- Name: banquet_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."banquet_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: catering_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."catering_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_caterer(NEW.provider_id) THEN RAISE EXCEPTION 'Catering data is restricted to catering_services providers'; END IF; RETURN NEW; END $$;


--
-- Name: catering_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."catering_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: check_artist_availability("uuid", "date", time without time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."check_artist_availability"("p_provider_id" "uuid", "p_event_date" "date", "p_event_time" time without time zone DEFAULT NULL::time without time zone, "p_duration_hours" integer DEFAULT 4) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_blocked INTEGER;
  v_count   INTEGER;
  v_conflict BOOLEAN := FALSE;
  v_lock    BIGINT;
BEGIN
  -- Acquire per-provider-per-date advisory lock (prevents concurrent double bookings)
  v_lock := ('x' || md5(p_provider_id::TEXT || p_event_date::TEXT))::BIT(64)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock);

  -- 1. Past date check
  IF p_event_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'This date is in the past');
  END IF;

  -- 2. Blocked date check
  SELECT COUNT(*) INTO v_blocked
  FROM public.provider_availability
  WHERE provider_id    = p_provider_id
    AND unavailable_date = p_event_date
    AND slot_type      = 'unavailable';

  IF v_blocked > 0 THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'Artist has marked this date as unavailable');
  END IF;

  -- 3. Existing booking check
  IF p_event_time IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.bookings
    WHERE provider_id = p_provider_id
      AND event_date  = p_event_date
      AND status IN ('requested', 'accepted', 'in_progress');

    IF v_count > 0 THEN
      RETURN jsonb_build_object(
        'available', FALSE,
        'reason', 'Artist already has ' || v_count || ' booking(s) on this date. Please select another date.'
      );
    END IF;
  ELSE
    -- Time overlap check
    SELECT EXISTS (
      SELECT 1 FROM public.bookings
      WHERE provider_id = p_provider_id
        AND event_date  = p_event_date
        AND status IN ('requested', 'accepted', 'in_progress')
        AND event_time IS NOT NULL
        AND p_event_time < (event_time + (COALESCE(event_duration_hours, 4) * INTERVAL '1 hour'))
        AND (p_event_time + (p_duration_hours * INTERVAL '1 hour')) > event_time
    ) INTO v_conflict;

    IF v_conflict THEN
      RETURN jsonb_build_object(
        'available', FALSE,
        'reason', 'Artist is already booked during this time slot. Please choose a different time.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('available', TRUE, 'reason', NULL);
END;
$$;


--
-- Name: check_cofounder_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."check_cofounder_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.member_type = 'co_founder' AND NEW.is_active = TRUE THEN
    IF (SELECT COUNT(*) FROM public.about_team_members 
        WHERE member_type = 'co_founder' AND is_active = TRUE AND id != NEW.id) >= 8 THEN
      RAISE EXCEPTION 'Cannot have more than 8 active co-founders';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: check_founder_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."check_founder_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.member_type = 'founder' THEN
    IF (SELECT COUNT(*) FROM public.about_team_members 
        WHERE member_type = 'founder' AND id != NEW.id) > 0 THEN
      RAISE EXCEPTION 'Cannot have more than 1 founder';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: check_provider_availability("uuid", "date"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."check_provider_availability"("p_provider_id" "uuid", "p_event_date" "date") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_is_booked BOOLEAN;
  v_calendar_available BOOLEAN;
BEGIN
  -- Check if provider has a booking on that date
  SELECT EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE provider_id = p_provider_id 
      AND event_date = p_event_date 
      AND status NOT IN ('cancelled', 'rejected')
  ) INTO v_is_booked;
  
  IF v_is_booked THEN
    RETURN FALSE;
  END IF;
  
  -- Check calendar availability
  SELECT COALESCE(is_available, TRUE) INTO v_calendar_available
  FROM public.provider_calendar
  WHERE provider_id = p_provider_id AND date = p_event_date;
  
  -- If no calendar entry, assume available
  IF v_calendar_available IS NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN v_calendar_available;
END;
$$;


--
-- Name: checkout_photography_cart("uuid", "date", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."checkout_photography_cart"("p_cart_id" "uuid", "p_event_date" "date", "p_event_time" "text" DEFAULT NULL::"text", "p_venue" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


--
-- Name: create_event_booking("uuid", "text", "text", "date", "text", integer, integer, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_event_booking"("p_customer_id" "uuid", "p_event_name" "text", "p_event_type" "text", "p_event_date" "date", "p_location" "text", "p_guest_count" integer, "p_total_budget" integer, "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.event_bookings (
    customer_id,
    event_name,
    event_type,
    event_date,
    location,
    guest_count,
    total_budget,
    notes
  ) VALUES (
    p_customer_id,
    p_event_name,
    p_event_type,
    p_event_date,
    p_location,
    p_guest_count,
    p_total_budget,
    p_notes
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;


--
-- Name: create_notification_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_notification_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: create_photography_package_booking("uuid", "date", "text", "text", "text", "uuid"[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_photography_package_booking"("p_package_id" "uuid", "p_event_date" "date", "p_event_time" "text" DEFAULT NULL::"text", "p_venue" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ DECLARE p record; addon_total numeric:=0; booking_id uuid; BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF; SELECT * INTO p FROM public.photography_packages WHERE id=p_package_id AND is_active AND is_visible FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Package is unavailable'; END IF; IF EXISTS(SELECT 1 FROM public.photographer_availability WHERE photographer_id=p.photographer_id AND available_date=p_event_date AND NOT is_available) THEN RAISE EXCEPTION 'Photographer is unavailable on this date'; END IF; SELECT coalesce(sum(price),0) INTO addon_total FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(p_addon_ids) AND is_active; IF (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(p_addon_ids) AND is_active) <> coalesce(array_length(p_addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF; INSERT INTO public.photography_package_bookings(package_id,photographer_id,customer_id,event_date,event_time,venue,notes,selected_addon_ids,base_amount,addons_amount,total_amount) VALUES(p.id,p.photographer_id,auth.uid(),p_event_date,p_event_time,nullif(trim(p_venue),''),nullif(trim(p_notes),''),p_addon_ids,p.price,addon_total,p.price+addon_total) RETURNING id INTO booking_id; RETURN booking_id; END $$;


--
-- Name: create_service_start_otp("text", "uuid", "uuid", boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_service_start_otp"("p_booking_table" "text", "p_booking_id" "uuid", "p_vendor_user_id" "uuid", "p_is_resend" boolean DEFAULT false) RETURNS TABLE("otp_id" "uuid", "otp_code" "text", "customer_email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
DECLARE
  v_customer_id UUID;
  v_provider_id UUID;
  v_status TEXT;
  v_advance_paid_at TIMESTAMPTZ;
  v_work_started_at TIMESTAMPTZ;
  v_customer_email TEXT;
  v_previous_id UUID;
  v_previous_resends INT;
  v_max_resends INT;
  v_previous_created_at TIMESTAMPTZ;
  v_resend_count INT := 0;
  v_random BIGINT;
  v_otp TEXT;
  v_otp_hash TEXT;
  v_otp_id UUID;
BEGIN
  SELECT *
  INTO v_customer_id, v_provider_id, v_status, v_advance_paid_at, v_work_started_at
  FROM public.service_start_booking_context(p_booking_table, p_booking_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = v_provider_id
      AND user_id = p_vendor_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'UNAUTHORIZED_VENDOR';
  END IF;

  IF lower(coalesce(v_status, '')) NOT IN ('confirmed', 'approved', 'in_progress')
     OR v_advance_paid_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BOOKING_NOT_CONFIRMED';
  END IF;

  IF v_work_started_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERVICE_ALREADY_STARTED';
  END IF;

  PERFORM public.assert_service_start_is_due(p_booking_table, p_booking_id);

  SELECT NULLIF(trim(email), '')
  INTO v_customer_email
  FROM public.profiles
  WHERE id = v_customer_id;

  IF v_customer_email IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CUSTOMER_EMAIL_NOT_FOUND';
  END IF;

  UPDATE public.booking_start_otps
  SET invalidated = true
  WHERE booking_table = p_booking_table
    AND booking_id = p_booking_id
    AND verified = false
    AND invalidated = false
    AND expires_at <= now();

  SELECT id, resend_count, max_resends, created_at
  INTO v_previous_id, v_previous_resends, v_max_resends, v_previous_created_at
  FROM public.booking_start_otps
  WHERE booking_table = p_booking_table
    AND booking_id = p_booking_id
    AND verified = false
    AND invalidated = false
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_previous_id IS NOT NULL AND NOT p_is_resend THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_OTP_EXISTS';
  END IF;

  IF p_is_resend THEN
    IF v_previous_id IS NOT NULL THEN
      IF v_previous_resends >= v_max_resends THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MAX_RESENDS_REACHED';
      END IF;
      IF v_previous_created_at > now() - interval '60 seconds' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RESEND_COOLDOWN';
      END IF;
      v_resend_count := v_previous_resends + 1;
      UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_previous_id;
    ELSE
      v_resend_count := 1;
    END IF;
  END IF;

  v_random := (get_byte(gen_random_bytes(4), 0)::bigint << 24)
            + (get_byte(gen_random_bytes(4), 1)::bigint << 16)
            + (get_byte(gen_random_bytes(4), 2)::bigint << 8)
            + get_byte(gen_random_bytes(4), 3)::bigint;
  v_otp := lpad((v_random % 1000000)::text, 6, '0');
  v_otp_hash := crypt(v_otp, gen_salt('bf', 10));

  INSERT INTO public.booking_start_otps (
    booking_id, booking_table, vendor_id, customer_id, otp_hash, purpose,
    expires_at, resend_count, email_sent, invalidated
  ) VALUES (
    p_booking_id, p_booking_table, v_provider_id::text, v_customer_id,
    v_otp_hash, 'booking_start', now() + interval '10 minutes',
    v_resend_count, false, false
  )
  RETURNING id INTO v_otp_id;

  EXECUTE format(
    'UPDATE public.%I SET start_requested_at = $1 WHERE id = $2',
    p_booking_table
  ) USING now(), p_booking_id;

  INSERT INTO public.booking_events (
    booking_table, booking_id, event_type, actor_id, actor_role, metadata
  ) VALUES (
    p_booking_table,
    p_booking_id,
    CASE WHEN p_is_resend THEN 'START_OTP_RESENT' ELSE 'START_OTP_GENERATED' END,
    p_vendor_user_id,
    'vendor',
    jsonb_build_object('expires_at', now() + interval '10 minutes')
  );

  RETURN QUERY SELECT v_otp_id, v_otp, v_customer_email;
END;
$_$;


--
-- Name: create_water_product_order("uuid", "jsonb", "text", numeric, numeric, "date", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_water_product_order"("p_provider_id" "uuid", "p_items" "jsonb", "p_delivery_address" "text", "p_delivery_lat" numeric, "p_delivery_lng" numeric, "p_delivery_date" "date", "p_delivery_time_slot" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  quote record;
  order_id uuid;
  item jsonb;
  variant record;
  line_total numeric;
  subtotal_total numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO quote FROM public.quote_water_delivery(p_provider_id, p_delivery_lat, p_delivery_lng);
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT v.id, v.product_id, v.label, v.price, p.name, s.quantity_available
      INTO variant
      FROM public.water_product_variants v
      JOIN public.water_products p ON p.id = v.product_id
      JOIN public.water_product_stock s ON s.variant_id = v.id
     WHERE v.id = (item->>'variantId')::uuid
       AND p.id = (item->>'productId')::uuid
       AND p.provider_id = p_provider_id
       AND p.is_active AND p.is_visible AND NOT p.is_archived AND v.is_available
     FOR UPDATE OF s;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selected product is no longer available'; END IF;
    IF (item->>'quantity')::integer <= 0 OR variant.quantity_available < (item->>'quantity')::integer THEN RAISE EXCEPTION 'Insufficient stock for %', variant.label; END IF;
    line_total := variant.price * (item->>'quantity')::integer;
    subtotal_total := subtotal_total + line_total;
  END LOOP;
  INSERT INTO public.product_orders (provider_id, customer_id, delivery_address, delivery_lat, delivery_lng, delivery_date, delivery_time_slot, estimated_delivery_minutes, distance_km, subtotal, delivery_charge, total_amount)
  VALUES (p_provider_id, auth.uid(), p_delivery_address, p_delivery_lat, p_delivery_lng, p_delivery_date, p_delivery_time_slot, quote.estimated_delivery_minutes, quote.distance_km, subtotal_total, quote.delivery_charge, subtotal_total + quote.delivery_charge)
  RETURNING id INTO order_id;
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT v.id, v.product_id, v.label, v.price, p.name INTO variant FROM public.water_product_variants v JOIN public.water_products p ON p.id = v.product_id WHERE v.id = (item->>'variantId')::uuid;
    line_total := variant.price * (item->>'quantity')::integer;
    INSERT INTO public.product_order_items (order_id, product_id, variant_id, product_name, variant_label, unit_price, quantity, line_total) VALUES (order_id, variant.product_id, variant.id, variant.name, variant.label, variant.price, (item->>'quantity')::integer, line_total);
    UPDATE public.water_product_stock SET quantity_available = quantity_available - (item->>'quantity')::integer WHERE variant_id = variant.id;
  END LOOP;
  INSERT INTO public.delivery_charges (order_id, free_radius_km, distance_km, charge, is_free_delivery) SELECT order_id, free_delivery_radius_km, quote.distance_km, quote.delivery_charge, quote.is_free_delivery FROM public.supplier_delivery_settings WHERE provider_id = p_provider_id;
  RETURN order_id;
END;
$$;


--
-- Name: create_water_product_order("uuid", "jsonb", "text", numeric, numeric, "date", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_water_product_order"("p_provider_id" "uuid", "p_items" "jsonb", "p_delivery_address" "text", "p_delivery_lat" numeric, "p_delivery_lng" numeric, "p_delivery_date" "date", "p_delivery_time_slot" "text" DEFAULT NULL::"text", "p_special_instructions" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  quote record;
  order_id uuid;
  item jsonb;
  variant record;
  line_total numeric;
  subtotal_total numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO quote FROM public.quote_water_delivery(p_provider_id, p_delivery_lat, p_delivery_lng);
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT v.id, v.product_id, v.label, v.price, p.name, s.quantity_available
      INTO variant
      FROM public.water_product_variants v
      JOIN public.water_products p ON p.id = v.product_id
      JOIN public.water_product_stock s ON s.variant_id = v.id
     WHERE v.id = (item->>'variantId')::uuid
       AND p.id = (item->>'productId')::uuid
       AND p.provider_id = p_provider_id
       AND p.is_active AND p.is_visible AND NOT p.is_archived AND v.is_available
     FOR UPDATE OF s;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selected product is no longer available'; END IF;
    IF (item->>'quantity')::integer <= 0 OR variant.quantity_available < (item->>'quantity')::integer THEN RAISE EXCEPTION 'Insufficient stock for %', variant.label; END IF;
    line_total := variant.price * (item->>'quantity')::integer;
    subtotal_total := subtotal_total + line_total;
  END LOOP;
  INSERT INTO public.product_orders (provider_id, customer_id, delivery_address, delivery_lat, delivery_lng, delivery_date, delivery_time_slot, special_instructions, estimated_delivery_minutes, distance_km, subtotal, delivery_charge, total_amount)
  VALUES (p_provider_id, auth.uid(), p_delivery_address, p_delivery_lat, p_delivery_lng, p_delivery_date, p_delivery_time_slot, nullif(trim(p_special_instructions), ''), quote.estimated_delivery_minutes, quote.distance_km, subtotal_total, quote.delivery_charge, subtotal_total + quote.delivery_charge)
  RETURNING id INTO order_id;
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT v.id, v.product_id, v.label, v.price, p.name INTO variant FROM public.water_product_variants v JOIN public.water_products p ON p.id = v.product_id WHERE v.id = (item->>'variantId')::uuid;
    line_total := variant.price * (item->>'quantity')::integer;
    INSERT INTO public.product_order_items (order_id, product_id, variant_id, product_name, variant_label, unit_price, quantity, line_total) VALUES (order_id, variant.product_id, variant.id, variant.name, variant.label, variant.price, (item->>'quantity')::integer, line_total);
    UPDATE public.water_product_stock SET quantity_available = quantity_available - (item->>'quantity')::integer WHERE variant_id = variant.id;
  END LOOP;
  INSERT INTO public.delivery_charges (order_id, free_radius_km, distance_km, charge, is_free_delivery) SELECT order_id, free_delivery_radius_km, quote.distance_km, quote.delivery_charge, quote.is_free_delivery FROM public.supplier_delivery_settings WHERE provider_id = p_provider_id;
  RETURN order_id;
END;
$$;


--
-- Name: decorator_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."decorator_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_decorator(NEW.provider_id) THEN RAISE EXCEPTION 'Decorator data restricted to decorator providers'; END IF; RETURN NEW; END $$;


--
-- Name: decorator_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."decorator_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: dj_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."dj_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_dj(NEW.provider_id) THEN RAISE EXCEPTION 'DJ data is restricted to dj providers'; END IF; RETURN NEW; END $$;


--
-- Name: dj_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."dj_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: drone_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."drone_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_drone_operator(NEW.provider_id) THEN RAISE EXCEPTION 'Drone data is restricted to drone_photography providers'; END IF; RETURN NEW; END $$;


--
-- Name: drone_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."drone_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: enforce_water_supplier_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_water_supplier_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_water_supplier(NEW.provider_id) THEN
    RAISE EXCEPTION 'Water Supplier product data is restricted to water_supplier providers';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: expire_featured_artists(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."expire_featured_artists"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.expires_at < NOW() THEN
    UPDATE public.provider_profiles SET is_featured = false WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."generate_invoice_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invoice_num TEXT;
BEGIN
  v_invoice_num := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('invoice_seq')::TEXT, 6, '0');
  RETURN v_invoice_num;
END;
$$;


--
-- Name: get_active_promotion_video("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_active_promotion_video"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "video_url" "text", "priority_order" integer, "display_position" "text", "user_limit" integer, "unique_users_reached" integer, "has_user_viewed" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.video_url,
    v.priority_order,
    v.display_position,
    v.user_limit,
    v.unique_users_reached,
    COALESCE(EXISTS(
      SELECT 1 FROM public.auth_promotion_video_views
      WHERE video_id = v.id AND user_id = p_user_id
    ), FALSE) AS has_user_viewed
  FROM public.auth_promotion_videos v
  WHERE v.is_active = TRUE
    AND v.unique_users_reached < v.user_limit
  ORDER BY v.priority_order ASC
  LIMIT 1;
END;
$$;


--
-- Name: get_nearest_available_dates("uuid", "date", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_nearest_available_dates"("p_provider_id" "uuid", "p_after_date" "date", "p_count" integer DEFAULT 3) RETURNS "date"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result DATE[] := '{}';
  v_check  DATE   := p_after_date + 1;
  v_avail  JSONB;
  v_iter   INTEGER := 0;
BEGIN
  WHILE array_length(v_result, 1) IS DISTINCT FROM p_count AND v_iter < 60 LOOP
    v_avail := public.check_artist_availability(p_provider_id, v_check);
    IF (v_avail->>'available')::BOOLEAN THEN
      v_result := array_append(v_result, v_check);
    END IF;
    v_check := v_check + 1;
    v_iter  := v_iter + 1;
  END LOOP;
  RETURN v_result;
END;
$$;


--
-- Name: get_random_eligible_promotion_video("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_random_eligible_promotion_video"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "video_url" "text", "priority_order" integer, "display_position" "text", "user_limit" integer, "unique_users_reached" integer, "has_user_viewed" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.video_url,
    v.priority_order,
    v.display_position,
    v.user_limit,
    v.unique_users_reached,
    COALESCE(EXISTS(
      SELECT 1 FROM public.auth_promotion_video_views
      WHERE video_id = v.id AND user_id = p_user_id
    ), FALSE) AS has_user_viewed
  FROM public.auth_promotion_videos v
  WHERE v.is_active = TRUE
    AND v.unique_users_reached < v.user_limit
  ORDER BY RANDOM()
  LIMIT 1;
END;
$$;


--
-- Name: get_user_roles("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_user_roles"("p_user_id" "uuid") RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN ARRAY(
    SELECT ur.role::TEXT FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
  );
END;
$$;


--
-- Name: get_water_variant_availability("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_water_variant_availability"("p_provider_id" "uuid") RETURNS TABLE("variant_id" "uuid", "is_in_stock" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT v.id, s.quantity_available > 0
  FROM public.water_product_variants v
  JOIN public.water_products p ON p.id = v.product_id
  JOIN public.water_product_stock s ON s.variant_id = v.id
  WHERE p.provider_id = p_provider_id
    AND p.is_active AND p.is_visible AND NOT p.is_archived
    AND v.is_available;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  -- Assign default customer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create notification settings
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: has_role("uuid", "public"."app_role"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: is_anchor("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_anchor"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('anchor','host','emcee','event_anchor','event_host','mc'));
$$;


--
-- Name: is_banquet_hall("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_banquet_hall"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('banquet_hall','banquet','venue','hall','function_hall','convention_hall','wedding_hall','event_venue'));
$$;


--
-- Name: is_caterer("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_caterer"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text='catering_services');
$$;


--
-- Name: is_chat_eligible("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_chat_eligible"("p_booking_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  -- Generic bookings: status in_progress or completed
  IF EXISTS (SELECT 1 FROM public.bookings WHERE id = p_booking_id AND status IN ('in_progress', 'completed')) THEN RETURN TRUE; END IF;

  -- Category-specific: check status = 'in_progress' or 'confirmed' or 'completed'
  IF EXISTS (SELECT 1 FROM public.singer_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dancer_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.videography_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.drone_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dj_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.decorator_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.makeup_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.mehendi_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.anchor_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.band_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.priest_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.water_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.rental_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.banquet_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.catering_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.photography_package_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;


--
-- Name: is_chat_participant("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_chat_participant"("p_booking_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  -- Check generic bookings table
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = p_booking_id
    AND (b.customer_id = p_user_id OR EXISTS (
      SELECT 1 FROM public.provider_profiles pp WHERE pp.id = b.provider_id AND pp.user_id = p_user_id
    ))
  ) THEN RETURN TRUE; END IF;

  -- Check all category-specific booking tables
  IF EXISTS (SELECT 1 FROM public.singer_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dancer_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.videography_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.drone_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dj_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.decorator_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.makeup_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.mehendi_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.anchor_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.band_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.priest_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.water_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.rental_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.banquet_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.catering_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.photography_package_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = photographer_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;


--
-- Name: is_current_service_start_otp("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_current_service_start_otp"("p_otp_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.booking_start_otps
    WHERE id = p_otp_id
      AND verified = false
      AND invalidated = false
      AND email_sent = true
      AND expires_at > now()
  );
$$;


--
-- Name: is_decorator("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_decorator"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('decorator','event_decorator','decoration_services','floral_decorator','wedding_decorator'));
$$;


--
-- Name: is_dj("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_dj"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('dj','disc_jockey','dj_services'));
$$;


--
-- Name: is_drone_operator("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_drone_operator"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('drone_photography','drone_operator','drone_videography'));
$$;


--
-- Name: is_makeup_artist("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_makeup_artist"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('makeup_artist','bridal_makeup','makeup'));
$$;


--
-- Name: is_mehendi_artist("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_mehendi_artist"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('mehendi_artist','mehndi_artist','mehendi','henna_artist'));
$$;


--
-- Name: is_photographer("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_photographer"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text='photographer'); $$;


--
-- Name: is_priest("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_priest"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('priest','pandit','purohit','pujari','panditji','astrologer_priest','temple_priest','hindu_priest','muslim_priest','christian_priest','vedic_pandit'));
$$;


--
-- Name: is_rental_service("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_rental_service"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('rental','rentals','rental_services','tent_house','shamiana','stage_rental','furniture_rental','generator_rental','sound_rental','lighting_rental','equipment_rental'));
$$;


--
-- Name: is_videographer("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_videographer"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('videographer','cinematographer'));
$$;


--
-- Name: is_water_supplier("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_water_supplier"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = p_provider_id
      AND profession::text IN ('water_supplier', 'drinking_water_supplier')
  );
$$;


--
-- Name: log_audit_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."log_audit_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: make_admin("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."make_admin"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN 'User ' || p_user_id || ' promoted to admin successfully.';
END;
$$;


--
-- Name: make_provider("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."make_provider"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'provider')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN 'User ' || p_user_id || ' promoted to provider successfully.';
END;
$$;


--
-- Name: makeup_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."makeup_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_makeup_artist(NEW.provider_id) THEN RAISE EXCEPTION 'Makeup data restricted to makeup_artist providers'; END IF; RETURN NEW; END $$;


--
-- Name: makeup_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."makeup_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: match_vendors("public"."vector", integer, double precision, "text", "text", numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."match_vendors"("query_embedding" "public"."vector", "match_count" integer DEFAULT 10, "similarity_threshold" double precision DEFAULT 0.5, "filter_profession" "text" DEFAULT NULL::"text", "filter_city" "text" DEFAULT NULL::"text", "filter_price_max" numeric DEFAULT NULL::numeric) RETURNS TABLE("provider_id" "uuid", "profession" "text", "content" "text", "similarity" double precision, "price_min" numeric, "price_max" numeric, "average_rating" double precision, "is_verified" boolean, "city" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ve.provider_id,
    pp.profession::TEXT,
    ve.content,
    (1 - (ve.embedding <=> query_embedding))::FLOAT,
    pp.price_min::NUMERIC,
    pp.price_max::NUMERIC,
    COALESCE(pp.average_rating, 0)::FLOAT,
    TRUE,
    pr.city::TEXT
  FROM public.vendor_embeddings ve
  JOIN public.provider_profiles pp ON pp.id = ve.provider_id
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE ve.embedding IS NOT NULL
    AND pp.verification_status IN ('approved', 'verified')
    AND COALESCE(pp.is_verified, FALSE) = TRUE
    AND COALESCE(pp.is_published, FALSE) = TRUE
    AND (filter_profession IS NULL OR pp.profession::TEXT = filter_profession)
    AND (filter_city IS NULL OR LOWER(pr.city) LIKE LOWER('%' || filter_city || '%'))
    AND (filter_price_max IS NULL OR pp.price_min IS NULL OR pp.price_min <= filter_price_max)
    AND 1 - (ve.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


--
-- Name: mehendi_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."mehendi_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_mehendi_artist(NEW.provider_id) THEN RAISE EXCEPTION 'Mehendi data restricted to mehendi_artist providers'; END IF; RETURN NEW; END $$;


--
-- Name: mehendi_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."mehendi_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: owns_anchor("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_anchor"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('anchor','host','emcee','event_anchor','event_host','mc'));
$$;


--
-- Name: owns_banquet_hall("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_banquet_hall"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('banquet_hall','banquet','venue','hall','function_hall','convention_hall','wedding_hall','event_venue'));
$$;


--
-- Name: owns_caterer("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_caterer"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text='catering_services');
$$;


--
-- Name: owns_decorator("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_decorator"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('decorator','event_decorator','decoration_services','floral_decorator','wedding_decorator'));
$$;


--
-- Name: owns_dj("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_dj"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('dj','disc_jockey','dj_services'));
$$;


--
-- Name: owns_drone_operator("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_drone_operator"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('drone_photography','drone_operator','drone_videography'));
$$;


--
-- Name: owns_makeup_artist("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_makeup_artist"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('makeup_artist','bridal_makeup','makeup'));
$$;


--
-- Name: owns_mehendi_artist("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_mehendi_artist"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('mehendi_artist','mehndi_artist','mehendi','henna_artist'));
$$;


--
-- Name: owns_photographer("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_photographer"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text='photographer'); $$;


--
-- Name: owns_priest("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_priest"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('priest','pandit','purohit','pujari','panditji','astrologer_priest','temple_priest','hindu_priest','muslim_priest','christian_priest','vedic_pandit'));
$$;


--
-- Name: owns_rental_service("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_rental_service"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('rental','rentals','rental_services','tent_house','shamiana','stage_rental','furniture_rental','generator_rental','sound_rental','lighting_rental','equipment_rental'));
$$;


--
-- Name: owns_videographer("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_videographer"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('videographer','cinematographer'));
$$;


--
-- Name: owns_water_supplier("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_water_supplier"("p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = p_provider_id
      AND user_id = auth.uid()
      AND profession::text IN ('water_supplier', 'drinking_water_supplier')
  );
$$;


--
-- Name: photography_cart_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."photography_cart_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN
  IF NOT public.is_photographer(NEW.photographer_id) THEN RAISE EXCEPTION 'Photography carts are restricted to photographer providers'; END IF;
  RETURN NEW;
END $$;


--
-- Name: photography_cart_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."photography_cart_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


--
-- Name: photography_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."photography_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN IF NOT public.is_photographer(NEW.photographer_id) THEN RAISE EXCEPTION 'Photography package data is restricted to photographer providers'; END IF; RETURN NEW; END $$;


--
-- Name: photography_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."photography_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: photography_videography_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."photography_videography_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ 
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END $$;


--
-- Name: priest_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."priest_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_priest(NEW.provider_id) THEN RAISE EXCEPTION 'Priest data restricted to priest/pandit providers'; END IF; RETURN NEW; END $$;


--
-- Name: priest_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."priest_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: quote_water_delivery("uuid", numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."quote_water_delivery"("p_provider_id" "uuid", "p_delivery_lat" numeric, "p_delivery_lng" numeric) RETURNS TABLE("distance_km" numeric, "delivery_charge" numeric, "is_free_delivery" boolean, "estimated_delivery_minutes" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  settings public.supplier_delivery_settings%ROWTYPE;
  calculated_distance numeric;
BEGIN
  SELECT * INTO settings FROM public.supplier_delivery_settings WHERE provider_id = p_provider_id;
  IF NOT FOUND OR settings.delivery_origin_lat IS NULL OR settings.delivery_origin_lng IS NULL THEN
    RAISE EXCEPTION 'Supplier delivery origin has not been configured';
  END IF;

  calculated_distance := 6371 * acos(least(1, greatest(-1,
    cos(radians(settings.delivery_origin_lat)) * cos(radians(p_delivery_lat)) *
    cos(radians(p_delivery_lng) - radians(settings.delivery_origin_lng)) +
    sin(radians(settings.delivery_origin_lat)) * sin(radians(p_delivery_lat))
  )));

  IF calculated_distance > settings.max_delivery_radius_km THEN
    RAISE EXCEPTION 'Delivery address is outside this supplier''s delivery radius';
  END IF;

  RETURN QUERY SELECT
    round(calculated_distance, 2),
    CASE WHEN calculated_distance <= settings.free_delivery_radius_km THEN 0 ELSE settings.extra_delivery_charge END,
    calculated_distance <= settings.free_delivery_radius_km,
    CASE WHEN calculated_distance <= settings.free_delivery_radius_km THEN 30 ELSE 45 END;
END;
$$;


--
-- Name: record_promotion_view("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."record_promotion_view"("p_video_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_users INTEGER;
  v_user_limit INTEGER;
  v_already_viewed BOOLEAN;
BEGIN
  -- Check if user already viewed this video
  SELECT EXISTS(
    SELECT 1 FROM public.auth_promotion_video_views
    WHERE video_id = p_video_id AND user_id = p_user_id
  ) INTO v_already_viewed;
  
  IF v_already_viewed THEN
    RETURN FALSE;
  END IF;

  -- Lock the video row to prevent concurrent updates from exceeding limit
  SELECT unique_users_reached, user_limit
  FROM public.auth_promotion_videos
  WHERE id = p_video_id
  INTO v_current_users, v_user_limit
  FOR UPDATE;

  IF v_current_users IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If limit already reached, reject
  IF v_current_users >= v_user_limit THEN
    RETURN FALSE;
  END IF;

  -- Insert the view record (will fail with unique constraint if user already viewed)
  BEGIN
    INSERT INTO public.auth_promotion_video_views (video_id, user_id)
    VALUES (p_video_id, p_user_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN FALSE;
  END;

  -- Increment the user count
  UPDATE public.auth_promotion_videos
  SET unique_users_reached = unique_users_reached + 1
  WHERE id = p_video_id;

  -- If we just reached the limit, deactivate this video and activate next one
  SELECT unique_users_reached
  FROM public.auth_promotion_videos
  WHERE id = p_video_id
  INTO v_current_users;

  IF v_current_users >= v_user_limit THEN
    -- Deactivate current video
    UPDATE public.auth_promotion_videos
    SET is_active = FALSE
    WHERE id = p_video_id;

    -- Activate next video if it exists
    UPDATE public.auth_promotion_videos
    SET is_active = TRUE
    WHERE id = (
      SELECT id FROM public.auth_promotion_videos
      WHERE is_active = FALSE
        AND priority_order > (
          SELECT priority_order FROM public.auth_promotion_videos WHERE id = p_video_id
        )
      ORDER BY priority_order ASC
      LIMIT 1
    );
  END IF;

  RETURN TRUE;
END;
$$;


--
-- Name: record_service_start_otp_delivery("uuid", boolean, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."record_service_start_otp_delivery"("p_otp_id" "uuid", "p_delivered" boolean, "p_error" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_email_sent BOOLEAN;
BEGIN
  SELECT email_sent
  INTO v_email_sent
  FROM public.booking_start_otps
  WHERE id = p_otp_id
    AND verified = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OTP_NOT_FOUND';
  END IF;

  IF p_delivered THEN
    UPDATE public.booking_start_otps
    SET email_sent = true,
        email_sent_at = coalesce(email_sent_at, now()),
        email_error = NULL
    WHERE id = p_otp_id
      AND verified = false;
  ELSIF NOT v_email_sent THEN
    UPDATE public.booking_start_otps
    SET email_error = left(coalesce(p_error, 'Email delivery failed'), 500),
        invalidated = true
    WHERE id = p_otp_id
      AND verified = false;
  END IF;
END;
$$;


--
-- Name: reject_artist("uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."reject_artist"("p_provider_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.provider_profiles
  WHERE id = p_provider_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Provider not found');
  END IF;

  UPDATE public.provider_profiles SET
    verification_status = 'rejected',
    is_published        = FALSE,
    is_verified         = FALSE,
    rejection_reason    = p_reason,
    verified_at         = NOW(),
    verified_by         = p_admin_user_id
  WHERE id = p_provider_id;

  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'provider';

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_user_id,
    'Profile Review Update',
    'Your Vowza profile requires attention. Reason: ' || p_reason || '. Please update your profile and resubmit.',
    'rejection',
    p_provider_id::TEXT,
    FALSE
  );

  RETURN jsonb_build_object('success', true, 'message', 'rejected');
END;
$$;


--
-- Name: rental_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."rental_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_rental_service(NEW.provider_id) THEN RAISE EXCEPTION 'Rental data restricted to rental service providers'; END IF; RETURN NEW; END $$;


--
-- Name: rental_inventory_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."rental_inventory_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


--
-- Name: rental_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."rental_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: search_vendors_sql("text", "text", numeric, double precision, "text", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."search_vendors_sql"("p_profession" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_price_max" numeric DEFAULT NULL::numeric, "p_min_rating" double precision DEFAULT 0, "p_area" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 10) RETURNS TABLE("provider_id" "uuid", "profession" "text", "stage_name" "text", "bio" "text", "price_min" numeric, "price_max" numeric, "average_rating" double precision, "total_reviews" integer, "total_bookings" integer, "is_verified" boolean, "is_available" boolean, "experience_years" integer, "cover_image_url" "text", "city" "text", "area" "text", "full_name" "text", "avatar_url" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id,
    pp.profession::TEXT,
    pp.stage_name::TEXT,
    pp.bio::TEXT,
    pp.price_min::NUMERIC,
    pp.price_max::NUMERIC,
    COALESCE(pp.average_rating, 0)::FLOAT,
    COALESCE(pp.total_reviews, 0)::INT,
    COALESCE(pp.total_bookings, 0)::INT,
    COALESCE(pp.is_verified, FALSE)::BOOLEAN,
    COALESCE(pp.is_available, TRUE)::BOOLEAN,
    pp.experience_years::INT,
    pp.cover_image_url::TEXT,
    pr.city::TEXT,
    pr.area::TEXT,
    pr.full_name::TEXT,
    pr.avatar_url::TEXT
  FROM public.provider_profiles pp
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE pp.verification_status IN ('approved', 'verified')
    AND COALESCE(pp.is_verified, FALSE) = TRUE
    AND COALESCE(pp.is_published, FALSE) = TRUE
    AND (p_profession IS NULL OR pp.profession::TEXT = p_profession)
    AND (p_city IS NULL OR LOWER(COALESCE(pr.city, '')) LIKE LOWER('%' || p_city || '%'))
    AND (p_area IS NULL OR
      LOWER(TRIM(COALESCE(pr.area, ''))) LIKE '%' || LOWER(TRIM(p_area)) || '%'
      OR
      EXISTS (
        SELECT 1 FROM UNNEST(COALESCE(pp.service_areas, '{}')) AS sa
        WHERE LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
      )
    )
    AND (p_price_max IS NULL OR pp.price_min IS NULL OR pp.price_min <= p_price_max)
    AND COALESCE(pp.average_rating, 0) >= p_min_rating
  ORDER BY
    CASE
      WHEN LOWER(TRIM(COALESCE(pr.area, ''))) LIKE '%' || LOWER(TRIM(p_area)) || '%' THEN 0
      WHEN EXISTS (
        SELECT 1 FROM UNNEST(COALESCE(pp.service_areas, '{}')) AS sa
        WHERE LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
      ) THEN 1
    END,
    COALESCE(pp.average_rating, 0) DESC,
    COALESCE(pp.total_bookings, 0) DESC
  LIMIT p_limit;
END;
$$;


--
-- Name: service_start_booking_context("text", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."service_start_booking_context"("p_booking_table" "text", "p_booking_id" "uuid") RETURNS TABLE("customer_id" "uuid", "provider_id" "uuid", "booking_status" "text", "advance_paid_at" timestamp with time zone, "work_started_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
DECLARE
  v_provider_column TEXT;
BEGIN
  IF p_booking_table NOT IN (
    'bookings', 'photography_package_bookings', 'catering_bookings',
    'drone_bookings', 'videography_bookings', 'dj_bookings',
    'decorator_bookings', 'makeup_bookings', 'mehendi_bookings',
    'anchor_bookings', 'banquet_bookings', 'rental_bookings',
    'priest_bookings', 'water_bookings', 'band_bookings',
    'singer_bookings', 'dancer_bookings'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_BOOKING_SOURCE';
  END IF;

  v_provider_column := CASE
    WHEN p_booking_table = 'photography_package_bookings' THEN 'photographer_id'
    ELSE 'provider_id'
  END;

  RETURN QUERY EXECUTE format(
    'SELECT b.customer_id, b.%1$I::uuid, b.status::text, b.advance_paid_at, b.work_started_at
     FROM public.%2$I AS b
     WHERE b.id = $1
     FOR UPDATE',
    v_provider_column,
    p_booking_table
  ) USING p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BOOKING_NOT_FOUND';
  END IF;
END;
$_$;


--
-- Name: set_auth_promotion_media_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_auth_promotion_media_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;


--
-- Name: set_auth_promotion_videos_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_auth_promotion_videos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;


--
-- Name: set_water_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_water_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


--
-- Name: update_artist_booking_status("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_artist_booking_status"("p_booking_id" "uuid", "p_status" "text", "p_negotiation_message" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.artist_bookings
  SET status = p_status,
      negotiation_message = p_negotiation_message,
      updated_at = now()
  WHERE id = p_booking_id;
  
  RETURN TRUE;
END;
$$;


--
-- Name: update_daily_analytics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_daily_analytics"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.platform_analytics (date, total_bookings, total_revenue, total_commission)
  VALUES (
    CURRENT_DATE,
    1,
    NEW.amount,
    ROUND(NEW.amount * 0.05)
  )
  ON CONFLICT (date)
  DO UPDATE SET
    total_bookings = platform_analytics.total_bookings + 1,
    total_revenue = platform_analytics.total_revenue + NEW.amount,
    total_commission = platform_analytics.total_commission + ROUND(NEW.amount * 0.05);

  RETURN NEW;
END;
$$;


--
-- Name: update_provider_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_provider_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.provider_profiles
  SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE provider_id = NEW.provider_id
    ),
    total_reviews = (
      SELECT COUNT(*) FROM public.reviews WHERE provider_id = NEW.provider_id
    )
  WHERE id = NEW.provider_id;

  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: user_has_role("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."user_has_role"("p_user_id" "uuid", "p_role" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = p_role::public.app_role
  );
END;
$$;


--
-- Name: validate_promotion_vendor_package(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validate_promotion_vendor_package"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If provider_id is set and package_id is set, verify the package belongs to this provider
  IF NEW.provider_id IS NOT NULL AND NEW.package_id IS NOT NULL AND NEW.package_table IS NOT NULL THEN
    -- For generic validation, check that the package_table exists and has the package_id
    -- Category-specific validation happens at application layer
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = NEW.package_table
    ) THEN
      RAISE EXCEPTION 'Invalid package table: %', NEW.package_table;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: verify_service_start_otp("text", "uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."verify_service_start_otp"("p_booking_table" "text", "p_booking_id" "uuid", "p_vendor_user_id" "uuid", "p_otp" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
DECLARE
  v_customer_id UUID;
  v_provider_id UUID;
  v_status TEXT;
  v_advance_paid_at TIMESTAMPTZ;
  v_work_started_at TIMESTAMPTZ;
  v_otp_record public.booking_start_otps%ROWTYPE;
  v_attempts INT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_otp !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT *
  INTO v_customer_id, v_provider_id, v_status, v_advance_paid_at, v_work_started_at
  FROM public.service_start_booking_context(p_booking_table, p_booking_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = v_provider_id
      AND user_id = p_vendor_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'UNAUTHORIZED_VENDOR';
  END IF;

  IF lower(coalesce(v_status, '')) NOT IN ('confirmed', 'approved', 'in_progress')
     OR v_advance_paid_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BOOKING_NOT_CONFIRMED';
  END IF;

  IF v_work_started_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_started', 'started_at', v_work_started_at);
  END IF;

  PERFORM public.assert_service_start_is_due(p_booking_table, p_booking_id);

  SELECT *
  INTO v_otp_record
  FROM public.booking_start_otps
  WHERE booking_table = p_booking_table
    AND booking_id = p_booking_id
    AND verified = false
    AND invalidated = false
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_active_otp');
  END IF;

  IF v_otp_record.expires_at <= v_now THEN
    UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_otp_record.id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF NOT v_otp_record.email_sent THEN
    UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_otp_record.id;
    RETURN jsonb_build_object('status', 'email_delivery_failed');
  END IF;

  IF v_otp_record.attempts >= v_otp_record.max_attempts THEN
    UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_otp_record.id;
    RETURN jsonb_build_object('status', 'too_many_attempts');
  END IF;

  IF crypt(p_otp, v_otp_record.otp_hash) <> v_otp_record.otp_hash THEN
    v_attempts := v_otp_record.attempts + 1;
    UPDATE public.booking_start_otps
    SET attempts = v_attempts,
        invalidated = (v_attempts >= v_otp_record.max_attempts)
    WHERE id = v_otp_record.id;

    IF v_attempts >= v_otp_record.max_attempts THEN
      RETURN jsonb_build_object('status', 'too_many_attempts');
    END IF;

    RETURN jsonb_build_object(
      'status', 'invalid',
      'remaining_attempts', v_otp_record.max_attempts - v_attempts
    );
  END IF;

  UPDATE public.booking_start_otps
  SET verified = true,
      verified_at = v_now,
      verified_by = p_vendor_user_id,
      used_at = v_now
  WHERE id = v_otp_record.id;

  EXECUTE format(
    'UPDATE public.%I
     SET status = $1, otp_verified_at = $2, work_started_at = $2
     WHERE id = $3',
    p_booking_table
  ) USING 'in_progress', v_now, p_booking_id;

  INSERT INTO public.booking_events (
    booking_table, booking_id, event_type, actor_id, actor_role, metadata
  ) VALUES
    (p_booking_table, p_booking_id, 'START_OTP_VERIFIED', p_vendor_user_id, 'vendor', jsonb_build_object('verified_at', v_now)),
    (p_booking_table, p_booking_id, 'WORK_STARTED', p_vendor_user_id, 'vendor', jsonb_build_object('started_at', v_now));

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_customer_id,
    'Service Started',
    'Your vendor has verified the Service Start OTP and started the service.',
    'booking_confirmed',
    p_booking_id,
    false
  );

  RETURN jsonb_build_object('status', 'started', 'started_at', v_now);
END;
$_$;


--
-- Name: videography_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."videography_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN IF NOT public.is_videographer(NEW.provider_id) THEN RAISE EXCEPTION 'Videography data is restricted to videographer/cinematographer providers'; END IF; RETURN NEW; END $$;


--
-- Name: videography_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."videography_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: water_pkg_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."water_pkg_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;


--
-- Name: allow_any_operation("text"[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation("text"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."allow_only_operation"("expected_operation" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object("text", "text", "uuid", "jsonb"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension("text"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename("text"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;


--
-- Name: foldername("text"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix("text", "text", "text"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter("text", "text", "text", integer, "text", "text"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter("text", "text", "text", integer, "text", "text", "text"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."protect_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search("text", "text", integer, integer, integer, "text", "text", "text"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_prefix_len INT;
    v_prefix_start INT;
    v_combined_levels INT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_prefix_len := length(coalesce(prefix, ''));
    v_prefix_start := coalesce(array_length(string_to_array(coalesce(prefix, ''), v_delimiter), 1), 1);
    v_combined_levels := coalesce(array_length(string_to_array(v_prefix, v_delimiter), 1), 1);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT array_to_string(path_tokens[$1:$2], '/') AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $3 || '%%'
                  AND bucket_id = $4
                  AND array_length(objects.path_tokens, 1) <> $2
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT array_to_string(path_tokens[$1:$2], '/') AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $3 || '%%'
               AND bucket_id = $4
               AND array_length(objects.path_tokens, 1) = $2
             ORDER BY %I %s)
            LIMIT $5 OFFSET $6
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING v_prefix_start, v_combined_levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := substring(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter) from v_prefix_len + 1);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := substring(v_current.name from v_prefix_len + 1);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp("text", "text", integer, integer, "text", "text", "text", "text"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
    v_sort_order text;
    v_sort_column text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    -- Defense-in-depth: this function is independently reachable and must
    -- not trust p_sort_order/p_sort_column to already be validated by a
    -- caller. Normalize to the same strict allow-list storage.search_v2
    -- uses before interpolating anything into dynamic SQL below.
    v_sort_order := lower(coalesce(p_sort_order, 'asc'));
    IF v_sort_order NOT IN ('asc', 'desc') THEN
        v_sort_order := 'asc';
    END IF;

    v_sort_column := lower(coalesce(p_sort_column, 'updated_at'));
    IF v_sort_column NOT IN ('updated_at', 'created_at') THEN
        v_sort_column := 'updated_at';
    END IF;

    IF v_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        v_sort_column,
        v_cursor_op,
        v_sort_column,
        v_sort_order,
        v_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2("text", "text", integer, integer, "text", "text", "text", "text"); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE "audit_log_entries"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."custom_oauth_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_type" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "name" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "client_secret" "text" NOT NULL,
    "acceptable_client_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "pkce_enabled" boolean DEFAULT true NOT NULL,
    "attribute_mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "authorization_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "email_optional" boolean DEFAULT false NOT NULL,
    "issuer" "text",
    "discovery_url" "text",
    "skip_nonce_check" boolean DEFAULT false NOT NULL,
    "cached_discovery" "jsonb",
    "discovery_cached_at" timestamp with time zone,
    "authorization_url" "text",
    "token_url" "text",
    "userinfo_url" "text",
    "jwks_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "custom_claims_allowlist" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "custom_oauth_providers_authorization_url_https" CHECK ((("authorization_url" IS NULL) OR ("authorization_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_authorization_url_length" CHECK ((("authorization_url" IS NULL) OR ("char_length"("authorization_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_client_id_length" CHECK ((("char_length"("client_id") >= 1) AND ("char_length"("client_id") <= 512))),
    CONSTRAINT "custom_oauth_providers_discovery_url_length" CHECK ((("discovery_url" IS NULL) OR ("char_length"("discovery_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_identifier_format" CHECK (("identifier" ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::"text")),
    CONSTRAINT "custom_oauth_providers_issuer_length" CHECK ((("issuer" IS NULL) OR (("char_length"("issuer") >= 1) AND ("char_length"("issuer") <= 2048)))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_https" CHECK ((("jwks_uri" IS NULL) OR ("jwks_uri" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_length" CHECK ((("jwks_uri" IS NULL) OR ("char_length"("jwks_uri") <= 2048))),
    CONSTRAINT "custom_oauth_providers_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 100))),
    CONSTRAINT "custom_oauth_providers_oauth2_requires_endpoints" CHECK ((("provider_type" <> 'oauth2'::"text") OR (("authorization_url" IS NOT NULL) AND ("token_url" IS NOT NULL) AND ("userinfo_url" IS NOT NULL)))),
    CONSTRAINT "custom_oauth_providers_oidc_discovery_url_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("discovery_url" IS NULL) OR ("discovery_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_issuer_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NULL) OR ("issuer" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_requires_issuer" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NOT NULL))),
    CONSTRAINT "custom_oauth_providers_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['oauth2'::"text", 'oidc'::"text"]))),
    CONSTRAINT "custom_oauth_providers_token_url_https" CHECK ((("token_url" IS NULL) OR ("token_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_token_url_length" CHECK ((("token_url" IS NULL) OR ("char_length"("token_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_https" CHECK ((("userinfo_url" IS NULL) OR ("userinfo_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_length" CHECK ((("userinfo_url" IS NULL) OR ("char_length"("userinfo_url") <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "code_challenge" "text",
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone,
    "invite_token" "text",
    "referrer" "text",
    "oauth_client_state_id" "uuid",
    "linking_target_id" "uuid",
    "email_optional" boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE "flow_state"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."flow_state" IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


--
-- Name: TABLE "identities"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN "identities"."email"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


--
-- Name: TABLE "instances"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


--
-- Name: TABLE "mfa_amr_claims"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


--
-- Name: TABLE "mfa_challenges"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


--
-- Name: TABLE "mfa_factors"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';


--
-- Name: COLUMN "mfa_factors"."last_webauthn_challenge_data"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."oauth_client_states" (
    "id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "code_verifier" "text",
    "created_at" timestamp with time zone NOT NULL
);


--
-- Name: TABLE "oauth_client_states"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."oauth_client_states" IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    "token_endpoint_auth_method" "text" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048)),
    CONSTRAINT "oauth_clients_token_endpoint_auth_method_check" CHECK (("token_endpoint_auth_method" = ANY (ARRAY['client_secret_basic'::"text", 'client_secret_post'::"text", 'none'::"text"])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


--
-- Name: TABLE "refresh_tokens"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


--
-- Name: TABLE "saml_providers"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


--
-- Name: TABLE "saml_relay_states"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


--
-- Name: TABLE "schema_migrations"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


--
-- Name: TABLE "sessions"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN "sessions"."not_after"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN "sessions"."refresh_token_hmac_key"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN "sessions"."refresh_token_counter"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


--
-- Name: TABLE "sso_domains"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


--
-- Name: TABLE "sso_providers"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN "sso_providers"."resource_id"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


--
-- Name: TABLE "users"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN "users"."is_sso_user"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."webauthn_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "challenge_type" "text" NOT NULL,
    "session_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "webauthn_challenges_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['signup'::"text", 'registration'::"text", 'authentication'::"text"])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE "auth"."webauthn_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "bytea" NOT NULL,
    "public_key" "bytea" NOT NULL,
    "attestation_type" "text" DEFAULT ''::"text" NOT NULL,
    "aaguid" "uuid",
    "sign_count" bigint DEFAULT 0 NOT NULL,
    "transports" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "backup_eligible" boolean DEFAULT false NOT NULL,
    "backed_up" boolean DEFAULT false NOT NULL,
    "friendly_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


--
-- Name: about_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."about_team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "bio" "text" DEFAULT ''::"text" NOT NULL,
    "photo_url" "text",
    "member_type" "text" NOT NULL,
    "display_order" integer DEFAULT 999 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "linkedin_url" "text",
    CONSTRAINT "about_team_members_member_type_check" CHECK (("member_type" = ANY (ARRAY['founder'::"text", 'co_founder'::"text"])))
);


--
-- Name: COLUMN "about_team_members"."linkedin_url"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."about_team_members"."linkedin_url" IS 'Optional LinkedIn profile URL (e.g., https://www.linkedin.com/in/username)';


--
-- Name: about_us; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."about_us" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" DEFAULT 'Where Talent Meets Celebration'::"text" NOT NULL,
    "description" "text" DEFAULT 'Loading...'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "mission" "text" DEFAULT '...'::"text" NOT NULL,
    "vision" "text" DEFAULT '...'::"text" NOT NULL,
    "hero_image_url" "text",
    CONSTRAINT "one_row_only" CHECK ((("id" = '00000000-0000-0000-0000-000000000001'::"uuid") OR ("id" IS NOT NULL)))
);


--
-- Name: COLUMN "about_us"."hero_image_url"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."about_us"."hero_image_url" IS 'URL to the uploaded hero image displayed in the About Us page (stored in Supabase Storage about-us bucket)';


--
-- Name: admin_event_package_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."admin_event_package_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_location" character varying(500),
    "guest_count" integer,
    "package_price" numeric(12,2) NOT NULL,
    "discount_applied" numeric(5,2) DEFAULT 0,
    "final_price" numeric(12,2) NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "payment_status" character varying(50) DEFAULT 'unpaid'::character varying,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "valid_payment_status" CHECK ((("payment_status")::"text" = ANY ((ARRAY['unpaid'::character varying, 'partial'::character varying, 'paid'::character varying])::"text"[]))),
    CONSTRAINT "valid_status" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);


--
-- Name: admin_event_package_discounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."admin_event_package_discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "discount_percentage" numeric(5,2) NOT NULL,
    "reason" character varying(255),
    "active_from" timestamp without time zone NOT NULL,
    "active_until" timestamp without time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "valid_discount_audit" CHECK ((("discount_percentage" >= (0)::numeric) AND ("discount_percentage" <= (100)::numeric)))
);


--
-- Name: admin_event_package_inclusions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."admin_event_package_inclusions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "is_included" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: admin_event_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."admin_event_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type_id" "uuid" NOT NULL,
    "tier" character varying(50) NOT NULL,
    "display_name" character varying(255) NOT NULL,
    "description" "text",
    "base_price" numeric(12,2) NOT NULL,
    "discount_percentage" numeric(5,2) DEFAULT 0,
    "final_price" numeric(12,2) GENERATED ALWAYS AS (("base_price" * ((1)::numeric - ("discount_percentage" / (100)::numeric)))) STORED,
    "max_category_selections" integer DEFAULT 3,
    "max_professionals_per_category" integer DEFAULT 2,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid" NOT NULL,
    CONSTRAINT "valid_discount" CHECK ((("discount_percentage" >= (0)::numeric) AND ("discount_percentage" <= (100)::numeric))),
    CONSTRAINT "valid_price" CHECK (("base_price" > (0)::numeric))
);


--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ai_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'New Conversation'::"text" NOT NULL,
    "context_summary" "jsonb" DEFAULT '{}'::"jsonb",
    "last_active_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "is_favorite" boolean DEFAULT false NOT NULL
);


--
-- Name: ai_message_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ai_message_feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "reaction" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "ai_message_feedback_reaction_check" CHECK (("reaction" = ANY (ARRAY['like'::"text", 'dislike'::"text"])))
);


--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ai_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "ai_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


--
-- Name: anchor_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."anchor_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "anchor_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: anchor_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."anchor_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "city" "text",
    "expected_audience" "text",
    "special_requirements" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "anchor_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "anchor_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "anchor_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: anchor_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."anchor_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "anchor_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: anchor_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."anchor_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "package_type" "text" NOT NULL,
    "description" "text",
    "package_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "travel_charges" numeric(12,2) DEFAULT 0,
    "outside_city_charges" numeric(12,2) DEFAULT 0,
    "extra_hour_charges" numeric(12,2) DEFAULT 0,
    "script_writing_charges" numeric(12,2) DEFAULT 0,
    "stage_coordination_charges" numeric(12,2) DEFAULT 0,
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hosting_style" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "audience_capacity" "text",
    "services_included" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "deliverables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "lead_anchor" integer DEFAULT 1,
    "co_host" integer DEFAULT 0,
    "assistant" integer DEFAULT 0,
    "stage_coordinator" integer DEFAULT 0,
    "event_manager" integer DEFAULT 0,
    "sound_coordinator" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "anchor_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 150))),
    CONSTRAINT "anchor_packages_package_price_check" CHECK (("package_price" >= (0)::numeric)),
    CONSTRAINT "anchor_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: artist_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."artist_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "profession_type" "public"."profession_type" NOT NULL,
    "description" "text",
    "icon" "text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "min_price" integer,
    "max_price" integer,
    "popular_count" integer DEFAULT 0,
    "icon_lucide" "text"
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "avatar_url" "text",
    "city" "text",
    "area" "text",
    "state" "text",
    "address" "text",
    "organization_name" "text",
    "phone_verified" boolean DEFAULT false,
    "date_of_birth" "date",
    "alternate_phone" "text",
    "whatsapp_enabled" boolean DEFAULT true,
    "email_notifications_enabled" boolean DEFAULT true,
    "sms_notifications_enabled" boolean DEFAULT true,
    "push_notifications_enabled" boolean DEFAULT true,
    "profile_completion_percentage" integer DEFAULT 0,
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "account_verified_at" timestamp with time zone,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_blocked" boolean DEFAULT false,
    "district" "text"
);


--
-- Name: provider_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."provider_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "profession" "public"."profession_type" NOT NULL,
    "experience_years" integer DEFAULT 0,
    "price_min" integer,
    "price_max" integer,
    "bio" "text",
    "is_verified" boolean DEFAULT false,
    "is_available" boolean DEFAULT true,
    "average_rating" numeric(3,2) DEFAULT 0,
    "total_reviews" integer DEFAULT 0,
    "total_bookings" integer DEFAULT 0,
    "specialties" "text"[],
    "stage_name" "text",
    "cover_image_url" "text",
    "languages" "text"[] DEFAULT '{}'::"text"[],
    "pricing_type" "text" DEFAULT 'per_event'::"text",
    "category_details" "jsonb" DEFAULT '{}'::"jsonb",
    "performance_type" "text",
    "onboarding_completed" boolean DEFAULT false,
    "instagram" "text",
    "facebook" "text",
    "youtube" "text",
    "website" "text",
    "gst_number" "text",
    "verification_status" "text" DEFAULT 'pending'::"text",
    "rejection_reason" "text",
    "verified_at" timestamp with time zone,
    "travel_charges" integer DEFAULT 0,
    "extra_charges" integer DEFAULT 0,
    "cover_banner_url" "text",
    "available_dates" "date"[],
    "bank_account_holder" "text",
    "bank_account_number" "text",
    "bank_ifsc" "text",
    "bank_name" "text",
    "branch_name" "text",
    "is_bank_verified" boolean DEFAULT false,
    "is_featured" boolean DEFAULT false,
    "featured_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "whatsapp" "text",
    "service_radius" integer DEFAULT 50,
    "instant_booking" boolean DEFAULT false,
    "gallery_urls" "text"[] DEFAULT '{}'::"text"[],
    "video_urls" "text"[] DEFAULT '{}'::"text"[],
    "available_days" integer[] DEFAULT '{}'::integer[],
    "subcategory" "text",
    "vendor_details" "jsonb" DEFAULT '{}'::"jsonb",
    "faqs" "jsonb" DEFAULT '[]'::"jsonb",
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "business_hours" "jsonb" DEFAULT '{}'::"jsonb",
    "service_areas" "text"[] DEFAULT '{}'::"text"[],
    "verified_by" "uuid",
    "is_published" boolean DEFAULT false,
    "band_category" "text",
    "liveness_verified" boolean DEFAULT false,
    "liveness_verified_at" timestamp with time zone,
    "liveness_provider" "text" DEFAULT 'mediapipe_face_mesh'::"text",
    "liveness_session_id" "text",
    "liveness_attempts" integer DEFAULT 0,
    "aadhaar_status" "text" DEFAULT 'pending'::"text",
    "aadhaar_verified_at" timestamp with time zone,
    "pan_status" "text" DEFAULT 'pending'::"text",
    "pan_verified_at" timestamp with time zone,
    "govt_id_status" "text" DEFAULT 'pending'::"text",
    "govt_id_verified_at" timestamp with time zone,
    "doc_verification_notes" "text",
    CONSTRAINT "provider_profiles_aadhaar_status_check" CHECK (("aadhaar_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "provider_profiles_govt_id_status_check" CHECK (("govt_id_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text", 'not_uploaded'::"text"]))),
    CONSTRAINT "provider_profiles_pan_status_check" CHECK (("pan_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "provider_profiles_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


--
-- Name: approved_artists_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."approved_artists_view" AS
 SELECT "pp"."id",
    "pp"."user_id",
    "pp"."profession",
    "pp"."experience_years",
    "pp"."price_min",
    "pp"."price_max",
    "pp"."bio",
    "pp"."is_verified",
    "pp"."is_available",
    "pp"."is_featured",
    "pp"."featured_until",
    "pp"."average_rating",
    "pp"."total_reviews",
    "pp"."total_bookings",
    "pp"."specialties",
    "pp"."languages",
    "pp"."cover_image_url",
    "p"."city" AS "service_city",
    "p"."area" AS "service_area",
    "p"."state",
    "p"."full_name",
    "p"."avatar_url",
    "ac"."name" AS "category_name",
    "ac"."icon" AS "category_icon"
   FROM (("public"."provider_profiles" "pp"
     LEFT JOIN "public"."profiles" "p" ON (("pp"."user_id" = "p"."id")))
     LEFT JOIN "public"."artist_categories" "ac" ON (("pp"."profession" = "ac"."profession_type")))
  WHERE (("pp"."verification_status" = ANY (ARRAY['approved'::"text", 'verified'::"text"])) AND ("pp"."is_available" = true));


--
-- Name: artist_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."artist_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "provider_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "price" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "negotiation_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "artist_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'negotiating'::"text", 'cancelled'::"text"])))
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text",
    "record_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: auth_promotion_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."auth_promotion_media" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "admin_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "media_type" "text" NOT NULL,
    "media_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "slot_number" integer,
    "file_size_bytes" bigint,
    "category" "text",
    "provider_id" "uuid",
    "package_id" "uuid",
    "package_table" "text",
    "vendor_name" "text",
    "package_name" "text",
    "destination_type" "text" DEFAULT 'vendor'::"text",
    "is_published" boolean DEFAULT false,
    CONSTRAINT "auth_promotion_media_active_requires_slot" CHECK ((("slot_number" IS NOT NULL) OR ("is_active" = false))),
    CONSTRAINT "auth_promotion_media_destination_type_check" CHECK (("destination_type" = ANY (ARRAY['vendor'::"text", 'package'::"text", 'service'::"text"]))),
    CONSTRAINT "auth_promotion_media_display_order_check" CHECK (("display_order" >= 0)),
    CONSTRAINT "auth_promotion_media_file_size_nonnegative" CHECK ((("file_size_bytes" IS NULL) OR ("file_size_bytes" >= 0))),
    CONSTRAINT "auth_promotion_media_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"]))),
    CONSTRAINT "auth_promotion_media_media_url_check" CHECK (("media_url" <> ''::"text")),
    CONSTRAINT "auth_promotion_media_slot_image_only" CHECK ((((("slot_number" >= 1) AND ("slot_number" <= 4)) AND ("media_type" = 'image'::"text")) OR ("slot_number" IS NULL))),
    CONSTRAINT "auth_promotion_media_slot_number_range" CHECK ((("slot_number" >= 1) AND ("slot_number" <= 4))),
    CONSTRAINT "auth_promotion_media_storage_path_check" CHECK (("storage_path" <> ''::"text"))
);


--
-- Name: TABLE "auth_promotion_media"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."auth_promotion_media" IS 'Homepage promotional media cards with optional vendor/package relationships.
- If provider_id is set: promotion is vendor-specific
- If package_id is also set: promotion links to exact package
- category: event type (catering, photography, etc.) for admin filtering
- destination_type: controls navigation behavior (vendor or package)
- is_published: controls visibility on public homepage
- Backward compatible: can store image-only promotions with NULL provider_id';


--
-- Name: COLUMN "auth_promotion_media"."slot_number"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."auth_promotion_media"."slot_number" IS 'Homepage slot (1-4) - determines visual position in 2x2 grid';


--
-- Name: COLUMN "auth_promotion_media"."provider_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."auth_promotion_media"."provider_id" IS 'Reference to provider_profiles.id - if set, promotion links to exact vendor';


--
-- Name: COLUMN "auth_promotion_media"."package_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."auth_promotion_media"."package_id" IS 'Package UUID - must exist in category-specific package table (catering_packages, photography_packages, etc.)';


--
-- Name: COLUMN "auth_promotion_media"."package_table"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."auth_promotion_media"."package_table" IS 'Name of the category-specific package table (catering_packages, photography_packages, etc.)';


--
-- Name: COLUMN "auth_promotion_media"."is_published"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."auth_promotion_media"."is_published" IS 'If true, promotion appears on public homepage. If false, only admins see it';


--
-- Name: auth_promotion_video_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."auth_promotion_video_views" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "watch_duration_seconds" integer,
    "was_closed" boolean DEFAULT false NOT NULL,
    CONSTRAINT "auth_promotion_video_views_watch_duration_seconds_check" CHECK ((("watch_duration_seconds" IS NULL) OR ("watch_duration_seconds" >= 0)))
);


--
-- Name: auth_promotion_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."auth_promotion_videos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "video_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "priority_order" integer DEFAULT 0 NOT NULL,
    "display_position" "text" DEFAULT 'bottom-right'::"text" NOT NULL,
    "user_limit" integer DEFAULT 15 NOT NULL,
    "unique_users_reached" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "auth_promotion_videos_display_position_check" CHECK (("display_position" = ANY (ARRAY['top-left'::"text", 'top-right'::"text", 'bottom-left'::"text", 'bottom-right'::"text"]))),
    CONSTRAINT "auth_promotion_videos_priority_order_check" CHECK (("priority_order" >= 0)),
    CONSTRAINT "auth_promotion_videos_storage_path_check" CHECK (("storage_path" <> ''::"text")),
    CONSTRAINT "auth_promotion_videos_unique_users_reached_check" CHECK (("unique_users_reached" >= 0)),
    CONSTRAINT "auth_promotion_videos_user_limit_check" CHECK (("user_limit" > 0)),
    CONSTRAINT "auth_promotion_videos_user_limit_not_exceeded" CHECK (("unique_users_reached" <= "user_limit")),
    CONSTRAINT "auth_promotion_videos_video_url_check" CHECK (("video_url" <> ''::"text"))
);


--
-- Name: auth_promotional_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."auth_promotional_config" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "admin_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "current_image_url" "text",
    "image_storage_path" "text",
    "overlay_opacity" numeric(3,2) DEFAULT 0.30 NOT NULL,
    "overlay_color" "text" DEFAULT 'rgba(0,0,0,1)'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "auth_promotional_config_image_url_check" CHECK ((("current_image_url" IS NULL) OR ("current_image_url" <> ''::"text"))),
    CONSTRAINT "auth_promotional_config_overlay_opacity_check" CHECK ((("overlay_opacity" >= (0)::numeric) AND ("overlay_opacity" <= (1)::numeric)))
);


--
-- Name: band_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."band_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "band_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: band_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."band_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "city" "text",
    "special_requirements" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "band_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "band_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "band_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: band_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."band_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: band_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."band_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "band_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: band_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."band_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "band_category" "text",
    "description" "text",
    "event_type" "text",
    "package_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "travel_charges" numeric(12,2) DEFAULT 0,
    "outside_city_charges" numeric(12,2) DEFAULT 0,
    "extra_hour_charges" numeric(12,2) DEFAULT 0,
    "additional_performer_charges" numeric(12,2) DEFAULT 0,
    "additional_equipment_charges" numeric(12,2) DEFAULT 0,
    "performance_duration" "text",
    "number_of_performers" "text",
    "instruments" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "music_genres" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "event_types_supported" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "equipment_included" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "band_members" "text",
    "lead_performer" "text",
    "drummers" "text",
    "instrumentalists" "text",
    "singers" "text",
    "support_staff" "text",
    "sound_engineer" "text",
    "deliverables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "band_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 200))),
    CONSTRAINT "band_packages_package_price_check" CHECK (("package_price" >= (0)::numeric)),
    CONSTRAINT "band_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: bank_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."bank_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "bank_name" "text" NOT NULL,
    "account_number" "text" NOT NULL,
    "ifsc_code" "text" NOT NULL,
    "upi_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: banquet_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."banquet_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "guest_count" "text",
    "venue" "text",
    "city" "text",
    "special_requirements" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "banquet_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "banquet_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "banquet_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: banquet_halls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."banquet_halls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "venue_type" "text" NOT NULL,
    "description" "text",
    "hall_rental_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "security_deposit" numeric(12,2) DEFAULT 0,
    "cleaning_charges" numeric(12,2) DEFAULT 0,
    "decoration_permission_fee" numeric(12,2) DEFAULT 0,
    "generator_charges" numeric(12,2) DEFAULT 0,
    "extra_hour_charges" numeric(12,2) DEFAULT 0,
    "outside_catering_charges" numeric(12,2) DEFAULT 0,
    "hall_capacity" "text",
    "seating_styles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "venue_features" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "facilities_included" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "event_types_supported" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "allowed_time" "text",
    "noise_restrictions" "text",
    "outside_decoration_allowed" boolean DEFAULT true,
    "outside_catering_allowed" boolean DEFAULT true,
    "alcohol_allowed" boolean DEFAULT false,
    "fireworks_allowed" boolean DEFAULT false,
    "smoking_policy" "text",
    "cancellation_policy" "text",
    "advance_refund_policy" "text",
    "virtual_tour_url" "text",
    "google_maps_url" "text",
    "address" "text",
    "city" "text",
    "state" "text",
    "pincode" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "banquet_halls_hall_rental_price_check" CHECK (("hall_rental_price" >= (0)::numeric)),
    CONSTRAINT "banquet_halls_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 200))),
    CONSTRAINT "banquet_halls_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: booking_cancellations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."booking_cancellations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "booking_table" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider_id" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "cancelled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hours_remaining" numeric(10,2) DEFAULT 0 NOT NULL,
    "policy_tier" "text" NOT NULL,
    "amount_paid" numeric(10,2) DEFAULT 0 NOT NULL,
    "refund_percentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "refund_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "amount_retained" numeric(10,2) DEFAULT 0 NOT NULL,
    "refund_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "refund_initiated_at" timestamp with time zone,
    "refund_completed_at" timestamp with time zone,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_cancellations_policy_tier_check" CHECK (("policy_tier" = ANY (ARRAY['5_plus_days'::"text", '4_days'::"text", '3_days'::"text", '48_hours'::"text", 'under_48'::"text"]))),
    CONSTRAINT "booking_cancellations_refund_status_check" CHECK (("refund_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'completed'::"text", 'failed'::"text"])))
);


--
-- Name: booking_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."booking_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_table" "text" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: booking_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."booking_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_table" "text" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "state" "text",
    "district" "text",
    "town_city" "text",
    "exact_address" "text",
    "pincode" "text",
    "landmark" "text",
    "latitude" double precision,
    "longitude" double precision,
    "formatted_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: booking_start_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."booking_start_otps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "booking_table" "text" NOT NULL,
    "vendor_id" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "otp_hash" "text" NOT NULL,
    "purpose" "text" DEFAULT 'booking_start'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "resend_count" integer DEFAULT 0 NOT NULL,
    "max_resends" integer DEFAULT 3 NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "sms_sent" boolean DEFAULT false,
    "sms_sent_at" timestamp with time zone,
    "email_sent" boolean DEFAULT false,
    "email_sent_at" timestamp with time zone,
    "admin_notified" boolean DEFAULT false,
    "admin_notified_at" timestamp with time zone,
    "invalidated" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_at" timestamp with time zone,
    "email_error" "text",
    CONSTRAINT "booking_start_otps_purpose_check" CHECK (("purpose" = 'booking_start'::"text"))
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "event_type_id" "uuid",
    "event_date" "date" NOT NULL,
    "event_time" time without time zone,
    "event_duration_hours" integer DEFAULT 4,
    "venue_address" "text" NOT NULL,
    "venue_city" "text" NOT NULL,
    "venue_area" "text",
    "requirements" "text",
    "amount" integer NOT NULL,
    "platform_fee" integer DEFAULT 0,
    "status" "public"."booking_status" DEFAULT 'requested'::"public"."booking_status" NOT NULL,
    "customer_notes" "text",
    "provider_notes" "text",
    "invoice_number" "text",
    "invoice_generated_at" timestamp with time zone,
    "invoice_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text"
);


--
-- Name: budget_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."budget_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "priority" "text" NOT NULL,
    "budget_percentage" integer NOT NULL,
    "allocated_budget" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "budget_allocations_priority_check" CHECK (("priority" = ANY (ARRAY['essential'::"text", 'recommended'::"text", 'optional'::"text"])))
);


--
-- Name: category_provider_counts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."category_provider_counts" AS
 SELECT "ac"."id",
    "ac"."name",
    "ac"."profession_type",
    "ac"."description",
    "ac"."icon",
    "ac"."is_active",
    "ac"."sort_order",
    "count"("pp"."id") AS "provider_count"
   FROM ("public"."artist_categories" "ac"
     LEFT JOIN "public"."provider_profiles" "pp" ON (((("pp"."profession")::"text" = ("ac"."profession_type")::"text") AND ("pp"."verification_status" = ANY (ARRAY['approved'::"text", 'verified'::"text"])))))
  GROUP BY "ac"."id", "ac"."name", "ac"."profession_type", "ac"."description", "ac"."icon", "ac"."is_active", "ac"."sort_order";


--
-- Name: catering_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."catering_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catering_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: catering_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."catering_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "guest_count" integer NOT NULL,
    "meal_type" "text",
    "venue" "text",
    "special_requests" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "city" "text",
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "catering_bookings_addons_amount_check" CHECK (("addons_amount" >= (0)::numeric)),
    CONSTRAINT "catering_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "catering_bookings_guest_count_check" CHECK (("guest_count" > 0)),
    CONSTRAINT "catering_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'preparing'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "catering_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: catering_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."catering_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "alt_text" "text",
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: catering_menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."catering_menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_veg" boolean DEFAULT true NOT NULL,
    "is_jain" boolean DEFAULT false NOT NULL,
    "is_premium" boolean DEFAULT false NOT NULL,
    "is_bestseller" boolean DEFAULT false NOT NULL,
    "is_unlimited" boolean DEFAULT true NOT NULL,
    "spicy_level" integer DEFAULT 1,
    "extra_cost" numeric(12,2) DEFAULT 0,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catering_menu_items_extra_cost_check" CHECK (("extra_cost" >= (0)::numeric)),
    CONSTRAINT "catering_menu_items_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 120))),
    CONSTRAINT "catering_menu_items_spicy_level_check" CHECK ((("spicy_level" >= 0) AND ("spicy_level" <= 5)))
);


--
-- Name: catering_menu_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."catering_menu_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catering_menu_sections_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 100)))
);


--
-- Name: catering_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."catering_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "cuisine_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "service_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "serving_styles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "meal_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "price_per_plate" numeric(12,2),
    "starting_price" numeric(12,2),
    "min_guests" integer DEFAULT 50 NOT NULL,
    "max_guests" integer,
    "recommended_guests" integer,
    "advance_percentage" integer DEFAULT 30,
    "preparation_days" integer DEFAULT 3,
    "cancellation_policy" "text",
    "service_duration" "text",
    "is_veg" boolean DEFAULT true NOT NULL,
    "is_nonveg" boolean DEFAULT false NOT NULL,
    "is_jain" boolean DEFAULT false NOT NULL,
    "is_vegan" boolean DEFAULT false NOT NULL,
    "travel_within_city" boolean DEFAULT true NOT NULL,
    "travel_outside_city" boolean DEFAULT false NOT NULL,
    "max_travel_km" integer,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catering_packages_advance_percentage_check" CHECK ((("advance_percentage" >= 0) AND ("advance_percentage" <= 100))),
    CONSTRAINT "catering_packages_check" CHECK ((("max_guests" IS NULL) OR ("max_guests" >= "min_guests"))),
    CONSTRAINT "catering_packages_min_guests_check" CHECK (("min_guests" > 0)),
    CONSTRAINT "catering_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 150))),
    CONSTRAINT "catering_packages_price_per_plate_check" CHECK (("price_per_plate" >= (0)::numeric)),
    CONSTRAINT "catering_packages_starting_price_check" CHECK (("starting_price" >= (0)::numeric)),
    CONSTRAINT "catering_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'archived'::"text"])))
);


--
-- Name: commission_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."commission_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "booking_amount" integer NOT NULL,
    "commission_rate" integer DEFAULT 5 NOT NULL,
    "commission_amount" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "collected_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commission_tracking_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'collected'::"text", 'paid'::"text"])))
);


--
-- Name: dancer_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."dancer_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "dancer_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: dancer_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."dancer_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "city" "text",
    "dance_type" "text",
    "number_of_dancers" integer DEFAULT 1,
    "performance_duration" "text",
    "special_requirements" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "dancer_bookings_addons_amount_check" CHECK (("addons_amount" >= (0)::numeric)),
    CONSTRAINT "dancer_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "dancer_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "dancer_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: dancer_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."dancer_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "public_url" "text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "title" "text",
    "dance_type" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dancer_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: dancer_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."dancer_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "dance_type" "text",
    "package_type" "text",
    "performance_style" "text",
    "team_size" integer DEFAULT 1,
    "duration" "text",
    "services_included" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "deliverables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "package_price" numeric(12,2) NOT NULL,
    "advance_percentage" integer DEFAULT 20 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dancer_packages_advance_percentage_check" CHECK ((("advance_percentage" >= 0) AND ("advance_percentage" <= 100))),
    CONSTRAINT "dancer_packages_package_price_check" CHECK (("package_price" >= (0)::numeric)),
    CONSTRAINT "dancer_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: decorator_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."decorator_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "decorator_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: decorator_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."decorator_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "city" "text",
    "theme_preference" "text",
    "special_instructions" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "decorator_bookings_addons_amount_check" CHECK (("addons_amount" >= (0)::numeric)),
    CONSTRAINT "decorator_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "decorator_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "decorator_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: decorator_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."decorator_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "decorator_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: decorator_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."decorator_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "package_type" "text" NOT NULL,
    "description" "text",
    "theme" "text",
    "package_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "travel_charges" numeric(12,2) DEFAULT 0,
    "setup_charges" numeric(12,2) DEFAULT 0,
    "inclusions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "themes_available" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "setup_time" "text",
    "teardown_included" boolean DEFAULT true,
    "venue_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "teardown_time" "text",
    CONSTRAINT "decorator_packages_advance_percentage_check" CHECK ((("advance_percentage" >= 0) AND ("advance_percentage" <= 100))),
    CONSTRAINT "decorator_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 150))),
    CONSTRAINT "decorator_packages_package_price_check" CHECK (("package_price" >= (0)::numeric)),
    CONSTRAINT "decorator_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: delivery_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."delivery_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "free_radius_km" numeric(6,2) NOT NULL,
    "distance_km" numeric(8,2) NOT NULL,
    "charge" numeric(12,2) NOT NULL,
    "is_free_delivery" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: dj_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."dj_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dj_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: dj_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."dj_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "city" "text",
    "expected_audience" integer,
    "song_requests" "text",
    "special_instructions" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "dj_bookings_addons_amount_check" CHECK (("addons_amount" >= (0)::numeric)),
    CONSTRAINT "dj_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "dj_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "dj_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: dj_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."dj_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dj_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: dj_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."dj_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "event_type" "text",
    "package_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "travel_charges" numeric(12,2) DEFAULT 0,
    "extra_hour_charges" numeric(12,2) DEFAULT 0,
    "outside_city_charges" numeric(12,2) DEFAULT 0,
    "equipment_transport_charges" numeric(12,2) DEFAULT 0,
    "performance_duration" "text" DEFAULT '4 Hours'::"text",
    "music_genres" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "event_coverage" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "equipment" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "dj_count" integer DEFAULT 1,
    "assistant_djs" integer DEFAULT 0,
    "sound_engineers" integer DEFAULT 0,
    "lighting_operators" integer DEFAULT 0,
    "technicians" integer DEFAULT 0,
    "stage_crew" integer DEFAULT 0,
    "mc_host" boolean DEFAULT false,
    "deliverables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "languages_supported" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "crowd_capacity" "text",
    "playlist_requests_allowed" boolean DEFAULT true,
    "explicit_songs_allowed" boolean DEFAULT false,
    "setup_time" "text",
    "stage_size" "text",
    "backup_equipment" boolean DEFAULT false,
    "mc_name" "text",
    "mc_experience" "text",
    "generator_charges" numeric(12,2) DEFAULT 0,
    CONSTRAINT "dj_packages_advance_percentage_check" CHECK ((("advance_percentage" >= 0) AND ("advance_percentage" <= 100))),
    CONSTRAINT "dj_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 150))),
    CONSTRAINT "dj_packages_package_price_check" CHECK (("package_price" >= (0)::numeric)),
    CONSTRAINT "dj_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: drone_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."drone_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "drone_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: drone_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."drone_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "coverage_duration" "text",
    "venue" "text",
    "indoor_outdoor" "text" DEFAULT 'outdoor'::"text",
    "drone_permission_available" boolean DEFAULT false,
    "restricted_area" boolean DEFAULT false,
    "special_requests" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "city" "text",
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "drone_bookings_addons_amount_check" CHECK (("addons_amount" >= (0)::numeric)),
    CONSTRAINT "drone_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "drone_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "drone_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: drone_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."drone_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "alt_text" "text",
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "drone_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: drone_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."drone_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "starting_price" numeric(12,2),
    "fixed_price" numeric(12,2),
    "hourly_price" numeric(12,2),
    "half_day_price" numeric(12,2),
    "full_day_price" numeric(12,2),
    "service_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "coverage_type" "text" DEFAULT 'photos_videos'::"text",
    "coverage_durations" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "drone_brand" "text",
    "drone_model" "text",
    "camera_resolution" "text" DEFAULT '4K'::"text",
    "drone_features" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "deliverables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "delivery_time" "text",
    "coverage_includes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "travel_within_city" boolean DEFAULT true NOT NULL,
    "travel_outside_city" boolean DEFAULT false NOT NULL,
    "max_travel_km" integer,
    "cancellation_policy" "text",
    "weather_policy" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "package_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "travel_charges_amount" numeric(12,2) DEFAULT 0,
    "extra_flight_hour_charges" numeric(12,2) DEFAULT 0,
    "flexible_pricing" boolean DEFAULT false,
    "max_flight_time" "text",
    "flights_included" integer DEFAULT 1,
    "battery_count" integer DEFAULT 2,
    "coverage_indoor" boolean DEFAULT false,
    "coverage_outdoor" boolean DEFAULT true,
    "travel_radius_km" integer,
    CONSTRAINT "drone_packages_advance_percentage_check" CHECK ((("advance_percentage" >= 0) AND ("advance_percentage" <= 100))),
    CONSTRAINT "drone_packages_coverage_type_check" CHECK (("coverage_type" = ANY (ARRAY['photos_only'::"text", 'videos_only'::"text", 'photos_videos'::"text"]))),
    CONSTRAINT "drone_packages_fixed_price_check" CHECK (("fixed_price" >= (0)::numeric)),
    CONSTRAINT "drone_packages_full_day_price_check" CHECK (("full_day_price" >= (0)::numeric)),
    CONSTRAINT "drone_packages_half_day_price_check" CHECK (("half_day_price" >= (0)::numeric)),
    CONSTRAINT "drone_packages_hourly_price_check" CHECK (("hourly_price" >= (0)::numeric)),
    CONSTRAINT "drone_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 150))),
    CONSTRAINT "drone_packages_package_price_check" CHECK (("package_price" >= (0)::numeric)),
    CONSTRAINT "drone_packages_starting_price_check" CHECK (("starting_price" >= (0)::numeric)),
    CONSTRAINT "drone_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: event_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."event_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "location" "text" NOT NULL,
    "guest_count" integer NOT NULL,
    "total_budget" integer NOT NULL,
    "status" "text" DEFAULT 'planning'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_bookings_status_check" CHECK (("status" = ANY (ARRAY['planning'::"text", 'pending'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


--
-- Name: event_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."event_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: featured_artists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."featured_artists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "featured_by" "uuid",
    "featured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: hall_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."hall_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hall_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: hall_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."hall_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hall_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text", '360'::"text", 'drone'::"text"])))
);


--
-- Name: invoice_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."invoice_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "platform_fee" integer NOT NULL,
    "total_amount" integer NOT NULL,
    "status" "text" DEFAULT 'paid'::"text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_at" timestamp with time zone,
    "invoice_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."login_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "attempt_type" "text" NOT NULL,
    "success" boolean NOT NULL,
    "failure_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "login_attempts_attempt_type_check" CHECK (("attempt_type" = ANY (ARRAY['otp_request'::"text", 'otp_verify'::"text", 'login'::"text"])))
);


--
-- Name: makeup_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."makeup_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "makeup_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: makeup_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."makeup_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "city" "text",
    "special_requirements" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "makeup_bookings_addons_amount_check" CHECK (("addons_amount" >= (0)::numeric)),
    CONSTRAINT "makeup_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "makeup_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "makeup_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: makeup_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."makeup_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "makeup_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: makeup_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."makeup_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "package_type" "text" NOT NULL,
    "description" "text",
    "package_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "travel_charges" numeric(12,2) DEFAULT 0,
    "outside_city_charges" numeric(12,2) DEFAULT 0,
    "touchup_charges" numeric(12,2) DEFAULT 0,
    "early_morning_charges" numeric(12,2) DEFAULT 0,
    "late_night_charges" numeric(12,2) DEFAULT 0,
    "services_included" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "brands_used" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "skin_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "deliverables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "lead_artist" integer DEFAULT 1,
    "assistant_artists" integer DEFAULT 0,
    "hair_stylists" integer DEFAULT 0,
    "saree_drapers" integer DEFAULT 0,
    "male_grooming_artist" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "makeup_packages_advance_percentage_check" CHECK ((("advance_percentage" >= 0) AND ("advance_percentage" <= 100))),
    CONSTRAINT "makeup_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 150))),
    CONSTRAINT "makeup_packages_package_price_check" CHECK (("package_price" >= (0)::numeric)),
    CONSTRAINT "makeup_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: mehendi_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."mehendi_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mehendi_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: mehendi_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."mehendi_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "city" "text",
    "num_clients" integer DEFAULT 1,
    "special_requirements" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "mehendi_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "mehendi_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "mehendi_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: mehendi_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."mehendi_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mehendi_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: mehendi_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."mehendi_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "package_type" "text" NOT NULL,
    "description" "text",
    "package_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "price_per_hand" numeric(12,2) DEFAULT 0,
    "price_per_person" numeric(12,2) DEFAULT 0,
    "travel_charges" numeric(12,2) DEFAULT 0,
    "outside_city_charges" numeric(12,2) DEFAULT 0,
    "group_discount" numeric(12,2) DEFAULT 0,
    "festival_charges" numeric(12,2) DEFAULT 0,
    "design_styles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "coverage" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "clients_included" integer DEFAULT 1,
    "inclusions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "deliverables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "lead_artist" integer DEFAULT 1,
    "assistant_artists" integer DEFAULT 0,
    "max_clients" integer DEFAULT 5,
    "bridal_specialist" boolean DEFAULT false,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mehendi_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 150))),
    CONSTRAINT "mehendi_packages_package_price_check" CHECK (("package_price" >= (0)::numeric)),
    CONSTRAINT "mehendi_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "dish_name" "text" NOT NULL,
    "category" "text",
    "description" "text",
    "image_url" "text",
    "price_per_plate" numeric DEFAULT 0,
    "min_order" integer DEFAULT 1,
    "max_capacity" integer,
    "is_available" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "message_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "attachment_url" "text",
    "file_name" "text",
    "file_size" bigint,
    "mime_type" "text",
    "latitude" double precision,
    "longitude" double precision,
    "location_label" "text",
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "reply_to_id" "uuid",
    CONSTRAINT "messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'video'::"text", 'file'::"text", 'location'::"text"])))
);


--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sms_enabled" boolean DEFAULT true,
    "email_enabled" boolean DEFAULT true,
    "push_enabled" boolean DEFAULT true,
    "booking_notifications" boolean DEFAULT true,
    "payment_notifications" boolean DEFAULT true,
    "marketing_notifications" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "reference_id" "uuid",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: otp_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."otp_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "ip_address" "text",
    "request_count" integer DEFAULT 1,
    "window_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."otp_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "otp_hash" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "attempts" integer DEFAULT 0,
    "expires_at" timestamp with time zone NOT NULL,
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "platform_fee" integer DEFAULT 0,
    "provider_amount" integer NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "payment_method" "text",
    "transaction_id" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: photographer_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photographer_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "photographer_id" "uuid" NOT NULL,
    "available_date" "date" NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "note" "text"
);


--
-- Name: photography_albums; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_albums" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "size" "text" NOT NULL,
    "pages" integer NOT NULL,
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "photography_albums_pages_check" CHECK (("pages" > 0)),
    CONSTRAINT "photography_albums_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "photography_albums_size_check" CHECK ((("char_length"(TRIM(BOTH FROM "size")) >= 1) AND ("char_length"(TRIM(BOTH FROM "size")) <= 80))),
    CONSTRAINT "photography_albums_type_check" CHECK ((("char_length"(TRIM(BOTH FROM "type")) >= 1) AND ("char_length"(TRIM(BOTH FROM "type")) <= 120)))
);


--
-- Name: photography_booking_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_booking_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "event_type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: photography_cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cart_id" "uuid" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "album_id" "uuid",
    CONSTRAINT "photography_cart_items_quantity_check" CHECK (("quantity" > 0))
);


--
-- Name: photography_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "photographer_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "photography_carts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'checked_out'::"text", 'abandoned'::"text"])))
);


--
-- Name: photography_package_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_package_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "photography_package_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: photography_package_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_package_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "photographer_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "notes" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "selected_album_id" "uuid",
    "album_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "selected_album_details" "jsonb",
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "city" "text",
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "photography_package_bookings_album_amount_check" CHECK (("album_amount" >= (0)::numeric)),
    CONSTRAINT "photography_package_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


--
-- Name: photography_package_highlights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_package_highlights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


--
-- Name: photography_package_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_package_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "alt_text" "text",
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: photography_package_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_package_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "photography_package_invoices_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "photography_package_invoices_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'void'::"text"])))
);


--
-- Name: photography_package_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_package_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_method" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "photography_package_payments_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "photography_package_payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"])))
);


--
-- Name: photography_package_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_package_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "review_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "photography_package_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


--
-- Name: photography_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "photographer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "duration" "text",
    "album_included" boolean DEFAULT false NOT NULL,
    "album_details" "text",
    "travel_included" boolean DEFAULT false NOT NULL,
    "travel_details" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "photography_type" "text",
    "team_size" integer,
    "team_size_custom" integer,
    "edited_photos" integer,
    "raw_photos_included" boolean DEFAULT false NOT NULL,
    "album_type" "text",
    "album_size" "text",
    "album_pages" integer,
    "travel_radius_km" numeric(8,2),
    "travel_extra_charge" numeric(12,2),
    "delivery_time" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "package_type" "text" DEFAULT 'photography_only'::"text",
    "videography_included" boolean DEFAULT false,
    "videography_team_videographers" integer DEFAULT 1,
    "videography_team_assistants" integer DEFAULT 0,
    "videography_team_drone_operator" boolean DEFAULT false,
    "videography_coverage_hours" "text",
    "videography_deliverables" "text"[] DEFAULT '{}'::"text"[],
    "videography_delivery_time" "text",
    "videography_equipment" "text"[] DEFAULT '{}'::"text"[],
    "videography_editing_options" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "photography_packages_album_pages_check" CHECK ((("album_pages" IS NULL) OR ("album_pages" > 0))),
    CONSTRAINT "photography_packages_edited_photos_check" CHECK ((("edited_photos" IS NULL) OR ("edited_photos" >= 0))),
    CONSTRAINT "photography_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 120))),
    CONSTRAINT "photography_packages_package_type_check" CHECK (("package_type" = ANY (ARRAY['photography_only'::"text", 'videography_only'::"text", 'photography_and_videography'::"text"]))),
    CONSTRAINT "photography_packages_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "photography_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"]))),
    CONSTRAINT "photography_packages_team_size_check" CHECK ((("team_size" IS NULL) OR ("team_size" > 0))),
    CONSTRAINT "photography_packages_team_size_custom_check" CHECK ((("team_size_custom" IS NULL) OR ("team_size_custom" > 0))),
    CONSTRAINT "photography_packages_travel_check" CHECK (((("travel_radius_km" IS NULL) OR ("travel_radius_km" >= (0)::numeric)) AND (("travel_extra_charge" IS NULL) OR ("travel_extra_charge" >= (0)::numeric))))
);


--
-- Name: COLUMN "photography_packages"."package_type"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."photography_packages"."package_type" IS 'Package type: photography_only, videography_only, or photography_and_videography';


--
-- Name: COLUMN "photography_packages"."videography_included"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."photography_packages"."videography_included" IS 'Indicates if this combined package includes videography services';


--
-- Name: COLUMN "photography_packages"."videography_team_videographers"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."photography_packages"."videography_team_videographers" IS 'Number of videographers for combined packages';


--
-- Name: COLUMN "photography_packages"."videography_coverage_hours"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."photography_packages"."videography_coverage_hours" IS 'Videography coverage hours for combined packages';


--
-- Name: photography_videography_package_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_videography_package_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "addon_name_length" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 100))),
    CONSTRAINT "photography_videography_package_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: photography_videography_package_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_videography_package_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "notes" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "photography_videography_package_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "photography_videography_package_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "photography_videography_package_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: photography_videography_package_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_videography_package_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "alt_text" "text",
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text",
    "duration_seconds" integer,
    "thumbnail_url" "text",
    CONSTRAINT "photography_videography_package_images_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: COLUMN "photography_videography_package_images"."media_type"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."photography_videography_package_images"."media_type" IS 'Type of media: image or video';


--
-- Name: COLUMN "photography_videography_package_images"."duration_seconds"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."photography_videography_package_images"."duration_seconds" IS 'Duration for videos in seconds';


--
-- Name: COLUMN "photography_videography_package_images"."thumbnail_url"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."photography_videography_package_images"."thumbnail_url" IS 'Thumbnail URL for videos';


--
-- Name: photography_videography_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."photography_videography_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "package_type" "text" NOT NULL,
    "price" numeric(12,2) NOT NULL,
    "duration" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "view_count" integer DEFAULT 0 NOT NULL,
    "photography_team_size" integer DEFAULT 1,
    "photography_team_size_custom" "text",
    "photography_edited_photos" integer,
    "photography_unlimited_edited" boolean DEFAULT false,
    "photography_raw_photos_included" boolean DEFAULT false,
    "photography_album_included" boolean DEFAULT false,
    "photography_album_details" "text",
    "photography_pre_event_shoot" boolean DEFAULT false,
    "photography_deliverables" "text"[] DEFAULT '{}'::"text"[],
    "photography_delivery_time" "text",
    "videography_team_videographers" integer DEFAULT 1,
    "videography_team_assistants" integer DEFAULT 0,
    "videography_team_drone_operator" boolean DEFAULT false,
    "videography_team_editor" integer DEFAULT 1,
    "videography_coverage_hours" "text",
    "videography_event_types" "text"[] DEFAULT '{}'::"text"[],
    "videography_included_services" "text"[] DEFAULT '{}'::"text"[],
    "videography_deliverables" "text"[] DEFAULT '{}'::"text"[],
    "videography_delivery_time" "text",
    "videography_equipment" "text"[] DEFAULT '{}'::"text"[],
    "videography_editing_options" "text"[] DEFAULT '{}'::"text"[],
    "videography_pre_event_shoot" boolean DEFAULT false,
    "travel_included" boolean DEFAULT false,
    "travel_radius_km" integer,
    "travel_extra_charge" numeric(12,2),
    "travel_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "advance_percentage" numeric(3,1) DEFAULT 20,
    "event_type" "text",
    CONSTRAINT "photography_videography_packages_advance_percentage_check" CHECK ((("advance_percentage" >= (0)::numeric) AND ("advance_percentage" <= (100)::numeric))),
    CONSTRAINT "photography_videography_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 150))),
    CONSTRAINT "photography_videography_packages_package_type_check" CHECK (("package_type" = ANY (ARRAY['photography_only'::"text", 'videography_only'::"text", 'photography_and_videography'::"text"]))),
    CONSTRAINT "photography_videography_packages_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "photography_videography_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'archived'::"text"])))
);


--
-- Name: COLUMN "photography_videography_packages"."advance_percentage"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."photography_videography_packages"."advance_percentage" IS 'Advance percentage required (0-100), default 20%';


--
-- Name: COLUMN "photography_videography_packages"."event_type"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."photography_videography_packages"."event_type" IS 'Event type: Wedding, Engagement, etc.';


--
-- Name: planner_recommendation_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."planner_recommendation_candidates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "rank_position" integer NOT NULL,
    "match_score" numeric(6,2) NOT NULL,
    "reason_breakdown" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "availability_status" "text" NOT NULL,
    "availability_checked_at" timestamp with time zone,
    "evidence_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "planner_recommendation_candidates_availability_status_check" CHECK (("availability_status" = ANY (ARRAY['not_checked'::"text", 'needs_confirmation'::"text", 'unavailable'::"text", 'confirmed'::"text"]))),
    CONSTRAINT "planner_recommendation_candidates_match_score_check" CHECK (("match_score" >= (0)::numeric)),
    CONSTRAINT "planner_recommendation_candidates_rank_position_check" CHECK (("rank_position" > 0))
);


--
-- Name: planner_recommendation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."planner_recommendation_runs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "conversation_id" "uuid",
    "message_id" "uuid",
    "intent" "text" NOT NULL,
    "search_criteria" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "algorithm_version" "text" DEFAULT 'planner-ranking-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


--
-- Name: platform_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."platform_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "total_bookings" integer DEFAULT 0,
    "total_revenue" integer DEFAULT 0,
    "total_commission" integer DEFAULT 0,
    "active_providers" integer DEFAULT 0,
    "active_customers" integer DEFAULT 0,
    "new_registrations" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."platform_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


--
-- Name: pooja_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pooja_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "pooja_name" "text" NOT NULL,
    "religion" "text" DEFAULT 'Hindu'::"text",
    "description" "text",
    "price" numeric DEFAULT 0,
    "duration_minutes" integer,
    "materials_included" boolean DEFAULT false,
    "materials_note" "text",
    "image_url" "text",
    "is_available" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: portfolio_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."portfolio_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "media_url" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "title" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text",
    "style_tag" "text",
    "event_name" "text",
    "is_published" boolean DEFAULT false,
    CONSTRAINT "portfolio_items_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: pricing_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pricing_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" integer NOT NULL,
    "duration" "text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: priest_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."priest_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "priest_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: priest_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."priest_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "city" "text",
    "special_instructions" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "priest_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "priest_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "priest_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: priest_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."priest_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "priest_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: priest_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."priest_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "package_type" "text" NOT NULL,
    "description" "text",
    "service_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "dakshina_included" boolean DEFAULT false,
    "travel_charges" numeric(12,2) DEFAULT 0,
    "outside_city_charges" numeric(12,2) DEFAULT 0,
    "extra_ritual_charges" numeric(12,2) DEFAULT 0,
    "extra_hours_charges" numeric(12,2) DEFAULT 0,
    "materials_included" boolean DEFAULT false,
    "service_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "duration" "text",
    "required_materials" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "temple_required" boolean DEFAULT false,
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "years_of_experience" integer,
    "included_services" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "available_cities" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "travel_distance" "text",
    "daily_capacity" integer DEFAULT 2,
    "max_bookings_per_day" integer DEFAULT 2,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "priest_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 200))),
    CONSTRAINT "priest_packages_service_price_check" CHECK (("service_price" >= (0)::numeric)),
    CONSTRAINT "priest_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: product_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."product_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "variant_id" "uuid" NOT NULL,
    "product_name" "text" NOT NULL,
    "variant_label" "text" NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "quantity" integer NOT NULL,
    "line_total" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_order_items_line_total_check" CHECK (("line_total" >= (0)::numeric)),
    CONSTRAINT "product_order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "product_order_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


--
-- Name: product_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."product_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "delivery_address" "text" NOT NULL,
    "delivery_lat" numeric(10,7) NOT NULL,
    "delivery_lng" numeric(10,7) NOT NULL,
    "delivery_date" "date" NOT NULL,
    "delivery_time_slot" "text",
    "estimated_delivery_minutes" integer,
    "distance_km" numeric(8,2) NOT NULL,
    "subtotal" numeric(12,2) NOT NULL,
    "delivery_charge" numeric(12,2) NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_orders_delivery_charge_check" CHECK (("delivery_charge" >= (0)::numeric)),
    CONSTRAINT "product_orders_distance_km_check" CHECK (("distance_km" >= (0)::numeric)),
    CONSTRAINT "product_orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"]))),
    CONSTRAINT "product_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'preparing'::"text", 'out_for_delivery'::"text", 'delivered'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "product_orders_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "product_orders_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: provider_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."provider_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "unavailable_date" "date" NOT NULL,
    "time_slot_start" time without time zone,
    "time_slot_end" time without time zone,
    "slot_type" "text" DEFAULT 'unavailable'::"text",
    "reason" "text",
    CONSTRAINT "provider_availability_slot_type_check" CHECK (("slot_type" = ANY (ARRAY['available'::"text", 'unavailable'::"text", 'busy'::"text"])))
);


--
-- Name: provider_calendar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."provider_calendar" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "is_available" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: provider_faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."provider_faqs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: provider_time_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."provider_time_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_time_slots_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."refresh_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "device_info" "jsonb",
    "ip_address" "inet",
    "expires_at" timestamp with time zone NOT NULL,
    "is_revoked" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: rental_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rental_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rental_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: rental_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rental_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "rental_duration" "text",
    "delivery_address" "text",
    "city" "text",
    "quantity_required" integer DEFAULT 1 NOT NULL,
    "special_instructions" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "inventory_reserved" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "rental_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "rental_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "rental_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: rental_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rental_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rental_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text", 'setup'::"text"])))
);


--
-- Name: rental_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rental_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "category" "text",
    "image_url" "text",
    "description" "text",
    "quantity_available" integer DEFAULT 1,
    "price_per_day" numeric DEFAULT 0,
    "price_per_event" numeric DEFAULT 0,
    "security_deposit" numeric DEFAULT 0,
    "delivery_charges" numeric DEFAULT 0,
    "available_locations" "text"[] DEFAULT '{}'::"text"[],
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: rental_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rental_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "package_type" "text" NOT NULL,
    "description" "text",
    "rental_type" "text" DEFAULT 'per_event'::"text" NOT NULL,
    "price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "security_deposit" numeric(12,2) DEFAULT 0,
    "transportation_charges" numeric(12,2) DEFAULT 0,
    "installation_charges" numeric(12,2) DEFAULT 0,
    "outside_city_charges" numeric(12,2) DEFAULT 0,
    "extra_hour_charges" numeric(12,2) DEFAULT 0,
    "late_return_charges" numeric(12,2) DEFAULT 0,
    "rental_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "included_items" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "inventory_quantity" integer DEFAULT 1,
    "available_units" integer DEFAULT 1,
    "delivery_radius" "text",
    "available_cities" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "setup_time" "text",
    "delivery_time" "text",
    "pickup_time" "text",
    "installation_team" "text",
    "support_contact" "text",
    "emergency_contact" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rental_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 200))),
    CONSTRAINT "rental_packages_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "rental_packages_rental_type_check" CHECK (("rental_type" = ANY (ARRAY['per_event'::"text", 'per_day'::"text", 'per_hour'::"text", 'package_price'::"text"]))),
    CONSTRAINT "rental_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: reschedule_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."reschedule_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "booking_table" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider_id" "text" NOT NULL,
    "original_date" "date" NOT NULL,
    "original_time" "text",
    "requested_date" "date" NOT NULL,
    "requested_time" "text",
    "reason" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "decided_by" "uuid",
    "decided_at" timestamp with time zone,
    "decline_reason" "text",
    "refund_eligible" boolean DEFAULT false,
    "original_amount_paid" numeric(10,2) DEFAULT 0,
    "refund_percentage" numeric(5,2) DEFAULT 80,
    "refund_amount" numeric(10,2) DEFAULT 0,
    "refund_status" "text" DEFAULT 'none'::"text",
    "refund_initiated_at" timestamp with time zone,
    "refund_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reschedule_requests_refund_status_check" CHECK (("refund_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "reschedule_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'declined'::"text", 'cancelled'::"text"])))
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "review_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


--
-- Name: search_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."search_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "search_query" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb",
    "results_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "endpoint" "text",
    "resource_type" "text",
    "resource_id" "text",
    "action" "text",
    "result" "text",
    "http_status" integer,
    "reason" "text",
    "risk_score" integer DEFAULT 0,
    "user_agent" "text",
    "is_authenticated" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "security_events_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100))),
    CONSTRAINT "security_events_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text", 'info'::"text"])))
);


--
-- Name: singer_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."singer_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "singer_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: singer_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."singer_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "city" "text",
    "special_requirements" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_deadline" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "singer_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "singer_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "singer_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: singer_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."singer_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: singer_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."singer_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "package_type" "text",
    "description" "text",
    "package_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "performance_duration" "text",
    "number_of_sets" "text",
    "set_duration" "text",
    "break_duration" "text",
    "performance_style" "text",
    "event_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "music_styles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "equipment_included" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "team_members" "text",
    "lead_singer" "text",
    "supporting_vocalist" "text",
    "guitarist" "text",
    "keyboardist" "text",
    "percussionist" "text",
    "deliverables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "singer_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 200))),
    CONSTRAINT "singer_packages_package_price_check" CHECK (("package_price" >= (0)::numeric)),
    CONSTRAINT "singer_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."subcategories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: supplier_delivery_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_delivery_settings" (
    "provider_id" "uuid" NOT NULL,
    "delivery_origin_lat" numeric(10,7),
    "delivery_origin_lng" numeric(10,7),
    "max_delivery_radius_km" numeric(6,2) DEFAULT 50 NOT NULL,
    "free_delivery_radius_km" numeric(6,2) DEFAULT 5 NOT NULL,
    "extra_delivery_charge" numeric(12,2) DEFAULT 100 NOT NULL,
    "same_day_delivery_enabled" boolean DEFAULT false NOT NULL,
    "emergency_delivery_enabled" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supplier_delivery_settings_check" CHECK (("free_delivery_radius_km" <= "max_delivery_radius_km")),
    CONSTRAINT "supplier_delivery_settings_delivery_origin_lat_check" CHECK ((("delivery_origin_lat" IS NULL) OR (("delivery_origin_lat" >= ('-90'::integer)::numeric) AND ("delivery_origin_lat" <= (90)::numeric)))),
    CONSTRAINT "supplier_delivery_settings_delivery_origin_lng_check" CHECK ((("delivery_origin_lng" IS NULL) OR (("delivery_origin_lng" >= ('-180'::integer)::numeric) AND ("delivery_origin_lng" <= (180)::numeric)))),
    CONSTRAINT "supplier_delivery_settings_extra_delivery_charge_check" CHECK (("extra_delivery_charge" >= (0)::numeric)),
    CONSTRAINT "supplier_delivery_settings_free_delivery_radius_km_check" CHECK (("free_delivery_radius_km" >= (0)::numeric)),
    CONSTRAINT "supplier_delivery_settings_max_delivery_radius_km_check" CHECK (("max_delivery_radius_km" > (0)::numeric))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'customer'::"public"."app_role" NOT NULL
);


--
-- Name: vendor_cancellations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."vendor_cancellations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "booking_table" "text" NOT NULL,
    "vendor_id" "text" NOT NULL,
    "vendor_user_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "total_booking_cost" numeric(10,2) NOT NULL,
    "penalty_percentage" numeric(5,2) DEFAULT 30 NOT NULL,
    "penalty_amount" numeric(10,2) NOT NULL,
    "customer_advance_paid" numeric(10,2) DEFAULT 0 NOT NULL,
    "customer_refund_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "customer_refund_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "reason" "text",
    "cancelled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vendor_cancellations_customer_refund_status_check" CHECK (("customer_refund_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'completed'::"text", 'failed'::"text"])))
);


--
-- Name: vendor_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."vendor_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "embedding_sm" "public"."vector"(384),
    "content_type" "text" DEFAULT 'profile'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: vendor_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."vendor_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "booking_table" "text" NOT NULL,
    "vendor_id" "text" NOT NULL,
    "vendor_user_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "booking_amount" numeric(12,2) NOT NULL,
    "platform_fee_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "platform_fee_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "vendor_earnings" numeric(12,2) DEFAULT 0 NOT NULL,
    "advance_paid" numeric(12,2) DEFAULT 0 NOT NULL,
    "remaining_due" numeric(12,2) DEFAULT 0 NOT NULL,
    "settlement_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "settled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vendor_settlements_settlement_status_check" CHECK (("settlement_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'settled'::"text", 'failed'::"text", 'disputed'::"text"])))
);


--
-- Name: videography_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."videography_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "videography_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: videography_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."videography_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "event_time" "text",
    "venue" "text",
    "notes" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "city" "text",
    "special_requirements" "text",
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "videography_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "videography_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "videography_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: videography_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."videography_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "videography_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: videography_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."videography_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "starting_price" numeric(12,2),
    "full_day_price" numeric(12,2),
    "half_day_price" numeric(12,2),
    "hourly_price" numeric(12,2),
    "extra_hour_cost" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "coverage_hours" "text",
    "event_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "included_services" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "deliverables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "delivery_time" "text",
    "equipment" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "editing_options" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "team_videographers" integer DEFAULT 1,
    "team_assistants" integer DEFAULT 0,
    "team_drone_operator" boolean DEFAULT false,
    "team_editor" integer DEFAULT 1,
    "team_live_operator" boolean DEFAULT false,
    "travel_within_city" boolean DEFAULT true,
    "travel_outside_city" boolean DEFAULT false,
    "max_travel_km" integer,
    "cancellation_policy" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_type" "text",
    "package_price" numeric(12,2),
    "travel_charges" numeric(12,2) DEFAULT 0,
    "extra_coverage_cost" numeric(12,2) DEFAULT 0,
    "num_cameras" integer DEFAULT 1,
    "coverage_includes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "live_streaming" boolean DEFAULT false,
    "recording_4k" boolean DEFAULT true,
    "multi_camera" boolean DEFAULT false,
    "cinematic_coverage" boolean DEFAULT true,
    "package_type" "text" DEFAULT 'videography_only'::"text",
    "photography_included" boolean DEFAULT false,
    "photography_team_size" integer DEFAULT 1,
    "photography_team_size_custom" "text",
    "photography_edited_photos" integer,
    "photography_unlimited_edited" boolean DEFAULT false,
    "photography_album_included" boolean DEFAULT false,
    "photography_album_details" "text",
    "photography_deliverables" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "videography_packages_advance_percentage_check" CHECK ((("advance_percentage" >= 0) AND ("advance_percentage" <= 100))),
    CONSTRAINT "videography_packages_extra_coverage_cost_check" CHECK (("extra_coverage_cost" >= (0)::numeric)),
    CONSTRAINT "videography_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 150))),
    CONSTRAINT "videography_packages_package_price_check" CHECK (("package_price" >= (0)::numeric)),
    CONSTRAINT "videography_packages_package_type_check" CHECK (("package_type" = ANY (ARRAY['photography_only'::"text", 'videography_only'::"text", 'photography_and_videography'::"text"]))),
    CONSTRAINT "videography_packages_starting_price_check" CHECK (("starting_price" >= (0)::numeric)),
    CONSTRAINT "videography_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'archived'::"text"]))),
    CONSTRAINT "videography_packages_travel_charges_check" CHECK (("travel_charges" >= (0)::numeric))
);


--
-- Name: COLUMN "videography_packages"."package_type"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."videography_packages"."package_type" IS 'Package type: photography_only, videography_only, or photography_and_videography';


--
-- Name: COLUMN "videography_packages"."photography_included"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."videography_packages"."photography_included" IS 'Indicates if this combined package includes photography services';


--
-- Name: COLUMN "videography_packages"."photography_team_size"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."videography_packages"."photography_team_size" IS 'Number of photographers for combined packages';


--
-- Name: water_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."water_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "water_addons_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: water_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."water_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text",
    "event_date" "date" NOT NULL,
    "delivery_time" "text",
    "delivery_address" "text",
    "city" "text",
    "quantity_required" "text",
    "special_instructions" "text",
    "selected_addon_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "base_amount" numeric(12,2) NOT NULL,
    "addons_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) DEFAULT 0,
    "remaining_amount" numeric(12,2) DEFAULT 0,
    "payment_deadline" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "advance_paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "calendar_locked" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_requested_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "work_started_at" timestamp with time zone,
    "work_completed_at" timestamp with time zone,
    "settlement_status" "text" DEFAULT 'none'::"text",
    CONSTRAINT "water_bookings_base_amount_check" CHECK (("base_amount" >= (0)::numeric)),
    CONSTRAINT "water_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "water_bookings_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


--
-- Name: water_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."water_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: water_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."water_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "water_gallery_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


--
-- Name: water_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."water_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "package_type" "text" NOT NULL,
    "description" "text",
    "pricing_type" "text" DEFAULT 'per_can'::"text" NOT NULL,
    "base_price" numeric(12,2),
    "advance_percentage" integer DEFAULT 20,
    "transportation_charges" numeric(12,2) DEFAULT 0,
    "outside_city_charges" numeric(12,2) DEFAULT 0,
    "night_delivery_charges" numeric(12,2) DEFAULT 0,
    "emergency_delivery_charges" numeric(12,2) DEFAULT 0,
    "additional_tank_charges" numeric(12,2) DEFAULT 0,
    "discount_percentage" integer DEFAULT 0,
    "supply_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "supply_features" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "available_cities" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "delivery_radius" "text",
    "available_time_slots" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "max_deliveries_per_day" integer DEFAULT 10,
    "fleet_capacity" "text",
    "vehicle_type" "text",
    "delivery_team_size" "text",
    "delivery_time" "text",
    "installation_included" boolean DEFAULT false,
    "water_dispenser_available" boolean DEFAULT false,
    "stand_included" boolean DEFAULT false,
    "cooling_unit_available" boolean DEFAULT false,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "water_packages_base_price_check" CHECK (("base_price" >= (0)::numeric)),
    CONSTRAINT "water_packages_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 200))),
    CONSTRAINT "water_packages_pricing_type_check" CHECK (("pricing_type" = ANY (ARRAY['per_can'::"text", 'per_litre'::"text", 'per_tanker'::"text", 'per_event'::"text", 'custom_quote'::"text"]))),
    CONSTRAINT "water_packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text"])))
);


--
-- Name: water_product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."water_product_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "alt_text" "text",
    "is_cover" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: water_product_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."water_product_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "review_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "water_product_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


--
-- Name: water_product_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."water_product_stock" (
    "variant_id" "uuid" NOT NULL,
    "quantity_available" integer DEFAULT 0 NOT NULL,
    "low_stock_threshold" integer DEFAULT 5 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "water_product_stock_low_stock_threshold_check" CHECK (("low_stock_threshold" >= 0)),
    CONSTRAINT "water_product_stock_quantity_available_check" CHECK (("quantity_available" >= 0))
);


--
-- Name: water_product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."water_product_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "size_value" numeric(12,3),
    "size_unit" "text",
    "price" numeric(12,2) NOT NULL,
    "sku" "text",
    "is_available" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "water_product_variants_label_check" CHECK ((("char_length"(TRIM(BOTH FROM "label")) >= 1) AND ("char_length"(TRIM(BOTH FROM "label")) <= 80))),
    CONSTRAINT "water_product_variants_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: water_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."water_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "unit_type" "text" NOT NULL,
    "water_quality" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "delivery_options" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "delivery_time_minutes" integer DEFAULT 30 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "is_best_seller" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "water_products_delivery_time_minutes_check" CHECK ((("delivery_time_minutes" >= 1) AND ("delivery_time_minutes" <= 1440))),
    CONSTRAINT "water_products_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 120))),
    CONSTRAINT "water_products_unit_type_check" CHECK (("unit_type" = ANY (ARRAY['bottle'::"text", 'can'::"text", 'litre'::"text", 'tanker'::"text", 'box'::"text", '1000l'::"text", '5000l'::"text", '10000l'::"text", 'custom'::"text"]))),
    CONSTRAINT "water_products_view_count_check" CHECK (("view_count" >= 0))
);


--
-- Name: worker_bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."worker_bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "account_holder_name" "text" NOT NULL,
    "account_number" "text" NOT NULL,
    "bank_name" "text" NOT NULL,
    "ifsc_code" "text" NOT NULL,
    "branch_name" "text",
    "is_verified" boolean DEFAULT false,
    "verification_ref_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: worker_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."worker_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "document_url" "text" NOT NULL,
    "document_number" "text",
    "issued_date" "date",
    "expiry_date" "date",
    "verification_status" "text" DEFAULT 'pending'::"text",
    "rejection_reason" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    CONSTRAINT "worker_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['government_id'::"text", 'address_proof'::"text", 'bank_details'::"text", 'portfolio'::"text", 'certification'::"text", 'photo'::"text"]))),
    CONSTRAINT "worker_documents_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


--
-- Name: worker_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."worker_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "gender" "text",
    "profile_photo_url" "text",
    "service_type" "text" NOT NULL,
    "experience_years" integer DEFAULT 0,
    "service_city" "text",
    "service_area" "text",
    "government_id_type" "text",
    "government_id_url" "text",
    "address_proof_url" "text",
    "bank_account_number" "text",
    "bank_ifsc" "text",
    "bank_account_holder" "text",
    "portfolio_urls" "text"[] DEFAULT '{}'::"text"[],
    "verification_status" "public"."verification_status" DEFAULT 'pending'::"public"."verification_status",
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "rejection_reason" "text",
    "date_of_birth" "date",
    "alternate_phone" "text",
    "whatsapp_enabled" boolean DEFAULT true,
    "background_check_completed" boolean DEFAULT false,
    "training_completed" boolean DEFAULT false,
    "onboarded_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL,
    "versioning_status" "text" DEFAULT 'DISABLED'::"text" NOT NULL,
    CONSTRAINT "buckets_versioning_dark_check" CHECK (("versioning_status" = 'DISABLED'::"text")),
    CONSTRAINT "buckets_versioning_standard_only_check" CHECK ((("type" = 'STANDARD'::"storage"."buckettype") OR ("versioning_status" = 'DISABLED'::"text"))),
    CONSTRAINT "buckets_versioning_status_check" CHECK (("versioning_status" = ANY (ARRAY['DISABLED'::"text", 'ENABLED'::"text", 'SUSPENDED'::"text"])))
);


--
-- Name: COLUMN "buckets"."owner"; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb",
    "archived_at" timestamp with time zone,
    "is_delete_marker" boolean DEFAULT false NOT NULL,
    "is_versioned" boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN "objects"."owner"; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb",
    "metadata" "jsonb"
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_identifier_key" UNIQUE ("identifier");


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_pkey" PRIMARY KEY ("id");


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_client_states"
    ADD CONSTRAINT "oauth_client_states_pkey" PRIMARY KEY ("id");


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id");


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id");


--
-- Name: about_team_members about_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."about_team_members"
    ADD CONSTRAINT "about_team_members_pkey" PRIMARY KEY ("id");


--
-- Name: about_us about_us_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."about_us"
    ADD CONSTRAINT "about_us_pkey" PRIMARY KEY ("id");


--
-- Name: admin_event_package_bookings admin_event_package_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_package_bookings"
    ADD CONSTRAINT "admin_event_package_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: admin_event_package_discounts admin_event_package_discounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_package_discounts"
    ADD CONSTRAINT "admin_event_package_discounts_pkey" PRIMARY KEY ("id");


--
-- Name: admin_event_package_inclusions admin_event_package_inclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_package_inclusions"
    ADD CONSTRAINT "admin_event_package_inclusions_pkey" PRIMARY KEY ("id");


--
-- Name: admin_event_packages admin_event_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_packages"
    ADD CONSTRAINT "admin_event_packages_pkey" PRIMARY KEY ("id");


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id");


--
-- Name: ai_message_feedback ai_message_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_message_feedback"
    ADD CONSTRAINT "ai_message_feedback_pkey" PRIMARY KEY ("id");


--
-- Name: ai_message_feedback ai_message_feedback_user_id_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_message_feedback"
    ADD CONSTRAINT "ai_message_feedback_user_id_message_id_key" UNIQUE ("user_id", "message_id");


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id");


--
-- Name: anchor_addons anchor_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."anchor_addons"
    ADD CONSTRAINT "anchor_addons_pkey" PRIMARY KEY ("id");


--
-- Name: anchor_bookings anchor_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."anchor_bookings"
    ADD CONSTRAINT "anchor_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: anchor_gallery anchor_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."anchor_gallery"
    ADD CONSTRAINT "anchor_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: anchor_packages anchor_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."anchor_packages"
    ADD CONSTRAINT "anchor_packages_pkey" PRIMARY KEY ("id");


--
-- Name: artist_bookings artist_bookings_event_id_provider_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."artist_bookings"
    ADD CONSTRAINT "artist_bookings_event_id_provider_id_key" UNIQUE ("event_id", "provider_id");


--
-- Name: artist_bookings artist_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."artist_bookings"
    ADD CONSTRAINT "artist_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: artist_categories artist_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."artist_categories"
    ADD CONSTRAINT "artist_categories_name_key" UNIQUE ("name");


--
-- Name: artist_categories artist_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."artist_categories"
    ADD CONSTRAINT "artist_categories_pkey" PRIMARY KEY ("id");


--
-- Name: artist_categories artist_categories_profession_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."artist_categories"
    ADD CONSTRAINT "artist_categories_profession_type_key" UNIQUE ("profession_type");


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");


--
-- Name: auth_promotion_media auth_promotion_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotion_media"
    ADD CONSTRAINT "auth_promotion_media_pkey" PRIMARY KEY ("id");


--
-- Name: auth_promotion_video_views auth_promotion_video_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotion_video_views"
    ADD CONSTRAINT "auth_promotion_video_views_pkey" PRIMARY KEY ("id");


--
-- Name: auth_promotion_video_views auth_promotion_video_views_unique_user_video; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotion_video_views"
    ADD CONSTRAINT "auth_promotion_video_views_unique_user_video" UNIQUE ("video_id", "user_id");


--
-- Name: auth_promotion_videos auth_promotion_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotion_videos"
    ADD CONSTRAINT "auth_promotion_videos_pkey" PRIMARY KEY ("id");


--
-- Name: auth_promotional_config auth_promotional_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotional_config"
    ADD CONSTRAINT "auth_promotional_config_pkey" PRIMARY KEY ("id");


--
-- Name: band_addons band_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_addons"
    ADD CONSTRAINT "band_addons_pkey" PRIMARY KEY ("id");


--
-- Name: band_bookings band_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_bookings"
    ADD CONSTRAINT "band_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: band_categories band_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_categories"
    ADD CONSTRAINT "band_categories_name_key" UNIQUE ("name");


--
-- Name: band_categories band_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_categories"
    ADD CONSTRAINT "band_categories_pkey" PRIMARY KEY ("id");


--
-- Name: band_categories band_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_categories"
    ADD CONSTRAINT "band_categories_slug_key" UNIQUE ("slug");


--
-- Name: band_gallery band_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_gallery"
    ADD CONSTRAINT "band_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: band_packages band_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_packages"
    ADD CONSTRAINT "band_packages_pkey" PRIMARY KEY ("id");


--
-- Name: bank_details bank_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_details"
    ADD CONSTRAINT "bank_details_pkey" PRIMARY KEY ("id");


--
-- Name: banquet_bookings banquet_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."banquet_bookings"
    ADD CONSTRAINT "banquet_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: banquet_halls banquet_halls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."banquet_halls"
    ADD CONSTRAINT "banquet_halls_pkey" PRIMARY KEY ("id");


--
-- Name: booking_cancellations booking_cancellations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."booking_cancellations"
    ADD CONSTRAINT "booking_cancellations_pkey" PRIMARY KEY ("id");


--
-- Name: booking_events booking_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."booking_events"
    ADD CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id");


--
-- Name: booking_locations booking_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."booking_locations"
    ADD CONSTRAINT "booking_locations_pkey" PRIMARY KEY ("id");


--
-- Name: booking_start_otps booking_start_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."booking_start_otps"
    ADD CONSTRAINT "booking_start_otps_pkey" PRIMARY KEY ("id");


--
-- Name: bookings bookings_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_invoice_number_key" UNIQUE ("invoice_number");


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");


--
-- Name: budget_allocations budget_allocations_event_id_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."budget_allocations"
    ADD CONSTRAINT "budget_allocations_event_id_category_key" UNIQUE ("event_id", "category");


--
-- Name: budget_allocations budget_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."budget_allocations"
    ADD CONSTRAINT "budget_allocations_pkey" PRIMARY KEY ("id");


--
-- Name: catering_addons catering_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_addons"
    ADD CONSTRAINT "catering_addons_pkey" PRIMARY KEY ("id");


--
-- Name: catering_bookings catering_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_bookings"
    ADD CONSTRAINT "catering_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: catering_gallery catering_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_gallery"
    ADD CONSTRAINT "catering_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: catering_menu_items catering_menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_menu_items"
    ADD CONSTRAINT "catering_menu_items_pkey" PRIMARY KEY ("id");


--
-- Name: catering_menu_sections catering_menu_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_menu_sections"
    ADD CONSTRAINT "catering_menu_sections_pkey" PRIMARY KEY ("id");


--
-- Name: catering_packages catering_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_packages"
    ADD CONSTRAINT "catering_packages_pkey" PRIMARY KEY ("id");


--
-- Name: commission_tracking commission_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."commission_tracking"
    ADD CONSTRAINT "commission_tracking_pkey" PRIMARY KEY ("id");


--
-- Name: dancer_addons dancer_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dancer_addons"
    ADD CONSTRAINT "dancer_addons_pkey" PRIMARY KEY ("id");


--
-- Name: dancer_bookings dancer_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dancer_bookings"
    ADD CONSTRAINT "dancer_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: dancer_gallery dancer_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dancer_gallery"
    ADD CONSTRAINT "dancer_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: dancer_packages dancer_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dancer_packages"
    ADD CONSTRAINT "dancer_packages_pkey" PRIMARY KEY ("id");


--
-- Name: decorator_addons decorator_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decorator_addons"
    ADD CONSTRAINT "decorator_addons_pkey" PRIMARY KEY ("id");


--
-- Name: decorator_bookings decorator_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decorator_bookings"
    ADD CONSTRAINT "decorator_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: decorator_gallery decorator_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decorator_gallery"
    ADD CONSTRAINT "decorator_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: decorator_packages decorator_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decorator_packages"
    ADD CONSTRAINT "decorator_packages_pkey" PRIMARY KEY ("id");


--
-- Name: delivery_charges delivery_charges_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."delivery_charges"
    ADD CONSTRAINT "delivery_charges_order_id_key" UNIQUE ("order_id");


--
-- Name: delivery_charges delivery_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."delivery_charges"
    ADD CONSTRAINT "delivery_charges_pkey" PRIMARY KEY ("id");


--
-- Name: dj_addons dj_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dj_addons"
    ADD CONSTRAINT "dj_addons_pkey" PRIMARY KEY ("id");


--
-- Name: dj_bookings dj_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dj_bookings"
    ADD CONSTRAINT "dj_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: dj_gallery dj_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dj_gallery"
    ADD CONSTRAINT "dj_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: dj_packages dj_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dj_packages"
    ADD CONSTRAINT "dj_packages_pkey" PRIMARY KEY ("id");


--
-- Name: drone_addons drone_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."drone_addons"
    ADD CONSTRAINT "drone_addons_pkey" PRIMARY KEY ("id");


--
-- Name: drone_bookings drone_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."drone_bookings"
    ADD CONSTRAINT "drone_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: drone_gallery drone_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."drone_gallery"
    ADD CONSTRAINT "drone_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: drone_packages drone_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."drone_packages"
    ADD CONSTRAINT "drone_packages_pkey" PRIMARY KEY ("id");


--
-- Name: event_bookings event_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."event_bookings"
    ADD CONSTRAINT "event_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: event_types event_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."event_types"
    ADD CONSTRAINT "event_types_name_key" UNIQUE ("name");


--
-- Name: event_types event_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."event_types"
    ADD CONSTRAINT "event_types_pkey" PRIMARY KEY ("id");


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");


--
-- Name: favorites favorites_user_id_provider_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_provider_id_key" UNIQUE ("user_id", "provider_id");


--
-- Name: featured_artists featured_artists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."featured_artists"
    ADD CONSTRAINT "featured_artists_pkey" PRIMARY KEY ("id");


--
-- Name: hall_addons hall_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."hall_addons"
    ADD CONSTRAINT "hall_addons_pkey" PRIMARY KEY ("id");


--
-- Name: hall_gallery hall_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."hall_gallery"
    ADD CONSTRAINT "hall_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."login_attempts"
    ADD CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id");


--
-- Name: makeup_addons makeup_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."makeup_addons"
    ADD CONSTRAINT "makeup_addons_pkey" PRIMARY KEY ("id");


--
-- Name: makeup_bookings makeup_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."makeup_bookings"
    ADD CONSTRAINT "makeup_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: makeup_gallery makeup_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."makeup_gallery"
    ADD CONSTRAINT "makeup_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: makeup_packages makeup_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."makeup_packages"
    ADD CONSTRAINT "makeup_packages_pkey" PRIMARY KEY ("id");


--
-- Name: mehendi_addons mehendi_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."mehendi_addons"
    ADD CONSTRAINT "mehendi_addons_pkey" PRIMARY KEY ("id");


--
-- Name: mehendi_bookings mehendi_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."mehendi_bookings"
    ADD CONSTRAINT "mehendi_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: mehendi_gallery mehendi_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."mehendi_gallery"
    ADD CONSTRAINT "mehendi_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: mehendi_packages mehendi_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."mehendi_packages"
    ADD CONSTRAINT "mehendi_packages_pkey" PRIMARY KEY ("id");


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");


--
-- Name: notification_settings notification_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_user_id_key" UNIQUE ("user_id");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");


--
-- Name: otp_rate_limits otp_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."otp_rate_limits"
    ADD CONSTRAINT "otp_rate_limits_pkey" PRIMARY KEY ("id");


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."otp_verifications"
    ADD CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id");


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");


--
-- Name: photographer_availability photographer_availability_photographer_id_available_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photographer_availability"
    ADD CONSTRAINT "photographer_availability_photographer_id_available_date_key" UNIQUE ("photographer_id", "available_date");


--
-- Name: photographer_availability photographer_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photographer_availability"
    ADD CONSTRAINT "photographer_availability_pkey" PRIMARY KEY ("id");


--
-- Name: photography_albums photography_albums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_albums"
    ADD CONSTRAINT "photography_albums_pkey" PRIMARY KEY ("id");


--
-- Name: photography_booking_timeline photography_booking_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_booking_timeline"
    ADD CONSTRAINT "photography_booking_timeline_pkey" PRIMARY KEY ("id");


--
-- Name: photography_cart_items photography_cart_items_cart_id_package_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_cart_items"
    ADD CONSTRAINT "photography_cart_items_cart_id_package_id_key" UNIQUE ("cart_id", "package_id");


--
-- Name: photography_cart_items photography_cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_cart_items"
    ADD CONSTRAINT "photography_cart_items_pkey" PRIMARY KEY ("id");


--
-- Name: photography_carts photography_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_carts"
    ADD CONSTRAINT "photography_carts_pkey" PRIMARY KEY ("id");


--
-- Name: photography_package_addons photography_package_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_addons"
    ADD CONSTRAINT "photography_package_addons_pkey" PRIMARY KEY ("id");


--
-- Name: photography_package_bookings photography_package_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_bookings"
    ADD CONSTRAINT "photography_package_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: photography_package_highlights photography_package_highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_highlights"
    ADD CONSTRAINT "photography_package_highlights_pkey" PRIMARY KEY ("id");


--
-- Name: photography_package_images photography_package_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_images"
    ADD CONSTRAINT "photography_package_images_pkey" PRIMARY KEY ("id");


--
-- Name: photography_package_invoices photography_package_invoices_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_invoices"
    ADD CONSTRAINT "photography_package_invoices_booking_id_key" UNIQUE ("booking_id");


--
-- Name: photography_package_invoices photography_package_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_invoices"
    ADD CONSTRAINT "photography_package_invoices_invoice_number_key" UNIQUE ("invoice_number");


--
-- Name: photography_package_invoices photography_package_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_invoices"
    ADD CONSTRAINT "photography_package_invoices_pkey" PRIMARY KEY ("id");


--
-- Name: photography_package_payments photography_package_payments_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_payments"
    ADD CONSTRAINT "photography_package_payments_booking_id_key" UNIQUE ("booking_id");


--
-- Name: photography_package_payments photography_package_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_payments"
    ADD CONSTRAINT "photography_package_payments_pkey" PRIMARY KEY ("id");


--
-- Name: photography_package_reviews photography_package_reviews_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_reviews"
    ADD CONSTRAINT "photography_package_reviews_booking_id_key" UNIQUE ("booking_id");


--
-- Name: photography_package_reviews photography_package_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_reviews"
    ADD CONSTRAINT "photography_package_reviews_pkey" PRIMARY KEY ("id");


--
-- Name: photography_packages photography_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_packages"
    ADD CONSTRAINT "photography_packages_pkey" PRIMARY KEY ("id");


--
-- Name: photography_videography_package_addons photography_videography_package_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_videography_package_addons"
    ADD CONSTRAINT "photography_videography_package_addons_pkey" PRIMARY KEY ("id");


--
-- Name: photography_videography_package_bookings photography_videography_package_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_videography_package_bookings"
    ADD CONSTRAINT "photography_videography_package_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: photography_videography_package_images photography_videography_package_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_videography_package_images"
    ADD CONSTRAINT "photography_videography_package_images_pkey" PRIMARY KEY ("id");


--
-- Name: photography_videography_packages photography_videography_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_videography_packages"
    ADD CONSTRAINT "photography_videography_packages_pkey" PRIMARY KEY ("id");


--
-- Name: planner_recommendation_candidates planner_recommendation_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."planner_recommendation_candidates"
    ADD CONSTRAINT "planner_recommendation_candidates_pkey" PRIMARY KEY ("id");


--
-- Name: planner_recommendation_candidates planner_recommendation_candidates_run_id_provider_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."planner_recommendation_candidates"
    ADD CONSTRAINT "planner_recommendation_candidates_run_id_provider_id_key" UNIQUE ("run_id", "provider_id");


--
-- Name: planner_recommendation_candidates planner_recommendation_candidates_run_id_rank_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."planner_recommendation_candidates"
    ADD CONSTRAINT "planner_recommendation_candidates_run_id_rank_position_key" UNIQUE ("run_id", "rank_position");


--
-- Name: planner_recommendation_runs planner_recommendation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."planner_recommendation_runs"
    ADD CONSTRAINT "planner_recommendation_runs_pkey" PRIMARY KEY ("id");


--
-- Name: platform_analytics platform_analytics_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."platform_analytics"
    ADD CONSTRAINT "platform_analytics_date_key" UNIQUE ("date");


--
-- Name: platform_analytics platform_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."platform_analytics"
    ADD CONSTRAINT "platform_analytics_pkey" PRIMARY KEY ("id");


--
-- Name: platform_settings platform_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_key_key" UNIQUE ("key");


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");


--
-- Name: pooja_services pooja_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pooja_services"
    ADD CONSTRAINT "pooja_services_pkey" PRIMARY KEY ("id");


--
-- Name: portfolio_items portfolio_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."portfolio_items"
    ADD CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id");


--
-- Name: pricing_packages pricing_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pricing_packages"
    ADD CONSTRAINT "pricing_packages_pkey" PRIMARY KEY ("id");


--
-- Name: priest_addons priest_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."priest_addons"
    ADD CONSTRAINT "priest_addons_pkey" PRIMARY KEY ("id");


--
-- Name: priest_bookings priest_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."priest_bookings"
    ADD CONSTRAINT "priest_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: priest_gallery priest_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."priest_gallery"
    ADD CONSTRAINT "priest_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: priest_packages priest_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."priest_packages"
    ADD CONSTRAINT "priest_packages_pkey" PRIMARY KEY ("id");


--
-- Name: product_order_items product_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_order_items"
    ADD CONSTRAINT "product_order_items_pkey" PRIMARY KEY ("id");


--
-- Name: product_orders product_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: provider_availability provider_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_availability"
    ADD CONSTRAINT "provider_availability_pkey" PRIMARY KEY ("id");


--
-- Name: provider_availability provider_availability_provider_id_unavailable_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_availability"
    ADD CONSTRAINT "provider_availability_provider_id_unavailable_date_key" UNIQUE ("provider_id", "unavailable_date");


--
-- Name: provider_calendar provider_calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_calendar"
    ADD CONSTRAINT "provider_calendar_pkey" PRIMARY KEY ("id");


--
-- Name: provider_calendar provider_calendar_provider_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_calendar"
    ADD CONSTRAINT "provider_calendar_provider_id_date_key" UNIQUE ("provider_id", "date");


--
-- Name: provider_faqs provider_faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_faqs"
    ADD CONSTRAINT "provider_faqs_pkey" PRIMARY KEY ("id");


--
-- Name: provider_profiles provider_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_profiles"
    ADD CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id");


--
-- Name: provider_profiles provider_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_profiles"
    ADD CONSTRAINT "provider_profiles_user_id_key" UNIQUE ("user_id");


--
-- Name: provider_time_slots provider_time_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_time_slots"
    ADD CONSTRAINT "provider_time_slots_pkey" PRIMARY KEY ("id");


--
-- Name: provider_time_slots provider_time_slots_provider_id_day_of_week_start_time_end__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_time_slots"
    ADD CONSTRAINT "provider_time_slots_provider_id_day_of_week_start_time_end__key" UNIQUE ("provider_id", "day_of_week", "start_time", "end_time");


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");


--
-- Name: push_subscriptions push_subscriptions_user_id_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash");


--
-- Name: rental_addons rental_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_addons"
    ADD CONSTRAINT "rental_addons_pkey" PRIMARY KEY ("id");


--
-- Name: rental_bookings rental_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_bookings"
    ADD CONSTRAINT "rental_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: rental_gallery rental_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_gallery"
    ADD CONSTRAINT "rental_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: rental_items rental_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_items"
    ADD CONSTRAINT "rental_items_pkey" PRIMARY KEY ("id");


--
-- Name: rental_packages rental_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_packages"
    ADD CONSTRAINT "rental_packages_pkey" PRIMARY KEY ("id");


--
-- Name: reschedule_requests reschedule_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reschedule_requests"
    ADD CONSTRAINT "reschedule_requests_pkey" PRIMARY KEY ("id");


--
-- Name: reviews reviews_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_key" UNIQUE ("booking_id");


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");


--
-- Name: search_history search_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."search_history"
    ADD CONSTRAINT "search_history_pkey" PRIMARY KEY ("id");


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_pkey" PRIMARY KEY ("id");


--
-- Name: singer_addons singer_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."singer_addons"
    ADD CONSTRAINT "singer_addons_pkey" PRIMARY KEY ("id");


--
-- Name: singer_bookings singer_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."singer_bookings"
    ADD CONSTRAINT "singer_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: singer_gallery singer_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."singer_gallery"
    ADD CONSTRAINT "singer_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: singer_packages singer_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."singer_packages"
    ADD CONSTRAINT "singer_packages_pkey" PRIMARY KEY ("id");


--
-- Name: subcategories subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id");


--
-- Name: subcategories subcategories_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_slug_name_key" UNIQUE ("category_slug", "name");


--
-- Name: supplier_delivery_settings supplier_delivery_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_delivery_settings"
    ADD CONSTRAINT "supplier_delivery_settings_pkey" PRIMARY KEY ("provider_id");


--
-- Name: admin_event_packages unique_event_tier; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_packages"
    ADD CONSTRAINT "unique_event_tier" UNIQUE ("event_type_id", "tier");


--
-- Name: admin_event_package_inclusions unique_package_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_package_inclusions"
    ADD CONSTRAINT "unique_package_category" UNIQUE ("package_id", "category_id");


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");


--
-- Name: vendor_cancellations vendor_cancellations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vendor_cancellations"
    ADD CONSTRAINT "vendor_cancellations_pkey" PRIMARY KEY ("id");


--
-- Name: vendor_embeddings vendor_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vendor_embeddings"
    ADD CONSTRAINT "vendor_embeddings_pkey" PRIMARY KEY ("id");


--
-- Name: vendor_settlements vendor_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vendor_settlements"
    ADD CONSTRAINT "vendor_settlements_pkey" PRIMARY KEY ("id");


--
-- Name: videography_addons videography_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videography_addons"
    ADD CONSTRAINT "videography_addons_pkey" PRIMARY KEY ("id");


--
-- Name: videography_bookings videography_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videography_bookings"
    ADD CONSTRAINT "videography_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: videography_gallery videography_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videography_gallery"
    ADD CONSTRAINT "videography_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: videography_packages videography_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videography_packages"
    ADD CONSTRAINT "videography_packages_pkey" PRIMARY KEY ("id");


--
-- Name: water_addons water_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_addons"
    ADD CONSTRAINT "water_addons_pkey" PRIMARY KEY ("id");


--
-- Name: water_bookings water_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_bookings"
    ADD CONSTRAINT "water_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: water_categories water_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_categories"
    ADD CONSTRAINT "water_categories_code_key" UNIQUE ("code");


--
-- Name: water_categories water_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_categories"
    ADD CONSTRAINT "water_categories_pkey" PRIMARY KEY ("id");


--
-- Name: water_gallery water_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_gallery"
    ADD CONSTRAINT "water_gallery_pkey" PRIMARY KEY ("id");


--
-- Name: water_packages water_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_packages"
    ADD CONSTRAINT "water_packages_pkey" PRIMARY KEY ("id");


--
-- Name: water_product_images water_product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_images"
    ADD CONSTRAINT "water_product_images_pkey" PRIMARY KEY ("id");


--
-- Name: water_product_reviews water_product_reviews_order_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_reviews"
    ADD CONSTRAINT "water_product_reviews_order_item_id_key" UNIQUE ("order_item_id");


--
-- Name: water_product_reviews water_product_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_reviews"
    ADD CONSTRAINT "water_product_reviews_pkey" PRIMARY KEY ("id");


--
-- Name: water_product_stock water_product_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_stock"
    ADD CONSTRAINT "water_product_stock_pkey" PRIMARY KEY ("variant_id");


--
-- Name: water_product_variants water_product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_variants"
    ADD CONSTRAINT "water_product_variants_pkey" PRIMARY KEY ("id");


--
-- Name: water_product_variants water_product_variants_product_id_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_variants"
    ADD CONSTRAINT "water_product_variants_product_id_label_key" UNIQUE ("product_id", "label");


--
-- Name: water_products water_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_products"
    ADD CONSTRAINT "water_products_pkey" PRIMARY KEY ("id");


--
-- Name: worker_bank_accounts worker_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worker_bank_accounts"
    ADD CONSTRAINT "worker_bank_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: worker_documents worker_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worker_documents"
    ADD CONSTRAINT "worker_documents_pkey" PRIMARY KEY ("id");


--
-- Name: worker_profiles worker_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worker_profiles"
    ADD CONSTRAINT "worker_profiles_pkey" PRIMARY KEY ("id");


--
-- Name: worker_profiles worker_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worker_profiles"
    ADD CONSTRAINT "worker_profiles_user_id_key" UNIQUE ("user_id");


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "custom_oauth_providers_created_at_idx" ON "auth"."custom_oauth_providers" USING "btree" ("created_at");


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "custom_oauth_providers_enabled_idx" ON "auth"."custom_oauth_providers" USING "btree" ("enabled");


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "custom_oauth_providers_identifier_idx" ON "auth"."custom_oauth_providers" USING "btree" ("identifier");


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "custom_oauth_providers_provider_type_idx" ON "auth"."custom_oauth_providers" USING "btree" ("provider_type");


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");


--
-- Name: INDEX "identities_email_idx"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "idx_oauth_client_states_created_at" ON "auth"."oauth_client_states" USING "btree" ("created_at");


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");


--
-- Name: idx_users_created_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "idx_users_created_at_desc" ON "auth"."users" USING "btree" ("created_at" DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "idx_users_email" ON "auth"."users" USING "btree" ("email");


--
-- Name: idx_users_last_sign_in_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "idx_users_last_sign_in_at_desc" ON "auth"."users" USING "btree" ("last_sign_in_at" DESC);


--
-- Name: idx_users_name; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "idx_users_name" ON "auth"."users" USING "btree" ((("raw_user_meta_data" ->> 'name'::"text"))) WHERE (("raw_user_meta_data" ->> 'name'::"text") IS NOT NULL);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);


--
-- Name: INDEX "users_email_partial_key"; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "webauthn_challenges_expires_at_idx" ON "auth"."webauthn_challenges" USING "btree" ("expires_at");


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "webauthn_challenges_user_id_idx" ON "auth"."webauthn_challenges" USING "btree" ("user_id");


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "auth"."webauthn_credentials" USING "btree" ("credential_id");


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX "webauthn_credentials_user_id_idx" ON "auth"."webauthn_credentials" USING "btree" ("user_id");


--
-- Name: anchor_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "anchor_addons_package_idx" ON "public"."anchor_addons" USING "btree" ("package_id");


--
-- Name: anchor_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "anchor_bookings_customer_idx" ON "public"."anchor_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: anchor_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "anchor_bookings_provider_idx" ON "public"."anchor_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: anchor_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "anchor_gallery_one_cover" ON "public"."anchor_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: anchor_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "anchor_gallery_package_idx" ON "public"."anchor_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: anchor_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "anchor_packages_provider_idx" ON "public"."anchor_packages" USING "btree" ("provider_id", "status");


--
-- Name: band_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "band_addons_package_idx" ON "public"."band_addons" USING "btree" ("package_id");


--
-- Name: band_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "band_bookings_customer_idx" ON "public"."band_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: band_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "band_bookings_provider_idx" ON "public"."band_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: band_categories_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "band_categories_active_idx" ON "public"."band_categories" USING "btree" ("is_active", "sort_order");


--
-- Name: band_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "band_gallery_one_cover" ON "public"."band_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: band_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "band_gallery_package_idx" ON "public"."band_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: band_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "band_packages_provider_idx" ON "public"."band_packages" USING "btree" ("provider_id", "status");


--
-- Name: banquet_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "banquet_bookings_customer_idx" ON "public"."banquet_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: banquet_bookings_no_double; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "banquet_bookings_no_double" ON "public"."banquet_bookings" USING "btree" ("package_id", "event_date") WHERE ("status" = ANY (ARRAY['accepted'::"text", 'confirmed'::"text", 'in_progress'::"text"]));


--
-- Name: banquet_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "banquet_bookings_provider_idx" ON "public"."banquet_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: banquet_halls_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "banquet_halls_provider_idx" ON "public"."banquet_halls" USING "btree" ("provider_id", "status");


--
-- Name: booking_events_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "booking_events_booking_idx" ON "public"."booking_events" USING "btree" ("booking_table", "booking_id", "created_at" DESC);


--
-- Name: booking_locations_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "booking_locations_booking_idx" ON "public"."booking_locations" USING "btree" ("booking_table", "booking_id");


--
-- Name: booking_start_otps_one_active_per_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "booking_start_otps_one_active_per_booking" ON "public"."booking_start_otps" USING "btree" ("booking_table", "booking_id") WHERE (("verified" = false) AND ("invalidated" = false));


--
-- Name: bookings_payment_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bookings_payment_deadline_idx" ON "public"."bookings" USING "btree" ("payment_deadline") WHERE (("payment_deadline" IS NOT NULL) AND ("calendar_locked" = false));


--
-- Name: catering_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "catering_addons_package_idx" ON "public"."catering_addons" USING "btree" ("package_id");


--
-- Name: catering_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "catering_bookings_customer_idx" ON "public"."catering_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: catering_bookings_payment_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "catering_bookings_payment_deadline_idx" ON "public"."catering_bookings" USING "btree" ("payment_deadline") WHERE (("payment_deadline" IS NOT NULL) AND ("calendar_locked" = false));


--
-- Name: catering_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "catering_bookings_provider_idx" ON "public"."catering_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: catering_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "catering_gallery_one_cover" ON "public"."catering_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: catering_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "catering_gallery_package_idx" ON "public"."catering_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: catering_items_section_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "catering_items_section_idx" ON "public"."catering_menu_items" USING "btree" ("section_id", "sort_order");


--
-- Name: catering_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "catering_packages_provider_idx" ON "public"."catering_packages" USING "btree" ("provider_id", "status");


--
-- Name: catering_sections_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "catering_sections_package_idx" ON "public"."catering_menu_sections" USING "btree" ("package_id", "sort_order");


--
-- Name: dancer_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dancer_addons_package_idx" ON "public"."dancer_addons" USING "btree" ("package_id");


--
-- Name: dancer_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dancer_bookings_customer_idx" ON "public"."dancer_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: dancer_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dancer_bookings_provider_idx" ON "public"."dancer_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: dancer_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dancer_gallery_package_idx" ON "public"."dancer_gallery" USING "btree" ("package_id");


--
-- Name: dancer_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dancer_packages_provider_idx" ON "public"."dancer_packages" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: decorator_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "decorator_addons_package_idx" ON "public"."decorator_addons" USING "btree" ("package_id");


--
-- Name: decorator_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "decorator_bookings_customer_idx" ON "public"."decorator_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: decorator_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "decorator_bookings_provider_idx" ON "public"."decorator_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: decorator_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "decorator_gallery_one_cover" ON "public"."decorator_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: decorator_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "decorator_gallery_package_idx" ON "public"."decorator_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: decorator_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "decorator_packages_provider_idx" ON "public"."decorator_packages" USING "btree" ("provider_id", "status");


--
-- Name: decorator_packages_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "decorator_packages_type_idx" ON "public"."decorator_packages" USING "btree" ("package_type");


--
-- Name: dj_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dj_addons_package_idx" ON "public"."dj_addons" USING "btree" ("package_id");


--
-- Name: dj_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dj_bookings_customer_idx" ON "public"."dj_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: dj_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dj_bookings_provider_idx" ON "public"."dj_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: dj_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "dj_gallery_one_cover" ON "public"."dj_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: dj_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dj_gallery_package_idx" ON "public"."dj_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: dj_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dj_packages_provider_idx" ON "public"."dj_packages" USING "btree" ("provider_id", "status");


--
-- Name: drone_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "drone_addons_package_idx" ON "public"."drone_addons" USING "btree" ("package_id");


--
-- Name: drone_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "drone_bookings_customer_idx" ON "public"."drone_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: drone_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "drone_bookings_provider_idx" ON "public"."drone_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: drone_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "drone_gallery_one_cover" ON "public"."drone_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: drone_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "drone_gallery_package_idx" ON "public"."drone_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: drone_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "drone_packages_provider_idx" ON "public"."drone_packages" USING "btree" ("provider_id", "status");


--
-- Name: hall_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "hall_addons_package_idx" ON "public"."hall_addons" USING "btree" ("package_id");


--
-- Name: hall_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "hall_gallery_one_cover" ON "public"."hall_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: hall_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "hall_gallery_package_idx" ON "public"."hall_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: idx_about_team_members_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_about_team_members_display_order" ON "public"."about_team_members" USING "btree" ("display_order") WHERE ("is_active" = true);


--
-- Name: idx_about_team_members_member_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_about_team_members_member_type" ON "public"."about_team_members" USING "btree" ("member_type", "is_active");


--
-- Name: idx_admin_event_package_bookings_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_admin_event_package_bookings_customer_id" ON "public"."admin_event_package_bookings" USING "btree" ("customer_id");


--
-- Name: idx_admin_event_package_bookings_package_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_admin_event_package_bookings_package_id" ON "public"."admin_event_package_bookings" USING "btree" ("package_id");


--
-- Name: idx_admin_event_package_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_admin_event_package_bookings_status" ON "public"."admin_event_package_bookings" USING "btree" ("status");


--
-- Name: idx_admin_event_package_discounts_package_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_admin_event_package_discounts_package_id" ON "public"."admin_event_package_discounts" USING "btree" ("package_id");


--
-- Name: idx_admin_event_package_inclusions_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_admin_event_package_inclusions_category_id" ON "public"."admin_event_package_inclusions" USING "btree" ("category_id");


--
-- Name: idx_admin_event_package_inclusions_package_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_admin_event_package_inclusions_package_id" ON "public"."admin_event_package_inclusions" USING "btree" ("package_id");


--
-- Name: idx_admin_event_packages_event_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_admin_event_packages_event_type_id" ON "public"."admin_event_packages" USING "btree" ("event_type_id");


--
-- Name: idx_admin_event_packages_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_admin_event_packages_is_active" ON "public"."admin_event_packages" USING "btree" ("is_active");


--
-- Name: idx_admin_event_packages_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_admin_event_packages_tier" ON "public"."admin_event_packages" USING "btree" ("tier");


--
-- Name: idx_ai_conversations_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_conversations_archived" ON "public"."ai_conversations" USING "btree" ("user_id", "is_archived", "last_active_at" DESC);


--
-- Name: idx_ai_conversations_favorite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_conversations_favorite" ON "public"."ai_conversations" USING "btree" ("user_id", "is_favorite", "last_active_at" DESC);


--
-- Name: idx_ai_conversations_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_conversations_pinned" ON "public"."ai_conversations" USING "btree" ("user_id", "is_pinned", "last_active_at" DESC);


--
-- Name: idx_ai_conversations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_conversations_user" ON "public"."ai_conversations" USING "btree" ("user_id", "last_active_at" DESC);


--
-- Name: idx_ai_conversations_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_conversations_user_active" ON "public"."ai_conversations" USING "btree" ("user_id", "last_active_at" DESC);


--
-- Name: idx_ai_message_feedback_user_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_message_feedback_user_message" ON "public"."ai_message_feedback" USING "btree" ("user_id", "message_id");


--
-- Name: idx_ai_messages_conv_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_messages_conv_created" ON "public"."ai_messages" USING "btree" ("conversation_id", "created_at");


--
-- Name: idx_ai_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_messages_conversation" ON "public"."ai_messages" USING "btree" ("conversation_id", "created_at");


--
-- Name: idx_artist_bookings_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_artist_bookings_event" ON "public"."artist_bookings" USING "btree" ("event_id", "status");


--
-- Name: idx_artist_bookings_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_artist_bookings_provider" ON "public"."artist_bookings" USING "btree" ("provider_id", "status");


--
-- Name: idx_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_audit_log_created_at" ON "public"."audit_log" USING "btree" ("created_at");


--
-- Name: idx_audit_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_audit_log_user_id" ON "public"."audit_log" USING "btree" ("user_id");


--
-- Name: idx_auth_promotion_media_active_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotion_media_active_order" ON "public"."auth_promotion_media" USING "btree" ("is_active", "display_order", "created_at");


--
-- Name: idx_auth_promotion_media_active_slot_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotion_media_active_slot_order" ON "public"."auth_promotion_media" USING "btree" ("slot_number", "display_order", "created_at") WHERE (("is_active" = true) AND ("slot_number" IS NOT NULL));


--
-- Name: idx_auth_promotion_media_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotion_media_order" ON "public"."auth_promotion_media" USING "btree" ("display_order", "created_at");


--
-- Name: idx_auth_promotion_media_provider_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotion_media_provider_package" ON "public"."auth_promotion_media" USING "btree" ("provider_id", "package_id", "is_published");


--
-- Name: idx_auth_promotion_media_slot_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotion_media_slot_published" ON "public"."auth_promotion_media" USING "btree" ("slot_number", "is_published", "created_at" DESC);


--
-- Name: idx_auth_promotion_media_unique_slot_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_auth_promotion_media_unique_slot_order" ON "public"."auth_promotion_media" USING "btree" ("slot_number", "display_order") WHERE ("slot_number" IS NOT NULL);


--
-- Name: idx_auth_promotion_video_views_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotion_video_views_user" ON "public"."auth_promotion_video_views" USING "btree" ("user_id", "viewed_at" DESC);


--
-- Name: idx_auth_promotion_video_views_video; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotion_video_views_video" ON "public"."auth_promotion_video_views" USING "btree" ("video_id", "viewed_at" DESC);


--
-- Name: idx_auth_promotion_videos_active_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotion_videos_active_priority" ON "public"."auth_promotion_videos" USING "btree" ("is_active", "priority_order", "created_at") WHERE ("is_active" = true);


--
-- Name: idx_auth_promotion_videos_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotion_videos_priority" ON "public"."auth_promotion_videos" USING "btree" ("priority_order", "created_at");


--
-- Name: idx_auth_promotion_videos_unique_active_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_auth_promotion_videos_unique_active_priority" ON "public"."auth_promotion_videos" USING "btree" ("priority_order") WHERE ("is_active" = true);


--
-- Name: idx_auth_promotional_config_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotional_config_active" ON "public"."auth_promotional_config" USING "btree" ("is_active");


--
-- Name: idx_auth_promotional_config_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_promotional_config_created" ON "public"."auth_promotional_config" USING "btree" ("created_at" DESC);


--
-- Name: idx_availability_provider_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_availability_provider_date" ON "public"."provider_availability" USING "btree" ("provider_id", "unavailable_date");


--
-- Name: idx_booking_otp_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_booking_otp_active" ON "public"."booking_start_otps" USING "btree" ("booking_id", "verified", "invalidated", "expires_at");


--
-- Name: idx_booking_otp_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_booking_otp_booking" ON "public"."booking_start_otps" USING "btree" ("booking_id");


--
-- Name: idx_booking_otp_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_booking_otp_customer" ON "public"."booking_start_otps" USING "btree" ("customer_id");


--
-- Name: idx_booking_otp_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_booking_otp_vendor" ON "public"."booking_start_otps" USING "btree" ("vendor_id");


--
-- Name: idx_bookings_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_bookings_customer_id" ON "public"."bookings" USING "btree" ("customer_id");


--
-- Name: idx_bookings_event_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_bookings_event_date" ON "public"."bookings" USING "btree" ("event_date");


--
-- Name: idx_bookings_provider_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_bookings_provider_date" ON "public"."bookings" USING "btree" ("provider_id", "event_date");


--
-- Name: idx_bookings_provider_date_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_bookings_provider_date_status" ON "public"."bookings" USING "btree" ("provider_id", "event_date", "status");


--
-- Name: idx_bookings_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_bookings_provider_id" ON "public"."bookings" USING "btree" ("provider_id");


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");


--
-- Name: idx_budget_allocations_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_budget_allocations_event" ON "public"."budget_allocations" USING "btree" ("event_id");


--
-- Name: idx_calendar_provider_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_calendar_provider_date" ON "public"."provider_calendar" USING "btree" ("provider_id", "date", "is_available");


--
-- Name: idx_cancellation_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cancellation_booking" ON "public"."booking_cancellations" USING "btree" ("booking_id");


--
-- Name: idx_cancellation_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cancellation_customer" ON "public"."booking_cancellations" USING "btree" ("customer_id");


--
-- Name: idx_cancellation_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cancellation_provider" ON "public"."booking_cancellations" USING "btree" ("provider_id");


--
-- Name: idx_categories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_categories_active" ON "public"."artist_categories" USING "btree" ("is_active", "sort_order") WHERE ("is_active" = true);


--
-- Name: idx_commission_tracking_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_commission_tracking_booking_id" ON "public"."commission_tracking" USING "btree" ("booking_id");


--
-- Name: idx_commission_tracking_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_commission_tracking_provider_id" ON "public"."commission_tracking" USING "btree" ("provider_id");


--
-- Name: idx_commission_tracking_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_commission_tracking_status" ON "public"."commission_tracking" USING "btree" ("status");


--
-- Name: idx_event_bookings_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_event_bookings_customer" ON "public"."event_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: idx_event_bookings_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_event_bookings_date" ON "public"."event_bookings" USING "btree" ("event_date");


--
-- Name: idx_favorites_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_favorites_provider_id" ON "public"."favorites" USING "btree" ("provider_id");


--
-- Name: idx_favorites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_favorites_user_id" ON "public"."favorites" USING "btree" ("user_id");


--
-- Name: idx_featured_artists_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_featured_artists_expires_at" ON "public"."featured_artists" USING "btree" ("expires_at");


--
-- Name: idx_featured_artists_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_featured_artists_provider_id" ON "public"."featured_artists" USING "btree" ("provider_id");


--
-- Name: idx_invoices_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_invoices_booking_id" ON "public"."invoices" USING "btree" ("booking_id");


--
-- Name: idx_invoices_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_invoices_customer_id" ON "public"."invoices" USING "btree" ("customer_id");


--
-- Name: idx_invoices_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_invoices_invoice_number" ON "public"."invoices" USING "btree" ("invoice_number");


--
-- Name: idx_invoices_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_invoices_provider_id" ON "public"."invoices" USING "btree" ("provider_id");


--
-- Name: idx_login_attempts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_login_attempts_created_at" ON "public"."login_attempts" USING "btree" ("created_at");


--
-- Name: idx_login_attempts_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_login_attempts_phone" ON "public"."login_attempts" USING "btree" ("phone");


--
-- Name: idx_menu_items_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_menu_items_provider" ON "public"."menu_items" USING "btree" ("provider_id");


--
-- Name: idx_messages_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_booking_id" ON "public"."messages" USING "btree" ("booking_id");


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at");


--
-- Name: idx_messages_delivered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_delivered" ON "public"."messages" USING "btree" ("delivered_at") WHERE ("delivered_at" IS NULL);


--
-- Name: idx_messages_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_read" ON "public"."messages" USING "btree" ("read_at") WHERE ("read_at" IS NULL);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);


--
-- Name: idx_otp_phone_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_otp_phone_expires" ON "public"."otp_verifications" USING "btree" ("phone", "expires_at");


--
-- Name: idx_planner_recommendation_candidates_run_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_planner_recommendation_candidates_run_rank" ON "public"."planner_recommendation_candidates" USING "btree" ("run_id", "rank_position");


--
-- Name: idx_planner_recommendation_runs_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_planner_recommendation_runs_user_created" ON "public"."planner_recommendation_runs" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_platform_analytics_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_platform_analytics_date" ON "public"."platform_analytics" USING "btree" ("date");


--
-- Name: idx_pooja_services_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_pooja_services_provider" ON "public"."pooja_services" USING "btree" ("provider_id");


--
-- Name: idx_pricing_packages_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_pricing_packages_provider" ON "public"."pricing_packages" USING "btree" ("provider_id");


--
-- Name: idx_product_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_product_orders_customer" ON "public"."product_orders" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: idx_product_orders_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_product_orders_provider" ON "public"."product_orders" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: idx_profiles_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_profiles_area" ON "public"."profiles" USING "btree" ("area");


--
-- Name: idx_profiles_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_profiles_city" ON "public"."profiles" USING "btree" ("city");


--
-- Name: idx_profiles_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_profiles_is_active" ON "public"."profiles" USING "btree" ("is_active");


--
-- Name: idx_profiles_last_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_profiles_last_active" ON "public"."profiles" USING "btree" ("last_active_at" DESC);


--
-- Name: idx_profiles_phone_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_profiles_phone_verified" ON "public"."profiles" USING "btree" ("phone_verified");


--
-- Name: idx_profiles_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_profiles_state" ON "public"."profiles" USING "btree" ("state");


--
-- Name: idx_provider_availability_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_availability_lookup" ON "public"."provider_availability" USING "btree" ("provider_id", "unavailable_date", "slot_type");


--
-- Name: idx_provider_city_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_city_status" ON "public"."provider_profiles" USING "btree" ("verification_status");


--
-- Name: idx_provider_experience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_experience" ON "public"."provider_profiles" USING "btree" ("experience_years" DESC);


--
-- Name: idx_provider_faqs_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_faqs_provider" ON "public"."provider_faqs" USING "btree" ("provider_id");


--
-- Name: idx_provider_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_featured" ON "public"."provider_profiles" USING "btree" ("is_featured", "featured_until") WHERE ("is_featured" = true);


--
-- Name: idx_provider_is_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_is_available" ON "public"."provider_profiles" USING "btree" ("is_available");


--
-- Name: idx_provider_is_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_is_verified" ON "public"."provider_profiles" USING "btree" ("is_verified");


--
-- Name: idx_provider_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_location" ON "public"."provider_profiles" USING "btree" ("user_id", "is_verified");


--
-- Name: idx_provider_price_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_price_range" ON "public"."provider_profiles" USING "btree" ("price_min", "price_max");


--
-- Name: idx_provider_profession; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_profession" ON "public"."provider_profiles" USING "btree" ("profession");


--
-- Name: idx_provider_profession_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_profession_status" ON "public"."provider_profiles" USING "btree" ("profession", "verification_status");


--
-- Name: idx_provider_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_published" ON "public"."provider_profiles" USING "btree" ("is_published", "verification_status");


--
-- Name: idx_provider_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_rating" ON "public"."provider_profiles" USING "btree" ("average_rating" DESC, "total_reviews" DESC);


--
-- Name: idx_provider_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_search" ON "public"."provider_profiles" USING "btree" ("profession", "is_verified", "is_available", "price_min", "price_max");


--
-- Name: idx_provider_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_status" ON "public"."provider_profiles" USING "btree" ("verification_status");


--
-- Name: idx_provider_subcategory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_provider_subcategory" ON "public"."provider_profiles" USING "btree" ("subcategory");


--
-- Name: idx_push_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_push_subscriptions_user_id" ON "public"."push_subscriptions" USING "btree" ("user_id");


--
-- Name: idx_rate_limit_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rate_limit_phone" ON "public"."otp_rate_limits" USING "btree" ("phone", "window_start");


--
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_refresh_tokens_expires_at" ON "public"."refresh_tokens" USING "btree" ("expires_at");


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_refresh_tokens_user_id" ON "public"."refresh_tokens" USING "btree" ("user_id");


--
-- Name: idx_rental_items_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rental_items_provider" ON "public"."rental_items" USING "btree" ("provider_id");


--
-- Name: idx_reschedule_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_reschedule_booking" ON "public"."reschedule_requests" USING "btree" ("booking_id");


--
-- Name: idx_reschedule_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_reschedule_customer" ON "public"."reschedule_requests" USING "btree" ("customer_id");


--
-- Name: idx_reschedule_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_reschedule_provider" ON "public"."reschedule_requests" USING "btree" ("provider_id");


--
-- Name: idx_reschedule_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_reschedule_status" ON "public"."reschedule_requests" USING "btree" ("status");


--
-- Name: idx_search_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_search_history_user" ON "public"."search_history" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_settlement_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_settlement_booking" ON "public"."vendor_settlements" USING "btree" ("booking_id");


--
-- Name: idx_settlement_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_settlement_status" ON "public"."vendor_settlements" USING "btree" ("settlement_status");


--
-- Name: idx_settlement_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_settlement_vendor" ON "public"."vendor_settlements" USING "btree" ("vendor_id");


--
-- Name: idx_subcategories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_subcategories_slug" ON "public"."subcategories" USING "btree" ("category_slug");


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_user_roles_role" ON "public"."user_roles" USING "btree" ("role");


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");


--
-- Name: idx_vendor_cancel_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_vendor_cancel_booking" ON "public"."vendor_cancellations" USING "btree" ("booking_id");


--
-- Name: idx_vendor_cancel_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_vendor_cancel_customer" ON "public"."vendor_cancellations" USING "btree" ("customer_id");


--
-- Name: idx_vendor_cancel_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_vendor_cancel_vendor" ON "public"."vendor_cancellations" USING "btree" ("vendor_id");


--
-- Name: idx_vendor_embeddings_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_vendor_embeddings_provider" ON "public"."vendor_embeddings" USING "btree" ("provider_id");


--
-- Name: idx_vendor_embeddings_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_vendor_embeddings_vector" ON "public"."vendor_embeddings" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');


--
-- Name: idx_water_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_water_products_category" ON "public"."water_products" USING "btree" ("category_id");


--
-- Name: idx_water_products_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_water_products_provider" ON "public"."water_products" USING "btree" ("provider_id", "is_active", "is_visible");


--
-- Name: idx_water_variants_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_water_variants_product" ON "public"."water_product_variants" USING "btree" ("product_id", "is_available");


--
-- Name: idx_worker_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_worker_documents_status" ON "public"."worker_documents" USING "btree" ("verification_status");


--
-- Name: idx_worker_documents_worker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_worker_documents_worker_id" ON "public"."worker_documents" USING "btree" ("worker_id");


--
-- Name: idx_worker_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_worker_status" ON "public"."worker_profiles" USING "btree" ("verification_status");


--
-- Name: idx_worker_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_worker_user" ON "public"."worker_profiles" USING "btree" ("user_id");


--
-- Name: makeup_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "makeup_addons_package_idx" ON "public"."makeup_addons" USING "btree" ("package_id");


--
-- Name: makeup_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "makeup_bookings_customer_idx" ON "public"."makeup_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: makeup_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "makeup_bookings_provider_idx" ON "public"."makeup_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: makeup_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "makeup_gallery_one_cover" ON "public"."makeup_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: makeup_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "makeup_gallery_package_idx" ON "public"."makeup_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: makeup_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "makeup_packages_provider_idx" ON "public"."makeup_packages" USING "btree" ("provider_id", "status");


--
-- Name: makeup_packages_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "makeup_packages_type_idx" ON "public"."makeup_packages" USING "btree" ("package_type");


--
-- Name: mehendi_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mehendi_addons_package_idx" ON "public"."mehendi_addons" USING "btree" ("package_id");


--
-- Name: mehendi_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mehendi_bookings_customer_idx" ON "public"."mehendi_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: mehendi_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mehendi_bookings_provider_idx" ON "public"."mehendi_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: mehendi_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "mehendi_gallery_one_cover" ON "public"."mehendi_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: mehendi_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mehendi_gallery_package_idx" ON "public"."mehendi_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: mehendi_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mehendi_packages_provider_idx" ON "public"."mehendi_packages" USING "btree" ("provider_id", "status");


--
-- Name: one_cover_image_per_water_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "one_cover_image_per_water_product" ON "public"."water_product_images" USING "btree" ("product_id") WHERE "is_cover";


--
-- Name: photography_active_cart_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "photography_active_cart_provider_idx" ON "public"."photography_carts" USING "btree" ("customer_id", "photographer_id") WHERE ("status" = 'active'::"text");


--
-- Name: photography_albums_package_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_albums_package_active_idx" ON "public"."photography_albums" USING "btree" ("package_id", "is_active", "sort_order");


--
-- Name: photography_bookings_photographer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_bookings_photographer_idx" ON "public"."photography_package_bookings" USING "btree" ("photographer_id", "created_at" DESC);


--
-- Name: photography_cart_items_album_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_cart_items_album_idx" ON "public"."photography_cart_items" USING "btree" ("album_id");


--
-- Name: photography_cart_items_cart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_cart_items_cart_idx" ON "public"."photography_cart_items" USING "btree" ("cart_id");


--
-- Name: photography_carts_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_carts_customer_idx" ON "public"."photography_carts" USING "btree" ("customer_id", "status", "updated_at" DESC);


--
-- Name: photography_package_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "photography_package_one_cover" ON "public"."photography_package_images" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: photography_packages_photographer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_packages_photographer_idx" ON "public"."photography_packages" USING "btree" ("photographer_id", "is_active", "is_visible");


--
-- Name: photography_packages_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_packages_public_idx" ON "public"."photography_packages" USING "btree" ("photographer_id", "status", "is_active", "is_visible");


--
-- Name: photography_timeline_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_timeline_booking_idx" ON "public"."photography_booking_timeline" USING "btree" ("booking_id", "created_at");


--
-- Name: photography_videography_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_videography_addons_package_idx" ON "public"."photography_videography_package_addons" USING "btree" ("package_id");


--
-- Name: photography_videography_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_videography_bookings_customer_idx" ON "public"."photography_videography_package_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: photography_videography_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_videography_bookings_provider_idx" ON "public"."photography_videography_package_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: photography_videography_images_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_videography_images_package_idx" ON "public"."photography_videography_package_images" USING "btree" ("package_id");


--
-- Name: photography_videography_packages_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_videography_packages_active_idx" ON "public"."photography_videography_packages" USING "btree" ("is_active", "is_visible", "status") WHERE (("is_active" = true) AND ("is_visible" = true));


--
-- Name: photography_videography_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_videography_packages_provider_idx" ON "public"."photography_videography_packages" USING "btree" ("provider_id", "is_active", "is_visible");


--
-- Name: photography_videography_packages_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "photography_videography_packages_type_idx" ON "public"."photography_videography_packages" USING "btree" ("package_type");


--
-- Name: portfolio_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "portfolio_published_idx" ON "public"."portfolio_items" USING "btree" ("provider_id", "is_published");


--
-- Name: priest_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "priest_addons_package_idx" ON "public"."priest_addons" USING "btree" ("package_id");


--
-- Name: priest_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "priest_bookings_customer_idx" ON "public"."priest_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: priest_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "priest_bookings_provider_idx" ON "public"."priest_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: priest_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "priest_gallery_one_cover" ON "public"."priest_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: priest_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "priest_gallery_package_idx" ON "public"."priest_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: priest_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "priest_packages_provider_idx" ON "public"."priest_packages" USING "btree" ("provider_id", "status");


--
-- Name: provider_profiles_band_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "provider_profiles_band_category_idx" ON "public"."provider_profiles" USING "btree" ("band_category") WHERE ("band_category" IS NOT NULL);


--
-- Name: rental_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "rental_addons_package_idx" ON "public"."rental_addons" USING "btree" ("package_id");


--
-- Name: rental_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "rental_bookings_customer_idx" ON "public"."rental_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: rental_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "rental_bookings_provider_idx" ON "public"."rental_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: rental_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "rental_gallery_one_cover" ON "public"."rental_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: rental_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "rental_gallery_package_idx" ON "public"."rental_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: rental_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "rental_packages_provider_idx" ON "public"."rental_packages" USING "btree" ("provider_id", "status");


--
-- Name: security_events_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "security_events_created_idx" ON "public"."security_events" USING "btree" ("created_at" DESC);


--
-- Name: security_events_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "security_events_event_type_idx" ON "public"."security_events" USING "btree" ("event_type");


--
-- Name: security_events_risk_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "security_events_risk_idx" ON "public"."security_events" USING "btree" ("risk_score" DESC);


--
-- Name: security_events_severity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "security_events_severity_idx" ON "public"."security_events" USING "btree" ("severity");


--
-- Name: security_events_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "security_events_user_id_idx" ON "public"."security_events" USING "btree" ("user_id");


--
-- Name: singer_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "singer_addons_package_idx" ON "public"."singer_addons" USING "btree" ("package_id");


--
-- Name: singer_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "singer_bookings_customer_idx" ON "public"."singer_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: singer_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "singer_bookings_provider_idx" ON "public"."singer_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: singer_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "singer_gallery_package_idx" ON "public"."singer_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: singer_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "singer_packages_provider_idx" ON "public"."singer_packages" USING "btree" ("provider_id", "status");


--
-- Name: videography_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "videography_addons_package_idx" ON "public"."videography_addons" USING "btree" ("package_id");


--
-- Name: videography_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "videography_bookings_provider_idx" ON "public"."videography_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: videography_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "videography_gallery_package_idx" ON "public"."videography_gallery" USING "btree" ("package_id");


--
-- Name: videography_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "videography_packages_provider_idx" ON "public"."videography_packages" USING "btree" ("provider_id", "status");


--
-- Name: water_addons_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "water_addons_package_idx" ON "public"."water_addons" USING "btree" ("package_id");


--
-- Name: water_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "water_bookings_customer_idx" ON "public"."water_bookings" USING "btree" ("customer_id", "created_at" DESC);


--
-- Name: water_bookings_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "water_bookings_provider_idx" ON "public"."water_bookings" USING "btree" ("provider_id", "created_at" DESC);


--
-- Name: water_gallery_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "water_gallery_one_cover" ON "public"."water_gallery" USING "btree" ("package_id") WHERE "is_cover";


--
-- Name: water_gallery_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "water_gallery_package_idx" ON "public"."water_gallery" USING "btree" ("package_id", "sort_order");


--
-- Name: water_packages_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "water_packages_provider_idx" ON "public"."water_packages" USING "btree" ("provider_id", "status");


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX "idx_objects_bucket_id_name_lower" ON "storage"."objects" USING "btree" ("bucket_id", "lower"("name") COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();


--
-- Name: anchor_packages anchor_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "anchor_package_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."anchor_packages" FOR EACH ROW EXECUTE FUNCTION "public"."anchor_guard"();


--
-- Name: anchor_packages anchor_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "anchor_packages_updated_at" BEFORE UPDATE ON "public"."anchor_packages" FOR EACH ROW EXECUTE FUNCTION "public"."anchor_updated_at"();


--
-- Name: worker_documents audit_worker_documents_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_worker_documents_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."worker_documents" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_changes"();


--
-- Name: worker_profiles audit_worker_profiles_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "audit_worker_profiles_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."worker_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_changes"();


--
-- Name: band_packages band_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "band_packages_updated_at" BEFORE UPDATE ON "public"."band_packages" FOR EACH ROW EXECUTE FUNCTION "public"."band_pkg_updated_at"();


--
-- Name: banquet_halls banquet_hall_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "banquet_hall_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."banquet_halls" FOR EACH ROW EXECUTE FUNCTION "public"."banquet_guard"();


--
-- Name: banquet_halls banquet_halls_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "banquet_halls_updated_at" BEFORE UPDATE ON "public"."banquet_halls" FOR EACH ROW EXECUTE FUNCTION "public"."banquet_updated_at"();


--
-- Name: catering_packages catering_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "catering_package_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."catering_packages" FOR EACH ROW EXECUTE FUNCTION "public"."catering_guard"();


--
-- Name: catering_packages catering_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "catering_packages_updated_at" BEFORE UPDATE ON "public"."catering_packages" FOR EACH ROW EXECUTE FUNCTION "public"."catering_updated_at"();


--
-- Name: featured_artists check_featured_expiry; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "check_featured_expiry" BEFORE INSERT OR UPDATE ON "public"."featured_artists" FOR EACH ROW EXECUTE FUNCTION "public"."expire_featured_artists"();


--
-- Name: decorator_packages decorator_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "decorator_package_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."decorator_packages" FOR EACH ROW EXECUTE FUNCTION "public"."decorator_guard"();


--
-- Name: decorator_packages decorator_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "decorator_packages_updated_at" BEFORE UPDATE ON "public"."decorator_packages" FOR EACH ROW EXECUTE FUNCTION "public"."decorator_updated_at"();


--
-- Name: supplier_delivery_settings delivery_settings_provider_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "delivery_settings_provider_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."supplier_delivery_settings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_water_supplier_owner"();


--
-- Name: dj_packages dj_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "dj_package_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."dj_packages" FOR EACH ROW EXECUTE FUNCTION "public"."dj_guard"();


--
-- Name: dj_packages dj_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "dj_packages_updated_at" BEFORE UPDATE ON "public"."dj_packages" FOR EACH ROW EXECUTE FUNCTION "public"."dj_updated_at"();


--
-- Name: drone_packages drone_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "drone_package_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."drone_packages" FOR EACH ROW EXECUTE FUNCTION "public"."drone_guard"();


--
-- Name: drone_packages drone_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "drone_packages_updated_at" BEFORE UPDATE ON "public"."drone_packages" FOR EACH ROW EXECUTE FUNCTION "public"."drone_updated_at"();


--
-- Name: makeup_packages makeup_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "makeup_package_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."makeup_packages" FOR EACH ROW EXECUTE FUNCTION "public"."makeup_guard"();


--
-- Name: makeup_packages makeup_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "makeup_packages_updated_at" BEFORE UPDATE ON "public"."makeup_packages" FOR EACH ROW EXECUTE FUNCTION "public"."makeup_updated_at"();


--
-- Name: mehendi_packages mehendi_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "mehendi_package_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."mehendi_packages" FOR EACH ROW EXECUTE FUNCTION "public"."mehendi_guard"();


--
-- Name: mehendi_packages mehendi_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "mehendi_packages_updated_at" BEFORE UPDATE ON "public"."mehendi_packages" FOR EACH ROW EXECUTE FUNCTION "public"."mehendi_updated_at"();


--
-- Name: reviews on_review_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "on_review_created" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_provider_rating"();


--
-- Name: photographer_availability photography_availability_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "photography_availability_guard" BEFORE INSERT OR UPDATE OF "photographer_id" ON "public"."photographer_availability" FOR EACH ROW EXECUTE FUNCTION "public"."photography_guard"();


--
-- Name: photography_carts photography_cart_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "photography_cart_guard" BEFORE INSERT OR UPDATE OF "photographer_id" ON "public"."photography_carts" FOR EACH ROW EXECUTE FUNCTION "public"."photography_cart_guard"();


--
-- Name: photography_carts photography_carts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "photography_carts_updated_at" BEFORE UPDATE ON "public"."photography_carts" FOR EACH ROW EXECUTE FUNCTION "public"."photography_cart_updated_at"();


--
-- Name: photography_packages photography_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "photography_package_guard" BEFORE INSERT OR UPDATE OF "photographer_id" ON "public"."photography_packages" FOR EACH ROW EXECUTE FUNCTION "public"."photography_guard"();


--
-- Name: photography_packages photography_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "photography_packages_updated_at" BEFORE UPDATE ON "public"."photography_packages" FOR EACH ROW EXECUTE FUNCTION "public"."photography_updated_at"();


--
-- Name: photography_videography_packages photography_videography_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "photography_videography_packages_updated_at" BEFORE UPDATE ON "public"."photography_videography_packages" FOR EACH ROW EXECUTE FUNCTION "public"."photography_videography_updated_at"();


--
-- Name: priest_packages priest_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "priest_package_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."priest_packages" FOR EACH ROW EXECUTE FUNCTION "public"."priest_guard"();


--
-- Name: priest_packages priest_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "priest_packages_updated_at" BEFORE UPDATE ON "public"."priest_packages" FOR EACH ROW EXECUTE FUNCTION "public"."priest_updated_at"();


--
-- Name: product_orders product_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "product_orders_updated_at" BEFORE UPDATE ON "public"."product_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_water_updated_at"();


--
-- Name: rental_bookings rental_inventory_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "rental_inventory_trigger" BEFORE UPDATE ON "public"."rental_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."rental_inventory_update"();


--
-- Name: rental_packages rental_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "rental_package_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."rental_packages" FOR EACH ROW EXECUTE FUNCTION "public"."rental_guard"();


--
-- Name: rental_packages rental_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "rental_packages_updated_at" BEFORE UPDATE ON "public"."rental_packages" FOR EACH ROW EXECUTE FUNCTION "public"."rental_updated_at"();


--
-- Name: auth_promotion_media set_auth_promotion_media_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_auth_promotion_media_updated_at" BEFORE UPDATE ON "public"."auth_promotion_media" FOR EACH ROW EXECUTE FUNCTION "public"."set_auth_promotion_media_updated_at"();


--
-- Name: auth_promotion_videos set_auth_promotion_videos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_auth_promotion_videos_updated_at" BEFORE UPDATE ON "public"."auth_promotion_videos" FOR EACH ROW EXECUTE FUNCTION "public"."set_auth_promotion_videos_updated_at"();


--
-- Name: supplier_delivery_settings supplier_delivery_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "supplier_delivery_updated_at" BEFORE UPDATE ON "public"."supplier_delivery_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_water_updated_at"();


--
-- Name: about_team_members trg_check_cofounder_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_check_cofounder_limit" BEFORE INSERT OR UPDATE ON "public"."about_team_members" FOR EACH ROW EXECUTE FUNCTION "public"."check_cofounder_limit"();


--
-- Name: about_team_members trg_check_founder_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_check_founder_limit" BEFORE INSERT OR UPDATE ON "public"."about_team_members" FOR EACH ROW EXECUTE FUNCTION "public"."check_founder_limit"();


--
-- Name: bookings update_analytics_on_booking; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_analytics_on_booking" AFTER INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_daily_analytics"();


--
-- Name: artist_bookings update_artist_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_artist_bookings_updated_at" BEFORE UPDATE ON "public"."artist_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: artist_categories update_artist_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_artist_categories_updated_at" BEFORE UPDATE ON "public"."artist_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: bank_details update_bank_details_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_bank_details_updated_at" BEFORE UPDATE ON "public"."bank_details" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: bookings update_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: budget_allocations update_budget_allocations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_budget_allocations_updated_at" BEFORE UPDATE ON "public"."budget_allocations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: event_bookings update_event_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_event_bookings_updated_at" BEFORE UPDATE ON "public"."event_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: pricing_packages update_pricing_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_pricing_packages_updated_at" BEFORE UPDATE ON "public"."pricing_packages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: provider_calendar update_provider_calendar_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_provider_calendar_updated_at" BEFORE UPDATE ON "public"."provider_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: provider_profiles update_provider_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_provider_profiles_updated_at" BEFORE UPDATE ON "public"."provider_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: provider_time_slots update_provider_time_slots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_provider_time_slots_updated_at" BEFORE UPDATE ON "public"."provider_time_slots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: worker_profiles update_worker_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_worker_profiles_updated_at" BEFORE UPDATE ON "public"."worker_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: auth_promotion_media validate_promotion_vendor_package_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "validate_promotion_vendor_package_trigger" BEFORE INSERT OR UPDATE ON "public"."auth_promotion_media" FOR EACH ROW EXECUTE FUNCTION "public"."validate_promotion_vendor_package"();


--
-- Name: videography_packages videography_package_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "videography_package_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."videography_packages" FOR EACH ROW EXECUTE FUNCTION "public"."videography_guard"();


--
-- Name: videography_packages videography_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "videography_packages_updated_at" BEFORE UPDATE ON "public"."videography_packages" FOR EACH ROW EXECUTE FUNCTION "public"."videography_updated_at"();


--
-- Name: water_packages water_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "water_packages_updated_at" BEFORE UPDATE ON "public"."water_packages" FOR EACH ROW EXECUTE FUNCTION "public"."water_pkg_updated_at"();


--
-- Name: water_products water_product_provider_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "water_product_provider_guard" BEFORE INSERT OR UPDATE OF "provider_id" ON "public"."water_products" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_water_supplier_owner"();


--
-- Name: water_products water_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "water_products_updated_at" BEFORE UPDATE ON "public"."water_products" FOR EACH ROW EXECUTE FUNCTION "public"."set_water_updated_at"();


--
-- Name: water_product_stock water_stock_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "water_stock_updated_at" BEFORE UPDATE ON "public"."water_product_stock" FOR EACH ROW EXECUTE FUNCTION "public"."set_water_updated_at"();


--
-- Name: water_product_variants water_variants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "water_variants_updated_at" BEFORE UPDATE ON "public"."water_product_variants" FOR EACH ROW EXECUTE FUNCTION "public"."set_water_updated_at"();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER "protect_buckets_delete" BEFORE DELETE ON "storage"."buckets" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER "protect_objects_delete" BEFORE DELETE ON "storage"."objects" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: about_us about_us_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."about_us"
    ADD CONSTRAINT "about_us_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: admin_event_package_bookings admin_event_package_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_package_bookings"
    ADD CONSTRAINT "admin_event_package_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: admin_event_package_bookings admin_event_package_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_package_bookings"
    ADD CONSTRAINT "admin_event_package_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."admin_event_packages"("id") ON DELETE RESTRICT;


--
-- Name: admin_event_package_discounts admin_event_package_discounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_package_discounts"
    ADD CONSTRAINT "admin_event_package_discounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: admin_event_package_discounts admin_event_package_discounts_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_package_discounts"
    ADD CONSTRAINT "admin_event_package_discounts_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."admin_event_packages"("id") ON DELETE CASCADE;


--
-- Name: admin_event_package_inclusions admin_event_package_inclusions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_package_inclusions"
    ADD CONSTRAINT "admin_event_package_inclusions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."artist_categories"("id") ON DELETE CASCADE;


--
-- Name: admin_event_package_inclusions admin_event_package_inclusions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_package_inclusions"
    ADD CONSTRAINT "admin_event_package_inclusions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."admin_event_packages"("id") ON DELETE CASCADE;


--
-- Name: admin_event_packages admin_event_packages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_packages"
    ADD CONSTRAINT "admin_event_packages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: admin_event_packages admin_event_packages_event_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admin_event_packages"
    ADD CONSTRAINT "admin_event_packages_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE CASCADE;


--
-- Name: ai_conversations ai_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ai_message_feedback ai_message_feedback_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_message_feedback"
    ADD CONSTRAINT "ai_message_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE CASCADE;


--
-- Name: ai_message_feedback ai_message_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_message_feedback"
    ADD CONSTRAINT "ai_message_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ai_messages ai_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE;


--
-- Name: ai_messages ai_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: anchor_addons anchor_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."anchor_addons"
    ADD CONSTRAINT "anchor_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."anchor_packages"("id") ON DELETE CASCADE;


--
-- Name: anchor_bookings anchor_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."anchor_bookings"
    ADD CONSTRAINT "anchor_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: anchor_bookings anchor_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."anchor_bookings"
    ADD CONSTRAINT "anchor_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."anchor_packages"("id");


--
-- Name: anchor_bookings anchor_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."anchor_bookings"
    ADD CONSTRAINT "anchor_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: anchor_gallery anchor_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."anchor_gallery"
    ADD CONSTRAINT "anchor_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."anchor_packages"("id") ON DELETE CASCADE;


--
-- Name: anchor_packages anchor_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."anchor_packages"
    ADD CONSTRAINT "anchor_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: artist_bookings artist_bookings_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."artist_bookings"
    ADD CONSTRAINT "artist_bookings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."event_bookings"("id") ON DELETE CASCADE;


--
-- Name: artist_bookings artist_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."artist_bookings"
    ADD CONSTRAINT "artist_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: auth_promotion_media auth_promotion_media_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotion_media"
    ADD CONSTRAINT "auth_promotion_media_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--
-- Name: auth_promotion_media auth_promotion_media_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotion_media"
    ADD CONSTRAINT "auth_promotion_media_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE SET NULL;


--
-- Name: auth_promotion_video_views auth_promotion_video_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotion_video_views"
    ADD CONSTRAINT "auth_promotion_video_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: auth_promotion_video_views auth_promotion_video_views_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotion_video_views"
    ADD CONSTRAINT "auth_promotion_video_views_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."auth_promotion_videos"("id") ON DELETE CASCADE;


--
-- Name: auth_promotion_videos auth_promotion_videos_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotion_videos"
    ADD CONSTRAINT "auth_promotion_videos_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--
-- Name: auth_promotional_config auth_promotional_config_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_promotional_config"
    ADD CONSTRAINT "auth_promotional_config_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--
-- Name: band_addons band_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_addons"
    ADD CONSTRAINT "band_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."band_packages"("id") ON DELETE CASCADE;


--
-- Name: band_bookings band_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_bookings"
    ADD CONSTRAINT "band_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: band_bookings band_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_bookings"
    ADD CONSTRAINT "band_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."band_packages"("id");


--
-- Name: band_bookings band_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_bookings"
    ADD CONSTRAINT "band_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: band_gallery band_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_gallery"
    ADD CONSTRAINT "band_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."band_packages"("id") ON DELETE CASCADE;


--
-- Name: band_packages band_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."band_packages"
    ADD CONSTRAINT "band_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: bank_details bank_details_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_details"
    ADD CONSTRAINT "bank_details_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: banquet_bookings banquet_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."banquet_bookings"
    ADD CONSTRAINT "banquet_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: banquet_bookings banquet_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."banquet_bookings"
    ADD CONSTRAINT "banquet_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."banquet_halls"("id");


--
-- Name: banquet_bookings banquet_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."banquet_bookings"
    ADD CONSTRAINT "banquet_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: banquet_halls banquet_halls_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."banquet_halls"
    ADD CONSTRAINT "banquet_halls_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: booking_cancellations booking_cancellations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."booking_cancellations"
    ADD CONSTRAINT "booking_cancellations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: booking_start_otps booking_start_otps_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."booking_start_otps"
    ADD CONSTRAINT "booking_start_otps_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id");


--
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: bookings bookings_event_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id");


--
-- Name: bookings bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: budget_allocations budget_allocations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."budget_allocations"
    ADD CONSTRAINT "budget_allocations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."event_bookings"("id") ON DELETE CASCADE;


--
-- Name: catering_addons catering_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_addons"
    ADD CONSTRAINT "catering_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."catering_packages"("id") ON DELETE CASCADE;


--
-- Name: catering_bookings catering_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_bookings"
    ADD CONSTRAINT "catering_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: catering_bookings catering_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_bookings"
    ADD CONSTRAINT "catering_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."catering_packages"("id");


--
-- Name: catering_bookings catering_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_bookings"
    ADD CONSTRAINT "catering_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: catering_gallery catering_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_gallery"
    ADD CONSTRAINT "catering_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."catering_packages"("id") ON DELETE CASCADE;


--
-- Name: catering_menu_items catering_menu_items_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_menu_items"
    ADD CONSTRAINT "catering_menu_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."catering_menu_sections"("id") ON DELETE CASCADE;


--
-- Name: catering_menu_sections catering_menu_sections_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_menu_sections"
    ADD CONSTRAINT "catering_menu_sections_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."catering_packages"("id") ON DELETE CASCADE;


--
-- Name: catering_packages catering_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."catering_packages"
    ADD CONSTRAINT "catering_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: commission_tracking commission_tracking_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."commission_tracking"
    ADD CONSTRAINT "commission_tracking_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;


--
-- Name: commission_tracking commission_tracking_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."commission_tracking"
    ADD CONSTRAINT "commission_tracking_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: dancer_addons dancer_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dancer_addons"
    ADD CONSTRAINT "dancer_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."dancer_packages"("id") ON DELETE CASCADE;


--
-- Name: dancer_bookings dancer_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dancer_bookings"
    ADD CONSTRAINT "dancer_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: dancer_bookings dancer_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dancer_bookings"
    ADD CONSTRAINT "dancer_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."dancer_packages"("id");


--
-- Name: dancer_bookings dancer_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dancer_bookings"
    ADD CONSTRAINT "dancer_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: dancer_gallery dancer_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dancer_gallery"
    ADD CONSTRAINT "dancer_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."dancer_packages"("id") ON DELETE CASCADE;


--
-- Name: dancer_packages dancer_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dancer_packages"
    ADD CONSTRAINT "dancer_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: decorator_addons decorator_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decorator_addons"
    ADD CONSTRAINT "decorator_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."decorator_packages"("id") ON DELETE CASCADE;


--
-- Name: decorator_bookings decorator_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decorator_bookings"
    ADD CONSTRAINT "decorator_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: decorator_bookings decorator_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decorator_bookings"
    ADD CONSTRAINT "decorator_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."decorator_packages"("id");


--
-- Name: decorator_bookings decorator_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decorator_bookings"
    ADD CONSTRAINT "decorator_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: decorator_gallery decorator_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decorator_gallery"
    ADD CONSTRAINT "decorator_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."decorator_packages"("id") ON DELETE CASCADE;


--
-- Name: decorator_packages decorator_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decorator_packages"
    ADD CONSTRAINT "decorator_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: delivery_charges delivery_charges_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."delivery_charges"
    ADD CONSTRAINT "delivery_charges_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."product_orders"("id") ON DELETE CASCADE;


--
-- Name: dj_addons dj_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dj_addons"
    ADD CONSTRAINT "dj_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."dj_packages"("id") ON DELETE CASCADE;


--
-- Name: dj_bookings dj_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dj_bookings"
    ADD CONSTRAINT "dj_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: dj_bookings dj_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dj_bookings"
    ADD CONSTRAINT "dj_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."dj_packages"("id");


--
-- Name: dj_bookings dj_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dj_bookings"
    ADD CONSTRAINT "dj_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: dj_gallery dj_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dj_gallery"
    ADD CONSTRAINT "dj_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."dj_packages"("id") ON DELETE CASCADE;


--
-- Name: dj_packages dj_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dj_packages"
    ADD CONSTRAINT "dj_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: drone_addons drone_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."drone_addons"
    ADD CONSTRAINT "drone_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."drone_packages"("id") ON DELETE CASCADE;


--
-- Name: drone_bookings drone_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."drone_bookings"
    ADD CONSTRAINT "drone_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: drone_bookings drone_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."drone_bookings"
    ADD CONSTRAINT "drone_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."drone_packages"("id");


--
-- Name: drone_bookings drone_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."drone_bookings"
    ADD CONSTRAINT "drone_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: drone_gallery drone_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."drone_gallery"
    ADD CONSTRAINT "drone_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."drone_packages"("id") ON DELETE CASCADE;


--
-- Name: drone_packages drone_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."drone_packages"
    ADD CONSTRAINT "drone_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: event_bookings event_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."event_bookings"
    ADD CONSTRAINT "event_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: favorites favorites_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: featured_artists featured_artists_featured_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."featured_artists"
    ADD CONSTRAINT "featured_artists_featured_by_fkey" FOREIGN KEY ("featured_by") REFERENCES "auth"."users"("id");


--
-- Name: featured_artists featured_artists_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."featured_artists"
    ADD CONSTRAINT "featured_artists_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: hall_addons hall_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."hall_addons"
    ADD CONSTRAINT "hall_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."banquet_halls"("id") ON DELETE CASCADE;


--
-- Name: hall_gallery hall_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."hall_gallery"
    ADD CONSTRAINT "hall_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."banquet_halls"("id") ON DELETE CASCADE;


--
-- Name: invoices invoices_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id");


--
-- Name: invoices invoices_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: makeup_addons makeup_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."makeup_addons"
    ADD CONSTRAINT "makeup_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."makeup_packages"("id") ON DELETE CASCADE;


--
-- Name: makeup_bookings makeup_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."makeup_bookings"
    ADD CONSTRAINT "makeup_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: makeup_bookings makeup_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."makeup_bookings"
    ADD CONSTRAINT "makeup_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."makeup_packages"("id");


--
-- Name: makeup_bookings makeup_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."makeup_bookings"
    ADD CONSTRAINT "makeup_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: makeup_gallery makeup_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."makeup_gallery"
    ADD CONSTRAINT "makeup_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."makeup_packages"("id") ON DELETE CASCADE;


--
-- Name: makeup_packages makeup_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."makeup_packages"
    ADD CONSTRAINT "makeup_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: mehendi_addons mehendi_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."mehendi_addons"
    ADD CONSTRAINT "mehendi_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."mehendi_packages"("id") ON DELETE CASCADE;


--
-- Name: mehendi_bookings mehendi_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."mehendi_bookings"
    ADD CONSTRAINT "mehendi_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: mehendi_bookings mehendi_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."mehendi_bookings"
    ADD CONSTRAINT "mehendi_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."mehendi_packages"("id");


--
-- Name: mehendi_bookings mehendi_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."mehendi_bookings"
    ADD CONSTRAINT "mehendi_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: mehendi_gallery mehendi_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."mehendi_gallery"
    ADD CONSTRAINT "mehendi_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."mehendi_packages"("id") ON DELETE CASCADE;


--
-- Name: mehendi_packages mehendi_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."mehendi_packages"
    ADD CONSTRAINT "mehendi_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: menu_items menu_items_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: notification_settings notification_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: payments payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;


--
-- Name: photographer_availability photographer_availability_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photographer_availability"
    ADD CONSTRAINT "photographer_availability_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: photography_albums photography_albums_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_albums"
    ADD CONSTRAINT "photography_albums_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."photography_packages"("id") ON DELETE CASCADE;


--
-- Name: photography_booking_timeline photography_booking_timeline_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_booking_timeline"
    ADD CONSTRAINT "photography_booking_timeline_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: photography_booking_timeline photography_booking_timeline_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_booking_timeline"
    ADD CONSTRAINT "photography_booking_timeline_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."photography_package_bookings"("id") ON DELETE CASCADE;


--
-- Name: photography_cart_items photography_cart_items_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_cart_items"
    ADD CONSTRAINT "photography_cart_items_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."photography_albums"("id") ON DELETE SET NULL;


--
-- Name: photography_cart_items photography_cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_cart_items"
    ADD CONSTRAINT "photography_cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."photography_carts"("id") ON DELETE CASCADE;


--
-- Name: photography_cart_items photography_cart_items_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_cart_items"
    ADD CONSTRAINT "photography_cart_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."photography_packages"("id");


--
-- Name: photography_carts photography_carts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_carts"
    ADD CONSTRAINT "photography_carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: photography_carts photography_carts_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_carts"
    ADD CONSTRAINT "photography_carts_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: photography_package_addons photography_package_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_addons"
    ADD CONSTRAINT "photography_package_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."photography_packages"("id") ON DELETE CASCADE;


--
-- Name: photography_package_bookings photography_package_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_bookings"
    ADD CONSTRAINT "photography_package_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: photography_package_bookings photography_package_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_bookings"
    ADD CONSTRAINT "photography_package_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."photography_packages"("id");


--
-- Name: photography_package_bookings photography_package_bookings_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_bookings"
    ADD CONSTRAINT "photography_package_bookings_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: photography_package_bookings photography_package_bookings_selected_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_bookings"
    ADD CONSTRAINT "photography_package_bookings_selected_album_id_fkey" FOREIGN KEY ("selected_album_id") REFERENCES "public"."photography_albums"("id") ON DELETE SET NULL;


--
-- Name: photography_package_highlights photography_package_highlights_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_highlights"
    ADD CONSTRAINT "photography_package_highlights_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."photography_packages"("id") ON DELETE CASCADE;


--
-- Name: photography_package_images photography_package_images_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_images"
    ADD CONSTRAINT "photography_package_images_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."photography_packages"("id") ON DELETE CASCADE;


--
-- Name: photography_package_invoices photography_package_invoices_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_invoices"
    ADD CONSTRAINT "photography_package_invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."photography_package_bookings"("id") ON DELETE CASCADE;


--
-- Name: photography_package_payments photography_package_payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_payments"
    ADD CONSTRAINT "photography_package_payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."photography_package_bookings"("id") ON DELETE CASCADE;


--
-- Name: photography_package_reviews photography_package_reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_reviews"
    ADD CONSTRAINT "photography_package_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."photography_package_bookings"("id") ON DELETE CASCADE;


--
-- Name: photography_package_reviews photography_package_reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_reviews"
    ADD CONSTRAINT "photography_package_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: photography_package_reviews photography_package_reviews_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_package_reviews"
    ADD CONSTRAINT "photography_package_reviews_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."photography_packages"("id") ON DELETE CASCADE;


--
-- Name: photography_packages photography_packages_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_packages"
    ADD CONSTRAINT "photography_packages_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: photography_videography_package_addons photography_videography_package_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_videography_package_addons"
    ADD CONSTRAINT "photography_videography_package_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."photography_videography_packages"("id") ON DELETE CASCADE;


--
-- Name: photography_videography_package_bookings photography_videography_package_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_videography_package_bookings"
    ADD CONSTRAINT "photography_videography_package_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: photography_videography_package_bookings photography_videography_package_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_videography_package_bookings"
    ADD CONSTRAINT "photography_videography_package_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."photography_videography_packages"("id");


--
-- Name: photography_videography_package_bookings photography_videography_package_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_videography_package_bookings"
    ADD CONSTRAINT "photography_videography_package_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: photography_videography_package_images photography_videography_package_images_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_videography_package_images"
    ADD CONSTRAINT "photography_videography_package_images_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."photography_videography_packages"("id") ON DELETE CASCADE;


--
-- Name: photography_videography_packages photography_videography_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."photography_videography_packages"
    ADD CONSTRAINT "photography_videography_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: planner_recommendation_candidates planner_recommendation_candidates_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."planner_recommendation_candidates"
    ADD CONSTRAINT "planner_recommendation_candidates_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE RESTRICT;


--
-- Name: planner_recommendation_candidates planner_recommendation_candidates_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."planner_recommendation_candidates"
    ADD CONSTRAINT "planner_recommendation_candidates_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."planner_recommendation_runs"("id") ON DELETE CASCADE;


--
-- Name: planner_recommendation_runs planner_recommendation_runs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."planner_recommendation_runs"
    ADD CONSTRAINT "planner_recommendation_runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE SET NULL;


--
-- Name: planner_recommendation_runs planner_recommendation_runs_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."planner_recommendation_runs"
    ADD CONSTRAINT "planner_recommendation_runs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE SET NULL;


--
-- Name: planner_recommendation_runs planner_recommendation_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."planner_recommendation_runs"
    ADD CONSTRAINT "planner_recommendation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: platform_settings platform_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");


--
-- Name: pooja_services pooja_services_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pooja_services"
    ADD CONSTRAINT "pooja_services_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: portfolio_items portfolio_items_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."portfolio_items"
    ADD CONSTRAINT "portfolio_items_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: pricing_packages pricing_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pricing_packages"
    ADD CONSTRAINT "pricing_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: priest_addons priest_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."priest_addons"
    ADD CONSTRAINT "priest_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."priest_packages"("id") ON DELETE CASCADE;


--
-- Name: priest_bookings priest_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."priest_bookings"
    ADD CONSTRAINT "priest_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: priest_bookings priest_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."priest_bookings"
    ADD CONSTRAINT "priest_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."priest_packages"("id");


--
-- Name: priest_bookings priest_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."priest_bookings"
    ADD CONSTRAINT "priest_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: priest_gallery priest_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."priest_gallery"
    ADD CONSTRAINT "priest_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."priest_packages"("id") ON DELETE CASCADE;


--
-- Name: priest_packages priest_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."priest_packages"
    ADD CONSTRAINT "priest_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: product_order_items product_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_order_items"
    ADD CONSTRAINT "product_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."product_orders"("id") ON DELETE CASCADE;


--
-- Name: product_order_items product_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_order_items"
    ADD CONSTRAINT "product_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."water_products"("id");


--
-- Name: product_order_items product_order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_order_items"
    ADD CONSTRAINT "product_order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."water_product_variants"("id");


--
-- Name: product_orders product_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: product_orders product_orders_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: provider_availability provider_availability_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_availability"
    ADD CONSTRAINT "provider_availability_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: provider_calendar provider_calendar_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_calendar"
    ADD CONSTRAINT "provider_calendar_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: provider_faqs provider_faqs_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_faqs"
    ADD CONSTRAINT "provider_faqs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: provider_profiles provider_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_profiles"
    ADD CONSTRAINT "provider_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: provider_profiles provider_profiles_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_profiles"
    ADD CONSTRAINT "provider_profiles_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id");


--
-- Name: provider_time_slots provider_time_slots_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."provider_time_slots"
    ADD CONSTRAINT "provider_time_slots_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: rental_addons rental_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_addons"
    ADD CONSTRAINT "rental_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."rental_packages"("id") ON DELETE CASCADE;


--
-- Name: rental_bookings rental_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_bookings"
    ADD CONSTRAINT "rental_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: rental_bookings rental_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_bookings"
    ADD CONSTRAINT "rental_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."rental_packages"("id");


--
-- Name: rental_bookings rental_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_bookings"
    ADD CONSTRAINT "rental_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: rental_gallery rental_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_gallery"
    ADD CONSTRAINT "rental_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."rental_packages"("id") ON DELETE CASCADE;


--
-- Name: rental_items rental_items_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_items"
    ADD CONSTRAINT "rental_items_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: rental_packages rental_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rental_packages"
    ADD CONSTRAINT "rental_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: reschedule_requests reschedule_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reschedule_requests"
    ADD CONSTRAINT "reschedule_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: reschedule_requests reschedule_requests_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reschedule_requests"
    ADD CONSTRAINT "reschedule_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "auth"."users"("id");


--
-- Name: reviews reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;


--
-- Name: reviews reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: reviews reviews_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: search_history search_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."search_history"
    ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: singer_addons singer_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."singer_addons"
    ADD CONSTRAINT "singer_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."singer_packages"("id") ON DELETE CASCADE;


--
-- Name: singer_bookings singer_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."singer_bookings"
    ADD CONSTRAINT "singer_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: singer_bookings singer_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."singer_bookings"
    ADD CONSTRAINT "singer_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."singer_packages"("id");


--
-- Name: singer_bookings singer_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."singer_bookings"
    ADD CONSTRAINT "singer_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: singer_gallery singer_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."singer_gallery"
    ADD CONSTRAINT "singer_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."singer_packages"("id") ON DELETE CASCADE;


--
-- Name: singer_packages singer_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."singer_packages"
    ADD CONSTRAINT "singer_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: supplier_delivery_settings supplier_delivery_settings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_delivery_settings"
    ADD CONSTRAINT "supplier_delivery_settings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: vendor_cancellations vendor_cancellations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vendor_cancellations"
    ADD CONSTRAINT "vendor_cancellations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id");


--
-- Name: vendor_cancellations vendor_cancellations_vendor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vendor_cancellations"
    ADD CONSTRAINT "vendor_cancellations_vendor_user_id_fkey" FOREIGN KEY ("vendor_user_id") REFERENCES "auth"."users"("id");


--
-- Name: vendor_embeddings vendor_embeddings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vendor_embeddings"
    ADD CONSTRAINT "vendor_embeddings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: vendor_settlements vendor_settlements_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vendor_settlements"
    ADD CONSTRAINT "vendor_settlements_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id");


--
-- Name: vendor_settlements vendor_settlements_vendor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vendor_settlements"
    ADD CONSTRAINT "vendor_settlements_vendor_user_id_fkey" FOREIGN KEY ("vendor_user_id") REFERENCES "auth"."users"("id");


--
-- Name: videography_addons videography_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videography_addons"
    ADD CONSTRAINT "videography_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."videography_packages"("id") ON DELETE CASCADE;


--
-- Name: videography_bookings videography_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videography_bookings"
    ADD CONSTRAINT "videography_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: videography_bookings videography_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videography_bookings"
    ADD CONSTRAINT "videography_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."videography_packages"("id");


--
-- Name: videography_bookings videography_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videography_bookings"
    ADD CONSTRAINT "videography_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: videography_gallery videography_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videography_gallery"
    ADD CONSTRAINT "videography_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."videography_packages"("id") ON DELETE CASCADE;


--
-- Name: videography_packages videography_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videography_packages"
    ADD CONSTRAINT "videography_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: water_addons water_addons_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_addons"
    ADD CONSTRAINT "water_addons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."water_packages"("id") ON DELETE CASCADE;


--
-- Name: water_bookings water_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_bookings"
    ADD CONSTRAINT "water_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: water_bookings water_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_bookings"
    ADD CONSTRAINT "water_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."water_packages"("id");


--
-- Name: water_bookings water_bookings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_bookings"
    ADD CONSTRAINT "water_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id");


--
-- Name: water_gallery water_gallery_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_gallery"
    ADD CONSTRAINT "water_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."water_packages"("id") ON DELETE CASCADE;


--
-- Name: water_packages water_packages_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_packages"
    ADD CONSTRAINT "water_packages_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: water_product_images water_product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_images"
    ADD CONSTRAINT "water_product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."water_products"("id") ON DELETE CASCADE;


--
-- Name: water_product_reviews water_product_reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_reviews"
    ADD CONSTRAINT "water_product_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");


--
-- Name: water_product_reviews water_product_reviews_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_reviews"
    ADD CONSTRAINT "water_product_reviews_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."product_order_items"("id") ON DELETE CASCADE;


--
-- Name: water_product_reviews water_product_reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_reviews"
    ADD CONSTRAINT "water_product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."water_products"("id") ON DELETE CASCADE;


--
-- Name: water_product_stock water_product_stock_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_stock"
    ADD CONSTRAINT "water_product_stock_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."water_product_variants"("id") ON DELETE CASCADE;


--
-- Name: water_product_variants water_product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_product_variants"
    ADD CONSTRAINT "water_product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."water_products"("id") ON DELETE CASCADE;


--
-- Name: water_products water_products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_products"
    ADD CONSTRAINT "water_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."water_categories"("id");


--
-- Name: water_products water_products_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."water_products"
    ADD CONSTRAINT "water_products_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;


--
-- Name: worker_bank_accounts worker_bank_accounts_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worker_bank_accounts"
    ADD CONSTRAINT "worker_bank_accounts_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."worker_profiles"("user_id") ON DELETE CASCADE;


--
-- Name: worker_documents worker_documents_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worker_documents"
    ADD CONSTRAINT "worker_documents_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id");


--
-- Name: worker_documents worker_documents_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worker_documents"
    ADD CONSTRAINT "worker_documents_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."worker_profiles"("user_id") ON DELETE CASCADE;


--
-- Name: worker_profiles worker_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worker_profiles"
    ADD CONSTRAINT "worker_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_bank_accounts Admins can manage all worker bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all worker bank accounts" ON "public"."worker_bank_accounts" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));


--
-- Name: worker_documents Admins can manage all worker documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all worker documents" ON "public"."worker_documents" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));


--
-- Name: platform_analytics Admins can manage analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage analytics" ON "public"."platform_analytics" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: artist_categories Admins can manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage categories" ON "public"."artist_categories" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: commission_tracking Admins can manage commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage commissions" ON "public"."commission_tracking" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: featured_artists Admins can manage featured artists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage featured artists" ON "public"."featured_artists" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: invoices Admins can manage invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage invoices" ON "public"."invoices" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: worker_profiles Admins can update all workers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all workers" ON "public"."worker_profiles" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));


--
-- Name: audit_log Admins can view all audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all audit logs" ON "public"."audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));


--
-- Name: worker_profiles Admins can view all workers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all workers" ON "public"."worker_profiles" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));


--
-- Name: auth_promotion_media Admins delete auth promotion media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete auth promotion media" ON "public"."auth_promotion_media" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: auth_promotion_media Admins insert auth promotion media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert auth promotion media" ON "public"."auth_promotion_media" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: auth_promotion_media Admins update auth promotion media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update auth promotion media" ON "public"."auth_promotion_media" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: login_attempts All users can view login attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All users can view login attempts" ON "public"."login_attempts" FOR SELECT USING (true);


--
-- Name: notifications Authenticated can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: worker_profiles Authenticated users can insert worker profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert worker profile" ON "public"."worker_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: provider_availability Availability is viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Availability is viewable by everyone" ON "public"."provider_availability" FOR SELECT USING (true);


--
-- Name: bookings Booking parties can update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Booking parties can update" ON "public"."bookings" FOR UPDATE USING ((("auth"."uid"() = "customer_id") OR (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"()))))));


--
-- Name: payments Booking parties can view payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Booking parties can view payments" ON "public"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "payments"."booking_id") AND (("b"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."provider_profiles"
          WHERE (("provider_profiles"."id" = "b"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))))));


--
-- Name: bookings Customers can create bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("auth"."uid"() = "customer_id"));


--
-- Name: reviews Customers can create reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create reviews" ON "public"."reviews" FOR INSERT WITH CHECK ((("auth"."uid"() = "customer_id") AND (EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "reviews"."booking_id") AND ("bookings"."customer_id" = "auth"."uid"()) AND ("bookings"."status" = 'completed'::"public"."booking_status"))))));


--
-- Name: event_bookings Customers can delete own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can delete own events" ON "public"."event_bookings" FOR DELETE USING (("auth"."uid"() = "customer_id"));


--
-- Name: artist_bookings Customers can insert artist bookings for own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can insert artist bookings for own events" ON "public"."artist_bookings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."event_bookings"
  WHERE (("event_bookings"."id" = "artist_bookings"."event_id") AND ("event_bookings"."customer_id" = "auth"."uid"())))));


--
-- Name: budget_allocations Customers can insert budget for own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can insert budget for own events" ON "public"."budget_allocations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."event_bookings"
  WHERE (("event_bookings"."id" = "budget_allocations"."event_id") AND ("event_bookings"."customer_id" = "auth"."uid"())))));


--
-- Name: event_bookings Customers can insert own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can insert own events" ON "public"."event_bookings" FOR INSERT WITH CHECK (("auth"."uid"() = "customer_id"));


--
-- Name: budget_allocations Customers can update budget for own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update budget for own events" ON "public"."budget_allocations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."event_bookings"
  WHERE (("event_bookings"."id" = "budget_allocations"."event_id") AND ("event_bookings"."customer_id" = "auth"."uid"())))));


--
-- Name: event_bookings Customers can update own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update own events" ON "public"."event_bookings" FOR UPDATE USING (("auth"."uid"() = "customer_id"));


--
-- Name: artist_bookings Customers can view artist bookings for own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view artist bookings for own events" ON "public"."artist_bookings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."event_bookings"
  WHERE (("event_bookings"."id" = "artist_bookings"."event_id") AND ("event_bookings"."customer_id" = "auth"."uid"())))));


--
-- Name: budget_allocations Customers can view budget for own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view budget for own events" ON "public"."budget_allocations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."event_bookings"
  WHERE (("event_bookings"."id" = "budget_allocations"."event_id") AND ("event_bookings"."customer_id" = "auth"."uid"())))));


--
-- Name: event_bookings Customers can view own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own events" ON "public"."event_bookings" FOR SELECT USING (("auth"."uid"() = "customer_id"));


--
-- Name: event_types Event types are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Event types are viewable by everyone" ON "public"."event_types" FOR SELECT USING (true);


--
-- Name: platform_analytics Everyone can view analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view analytics" ON "public"."platform_analytics" FOR SELECT USING (true);


--
-- Name: artist_categories Everyone can view categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view categories" ON "public"."artist_categories" FOR SELECT USING (true);


--
-- Name: favorites Everyone can view favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view favorites" ON "public"."favorites" FOR SELECT USING (true);


--
-- Name: featured_artists Everyone can view featured artists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view featured artists" ON "public"."featured_artists" FOR SELECT USING (true);


--
-- Name: pricing_packages Everyone can view pricing packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view pricing packages" ON "public"."pricing_packages" FOR SELECT USING (true);


--
-- Name: provider_time_slots Everyone can view time slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view time slots" ON "public"."provider_time_slots" FOR SELECT USING (true);


--
-- Name: portfolio_items Portfolio items are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Portfolio items are viewable by everyone" ON "public"."portfolio_items" FOR SELECT USING (true);


--
-- Name: profiles Profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);


--
-- Name: provider_profiles Provider profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Provider profiles are viewable by everyone" ON "public"."provider_profiles" FOR SELECT USING (true);


--
-- Name: provider_availability Providers can delete own availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can delete own availability" ON "public"."provider_availability" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "provider_availability"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: portfolio_items Providers can delete own portfolio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can delete own portfolio" ON "public"."portfolio_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "portfolio_items"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: portfolio_items Providers can insert own portfolio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can insert own portfolio" ON "public"."portfolio_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "portfolio_items"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: provider_profiles Providers can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can insert own profile" ON "public"."provider_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: provider_availability Providers can manage own availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can manage own availability" ON "public"."provider_availability" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "provider_availability"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "provider_availability"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: bank_details Providers can manage own bank details; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can manage own bank details" ON "public"."bank_details" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "bank_details"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: provider_calendar Providers can manage own calendar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can manage own calendar" ON "public"."provider_calendar" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "provider_calendar"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: pricing_packages Providers can manage own pricing packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can manage own pricing packages" ON "public"."pricing_packages" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "pricing_packages"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: provider_time_slots Providers can manage own time slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can manage own time slots" ON "public"."provider_time_slots" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "provider_time_slots"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: artist_bookings Providers can update own bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can update own bookings" ON "public"."artist_bookings" FOR UPDATE USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: provider_profiles Providers can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can update own profile" ON "public"."provider_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: artist_bookings Providers can view own bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can view own bookings" ON "public"."artist_bookings" FOR SELECT USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: commission_tracking Providers can view own commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers can view own commissions" ON "public"."commission_tracking" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "commission_tracking"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: auth_promotion_media Public read active auth promotion media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read active auth promotion media" ON "public"."auth_promotion_media" FOR SELECT USING ((("is_active" AND "is_published") OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));


--
-- Name: reviews Reviews are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviews are viewable by everyone" ON "public"."reviews" FOR SELECT USING (true);


--
-- Name: login_attempts Service can insert login attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert login attempts" ON "public"."login_attempts" FOR INSERT WITH CHECK (true);


--
-- Name: otp_rate_limits Service can insert rate limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert rate limits" ON "public"."otp_rate_limits" FOR INSERT WITH CHECK (true);


--
-- Name: user_roles Service can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert roles" ON "public"."user_roles" FOR INSERT WITH CHECK (true);


--
-- Name: user_roles Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON "public"."user_roles" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));


--
-- Name: notifications Users can delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: push_subscriptions Users can delete own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own subscriptions" ON "public"."push_subscriptions" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: otp_verifications Users can insert OTP verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert OTP verifications" ON "public"."otp_verifications" FOR INSERT WITH CHECK (true);


--
-- Name: refresh_tokens Users can insert own refresh tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own refresh tokens" ON "public"."refresh_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: search_history Users can insert own search history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own search history" ON "public"."search_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: push_subscriptions Users can insert own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own subscriptions" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: favorites Users can manage own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own favorites" ON "public"."favorites" USING (("auth"."uid"() = "user_id"));


--
-- Name: notification_settings Users can manage own notification settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own notification settings" ON "public"."notification_settings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: otp_verifications Users can update OTP verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update OTP verifications" ON "public"."otp_verifications" FOR UPDATE USING (true);


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));


--
-- Name: refresh_tokens Users can update own refresh tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own refresh tokens" ON "public"."refresh_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: otp_verifications Users can verify OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can verify OTP" ON "public"."otp_verifications" FOR SELECT USING (true);


--
-- Name: audit_log Users can view own audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own audit logs" ON "public"."audit_log" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: bookings Users can view own bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own bookings" ON "public"."bookings" FOR SELECT USING ((("auth"."uid"() = "customer_id") OR (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"()))))));


--
-- Name: invoices Users can view own invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own invoices" ON "public"."invoices" FOR SELECT USING ((("auth"."uid"() = "customer_id") OR (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "invoices"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"()))))));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: refresh_tokens Users can view own refresh tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own refresh tokens" ON "public"."refresh_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: search_history Users can view own search history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own search history" ON "public"."search_history" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: push_subscriptions Users can view own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own subscriptions" ON "public"."push_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ai_message_feedback Users manage own AI message feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own AI message feedback" ON "public"."ai_message_feedback" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: planner_recommendation_runs Users manage own planner recommendation runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own planner recommendation runs" ON "public"."planner_recommendation_runs" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: planner_recommendation_candidates Users read recommendation candidates from own runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read recommendation candidates from own runs" ON "public"."planner_recommendation_candidates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."planner_recommendation_runs" "run"
  WHERE (("run"."id" = "planner_recommendation_candidates"."run_id") AND ("run"."user_id" = "auth"."uid"())))));


--
-- Name: worker_bank_accounts Workers can insert own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workers can insert own bank accounts" ON "public"."worker_bank_accounts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."worker_profiles" "wp"
  WHERE (("wp"."user_id" = "auth"."uid"()) AND ("wp"."user_id" = "worker_bank_accounts"."worker_id")))));


--
-- Name: worker_documents Workers can insert own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workers can insert own documents" ON "public"."worker_documents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."worker_profiles" "wp"
  WHERE (("wp"."user_id" = "auth"."uid"()) AND ("wp"."user_id" = "worker_documents"."worker_id")))));


--
-- Name: worker_profiles Workers can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workers can update own profile" ON "public"."worker_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: worker_bank_accounts Workers can view own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workers can view own bank accounts" ON "public"."worker_bank_accounts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."worker_profiles" "wp"
  WHERE (("wp"."user_id" = "auth"."uid"()) AND ("wp"."user_id" = "worker_bank_accounts"."worker_id")))));


--
-- Name: worker_documents Workers can view own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workers can view own documents" ON "public"."worker_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."worker_profiles" "wp"
  WHERE (("wp"."user_id" = "auth"."uid"()) AND ("wp"."user_id" = "worker_documents"."worker_id")))));


--
-- Name: worker_profiles Workers can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workers can view own profile" ON "public"."worker_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: about_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."about_team_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: about_team_members about_team_members_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "about_team_members_admin_delete" ON "public"."about_team_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: about_team_members about_team_members_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "about_team_members_admin_insert" ON "public"."about_team_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: about_team_members about_team_members_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "about_team_members_admin_read" ON "public"."about_team_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: about_team_members about_team_members_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "about_team_members_admin_update" ON "public"."about_team_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: about_team_members about_team_members_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "about_team_members_public_read" ON "public"."about_team_members" FOR SELECT USING (("is_active" = true));


--
-- Name: about_us; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."about_us" ENABLE ROW LEVEL SECURITY;

--
-- Name: about_us about_us_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "about_us_admin_delete" ON "public"."about_us" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: about_us about_us_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "about_us_admin_update" ON "public"."about_us" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: about_us about_us_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "about_us_admin_write" ON "public"."about_us" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: about_us about_us_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "about_us_public_read" ON "public"."about_us" FOR SELECT USING (true);


--
-- Name: platform_settings admin_can_insert_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_can_insert_settings" ON "public"."platform_settings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));


--
-- Name: platform_settings admin_can_update_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_can_update_settings" ON "public"."platform_settings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));


--
-- Name: admin_event_package_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."admin_event_package_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_event_package_bookings admin_event_package_bookings_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_event_package_bookings_admin_all" ON "public"."admin_event_package_bookings" USING (( SELECT (("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"))) WITH CHECK (( SELECT (("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text")));


--
-- Name: admin_event_package_bookings admin_event_package_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_event_package_bookings_customer_insert" ON "public"."admin_event_package_bookings" FOR INSERT WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: admin_event_package_bookings admin_event_package_bookings_customer_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_event_package_bookings_customer_view" ON "public"."admin_event_package_bookings" FOR SELECT USING (("customer_id" = "auth"."uid"()));


--
-- Name: admin_event_package_discounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."admin_event_package_discounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_event_package_discounts admin_event_package_discounts_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_event_package_discounts_admin_all" ON "public"."admin_event_package_discounts" USING (( SELECT (("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"))) WITH CHECK (( SELECT (("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text")));


--
-- Name: admin_event_package_inclusions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."admin_event_package_inclusions" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_event_package_inclusions admin_event_package_inclusions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_event_package_inclusions_admin_all" ON "public"."admin_event_package_inclusions" USING (( SELECT (("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"))) WITH CHECK (( SELECT (("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text")));


--
-- Name: admin_event_package_inclusions admin_event_package_inclusions_customer_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_event_package_inclusions_customer_view" ON "public"."admin_event_package_inclusions" FOR SELECT USING (true);


--
-- Name: admin_event_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."admin_event_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_event_packages admin_event_packages_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_event_packages_admin_all" ON "public"."admin_event_packages" USING (( SELECT (("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"))) WITH CHECK (( SELECT (("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text")));


--
-- Name: admin_event_packages admin_event_packages_customer_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_event_packages_customer_view" ON "public"."admin_event_packages" FOR SELECT USING (("is_active" = true));


--
-- Name: booking_cancellations admin_select_all_cancellations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_select_all_cancellations" ON "public"."booking_cancellations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));


--
-- Name: reschedule_requests admin_select_all_reschedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_select_all_reschedules" ON "public"."reschedule_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));


--
-- Name: vendor_settlements admin_select_all_settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_select_all_settlements" ON "public"."vendor_settlements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));


--
-- Name: vendor_cancellations admin_select_all_vendor_cancellations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_select_all_vendor_cancellations" ON "public"."vendor_cancellations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));


--
-- Name: ai_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ai_conversations" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_conversations ai_conversations_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ai_conversations_owner" ON "public"."ai_conversations" USING (("user_id" = "auth"."uid"()));


--
-- Name: ai_message_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ai_message_feedback" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ai_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_messages ai_messages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ai_messages_owner" ON "public"."ai_messages" USING (("user_id" = "auth"."uid"()));


--
-- Name: anchor_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."anchor_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: anchor_addons anchor_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anchor_addons_owner" ON "public"."anchor_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."anchor_packages" "p"
  WHERE (("p"."id" = "anchor_addons"."package_id") AND "public"."owns_anchor"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."anchor_packages" "p"
  WHERE (("p"."id" = "anchor_addons"."package_id") AND "public"."owns_anchor"("p"."provider_id")))));


--
-- Name: anchor_addons anchor_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anchor_addons_read" ON "public"."anchor_addons" FOR SELECT USING (true);


--
-- Name: anchor_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."anchor_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: anchor_bookings anchor_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anchor_bookings_customer_insert" ON "public"."anchor_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "anchor_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: anchor_bookings anchor_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anchor_bookings_customer_update" ON "public"."anchor_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: anchor_bookings anchor_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anchor_bookings_provider_update" ON "public"."anchor_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_anchor"("provider_id")) WITH CHECK ("public"."owns_anchor"("provider_id"));


--
-- Name: anchor_bookings anchor_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anchor_bookings_read" ON "public"."anchor_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_anchor"("provider_id")));


--
-- Name: anchor_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."anchor_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: anchor_gallery anchor_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anchor_gallery_owner" ON "public"."anchor_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."anchor_packages" "p"
  WHERE (("p"."id" = "anchor_gallery"."package_id") AND "public"."owns_anchor"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."anchor_packages" "p"
  WHERE (("p"."id" = "anchor_gallery"."package_id") AND "public"."owns_anchor"("p"."provider_id")))));


--
-- Name: anchor_gallery anchor_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anchor_gallery_read" ON "public"."anchor_gallery" FOR SELECT USING (true);


--
-- Name: anchor_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."anchor_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: anchor_packages anchor_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anchor_packages_owner" ON "public"."anchor_packages" USING ("public"."owns_anchor"("provider_id")) WITH CHECK ("public"."owns_anchor"("provider_id"));


--
-- Name: anchor_packages anchor_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anchor_packages_read" ON "public"."anchor_packages" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_anchor"("provider_id")));


--
-- Name: platform_settings anyone_can_read_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anyone_can_read_settings" ON "public"."platform_settings" FOR SELECT USING (true);


--
-- Name: artist_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."artist_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_promotion_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."auth_promotion_media" ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_promotion_video_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."auth_promotion_video_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_promotion_video_views auth_promotion_video_views_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotion_video_views_admin_delete" ON "public"."auth_promotion_video_views" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: auth_promotion_video_views auth_promotion_video_views_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotion_video_views_admin_update" ON "public"."auth_promotion_video_views" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: auth_promotion_video_views auth_promotion_video_views_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotion_video_views_user_insert" ON "public"."auth_promotion_video_views" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: auth_promotion_video_views auth_promotion_video_views_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotion_video_views_user_select" ON "public"."auth_promotion_video_views" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));


--
-- Name: auth_promotion_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."auth_promotion_videos" ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_promotion_videos auth_promotion_videos_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotion_videos_admin_delete" ON "public"."auth_promotion_videos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: auth_promotion_videos auth_promotion_videos_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotion_videos_admin_insert" ON "public"."auth_promotion_videos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: auth_promotion_videos auth_promotion_videos_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotion_videos_admin_update" ON "public"."auth_promotion_videos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: auth_promotion_videos auth_promotion_videos_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotion_videos_public_select" ON "public"."auth_promotion_videos" FOR SELECT USING ((("is_active" = true) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));


--
-- Name: auth_promotional_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."auth_promotional_config" ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_promotional_config auth_promotional_config_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotional_config_delete" ON "public"."auth_promotional_config" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: auth_promotional_config auth_promotional_config_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotional_config_insert" ON "public"."auth_promotional_config" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: auth_promotional_config auth_promotional_config_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotional_config_select" ON "public"."auth_promotional_config" FOR SELECT USING (true);


--
-- Name: auth_promotional_config auth_promotional_config_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_promotional_config_update" ON "public"."auth_promotional_config" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));


--
-- Name: vendor_settlements authenticated_insert_settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated_insert_settlements" ON "public"."vendor_settlements" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));


--
-- Name: vendor_settlements authenticated_update_settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated_update_settlements" ON "public"."vendor_settlements" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));


--
-- Name: band_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."band_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: band_addons band_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_addons_owner" ON "public"."band_addons" USING ((EXISTS ( SELECT 1
   FROM ("public"."band_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "band_addons"."package_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."band_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "band_addons"."package_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: band_addons band_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_addons_read" ON "public"."band_addons" FOR SELECT USING (true);


--
-- Name: band_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."band_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: band_bookings band_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_bookings_customer_insert" ON "public"."band_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "band_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: band_bookings band_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_bookings_customer_update" ON "public"."band_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: band_bookings band_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_bookings_provider_update" ON "public"."band_bookings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "band_bookings"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "band_bookings"."provider_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: band_bookings band_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_bookings_read" ON "public"."band_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "band_bookings"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))));


--
-- Name: band_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."band_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: band_categories band_categories_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_categories_read" ON "public"."band_categories" FOR SELECT USING (true);


--
-- Name: band_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."band_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: band_gallery band_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_gallery_owner" ON "public"."band_gallery" USING ((EXISTS ( SELECT 1
   FROM ("public"."band_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "band_gallery"."package_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."band_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "band_gallery"."package_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: band_gallery band_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_gallery_read" ON "public"."band_gallery" FOR SELECT USING (true);


--
-- Name: band_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."band_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: band_packages band_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_packages_owner" ON "public"."band_packages" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "band_packages"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "band_packages"."provider_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: band_packages band_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "band_packages_read" ON "public"."band_packages" FOR SELECT USING ((("status" = 'active'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "band_packages"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))));


--
-- Name: bank_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."bank_details" ENABLE ROW LEVEL SECURITY;

--
-- Name: banquet_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."banquet_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: banquet_bookings banquet_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "banquet_bookings_customer_insert" ON "public"."banquet_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "banquet_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: banquet_bookings banquet_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "banquet_bookings_customer_update" ON "public"."banquet_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: banquet_bookings banquet_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "banquet_bookings_provider_update" ON "public"."banquet_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_banquet_hall"("provider_id")) WITH CHECK ("public"."owns_banquet_hall"("provider_id"));


--
-- Name: banquet_bookings banquet_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "banquet_bookings_read" ON "public"."banquet_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_banquet_hall"("provider_id")));


--
-- Name: banquet_halls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."banquet_halls" ENABLE ROW LEVEL SECURITY;

--
-- Name: banquet_halls banquet_halls_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "banquet_halls_owner" ON "public"."banquet_halls" USING ("public"."owns_banquet_hall"("provider_id")) WITH CHECK ("public"."owns_banquet_hall"("provider_id"));


--
-- Name: banquet_halls banquet_halls_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "banquet_halls_read" ON "public"."banquet_halls" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_banquet_hall"("provider_id")));


--
-- Name: booking_cancellations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."booking_cancellations" ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."booking_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_events booking_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "booking_events_insert" ON "public"."booking_events" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: booking_events booking_events_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "booking_events_read" ON "public"."booking_events" FOR SELECT TO "authenticated" USING (true);


--
-- Name: booking_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."booking_locations" ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_locations booking_locations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "booking_locations_insert" ON "public"."booking_locations" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: booking_locations booking_locations_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "booking_locations_read" ON "public"."booking_locations" FOR SELECT TO "authenticated" USING (true);


--
-- Name: booking_start_otps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."booking_start_otps" ENABLE ROW LEVEL SECURITY;

--
-- Name: budget_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."budget_allocations" ENABLE ROW LEVEL SECURITY;

--
-- Name: catering_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."catering_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: catering_addons catering_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_addons_owner" ON "public"."catering_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."catering_packages" "p"
  WHERE (("p"."id" = "catering_addons"."package_id") AND "public"."owns_caterer"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."catering_packages" "p"
  WHERE (("p"."id" = "catering_addons"."package_id") AND "public"."owns_caterer"("p"."provider_id")))));


--
-- Name: catering_addons catering_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_addons_read" ON "public"."catering_addons" FOR SELECT USING (true);


--
-- Name: catering_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."catering_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: catering_bookings catering_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_bookings_customer_insert" ON "public"."catering_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "catering_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: catering_bookings catering_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_bookings_customer_update" ON "public"."catering_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: catering_bookings catering_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_bookings_provider_update" ON "public"."catering_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_caterer"("provider_id")) WITH CHECK ("public"."owns_caterer"("provider_id"));


--
-- Name: catering_bookings catering_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_bookings_read" ON "public"."catering_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_caterer"("provider_id")));


--
-- Name: catering_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."catering_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: catering_gallery catering_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_gallery_owner" ON "public"."catering_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."catering_packages" "p"
  WHERE (("p"."id" = "catering_gallery"."package_id") AND "public"."owns_caterer"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."catering_packages" "p"
  WHERE (("p"."id" = "catering_gallery"."package_id") AND "public"."owns_caterer"("p"."provider_id")))));


--
-- Name: catering_gallery catering_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_gallery_read" ON "public"."catering_gallery" FOR SELECT USING (true);


--
-- Name: catering_menu_items catering_items_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_items_owner" ON "public"."catering_menu_items" USING ((EXISTS ( SELECT 1
   FROM ("public"."catering_menu_sections" "s"
     JOIN "public"."catering_packages" "p" ON (("p"."id" = "s"."package_id")))
  WHERE (("s"."id" = "catering_menu_items"."section_id") AND "public"."owns_caterer"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."catering_menu_sections" "s"
     JOIN "public"."catering_packages" "p" ON (("p"."id" = "s"."package_id")))
  WHERE (("s"."id" = "catering_menu_items"."section_id") AND "public"."owns_caterer"("p"."provider_id")))));


--
-- Name: catering_menu_items catering_items_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_items_read" ON "public"."catering_menu_items" FOR SELECT USING (true);


--
-- Name: catering_menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."catering_menu_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: catering_menu_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."catering_menu_sections" ENABLE ROW LEVEL SECURITY;

--
-- Name: catering_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."catering_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: catering_packages catering_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_packages_owner" ON "public"."catering_packages" USING ("public"."owns_caterer"("provider_id")) WITH CHECK ("public"."owns_caterer"("provider_id"));


--
-- Name: catering_packages catering_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_packages_read" ON "public"."catering_packages" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_caterer"("provider_id")));


--
-- Name: catering_menu_sections catering_sections_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_sections_owner" ON "public"."catering_menu_sections" USING ((EXISTS ( SELECT 1
   FROM "public"."catering_packages" "p"
  WHERE (("p"."id" = "catering_menu_sections"."package_id") AND "public"."owns_caterer"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."catering_packages" "p"
  WHERE (("p"."id" = "catering_menu_sections"."package_id") AND "public"."owns_caterer"("p"."provider_id")))));


--
-- Name: catering_menu_sections catering_sections_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "catering_sections_read" ON "public"."catering_menu_sections" FOR SELECT USING (true);


--
-- Name: messages chat_insert_eligible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat_insert_eligible" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND "public"."is_chat_participant"("booking_id", "auth"."uid"()) AND "public"."is_chat_eligible"("booking_id")));


--
-- Name: messages chat_select_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat_select_participant" ON "public"."messages" FOR SELECT USING ("public"."is_chat_participant"("booking_id", "auth"."uid"()));


--
-- Name: messages chat_update_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat_update_read" ON "public"."messages" FOR UPDATE USING ((("sender_id" <> "auth"."uid"()) AND "public"."is_chat_participant"("booking_id", "auth"."uid"())));


--
-- Name: commission_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."commission_tracking" ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_cancellations customer_insert_cancellation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer_insert_cancellation" ON "public"."booking_cancellations" FOR INSERT WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: reschedule_requests customer_insert_reschedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer_insert_reschedule" ON "public"."reschedule_requests" FOR INSERT WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: booking_cancellations customer_select_own_cancellations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer_select_own_cancellations" ON "public"."booking_cancellations" FOR SELECT USING (("customer_id" = "auth"."uid"()));


--
-- Name: reschedule_requests customer_select_own_reschedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer_select_own_reschedules" ON "public"."reschedule_requests" FOR SELECT USING (("customer_id" = "auth"."uid"()));


--
-- Name: vendor_settlements customer_select_own_settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer_select_own_settlements" ON "public"."vendor_settlements" FOR SELECT USING (("customer_id" = "auth"."uid"()));


--
-- Name: vendor_cancellations customer_select_vendor_cancellations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer_select_vendor_cancellations" ON "public"."vendor_cancellations" FOR SELECT USING (("customer_id" = "auth"."uid"()));


--
-- Name: reschedule_requests customer_update_cancel_reschedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer_update_cancel_reschedule" ON "public"."reschedule_requests" FOR UPDATE USING ((("customer_id" = "auth"."uid"()) AND ("status" = 'pending'::"text")));


--
-- Name: dancer_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."dancer_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: dancer_addons dancer_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dancer_addons_owner" ON "public"."dancer_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."dancer_packages" "p"
  WHERE (("p"."id" = "dancer_addons"."package_id") AND ("p"."provider_id" IN ( SELECT "provider_profiles"."id"
           FROM "public"."provider_profiles"
          WHERE ("provider_profiles"."user_id" = "auth"."uid"()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."dancer_packages" "p"
  WHERE (("p"."id" = "dancer_addons"."package_id") AND ("p"."provider_id" IN ( SELECT "provider_profiles"."id"
           FROM "public"."provider_profiles"
          WHERE ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: dancer_addons dancer_addons_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dancer_addons_public_read" ON "public"."dancer_addons" FOR SELECT USING (true);


--
-- Name: dancer_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."dancer_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: dancer_bookings dancer_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dancer_bookings_customer_insert" ON "public"."dancer_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "dancer_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: dancer_bookings dancer_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dancer_bookings_provider_update" ON "public"."dancer_bookings" FOR UPDATE USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: dancer_bookings dancer_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dancer_bookings_read" ON "public"."dancer_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR ("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: dancer_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."dancer_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: dancer_gallery dancer_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dancer_gallery_owner" ON "public"."dancer_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."dancer_packages" "p"
  WHERE (("p"."id" = "dancer_gallery"."package_id") AND ("p"."provider_id" IN ( SELECT "provider_profiles"."id"
           FROM "public"."provider_profiles"
          WHERE ("provider_profiles"."user_id" = "auth"."uid"()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."dancer_packages" "p"
  WHERE (("p"."id" = "dancer_gallery"."package_id") AND ("p"."provider_id" IN ( SELECT "provider_profiles"."id"
           FROM "public"."provider_profiles"
          WHERE ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: dancer_gallery dancer_gallery_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dancer_gallery_public_read" ON "public"."dancer_gallery" FOR SELECT USING (true);


--
-- Name: dancer_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."dancer_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: dancer_packages dancer_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dancer_packages_owner" ON "public"."dancer_packages" USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: dancer_packages dancer_packages_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dancer_packages_public_read" ON "public"."dancer_packages" FOR SELECT USING (("status" = 'active'::"text"));


--
-- Name: decorator_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."decorator_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: decorator_addons decorator_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "decorator_addons_owner" ON "public"."decorator_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."decorator_packages" "p"
  WHERE (("p"."id" = "decorator_addons"."package_id") AND "public"."owns_decorator"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."decorator_packages" "p"
  WHERE (("p"."id" = "decorator_addons"."package_id") AND "public"."owns_decorator"("p"."provider_id")))));


--
-- Name: decorator_addons decorator_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "decorator_addons_read" ON "public"."decorator_addons" FOR SELECT USING (true);


--
-- Name: decorator_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."decorator_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: decorator_bookings decorator_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "decorator_bookings_customer_insert" ON "public"."decorator_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "decorator_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: decorator_bookings decorator_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "decorator_bookings_customer_update" ON "public"."decorator_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: decorator_bookings decorator_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "decorator_bookings_provider_update" ON "public"."decorator_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_decorator"("provider_id")) WITH CHECK ("public"."owns_decorator"("provider_id"));


--
-- Name: decorator_bookings decorator_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "decorator_bookings_read" ON "public"."decorator_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_decorator"("provider_id")));


--
-- Name: decorator_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."decorator_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: decorator_gallery decorator_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "decorator_gallery_owner" ON "public"."decorator_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."decorator_packages" "p"
  WHERE (("p"."id" = "decorator_gallery"."package_id") AND "public"."owns_decorator"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."decorator_packages" "p"
  WHERE (("p"."id" = "decorator_gallery"."package_id") AND "public"."owns_decorator"("p"."provider_id")))));


--
-- Name: decorator_gallery decorator_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "decorator_gallery_read" ON "public"."decorator_gallery" FOR SELECT USING (true);


--
-- Name: decorator_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."decorator_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: decorator_packages decorator_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "decorator_packages_owner" ON "public"."decorator_packages" USING ("public"."owns_decorator"("provider_id")) WITH CHECK ("public"."owns_decorator"("provider_id"));


--
-- Name: decorator_packages decorator_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "decorator_packages_read" ON "public"."decorator_packages" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_decorator"("provider_id")));


--
-- Name: delivery_charges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."delivery_charges" ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_charges delivery_charges_participant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delivery_charges_participant_read" ON "public"."delivery_charges" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."product_orders" "o"
  WHERE (("o"."id" = "delivery_charges"."order_id") AND (("o"."customer_id" = "auth"."uid"()) OR "public"."owns_water_supplier"("o"."provider_id"))))));


--
-- Name: supplier_delivery_settings delivery_settings_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delivery_settings_owner_write" ON "public"."supplier_delivery_settings" USING ("public"."owns_water_supplier"("provider_id")) WITH CHECK ("public"."owns_water_supplier"("provider_id"));


--
-- Name: supplier_delivery_settings delivery_settings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delivery_settings_read" ON "public"."supplier_delivery_settings" FOR SELECT USING (true);


--
-- Name: dj_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."dj_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: dj_addons dj_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dj_addons_owner" ON "public"."dj_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."dj_packages" "p"
  WHERE (("p"."id" = "dj_addons"."package_id") AND "public"."owns_dj"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."dj_packages" "p"
  WHERE (("p"."id" = "dj_addons"."package_id") AND "public"."owns_dj"("p"."provider_id")))));


--
-- Name: dj_addons dj_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dj_addons_read" ON "public"."dj_addons" FOR SELECT USING (true);


--
-- Name: dj_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."dj_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: dj_bookings dj_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dj_bookings_customer_insert" ON "public"."dj_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "dj_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: dj_bookings dj_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dj_bookings_customer_update" ON "public"."dj_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: dj_bookings dj_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dj_bookings_provider_update" ON "public"."dj_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_dj"("provider_id")) WITH CHECK ("public"."owns_dj"("provider_id"));


--
-- Name: dj_bookings dj_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dj_bookings_read" ON "public"."dj_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_dj"("provider_id")));


--
-- Name: dj_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."dj_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: dj_gallery dj_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dj_gallery_owner" ON "public"."dj_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."dj_packages" "p"
  WHERE (("p"."id" = "dj_gallery"."package_id") AND "public"."owns_dj"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."dj_packages" "p"
  WHERE (("p"."id" = "dj_gallery"."package_id") AND "public"."owns_dj"("p"."provider_id")))));


--
-- Name: dj_gallery dj_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dj_gallery_read" ON "public"."dj_gallery" FOR SELECT USING (true);


--
-- Name: dj_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."dj_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: dj_packages dj_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dj_packages_owner" ON "public"."dj_packages" USING ("public"."owns_dj"("provider_id")) WITH CHECK ("public"."owns_dj"("provider_id"));


--
-- Name: dj_packages dj_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dj_packages_read" ON "public"."dj_packages" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_dj"("provider_id")));


--
-- Name: drone_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."drone_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: drone_addons drone_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "drone_addons_owner" ON "public"."drone_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."drone_packages" "p"
  WHERE (("p"."id" = "drone_addons"."package_id") AND "public"."owns_drone_operator"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."drone_packages" "p"
  WHERE (("p"."id" = "drone_addons"."package_id") AND "public"."owns_drone_operator"("p"."provider_id")))));


--
-- Name: drone_addons drone_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "drone_addons_read" ON "public"."drone_addons" FOR SELECT USING (true);


--
-- Name: drone_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."drone_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: drone_bookings drone_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "drone_bookings_customer_insert" ON "public"."drone_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "drone_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: drone_bookings drone_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "drone_bookings_customer_update" ON "public"."drone_bookings" FOR UPDATE TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_drone_operator"("provider_id")));


--
-- Name: drone_bookings drone_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "drone_bookings_read" ON "public"."drone_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_drone_operator"("provider_id")));


--
-- Name: drone_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."drone_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: drone_gallery drone_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "drone_gallery_owner" ON "public"."drone_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."drone_packages" "p"
  WHERE (("p"."id" = "drone_gallery"."package_id") AND "public"."owns_drone_operator"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."drone_packages" "p"
  WHERE (("p"."id" = "drone_gallery"."package_id") AND "public"."owns_drone_operator"("p"."provider_id")))));


--
-- Name: drone_gallery drone_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "drone_gallery_read" ON "public"."drone_gallery" FOR SELECT USING (true);


--
-- Name: drone_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."drone_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: drone_packages drone_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "drone_packages_owner" ON "public"."drone_packages" USING ("public"."owns_drone_operator"("provider_id")) WITH CHECK ("public"."owns_drone_operator"("provider_id"));


--
-- Name: drone_packages drone_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "drone_packages_read" ON "public"."drone_packages" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_drone_operator"("provider_id")));


--
-- Name: vendor_embeddings embeddings_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "embeddings_admin_write" ON "public"."vendor_embeddings" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: vendor_embeddings embeddings_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "embeddings_public_read" ON "public"."vendor_embeddings" FOR SELECT USING (true);


--
-- Name: event_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."event_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: event_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."event_types" ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_faqs faqs_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "faqs_owner_write" ON "public"."provider_faqs" USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: provider_faqs faqs_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "faqs_public_read" ON "public"."provider_faqs" FOR SELECT USING (true);


--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;

--
-- Name: featured_artists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."featured_artists" ENABLE ROW LEVEL SECURITY;

--
-- Name: hall_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."hall_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: hall_addons hall_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "hall_addons_owner" ON "public"."hall_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."banquet_halls" "p"
  WHERE (("p"."id" = "hall_addons"."package_id") AND "public"."owns_banquet_hall"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."banquet_halls" "p"
  WHERE (("p"."id" = "hall_addons"."package_id") AND "public"."owns_banquet_hall"("p"."provider_id")))));


--
-- Name: hall_addons hall_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "hall_addons_read" ON "public"."hall_addons" FOR SELECT USING (true);


--
-- Name: hall_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."hall_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: hall_gallery hall_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "hall_gallery_owner" ON "public"."hall_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."banquet_halls" "p"
  WHERE (("p"."id" = "hall_gallery"."package_id") AND "public"."owns_banquet_hall"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."banquet_halls" "p"
  WHERE (("p"."id" = "hall_gallery"."package_id") AND "public"."owns_banquet_hall"("p"."provider_id")))));


--
-- Name: hall_gallery hall_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "hall_gallery_read" ON "public"."hall_gallery" FOR SELECT USING (true);


--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;

--
-- Name: login_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."login_attempts" ENABLE ROW LEVEL SECURITY;

--
-- Name: makeup_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."makeup_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: makeup_addons makeup_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "makeup_addons_owner" ON "public"."makeup_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."makeup_packages" "p"
  WHERE (("p"."id" = "makeup_addons"."package_id") AND "public"."owns_makeup_artist"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."makeup_packages" "p"
  WHERE (("p"."id" = "makeup_addons"."package_id") AND "public"."owns_makeup_artist"("p"."provider_id")))));


--
-- Name: makeup_addons makeup_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "makeup_addons_read" ON "public"."makeup_addons" FOR SELECT USING (true);


--
-- Name: makeup_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."makeup_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: makeup_bookings makeup_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "makeup_bookings_customer_insert" ON "public"."makeup_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "makeup_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: makeup_bookings makeup_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "makeup_bookings_customer_update" ON "public"."makeup_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: makeup_bookings makeup_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "makeup_bookings_provider_update" ON "public"."makeup_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_makeup_artist"("provider_id")) WITH CHECK ("public"."owns_makeup_artist"("provider_id"));


--
-- Name: makeup_bookings makeup_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "makeup_bookings_read" ON "public"."makeup_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_makeup_artist"("provider_id")));


--
-- Name: makeup_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."makeup_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: makeup_gallery makeup_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "makeup_gallery_owner" ON "public"."makeup_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."makeup_packages" "p"
  WHERE (("p"."id" = "makeup_gallery"."package_id") AND "public"."owns_makeup_artist"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."makeup_packages" "p"
  WHERE (("p"."id" = "makeup_gallery"."package_id") AND "public"."owns_makeup_artist"("p"."provider_id")))));


--
-- Name: makeup_gallery makeup_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "makeup_gallery_read" ON "public"."makeup_gallery" FOR SELECT USING (true);


--
-- Name: makeup_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."makeup_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: makeup_packages makeup_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "makeup_packages_owner" ON "public"."makeup_packages" USING ("public"."owns_makeup_artist"("provider_id")) WITH CHECK ("public"."owns_makeup_artist"("provider_id"));


--
-- Name: makeup_packages makeup_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "makeup_packages_read" ON "public"."makeup_packages" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_makeup_artist"("provider_id")));


--
-- Name: mehendi_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."mehendi_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: mehendi_addons mehendi_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mehendi_addons_owner" ON "public"."mehendi_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."mehendi_packages" "p"
  WHERE (("p"."id" = "mehendi_addons"."package_id") AND "public"."owns_mehendi_artist"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."mehendi_packages" "p"
  WHERE (("p"."id" = "mehendi_addons"."package_id") AND "public"."owns_mehendi_artist"("p"."provider_id")))));


--
-- Name: mehendi_addons mehendi_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mehendi_addons_read" ON "public"."mehendi_addons" FOR SELECT USING (true);


--
-- Name: mehendi_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."mehendi_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: mehendi_bookings mehendi_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mehendi_bookings_customer_insert" ON "public"."mehendi_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "mehendi_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: mehendi_bookings mehendi_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mehendi_bookings_customer_update" ON "public"."mehendi_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: mehendi_bookings mehendi_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mehendi_bookings_provider_update" ON "public"."mehendi_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_mehendi_artist"("provider_id")) WITH CHECK ("public"."owns_mehendi_artist"("provider_id"));


--
-- Name: mehendi_bookings mehendi_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mehendi_bookings_read" ON "public"."mehendi_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_mehendi_artist"("provider_id")));


--
-- Name: mehendi_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."mehendi_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: mehendi_gallery mehendi_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mehendi_gallery_owner" ON "public"."mehendi_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."mehendi_packages" "p"
  WHERE (("p"."id" = "mehendi_gallery"."package_id") AND "public"."owns_mehendi_artist"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."mehendi_packages" "p"
  WHERE (("p"."id" = "mehendi_gallery"."package_id") AND "public"."owns_mehendi_artist"("p"."provider_id")))));


--
-- Name: mehendi_gallery mehendi_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mehendi_gallery_read" ON "public"."mehendi_gallery" FOR SELECT USING (true);


--
-- Name: mehendi_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."mehendi_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: mehendi_packages mehendi_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mehendi_packages_owner" ON "public"."mehendi_packages" USING ("public"."owns_mehendi_artist"("provider_id")) WITH CHECK ("public"."owns_mehendi_artist"("provider_id"));


--
-- Name: mehendi_packages mehendi_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mehendi_packages_read" ON "public"."mehendi_packages" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_mehendi_artist"("provider_id")));


--
-- Name: menu_items menu_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "menu_owner_write" ON "public"."menu_items" USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: menu_items menu_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "menu_public_read" ON "public"."menu_items" FOR SELECT USING (true);


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notif_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notif_insert" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: notifications notif_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notif_select" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: notifications notif_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notif_update" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));


--
-- Name: notification_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_delete" ON "public"."notifications" FOR DELETE USING (("user_id" = "auth"."uid"()));


--
-- Name: otp_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."otp_rate_limits" ENABLE ROW LEVEL SECURITY;

--
-- Name: otp_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."otp_verifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_packages packages_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "packages_owner_write" ON "public"."pricing_packages" USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: pricing_packages packages_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "packages_public_read" ON "public"."pricing_packages" FOR SELECT USING (true);


--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;

--
-- Name: photographer_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photographer_availability" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_package_addons photography_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_addons_owner" ON "public"."photography_package_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."photography_packages" "p"
  WHERE (("p"."id" = "photography_package_addons"."package_id") AND "public"."owns_photographer"("p"."photographer_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."photography_packages" "p"
  WHERE (("p"."id" = "photography_package_addons"."package_id") AND "public"."owns_photographer"("p"."photographer_id")))));


--
-- Name: photography_package_addons photography_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_addons_read" ON "public"."photography_package_addons" FOR SELECT USING (true);


--
-- Name: photography_albums; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_albums" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_albums photography_albums_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_albums_owner" ON "public"."photography_albums" USING ((EXISTS ( SELECT 1
   FROM "public"."photography_packages" "p"
  WHERE (("p"."id" = "photography_albums"."package_id") AND "public"."owns_photographer"("p"."photographer_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."photography_packages" "p"
  WHERE (("p"."id" = "photography_albums"."package_id") AND "public"."owns_photographer"("p"."photographer_id")))));


--
-- Name: photography_albums photography_albums_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_albums_read" ON "public"."photography_albums" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."photography_packages" "p"
  WHERE (("p"."id" = "photography_albums"."package_id") AND (("p"."is_active" AND "p"."is_visible" AND ("p"."status" = 'published'::"text")) OR "public"."owns_photographer"("p"."photographer_id"))))));


--
-- Name: photographer_availability photography_availability_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_availability_owner" ON "public"."photographer_availability" USING ("public"."owns_photographer"("photographer_id")) WITH CHECK ("public"."owns_photographer"("photographer_id"));


--
-- Name: photographer_availability photography_availability_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_availability_read" ON "public"."photographer_availability" FOR SELECT USING (true);


--
-- Name: photography_booking_timeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_booking_timeline" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_package_bookings photography_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_bookings_customer_insert" ON "public"."photography_package_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "photography_package_bookings"."photographer_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: photography_package_bookings photography_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_bookings_customer_update" ON "public"."photography_package_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: photography_package_bookings photography_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_bookings_provider_update" ON "public"."photography_package_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_photographer"("photographer_id")) WITH CHECK ("public"."owns_photographer"("photographer_id"));


--
-- Name: photography_package_bookings photography_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_bookings_read" ON "public"."photography_package_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_photographer"("photographer_id")));


--
-- Name: photography_cart_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_cart_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_cart_items photography_cart_items_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_cart_items_customer" ON "public"."photography_cart_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."photography_carts" "c"
  WHERE (("c"."id" = "photography_cart_items"."cart_id") AND ("c"."customer_id" = "auth"."uid"())))));


--
-- Name: photography_cart_items photography_cart_items_provider; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_cart_items_provider" ON "public"."photography_cart_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."photography_carts" "c"
  WHERE (("c"."id" = "photography_cart_items"."cart_id") AND "public"."owns_photographer"("c"."photographer_id")))));


--
-- Name: photography_carts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_carts" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_carts photography_carts_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_carts_customer" ON "public"."photography_carts" FOR SELECT USING (("customer_id" = "auth"."uid"()));


--
-- Name: photography_carts photography_carts_provider; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_carts_provider" ON "public"."photography_carts" FOR SELECT USING ("public"."owns_photographer"("photographer_id"));


--
-- Name: photography_package_highlights photography_highlights_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_highlights_owner" ON "public"."photography_package_highlights" USING ((EXISTS ( SELECT 1
   FROM "public"."photography_packages" "p"
  WHERE (("p"."id" = "photography_package_highlights"."package_id") AND "public"."owns_photographer"("p"."photographer_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."photography_packages" "p"
  WHERE (("p"."id" = "photography_package_highlights"."package_id") AND "public"."owns_photographer"("p"."photographer_id")))));


--
-- Name: photography_package_highlights photography_highlights_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_highlights_read" ON "public"."photography_package_highlights" FOR SELECT USING (true);


--
-- Name: photography_package_images photography_images_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_images_owner" ON "public"."photography_package_images" USING ((EXISTS ( SELECT 1
   FROM "public"."photography_packages" "p"
  WHERE (("p"."id" = "photography_package_images"."package_id") AND "public"."owns_photographer"("p"."photographer_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."photography_packages" "p"
  WHERE (("p"."id" = "photography_package_images"."package_id") AND "public"."owns_photographer"("p"."photographer_id")))));


--
-- Name: photography_package_images photography_images_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_images_read" ON "public"."photography_package_images" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."photography_packages" "p"
  WHERE (("p"."id" = "photography_package_images"."package_id") AND (("p"."is_active" AND "p"."is_visible") OR "public"."owns_photographer"("p"."photographer_id"))))));


--
-- Name: photography_package_invoices photography_invoices_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_invoices_read" ON "public"."photography_package_invoices" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."photography_package_bookings" "b"
  WHERE (("b"."id" = "photography_package_invoices"."booking_id") AND (("b"."customer_id" = "auth"."uid"()) OR "public"."owns_photographer"("b"."photographer_id"))))));


--
-- Name: photography_package_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_package_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_package_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_package_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_package_highlights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_package_highlights" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_package_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_package_images" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_package_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_package_invoices" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_package_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_package_payments" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_package_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_package_reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_packages photography_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_packages_owner" ON "public"."photography_packages" USING ("public"."owns_photographer"("photographer_id")) WITH CHECK ("public"."owns_photographer"("photographer_id"));


--
-- Name: photography_packages photography_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_packages_read" ON "public"."photography_packages" FOR SELECT USING ((("is_active" AND "is_visible") OR "public"."owns_photographer"("photographer_id")));


--
-- Name: photography_package_payments photography_payments_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_payments_read" ON "public"."photography_package_payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."photography_package_bookings" "b"
  WHERE (("b"."id" = "photography_package_payments"."booking_id") AND (("b"."customer_id" = "auth"."uid"()) OR "public"."owns_photographer"("b"."photographer_id"))))));


--
-- Name: photography_package_reviews photography_reviews_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_reviews_create" ON "public"."photography_package_reviews" FOR INSERT WITH CHECK ((("customer_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."photography_package_bookings" "b"
  WHERE (("b"."id" = "photography_package_reviews"."booking_id") AND ("b"."customer_id" = "auth"."uid"()) AND ("b"."status" = 'completed'::"text"))))));


--
-- Name: photography_package_reviews photography_reviews_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_reviews_read" ON "public"."photography_package_reviews" FOR SELECT USING (true);


--
-- Name: photography_booking_timeline photography_timeline_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_timeline_read" ON "public"."photography_booking_timeline" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."photography_package_bookings" "b"
  WHERE (("b"."id" = "photography_booking_timeline"."booking_id") AND (("b"."customer_id" = "auth"."uid"()) OR "public"."owns_photographer"("b"."photographer_id"))))));


--
-- Name: photography_videography_package_addons photography_videography_addons_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_addons_customer" ON "public"."photography_videography_package_addons" FOR SELECT USING (("package_id" IN ( SELECT "photography_videography_packages"."id"
   FROM "public"."photography_videography_packages"
  WHERE (("photography_videography_packages"."is_active" = true) AND ("photography_videography_packages"."is_visible" = true) AND ("photography_videography_packages"."status" = 'active'::"text")))));


--
-- Name: POLICY "photography_videography_addons_customer" ON "photography_videography_package_addons"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "photography_videography_addons_customer" ON "public"."photography_videography_package_addons" IS 'Customers can only view add-ons for active, visible packages';


--
-- Name: photography_videography_package_addons photography_videography_addons_vendor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_addons_vendor" ON "public"."photography_videography_package_addons" USING (("package_id" IN ( SELECT "photography_videography_packages"."id"
   FROM "public"."photography_videography_packages"
  WHERE ("photography_videography_packages"."provider_id" IN ( SELECT "provider_profiles"."id"
           FROM "public"."provider_profiles"
          WHERE ("provider_profiles"."user_id" = "auth"."uid"())))))) WITH CHECK (("package_id" IN ( SELECT "photography_videography_packages"."id"
   FROM "public"."photography_videography_packages"
  WHERE ("photography_videography_packages"."provider_id" IN ( SELECT "provider_profiles"."id"
           FROM "public"."provider_profiles"
          WHERE ("provider_profiles"."user_id" = "auth"."uid"()))))));


--
-- Name: photography_videography_package_bookings photography_videography_bookings_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_bookings_customer" ON "public"."photography_videography_package_bookings" FOR SELECT USING (("customer_id" = "auth"."uid"()));


--
-- Name: photography_videography_package_bookings photography_videography_bookings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_bookings_insert" ON "public"."photography_videography_package_bookings" FOR INSERT WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: photography_videography_package_bookings photography_videography_bookings_vendor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_bookings_vendor" ON "public"."photography_videography_package_bookings" FOR SELECT USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: photography_videography_packages photography_videography_customer_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_customer_select" ON "public"."photography_videography_packages" FOR SELECT USING ((("is_active" = true) AND ("is_visible" = true) AND ("status" = 'active'::"text")));


--
-- Name: POLICY "photography_videography_customer_select" ON "photography_videography_packages"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "photography_videography_customer_select" ON "public"."photography_videography_packages" IS 'Customers can only view active, visible packages (not draft/paused/archived)';


--
-- Name: photography_videography_package_images photography_videography_images_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_images_customer" ON "public"."photography_videography_package_images" FOR SELECT USING (("package_id" IN ( SELECT "photography_videography_packages"."id"
   FROM "public"."photography_videography_packages"
  WHERE (("photography_videography_packages"."is_active" = true) AND ("photography_videography_packages"."is_visible" = true) AND ("photography_videography_packages"."status" = 'active'::"text")))));


--
-- Name: POLICY "photography_videography_images_customer" ON "photography_videography_package_images"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "photography_videography_images_customer" ON "public"."photography_videography_package_images" IS 'Customers can only view images for active, visible packages';


--
-- Name: photography_videography_package_images photography_videography_images_vendor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_images_vendor" ON "public"."photography_videography_package_images" USING (("package_id" IN ( SELECT "photography_videography_packages"."id"
   FROM "public"."photography_videography_packages"
  WHERE ("photography_videography_packages"."provider_id" IN ( SELECT "provider_profiles"."id"
           FROM "public"."provider_profiles"
          WHERE ("provider_profiles"."user_id" = "auth"."uid"())))))) WITH CHECK (("package_id" IN ( SELECT "photography_videography_packages"."id"
   FROM "public"."photography_videography_packages"
  WHERE ("photography_videography_packages"."provider_id" IN ( SELECT "provider_profiles"."id"
           FROM "public"."provider_profiles"
          WHERE ("provider_profiles"."user_id" = "auth"."uid"()))))));


--
-- Name: photography_videography_package_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_videography_package_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_videography_package_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_videography_package_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_videography_package_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_videography_package_images" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_videography_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."photography_videography_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: photography_videography_packages photography_videography_vendor_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_vendor_delete" ON "public"."photography_videography_packages" FOR DELETE USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: photography_videography_packages photography_videography_vendor_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_vendor_insert" ON "public"."photography_videography_packages" FOR INSERT WITH CHECK (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: photography_videography_packages photography_videography_vendor_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_vendor_select" ON "public"."photography_videography_packages" FOR SELECT USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: photography_videography_packages photography_videography_vendor_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "photography_videography_vendor_update" ON "public"."photography_videography_packages" FOR UPDATE USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: planner_recommendation_candidates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."planner_recommendation_candidates" ENABLE ROW LEVEL SECURITY;

--
-- Name: planner_recommendation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."planner_recommendation_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."platform_analytics" ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: pooja_services pooja_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pooja_owner_write" ON "public"."pooja_services" USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: pooja_services pooja_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pooja_public_read" ON "public"."pooja_services" FOR SELECT USING (true);


--
-- Name: portfolio_items portfolio_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_delete" ON "public"."portfolio_items" FOR DELETE USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: portfolio_items portfolio_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_insert" ON "public"."portfolio_items" FOR INSERT TO "authenticated" WITH CHECK (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: portfolio_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."portfolio_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: portfolio_items portfolio_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_select" ON "public"."portfolio_items" FOR SELECT USING ((("is_published" = true) OR ("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"())))));


--
-- Name: portfolio_items portfolio_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_update" ON "public"."portfolio_items" FOR UPDATE USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: priest_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."priest_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: priest_addons priest_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "priest_addons_owner" ON "public"."priest_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."priest_packages" "p"
  WHERE (("p"."id" = "priest_addons"."package_id") AND "public"."owns_priest"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."priest_packages" "p"
  WHERE (("p"."id" = "priest_addons"."package_id") AND "public"."owns_priest"("p"."provider_id")))));


--
-- Name: priest_addons priest_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "priest_addons_read" ON "public"."priest_addons" FOR SELECT USING (true);


--
-- Name: priest_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."priest_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: priest_bookings priest_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "priest_bookings_customer_insert" ON "public"."priest_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "priest_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: priest_bookings priest_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "priest_bookings_customer_update" ON "public"."priest_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: priest_bookings priest_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "priest_bookings_provider_update" ON "public"."priest_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_priest"("provider_id")) WITH CHECK ("public"."owns_priest"("provider_id"));


--
-- Name: priest_bookings priest_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "priest_bookings_read" ON "public"."priest_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_priest"("provider_id")));


--
-- Name: priest_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."priest_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: priest_gallery priest_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "priest_gallery_owner" ON "public"."priest_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."priest_packages" "p"
  WHERE (("p"."id" = "priest_gallery"."package_id") AND "public"."owns_priest"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."priest_packages" "p"
  WHERE (("p"."id" = "priest_gallery"."package_id") AND "public"."owns_priest"("p"."provider_id")))));


--
-- Name: priest_gallery priest_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "priest_gallery_read" ON "public"."priest_gallery" FOR SELECT USING (true);


--
-- Name: priest_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."priest_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: priest_packages priest_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "priest_packages_owner" ON "public"."priest_packages" USING ("public"."owns_priest"("provider_id")) WITH CHECK ("public"."owns_priest"("provider_id"));


--
-- Name: priest_packages priest_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "priest_packages_read" ON "public"."priest_packages" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_priest"("provider_id")));


--
-- Name: product_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."product_order_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_order_items product_order_items_participant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "product_order_items_participant_read" ON "public"."product_order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."product_orders" "o"
  WHERE (("o"."id" = "product_order_items"."order_id") AND (("o"."customer_id" = "auth"."uid"()) OR "public"."owns_water_supplier"("o"."provider_id"))))));


--
-- Name: product_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."product_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_orders product_orders_participant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "product_orders_participant_read" ON "public"."product_orders" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_water_supplier"("provider_id")));


--
-- Name: water_product_reviews product_reviews_customer_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "product_reviews_customer_create" ON "public"."water_product_reviews" FOR INSERT WITH CHECK ((("customer_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."product_order_items" "i"
     JOIN "public"."product_orders" "o" ON (("o"."id" = "i"."order_id")))
  WHERE (("i"."id" = "water_product_reviews"."order_item_id") AND ("o"."customer_id" = "auth"."uid"()) AND ("o"."status" = 'delivered'::"text"))))));


--
-- Name: water_product_reviews product_reviews_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "product_reviews_read" ON "public"."water_product_reviews" FOR SELECT USING (true);


--
-- Name: provider_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."provider_availability" ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_calendar; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."provider_calendar" ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_time_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."provider_time_slots" ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_profiles providers_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "providers_admin_write" ON "public"."provider_profiles" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: provider_profiles providers_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "providers_owner_write" ON "public"."provider_profiles" USING (("user_id" = "auth"."uid"()));


--
-- Name: provider_profiles providers_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "providers_public_read" ON "public"."provider_profiles" FOR SELECT USING ((("verification_status" = ANY (ARRAY['approved'::"text", 'verified'::"text"])) OR ("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."refresh_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: rental_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rental_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: rental_addons rental_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rental_addons_owner" ON "public"."rental_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."rental_packages" "p"
  WHERE (("p"."id" = "rental_addons"."package_id") AND "public"."owns_rental_service"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rental_packages" "p"
  WHERE (("p"."id" = "rental_addons"."package_id") AND "public"."owns_rental_service"("p"."provider_id")))));


--
-- Name: rental_addons rental_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rental_addons_read" ON "public"."rental_addons" FOR SELECT USING (true);


--
-- Name: rental_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rental_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: rental_bookings rental_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rental_bookings_customer_insert" ON "public"."rental_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "rental_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: rental_bookings rental_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rental_bookings_customer_update" ON "public"."rental_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: rental_bookings rental_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rental_bookings_provider_update" ON "public"."rental_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_rental_service"("provider_id")) WITH CHECK ("public"."owns_rental_service"("provider_id"));


--
-- Name: rental_bookings rental_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rental_bookings_read" ON "public"."rental_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_rental_service"("provider_id")));


--
-- Name: rental_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rental_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: rental_gallery rental_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rental_gallery_owner" ON "public"."rental_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."rental_packages" "p"
  WHERE (("p"."id" = "rental_gallery"."package_id") AND "public"."owns_rental_service"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rental_packages" "p"
  WHERE (("p"."id" = "rental_gallery"."package_id") AND "public"."owns_rental_service"("p"."provider_id")))));


--
-- Name: rental_gallery rental_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rental_gallery_read" ON "public"."rental_gallery" FOR SELECT USING (true);


--
-- Name: rental_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rental_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: rental_packages rental_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rental_packages_owner" ON "public"."rental_packages" USING ("public"."owns_rental_service"("provider_id")) WITH CHECK ("public"."owns_rental_service"("provider_id"));


--
-- Name: rental_packages rental_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rental_packages_read" ON "public"."rental_packages" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_rental_service"("provider_id")));


--
-- Name: rental_items rentals_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rentals_owner_write" ON "public"."rental_items" USING (("provider_id" IN ( SELECT "provider_profiles"."id"
   FROM "public"."provider_profiles"
  WHERE ("provider_profiles"."user_id" = "auth"."uid"()))));


--
-- Name: rental_items rentals_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rentals_public_read" ON "public"."rental_items" FOR SELECT USING (true);


--
-- Name: reschedule_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."reschedule_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: search_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."search_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."security_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events security_events_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "security_events_admin_read" ON "public"."security_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));


--
-- Name: security_events security_events_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "security_events_anon_insert" ON "public"."security_events" FOR INSERT TO "anon" WITH CHECK ((("user_id" IS NULL) AND ("is_authenticated" = false)));


--
-- Name: security_events security_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "security_events_insert" ON "public"."security_events" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));


--
-- Name: singer_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."singer_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: singer_addons singer_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "singer_addons_owner" ON "public"."singer_addons" USING ((EXISTS ( SELECT 1
   FROM ("public"."singer_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "singer_addons"."package_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."singer_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "singer_addons"."package_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: singer_addons singer_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "singer_addons_read" ON "public"."singer_addons" FOR SELECT USING (true);


--
-- Name: singer_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."singer_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: singer_bookings singer_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "singer_bookings_customer_insert" ON "public"."singer_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "singer_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: singer_bookings singer_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "singer_bookings_customer_update" ON "public"."singer_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: singer_bookings singer_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "singer_bookings_provider_update" ON "public"."singer_bookings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "singer_bookings"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "singer_bookings"."provider_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: singer_bookings singer_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "singer_bookings_read" ON "public"."singer_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "singer_bookings"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))));


--
-- Name: singer_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."singer_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: singer_gallery singer_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "singer_gallery_owner" ON "public"."singer_gallery" USING ((EXISTS ( SELECT 1
   FROM ("public"."singer_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "singer_gallery"."package_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."singer_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "singer_gallery"."package_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: singer_gallery singer_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "singer_gallery_read" ON "public"."singer_gallery" FOR SELECT USING (true);


--
-- Name: singer_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."singer_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: singer_packages singer_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "singer_packages_owner" ON "public"."singer_packages" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "singer_packages"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "singer_packages"."provider_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: singer_packages singer_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "singer_packages_read" ON "public"."singer_packages" FOR SELECT USING ((("status" = 'active'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "singer_packages"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))));


--
-- Name: subcategories subcategories_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "subcategories_admin_write" ON "public"."subcategories" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));


--
-- Name: subcategories subcategories_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "subcategories_public_read" ON "public"."subcategories" FOR SELECT USING (true);


--
-- Name: supplier_delivery_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."supplier_delivery_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_delete_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_roles_delete_auth" ON "public"."user_roles" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: user_roles user_roles_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_roles_insert_auth" ON "public"."user_roles" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: user_roles user_roles_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_roles_read_all" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);


--
-- Name: user_roles user_roles_read_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_roles_read_auth" ON "public"."user_roles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: user_roles user_roles_write_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_roles_write_self" ON "public"."user_roles" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: vendor_cancellations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."vendor_cancellations" ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_embeddings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."vendor_embeddings" ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_cancellations vendor_insert_cancellation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vendor_insert_cancellation" ON "public"."vendor_cancellations" FOR INSERT WITH CHECK (("vendor_user_id" = "auth"."uid"()));


--
-- Name: booking_cancellations vendor_select_cancellations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vendor_select_cancellations" ON "public"."booking_cancellations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE ((("pp"."id")::"text" = "booking_cancellations"."provider_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: vendor_cancellations vendor_select_own_cancellations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vendor_select_own_cancellations" ON "public"."vendor_cancellations" FOR SELECT USING (("vendor_user_id" = "auth"."uid"()));


--
-- Name: reschedule_requests vendor_select_own_reschedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vendor_select_own_reschedules" ON "public"."reschedule_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE ((("pp"."id")::"text" = "reschedule_requests"."provider_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: vendor_settlements vendor_select_own_settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vendor_select_own_settlements" ON "public"."vendor_settlements" FOR SELECT USING (("vendor_user_id" = "auth"."uid"()));


--
-- Name: vendor_settlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."vendor_settlements" ENABLE ROW LEVEL SECURITY;

--
-- Name: reschedule_requests vendor_update_reschedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vendor_update_reschedule" ON "public"."reschedule_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE ((("pp"."id")::"text" = "reschedule_requests"."provider_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: videography_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."videography_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: videography_addons videography_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "videography_addons_owner" ON "public"."videography_addons" USING ((EXISTS ( SELECT 1
   FROM "public"."videography_packages" "p"
  WHERE (("p"."id" = "videography_addons"."package_id") AND "public"."owns_videographer"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."videography_packages" "p"
  WHERE (("p"."id" = "videography_addons"."package_id") AND "public"."owns_videographer"("p"."provider_id")))));


--
-- Name: videography_addons videography_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "videography_addons_read" ON "public"."videography_addons" FOR SELECT USING (true);


--
-- Name: videography_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."videography_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: videography_bookings videography_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "videography_bookings_customer_insert" ON "public"."videography_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "videography_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: videography_bookings videography_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "videography_bookings_customer_update" ON "public"."videography_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: videography_bookings videography_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "videography_bookings_provider_update" ON "public"."videography_bookings" FOR UPDATE TO "authenticated" USING ("public"."owns_videographer"("provider_id")) WITH CHECK ("public"."owns_videographer"("provider_id"));


--
-- Name: videography_bookings videography_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "videography_bookings_read" ON "public"."videography_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR "public"."owns_videographer"("provider_id")));


--
-- Name: videography_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."videography_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: videography_gallery videography_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "videography_gallery_owner" ON "public"."videography_gallery" USING ((EXISTS ( SELECT 1
   FROM "public"."videography_packages" "p"
  WHERE (("p"."id" = "videography_gallery"."package_id") AND "public"."owns_videographer"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."videography_packages" "p"
  WHERE (("p"."id" = "videography_gallery"."package_id") AND "public"."owns_videographer"("p"."provider_id")))));


--
-- Name: videography_gallery videography_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "videography_gallery_read" ON "public"."videography_gallery" FOR SELECT USING (true);


--
-- Name: videography_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."videography_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: videography_packages videography_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "videography_packages_owner" ON "public"."videography_packages" USING ("public"."owns_videographer"("provider_id")) WITH CHECK ("public"."owns_videographer"("provider_id"));


--
-- Name: videography_packages videography_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "videography_packages_read" ON "public"."videography_packages" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."owns_videographer"("provider_id")));


--
-- Name: water_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."water_addons" ENABLE ROW LEVEL SECURITY;

--
-- Name: water_addons water_addons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_addons_owner" ON "public"."water_addons" USING ((EXISTS ( SELECT 1
   FROM ("public"."water_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "water_addons"."package_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."water_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "water_addons"."package_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: water_addons water_addons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_addons_read" ON "public"."water_addons" FOR SELECT USING (true);


--
-- Name: water_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."water_bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: water_bookings water_bookings_customer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_bookings_customer_insert" ON "public"."water_bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."provider_profiles"
  WHERE (("provider_profiles"."id" = "water_bookings"."provider_id") AND ("provider_profiles"."user_id" = "auth"."uid"())))))));


--
-- Name: water_bookings water_bookings_customer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_bookings_customer_update" ON "public"."water_bookings" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));


--
-- Name: water_bookings water_bookings_provider_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_bookings_provider_update" ON "public"."water_bookings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "water_bookings"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "water_bookings"."provider_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: water_bookings water_bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_bookings_read" ON "public"."water_bookings" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "water_bookings"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))));


--
-- Name: water_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."water_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: water_categories water_categories_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_categories_read" ON "public"."water_categories" FOR SELECT USING (("is_active" OR ("auth"."uid"() IS NOT NULL)));


--
-- Name: water_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."water_gallery" ENABLE ROW LEVEL SECURITY;

--
-- Name: water_gallery water_gallery_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_gallery_owner" ON "public"."water_gallery" USING ((EXISTS ( SELECT 1
   FROM ("public"."water_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "water_gallery"."package_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."water_packages" "p"
     JOIN "public"."provider_profiles" "pp" ON (("pp"."id" = "p"."provider_id")))
  WHERE (("p"."id" = "water_gallery"."package_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: water_gallery water_gallery_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_gallery_read" ON "public"."water_gallery" FOR SELECT USING (true);


--
-- Name: water_product_images water_images_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_images_owner_write" ON "public"."water_product_images" USING ((EXISTS ( SELECT 1
   FROM "public"."water_products" "p"
  WHERE (("p"."id" = "water_product_images"."product_id") AND "public"."owns_water_supplier"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."water_products" "p"
  WHERE (("p"."id" = "water_product_images"."product_id") AND "public"."owns_water_supplier"("p"."provider_id")))));


--
-- Name: water_product_images water_images_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_images_read" ON "public"."water_product_images" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."water_products" "p"
  WHERE (("p"."id" = "water_product_images"."product_id") AND (("p"."is_active" AND "p"."is_visible" AND (NOT "p"."is_archived")) OR "public"."owns_water_supplier"("p"."provider_id"))))));


--
-- Name: water_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."water_packages" ENABLE ROW LEVEL SECURITY;

--
-- Name: water_packages water_packages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_packages_owner" ON "public"."water_packages" USING ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "water_packages"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "water_packages"."provider_id") AND ("pp"."user_id" = "auth"."uid"())))));


--
-- Name: water_packages water_packages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_packages_read" ON "public"."water_packages" FOR SELECT USING ((("status" = 'active'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."provider_profiles" "pp"
  WHERE (("pp"."id" = "water_packages"."provider_id") AND ("pp"."user_id" = "auth"."uid"()))))));


--
-- Name: water_product_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."water_product_images" ENABLE ROW LEVEL SECURITY;

--
-- Name: water_product_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."water_product_reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: water_product_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."water_product_stock" ENABLE ROW LEVEL SECURITY;

--
-- Name: water_product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."water_product_variants" ENABLE ROW LEVEL SECURITY;

--
-- Name: water_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."water_products" ENABLE ROW LEVEL SECURITY;

--
-- Name: water_products water_products_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_products_owner_write" ON "public"."water_products" USING ("public"."owns_water_supplier"("provider_id")) WITH CHECK ("public"."owns_water_supplier"("provider_id"));


--
-- Name: water_products water_products_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_products_read" ON "public"."water_products" FOR SELECT USING ((("is_active" AND "is_visible" AND (NOT "is_archived")) OR "public"."owns_water_supplier"("provider_id")));


--
-- Name: water_product_stock water_stock_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_stock_owner_read" ON "public"."water_product_stock" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."water_product_variants" "v"
     JOIN "public"."water_products" "p" ON (("p"."id" = "v"."product_id")))
  WHERE (("v"."id" = "water_product_stock"."variant_id") AND "public"."owns_water_supplier"("p"."provider_id")))));


--
-- Name: water_product_stock water_stock_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_stock_owner_write" ON "public"."water_product_stock" USING ((EXISTS ( SELECT 1
   FROM ("public"."water_product_variants" "v"
     JOIN "public"."water_products" "p" ON (("p"."id" = "v"."product_id")))
  WHERE (("v"."id" = "water_product_stock"."variant_id") AND "public"."owns_water_supplier"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."water_product_variants" "v"
     JOIN "public"."water_products" "p" ON ((("p"."id" = "v"."product_id") AND "public"."owns_water_supplier"("p"."provider_id")))))));


--
-- Name: water_product_variants water_variants_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_variants_owner_write" ON "public"."water_product_variants" USING ((EXISTS ( SELECT 1
   FROM "public"."water_products" "p"
  WHERE (("p"."id" = "water_product_variants"."product_id") AND "public"."owns_water_supplier"("p"."provider_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."water_products" "p"
  WHERE (("p"."id" = "water_product_variants"."product_id") AND "public"."owns_water_supplier"("p"."provider_id")))));


--
-- Name: water_product_variants water_variants_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "water_variants_read" ON "public"."water_product_variants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."water_products" "p"
  WHERE (("p"."id" = "water_product_variants"."product_id") AND (("p"."is_active" AND "p"."is_visible" AND (NOT "p"."is_archived")) OR "public"."owns_water_supplier"("p"."provider_id"))))));


--
-- Name: worker_bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."worker_bank_accounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."worker_documents" ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."worker_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Admins can read business documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read business documents" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'business-documents'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can read contracts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read contracts" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'contracts'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can read documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read documents" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'documents'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can read payment proofs; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read payment proofs" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'payment-proofs'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can read verification; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read verification" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'verification'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can read verification documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read verification documents" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'verification-documents'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can upload contracts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can upload contracts" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'contracts'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can view all worker documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can view all worker documents" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'worker-documents'::"text") AND "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));


--
-- Name: objects Admins delete auth promotional images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins delete auth promotional images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'auth-promotional'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));


--
-- Name: objects Admins insert auth promotional images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins insert auth promotional images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'auth-promotional'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));


--
-- Name: objects Admins update auth promotional images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins update auth promotional images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'auth-promotional'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))))) WITH CHECK ((("bucket_id" = 'auth-promotional'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));


--
-- Name: objects Anyone can view provider media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Anyone can view provider media" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'provider-media'::"text"));


--
-- Name: objects Artists can delete their own gallery items; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can delete their own gallery items" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'gallery'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can delete their own portfolio images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can delete their own portfolio images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'portfolio-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can delete their own profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can delete their own profile images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'artist-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can delete their own videos; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can delete their own videos" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'videos'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can update their own gallery items; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can update their own gallery items" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'gallery'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can update their own portfolio images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can update their own portfolio images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'portfolio-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can update their own profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can update their own profile images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'artist-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can update their own videos; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can update their own videos" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'videos'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated artists can upload portfolio images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated artists can upload portfolio images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'portfolio-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated artists can upload profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated artists can upload profile images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'artist-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated artists can upload to gallery; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated artists can upload to gallery" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'gallery'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated artists can upload videos; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated artists can upload videos" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'videos'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated customers can upload profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated customers can upload profile images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'customer-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated users can delete provider media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can delete provider media" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'provider-media'::"text") AND ("auth"."role"() = 'authenticated'::"text")));


--
-- Name: objects Authenticated users can upload cover banners; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload cover banners" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'cover-banners'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated users can upload event images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload event images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'event-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated users can upload portfolio items; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload portfolio items" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'portfolio'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated users can upload profile pictures; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload profile pictures" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'profile-pictures'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated users can upload provider media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload provider media" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'provider-media'::"text") AND ("auth"."role"() = 'authenticated'::"text")));


--
-- Name: objects Authenticated users can upload thumbnails; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload thumbnails" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'thumbnails'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Chat participants can upload files; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Chat participants can upload files" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'chat-files'::"text") AND ((("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]) OR (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2]))));


--
-- Name: objects Customers can delete their own profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Customers can delete their own profile images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'customer-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Customers can update their own profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Customers can update their own profile images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'customer-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Participants can read chat files; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Participants can read chat files" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'chat-files'::"text") AND ((("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]) OR (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2]))));


--
-- Name: objects Public read access for artist profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for artist profile images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'artist-profile-images'::"text"));


--
-- Name: objects Public read access for cover banners; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for cover banners" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'cover-banners'::"text"));


--
-- Name: objects Public read access for customer profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for customer profile images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'customer-profile-images'::"text"));


--
-- Name: objects Public read access for event images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for event images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'event-images'::"text"));


--
-- Name: objects Public read access for gallery; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for gallery" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'gallery'::"text"));


--
-- Name: objects Public read access for portfolio; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for portfolio" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'portfolio'::"text"));


--
-- Name: objects Public read access for portfolio images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for portfolio images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'portfolio-images'::"text"));


--
-- Name: objects Public read access for profile pictures; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for profile pictures" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'profile-pictures'::"text"));


--
-- Name: objects Public read access for thumbnails; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for thumbnails" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'thumbnails'::"text"));


--
-- Name: objects Public read access for videos; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for videos" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'videos'::"text"));


--
-- Name: objects Public read auth promotional images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read auth promotional images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'auth-promotional'::"text"));


--
-- Name: objects Users can delete own provider media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete own provider media" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'provider-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can delete their own business documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete their own business documents" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'business-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can delete their own event images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete their own event images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'event-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can delete their own thumbnails; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete their own thumbnails" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'thumbnails'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can delete their own verification documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete their own verification documents" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'verification-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can read their own contracts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can read their own contracts" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'contracts'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can read their own payment proofs; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can read their own payment proofs" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'payment-proofs'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update own provider media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update own provider media" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'provider-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own business documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own business documents" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'business-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own cover banners; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own cover banners" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'cover-banners'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own documents" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own event images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own event images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'event-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own portfolio items; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own portfolio items" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'portfolio'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own profile pictures; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own profile pictures" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'profile-pictures'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own thumbnails; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own thumbnails" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'thumbnails'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own verification; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own verification" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'verification'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own verification documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own verification documents" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'verification-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can upload their own business documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own business documents" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'business-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can upload their own documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own documents" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can upload their own payment proofs; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own payment proofs" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'payment-proofs'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can upload their own verification; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own verification" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'verification'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can upload their own verification documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own verification documents" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'verification-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Workers can upload own documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Workers can upload own documents" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'worker-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Workers can view own documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Workers can view own documents" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'worker-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects about-us-admin-delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "about-us-admin-delete" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'about-us'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects about-us-admin-upload; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "about-us-admin-upload" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'about-us'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects about-us-public-read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "about-us-public-read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'about-us'::"text"));


--
-- Name: objects anchor_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "anchor_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'anchor-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'anchor-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects anchor_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "anchor_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'anchor-media'::"text"));


--
-- Name: objects band_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "band_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'band-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'band-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects band_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "band_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'band-media'::"text"));


--
-- Name: objects banquet_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "banquet_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'banquet-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'banquet-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects banquet_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "banquet_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'banquet-media'::"text"));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;

--
-- Name: objects catering_images_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "catering_images_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'catering-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'catering-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects catering_images_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "catering_images_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'catering-images'::"text"));


--
-- Name: objects chat_media_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "chat_media_delete" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'chat-media'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));


--
-- Name: objects chat_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "chat_media_read" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'chat-media'::"text") AND ("auth"."uid"() IS NOT NULL)));


--
-- Name: objects chat_media_upload; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "chat_media_upload" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'chat-media'::"text") AND ("auth"."uid"() IS NOT NULL)));


--
-- Name: objects dancer_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "dancer_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'dancer-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'dancer-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects dancer_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "dancer_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'dancer-media'::"text"));


--
-- Name: objects decorator_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "decorator_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'decorator-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'decorator-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects decorator_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "decorator_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'decorator-media'::"text"));


--
-- Name: objects dj_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "dj_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'dj-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'dj-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects dj_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "dj_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'dj-media'::"text"));


--
-- Name: objects drone_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "drone_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'drone-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'drone-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects drone_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "drone_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'drone-media'::"text"));


--
-- Name: objects makeup_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "makeup_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'makeup-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'makeup-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects makeup_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "makeup_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'makeup-media'::"text"));


--
-- Name: objects mehendi_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "mehendi_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'mehendi-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'mehendi-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects mehendi_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "mehendi_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'mehendi-media'::"text"));


--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;

--
-- Name: objects photography_storage_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_storage_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'photography-package-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'photography-package-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects photography_storage_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_storage_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'photography-package-images'::"text"));


--
-- Name: objects photography_videography_storage_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_videography_storage_delete" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'photography-videography-package-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));


--
-- Name: objects photography_videography_storage_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_videography_storage_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'photography-videography-package-images'::"text"));


--
-- Name: objects photography_videography_storage_update; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_videography_storage_update" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'photography-videography-package-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text"))) WITH CHECK ((("bucket_id" = 'photography-videography-package-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));


--
-- Name: objects photography_videography_storage_upload; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_videography_storage_upload" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'photography-videography-package-images'::"text") AND ("auth"."role"() = 'authenticated'::"text")));


--
-- Name: objects priest_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "priest_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'priest-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'priest-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects priest_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "priest_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'priest-media'::"text"));


--
-- Name: objects rental_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "rental_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'rental-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'rental-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects rental_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "rental_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'rental-media'::"text"));


--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;

--
-- Name: objects singer_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "singer_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'singer-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'singer-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects singer_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "singer_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'singer-media'::"text"));


--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;

--
-- Name: objects videography_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "videography_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'videography-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'videography-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects videography_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "videography_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'videography-media'::"text"));


--
-- Name: objects water_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "water_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'water-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'water-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects water_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "water_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'water-media'::"text"));


--
-- Name: objects water_product_images_owner_write; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "water_product_images_owner_write" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'water-product-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'water-product-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects water_product_images_public_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "water_product_images_public_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'water-product-images'::"text"));


--
-- Name: SCHEMA "auth"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: SCHEMA "storage"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";


--
-- Name: FUNCTION "email"(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";


--
-- Name: FUNCTION "jwt"(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";


--
-- Name: FUNCTION "role"(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";


--
-- Name: FUNCTION "uid"(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";


--
-- Name: FUNCTION "add_artist_to_event"("p_event_id" "uuid", "p_provider_id" "uuid", "p_provider_name" "text", "p_category" "text", "p_price" integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."add_artist_to_event"("p_event_id" "uuid", "p_provider_id" "uuid", "p_provider_name" "text", "p_category" "text", "p_price" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_artist_to_event"("p_event_id" "uuid", "p_provider_id" "uuid", "p_provider_name" "text", "p_category" "text", "p_price" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_artist_to_event"("p_event_id" "uuid", "p_provider_id" "uuid", "p_provider_name" "text", "p_category" "text", "p_price" integer) TO "service_role";


--
-- Name: FUNCTION "add_photography_cart_item"("p_package_id" "uuid", "p_addon_ids" "uuid"[], "p_album_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."add_photography_cart_item"("p_package_id" "uuid", "p_addon_ids" "uuid"[], "p_album_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_photography_cart_item"("p_package_id" "uuid", "p_addon_ids" "uuid"[], "p_album_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_photography_cart_item"("p_package_id" "uuid", "p_addon_ids" "uuid"[], "p_album_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "anchor_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."anchor_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."anchor_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."anchor_guard"() TO "service_role";


--
-- Name: FUNCTION "anchor_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."anchor_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."anchor_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."anchor_updated_at"() TO "service_role";


--
-- Name: FUNCTION "approve_artist"("p_provider_id" "uuid", "p_admin_user_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."approve_artist"("p_provider_id" "uuid", "p_admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_artist"("p_provider_id" "uuid", "p_admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_artist"("p_provider_id" "uuid", "p_admin_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "assert_service_start_is_due"("p_booking_table" "text", "p_booking_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assert_service_start_is_due"("p_booking_table" "text", "p_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_service_start_is_due"("p_booking_table" "text", "p_booking_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "band_pkg_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."band_pkg_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."band_pkg_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."band_pkg_updated_at"() TO "service_role";


--
-- Name: FUNCTION "banquet_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."banquet_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."banquet_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."banquet_guard"() TO "service_role";


--
-- Name: FUNCTION "banquet_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."banquet_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."banquet_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."banquet_updated_at"() TO "service_role";


--
-- Name: FUNCTION "catering_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."catering_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."catering_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."catering_guard"() TO "service_role";


--
-- Name: FUNCTION "catering_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."catering_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."catering_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."catering_updated_at"() TO "service_role";


--
-- Name: FUNCTION "check_artist_availability"("p_provider_id" "uuid", "p_event_date" "date", "p_event_time" time without time zone, "p_duration_hours" integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."check_artist_availability"("p_provider_id" "uuid", "p_event_date" "date", "p_event_time" time without time zone, "p_duration_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_artist_availability"("p_provider_id" "uuid", "p_event_date" "date", "p_event_time" time without time zone, "p_duration_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_artist_availability"("p_provider_id" "uuid", "p_event_date" "date", "p_event_time" time without time zone, "p_duration_hours" integer) TO "service_role";


--
-- Name: FUNCTION "check_cofounder_limit"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."check_cofounder_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_cofounder_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_cofounder_limit"() TO "service_role";


--
-- Name: FUNCTION "check_founder_limit"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."check_founder_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_founder_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_founder_limit"() TO "service_role";


--
-- Name: FUNCTION "check_provider_availability"("p_provider_id" "uuid", "p_event_date" "date"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."check_provider_availability"("p_provider_id" "uuid", "p_event_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."check_provider_availability"("p_provider_id" "uuid", "p_event_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_provider_availability"("p_provider_id" "uuid", "p_event_date" "date") TO "service_role";


--
-- Name: FUNCTION "checkout_photography_cart"("p_cart_id" "uuid", "p_event_date" "date", "p_event_time" "text", "p_venue" "text", "p_notes" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."checkout_photography_cart"("p_cart_id" "uuid", "p_event_date" "date", "p_event_time" "text", "p_venue" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkout_photography_cart"("p_cart_id" "uuid", "p_event_date" "date", "p_event_time" "text", "p_venue" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkout_photography_cart"("p_cart_id" "uuid", "p_event_date" "date", "p_event_time" "text", "p_venue" "text", "p_notes" "text") TO "service_role";


--
-- Name: FUNCTION "create_event_booking"("p_customer_id" "uuid", "p_event_name" "text", "p_event_type" "text", "p_event_date" "date", "p_location" "text", "p_guest_count" integer, "p_total_budget" integer, "p_notes" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."create_event_booking"("p_customer_id" "uuid", "p_event_name" "text", "p_event_type" "text", "p_event_date" "date", "p_location" "text", "p_guest_count" integer, "p_total_budget" integer, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_event_booking"("p_customer_id" "uuid", "p_event_name" "text", "p_event_type" "text", "p_event_date" "date", "p_location" "text", "p_guest_count" integer, "p_total_budget" integer, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_event_booking"("p_customer_id" "uuid", "p_event_name" "text", "p_event_type" "text", "p_event_date" "date", "p_location" "text", "p_guest_count" integer, "p_total_budget" integer, "p_notes" "text") TO "service_role";


--
-- Name: FUNCTION "create_notification_settings"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."create_notification_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_settings"() TO "service_role";


--
-- Name: FUNCTION "create_photography_package_booking"("p_package_id" "uuid", "p_event_date" "date", "p_event_time" "text", "p_venue" "text", "p_notes" "text", "p_addon_ids" "uuid"[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."create_photography_package_booking"("p_package_id" "uuid", "p_event_date" "date", "p_event_time" "text", "p_venue" "text", "p_notes" "text", "p_addon_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_photography_package_booking"("p_package_id" "uuid", "p_event_date" "date", "p_event_time" "text", "p_venue" "text", "p_notes" "text", "p_addon_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_photography_package_booking"("p_package_id" "uuid", "p_event_date" "date", "p_event_time" "text", "p_venue" "text", "p_notes" "text", "p_addon_ids" "uuid"[]) TO "service_role";


--
-- Name: FUNCTION "create_service_start_otp"("p_booking_table" "text", "p_booking_id" "uuid", "p_vendor_user_id" "uuid", "p_is_resend" boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."create_service_start_otp"("p_booking_table" "text", "p_booking_id" "uuid", "p_vendor_user_id" "uuid", "p_is_resend" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_service_start_otp"("p_booking_table" "text", "p_booking_id" "uuid", "p_vendor_user_id" "uuid", "p_is_resend" boolean) TO "service_role";


--
-- Name: FUNCTION "create_water_product_order"("p_provider_id" "uuid", "p_items" "jsonb", "p_delivery_address" "text", "p_delivery_lat" numeric, "p_delivery_lng" numeric, "p_delivery_date" "date", "p_delivery_time_slot" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."create_water_product_order"("p_provider_id" "uuid", "p_items" "jsonb", "p_delivery_address" "text", "p_delivery_lat" numeric, "p_delivery_lng" numeric, "p_delivery_date" "date", "p_delivery_time_slot" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_water_product_order"("p_provider_id" "uuid", "p_items" "jsonb", "p_delivery_address" "text", "p_delivery_lat" numeric, "p_delivery_lng" numeric, "p_delivery_date" "date", "p_delivery_time_slot" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_water_product_order"("p_provider_id" "uuid", "p_items" "jsonb", "p_delivery_address" "text", "p_delivery_lat" numeric, "p_delivery_lng" numeric, "p_delivery_date" "date", "p_delivery_time_slot" "text") TO "service_role";


--
-- Name: FUNCTION "create_water_product_order"("p_provider_id" "uuid", "p_items" "jsonb", "p_delivery_address" "text", "p_delivery_lat" numeric, "p_delivery_lng" numeric, "p_delivery_date" "date", "p_delivery_time_slot" "text", "p_special_instructions" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."create_water_product_order"("p_provider_id" "uuid", "p_items" "jsonb", "p_delivery_address" "text", "p_delivery_lat" numeric, "p_delivery_lng" numeric, "p_delivery_date" "date", "p_delivery_time_slot" "text", "p_special_instructions" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_water_product_order"("p_provider_id" "uuid", "p_items" "jsonb", "p_delivery_address" "text", "p_delivery_lat" numeric, "p_delivery_lng" numeric, "p_delivery_date" "date", "p_delivery_time_slot" "text", "p_special_instructions" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_water_product_order"("p_provider_id" "uuid", "p_items" "jsonb", "p_delivery_address" "text", "p_delivery_lat" numeric, "p_delivery_lng" numeric, "p_delivery_date" "date", "p_delivery_time_slot" "text", "p_special_instructions" "text") TO "service_role";


--
-- Name: FUNCTION "decorator_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."decorator_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."decorator_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decorator_guard"() TO "service_role";


--
-- Name: FUNCTION "decorator_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."decorator_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."decorator_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decorator_updated_at"() TO "service_role";


--
-- Name: FUNCTION "dj_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."dj_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."dj_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dj_guard"() TO "service_role";


--
-- Name: FUNCTION "dj_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."dj_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."dj_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dj_updated_at"() TO "service_role";


--
-- Name: FUNCTION "drone_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."drone_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."drone_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."drone_guard"() TO "service_role";


--
-- Name: FUNCTION "drone_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."drone_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."drone_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."drone_updated_at"() TO "service_role";


--
-- Name: FUNCTION "enforce_water_supplier_owner"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."enforce_water_supplier_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_water_supplier_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_water_supplier_owner"() TO "service_role";


--
-- Name: FUNCTION "expire_featured_artists"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."expire_featured_artists"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_featured_artists"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_featured_artists"() TO "service_role";


--
-- Name: FUNCTION "generate_invoice_number"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "service_role";


--
-- Name: FUNCTION "get_active_promotion_video"("p_user_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."get_active_promotion_video"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_promotion_video"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_promotion_video"("p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "get_nearest_available_dates"("p_provider_id" "uuid", "p_after_date" "date", "p_count" integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."get_nearest_available_dates"("p_provider_id" "uuid", "p_after_date" "date", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearest_available_dates"("p_provider_id" "uuid", "p_after_date" "date", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nearest_available_dates"("p_provider_id" "uuid", "p_after_date" "date", "p_count" integer) TO "service_role";


--
-- Name: FUNCTION "get_random_eligible_promotion_video"("p_user_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."get_random_eligible_promotion_video"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_random_eligible_promotion_video"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_random_eligible_promotion_video"("p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "get_user_roles"("p_user_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."get_user_roles"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_roles"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_roles"("p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "get_water_variant_availability"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."get_water_variant_availability"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_water_variant_availability"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_water_variant_availability"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "handle_new_user"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


--
-- Name: FUNCTION "has_role"("_user_id" "uuid", "_role" "public"."app_role"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";


--
-- Name: FUNCTION "is_anchor"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_anchor"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_anchor"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_anchor"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_banquet_hall"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_banquet_hall"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_banquet_hall"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_banquet_hall"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_caterer"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_caterer"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_caterer"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_caterer"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_chat_eligible"("p_booking_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_chat_eligible"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_chat_eligible"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_chat_eligible"("p_booking_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_chat_participant"("p_booking_id" "uuid", "p_user_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_chat_participant"("p_booking_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_chat_participant"("p_booking_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_chat_participant"("p_booking_id" "uuid", "p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_current_service_start_otp"("p_otp_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."is_current_service_start_otp"("p_otp_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_current_service_start_otp"("p_otp_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_decorator"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_decorator"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_decorator"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_decorator"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_dj"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_dj"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_dj"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_dj"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_drone_operator"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_drone_operator"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_drone_operator"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_drone_operator"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_makeup_artist"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_makeup_artist"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_makeup_artist"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_makeup_artist"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_mehendi_artist"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_mehendi_artist"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_mehendi_artist"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_mehendi_artist"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_photographer"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_photographer"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_photographer"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_photographer"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_priest"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_priest"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_priest"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_priest"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_rental_service"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_rental_service"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_rental_service"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_rental_service"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_videographer"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_videographer"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_videographer"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_videographer"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_water_supplier"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."is_water_supplier"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_water_supplier"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_water_supplier"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "log_audit_changes"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."log_audit_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_changes"() TO "service_role";


--
-- Name: FUNCTION "make_admin"("p_user_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."make_admin"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."make_admin"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."make_admin"("p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "make_provider"("p_user_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."make_provider"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."make_provider"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."make_provider"("p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "makeup_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."makeup_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."makeup_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."makeup_guard"() TO "service_role";


--
-- Name: FUNCTION "makeup_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."makeup_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."makeup_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."makeup_updated_at"() TO "service_role";


--
-- Name: FUNCTION "match_vendors"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "filter_profession" "text", "filter_city" "text", "filter_price_max" numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."match_vendors"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "filter_profession" "text", "filter_city" "text", "filter_price_max" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."match_vendors"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "filter_profession" "text", "filter_city" "text", "filter_price_max" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_vendors"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "filter_profession" "text", "filter_city" "text", "filter_price_max" numeric) TO "service_role";


--
-- Name: FUNCTION "mehendi_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."mehendi_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."mehendi_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mehendi_guard"() TO "service_role";


--
-- Name: FUNCTION "mehendi_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."mehendi_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."mehendi_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mehendi_updated_at"() TO "service_role";


--
-- Name: FUNCTION "owns_anchor"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_anchor"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_anchor"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_anchor"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_banquet_hall"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_banquet_hall"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_banquet_hall"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_banquet_hall"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_caterer"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_caterer"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_caterer"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_caterer"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_decorator"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_decorator"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_decorator"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_decorator"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_dj"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_dj"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_dj"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_dj"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_drone_operator"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_drone_operator"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_drone_operator"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_drone_operator"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_makeup_artist"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_makeup_artist"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_makeup_artist"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_makeup_artist"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_mehendi_artist"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_mehendi_artist"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_mehendi_artist"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_mehendi_artist"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_photographer"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_photographer"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_photographer"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_photographer"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_priest"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_priest"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_priest"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_priest"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_rental_service"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_rental_service"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_rental_service"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_rental_service"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_videographer"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_videographer"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_videographer"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_videographer"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "owns_water_supplier"("p_provider_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."owns_water_supplier"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_water_supplier"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_water_supplier"("p_provider_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "photography_cart_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."photography_cart_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."photography_cart_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."photography_cart_guard"() TO "service_role";


--
-- Name: FUNCTION "photography_cart_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."photography_cart_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."photography_cart_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."photography_cart_updated_at"() TO "service_role";


--
-- Name: FUNCTION "photography_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."photography_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."photography_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."photography_guard"() TO "service_role";


--
-- Name: FUNCTION "photography_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."photography_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."photography_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."photography_updated_at"() TO "service_role";


--
-- Name: FUNCTION "photography_videography_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."photography_videography_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."photography_videography_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."photography_videography_updated_at"() TO "service_role";


--
-- Name: FUNCTION "priest_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."priest_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."priest_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."priest_guard"() TO "service_role";


--
-- Name: FUNCTION "priest_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."priest_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."priest_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."priest_updated_at"() TO "service_role";


--
-- Name: FUNCTION "quote_water_delivery"("p_provider_id" "uuid", "p_delivery_lat" numeric, "p_delivery_lng" numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."quote_water_delivery"("p_provider_id" "uuid", "p_delivery_lat" numeric, "p_delivery_lng" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."quote_water_delivery"("p_provider_id" "uuid", "p_delivery_lat" numeric, "p_delivery_lng" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."quote_water_delivery"("p_provider_id" "uuid", "p_delivery_lat" numeric, "p_delivery_lng" numeric) TO "service_role";


--
-- Name: FUNCTION "record_promotion_view"("p_video_id" "uuid", "p_user_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."record_promotion_view"("p_video_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_promotion_view"("p_video_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_promotion_view"("p_video_id" "uuid", "p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "record_service_start_otp_delivery"("p_otp_id" "uuid", "p_delivered" boolean, "p_error" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."record_service_start_otp_delivery"("p_otp_id" "uuid", "p_delivered" boolean, "p_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_service_start_otp_delivery"("p_otp_id" "uuid", "p_delivered" boolean, "p_error" "text") TO "service_role";


--
-- Name: FUNCTION "reject_artist"("p_provider_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."reject_artist"("p_provider_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_artist"("p_provider_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_artist"("p_provider_id" "uuid", "p_admin_user_id" "uuid", "p_reason" "text") TO "service_role";


--
-- Name: FUNCTION "rental_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."rental_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."rental_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rental_guard"() TO "service_role";


--
-- Name: FUNCTION "rental_inventory_update"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."rental_inventory_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."rental_inventory_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rental_inventory_update"() TO "service_role";


--
-- Name: FUNCTION "rental_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."rental_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."rental_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rental_updated_at"() TO "service_role";


--
-- Name: FUNCTION "search_vendors_sql"("p_profession" "text", "p_city" "text", "p_price_max" numeric, "p_min_rating" double precision, "p_area" "text", "p_limit" integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."search_vendors_sql"("p_profession" "text", "p_city" "text", "p_price_max" numeric, "p_min_rating" double precision, "p_area" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_vendors_sql"("p_profession" "text", "p_city" "text", "p_price_max" numeric, "p_min_rating" double precision, "p_area" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_vendors_sql"("p_profession" "text", "p_city" "text", "p_price_max" numeric, "p_min_rating" double precision, "p_area" "text", "p_limit" integer) TO "service_role";


--
-- Name: FUNCTION "service_start_booking_context"("p_booking_table" "text", "p_booking_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."service_start_booking_context"("p_booking_table" "text", "p_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."service_start_booking_context"("p_booking_table" "text", "p_booking_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "set_auth_promotion_media_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."set_auth_promotion_media_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_auth_promotion_media_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_auth_promotion_media_updated_at"() TO "service_role";


--
-- Name: FUNCTION "set_auth_promotion_videos_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."set_auth_promotion_videos_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_auth_promotion_videos_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_auth_promotion_videos_updated_at"() TO "service_role";


--
-- Name: FUNCTION "set_water_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."set_water_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_water_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_water_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_artist_booking_status"("p_booking_id" "uuid", "p_status" "text", "p_negotiation_message" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."update_artist_booking_status"("p_booking_id" "uuid", "p_status" "text", "p_negotiation_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_artist_booking_status"("p_booking_id" "uuid", "p_status" "text", "p_negotiation_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_artist_booking_status"("p_booking_id" "uuid", "p_status" "text", "p_negotiation_message" "text") TO "service_role";


--
-- Name: FUNCTION "update_daily_analytics"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."update_daily_analytics"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_daily_analytics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_daily_analytics"() TO "service_role";


--
-- Name: FUNCTION "update_provider_rating"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."update_provider_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_provider_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_provider_rating"() TO "service_role";


--
-- Name: FUNCTION "update_updated_at_column"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


--
-- Name: FUNCTION "user_has_role"("p_user_id" "uuid", "p_role" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."user_has_role"("p_user_id" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_role"("p_user_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_role"("p_user_id" "uuid", "p_role" "text") TO "service_role";


--
-- Name: FUNCTION "validate_promotion_vendor_package"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."validate_promotion_vendor_package"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_promotion_vendor_package"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_promotion_vendor_package"() TO "service_role";


--
-- Name: FUNCTION "verify_service_start_otp"("p_booking_table" "text", "p_booking_id" "uuid", "p_vendor_user_id" "uuid", "p_otp" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."verify_service_start_otp"("p_booking_table" "text", "p_booking_id" "uuid", "p_vendor_user_id" "uuid", "p_otp" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_service_start_otp"("p_booking_table" "text", "p_booking_id" "uuid", "p_vendor_user_id" "uuid", "p_otp" "text") TO "service_role";


--
-- Name: FUNCTION "videography_guard"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."videography_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."videography_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."videography_guard"() TO "service_role";


--
-- Name: FUNCTION "videography_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."videography_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."videography_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."videography_updated_at"() TO "service_role";


--
-- Name: FUNCTION "water_pkg_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."water_pkg_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."water_pkg_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."water_pkg_updated_at"() TO "service_role";


--
-- Name: TABLE "audit_log_entries"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "custom_oauth_providers"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "postgres";
GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "dashboard_user";


--
-- Name: TABLE "flow_state"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";


--
-- Name: TABLE "identities"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";


--
-- Name: TABLE "instances"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "mfa_amr_claims"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";


--
-- Name: TABLE "mfa_challenges"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";


--
-- Name: TABLE "mfa_factors"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";


--
-- Name: TABLE "oauth_authorizations"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";


--
-- Name: TABLE "oauth_client_states"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."oauth_client_states" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_client_states" TO "dashboard_user";


--
-- Name: TABLE "oauth_clients"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";


--
-- Name: TABLE "oauth_consents"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";


--
-- Name: TABLE "one_time_tokens"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";


--
-- Name: TABLE "refresh_tokens"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;


--
-- Name: SEQUENCE "refresh_tokens_id_seq"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";


--
-- Name: TABLE "saml_providers"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";


--
-- Name: TABLE "saml_relay_states"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";


--
-- Name: TABLE "schema_migrations"; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "sessions"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";


--
-- Name: TABLE "sso_domains"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";


--
-- Name: TABLE "sso_providers"; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";


--
-- Name: TABLE "users"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "webauthn_challenges"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "dashboard_user";


--
-- Name: TABLE "webauthn_credentials"; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "dashboard_user";


--
-- Name: TABLE "about_team_members"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."about_team_members" TO "anon";
GRANT ALL ON TABLE "public"."about_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."about_team_members" TO "service_role";


--
-- Name: TABLE "about_us"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."about_us" TO "anon";
GRANT ALL ON TABLE "public"."about_us" TO "authenticated";
GRANT ALL ON TABLE "public"."about_us" TO "service_role";


--
-- Name: TABLE "admin_event_package_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."admin_event_package_bookings" TO "anon";
GRANT ALL ON TABLE "public"."admin_event_package_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_event_package_bookings" TO "service_role";


--
-- Name: TABLE "admin_event_package_discounts"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."admin_event_package_discounts" TO "anon";
GRANT ALL ON TABLE "public"."admin_event_package_discounts" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_event_package_discounts" TO "service_role";


--
-- Name: TABLE "admin_event_package_inclusions"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."admin_event_package_inclusions" TO "anon";
GRANT ALL ON TABLE "public"."admin_event_package_inclusions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_event_package_inclusions" TO "service_role";


--
-- Name: TABLE "admin_event_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."admin_event_packages" TO "anon";
GRANT ALL ON TABLE "public"."admin_event_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_event_packages" TO "service_role";


--
-- Name: TABLE "ai_conversations"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."ai_conversations" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversations" TO "service_role";


--
-- Name: TABLE "ai_message_feedback"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."ai_message_feedback" TO "anon";
GRANT ALL ON TABLE "public"."ai_message_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_message_feedback" TO "service_role";


--
-- Name: TABLE "ai_messages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."ai_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_messages" TO "service_role";


--
-- Name: TABLE "anchor_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."anchor_addons" TO "anon";
GRANT ALL ON TABLE "public"."anchor_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."anchor_addons" TO "service_role";


--
-- Name: TABLE "anchor_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."anchor_bookings" TO "anon";
GRANT ALL ON TABLE "public"."anchor_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."anchor_bookings" TO "service_role";


--
-- Name: TABLE "anchor_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."anchor_gallery" TO "anon";
GRANT ALL ON TABLE "public"."anchor_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."anchor_gallery" TO "service_role";


--
-- Name: TABLE "anchor_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."anchor_packages" TO "anon";
GRANT ALL ON TABLE "public"."anchor_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."anchor_packages" TO "service_role";


--
-- Name: TABLE "artist_categories"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."artist_categories" TO "anon";
GRANT ALL ON TABLE "public"."artist_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."artist_categories" TO "service_role";


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";


--
-- Name: TABLE "provider_profiles"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."provider_profiles" TO "anon";
GRANT ALL ON TABLE "public"."provider_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_profiles" TO "service_role";


--
-- Name: TABLE "approved_artists_view"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."approved_artists_view" TO "anon";
GRANT ALL ON TABLE "public"."approved_artists_view" TO "authenticated";
GRANT ALL ON TABLE "public"."approved_artists_view" TO "service_role";


--
-- Name: TABLE "artist_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."artist_bookings" TO "anon";
GRANT ALL ON TABLE "public"."artist_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."artist_bookings" TO "service_role";


--
-- Name: TABLE "audit_log"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";


--
-- Name: TABLE "auth_promotion_media"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."auth_promotion_media" TO "anon";
GRANT ALL ON TABLE "public"."auth_promotion_media" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_promotion_media" TO "service_role";


--
-- Name: TABLE "auth_promotion_video_views"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."auth_promotion_video_views" TO "anon";
GRANT ALL ON TABLE "public"."auth_promotion_video_views" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_promotion_video_views" TO "service_role";


--
-- Name: TABLE "auth_promotion_videos"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."auth_promotion_videos" TO "anon";
GRANT ALL ON TABLE "public"."auth_promotion_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_promotion_videos" TO "service_role";


--
-- Name: TABLE "auth_promotional_config"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."auth_promotional_config" TO "anon";
GRANT ALL ON TABLE "public"."auth_promotional_config" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_promotional_config" TO "service_role";


--
-- Name: TABLE "band_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."band_addons" TO "anon";
GRANT ALL ON TABLE "public"."band_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."band_addons" TO "service_role";


--
-- Name: TABLE "band_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."band_bookings" TO "anon";
GRANT ALL ON TABLE "public"."band_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."band_bookings" TO "service_role";


--
-- Name: TABLE "band_categories"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."band_categories" TO "anon";
GRANT ALL ON TABLE "public"."band_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."band_categories" TO "service_role";


--
-- Name: TABLE "band_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."band_gallery" TO "anon";
GRANT ALL ON TABLE "public"."band_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."band_gallery" TO "service_role";


--
-- Name: TABLE "band_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."band_packages" TO "anon";
GRANT ALL ON TABLE "public"."band_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."band_packages" TO "service_role";


--
-- Name: TABLE "bank_details"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."bank_details" TO "anon";
GRANT ALL ON TABLE "public"."bank_details" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_details" TO "service_role";


--
-- Name: TABLE "banquet_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."banquet_bookings" TO "anon";
GRANT ALL ON TABLE "public"."banquet_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."banquet_bookings" TO "service_role";


--
-- Name: TABLE "banquet_halls"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."banquet_halls" TO "anon";
GRANT ALL ON TABLE "public"."banquet_halls" TO "authenticated";
GRANT ALL ON TABLE "public"."banquet_halls" TO "service_role";


--
-- Name: TABLE "booking_cancellations"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."booking_cancellations" TO "anon";
GRANT ALL ON TABLE "public"."booking_cancellations" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_cancellations" TO "service_role";


--
-- Name: TABLE "booking_events"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."booking_events" TO "anon";
GRANT ALL ON TABLE "public"."booking_events" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_events" TO "service_role";


--
-- Name: TABLE "booking_locations"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."booking_locations" TO "anon";
GRANT ALL ON TABLE "public"."booking_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_locations" TO "service_role";


--
-- Name: TABLE "booking_start_otps"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."booking_start_otps" TO "service_role";


--
-- Name: TABLE "bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";


--
-- Name: TABLE "budget_allocations"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."budget_allocations" TO "anon";
GRANT ALL ON TABLE "public"."budget_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_allocations" TO "service_role";


--
-- Name: TABLE "category_provider_counts"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."category_provider_counts" TO "anon";
GRANT ALL ON TABLE "public"."category_provider_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."category_provider_counts" TO "service_role";


--
-- Name: TABLE "catering_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."catering_addons" TO "anon";
GRANT ALL ON TABLE "public"."catering_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."catering_addons" TO "service_role";


--
-- Name: TABLE "catering_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."catering_bookings" TO "anon";
GRANT ALL ON TABLE "public"."catering_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."catering_bookings" TO "service_role";


--
-- Name: TABLE "catering_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."catering_gallery" TO "anon";
GRANT ALL ON TABLE "public"."catering_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."catering_gallery" TO "service_role";


--
-- Name: TABLE "catering_menu_items"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."catering_menu_items" TO "anon";
GRANT ALL ON TABLE "public"."catering_menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."catering_menu_items" TO "service_role";


--
-- Name: TABLE "catering_menu_sections"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."catering_menu_sections" TO "anon";
GRANT ALL ON TABLE "public"."catering_menu_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."catering_menu_sections" TO "service_role";


--
-- Name: TABLE "catering_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."catering_packages" TO "anon";
GRANT ALL ON TABLE "public"."catering_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."catering_packages" TO "service_role";


--
-- Name: TABLE "commission_tracking"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."commission_tracking" TO "anon";
GRANT ALL ON TABLE "public"."commission_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."commission_tracking" TO "service_role";


--
-- Name: TABLE "dancer_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."dancer_addons" TO "anon";
GRANT ALL ON TABLE "public"."dancer_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."dancer_addons" TO "service_role";


--
-- Name: TABLE "dancer_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."dancer_bookings" TO "anon";
GRANT ALL ON TABLE "public"."dancer_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."dancer_bookings" TO "service_role";


--
-- Name: TABLE "dancer_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."dancer_gallery" TO "anon";
GRANT ALL ON TABLE "public"."dancer_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."dancer_gallery" TO "service_role";


--
-- Name: TABLE "dancer_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."dancer_packages" TO "anon";
GRANT ALL ON TABLE "public"."dancer_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."dancer_packages" TO "service_role";


--
-- Name: TABLE "decorator_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."decorator_addons" TO "anon";
GRANT ALL ON TABLE "public"."decorator_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."decorator_addons" TO "service_role";


--
-- Name: TABLE "decorator_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."decorator_bookings" TO "anon";
GRANT ALL ON TABLE "public"."decorator_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."decorator_bookings" TO "service_role";


--
-- Name: TABLE "decorator_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."decorator_gallery" TO "anon";
GRANT ALL ON TABLE "public"."decorator_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."decorator_gallery" TO "service_role";


--
-- Name: TABLE "decorator_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."decorator_packages" TO "anon";
GRANT ALL ON TABLE "public"."decorator_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."decorator_packages" TO "service_role";


--
-- Name: TABLE "delivery_charges"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."delivery_charges" TO "anon";
GRANT ALL ON TABLE "public"."delivery_charges" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_charges" TO "service_role";


--
-- Name: TABLE "dj_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."dj_addons" TO "anon";
GRANT ALL ON TABLE "public"."dj_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."dj_addons" TO "service_role";


--
-- Name: TABLE "dj_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."dj_bookings" TO "anon";
GRANT ALL ON TABLE "public"."dj_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."dj_bookings" TO "service_role";


--
-- Name: TABLE "dj_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."dj_gallery" TO "anon";
GRANT ALL ON TABLE "public"."dj_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."dj_gallery" TO "service_role";


--
-- Name: TABLE "dj_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."dj_packages" TO "anon";
GRANT ALL ON TABLE "public"."dj_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."dj_packages" TO "service_role";


--
-- Name: TABLE "drone_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."drone_addons" TO "anon";
GRANT ALL ON TABLE "public"."drone_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."drone_addons" TO "service_role";


--
-- Name: TABLE "drone_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."drone_bookings" TO "anon";
GRANT ALL ON TABLE "public"."drone_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."drone_bookings" TO "service_role";


--
-- Name: TABLE "drone_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."drone_gallery" TO "anon";
GRANT ALL ON TABLE "public"."drone_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."drone_gallery" TO "service_role";


--
-- Name: TABLE "drone_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."drone_packages" TO "anon";
GRANT ALL ON TABLE "public"."drone_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."drone_packages" TO "service_role";


--
-- Name: TABLE "event_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."event_bookings" TO "anon";
GRANT ALL ON TABLE "public"."event_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."event_bookings" TO "service_role";


--
-- Name: TABLE "event_types"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."event_types" TO "anon";
GRANT ALL ON TABLE "public"."event_types" TO "authenticated";
GRANT ALL ON TABLE "public"."event_types" TO "service_role";


--
-- Name: TABLE "favorites"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";


--
-- Name: TABLE "featured_artists"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."featured_artists" TO "anon";
GRANT ALL ON TABLE "public"."featured_artists" TO "authenticated";
GRANT ALL ON TABLE "public"."featured_artists" TO "service_role";


--
-- Name: TABLE "hall_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."hall_addons" TO "anon";
GRANT ALL ON TABLE "public"."hall_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."hall_addons" TO "service_role";


--
-- Name: TABLE "hall_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."hall_gallery" TO "anon";
GRANT ALL ON TABLE "public"."hall_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."hall_gallery" TO "service_role";


--
-- Name: SEQUENCE "invoice_seq"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE "public"."invoice_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_seq" TO "service_role";


--
-- Name: TABLE "invoices"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";


--
-- Name: TABLE "login_attempts"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."login_attempts" TO "anon";
GRANT ALL ON TABLE "public"."login_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."login_attempts" TO "service_role";


--
-- Name: TABLE "makeup_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."makeup_addons" TO "anon";
GRANT ALL ON TABLE "public"."makeup_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."makeup_addons" TO "service_role";


--
-- Name: TABLE "makeup_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."makeup_bookings" TO "anon";
GRANT ALL ON TABLE "public"."makeup_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."makeup_bookings" TO "service_role";


--
-- Name: TABLE "makeup_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."makeup_gallery" TO "anon";
GRANT ALL ON TABLE "public"."makeup_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."makeup_gallery" TO "service_role";


--
-- Name: TABLE "makeup_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."makeup_packages" TO "anon";
GRANT ALL ON TABLE "public"."makeup_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."makeup_packages" TO "service_role";


--
-- Name: TABLE "mehendi_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."mehendi_addons" TO "anon";
GRANT ALL ON TABLE "public"."mehendi_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."mehendi_addons" TO "service_role";


--
-- Name: TABLE "mehendi_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."mehendi_bookings" TO "anon";
GRANT ALL ON TABLE "public"."mehendi_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."mehendi_bookings" TO "service_role";


--
-- Name: TABLE "mehendi_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."mehendi_gallery" TO "anon";
GRANT ALL ON TABLE "public"."mehendi_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."mehendi_gallery" TO "service_role";


--
-- Name: TABLE "mehendi_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."mehendi_packages" TO "anon";
GRANT ALL ON TABLE "public"."mehendi_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."mehendi_packages" TO "service_role";


--
-- Name: TABLE "menu_items"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";


--
-- Name: TABLE "messages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";


--
-- Name: TABLE "notification_settings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";


--
-- Name: TABLE "notifications"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";


--
-- Name: TABLE "otp_rate_limits"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."otp_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."otp_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."otp_rate_limits" TO "service_role";


--
-- Name: TABLE "otp_verifications"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."otp_verifications" TO "anon";
GRANT ALL ON TABLE "public"."otp_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."otp_verifications" TO "service_role";


--
-- Name: TABLE "payments"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";


--
-- Name: TABLE "photographer_availability"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photographer_availability" TO "anon";
GRANT ALL ON TABLE "public"."photographer_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."photographer_availability" TO "service_role";


--
-- Name: TABLE "photography_albums"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_albums" TO "anon";
GRANT ALL ON TABLE "public"."photography_albums" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_albums" TO "service_role";


--
-- Name: TABLE "photography_booking_timeline"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_booking_timeline" TO "anon";
GRANT ALL ON TABLE "public"."photography_booking_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_booking_timeline" TO "service_role";


--
-- Name: TABLE "photography_cart_items"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_cart_items" TO "anon";
GRANT ALL ON TABLE "public"."photography_cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_cart_items" TO "service_role";


--
-- Name: TABLE "photography_carts"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_carts" TO "anon";
GRANT ALL ON TABLE "public"."photography_carts" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_carts" TO "service_role";


--
-- Name: TABLE "photography_package_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_package_addons" TO "anon";
GRANT ALL ON TABLE "public"."photography_package_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_package_addons" TO "service_role";


--
-- Name: TABLE "photography_package_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_package_bookings" TO "anon";
GRANT ALL ON TABLE "public"."photography_package_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_package_bookings" TO "service_role";


--
-- Name: TABLE "photography_package_highlights"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_package_highlights" TO "anon";
GRANT ALL ON TABLE "public"."photography_package_highlights" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_package_highlights" TO "service_role";


--
-- Name: TABLE "photography_package_images"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_package_images" TO "anon";
GRANT ALL ON TABLE "public"."photography_package_images" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_package_images" TO "service_role";


--
-- Name: TABLE "photography_package_invoices"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_package_invoices" TO "anon";
GRANT ALL ON TABLE "public"."photography_package_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_package_invoices" TO "service_role";


--
-- Name: TABLE "photography_package_payments"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_package_payments" TO "anon";
GRANT ALL ON TABLE "public"."photography_package_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_package_payments" TO "service_role";


--
-- Name: TABLE "photography_package_reviews"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_package_reviews" TO "anon";
GRANT ALL ON TABLE "public"."photography_package_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_package_reviews" TO "service_role";


--
-- Name: TABLE "photography_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_packages" TO "anon";
GRANT ALL ON TABLE "public"."photography_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_packages" TO "service_role";


--
-- Name: TABLE "photography_videography_package_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_videography_package_addons" TO "anon";
GRANT ALL ON TABLE "public"."photography_videography_package_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_videography_package_addons" TO "service_role";


--
-- Name: TABLE "photography_videography_package_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_videography_package_bookings" TO "anon";
GRANT ALL ON TABLE "public"."photography_videography_package_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_videography_package_bookings" TO "service_role";


--
-- Name: TABLE "photography_videography_package_images"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_videography_package_images" TO "anon";
GRANT ALL ON TABLE "public"."photography_videography_package_images" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_videography_package_images" TO "service_role";


--
-- Name: TABLE "photography_videography_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."photography_videography_packages" TO "anon";
GRANT ALL ON TABLE "public"."photography_videography_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."photography_videography_packages" TO "service_role";


--
-- Name: TABLE "planner_recommendation_candidates"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."planner_recommendation_candidates" TO "anon";
GRANT ALL ON TABLE "public"."planner_recommendation_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."planner_recommendation_candidates" TO "service_role";


--
-- Name: TABLE "planner_recommendation_runs"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."planner_recommendation_runs" TO "anon";
GRANT ALL ON TABLE "public"."planner_recommendation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."planner_recommendation_runs" TO "service_role";


--
-- Name: TABLE "platform_analytics"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."platform_analytics" TO "anon";
GRANT ALL ON TABLE "public"."platform_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_analytics" TO "service_role";


--
-- Name: TABLE "platform_settings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";


--
-- Name: TABLE "pooja_services"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."pooja_services" TO "anon";
GRANT ALL ON TABLE "public"."pooja_services" TO "authenticated";
GRANT ALL ON TABLE "public"."pooja_services" TO "service_role";


--
-- Name: TABLE "portfolio_items"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."portfolio_items" TO "anon";
GRANT ALL ON TABLE "public"."portfolio_items" TO "authenticated";
GRANT ALL ON TABLE "public"."portfolio_items" TO "service_role";


--
-- Name: TABLE "pricing_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."pricing_packages" TO "anon";
GRANT ALL ON TABLE "public"."pricing_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_packages" TO "service_role";


--
-- Name: TABLE "priest_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."priest_addons" TO "anon";
GRANT ALL ON TABLE "public"."priest_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."priest_addons" TO "service_role";


--
-- Name: TABLE "priest_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."priest_bookings" TO "anon";
GRANT ALL ON TABLE "public"."priest_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."priest_bookings" TO "service_role";


--
-- Name: TABLE "priest_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."priest_gallery" TO "anon";
GRANT ALL ON TABLE "public"."priest_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."priest_gallery" TO "service_role";


--
-- Name: TABLE "priest_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."priest_packages" TO "anon";
GRANT ALL ON TABLE "public"."priest_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."priest_packages" TO "service_role";


--
-- Name: TABLE "product_order_items"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."product_order_items" TO "anon";
GRANT ALL ON TABLE "public"."product_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."product_order_items" TO "service_role";


--
-- Name: TABLE "product_orders"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."product_orders" TO "anon";
GRANT ALL ON TABLE "public"."product_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."product_orders" TO "service_role";


--
-- Name: TABLE "provider_availability"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."provider_availability" TO "anon";
GRANT ALL ON TABLE "public"."provider_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_availability" TO "service_role";


--
-- Name: TABLE "provider_calendar"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."provider_calendar" TO "anon";
GRANT ALL ON TABLE "public"."provider_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_calendar" TO "service_role";


--
-- Name: TABLE "provider_faqs"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."provider_faqs" TO "anon";
GRANT ALL ON TABLE "public"."provider_faqs" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_faqs" TO "service_role";


--
-- Name: TABLE "provider_time_slots"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."provider_time_slots" TO "anon";
GRANT ALL ON TABLE "public"."provider_time_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_time_slots" TO "service_role";


--
-- Name: TABLE "push_subscriptions"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";


--
-- Name: TABLE "refresh_tokens"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."refresh_tokens" TO "anon";
GRANT ALL ON TABLE "public"."refresh_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."refresh_tokens" TO "service_role";


--
-- Name: TABLE "rental_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."rental_addons" TO "anon";
GRANT ALL ON TABLE "public"."rental_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_addons" TO "service_role";


--
-- Name: TABLE "rental_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."rental_bookings" TO "anon";
GRANT ALL ON TABLE "public"."rental_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_bookings" TO "service_role";


--
-- Name: TABLE "rental_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."rental_gallery" TO "anon";
GRANT ALL ON TABLE "public"."rental_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_gallery" TO "service_role";


--
-- Name: TABLE "rental_items"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."rental_items" TO "anon";
GRANT ALL ON TABLE "public"."rental_items" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_items" TO "service_role";


--
-- Name: TABLE "rental_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."rental_packages" TO "anon";
GRANT ALL ON TABLE "public"."rental_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_packages" TO "service_role";


--
-- Name: TABLE "reschedule_requests"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."reschedule_requests" TO "anon";
GRANT ALL ON TABLE "public"."reschedule_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."reschedule_requests" TO "service_role";


--
-- Name: TABLE "reviews"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";


--
-- Name: TABLE "search_history"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."search_history" TO "anon";
GRANT ALL ON TABLE "public"."search_history" TO "authenticated";
GRANT ALL ON TABLE "public"."search_history" TO "service_role";


--
-- Name: TABLE "security_events"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."security_events" TO "anon";
GRANT ALL ON TABLE "public"."security_events" TO "authenticated";
GRANT ALL ON TABLE "public"."security_events" TO "service_role";


--
-- Name: TABLE "singer_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."singer_addons" TO "anon";
GRANT ALL ON TABLE "public"."singer_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."singer_addons" TO "service_role";


--
-- Name: TABLE "singer_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."singer_bookings" TO "anon";
GRANT ALL ON TABLE "public"."singer_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."singer_bookings" TO "service_role";


--
-- Name: TABLE "singer_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."singer_gallery" TO "anon";
GRANT ALL ON TABLE "public"."singer_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."singer_gallery" TO "service_role";


--
-- Name: TABLE "singer_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."singer_packages" TO "anon";
GRANT ALL ON TABLE "public"."singer_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."singer_packages" TO "service_role";


--
-- Name: TABLE "subcategories"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."subcategories" TO "anon";
GRANT ALL ON TABLE "public"."subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."subcategories" TO "service_role";


--
-- Name: TABLE "supplier_delivery_settings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."supplier_delivery_settings" TO "anon";
GRANT ALL ON TABLE "public"."supplier_delivery_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_delivery_settings" TO "service_role";


--
-- Name: TABLE "user_roles"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";


--
-- Name: TABLE "vendor_cancellations"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."vendor_cancellations" TO "anon";
GRANT ALL ON TABLE "public"."vendor_cancellations" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_cancellations" TO "service_role";


--
-- Name: TABLE "vendor_embeddings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."vendor_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."vendor_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_embeddings" TO "service_role";


--
-- Name: TABLE "vendor_settlements"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."vendor_settlements" TO "anon";
GRANT ALL ON TABLE "public"."vendor_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_settlements" TO "service_role";


--
-- Name: TABLE "videography_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."videography_addons" TO "anon";
GRANT ALL ON TABLE "public"."videography_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."videography_addons" TO "service_role";


--
-- Name: TABLE "videography_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."videography_bookings" TO "anon";
GRANT ALL ON TABLE "public"."videography_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."videography_bookings" TO "service_role";


--
-- Name: TABLE "videography_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."videography_gallery" TO "anon";
GRANT ALL ON TABLE "public"."videography_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."videography_gallery" TO "service_role";


--
-- Name: TABLE "videography_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."videography_packages" TO "anon";
GRANT ALL ON TABLE "public"."videography_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."videography_packages" TO "service_role";


--
-- Name: TABLE "water_addons"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."water_addons" TO "anon";
GRANT ALL ON TABLE "public"."water_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."water_addons" TO "service_role";


--
-- Name: TABLE "water_bookings"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."water_bookings" TO "anon";
GRANT ALL ON TABLE "public"."water_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."water_bookings" TO "service_role";


--
-- Name: TABLE "water_categories"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."water_categories" TO "anon";
GRANT ALL ON TABLE "public"."water_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."water_categories" TO "service_role";


--
-- Name: TABLE "water_gallery"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."water_gallery" TO "anon";
GRANT ALL ON TABLE "public"."water_gallery" TO "authenticated";
GRANT ALL ON TABLE "public"."water_gallery" TO "service_role";


--
-- Name: TABLE "water_packages"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."water_packages" TO "anon";
GRANT ALL ON TABLE "public"."water_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."water_packages" TO "service_role";


--
-- Name: TABLE "water_product_images"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."water_product_images" TO "anon";
GRANT ALL ON TABLE "public"."water_product_images" TO "authenticated";
GRANT ALL ON TABLE "public"."water_product_images" TO "service_role";


--
-- Name: TABLE "water_product_reviews"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."water_product_reviews" TO "anon";
GRANT ALL ON TABLE "public"."water_product_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."water_product_reviews" TO "service_role";


--
-- Name: TABLE "water_product_stock"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."water_product_stock" TO "anon";
GRANT ALL ON TABLE "public"."water_product_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."water_product_stock" TO "service_role";


--
-- Name: TABLE "water_product_variants"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."water_product_variants" TO "anon";
GRANT ALL ON TABLE "public"."water_product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."water_product_variants" TO "service_role";


--
-- Name: TABLE "water_products"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."water_products" TO "anon";
GRANT ALL ON TABLE "public"."water_products" TO "authenticated";
GRANT ALL ON TABLE "public"."water_products" TO "service_role";


--
-- Name: TABLE "worker_bank_accounts"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."worker_bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."worker_bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_bank_accounts" TO "service_role";


--
-- Name: TABLE "worker_documents"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."worker_documents" TO "anon";
GRANT ALL ON TABLE "public"."worker_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_documents" TO "service_role";


--
-- Name: TABLE "worker_profiles"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."worker_profiles" TO "anon";
GRANT ALL ON TABLE "public"."worker_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_profiles" TO "service_role";


--
-- Name: TABLE "buckets"; Type: ACL; Schema: storage; Owner: -
--

REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "buckets_analytics"; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";


--
-- Name: TABLE "buckets_vectors"; Type: ACL; Schema: storage; Owner: -
--

GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";


--
-- Name: TABLE "objects"; Type: ACL; Schema: storage; Owner: -
--

REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "s3_multipart_uploads"; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";


--
-- Name: TABLE "s3_multipart_uploads_parts"; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";


--
-- Name: TABLE "vector_indexes"; Type: ACL; Schema: storage; Owner: -
--

GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

\unrestrict k3chUfUSfaP0SrANjhhcTi0bZe2JbLSVFueGA9n0vmKSS4hYL29IHSTA7OfXMdK

