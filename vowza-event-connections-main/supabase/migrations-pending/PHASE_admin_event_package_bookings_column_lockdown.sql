-- PHASE_admin_event_package_bookings_column_lockdown.sql
--
-- P0-1 (BREAKING HALF, admin event-package bookings): lock down
-- public.admin_event_package_bookings so NO client-side path can set or overwrite
-- booking financial truth.
--   * REVOKE table-wide UPDATE from authenticated and GRANT UPDATE back on ONLY
--     the benign columns a browser/admin flow legitimately writes. The pricing
--     snapshot columns (package_price / discount_applied / final_price) plus the
--     identity columns become non-UPDATE-able.
--   * REVOKE INSERT from authenticated so rows can be CREATED only through the
--     create_admin_event_package_booking SECURITY DEFINER RPC (which derives the
--     whole pricing snapshot). This also RETIRES the customer-insert RLS policy's
--     reach: the RLS policy admin_event_package_bookings_customer_insert stays,
--     but with the table INSERT privilege revoked a direct client INSERT is 403.
-- After it lands, a signed-in user attempting a direct PATCH of a pricing column,
-- or a direct INSERT, gets HTTP 403 / SQLSTATE 42501. The server-derived snapshot
-- written by create_admin_event_package_booking cannot be forged or overwritten
-- from the browser.
--
-- These bookings are admin-fulfilled: there is NO vendor accept step and NO
-- provider_id column, so — unlike the 15 vendor categories — there is no
-- companion accept_* RPC to keep working, only the create RPC.
--
-- =========================== DO NOT db push YET ============================
-- PARKED OUTSIDE supabase/migrations/ ON PURPOSE. `supabase db push` ignores
-- this directory, so it cannot ship by accident. It is a BREAKING change and
-- MUST NOT be applied until BOTH of the following are live in production and
-- verified against the SERVED bundle (asset hashes and cached HTML lie):
--
--   PRECONDITION 1  The additive create RPC migration is applied in prod:
--       20261235000000_admin_event_package_booking_server_authoritative.sql
--       (create_admin_event_package_booking)
--   PRECONDITION 2  The rewired frontend is deployed and confirmed live via a
--     served-bundle grep (asset hashes and cached HTML lie):
--       * src/hooks/useEventPackages.ts (useCreateEventPackageBooking) creates via
--         supabase.rpc('create_admin_event_package_booking') — NOT a direct
--         admin_event_package_bookings INSERT carrying package_price/final_price.
--     INSERT and the snapshot columns are REVOKED here, so an OLD served bundle
--     that still direct-inserts WILL break. The creation path must be live first.
--
-- SCOPE (what this lockdown protects):
--   Every column that holds financial truth or identity is `protected` (no
--   authenticated UPDATE): package_price, discount_applied, final_price, id,
--   customer_id, package_id, created_at. INSERT is revoked outright. The whole
--   pricing snapshot is now written solely by create_admin_event_package_booking
--   (SECURITY DEFINER).
--   event_location / guest_count are DESCRIPTIVE only (never pricing inputs), and
--   these packages have NO addon and NO quantity multiplier, so there is no
--   quantity column to protect.
--   The `benign` allowlist is the lifecycle/logistics columns a browser/admin
--   flow still legitimately UPDATEs: event_date, event_location, guest_count,
--   status, payment_status, updated_at. NOTE: today only admin can UPDATE these
--   rows (there is an admin FOR ALL policy + a customer SELECT/INSERT policy, but
--   NO customer UPDATE policy), so RLS is the real gate on status/payment_status;
--   this lockdown only ensures the pricing snapshot is never client-writable.
--   payment truth (marking 'paid') is a Phase D concern, not amount authority.
--
-- ROLLBACK (emergency restore of pre-lockdown behaviour only):
--   GRANT INSERT, UPDATE ON public.admin_event_package_bookings TO authenticated;
--   NOTIFY pgrst, 'reload schema';
--   (This RE-OPENS the snapshot-tamper + forge-on-create holes; use only to
--    unblock an old served frontend.)
--
-- Requires: 20261235000000_admin_event_package_booking_server_authoritative.sql
BEGIN;

