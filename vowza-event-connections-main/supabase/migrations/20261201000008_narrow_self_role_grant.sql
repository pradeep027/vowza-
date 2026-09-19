-- ===========================================================================
-- 20261201000008  narrow_self_role_grant   [PHASE 0 / STEP 1 — A2 fix]
--
-- MOVED from supabase/migrations-pending/PHASE_C_narrow_self_role_grant.sql
-- (byte-identical policy body) as Phase 0 Step 1 preparation, per
-- VOWZA_PHASE_0_PREDEPLOY_VERIFICATION.md (GREEN) and
-- VOWZA_PHASE_0_IMPLEMENTATION_REPORT.md. NOT YET APPLIED to production.
--
-- APPLY ONLY AFTER the deployment prechecks in the implementation report:
--   1. 20261201000007_claim_provider_role.sql is applied, AND
--   2. the Vercel deploy that calls claim_provider_role() is live, AND
--   3. one real vendor registration has been completed successfully against it.
--
-- Verify (2) properly -- "the deploy finished" is not the same as "the new bundle
-- is being served". Load vowza.co.in in a fresh private window, register a test
-- vendor through to the end, and confirm a row appears in
-- vowza_audit.privileged_actions with action='claim_provider_role' and
-- outcome='applied'. That audit row is the only positive proof the new code path
-- is actually the one executing.
--
--
-- WHAT IT CHANGES
-- ---------------
-- 20261201000002's INSERT policy currently permits a self-grant of BOTH
-- 'customer' and 'provider':
--
--     WITH CHECK (role IN ('customer','provider')
--         AND (user_id = auth.uid() OR has_role(...,'admin') OR has_role(...,'super_admin')))
--
-- so any authenticated account can give itself `provider` with no
-- provider_profiles row and no audit trail. This narrows the self-grant branch
-- to `customer` only. `provider` becomes reachable two ways, both accountable:
--
--   * public.claim_provider_role()  -- self-service, but only with a profile,
--                                      and it writes an audit row (Phase A)
--   * an admin or super_admin       -- the branch retained below, used by
--                                      services/approvalService.ts and
--                                      services/adminVerification.ts
--
--
-- WHAT MUST KEEP WORKING AFTER THIS
-- ---------------------------------
--   * AuthContext.tsx seeding 'customer' for every new signup  -> self branch
--   * approvalService.ts approving a vendor ('provider' to another user) -> admin branch
--   * adminVerification.ts likewise                            -> admin branch
--   * ProviderRegistration.tsx / ArtistOnboarding.tsx           -> RPC, bypasses
--     this policy entirely because the definer function runs as owner
--
-- Note the last point: claim_provider_role() is unaffected by this policy. The
-- function owner is the table owner and there is no FORCE ROW LEVEL SECURITY on
-- user_roles, so owner-executed inserts do not consult policies at all. That is
-- what makes the RPC the sanctioned path rather than a second hole.
--
--
-- ON VERIFICATION, HONESTLY
-- -------------------------
-- The assertions below are catalog assertions: the policy exists, is PERMISSIVE
-- FOR INSERT TO authenticated, and its normalized WITH CHECK is printed in full
-- for review. They do NOT prove the behaviour, and no assertion in this file
-- could -- proving it requires two authenticated sessions with real JWTs, which
-- a migration does not have. Faking one with set_config('request.jwt.claims')
-- against a synthetic uuid was considered and rejected: user_roles.user_id
-- references a real account, so the attempt fails on the foreign key rather than
-- on the policy, and a check whose failure mode is indistinguishable from a pass
-- is worse than no check.
--
-- The behavioural proof is the two probes in the handoff, run after this lands:
--   NEGATIVE: as an ordinary logged-in user, POST /rest/v1/user_roles
--             {"user_id":"<own uuid>","role":"provider"}  -> MUST return 403.
--   POSITIVE: register a vendor end to end                -> MUST succeed, and
--             leave outcome='applied' in the audit table.
-- Do not consider this phase complete until both have been run.
-- ===========================================================================

BEGIN;

DROP POLICY IF EXISTS "user_roles_insert_unprivileged" ON public.user_roles;

CREATE POLICY "user_roles_insert_unprivileged"
    ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Self-service: customer only. This is the seeding path in
        -- AuthContext.tsx and is the least-privilege role, so it stays open.
        (
            role = 'customer'::public.app_role
            AND user_id = auth.uid()
        )
        OR
        -- Admin acting on any account, including their own. Both 'customer' and
        -- 'provider' remain grantable here; 'admin' and 'super_admin' are not
        -- reachable through this policy at all and go through
        -- public.admin_set_user_role() instead.
        (
            role IN ('customer'::public.app_role, 'provider'::public.app_role)
            AND (
                public.has_role(auth.uid(), 'admin'::public.app_role)
                OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
            )
        )
    );

COMMENT ON POLICY "user_roles_insert_unprivileged" ON public.user_roles IS
    'Self-grant is limited to the customer role. The provider role requires either public.claim_provider_role() (which demands an existing provider_profiles row and writes an audit row) or an admin/super_admin actor. Never permits admin or super_admin.';

DO $assert$
DECLARE
    v_check text;
    v_cmd   text;
    v_perm  text;
    v_roles name[];
BEGIN
    SELECT p.with_check, p.cmd, p.permissive, p.roles
      INTO v_check, v_cmd, v_perm, v_roles
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.tablename  = 'user_roles'
       AND p.policyname = 'user_roles_insert_unprivileged';

    IF v_check IS NULL THEN
        RAISE EXCEPTION 'FAILED: user_roles_insert_unprivileged does not exist after being recreated.';
    END IF;

    IF v_cmd <> 'INSERT' THEN
        RAISE EXCEPTION 'FAILED: policy applies to %, expected INSERT.', v_cmd;
    END IF;

    -- A policy with no TO clause applies to PUBLIC, which anon inherits. anon
    -- holds no INSERT privilege on this table so it could not act on it, but a
    -- PUBLIC-scoped policy here would still be wrong and is worth catching.
    IF NOT (v_roles @> ARRAY['authenticated']::name[]) THEN
        RAISE EXCEPTION 'FAILED: policy roles are %, expected to include authenticated.', v_roles;
    END IF;

    -- The admin branch must have survived the rewrite: without it, approving a
    -- vendor stops working and every admin approval starts failing.
    IF position('has_role' in v_check) = 0 THEN
        RAISE EXCEPTION 'FAILED: the admin branch is missing from the new WITH CHECK; admin approval of vendors would break.';
    END IF;

    RAISE NOTICE 'user_roles_insert_unprivileged rewritten. permissive=%, roles=%', v_perm, v_roles;
    RAISE NOTICE 'normalized WITH CHECK -> %', v_check;
    RAISE NOTICE 'Behaviour is NOT proven by this migration. Run the negative and positive probes from the handoff now.';
END;
$assert$;

COMMIT;

NOTIFY pgrst, 'reload schema';
