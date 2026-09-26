-- PHASE_anchor_bookings_column_lockdown.sql
--
-- P0-1 (BREAKING HALF, anchor category): lock down public.anchor_bookings so NO
-- client-side path can set or overwrite booking financial truth.
--   * REVOKE table-wide UPDATE from authenticated and GRANT UPDATE back on ONLY
--     the benign columns a browser flow legitimately writes. All FIVE amount
--     columns (base_amount / addons_amount / total_amount / advance_amount /
--     remaining_amount) plus the identity columns become non-UPDATE-able.
--   * REVOKE INSERT from authenticated so rows can be CREATED only through the
--     create_anchor_booking SECURITY DEFINER RPC (which derives every amount).
-- After it lands, a signed-in user (customer OR vendor) attempting a direct
-- PATCH of an amount column, or a direct INSERT, gets HTTP 403 / SQLSTATE 42501.
-- The server-derived financials written by create_anchor_booking and set by
-- accept_anchor_booking cannot be forged or overwritten from the browser.
--
-- =========================== DO NOT db push YET ============================
-- PARKED OUTSIDE supabase/migrations/ ON PURPOSE. `supabase db push` ignores
-- this directory, so it cannot ship by accident. It is a BREAKING change and
-- MUST NOT be applied until BOTH of the following are live in production and
-- verified against the SERVED bundle (asset hashes and cached HTML lie):
--
--   PRECONDITION 1  Both additive RPC migrations are applied in prod:
--       20261209000000_anchor_booking_server_authoritative.sql  (create_anchor_booking)
--       20261210000000_anchor_booking_accept_authoritative.sql  (accept_anchor_booking)
--   PRECONDITION 2  The rewired frontend is deployed and confirmed live via a
--     served-bundle grep (asset hashes and cached HTML lie):
--       * src/components/AnchorMenu.tsx creates via
--         supabase.rpc('create_anchor_booking') — NOT a direct anchor_bookings INSERT.
--       * src/pages/Checkout.tsx routes anchor cart items through
--         supabase.rpc('create_anchor_booking') — NOT the generic amount-carrying INSERT.
--       * src/pages/vendor/VendorBookings.tsx accepts anchor via
--         supabase.rpc('accept_anchor_booking') — NO client advance/remaining PATCH.
--     INSERT and the advance columns are REVOKED here, so an OLD served bundle
--     that still direct-inserts or PATCHes amounts WILL break. Both the creation
--     path AND the accept path must be live first.
--
-- SCOPE (what this lockdown protects):
--   Every column that holds financial truth or identity is `protected` (no
--   authenticated UPDATE): base_amount, addons_amount, total_amount,
--   advance_amount, remaining_amount, id, customer_id, provider_id, package_id,
--   created_at, selected_addon_ids. INSERT is revoked outright. All amounts are
--   now written solely by create_anchor_booking (creation) and
--   accept_anchor_booking (accept), both SECURITY DEFINER.
--   NOTE ON expected_audience: unlike catering's guest_count, expected_audience
--   is NOT a pricing multiplier — the anchor total is package_price + addons
--   regardless of the client count (see AnchorMenu.tsx and create_anchor_booking).
--   It is therefore a benign descriptive column, left browser-writable.
--   The `benign` allowlist is the lifecycle/logistics columns a browser flow
--   still legitimately UPDATEs (status transitions, timestamps, venue/city,
--   event_time, event_type, expected_audience, settlement_status,
--   calendar_locked). advance_paid_at / confirmed_at / status stay writable so
--   the customer pay-advance flow and the vendor decline/cancel flow keep working
--   without amount authority.
--
-- ROLLBACK (emergency restore of pre-lockdown behaviour only):
--   GRANT INSERT, UPDATE ON public.anchor_bookings TO authenticated;
--   NOTIFY pgrst, 'reload schema';
--   (This RE-OPENS the amount-tamper + forge-on-create holes; use only to
--    unblock an old served frontend.)
--
-- Requires: 20261209000000_anchor_booking_server_authoritative.sql
--       and: 20261210000000_anchor_booking_accept_authoritative.sql

BEGIN;

SET search_path = public, pg_temp;

-- 1) Remove the table-wide UPDATE that lets a row party PATCH any column, and
--    remove INSERT entirely so rows can be created ONLY via the
--    create_anchor_booking SECURITY DEFINER RPC (which runs as the table owner
--    and is not subject to these grants). No INSERT is granted back.
REVOKE INSERT, UPDATE ON public.anchor_bookings FROM PUBLIC, anon, authenticated;

