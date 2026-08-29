-- 20261201000005_revoke_anon_writes_and_enable_rls.sql
--
-- P0. Closes an UNAUTHENTICATED read/write hole on eleven tables.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT
-- ---------------------------------------------------------------------------
-- The production schema has 154 tables carrying at least one RLS policy, but
-- only 144 of them ever ran ALTER TABLE ... ENABLE ROW LEVEL SECURITY. On a
-- table where RLS is disabled every policy attached to it is INERT: Postgres
-- does not consult policies at all, it consults the table ACL only. And all
-- eleven of these tables also hold, verbatim from the dump:
--
--     GRANT ALL ON TABLE "public"."<table>" TO "anon";
--
-- GRANT ALL is SELECT + INSERT + UPDATE + DELETE + TRUNCATE + REFERENCES +
-- TRIGGER (+ MAINTAIN on PG17). anon is the role behind the sb_publishable_
-- key that ships inside the browser bundle and is public by design. So for
-- these eleven tables the effective access control for an anonymous caller,
-- holding nothing but a key anyone can read out of the JS, was: none.
--
--   * profiles            -- 66 real users. Anonymous UPDATE of any row.
--   * provider_profiles   -- 36 real vendors. is_verified, is_published and
--                            verification_status are plain columns here, so
--                            anonymous UPDATE is a vendor-verification
--                            bypass; anonymous DELETE erases the marketplace.
--   * bookings            -- already remediated 2026-08-25 08:58:42 UTC.
--   * the eight catalogue tables that render the public site.
--
-- The eleven were found by sweeping the schema dump for tables with policies
-- but no ENABLE statement. Guarded against a grep artifact first: the dump
-- emits exactly one textual form of that statement, 144 times, with no
-- ALTER TABLE ONLY variant, so the ten absences are real. Corroborated
-- independently -- bookings is in the set, and fourteen hours after the dump
-- someone ran ENABLE ROW LEVEL SECURITY against it. You do not run that on a
-- table that already has it.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION DOES, AND WHAT IT DELIBERATELY DOES NOT DO
-- ---------------------------------------------------------------------------
-- It closes the WRITE hole completely and turns RLS on. It does NOT change
-- what anon can READ. That split is deliberate:
--
--   Revoking anon's writes cannot break a read path, and it cannot break a
--   write path either, because all 26 browser write sites against profiles
--   and provider_profiles run authenticated -- admin screens, or flows scoped
--   to user.id -- and row creation in profiles happens exclusively through
--   the handle_new_user() SECURITY DEFINER trigger on auth.users, which runs
--   as the function owner and never as anon. There is no pre-auth writer
--   anywhere in src/ or supabase/functions/. So this half is bounded and
--   safe to ship immediately, which is what an actively exploitable hole
--   deserves.
--
--   Restricting anon's reads is NOT safe to ship in the same migration,
--   because the sensitive columns cannot be hidden with a policy. RLS has no
--   column dimension, and row-scoping does not help here: the vendors whose
--   bank_account_number leaks are precisely the APPROVED ones who must stay
--   publicly listed. Hiding them requires column-level GRANT, and a
--   column-level GRANT breaks SELECT * -- which three anon-reachable queries
--   still use. That is migration 20261201000006, and it must land AFTER the
--   frontend stops using SELECT *. Sequencing it separately is the only way
--   to avoid taking the public site down.
--
-- Note also what is NOT here: FORCE ROW LEVEL SECURITY. The unmerged
-- phase-2a migration applies FORCE to 155 tables. FORCE subjects the table
-- OWNER to RLS, which silently changes the behaviour of every SECURITY
-- DEFINER function owned by a role lacking rolbypassrls. That is a large,
-- unreviewed behavioural change and it is not required to close this hole.
--
-- ---------------------------------------------------------------------------
-- WHAT ENABLING RLS ACTIVATES FOR THE FIRST TIME -- and the two breakages
-- this migration pre-empts
-- ---------------------------------------------------------------------------
-- These policies have never once executed in production. Turning RLS on runs
-- them for the first time, so every gap in the policy set becomes a live
-- failure. Two real gaps were found by auditing all client call sites against
-- the policy list, and both fail SILENTLY because the call sites discard the
-- result:
--
--   1. profiles has no DELETE policy, and src/pages/admin/AdminCustomers.tsx:36
--      runs  await supabase.from('profiles').delete().eq('id', id)  in the
--      browser and never inspects the outcome. Section 3 adds an admin DELETE
--      policy so behaviour is preserved rather than quietly changed.
--      (That call site is architecturally wrong -- deleting a profiles row
--      leaves the auth.users row orphaned. supabase/functions/delete-account
--      already does this correctly server-side. Preserving current behaviour
--      here, and fixing the call site, are separate concerns; this migration
--      only refuses to break it by surprise.)
--
--   2. reviews has no DELETE policy, and src/pages/admin/AdminReviews.tsx:36
--      runs  await supabase.from('reviews').delete().eq('id', id)  the same
--      way. Section 3 adds an admin DELETE policy for review moderation.
--
-- A third hazard: four of the pre-existing admin policies test only
-- role = 'admin' and never 'super_admin'. Since these policies have never
-- run, nobody has ever discovered whether Vowza's admins actually hold an
-- 'admin' row or only a 'super_admin' one. If it is the latter, enabling RLS
-- locks admins out of category and vendor management. Section 2 handles this
-- additively -- all 388 policies in this schema are PERMISSIVE and OR
-- together, so ADDING a policy can only ever widen access, never narrow it.
-- Adding a super_admin-aware policy alongside the existing one therefore
-- cannot break anything, whereas rewriting the existing one could.
--
-- Verified as NOT breakages: reviews takes only SELECT and INSERT from the
-- client besides the admin delete; subcategories, menu_items, pooja_services
-- and rental_items take no client writes at all; pricing_packages and
-- provider_faqs are written only from vendor-owned pages covered by the
-- existing *_owner_write FOR ALL policies; artist_categories is written only
-- from admin screens; and no client code inserts into profiles.
-- profiles.is_blocked is referenced only as a TypeScript interface field in
-- AdminCustomers.tsx:7 -- never written, never enforced -- so no policy needs
-- to account for it.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- Per table:  ALTER TABLE public.<t> DISABLE ROW LEVEL SECURITY;
--             GRANT ALL ON TABLE public.<t> TO anon;
-- Do not roll back without understanding that doing so restores anonymous
-- write access to 66 users' and 36 vendors' records.
-- ===========================================================================

