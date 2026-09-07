-- 20261201000003_audit_schema.sql
--
-- Creates the audit destination for privileged actions, in a schema PostgREST
-- does not serve.
--
-- ---------------------------------------------------------------------------
-- WHY NOT public.audit_log
-- ---------------------------------------------------------------------------
-- From the baseline, lines 17061-17063:
--     GRANT ALL ON TABLE "public"."audit_log" TO "anon";
--     GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
-- ALL includes INSERT and DELETE. So today any anonymous caller can forge
-- audit rows and delete real ones. An audit record the audited party can
-- delete is not evidence of anything, and PR #13's verification Edge Function
-- currently writes there.
--
-- This table takes the opposite approach: it grants NOTHING to any role. It is
-- reachable only through SECURITY DEFINER functions in public, which are owned
-- by postgres and therefore bypass both the missing grants and RLS. The
-- attack surface is the EXECUTE grant on those functions, which is one thing
-- to guard instead of four verbs on a PostgREST-exposed table.
--
-- ---------------------------------------------------------------------------
-- WHY A SEPARATE SCHEMA AND NOT JUST A REVOKE
-- ---------------------------------------------------------------------------
-- pg_default_acl carries 24 rows whose grantors (postgres, supabase_admin)
-- give anon "arwdDxtm" on future relations. A table created in public is born
-- world-writable and stays that way until someone remembers to revoke. A
-- table outside public, in a schema anon holds no USAGE on, is not exposed by
-- PostgREST at all -- so a forgotten revoke is not a breach.
--
-- The explicit REVOKEs below are still issued, because a default ACL entry
-- with defaclnamespace = 0 applies to every schema, and this migration should
-- not depend on my reading of which of the 24 rows are schema-scoped.
--
-- Do NOT add vowza_audit to the project's Exposed Schemas setting
-- (Dashboard > Settings > API). That setting is the only thing standing
-- between this table and the internet.
-- ---------------------------------------------------------------------------

BEGIN;

CREATE SCHEMA IF NOT EXISTS vowza_audit;

REVOKE ALL ON SCHEMA vowza_audit FROM PUBLIC;
REVOKE ALL ON SCHEMA vowza_audit FROM anon, authenticated;

COMMENT ON SCHEMA vowza_audit IS
    'Append-only audit records. Not exposed through PostgREST. No role holds any privilege here; writes and reads go through SECURITY DEFINER functions in public.';

-- ===========================================================================
-- The audit table.
--
-- No foreign keys to auth.users, deliberately. ON DELETE CASCADE would erase
-- the record of what someone did when their account is deleted, and SET NULL
-- would erase who did it. Audit provenance has to outlive the actor, so the
-- uuids are stored unconstrained and the email is denormalised alongside them
-- so the row stays readable after the account is gone.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS vowza_audit.privileged_actions (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at     timestamptz NOT NULL DEFAULT now(),

    actor_id        uuid,
    actor_email     text,

    action          text        NOT NULL,
    outcome         text        NOT NULL,

    target_user_id  uuid,
    target_email    text,
    subject_role    public.app_role,

    detail          jsonb       NOT NULL DEFAULT '{}'::jsonb,
    source          text,

    CONSTRAINT privileged_actions_outcome_check
        CHECK (outcome IN ('applied','denied','noop','failed'))
);

COMMENT ON TABLE vowza_audit.privileged_actions IS
    'One row per attempted privileged action, including attempts that were denied. Append-only, enforced by trigger.';
COMMENT ON COLUMN vowza_audit.privileged_actions.actor_id IS
    'Verified JWT subject of the caller. Never a client-supplied value.';
COMMENT ON COLUMN vowza_audit.privileged_actions.outcome IS
    'applied = state changed. denied = authorization refused. noop = authorized but nothing to change. failed = error after authorization.';

CREATE INDEX IF NOT EXISTS privileged_actions_occurred_at_idx
    ON vowza_audit.privileged_actions (occurred_at DESC);
