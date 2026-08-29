-- 20261201000006_restrict_anon_column_access.sql
--
-- P0. Stops the `anon` role reading vendors' bank accounts and users' PII.
--
-- *** DEPLOY ORDER MATTERS. READ THIS FIRST. ***
--
-- The frontend change that accompanies this migration MUST be live on
-- vowza.co.in BEFORE this migration is applied. Vercel deploy first, then
-- `supabase db push`.
--
-- Reason: this migration withholds the SELECT privilege on 23 columns of
-- provider_profiles and 20 columns of profiles from anon. `SELECT *` requires
-- the SELECT privilege on EVERY column of the relation, so the moment this
-- lands, any surviving `select('*')` against those tables from an anonymous
-- session returns 42501 permission denied. Three anonymous-reachable queries
-- used `select('*')`; the accompanying commit replaces them with explicit
-- column lists drawn from src/lib/publicColumns.ts.
--
-- The frontend change is backward compatible -- explicit column lists work
-- fine against the current wide grant -- so deploying it early is safe. The
-- reverse order takes /artists, /category/:slug and /provider/:id down.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS EXPOSED
-- ---------------------------------------------------------------------------
-- anon holds GRANT ALL on both tables, and until 20261201000005 their RLS
-- policies were inert. 20261201000005 closed the write half. This closes the
-- read half. Until it lands, an anonymous GET with the sb_publishable_ key --
-- which is public by design and sits in the JS bundle -- returns every column
-- of every row, including:
--
--   provider_profiles, all 36 vendors:
--     bank_account_number, bank_ifsc, bank_account_holder, bank_name,
--     branch_name, is_bank_verified   -- full payout banking details
--     gst_number
--     aadhaar_status, aadhaar_verified_at, pan_status, pan_verified_at,
--     govt_id_status, govt_id_verified_at, doc_verification_notes
--     liveness_session_id, liveness_provider, liveness_verified,
--     liveness_verified_at, liveness_attempts
--     rejection_reason, verified_by, verified_at, onboarding_completed
--
--   profiles, all 66 users:
--     phone, alternate_phone, email, address, date_of_birth,
--     organization_name, preferences, metadata, is_blocked, is_active,
--     last_active_at, account_verified_at, phone_verified,
--     profile_completion_percentage, and the four notification flags
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS COLUMN-LEVEL GRANT AND NOT A POLICY
-- ---------------------------------------------------------------------------
-- RLS has no column dimension -- a policy decides which ROWS a caller sees,
-- never which columns. And restricting rows does not help here: the vendors
-- whose bank_account_number leaks are exactly the ones with
-- verification_status IN ('approved','verified'), i.e. the ones who must stay
-- publicly listed for the marketplace to function. There is no row predicate
-- that hides an approved vendor's bank details while showing their listing.
-- Column-level GRANT is the only mechanism that separates the two.
--
-- Conversely GRANT has no *value* dimension, which is why vendor_details
-- remains readable -- see the deferred item at the end.
--
-- ---------------------------------------------------------------------------
-- THE ALLOWLIST, AND HOW IT WAS DERIVED
-- ---------------------------------------------------------------------------
-- Not a guess. Every anonymous read path was enumerated from src/App.tsx's
-- route table (the 14 routes outside ProtectedRoute / AdminLayout /
-- CustomerLayout / VendorLayout) and each provider/profile field consumed by
-- those pages was traced, including fields read inside child components the
-- row is passed down to. The union is 46 of the 69 provider_profiles columns
-- and 7 of the 27 profiles columns. Both lists are mirrored in
-- src/lib/publicColumns.ts.
--
-- Three things the allowlist has to account for that a naive read of the
-- component tree would miss:
--
--   1. Filter and sort columns. PostgREST needs the SELECT privilege on any
--      column named in .eq() / .in() / .order() / .range(), not just the ones
--      rendered. That is why created_at, is_published, band_category,
--      verification_status and price_max are on the list.
--
--   2. public.search_vendors_sql -- the primary AI-planner path -- is
--      LANGUAGE plpgsql STABLE with NO SECURITY DEFINER, so it is SECURITY
--      INVOKER and runs under the CALLER's privileges, and it is granted to
--      anon. It reads pp.service_areas, which no component renders. Omitting
--      service_areas would break /ai-planner with a permission error rather
--      than a blank list. It also reads pr.city, pr.area, pr.full_name and
--      pr.avatar_url from profiles, all of which are on the profiles
--      allowlist. It is the only SECURITY INVOKER function touching either
--      table -- the other 34 are DEFINER and unaffected by these grants.
--
--   3. Columns read in code but absent from the schema. Components reference
--      provider.city, service_city, service_state, service_area,
--      business_name and contact_person, none of which are columns of
--      provider_profiles. Under `select('*')` they silently arrived undefined
--      and fell through to a profiles value or a literal. They are absent
--      from the allowlist AND from publicColumns.ts, because naming a
--      non-existent column in an explicit select is a hard 42703.
--
-- Two other anonymous-reachable queries were checked and need no change,
-- because they already name their columns and every name is on the allowlist:
-- ragRetriever.ts:303 (the /ai-planner fallback used when the RPC errors or
-- returns empty -- 15 columns including user_id and service_areas, filtering
-- on verification_status, is_verified, is_published and profession, ordering
-- by average_rating) and ragRetriever.ts:415 (selects id only). Navbar.tsx:146
-- likewise already uses explicit lists on both tables.
--
-- Not affected: authenticated. Every revoke below names anon only. The vendor
-- pages that legitimately read bank and KYC columns for their own row --
-- useVendorData.ts:92 and :1776, VendorWallet.tsx, VendorEditProfile.tsx:216,
-- ProviderDashboard.tsx:336 -- keep working unchanged, as do all the admin
-- screens, all of which sit behind a layout that enforces auth.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
--   GRANT SELECT ON TABLE public.provider_profiles TO anon;
--   GRANT SELECT ON TABLE public.profiles TO anon;
--   -- and recreate the two dropped policies with USING (true)
-- A table-level GRANT SELECT supersedes the column-level grants, so the first
-- two statements alone restore the previous read surface.
-- ===========================================================================

