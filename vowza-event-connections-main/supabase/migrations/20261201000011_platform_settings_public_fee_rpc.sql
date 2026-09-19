-- ===========================================================================
-- 20261201000011_platform_settings_public_fee_rpc.sql   [PHASE 0b / STAGE 1]
--
-- PURPOSE
--   Give the browser a controlled, key-fixed way to read the one public
--   setting the application needs (platform_fee) WITHOUT exposing the
--   platform_settings table. The broad anon table policy is intentionally
--   LEFT IN PLACE in this stage; it is removed by Stage 2
--   (20261201000012) only after the application consumer is switched and
--   verified. Never combine the two stages in one deploy.
--
-- SCOPE
--   * Adds exactly one function. Touches no policy, no grant on tables, no data.
--   * The function hardcodes the key 'platform_fee'. There is no parameter,
--     no dynamic key lookup, no way to read any other row of platform_settings
--     through it.
--
-- CONSUMER
--   src/hooks/usePlatformFee.ts (switched in this same stage, before Stage 2).
--   Shape preserved: {"type":"percentage"|"fixed","rate":number,"enabled":boolean}
--   (live production value verified 2026-09-18: {"type":"percentage","rate":5,"enabled":true})
--
-- SECURITY
--   * SECURITY DEFINER so it reads platform_settings regardless of the caller's
--     grants/policies (needed once Stage 2 removes anon table reads).
--   * search_path pinned to public, pg_temp so the definer body cannot be
--     redirected by temp-schema shadowing.
--   * EXECUTE granted to PUBLIC (PostgREST anon + authenticated); nothing else
--     is exposed by a function that returns a single whitelisted value.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.get_public_platform_fee();
--   NOTIFY pgrst, 'reload schema';
--   (The hook keeps its DEFAULT_FEE fallback, so dropping the function degrades
--   the fee display to the 5% default rather than breaking checkout.)
-- ===========================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_platform_fee()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT value
    FROM public.platform_settings
    WHERE key = 'platform_fee'
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_public_platform_fee() IS
    'Phase 0b Stage 1: public read of the single whitelisted platform setting (platform_fee). Key is hardcoded; no parameter, no arbitrary key lookup. See 20261201000011.';

-- Explicit grant model: nothing is implicit. Revoke everything, then grant
-- EXECUTE to PUBLIC (covers anon + authenticated; service_role via PUBLIC too).
REVOKE ALL ON FUNCTION public.get_public_platform_fee() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_fee() TO PUBLIC;

-- ---------------------------------------------------------------------------
-- Assertions: abort the migration if the function is not exactly as designed.
-- ---------------------------------------------------------------------------
DO $assert$
DECLARE
    v_definer  boolean;
    v_conf     text;
    v_anon_exec boolean;
BEGIN
    SELECT prosecdef, array_to_string(coalesce(proconfig, '{}'), ',')
      INTO v_definer, v_conf
      FROM pg_proc
     WHERE oid = 'public.get_public_platform_fee()'::regprocedure;

    IF v_definer IS NULL THEN
        RAISE EXCEPTION 'FAILED: get_public_platform_fee() was not created.';
    END IF;

    IF v_definer <> true THEN
        RAISE EXCEPTION 'FAILED: get_public_platform_fee() is not SECURITY DEFINER.';
    END IF;

    IF v_conf NOT LIKE '%search_path%' THEN
        RAISE EXCEPTION 'FAILED: get_public_platform_fee() search_path is not pinned (proconfig=%).', v_conf;
    END IF;

    SELECT has_function_privilege('anon', 'public.get_public_platform_fee()', 'EXECUTE')
      INTO v_anon_exec;

    IF v_anon_exec <> true THEN
        RAISE EXCEPTION 'FAILED: anon cannot EXECUTE get_public_platform_fee().';
    END IF;

    RAISE NOTICE 'get_public_platform_fee() installed: SECURITY DEFINER, pinned search_path, anon-executable.';
END;
$assert$;

COMMIT;

NOTIFY pgrst, 'reload schema';
