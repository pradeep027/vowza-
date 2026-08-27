-- Step 4: feature-group RLS completion for the 30 documented unmatched call-site cells.
-- Evidence basis: local replay baseline plus the committed source call-site matrix.
-- This migration is review-only and has not been applied to production.
--
-- Rollback order (operator-reviewed only):
--   1. Revert the application changes that stop relying on the denied anonymous
--      paths and confirm the replacement policies are not in use.
--   2. Drop the policies created below.
--   3. Disable FORCE/RLS on booking_start_otps only if a reviewed replacement
--      policy set exists.
--   4. Restore grants only from a captured pre-migration ACL, never by guesswork.
--
-- The anonymous revokes intentionally do not have an automatic grant rollback.
-- Re-granting them without a fresh privilege review would reopen the audited gap.

BEGIN;

-- Anonymous write access is not required for the documented authenticated
-- booking/admin paths. Revoke only the exact unmatched anonymous operations.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON TABLE
  public.anchor_bookings,
  public.auth_promotion_media,
  public.auth_promotion_videos,
  public.band_bookings,
  public.banquet_bookings,
  public.booking_locations,
  public.dancer_bookings,
  public.decorator_bookings,
  public.dj_bookings,
  public.drone_bookings,
  public.makeup_bookings,
  public.mehendi_bookings,
  public.priest_bookings,
  public.rental_bookings,
  public.singer_bookings,
  public.videography_bookings,
  public.water_bookings
FROM anon;

REVOKE SELECT ON TABLE public.auth_promotion_video_views FROM anon;
REVOKE DELETE ON TABLE public.photography_cart_items FROM anon;

-- These records are operator/service-owned. Authenticated clients must not
-- write or delete them directly.
REVOKE INSERT ON TABLE public.audit_log FROM authenticated;
REVOKE DELETE ON TABLE public.security_events FROM authenticated;

-- Close the only currently policyless OTP-start table in the committed audit
-- inventory. It is not a client-facing table.
ALTER TABLE public.booking_start_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_start_otps FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_start_otps FROM anon, authenticated;

-- Profiles: preserve the public catalog read, but make authenticated writes
-- explicit and owner-scoped. These policies close the two INSERT and one
-- DELETE authenticated call-site cells without granting cross-user access.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can delete own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- Reviews: customers may edit or remove only their own review. The existing
-- public SELECT and completed-booking INSERT policies remain in place.
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY "Customers can update own reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can delete own reviews"
  ON public.reviews
  FOR DELETE
  TO authenticated
  USING (customer_id = auth.uid());

-- Cart items: deletion is permitted only through a cart owned by the caller.
-- The existing public SELECT policies remain unchanged.
CREATE POLICY "Customers can delete own photography cart items"
  ON public.photography_cart_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.photography_carts c
      WHERE c.id = photography_cart_items.cart_id
        AND c.customer_id = auth.uid()
    )
  );

COMMIT;

-- ROLLBACK SQL — execute only after application rollback and a fresh ACL review:
-- BEGIN;
-- DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Customers can update own reviews" ON public.reviews;
-- DROP POLICY IF EXISTS "Customers can delete own reviews" ON public.reviews;
-- DROP POLICY IF EXISTS "Customers can delete own photography cart items" ON public.photography_cart_items;
-- DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO public USING (auth.uid() = id);
-- ALTER TABLE public.booking_start_otps NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.booking_start_otps DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.reviews NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- Do not restore anonymous table grants automatically; recover them only from
-- the operator-captured pre-migration ACL if the security review approves it.

-- RLS acceptance tests for this migration live in
-- supabase/tests/20261206000000_feature_group_rls_completion.sql.

