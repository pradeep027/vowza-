import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getRandomPromotionVideo,
  getRandomPromotionVideoForVisitor,
  type PromotionVideoWithViewStatus,
  PROMOTION_VIDEO_UPDATED_EVENT,
} from '@/integrations/supabase/promotion-videos';

const CHANNEL_NAME = 'vowza-promotion-videos';
const PROMO_VIEWED_STORAGE_KEY = 'vowza_promo_viewed_user'; // For authenticated users
const PROMO_VISITOR_ID_KEY = 'vowza_promo_visitor_id'; // For anonymous visitors
const PROMO_VIEWED_VISITOR_KEY = 'vowza_promo_viewed_visitor'; // For anonymous one-time tracking

interface UsePromotionVideoAdResult {
  video: PromotionVideoWithViewStatus | null;
  isLoading: boolean;
  hasUserViewed: boolean;
  recordView: () => Promise<boolean>;
  refresh: () => Promise<void>;
  isAnonymous: boolean;
}

/**
 * Hook for managing promotional video ads.
 * 
 * Features:
 * - Supports BOTH authenticated and unauthenticated visitors
 * - For authenticated: Uses user ID + database tracking
 * - For anonymous: Uses random visitor ID + localStorage tracking
 * - Implements ONE-TIME display per user/visitor (persisted via localStorage)
 * - Prevents double-counting via database UNIQUE constraint (authenticated)
 * - Prevents double-counting via localStorage (anonymous)
 */
