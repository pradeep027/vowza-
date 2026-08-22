// ─── Category Config — Complete marketplace definition ────────────────────────
// Single source of truth for all 20 categories:
//   subcategories, profile fields, banner colours, icons, slugs

import {
  Camera, MonitorPlay, Music2, Disc3, Mic,
  PersonStanding, Users, Paintbrush, Sparkles, Hand,
  Wand2, Building2, Package, Landmark, Droplets,
  Utensils, Lightbulb, Volume2, type LucideIcon,
} from "lucide-react";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "boolean" | "tags" | "url";
  placeholder?: string;
  options?: string[];
  section?: "basic" | "services" | "pricing" | "portfolio" | "contact";
}

export interface CategoryDef {
  id: string;               // slug — used in URL /category/:id
  name: string;             // display name
  plural: string;           // "Photographers", "DJs"…
  icon: LucideIcon;
  gradient: string;         // CSS gradient for banner
  bannerColor: string;      // bg-* class for fallback
  subcategories: string[];
  fields: FieldDef[];       // category-specific profile fields
  // DB profession_type values that map to this category
  professionTypes: string[];
  // Which special table this category uses (optional)
  specialTable?: "menu_items" | "rental_items" | "pooja_services";
}

const COMMON_FIELDS: FieldDef[] = [
  { key: "bio",             label: "About / Bio",        type: "textarea",  placeholder: "Describe your services…",  section: "basic"    },
  { key: "experience_years",label: "Experience (years)",  type: "number",    placeholder: "5",                        section: "basic"    },
  { key: "price_min",       label: "Starting Price (₹)",  type: "number",    placeholder: "5000",                     section: "pricing"  },
  { key: "price_max",       label: "Maximum Price (₹)",   type: "number",    placeholder: "50000",                    section: "pricing"  },
  { key: "languages",       label: "Languages Spoken",    type: "tags",      placeholder: "Hindi, Telugu…",           section: "basic"    },
  { key: "specialties",     label: "Specialties",         type: "tags",      placeholder: "Wedding, Corporate…",      section: "services" },
  { key: "service_areas",   label: "Service Areas",       type: "tags",      placeholder: "Hyderabad, Pune…",         section: "services" },
  { key: "whatsapp",        label: "WhatsApp Number",     type: "text",      placeholder: "+91 9876543210",           section: "contact"  },
  { key: "instagram",       label: "Instagram",           type: "url",       placeholder: "@youhandle",               section: "contact"  },
  { key: "youtube",         label: "YouTube",             type: "url",       placeholder: "youtube.com/c/...",        section: "contact"  },
];

