// ─── Navbar — Corporate Premium Edition ──────────────────────────────────────
// Sticky, shrinks on scroll, mega menu for Browse, instant search, all actions

import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Menu, X, Search, Sparkles, ShoppingBag, Bell, Heart,
  ChevronDown, User, LogOut, LayoutDashboard, BookOpen,
  Camera, Music, Disc3, Palette, Mic2, Users, Utensils,
  Wand2, Star, Zap, MapPin, CalendarDays, ArrowRight,
  BadgeCheck, UserPlus, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { useDashboardLink } from "@/hooks/useDashboardLink";
import AppLogo from "@/components/AppLogo";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ── Mega menu data ─────────────────────────────────────────────────────────
const megaCategories = [
  { label: "Photographers",    icon: Camera,   slug: "photographer",       featured: true  },
  { label: "DJs",              icon: Disc3,    slug: "dj",                 featured: false },
  { label: "Live Bands",       icon: Music,    slug: "music_band",         featured: true  },
  { label: "Makeup Artists",   icon: Palette,  slug: "makeup_artist",      featured: false },
  { label: "Singers",          icon: Mic2,     slug: "singer",             featured: false },
  { label: "Choreographers",   icon: Users,    slug: "choreographer",      featured: false },
  { label: "Decorators",       icon: Wand2,    slug: "wedding_decorator",  featured: true  },
  { label: "Caterers",         icon: Utensils, slug: "catering_services",  featured: false },
  { label: "Mehendi Artists",  icon: Star,     slug: "mehendi_artist",     featured: false },
  { label: "Anchors / Emcees", icon: Mic2,     slug: "anchor",             featured: false },
  { label: "Magicians",        icon: Zap,      slug: "magician",           featured: false },
  { label: "Event Planners",   icon: CalendarDays, slug: "event_planner",  featured: false },
];

const popularCities = ["Hyderabad", "Mumbai", "Bangalore", "Delhi", "Chennai", "Pune"];

// ── Search suggestions (static — enhance with DB later) ───────────────────
const quickSuggestions = [
  "Wedding photographer Hyderabad",
  "DJ for birthday party",
  "Mehendi artist Mumbai",
  "Live band for reception",
  "Makeup artist Bangalore",
];

