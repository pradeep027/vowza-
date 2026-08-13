// ─── useArtists — Dynamic Marketplace Hook ────────────────────────────────────
// Uses two-query pattern (no PGRST200 join errors).
// provider_profiles → profiles via user_id (separate fetch).
// artist_categories → profession_type string match (separate fetch).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { artistCategories } from '@/data/artistCategories';

export interface ArtistFilters {
  category?:   string;
  categories?: string[]; // multiple allowed professions (for event filtering)
  search?:     string;
  city?:       string;
  state?:      string;
  budgetMin?:  number;
  budgetMax?:  number;
  rating?:     number;
  experience?: number;
  verified?:   boolean;
  featured?:   boolean;
  available?:  boolean;
  language?:   string;
  sortBy?:     'rating' | 'price-low' | 'price-high' | 'newest' | 'experience';
}

export interface Artist {
  id:                 string;
  user_id:            string;
  full_name:          string;
  stage_name:         string;
  profession:         string;
  category_name:      string;
  category_icon:      string;
  city:               string;
  state:              string;
  area:               string;
  experience_years:   number;
  price_min:          number;
  price_max:          number;
  bio:                string;
  specialties:        string[];
  languages:          string[];
  avatar_url:         string;
  cover_image_url:    string;
  gallery_urls:       string[];
  average_rating:     number;
  total_reviews:      number;
  total_bookings:     number;
  is_verified:        boolean;
  is_available:       boolean;
  is_featured:        boolean;
  instant_booking:    boolean;
  verification_status: string;
  whatsapp:           string;
  service_radius:     number;
  subcategory:        string;
  vendor_details:     Record<string, any>;
}

// ─── Category label/icon from local definition (no extra DB call) ──────────────
function getCategoryMeta(professionType: string): { name: string; icon: string } {
  const cat = artistCategories.find(c => c.value === professionType);
  return {
    name: cat?.label ?? professionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    icon: cat?.icon?.displayName ?? 'Sparkles',
  };
}

// ─── Normalize category URL param → database profession enum ──────────────────
// The URL might use plural or common terms (e.g. "photographers") but the
// database enum stores singular profession_type values (e.g. "photographer").
const CATEGORY_NORMALIZATION: Record<string, string | string[]> = {
  photographers:     'photographer',
  photographer:      'photographer',
  videographers:     'videographer',
  videographer:      'videographer',
  decorators:        ['wedding_decorator', 'event_decorator', 'stage_decorator'],
  decorator:         ['wedding_decorator', 'event_decorator', 'stage_decorator'],
  wedding_decorator: 'wedding_decorator',
  event_decorator:   'event_decorator',
  stage_decorator:   'stage_decorator',
  'makeup_artists':  'makeup_artist',
  'makeup_artist':   'makeup_artist',
  makeup:            'makeup_artist',
  djs:              'dj',
  dj:               'dj',
  bands:            'music_band',
  'music_bands':    'music_band',
  'music_band':     'music_band',
  singers:          'singer',
  singer:           'singer',
  dancers:          'dancer',
  dancer:           'dancer',
  caterers:         'catering_services',
  catering:         'catering_services',
  'catering_services': 'catering_services',
  anchors:          'anchor',
  anchor:           'anchor',
  'mehendi_artists': 'mehendi_artist',
  'mehendi_artist':  'mehendi_artist',
  mehendi:           'mehendi_artist',
  magicians:         'magician',
  magician:          'magician',
  'drone_operators': 'drone_operator',
  'drone_operator':  'drone_operator',
  drone:             'drone_operator',
  choreographers:    'choreographer',
  choreographer:     'choreographer',
  pandits:           'pandit',
  pandit:            'pandit',
  'banquet_halls':   'banquet_hall',
  'banquet_hall':    'banquet_hall',
  rentals:           'rentals',
};

function normalizeCategoryFilter(category: string): { single?: string; multiple?: string[] } {
  const normalized = CATEGORY_NORMALIZATION[category.toLowerCase()];
  if (!normalized) {
    // If not in map, pass through as-is (might be a valid enum value already)
    return { single: category };
  }
  if (Array.isArray(normalized)) {
    return { multiple: normalized };
  }
  return { single: normalized };
}

