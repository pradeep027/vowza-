-- HOTFIX: Photography & Videography Customer Visibility Policies
-- Timestamp: 20261025000000 (October 25, 2026)
-- Purpose: Fix customer SELECT policies to prevent draft package visibility
--
-- ISSUE: 
--   - Migration 20261022000000 dropped the customer_select policy but didn't recreate it
--   - Migration 20261001000000 has correct main policy (status='active') 
--     but images/addons policies still allow draft visibility (status IN ('active', 'draft'))
--
-- FIX:
--   - Recreate the missing customer_select policy for packages (status='active' only)
--   - Fix images customer policy to match (status='active' only)  
--   - Fix addons customer policy to match (status='active' only)
--
-- This ensures customers NEVER see draft packages at database level

-- ═════════════════════════════════════════════════════════════════════════════════
-- 1. RECREATE MISSING photography_videography_packages CUSTOMER SELECT POLICY
-- ═════════════════════════════════════════════════════════════════════════════════

-- This policy was dropped by 20261022000000 and never recreated
-- Recreate it with correct conditions: only active packages visible
DROP POLICY IF EXISTS photography_videography_customer_select ON public.photography_videography_packages CASCADE;

CREATE POLICY photography_videography_customer_select 
  ON public.photography_videography_packages 
  FOR SELECT 
  USING (is_active = TRUE AND is_visible = TRUE AND status = 'active');

COMMENT ON POLICY photography_videography_customer_select ON public.photography_videography_packages 
  IS 'Customers can only view active, visible packages (not draft/paused/archived)';

-- ═════════════════════════════════════════════════════════════════════════════════
-- 2. FIX photography_videography_package_images CUSTOMER SELECT POLICY
-- ═════════════════════════════════════════════════════════════════════════════════

-- Remove old buggy policy that exposes draft images
DROP POLICY IF EXISTS photography_videography_images_customer ON public.photography_videography_package_images CASCADE;

-- Recreate with correct condition: only images for active packages
CREATE POLICY photography_videography_images_customer 
  ON public.photography_videography_package_images 
  FOR SELECT 
  USING (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE is_active = TRUE AND is_visible = TRUE AND status = 'active'
    )
  );

COMMENT ON POLICY photography_videography_images_customer ON public.photography_videography_package_images 
  IS 'Customers can only view images for active, visible packages';

-- ═════════════════════════════════════════════════════════════════════════════════
-- 3. FIX photography_videography_package_addons CUSTOMER SELECT POLICY
-- ═════════════════════════════════════════════════════════════════════════════════

-- Remove old buggy policy that exposes draft add-ons
DROP POLICY IF EXISTS photography_videography_addons_customer ON public.photography_videography_package_addons CASCADE;

-- Recreate with correct condition: only add-ons for active packages
CREATE POLICY photography_videography_addons_customer 
  ON public.photography_videography_package_addons 
  FOR SELECT 
  USING (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE is_active = TRUE AND is_visible = TRUE AND status = 'active'
    )
  );

COMMENT ON POLICY photography_videography_addons_customer ON public.photography_videography_package_addons 
  IS 'Customers can only view add-ons for active, visible packages';

-- ═════════════════════════════════════════════════════════════════════════════════
-- 4. VERIFICATION QUERIES (NOT EXECUTED, FOR DOCUMENTATION)
-- ═════════════════════════════════════════════════════════════════════════════════

-- After this migration, verify draft packages are NOT visible:
-- 
-- SELECT COUNT(*) FROM photography_videography_packages 
-- WHERE status = 'draft' AND is_active = TRUE AND is_visible = TRUE;
-- Expected result: Packages exist but NOT ACCESSIBLE via SELECT due to RLS
--
-- SELECT COUNT(*) FROM photography_videography_packages 
-- WHERE status = 'active' AND is_active = TRUE AND is_visible = TRUE;
-- Expected result: Only active packages accessible to customers
--
-- ═════════════════════════════════════════════════════════════════════════════════

