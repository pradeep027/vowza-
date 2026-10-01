-- PHASE_band_bookings_column_lockdown.sql
--
-- P0-1 (BREAKING HALF, band pilot): lock down public.band_bookings so NO
-- client-side path can set or overwrite booking financial truth.
--   * REVOKE table-wide UPDATE from authenticated and GRANT UPDATE back on ONLY
--     the benign columns a browser flow legitimately writes. All FIVE amount
--     columns (base_amount / addons_amount / total_amount / advance_amount /
--     remaining_amount) plus the identity columns become non-UPDATE-able.
--   * REVOKE INSERT from authenticated so rows can be CREATED only through the
--     create_band_booking SECURITY DEFINER RPC (which derives every amount).
-- After it lands, a signed-in user (customer OR vendor) attempting a direct
-- PATCH of an amount column, or a direct INSERT, gets HTTP 403 / SQLSTATE 42501.
-- The server-derived financials written by create_band_booking and set by
-- accept_band_booking cannot be forged or overwritten from the browser.
--
-- =========================== DO NOT db push YET ============================
-- PARKED OUTSIDE supabase/migrations/ ON PURPOSE. `supabase db push` ignores
-- this directory, so it cannot ship by accident. It is a BREAKING change and
-- MUST NOT be applied until BOTH of the following are live in production and
-- verified against the SERVED bundle (asset hashes and cached HTML lie):
--
--   PRECONDITION 1  Both additive RPC migrations are applied in prod:
--       20261205000000_band_booking_server_authoritative.sql  (create_band_booking)
--       20261206000000_band_booking_accept_authoritative.sql  (accept_band_booking)
--   PRECONDITION 2  The rewired frontend is deployed and confirmed live via a
--     served-bundle grep (asset hashes and cached HTML lie):
--       * src/components/BandMenu.tsx "Book Now" creates via
--         supabase.rpc('create_band_booking').
--       * src/pages/Checkout.tsx creates band cart items via
--         supabase.rpc('create_band_booking') — NOT a direct band_bookings INSERT.
--       * src/pages/vendor/VendorBookings.tsx accepts band bookings via
--         supabase.rpc('accept_band_booking') — NO client advance/remaining PATCH.
--     Unlike the earlier draft, INSERT and the advance columns are REVOKED here,
--     so an OLD served bundle that still direct-inserts or PATCHes amounts WILL
--     break. Both creation paths AND the accept path must be live first.
--
-- SCOPE (what this lockdown protects):
--   Every column that holds financial truth or identity is `protected` (no
--   authenticated UPDATE): base_amount, addons_amount, total_amount,
--   advance_amount, remaining_amount, id, customer_id, provider_id, package_id,
--   created_at, selected_addon_ids. INSERT is revoked outright. All amounts are
--   now written solely by create_band_booking (creation) and accept_band_booking
--   (accept), both SECURITY DEFINER.
--   The `benign` allowlist is the lifecycle/logistics columns a browser flow
--   still legitimately UPDATEs (status transitions, timestamps, venue/city,
--   settlement_status, calendar_locked). advance_paid_at / confirmed_at / status
--   stay writable so the customer pay-advance flow (MyBookings) and the vendor
--   decline/cancel flow keep working without amount authority.
--   FOLLOW-UP (separate, does not block this lockdown): the settlement write in
--   bookingExecutionService.completeService touches only benign columns
--   (status / work_completed_at / settlement_status); the vendor_settlements
--   amount hole is tracked apart from band_bookings.
--
-- ROLLBACK (emergency restore of pre-lockdown behaviour only):
--   GRANT INSERT, UPDATE ON public.band_bookings TO authenticated;
--   NOTIFY pgrst, 'reload schema';
--   (This RE-OPENS the amount-tamper + forge-on-create holes; use only to
--    unblock an old served frontend.)
--
-- Requires: 20261205000000_band_booking_server_authoritative.sql
--       and: 20261206000000_band_booking_accept_authoritative.sql

BEGIN;

SET search_path = public, pg_temp;

