import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ProfessionType = Database['public']['Enums']['profession_type'];

export interface Provider {
  id: string;
  user_id: string;
  profession: ProfessionType;
  experience_years: number | null;
  price_min: number | null;
  price_max: number | null;
  bio: string | null;
  is_verified: boolean | null;
  is_available: boolean | null;
  average_rating: number | null;
  total_reviews: number | null;
  specialties: string[] | null;
  profile: {
    full_name: string;
    avatar_url: string | null;
    city: string | null;
    area: string | null;
  } | null;
}

interface UseProvidersOptions {
  profession?: ProfessionType;
  city?: string;
  minRating?: number;
  isAvailable?: boolean;
}

export const useProviders = (options: UseProvidersOptions = {}) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch provider profiles
        let query = supabase
          .from('provider_profiles')
          .select('*')
          .eq('is_available', options.isAvailable ?? true);

        if (options.profession) {
          query = query.eq('profession', options.profession);
        }

        if (options.minRating) {
          query = query.gte('average_rating', options.minRating);
        }

        const { data: providerData, error: fetchError } = await query.order('average_rating', { ascending: false });

        if (fetchError) throw fetchError;

        if (!providerData || providerData.length === 0) {
          setProviders([]);
          return;
        }

        // Fetch profiles for each provider
        const userIds = providerData.map(p => p.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, city, area')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        // Map profiles to providers
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        let mappedProviders: Provider[] = providerData.map(provider => ({
          ...provider,
          profile: profilesMap.get(provider.user_id) || null
        }));

        // Filter by city if provided
        if (options.city) {
          mappedProviders = mappedProviders.filter(
            (p) => p.profile?.city?.toLowerCase().includes(options.city!.toLowerCase())
          );
        }

        setProviders(mappedProviders);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProviders();
  }, [options.profession, options.city, options.minRating, options.isAvailable]);

  return { providers, isLoading, error };
};
