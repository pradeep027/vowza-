// ─── Wishlist/Favorites feature API ──────────────────────────────────────────
// Single Supabase boundary for the favorites (saved artists) feature.
//
// Behavior is preserved VERBATIM from the pre-migration implementations in
// src/hooks/useArtists.ts (useToggleFavorite / useFavorites) and
// src/pages/ProviderProfile.tsx (checkFav / toggleFav):
// - mutations deliberately do NOT check the Supabase error object, so a DB
//   error (e.g. RLS denial) resolves silently while a network error throws —
//   exactly as before. Do NOT "fix" this here; it is an intentional
//   behavior-preservation decision from Phase 2D-A.

import { supabase } from '@/integrations/supabase/client';

/** All provider_ids saved as favorites by the given user. Throws on error. */
export async function getFavoriteProviderIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('provider_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((f: any) => f.provider_id as string);
}

/** Insert a favorite row. Silent on DB errors (network errors throw) — as before. */
export async function addFavorite(userId: string, providerId: string): Promise<void> {
  await supabase.from('favorites').insert({ user_id: userId, provider_id: providerId });
}

/** Delete a favorite row. Silent on DB errors (network errors throw) — as before. */
export async function removeFavorite(userId: string, providerId: string): Promise<void> {
  await supabase.from('favorites').delete().eq('user_id', userId).eq('provider_id', providerId);
}

/** Whether the given favorite row exists for this user+provider. */
export async function isFavorite(userId: string, providerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .maybeSingle();
  return !!data;
}
