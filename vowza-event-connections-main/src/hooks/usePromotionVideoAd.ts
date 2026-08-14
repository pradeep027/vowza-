import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getActivePromotionVideo,
  getAllEligiblePromotionVideos,
  recordPromotionView,
  type PromotionVideoWithViewStatus,
  PROMOTION_VIDEO_UPDATED_EVENT,
} from '@/integrations/supabase/promotion-videos';

const CHANNEL_NAME = 'vowza-promotion-videos';
const PROMO_VIEWED_STORAGE_KEY = 'vowza_promo_viewed_user'; // Persistent one-time tracking

interface UsePromotionVideoAdResult {
  video: PromotionVideoWithViewStatus | null;
  isLoading: boolean;
  hasUserViewed: boolean;
  recordView: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing promotional video ads.
 * 
 * Features:
 * - Fetches active promotion videos for authenticated users
 * - Implements ONE-TIME display per user (persisted via localStorage + RPC check)
 * - Random selection among eligible videos for new users
 * - Prevents double-counting via database UNIQUE constraint
 */
export function usePromotionVideoAd(): UsePromotionVideoAdResult {
  const { user } = useAuth();
  const [video, setVideo] = useState<PromotionVideoWithViewStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUserViewed, setHasUserViewed] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // One-Time Display Tracking
  // ─────────────────────────────────────────────────────────────────────────
  // localStorage stores: "vowza_promo_viewed_user" → user_id
  // This ensures the ad shows only ONCE even across page refreshes/navigation
  // ─────────────────────────────────────────────────────────────────────────
  
  const hasUserAlreadySeenPromo = useCallback((): boolean => {
    try {
      const storedUserId = localStorage.getItem(PROMO_VIEWED_STORAGE_KEY);
      return storedUserId === user?.id;
    } catch (e) {
      console.warn('[usePromotionVideoAd] localStorage check failed:', e);
      return false;
    }
  }, [user?.id]);

  const markPromoAsViewed = useCallback(() => {
    try {
      if (user?.id) {
        localStorage.setItem(PROMO_VIEWED_STORAGE_KEY, user.id);
        console.log('[usePromotionVideoAd] Marked promo as viewed for user:', user.id);
      }
    } catch (e) {
      console.warn('[usePromotionVideoAd] localStorage write failed:', e);
    }
  }, [user?.id]);

  const refresh = useCallback(async () => {
    console.log('[usePromotionVideoAd] refresh() called, user?.id:', user?.id);
    
    if (!user?.id) {
      console.log('[usePromotionVideoAd] No user ID, clearing video');
      setVideo(null);
      setIsLoading(false);
      return;
    }

    // Check one-time display rule
    if (hasUserAlreadySeenPromo()) {
      console.log('[usePromotionVideoAd] ⏸️ User already received promotional ad - blocking repeat display');
      setVideo(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('[usePromotionVideoAd] Fetching eligible promotion video for user:', user.id);
      
      // Get ALL eligible videos (for random selection)
      const eligibleVideos = await getAllEligiblePromotionVideos(user.id);
      
      if (!eligibleVideos || eligibleVideos.length === 0) {
        console.warn('[usePromotionVideoAd] No eligible promotion videos available');
        setVideo(null);
      } else {
        // Random selection among eligible videos
        const selectedVideo = eligibleVideos[Math.floor(Math.random() * eligibleVideos.length)];
        console.log('[usePromotionVideoAd] ✅ Randomly selected video from', eligibleVideos.length, 'eligible:', selectedVideo.id);
        
        setVideo(selectedVideo);
        setHasUserViewed(selectedVideo.has_user_viewed ?? false);
      }
    } catch (error) {
      console.error('[usePromotionVideoAd] Exception in refresh():', error);
      setVideo(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, hasUserAlreadySeenPromo]);

  const recordView = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !video?.id) return false;

    // If user already viewed THIS VIDEO, skip recording to prevent double-count
    if (hasUserViewed) {
      console.log('[usePromotionVideoAd] recordView() skipped - user already counted for this video');
      return false;
    }

    try {
      console.log('[usePromotionVideoAd] Recording view for user:', user.id, 'video:', video.id);
      const recorded = await recordPromotionView(video.id, user.id);
      
      if (recorded) {
        console.log('[usePromotionVideoAd] ✅ View recorded - marking user promo as viewed');
        setHasUserViewed(true);
        // Mark in localStorage so user never sees promotional ad again
        markPromoAsViewed();
        // Refresh to get next video (if any)
        await refresh();
      } else {
        console.warn('[usePromotionVideoAd] recordPromotionView returned FALSE');
      }
      return recorded;
    } catch (error) {
      console.error('[usePromotionVideoAd] Failed to record view:', error);
      return false;
    }
  }, [user?.id, video?.id, hasUserViewed, refresh, markPromoAsViewed]);

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
    video,  // Return video for display (if eligible and user hasn't seen one-time promo)
    isLoading,
    hasUserViewed,  // Flags whether user was counted for THIS VIDEO
    recordView,
    refresh,
  };
  
  console.log('[usePromotionVideoAd] Returning:', {
    video: returnValue.video?.id,
    isLoading,
    hasUserViewed,
    shouldDisplay: !!video,
    userAlreadySawPromo: hasUserAlreadySeenPromo(),
  });
  
  return returnValue;
}