SET search_path = public, pg_temp;
-- 1) Remove the table-wide UPDATE that lets a row party PATCH any column, and
--    remove INSERT entirely so rows can be created ONLY via the
--    create_admin_event_package_booking SECURITY DEFINER RPC (which runs as the
--    table owner and is not subject to these grants). No INSERT is granted back.
REVOKE INSERT, UPDATE ON public.admin_event_package_bookings FROM PUBLIC, anon, authenticated;
-- 2) Grant UPDATE back on ONLY the benign lifecycle/logistics columns. Every
--    column NOT listed here (the three snapshot columns + the identity columns)
--    is now non-UPDATE-able by authenticated. No INSERT is granted back at all.
--    This is the column allowlist — the 6 benign columns:
GRANT UPDATE (
    event_date,
    event_location,
    guest_count,
    payment_status,
    status,
    updated_at
) ON public.admin_event_package_bookings TO authenticated;
-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Prove, against the LIVE catalog, that the intended
-- protected/benign split still describes the real table before we rely on the
-- grants above. Abort (rolling back the whole migration) on ANY drift:
--   * a protected column that does not exist,
--   * a benign column that does not exist,
--   * a live column that is in NEITHER list (an un-classified column — could be
--     a new financial field silently left writable),
--   * overlap between the two lists,
--   * authenticated still holding INSERT after the REVOKE above.
-- ===========================================================================
DO $catalog$
DECLARE
    -- 7 columns that must NOT be authenticated-writable: the three snapshot
    -- amounts plus the identity/provenance columns the create RPC sets.
    protected_cols text[] := ARRAY[
        'package_price','discount_applied','final_price',
        'id','customer_id','package_id','created_at'
    ];
    -- 6 benign lifecycle/logistics columns granted UPDATE above. event_location
    -- and guest_count are here ON PURPOSE: neither is a pricing input (these
    -- packages have no addon and no quantity multiplier — the price is the
    -- package's own snapshot). status/payment_status are admin-managed state.
    benign_cols text[] := ARRAY[
        'event_date','event_location','guest_count',
        'payment_status','status','updated_at'
    ];
    v_col      text;
    v_missing  text := '';
    v_unknown  text := '';
    v_overlap  text := '';
BEGIN
    -- (a) every protected column must exist.
    FOREACH v_col IN ARRAY protected_cols LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = 'public.admin_event_package_bookings'::regclass
               AND a.attname = v_col AND a.attnum > 0 AND NOT a.attisdropped
        ) THEN
            v_missing := v_missing || ' protected:' || v_col;
        END IF;
    END LOOP;
    -- (b) every benign column must exist.
    FOREACH v_col IN ARRAY benign_cols LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = 'public.admin_event_package_bookings'::regclass
               AND a.attname = v_col AND a.attnum > 0 AND NOT a.attisdropped
        ) THEN
            v_missing := v_missing || ' benign:' || v_col;
        END IF;
    END LOOP;
    -- (c) no live column may be un-classified (in neither list). A new column
    --     added to the table since this snapshot MUST be triaged, not defaulted
    --     open — fail closed so a new financial field is never silently writable.
    FOR v_col IN
        SELECT a.attname FROM pg_attribute a
         WHERE a.attrelid = 'public.admin_event_package_bookings'::regclass
           AND a.attnum > 0 AND NOT a.attisdropped
    LOOP
        IF NOT (v_col = ANY (protected_cols) OR v_col = ANY (benign_cols)) THEN
            v_unknown := v_unknown || ' ' || v_col;
        END IF;
    END LOOP;

    -- (d) the two lists must be disjoint.
    FOREACH v_col IN ARRAY protected_cols LOOP
        IF v_col = ANY (benign_cols) THEN
            v_overlap := v_overlap || ' ' || v_col;
        END IF;
    END LOOP;

    IF v_missing <> '' THEN
        RAISE EXCEPTION 'ABORT admin event-package lockdown: expected column(s) missing:%', v_missing;
    END IF;
    IF v_unknown <> '' THEN
        RAISE EXCEPTION 'ABORT admin event-package lockdown: un-classified live column(s) (triage before locking):%', v_unknown;
    END IF;
    IF v_overlap <> '' THEN
        RAISE EXCEPTION 'ABORT admin event-package lockdown: column(s) in BOTH protected and benign:%', v_overlap;
    END IF;

    -- (e) the REVOKE must have taken: authenticated must NOT hold INSERT.
    IF has_table_privilege('authenticated', 'public.admin_event_package_bookings', 'INSERT') THEN
        RAISE EXCEPTION 'ABORT admin event-package lockdown: authenticated still holds INSERT after REVOKE.';
    END IF;

    RAISE NOTICE 'OK: admin event-package lockdown split matches live schema (7 protected / 6 benign / 13 total), INSERT revoked.';
