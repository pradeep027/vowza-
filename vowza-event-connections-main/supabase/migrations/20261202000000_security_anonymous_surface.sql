-- Vowza §2-A: anonymous grant/RLS stopgap
--
-- Scope: revoke anonymous write capabilities, force RLS on the eleven tables
-- identified in the production catalog, and expose only the reviewed public
-- catalog columns. This migration intentionally does not create new tables or
-- move data; the payout/verification split and provider_public projection are
-- §2-B.
--
-- Production execution note: the ALTER DEFAULT PRIVILEGES statements name the
-- two production public-schema grantors observed in pg_default_acl. If the
-- migration role is not permitted to alter supabase_admin's defaults, stop
-- before applying a partial migration and run the complete migration through
-- the approved dashboard role.
--
-- Rollback order: (1) restore the prior anonymous grants/policies only after
-- review; (2) revert application query changes; (3) disable RLS/force-RLS only
-- with an approved replacement policy set; (4) drop owns_provider last.

BEGIN;

-- §2.0 Revoke anonymous writes and future public-schema defaults first.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE UPDATE, USAGE ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Existing function EXECUTE privileges are intentionally not changed in §2-A;
-- the full SECURITY DEFINER/anon-RPC surface is §4 and must be reviewed there.

-- The production pg_default_acl query showed postgres and supabase_admin
-- granting anon defaults in public. Do not alter authenticated or managed
-- schemas here.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE UPDATE, USAGE ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE UPDATE, USAGE ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- §2.1b Shared ownership helper. Policies use this instead of inline
-- provider_profiles subqueries so ownership checks remain stable as provider
-- row visibility is narrowed.
CREATE OR REPLACE FUNCTION public.owns_provider(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.provider_profiles AS pp
    WHERE pp.id = p_provider_id
      AND pp.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.owns_provider(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_provider(uuid) TO authenticated;

-- §2.1 Enable RLS on the eleven production RLS-off tables.
ALTER TABLE public.artist_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pooja_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- §2.1 Force RLS on every public table. The 155 statements are replay-catalog derived.
ALTER TABLE public.about_team_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.about_us FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_package_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_package_discounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_package_inclusions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_message_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.anchor_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.anchor_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.anchor_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.anchor_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.artist_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.artist_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auth_promotion_media FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auth_promotion_video_views FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auth_promotion_videos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auth_promotional_config FORCE ROW LEVEL SECURITY;
ALTER TABLE public.band_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.band_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.band_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.band_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.band_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bank_details FORCE ROW LEVEL SECURITY;
ALTER TABLE public.banquet_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.banquet_halls FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_cancellations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_locations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_start_otps FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.budget_allocations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catering_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catering_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catering_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catering_menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catering_menu_sections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catering_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commission_tracking FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dancer_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dancer_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dancer_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dancer_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.decorator_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.decorator_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.decorator_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.decorator_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_charges FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dj_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dj_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dj_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dj_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.drone_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.drone_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.drone_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.drone_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_types FORCE ROW LEVEL SECURITY;
ALTER TABLE public.favorites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.featured_artists FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hall_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hall_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.makeup_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.makeup_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.makeup_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.makeup_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mehendi_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mehendi_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mehendi_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mehendi_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_limits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photographer_availability FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_albums FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_booking_timeline FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_cart_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_carts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_highlights FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_images FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_videography_package_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_videography_package_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_videography_package_images FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photography_videography_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.planner_recommendation_candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.planner_recommendation_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_analytics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pooja_services FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.priest_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.priest_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.priest_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.priest_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_availability FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_calendar FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_faqs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_time_slots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rental_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rental_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rental_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rental_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rental_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reschedule_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.search_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.security_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.singer_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.singer_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.singer_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.singer_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_delivery_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_cancellations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_embeddings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_settlements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.videography_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.videography_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.videography_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.videography_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.water_addons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.water_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.water_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.water_gallery FORCE ROW LEVEL SECURITY;
ALTER TABLE public.water_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.water_product_images FORCE ROW LEVEL SECURITY;
ALTER TABLE public.water_product_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.water_product_stock FORCE ROW LEVEL SECURITY;
ALTER TABLE public.water_product_variants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.water_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.worker_bank_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.worker_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.worker_profiles FORCE ROW LEVEL SECURITY;

-- §2.2 Explicit anonymous grants for catalog tables. No anonymous write grant
-- is returned by §2.0.
GRANT SELECT ON TABLE public.artist_categories TO anon;
GRANT SELECT ON TABLE public.menu_items TO anon;
GRANT SELECT ON TABLE public.pooja_services TO anon;
GRANT SELECT ON TABLE public.pricing_packages TO anon;
GRANT SELECT ON TABLE public.provider_faqs TO anon;
GRANT SELECT ON TABLE public.rental_items TO anon;
GRANT SELECT ON TABLE public.reviews TO anon;

-- subcategories has no canonical source call site and is intentionally
-- inaccessible to anon; preserve the object for a later abandonment review.
REVOKE ALL ON TABLE public.subcategories FROM anon;

-- provider_profiles has mixed public and sensitive columns. RLS cannot filter
-- columns, so the anonymous grant is deliberately an explicit allowlist. The
-- list is limited to fields rendered by public browse/detail/recommendation
-- paths or required by their public filters. JSONB columns are excluded except
-- social_links, whose production key inventory was reviewed and contains only
-- social handles/URLs. Sensitive bank/KYC/vendor_details columns are absent.
REVOKE ALL ON TABLE public.provider_profiles FROM anon;
GRANT SELECT (
  id,
  user_id,
  profession,
  experience_years,
  price_min,
  price_max,
  bio,
  is_verified,
  is_available,
  average_rating,
  total_reviews,
  total_bookings,
  specialties,
  stage_name,
  cover_image_url,
  languages,
  instagram,
  facebook,
  youtube,
  website,
  is_featured,
  featured_until,
  instant_booking,
  subcategory,
  social_links,
  is_published,
  band_category,
  created_at
) ON TABLE public.provider_profiles TO anon;

-- profiles has mixed identity fields. §2-A grants only the public display
-- columns needed by current browse/detail pages; phone, email, address,
-- metadata, preferences, and account-state columns remain inaccessible.
REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT (
  id,
  full_name,
  avatar_url,
  city,
  area,
  state
) ON TABLE public.profiles TO anon;

-- §2.2/§2.3 Replace the broad permissive public policies.
DROP POLICY IF EXISTS "Provider profiles are viewable by everyone" ON public.provider_profiles;
DROP POLICY IF EXISTS "providers_public_read" ON public.provider_profiles;
CREATE POLICY provider_profiles_public_catalog_read
  ON public.provider_profiles
  FOR SELECT
  TO anon
  USING (is_published = true AND is_available = true);
COMMENT ON POLICY provider_profiles_public_catalog_read ON public.provider_profiles IS
  'Anonymous catalog/detail/recommendation reads for /artists, /category/:slug, /provider/:id, and /artist/:id; column grants exclude payout, KYC, identity, and sensitive JSONB fields.';

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY profiles_public_catalog_read
  ON public.profiles
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1
    FROM public.provider_profiles AS pp
    WHERE pp.user_id = public.profiles.id
      AND pp.is_published = true
      AND pp.is_available = true
  ));
