-- 20261244000000_provider_verification_column_guard.sql
--
-- P0 Phase F (document / identity verification integrity) -- SECURITY FIX.
--
-- THE HOLE (still open at the DB layer): the admin approval + vendor resubmit
-- flows were correctly rewired to the SECURITY DEFINER RPCs
-- admin_set_provider_verification / provider_resubmit_for_review in
-- 20261204000000, but the privilege REMOVAL that actually blocks a direct
-- PostgREST PATCH of the trust columns lives in
-- supabase/migrations-pending/PHASE_provider_column_lockdown.sql and is PARKED
-- (breaking: it REVOKEs table-wide UPDATE, so it may ship only after the rewired
-- frontend is live + verified). Until it lands, a signed-in vendor can bypass
-- the frontend entirely and PATCH their OWN provider_profiles row setting
-- verification_status='approved', is_verified=true, is_published=true,
-- is_featured=true, the KYC/liveness columns, or the reputation counters -- the
-- owner RLS UPDATE policy + the table-wide UPDATE grant permit it, and the only
-- applied BEFORE UPDATE trigger (provider_profiles_bank_reverify) guards bank
-- columns only. Provider self-approval / self-verification is therefore LIVE.
--
-- THE FIX (ADDITIVE, safe to apply any time, before or after the frontend):
-- add a BEFORE UPDATE row trigger provider_profiles_guard_trust_columns that
-- REJECTS (42501) any change to the verification / approval / featured / KYC /
-- liveness / reputation columns UNLESS it comes from an authorized path:
--   * a trusted non-session context (auth.uid() IS NULL -- service_role, the
--     legacy approve_artist/reject_artist definers, internal jobs);
--   * an admin or super_admin (public.has_role(auth.uid(), ...)) -- the
--     admin_set_provider_verification path, whose auth.uid() is preserved under
--     SECURITY DEFINER;
--   * the exact constrained owner resubmit transition rejected -> pending with
--     no other guarded column changing -- the provider_resubmit_for_review path.
-- A change to a non-guarded column (bio, pricing, gallery, bank_* ...) is never
-- touched, so legitimate profile edits are unaffected. The bank-reverify
-- downgrade of is_bank_verified to false is allowed (only ->true is guarded).
--
-- RELATION TO THE PARKED LOCKDOWN: this trigger is a complementary, NON-breaking
-- mitigation that closes the escalation hole now; it does NOT supersede
-- PHASE_provider_column_lockdown.sql, which remains the comprehensive
-- column-privilege fix (it also locks id / user_id / created_at / profession /
-- rejection_reason and denies at the privilege layer before a row is scanned)
-- and stays PARKED until its deploy preconditions are met.
--
-- CLASSIFICATION: SECURITY FIX (closes a live provider self-approval /
--   self-verification privilege escalation). ADDITIVE -- adds one trigger +
--   function; revokes nothing; changes no legitimate behaviour.
--
-- ROLLBACK:
--   DROP TRIGGER provider_profiles_guard_trust_columns ON public.provider_profiles;
--   DROP FUNCTION public.provider_profiles_guard_trust_columns();
--   NOTIFY pgrst, 'reload schema';
BEGIN;

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- Fail-closed schema drift guard: refuse to apply if the role-check function or
-- any guarded column has been renamed/removed since this was written, so a
-- silent schema drift surfaces here at APPLY time rather than as a trigger that
-- compiles but no longer guards the column it names.
-- ---------------------------------------------------------------------------
DO $catalog$
DECLARE
  v_col  text;
  v_cols text[] := ARRAY[
    'verification_status','is_verified','is_published','is_featured',
    'featured_until','verified_at','verified_by','is_bank_verified',
    'aadhaar_status','aadhaar_verified_at','pan_status','pan_verified_at',
    'govt_id_status','govt_id_verified_at','liveness_verified',
    'liveness_verified_at','liveness_session_id','liveness_provider',
    'liveness_attempts','doc_verification_notes','average_rating',
    'total_reviews','total_bookings'
  ];
