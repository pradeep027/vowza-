-- PHASE_bookings_column_lockdown.sql
--
-- P0-1 (BREAKING HALF, generic bookings): lock down public.bookings so NO
-- client-side path can set or overwrite booking financial truth.
--   * REVOKE table-wide INSERT + UPDATE from authenticated, then GRANT UPDATE
--     back on ONLY the benign lifecycle/logistics columns a browser/provider/
--     admin flow legitimately writes. The 4 financial columns (amount,
--     advance_amount, remaining_amount, platform_fee) plus the 4 identity
--     columns (id, customer_id, provider_id, created_at) become
--     non-UPDATE-able, and rows can be CREATED only through the
--     create_generic_booking SECURITY DEFINER RPC (which forces customer_id and
--     decides amount / platform_fee / status).
-- After it lands, a signed-in user attempting a direct PATCH of a financial
-- column, or a direct INSERT, gets HTTP 403 / SQLSTATE 42501. The
-- server-decided amount written by create_generic_booking cannot be forged or
-- overwritten from the browser.
--
-- generic bookings has NO advance/remaining flow (those columns are never
-- written by any app path) and the provider accept/reject path writes ONLY
-- status — no financial value — so, unlike the 15 vendor categories, there is
-- NO companion accept_* RPC to keep working, only create_generic_booking.
--
-- =========================== DO NOT db push YET ============================
-- PARKED OUTSIDE supabase/migrations/ ON PURPOSE. `supabase db push` ignores
-- this directory, so it cannot ship by accident. It is a BREAKING change and
-- MUST NOT be applied until BOTH of the following are live in production and
-- verified against the SERVED bundle (asset hashes and cached HTML lie):
--
--   PRECONDITION 1  The additive create RPC migration is applied in prod:
--       20261236000000_bookings_server_authoritative.sql (create_generic_booking)
--   PRECONDITION 2  The rewired frontend is deployed and confirmed live via a
--     served-bundle grep:
--       * src/components/BookingModal.tsx creates via
--         supabase.rpc('create_generic_booking') — NOT a direct public.bookings
--         INSERT carrying amount / platform_fee.
--       * src/hooks/useBookings.ts createBooking likewise routes through the RPC.
--     INSERT and the financial columns are REVOKED here, so an OLD served bundle
--     that still direct-inserts WILL break. The creation path must be live first.
--
-- SCOPE (what this lockdown protects):
--   Every column that holds financial truth or identity is `protected` (no
--   authenticated UPDATE): amount, advance_amount, remaining_amount,
--   platform_fee, id, customer_id, provider_id, created_at. INSERT is revoked
--   outright. The whole financial snapshot is now written solely by
--   create_generic_booking (SECURITY DEFINER).
--   The `benign` allowlist is the 26 lifecycle/logistics/state columns a
--   browser/provider/admin flow still legitimately UPDATEs: status transitions
--   (accept/reject/cancel), OTP + work-lifecycle timestamps, calendar_locked,
--   notes, venue/event descriptive fields, settlement_status, and invoice
--   provenance. NOTE: RLS is the real gate on WHO may update a given row
--   (provider accept/reject, customer cancel); this lockdown only ensures the
--   financial columns are never client-writable. Marking payment/settlement
--   'paid' is a Phase D concern, not amount authority.
--
-- ROLLBACK (emergency restore of pre-lockdown behaviour only):
--   GRANT INSERT, UPDATE ON public.bookings TO authenticated;
--   NOTIFY pgrst, 'reload schema';
--   (This RE-OPENS the amount-tamper + forge-on-create holes; use only to
--    unblock an old served frontend.)
--
-- Requires: 20261236000000_bookings_server_authoritative.sql
BEGIN;

