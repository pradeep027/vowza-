-- 20261243000000_pay_booking_advance_authoritative.sql
--
-- P0 Phase E (pay-advance / lifecycle integrity) — SERVER-AUTHORITATIVE advance
-- payment. Before this, the "Pay 20% Advance" flow ran entirely in the browser:
-- src/pages/MyBookings.tsx::handlePayAdvance and the inline onClick in
-- src/pages/customer/MyBookingsPage.tsx each raw-UPDATEd the booking row
--     advance_paid_at = now(), confirmed_at = now(), calendar_locked = true,
--     status = 'in_progress'
-- with a client-computed advance (Math.round(booking.amount * 0.2)), and the
-- advance_amount financial column was never persisted server-side at all. Any
-- signed-in user who could UPDATE the row could therefore flip these lifecycle
-- flags (unlock the provider-contact "paywall", lock a calendar) without the
-- booking being accepted, out of transition order, or as the wrong party.
--
-- This migration moves the whole advance step into one hardened SECURITY DEFINER
-- RPC, public.pay_booking_advance(p_booking_id uuid, p_booking_source text)
-- RETURNS numeric. The RPC:
--   * resolves the booking table + provider/amount columns from a FIXED CASE
--     whitelist (unknown source -> 22023), never from client-supplied SQL;
--   * reads the AUTHORITATIVE amount + customer + status from the stored row
--     (FOR UPDATE), never from the client;
--   * authorizes the caller as the booking's CUSTOMER (else 42501) — the
--     SECURITY DEFINER context preserves auth.uid();
--   * is IDEMPOTENT: if the advance was already paid (advance_paid_at set) it
--     returns the stored advance instead of re-writing (safe to retry);
--   * requires status='accepted' (else 55000) and a valid amount (else 22023);
--   * server-derives the advance as round(amount * 0.2) — the SAME 20% rule the
--     whole app uses (completeService, cancel refund, both pay-advance sites) —
--     and persists advance_amount + advance_paid_at + confirmed_at +
--     calendar_locked + status='in_progress' in ONE transaction. The status
--     write still fires the Phase C BEFORE-UPDATE trigger, which validates the
--     accepted -> in_progress edge and the customer actor binding.
--
-- The customer+provider notification stays client-side (NotificationService):
-- the RPC returns the derived advance so the browser can render it.
--
-- CLASSIFICATION: SECURITY FIX (the advance amount + the actor are now
--   server-derived/-bound; a customer can no longer flip the lifecycle flags out
--   of order or on an unaccepted booking) + BUG FIX (advance_amount is now
--   actually persisted). ADDITIVE — adds one RPC; revokes nothing. The companion
--   lifecycle-column lockdown (moving advance_paid_at / confirmed_at /
--   calendar_locked out of the per-table benign UPDATE allowlist) also depends on
--   the cancel/decline paths becoming RPCs, so it is deferred, not shipped here.
--
-- NOT RUNTIME-VERIFIABLE here (no live DB): proven statically + by this
--   migration's own $catalog$/$verify$ at APPLY time.
--
-- ROLLBACK: DROP FUNCTION public.pay_booking_advance(uuid, text);
--   (the pre-existing benign-column UPDATE grant still permits the old client
--   write path).
BEGIN;

SET search_path = public, pg_temp;
-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Every booking table this RPC can target must expose
-- its provider column, its amount column (numeric), advance_amount (numeric),
-- and the uniform status / customer_id / advance_paid_at / confirmed_at /
-- calendar_locked columns this RPC reads/writes.
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
        FOREACH v_col IN ARRAY ARRAY[r.pcol, r.acol, 'status', 'customer_id', 'advance_amount', 'advance_paid_at', 'confirmed_at', 'calendar_locked']
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_attribute a
                 WHERE a.attrelid = ('public.' || r.tbl)::regclass
                   AND a.attname = v_col AND a.attnum > 0 AND NOT a.attisdropped
            ) THEN
                RAISE EXCEPTION 'ABORT pay_booking_advance: %.% missing.', r.tbl, v_col;
            END IF;
        END LOOP;
        -- The amount column and advance_amount must both be numeric.
        FOREACH v_col IN ARRAY ARRAY[r.acol, 'advance_amount']
        LOOP
            SELECT ty.typcategory = 'N' INTO v_numok
              FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
             WHERE a.attrelid = ('public.' || r.tbl)::regclass AND a.attname = v_col;
            IF NOT COALESCE(v_numok, false) THEN
                RAISE EXCEPTION 'ABORT pay_booking_advance: %.% is not numeric.', r.tbl, v_col;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'OK: pay_booking_advance preconditions satisfied.';
