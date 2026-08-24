// WishlistPage — saved artists, real backend data only
import { useMemo } from 'react';
import VowzaIcon from '@/components/VowzaIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useFavorites, useToggleFavorite } from '@/hooks/useArtists';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Heart, MapPin, Star, HeartCrack } from 'lucide-react';

export default function WishlistPage() {
  const { data: favoriteIds = [], isLoading: idsLoading } = useFavorites();
  const toggleFavorite = useToggleFavorite();

  const { data: artists = [], isLoading: artistsLoading } = useQuery({
    queryKey: ['favorite-artists', favoriteIds],
    queryFn: async () => {
      if (favoriteIds.length === 0) return [];
      const { data: providers, error } = await supabase
        .from('provider_profiles')
        .select('*')
        .in('id', favoriteIds);
      if (error) throw error;
      if (!providers || providers.length === 0) return [];

      const userIds = providers.map((p: any) => p.user_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name, avatar_url, city, state').in('id', userIds);
      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

      return providers.map((p: any) => {
        const profile: any = profileMap.get(p.user_id) ?? {};
        return {
          id: p.id,
          name: p.stage_name || profile.full_name || 'Unknown Artist',
          profession: p.profession as string,
          city: (p as any).service_city || profile.city || '',
          state: (p as any).service_state || profile.state || '',
          avatar_url: profile.avatar_url || p.cover_image_url || '',
          average_rating: p.average_rating ?? 0,
          total_reviews: p.total_reviews ?? 0,
        };
      });
    },
    enabled: favoriteIds.length > 0,
  });

  const isLoading = idsLoading || artistsLoading;

  const handleRemove = async (providerId: string) => {
    try {
      await toggleFavorite.mutateAsync({ providerId, isFavorite: true });
      toast.success('Removed from wishlist');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove');
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map(i => <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Wishlist</h1>
        <p className="text-muted-foreground text-sm mt-1">Artists you've saved for later.</p>
      </div>

      {artists.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {artists.map((artist: any, i: number) => (
              <motion.div
                key={artist.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                whileHover={{ y: -4 }}
                className="rounded-2xl bg-white border border-border overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300"
              >
                <div className="h-40 bg-gradient-to-br from-[#8B1538]/10 to-[#D4AF37]/10 relative overflow-hidden">
                  {artist.avatar_url ? (
                    <img src={artist.avatar_url} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <VowzaIcon className="w-10 h-10 text-[#8B1538]/30" />
                    </div>
                  )}
                  <button
                    onClick={() => handleRemove(artist.id)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-red-500 hover:bg-white transition-colors"
                    aria-label="Remove from wishlist"
                  >
                    <Heart className="w-4 h-4 fill-current" />
                  </button>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-foreground truncate">{artist.name}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{artist.profession?.replace(/_/g, ' ')}</p>
                  {artist.city && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {[artist.city, artist.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {artist.total_reviews > 0 && (
                    <p className="text-sm flex items-center gap-1 text-amber-600 font-medium">
                      <Star className="w-3.5 h-3.5 fill-current" /> {artist.average_rating.toFixed(1)}
                      <span className="text-muted-foreground font-normal">({artist.total_reviews})</span>
                    </p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Link to={`/artist/${artist.id}`} className="flex-1">
                      <Button size="sm" className="w-full bg-gradient-to-r from-[#8B1538] to-[#A31E42] hover:opacity-90">
                        View Profile
                      </Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => handleRemove(artist.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl border border-dashed border-border bg-white/60 py-16 flex flex-col items-center text-center px-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B1538]/10 to-[#D4AF37]/10 flex items-center justify-center mb-4">
        <HeartCrack className="w-8 h-8 text-[#8B1538]" />
      </div>
      <h3 className="font-display font-semibold text-lg text-foreground mb-1">No saved artists yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-5">
        Tap the heart icon on any artist's profile to save them here for quick access.
      </p>
      <Link to="/browse">
        <Button className="bg-gradient-to-r from-[#8B1538] to-[#A31E42] hover:opacity-90">
          <VowzaIcon className="w-4 h-4 mr-1.5" /> Discover Artists
        </Button>
      </Link>
    </motion.div>
  );
}