// ─── Main hook: fetch approved artists with filters ────────────────────────────
export function useArtists(filters: ArtistFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ['artists', filters],
    queryFn:  async () => {
      // Step 1 — Fetch provider_profiles (no nested join)
      let query = supabase
        .from('provider_profiles')
        .select('*')
        .in('verification_status', ['approved', 'verified']);

      // Only add is_published filter if not filtering by categories (event mode fetches all then filters)
      if (!filters.categories || filters.categories.length === 0) {
        query = query.eq('is_published' as any, true);
      }

      // Normalize category filter to match actual database enum values
      if (filters.category) {
        const { single, multiple } = normalizeCategoryFilter(filters.category);
        if (multiple) {
          query = query.in('profession', multiple as any);
        } else if (single) {
          query = query.eq('profession', single as any);
        }
      }
      if (filters.categories && filters.categories.length > 0) {
        // Normalize each category in the array
        const normalizedCategories = filters.categories.flatMap(cat => {
          const { single, multiple } = normalizeCategoryFilter(cat);
          if (multiple) return multiple;
          if (single) return [single];
          return [cat];
        });
        query = query.in('profession', [...new Set(normalizedCategories)] as any);
      }
      if (filters.budgetMin !== undefined) query = query.gte('price_min', filters.budgetMin);
      if (filters.budgetMax !== undefined) query = query.lte('price_max', filters.budgetMax);
      if (filters.verified  !== undefined) query = query.eq('is_verified', filters.verified);
      if (filters.available !== undefined) query = query.eq('is_available', filters.available);
      if (filters.featured  !== undefined) query = query.eq('is_featured' as any, filters.featured);

      const { data: providers, error: pErr } = await query;
      if (pErr) {
        console.error('[useArtists] Query error:', pErr.message);
        return [];
      }
      if (!providers || providers.length === 0) return [];

      // Step 2 — Fetch matching profiles
      const userIds = providers.map(p => p.user_id).filter(Boolean);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city, state, area')
        .in('id', userIds);

      const profileMap = new Map((profilesData ?? []).map(p => [p.id, p]));

      // Step 3 — Map to Artist interface
      let artists: Artist[] = providers.map((p: any) => {
        const profile  = profileMap.get(p.user_id) ?? {};
        const catMeta  = getCategoryMeta(p.profession);
        return {
          id:                 p.id,
          user_id:            p.user_id,
          full_name:          (profile as any).full_name ?? 'Unknown Artist',
          stage_name:         p.stage_name ?? '',
          profession:         p.profession,
          category_name:      catMeta.name,
          category_icon:      catMeta.icon,
          city:               (p as any).service_city || (profile as any).city  || '',
          state:              (p as any).service_state || (profile as any).state || '',
          area:               (p as any).service_area  || (profile as any).area  || '',
          experience_years:   p.experience_years ?? 0,
          price_min:          p.price_min  ?? 0,
          price_max:          p.price_max  ?? 0,
          bio:                p.bio        ?? '',
          specialties:        Array.isArray(p.specialties) ? p.specialties : [],
          languages:          Array.isArray(p.languages)   ? p.languages   : [],
          avatar_url:         (profile as any).avatar_url  ?? '',
          cover_image_url:    p.cover_image_url            ?? '',
          gallery_urls:       Array.isArray((p as any).gallery_urls) ? (p as any).gallery_urls : [],
          average_rating:     p.average_rating  ?? 0,
          total_reviews:      p.total_reviews   ?? 0,
          total_bookings:     p.total_bookings  ?? 0,
          is_verified:        p.is_verified     ?? false,
          is_available:       p.is_available    !== false,
          is_featured:        (p as any).is_featured    ?? false,
          instant_booking:    (p as any).instant_booking ?? false,
          verification_status: p.verification_status ?? 'pending',
          whatsapp:           (p as any).whatsapp ?? '',
          service_radius:     (p as any).service_radius ?? 50,
          subcategory:        (p as any).subcategory ?? '',
          vendor_details:     (p as any).vendor_details ?? (p as any).category_details ?? {},
        };
      });

      // Step 4 — Client-side filters
      if (filters.search) {
        const q = filters.search.toLowerCase();
        artists = artists.filter(a =>
          a.full_name.toLowerCase().includes(q)  ||
          a.stage_name.toLowerCase().includes(q) ||
          a.profession.toLowerCase().includes(q) ||
          a.category_name.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q)       ||
          a.bio.toLowerCase().includes(q)
        );
      }

      if (filters.city)     artists = artists.filter(a => a.city.toLowerCase().includes(filters.city!.toLowerCase()));
      if (filters.state)    artists = artists.filter(a => a.state.toLowerCase().includes(filters.state!.toLowerCase()));
      if (filters.rating)   artists = artists.filter(a => a.average_rating   >= filters.rating!);
      if (filters.experience) artists = artists.filter(a => a.experience_years >= filters.experience!);
      if (filters.language)   artists = artists.filter(a =>
        a.languages.some(l => l.toLowerCase().includes(filters.language!.toLowerCase()))
      );

      // Step 5 — Sort
      switch (filters.sortBy) {
        case 'price-low':   artists.sort((a, b) => a.price_min - b.price_min);         break;
        case 'price-high':  artists.sort((a, b) => b.price_max - a.price_max);         break;
        case 'experience':  artists.sort((a, b) => b.experience_years - a.experience_years); break;
        case 'newest':      artists.reverse();                                         break;
        default:            artists.sort((a, b) => b.average_rating - a.average_rating); break;
      }

      return artists;
    },
    enabled,
    staleTime: 0,  // Always fresh — approved artists must appear immediately
    refetchOnWindowFocus: true,
  });
}

