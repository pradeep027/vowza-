import { Music, Camera, Users, Palette, Mic2, Disc3, Video, Sparkles, Star, Heart, Zap, Globe, Utensils, Volume2, Lightbulb, CalendarDays } from "lucide-react";

// ─── Core Interfaces ──────────────────────────────────────────────────────────

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  professionalCount: number;
}

export interface TrendingCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  color: string;
  bgColor: string;
  slug: string;
}

export interface EventType {
  id: string;
  name: string;
  icon: string;
  description: string;
  artistCount: number;
  gradient: string;
}

export interface City {
  id: string;
  name: string;
  state: string;
  artistCount: number;
  gradient: string;
  description: string;
}

export interface FeaturedCollection {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  artistCount: number;
  gradient: string;
  badge: string;
  badgeColor: string;
}

export interface Professional {
  id: string;
  name: string;
  profession: string;
  category: string;
  location: string;
  rating: number;
  reviewCount: number;
  priceRange: string;
  priceMin: number;
  experience: string;
  image: string;
  isVerified: boolean;
  isAvailable: boolean;
  hasInstantBook: boolean;
  completedEvents: number;
  specialties: string[];
  languages?: string[];
  badge?: "top_rated" | "trending" | "new" | "premium";
}

export interface Testimonial {
  id: string;
  customerName: string;
  customerLocation: string;
  customerImage: string;
  artistName: string;
  artistProfession: string;
  eventType: string;
  rating: number;
  review: string;
  eventDate: string;
  featured?: boolean;
}

export interface GalleryItem {
  id: string;
  imageUrl: string;
  eventType: string;
  artistName: string;
  location: string;
  likes: number;
  category: string;
  aspectRatio: "square" | "portrait" | "landscape";
}

export interface SearchSuggestion {
  query: string;
  category: string;
  icon: string;
}

// ─── Service Categories (existing, kept for compatibility) ───────────────────

export const serviceCategories: ServiceCategory[] = [
  {
    id: "bands",
    name: "Music Bands",
    description: "Live music bands for weddings, receptions, and celebrations",
    icon: "Music",
    image: "/placeholder.svg",
    professionalCount: 245,
  },
  {
    id: "traditional-bands",
    name: "Traditional Bands",
    description: "Maharashtra traditional bands with dhol, tasha, and folk instruments",
    icon: "Mic2",
    image: "/placeholder.svg",
    professionalCount: 189,
  },
  {
    id: "dj",
    name: "DJs",
    description: "Professional DJs with modern sound systems and lighting",
    icon: "Disc3",
    image: "/placeholder.svg",
    professionalCount: 312,
  },
  {
    id: "photographers",
    name: "Photographers & Videographers",
    description: "Capture your special moments with professional photography",
    icon: "Camera",
    image: "/placeholder.svg",
    professionalCount: 456,
  },
  {
    id: "dancers",
    name: "Dancers",
    description: "Classical, Kuchipudi, Western, and contemporary dance performers",
    icon: "Users",
    image: "/placeholder.svg",
    professionalCount: 178,
  },
  {
    id: "decorators",
    name: "Event Decorators",
    description: "Transform your venue with stunning decorations and themes",
    icon: "Palette",
    image: "/placeholder.svg",
    professionalCount: 234,
  },
];

// ─── Trending Categories (15 categories) ─────────────────────────────────────

