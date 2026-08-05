// ─── Artists Page — Corporate Premium Edition ────────────────────────────────
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Search, SlidersHorizontal, X, MapPin, Star, Clock,
  IndianRupee, BadgeCheck, Zap, Heart, ChevronDown,
  LayoutGrid, List, ArrowRight, Filter,
} from "lucide-react";
import { useArtists, useCategories, type ArtistFilters, type Artist } from "@/hooks/useArtists";
import { toast } from "sonner";

const cities = ["Hyderabad","Bangalore","Mumbai","Delhi","Chennai","Pune","Kolkata","Ahmedabad","Jaipur","Lucknow","Kochi","Indore","Nagpur","Vizag","Vijayawada"];
const budgets = [
  { label: "Under ₹15K",    value: "0-15000" },
  { label: "₹15K – ₹30K",  value: "15000-30000" },
  { label: "₹30K – ₹60K",  value: "30000-60000" },
  { label: "₹60K – ₹1L",   value: "60000-100000" },
  { label: "Above ₹1L",     value: "100000-9999999" },
];
const ratings   = ["4.5","4","3.5","3"];
const languages = ["Hindi","English","Telugu","Tamil","Kannada","Marathi","Bengali"];

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n/100000).toFixed(1)}L` :
  n >= 1000   ? `₹${(n/1000).toFixed(0)}K`   : `₹${n}`;

// ── Artist Card ───────────────────────────────────────────────────────────────
const ArtistCard = ({ artist, view }: { artist: Artist; view: "grid" | "list" }) => {
  const navigate = useNavigate();

  if (view === "list") {
    return (
      <button
        onClick={() => navigate(`/artist/${artist.id}`)}
        className="group w-full text-left flex gap-5 p-5 rounded-2xl bg-surface-1 border border-border/60
                   hover:border-gold/25 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
      >
        {/* Image */}
        <div className="relative w-32 h-28 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
          <img
            src={artist.cover_image_url || artist.avatar_url || "/placeholder.svg"}
            alt={artist.full_name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {artist.is_available && (
            <span className="absolute bottom-2 left-2 text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
              Available
            </span>
          )}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="font-semibold text-sm text-foreground group-hover:text-maroon transition-colors truncate">
                {artist.full_name}
              </h3>
              <p className="text-xs text-muted-foreground">{artist.category_name}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {artist.is_verified && <BadgeCheck className="w-4 h-4 text-emerald-500" />}
              {artist.instant_booking && <Zap className="w-3.5 h-3.5 text-violet-500" />}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{artist.city || "India"}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{artist.experience_years} yrs</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{artist.average_rating.toFixed(1)} ({artist.total_reviews})</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground">Starting from </span>
              <span className="text-sm font-bold text-foreground">{artist.price_min > 0 ? fmt(artist.price_min) : "On Request"}</span>
            </div>
            <span className="text-xs font-semibold text-maroon flex items-center gap-1 group-hover:gap-1.5 transition-all">
              View Profile <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate(`/artist/${artist.id}`)}
      className="group text-left rounded-2xl overflow-hidden bg-surface-1 border border-border/60
                 hover:border-gold/25 hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5"
    >
      {/* Image */}
      <div className="relative h-52 bg-muted overflow-hidden">
        <img
          src={artist.cover_image_url || artist.avatar_url || "/placeholder.svg"}
          alt={artist.full_name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-600"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {artist.is_verified    && <span className="badge-verified">  <BadgeCheck className="w-3 h-3" />Verified</span>}
          {artist.is_featured    && <span className="badge-featured">  ⭐ Featured</span>}
          {artist.instant_booking && <span className="badge-instant"><Zap className="w-3 h-3" />Instant</span>}
        </div>
        {/* Rating */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-lg">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs font-bold text-white">{artist.average_rating.toFixed(1)}</span>
          <span className="text-[10px] text-white/65">({artist.total_reviews})</span>
        </div>
        {/* Wishlist */}
        <button
          onClick={e => e.stopPropagation()}
          className="absolute top-3 right-3 w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Heart className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-sm text-foreground group-hover:text-maroon transition-colors truncate mb-0.5">
          {artist.stage_name || artist.full_name}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">{artist.category_name}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{artist.city || "India"}</span>
          {artist.experience_years > 0 && <span>{artist.experience_years} yrs exp</span>}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div>
            <p className="text-[10px] text-muted-foreground">Starting from</p>
            <p className="text-sm font-bold text-foreground">{artist.price_min > 0 ? fmt(artist.price_min) : "On Request"}</p>
          </div>
          {artist.is_available
            ? <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Available</span>
            : <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Busy</span>
          }
        </div>
      </div>
    </button>
  );
};

// ── Sidebar filter block ───────────────────────────────────────────────────────
const FilterBlock = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/50 pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const Artists = () => {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();
  const categoryParam   = searchParams.get("category") || "";

  const [search,      setSearch]      = useState(searchParams.get("search") || "");
  const [city,        setCity]        = useState(searchParams.get("city")   || "");
  const [budget,      setBudget]      = useState("");
  const [rating,      setRating]      = useState("");
  const [experience,  setExperience]  = useState("");
  const [language,    setLanguage]    = useState("");
  const [sortBy,      setSortBy]      = useState<ArtistFilters["sortBy"]>("rating");
  const [verified,    setVerified]    = useState(false);
  const [featured,    setFeatured]    = useState(false);
  const [available,   setAvailable]   = useState(false);
  const [view,        setView]        = useState<"grid" | "list">("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filters: ArtistFilters = {
    category:   categoryParam || undefined,
    search:     search        || undefined,
    city:       city          || undefined,
    budgetMin:  budget ? parseInt(budget.split("-")[0]) : undefined,
    budgetMax:  budget ? parseInt(budget.split("-")[1]) : undefined,
    rating:     rating     ? parseFloat(rating)    : undefined,
    experience: experience ? parseInt(experience)  : undefined,
    language:   language   || undefined,
    sortBy,
    verified:  verified  || undefined,
    featured:  featured  || undefined,
    available: available || undefined,
  };

  const { data: artists = [], isLoading, error } = useArtists(filters);
  const { data: categories = [] } = useCategories();

  if (error) toast.error("Failed to load artists");

  const clearAll = () => {
    setSearch(""); setCity(""); setBudget(""); setRating("");
    setExperience(""); setLanguage(""); setSortBy("rating");
    setVerified(false); setFeatured(false); setAvailable(false);
  };

  const activeFilterCount = [city, budget, rating, experience, language, verified, featured, available].filter(Boolean).length;

  const categoryLabel = categoryParam
    ? (categories.find((c: any) => c.profession_type === categoryParam || c.id === categoryParam) as any)?.name || categoryParam
    : "All Artists";

  // ── Sidebar content (shared desktop + mobile) ──────────────────────────────
  const SidebarContent = () => (
    <div className="space-y-0">
      {/* Category */}
      <FilterBlock title="Category">
        <div className="space-y-1">
          <button
            onClick={() => navigate("/artists")}
            className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors", !categoryParam ? "bg-maroon/8 text-maroon" : "text-muted-foreground hover:bg-secondary")}
          >
            All Categories
          </button>
          {(categories as any[]).slice(0, 12).map((c: any) => (
            <button
              key={c.id}
              onClick={() => navigate(`/artists?category=${c.profession_type || c.id}`)}
              className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between",
                categoryParam === (c.profession_type || c.id) ? "bg-maroon/8 text-maroon" : "text-muted-foreground hover:bg-secondary")}
            >
              <span>{c.name}</span>
              {c.provider_count > 0 && <span className="text-[10px] text-muted-foreground">{c.provider_count}</span>}
            </button>
          ))}
        </div>
      </FilterBlock>

      {/* City */}
      <FilterBlock title="City">
        <div className="grid grid-cols-2 gap-1">
          {cities.slice(0, 10).map(c => (
            <button
              key={c}
              onClick={() => setCity(city === c ? "" : c)}
              className={cn("px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors text-left",
                city === c ? "bg-maroon/8 text-maroon" : "text-muted-foreground hover:bg-secondary")}
            >
              {c}
            </button>
          ))}
        </div>
      </FilterBlock>

      {/* Budget */}
      <FilterBlock title="Budget">
        <div className="space-y-1">
          {budgets.map(b => (
            <button
              key={b.value}
              onClick={() => setBudget(budget === b.value ? "" : b.value)}
              className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                budget === b.value ? "bg-maroon/8 text-maroon" : "text-muted-foreground hover:bg-secondary")}
            >
              {b.label}
            </button>
          ))}
        </div>
      </FilterBlock>

      {/* Rating */}
      <FilterBlock title="Minimum Rating" defaultOpen={false}>
        <div className="space-y-1">
          {ratings.map(r => (
            <button
              key={r}
              onClick={() => setRating(rating === r ? "" : r)}
              className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2",
                rating === r ? "bg-maroon/8 text-maroon" : "text-muted-foreground hover:bg-secondary")}
            >
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> {r}+ Stars
            </button>
          ))}
        </div>
      </FilterBlock>

      {/* Language */}
      <FilterBlock title="Language" defaultOpen={false}>
        <div className="flex flex-wrap gap-1.5">
          {languages.map(l => (
            <button
              key={l}
              onClick={() => setLanguage(language === l ? "" : l)}
              className={cn("px-3 py-1 rounded-full text-[11px] font-medium border transition-colors",
                language === l ? "bg-maroon/8 text-maroon border-maroon/30" : "border-border text-muted-foreground hover:border-border/80")}
            >
              {l}
            </button>
          ))}
        </div>
      </FilterBlock>

      {/* Quick toggles */}
      <FilterBlock title="Quick Filters" defaultOpen={false}>
        <div className="space-y-2">
          {[
            { label: "Verified Only",   val: verified,  set: setVerified  },
            { label: "Featured Only",   val: featured,  set: setFeatured  },
            { label: "Available Now",   val: available, set: setAvailable },
          ].map(({ label, val, set }) => (
            <label key={label} className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => set(!val)}
                className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  val ? "bg-maroon border-maroon" : "border-border")}
              >
                {val && <span className="text-white text-[10px] font-bold">✓</span>}
              </div>
              <span className="text-xs font-medium text-foreground">{label}</span>
            </label>
          ))}
        </div>
      </FilterBlock>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="pt-16 md:pt-18 bg-surface-2 border-b border-border/50">
        <div className="container px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Marketplace</p>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">{categoryLabel}</h1>
              {!isLoading && (
                <p className="text-muted-foreground text-sm mt-1">
                  {artists.length} verified professional{artists.length !== 1 ? "s" : ""} found
                </p>
              )}
            </div>
            {/* Sort + view toggle */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as ArtistFilters["sortBy"])}
                className="input-premium text-sm py-2 px-3 w-auto"
              >
                <option value="rating">Best Rated</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="experience">Most Experienced</option>
                <option value="newest">Newest</option>
              </select>
              <button onClick={() => setView("grid")} className={cn("p-2 rounded-lg border transition-colors", view === "grid" ? "bg-maroon text-white border-maroon" : "border-border text-muted-foreground hover:bg-secondary")}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setView("list")} className={cn("p-2 rounded-lg border transition-colors", view === "list" ? "bg-maroon text-white border-maroon" : "border-border text-muted-foreground hover:bg-secondary")}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="container px-4 py-8">
        <div className="flex gap-8">

          {/* ── Desktop Sidebar ──────────────────────────────────────── */}
          <aside className="hidden lg:block w-60 xl:w-64 flex-shrink-0">
            {/* Search */}
            <div className="relative mb-5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search artists…"
                className="input-premium pl-9 py-2.5 text-sm"
              />
            </div>

            <div className="bg-surface-1 rounded-2xl border border-border/60 p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Filter className="w-3 h-3" /> Filters
                </span>
                {activeFilterCount > 0 && (
                  <button onClick={clearAll} className="text-[11px] font-semibold text-maroon flex items-center gap-1 hover:opacity-75">
                    <X className="w-3 h-3" /> Clear ({activeFilterCount})
                  </button>
                )}
              </div>
              <SidebarContent />
            </div>
          </aside>

          {/* ── Main content ─────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">

            {/* Mobile filter bar */}
            <div className="flex items-center gap-2 mb-5 lg:hidden">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search artists…"
                  className="input-premium pl-9 py-2.5 text-sm w-full"
                />
              </div>
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors flex-shrink-0"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters {activeFilterCount > 0 && <span className="w-5 h-5 rounded-full bg-maroon text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>}
              </button>
            </div>

            {/* Loading */}
            {isLoading ? (
              <div className={cn("grid gap-4", view === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={cn("rounded-2xl skeleton", view === "grid" ? "h-72" : "h-28")} />
                ))}
              </div>
            ) : artists.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-5">🎭</div>
                <h3 className="text-xl font-display font-semibold text-foreground mb-2">No Artists Found</h3>
                <p className="text-muted-foreground text-sm mb-6">Try adjusting your filters or search terms</p>
                <button onClick={clearAll} className="btn-primary">Clear All Filters</button>
              </div>
            ) : (
              <div className={cn("grid gap-4", view === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
                {artists.map((a: Artist, i: number) => (
                  <div key={a.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
                    <ArtistCard artist={a} view={view} />
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Mobile sidebar drawer ─────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-background shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-semibold text-sm">Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {activeFilterCount > 0 && (
                <button onClick={clearAll} className="w-full mb-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-1.5">
                  <X className="w-3.5 h-3.5" /> Clear all filters
                </button>
              )}
              <SidebarContent />
            </div>
            <div className="p-4 border-t border-border sticky bottom-0 bg-background">
              <button onClick={() => setSidebarOpen(false)} className="btn-primary w-full justify-center">
                Show {artists.length} artists
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Artists;
