-- 20261229000000_videography_booking_server_authoritative.sql
--
-- P0-1 (videography category): move booking financial authority off the browser.
--
-- BEFORE: src/components/VideographyMenu.tsx (the "Book Now" modal) inserted
--   directly into public.videography_bookings with base_amount / addons_amount /
--   total_amount / advance_amount / remaining_amount taken from CLIENT-computed
--   values, and the generic cart path in src/pages/Checkout.tsx did the same via a
--   dynamic-table INSERT using a flat ADVANCE_PERCENT = 20 and the CLIENT cart
--   item.price as the base. (The UnifiedPhotographyVideographyMenu.tsx path is
--   cart-only — it adds a videography_bookings item to the cart and checks out
--   through that same Checkout path.) A tampered client could post any amounts
--   (e.g. total_amount = 1) and the row would persist them. Videography's columns
--   venue / city / special_requirements DO exist, so — unlike priest/rental — the
--   generic cart INSERT was not additionally broken, but it trusted amounts AND
--   used a flat 20% advance instead of the package's advance_percentage that
--   VideographyMenu HONORS.
--
-- AFTER: the browser calls public.create_videography_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_videography_bookings_column_lockdown.sql
-- and must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from VideographyMenu.tsx (P0-1 — preserve business
-- logic; do not "fix" it here):
--   base    = coalesce(nullif(starting_price,0), nullif(package_price,0), 0) --
--             VideographyMenu's Number(pkg.starting_price || pkg.package_price ||
--             0): starting_price wins when non-zero, else package_price, else 0.
--             Videography has NO quantity/multiplier — total is base + addons, and
--             the ancillary price columns (extra_hour_cost, full_day_price, ...)
--             the menu never totals are ignored here too.
--   addons  = sum(price) of the passed addon ids that belong to the package.
--             videography_addons HAS an is_active column, but — matching the band
--             pilot / singer convention — this RPC does NOT filter on it: it sums
--             any passed ids that belong to the package. VideographyMenu and the
--             cart path pass NO addon ids today (selected_addon_ids = [],
--             addons_amount = 0), so the CURRENT flow yields 0 addons; a future
--             addon-carrying caller is priced from the trusted rows.
--   total   = base + addons
--   advance = round(total * advance_percentage / 100) -- VIDEOGRAPHY HONORS the
--             package's per-package advance_percentage (integer DEFAULT 20), like
--             dancer/makeup/mehendi/priest/rental/singer — NOT a flat 20%. Mirrors
--             VideographyMenu's Number(pkg.advance_percentage || 20): NULL/0 -> 20.
--   remaining = total - advance
--   Videography STORES advance/remaining AT CREATION (mirrors VideographyMenu,
--   which writes all five amounts at insert time — like dancer/priest/rental/
--   singer). event_type is NOT defaulted to package_type (VideographyMenu writes
--   eventType || null with NO fallback). event_type / venue / city /
--   special_requirements are DESCRIPTIVE fields only — never pricing inputs.
--
-- ROLLBACK:
--   DROP FUNCTION public.create_videography_booking(uuid,date,text,text,text,text,text,uuid[]);
--   Then the old VideographyMenu / Checkout direct-insert paths must be restored
--   for videography bookings to keep working; nothing else depends on this RPC.
BEGIN;

-- ---------------------------------------------------------------------------
-- Fail-closed pre-flight: abort the whole migration if the columns this RPC
-- writes/derives from are missing or the wrong type. Never silently create a
-- function that would compute wrong money on a drifted schema.
-- ---------------------------------------------------------------------------
DO $catalog$
DECLARE
  v_missing text;
  v_price_type text;
  v_pkgprice_type text;
  v_pct_type text;