BEGIN;

-- ===========================================================================
-- SECTION 1 -- revoke anon's write privileges
-- ===========================================================================
-- REVOKE ALL then GRANT SELECT back, rather than naming verbs. Naming verbs
-- is how REFERENCES and TRIGGER got left behind in an earlier draft of
-- 20261201000002, and on PG17 there is now MAINTAIN to forget as well.
-- REVOKE ALL cannot omit a verb that gets added in a future major version.
--
-- Each REVOKE names PUBLIC as well as anon. anon's privilege here comes from
-- an explicit GRANT, but a privilege held through PUBLIC is invisible in the
-- per-role ACL and would survive a revoke aimed only at anon.
--
-- Safe for the other roles: authenticated and service_role each hold their
-- own explicit GRANT ALL on every one of these tables (dump lines 18130-18132
-- for user_roles and the equivalent triple for each table here), so revoking
-- PUBLIC does not touch them. This was checked before writing the statement --
-- if service_role's access had come only through PUBLIC, this would have
-- broken every Edge Function.

REVOKE ALL ON TABLE public.artist_categories   FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.bookings            FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.menu_items          FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.pooja_services      FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.pricing_packages    FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.profiles            FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.provider_faqs       FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.provider_profiles   FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.rental_items        FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.reviews             FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.subcategories       FROM PUBLIC, anon;

-- Give back exactly SELECT. Column-level narrowing of profiles and
-- provider_profiles happens in 20261201000006, after the frontend stops
-- using SELECT *.
GRANT SELECT ON TABLE public.artist_categories   TO anon;
GRANT SELECT ON TABLE public.menu_items          TO anon;
GRANT SELECT ON TABLE public.pooja_services      TO anon;
GRANT SELECT ON TABLE public.pricing_packages    TO anon;
GRANT SELECT ON TABLE public.profiles            TO anon;
GRANT SELECT ON TABLE public.provider_faqs       TO anon;
GRANT SELECT ON TABLE public.provider_profiles   TO anon;
GRANT SELECT ON TABLE public.rental_items        TO anon;
GRANT SELECT ON TABLE public.reviews             TO anon;
GRANT SELECT ON TABLE public.subcategories       TO anon;

-- bookings is deliberately NOT granted SELECT back to anon. Nothing anonymous
-- reads it: there is no guest booking path anywhere -- BookingModal.tsx:281 is
-- gated by if (!user) at :192, useBookings.ts:669 at :666, and
-- supabase/functions/create-booking/index.ts:62-65 returns 401 without an
-- authorization header. An anonymous SELECT on bookings would only ever be an
-- attacker reading customers' event addresses and phone numbers.