BEGIN;

-- ===========================================================================
-- SECTION 1 -- provider_profiles: 46 columns to anon, 23 withheld
-- ===========================================================================
-- Table-level SELECT must go first. A table-level grant is not the union of
-- the column grants -- it outranks them, so leaving it in place would make
-- every GRANT below decorative.
--
-- PUBLIC is named alongside anon because a privilege held through PUBLIC does
-- not appear in the per-role ACL and would survive a revoke aimed only at
-- anon. authenticated and service_role hold their own explicit grants and are
-- untouched.

REVOKE SELECT ON TABLE public.provider_profiles FROM PUBLIC, anon;

GRANT SELECT (
    average_rating,
    available_dates,
    available_days,
    band_category,
    bio,
    business_hours,
    category_details,
    cover_banner_url,
    cover_image_url,
    created_at,
    experience_years,
    extra_charges,
    facebook,
    faqs,
    featured_until,
    gallery_urls,
    id,
    instagram,
    instant_booking,
    is_available,
    is_featured,
    is_published,
    is_verified,
    languages,
    performance_type,
    price_max,
    price_min,
    pricing_type,
    profession,
    service_areas,
    service_radius,
    social_links,
    specialties,
    stage_name,
    subcategory,
    total_bookings,
    total_reviews,
    travel_charges,
    updated_at,
    user_id,
    vendor_details,
    verification_status,
    video_urls,
    website,
    whatsapp,
    youtube
) ON TABLE public.provider_profiles TO anon;