-- 1) Remove the table-wide UPDATE that lets a row party PATCH any column, and
--    remove INSERT entirely so rows can be created ONLY via the
--    create_band_booking SECURITY DEFINER RPC (which runs as the table owner and
--    is not subject to these grants). No INSERT is granted back to authenticated.
REVOKE INSERT, UPDATE ON public.band_bookings FROM PUBLIC, anon, authenticated;

-- 2) Grant UPDATE back on ONLY the browser-writable columns. Every column NOT
--    listed here (ALL FIVE amounts — base/addons/total/advance/remaining —
--    plus identity, created_at, selected_addon_ids) stays non-updatable by
--    authenticated and is written solely at creation by create_band_booking and
--    at accept by accept_band_booking (both SECURITY DEFINER, not subject to
--    these column grants). INSERT is revoked above; SELECT / DELETE are left
--    untouched.
GRANT UPDATE (
    accepted_at, advance_paid_at, calendar_locked, city,
    confirmed_at, event_date, event_time, event_type, expired_at,
    otp_verified_at, payment_deadline, settlement_status,
    special_requirements, start_requested_at, status, venue,
    work_completed_at, work_started_at
) ON public.band_bookings TO authenticated;

-- ===========================================================================
-- STATIC PROOF (privilege catalogue). Asserts, without touching data, that the
-- grant matrix is exactly right and that no live column escaped classification.
-- ===========================================================================
DO $catalog$
DECLARE
    benign text[] := ARRAY[
        'accepted_at','advance_paid_at','calendar_locked','city',
        'confirmed_at','event_date','event_time','event_type','expired_at',
        'otp_verified_at','payment_deadline','settlement_status',
        'special_requirements','start_requested_at','status','venue',
        'work_completed_at','work_started_at'
    ];
    protected text[] := ARRAY[
        'addons_amount','advance_amount','base_amount','created_at','customer_id',
        'id','package_id','provider_id','remaining_amount','selected_addon_ids',
        'total_amount'
    ];
    c     text;
    v_bad text;
BEGIN
    -- (a) DRIFT GUARD: every live column must be classified in exactly one list.
    SELECT string_agg(a.attname, ', ') INTO v_bad
      FROM pg_attribute a
     WHERE a.attrelid = 'public.band_bookings'::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
       AND NOT (a.attname = ANY(benign) OR a.attname = ANY(protected));
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: band_bookings has unclassified column(s): %. Classify each as benign or protected before applying.', v_bad;
    END IF;

    -- (b) no column may appear in both lists.
    SELECT string_agg(x, ', ') INTO v_bad
      FROM (SELECT unnest(benign) INTERSECT SELECT unnest(protected)) t(x);
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: column(s) classified as BOTH benign and protected: %.', v_bad;
    END IF;

    -- (c) protected columns must NOT be UPDATE-able by authenticated.
    FOREACH c IN ARRAY protected LOOP
        IF has_column_privilege('authenticated', 'public.band_bookings', c, 'UPDATE') THEN
            RAISE EXCEPTION 'FAILED: authenticated still holds UPDATE on protected column %.', c;
        END IF;
    END LOOP;

    -- (d) benign columns MUST remain UPDATE-able by authenticated.
    FOREACH c IN ARRAY benign LOOP
        IF NOT has_column_privilege('authenticated', 'public.band_bookings', c, 'UPDATE') THEN
            RAISE EXCEPTION 'FAILED: authenticated lost UPDATE on benign column %.', c;
        END IF;
    END LOOP;

    -- (e) INSERT must be fully revoked: creation goes only through the definer
    --     RPC. Any residual authenticated INSERT would re-open the forge-on-
    --     create hole (client-supplied amounts on a brand-new row).
    IF has_table_privilege('authenticated', 'public.band_bookings', 'INSERT') THEN
        RAISE EXCEPTION 'FAILED: authenticated still holds INSERT on band_bookings; creation is not RPC-only.';
    END IF;

    RAISE NOTICE 'OK: % benign columns UPDATE-able, % protected columns locked, INSERT revoked.',
        array_length(benign, 1), array_length(protected, 1);