-- The two views over these tables also hold GRANT ALL TO anon. Neither is
-- updatable (both contain joins, so neither is auto-updatable and writes
-- would fail anyway), but a write privilege nobody can use is still a
-- privilege nobody should hold.
--
-- Their SELECT grant is intentionally left in place. Both are plain views
-- with no security_invoker reloption -- confirmed absent from the dump -- so
-- on PG17 they run with the OWNER's privileges and are unaffected by the
-- column-level GRANTs in 20261201000006. That makes them a potential way
-- around those grants, so their column lists were checked explicitly:
-- approved_artists_view exposes 24 columns, none of them bank, KYC, phone,
-- email or address; category_provider_counts exposes only category metadata
-- plus a COUNT. Neither leaks anything 20261201000006 is trying to hide.
-- approved_artists_view has zero references in src/ and zero in
-- supabase/functions/ -- it is dead, and a later migration should drop it.
REVOKE ALL ON TABLE public.approved_artists_view     FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.category_provider_counts  FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.approved_artists_view     TO anon;
GRANT SELECT ON TABLE public.category_provider_counts  TO anon;

-- ===========================================================================
-- SECTION 2 -- additive admin policies that also recognise super_admin
-- ===========================================================================
-- Purely additive. PERMISSIVE policies OR together, so each of these can only
-- widen access relative to what Section 4 is about to switch on. None of them
-- can deny anything that the existing policy would have allowed.
--
-- Each is scoped TO authenticated. The pre-existing policies on these tables
-- carry no TO clause, which means they apply to PUBLIC -- anon included. That
-- is harmless for an admin test (anon's auth.uid() is NULL, so the EXISTS is
-- false) but there is no reason to repeat it in new policy text.
--
-- has_role() is used rather than an inlined EXISTS over user_roles. The
-- inlined form requires the caller to hold SELECT on user_roles, which is why
-- 41 policies across 24 tables currently pin anon's SELECT privilege on that
-- table in place; new policies should not add a 42nd.

CREATE POLICY "artist_categories_admin_write_v2"
    ON public.artist_categories
    FOR ALL
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );

CREATE POLICY "subcategories_admin_write_v2"
    ON public.subcategories
    FOR ALL
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );

CREATE POLICY "provider_profiles_admin_write_v2"
    ON public.provider_profiles
    FOR ALL
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );

-- ===========================================================================
-- SECTION 3 -- DELETE policies that keep two admin screens working
-- ===========================================================================
-- Without these, AdminCustomers.tsx:36 and AdminReviews.tsx:36 begin failing
-- the moment Section 4 runs, and because both discard the result the failure
-- is invisible: the row stays, the list refreshes, nobody is told.

CREATE POLICY "profiles_admin_delete"
    ON public.profiles
    FOR DELETE
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );

CREATE POLICY "reviews_admin_delete"
    ON public.reviews
    FOR DELETE
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );

COMMENT ON POLICY "profiles_admin_delete" ON public.profiles IS
    'Preserves AdminCustomers.tsx:36, which deletes profiles rows from the browser and discards the result. That call site orphans the matching auth.users row and should be migrated to the delete-account Edge Function; this policy exists so enabling RLS does not break it silently in the meantime.';

COMMENT ON POLICY "reviews_admin_delete" ON public.reviews IS
    'Preserves review moderation at AdminReviews.tsx:36, which discards its result. reviews previously had only SELECT and INSERT policies.';

-- ===========================================================================
-- SECTION 4 -- enable RLS
-- ===========================================================================
-- Idempotent: ENABLE ROW LEVEL SECURITY on a table that already has it is a
-- no-op, so bookings is listed for uniformity even though it was remediated
-- on 2026-08-25. Listing it also means this migration leaves the set in a
-- known state regardless of what was toggled by hand in the dashboard, which
-- writes no ledger row and is therefore invisible to migration history.

ALTER TABLE public.artist_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pooja_services      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_packages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_faqs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories       ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- SECTION 5 -- catalog assertions
-- ===========================================================================
-- Derived from the catalog, not from a hand-maintained list of expectations,
-- so these cannot drift into agreeing with themselves.

DO $catalog$
DECLARE
    v_expected  text[] := ARRAY[
        'artist_categories','bookings','menu_items','pooja_services',
        'pricing_packages','profiles','provider_faqs','provider_profiles',
        'rental_items','reviews','subcategories'
    ];
    v_bad       text;
    v_count     int;