export const trendingCategories: TrendingCategory[] = [
  { id: "photographers", name: "Photographers", icon: "Camera", count: 456, color: "text-gold", bgColor: "bg-gold/10", slug: "photographers" },
  { id: "decorators", name: "Decorators", icon: "Palette", count: 234, color: "text-maroon", bgColor: "bg-maroon/10", slug: "decorators" },
  { id: "bands", name: "Live Bands", icon: "Music", count: 245, color: "text-royal", bgColor: "bg-royal/10", slug: "bands" },
  { id: "dj", name: "DJs", icon: "Disc3", count: 312, color: "text-gold", bgColor: "bg-gold/10", slug: "dj" },
  { id: "makeup", name: "Makeup Artists", icon: "Sparkles", count: 189, color: "text-maroon", bgColor: "bg-blush", slug: "makeup" },
  { id: "anchors", name: "Anchors & Hosts", icon: "Mic2", count: 143, color: "text-royal", bgColor: "bg-royal/10", slug: "anchors" },
  { id: "choreographers", name: "Choreographers", icon: "Users", count: 98, color: "text-gold", bgColor: "bg-gold/10", slug: "choreographers" },
  { id: "dancers", name: "Dancers", icon: "Users", count: 178, color: "text-maroon", bgColor: "bg-maroon/10", slug: "dancers" },
  { id: "mehendi", name: "Mehendi Artists", icon: "Sparkles", count: 124, color: "text-gold", bgColor: "bg-gold/10", slug: "mehendi" },
  { id: "catering", name: "Caterers", icon: "Utensils", count: 267, color: "text-royal", bgColor: "bg-royal/10", slug: "catering" },
  { id: "planners", name: "Event Planners", icon: "CalendarDays", count: 201, color: "text-maroon", bgColor: "bg-maroon/10", slug: "planners" },
  { id: "lighting", name: "Lighting", icon: "Lightbulb", count: 156, color: "text-gold", bgColor: "bg-gold/10", slug: "lighting" },
  { id: "sound", name: "Sound Engineers", icon: "Volume2", count: 134, color: "text-royal", bgColor: "bg-royal/10", slug: "sound" },
  { id: "videographers", name: "Videographers", icon: "Video", count: 211, color: "text-maroon", bgColor: "bg-maroon/10", slug: "videographers" },
  { id: "rentals", name: "Rental Services", icon: "Star", count: 87, color: "text-gold", bgColor: "bg-gold/10", slug: "rentals" },
];

// ─── Event Types (12 events) ──────────────────────────────────────────────────

export const eventTypes: EventType[] = [
  { id: "wedding", name: "Wedding", icon: "💒", description: "Make your big day unforgettable", artistCount: 1200, gradient: "from-rose-400 to-maroon" },
  { id: "reception", name: "Reception", icon: "🥂", description: "Celebrate after the ceremony", artistCount: 980, gradient: "from-gold to-amber-600" },
  { id: "birthday", name: "Birthday", icon: "🎂", description: "Party like it's your day", artistCount: 750, gradient: "from-purple-400 to-royal" },
  { id: "corporate", name: "Corporate", icon: "🏢", description: "Professional events & conferences", artistCount: 620, gradient: "from-slate-400 to-slate-700" },
  { id: "haldi", name: "Haldi Ceremony", icon: "💛", description: "Joyful pre-wedding ritual", artistCount: 430, gradient: "from-yellow-300 to-gold" },
  { id: "sangeet", name: "Sangeet Night", icon: "🎵", description: "Music & dance celebrations", artistCount: 560, gradient: "from-pink-400 to-maroon" },
  { id: "engagement", name: "Engagement", icon: "💍", description: "Ring ceremony & celebrations", artistCount: 480, gradient: "from-gold to-rose-500" },
  { id: "housewarming", name: "House Warming", icon: "🏠", description: "Bless your new home", artistCount: 310, gradient: "from-green-400 to-teal-600" },
  { id: "babyshower", name: "Baby Shower", icon: "👶", description: "Celebrate the new arrival", artistCount: 260, gradient: "from-sky-300 to-blue-500" },
  { id: "collegefest", name: "College Fest", icon: "🎓", description: "Energetic campus celebrations", artistCount: 340, gradient: "from-orange-400 to-red-500" },
  { id: "temple", name: "Temple Events", icon: "🛕", description: "Sacred & spiritual occasions", artistCount: 290, gradient: "from-amber-400 to-orange-600" },
  { id: "private", name: "Private Party", icon: "🎉", description: "Exclusive private gatherings", artistCount: 520, gradient: "from-violet-400 to-purple-700" },
];

// ─── Popular Cities ───────────────────────────────────────────────────────────