CREATE INDEX IF NOT EXISTS privileged_actions_target_idx
    ON vowza_audit.privileged_actions (target_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS privileged_actions_actor_idx
    ON vowza_audit.privileged_actions (actor_id, occurred_at DESC);

-- ===========================================================================
-- Append-only, enforced rather than assumed.
--
-- Zero grants already stop client roles. This trigger additionally stops the
-- SECURITY DEFINER functions -- which run as postgres and would otherwise be
-- able to rewrite history -- from doing anything but INSERT. Removing an audit
-- trail now requires DDL, which is itself conspicuous.
-- ===========================================================================
CREATE OR REPLACE FUNCTION vowza_audit.reject_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, pg_temp
    AS $$
BEGIN
    RAISE EXCEPTION
        'vowza_audit.% is append-only; % is not permitted',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS privileged_actions_append_only
    ON vowza_audit.privileged_actions;
CREATE TRIGGER privileged_actions_append_only
    BEFORE UPDATE OR DELETE ON vowza_audit.privileged_actions
    FOR EACH ROW EXECUTE FUNCTION vowza_audit.reject_mutation();

-- TRUNCATE bypasses row triggers, so it gets its own statement-level trigger.
DROP TRIGGER IF EXISTS privileged_actions_no_truncate
    ON vowza_audit.privileged_actions;
CREATE TRIGGER privileged_actions_no_truncate
    BEFORE TRUNCATE ON vowza_audit.privileged_actions
    FOR EACH STATEMENT EXECUTE FUNCTION vowza_audit.reject_mutation();

-- ===========================================================================
-- Belt and braces against pg_default_acl. If any of the 24 default ACL rows
-- is not schema-scoped, the table was born anon=arwdDxtm regardless of which
-- schema it lives in.
-- ===========================================================================
REVOKE ALL ON ALL TABLES    IN SCHEMA vowza_audit FROM PUBLIC;
REVOKE ALL ON ALL TABLES    IN SCHEMA vowza_audit FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA vowza_audit FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA vowza_audit FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA vowza_audit FROM PUBLIC;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA vowza_audit FROM anon, authenticated;

-- And for anything added to this schema later.
ALTER DEFAULT PRIVILEGES IN SCHEMA vowza_audit
    REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA vowza_audit
    REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA vowza_audit
    REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA vowza_audit
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ===========================================================================
-- Verification. Fails the migration if the audit table is reachable by a
-- client role, or if append-only did not take.
-- ===========================================================================
DO $$
DECLARE
    leaked   text;
    trg      int;
    appended bigint;
BEGIN
    SELECT string_agg(r || ':' || p, ', ' ORDER BY r, p)
      INTO leaked
      FROM unnest(ARRAY['anon','authenticated'])                              AS r,
           unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])      AS p
     WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r)
       AND has_table_privilege(r, 'vowza_audit.privileged_actions', p);

    IF leaked IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: audit table is reachable by %', leaked;
    END IF;

    IF EXISTS (
        SELECT 1 FROM unnest(ARRAY['anon','authenticated']) AS r
         WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r)
           AND has_schema_privilege(r, 'vowza_audit', 'USAGE')
    ) THEN
        RAISE EXCEPTION 'FAILED: a client role holds USAGE on schema vowza_audit';
    END IF;

    SELECT count(*) INTO trg
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'vowza_audit' AND c.relname = 'privileged_actions'
       AND NOT t.tgisinternal;

    IF trg < 2 THEN
        RAISE EXCEPTION 'FAILED: append-only triggers missing (found %)', trg;
    END IF;

    -- Prove append-only actually rejects, rather than trusting that the
    -- trigger exists. Insert, try to delete, expect the exception, then roll
    -- the probe back so no synthetic row survives.
    BEGIN
        INSERT INTO vowza_audit.privileged_actions (action, outcome, detail, source)
        VALUES ('audit.self_test', 'noop', '{"probe":true}'::jsonb, 'migration:20261201000003')
        RETURNING id INTO appended;

        BEGIN
            DELETE FROM vowza_audit.privileged_actions WHERE id = appended;
            RAISE EXCEPTION 'FAILED: DELETE on the audit table succeeded; it is not append-only';
        EXCEPTION
            WHEN insufficient_privilege THEN
                NULL;  -- expected
        END;

        RAISE EXCEPTION 'rollback_probe';
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
    END;

    RAISE NOTICE 'OK: vowza_audit.privileged_actions is unreachable by client roles and append-only.';
END $$;

COMMIT;
