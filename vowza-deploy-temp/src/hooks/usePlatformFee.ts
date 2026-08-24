import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformFeeConfig {
  type: 'percentage' | 'fixed';
  rate: number; // percentage value OR fixed amount in INR
  enabled: boolean;
}

const DEFAULT_FEE: PlatformFeeConfig = { type: 'percentage', rate: 5, enabled: true };

export function usePlatformFee() {
  return useQuery({
    queryKey: ['platform-fee'],
    queryFn: async (): Promise<PlatformFeeConfig> => {
      const { data, error } = await supabase
        .from('platform_settings' as any)
        .select('value')
        .eq('key', 'platform_fee')
        .maybeSingle();
      if (error || !data) return DEFAULT_FEE;
      const val = (data as any).value;
      return {
        type: val?.type || 'percentage',
        rate: Number(val?.rate ?? 5),
        enabled: val?.enabled !== false,
      };
    },
    staleTime: 1000 * 60 * 5, // cache 5 min
  });
}

/** Calculate platform fee for a given subtotal */
export function calculatePlatformFee(subtotal: number, config: PlatformFeeConfig): number {
  if (!config.enabled) return 0;
  if (config.type === 'percentage') return Math.round(subtotal * config.rate / 100);
  return Math.round(config.rate); // fixed amount
}
