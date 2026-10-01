// ─── useArtists — Dynamic Marketplace Hook ────────────────────────────────────
// Uses two-query pattern (no PGRST200 join errors).
// provider_profiles → profiles via user_id (separate fetch).
// artist_categories → profession_type string match (separate fetch).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { artistCategories } from '@/data/artistCategories';
import { PUBLIC_PROVIDER_SELECT } from '@/lib/publicColumns';
import { addFavorite, removeFavorite, getFavoriteProviderIds } from '@/features/wishlist/api/favoriteData';
import type { Tables } from '@/integrations/supabase/types';

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

// Runtime row shapes for the two marketplace queries. provider_profiles is
// fetched through a widened builder (see the TS2589 note inside useArtists), so
// its result is cast to this row type for typed field access. The three
// service_* columns exist at runtime but are absent from the generated types.
type ProviderRow = Tables<'provider_profiles'> & {
  service_city?:  string | null;
  service_state?: string | null;
  service_area?:  string | null;
};
type ProfileRow = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'avatar_url' | 'city' | 'state' | 'area'>;

// ─── Category label/icon from local definition (no extra DB call) ──────────────
function getCategoryMeta(professionType: string): { name: string; icon: string } {
  const cat = artistCategories.find(c => c.value === professionType);
  return {
    name: cat?.label ?? professionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    // Lucide icons expose a display name via the function's name; fall back
    // to a generic Sparkles label when unknown.
    icon: (cat?.icon as { displayName?: string } | undefined)?.displayName ?? 'Sparkles',
  };
}