END $catalog$;
-- ===========================================================================
-- The authoritative advance RPC. One transaction: resolve -> read -> authz
-- -> idempotency -> state check -> derive 20% -> persist flags + status.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.pay_booking_advance(
    p_booking_id     uuid,
    p_booking_source text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid          uuid := auth.uid();
    v_table        text;
    v_pcol         text;
    v_acol         text;
    v_is_enum      boolean := false;
    v_status       text;
    v_customer_id  uuid;
    v_provider_id  uuid;
    v_amount       numeric;
    v_advance_at   timestamptz;
    v_advance      numeric;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You are not authorized to pay this advance' USING ERRCODE = '42501';
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

    -- Authoritative read of the stored row; lock it to serialize concurrent pays.
    EXECUTE format(
        'SELECT status::text, customer_id, %I, %I, advance_paid_at FROM public.%I WHERE id = $1 FOR UPDATE',
        v_pcol, v_acol, v_table
    ) INTO v_status, v_customer_id, v_provider_id, v_amount, v_advance_at USING p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002';
    END IF;

    -- Only the booking's CUSTOMER may pay its advance (SECURITY DEFINER preserves auth.uid()).
    IF v_customer_id IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'You are not authorized to pay this advance' USING ERRCODE = '42501';
    END IF;

    -- Idempotent: advance already paid -> return the stored advance, do not re-write.
    IF v_advance_at IS NOT NULL THEN
        RETURN round(COALESCE(v_amount, 0) * 0.2);
    END IF;

    IF v_status <> 'accepted' THEN
        RAISE EXCEPTION 'Advance can only be paid on an accepted booking' USING ERRCODE = '55000';
    END IF;
    IF v_amount IS NULL OR v_amount < 0 THEN
        RAISE EXCEPTION 'Booking amount is not set' USING ERRCODE = '22023';
    END IF;

    v_advance := round(v_amount * 0.2);   -- 20% advance, the single app-wide rule

    -- Persist the advance + lifecycle flags. The status write fires the Phase C
    -- BEFORE UPDATE OF status trigger (accepted -> in_progress, customer actor).
    IF v_is_enum THEN
        EXECUTE format(
            'UPDATE public.%I SET advance_amount = $1, advance_paid_at = now(), confirmed_at = now(), calendar_locked = true, status = %L::public.booking_status WHERE id = $2',
            v_table, 'in_progress'
        ) USING v_advance, p_booking_id;
    ELSE
        EXECUTE format(
            'UPDATE public.%I SET advance_amount = $1, advance_paid_at = now(), confirmed_at = now(), calendar_locked = true, status = %L WHERE id = $2',
            v_table, 'in_progress'
        ) USING v_advance, p_booking_id;
    END IF;

    RETURN v_advance;
END $fn$;
-- ===========================================================================
-- Least privilege: only authenticated callers may invoke; never anon/public.
-- ===========================================================================
REVOKE ALL ON FUNCTION public.pay_booking_advance(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_booking_advance(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.pay_booking_advance(uuid, text) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'pay_booking_advance';
    IF v_secdef IS NULL THEN
        RAISE EXCEPTION 'FAILED: pay_booking_advance() was not created.';
    END IF;
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: pay_booking_advance() is not SECURITY DEFINER.';
    END IF;
    IF v_cfg IS NULL OR v_cfg NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: pay_booking_advance() has no hardened search_path (got %).', v_cfg;
    END IF;
    IF has_function_privilege('anon', 'public.pay_booking_advance(uuid, text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAILED: anon can execute pay_booking_advance().';
    END IF;
    IF NOT has_function_privilege('authenticated', 'public.pay_booking_advance(uuid, text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot execute pay_booking_advance().';
    END IF;

    RAISE NOTICE 'OK: pay_booking_advance installed, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';

