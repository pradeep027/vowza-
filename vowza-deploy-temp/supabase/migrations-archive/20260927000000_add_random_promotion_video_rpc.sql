-- ============================================================================
-- HOTFIX: Add Random Promotion Video RPC
-- Purpose: Fix issue where Video 1 (priority_order=1) was always selected
-- New RPC uses ORDER BY RANDOM() to select from ALL eligible videos
-- ============================================================================

-- Drop old RPC if exists (will be replaced)
DROP FUNCTION IF EXISTS public.get_random_eligible_promotion_video(UUID);

-- ============================================================================
-- NEW RPC: get_random_eligible_promotion_video (FIXED FOR RANDOM SELECTION)
-- ✨ Fetches a RANDOMLY selected eligible promotion video for authenticated user
-- IMPORTANT: Uses ORDER BY RANDOM() to avoid always selecting priority_order = 1
-- Returns: one random video from ALL eligible videos (not just the first one)
-- 
-- Eligible = is_active AND unique_users_reached < user_limit
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_random_eligible_promotion_video(p_user_id UUID)
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
  ORDER BY RANDOM()  -- 🎲 SELECT RANDOMLY FROM ALL ELIGIBLE VIDEOS
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_random_eligible_promotion_video(UUID) TO authenticated;