BEGIN
    -- 5a. Every one of the eleven must now have RLS on. If a table name here
    -- were misspelled the ALTER would already have failed, so this is really
    -- a guard against a future edit removing a line from Section 4.
    SELECT string_agg(c.relname, ', ' ORDER BY c.relname), count(*)
      INTO v_bad, v_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = ANY (v_expected)
       AND NOT c.relrowsecurity;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: RLS is still disabled on % of the eleven tables: %. Every policy on those tables is inert.', v_count, v_bad;
    END IF;

    -- 5b. anon must hold NO write privilege on any of the eleven.
    SELECT string_agg(DISTINCT g.table_name || '.' || lower(g.privilege_type), ', '), count(*)
      INTO v_bad, v_count
      FROM information_schema.role_table_grants g
     WHERE g.table_schema = 'public'
       AND g.table_name = ANY (v_expected)
       AND g.grantee IN ('anon','PUBLIC')
       AND g.privilege_type <> 'SELECT';
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: anon (or PUBLIC) still holds non-SELECT privileges: %. The write hole is not closed.', v_bad;
    END IF;

    -- 5c. anon must RETAIN SELECT on the ten public-facing tables. Losing it
    -- would blank the public site, and would also break providers_public_read
    -- and 40 sibling policies that subquery these tables.
    SELECT string_agg(t, ', ' ORDER BY t), count(*)
      INTO v_bad, v_count
      FROM unnest(v_expected) AS t
     WHERE t <> 'bookings'
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.role_table_grants g
            WHERE g.table_schema = 'public' AND g.table_name = t
              AND g.grantee = 'anon' AND g.privilege_type = 'SELECT');
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: anon lost SELECT on %, which would blank the public site.', v_bad;
    END IF;

    -- 5d. authenticated must keep full write access -- every vendor and admin
    -- flow depends on it, and several discard their errors.
    SELECT string_agg(DISTINCT t, ', '), count(DISTINCT t)
      INTO v_bad, v_count
      FROM unnest(v_expected) AS t
     WHERE NOT EXISTS (
           SELECT 1 FROM information_schema.role_table_grants g
            WHERE g.table_schema = 'public' AND g.table_name = t
              AND g.grantee = 'authenticated' AND g.privilege_type = 'UPDATE');
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: authenticated lost UPDATE on %. Vendor and admin write paths would fail, several of them silently.', v_bad;
    END IF;

    RAISE NOTICE 'OK: eleven tables have RLS enabled; anon holds SELECT and nothing else; authenticated unaffected.';

    -- 5e. Visibility, not a gate. This is the size of the remaining problem:
    -- tables elsewhere in public where anon can still write. Reported so the
    -- residual is a number somebody has seen rather than an assumption.
    SELECT count(DISTINCT g.table_name) INTO v_count
      FROM information_schema.role_table_grants g
      JOIN pg_class c  ON c.relname = g.table_name
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE g.table_schema = 'public'
       AND g.grantee IN ('anon','PUBLIC')
       AND g.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
       AND c.relkind = 'r';
    RAISE NOTICE 'RESIDUAL: % table(s) in schema public still grant a write privilege to anon or PUBLIC. Out of scope for this migration; tracked separately.', v_count;

    -- 5f. Same shape, for tables that still have policies but no RLS.
    SELECT count(*) INTO v_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
       AND EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);
    IF v_count > 0 THEN
        RAISE WARNING 'RESIDUAL: % further table(s) in schema public carry policies while RLS is disabled, so those policies are inert. Expected 0 after this migration.', v_count;
    ELSE
        RAISE NOTICE 'OK: no table in schema public has policies while RLS is disabled.';
    END IF;
END $catalog$;

-- ===========================================================================
-- SECTION 6 -- functional probe, executed as anon
-- ===========================================================================
-- Inspecting the catalog proves the grants changed. It does not prove an
-- anonymous caller is actually stopped, and it does not prove the public site
-- still works. Both of those are executed here instead of assumed.
--
-- Every write below targets the all-zeros uuid, which matches no row, so the
-- probe cannot modify data even in the failure case where it is permitted.

DO $probe$
DECLARE
    v_read_pp   text;
    v_read_prof text;
    v_upd_pp    text;
    v_upd_prof  text;
    v_del_pp    text;
    v_ins_rev   text;
    v_read_bk   text;
