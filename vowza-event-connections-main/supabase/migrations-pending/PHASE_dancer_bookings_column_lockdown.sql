-- PHASE_dancer_bookings_column_lockdown.sql
--
-- P0-1 (BREAKING HALF, dancer category): lock down public.dancer_bookings so NO
-- client-side path can set or overwrite booking financial truth.
--   * REVOKE table-wide UPDATE from authenticated and GRANT UPDATE back on ONLY
--     the benign columns a browser flow legitimately writes. All FIVE amount
--     columns (base_amount / addons_amount / total_amount / advance_amount /
--     remaining_amount) plus the identity columns become non-UPDATE-able.
--   * REVOKE INSERT from authenticated so rows can be CREATED only through the
--     create_dancer_booking SECURITY DEFINER RPC (which derives every amount).
-- After it lands, a signed-in user (customer OR vendor) attempting a direct
-- PATCH of an amount column, or a direct INSERT, gets HTTP 403 / SQLSTATE 42501.
-- The server-derived financials written by create_dancer_booking and set by
-- accept_dancer_booking cannot be forged or overwritten from the browser.
--
-- =========================== DO NOT db push YET ============================
-- PARKED OUTSIDE supabase/migrations/ ON PURPOSE. `supabase db push` ignores
-- this directory, so it cannot ship by accident. It is a BREAKING change and
-- MUST NOT be applied until BOTH of the following are live in production and
-- verified against the SERVED bundle (asset hashes and cached HTML lie):
--
--   PRECONDITION 1  Both additive RPC migrations are applied in prod:
--       20261213000000_dancer_booking_server_authoritative.sql  (create_dancer_booking)
--       20261214000000_dancer_booking_accept_authoritative.sql  (accept_dancer_booking)
--   PRECONDITION 2  The rewired frontend is deployed and confirmed live via a
--     served-bundle grep (asset hashes and cached HTML lie):
--       * src/components/DancerMenu.tsx creates via
--         supabase.rpc('create_dancer_booking') — NOT a direct dancer_bookings INSERT.
--       * src/pages/Checkout.tsx routes dancer cart items through
--         supabase.rpc('create_dancer_booking') — NOT the generic amount-carrying INSERT.
--       * src/pages/vendor/VendorBookings.tsx accepts dancer via
--         supabase.rpc('accept_dancer_booking') — NO client advance/remaining PATCH.
--     INSERT and the amount columns are REVOKED here, so an OLD served bundle
--     that still direct-inserts or PATCHes amounts WILL break. Both the creation
--     path AND the accept path must be live first.
--
-- SCOPE (what this lockdown protects):
--   Every column that holds financial truth or identity is `protected` (no
--   authenticated UPDATE): base_amount, addons_amount, total_amount,
--   advance_amount, remaining_amount, id, customer_id, provider_id, package_id,
--   created_at, selected_addon_ids. INSERT is revoked outright. All amounts are
--   now written solely by create_dancer_booking (creation) and
--   accept_dancer_booking (accept), both SECURITY DEFINER.
--   NOTE ON number_of_dancers / dance_type / performance_duration /
--   special_requirements: unlike catering's guest_count, NONE is a pricing
--   multiplier — the dancer total is package_price + addons regardless of them
--   (see DancerMenu.tsx and create_dancer_booking). They are therefore benign
--   descriptive columns, left browser-writable.
--   The `benign` allowlist is the lifecycle/logistics columns a browser flow
--   still legitimately UPDATEs (status transitions, timestamps, venue/city,
--   event_time, event_type, settlement_status, calendar_locked).
--   advance_paid_at / confirmed_at / status stay writable so the customer
--   pay-advance flow and the vendor decline/cancel flow keep working without
--   amount authority.
--
-- ROLLBACK (emergency restore of pre-lockdown behaviour only):
--   GRANT INSERT, UPDATE ON public.dancer_bookings TO authenticated;
--   NOTIFY pgrst, 'reload schema';
--   (This RE-OPENS the amount-tamper + forge-on-create holes; use only to
--    unblock an old served frontend.)
--
-- Requires: 20261213000000_dancer_booking_server_authoritative.sql
--       and: 20261214000000_dancer_booking_accept_authoritative.sql

BEGIN;

SET search_path = public, pg_temp;

-- 1) Remove the table-wide UPDATE that lets a row party PATCH any column, and
--    remove INSERT entirely so rows can be created ONLY via the
--    create_dancer_booking SECURITY DEFINER RPC (which runs as the table owner
--    and is not subject to these grants). No INSERT is granted back.
REVOKE INSERT, UPDATE ON public.dancer_bookings FROM PUBLIC, anon, authenticated;

