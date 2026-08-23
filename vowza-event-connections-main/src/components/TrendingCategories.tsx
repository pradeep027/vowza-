// ─── TrendingCategories — Premium Categories ─────────────────────────────────
// 15 main marketplace categories with unique icons, brand colours, hover animations.
// Fully responsive: 3 cols mobile → 4 tablet → 5 desktop → 7 wide.
// Uses live DB counts when available; gracefully shows static list as fallback.
// USES AUTHORITATIVE SOURCE: src/config/mainCategoryMapping.ts

import { memo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  Guitar,
  Disc3,
  Mic,
  PersonStanding,
  Flower2,
  Palette,
  Fingerprint,
  MicVocal,
  MonitorPlay,
  Utensils,
  Building2,
  Package,
  Landmark,
  Droplets,
} from "lucide-react";
import { useCategories } from "@/hooks/useArtists";
import { MAIN_CATEGORIES } from "@/config/mainCategoryMapping";

// ── Map icon names to Lucide components ──
const ICON_MAP: Record<string, React.ElementType> = {
  Camera,
  Guitar,
  Disc3,
  Mic,
  PersonStanding,
  Flower2,
  Palette,
  Fingerprint,
  MicVocal,
  MonitorPlay,
  Utensils,
  Building2,
  Package,
  Landmark,
  Droplets,
};

// ── Define display-specific properties not in mainCategoryMapping ──
interface CategoryDisplayDef {
  id:    string;
  name:  string;
  icon:  React.ElementType;
  color: string;
  text:  string;
  ring:  string;
  types: string[];
}

// ── Transform mainCategoryMapping into display format ──
// This is the ONLY source of category data - everything comes from MAIN_CATEGORIES
const CATEGORIES: CategoryDisplayDef[] = MAIN_CATEGORIES.map(cat => ({
  id:    cat.id,
  name:  cat.name,
  icon:  ICON_MAP[cat.icon] || Camera,  // Fallback to Camera if icon name not found
  color: cat.color,
  text:  cat.text,
  ring:  cat.ring,
  types: cat.professionTypes,
}));

// ── Category Card — module scope to avoid focus/remount bugs ─────────────────
interface CardProps { cat: CategoryDisplayDef; count: number; onClick: () => void; idx: number; }

const CategoryCard = memo(({ cat, count, onClick, idx }: CardProps) => {
  const hasImage = ['photography-videography', 'catering_services', 'drone_operator', 'music_band', 'dj', 'makeup_artist', 'anchor', 'mehendi_artist', 'singer', 'wedding_decorator', 'dancer', 'banquet_hall', 'rentals', 'pandit', 'water_supplier'].includes(cat.id);

  return (
  <motion.button
    onClick={onClick}
    aria-label={`Browse ${cat.name}`}
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay: Math.min(idx, 15) * 0.035, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -6, scale: 1.035 }}
    whileTap={{ scale: 0.97 }}
    className={`
      group relative flex flex-col items-center gap-3
      p-4 md:p-5 rounded-2xl overflow-hidden
      bg-surface-1/70 backdrop-blur-sm border border-border/60
      ring-2 ring-transparent hover:${cat.ring}
      hover:border-transparent hover:shadow-xl
      transition-[border-color,box-shadow] duration-300
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
    `}
  >
    {/* Soft radial glow on hover, tinted per-category */}
    <span className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 ${cat.color} blur-2xl scale-150 pointer-events-none`} />

    {/* Icon / Image */}
    {cat.id === 'photography-videography' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/PHOTOGRAPHER86.jpeg.jpg" alt="Photography & Videography" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'catering_services' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/CATERING.jpeg" alt="Catering" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'drone_operator' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/drone main.png" alt="Drone Photography" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'music_band' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/band main.png" alt="Bands" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'dj' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/dj main.png" alt="DJs" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'makeup_artist' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/makeup main.png" alt="Makeup Artists" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'anchor' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/anchors and hosts main.png" alt="Anchors & Hosts" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'mehendi_artist' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/mehindi main.png" alt="Mehendi Artists" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'singer' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/singers main.png" alt="Singers" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'wedding_decorator' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/decorator.png" alt="Decorators" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'dancer' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/dancers main.png" alt="Dancers" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'banquet_hall' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/banquet halls.png" alt="Banquet Halls" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'rentals' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/rentals main.png" alt="Rentals" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'pandit' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/pandit main.png" alt="Pandits / Priests" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'water_supplier' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/water main.png" alt="Drinking Water" className="w-full h-full object-cover" />
      </div>
    ) : (
      <div
        className={`
          relative z-10 w-12 h-12 md:w-14 md:h-14 rounded-2xl
          ${cat.color}
          flex items-center justify-center flex-shrink-0
          group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300
        `}
      >
        <cat.icon className={`w-5 h-5 md:w-6 md:h-6 ${cat.text}`} aria-hidden />
      </div>
    )}

    {/* Label */}
    <span className="relative z-10 text-[11px] md:text-xs font-bold text-foreground text-center leading-snug group-hover:text-maroon transition-colors">
      {cat.name}
    </span>
  </motion.button>
  );
});
CategoryCard.displayName = "CategoryCard";

// ── Skeleton card ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="rounded-2xl skeleton h-[108px] md:h-[120px]" />
);

// ── Main Section ──────────────────────────────────────────────────────────────
const TrendingCategories = () => {
  const navigate = useNavigate();
  const { data: dbCats, isLoading } = useCategories();

  // Build a count-map keyed by profession_type from the DB
  const countMap = new Map<string, number>();
  if (dbCats && dbCats.length > 0) {
    (dbCats as any[]).forEach((c: any) => {
      const type = c.profession_type || c.id;
      if (type) countMap.set(type, c.provider_count ?? 0);
    });
  }

  // For each canonical category, sum counts across all merged types
  const getCategoryCount = (cat: CategoryDisplayDef): number =>
    cat.types.reduce((sum, t) => sum + (countMap.get(t) ?? 0), 0);

  return (
    <section className="py-14 md:py-24 bg-background">
      <div className="container px-4">

        {/* ── Section header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-12"
        >
          <div>
            <div className="section-label bg-maroon/8 text-maroon mb-4 inline-flex">
              Browse Categories
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
              What are you looking for?
            </h2>
            <p className="text-muted-foreground mt-2 max-w-lg text-sm">
              From photographers to caterers — every service you need for a perfect event.
            </p>
          </div>
          <button
            onClick={() => navigate("/artists")}
            className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-maroon hover:gap-2.5 transition-all group flex-shrink-0"
            aria-label="View all categories"
          >
            All categories
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>

        {/* ── Grid ── */}
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
            {Array.from({ length: 15 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
            {CATEGORIES.map((cat, i) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                count={getCategoryCount(cat)}
                idx={i}
                onClick={() => navigate(`/category/${cat.id}`)}
              />
            ))}
          </div>
        )}

        {/* ── Mobile CTA ── */}
        <div className="mt-8 text-center md:hidden">
          <button
            onClick={() => navigate("/artists")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-maroon"
          >
            View all categories <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
};

export default TrendingCategories;