-- 2) Grant UPDATE back on ONLY the benign lifecycle/logistics columns a browser
--    flow legitimately writes. Every column NOT listed here (all five amounts +
--    the identity columns) is now non-UPDATE-able by authenticated. No INSERT is
--    granted back at all. This is the column allowlist — the 19 benign columns:
GRANT UPDATE (
    accepted_at,
    advance_paid_at,
    calendar_locked,
    city,
    confirmed_at,
    event_date,
    event_time,
    event_type,
    expected_audience,
    expired_at,
    otp_verified_at,
    payment_deadline,
    settlement_status,
    special_requirements,
    start_requested_at,
    status,
    venue,
    work_completed_at,
    work_started_at
) ON public.anchor_bookings TO authenticated;

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
    -- the identity/provenance columns create_anchor_booking sets authoritatively.
    protected_cols text[] := ARRAY[
        'base_amount','addons_amount','total_amount','advance_amount','remaining_amount',
        'id','customer_id','provider_id','package_id','created_at','selected_addon_ids'
    ];
    -- 19 benign lifecycle/logistics columns granted UPDATE above. expected_audience
    -- is here ON PURPOSE: unlike catering's guest_count it is NOT a pricing input.
    benign_cols text[] := ARRAY[
        'accepted_at','advance_paid_at','calendar_locked','city','confirmed_at',
        'event_date','event_time','event_type','expected_audience','expired_at',
        'otp_verified_at','payment_deadline','settlement_status','special_requirements',
        'start_requested_at','status','venue','work_completed_at','work_started_at'
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
             WHERE a.attrelid = 'public.anchor_bookings'::regclass
               AND a.attname = v_col AND a.attnum > 0 AND NOT a.attisdropped
        ) THEN
            v_missing := v_missing || ' protected:' || v_col;
        END IF;
    END LOOP;

    -- (b) every benign column must exist.
    FOREACH v_col IN ARRAY benign_cols LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = 'public.anchor_bookings'::regclass
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
         WHERE a.attrelid = 'public.anchor_bookings'::regclass
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
        RAISE EXCEPTION 'ABORT anchor lockdown: expected column(s) missing:%', v_missing;
    END IF;
    IF v_unknown <> '' THEN
        RAISE EXCEPTION 'ABORT anchor lockdown: un-classified live column(s) (triage before locking):%', v_unknown;
    END IF;
    IF v_overlap <> '' THEN
        RAISE EXCEPTION 'ABORT anchor lockdown: column(s) in BOTH protected and benign:%', v_overlap;
    END IF;

    -- (e) the REVOKE must have taken: authenticated must NOT hold INSERT, and
    --     must NOT hold a table-wide UPDATE (column grants are checked in $probe$).
    IF has_table_privilege('authenticated', 'public.anchor_bookings', 'INSERT') THEN
        RAISE EXCEPTION 'ABORT anchor lockdown: authenticated still holds INSERT after REVOKE.';
    END IF;

    RAISE NOTICE 'OK: anchor lockdown split matches live schema (11 protected / 19 benign / 30 total), INSERT revoked.';
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
    -- A UUID that matches no anchor_bookings row: isolates the privilege decision
    -- from RLS/data. UPDATEs touch zero rows; the INSERT is rolled back anyway.
    v_ghost   uuid := '00000000-0000-0000-0000-000000000000';
    v_blocked boolean;
BEGIN
    SET LOCAL ROLE authenticated;

    -- (1) protected amount column: a self-assignment UPDATE must be DENIED (42501).
    v_blocked := false;
    BEGIN
        EXECUTE format(
            'UPDATE public.anchor_bookings SET total_amount = total_amount WHERE id = %L', v_ghost
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
            'UPDATE public.anchor_bookings SET advance_amount = advance_amount WHERE id = %L', v_ghost
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
            'UPDATE public.anchor_bookings SET status = status WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
            RAISE EXCEPTION 'FAILED probe: authenticated could NOT UPDATE benign column status (grant missing).';
    END;

    -- (2b) benign calendar_locked must likewise be ALLOWED (vendor decline/cancel).
    BEGIN
        EXECUTE format(
            'UPDATE public.anchor_bookings SET calendar_locked = calendar_locked WHERE id = %L', v_ghost
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
        EXECUTE 'INSERT INTO public.anchor_bookings (status) VALUES (''pending'')';
        -- Should be unreachable; if it somehow inserted, undo it below.
    EXCEPTION
        WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RESET ROLE;
        RAISE EXCEPTION 'FAILED probe: authenticated could INSERT into anchor_bookings.';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'OK: anchor probe — protected amounts + INSERT DENIED, benign status/calendar_locked ALLOWED.';
END $probe$;

COMMIT;

NOTIFY pgrst, 'reload schema';
