-- 20261242000000_complete_booking_service_authoritative.sql
--
-- P0 Phase D (payment / settlement integrity) — SERVER-AUTHORITATIVE service
-- completion. Before this, src/services/bookingExecutionService.ts::completeService
-- ran entirely in the browser: it accepted a client-passed bookingAmount AND
-- platformFeeRate, then raw-inserted a vendor_settlements row with those values
-- (and raw-updated the booking to 'completed'). A malicious vendor could inflate
-- booking_amount / vendor_earnings or zero the platform fee and fabricate the
-- payout, because the authenticated_insert_settlements RLS policy lets ANY
-- authenticated user insert ANY settlement row.
--
-- This migration moves the ENTIRE completion + settlement into one hardened
-- SECURITY DEFINER RPC, public.complete_booking_service(p_booking_id uuid,
-- p_booking_source text) RETURNS uuid. The RPC:
--   * resolves the booking table + provider/amount columns from a FIXED CASE
--     whitelist (unknown source -> 22023), never from client-supplied SQL;
--   * reads the AUTHORITATIVE amount + provider + customer + status from the
--     stored row (FOR UPDATE), never from the client;
--   * authorizes the caller as the booking's PROVIDER via provider_profiles
--     (else 42501) — the SECURITY DEFINER context preserves auth.uid();
--   * is IDEMPOTENT: if a settlement already exists for this booking it returns
--     that id instead of inserting a duplicate (safe to retry);
--   * requires status='in_progress' and work_completed_at IS NULL (else 55000);
--   * derives the platform fee from public.platform_settings (the same source
--     of truth as the rest of the app) — percentage / fixed / disabled;
--   * writes status='completed'/work_completed_at/settlement_status='pending'
--     (the existing status trigger still validates the in_progress->completed
--     edge and the provider actor binding), the settlement, a WORK_COMPLETED
--     audit event, and the customer notification — all in ONE transaction.
--
-- CLASSIFICATION: SECURITY FIX (settlement money is now server-derived + the
--   caller is bound to the provider) + BUG FIX (the fee now follows the
--   configured platform_settings instead of a hard-coded client 5). ADDITIVE —
--   adds one RPC; revokes nothing; the broad settlement-insert RLS lockdown is
--   PARKED separately (migrations-pending) until the new bundle is deployed.
--
-- NOT RUNTIME-VERIFIABLE here (no live DB): proven statically + by this
--   migration's own $catalog$/$verify$ at APPLY time.
--
-- ROLLBACK: DROP FUNCTION public.complete_booking_service(uuid, text);
--   (the pre-existing broad RLS still permits the old client write path).
BEGIN;

SET search_path = public, pg_temp;
-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Every booking table this RPC can target must expose
-- its provider column, its amount column (numeric), and the uniform status /
-- customer_id / work_completed_at / settlement_status columns. The settlement,
-- audit, notification, platform-fee and provider-ownership tables must match
-- the shapes this RPC writes/reads.
-- ===========================================================================
DO $catalog$
DECLARE
    r       record;
    v_col   text;
    v_numok boolean;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('bookings','provider_id','amount'),
            ('photography_package_bookings','photographer_id','total_amount'),
            ('catering_bookings','provider_id','total_amount'),
            ('drone_bookings','provider_id','total_amount'),
            ('videography_bookings','provider_id','total_amount'),
            ('dj_bookings','provider_id','total_amount'),
            ('decorator_bookings','provider_id','total_amount'),
            ('makeup_bookings','provider_id','total_amount'),
            ('mehendi_bookings','provider_id','total_amount'),
            ('anchor_bookings','provider_id','total_amount'),
            ('banquet_bookings','provider_id','total_amount'),
            ('rental_bookings','provider_id','total_amount'),
            ('priest_bookings','provider_id','total_amount'),
            ('water_bookings','provider_id','total_amount'),
            ('band_bookings','provider_id','total_amount'),
            ('singer_bookings','provider_id','total_amount'),
            ('dancer_bookings','provider_id','total_amount')
        ) AS t(tbl, pcol, acol)
    LOOP
        FOREACH v_col IN ARRAY ARRAY[r.pcol, r.acol, 'status', 'customer_id', 'work_completed_at', 'settlement_status']
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_attribute a
                 WHERE a.attrelid = ('public.' || r.tbl)::regclass
                   AND a.attname = v_col AND a.attnum > 0 AND NOT a.attisdropped
            ) THEN
                RAISE EXCEPTION 'ABORT complete_booking_service: %.% missing.', r.tbl, v_col;
            END IF;
        END LOOP;
        SELECT ty.typcategory = 'N' INTO v_numok
          FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
         WHERE a.attrelid = ('public.' || r.tbl)::regclass AND a.attname = r.acol;
        IF NOT COALESCE(v_numok, false) THEN
            RAISE EXCEPTION 'ABORT complete_booking_service: %.% is not numeric.', r.tbl, r.acol;
        END IF;
    END LOOP;
    -- Supporting tables the RPC reads from / writes to.
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.platform_settings'::regclass AND a.attname='value' AND NOT a.attisdropped) THEN
        RAISE EXCEPTION 'ABORT complete_booking_service: platform_settings.value missing.';
    END IF;
    FOREACH v_col IN ARRAY ARRAY['booking_id','booking_table','vendor_id','vendor_user_id','customer_id','booking_amount','platform_fee_rate','platform_fee_amount','vendor_earnings','advance_paid','remaining_due','settlement_status']
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.vendor_settlements'::regclass AND a.attname=v_col AND a.attnum>0 AND NOT a.attisdropped) THEN
            RAISE EXCEPTION 'ABORT complete_booking_service: vendor_settlements.% missing.', v_col;
        END IF;
    END LOOP;
    FOREACH v_col IN ARRAY ARRAY['booking_table','booking_id','event_type','actor_id','actor_role','metadata']
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.booking_events'::regclass AND a.attname=v_col AND a.attnum>0 AND NOT a.attisdropped) THEN
            RAISE EXCEPTION 'ABORT complete_booking_service: booking_events.% missing.', v_col;
        END IF;
    END LOOP;
    FOREACH v_col IN ARRAY ARRAY['user_id','title','message','type','reference_id','is_read']
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.notifications'::regclass AND a.attname=v_col AND a.attnum>0 AND NOT a.attisdropped) THEN
            RAISE EXCEPTION 'ABORT complete_booking_service: notifications.% missing.', v_col;
        END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.provider_profiles'::regclass AND a.attname='user_id' AND NOT a.attisdropped) THEN
        RAISE EXCEPTION 'ABORT complete_booking_service: provider_profiles.user_id missing.';
    END IF;

    RAISE NOTICE 'OK: complete_booking_service preconditions satisfied.';