END $catalog$;

-- ===========================================================================
-- RUNTIME PROOF (direct Supabase-client mutation path). Impersonates a signed-in
-- booking party and proves, at the privilege layer, that ALL FIVE amount columns
-- are DENIED for direct UPDATE, that a direct INSERT is DENIED, and that a benign
-- column stays writable. Column/table-privilege checks fire at executor start,
-- before any row is scanned, so aiming UPDATEs at a non-existent row isolates the
-- privilege decision from RLS and live data (nothing is ever written); the INSERT
-- probe runs inside a savepoint that is always rolled back.
-- ===========================================================================
DO $probe$
DECLARE
    protected_probe text[] := ARRAY['base_amount','addons_amount','total_amount','advance_amount','remaining_amount'];
    benign_probe    text[] := ARRAY['status','calendar_locked'];
    c        text;
    v_ghost  uuid := '00000000-0000-0000-0000-000000000000';
    v_leaked text := NULL;   -- first protected column NOT denied
    v_lost   text := NULL;   -- first benign column NOT allowed
    v_ins    text := NULL;   -- INSERT result if NOT denied
    v_res    text;
BEGIN
    SET LOCAL ROLE authenticated;

    FOREACH c IN ARRAY protected_probe LOOP
        BEGIN
            EXECUTE format('UPDATE public.band_bookings SET %I = %I WHERE id = %L', c, c, v_ghost);
            v_res := 'ALLOWED';
        EXCEPTION
            WHEN insufficient_privilege THEN v_res := 'BLOCKED';
            WHEN others                 THEN v_res := 'OTHER_' || SQLSTATE;
        END;
        IF v_res <> 'BLOCKED' AND v_leaked IS NULL THEN
            v_leaked := c || '=' || v_res;
        END IF;
    END LOOP;

    FOREACH c IN ARRAY benign_probe LOOP
        BEGIN
            EXECUTE format('UPDATE public.band_bookings SET %I = %I WHERE id = %L', c, c, v_ghost);
            v_res := 'ALLOWED';
        EXCEPTION
            WHEN insufficient_privilege THEN v_res := 'BLOCKED';
            WHEN others                 THEN v_res := 'OTHER_' || SQLSTATE;
        END;
        IF v_res <> 'ALLOWED' AND v_lost IS NULL THEN
            v_lost := c || '=' || v_res;
        END IF;
    END LOOP;

    -- Direct creation must be denied outright (creation only via the RPC). Run in
    -- a savepoint and always roll back so nothing is written even if it slipped.
    BEGIN
        BEGIN
            INSERT INTO public.band_bookings (id) VALUES (v_ghost);
            v_res := 'ALLOWED';
        EXCEPTION
            WHEN insufficient_privilege THEN v_res := 'BLOCKED';
            WHEN others                 THEN v_res := 'OTHER_' || SQLSTATE;
        END;
    END;
    IF v_res NOT IN ('BLOCKED') THEN
        v_ins := v_res;
    END IF;

    RESET ROLE;

    IF v_leaked IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: a signed-in party was NOT denied direct UPDATE of a protected amount column (%). Expected BLOCKED (SQLSTATE 42501); the financial-tamper hole is still open.', v_leaked;
    END IF;
    IF v_lost IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: a signed-in party can no longer UPDATE a benign column (%). Legitimate accept/cancel flow would break.', v_lost;
    END IF;
    IF v_ins IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: a signed-in party was NOT denied a direct INSERT (got %). Expected BLOCKED (SQLSTATE 42501); the forge-on-create hole is still open.', v_ins;
    END IF;

    RAISE NOTICE 'OK: direct PATCH denied on all five amounts, direct INSERT denied, UPDATE allowed on status/calendar_locked.';
END $probe$;

COMMIT;

-- PostgREST caches column privileges with the schema; without this the 403s do
-- not take effect until the next DDL event.
NOTIFY pgrst, 'reload schema';
