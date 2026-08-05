// ─── TrendingCategories — Premium Categories ─────────────────────────────────
// 20 categories with unique icons, brand colours, hover animations.
// Fully responsive: 3 cols mobile → 4 tablet → 5 desktop → 7 wide.
// Uses live DB counts when available; gracefully shows static list as fallback.

import { memo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Camera,          // Photographers
  Video,           // Videographers
  Music2,          // Bands
  Disc3,           // DJs
  Mic,             // Singers
  PersonStanding,  // Dancers
  Users,           // Choreographers
  Paintbrush,      // Decorators
  Sparkles,        // Makeup Artists
  Hand,            // Mehendi Artists
  Wand2,           // Magicians
  MonitorPlay,     // Anchors & Hosts + Drone
  Utensils,        // Catering Services
  Lightbulb,       // Lighting Services
  Volume2,         // Sound Services
  Building2,       // Banquet Halls
  Package,         // Rentals
  Landmark,        // Pandits / Priests
  Droplets,        // Drinking Water
} from "lucide-react";
import { useCategories } from "@/hooks/useArtists";

// ── 19 canonical categories — module scope, never re-created ─────────────────
interface CategoryDef {
  id:    string;                        // slug used for DB query
  name:  string;                        // display label
  icon:  React.ElementType;             // Lucide icon component
  color: string;                        // Tailwind bg on icon wrapper
  text:  string;                        // Tailwind text colour for icon
  ring:  string;                        // Tailwind ring colour on hover
  // Merged DB profession_types — any of these in the DB map to this card
  types: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id:    "photographer",
    name:  "Photographers",
    icon:  Camera,
    color: "bg-rose-50 dark:bg-rose-950/40",
    text:  "text-rose-600 dark:text-rose-400",
    ring:  "ring-rose-200 dark:ring-rose-800",
    types: ["photographer"],
  },
  {
    id:    "videographer",
    name:  "Videographers",
    icon:  Video,
    color: "bg-pink-50 dark:bg-pink-950/40",
    text:  "text-pink-600 dark:text-pink-400",
    ring:  "ring-pink-200 dark:ring-pink-800",
    types: ["videographer","cinematographer"],
  },
  {
    id:    "drone_operator",
    name:  "Drone Photography",
    icon:  MonitorPlay,
    color: "bg-slate-50 dark:bg-slate-950/40",
    text:  "text-slate-600 dark:text-slate-400",
    ring:  "ring-slate-200 dark:ring-slate-800",
    types: ["drone_operator"],
  },
  {
    id:    "music_band",
    name:  "Bands",
    icon:  Music2,
    color: "bg-amber-50 dark:bg-amber-950/40",
    text:  "text-amber-600 dark:text-amber-400",
    ring:  "ring-amber-200 dark:ring-amber-800",
    types: ["music_band","normal_band","maharashtra_band","traditional_band","musician","instrumental_artist","classical_musician"],
  },
  {
    id:    "dj",
    name:  "DJs",
    icon:  Disc3,
    color: "bg-violet-50 dark:bg-violet-950/40",
    text:  "text-violet-600 dark:text-violet-400",
    ring:  "ring-violet-200 dark:ring-violet-800",
    types: ["dj"],
  },
  {
    id:    "singer",
    name:  "Singers",
    icon:  Mic,
    color: "bg-sky-50 dark:bg-sky-950/40",
    text:  "text-sky-600 dark:text-sky-400",
    ring:  "ring-sky-200 dark:ring-sky-800",
    types: ["singer"],
  },
  {
    id:    "dancer",
    name:  "Dancers",
    icon:  PersonStanding,
    color: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
    text:  "text-fuchsia-600 dark:text-fuchsia-400",
    ring:  "ring-fuchsia-200 dark:ring-fuchsia-800",
    types: ["dancer","kuchipudi_dancer","classical_dancer","western_dancer"],
  },
  {
    id:    "choreographer",
    name:  "Choreographers",
    icon:  Users,
    color: "bg-purple-50 dark:bg-purple-950/40",
    text:  "text-purple-600 dark:text-purple-400",
    ring:  "ring-purple-200 dark:ring-purple-800",
    types: ["choreographer"],
  },
  {
    id:    "wedding_decorator",
    name:  "Decorators",
    icon:  Paintbrush,
    color: "bg-lime-50 dark:bg-lime-950/40",
    text:  "text-lime-700 dark:text-lime-400",
    ring:  "ring-lime-200 dark:ring-lime-800",
    types: ["wedding_decorator","stage_decorator","event_decorator"],
  },
  {
    id:    "makeup_artist",
    name:  "Makeup Artists",
    icon:  Sparkles,
    color: "bg-orange-50 dark:bg-orange-950/40",
    text:  "text-orange-600 dark:text-orange-400",
    ring:  "ring-orange-200 dark:ring-orange-800",
    types: ["makeup_artist"],
  },
  {
    id:    "mehendi_artist",
    name:  "Mehendi Artists",
    icon:  Hand,
    color: "bg-green-50 dark:bg-green-950/40",
    text:  "text-green-600 dark:text-green-400",
    ring:  "ring-green-200 dark:ring-green-800",
    types: ["mehendi_artist"],
  },
  {
    id:    "magician",
    name:  "Magicians",
    icon:  Wand2,
    color: "bg-indigo-50 dark:bg-indigo-950/40",
    text:  "text-indigo-600 dark:text-indigo-400",
    ring:  "ring-indigo-200 dark:ring-indigo-800",
    types: ["magician"],
  },
  {
    id:    "anchor",
    name:  "Anchors & Hosts",
    icon:  MonitorPlay,
    color: "bg-cyan-50 dark:bg-cyan-950/40",
    text:  "text-cyan-600 dark:text-cyan-400",
    ring:  "ring-cyan-200 dark:ring-cyan-800",
    types: ["anchor","host"],
  },
  {
    id:    "catering_services",
    name:  "Catering Services",
    icon:  Utensils,
    color: "bg-yellow-50 dark:bg-yellow-950/40",
    text:  "text-yellow-700 dark:text-yellow-400",
    ring:  "ring-yellow-200 dark:ring-yellow-800",
    types: ["catering_services"],
  },
  {
    id:    "lighting_services",
    name:  "Lighting Services",
    icon:  Lightbulb,
    color: "bg-amber-50 dark:bg-amber-950/40",
    text:  "text-amber-700 dark:text-amber-500",
    ring:  "ring-amber-300 dark:ring-amber-800",
    types: ["lighting_services"],
  },
  {
    id:    "sound_services",
    name:  "Sound Services",
    icon:  Volume2,
    color: "bg-blue-50 dark:bg-blue-950/40",
    text:  "text-blue-600 dark:text-blue-400",
    ring:  "ring-blue-200 dark:ring-blue-800",
    types: ["sound_services"],
  },
  // ── NEW CATEGORIES ─────────────────────────────────────────────────────────
  {
    id:    "banquet_hall",
    name:  "Banquet Halls",
    icon:  Building2,
    color: "bg-emerald-50 dark:bg-emerald-950/40",
    text:  "text-emerald-600 dark:text-emerald-400",
    ring:  "ring-emerald-200 dark:ring-emerald-800",
    types: ["banquet_hall","wedding_venue","event_venue"],
  },
  {
    id:    "rentals",
    name:  "Rentals",
    icon:  Package,
    color: "bg-orange-50 dark:bg-orange-950/40",
    text:  "text-orange-600 dark:text-orange-400",
    ring:  "ring-orange-200 dark:ring-orange-800",
    types: ["rentals","tent_shamiana","stage_rental","furniture_rental","generator_rental","ac_cooler","led_wall"],
  },
  {
    id:    "pandit",
    name:  "Pandits / Priests",
    icon:  Landmark,
    color: "bg-yellow-50 dark:bg-yellow-950/40",
    text:  "text-yellow-700 dark:text-yellow-400",
    ring:  "ring-yellow-200 dark:ring-yellow-800",
    types: ["pandit","priest","religious_services"],
  },
  {
    id:    "water_supplier",
    name:  "Drinking Water",
    icon:  Droplets,
    color: "bg-sky-50 dark:bg-sky-950/40",
    text:  "text-sky-600 dark:text-sky-400",
    ring:  "ring-sky-200 dark:ring-sky-800",
    types: ["water_supplier","drinking_water","water_tanker"],
  },
];

// ── Category Card — module scope to avoid focus/remount bugs ─────────────────
interface CardProps { cat: CategoryDef; count: number; onClick: () => void; idx: number; }

const CategoryCard = memo(({ cat, count, onClick, idx }: CardProps) => (
  <motion.button
    onClick={onClick}
    aria-label={`Browse ${cat.name}`}
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-40px" }}
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

    {/* Icon bubble */}
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

    {/* Label */}
    <span className="relative z-10 text-[11px] md:text-xs font-semibold text-foreground text-center leading-snug group-hover:text-maroon transition-colors">
      {cat.name}
    </span>

    {/* Live count — only shown when real data exists */}
    {count > 0 && (
      <span className="relative z-10 text-[9px] md:text-[10px] font-medium text-muted-foreground -mt-1">
        {count}+ artists
      </span>
    )}
  </motion.button>
));
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
  const getCategoryCount = (cat: CategoryDef): number =>
    cat.types.reduce((sum, t) => sum + (countMap.get(t) ?? 0), 0);

  return (
    <section className="py-14 md:py-24 bg-background">
      <div className="container px-4">

        {/* ── Section header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
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
            {Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)}
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