BEGIN
    SET LOCAL ROLE anon;

    -- Reads that MUST still work. /artists, /category/:slug and /provider/:id
    -- are all anonymous routes served from these two tables.
    BEGIN
        PERFORM 1 FROM public.provider_profiles LIMIT 1;
        v_read_pp := 'OK';
    EXCEPTION WHEN insufficient_privilege THEN v_read_pp := 'DENIED';
    END;

    BEGIN
        PERFORM 1 FROM public.profiles LIMIT 1;
        v_read_prof := 'OK';
    EXCEPTION WHEN insufficient_privilege THEN v_read_prof := 'DENIED';
    END;

    -- Writes that MUST now be refused. Before this migration every one of
    -- these succeeded for an anonymous caller.
    BEGIN
        UPDATE public.provider_profiles
           SET is_verified = is_verified
         WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
        v_upd_pp := 'ALLOWED';
    EXCEPTION
        WHEN insufficient_privilege THEN v_upd_pp := 'BLOCKED';
        WHEN others                 THEN v_upd_pp := 'OTHER_' || SQLSTATE;
    END;

    BEGIN
        UPDATE public.profiles
           SET full_name = full_name
         WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
        v_upd_prof := 'ALLOWED';
    EXCEPTION
        WHEN insufficient_privilege THEN v_upd_prof := 'BLOCKED';
        WHEN others                 THEN v_upd_prof := 'OTHER_' || SQLSTATE;
    END;

    BEGIN
        DELETE FROM public.provider_profiles
         WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
        v_del_pp := 'ALLOWED';
    EXCEPTION
        WHEN insufficient_privilege THEN v_del_pp := 'BLOCKED';
        WHEN others                 THEN v_del_pp := 'OTHER_' || SQLSTATE;
    END;

    BEGIN
        INSERT INTO public.reviews (booking_id, customer_id, provider_id, rating)
        VALUES ('00000000-0000-0000-0000-000000000000'::uuid,
                '00000000-0000-0000-0000-000000000000'::uuid,
                '00000000-0000-0000-0000-000000000000'::uuid, 5);
        v_ins_rev := 'ALLOWED';
    EXCEPTION
        WHEN insufficient_privilege THEN v_ins_rev := 'BLOCKED';
        WHEN others                 THEN v_ins_rev := 'OTHER_' || SQLSTATE;
    END;

    -- bookings: SELECT was not granted back, so an anonymous read of
    -- customers' addresses and phone numbers must be refused outright.
    BEGIN
        PERFORM 1 FROM public.bookings LIMIT 1;
        v_read_bk := 'ALLOWED';
    EXCEPTION WHEN insufficient_privilege THEN v_read_bk := 'BLOCKED';
    END;

    RESET ROLE;

    IF v_read_pp <> 'OK' OR v_read_prof <> 'OK' THEN
        RAISE EXCEPTION 'FAILED: anon can no longer read provider_profiles (%) / profiles (%). The public artists, category and provider pages would be blank. This migration was not supposed to change reads at all.', v_read_pp, v_read_prof;
    END IF;

    IF v_upd_pp <> 'BLOCKED' THEN
        RAISE EXCEPTION 'FAILED: an anonymous caller can still UPDATE provider_profiles (probe result: %). is_verified and is_published live on that table, so the vendor-verification bypass is still open.', v_upd_pp;
    END IF;

    IF v_upd_prof <> 'BLOCKED' THEN
        RAISE EXCEPTION 'FAILED: an anonymous caller can still UPDATE profiles (probe result: %). 66 users'' records remain writable with a key that ships in the browser bundle.', v_upd_prof;
    END IF;

    IF v_del_pp <> 'BLOCKED' THEN
        RAISE EXCEPTION 'FAILED: an anonymous caller can still DELETE from provider_profiles (probe result: %). The marketplace can still be erased by anyone.', v_del_pp;
    END IF;

    IF v_ins_rev <> 'BLOCKED' THEN
        RAISE EXCEPTION 'FAILED: an anonymous caller can still INSERT into reviews (probe result: %). Ratings remain forgeable without an account.', v_ins_rev;
    END IF;

    IF v_read_bk <> 'BLOCKED' THEN
        RAISE EXCEPTION 'FAILED: an anonymous caller can still read bookings (probe result: %), exposing customers'' event addresses and phone numbers.', v_read_bk;
    END IF;

    RAISE NOTICE 'OK: anonymous reads of provider_profiles and profiles still succeed; anonymous UPDATE, DELETE and INSERT are refused; bookings is unreadable. Verified by execution, not inspection.';
END $probe$;

COMMIT;

-- PostgREST caches the schema. Without this the API keeps serving from a
-- cached snapshot and post-deploy verification can report a false pass.
NOTIFY pgrst, 'reload schema';