COMMENT ON POLICY profiles_public_catalog_read ON public.profiles IS
  'Temporary §2-A display projection for public provider catalog/detail routes; provider_public view replaces this table join in §2-B.';
CREATE POLICY profiles_owner_read
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- subcategories is intentionally deny-all for now: no canonical source call
-- site was found, and the brief requires preservation rather than dropping it.
DROP POLICY IF EXISTS subcategories_public_read ON public.subcategories;

-- Replace provider-linked owner predicates with owns_provider(uuid).
DROP POLICY IF EXISTS menu_owner_write ON public.menu_items;
CREATE POLICY menu_owner_write
  ON public.menu_items
  FOR ALL
  TO authenticated
  USING (public.owns_provider(provider_id))
  WITH CHECK (public.owns_provider(provider_id));

DROP POLICY IF EXISTS pooja_owner_write ON public.pooja_services;
CREATE POLICY pooja_owner_write
  ON public.pooja_services
  FOR ALL
  TO authenticated
  USING (public.owns_provider(provider_id))
  WITH CHECK (public.owns_provider(provider_id));

DROP POLICY IF EXISTS "Providers can manage own pricing packages" ON public.pricing_packages;
DROP POLICY IF EXISTS packages_owner_write ON public.pricing_packages;
CREATE POLICY packages_owner_write
  ON public.pricing_packages
  FOR ALL
  TO authenticated
  USING (public.owns_provider(provider_id))
  WITH CHECK (public.owns_provider(provider_id));

DROP POLICY IF EXISTS faqs_owner_write ON public.provider_faqs;
CREATE POLICY faqs_owner_write
  ON public.provider_faqs
  FOR ALL
  TO authenticated
  USING (public.owns_provider(provider_id))
  WITH CHECK (public.owns_provider(provider_id));

DROP POLICY IF EXISTS rentals_owner_write ON public.rental_items;
CREATE POLICY rentals_owner_write
  ON public.rental_items
  FOR ALL
  TO authenticated
  USING (public.owns_provider(provider_id))
  WITH CHECK (public.owns_provider(provider_id));

DROP POLICY IF EXISTS "Booking parties can update" ON public.bookings;
CREATE POLICY "Booking parties can update"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = customer_id) OR public.owns_provider(provider_id));

DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
CREATE POLICY "Users can view own bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = customer_id) OR public.owns_provider(provider_id));

-- §2.4/§2.5 no anonymous write grants remain. Existing reviews SELECT and
-- completed-booking INSERT policies are retained; the public query rewrite in
-- this PR removes customer_id from the anonymous review projection later.

COMMIT;

-- Rollback block (review-only; do not run automatically).
-- Ordering: revert this migration; revert the application query changes; then
-- drop owns_provider. The grants below restore the committed Phase 2 baseline's
-- broad anonymous ACL shape; review against a fresh catalog before execution.
-- BEGIN;
-- REVOKE SELECT ON TABLE public.provider_profiles FROM anon;
-- REVOKE SELECT ON TABLE public.profiles FROM anon;
-- DROP POLICY IF EXISTS provider_profiles_public_catalog_read ON public.provider_profiles;
-- DROP POLICY IF EXISTS profiles_public_catalog_read ON public.profiles;
-- DROP POLICY IF EXISTS profiles_owner_read ON public.profiles;
-- DROP POLICY IF EXISTS subcategories_public_read ON public.subcategories;
-- CREATE POLICY "providers_public_read" ON public.provider_profiles FOR SELECT USING ((verification_status = ANY (ARRAY['approved'::text, 'verified'::text])) OR (user_id = auth.uid()) OR (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
-- CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
-- CREATE POLICY "subcategories_public_read" ON public.subcategories FOR SELECT USING (true);
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
-- DO $$ DECLARE r record; BEGIN FOR r IN SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' LOOP EXECUTE format('ALTER TABLE %I.%I NO FORCE ROW LEVEL SECURITY', r.nspname, r.relname); END LOOP; END $$;
-- ALTER TABLE public.artist_categories DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.menu_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pooja_services DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pricing_packages DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.provider_faqs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.provider_profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.rental_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.subcategories DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- After the application rollback, run:
-- DROP FUNCTION IF EXISTS public.owns_provider(uuid);