-- ===========================================================================
-- SECTION 2 -- profiles: 7 columns to anon, 20 withheld
-- ===========================================================================
-- phone and email are deliberately absent. ProviderProfile.tsx used to select
-- both and hand them to every anonymous visitor, but that file never rendered
-- either -- the select was the only occurrence of either identifier in it.
-- Vendor contact details belong behind authentication in a marketplace
-- regardless: an open phone/email column is a scraping and disintermediation
-- surface. If "show contact to logged-in users" is wanted later, add an
-- authenticated query; do not widen this grant.

REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon;

GRANT SELECT (
    area,
    avatar_url,
    city,
    district,
    full_name,
    id,
    state
) ON TABLE public.profiles TO anon;

-- ===========================================================================
-- SECTION 3 -- replace the two USING (true) SELECT policies
-- ===========================================================================
-- 20261201000005 enabled RLS on both tables, but each carries a SELECT policy
-- with USING (true) and no TO clause, so it applies to PUBLIC and returns
-- every row. Policies are PERMISSIVE and OR together, which means these two
-- individually defeat every other SELECT policy on their table -- notably
-- providers_public_read, which is correctly scoped and has been dead letter
-- next to a USING (true) sibling this whole time.
--
-- Dropping them is what finally makes providers_public_read load-bearing.

DROP POLICY IF EXISTS "Provider profiles are viewable by everyone" ON public.provider_profiles;

-- providers_public_read survives and now governs anonymous reads. Verified at
-- migrations-archive/20260803000000_approval_workflow.sql:31 -- it has NO TO
-- clause, so it applies to PUBLIC and anon inherits it. (This mattered: had it
-- been scoped TO authenticated, dropping the policy above would have blanked
-- the entire public marketplace.) Its predicate is:
--   verification_status IN ('approved','verified')
--   OR user_id = auth.uid()
--   OR EXISTS (admin in user_roles)
-- Every anonymous query already filters on approved/verified -- CategoryPage,
-- useArtists, Navbar, ragRetriever and search_vendors_sql all do -- so this
-- narrows nothing they rely on. What it DOES close: ProviderProfile.tsx
-- applies no approval filter, so /provider/<uuid> could previously render a
-- vendor whose application was still pending or rejected. It now 404s for
-- anonymous visitors while the vendor themselves still sees it, via the
-- user_id = auth.uid() branch.
--
-- Known residual, deliberately left: providers_public_read does not test
-- is_published, so an approved-but-unpublished vendor stays readable by uuid.
-- The app filters is_published in every list query. Tightening the policy
-- risks breaking an approved vendor's own preview and is not worth coupling
-- to this fix.

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "profiles_public_read_scoped"
    ON public.profiles
    FOR SELECT
    TO anon, authenticated
    USING (
        -- own row
        id = auth.uid()
        -- vendor-owner rows: every public page joins provider_profiles to
        -- profiles on user_id to get the vendor's display name, avatar and
        -- city. search_vendors_sql LEFT JOINs profiles and FILTERS on
        -- pr.city / pr.area, so if this branch were missing it would return
        -- zero rows and /ai-planner would fail closed rather than loudly.
        OR EXISTS (
            SELECT 1 FROM public.provider_profiles pp
             WHERE pp.user_id = profiles.id
        )
        -- review-author rows: ProviderProfile.tsx renders reviewer names via
        -- .select("id,full_name").in("id", ids) over reviews.customer_id.
        OR EXISTS (
            SELECT 1 FROM public.reviews r
             WHERE r.customer_id = profiles.id
        )
    );

COMMENT ON POLICY "profiles_public_read_scoped" ON public.profiles IS
    'Replaces "Profiles are viewable by everyone" (USING (true)), which let anon enumerate all 66 user rows. Scoped to own row, vendor-owner rows and review-author rows -- the three shapes every anonymous read path actually needs. Subqueries here run under the referenced tables RLS, so a pending vendor whose provider_profiles row is not visible to anon also stops being resolvable through this policy.';

