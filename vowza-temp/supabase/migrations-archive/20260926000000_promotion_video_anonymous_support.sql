-- Anonymous Visitor Support for Promotion Videos — Phase 2
-- Enables promotional videos to display to unauthenticated visitors
-- Uses cryptographically random visitor IDs (no personal data)

-- ============================================================================
-- TABLE: auth_promotion_video_visitor_views
-- Tracks unique anonymous visitors who have viewed promotion videos
-- Ensures one-time display per anonymous visitor per video
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_promotion_video_visitor_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.auth_promotion_videos(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL CHECK (visitor_id <> ''),  -- Random UUID or identifier, NOT personal data
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  
  -- One view record per visitor per video
  CONSTRAINT auth_promotion_video_visitor_views_unique_visitor_video
    UNIQUE (video_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_video_visitor_views_video
  ON public.auth_promotion_video_visitor_views (video_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_video_visitor_views_visitor
  ON public.auth_promotion_video_visitor_views (visitor_id, viewed_at DESC);

-- ============================================================================
-- RLS POLICIES for visitor views
-- ============================================================================

ALTER TABLE public.auth_promotion_video_visitor_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_visitor_views'
      AND policyname = 'auth_promotion_video_visitor_views_insert'
  ) THEN
    CREATE POLICY auth_promotion_video_visitor_views_insert
      ON public.auth_promotion_video_visitor_views FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_visitor_views'
      AND policyname = 'auth_promotion_video_visitor_views_admin_select'
  ) THEN
    CREATE POLICY auth_promotion_video_visitor_views_admin_select
      ON public.auth_promotion_video_visitor_views FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

GRANT INSERT ON public.auth_promotion_video_visitor_views TO anon, authenticated;
GRANT SELECT ON public.auth_promotion_video_visitor_views TO authenticated;

-- ============================================================================
-- RPC: record_promotion_view_for_visitor
-- Records anonymous visitor view of promotion video
-- Increments unique_users_reached counter (for 15-user limit enforcement)
-- Returns: TRUE if recorded successfully, FALSE if limit reached
-- ATOMIC: Uses transaction to prevent race conditions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_promotion_view_for_visitor(
  p_video_id UUID,
  p_visitor_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_users INTEGER;
  v_user_limit INTEGER;
  v_already_viewed BOOLEAN;
BEGIN
  -- Check if this visitor already viewed this video
  SELECT EXISTS(
    SELECT 1 FROM public.auth_promotion_video_visitor_views
    WHERE video_id = p_video_id AND visitor_id = p_visitor_id
  ) INTO v_already_viewed;
  
  IF v_already_viewed THEN
    RETURN FALSE;
  END IF;

  -- Lock the video row to prevent concurrent updates from exceeding limit
  SELECT unique_users_reached, user_limit
  FROM public.auth_promotion_videos
  WHERE id = p_video_id
  INTO v_current_users, v_user_limit
  FOR UPDATE;

  IF v_current_users IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If limit already reached, reject
  IF v_current_users >= v_user_limit THEN
    RETURN FALSE;
  END IF;

  -- Insert the visitor view record
  BEGIN
    INSERT INTO public.auth_promotion_video_visitor_views (video_id, visitor_id)
    VALUES (p_video_id, p_visitor_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN FALSE;
  END;

  -- Increment the user count (treats each anonymous visitor as a unique user for limit purposes)
  UPDATE public.auth_promotion_videos
  SET unique_users_reached = unique_users_reached + 1
  WHERE id = p_video_id;

  -- If we just reached the limit, deactivate this video and activate next one
  SELECT unique_users_reached
  FROM public.auth_promotion_videos
  WHERE id = p_video_id
  INTO v_current_users;

  IF v_current_users >= v_user_limit THEN
    -- Deactivate current video
    UPDATE public.auth_promotion_videos
    SET is_active = FALSE
    WHERE id = p_video_id;

    -- Activate next video if it exists
    UPDATE public.auth_promotion_videos
    SET is_active = TRUE
    WHERE id = (
      SELECT id FROM public.auth_promotion_videos
      WHERE is_active = FALSE
        AND priority_order > (
          SELECT priority_order FROM public.auth_promotion_videos WHERE id = p_video_id
        )
      ORDER BY priority_order ASC
      LIMIT 1
    );
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_promotion_view_for_visitor(UUID, TEXT) TO anon, authenticated;

-- ============================================================================
-- COMMENT: Why this design?
-- ============================================================================

-- Anonymous visitors are tracked by cryptographically random visitor IDs:
--   ✓ Generated client-side using crypto.randomUUID()
--   ✓ Stored in browser localStorage
--   ✓ NO personal data (NO email, NO phone, NO IP, NO fingerprinting)
--   ✓ Persists across page refreshes and navigation
--   ✓ One-time display: localStorage flag prevents repeat ads
--   ✓ Atomic database counter still enforces 15-user limit
--   ✓ Admin can see anonymous impressions (visitor_id is random, not linked to person)

-- Both authenticated users and anonymous visitors use the same 15-user counter:
--   ✓ Mixing both types is intentional: limit is "15 unique viewers total"
--   ✓ Each authenticated user = 1 counter increment
--   ✓ Each anonymous visitor = 1 counter increment
--   ✓ When limit reached, video deactivates and next video activates

-- Security:
--   ✓ RLS allows INSERT by anon/authenticated (necessary for unauthenticated)
--   ✓ RLS restricts SELECT to admins only (privacy: don't expose visitor data to customers)
--   ✓ UNIQUE constraint on (video_id, visitor_id) prevents duplicate counting
--   ✓ FOR UPDATE lock in RPC prevents race conditions
