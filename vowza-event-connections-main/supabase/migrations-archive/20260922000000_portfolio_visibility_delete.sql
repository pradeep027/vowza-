-- ════════════════════════════════════════════════════════════════════════════════
-- PORTFOLIO VISIBILITY & DELETE MANAGEMENT
-- ════════════════════════════════════════════════════════════════════════════════
--
-- Feature: Portfolio item visibility control and deletion
--
-- Changes:
-- 1. Add `is_published` field to portfolio_items (default FALSE for new items)
-- 2. Update RLS policies to respect visibility
-- 3. Allow owners to delete their own portfolio items
-- 4. Ensure private items are not publicly accessible
--
-- This applies to the unified portfolio_items table used by ALL vendor categories.
--
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. Add visibility field to portfolio_items
-- ─────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;

-- Index for faster filtering on public portfolio queries
CREATE INDEX IF NOT EXISTS portfolio_published_idx ON public.portfolio_items(provider_id, is_published);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. Update RLS policies for visibility control
-- ─────────────────────────────────────────────────────────────────────────────────

-- Drop old unrestricted policies
DROP POLICY IF EXISTS "portfolio_public_read" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_owner_write" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_select" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_insert" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_update" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_delete" ON public.portfolio_items;

-- ─── SELECT: Public items + owner's private items ────────────────────────────────
CREATE POLICY portfolio_select ON public.portfolio_items
  FOR SELECT
  USING (
    -- Published items: accessible to everyone
    (is_published = TRUE)
    OR
    -- Private items: only owner can see
    (provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()))
  );

-- ─── INSERT: Only owner can insert ─────────────────────────────────────────────────
CREATE POLICY portfolio_insert ON public.portfolio_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

-- ─── UPDATE: Only owner can update ─────────────────────────────────────────────────
CREATE POLICY portfolio_update ON public.portfolio_items
  FOR UPDATE
  USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

-- ─── DELETE: Only owner can delete ─────────────────────────────────────────────────
CREATE POLICY portfolio_delete ON public.portfolio_items
  FOR DELETE
  USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. Ensure RLS is enabled on portfolio_items
-- ─────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. Backfill existing items to be published (preserve current behavior)
-- ─────────────────────────────────────────────────────────────────────────────────

UPDATE public.portfolio_items
SET is_published = TRUE
WHERE is_published = FALSE;

-- ════════════════════════════════════════════════════════════════════════════════
-- EXPLANATION OF CHANGES
-- ════════════════════════════════════════════════════════════════════════════════
--
-- SELECT Policy:
--   - Public items (is_published = TRUE) can be seen by everyone
--   - Private items (is_published = FALSE) can only be seen by their owner
--   - Owner determined by: portfolio_items.provider_id → provider_profiles.user_id
--
-- INSERT Policy:
--   - Only authenticated users who own a provider_profiles can insert
--
-- UPDATE Policy:
--   - Only owner can change is_published status or other fields
--
-- DELETE Policy:
--   - Only owner can delete their portfolio items
--
-- Storage Access:
--   - Public URLs are still accessible, but database-level RLS enforces access control
--   - Private items should not be returned by queries
--   - Storage buckets have separate policies that allow public access to files,
--     but frontend should only show private URLs in owner's dashboard
--
-- ════════════════════════════════════════════════════════════════════════════════

