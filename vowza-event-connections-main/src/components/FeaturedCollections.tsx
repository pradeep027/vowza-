// ─── FeaturedCollections — Dynamic from Supabase ─────────────────────────────
// Shows real featured + top-rated artists. Falls back to curated collections.

import { useNavigate } from "react-router-dom";
import { ArrowRight, Users, Star, MapPin, Zap, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFeaturedArtists } from "@/hooks/useArtists";
import type { Artist } from "@/hooks/useArtists";

const FeaturedCollections = () => {
  const navigate  = useNavigate();
  const { data: artists = [], isLoading } = useFeaturedArtists(6);

  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`;

  if (isLoading) {
    return (
      <section className="py-14 md:py-20 bg-secondary">
        <div className="container px-4">
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 rounded-full bg-gold/10 text-gold-dark text-sm font-medium mb-4">
              Curated For You
            </span>
            <h2 className="text-2xl md:text-4xl font-display font-bold text-foreground mb-3">
              Featured Artists
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (artists.length === 0) return null;

  return (
    <section className="py-14 md:py-20 bg-secondary">
      <div className="container px-4">
        {/* Header */}
        <div className="flex items-end justify-between mb-10 md:mb-14">
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-gold/10 text-gold-dark text-sm font-medium mb-4">
              Top Professionals
            </span>
            <h2 className="text-2xl md:text-4xl font-display font-bold text-foreground mb-3">
              Featured Artists
            </h2>
            <p className="text-muted-foreground max-w-xl text-sm md:text-base">
              Verified professionals with outstanding reviews, ready for your next event.
            </p>
          </div>
          <button
            onClick={() => navigate("/artists")}
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-maroon hover:gap-2.5 transition-all"
          >
            View all <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Artist Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {artists.map((artist: Artist, index: number) => (
            <button
              key={artist.id}
              onClick={() => navigate(`/artist/${artist.id}`)}
              className="group relative rounded-2xl overflow-hidden text-left transition-all duration-300
                         hover:-translate-y-1.5 hover:shadow-elevated bg-card border border-border/60
                         hover:border-gold/30 animate-fade-in"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              {/* Cover image */}
              <div className="relative h-44 bg-muted overflow-hidden">
                <img
                  src={artist.cover_image_url || artist.avatar_url || '/placeholder.svg'}
                  alt={artist.full_name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex gap-1.5">
                  {artist.is_verified && (
                    <Badge className="bg-gold text-foreground border-0 text-[10px] px-2 py-0.5">
                      <BadgeCheck className="w-3 h-3 mr-0.5" />Verified
                    </Badge>
                  )}
                  {artist.is_featured && (
                    <Badge className="bg-violet-500 text-white border-0 text-[10px] px-2 py-0.5">
                      ⭐ Featured
                    </Badge>
                  )}
                  {artist.instant_booking && (
                    <Badge className="bg-emerald-500 text-white border-0 text-[10px] px-2 py-0.5">
                      <Zap className="w-3 h-3 mr-0.5" />Instant Book
                    </Badge>
                  )}
                </div>

                {/* Rating */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-card/90 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <Star className="w-3.5 h-3.5 text-gold fill-gold" />
                  <span className="text-xs font-semibold text-foreground">{artist.average_rating.toFixed(1)}</span>
                  <span className="text-[10px] text-muted-foreground">({artist.total_reviews})</span>
                </div>

                {/* Avatar */}
                <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full border-2 border-card overflow-hidden bg-muted">
                  <img
                    src={artist.avatar_url || '/placeholder.svg'}
                    alt={artist.full_name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-display font-semibold text-sm text-foreground group-hover:text-maroon transition-colors truncate">
                  {artist.stage_name || artist.full_name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{artist.category_name}</p>

                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{artist.city || 'India'}
                  </span>
                  {artist.experience_years > 0 && (
                    <span>{artist.experience_years} yrs exp</span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Starting from</p>
                    <p className="text-sm font-bold text-foreground">
                      {artist.price_min > 0 ? fmt(artist.price_min) : 'On Request'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {artist.is_available ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        Available
                      </span>
                    ) : (
                      <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        Busy
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users className="w-3 h-3" />
                      {artist.total_bookings}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-8 text-center md:hidden">
          <button
            onClick={() => navigate("/artists")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-maroon"
          >
            View all artists <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedCollections;
