import { useCallback, useEffect, useState } from 'react';
import { AUTH_PROMO_UPDATED_EVENT, fetchActiveAuthPromotionMedia, type AuthPromotionMedia } from '@/integrations/supabase/auth-promo';

const CHANNEL_NAME = 'vowza-auth-promotion-media';
export function useAuthPromotionMedia(): { media: AuthPromotionMedia[]; isLoading: boolean; refresh: () => Promise<void> } {
  const [media, setMedia] = useState<AuthPromotionMedia[]>([]); const [isLoading, setIsLoading] = useState(true);
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try { setMedia(await fetchActiveAuthPromotionMedia()); }
    catch (error) { console.error('[useAuthPromotionMedia] homepage promotion refresh failed', error); setMedia([]); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
    const onMessage = () => void refresh();
    window.addEventListener(AUTH_PROMO_UPDATED_EVENT, onMessage); channel?.addEventListener('message', onMessage);
    return () => { window.removeEventListener(AUTH_PROMO_UPDATED_EVENT, onMessage); channel?.removeEventListener('message', onMessage); channel?.close(); };
  }, [refresh]);
  return { media, isLoading, refresh };
}
