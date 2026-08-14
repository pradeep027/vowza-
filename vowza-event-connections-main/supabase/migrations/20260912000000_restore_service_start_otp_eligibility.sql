-- Restore Service Start OTP eligibility for paid pre-start bookings.
--
-- The legacy customer payment flow writes status = 'in_progress' before service
-- execution. work_started_at is the authoritative execution marker, so this
-- migration permits that paid pre-start compatibility state while requiring the
-- scheduled event time to have arrived in Asia/Kolkata.

CREATE OR REPLACE FUNCTION public.assert_service_start_is_due(
  p_booking_table TEXT,
  p_booking_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.create_service_start_otp(
  p_booking_table TEXT,
  p_booking_id UUID,
  p_vendor_user_id UUID,
  p_is_resend BOOLEAN DEFAULT false
)
RETURNS TABLE (
  otp_id UUID,
  otp_code TEXT,
  customer_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.verify_service_start_otp(
  p_booking_table TEXT,
  p_booking_id UUID,
  p_vendor_user_id UUID,
  p_otp TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.assert_service_start_is_due(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_service_start_is_due(TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.create_service_start_otp(TEXT, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_service_start_otp(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_service_start_otp(TEXT, UUID, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_service_start_otp(TEXT, UUID, UUID, TEXT) TO service_role;

-- Delivery acknowledgement is monotonic. A lost response after a successful
-- Brevo send must never downgrade a usable delivered code into an invalid one.
CREATE OR REPLACE FUNCTION public.record_service_start_otp_delivery(
  p_otp_id UUID,
  p_delivered BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- Participant notifications are emitted only for a currently active, delivered
-- OTP. A slow older send that a resend has superseded is never announced.
CREATE OR REPLACE FUNCTION public.is_current_service_start_otp(
  p_otp_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
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

REVOKE ALL ON FUNCTION public.record_service_start_otp_delivery(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_current_service_start_otp(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_service_start_otp_delivery(UUID, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_current_service_start_otp(UUID) TO service_role;
