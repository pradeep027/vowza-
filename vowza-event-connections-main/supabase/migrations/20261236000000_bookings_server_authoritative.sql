-- 20261236000000_bookings_server_authoritative.sql
--
-- P0-1 (generic `bookings` table — Phase B closeout): move booking financial
-- authority off the browser. public.bookings is the ORIGINAL direct-booking flow
-- (src/components/BookingModal.tsx, rendered by src/pages/ProviderProfile.tsx)
-- that predates the 15 per-vendor category tables and the admin event-package
-- flow. It is the LAST Phase B table.
--
-- BEFORE: BookingModal.tsx inserted directly into public.bookings with `amount`
--   (and platform_fee = 0) taken from CLIENT state. The amount input is readOnly
--   and pre-filled to the chosen pricing_packages.price when a package is picked,
--   but NOTHING server-side enforced that: a tampered client could book an
--   ₹80,000 package yet post amount = 1. (The modal also sent a `package_id` key
--   that public.bookings does NOT have — the only package_id column in the whole
--   schema is on auth_promotion_media — so that insert key would be rejected by
--   PostgREST as an unknown column. This RPC fixes that latent bug too: bookings
--   has no package_id column, so the package id is used ONLY to look up the
--   authoritative price and is never stored.)
--
-- AFTER: the browser calls public.create_generic_booking(...) passing ONLY
--   identifiers / descriptive fields (and, for the no-package flow, its offered
--   amount). This SECURITY DEFINER RPC forces customer_id = auth.uid(), forces
--   platform_fee = 0 and status = 'requested', and decides `amount` server-side.
--
-- TWO amount branches, preserved EXACTLY from BookingModal.tsx (do not "fix"):
--   (1) PACKAGE-SELECTED (amount UI is readOnly): amount is server-authoritative
--       = pricing_packages.price of the chosen package, which MUST belong to the
--       provider being booked (server-enforced anti-tamper — this replaces the
--       bypassable client validateVendorPackageRelationship check). Any
--       client-supplied amount is ignored. NO is_active gate is applied, because
--       ProviderProfile.tsx lists a provider's packages with no is_active filter;
--       adding one here would reject a package the UI presented as bookable
--       (that would be a BUSINESS-RULE CHANGE, out of scope).
--   (2) NO-PACKAGE "Offered Amount" (amount UI is free entry): a genuine customer
--       NEGOTIATION — the customer legitimately names the price and there is NO
--       server-authoritative source (provider.price_min / price_max are shown
--       only as "Suggested"; the client validates solely that amount > 0). The
--       RPC HONORS the offered amount as-is, enforcing only amount > 0 — matching
--       the client's validateDetails. It deliberately imposes NO price_min floor
--       (that would change the negotiation rule). Safe because the amount is the
--       customer's own offer, the provider still accepts/rejects it, and
--       customer_id / platform_fee / status stay server-forced.
--
-- generic bookings NEVER writes advance_amount / remaining_amount from any app
-- path (those lifecycle columns exist but are unused here), and platform_fee is
-- only ever set to 0 at create. The provider accept/reject path
-- (ProviderDashboard.tsx) writes ONLY status — no financial value — so, unlike
-- the 15 vendor categories, there is NO companion accept_* RPC to add.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE; it revokes nothing. The BREAKING column lockdown
-- that stops direct PATCHes of the amount columns is parked separately at
-- supabase/migrations-pending/PHASE_bookings_column_lockdown.sql and must NOT be
-- promoted until this RPC + the rewired BookingModal are live.
--
-- ROLLBACK: DROP FUNCTION public.create_generic_booking(uuid,date,uuid,integer,text,integer,text,text,text,text,uuid);
--   The old BookingModal direct-insert path would then have to be restored.
BEGIN;
-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Introspect the LIVE schema and abort (rolling back
-- the whole migration) if the columns/types this RPC reads and writes are not
-- exactly what the repo snapshot assumes. Uses pg_attribute, not the repo.
-- ===========================================================================
DO $catalog$
DECLARE
    req       record;
    v_missing text := '';
    v_typebad text := '';
BEGIN
    -- (a) every column the RPC touches must exist.
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('pricing_packages','id'), ('pricing_packages','provider_id'),
            ('pricing_packages','price'),
            ('provider_profiles','id'),
            ('bookings','customer_id'), ('bookings','provider_id'),
            ('bookings','event_type_id'), ('bookings','event_date'),
            ('bookings','event_time'), ('bookings','event_duration_hours'),
            ('bookings','venue_address'), ('bookings','venue_city'),
            ('bookings','venue_area'), ('bookings','requirements'),
            ('bookings','amount'), ('bookings','advance_amount'),
            ('bookings','remaining_amount'), ('bookings','platform_fee'),
            ('bookings','status')
        ) AS t(tbl, col)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = ('public.' || req.tbl)::regclass
               AND a.attname = req.col AND a.attnum > 0 AND NOT a.attisdropped
        ) THEN
            v_missing := v_missing || format(' %s.%s', req.tbl, req.col);
        END IF;
    END LOOP;
    IF v_missing <> '' THEN
        RAISE EXCEPTION 'ABORT create_generic_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    -- (b) the booking financial columns + the package price must be numeric;
    --     server derivation writes numbers into them and reads price from them.
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('bookings','amount'), ('bookings','advance_amount'),
            ('bookings','remaining_amount'), ('bookings','platform_fee'),
            ('pricing_packages','price')
        ) AS t(tbl, col)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
             WHERE a.attrelid = ('public.' || req.tbl)::regclass
               AND a.attname = req.col
               AND ty.typname IN ('int2','int4','int8','numeric','float4','float8')
        ) THEN
            v_typebad := v_typebad || format(' %s.%s', req.tbl, req.col);
        END IF;
    END LOOP;
    IF v_typebad <> '' THEN
        RAISE EXCEPTION 'ABORT create_generic_booking: expected numeric column(s) are not numeric:%', v_typebad;
    END IF;

    RAISE NOTICE 'OK: bookings schema matches; creating create_generic_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative generic booking CREATE. The browser passes identifiers,