// ─── Normalize category URL param → database profession enum ──────────────────
// The URL might use plural or common terms (e.g. "photographers") but the
// database enum stores singular profession_type values (e.g. "photographer").
// Supports compound searches like "wedding photography" by extracting profession keywords.
const CATEGORY_NORMALIZATION: Record<string, string | string[]> = {
  'photography-videography': ['photographer', 'videographer', 'cinematographer', 'drone_operator', 'photography_videography'],
  'photography_videography': ['photographer', 'videographer', 'cinematographer', 'drone_operator'],
  'photo and video': ['photographer', 'videographer', 'cinematographer', 'drone_operator', 'photography_videography'],
  'photography and videography': ['photographer', 'videographer', 'cinematographer', 'drone_operator', 'photography_videography'],
  'wedding photo video': ['photographer', 'videographer', 'cinematographer', 'drone_operator', 'photography_videography'],
  'wedding photography': 'photographer',
  'wedding videography': 'videographer',
  'wedding photographer': 'photographer',
  'wedding videographer': 'videographer',
  photographers:     'photographer',
  photographer:      'photographer',
  photography:       'photographer',
  videographers:     'videographer',
  videographer:      'videographer',
  videography:       'videographer',
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
        // Explicit column list, not '*': anon holds SELECT on only 46 of the 69
        // columns. See src/lib/publicColumns.ts.
        .select(PUBLIC_PROVIDER_SELECT)
        .in('verification_status', ['approved', 'verified']);

      // Only add is_published filter if not filtering by categories (event mode fetches all then filters)
      // Cast through `any`: the generated column-union overloads exceed the
      // TS instantiation-depth limit (TS2589) for chained builders here.
      if (!filters.categories || filters.categories.length === 0) {
        (query as any) = query.eq('is_published', true);
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
      // Remaining filters applied through a widened alias: the generated
      // column-union overloads exceed TS instantiation depth when chained.
      const q = query as any;
      if (filters.budgetMin !== undefined) q.gte('price_min', filters.budgetMin);
      if (filters.budgetMax !== undefined) q.lte('price_max', filters.budgetMax);
      if (filters.verified  !== undefined) q.eq('is_verified', filters.verified);
      if (filters.available !== undefined) q.eq('is_available', filters.available);
      if (filters.featured  !== undefined) q.eq('is_featured', filters.featured);

      const { data: providers, error: pErr } = await q;
      if (pErr) {
        console.error('[useArtists] Query error:', pErr.message);
        // Surface the failure so React Query sets its error state — a backend
        // error must be distinguishable from a genuine empty result. Every caller
        // defaults `data` to [] (or guards with `|| []`), so none crash on throw.
        throw pErr;
      }
      if (!providers || providers.length === 0) return [];

      // Step 2 — Fetch matching profiles
      // provider rows are untyped at runtime; user_id is guaranteed by schema.
      const userIds = (providers as Array<{ user_id?: string }>).map(p => p.user_id).filter(Boolean);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city, state, area')
        .in('id', userIds);

      const profileMap = new Map((profilesData ?? []).map(p => [p.id, p]));

      // Step 3 — Map to Artist interface
      let artists: Artist[] = (providers as ProviderRow[]).map((p) => {
        const profile  = (profileMap.get(p.user_id) ?? {}) as Partial<ProfileRow>;
        const catMeta  = getCategoryMeta(p.profession);
        return {
          id:                 p.id,
          user_id:            p.user_id,
          full_name:          profile.full_name ?? 'Unknown Artist',
          stage_name:         p.stage_name ?? '',
          profession:         p.profession,
          category_name:      catMeta.name,
          category_icon:      catMeta.icon,
          city:               p.service_city  || profile.city  || '',
          state:              p.service_state || profile.state || '',
          area:               p.service_area  || profile.area  || '',
          experience_years:   p.experience_years ?? 0,
          price_min:          p.price_min  ?? 0,
          price_max:          p.price_max  ?? 0,
          bio:                p.bio        ?? '',
          specialties:        Array.isArray(p.specialties) ? p.specialties : [],
          languages:          Array.isArray(p.languages)   ? p.languages   : [],
          avatar_url:         profile.avatar_url  ?? '',
          cover_image_url:    p.cover_image_url            ?? '',
          gallery_urls:       Array.isArray(p.gallery_urls) ? p.gallery_urls : [],
          average_rating:     p.average_rating  ?? 0,
          total_reviews:      p.total_reviews   ?? 0,
          total_bookings:     p.total_bookings  ?? 0,
          is_verified:        p.is_verified     ?? false,
          is_available:       p.is_available    !== false,
          is_featured:        p.is_featured    ?? false,
          instant_booking:    p.instant_booking ?? false,
          verification_status: p.verification_status ?? 'pending',
          whatsapp:           p.whatsapp ?? '',
          service_radius:     p.service_radius ?? 50,
          subcategory:        p.subcategory ?? '',
          vendor_details:     (p.vendor_details ?? p.category_details ?? {}) as Record<string, any>,
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
        // Explicit column list, not '*'. NOTE: this query applies no approval
        // filter, so it can address any provider row by uuid. It is currently
        // unreachable (nothing imports useArtist); if it is ever wired up, add
        // .in('verification_status', ['approved','verified']) first.
        .select(PUBLIC_PROVIDER_SELECT)
        .eq('id', id)
        .limit(1);

      if (error) throw error;
      if (!rows || rows.length === 0) throw new Error(`Artist not found: ${id}`);
      const p = rows[0] as any;

      const { data: profileRows } = await supabase
        .from('profiles')
        // 'phone' removed: anon no longer holds SELECT on it, and nothing here
        // rendered it.
        .select('id, full_name, avatar_url, city, state, area')
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
        .from('category_provider_counts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        // Fallback: plain table without counts
        const { data: fallback, error: err2 } = await supabase
          .from('artist_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');
        if (err2) throw err2;
        return (fallback ?? []).map((c: any) => ({ ...c, provider_count: 0 }));
      }

      return ((data ?? []) as unknown[]) as CategoryWithCount[];
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
// Data access delegated to the wishlist feature API (Phase 2D-A).
// TanStack mutation shape and invalidation behavior preserved exactly.
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId, isFavorite }: { providerId: string; isFavorite: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (isFavorite) {
        await removeFavorite(user.id, providerId);
      } else {
        await addFavorite(user.id, providerId);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
}

// ─── Fetch favorites ───────────────────────────────────────────────────────────
// Data access delegated to the wishlist feature API (Phase 2D-A).
// Hook signature, query key, and staleTime preserved exactly.
export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn:  async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      return getFavoriteProviderIds(user.id);
    },
    staleTime: 1000 * 60 * 5,
  });
}