export const popularCities: City[] = [
  { id: "hyderabad", name: "Hyderabad", state: "Telangana", artistCount: 1240, gradient: "from-maroon/80 to-maroon-dark/90", description: "City of Pearls" },
  { id: "bangalore", name: "Bangalore", state: "Karnataka", artistCount: 1580, gradient: "from-royal/80 to-royal/90", description: "Silicon Valley of India" },
  { id: "chennai", name: "Chennai", state: "Tamil Nadu", artistCount: 890, gradient: "from-gold/80 to-amber-700/90", description: "Cultural Capital of South" },
  { id: "mumbai", name: "Mumbai", state: "Maharashtra", artistCount: 2100, gradient: "from-maroon/80 to-maroon-dark/90", description: "City of Dreams" },
  { id: "delhi", name: "Delhi", state: "NCR", artistCount: 1920, gradient: "from-slate-700/80 to-slate-900/90", description: "Heart of India" },
  { id: "pune", name: "Pune", state: "Maharashtra", artistCount: 760, gradient: "from-gold/80 to-amber-700/90", description: "Oxford of the East" },
  { id: "vizag", name: "Vizag", state: "Andhra Pradesh", artistCount: 420, gradient: "from-teal-600/80 to-teal-900/90", description: "Jewel of the East Coast" },
  { id: "vijayawada", name: "Vijayawada", state: "Andhra Pradesh", artistCount: 380, gradient: "from-maroon/80 to-maroon-dark/90", description: "Business Capital of AP" },
  { id: "warangal", name: "Warangal", state: "Telangana", artistCount: 195, gradient: "from-orange-600/80 to-red-900/90", description: "City of Warriors" },
];

// ─── Featured Collections ─────────────────────────────────────────────────────

export const featuredCollections: FeaturedCollection[] = [
  { id: "luxury", title: "Luxury Weddings", subtitle: "Premium Experiences", description: "Top-tier artists for grand celebrations — every detail, perfected.", artistCount: 186, gradient: "from-gold via-amber-500 to-gold-dark", badge: "Premium", badgeColor: "bg-gold text-foreground" },
  { id: "budget", title: "Budget Friendly", subtitle: "Quality Within Reach", description: "Exceptional artists at prices that make sense for every family.", artistCount: 342, gradient: "from-emerald-400 via-teal-500 to-emerald-700", badge: "Value", badgeColor: "bg-emerald-500 text-white" },
  { id: "celebrity", title: "Celebrity Artists", subtitle: "Star Power for Your Event", description: "Book renowned performers and celebrity artists for an iconic event.", artistCount: 47, gradient: "from-violet-500 via-purple-600 to-indigo-700", badge: "VIP", badgeColor: "bg-violet-500 text-white" },
  { id: "trending", title: "Trending This Week", subtitle: "Most Booked Right Now", description: "The hottest artists being booked across India this week.", artistCount: 124, gradient: "from-maroon via-rose-600 to-maroon-dark", badge: "Hot 🔥", badgeColor: "bg-maroon text-white" },
  { id: "new", title: "Rising Stars", subtitle: "Fresh Talent, Great Value", description: "Discover newly verified artists who are making waves.", artistCount: 98, gradient: "from-royal via-blue-500 to-indigo-600", badge: "New", badgeColor: "bg-royal text-white" },
];

// ─── Featured Professionals (enhanced) ───────────────────────────────────────

