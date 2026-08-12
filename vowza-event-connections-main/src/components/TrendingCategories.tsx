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
  Guitar,          // Bands
  Disc3,           // DJs
  Mic,             // Singers
  PersonStanding,  // Dancers
  Flower2,         // Decorators
  Palette,         // Makeup Artists
  Fingerprint,     // Mehendi Artists
  MicVocal,        // Anchors & Hosts
  MonitorPlay,     // Drone
  Utensils,        // Catering Services
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

// Custom photographer icon component using the provided PNG
const PhotographerIcon = ({ className }: { className?: string }) => (
  <img src="/images/wedding-photography.jpg" alt="" className={`${className} object-cover rounded-lg`} />
);

const CATEGORIES: CategoryDef[] = [
  {
    id:    "photographer",
    name:  "Photographers",
    icon:  PhotographerIcon as any,
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
    icon:  Guitar,
    color: "bg-amber-50 dark:bg-amber-950/40",
    text:  "text-amber-600 dark:text-amber-400",
    ring:  "ring-amber-200 dark:ring-amber-800",
    types: ["music_band","maharashtra_band","traditional_band","instrumental_artist","classical_musician","wedding_band","dhol_band","brass_band"],
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
    id:    "wedding_decorator",
    name:  "Decorators",
    icon:  Flower2,
    color: "bg-lime-50 dark:bg-lime-950/40",
    text:  "text-lime-700 dark:text-lime-400",
    ring:  "ring-lime-200 dark:ring-lime-800",
    types: ["wedding_decorator","stage_decorator","event_decorator"],
  },
  {
    id:    "makeup_artist",
    name:  "Makeup Artists",
    icon:  Palette,
    color: "bg-orange-50 dark:bg-orange-950/40",
    text:  "text-orange-600 dark:text-orange-400",
    ring:  "ring-orange-200 dark:ring-orange-800",
    types: ["makeup_artist"],
  },
  {
    id:    "mehendi_artist",
    name:  "Mehendi Artists",
    icon:  Fingerprint,
    color: "bg-green-50 dark:bg-green-950/40",
    text:  "text-green-600 dark:text-green-400",
    ring:  "ring-green-200 dark:ring-green-800",
    types: ["mehendi_artist"],
  },
  {
    id:    "anchor",
    name:  "Anchors & Hosts",
    icon:  MicVocal,
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

const CategoryCard = memo(({ cat, count, onClick, idx }: CardProps) => {
  const isPhotographer = cat.id === 'photographer';

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
    {isPhotographer ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/PHOTOGRAPHER86.jpeg.jpg" alt="Photographers" className="w-full h-full object-cover" />
      </div>
    ) : cat.id === 'videographer' ? (
      <div className="relative z-10 w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <img src="/images/VIDEOGRAPHY MAIN.jpg" alt="Videographers" className="w-full h-full object-cover" />
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
  const getCategoryCount = (cat: CategoryDef): number =>
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
