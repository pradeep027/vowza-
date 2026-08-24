import { useCallback, useEffect, useState } from 'react';
import {
  AUTH_PROMO_UPDATED_EVENT,
  fetchAuthPromoConfig,
  type AuthPromoDisplayConfig,
} from '@/integrations/supabase/auth-promo';

interface UseAuthPromotionResult {
  promotion: AuthPromoDisplayConfig | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Provides the one public active-promotion source for both /auth and AuthModal.
 * A refresh always clears the previous result first, preventing a stale image
 * from surviving a deleted/hidden promotion or a failed image replacement.
 */
export function useAuthPromotion(enabled = true): UseAuthPromotionResult {
  const [promotion, setPromotion] = useState<AuthPromoDisplayConfig | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setPromotion(null);

    try {
      setPromotion(await fetchAuthPromoConfig());
    } catch (error) {
      console.error('[useAuthPromotion] Unable to load active promotion:', error);
      setPromotion(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPromotion(null);
      setIsLoading(false);
      return;
    }

    void refresh();
    window.addEventListener(AUTH_PROMO_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(AUTH_PROMO_UPDATED_EVENT, refresh);
  }, [enabled, refresh]);

  return { promotion, isLoading, refresh };
}
