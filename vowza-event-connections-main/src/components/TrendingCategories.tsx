// ─── TrendingCategories — Dynamic from Supabase ───────────────────────────────
// Shows real provider counts per category. Falls back gracefully.

import { useNavigate } from "react-router-dom";
import { ArrowRight, Music, Camera, Users, Palette, Mic2, Disc3, Video, Sparkles, Star, Utensils, CalendarDays, Volume2, Lightbulb, Loader2 } from "lucide-react";
import { useCategories } from "@/hooks/useArtists";
import { trendingCategories } from "@/data/services"; // fallback static data

const iconMap: Record<string, React.ReactNode> = {
  Camera:       <Camera className="w-6 h-6" />,
  Palette:      <Palette className="w-6 h-6" />,
  Music:        <Music className="w-6 h-6" />,
  Disc3:        <Disc3 className="w-6 h-6" />,
  Sparkles:     <Sparkles className="w-6 h-6" />,
  Mic2:         <Mic2 className="w-6 h-6" />,
  Users:        <Users className="w-6 h-6" />,
  Utensils:     <Utensils className="w-6 h-6" />,
  CalendarDays: <CalendarDays className="w-6 h-6" />,
  Lightbulb:    <Lightbulb className="w-6 h-6" />,
  Volume2:      <Volume2 className="w-6 h-6" />,
  Video:        <Video className="w-6 h-6" />,
  Star:         <Star className="w-6 h-6" />,
  camera:       <Camera className="w-6 h-6" />,
  palette:      <Palette className="w-6 h-6" />,
  music:        <Music className="w-6 h-6" />,
  disc3:        <Disc3 className="w-6 h-6" />,
  sparkles:     <Sparkles className="w-6 h-6" />,
  mic2:         <Mic2 className="w-6 h-6" />,
  users:        <Users className="w-6 h-6" />,
  utensils:     <Utensils className="w-6 h-6" />,
  lightbulb:    <Lightbulb className="w-6 h-6" />,
  volume2:      <Volume2 className="w-6 h-6" />,
  video:        <Video className="w-6 h-6" />,
};

// Colour pairs for each category slot
const colourPairs = [
  { color: "text-gold",   bgColor: "bg-gold/10"   },
  { color: "text-maroon", bgColor: "bg-maroon/10" },
  { color: "text-royal",  bgColor: "bg-royal/10"  },
  { color: "text-gold",   bgColor: "bg-gold/10"   },
  { color: "text-maroon", bgColor: "bg-blush"      },
  { color: "text-royal",  bgColor: "bg-royal/10"  },
  { color: "text-gold",   bgColor: "bg-gold/10"   },
  { color: "text-maroon", bgColor: "bg-maroon/10" },
  { color: "text-royal",  bgColor: "bg-royal/10"  },
  { color: "text-gold",   bgColor: "bg-gold/10"   },
];

const TrendingCategories = () => {
  const navigate = useNavigate();
  const { data: dbCategories, isLoading } = useCategories();

  // Use DB categories when available; fallback to static data
  const categories = dbCategories && dbCategories.length > 0
    ? dbCategories.map((cat: any, i: number) => ({
        id:      cat.profession_type || cat.id,
        name:    cat.name,
        icon:    cat.icon || 'Sparkles',
        count:   cat.provider_count ?? 0,
        slug:    cat.profession_type || cat.id,
        ...colourPairs[i % colourPairs.length],
      }))
    : trendingCategories;

  return (
    <section className="py-14 md:py-20 bg-background">
      <div className="container px-4">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-gold/10 text-gold-dark text-sm font-medium mb-3">
              Browse by Category
            </span>
            <h2 className="text-2xl md:text-4xl font-display font-bold text-foreground">
              Trending Categories
            </h2>
          </div>
          <button
            onClick={() => navigate("/artists")}
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-maroon hover:gap-2.5 transition-all"
          >
            View all <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-muted animate-pulse" style={{ height: 110 }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-3 md:gap-4">
            {categories.map((cat: any, index: number) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/artists?category=${cat.slug || cat.id}`)}
                className="group flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-card border border-border/60
                           hover:border-gold/40 hover:shadow-gold transition-all duration-300 hover:-translate-y-1
                           animate-fade-in"
                style={{ animationDelay: `${index * 0.04}s` }}
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${cat.bgColor} flex items-center justify-center
                                 group-hover:scale-110 transition-transform duration-300`}>
                  <span className={cat.color}>
                    {iconMap[cat.icon] ?? iconMap[cat.icon?.toLowerCase?.()] ?? <Sparkles className="w-6 h-6" />}
                  </span>
                </div>

                {/* Label */}
                <span className="text-xs font-semibold text-foreground text-center leading-tight group-hover:text-maroon transition-colors">
                  {cat.name}
                </span>

                {/* Count — real from DB or static */}
                <span className="text-[10px] text-muted-foreground">
                  {cat.count > 0 ? `${cat.count}+` : '—'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Mobile "View all" */}
        <div className="mt-6 text-center md:hidden">
          <button
            onClick={() => navigate("/artists")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-maroon"
          >
            View all categories <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default TrendingCategories;
