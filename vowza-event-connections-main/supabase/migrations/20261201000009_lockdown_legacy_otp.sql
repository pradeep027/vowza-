-- ===========================================================================
-- 20261201000009_lockdown_legacy_otp.sql          [PHASE 0 / STEP 2 — B1/B3-adjacent]
--
-- SCOPE (VERIFIED BEFORE WRITING — see VOWZA_PHASE_0_PREDEPLOY_VERIFICATION.md):
--   * public.otp_verifications is a legacy, DORMANT table:
--       - zero frontend references (src/ contains only generated types.ts:5296)
--       - zero Edge Function references (all 9 functions/*/index.ts swept)
--       - zero active-migration or trigger or RPC references
--       - live OTP flow uses booking_start_otps via
--         send-service-start-otp / verify-service-start-otp Edge Functions + RPCs
--   * Historical policy names on otp_verifications (10, from migrations-archive):
--       "Users insert OTP" / "Users select OTP" / "Users update OTP"
--       "Users can insert OTP verifications" / "Users can verify OTP"
--       "Users can update OTP verifications"
--       "Anyone can insert OTP verifications" / "Anyone can read OTP verifications"
--       "Anyone can update OTP verifications"
--       "Service role can manage OTP"   (FOR ALL with NO TO clause => world-permissive)
--   * Historical policies were permissive (USING/WITH CHECK (true), several
--     TO anon, authenticated). RLS was enabled (20260106173355 L70). No DELETE
--     policy ever existed. No explicit GRANT/REVOKE on this table exists in any
--     migration (baseline grant state = UNKNOWN until live export).
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
--   1. Drops EVERY known historical policy on otp_verifications (idempotent).
--   2. Creates exactly one replacement policy, TO service_role only, FOR ALL,
--      with USING/WITH CHECK (true) — the correct scope for an Edge-Function-
--      only table (service_role bypasses RLS via policy or BYPASSRLS; this
--      makes the policy shape explicit and self-documenting, matching the
--      20261201000002 pattern for user_roles_service_all).
--   3. REVOKES all table privileges from PUBLIC, anon, authenticated, then
--      GRANTs the verbs Edge Functions need to service_role only.
--      ** Defensive: revokes name every verb + PUBLIC even if the live grant
--      state is unknown. If live grants differ from the repo-tracked baseline,
--      the deploy-time grant export (precheck 3) is reconciled against this
--      file BEFORE apply — see VOWZA_PHASE_0_IMPLEMENTATION_REPORT.md §4.**
--   4. Asserts the end state via the catalog and aborts on any mismatch.
--
-- WHAT THIS MIGRATION DOES NOT DO
-- -------------------------------
--   * Does NOT drop, truncate, or alter any column of otp_verifications.
--   * Does NOT touch otp_rate_limits, otp_verifications' sibling, EXCEPT that
--     it is deliberately left untouched here — otp_rate_limits has its own
--     permissive history ("Service role can manage rate limits" FOR ALL, no TO
--     clause) and is server-only; lockdown of otp_rate_limits follows in a
--     separate review if desired. (Narrow scope per Phase 0 discipline.)
--   * Does NOT touch booking_start_otps, otp_rate_limits grants, or ANY part of
--     the live service-start OTP flow (send/verify-service-start-otp EFs, their
--     RPCs, or their policies). Verified independent of this table.
--   * Does NOT delete otp_verifications (explicit Phase 0 requirement).
--
-- ROLLBACK (forward-only safe; no data movement):
--   Re-apply the prior policy/grant set captured in the deploy notes —
--   see VOWZA_PHASE_0_IMPLEMENTATION_REPORT.md §7 Rollback.
--
-- BEHAVIORAL PROOF (like Phase C: catalog assertions ≠ behavior):
--   Post-deploy smoke:
--     a) send-service-start-otp E2E → OTP arrives, row lands in booking_start_otps
--     b) verify-service-start-otp E2E → verification succeeds
--     c) anon/authenticated SELECT on otp_verifications → 0 rows / permission denied
--     d) grep proof of no client dependency: no src/ or EF reference exists
--        (already verified pre-deploy; re-run after deploy for the record)
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Drop every known historical policy (idempotent; names verified from
--    migrations-archive sweep in the pre-deploy verification report).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users insert OTP"                     ON public.otp_verifications;
DROP POLICY IF EXISTS "Users select OTP"                     ON public.otp_verifications;
DROP POLICY IF EXISTS "Users update OTP"                     ON public.otp_verifications;
DROP POLICY IF EXISTS "Users can insert OTP verifications"   ON public.otp_verifications;
DROP POLICY IF EXISTS "Users can verify OTP"                 ON public.otp_verifications;
DROP POLICY IF EXISTS "Users can update OTP verifications"   ON public.otp_verifications;
DROP POLICY IF EXISTS "Anyone can insert OTP verifications"  ON public.otp_verifications;
DROP POLICY IF EXISTS "Anyone can read OTP verifications"    ON public.otp_verifications;
DROP POLICY IF EXISTS "Anyone can update OTP verifications"  ON public.otp_verifications;
DROP POLICY IF EXISTS "Service role can manage OTP"          ON public.otp_verifications;

-- ---------------------------------------------------------------------------
-- 2. Single replacement policy: service_role only.
-- ---------------------------------------------------------------------------
CREATE POLICY "otp_verifications_service_all"
    ON public.otp_verifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY "otp_verifications_service_all" ON public.otp_verifications IS
    'Legacy dormant table: zero application/Edge-Function references (verified 2026-09 Phase 0). Access restricted to service_role only. Do not grant to anon/authenticated. See 20261201000009.';

-- ---------------------------------------------------------------------------
-- 3. Grants: revoke everything from client-reachable roles, grant Edge-Function
--    verbs to service_role only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.otp_verifications FROM PUBLIC, anon, authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON TABLE public.otp_verifications TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Catalog assertions — abort the migration if the end state is wrong.
-- ---------------------------------------------------------------------------
DO $assert$
DECLARE
    v_policies      int;
    v_wrong_scope   int;
    v_grants        text;
BEGIN
    -- Exactly one policy must remain, scoped to service_role only.
    SELECT count(*) INTO v_policies
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'otp_verifications';

    IF v_policies <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 policy on otp_verifications, found %.', v_policies;
    END IF;

    SELECT count(*) INTO v_wrong_scope
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'otp_verifications'
       AND (policyname <> 'otp_verifications_service_all'
            OR roles::text NOT LIKE '%service_role%');

    IF v_wrong_scope <> 0 THEN
        RAISE EXCEPTION 'FAILED: remaining otp_verifications policy is not service_role-scoped.';
    END IF;

    -- information_schema grant check: no privilege for anon/authenticated.
    SELECT string_agg(grantee || ':' || privilege_type, ', ') INTO v_grants
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name   = 'otp_verifications'
       AND grantee IN ('anon', 'authenticated', 'PUBLIC');

    IF v_grants IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: client-reachable grants remain on otp_verifications: %.', v_grants;
    END IF;

    RAISE NOTICE 'otp_verifications locked down: 1 service_role policy, zero client grants.';
END;
$assert$;

COMMIT;

NOTIFY pgrst, 'reload schema';
