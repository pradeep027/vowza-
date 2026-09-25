-- PHASE_provider_column_lockdown.sql
--
-- P0-2 (BREAKING HALF): revoke authenticated's table-wide UPDATE on
-- public.provider_profiles and grant UPDATE back on ONLY the benign,
-- vendor-editable columns. This is the change that actually closes the
-- direct-PATCH self-approval hole: after it lands, a signed-in vendor's PATCH
-- of verification_status, is_verified, is_published, is_featured, verified_*,
-- rejection_reason, is_bank_verified, the KYC/liveness columns, or the
-- reputation counters returns HTTP 403 / SQLSTATE 42501 from PostgREST.
--
-- =========================== DO NOT db push YET ============================
-- PARKED OUTSIDE supabase/migrations/ ON PURPOSE. `supabase db push` ignores
-- this directory, so it cannot ship by accident. It is a BREAKING change and
-- MUST NOT be applied until ALL of the following are live in production and
-- verified against the SERVED bundle (asset hashes and cached HTML lie):
--
--   PRECONDITION 1  The additive migration
--     20261204000000_provider_verification_authority.sql is applied in prod
--     (admin_set_provider_verification + provider_resubmit_for_review RPCs and
--     the clamp/bank triggers exist). Without it the admin panel and the vendor
--     resubmit button lose their only writer and BREAK.
--   PRECONDITION 2  The rewired frontend is deployed and confirmed live:
--       * src/services/approvalService.ts approve/reject/suspend  -> RPC
--       * src/pages/AdminDashboard.tsx handleVerification          -> RPC
--       * src/pages/VendorEditProfile.tsx resubmit (:230)          -> RPC
--       * src/hooks/useVendorData.ts saveBankDetails: is_bank_verified dropped
--     If the OLD frontend is still served, its direct PATCHes begin returning
--     403 and admin approval / vendor resubmit / bank-save silently fail.
--
-- PROMOTING IT (per supabase/migrations-pending/README.md):
--   1. Confirm PRECONDITION 1 (RPCs/triggers live) and PRECONDITION 2 (served
--      bundle carries the rewired call sites).
--   2. git mv supabase/migrations-pending/PHASE_provider_column_lockdown.sql \
--        supabase/migrations/<next-timestamp>_provider_column_lockdown.sql
--   3. supabase db push
--   4. Negative probe as a real vendor session: PATCH provider_profiles
--      verification_status -> expect 403; PATCH bio -> expect 200.
--
-- ROLLBACK (emergency restore of the pre-lockdown behaviour only):
--   GRANT UPDATE ON public.provider_profiles TO authenticated;
--   NOTIFY pgrst, 'reload schema';
--   (This RE-OPENS the hole; use only to unblock the old frontend.)
--
-- Requires: 20261204000000_provider_verification_authority.sql.

BEGIN;

SET search_path = public, pg_temp;

-- 1) Remove the table-wide UPDATE that lets a row owner PATCH any column.
REVOKE UPDATE ON public.provider_profiles FROM PUBLIC, anon, authenticated;

-- 2) Grant UPDATE back on ONLY the benign, vendor-editable columns. Every
--    column NOT listed here stays non-updatable by authenticated and can be
--    written solely by the SECURITY DEFINER RPCs / triggers from the additive
--    migration (which run as the table owner and are not subject to these
--    column grants). SELECT / INSERT / DELETE are intentionally left untouched:
--    the clamp trigger (BEFORE INSERT) neutralises trust columns on new rows,
--    so authenticated keeps full INSERT for registration.
GRANT UPDATE (
    available_dates, available_days, band_category,
    bank_account_holder, bank_account_number, bank_ifsc, bank_name,
    bio, branch_name, business_hours, category_details,
    cover_banner_url, cover_image_url, experience_years, extra_charges,
    facebook, faqs, gallery_urls, gst_number, instagram, instant_booking,
    is_available, languages, onboarding_completed, performance_type,
    price_max, price_min, pricing_type, service_areas, service_radius,
    social_links, specialties, stage_name, subcategory, travel_charges,
    updated_at, vendor_details, video_urls, website, whatsapp, youtube
) ON public.provider_profiles TO authenticated;

-- ===========================================================================
-- STATIC PROOF (privilege catalogue). Asserts, without touching data, that the
-- grant matrix is exactly right and that no column escaped classification.
-- ===========================================================================
DO $catalog$
DECLARE
    benign text[] := ARRAY[
        'available_dates','available_days','band_category',
        'bank_account_holder','bank_account_number','bank_ifsc','bank_name',
        'bio','branch_name','business_hours','category_details',
        'cover_banner_url','cover_image_url','experience_years','extra_charges',
        'facebook','faqs','gallery_urls','gst_number','instagram','instant_booking',
        'is_available','languages','onboarding_completed','performance_type',
        'price_max','price_min','pricing_type','service_areas','service_radius',
        'social_links','specialties','stage_name','subcategory','travel_charges',
        'updated_at','vendor_details','video_urls','website','whatsapp','youtube'
    ];
    protected text[] := ARRAY[
        'aadhaar_status','aadhaar_verified_at','average_rating','created_at',
        'doc_verification_notes','featured_until','govt_id_status',
        'govt_id_verified_at','id','is_bank_verified','is_featured','is_published',
        'is_verified','liveness_attempts','liveness_provider','liveness_session_id',
        'liveness_verified','liveness_verified_at','pan_status','pan_verified_at',
        'profession','rejection_reason','total_bookings','total_reviews','user_id',
        'verification_status','verified_at','verified_by'
    ];
    c     text;
    v_bad text;