BEGIN
  IF to_regclass('public.provider_profiles') IS NULL THEN
    RAISE EXCEPTION 'ABORT provider_verification_column_guard: public.provider_profiles missing';
  END IF;

  FOREACH v_col IN ARRAY v_cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.provider_profiles'::regclass
        AND attname = v_col AND attnum > 0 AND NOT attisdropped
    ) THEN
      RAISE EXCEPTION 'ABORT provider_verification_column_guard: guarded column provider_profiles.% not found', v_col;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  ) THEN
    RAISE EXCEPTION 'ABORT provider_verification_column_guard: public.has_role() not found';
  END IF;
END
$catalog$;
-- ---------------------------------------------------------------------------
-- Trust-column guard. Fires BEFORE UPDATE on every provider_profiles row. Named
-- so it sorts AFTER provider_profiles_bank_reverify (b < g): multiple BEFORE-ROW
-- triggers run alphabetically, so by the time this runs any bank-reverify reset
-- of is_bank_verified -> false has already been applied to NEW and is allowed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provider_profiles_guard_trust_columns()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    -- Fast path: if no GUARDED column changed, this is an ordinary profile edit
    -- (bio, pricing, gallery, social links, bank_* ...) -- never touched.
    -- is_bank_verified is only guarded on the ->true edge; a ->false downgrade
    -- (self or via provider_profiles_bank_reverify) is always permitted.
    IF  NEW.verification_status   IS NOT DISTINCT FROM OLD.verification_status
    AND NEW.is_verified           IS NOT DISTINCT FROM OLD.is_verified
    AND NEW.is_published          IS NOT DISTINCT FROM OLD.is_published
    AND NEW.is_featured           IS NOT DISTINCT FROM OLD.is_featured
    AND NEW.featured_until        IS NOT DISTINCT FROM OLD.featured_until
    AND NEW.verified_at           IS NOT DISTINCT FROM OLD.verified_at
    AND NEW.verified_by           IS NOT DISTINCT FROM OLD.verified_by
    AND NEW.aadhaar_status        IS NOT DISTINCT FROM OLD.aadhaar_status
    AND NEW.aadhaar_verified_at   IS NOT DISTINCT FROM OLD.aadhaar_verified_at
    AND NEW.pan_status            IS NOT DISTINCT FROM OLD.pan_status
    AND NEW.pan_verified_at       IS NOT DISTINCT FROM OLD.pan_verified_at
    AND NEW.govt_id_status        IS NOT DISTINCT FROM OLD.govt_id_status
    AND NEW.govt_id_verified_at   IS NOT DISTINCT FROM OLD.govt_id_verified_at
    AND NEW.liveness_verified     IS NOT DISTINCT FROM OLD.liveness_verified
    AND NEW.liveness_verified_at  IS NOT DISTINCT FROM OLD.liveness_verified_at
    AND NEW.liveness_session_id   IS NOT DISTINCT FROM OLD.liveness_session_id
    AND NEW.liveness_provider     IS NOT DISTINCT FROM OLD.liveness_provider
    AND NEW.liveness_attempts     IS NOT DISTINCT FROM OLD.liveness_attempts
    AND NEW.doc_verification_notes IS NOT DISTINCT FROM OLD.doc_verification_notes
    AND NEW.average_rating        IS NOT DISTINCT FROM OLD.average_rating
    AND NEW.total_reviews         IS NOT DISTINCT FROM OLD.total_reviews
    AND NEW.total_bookings        IS NOT DISTINCT FROM OLD.total_bookings
    AND NOT (NEW.is_bank_verified IS DISTINCT FROM OLD.is_bank_verified
             AND COALESCE(NEW.is_bank_verified, false) = true)
    THEN
        RETURN NEW;
    END IF;
    -- A guarded column IS changing. Decide whether the caller is authorized.

    -- (1) Trusted non-session context: service_role, the legacy
    -- approve_artist/reject_artist SECURITY DEFINER writers, and internal jobs
    -- carry no JWT, so auth.uid() IS NULL. PostgREST's `authenticated` role
    -- always carries a sub claim (non-null uid) and `anon` has no UPDATE grant,
    -- so a NULL uid here is never a signed-in end user.
    IF v_uid IS NULL THEN
        RETURN NEW;
    END IF;

    -- (2) Admin / super_admin: the admin_set_provider_verification path. Under
    -- SECURITY DEFINER the executing role becomes the owner but auth.uid() still
    -- returns the real admin caller, so this check holds inside that RPC.
    IF public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin') THEN
        RETURN NEW;
    END IF;

    -- (3) Owner resubmit, EXACTLY rejected -> pending with no other guarded
    -- column changing -- the provider_resubmit_for_review path. Any broader
    -- change (e.g. straight to 'approved', or flipping is_verified) falls
    -- through to the rejection below.
    IF OLD.verification_status = 'rejected'
       AND NEW.verification_status = 'pending'
       AND NEW.is_verified           IS NOT DISTINCT FROM OLD.is_verified
       AND NEW.is_published          IS NOT DISTINCT FROM OLD.is_published
       AND NEW.is_featured           IS NOT DISTINCT FROM OLD.is_featured
       AND NEW.featured_until        IS NOT DISTINCT FROM OLD.featured_until
       AND NEW.verified_at           IS NOT DISTINCT FROM OLD.verified_at
       AND NEW.verified_by           IS NOT DISTINCT FROM OLD.verified_by
       AND NEW.is_bank_verified      IS NOT DISTINCT FROM OLD.is_bank_verified
       AND NEW.aadhaar_status        IS NOT DISTINCT FROM OLD.aadhaar_status
       AND NEW.aadhaar_verified_at   IS NOT DISTINCT FROM OLD.aadhaar_verified_at
       AND NEW.pan_status            IS NOT DISTINCT FROM OLD.pan_status
       AND NEW.pan_verified_at       IS NOT DISTINCT FROM OLD.pan_verified_at
       AND NEW.govt_id_status        IS NOT DISTINCT FROM OLD.govt_id_status
       AND NEW.govt_id_verified_at   IS NOT DISTINCT FROM OLD.govt_id_verified_at
       AND NEW.liveness_verified     IS NOT DISTINCT FROM OLD.liveness_verified
       AND NEW.liveness_verified_at  IS NOT DISTINCT FROM OLD.liveness_verified_at
       AND NEW.liveness_session_id   IS NOT DISTINCT FROM OLD.liveness_session_id
       AND NEW.liveness_provider     IS NOT DISTINCT FROM OLD.liveness_provider
       AND NEW.liveness_attempts     IS NOT DISTINCT FROM OLD.liveness_attempts
       AND NEW.doc_verification_notes IS NOT DISTINCT FROM OLD.doc_verification_notes
       AND NEW.average_rating        IS NOT DISTINCT FROM OLD.average_rating
       AND NEW.total_reviews         IS NOT DISTINCT FROM OLD.total_reviews
       AND NEW.total_bookings        IS NOT DISTINCT FROM OLD.total_bookings
    THEN
        RETURN NEW;
    END IF;
    -- Anything else: a signed-in non-admin trying to change a verification /
    -- approval / featured / KYC / liveness / reputation column directly.
    RAISE EXCEPTION 'provider_profiles verification, approval, featured, KYC and reputation columns are not directly writable; use admin_set_provider_verification / provider_resubmit_for_review'
        USING ERRCODE = '42501';