-- Note on the subqueries above: a subquery inside a policy expression is
-- itself subject to the referenced table's RLS. provider_profiles is now
-- governed by providers_public_read, so the vendor-owner branch resolves only
-- for approved/verified vendors -- which is the desired behaviour, and is a
-- second reason a pending vendor is not publicly resolvable. Neither
-- provider_profiles nor reviews has a policy referencing profiles, so there
-- is no mutual recursion. anon retains table-level SELECT on reviews and
-- column-level SELECT on provider_profiles.user_id, which is what these
-- subqueries need.

-- ===========================================================================
-- SECTION 4 -- catalog assertions
-- ===========================================================================

-- These assertions deliberately do NOT use information_schema.column_privileges
-- or role_table_grants. Those views only expose rows where the current user is
-- the grantor, the grantee, or a member of the grantee role -- so if a grant
-- was made by supabase_admin and the migration runs as postgres, the row is
-- invisible and a "no sensitive column is granted" check passes while the
-- column is in fact still readable. A check that cannot fail is worse than no
-- check. has_column_privilege() and pg_class.relacl evaluate the real ACL
-- regardless of who granted it.
--
-- The withheld list is also not hardcoded: it is derived as "every column not
-- on the allowlist", so a column added to provider_profiles next year is
-- withheld by default and this assertion catches it if someone grants it.

DO $catalog$
DECLARE
    v_provider_allowed text[] := ARRAY[
        'average_rating','available_dates','available_days','band_category',
        'bio','business_hours','category_details','cover_banner_url',
        'cover_image_url','created_at','experience_years','extra_charges',
        'facebook','faqs','featured_until','gallery_urls','id','instagram',
        'instant_booking','is_available','is_featured','is_published',
        'is_verified','languages','performance_type','price_max','price_min',
        'pricing_type','profession','service_areas','service_radius',
        'social_links','specialties','stage_name','subcategory',
        'total_bookings','total_reviews','travel_charges','updated_at',
        'user_id','vendor_details','verification_status','video_urls',
        'website','whatsapp','youtube'
    ];
    v_profile_allowed text[] := ARRAY[
        'area','avatar_url','city','district','full_name','id','state'
    ];
    v_bad     text;
    v_count   int;
    v_total   int;
