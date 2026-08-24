-- Vowza security mitigation 2/3
-- Purpose: replace direct client access to public.otp_verifications with a
-- trusted, atomic verification RPC whose EXECUTE privilege is limited to
-- service_role.
--
-- The trusted caller is responsible for producing p_otp_hash using the same
-- hashing contract used when the OTP row was created. The raw OTP is never
-- accepted or returned by this function.
--
-- APPLY ORDER:
--   1. Apply 20260824000000_security_role_assignment_rpc.sql.
--   2. Apply this OTP verification RPC.
--   3. Apply 20260824000002_security_lock_sensitive_tables.sql.
--
-- ROLLBACK ORDER:
--   1. Revert 20260824000002_security_lock_sensitive_tables.sql.
--   2. Revert application call sites to their pre-mitigation behavior.
--   3. Drop this function after the application no longer calls it.
--
-- APPLY STATUS: prepared for review only; do not apply from this audit task.

BEGIN;

CREATE OR REPLACE FUNCTION public.verify_otp(
  p_phone text,
  p_purpose text,
  p_otp_hash text,
  p_max_attempts integer DEFAULT 3
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_otp_id uuid;
  v_current_attempts integer;
  v_attempts integer;
  v_expires_at timestamptz;
  v_stored_hash text;
BEGIN
  -- EXECUTE privilege is the caller control. There is intentionally no
  -- auth.role() guard in the function body; direct database connections can
  -- have no JWT context and therefore no auth.role() value.
  IF NULLIF(btrim(p_phone), '') IS NULL
     OR NULLIF(btrim(p_purpose), '') IS NULL
     OR NULLIF(btrim(p_otp_hash), '') IS NULL THEN
    RAISE EXCEPTION 'phone, purpose, and otp_hash are required'
      USING ERRCODE = '22004';
  END IF;

  IF p_max_attempts IS NULL OR p_max_attempts < 1 OR p_max_attempts > 10 THEN
    RAISE EXCEPTION 'max_attempts must be between 1 and 10'
      USING ERRCODE = '22023';
  END IF;

  -- Select the newest unverified OTP for the phone and purpose, regardless of
  -- hash, so a failed comparison can be counted atomically.
  SELECT ov.id,
         COALESCE(ov.attempts, 0),
         ov.expires_at,
         ov.otp_hash
    INTO v_otp_id, v_current_attempts, v_expires_at, v_stored_hash
    FROM public.otp_verifications AS ov
   WHERE ov.phone = p_phone
     AND ov.purpose = p_purpose
     AND COALESCE(ov.verified, false) = false
   ORDER BY ov.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_otp_id IS NULL THEN
    RETURN false;
  END IF;

  -- A failed verification consumes an attempt. Cap the stored value so it
  -- cannot wrap or grow without bound after lockout.
  v_attempts := LEAST(v_current_attempts + 1, p_max_attempts);

  IF v_current_attempts >= p_max_attempts
     OR v_expires_at <= now()
     OR v_stored_hash <> p_otp_hash THEN
    IF v_attempts >= p_max_attempts THEN
      UPDATE public.otp_verifications
         SET attempts = v_attempts,
             expires_at = now()
       WHERE id = v_otp_id;
    ELSE
      UPDATE public.otp_verifications
         SET attempts = v_attempts
       WHERE id = v_otp_id;
    END IF;
    RETURN false;
  END IF;

  UPDATE public.otp_verifications
     SET verified = true,
         attempts = v_attempts
   WHERE id = v_otp_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_otp(text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_otp(text, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.verify_otp(text, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_otp(text, text, text, integer) TO service_role;

COMMENT ON FUNCTION public.verify_otp(text, text, text, integer)
  IS 'Trusted atomic OTP verification RPC. Accepts a pre-hashed OTP, counts failed attempts, and is executable only by service_role.';

COMMIT;

-- ROLLBACK (run separately, in the order declared above):
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.verify_otp(text, text, text, integer);
-- COMMIT;