export const featuredProfessionals: Professional[] = [
  {
    id: "1",
    name: "Rhythm Masters Band",
    profession: "Live Music Band",
    category: "bands",
    location: "Mumbai, Maharashtra",
    rating: 4.9,
    reviewCount: 234,
    priceRange: "₹25,000 – ₹50,000",
    priceMin: 25000,
    experience: "12 yrs",
    image: "/placeholder.svg",
    isVerified: true,
    isAvailable: true,
    hasInstantBook: true,
    completedEvents: 412,
    specialties: ["Bollywood", "Sufi", "Classical Fusion"],
    languages: ["Hindi", "Marathi", "English"],
    badge: "top_rated",
  },
  {
    id: "2",
    name: "DJ Spark",
    profession: "Professional DJ",
    category: "dj",
    location: "Pune, Maharashtra",
    rating: 4.8,
    reviewCount: 189,
    priceRange: "₹15,000 – ₹35,000",
    priceMin: 15000,
    experience: "8 yrs",
    image: "/placeholder.svg",
    isVerified: true,
    isAvailable: true,
    hasInstantBook: true,
    completedEvents: 287,
    specialties: ["EDM", "Bollywood Remix", "Commercial"],
    languages: ["Hindi", "English"],
    badge: "trending",
  },
  {
    id: "3",
    name: "Shutter Stories",
    profession: "Wedding Photographer",
    category: "photographers",
    location: "Hyderabad, Telangana",
    rating: 4.9,
    reviewCount: 312,
    priceRange: "₹40,000 – ₹1,00,000",
    priceMin: 40000,
    experience: "10 yrs",
    image: "/placeholder.svg",
    isVerified: true,
    isAvailable: false,
    hasInstantBook: false,
    completedEvents: 524,
    specialties: ["Candid", "Traditional", "Pre-wedding"],
    languages: ["Telugu", "Hindi", "English"],
    badge: "top_rated",
  },
  {
    id: "4",
    name: "Nritya Kala Academy",
    profession: "Classical Dance Group",
    category: "dancers",
    location: "Mumbai, Maharashtra",
    rating: 4.7,
    reviewCount: 156,
    priceRange: "₹20,000 – ₹45,000",
    priceMin: 20000,
    experience: "15 yrs",
    image: "/placeholder.svg",
    isVerified: true,
    isAvailable: true,
    hasInstantBook: false,
    completedEvents: 318,
    specialties: ["Kuchipudi", "Bharatanatyam", "Folk"],
    languages: ["Telugu", "Hindi"],
    badge: "premium",
  },
  {
    id: "5",
    name: "Dream Decor Studio",
    profession: "Event Decorator",
    category: "decorators",
    location: "Bangalore, Karnataka",
    rating: 4.8,
    reviewCount: 198,
    priceRange: "₹50,000 – ₹2,00,000",
    priceMin: 50000,
    experience: "9 yrs",
    image: "/placeholder.svg",
    isVerified: true,
    isAvailable: true,
    hasInstantBook: true,
    completedEvents: 245,
    specialties: ["Floral", "Modern", "Traditional"],
    languages: ["Kannada", "Hindi", "English"],
    badge: "trending",
  },
  {
    id: "6",
    name: "Dhol Tasha Pathak",
    profession: "Traditional Band",
    category: "traditional-bands",
    location: "Nashik, Maharashtra",
    rating: 4.9,
    reviewCount: 267,
    priceRange: "₹18,000 – ₹40,000",
    priceMin: 18000,
    experience: "20 yrs",
    image: "/placeholder.svg",
    isVerified: true,
    isAvailable: true,
    hasInstantBook: false,
    completedEvents: 680,
    specialties: ["Dhol", "Tasha", "Lezim"],
    languages: ["Marathi", "Hindi"],
    badge: "top_rated",
  },
];

// ─── Testimonials ──────────────────────────────────────────────────────────────

