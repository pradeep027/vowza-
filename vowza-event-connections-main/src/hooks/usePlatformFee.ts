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
      // Phase 0b Stage 1: read via the key-fixed SECURITY DEFINER RPC instead
      // of the platform_settings table (table reads are locked down for anon in
      // Stage 2 — 20261201000011/20261201000012).
      const { data, error } = await supabase
        .rpc('get_public_platform_fee' as any);
      if (error || !data) return DEFAULT_FEE;
      // supabase-js parses jsonb responses; accept a raw string defensively.
      const val = typeof data === 'string' ? JSON.parse(data) : (data as any);
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