BEGIN
    -- (a) DRIFT GUARD: every live column must be classified in exactly one
    --     list. A new, unclassified column would otherwise silently stay
    --     revoked (breaking a write) or, if mis-listed as benign, open a hole.
    SELECT string_agg(a.attname, ', ') INTO v_bad
      FROM pg_attribute a
     WHERE a.attrelid = 'public.provider_profiles'::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
       AND NOT (a.attname = ANY(benign) OR a.attname = ANY(protected));
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: provider_profiles has unclassified column(s): %. Classify each as benign or protected before applying.', v_bad;
    END IF;

    -- (b) no column may appear in both lists.
    SELECT string_agg(x, ', ') INTO v_bad
      FROM (SELECT unnest(benign) INTERSECT SELECT unnest(protected)) t(x);
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: column(s) classified as BOTH benign and protected: %.', v_bad;
    END IF;

    -- (c) protected columns must NOT be UPDATE-able by authenticated.
    FOREACH c IN ARRAY protected LOOP
        IF has_column_privilege('authenticated', 'public.provider_profiles', c, 'UPDATE') THEN
            RAISE EXCEPTION 'FAILED: authenticated still holds UPDATE on protected column %.', c;
        END IF;
    END LOOP;

    -- (d) benign columns MUST remain UPDATE-able by authenticated.
    FOREACH c IN ARRAY benign LOOP
        IF NOT has_column_privilege('authenticated', 'public.provider_profiles', c, 'UPDATE') THEN
            RAISE EXCEPTION 'FAILED: authenticated lost UPDATE on benign column %.', c;
        END IF;
    END LOOP;

    RAISE NOTICE 'OK: % benign columns UPDATE-able, % protected columns locked.',
        array_length(benign, 1), array_length(protected, 1);
END $catalog$;

-- ===========================================================================
-- RUNTIME PROOF (direct Supabase-client mutation path). Impersonates a
-- signed-in vendor and proves the 9 mandated cases at the column-privilege
-- layer. Column-privilege checks fire at executor start, before any row is
-- scanned, so aiming at a non-existent row isolates the privilege decision
-- from RLS and live data (nothing is ever written).
--
--   Cases 1-6 (direct PATCH):
--     * benign field (bio)                 -> ALLOWED  (case 1)
--     * verification_status / is_verified /
--       is_published / is_featured /
--       verified_by / is_bank_verified /
--       reputation + KYC columns           -> DENIED 42501 (cases 2-6 + equiv.)
--   Cases 7-9 (admin/owner workflow) are enforced one layer up by the
--   has_role / ownership gates inside admin_set_provider_verification and
--   provider_resubmit_for_review (proven in 20261204000000's DO block): admin
--   approve/reject SUCCEED, any non-admin caller is audited 'denied'.
-- ===========================================================================
DO $probe$
DECLARE
    protected_probe text[] := ARRAY[
        'verification_status','is_verified','is_published','is_featured',
        'verified_by','is_bank_verified','average_rating','aadhaar_status',
        'liveness_verified','rejection_reason'
    ];
    c        text;
    v_ghost  uuid := '00000000-0000-0000-0000-000000000000';
    v_leaked text := NULL;   -- first protected column NOT denied (name + result)
    v_bio    text;           -- benign result
    v_res    text;
BEGIN
    -- Act as a signed-in vendor. Column-privilege checks fire at executor
    -- start, before any row is scanned, so a non-existent target row isolates
    -- the privilege decision from RLS and live data (nothing is written).
    SET LOCAL ROLE authenticated;

    FOREACH c IN ARRAY protected_probe LOOP
        BEGIN
            -- self-assignment keeps every column type-correct (no literal
            -- coercion that could raise before the privilege check).
            EXECUTE format('UPDATE public.provider_profiles SET %I = %I WHERE id = %L', c, c, v_ghost);
            v_res := 'ALLOWED';
        EXCEPTION
            WHEN insufficient_privilege THEN v_res := 'BLOCKED';
            WHEN others                 THEN v_res := 'OTHER_' || SQLSTATE;
        END;
        IF v_res <> 'BLOCKED' AND v_leaked IS NULL THEN
            v_leaked := c || '=' || v_res;
        END IF;
    END LOOP;

    -- A benign column must stay writable (0 rows matched is fine; only a
    -- privilege error would be a regression).
    BEGIN
        EXECUTE format('UPDATE public.provider_profiles SET bio = bio WHERE id = %L', v_ghost);
        v_bio := 'ALLOWED';
    EXCEPTION
        WHEN insufficient_privilege THEN v_bio := 'BLOCKED';
        WHEN others                 THEN v_bio := 'OTHER_' || SQLSTATE;
    END;

    RESET ROLE;

    -- Adjudicate as the migration role, with the vendor role already restored.
    IF v_leaked IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: a signed-in vendor was NOT denied direct UPDATE of a protected column (%). Expected BLOCKED (SQLSTATE 42501); the self-approval hole is still open.', v_leaked;
    END IF;
    IF v_bio <> 'ALLOWED' THEN
        RAISE EXCEPTION 'FAILED: a signed-in vendor can no longer UPDATE the benign column bio (probe result: %). Legitimate profile edits would break.', v_bio;
    END IF;

    RAISE NOTICE 'OK: direct vendor PATCH denied on all % probed protected columns, allowed on benign (P0-2 cases 1-6).',
        array_length(protected_probe, 1);
END $probe$;

COMMIT;

-- PostgREST caches column privileges with the schema; without this the 403s
-- do not take effect until the next DDL event.
NOTIFY pgrst, 'reload schema';

