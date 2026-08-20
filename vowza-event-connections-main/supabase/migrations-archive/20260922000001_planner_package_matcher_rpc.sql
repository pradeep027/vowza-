-- ─── PHASE 2C: Planner Package Matcher RPC ────────────────────────────────────
-- Creates RPC function for matching Admin Event Packages to budget allocations
-- 
-- Purpose: Find best matching Admin Event Packages based on:
--   - Event type
--   - Budget ceiling
--   - Guest count (optional context)
--   - Tier preference (silver/gold/platinum)
--
-- Usage from JavaScript:
--   const { data, error } = await supabase.rpc('match_admin_event_package', {
--     p_event_type: 'wedding',
--     p_max_budget: 500000,
--     p_tier: 'gold',
--     p_guest_count: 300,
--     p_city: 'Hyderabad'
--   });

-- ─── DROP existing function if any ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.match_admin_event_package(
  p_event_type TEXT,
  p_max_budget NUMERIC,
  p_tier TEXT,
  p_guest_count INT,
  p_city TEXT
) CASCADE;

-- ─── CREATE RPC: match_admin_event_package ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_admin_event_package(
  p_event_type TEXT DEFAULT NULL,
  p_max_budget NUMERIC DEFAULT NULL,
  p_tier TEXT DEFAULT NULL,
  p_guest_count INT DEFAULT NULL,
  p_city TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  event_type_id UUID,
  event_type_name TEXT,
  tier TEXT,
  display_name TEXT,
  description TEXT,
  base_price NUMERIC,
  discount_percentage NUMERIC,
  final_price NUMERIC,
  max_category_selections INT,
  max_professionals_per_category INT,
  is_active BOOLEAN,
  sort_order INT,
  created_at TIMESTAMP,
  match_confidence INT,
  match_reason TEXT
) LANGUAGE sql STABLE AS $$
  WITH package_matches AS (
    SELECT
      aep.id,
      aep.event_type_id,
      et."name" as event_type_name,
      aep.tier,
      aep.display_name,
      aep.description,
      aep.base_price,
      aep.discount_percentage,
      aep.final_price,
      aep.max_category_selections,
      aep.max_professionals_per_category,
      aep.is_active,
      aep.sort_order,
      aep.created_at,
      -- Confidence scoring (0-100)
      CASE
        -- Tier exact match: +40 points
        WHEN (p_tier IS NOT NULL AND aep.tier = p_tier) THEN 40
        -- Adjacent tier (gold vs gold±1): +25 points
        WHEN (p_tier IS NOT NULL AND 
              ((p_tier = 'silver' AND aep.tier IN ('silver', 'gold')) OR
               (p_tier = 'gold' AND aep.tier IN ('silver', 'gold', 'platinum')) OR
               (p_tier = 'platinum' AND aep.tier IN ('gold', 'platinum')))) THEN 25
        -- Different tier: +10 points
        ELSE 10
      END +
      -- Budget fit: +30 points if final_price <= max_budget, -20 if over
      CASE
        WHEN (p_max_budget IS NOT NULL AND aep.final_price <= p_max_budget) THEN 30
        WHEN (p_max_budget IS NOT NULL AND aep.final_price > p_max_budget) THEN -20
        ELSE 15  -- No budget constraint
      END +
      -- Event type relevance: +30 points for exact match, -10 for mismatch
      CASE
        WHEN (p_event_type IS NOT NULL AND LOWER(et."name") = LOWER(p_event_type)) THEN 30
        WHEN (p_event_type IS NOT NULL AND 
              (LOWER(et."name") LIKE LOWER(p_event_type) || '%' OR
               LOWER(p_event_type) LIKE LOWER(et."name") || '%')) THEN 15
        WHEN (p_event_type IS NULL) THEN 0  -- No filtering
        ELSE -10  -- Mismatch
      END AS confidence,
      -- Match reason explanation
      CASE
        WHEN (p_tier IS NOT NULL AND aep.tier = p_tier) THEN 'Exact tier match'
        WHEN (p_max_budget IS NOT NULL AND aep.final_price <= p_max_budget) THEN 'Within budget'
        WHEN (p_tier IS NOT NULL AND 
              ((p_tier = 'silver' AND aep.tier IN ('silver', 'gold')) OR
               (p_tier = 'gold' AND aep.tier IN ('silver', 'gold', 'platinum')) OR
               (p_tier = 'platinum' AND aep.tier IN ('gold', 'platinum')))) THEN 'Adjacent tier'
        ELSE 'Matching package'
      END AS match_reason
    FROM public.admin_event_packages aep
    JOIN public.event_types et ON aep.event_type_id = et.id
    WHERE
      -- Filter by event type (if provided)
      (p_event_type IS NULL OR LOWER(et."name") = LOWER(p_event_type))
      -- Only active packages
      AND aep.is_active = TRUE
      -- Optional: filter by budget ceiling (allow 20% overage for premium options)
      AND (p_max_budget IS NULL OR aep.final_price <= p_max_budget * 1.2)
      -- Optional: filter by tier
      AND (p_tier IS NULL OR aep.tier = p_tier)
  )
  SELECT
    pm.id,
    pm.event_type_id,
    pm.event_type_name,
    pm.tier,
    pm.display_name,
    pm.description,
    pm.base_price,
    pm.discount_percentage,
    pm.final_price,
    pm.max_category_selections,
    pm.max_professionals_per_category,
    pm.is_active,
    pm.sort_order,
    pm.created_at,
    GREATEST(0, LEAST(100, pm.confidence))::INT as match_confidence,
    pm.match_reason
  FROM package_matches pm
  -- Sort by: confidence (desc), price (asc)
  ORDER BY pm.confidence DESC, pm.final_price ASC;
$$ SECURITY INVOKER;

-- ─── GRANT permissions ────────────────────────────────────────────────────────
-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.match_admin_event_package(
  TEXT, NUMERIC, TEXT, INT, TEXT
) TO authenticated, anon;

-- ─── Create a simpler view-based function for common use case ──────────────────
-- Simple lookup: Get TOP package for tier
DROP FUNCTION IF EXISTS public.get_top_admin_package_for_tier(
  p_event_type TEXT,
  p_tier TEXT
) CASCADE;

CREATE OR REPLACE FUNCTION public.get_top_admin_package_for_tier(
  p_event_type TEXT,
  p_tier TEXT
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  description TEXT,
  final_price NUMERIC,
  tier TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    aep.id,
    aep.display_name,
    aep.description,
    aep.final_price,
    aep.tier
  FROM public.admin_event_packages aep
  JOIN public.event_types et ON aep.event_type_id = et.id
  WHERE
    (p_event_type IS NULL OR LOWER(et."name") = LOWER(p_event_type))
    AND (p_tier IS NULL OR aep.tier = p_tier)
    AND aep.is_active = TRUE
  ORDER BY aep.final_price ASC
  LIMIT 1;
$$ SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION public.get_top_admin_package_for_tier(
  TEXT, TEXT
) TO authenticated, anon;

-- ─── CREATE INDEX for performance ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_event_packages_event_tier_active
  ON public.admin_event_packages(event_type_id, tier, is_active);

CREATE INDEX IF NOT EXISTS idx_admin_event_packages_final_price
  ON public.admin_event_packages(final_price);

-- ✅ Phase 2C RPC created successfully
-- Ready for use from packageMatcher.ts findMatchingPackages()