export function usePromotionVideoAd(): UsePromotionVideoAdResult {
  const { user } = useAuth();
  const [video, setVideo] = useState<PromotionVideoWithViewStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUserViewed, setHasUserViewed] = useState(false);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Anonymous Visitor ID Generation
  // ─────────────────────────────────────────────────────────────────────────
  // For users who are not authenticated:
  // - Generate a random UUID (or fallback to timestamp-based)
  // - Store in localStorage for persistence across page reloads
  // - No personal data: NO email, NO phone, NO IP, NO fingerprinting
  // - Just a random identifier to prevent duplicate ad shows
  // ─────────────────────────────────────────────────────────────────────────

  const getOrCreateVisitorId = useCallback((): string | null => {
    // Only generate for non-authenticated users
    if (user?.id) return null;

    try {
      let stored = localStorage.getItem(PROMO_VISITOR_ID_KEY);
      if (!stored) {
        // Generate random visitor ID
        const randomId = crypto.randomUUID 
          ? crypto.randomUUID() 
          : `vowza_visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(PROMO_VISITOR_ID_KEY, randomId);
        stored = randomId;
        console.log('[usePromotionVideoAd] Generated new visitor ID:', stored);
      }
      return stored;
    } catch (e) {
      console.warn('[usePromotionVideoAd] Failed to get/create visitor ID:', e);
      return null;
    }
  }, [user?.id]);

  // Initialize visitor ID on mount
  useEffect(() => {
    if (!user?.id) {
      const vid = getOrCreateVisitorId();
      setVisitorId(vid);
      setIsAnonymous(!user?.id && !!vid);
    }
  }, [user?.id, getOrCreateVisitorId]);

  // ─────────────────────────────────────────────────────────────────────────
  // One-Time Display Tracking (Authenticated User)
  // ─────────────────────────────────────────────────────────────────────────
  
  const hasAuthenticatedUserSeenPromo = useCallback((): boolean => {
    try {
      const storedUserId = localStorage.getItem(PROMO_VIEWED_STORAGE_KEY);
      const alreadySeen = storedUserId === user?.id;
      if (alreadySeen) {
        console.log('[usePromotionVideoAd] Authenticated user already saw promo');
      }
      return alreadySeen;
    } catch (e) {
      console.warn('[usePromotionVideoAd] localStorage check (auth) failed:', e);
      return false;
    }
  }, [user?.id]);

  const markAuthenticatedPromoAsViewed = useCallback(() => {
    try {
      if (user?.id) {
        localStorage.setItem(PROMO_VIEWED_STORAGE_KEY, user.id);
        console.log('[usePromotionVideoAd] ✅ Marked promo as viewed for authenticated user:', user.id);
      }
    } catch (e) {
      console.warn('[usePromotionVideoAd] localStorage write failed (auth):', e);
    }
  }, [user?.id]);

  // ─────────────────────────────────────────────────────────────────────────
  // One-Time Display Tracking (Anonymous Visitor)
  // ─────────────────────────────────────────────────────────────────────────

  const hasAnonymousVisitorSeenPromo = useCallback((): boolean => {
    try {
      const stored = localStorage.getItem(PROMO_VIEWED_VISITOR_KEY);
      const alreadySeen = stored === 'true';
      if (alreadySeen) {
        console.log('[usePromotionVideoAd] Anonymous visitor already saw promo');
      }
      return alreadySeen;
    } catch (e) {
      console.warn('[usePromotionVideoAd] localStorage check (visitor) failed:', e);
      return false;
    }
  }, []);

  const markAnonymousPromoAsViewed = useCallback(() => {
    try {
      localStorage.setItem(PROMO_VIEWED_VISITOR_KEY, 'true');
      console.log('[usePromotionVideoAd] ✅ Marked promo as viewed for anonymous visitor');
    } catch (e) {
      console.warn('[usePromotionVideoAd] localStorage write failed (visitor):', e);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Main Refresh Logic
  // ─────────────────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    const isAuth = !!user?.id;
    console.log('[usePromotionVideoAd] refresh() called - authenticated:', isAuth, 'visitorId:', visitorId);
    
    // IMPORTANT: Remove one-time display limit (show ad every time)
    // Users should see promotional content multiple times for maximum engagement
    
    // Determine which flow to use
    if (isAuth) {
      // ─── AUTHENTICATED USER FLOW ──────────────────────────────────────────
      console.log('[usePromotionVideoAd] Using authenticated user flow');

      setIsLoading(true);
      try {
        // Get random video from all active videos (no limit on number of times user sees it)
        const randomVideo = await getRandomPromotionVideo();
        if (!randomVideo) {
          console.warn('[usePromotionVideoAd] No available videos for authenticated user');
          setVideo(null);
        } else {
          console.log('[usePromotionVideoAd] ✅ Got random video for authenticated user:', randomVideo.id);
          setVideo(randomVideo);
          setHasUserViewed(false); // Reset — show every time
        }
      } catch (error) {
        console.error('[usePromotionVideoAd] Exception fetching video (auth):', error);
        setVideo(null);
      } finally {
        setIsLoading(false);
      }
    } else if (visitorId) {
      // ─── ANONYMOUS VISITOR FLOW ───────────────────────────────────────────
      console.log('[usePromotionVideoAd] Using anonymous visitor flow');

      setIsLoading(true);
      try {
        // Get random video from all active videos (no limit on number of times visitor sees it)
        const randomVideo = await getRandomPromotionVideoForVisitor();
        if (!randomVideo) {
          console.warn('[usePromotionVideoAd] No available videos for anonymous visitor');
          setVideo(null);
        } else {
          console.log('[usePromotionVideoAd] ✅ Got random video for anonymous visitor:', randomVideo.id);
          setVideo(randomVideo);
          setHasUserViewed(false); // Reset — show every time
        }
      } catch (error) {
        console.error('[usePromotionVideoAd] Exception fetching video (visitor):', error);
        setVideo(null);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Neither authenticated nor has visitor ID
      setVideo(null);
      setIsLoading(false);
    }
  }, [user?.id, visitorId]);

  const recordView = useCallback(async (): Promise<boolean> => {
    if (!video?.id) {
      console.log('[usePromotionVideoAd] recordView() early exit - no video');
      return false;
    }

    // With no-limit strategy, we don't need to track views or prevent repeats
    // Just log that the video was viewed and continue
    console.log('[usePromotionVideoAd] Video viewed:', video.id);
    return true;
  }, [video?.id]);

  // Fetch active video on mount and when auth state changes
  useEffect(() => {
    console.log('[usePromotionVideoAd] useEffect triggered - user:', !!user?.id, 'visitorId:', visitorId);
    void refresh();
  }, [user?.id, visitorId, refresh]);

  // Listen for updates across tabs and from admin changes
  useEffect(() => {
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
  }, [refresh]);

  const returnValue = {
    video,  // Return video for display (if eligible and hasn't seen one-time promo)
    isLoading,
    hasUserViewed,  // Flags whether this user/visitor was counted for THIS VIDEO
    recordView,
    refresh,
    isAnonymous,  // Indicates if this is an anonymous visitor
  };
  
  console.log('[usePromotionVideoAd] Returning:', {
    video: returnValue.video?.id,
    isLoading,
    hasUserViewed,
    shouldDisplay: !!video,
    isAnonymous,
    isAuthenticated: !!user?.id,
  });
  
  return returnValue;
}


