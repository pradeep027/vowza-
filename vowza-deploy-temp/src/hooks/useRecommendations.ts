import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RecommendationScore {
  providerId: string;
  score: number;
  factors: {
    location: number;
    budget: number;
    availability: number;
    rating: number;
    experience: number;
    verified: number;
    popularity: number;
  };
}

// Smart recommendation engine based on multiple factors
export function useRecommendations(params: {
  category?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  eventDate?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['recommendations', params],
    queryFn: async () => {
      // @ts-ignore - Complex query with joins
      let query = supabase
        .from('provider_profiles')
        .select(`
          id,
          user_id,
          profession,
          experience_years,
          price_min,
          price_max,
          bio,
          is_verified,
          is_available,
          is_featured,
          average_rating,
          total_reviews,
          total_bookings,
          profiles (
            id,
            full_name,
            avatar_url,
            city,
            state,
            area
          )
        `)
        .in('verification_status', ['approved', 'verified'])
        .eq('is_available', true);

      if (params.category) {
        // @ts-ignore
        query = query.eq('profession', params.category as any);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate recommendation scores
      const scored = (data || []).map((provider: any) => {
        let score = 0;
        const factors = {
          location: 0,
          budget: 0,
          availability: 0,
          rating: 0,
          experience: 0,
          verified: 0,
          popularity: 0,
        };

        // Location match (25% weight)
        if (params.location && provider.profiles?.city?.toLowerCase() === params.location.toLowerCase()) {
          factors.location = 25;
        } else if (params.location && provider.profiles?.state?.toLowerCase() === params.location.toLowerCase()) {
          factors.location = 15;
        }

        // Budget match (25% weight)
        if (params.budgetMin && params.budgetMax) {
          const avgPrice = (provider.price_min + provider.price_max) / 2;
          if (avgPrice >= params.budgetMin && avgPrice <= params.budgetMax) {
            factors.budget = 25;
          } else if (avgPrice < params.budgetMin * 1.2) {
            factors.budget = 15;
          }
        }

        // Rating (15% weight)
        factors.rating = Math.min((provider.average_rating / 5) * 15, 15);

        // Experience (10% weight)
        factors.experience = Math.min((provider.experience_years / 10) * 10, 10);

        // Verified status (10% weight)
        factors.verified = provider.is_verified ? 10 : 0;

        // Popularity/Bookings (10% weight)
        factors.popularity = Math.min((provider.total_bookings / 100) * 10, 10);

        // Featured bonus (5% weight)
        if (provider.is_featured) {
          score += 5;
        }

        score = factors.location + factors.budget + factors.availability + factors.rating + 
                factors.experience + factors.verified + factors.popularity;

        return {
          ...provider,
          recommendationScore: score,
          factors,
        };
      });

      // Sort by score and return top results
      return scored
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .slice(0, params.limit || 10);
    },
    enabled: !!params.category,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get similar artists for replacement
export function useSimilarArtists(providerId: string, category?: string) {
  return useQuery({
    queryKey: ['similar-artists', providerId, category],
    queryFn: async () => {
      // First get the original provider's details
      // @ts-ignore
      const { data: original } = await supabase
        .from('provider_profiles')
        .select('*')
        .eq('id', providerId)
        .single();

      if (!original) return [];

      // Find similar providers
      // @ts-ignore
      const { data, error } = await supabase
        .from('provider_profiles')
        .select(`
          id,
          user_id,
          profession,
          experience_years,
          price_min,
          price_max,
          bio,
          is_verified,
          is_available,
          is_featured,
          average_rating,
          total_reviews,
          total_bookings,
          profiles (
            id,
            full_name,
            avatar_url,
            city,
            state,
            area
          )
        `)
        .neq('id', providerId)
        .in('verification_status', ['approved', 'verified'])
        .eq('is_available', true);

      if (error) throw error;

      // Score similarity
      const similar = (data || []).map((provider: any) => {
        let score = 0;

        // Same category (40% weight)
        if (provider.profession === original.profession) {
          score += 40;
        }

        // Similar price range (30% weight)
        const priceDiff = Math.abs(provider.price_min - original.price_min) / original.price_min;
        if (priceDiff < 0.2) score += 30;
        else if (priceDiff < 0.4) score += 20;
        else if (priceDiff < 0.6) score += 10;

        // Similar experience (15% weight)
        const expDiff = Math.abs(provider.experience_years - original.experience_years);
        if (expDiff < 2) score += 15;
        else if (expDiff < 5) score += 10;
        else if (expDiff < 10) score += 5;

        // Similar rating (15% weight)
        const ratingDiff = Math.abs(provider.average_rating - original.average_rating);
        if (ratingDiff < 0.5) score += 15;
        else if (ratingDiff < 1) score += 10;
        else if (ratingDiff < 1.5) score += 5;

        return {
          ...provider,
          similarityScore: score,
        };
      });

      return similar
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, 8);
    },
    enabled: !!providerId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