// ─── Single artist by ID ───────────────────────────────────────────────────────
export function useArtist(id: string) {
  return useQuery({
    queryKey: ['artist', id],
    queryFn:  async () => {
      // Use array query + [0] — never .single() which throws on 0 rows
      const { data: rows, error } = await supabase
        .from('provider_profiles')
        .select('*')
        .eq('id', id)
        .limit(1);

      if (error) throw error;
      if (!rows || rows.length === 0) throw new Error(`Artist not found: ${id}`);
      const p = rows[0] as any;

      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city, state, area, phone')
        .eq('id', p.user_id)
        .limit(1);

      const profile = profileRows && profileRows.length > 0 ? profileRows[0] : null;
      const catMeta = getCategoryMeta(p.profession);

      return { ...p, profile: profile ?? null, category_name: catMeta.name, category_icon: catMeta.icon };
    },
    enabled:   !!id,
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Categories with live provider counts ─────────────────────────────────────
export interface CategoryWithCount {
  id:             string;
  name:           string;
  profession_type: string;
  description:    string;
  icon:           string;
  is_active:      boolean;
  sort_order:     number;
  provider_count: number;
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn:  async () => {
      // Try the view with counts first; fall back to table if view doesn't exist yet
      const { data, error } = await supabase
        .from('category_provider_counts' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        // Fallback: plain table without counts
        const { data: fallback, error: err2 } = await supabase
          .from('artist_categories' as any)
          .select('*')
          .eq('is_active', true)
          .order('sort_order');
        if (err2) throw err2;
        return (fallback ?? []).map((c: any) => ({ ...c, provider_count: 0 }));
      }

      return (data ?? []) as CategoryWithCount[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ─── Availability check ────────────────────────────────────────────────────────
export function useAvailability(providerId: string, date: Date) {
  return useQuery({
    queryKey: ['availability', providerId, date.toISOString().split('T')[0]],
    queryFn:  async () => {
      // Use array + [0] — maybeSingle() throws when multiple rows exist
      const { data, error } = await supabase
        .from('provider_availability')
        .select('*')
        .eq('provider_id', providerId)
        .eq('unavailable_date', date.toISOString().split('T')[0])
        .limit(1);
      if (error) throw error;
      return { available: !data || data.length === 0 }; // no row = available
    },
    enabled:   !!providerId && !!date,
    staleTime: 1000 * 60,
  });
}

// ─── Toggle favorite ───────────────────────────────────────────────────────────
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId, isFavorite }: { providerId: string; isFavorite: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (isFavorite) {
        await supabase.from('favorites' as any).delete().eq('user_id', user.id).eq('provider_id', providerId);
      } else {
        await supabase.from('favorites' as any).insert({ user_id: user.id, provider_id: providerId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
}

// ─── Fetch favorites ───────────────────────────────────────────────────────────
export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn:  async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('favorites' as any)
        .select('provider_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data ?? []).map((f: any) => f.provider_id as string);
    },
    staleTime: 1000 * 60 * 5,
  });
}
