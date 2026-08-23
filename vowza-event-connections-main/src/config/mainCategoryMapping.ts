/**
 * Main Marketplace Category Mapping
 * 
 * This is the AUTHORITATIVE mapping between:
 * - Main marketplace categories (what customers see)
 * - Profession types (database enum values)
 * 
 * Used by:
 * - TrendingCategories.tsx (homepage category cards)
 * - Auth Promotion category selector
 * - CategoryPage.tsx
 * 
 * DO NOT HARDCODE CATEGORIES IN MULTIPLE PLACES.
 * This file is the single source of truth.
 */

export interface MainCategory {
  id: string;                    // Unique slug for URL/routing
  name: string;                  // Display name (what customers see)
  icon: string;                  // Lucide icon name
  color: string;                 // Tailwind bg color
  text: string;                  // Tailwind text color
  ring: string;                  // Tailwind ring color on hover
  professionTypes: string[];    // Array of profession_type enum values that belong to this category
  description?: string;          // Optional description
}

/**
 * 15 Main marketplace categories
 * Each groups one or more profession types from the database
 */
export const MAIN_CATEGORIES: MainCategory[] = [
  {
    id: "photography-videography",
    name: "Photography & Videography",
    icon: "Camera",
    color: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-200 dark:ring-rose-800",
    professionTypes: ["photographer", "videographer", "cinematographer", "photography_videography"],
    description: "Professional photography and videography services for your events"
  },
  {
    id: "drone_operator",
    name: "Drone Photography",
    icon: "MonitorPlay",
    color: "bg-slate-50 dark:bg-slate-950/40",
    text: "text-slate-600 dark:text-slate-400",
    ring: "ring-slate-200 dark:ring-slate-800",
    professionTypes: ["drone_operator"],
    description: "Aerial photography and videography using drone technology"
  },
  {
    id: "music_band",
    name: "Bands",
    icon: "Guitar",
    color: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-200 dark:ring-amber-800",
    professionTypes: ["music_band", "maharashta_band", "traditional_band", "instrumental_artist", "classical_musician", "wedding_band", "dhol_band", "brass_band"],
    description: "Live music bands for weddings and events"
  },
  {
    id: "dj",
    name: "DJs",
    icon: "Disc3",
    color: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-200 dark:ring-violet-800",
    professionTypes: ["dj"],
    description: "DJ and music entertainment services"
  },
  {
    id: "singer",
    name: "Singers",
    icon: "Mic",
    color: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-200 dark:ring-sky-800",
    professionTypes: ["singer"],
    description: "Professional singers and vocal performers"
  },
  {
    id: "dancer",
    name: "Dancers",
    icon: "PersonStanding",
    color: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    ring: "ring-fuchsia-200 dark:ring-fuchsia-800",
    professionTypes: ["dancer", "kuchipudi_dancer", "classical_dancer", "western_dancer"],
    description: "Dance performers for weddings and celebrations"
  },
  {
    id: "wedding_decorator",
    name: "Decorators",
    icon: "Flower2",
    color: "bg-lime-50 dark:bg-lime-950/40",
    text: "text-lime-700 dark:text-lime-400",
    ring: "ring-lime-200 dark:ring-lime-800",
    professionTypes: ["wedding_decorator", "stage_decorator", "event_decorator"],
    description: "Event decoration and styling services"
  },
  {
    id: "makeup_artist",
    name: "Makeup Artists",
    icon: "Palette",
    color: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-200 dark:ring-orange-800",
    professionTypes: ["makeup_artist"],
    description: "Professional makeup services"
  },
  {
    id: "mehendi_artist",
    name: "Mehendi Artists",
    icon: "Fingerprint",
    color: "bg-green-50 dark:bg-green-950/40",
    text: "text-green-600 dark:text-green-400",
    ring: "ring-green-200 dark:ring-green-800",
    professionTypes: ["mehendi_artist"],
    description: "Traditional mehendi (henna) application services"
  },
  {
    id: "anchor",
    name: "Anchors & Hosts",
    icon: "MicVocal",
    color: "bg-cyan-50 dark:bg-cyan-950/40",
    text: "text-cyan-600 dark:text-cyan-400",
    ring: "ring-cyan-200 dark:ring-cyan-800",
    professionTypes: ["anchor", "host"],
    description: "Professional event anchors and hosts"
  },
  {
    id: "catering_services",
    name: "Catering Services",
    icon: "Utensils",
    color: "bg-yellow-50 dark:bg-yellow-950/40",
    text: "text-yellow-700 dark:text-yellow-400",
    ring: "ring-yellow-200 dark:ring-yellow-800",
    professionTypes: ["catering_services"],
    description: "Food and catering services for events"
  },
  {
    id: "banquet_hall",
    name: "Banquet Halls",
    icon: "Building2",
    color: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-200 dark:ring-emerald-800",
    professionTypes: ["banquet_hall", "wedding_venue", "event_venue"],
    description: "Event venues and banquet halls"
  },
  {
    id: "rentals",
    name: "Rentals",
    icon: "Package",
    color: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-200 dark:ring-orange-800",
    professionTypes: ["rentals", "tent_shamiana", "stage_rental", "furniture_rental", "generator_rental", "ac_cooler", "led_wall"],
    description: "Event rentals and equipment"
  },
  {
    id: "pandit",
    name: "Pandits / Priests",
    icon: "Landmark",
    color: "bg-yellow-50 dark:bg-yellow-950/40",
    text: "text-yellow-700 dark:text-yellow-400",
    ring: "ring-yellow-200 dark:ring-yellow-800",
    professionTypes: ["pandit", "priest", "religious_services"],
    description: "Religious services and ceremony officiants"
  },
  {
    id: "water_supplier",
    name: "Drinking Water",
    icon: "Droplets",
    color: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-200 dark:ring-sky-800",
    professionTypes: ["water_supplier", "drinking_water", "water_tanker"],
    description: "Drinking water supply services for events"
  },
];

/**
 * Get a main category by ID
 */
export function getMainCategoryById(id: string): MainCategory | undefined {
  return MAIN_CATEGORIES.find(cat => cat.id === id);
}

/**
 * Get all profession types for a main category
 */
export function getProfessionTypesForMainCategory(categoryId: string): string[] {
  const category = getMainCategoryById(categoryId);
  return category?.professionTypes || [];
}

/**
 * Get the main category that contains a given profession type
 */
export function getMainCategoryForProfession(professionType: string): MainCategory | undefined {
  return MAIN_CATEGORIES.find(cat => 
    cat.professionTypes.includes(professionType)
  );
}

/**
 * Map a profession type to its main category ID
 */
export function professionTypeToMainCategoryId(professionType: string): string | undefined {
  const category = getMainCategoryForProfession(professionType);
  return category?.id;
}