BEGIN
  -- Required columns on public.videography_packages (pricing source of truth).
  SELECT string_agg(needed.col, ', ')
    INTO v_missing
  FROM (VALUES ('id'), ('provider_id'), ('status'), ('starting_price'),
               ('package_price'), ('advance_percentage')) AS needed(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.videography_packages'::regclass
      AND a.attname = needed.col
      AND a.attnum > 0
      AND NOT a.attisdropped
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'videography_packages missing column(s): %', v_missing;
  END IF;
  -- Required columns on public.videography_addons (addon pricing).
  SELECT string_agg(needed.col, ', ')
    INTO v_missing
  FROM (VALUES ('id'), ('package_id'), ('price')) AS needed(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.videography_addons'::regclass
      AND a.attname = needed.col
      AND a.attnum > 0
      AND NOT a.attisdropped
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'videography_addons missing column(s): %', v_missing;
  END IF;

  -- Required columns on public.videography_bookings (insert target).
  SELECT string_agg(needed.col, ', ')
    INTO v_missing
  FROM (VALUES ('id'), ('package_id'), ('provider_id'), ('customer_id'),
               ('event_date'), ('event_time'), ('event_type'), ('venue'),
               ('city'), ('special_requirements'), ('selected_addon_ids'),
               ('base_amount'), ('addons_amount'), ('total_amount'),
               ('advance_amount'), ('remaining_amount'), ('status')) AS needed(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.videography_bookings'::regclass
      AND a.attname = needed.col
      AND a.attnum > 0
      AND NOT a.attisdropped
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'videography_bookings missing column(s): %', v_missing;
  END IF;

  -- Type guards: money columns must be numeric; advance_percentage integer.
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_type
    FROM pg_attribute a
   WHERE a.attrelid = 'public.videography_packages'::regclass
     AND a.attname = 'starting_price';
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_pkgprice_type
    FROM pg_attribute a
   WHERE a.attrelid = 'public.videography_packages'::regclass
     AND a.attname = 'package_price';
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_pct_type
    FROM pg_attribute a
   WHERE a.attrelid = 'public.videography_packages'::regclass
     AND a.attname = 'advance_percentage';
  IF v_price_type NOT LIKE 'numeric%' THEN
    RAISE EXCEPTION 'videography_packages.starting_price is % (expected numeric)', v_price_type;
  END IF;
  IF v_pkgprice_type NOT LIKE 'numeric%' THEN
    RAISE EXCEPTION 'videography_packages.package_price is % (expected numeric)', v_pkgprice_type;
  END IF;
  IF v_pct_type NOT LIKE 'integer%' THEN
    RAISE EXCEPTION 'videography_packages.advance_percentage is % (expected integer)', v_pct_type;
  END IF;
END
$catalog$;
-- ---------------------------------------------------------------------------
-- create_videography_booking: the ONLY authorized way for the browser to make a
-- videography booking. Takes identifiers / selections / descriptive fields ONLY;
-- every financial value is derived here from trusted rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_videography_booking(
  p_package_id uuid,
  p_event_date date,
  p_event_time text DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_venue text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_special_requirements text DEFAULT NULL,
  p_addon_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_pkg public.videography_packages%ROWTYPE;
  v_base numeric(12,2);
  v_addons numeric(12,2);
  v_total numeric(12,2);
  v_pct integer;
  v_advance numeric(12,2);
  v_remaining numeric(12,2);
  v_valid_ids uuid[];
  v_booking_id uuid;
BEGIN
  -- 1. Authentication: customer_id can NEVER come from the browser.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '28000';
  END IF;

  -- 2. Load + lock the authoritative package row (price, provider, advance%).
  SELECT * INTO v_pkg
    FROM public.videography_packages
   WHERE id = p_package_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Videography package % not found', p_package_id
      USING errcode = 'P0002';
  END IF;
  IF v_pkg.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Videography package % is not active', p_package_id
      USING errcode = 'P0002';
  END IF;
  -- 3. Base price — first non-zero of starting_price then package_price, else 0.
  --    Mirrors VideographyMenu's Number(pkg.starting_price || pkg.package_price
  --    || 0). NO quantity multiplier for videography.
  v_base := coalesce(nullif(v_pkg.starting_price, 0), nullif(v_pkg.package_price, 0), 0);

  -- 4. Addons — sum the passed ids that BELONG to this package, from the trusted
  --    videography_addons rows. NO is_active filter (band pilot / singer
  --    convention): the id must belong to the package, and the price is taken
  --    from the row, so a tampered client can neither borrow another package's
  --    addon nor set the price. Today the flow passes none (addons_amount = 0).
  SELECT coalesce(sum(a.price), 0),
         coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
    INTO v_addons, v_valid_ids
    FROM public.videography_addons a
   WHERE a.package_id = v_pkg.id
     AND a.id = ANY(p_addon_ids);

  -- 5. Derive every financial value server-side.
  v_total := v_base + v_addons;
  v_pct := coalesce(nullif(v_pkg.advance_percentage, 0), 20);   -- HONOR pkg rate.
  v_advance := round(v_total * v_pct / 100.0);
  v_remaining := v_total - v_advance;

  -- 6. Insert atomically. customer_id is FORCED to auth.uid(); provider_id comes
  --    from the trusted package row; all five amounts are server-derived and
  --    STORED at creation (mirrors VideographyMenu).
  INSERT INTO public.videography_bookings (
    package_id, provider_id, customer_id,
    event_date, event_time, event_type, venue, city, special_requirements,
    selected_addon_ids,
    base_amount, addons_amount, total_amount, advance_amount, remaining_amount,
    status
  ) VALUES (
    v_pkg.id, v_pkg.provider_id, v_uid,
    p_event_date, nullif(p_event_time, ''), nullif(p_event_type, ''),
    nullif(p_venue, ''), nullif(p_city, ''), nullif(p_special_requirements, ''),
    v_valid_ids,
    v_base, v_addons, v_total, v_advance, v_remaining,
    'pending'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END
$fn$;
-- ---------------------------------------------------------------------------
-- Least privilege: only authenticated end users may call this. anon / PUBLIC
-- must not; the SECURITY DEFINER body still forces auth.uid().
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_videography_booking(uuid,date,text,text,text,text,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_videography_booking(uuid,date,text,text,text,text,text,uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Fail-closed post-conditions: prove the function landed exactly as intended.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_count integer;
  v_secdef boolean;
  v_config text[];
  v_anon boolean;
  v_auth boolean;
BEGIN
  SELECT count(*), bool_and(p.prosecdef)
    INTO v_count, v_secdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'create_videography_booking';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 create_videography_booking, found %', v_count;
  END IF;
  IF NOT v_secdef THEN
    RAISE EXCEPTION 'create_videography_booking is not SECURITY DEFINER';
  END IF;

  SELECT p.proconfig INTO v_config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_videography_booking';
  IF v_config IS NULL OR NOT (array_to_string(v_config, ',') LIKE '%search_path=%') THEN
    RAISE EXCEPTION 'create_videography_booking has no pinned search_path';
  END IF;

  v_anon := has_function_privilege('anon',
    'public.create_videography_booking(uuid,date,text,text,text,text,text,uuid[])', 'EXECUTE');
  v_auth := has_function_privilege('authenticated',
    'public.create_videography_booking(uuid,date,text,text,text,text,text,uuid[])', 'EXECUTE');
  IF v_anon THEN
    RAISE EXCEPTION 'anon must NOT execute create_videography_booking';
  END IF;
  IF NOT v_auth THEN
    RAISE EXCEPTION 'authenticated must execute create_videography_booking';
  END IF;
END
$verify$;

COMMIT;

-- Reload PostgREST so the new RPC is exposed immediately.
NOTIFY pgrst, 'reload schema';
