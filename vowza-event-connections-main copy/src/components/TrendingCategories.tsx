import { useNavigate } from "react-router-dom";
import { ArrowRight, Music, Camera, Users, Palette, Mic2, Disc3, Video, Sparkles, Star, Utensils, CalendarDays, Volume2, Lightbulb } from "lucide-react";
import { trendingCategories } from "@/data/services";

const iconMap: Record<string, React.ReactNode> = {
  Camera:      <Camera className="w-6 h-6" />,
  Palette:     <Palette className="w-6 h-6" />,
  Music:       <Music className="w-6 h-6" />,
  Disc3:       <Disc3 className="w-6 h-6" />,
  Sparkles:    <Sparkles className="w-6 h-6" />,
  Mic2:        <Mic2 className="w-6 h-6" />,
  Users:       <Users className="w-6 h-6" />,
  Utensils:    <Utensils className="w-6 h-6" />,
  CalendarDays:<CalendarDays className="w-6 h-6" />,
  Lightbulb:   <Lightbulb className="w-6 h-6" />,
  Volume2:     <Volume2 className="w-6 h-6" />,
  Video:       <Video className="w-6 h-6" />,
  Star:        <Star className="w-6 h-6" />,
};

const TrendingCategories = () => {
  const navigate = useNavigate();

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

        {/* Scrollable grid — 5 per row on desktop, 3 on tablet, 2 on mobile */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-3 md:gap-4">
          {trendingCategories.map((cat, index) => (
            <button
              key={cat.id}
              onClick={() => navigate(`/artists?category=${cat.slug}`)}
              className="group flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-card border border-border/60
                         hover:border-gold/40 hover:shadow-gold transition-all duration-300 hover:-translate-y-1
                         animate-fade-in"
              style={{ animationDelay: `${index * 0.04}s` }}
            >
              {/* Icon circle */}
              <div
                className={`w-12 h-12 rounded-xl ${cat.bgColor} flex items-center justify-center
                             group-hover:scale-110 transition-transform duration-300`}
              >
                <span className={cat.color}>
                  {iconMap[cat.icon] ?? <Star className="w-6 h-6" />}
                </span>
              </div>

              {/* Label */}
              <span className="text-xs font-semibold text-foreground text-center leading-tight group-hover:text-maroon transition-colors">
                {cat.name}
              </span>

              {/* Count */}
              <span className="text-[10px] text-muted-foreground">{cat.count}+</span>
            </button>
          ))}
        </div>

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
