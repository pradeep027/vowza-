-- Auth Promotion Videos system: Separate promotional video ads with 15-user atomic limit
-- This is completely independent from the homepage image carousel system.

-- ============================================================================
-- TABLE: auth_promotion_videos
-- Stores promotional videos managed by admin with configurable user limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_promotion_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  video_url TEXT NOT NULL CHECK (video_url <> ''),
  storage_path TEXT NOT NULL CHECK (storage_path <> ''),
  priority_order INTEGER NOT NULL DEFAULT 0 CHECK (priority_order >= 0),
  display_position TEXT NOT NULL DEFAULT 'bottom-right' CHECK (display_position IN ('top-left', 'top-right', 'bottom-left', 'bottom-right')),
  user_limit INTEGER NOT NULL DEFAULT 15 CHECK (user_limit > 0),
  unique_users_reached INTEGER NOT NULL DEFAULT 0 CHECK (unique_users_reached >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT auth_promotion_videos_user_limit_not_exceeded
    CHECK (unique_users_reached <= user_limit)
);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_videos_active_priority
  ON public.auth_promotion_videos (is_active, priority_order, created_at)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_auth_promotion_videos_priority
  ON public.auth_promotion_videos (priority_order, created_at);

-- Ensure unique priority order only among active videos
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_promotion_videos_unique_active_priority
  ON public.auth_promotion_videos (priority_order)
  WHERE is_active = TRUE;

-- ============================================================================
-- TABLE: auth_promotion_video_views
-- Tracks unique authenticated users who have viewed each promotion video
-- Enforces one-time-only view counting per user per video
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_promotion_video_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.auth_promotion_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  watch_duration_seconds INTEGER CHECK (watch_duration_seconds IS NULL OR watch_duration_seconds >= 0),
  was_closed BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- One view record per user per video
  CONSTRAINT auth_promotion_video_views_unique_user_video
    UNIQUE (video_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_video_views_video
  ON public.auth_promotion_video_views (video_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_video_views_user
  ON public.auth_promotion_video_views (user_id, viewed_at DESC);

-- ============================================================================
-- TRIGGER: Update auth_promotion_videos updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_auth_promotion_videos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_auth_promotion_videos_updated_at ON public.auth_promotion_videos;
CREATE TRIGGER set_auth_promotion_videos_updated_at
  BEFORE UPDATE ON public.auth_promotion_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_auth_promotion_videos_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.auth_promotion_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_promotion_video_views ENABLE ROW LEVEL SECURITY;

-- auth_promotion_videos: Public select (active only) / Admin write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_videos'
      AND policyname = 'auth_promotion_videos_public_select'
  ) THEN
    CREATE POLICY auth_promotion_videos_public_select
      ON public.auth_promotion_videos FOR SELECT
      USING (
        is_active = TRUE
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_videos'
      AND policyname = 'auth_promotion_videos_admin_insert'
  ) THEN
    CREATE POLICY auth_promotion_videos_admin_insert
      ON public.auth_promotion_videos FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_videos'
      AND policyname = 'auth_promotion_videos_admin_update'
  ) THEN
    CREATE POLICY auth_promotion_videos_admin_update
      ON public.auth_promotion_videos FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_videos'
      AND policyname = 'auth_promotion_videos_admin_delete'
  ) THEN
    CREATE POLICY auth_promotion_videos_admin_delete
      ON public.auth_promotion_videos FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

-- auth_promotion_video_views: Users insert own views / Admin read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_views'
      AND policyname = 'auth_promotion_video_views_user_insert'
  ) THEN
    CREATE POLICY auth_promotion_video_views_user_insert
      ON public.auth_promotion_video_views FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_views'
      AND policyname = 'auth_promotion_video_views_user_select'
  ) THEN
    CREATE POLICY auth_promotion_video_views_user_select
      ON public.auth_promotion_video_views FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_views'
      AND policyname = 'auth_promotion_video_views_admin_update'
  ) THEN
    CREATE POLICY auth_promotion_video_views_admin_update
      ON public.auth_promotion_video_views FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_views'
      AND policyname = 'auth_promotion_video_views_admin_delete'
  ) THEN
    CREATE POLICY auth_promotion_video_views_admin_delete
      ON public.auth_promotion_video_views FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

-- ============================================================================
-- RPC: get_active_promotion_video
-- Fetches the currently active promotional video for an authenticated user
-- Returns: video details + whether user has already viewed it
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_active_promotion_video(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  video_url TEXT,
  priority_order INTEGER,
  display_position TEXT,
  user_limit INTEGER,
  unique_users_reached INTEGER,
  has_user_viewed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.video_url,
    v.priority_order,
    v.display_position,
    v.user_limit,
    v.unique_users_reached,
    COALESCE(EXISTS(
      SELECT 1 FROM public.auth_promotion_video_views
      WHERE video_id = v.id AND user_id = p_user_id
    ), FALSE) AS has_user_viewed
  FROM public.auth_promotion_videos v
  WHERE v.is_active = TRUE
    AND v.unique_users_reached < v.user_limit
  ORDER BY v.priority_order ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_active_promotion_video(UUID) TO authenticated;

-- ============================================================================
-- RPC: record_promotion_view
-- Atomically records a user's view of a promotion video and enforces 15-user limit
-- Returns: TRUE if view was recorded successfully
--          FALSE if user already viewed, or limit reached, or other error
-- ATOMIC: Uses transaction to prevent race conditions on user_limit enforcement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_promotion_view(
  p_video_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_users INTEGER;
  v_user_limit INTEGER;
  v_already_viewed BOOLEAN;
BEGIN
  -- Check if user already viewed this video
  SELECT EXISTS(
    SELECT 1 FROM public.auth_promotion_video_views
    WHERE video_id = p_video_id AND user_id = p_user_id
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

  -- Insert the view record (will fail with unique constraint if user already viewed)
  BEGIN
    INSERT INTO public.auth_promotion_video_views (video_id, user_id)
    VALUES (p_video_id, p_user_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN FALSE;
  END;

  -- Increment the user count
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

GRANT EXECUTE ON FUNCTION public.record_promotion_view(UUID, UUID) TO authenticated;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON public.auth_promotion_videos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.auth_promotion_videos TO authenticated;
GRANT SELECT, INSERT ON public.auth_promotion_video_views TO authenticated;