BEGIN
    -- 4a. No table-level SELECT may remain for anon or PUBLIC on either table.
    -- A table-level grant is not the union of the column grants, it OUTRANKS
    -- them -- so if one survived, every GRANT above would be decorative and
    -- this migration would be a no-op that reported success. grantee = 0 in
    -- aclexplode() is PUBLIC.
    SELECT string_agg(DISTINCT c.relname, ', '), count(*)
      INTO v_bad, v_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(c.relacl) acl
     WHERE n.nspname = 'public'
       AND c.relname IN ('profiles','provider_profiles')
       AND acl.privilege_type = 'SELECT'
       AND (acl.grantee = 0 OR acl.grantee = 'anon'::regrole::oid);
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: a table-level SELECT grant to anon or PUBLIC survives on %. It outranks the column-level grants, so nothing is actually restricted.', v_bad;
    END IF;

    -- 4b. No provider_profiles column outside the 46-name allowlist may be
    -- readable by anon. Derived from pg_attribute, so it covers the 23 known
    -- sensitive columns AND anything added to the table later.
    -- has_column_privilege() accounts for grants held via PUBLIC, so anon
    -- alone is sufficient to test.
    SELECT string_agg(a.attname, ', ' ORDER BY a.attname), count(*)
      INTO v_bad, v_count
      FROM pg_attribute a
     WHERE a.attrelid = 'public.provider_profiles'::regclass
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND NOT (a.attname = ANY (v_provider_allowed))
       AND has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT');
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: anon can still read % non-public provider_profiles column(s): %. Vendor banking and KYC data remains exposed.', v_count, v_bad;
    END IF;

    -- 4c. Same for profiles: nothing outside the 7-name allowlist.
    SELECT string_agg(a.attname, ', ' ORDER BY a.attname), count(*)
      INTO v_bad, v_count
      FROM pg_attribute a
     WHERE a.attrelid = 'public.profiles'::regclass
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND NOT (a.attname = ANY (v_profile_allowed))
       AND has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT');
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: anon can still read % non-public profiles column(s): %. User PII remains exposed.', v_count, v_bad;
    END IF;

    -- 4d. Every allowlisted column must still be readable, or the public site
    -- breaks. has_column_privilege() raises undefined_column on a name that
    -- is not a real column, which makes this a spelling check on both arrays
    -- as well -- a typo aborts the migration instead of silently shipping a
    -- 42703 to /artists.
    SELECT string_agg(x.col, ', '), count(*)
      INTO v_bad, v_count
      FROM unnest(v_provider_allowed) AS x(col)
     WHERE NOT has_column_privilege('anon', 'public.provider_profiles'::regclass::oid, x.col, 'SELECT');
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: anon lost SELECT on % provider_profiles column(s) the public site requires: %.', v_count, v_bad;
    END IF;

    SELECT string_agg(x.col, ', '), count(*)
      INTO v_bad, v_count
      FROM unnest(v_profile_allowed) AS x(col)
     WHERE NOT has_column_privilege('anon', 'public.profiles'::regclass::oid, x.col, 'SELECT');
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: anon lost SELECT on % profiles column(s) the public site requires: %.', v_count, v_bad;
    END IF;

    -- Report the split so a schema change shows up in the push output rather
    -- than being discovered later. 69 and 27 are the counts this migration
    -- was written against.
    SELECT count(*) INTO v_total FROM pg_attribute
     WHERE attrelid = 'public.provider_profiles'::regclass
       AND attnum > 0 AND NOT attisdropped;
    RAISE NOTICE 'provider_profiles: % columns total, % readable by anon, % withheld.',
        v_total, array_length(v_provider_allowed, 1), v_total - array_length(v_provider_allowed, 1);

    SELECT count(*) INTO v_total FROM pg_attribute
     WHERE attrelid = 'public.profiles'::regclass
       AND attnum > 0 AND NOT attisdropped;
    RAISE NOTICE 'profiles: % columns total, % readable by anon, % withheld.',
        v_total, array_length(v_profile_allowed, 1), v_total - array_length(v_profile_allowed, 1);

    -- 4e. The two permissive-true SELECT policies this migration drops must
    -- actually be gone. Both names were confirmed to exist before this was
    -- written, so this assertion cannot false-fail -- it fires only if a DROP
    -- silently no-oped because the name drifted, which is precisely the case
    -- where the row-scoping half of this migration achieved nothing.
    SELECT string_agg(p.polname, ', '), count(*)
      INTO v_bad, v_count
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND ((c.relname = 'provider_profiles' AND p.polname = 'Provider profiles are viewable by everyone')
         OR (c.relname = 'profiles'          AND p.polname = 'Profiles are viewable by everyone'));
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: % permissive USING (true) policy/policies survived the DROP: %. PERMISSIVE policies OR together, so any one of them returns every row and defeats the scoped policies beside it.', v_count, v_bad;
    END IF;

    -- 4e-2. Any OTHER permissive-true SELECT-capable policy on these tables is
    -- reported, not raised. Deliberate: the column-level GRANTs above are the
    -- P0 fix and they are independent of RLS entirely -- sensitive columns are
    -- unreadable regardless of which rows a policy exposes. Aborting here
    -- would roll back the leak fix over a row-scoping imperfection. So this
    -- names the offenders loudly and lets the P0 land; anything it reports
    -- gets a follow-up migration.
    SELECT string_agg(c.relname || '.' || p.polname, ', '), count(*)
      INTO v_bad, v_count
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname IN ('profiles','provider_profiles')
       AND p.polcmd IN ('r','*')
       AND p.polpermissive
       AND coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') = 'true';
    IF v_count > 0 THEN
        RAISE WARNING 'ROW SCOPING INCOMPLETE: % other permissive SELECT-capable policy/policies still use USING (true) on these tables: %. Column-level privacy is enforced regardless, but anon can still enumerate every ROW. Report these names so a follow-up migration can scope them.', v_count, v_bad;
    ELSE
        RAISE NOTICE 'OK: no permissive USING (true) SELECT policy remains on profiles or provider_profiles.';
    END IF;

    -- 4f. providers_public_read must exist -- it is now the only thing
    -- governing which provider rows anon sees.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy p
          JOIN pg_class c ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname='public' AND c.relname='provider_profiles'
           AND p.polname='providers_public_read') THEN
        RAISE EXCEPTION 'FAILED: policy providers_public_read is missing from provider_profiles. Having just dropped the USING (true) policy, there is now nothing granting anonymous read access and the public site is blank.';
    END IF;

    RAISE NOTICE 'OK: table-level SELECT removed; 23 sensitive + 20 PII columns withheld from anon; no permissive-true SELECT policy remains.';
