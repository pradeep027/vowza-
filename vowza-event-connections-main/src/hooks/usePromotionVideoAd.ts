import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getActivePromotionVideo,
  getActivePromotionVideoForVisitor,
  recordPromotionView,
  recordPromotionViewForVisitor,
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
    
    // Determine which flow to use
    if (isAuth) {
      // ─── AUTHENTICATED USER FLOW ──────────────────────────────────────────
      console.log('[usePromotionVideoAd] Using authenticated user flow');

      if (hasAuthenticatedUserSeenPromo()) {
        console.log('[usePromotionVideoAd] ⏸️ Authenticated user already received ad');
        setVideo(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const activeVideo = await getActivePromotionVideo(user.id);
        if (!activeVideo) {
          console.warn('[usePromotionVideoAd] No eligible video for authenticated user');
          setVideo(null);
        } else {
          console.log('[usePromotionVideoAd] ✅ Got video for authenticated user:', activeVideo.id);
          setVideo(activeVideo);
          setHasUserViewed(activeVideo.has_user_viewed ?? false);
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

      if (hasAnonymousVisitorSeenPromo()) {
        console.log('[usePromotionVideoAd] ⏸️ Anonymous visitor already received ad');
        setVideo(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const activeVideo = await getActivePromotionVideoForVisitor(visitorId);
        if (!activeVideo) {
          console.warn('[usePromotionVideoAd] No eligible video for anonymous visitor');
          setVideo(null);
        } else {
          console.log('[usePromotionVideoAd] ✅ Got video for anonymous visitor:', activeVideo.id);
          setVideo(activeVideo);
          setHasUserViewed(false); // Anonymous visitors don't have view history in DB
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
  }, [user?.id, visitorId, hasAuthenticatedUserSeenPromo, hasAnonymousVisitorSeenPromo]);

  const recordView = useCallback(async (): Promise<boolean> => {
    if (!video?.id) {
      console.log('[usePromotionVideoAd] recordView() early exit - no video');
      return false;
    }

    const isAuth = !!user?.id;
    
    if (isAuth) {
      // ─── AUTHENTICATED USER: Record in database ──────────────────────────
      if (!user?.id) return false;

      if (hasUserViewed) {
        console.log('[usePromotionVideoAd] recordView() skipped - authenticated user already counted');
        return false;
      }

      try {
        console.log('[usePromotionVideoAd] Recording view for authenticated user:', user.id, 'video:', video.id);
        const recorded = await recordPromotionView(video.id, user.id);
        
        if (recorded) {
          console.log('[usePromotionVideoAd] ✅ View recorded (auth) - marking promo as viewed');
          setHasUserViewed(true);
          markAuthenticatedPromoAsViewed();
          await refresh();
        } else {
          console.warn('[usePromotionVideoAd] recordPromotionView (auth) returned FALSE');
        }
        return recorded;
      } catch (error) {
        console.error('[usePromotionVideoAd] Failed to record view (auth):', error);
        return false;
      }
    } else if (visitorId) {
      // ─── ANONYMOUS VISITOR: Record with visitor ID ────────────────────────
      if (hasUserViewed) {
        console.log('[usePromotionVideoAd] recordView() skipped - anonymous visitor already counted');
        return false;
      }

      try {
        console.log('[usePromotionVideoAd] Recording view for anonymous visitor:', visitorId, 'video:', video.id);
        const recorded = await recordPromotionViewForVisitor(video.id, visitorId);
        
        if (recorded) {
          console.log('[usePromotionVideoAd] ✅ View recorded (visitor) - marking promo as viewed');
          setHasUserViewed(true);
          markAnonymousPromoAsViewed();
          await refresh();
        } else {
          console.warn('[usePromotionVideoAd] recordPromotionViewForVisitor returned FALSE');
        }
        return recorded;
      } catch (error) {
        console.error('[usePromotionVideoAd] Failed to record view (visitor):', error);
        return false;
      }
    } else {
      console.log('[usePromotionVideoAd] recordView() - no user or visitor ID');
      return false;
    }
  }, [video?.id, user?.id, visitorId, hasUserViewed, refresh, markAuthenticatedPromoAsViewed, markAnonymousPromoAsViewed]);

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