const Navbar = () => {
  const [isOpen,       setIsOpen]       = useState(false);
  const [isScrolled,   setIsScrolled]   = useState(false);
  const [megaOpen,     setMegaOpen]     = useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const { user, signOut, isProvider, rolesLoaded } = useAuth();
  const { dashboardLink } = useDashboardLink();
  const { cart }          = useCart();
  const navigate          = useNavigate();
  const location          = useLocation();

  const searchRef  = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const megaRef    = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  // ── Scroll shrink ──────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // ── Close menus on route change ────────────────────────────────────────
  useEffect(() => {
    setIsOpen(false);
    setMegaOpen(false);
    setSearchOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  // ── Outside click handler ──────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideSearch = searchRef.current?.contains(target) || mobileSearchRef.current?.contains(target);
      if (!insideSearch) setSearchOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Keyboard shortcut: Ctrl/Cmd+K → open search ───────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMegaOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  // ── Debounced live search ──────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const q = searchQuery.trim().toLowerCase();
        const { data: providers } = await supabase
          .from('provider_profiles')
          .select('id, user_id, profession, stage_name, average_rating, is_verified, bio')
          .in('verification_status', ['approved', 'verified'])
          .eq('is_published', true)
          .limit(8);

        if (!providers || providers.length === 0) {
          setSearchResults([]);
          setSearching(false);
          return;
        }

        const userIds = providers.map(p => p.user_id).filter(Boolean);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, city')
          .in('id', userIds);

        const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

        const results = providers.map(p => ({
          id: p.id,
          name: (profileMap.get(p.user_id) as any)?.full_name || p.stage_name || 'Artist',
          avatar: (profileMap.get(p.user_id) as any)?.avatar_url || null,
          city: (profileMap.get(p.user_id) as any)?.city || '',
          profession: p.profession,
          rating: p.average_rating || 0,
          verified: p.is_verified,
          bio: p.bio || '',
          stage_name: p.stage_name || '',
        })).filter(r =>
          r.name.toLowerCase().includes(q) ||
          r.profession.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.bio.toLowerCase().includes(q) ||
          r.stage_name.toLowerCase().includes(q) ||
          r.profession.replace(/_/g, ' ').toLowerCase().includes(q)
        );

        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/artists?search=${encodeURIComponent(q.trim())}`);
  }, [navigate]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch(searchQuery);
  };

  const navH = isScrolled ? "h-14" : "h-16 md:h-18";

  return (
    <>
      {/* ── Main nav ──────────────────────────────────────────────────── */}
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50",
          "transition-[background-color,box-shadow,backdrop-filter,border-color] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isScrolled
            ? "bg-[#FFFFFF] dark:bg-gray-950 backdrop-blur-[12px] border-b border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
            : "bg-white/70 dark:bg-gray-950/70 backdrop-blur-md border-b border-transparent shadow-none"
        )}
      >
        <div className="container">
          <div className={cn("flex items-center justify-between transition-all duration-300", navH)}>

            {/* ── Logo — role-aware Home navigation ───────────────────── */}
            <AppLogo size="lg" className="flex-shrink-0" />

            {/* ── Desktop nav links ────────────────────────────────────── */}
            <div className="hidden lg:flex items-center gap-2" ref={megaRef}>

              {/* Browse — mega menu trigger */}
              <div
                className="relative group"
                onMouseEnter={() => setMegaOpen(true)}
                onMouseLeave={() => setMegaOpen(false)}
              >
                <button
                  className={cn(
                    "relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-[15px] font-semibold tracking-[0.01em] transition-colors duration-250 ease-out",
                    megaOpen || isActive("/artists")
                      ? "text-maroon"
                      : "text-foreground/85 hover:text-maroon"
                  )}
                  aria-expanded={megaOpen}
                  aria-haspopup="true"
                >
                  Browse Artists
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", megaOpen && "rotate-180")} />
                  {/* Animated underline */}
                  <span className={cn(
                    "absolute left-4 right-4 -bottom-0.5 h-[2px] rounded-full bg-gradient-maroon origin-left transition-transform duration-250 ease-out",
                    megaOpen || isActive("/artists") ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  )} />
                </button>

                {/* Mega menu dropdown */}
                {megaOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-[640px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border/60 overflow-hidden animate-fade-in z-50">
                    <div className="p-5 grid grid-cols-3 gap-1">
                      {megaCategories.map(({ label, icon: Icon, slug, featured }) => (
                        <Link
                          key={slug}
                          to={`/artists?category=${slug}`}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors group",
                            featured
                              ? "text-foreground hover:bg-gold/8 hover:text-maroon"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                            featured ? "bg-gold/10 group-hover:bg-gold/20" : "bg-muted group-hover:bg-secondary"
                          )}>
                            <Icon className={cn("w-4 h-4", featured ? "text-gold-dark" : "text-muted-foreground group-hover:text-foreground")} />
                          </div>
                          <span className="font-medium">{label}</span>
                          {featured && (
                            <BadgeCheck className="w-3.5 h-3.5 text-gold ml-auto opacity-60" />
                          )}
                        </Link>
                      ))}
                    </div>

                    {/* Footer strip */}
                    <div className="px-5 py-3.5 bg-secondary/50 border-t border-border/40 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-medium">Popular cities:</span>
                        {popularCities.map(city => (
                          <Link
                            key={city}
                            to={`/artists?city=${city}`}
                            className="text-xs text-muted-foreground hover:text-maroon flex items-center gap-1 transition-colors"
                          >
                            <MapPin className="w-2.5 h-2.5" />{city}
                          </Link>
                        ))}
                      </div>
                      <Link
                        to="/artists"
                        className="flex items-center gap-1 text-xs font-semibold text-maroon hover:gap-1.5 transition-all"
                      >
                        View all <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Vowza AI Planner */}
              <Link
                to="/ai-planner"
                className={cn(
                  "group relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-[15px] font-semibold tracking-[0.01em] transition-colors duration-250 ease-out",
                  isActive("/ai-planner") ? "text-maroon" : "text-foreground/85 hover:text-maroon"
                )}
              >
                <Sparkles className="w-3.5 h-3.5 text-gold" />
                Vowza AI Planner
                <span className={cn(
                  "absolute left-4 right-4 -bottom-0.5 h-[2px] rounded-full bg-gradient-gold origin-left transition-transform duration-250 ease-out",
                  isActive("/ai-planner") ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                )} />
              </Link>

              {/* How it works */}
              <a
                href="/#how-it-works"
                className="group relative px-4 py-2 rounded-lg text-[15px] font-semibold tracking-[0.01em] text-foreground/85 hover:text-maroon transition-colors duration-250 ease-out"
              >
                How it works
                <span className="absolute left-4 right-4 -bottom-0.5 h-[2px] rounded-full bg-gradient-maroon origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-250 ease-out" />
              </a>

              {user && (
                <Link
                  to="/my-bookings"
                  className={cn(
                    "group relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-[15px] font-semibold tracking-[0.01em] transition-colors duration-250 ease-out",
                    isActive("/my-bookings") ? "text-maroon" : "text-foreground/85 hover:text-maroon"
                  )}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  My Bookings
                  <span className={cn(
                    "absolute left-4 right-4 -bottom-0.5 h-[2px] rounded-full bg-gradient-maroon origin-left transition-transform duration-250 ease-out",
                    isActive("/my-bookings") ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  )} />
                </Link>
              )}
            </div>

            {/* ── Desktop actions ──────────────────────────────────────── */}
            <div className="hidden lg:flex items-center gap-1">

              {/* Search trigger */}
              <div className="relative" ref={searchRef}>
                <button
                  onClick={() => { setSearchOpen(!searchOpen); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-secondary/40 hover:bg-secondary transition-colors duration-250 ease-out text-foreground/70 hover:text-maroon text-sm"
                  aria-label="Search"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline text-xs font-medium">Search artists…</span>
                  <kbd className="hidden xl:inline ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-gray-800 border border-border rounded text-muted-foreground">⌘K</kbd>
                </button>

                {/* Search dropdown */}
                {searchOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[380px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border/60 overflow-hidden animate-scale-in z-50">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
                      <Search className="w-4 h-4 text-foreground/60 flex-shrink-0" />
                      <input
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Search artists, categories, cities…"
                        className="flex-1 text-sm font-medium bg-transparent text-foreground placeholder:text-foreground/50 placeholder:font-normal focus:outline-none focus:placeholder:text-foreground/65 transition-colors duration-250"
                        autoComplete="off"
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="p-3 max-h-[400px] overflow-y-auto">
                      {/* Loading spinner */}
                      {searching && (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      )}

                      {/* Live search results */}
                      {!searching && searchQuery.length >= 2 && searchResults.length > 0 && (
                        <>
                          <p className="text-xs text-muted-foreground font-medium px-2 mb-2 uppercase tracking-wide">Results</p>
                          {searchResults.map(r => (
                            <button
                              key={r.id}
                              onClick={() => { navigate(`/artist/${r.id}`); setSearchOpen(false); setSearchQuery(''); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors text-left"
                            >
                              <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">{r.name.charAt(0)}</div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
                                  {r.verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="capitalize">{r.profession.replace(/_/g, ' ')}</span>
                                  {r.city && <><span>·</span><span>{r.city}</span></>}
                                  {r.rating > 0 && <><span>·</span><span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{r.rating.toFixed(1)}</span></>}
                                </div>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            </button>
                          ))}
                        </>
                      )}

                      {/* No results state */}
                      {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                        <div className="py-6 text-center">
                          <p className="text-sm text-muted-foreground mb-1">No artists found for "{searchQuery}"</p>
                          <p className="text-xs text-muted-foreground">Try a different keyword or <button onClick={() => { navigate('/artists'); setSearchOpen(false); setSearchQuery(''); }} className="text-maroon font-medium hover:underline">browse all artists</button></p>
                        </div>
                      )}

                      {/* Quick searches — shown only when no active search */}
                      {(!searchQuery || searchQuery.length < 2) && (
                        <>
                          <p className="text-xs text-muted-foreground font-medium px-2 mb-2 uppercase tracking-wide">Quick searches</p>
                          {quickSuggestions.map(s => (
                            <button
                              key={s}
                              onClick={() => handleSearch(s)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-left"
                            >
                              <Search className="w-3.5 h-3.5 flex-shrink-0" />
                              {s}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                    <div className="px-4 py-2.5 border-t border-border/40">
                      <button
                        onClick={() => handleSearch(searchQuery || "all")}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-secondary text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        Browse all artists <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {user ? (
                <>
                  {/* Cart */}
                  <motion.button
                    whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
                    onClick={() => navigate("/cart")}
                    className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Cart"
                  >
                    <ShoppingBag className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                    {cart.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-maroon text-white text-[10px] font-bold flex items-center justify-center">
                        {cart.length}
                      </span>
                    )}
                  </motion.button>

                  {/* Wishlist */}
                  <motion.button
                    whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
                    onClick={() => navigate("/artists?saved=true")}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Saved"
                  >
                    <Heart className="w-[18px] h-[18px]" />
                  </motion.button>

                  {/* Notifications */}
                  <NotificationBell />

                  {/* Profile dropdown */}
                  <div className="relative" ref={profileRef}>
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                      onClick={() => setProfileOpen(!profileOpen)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all",
                        profileOpen
                          ? "border-border bg-secondary"
                          : "border-transparent hover:border-border hover:bg-secondary/60"
                      )}
                    >
                      <div className="w-7 h-7 rounded-lg bg-gradient-maroon flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-white" />
                      </div>
                      <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", profileOpen && "rotate-180")} />
                    </motion.button>

                    {profileOpen && (
                      <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border/60 overflow-hidden animate-scale-in z-50">
                        <div className="px-4 py-3 border-b border-border/40">
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <div className="p-2">
                          <Link to={dashboardLink} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors">
                            <LayoutDashboard className="w-4 h-4 text-muted-foreground" /> Dashboard
                          </Link>
                          <Link to="/my-bookings" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors">
                            <BookOpen className="w-4 h-4 text-muted-foreground" /> My Bookings
                          </Link>
                          <Link to="/artists?saved=true" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors">
                            <Heart className="w-4 h-4 text-muted-foreground" /> Saved Artists
                          </Link>
                          {/* Show "Become an Artist" only for non-providers */}
                          {rolesLoaded && !isProvider && (
                            <Link to="/provider/register" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors">
                              <UserPlus className="w-4 h-4 text-gold-dark" /> Become an Artist
                            </Link>
                          )}
                        </div>
                        <div className="p-2 border-t border-border/40">
                          <button
                            onClick={() => signOut()}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/5 transition-colors"
                          >
                            <LogOut className="w-4 h-4" /> Sign out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link to="/auth">
                  <button className="px-4 py-2 rounded-lg text-[15px] font-semibold text-foreground/85 hover:text-maroon hover:bg-secondary transition-colors duration-250 ease-out">
                    Sign in
                  </button>
                </Link>
              )}
            </div>

            {/* ── Mobile: search + hamburger ───────────────────────────── */}
            <div className="flex items-center gap-1 lg:hidden">
              <button
                onClick={() => { setSearchOpen(!searchOpen); setTimeout(() => mobileSearchInputRef.current?.focus(), 50); }}
                className="min-w-11 min-h-11 p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
              {user && (
                <button
                  onClick={() => navigate("/cart")}
                  className="relative min-w-11 min-h-11 p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <ShoppingBag className="w-5 h-5" />
                  {cart.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-maroon text-white text-[10px] font-bold flex items-center justify-center">
                      {cart.length}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="min-w-11 min-h-11 p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
                aria-label="Toggle menu"
                aria-expanded={isOpen}
              >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* ── Mobile search bar (slides in) ──────────────────────────── */}
          {searchOpen && (
            <div className="lg:hidden pb-3 animate-fade-down" ref={mobileSearchRef}>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary border border-border/60">
                <Search className="w-4 h-4 text-foreground/60 flex-shrink-0" />
                <input
                  ref={mobileSearchInputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search artists, categories, cities…"
                  className="flex-1 text-sm font-medium bg-transparent text-foreground placeholder:text-foreground/50 placeholder:font-normal focus:outline-none focus:placeholder:text-foreground/65 transition-colors duration-250"
                  autoComplete="off"
                />
                {searchQuery
                  ? <button onClick={() => setSearchQuery("")}><X className="w-4 h-4 text-muted-foreground" /></button>
                  : <button onClick={() => setSearchOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                }
              </div>
            </div>
          )}
        </div>

        {/* ── Mobile menu ───────────────────────────────────────────────── */}
        {isOpen && (
          <div className="lg:hidden border-t border-border/40 bg-white dark:bg-gray-950 animate-fade-down">
            <div
              className="container py-4 space-y-1"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
            >
          {/* Vowza AI Planner highlight */}
              <Link
                to="/ai-planner"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-gold/10 to-maroon/5 border border-gold/20 text-sm font-semibold text-foreground hover:from-gold/15 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-gold flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Vowza AI Planner</p>
                  <p className="text-xs text-muted-foreground">Plan your full event with AI</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </Link>

              <div className="h-px bg-border my-2" />

              <p className="text-2xs text-muted-foreground font-semibold uppercase tracking-wider px-4 py-1">Categories</p>
              {megaCategories.slice(0, 8).map(({ label, icon: Icon, slug }) => (
                <Link
                  key={slug}
                  to={`/artists?category=${slug}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </Link>
              ))}
              <Link to="/artists" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-maroon hover:bg-secondary rounded-xl transition-colors">
                <ArrowRight className="w-4 h-4" /> View all categories
              </Link>

              <div className="h-px bg-border my-2" />

              <a href="/#how-it-works" className="block px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                How it works
              </a>

              {user ? (
                <>
                  <Link to="/my-bookings"  className="flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><BookOpen className="w-4 h-4" /> My Bookings</Link>
                  <Link to={dashboardLink} className="flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><LayoutDashboard className="w-4 h-4" /> Dashboard</Link>
                  {rolesLoaded && !isProvider && (
                    <Link to="/provider/register" className="flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      <UserPlus className="w-4 h-4" /> Become an Artist
                    </Link>
                  )}
                  <div className="h-px bg-border my-2" />
                  <button onClick={() => signOut()} className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm text-destructive hover:bg-destructive/5 transition-colors">
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </>
              ) : (
                <div className="pt-2">
                  <Link to="/auth">
                    <button className="w-full px-4 py-3 min-h-[44px] rounded-xl text-sm font-semibold border border-border text-foreground hover:text-maroon hover:border-maroon/30 hover:bg-secondary transition-colors duration-250 ease-out">
                      Sign in
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ── Backdrop for mega/search on mobile ────────────────────────────── */}
      {(megaOpen || searchOpen || isOpen) && (
        <div
          className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-sm lg:hidden"
          onClick={() => { setMegaOpen(false); setSearchOpen(false); setIsOpen(false); }}
        />
      )}
    </>
  );
};

export default Navbar;