export const testimonials: Testimonial[] = [
  {
    id: "1",
    customerName: "Priya Sharma",
    customerLocation: "Hyderabad",
    customerImage: "/placeholder.svg",
    artistName: "Rhythm Masters Band",
    artistProfession: "Live Music Band",
    eventType: "Wedding",
    rating: 5,
    review: "Vowza made finding the perfect band for our wedding incredibly easy. Rhythm Masters exceeded every expectation — our guests are still talking about the performance!",
    eventDate: "December 2024",
    featured: true,
  },
  {
    id: "2",
    customerName: "Rahul Verma",
    customerLocation: "Mumbai",
    customerImage: "/placeholder.svg",
    artistName: "Shutter Stories",
    artistProfession: "Wedding Photographer",
    eventType: "Reception",
    rating: 5,
    review: "The photos are absolutely stunning. Shutter Stories captured every emotion perfectly. Booking through Vowza was seamless — payment, communication, everything.",
    eventDate: "November 2024",
    featured: true,
  },
  {
    id: "3",
    customerName: "Ananya Reddy",
    customerLocation: "Bangalore",
    customerImage: "/placeholder.svg",
    artistName: "Dream Decor Studio",
    artistProfession: "Event Decorator",
    eventType: "Engagement",
    rating: 5,
    review: "Dream Decor transformed our venue beyond imagination. The floral arrangements were breathtaking. I loved being able to see their full portfolio on Vowza before booking.",
    eventDate: "January 2025",
    featured: false,
  },
  {
    id: "4",
    customerName: "Karthik Nair",
    customerLocation: "Chennai",
    customerImage: "/placeholder.svg",
    artistName: "DJ Spark",
    artistProfession: "Professional DJ",
    eventType: "Birthday Party",
    rating: 5,
    review: "DJ Spark kept the energy high all night! The instant booking feature on Vowza saved us so much time. Highly recommend for anyone planning a party.",
    eventDate: "February 2025",
    featured: false,
  },
  {
    id: "5",
    customerName: "Meera Patel",
    customerLocation: "Pune",
    customerImage: "/placeholder.svg",
    artistName: "Nritya Kala Academy",
    artistProfession: "Classical Dance Group",
    eventType: "Sangeet",
    rating: 5,
    review: "The Kuchipudi performance at our Sangeet was mesmerizing. Every guest was in awe. Vowza's verified badge gave us confidence in our choice.",
    eventDate: "March 2025",
    featured: true,
  },
];

// ─── Gallery Items ─────────────────────────────────────────────────────────────

export const galleryItems: GalleryItem[] = [
  { id: "1", imageUrl: "/placeholder.svg", eventType: "Wedding", artistName: "Dream Decor Studio", location: "Mumbai", likes: 342, category: "decoration", aspectRatio: "portrait" },
  { id: "2", imageUrl: "/placeholder.svg", eventType: "Sangeet", artistName: "Rhythm Masters", location: "Hyderabad", likes: 218, category: "performance", aspectRatio: "landscape" },
  { id: "3", imageUrl: "/placeholder.svg", eventType: "Reception", artistName: "Shutter Stories", location: "Bangalore", likes: 456, category: "photography", aspectRatio: "square" },
  { id: "4", imageUrl: "/placeholder.svg", eventType: "Haldi", artistName: "Mehendi Art Studio", location: "Delhi", likes: 189, category: "mehendi", aspectRatio: "square" },
  { id: "5", imageUrl: "/placeholder.svg", eventType: "Birthday", artistName: "DJ Spark", location: "Pune", likes: 267, category: "dj", aspectRatio: "landscape" },
  { id: "6", imageUrl: "/placeholder.svg", eventType: "Engagement", artistName: "Nritya Kala", location: "Chennai", likes: 312, category: "dance", aspectRatio: "portrait" },
  { id: "7", imageUrl: "/placeholder.svg", eventType: "Corporate", artistName: "Elite Events", location: "Mumbai", likes: 145, category: "corporate", aspectRatio: "landscape" },
  { id: "8", imageUrl: "/placeholder.svg", eventType: "Wedding", artistName: "Lens & Light", location: "Hyderabad", likes: 523, category: "photography", aspectRatio: "square" },
];

// ─── AI Search Suggestions ─────────────────────────────────────────────────────

export const searchSuggestions: SearchSuggestion[] = [
  { query: "Plan a wedding for 300 guests in Hyderabad under ₹12 lakh", category: "wedding", icon: "Sparkles" },
  { query: "Birthday party for 100 people in Bangalore under ₹2 lakh", category: "birthday", icon: "Sparkles" },
  { query: "Sangeet night for 150 guests in Mumbai under ₹3 lakh", category: "sangeet", icon: "Sparkles" },
  { query: "Corporate event for 200 people in Delhi under ₹5 lakh", category: "corporate", icon: "Sparkles" },
  { query: "Engagement ceremony for 80 guests in Pune", category: "engagement", icon: "Sparkles" },
  { query: "Full wedding plan for 500 guests in Chennai with ₹20 lakh budget", category: "wedding", icon: "Sparkles" },
];

export const trendingSearches = [
  "Wedding in Hyderabad",
  "DJ for Sangeet",
  "Mehendi Artist",
  "Wedding Decorator",
  "Photographer Mumbai",
  "Bridal Makeup",
];