END $catalog$;
-- ===========================================================================
-- The authoritative completion RPC. One transaction: resolve -> read -> authz
-- -> idempotency -> state check -> fee -> complete -> settle -> audit -> notify.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.complete_booking_service(
    p_booking_id     uuid,
    p_booking_source text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid             uuid := auth.uid();
    v_table           text;
    v_pcol            text;
    v_acol            text;
    v_is_enum         boolean := false;
    v_status          text;
    v_work_completed  timestamptz;
    v_customer_id     uuid;
    v_provider_id     uuid;
    v_amount          numeric;
    v_existing        uuid;
    v_fee             jsonb;
    v_fee_enabled     boolean;
    v_fee_type        text;
    v_fee_rate        numeric;
    v_stored_rate     numeric;
    v_platform_fee    numeric;
    v_vendor_earnings numeric;
    v_advance_paid    numeric;
    v_remaining_due   numeric;
    v_settlement_id   uuid;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You are not authorized to complete this service' USING ERRCODE = '42501';
    END IF;

    -- Resolve table + provider/amount columns from a FIXED whitelist only.
    CASE p_booking_source
        WHEN 'generic'     THEN v_table := 'bookings';                      v_pcol := 'provider_id';     v_acol := 'amount';       v_is_enum := true;
        WHEN 'photography' THEN v_table := 'photography_package_bookings';  v_pcol := 'photographer_id'; v_acol := 'total_amount';
        WHEN 'catering'    THEN v_table := 'catering_bookings';             v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'drone'       THEN v_table := 'drone_bookings';                v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'videography' THEN v_table := 'videography_bookings';          v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'dj'          THEN v_table := 'dj_bookings';                   v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'decorator'   THEN v_table := 'decorator_bookings';            v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'makeup'      THEN v_table := 'makeup_bookings';               v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'mehendi'     THEN v_table := 'mehendi_bookings';              v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'anchor'      THEN v_table := 'anchor_bookings';               v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'banquet'     THEN v_table := 'banquet_bookings';              v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'rental'      THEN v_table := 'rental_bookings';               v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'priest'      THEN v_table := 'priest_bookings';               v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'water'       THEN v_table := 'water_bookings';                v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'band'        THEN v_table := 'band_bookings';                 v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'singer'      THEN v_table := 'singer_bookings';               v_pcol := 'provider_id';     v_acol := 'total_amount';
        WHEN 'dancer'      THEN v_table := 'dancer_bookings';               v_pcol := 'provider_id';     v_acol := 'total_amount';
        ELSE RAISE EXCEPTION 'Unknown booking source: %', p_booking_source USING ERRCODE = '22023';
    END CASE;

    -- Authoritative read of the stored row; lock it to serialize concurrent completes.
    EXECUTE format(
        'SELECT status::text, work_completed_at, customer_id, %I, %I FROM public.%I WHERE id = $1 FOR UPDATE',
        v_pcol, v_acol, v_table
    ) INTO v_status, v_work_completed, v_customer_id, v_provider_id, v_amount USING p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002';
    END IF;

    -- Only the booking's PROVIDER may complete it (SECURITY DEFINER preserves auth.uid()).
    IF NOT EXISTS (
        SELECT 1 FROM public.provider_profiles pp
         WHERE pp.id = v_provider_id AND pp.user_id = v_uid
    ) THEN
        RAISE EXCEPTION 'You are not authorized to complete this service' USING ERRCODE = '42501';
    END IF;

    -- Idempotent: an existing settlement means completion already happened.
    SELECT id INTO v_existing
      FROM public.vendor_settlements
     WHERE booking_id = p_booking_id AND booking_table = v_table
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RETURN v_existing;
    END IF;

    IF v_work_completed IS NOT NULL THEN
        RAISE EXCEPTION 'Service already completed' USING ERRCODE = '55000';
    END IF;
    IF v_status <> 'in_progress' THEN
        RAISE EXCEPTION 'Service has not started yet' USING ERRCODE = '55000';
    END IF;
    IF v_amount IS NULL OR v_amount < 0 THEN
        RAISE EXCEPTION 'Booking amount is not set' USING ERRCODE = '22023';
    END IF;

    -- Platform fee from the single source of truth (same as the rest of the app).
    SELECT value INTO v_fee FROM public.platform_settings WHERE key = 'platform_fee';
    v_fee_enabled := COALESCE((v_fee ->> 'enabled')::boolean, true);
    v_fee_type    := COALESCE(v_fee ->> 'type', 'percentage');
    v_fee_rate    := COALESCE((v_fee ->> 'rate')::numeric, 5);

    IF NOT v_fee_enabled THEN
        v_platform_fee := 0;
        v_stored_rate  := 0;
    ELSIF v_fee_type = 'fixed' THEN
        v_platform_fee := round(least(v_fee_rate, v_amount));
        v_stored_rate  := 0;
    ELSE
        v_platform_fee := round(v_amount * v_fee_rate / 100);
        v_stored_rate  := v_fee_rate;
    END IF;

    v_vendor_earnings := v_amount - v_platform_fee;
    v_advance_paid    := round(v_amount * 0.2);   -- 20% advance already paid
    v_remaining_due   := v_amount - v_advance_paid;

    -- Mark the booking completed. The BEFORE UPDATE OF status trigger still
    -- validates the in_progress -> completed edge and the provider actor binding.
    IF v_is_enum THEN
        EXECUTE format(
            'UPDATE public.%I SET status = %L::public.booking_status, work_completed_at = now(), settlement_status = %L WHERE id = $1',
            v_table, 'completed', 'pending'
        ) USING p_booking_id;
    ELSE
        EXECUTE format(
            'UPDATE public.%I SET status = %L, work_completed_at = now(), settlement_status = %L WHERE id = $1',
            v_table, 'completed', 'pending'
        ) USING p_booking_id;
    END IF;

    INSERT INTO public.vendor_settlements (
        booking_id, booking_table, vendor_id, vendor_user_id, customer_id,
        booking_amount, platform_fee_rate, platform_fee_amount, vendor_earnings,
        advance_paid, remaining_due, settlement_status
    ) VALUES (
        p_booking_id, v_table, v_provider_id::text, v_uid, v_customer_id,
        v_amount, v_stored_rate, v_platform_fee, v_vendor_earnings,
        v_advance_paid, v_remaining_due, 'pending'
    ) RETURNING id INTO v_settlement_id;

    INSERT INTO public.booking_events (
        booking_table, booking_id, event_type, actor_id, actor_role, metadata
    ) VALUES (
        v_table, p_booking_id, 'WORK_COMPLETED', v_uid, 'vendor',
        jsonb_build_object('vendor_id', v_provider_id::text, 'completed_at', now(),
                           'booking_amount', v_amount, 'vendor_earnings', v_vendor_earnings)
    );

    INSERT INTO public.notifications (
        user_id, title, message, type, reference_id, is_read
    ) VALUES (
        v_customer_id, 'Service Completed',
        'Your service has been completed. Thank you for using Vowza!',
        'booking_completed', p_booking_id, false
    );

    RETURN v_settlement_id;
END $fn$;
-- ===========================================================================
-- Least privilege: only authenticated callers may invoke; never anon/public.
-- ===========================================================================
REVOKE ALL ON FUNCTION public.complete_booking_service(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_booking_service(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_booking_service(uuid, text) TO authenticated;
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK.
-- ===========================================================================
DO $verify$
DECLARE
    v_secdef boolean;
    v_cfg    text;
BEGIN
    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_cfg
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'complete_booking_service';
    IF v_secdef IS NULL THEN
        RAISE EXCEPTION 'FAILED: complete_booking_service() was not created.';
    END IF;
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: complete_booking_service() is not SECURITY DEFINER.';
    END IF;
    IF v_cfg IS NULL OR v_cfg NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: complete_booking_service() has no hardened search_path (got %).', v_cfg;
    END IF;
    IF has_function_privilege('anon', 'public.complete_booking_service(uuid, text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAILED: anon can execute complete_booking_service().';
    END IF;
    IF NOT has_function_privilege('authenticated', 'public.complete_booking_service(uuid, text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot execute complete_booking_service().';
    END IF;

    RAISE NOTICE 'OK: complete_booking_service installed, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';