-- 2) Grant UPDATE back on ONLY the benign lifecycle/logistics columns a browser
--    flow legitimately writes. Every column NOT listed here (all five amounts +
--    the identity columns) is now non-UPDATE-able by authenticated. No INSERT is
--    granted back at all. This is the column allowlist — the 21 benign columns:
GRANT UPDATE (
    accepted_at,
    advance_paid_at,
    calendar_locked,
    city,
    confirmed_at,
    dance_type,
    event_date,
    event_time,
    event_type,
    expired_at,
    number_of_dancers,
    otp_verified_at,
    payment_deadline,
    performance_duration,
    settlement_status,
    special_requirements,
    start_requested_at,
    status,
    venue,
    work_completed_at,
    work_started_at
) ON public.dancer_bookings TO authenticated;
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
    -- 11 columns that must NOT be authenticated-writable: the five amounts plus
    -- the identity/provenance columns create_dancer_booking sets authoritatively.
    protected_cols text[] := ARRAY[
        'base_amount','addons_amount','total_amount','advance_amount','remaining_amount',
        'id','customer_id','provider_id','package_id','created_at','selected_addon_ids'
    ];
    -- 21 benign lifecycle/logistics columns granted UPDATE above. dance_type,
    -- number_of_dancers, performance_duration and special_requirements are here
    -- ON PURPOSE: unlike catering's guest_count none is a pricing input.
    benign_cols text[] := ARRAY[
        'accepted_at','advance_paid_at','calendar_locked','city','confirmed_at',
        'dance_type','event_date','event_time','event_type','expired_at',
        'number_of_dancers','otp_verified_at','payment_deadline','performance_duration',
        'settlement_status','special_requirements','start_requested_at','status',
        'venue','work_completed_at','work_started_at'
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
             WHERE a.attrelid = 'public.dancer_bookings'::regclass
               AND a.attname = v_col AND a.attnum > 0 AND NOT a.attisdropped
        ) THEN
            v_missing := v_missing || ' protected:' || v_col;
        END IF;
    END LOOP;

    -- (b) every benign column must exist.
    FOREACH v_col IN ARRAY benign_cols LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = 'public.dancer_bookings'::regclass
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
         WHERE a.attrelid = 'public.dancer_bookings'::regclass
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
        RAISE EXCEPTION 'ABORT dancer lockdown: expected column(s) missing:%', v_missing;
    END IF;
    IF v_unknown <> '' THEN
        RAISE EXCEPTION 'ABORT dancer lockdown: un-classified live column(s) (triage before locking):%', v_unknown;
    END IF;
    IF v_overlap <> '' THEN
        RAISE EXCEPTION 'ABORT dancer lockdown: column(s) in BOTH protected and benign:%', v_overlap;
    END IF;

    -- (e) the REVOKE must have taken: authenticated must NOT hold INSERT, and
    --     must NOT hold a table-wide UPDATE (column grants are checked in $probe$).
    IF has_table_privilege('authenticated', 'public.dancer_bookings', 'INSERT') THEN
        RAISE EXCEPTION 'ABORT dancer lockdown: authenticated still holds INSERT after REVOKE.';
    END IF;

    RAISE NOTICE 'OK: dancer lockdown split matches live schema (11 protected / 21 benign / 32 total), INSERT revoked.';
END $catalog$;
-- ===========================================================================
-- FAIL-CLOSED RUNTIME PROBE. Actually assume the `authenticated` role and prove
-- the grants behave: a protected amount PATCH is DENIED, a benign lifecycle PATCH
-- is ALLOWED, and a direct INSERT is DENIED. Privilege checks fire at executor
-- start (before any row is scanned), so a self-assignment UPDATE against a ghost
-- UUID that matches no row exercises the column privilege without reading or
-- writing data. The INSERT probe is wrapped in a savepoint and always rolled
-- back, so nothing is ever persisted regardless of outcome.
-- ===========================================================================
DO $probe$
DECLARE
    -- A UUID that matches no dancer_bookings row: isolates the privilege
    -- decision from RLS/data. UPDATEs touch zero rows; the INSERT is rolled back.
    v_ghost   uuid := '00000000-0000-0000-0000-000000000000';
    v_blocked boolean;
BEGIN
    SET LOCAL ROLE authenticated;

    -- (1) protected amount column: a self-assignment UPDATE must be DENIED (42501).
    v_blocked := false;
    BEGIN
        EXECUTE format(
            'UPDATE public.dancer_bookings SET total_amount = total_amount WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RESET ROLE;
        RAISE EXCEPTION 'FAILED probe: authenticated could UPDATE protected column total_amount.';
    END IF;

    -- (1b) a second protected amount column, for good measure: advance_amount.
    v_blocked := false;
    BEGIN
        EXECUTE format(
            'UPDATE public.dancer_bookings SET advance_amount = advance_amount WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RESET ROLE;
        RAISE EXCEPTION 'FAILED probe: authenticated could UPDATE protected column advance_amount.';
    END IF;
    -- (2) benign lifecycle column: a self-assignment UPDATE must be ALLOWED.
    --     If the grant is wrong this raises insufficient_privilege and we fail.
    BEGIN
        EXECUTE format(
            'UPDATE public.dancer_bookings SET status = status WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
            RAISE EXCEPTION 'FAILED probe: authenticated could NOT UPDATE benign column status (grant missing).';
    END;

    -- (2b) benign calendar_locked must likewise be ALLOWED (vendor decline/cancel).
    BEGIN
        EXECUTE format(
            'UPDATE public.dancer_bookings SET calendar_locked = calendar_locked WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
            RAISE EXCEPTION 'FAILED probe: authenticated could NOT UPDATE benign column calendar_locked (grant missing).';
    END;

    -- (3) direct INSERT must be DENIED — creation is forced through the RPC.
    --     Wrapped in a savepoint and always rolled back so nothing persists.
    v_blocked := false;
    BEGIN
        EXECUTE 'INSERT INTO public.dancer_bookings (status) VALUES (''pending'')';
        -- Should be unreachable; if it somehow inserted, undo it below.
    EXCEPTION
        WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RESET ROLE;
        RAISE EXCEPTION 'FAILED probe: authenticated could INSERT into dancer_bookings.';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'OK: dancer probe — protected amounts + INSERT DENIED, benign status/calendar_locked ALLOWED.';
END $probe$;

COMMIT;

NOTIFY pgrst, 'reload schema';
