-- Secure, application-level Service Start OTP for confirmed vendor bookings.
-- This is intentionally separate from Supabase Auth OTP / SMTP flows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reuse the existing booking_start_otps table and add only the fields needed to
-- make a successfully verified OTP explicitly single-use and delivery-auditable.
ALTER TABLE public.booking_start_otps
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Expired and duplicate legacy records must not prevent the secure flow from
-- maintaining exactly one active OTP per booking source.
UPDATE public.booking_start_otps
SET invalidated = true
WHERE verified = false
  AND invalidated = false
  AND expires_at <= now();

WITH ranked_active_otps AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY booking_table, booking_id
           ORDER BY created_at DESC, id DESC
         ) AS row_number
  FROM public.booking_start_otps
  WHERE verified = false
    AND invalidated = false
)
UPDATE public.booking_start_otps otp
SET invalidated = true
FROM ranked_active_otps ranked
WHERE otp.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS booking_start_otps_one_active_per_booking
  ON public.booking_start_otps (booking_table, booking_id)
  WHERE verified = false AND invalidated = false;

-- OTP hashes must never be readable or writable by browser clients. The Edge
-- Function is the only public API and calls the RPCs below using service_role.
DROP POLICY IF EXISTS "vendor_select_own_otps" ON public.booking_start_otps;
DROP POLICY IF EXISTS "customer_select_own_otps" ON public.booking_start_otps;
DROP POLICY IF EXISTS "admin_select_all_otps" ON public.booking_start_otps;
DROP POLICY IF EXISTS "authenticated_insert_otps" ON public.booking_start_otps;
DROP POLICY IF EXISTS "authenticated_update_otps" ON public.booking_start_otps;
ALTER TABLE public.booking_start_otps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_start_otps FROM anon, authenticated;

-- Returns and locks the booking while normalizing the photography provider key.
-- It accepts only the application's known booking tables, blocking SQL injection
-- through the dynamic table identifier.
CREATE OR REPLACE FUNCTION public.service_start_booking_context(
  p_booking_table TEXT,
  p_booking_id UUID
)
RETURNS TABLE (
  customer_id UUID,
  provider_id UUID,
  booking_status TEXT,
  advance_paid_at TIMESTAMPTZ,
  work_started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

-- Creates a cryptographically random six-digit code and stores only a bcrypt
-- hash. This function is service-role-only, so the plaintext code can only be
-- returned to the Edge Function for delivery through Brevo, never to a browser.
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

  IF lower(coalesce(v_status, '')) NOT IN ('confirmed', 'approved')
     OR v_advance_paid_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BOOKING_NOT_CONFIRMED';
  END IF;

  IF v_work_started_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERVICE_ALREADY_STARTED';
  END IF;

  SELECT NULLIF(trim(email), '')
  INTO v_customer_email
  FROM public.profiles
  WHERE id = v_customer_id;

  IF v_customer_email IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CUSTOMER_EMAIL_NOT_FOUND';
  END IF;

  -- An expired code is never reusable. Invalidate it before issuing another.
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
      UPDATE public.booking_start_otps
      SET invalidated = true
      WHERE id = v_previous_id;
    ELSE
      -- A resend after expiry is a fresh code, but still has one resend counted.
      v_resend_count := 1;
    END IF;
  END IF;

  -- Four bytes from pgcrypto are used as the entropy source. The browser never
  -- receives this code; only its bcrypt hash is persisted.
  v_random := (get_byte(gen_random_bytes(4), 0)::bigint << 24)
            + (get_byte(gen_random_bytes(4), 1)::bigint << 16)
            + (get_byte(gen_random_bytes(4), 2)::bigint << 8)
            + get_byte(gen_random_bytes(4), 3)::bigint;
  v_otp := lpad((v_random % 1000000)::text, 6, '0');
  v_otp_hash := crypt(v_otp, gen_salt('bf', 10));

  INSERT INTO public.booking_start_otps (
    booking_id,
    booking_table,
    vendor_id,
    customer_id,
    otp_hash,
    purpose,
    expires_at,
    resend_count,
    email_sent,
    invalidated
  ) VALUES (
    p_booking_id,
    p_booking_table,
    v_provider_id::text,
    v_customer_id,
    v_otp_hash,
    'booking_start',
    now() + interval '10 minutes',
    v_resend_count,
    false,
    false
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

-- Records delivery after Brevo responds. Failed delivery invalidates the code,
-- so an undelivered code can never be used.
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
BEGIN
  UPDATE public.booking_start_otps
  SET email_sent = p_delivered,
      email_sent_at = CASE WHEN p_delivered THEN now() ELSE NULL END,
      email_error = CASE WHEN p_delivered THEN NULL ELSE left(coalesce(p_error, 'Email delivery failed'), 500) END,
      invalidated = CASE WHEN p_delivered THEN invalidated ELSE true END
  WHERE id = p_otp_id
    AND verified = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OTP_NOT_FOUND';
  END IF;
END;
$$;

-- Verifies the customer-provided code atomically. The same transaction locks the
-- booking and OTP row, increments attempts, consumes the code, and starts work.
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

  IF lower(coalesce(v_status, '')) NOT IN ('confirmed', 'approved')
     OR v_advance_paid_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BOOKING_NOT_CONFIRMED';
  END IF;

  IF v_work_started_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_started', 'started_at', v_work_started_at);
  END IF;

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

-- These routines deliberately accept only service_role. Browser callers use the
-- authenticated Edge Function, which independently validates the vendor JWT.
REVOKE ALL ON FUNCTION public.service_start_booking_context(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_service_start_otp(TEXT, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_service_start_otp_delivery(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_service_start_otp(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_start_booking_context(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_service_start_otp(TEXT, UUID, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_service_start_otp_delivery(UUID, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_service_start_otp(TEXT, UUID, UUID, TEXT) TO service_role;