END $catalog$;

-- ===========================================================================
-- SECTION 5 -- functional probe, executed as anon
-- ===========================================================================
-- The catalog assertions prove the grants are shaped correctly. They do not
-- prove an anonymous caller is actually refused, and they do not prove the
-- public site still renders. Both are executed here.

DO $probe$
DECLARE
    v_star            text;
    v_bank            text;
    v_phone           text;
    v_list            text;
    v_profiles        text;
    v_rpc             text;
    v_owner_providers int;
    v_owner_profiles  int;
    v_anon_providers  int;
    v_anon_profiles   int;
BEGIN
    -- Baseline counts, taken as the migration role (bypasses RLS), so the
    -- visibility gates below can only fire when there is data for them to
    -- fire on. On an empty local replay these are 0 and the gates are
    -- skipped rather than failing for an environmental reason.
    SELECT count(*) INTO v_owner_providers
      FROM public.provider_profiles
     WHERE verification_status IN ('approved','verified');

    SELECT count(*) INTO v_owner_profiles
      FROM public.profiles p
     WHERE EXISTS (SELECT 1 FROM public.provider_profiles pp
                    WHERE pp.user_id = p.id
                      AND pp.verification_status IN ('approved','verified'));

    SET LOCAL ROLE anon;

    -- ---- MUST be refused ---------------------------------------------------

    BEGIN
        PERFORM * FROM public.provider_profiles LIMIT 1;
        v_star := 'ALLOWED';
    EXCEPTION
        WHEN insufficient_privilege THEN v_star := 'BLOCKED';
        WHEN others                 THEN v_star := 'OTHER_' || SQLSTATE;
    END;

    BEGIN
        PERFORM bank_account_number FROM public.provider_profiles LIMIT 1;
        v_bank := 'ALLOWED';
    EXCEPTION
        WHEN insufficient_privilege THEN v_bank := 'BLOCKED';
        WHEN others                 THEN v_bank := 'OTHER_' || SQLSTATE;
    END;

    BEGIN
        PERFORM phone FROM public.profiles LIMIT 1;
        v_phone := 'ALLOWED';
    EXCEPTION
        WHEN insufficient_privilege THEN v_phone := 'BLOCKED';
        WHEN others                 THEN v_phone := 'OTHER_' || SQLSTATE;
    END;

    -- ---- MUST still work: the real shapes of the public queries -----------

    -- CategoryPage.tsx:167 / useArtists.ts:152, via PUBLIC_PROVIDER_SELECT.
    BEGIN
        SELECT count(*) INTO v_anon_providers
          FROM (SELECT id, user_id, stage_name, profession, price_min, price_max,
                       average_rating, cover_image_url, vendor_details,
                       service_areas, band_category, created_at, is_featured
                  FROM public.provider_profiles
                 WHERE verification_status IN ('approved','verified')
                 ORDER BY average_rating DESC NULLS LAST
                 LIMIT 100) s;
        v_list := 'OK';
    EXCEPTION
        WHEN insufficient_privilege THEN v_list := 'DENIED';
        WHEN others                 THEN v_list := 'OTHER_' || SQLSTATE;
    END;

    -- useArtists.ts:196 step 2, ProviderProfile.tsx and Navbar.tsx:146.
    BEGIN
        SELECT count(*) INTO v_anon_profiles
          FROM (SELECT id, full_name, avatar_url, city, area, state
                  FROM public.profiles LIMIT 100) s;
        v_profiles := 'OK';
    EXCEPTION
        WHEN insufficient_privilege THEN v_profiles := 'DENIED';
        WHEN others                 THEN v_profiles := 'OTHER_' || SQLSTATE;
    END;

    -- search_vendors_sql: SECURITY INVOKER, granted to anon, and it reads
    -- pp.service_areas plus four profiles columns. This is the end-to-end
    -- check that the allowlist is sufficient for /ai-planner.
    --
    -- Called with named notation and only p_limit, because every parameter
    -- has a DEFAULT and p_limit is the one name confirmed at all three call
    -- sites. undefined_function and ambiguous_function are downgraded to a
    -- warning: the function ships in migrations-archive, so it legitimately
    -- may not exist on a local replay, and aborting the whole migration for
    -- that would be an environmental failure. insufficient_privilege is NOT
    -- downgraded -- that is the failure this probe exists to catch.
    BEGIN
        PERFORM * FROM public.search_vendors_sql(p_limit => 1);
        v_rpc := 'OK';
    EXCEPTION
        WHEN insufficient_privilege THEN v_rpc := 'DENIED';
        WHEN undefined_function     THEN v_rpc := 'ABSENT';
        WHEN ambiguous_function     THEN v_rpc := 'ABSENT';
        WHEN others                 THEN v_rpc := 'OTHER_' || SQLSTATE;
    END;

    RESET ROLE;

    -- ---- adjudicate --------------------------------------------------------

    IF v_star <> 'BLOCKED' THEN
        RAISE EXCEPTION 'FAILED: anon can still run SELECT * on provider_profiles (probe result: %). The column grants are not in effect.', v_star;
    END IF;
    IF v_bank <> 'BLOCKED' THEN
        RAISE EXCEPTION 'FAILED: anon can still read provider_profiles.bank_account_number (probe result: %). Vendor payout banking details remain public.', v_bank;
    END IF;
    IF v_phone <> 'BLOCKED' THEN
        RAISE EXCEPTION 'FAILED: anon can still read profiles.phone (probe result: %). Every registered user''s phone number remains public.', v_phone;
    END IF;
    IF v_list <> 'OK' THEN
        RAISE EXCEPTION 'FAILED: the public vendor-list query no longer runs as anon (probe result: %). /artists and /category/:slug would be blank. The allowlist is missing a column this query needs.', v_list;
    END IF;
    IF v_profiles <> 'OK' THEN
        RAISE EXCEPTION 'FAILED: the public profiles lookup no longer runs as anon (probe result: %). Vendor names and avatars would disappear site-wide.', v_profiles;
    END IF;
    IF v_rpc = 'DENIED' OR v_rpc LIKE 'OTHER_%' THEN
        RAISE EXCEPTION 'FAILED: public.search_vendors_sql no longer runs as anon (probe result: %). It is SECURITY INVOKER, so it executes under anon''s column privileges -- the allowlist is missing something it reads (most likely service_areas). /ai-planner would break.', v_rpc;
    END IF;
    IF v_rpc = 'ABSENT' THEN
        RAISE WARNING 'SKIPPED: public.search_vendors_sql does not exist here, so the /ai-planner path was not verified. Expected on a local replay; if this appears against production, the AI planner is running on the ragRetriever.ts fallback query instead.';
    END IF;

    -- Visibility, not just privilege. A permission-clean query that returns
    -- zero rows renders a blank marketplace with no error anywhere -- exactly
    -- the failure a privilege check cannot see. These gates fire only when
    -- the baseline proves there was something to return.
    IF v_owner_providers > 0 AND v_anon_providers = 0 THEN
        RAISE EXCEPTION 'FAILED: % approved/verified vendors exist but anon sees 0. providers_public_read is not matching them, so /artists renders empty with no error.', v_owner_providers;
    END IF;
    IF v_owner_profiles > 0 AND v_anon_profiles = 0 THEN
        RAISE EXCEPTION 'FAILED: % vendor-owner profile rows exist but anon sees 0. profiles_public_read_scoped is not matching them: every vendor name and avatar would be blank, and search_vendors_sql (which FILTERS on pr.city) would return nothing.', v_owner_profiles;
    END IF;
    IF v_owner_providers = 0 THEN
        RAISE WARNING 'No approved/verified vendors in this database, so the row-visibility gates were skipped. Re-run the post-deploy checks against production.';
    END IF;

    RAISE NOTICE 'OK: SELECT *, bank_account_number and profiles.phone refused for anon. Vendor list returned % of % rows, profiles returned % of %, search_vendors_sql: %. Verified by execution, not inspection.',
        v_anon_providers, v_owner_providers, v_anon_profiles, v_owner_profiles, v_rpc;