-- descriptive fields, and (no-package branch only) its offered amount. The
-- customer identity, platform_fee, status and — for the package branch — the
-- amount are all decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_generic_booking(
    p_provider_id          uuid,
    p_event_date           date,
    p_package_id           uuid    DEFAULT NULL,
    p_offered_amount       integer DEFAULT NULL,
    p_event_time           text    DEFAULT NULL,
    p_event_duration_hours integer DEFAULT NULL,
    p_venue_address        text    DEFAULT NULL,
    p_venue_city           text    DEFAULT NULL,
    p_venue_area           text    DEFAULT NULL,
    p_requirements         text    DEFAULT NULL,
    p_event_type_id        uuid    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid    uuid := auth.uid();
    v_pkg    public.pricing_packages%rowtype;
    v_amount integer;
    v_id     uuid;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
    END IF;
    IF p_provider_id IS NULL THEN
        RAISE EXCEPTION 'A provider is required' USING ERRCODE = '22023';
    END IF;
    IF p_event_date IS NULL THEN
        RAISE EXCEPTION 'An event date is required' USING ERRCODE = '22023';
    END IF;

    IF p_package_id IS NOT NULL THEN
        -- (1) PACKAGE-SELECTED: amount is server-authoritative. Row-lock the
        --     package so its price cannot change under us mid-insert.
        SELECT * INTO v_pkg
          FROM public.pricing_packages
         WHERE id = p_package_id
         FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Selected package not available' USING ERRCODE = 'P0002';
        END IF;
        -- The chosen package MUST belong to the provider being booked. This is
        -- the server-side enforcement of the (bypassable) client
        -- validateVendorPackageRelationship check.
        IF v_pkg.provider_id IS DISTINCT FROM p_provider_id THEN
            RAISE EXCEPTION 'Selected package does not belong to this provider' USING ERRCODE = '22023';
        END IF;
        -- No is_active gate (see header): a listed package stays bookable.
        v_amount := coalesce(v_pkg.price, 0);
        IF v_amount <= 0 THEN
            RAISE EXCEPTION 'Selected package has no price set' USING ERRCODE = '22023';
        END IF;
    ELSE
        -- (2) NO-PACKAGE "Offered Amount" negotiation: the customer legitimately
        --     names the price. There is NO server-authoritative source; enforce
        --     ONLY amount > 0 (mirrors the client's validateDetails) and confirm
        --     the provider exists. price_min/price_max are suggestions only — no
        --     floor is imposed (that would change the negotiation rule).
        IF NOT EXISTS (
            SELECT 1 FROM public.provider_profiles WHERE id = p_provider_id
        ) THEN
            RAISE EXCEPTION 'Provider not available' USING ERRCODE = 'P0002';
        END IF;
        v_amount := coalesce(p_offered_amount, 0);
        IF v_amount <= 0 THEN
            RAISE EXCEPTION 'A positive offered amount is required' USING ERRCODE = '22023';
        END IF;
    END IF;
    -- customer_id FORCED to the caller; platform_fee FORCED to 0; status FORCED
    -- to 'requested' (matches the old BookingModal insert). package_id is NOT
    -- stored — public.bookings has no such column; the package id was used only
    -- to look up the authoritative price above. event_time is a TIME column, so
    -- the "HH:MM" text is cast (the old direct insert relied on the same coercion).
    INSERT INTO public.bookings (
        customer_id, provider_id, event_type_id,
        event_date, event_time, event_duration_hours,
        venue_address, venue_city, venue_area, requirements,
        amount, platform_fee, status
    ) VALUES (
        v_uid, p_provider_id, p_event_type_id,
        p_event_date, nullif(p_event_time, '')::time, coalesce(p_event_duration_hours, 4),
        p_venue_address, p_venue_city, nullif(p_venue_area, ''), nullif(p_requirements, ''),
        v_amount, 0, 'requested'::public.booking_status
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END $fn$;
-- Callable only by signed-in users; never anon/public. The RPC forces
-- customer_id = auth.uid() and decides the financial values.
REVOKE ALL ON FUNCTION public.create_generic_booking(uuid,date,uuid,integer,text,integer,text,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_generic_booking(uuid,date,uuid,integer,text,integer,text,text,text,text,uuid) TO authenticated;
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK. Prove the function landed exactly as intended.
-- ===========================================================================
DO $verify$
DECLARE
    v_cnt       int;
    v_secdef    boolean;
    v_search    text;
    v_anon_exec boolean;
    v_auth_exec boolean;
BEGIN
    SELECT count(*) INTO v_cnt
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_generic_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_generic_booking overload, found %.', v_cnt;
    END IF;
    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_generic_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_generic_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_generic_booking has no hardened search_path (got %).', v_search;
    END IF;
    v_anon_exec := has_function_privilege('anon', 'public.create_generic_booking(uuid,date,uuid,integer,text,integer,text,text,text,text,uuid)', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_generic_booking(uuid,date,uuid,integer,text,integer,text,text,text,text,uuid)', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_generic_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_generic_booking.';
    END IF;

    RAISE NOTICE 'OK: create_generic_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