SET search_path = public, pg_temp;
-- 1) Remove the table-wide UPDATE that lets a row party PATCH any column, and
--    remove INSERT entirely so rows can be created ONLY via the
--    create_generic_booking SECURITY DEFINER RPC (which runs as the table owner
--    and is not subject to these grants). No INSERT is granted back.
REVOKE INSERT, UPDATE ON public.bookings FROM PUBLIC, anon, authenticated;
-- 2) Grant UPDATE back on ONLY the benign lifecycle/logistics columns. Every
--    column NOT listed here (the 4 financial columns + the 4 identity columns)
--    is now non-UPDATE-able by authenticated. No INSERT is granted back at all.
--    This is the column allowlist — the 26 benign columns:
GRANT UPDATE (
    accepted_at,
    advance_paid_at,
    calendar_locked,
    confirmed_at,
    customer_notes,
    event_date,
    event_duration_hours,
    event_time,
    event_type_id,
    expired_at,
    invoice_generated_at,
    invoice_number,
    invoice_url,
    otp_verified_at,
    payment_deadline,
    provider_notes,
    requirements,
    settlement_status,
    start_requested_at,
    status,
    updated_at,
    venue_address,
    venue_area,
    venue_city,
    work_completed_at,
    work_started_at
) ON public.bookings TO authenticated;
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
    -- 8 columns that must NOT be authenticated-writable: the four financial
    -- amounts plus the identity/provenance columns the create RPC sets.
    protected_cols text[] := ARRAY[
        'amount','advance_amount','remaining_amount','platform_fee',
        'id','customer_id','provider_id','created_at'
    ];
    -- 26 benign lifecycle/logistics/state columns granted UPDATE above. None is
    -- a pricing input: generic bookings has no addon and no quantity multiplier,
    -- and advance/remaining are never written by any app path.
    benign_cols text[] := ARRAY[
        'accepted_at','advance_paid_at','calendar_locked','confirmed_at',
        'customer_notes','event_date','event_duration_hours','event_time',
        'event_type_id','expired_at','invoice_generated_at','invoice_number',
        'invoice_url','otp_verified_at','payment_deadline','provider_notes',
        'requirements','settlement_status','start_requested_at','status',
        'updated_at','venue_address','venue_area','venue_city',
        'work_completed_at','work_started_at'
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
             WHERE a.attrelid = 'public.bookings'::regclass
               AND a.attname = v_col AND a.attnum > 0 AND NOT a.attisdropped
        ) THEN
            v_missing := v_missing || ' protected:' || v_col;
        END IF;
    END LOOP;
    -- (b) every benign column must exist.
    FOREACH v_col IN ARRAY benign_cols LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = 'public.bookings'::regclass
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
         WHERE a.attrelid = 'public.bookings'::regclass
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
        RAISE EXCEPTION 'ABORT bookings lockdown: expected column(s) missing:%', v_missing;
    END IF;
    IF v_unknown <> '' THEN
        RAISE EXCEPTION 'ABORT bookings lockdown: un-classified live column(s) (triage before locking):%', v_unknown;
    END IF;
    IF v_overlap <> '' THEN
        RAISE EXCEPTION 'ABORT bookings lockdown: column(s) in BOTH protected and benign:%', v_overlap;
    END IF;

    -- (e) the REVOKE must have taken: authenticated must NOT hold INSERT.
    IF has_table_privilege('authenticated', 'public.bookings', 'INSERT') THEN
        RAISE EXCEPTION 'ABORT bookings lockdown: authenticated still holds INSERT after REVOKE.';
    END IF;

    RAISE NOTICE 'OK: bookings lockdown split matches live schema (8 protected / 26 benign / 34 total), INSERT revoked.';
END $catalog$;
-- ===========================================================================
-- FAIL-CLOSED RUNTIME PROBE. Actually assume the `authenticated` role and prove
-- the grants behave: a protected financial PATCH is DENIED, a benign lifecycle
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
    -- (1) protected financial column: a self-assignment UPDATE must be DENIED (42501).
    v_blocked := false;
    BEGIN
        EXECUTE format(
            'UPDATE public.bookings SET amount = amount WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RESET ROLE;
        RAISE EXCEPTION 'FAILED probe: authenticated could UPDATE protected column amount.';
    END IF;
    -- (2) a second protected financial column: platform_fee must ALSO be DENIED.
    v_blocked := false;
    BEGIN
        EXECUTE format(
            'UPDATE public.bookings SET platform_fee = platform_fee WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RESET ROLE;
        RAISE EXCEPTION 'FAILED probe: authenticated could UPDATE protected column platform_fee.';
    END IF;
    -- (3) benign lifecycle column: a self-assignment UPDATE must be ALLOWED.
    BEGIN
        EXECUTE format(
            'UPDATE public.bookings SET status = status WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
            RAISE EXCEPTION 'FAILED probe: authenticated could NOT UPDATE benign column status.';
    END;
    -- (4) a second benign column: event_date must ALSO be ALLOWED.
    BEGIN
        EXECUTE format(
            'UPDATE public.bookings SET event_date = event_date WHERE id = %L', v_ghost
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
            RAISE EXCEPTION 'FAILED probe: authenticated could NOT UPDATE benign column event_date.';
    END;
    -- (5) direct INSERT must be DENIED — rows may be created ONLY via the
    --     create_generic_booking SECURITY DEFINER RPC. Wrapped in a
    --     subtransaction and always rolled back so nothing is persisted even if
    --     the grant regressed.
    v_blocked := false;
    BEGIN
        BEGIN
            INSERT INTO public.bookings (id) VALUES (v_ghost);
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
        RAISE EXCEPTION 'FAILED probe: authenticated could INSERT into bookings.';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'OK: bookings lockdown probe passed — protected financial PATCH denied, benign lifecycle PATCH allowed, direct INSERT denied.';
END $probe$;

COMMIT;

NOTIFY pgrst, 'reload schema';
