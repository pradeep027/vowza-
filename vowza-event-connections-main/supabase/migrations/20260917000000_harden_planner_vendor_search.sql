-- Harden marketplace RPCs used by the AI Planner.
-- This migration is intentionally additive and is not applied by this local fix.
-- A provider is eligible only when both the workflow status and the explicit
-- verification flag are approved, preventing unverified profiles from reaching
-- the planner even if a caller bypasses client-side validation.

CREATE OR REPLACE FUNCTION public.match_vendors(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5,
  filter_profession TEXT DEFAULT NULL,
  filter_city TEXT DEFAULT NULL,
  filter_price_max NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  provider_id UUID,
  profession TEXT,
  content TEXT,
  similarity FLOAT,
  price_min NUMERIC,
  price_max NUMERIC,
  average_rating FLOAT,
  is_verified BOOLEAN,
  city TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ve.provider_id,
    pp.profession::TEXT,
    ve.content,
    (1 - (ve.embedding <=> query_embedding))::FLOAT,
    pp.price_min::NUMERIC,
    pp.price_max::NUMERIC,
    COALESCE(pp.average_rating, 0)::FLOAT,
    TRUE,
    pr.city::TEXT
  FROM public.vendor_embeddings ve
  JOIN public.provider_profiles pp ON pp.id = ve.provider_id
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE ve.embedding IS NOT NULL
    AND pp.verification_status IN ('approved', 'verified')
    AND COALESCE(pp.is_verified, FALSE) = TRUE
    AND COALESCE(pp.is_published, FALSE) = TRUE
    AND (filter_profession IS NULL OR pp.profession::TEXT = filter_profession)
    AND (filter_city IS NULL OR LOWER(pr.city) LIKE LOWER('%' || filter_city || '%'))
    AND (filter_price_max IS NULL OR pp.price_min IS NULL OR pp.price_min <= filter_price_max)
    AND 1 - (ve.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- PostgreSQL cannot alter a function's OUT/RETURNS TABLE row type in place.
-- Replace only this Planner RPC so the published-profile hardening can deploy
-- over the legacy signature without applying unrelated migrations.
DROP FUNCTION IF EXISTS public.search_vendors_sql(TEXT, TEXT, NUMERIC, DOUBLE PRECISION, INTEGER);

CREATE OR REPLACE FUNCTION public.search_vendors_sql(
  p_profession TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_min_rating FLOAT DEFAULT 0,
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
  is_verified BOOLEAN,
  is_available BOOLEAN,
  experience_years INT,
  cover_image_url TEXT,
  city TEXT,
  full_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
STABLE
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
    TRUE,
    COALESCE(pp.is_available, TRUE)::BOOLEAN,
    pp.experience_years::INT,
    pp.cover_image_url::TEXT,
    pr.city::TEXT,
    pr.full_name::TEXT,
    pr.avatar_url::TEXT
  FROM public.provider_profiles pp
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE pp.verification_status IN ('approved', 'verified')
    AND COALESCE(pp.is_verified, FALSE) = TRUE
    AND COALESCE(pp.is_published, FALSE) = TRUE
    AND (p_profession IS NULL OR pp.profession::TEXT = p_profession)
    AND (p_city IS NULL OR LOWER(COALESCE(pr.city, '')) LIKE LOWER('%' || p_city || '%'))
    AND (p_price_max IS NULL OR pp.price_min IS NULL OR pp.price_min <= p_price_max)
    AND COALESCE(pp.average_rating, 0) >= p_min_rating
  ORDER BY COALESCE(pp.average_rating, 0) DESC, COALESCE(pp.total_bookings, 0) DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_vendors TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_vendors_sql TO authenticated, anon;