END;
$fn$;

DROP TRIGGER IF EXISTS provider_profiles_guard_trust_columns ON public.provider_profiles;
CREATE TRIGGER provider_profiles_guard_trust_columns
    BEFORE UPDATE ON public.provider_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.provider_profiles_guard_trust_columns();

-- ---------------------------------------------------------------------------
-- Self-check: the trigger exists, is BEFORE UPDATE FOR EACH ROW, and its
-- function is present. Fail the migration (roll back) otherwise.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_tg pg_trigger%ROWTYPE;
BEGIN
  SELECT * INTO v_tg
  FROM pg_trigger
  WHERE tgrelid = 'public.provider_profiles'::regclass
    AND tgname = 'provider_profiles_guard_trust_columns'
    AND NOT tgisinternal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFY provider_verification_column_guard: trigger not installed';
  END IF;

  -- tgtype bit 0 (value 2) = BEFORE; bit 2 (value 16) = ROW-level.
  IF (v_tg.tgtype & 2) = 0 OR (v_tg.tgtype & 16) = 0 THEN
    RAISE EXCEPTION 'VERIFY provider_verification_column_guard: trigger is not BEFORE ... FOR EACH ROW';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'provider_profiles_guard_trust_columns'
  ) THEN
    RAISE EXCEPTION 'VERIFY provider_verification_column_guard: guard function missing';
  END IF;
END
$verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';




