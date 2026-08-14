import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getActivePromotionVideo,
  recordPromotionView,
  type PromotionVideoWithViewStatus,
  PROMOTION_VIDEO_UPDATED_EVENT,
} from '@/integrations/supabase/promotion-videos';

const CHANNEL_NAME = 'vowza-promotion-videos';

interface UsePromotionVideoAdResult {
  video: PromotionVideoWithViewStatus | null;
  isLoading: boolean;
  hasUserViewed: boolean;
  recordView: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing promotional video ads.
 * Fetches the active promotion video for the authenticated user and handles view tracking.
 * Only authenticated users see promotions.
 */
export function usePromotionVideoAd(): UsePromotionVideoAdResult {
  const { user } = useAuth();
  const [video, setVideo] = useState<PromotionVideoWithViewStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUserViewed, setHasUserViewed] = useState(false);

  const refresh = useCallback(async () => {
    console.log('[usePromotionVideoAd] refresh() called, user?.id:', user?.id);
    if (!user?.id) {
      console.log('[usePromotionVideoAd] No user ID, clearing video');
      setVideo(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('[usePromotionVideoAd] Fetching active video for user:', user.id);
      console.log('[usePromotionVideoAd] About to call getActivePromotionVideo RPC...');
      const activeVideo = await getActivePromotionVideo(user.id);
      console.log('[usePromotionVideoAd] RPC completed. Result:', activeVideo);
      
      if (!activeVideo) {
        console.warn('[usePromotionVideoAd] RPC returned null/undefined - NO VIDEOS AVAILABLE');
        console.warn('[usePromotionVideoAd] Checking reasons:');
        console.warn('  - Is there a video in auth_promotion_videos?');
        console.warn('  - Is it marked as is_active = TRUE?');
        console.warn('  - Is unique_users_reached < user_limit?');
      }
      
      setVideo(activeVideo);
      setHasUserViewed(activeVideo?.has_user_viewed ?? false);
      console.log('[usePromotionVideoAd] State updated - video:', activeVideo, 'hasUserViewed:', activeVideo?.has_user_viewed ?? false);
    } catch (error) {
      console.error('[usePromotionVideoAd] Exception in refresh():', error);
      setVideo(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const recordView = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !video?.id) return false;

    try {
      const recorded = await recordPromotionView(video.id, user.id);
      if (recorded) {
        // Update local state to prevent double-showing
        setHasUserViewed(true);
        // Refresh to get next video in sequence
        await refresh();
      }
      return recorded;
    } catch (error) {
      console.error('[usePromotionVideoAd] Failed to record view:', error);
      return false;
    }
  }, [user?.id, video?.id, refresh]);

  // Fetch active video on mount and when user changes
  useEffect(() => {
    console.log('[usePromotionVideoAd] useEffect triggered, user?.id:', user?.id);
    void refresh();
  }, [user?.id, refresh]);

  // Listen for updates across tabs and from admin changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
    const onMessage = () => {
      console.log('[usePromotionVideoAd] Admin update detected, refreshing');
      void refresh();
    };

    window.addEventListener(PROMOTION_VIDEO_UPDATED_EVENT, onMessage);
    channel?.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener(PROMOTION_VIDEO_UPDATED_EVENT, onMessage);
      channel?.removeEventListener('message', onMessage);
      channel?.close();
    };
  }, [user?.id, refresh]);

  const returnValue = {
    video: video && !hasUserViewed ? video : null, // Only show if user hasn't viewed
    isLoading,
    hasUserViewed,
    recordView,
    refresh,
  };
  
  console.log('[usePromotionVideoAd] Returning:', {
    video: returnValue.video?.id,
    isLoading,
    hasUserViewed,
    videoExists: !!video,
    userViewed: hasUserViewed,
    shouldRender: !!(video && !hasUserViewed),
  });
  
  return returnValue;
}