export const CATEGORIES: CategoryDef[] = [
  // ────────────────────────────────────────────────────────────
  {
    id: "photography-videography", name: "Photography & Videography", plural: "Photography & Videography",
    icon: Camera,
    gradient: "linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)",
    bannerColor: "bg-blue-900",
    professionTypes: ["photographer", "videographer", "cinematographer", "photography_videography"],
    subcategories: ["Wedding Photography","Pre-Wedding","Candid","Traditional","Baby Shoot","Corporate","Fashion","Product","Traditional Video","Cinematic Film","Wedding Film","Reel Package","Drone Coverage","Live Streaming"],
    fields: [
      ...COMMON_FIELDS,
      // Photography fields
      { key: "drone_available",  label: "Drone Available",   type: "boolean",  section: "services" },
      { key: "albums_included",  label: "Albums Included",   type: "boolean",  section: "services" },
      { key: "team_size",        label: "Team Size",         type: "number",   placeholder: "2",  section: "services" },
      // Videography fields
      { key: "cinematic",       label: "Cinematic Style",    type: "boolean", section: "services" },
      { key: "drone_coverage",  label: "Drone Coverage",     type: "boolean", section: "services" },
      { key: "delivery_days",   label: "Delivery Time (days)", type: "number", placeholder: "15", section: "services" },
      { key: "formats",         label: "Output Formats",     type: "tags",    placeholder: "4K, Reels, DVD", section: "services" },
      { key: "hourly_rate",      label: "Hourly Rate (₹)",   type: "number",   placeholder: "2000", section: "pricing" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "drone_operator", name: "Drone Photography", plural: "Drone Photographers",
    icon: MonitorPlay,
    gradient: "linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)",
    bannerColor: "bg-slate-800",
    professionTypes: ["drone_operator"],
    subcategories: ["Wedding Drone","Real Estate","Event Aerial","Commercial"],
    fields: [
      ...COMMON_FIELDS,
      { key: "drone_type",       label: "Drone Model",        type: "text",    placeholder: "DJI Mavic 3", section: "services" },
      { key: "license",          label: "DGCA License No.",   type: "text",    placeholder: "DGCA-...",    section: "services" },
      { key: "fly_permission",   label: "Flying Permission",  type: "boolean", section: "services" },
      { key: "coverage_km",      label: "Coverage Area (km)", type: "number",  placeholder: "50",          section: "services" },
      { key: "hourly_rate",      label: "Price Per Hour (₹)", type: "number",  placeholder: "3000",        section: "pricing"  },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "music_band", name: "Bands", plural: "Bands",
    icon: Music2,
    gradient: "linear-gradient(135deg,#3a1c71 0%,#d76d77 50%,#ffaf7b 100%)",
    bannerColor: "bg-purple-900",
    professionTypes: ["music_band","maharashtra_band","traditional_band","instrumental_artist","classical_musician","wedding_band","dhol_band","brass_band"],
    subcategories: ["Wedding Band","Brass Band","Pad Band","Baraat Band","Punjabi Dhol Band","Nashik Dhol Band","Tamil Melam","Chenda Melam","Marfa Band","Shivaji Maharashtrian Band","Traditional Folk Band","Devotional Band","Shehnai & Nadaswaram Band","Live Music Band"],
    fields: [
      ...COMMON_FIELDS,
      { key: "members",          label: "No. of Members",     type: "number",  placeholder: "8", section: "basic"    },
      { key: "instruments",      label: "Instruments",        type: "tags",    placeholder: "Drums, Guitar…", section: "services" },
      { key: "performance_hrs",  label: "Performance Hours",  type: "number",  placeholder: "3", section: "services" },
      { key: "costume_theme",    label: "Costume/Theme",      type: "text",    placeholder: "Traditional", section: "services" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "dj", name: "DJs", plural: "DJs",
    icon: Disc3,
    gradient: "linear-gradient(135deg,#141e30 0%,#243b55 100%)",
    bannerColor: "bg-slate-900",
    professionTypes: ["dj"],
    subcategories: ["Wedding DJ","Club DJ","Birthday DJ","Corporate DJ","Sangeet DJ"],
    fields: [
      ...COMMON_FIELDS,
      { key: "sound_system",     label: "Sound System (watts)",type: "number", placeholder: "10000", section: "services" },
      { key: "lighting_included",label: "Lighting Included",   type: "boolean", section: "services" },
      { key: "smoke_machine",    label: "Smoke Machine",       type: "boolean", section: "services" },
      { key: "genres",           label: "Music Genres",        type: "tags",    placeholder: "Bollywood, EDM…", section: "services" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "singer", name: "Singers", plural: "Singers",
    icon: Mic,
    gradient: "linear-gradient(135deg,#c94b4b 0%,#4b134f 100%)",
    bannerColor: "bg-red-800",
    professionTypes: ["singer"],
    subcategories: ["Telugu Singer","Bollywood Singer","Hindi Singer","Folk Singer","Devotional Singer","Western / English Singer"],
    fields: [
      ...COMMON_FIELDS,
      { key: "genres",           label: "Genres",              type: "tags",    placeholder: "Classical, Folk…", section: "services" },
      { key: "male_female",      label: "Voice Type",          type: "select",  options: ["Male","Female","Both"], section: "basic" },
      { key: "performs_live",    label: "Live Performance",    type: "boolean", section: "services" },
      { key: "charges_per_show", label: "Charges Per Show (₹)",type: "number", placeholder: "15000", section: "pricing" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "dancer", name: "Dancers", plural: "Dancers",
    icon: PersonStanding,
    gradient: "linear-gradient(135deg,#ee0979 0%,#ff6a00 100%)",
    bannerColor: "bg-pink-800",
    professionTypes: ["dancer","kuchipudi_dancer","classical_dancer","western_dancer"],
    subcategories: ["Bharatanatyam","Kuchipudi","Kathak","Western","Hip Hop","Contemporary","Bhangra","Garba","Sangeet Dance","Bride Entry","Couple Dance"],
    fields: [
      ...COMMON_FIELDS,
      { key: "dance_style",      label: "Dance Style",         type: "tags",    placeholder: "Kuchipudi, Western…", section: "services" },
      { key: "solo_group",       label: "Solo / Group",        type: "select",  options: ["Solo","Group","Both"], section: "services" },
      { key: "team_members",     label: "Team Members",        type: "number",  placeholder: "4", section: "services" },
      { key: "costume_included", label: "Costume Included",    type: "boolean", section: "services" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "choreographer", name: "Choreographers", plural: "Choreographers",
    icon: Users,
    gradient: "linear-gradient(135deg,#6a3093 0%,#a044ff 100%)",
    bannerColor: "bg-purple-800",
    professionTypes: ["choreographer"],
    subcategories: ["Wedding","Sangeet","Classical","Western","Corporate","School Events"],
    fields: [
      ...COMMON_FIELDS,
      { key: "practice_sessions", label: "Practice Sessions", type: "number",  placeholder: "5", section: "services" },
      { key: "choreographies",    label: "No. of Choreographies", type: "number", placeholder: "3", section: "services" },
      { key: "travel_included",   label: "Travel Included",   type: "boolean", section: "services" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "wedding_decorator", name: "Decorators", plural: "Decorators",
    icon: Paintbrush,
    gradient: "linear-gradient(135deg,#134e5e 0%,#71b280 100%)",
    bannerColor: "bg-teal-800",
    professionTypes: ["wedding_decorator","stage_decorator","event_decorator"],
    subcategories: ["Wedding Decoration","Birthday Decoration","Stage Decoration","Floral Decoration","Balloon Decoration","Mandap Decoration","Reception Decoration"],
    fields: [
      ...COMMON_FIELDS,
      { key: "themes",           label: "Themes Offered",      type: "tags",    placeholder: "Royal, Floral…", section: "services" },
      { key: "floral",           label: "Floral Decoration",   type: "boolean", section: "services" },
      { key: "outdoor",          label: "Outdoor Events",      type: "boolean", section: "services" },
      { key: "materials_cost",   label: "Materials Cost Included", type: "boolean", section: "pricing" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "makeup_artist", name: "Makeup Artists", plural: "Makeup Artists",
    icon: Sparkles,
    gradient: "linear-gradient(135deg,#f953c6 0%,#b91d73 100%)",
    bannerColor: "bg-pink-900",
    professionTypes: ["makeup_artist"],
    subcategories: ["Bridal","Groom","Party","HD Makeup","Airbrush","Fashion"],
    fields: [
      ...COMMON_FIELDS,
      { key: "brands",           label: "Makeup Brands Used",  type: "tags",    placeholder: "MAC, Huda…", section: "services" },
      { key: "airbrush",         label: "Airbrush Available",  type: "boolean", section: "services" },
      { key: "travel",           label: "Travel to Venue",     type: "boolean", section: "services" },
      { key: "trial_available",  label: "Trial Session",       type: "boolean", section: "services" },
      { key: "trial_price",      label: "Trial Price (₹)",     type: "number",  placeholder: "2000", section: "pricing" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "mehendi_artist", name: "Mehendi Artists", plural: "Mehendi Artists",
    icon: Hand,
    gradient: "linear-gradient(135deg,#2d6a4f 0%,#52b788 100%)",
    bannerColor: "bg-green-800",
    professionTypes: ["mehendi_artist"],
    subcategories: ["Bridal Mehendi","Arabic","Rajasthani","Indo Arabic","Portrait Mehendi"],
    fields: [
      ...COMMON_FIELDS,
      { key: "bridal_pkg_price",  label: "Bridal Package Price (₹)", type: "number", placeholder: "5000", section: "pricing" },
      { key: "price_per_hand",    label: "Price Per Hand (₹)",       type: "number", placeholder: "500",  section: "pricing" },
      { key: "natural_mehendi",   label: "Natural Mehendi",          type: "boolean", section: "services" },
      { key: "organic",           label: "Organic Ingredients",      type: "boolean", section: "services" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "magician", name: "Magicians", plural: "Magicians",
    icon: Wand2,
    gradient: "linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)",
    bannerColor: "bg-indigo-900",
    professionTypes: ["magician","stand_up_comedian"],
    subcategories: ["Stage Magic","Kids Magic","Illusion","Close Up Magic"],
    fields: [
      ...COMMON_FIELDS,
      { key: "show_duration",    label: "Show Duration (min)",  type: "number", placeholder: "45", section: "services" },
      { key: "age_group",        label: "Suitable Age Group",   type: "text",   placeholder: "All ages", section: "services" },
      { key: "illusion",         label: "Illusion Show",        type: "boolean", section: "services" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "anchor", name: "Anchors & Hosts", plural: "Anchors & Hosts",
    icon: Mic,
    gradient: "linear-gradient(135deg,#1a1a2e 0%,#e94560 100%)",
    bannerColor: "bg-red-900",
    professionTypes: ["anchor","host"],
    subcategories: ["Wedding","Corporate","Birthday","Stage Shows","Celebrity Host"],
    fields: [
      ...COMMON_FIELDS,
      { key: "events_hosted",    label: "Events Hosted",        type: "number", placeholder: "100", section: "basic"    },
      { key: "multilingual",     label: "Multilingual",         type: "boolean", section: "services" },
      { key: "charges",          label: "Charges Per Event (₹)",type: "number", placeholder: "15000", section: "pricing" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "catering_services", name: "Catering Services", plural: "Caterers",
    icon: Utensils,
    gradient: "linear-gradient(135deg,#f7971e 0%,#ffd200 100%)",
    bannerColor: "bg-amber-700",
    professionTypes: ["catering_services"],
    subcategories: ["Veg Meals","Non Veg Meals","Biryani","Buffet","South Indian","North Indian","Chinese","Live Counters","Snacks","Sweets"],
    fields: [
      ...COMMON_FIELDS,
      { key: "min_plates",       label: "Minimum Plates",       type: "number", placeholder: "100", section: "services" },
      { key: "max_capacity",     label: "Maximum Capacity",     type: "number", placeholder: "1000", section: "services" },
      { key: "veg_nonveg",       label: "Veg / Non-Veg",        type: "select", options: ["Veg Only","Non-Veg","Both"], section: "services" },
      { key: "tasting",          label: "Tasting Session",      type: "boolean", section: "services" },
      { key: "price_per_plate",  label: "Price Per Plate (₹)",  type: "number", placeholder: "350", section: "pricing" },
    ],
    specialTable: "menu_items",
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "lighting_services", name: "Lighting Services", plural: "Lighting Services",
    icon: Lightbulb,
    gradient: "linear-gradient(135deg,#f7971e 0%,#ffd200 100%)",
    bannerColor: "bg-yellow-700",
    professionTypes: ["lighting_services"],
    subcategories: ["Stage Lighting","Wedding Lighting","Decorative Lighting","LED Lighting","Moving Heads","Laser Lights"],
    fields: [
      ...COMMON_FIELDS,
      { key: "equipment",        label: "Equipment List",       type: "tags",   placeholder: "Moving heads, LED…", section: "services" },
      { key: "led_available",    label: "LED Wall Available",   type: "boolean", section: "services" },
      { key: "laser_lights",     label: "Laser Lights",         type: "boolean", section: "services" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "sound_services", name: "Sound Services", plural: "Sound Engineers",
    icon: Volume2,
    gradient: "linear-gradient(135deg,#1565C0 0%,#1976D2 100%)",
    bannerColor: "bg-blue-800",
    professionTypes: ["sound_services"],
    subcategories: ["DJ Sound","Concert Sound","Wedding Sound","Corporate Audio"],
    fields: [
      ...COMMON_FIELDS,
      { key: "wattage",          label: "Sound System (watts)", type: "number", placeholder: "20000", section: "services" },
      { key: "microphones",      label: "Microphones",          type: "tags",   placeholder: "Wireless, Lapel…", section: "services" },
      { key: "speakers_brand",   label: "Speaker Brand",        type: "text",   placeholder: "JBL, Bose", section: "services" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "banquet_hall", name: "Banquet Halls", plural: "Banquet Halls",
    icon: Building2,
    gradient: "linear-gradient(135deg,#134e5e 0%,#71b280 100%)",
    bannerColor: "bg-emerald-800",
    professionTypes: ["banquet_hall"],
    subcategories: ["AC Hall","Non AC Hall","Outdoor Venue","Terrace","Lawn"],
    fields: [
      ...COMMON_FIELDS,
      { key: "hall_name",        label: "Hall Name",            type: "text",   placeholder: "Royal Palace Hall", section: "basic" },
      { key: "capacity",         label: "Seating Capacity",     type: "number", placeholder: "500", section: "services" },
      { key: "dining_capacity",  label: "Dining Capacity",      type: "number", placeholder: "400", section: "services" },
      { key: "ac",               label: "Air Conditioned",      type: "boolean", section: "services" },
      { key: "parking",          label: "Parking Available",    type: "boolean", section: "services" },
      { key: "rooms",            label: "Number of Rooms",      type: "number", placeholder: "10", section: "services" },
      { key: "price_per_day",    label: "Price Per Day (₹)",    type: "number", placeholder: "50000", section: "pricing" },
      { key: "price_per_hour",   label: "Price Per Hour (₹)",   type: "number", placeholder: "5000",  section: "pricing" },
      { key: "map_url",          label: "Google Maps Link",     type: "url",    placeholder: "maps.google.com/…", section: "contact" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "pandit", name: "Pandits / Priests", plural: "Pandits & Priests",
    icon: Landmark,
    gradient: "linear-gradient(135deg,#f7971e 0%,#e43a00 100%)",
    bannerColor: "bg-orange-800",
    professionTypes: ["pandit"],
    subcategories: ["Marriage","Gruhapravesam","Satyanarayana Vratham","Ganapathi Homam","Rudrabhishekam","Upanayanam","Naming Ceremony","Annaprasana","Navagraha Pooja","Ayush Homam","Vastu Pooja","Nikah","Christian Wedding"],
    fields: [
      ...COMMON_FIELDS,
      { key: "religion",         label: "Religion",             type: "select", options: ["Hindu","Muslim","Christian","All"], section: "basic" },
      { key: "vedic_knowledge",  label: "Vedic Specialization", type: "tags",   placeholder: "Rigveda, Yajurveda…", section: "services" },
      { key: "gotram",           label: "Gotram",               type: "text",   placeholder: "Optional", section: "basic" },
      { key: "materials_provided", label: "Pooja Materials Provided", type: "boolean", section: "services" },
    ],
    specialTable: "pooja_services",
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "water_supplier", name: "Drinking Water", plural: "Water Suppliers",
    icon: Droplets,
    gradient: "linear-gradient(135deg,#00b4db 0%,#0083b0 100%)",
    bannerColor: "bg-sky-700",
    professionTypes: ["water_supplier"],
    subcategories: ["Cool Water","Normal Water","RO Water","Mineral Water","Water Tankers"],
    fields: [
      ...COMMON_FIELDS,
      { key: "water_type",       label: "Water Type",           type: "tags",   placeholder: "RO, Mineral…", section: "services" },
      { key: "can_sizes",        label: "Can Sizes Available",  type: "tags",   placeholder: "20L, 10L, 5L", section: "services" },
      { key: "tanker_capacity",  label: "Tanker Capacity (L)",  type: "number", placeholder: "10000", section: "services" },
      { key: "price_per_can",    label: "Price Per Can (₹)",    type: "number", placeholder: "80",  section: "pricing" },
      { key: "price_per_tanker", label: "Price Per Tanker (₹)", type: "number", placeholder: "2000", section: "pricing" },
      { key: "delivery_area",    label: "Delivery Area (km)",   type: "number", placeholder: "30", section: "services" },
    ],
  },
  // ────────────────────────────────────────────────────────────
  {
    id: "rentals", name: "Rentals", plural: "Rental Services",
    icon: Package,
    gradient: "linear-gradient(135deg,#e65c00 0%,#f9d423 100%)",
    bannerColor: "bg-orange-700",
    professionTypes: ["rentals"],
    subcategories: ["Tent & Shamiana","Stage","Chairs & Tables","Furniture","Generator","AC Cooler","LED Wall","Sound Equipment","Lighting Equipment"],
    fields: [
      ...COMMON_FIELDS,
      { key: "delivery_available", label: "Delivery Available", type: "boolean", section: "services" },
      { key: "setup_included",   label: "Setup/Dismantling Included", type: "boolean", section: "services" },
      { key: "security_deposit_req", label: "Security Deposit Required", type: "boolean", section: "pricing" },
    ],
    specialTable: "rental_items",
  },
];

// Fast lookup map
export const CATEGORY_MAP = new Map<string, CategoryDef>(
  CATEGORIES.map(c => [c.id, c])
);

// Resolve any profession_type string to its canonical CategoryDef
export function getCategoryByProfession(profession: string): CategoryDef | undefined {
  return CATEGORIES.find(c => c.professionTypes.includes(profession));
}

// All slugs that point to a given CategoryDef id
export function getCategorySlug(categoryId: string): string {
  return `/category/${categoryId}`;
}
