-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: Missing UPDATE policies on category-specific booking tables.
--
-- ROOT CAUSE: Vendor accept/decline and customer cancel/pay-advance mutations
-- were SILENTLY FAILING because RLS blocked the UPDATE.
--
-- - catering_bookings: had customer UPDATE but NO vendor UPDATE
-- - photography_package_bookings: had NO update policy at all
-- - drone_bookings: already correct (has both)
-- - generic bookings: already correct ('Booking parties can update')
--
-- This migration adds the missing policies so both parties can update bookings.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── CATERING BOOKINGS: Add vendor/provider UPDATE policy ────────────────────
-- The customer policy already exists (from 20260808000000), keep it.
-- Add provider policy: caterer who owns the booking can update it.
DROP POLICY IF EXISTS catering_bookings_provider_update ON public.catering_bookings;
CREATE POLICY catering_bookings_provider_update ON public.catering_bookings
  FOR UPDATE TO authenticated
  USING (public.owns_caterer(provider_id))
  WITH CHECK (public.owns_caterer(provider_id));

-- ─── PHOTOGRAPHY PACKAGE BOOKINGS: Add both customer AND vendor UPDATE policies ──
-- Currently has ZERO update policies — neither party can update.
DROP POLICY IF EXISTS photography_bookings_customer_update ON public.photography_package_bookings;
CREATE POLICY photography_bookings_customer_update ON public.photography_package_bookings
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS photography_bookings_provider_update ON public.photography_package_bookings;
CREATE POLICY photography_bookings_provider_update ON public.photography_package_bookings
  FOR UPDATE TO authenticated
  USING (public.owns_photographer(photographer_id))
  WITH CHECK (public.owns_photographer(photographer_id));
