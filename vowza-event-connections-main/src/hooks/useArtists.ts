import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ArtistFilters {
  category?: string;
  search?: string;
  city?: string;
  budgetMin?: number;
  budgetMax?: number;
  rating?: number;
  experience?: number;
  verified?: boolean;
  featured?: boolean;
  available?: boolean;
  language?: string;
  sortBy?: 'rating' | 'price-low' | 'price-high' | 'newest' | 'experience';
}

export interface Artist {
  id: string;
  user_id: string;
  full_name: string;
  profession: string;
  category_name?: string;
  category_icon?: string;
  city: string;
  state: string;
  area: string;
  experience_years: number;
  price_min: number;
  price_max: number;
  bio: string;
  specialties: string[];
  languages: string[];
  avatar_url: string;
  cover_image_url: string;
  average_rating: number;
  total_reviews: number;
  total_bookings: number;
  is_verified: boolean;
  is_available: boolean;
  is_featured: boolean;
  verification_status: string;
}

// Fetch approved artists with filters
export function useArtists(filters: ArtistFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ['artists', filters],
    queryFn: async () => {
      // @ts-ignore - Supabase types don't include artist_categories yet
      let query = (supabase as any)
        .from('provider_profiles')
        .select(`
          id,
          user_id,
          profession,
          experience_years,
          price_min,
          price_max,
          bio,
          specialties,
          languages,
          cover_image_url,
          is_verified,
          is_available,
          is_featured,
          average_rating,
          total_reviews,
          total_bookings,
          verification_status,
          profiles (
            id,
            full_name,
            avatar_url,
            city,
            state,
            area
          ),
          artist_categories (
            name,
            icon
          )
        `)
        .in('verification_status', ['approved', 'verified']);

      // Apply filters
      if (filters.category) {
        // @ts-ignore
        query = query.eq('profession', filters.category);
      }

      if (filters.budgetMin !== undefined) {
        query = query.gte('price_min', filters.budgetMin);
      }

      if (filters.budgetMax !== undefined) {
        query = query.lte('price_max', filters.budgetMax);
      }

      if (filters.verified !== undefined) {
        query = query.eq('is_verified', filters.verified);
      }

      if (filters.featured !== undefined) {
        // @ts-ignore
        query = query.eq('is_featured', filters.featured);
      }

      if (filters.available !== undefined) {
        query = query.eq('is_available', filters.available);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data
      const artists: Artist[] = (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        full_name: item.profiles?.full_name || 'Unknown Artist',
        profession: item.profession,
        category_name: item.artist_categories?.name,
        category_icon: item.artist_categories?.icon,
        city: item.profiles?.city || '',
        state: item.profiles?.state || '',
        area: item.profiles?.area || '',
        experience_years: item.experience_years || 0,
        price_min: item.price_min || 0,
        price_max: item.price_max || 0,
        bio: item.bio || '',
        specialties: Array.isArray(item.specialties) ? item.specialties : [],
        languages: Array.isArray(item.languages) ? item.languages : [],
        avatar_url: item.profiles?.avatar_url || '',
        cover_image_url: item.cover_image_url || '',
        average_rating: item.average_rating || 0,
        total_reviews: item.total_reviews || 0,
        total_bookings: item.total_bookings || 0,
        is_verified: item.is_verified || false,
        is_available: item.is_available !== false,
        is_featured: item.is_featured || false,
        verification_status: item.verification_status || 'pending',
      }));

      // Client-side filters
      let filtered = artists;

      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(
          (artist) =>
            artist.full_name.toLowerCase().includes(search) ||
            artist.profession.toLowerCase().includes(search) ||
            artist.city.toLowerCase().includes(search) ||
            artist.bio.toLowerCase().includes(search)
        );
      }

      if (filters.city) {
        filtered = filtered.filter(
          (artist) => artist.city.toLowerCase() === filters.city!.toLowerCase()
        );
      }

      if (filters.rating) {
        filtered = filtered.filter((artist) => artist.average_rating >= filters.rating!);
      }

      if (filters.experience) {
        filtered = filtered.filter((artist) => artist.experience_years >= filters.experience!);
      }

      if (filters.language) {
        filtered = filtered.filter((artist) =>
          artist.languages.some((lang) => lang.toLowerCase().includes(filters.language!.toLowerCase()))
        );
      }

      // Sort
      switch (filters.sortBy) {
        case 'price-low':
          filtered.sort((a, b) => a.price_min - b.price_min);
          break;
        case 'price-high':
          filtered.sort((a, b) => b.price_max - a.price_max);
          break;
        case 'rating':
          filtered.sort((a, b) => b.average_rating - a.average_rating);
          break;
        case 'experience':
          filtered.sort((a, b) => b.experience_years - a.experience_years);
          break;
        case 'newest':
          // Assuming created_at exists, otherwise reverse
          filtered.reverse();
          break;
        default:
          filtered.sort((a, b) => b.average_rating - a.average_rating);
      }

      return filtered;
    },
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Fetch single artist by ID
export function useArtist(id: string) {
  return useQuery({
    queryKey: ['artist', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provider_profiles')
        .select(`
          *,
          profiles (
            id,
            full_name,
            avatar_url,
            city,
            state,
            area,
            phone,
            address
          ),
          artist_categories (
            name,
            icon,
            description
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch artist categories
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      // @ts-ignore - artist_categories table exists but not in types yet
      const { data, error } = await supabase
        .from('artist_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

// Check availability for a provider on a specific date
export function useAvailability(providerId: string, date: Date) {
  return useQuery({
    queryKey: ['availability', providerId, date.toISOString().split('T')[0]],
    queryFn: async () => {
      // @ts-ignore - RPC function exists but not in types yet
      const { data, error } = await supabase
        .rpc('check_provider_availability', {
          p_provider_id: providerId,
          p_event_date: date.toISOString().split('T')[0],
        });

      if (error) throw error;
      return data;
    },
    enabled: !!providerId && !!date,
    staleTime: 1000 * 60, // 1 minute
  });
}

// Toggle favorite
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ providerId, isFavorite }: { providerId: string; isFavorite: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (isFavorite) {
        // @ts-ignore - favorites table exists but not in types yet
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('provider_id', providerId);
      } else {
        // @ts-ignore - favorites table exists but not in types yet
        await supabase.from('favorites').insert({
          user_id: user.id,
          provider_id: providerId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}

// Fetch user's favorites
export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // @ts-ignore - favorites table exists but not in types yet
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          provider_id,
          provider_profiles (
            *,
            profiles (
              full_name,
              avatar_url,
              city
            )
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return data;
    },
    enabled: true,
    staleTime: 1000 * 60 * 5,
  });
}
