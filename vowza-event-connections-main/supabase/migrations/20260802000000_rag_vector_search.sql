-- ============================================================
-- RAG Vector Search — Vowza AI Planner
-- Enables semantic vendor search using pgvector.
-- Fully idempotent. Compatible with Supabase PostgreSQL.
-- ============================================================

-- ── 1. Enable pgvector extension ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Vendor embeddings table ────────────────────────────────────────────────
-- Stores pre-computed embeddings for vendor profiles so the AI can do
-- semantic nearest-neighbour search instead of only keyword matching.
CREATE TABLE IF NOT EXISTS public.vendor_embeddings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID        NOT NULL
                    REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,   -- the text that was embedded
  embedding       vector(1536),           -- OpenAI text-embedding-3-small (1536 dims)
  embedding_sm    vector(384),            -- smaller model fallback (384 dims)
  content_type    TEXT        DEFAULT 'profile',  -- profile | menu | package | review | faq
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_embeddings_provider
  ON public.vendor_embeddings (provider_id);

-- IVFFlat index for fast approximate nearest-neighbour on 1536-dim embeddings
-- lists=100 is appropriate for up to ~1M rows
CREATE INDEX IF NOT EXISTS idx_vendor_embeddings_vector
  ON public.vendor_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.vendor_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embeddings_public_read" ON public.vendor_embeddings;
CREATE POLICY "embeddings_public_read"
  ON public.vendor_embeddings FOR SELECT USING (true);

DROP POLICY IF EXISTS "embeddings_admin_write" ON public.vendor_embeddings;
CREATE POLICY "embeddings_admin_write"
  ON public.vendor_embeddings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── 3. Semantic vendor search function ────────────────────────────────────────
-- Called by the RAG retriever with a query embedding.
-- Returns the top-k most relevant vendor profiles.
CREATE OR REPLACE FUNCTION public.match_vendors(
  query_embedding  vector(1536),
  match_count      INT     DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5,
  filter_profession    TEXT  DEFAULT NULL,
  filter_city          TEXT  DEFAULT NULL,
  filter_price_max     NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  provider_id   UUID,
  profession    TEXT,
  content       TEXT,
  similarity    FLOAT,
  price_min     NUMERIC,
  price_max     NUMERIC,
  average_rating FLOAT,
  is_verified   BOOLEAN,
  city          TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ve.provider_id,
    pp.profession::TEXT                        AS profession,
    ve.content,
    (1 - (ve.embedding <=> query_embedding))::FLOAT AS similarity,
    pp.price_min::NUMERIC                      AS price_min,
    pp.price_max::NUMERIC                      AS price_max,
    COALESCE(pp.average_rating, 0)::FLOAT      AS average_rating,
    COALESCE(pp.is_verified, FALSE)::BOOLEAN   AS is_verified,
    pr.city::TEXT                              AS city
  FROM public.vendor_embeddings ve
  JOIN public.provider_profiles pp ON pp.id = ve.provider_id
  LEFT JOIN public.profiles pr      ON pr.id = pp.user_id
  WHERE
    ve.embedding IS NOT NULL
    AND pp.verification_status IN ('approved', 'verified')
    AND (filter_profession IS NULL OR pp.profession::TEXT = filter_profession)
    AND (filter_city       IS NULL OR LOWER(pr.city) LIKE LOWER('%' || filter_city || '%'))
    AND (filter_price_max  IS NULL OR pp.price_min IS NULL OR pp.price_min <= filter_price_max)
    AND 1 - (ve.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── 4. SQL-only (no-vector) vendor search function ────────────────────────────
-- Fallback used when no embedding exists yet. Performs keyword + filter search.
CREATE OR REPLACE FUNCTION public.search_vendors_sql(
  p_profession TEXT     DEFAULT NULL,
  p_city       TEXT     DEFAULT NULL,
  p_price_max  NUMERIC  DEFAULT NULL,
  p_min_rating FLOAT    DEFAULT 0,
  p_limit      INT      DEFAULT 10
)
RETURNS TABLE (
  provider_id       UUID,
  profession        TEXT,
  stage_name        TEXT,
  bio               TEXT,
  price_min         NUMERIC,
  price_max         NUMERIC,
  average_rating    FLOAT,
  total_reviews     INT,
  total_bookings    INT,
  is_verified       BOOLEAN,
  is_available      BOOLEAN,
  experience_years  INT,
  cover_image_url   TEXT,
  city              TEXT,
  full_name         TEXT,
  avatar_url        TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id                                    AS provider_id,
    pp.profession::TEXT                      AS profession,
    pp.stage_name::TEXT                      AS stage_name,
    pp.bio::TEXT                             AS bio,
    pp.price_min::NUMERIC                    AS price_min,
    pp.price_max::NUMERIC                    AS price_max,
    COALESCE(pp.average_rating, 0)::FLOAT    AS average_rating,
    COALESCE(pp.total_reviews, 0)::INT       AS total_reviews,
    COALESCE(pp.total_bookings, 0)::INT      AS total_bookings,
    COALESCE(pp.is_verified, FALSE)::BOOLEAN AS is_verified,
    COALESCE(pp.is_available, TRUE)::BOOLEAN AS is_available,
    pp.experience_years::INT                 AS experience_years,
    pp.cover_image_url::TEXT                 AS cover_image_url,
    pr.city::TEXT                            AS city,
    pr.full_name::TEXT                       AS full_name,
    pr.avatar_url::TEXT                      AS avatar_url
  FROM public.provider_profiles pp
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE
    pp.verification_status IN ('approved', 'verified')
    AND (p_profession IS NULL OR pp.profession::TEXT = p_profession)
    AND (p_city       IS NULL OR LOWER(COALESCE(pr.city, '')) LIKE LOWER('%' || p_city || '%'))
    AND (p_price_max  IS NULL OR pp.price_min IS NULL OR pp.price_min <= p_price_max)
    AND COALESCE(pp.average_rating, 0) >= p_min_rating
  ORDER BY
    COALESCE(pp.is_verified, FALSE) DESC,
    COALESCE(pp.average_rating, 0) DESC,
    COALESCE(pp.total_bookings, 0) DESC
  LIMIT p_limit;
END;
$$;

-- ── 5. Grant execute to authenticated and anon ────────────────────────────────
GRANT EXECUTE ON FUNCTION public.match_vendors TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_vendors_sql TO authenticated, anon;

-- ── 6. AI conversations table (if not already created) ────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL,
  title           TEXT        NOT NULL DEFAULT 'New Conversation',
  context_summary JSONB       DEFAULT '{}',
  last_active_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
  ON public.ai_conversations (user_id, last_active_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_owner" ON public.ai_conversations;
CREATE POLICY "ai_conversations_owner"
  ON public.ai_conversations FOR ALL
  USING (user_id = auth.uid());

-- ── 7. AI messages table (if not already created) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL
                    REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL,
  role            TEXT        NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT        NOT NULL,
  ai_response     JSONB,
  rag_context     JSONB,      -- stores what was retrieved for this message
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
  ON public.ai_messages (conversation_id, created_at ASC);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_messages_owner" ON public.ai_messages;
CREATE POLICY "ai_messages_owner"
  ON public.ai_messages FOR ALL
  USING (user_id = auth.uid());
