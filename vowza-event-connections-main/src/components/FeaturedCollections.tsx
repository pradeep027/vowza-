// ─── FeaturedCollections — Corporate Premium Edition ─────────────────────────
import { useNavigate } from "react-router-dom";
import { ArrowRight, Star, MapPin, Zap, BadgeCheck, Users, Heart } from "lucide-react";
import { useFeaturedArtists } from "@/hooks/useArtists";
import type { Artist } from "@/hooks/useArtists";

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
  n >= 1000   ? `₹${(n / 1000).toFixed(0)}K` : `₹${n}`;

const SkeletonCard = () => (
  <div className="rounded-3xl overflow-hidden bg-surface-1 border border-border/60">
    <div className="skeleton h-52 w-full" />
    <div className="p-5 space-y-3">
      <div className="skeleton h-4 w-3/4 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="skeleton h-3 w-1/3 rounded" />
    </div>
  </div>
);

const ArtistCard = ({ artist, index }: { artist: Artist; index: number }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/artist/${artist.id}`)}
      className="group text-left rounded-3xl overflow-hidden bg-surface-1 border border-border/60
                 hover:border-gold/25 transition-all duration-400 hover:-translate-y-2 hover:shadow-xl
                 animate-fade-up"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Image area */}
      <div className="relative h-52 bg-muted overflow-hidden">
        <img
          src={artist.cover_image_url || artist.avatar_url || "/placeholder.svg"}
          alt={artist.full_name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {artist.is_verified && (
            <span className="badge-verified text-[10px]">
              <BadgeCheck className="w-3 h-3" /> Verified
            </span>
          )}
          {artist.is_featured && (
            <span className="badge-featured text-[10px]">
              ⭐ Featured
            </span>
          )}
          {artist.instant_booking && (
            <span className="badge-instant text-[10px]">
              <Zap className="w-3 h-3" /> Instant
            </span>
          )}
        </div>

        {/* Bottom: rating + avatar */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 flex items-end justify-between">
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-lg">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-bold text-white">{artist.average_rating.toFixed(1)}</span>
            <span className="text-[10px] text-white/70">({artist.total_reviews})</span>
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-white/80 overflow-hidden bg-muted shadow-lg flex-shrink-0">
            <img
              src={artist.avatar_url || "/placeholder.svg"}
              alt={artist.full_name}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-foreground group-hover:text-maroon transition-colors truncate">
              {artist.stage_name || artist.full_name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{artist.category_name}</p>
          </div>
          <button
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
            aria-label="Save"
          >
            <Heart className="w-4 h-4 text-muted-foreground hover:text-rose-500 transition-colors" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {artist.city || "India"}
          </span>
          {artist.experience_years > 0 && (
            <span>{artist.experience_years} yrs exp</span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {artist.total_bookings} events
          </span>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Starting from</p>
            <p className="text-sm font-bold text-foreground">
              {artist.price_min > 0 ? fmt(artist.price_min) : "On Request"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {artist.is_available ? (
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                Available
              </span>
            ) : (
              <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                Busy
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

const FeaturedCollections = () => {
  const navigate = useNavigate();
  const { data: artists = [], isLoading } = useFeaturedArtists(6);

  if (!isLoading && artists.length === 0) return null;

  return (
    <section className="py-20 md:py-28 bg-surface-2">
      <div className="container px-4">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <div className="section-label bg-gold/10 text-gold-dark mb-4">Top Professionals</div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
              Featured Artists
            </h2>
            <p className="text-muted-foreground mt-2 max-w-lg">
              Handpicked professionals with exceptional ratings and repeat bookings.
            </p>
          </div>
          <button
            onClick={() => navigate("/artists?featured=true")}
            className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-maroon hover:gap-2.5 transition-all group flex-shrink-0"
          >
            View all
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : artists.map((a: Artist, i: number) => <ArtistCard key={a.id} artist={a} index={i} />)
          }
        </div>

        {/* Mobile CTA */}
        <div className="mt-10 text-center md:hidden">
          <button
            onClick={() => navigate("/artists")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-maroon"
          >
            View all artists <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedCollections;