END $probe$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ===========================================================================
-- DEFERRED, AND WHY -- do not mistake this for finished
-- ===========================================================================
-- 1. provider_profiles.vendor_details (jsonb) is still readable by anon, and
--    it has to be: it drives which of the 17 category menu components renders
--    on /provider/:id, and every is*() gate in src/lib/providerCategory.ts
--    reads it. GRANT has no value dimension -- there is no way to expose some
--    JSON keys and withhold others. If that column carries KYC document
--    references, the fix is to split the sensitive keys into a separate table
--    or a sanitised view, not to revoke the column. That needs a key-name
--    inventory first:
--        SELECT DISTINCT jsonb_object_keys(vendor_details)
--          FROM public.provider_profiles WHERE vendor_details IS NOT NULL;
--    Key names only -- do not select the values.
--
-- 2. authenticated still holds table-level SELECT on both tables, and
--    providers_public_read makes approved vendors visible to every logged-in
--    user. So any signed-up account can still read all 36 vendors' bank
--    columns. Closing that cannot be done with a column grant, because
--    useVendorData.ts:92 and :1776 legitimately need those columns for the
--    caller's OWN row and column privileges cannot distinguish rows. The
--    proper fix is to move bank_* and the KYC status columns into a separate
--    owner-scoped table (provider_payout_details already exists) and have the
--    vendor wallet read them through a SECURITY DEFINER function scoped to
--    auth.uid(). That touches a live payments path and belongs in its own
--    migration with its own verification.
--
-- 3. public.approved_artists_view is a plain view with no security_invoker
--    reloption, so on PG17 it runs as its OWNER and is NOT subject to the
--    column grants above. Its 24 columns were checked and none is sensitive,
--    so it is not a hole today -- but it is a standing bypass of this
--    migration, and it has zero references in src/ and zero in
--    supabase/functions/. It should be dropped.
--
-- 4. public.portfolio_items carries "portfolio_public_read" with USING (true)
--    (migrations-archive/20260803000000_approval_workflow.sql:63). Portfolio
--    images are meant to be public, so the policy is probably correct, but the
--    table was not part of the 11-table sweep in 20261201000005 and its anon
--    GRANT was never audited. Check whether anon holds writes on it.
--
-- 5. If the 4e-2 WARNING fires during the push, capture the policy names it
--    prints. It means anon can still enumerate every ROW of profiles or
--    provider_profiles through some other permissive-true policy. Column
--    privacy still holds, but that needs a follow-up migration.
-- ===========================================================================