END $catalog$;
-- ===========================================================================
-- FAIL-CLOSED RUNTIME PROBE. Actually assume the `authenticated` role and prove
-- the grants behave: a protected snapshot PATCH is DENIED, a benign lifecycle
-- PATCH is ALLOWED, and a direct INSERT is DENIED. Privilege checks fire at
-- executor start (before any row is scanned), so a self-assignment UPDATE against
-- a ghost UUID that matches no row exercises the column privilege without reading
-- or writing data. The INSERT probe is wrapped in a subtransaction and always
-- rolled back, so nothing is ever persisted regardless of outcome.
-- ===========================================================================
DO $probe$
DECLARE
    v_ghost   uuid := '00000000-0000-0000-0000-000000000000';
    v_blocked boolean;
BEGIN
    SET LOCAL ROLE authenticated;
    -- (1) protected snapshot column: a self-assignment UPDATE must be DENIED (42501).
    v_blocked := false;
    BEGIN
        EXECUTE format(
            'UPDATE public.admin_event_package_bookings SET final_price = final_price WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RESET ROLE;
        RAISE EXCEPTION 'FAILED probe: authenticated could UPDATE protected column final_price.';
    END IF;
    -- (2) a second protected snapshot column: package_price must ALSO be DENIED.
    v_blocked := false;
    BEGIN
        EXECUTE format(
            'UPDATE public.admin_event_package_bookings SET package_price = package_price WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RESET ROLE;
        RAISE EXCEPTION 'FAILED probe: authenticated could UPDATE protected column package_price.';
    END IF;
    -- (3) benign lifecycle column: a self-assignment UPDATE must be ALLOWED.
    BEGIN
        EXECUTE format(
            'UPDATE public.admin_event_package_bookings SET status = status WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
            RAISE EXCEPTION 'FAILED probe: authenticated could NOT UPDATE benign column status.';
    END;
    -- (4) a second benign column: event_date must ALSO be ALLOWED.
    BEGIN
        EXECUTE format(
            'UPDATE public.admin_event_package_bookings SET event_date = event_date WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
            RAISE EXCEPTION 'FAILED probe: authenticated could NOT UPDATE benign column event_date.';
    END;
    -- (5) direct INSERT must be DENIED — rows may be created ONLY via the
    --     create_admin_event_package_booking SECURITY DEFINER RPC. Wrapped in a
    --     subtransaction and always rolled back so nothing is persisted even if
    --     the grant regressed.
    v_blocked := false;
    BEGIN
        BEGIN
            INSERT INTO public.admin_event_package_bookings (id) VALUES (v_ghost);
        EXCEPTION
            WHEN insufficient_privilege THEN v_blocked := true;
            WHEN OTHERS THEN
                -- Any non-privilege error (NOT NULL, FK, etc.) means the INSERT
                -- privilege check PASSED before hitting the constraint — that is a
                -- FAILURE of the lockdown. Re-raise as a probe failure.
                RESET ROLE;
                RAISE EXCEPTION 'FAILED probe: authenticated INSERT reached constraints (privilege not revoked): %', SQLERRM;
        END;
    END;
    IF NOT v_blocked THEN
        RESET ROLE;
        RAISE EXCEPTION 'FAILED probe: authenticated could INSERT into admin_event_package_bookings.';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'OK: admin event-package lockdown probe passed — protected snapshot PATCH denied, benign lifecycle PATCH allowed, direct INSERT denied.';
END $probe$;

COMMIT;

NOTIFY pgrst, 'reload schema';
