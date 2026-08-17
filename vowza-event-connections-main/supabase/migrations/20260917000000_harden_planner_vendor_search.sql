-- Migration: Harden search_vendors_sql RPC with area filtering and verification enforcement
-- Date: 2026-09-17
-- Purpose: 
--   1. Add p_area parameter for locality/area-based vendor search
--   2. Implement two-tier ranking (exact area > service areas)
--   3. Enforce verification_status, is_verified, is_published consistently
--   4. Return actual is_verified value (not hardcoded TRUE)
--   5. Normalize service_areas matching (case-insensitive, trimmed)

-- STEP 1: Drop old function by explicit signature (PostgreSQL safety)
-- Old signature: search_vendors_sql(TEXT, TEXT, NUMERIC, FLOAT, INTEGER)
DROP FUNCTION IF EXISTS public.search_vendors_sql(TEXT, TEXT, NUMERIC, FLOAT, INTEGER);

-- STEP 2: Create new function with p_area parameter and service-area normalization
CREATE OR REPLACE FUNCTION public.search_vendors_sql(
  p_profession TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_min_rating FLOAT DEFAULT 0,
  p_area TEXT DEFAULT NULL,              -- NEW PARAMETER
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  provider_id UUID,
  profession TEXT,
  stage_name TEXT,
  bio TEXT,
  price_min NUMERIC,
  price_max NUMERIC,
  average_rating FLOAT,
  total_reviews INT,
  total_bookings INT,
  is_verified BOOLEAN,                   -- ACTUAL database value, NOT TRUE
  is_available BOOLEAN,
  experience_years INT,
  cover_image_url TEXT,
  city TEXT,
  area TEXT,                             -- NEW OUTPUT
  full_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id,
    pp.profession::TEXT,
    pp.stage_name::TEXT,
    pp.bio::TEXT,
    pp.price_min::NUMERIC,
    pp.price_max::NUMERIC,
    COALESCE(pp.average_rating, 0)::FLOAT,
    COALESCE(pp.total_reviews, 0)::INT,
    COALESCE(pp.total_bookings, 0)::INT,
    COALESCE(pp.is_verified, FALSE)::BOOLEAN,  -- ACTUAL value, NOT TRUE
    COALESCE(pp.is_available, TRUE)::BOOLEAN,
    pp.experience_years::INT,
    pp.cover_image_url::TEXT,
    pr.city::TEXT,
    pr.area::TEXT,                        -- NEW OUTPUT
    pr.full_name::TEXT,
    pr.avatar_url::TEXT
  FROM public.provider_profiles pp
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE pp.verification_status IN ('approved', 'verified')
    AND COALESCE(pp.is_verified, FALSE) = TRUE
    AND COALESCE(pp.is_published, FALSE) = TRUE
    AND (p_profession IS NULL OR pp.profession::TEXT = p_profession)
    AND (p_city IS NULL OR LOWER(COALESCE(pr.city, '')) LIKE LOWER('%' || p_city || '%'))
    -- NEW: Area filtering with service-areas normalization
    AND (p_area IS NULL OR 
      LOWER(TRIM(COALESCE(pr.area, ''))) LIKE '%' || LOWER(TRIM(p_area)) || '%'
      OR
      EXISTS (
        SELECT 1 FROM UNNEST(COALESCE(pp.service_areas, '{}')) AS sa
        WHERE LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
      )
    )
    AND (p_price_max IS NULL OR pp.price_min IS NULL OR pp.price_min <= p_price_max)
    AND COALESCE(pp.average_rating, 0) >= p_min_rating
  ORDER BY 
    -- TWO-TIER LOCATION RANKING (no city fallback when area specified)
    CASE 
      WHEN LOWER(TRIM(COALESCE(pr.area, ''))) LIKE '%' || LOWER(TRIM(p_area)) || '%' THEN 0
      WHEN EXISTS (
        SELECT 1 FROM UNNEST(COALESCE(pp.service_areas, '{}')) AS sa
        WHERE LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
      ) THEN 1
    END,
    COALESCE(pp.average_rating, 0) DESC,
    COALESCE(pp.total_bookings, 0) DESC
  LIMIT p_limit;
END;
$$;

-- STEP 3: Ensure permissions are set (idempotent)
GRANT EXECUTE ON FUNCTION public.search_vendors_sql TO authenticated, anon;
