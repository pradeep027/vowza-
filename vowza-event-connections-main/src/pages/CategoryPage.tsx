// ─── CategoryPage — Dynamic marketplace page for every category ───────────────
import { useState, useEffect, useCallback, memo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_MAP, type CategoryDef } from "@/data/categoryConfig";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search, SlidersHorizontal, MapPin, Star, Clock,
  BadgeCheck, Zap, Heart, ChevronLeft, ChevronRight,
  X, ArrowRight, Filter,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Vendor {
  id: string; user_id: string; profession: string; subcategory: string | null;
  stage_name: string | null; bio: string | null; experience_years: number | null;
  price_min: number | null; price_max: number | null;
  is_verified: boolean | null; is_available: boolean | null;
  is_featured: boolean | null; instant_booking: boolean | null;
  average_rating: number | null; total_reviews: number | null;
  total_bookings: number | null; verification_status: string | null;
  cover_image_url: string | null;
  // joined from profiles
  full_name: string; avatar_url: string | null; city: string | null;
}

const PAGE_SIZE = 12;
const fmt = (n: number) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(0)}K` : `₹${n}`;

// ── VendorCard — module scope ─────────────────────────────────────────────────
const VendorCard = memo(({ vendor, onClick }: { vendor: Vendor; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group text-left rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a24]
               border border-border/60 hover:border-gold/25 hover:shadow-xl
               transition-all duration-300 hover:-translate-y-1.5 w-full"
  >
    {/* Image */}
    <div className="relative h-48 bg-muted overflow-hidden">
      <img
        src={vendor.cover_image_url || vendor.avatar_url || "/placeholder.svg"}
        alt={vendor.full_name}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-600"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

      {/* Badges */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
        {vendor.is_verified && (
          <span className="badge-verified text-[10px]">
            <BadgeCheck className="w-3 h-3" /> Verified
          </span>
        )}
        {vendor.is_featured && (
          <span className="badge-featured text-[10px]">⭐ Featured</span>
        )}
        {vendor.instant_booking && (
          <span className="badge-instant text-[10px]">
            <Zap className="w-3 h-3" /> Instant
          </span>
        )}
      </div>

      {/* Rating */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg">
        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
        <span className="text-xs font-bold text-white">{(vendor.average_rating ?? 0).toFixed(1)}</span>
        <span className="text-[10px] text-white/65">({vendor.total_reviews ?? 0})</span>
      </div>

      {/* Wishlist */}
      <button
        type="button"
        onClick={e => e.stopPropagation()}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm
                   flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Save"
      >
        <Heart className="w-3.5 h-3.5 text-white" />
      </button>
    </div>

    {/* Info */}
    <div className="p-4">
      <h3 className="font-semibold text-sm text-foreground group-hover:text-maroon transition-colors truncate mb-0.5">
        {vendor.stage_name || vendor.full_name}
      </h3>
      {vendor.subcategory && (
        <p className="text-[11px] text-muted-foreground mb-2">{vendor.subcategory}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        {vendor.city && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />{vendor.city}
          </span>
        )}
        {(vendor.experience_years ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />{vendor.experience_years} yrs
          </span>
        )}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div>
          <p className="text-[10px] text-muted-foreground">Starting from</p>
          <p className="text-sm font-bold text-foreground">
            {vendor.price_min ? fmt(vendor.price_min) : "On Request"}
          </p>
        </div>
        {vendor.is_available ? (
          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
            Available
          </span>
        ) : (
          <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            Busy
          </span>
        )}
      </div>
    </div>
  </button>
));
VendorCard.displayName = "VendorCard";

// ── Skeleton ──────────────────────────────────────────────────────────────────
const VendorSkeleton = () => (
  <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a24] border border-border/60">
    <div className="skeleton h-48 w-full" />
    <div className="p-4 space-y-2">
      <div className="skeleton h-4 w-3/4 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="skeleton h-3 w-1/3 rounded" />
    </div>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const category: CategoryDef | undefined = CATEGORY_MAP.get(slug ?? "");

  const [vendors,      setVendors]      = useState<Vendor[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(0);
  const [search,       setSearch]       = useState(searchParams.get("search") ?? "");
  const [city,         setCity]         = useState(searchParams.get("city") ?? "");
  const [subcat,       setSubcat]       = useState("all");
  const [sortBy,       setSortBy]       = useState<"rating" | "price-low" | "price-high" | "newest">("rating");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  const load = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    try {
      let q = supabase
        .from("provider_profiles")
        .select("*", { count: "exact" })
        .in("profession", category.professionTypes)
        .eq("verification_status", "approved")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (subcat !== "all") q = q.eq("subcategory", subcat);
      if (verifiedOnly)     q = q.eq("is_verified", true);

      if (sortBy === "rating")     q = q.order("average_rating", { ascending: false });
      else if (sortBy === "price-low")  q = q.order("price_min",  { ascending: true  });
      else if (sortBy === "price-high") q = q.order("price_min",  { ascending: false });
      else q = q.order("created_at", { ascending: false });

      const { data, count, error } = await q;
      if (error) throw error;

      // Fetch profiles for all vendors
      const userIds = (data ?? []).map((v: any) => v.user_id).filter(Boolean);
      let profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, city")
          .in("id", userIds);
        profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      }

      let merged: Vendor[] = (data ?? []).map((v: any) => {
        const p = profileMap.get(v.user_id) ?? {};
        return { ...v, full_name: p.full_name ?? "Unknown", avatar_url: p.avatar_url ?? null, city: v.city ?? p.city ?? null };
      });

      // Client-side search/city filter
      if (search.trim()) {
        const q = search.toLowerCase();
        merged = merged.filter(v =>
          v.full_name?.toLowerCase().includes(q) ||
          v.stage_name?.toLowerCase().includes(q) ||
          v.subcategory?.toLowerCase().includes(q)
        );
      }
      if (city.trim()) {
        const c = city.toLowerCase();
        merged = merged.filter(v => v.city?.toLowerCase().includes(c));
      }

      setVendors(merged);
      setTotal(count ?? 0);
    } catch (e: any) {
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [category, page, subcat, sortBy, verifiedOnly, search, city]);

  useEffect(() => { load(); }, [load]);

  if (!category) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-semibold mb-2">Category not found</p>
        <button onClick={() => navigate("/")} className="btn-primary">Go Home</button>
      </div>
    </div>
  );

  const Icon = category.icon;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Banner ── */}
      <div
        className="relative h-56 md:h-72 overflow-hidden flex items-end"
        style={{ background: category.gradient }}
      >
        <div className="absolute inset-0 bg-black/30" />
        <div className="container px-4 pb-8 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Category</p>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white">{category.plural}</h1>
              <p className="text-white/65 text-sm mt-1">{total > 0 ? `${total} verified professionals` : "Find the best professionals"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 py-8">
        <div className="flex gap-7">

          {/* ── Desktop sidebar ── */}
          <aside className="hidden lg:block w-56 flex-shrink-0 space-y-5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors…" className="input-premium pl-9 py-2.5 text-sm w-full" />
            </div>
            {/* City */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="City or district…" className="input-premium pl-9 py-2.5 text-sm w-full" />
            </div>

            {/* Subcategories */}
            <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Subcategory</p>
              <div className="space-y-1">
                <button onClick={() => setSubcat("all")} className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors", subcat === "all" ? "bg-maroon/8 text-maroon" : "text-muted-foreground hover:bg-secondary")}>
                  All {category.plural}
                </button>
                {category.subcategories.map(s => (
                  <button key={s} onClick={() => setSubcat(s)} className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors", subcat === s ? "bg-maroon/8 text-maroon" : "text-muted-foreground hover:bg-secondary")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Verified toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer px-1">
              <div onClick={() => setVerifiedOnly(!verifiedOnly)} className={cn("w-5 h-5 rounded border flex items-center justify-center transition-colors", verifiedOnly ? "bg-maroon border-maroon" : "border-border")}>
                {verifiedOnly && <span className="text-white text-[10px] font-bold">✓</span>}
              </div>
              <span className="text-xs font-medium text-foreground">Verified Only</span>
            </label>
          </aside>

          {/* ── Main ── */}
          <main className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors…" className="input-premium pl-9 py-2.5 text-sm w-full lg:hidden" />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input-premium text-sm py-2 px-3 w-auto">
                  <option value="rating">Best Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="newest">Newest</option>
                </select>
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">
                  <Filter className="w-4 h-4" /> Filters
                </button>
              </div>
            </div>

            {/* Subcategory chips (scrollable) */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
              <button onClick={() => setSubcat("all")} className={cn("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors", subcat === "all" ? "bg-maroon text-white border-maroon" : "border-border text-muted-foreground hover:border-maroon/30")}>
                All
              </button>
              {category.subcategories.map(s => (
                <button key={s} onClick={() => setSubcat(s)} className={cn("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors", subcat === s ? "bg-maroon text-white border-maroon" : "border-border text-muted-foreground hover:border-maroon/30")}>
                  {s}
                </button>
              ))}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <VendorSkeleton key={i} />)}
              </div>
            ) : vendors.length === 0 ? (
              <div className="text-center py-20">
                <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                <h3 className="text-lg font-display font-semibold text-foreground mb-2">No {category.plural} Found</h3>
                <p className="text-muted-foreground text-sm mb-6">Be the first to register as a {category.name} on Vowza</p>
                <button onClick={() => navigate("/provider/register")} className="btn-primary">Join as {category.name}</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {vendors.map((v, i) => (
                  <div key={v.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
                    <VendorCard vendor={v} onClick={() => navigate(`/artist/${v.id}`)} />
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/60">
                <p className="text-xs text-muted-foreground">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</p>
                <div className="flex gap-1">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-background shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-semibold text-sm">Filters</span>
              <button onClick={() => setSidebarOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="City or district…" className="input-premium text-sm w-full" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Subcategory</p>
                <div className="space-y-1">
                  {["all", ...category.subcategories].map(s => (
                    <button key={s} onClick={() => { setSubcat(s); setSidebarOpen(false); }} className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-medium", subcat === s ? "bg-maroon/8 text-maroon" : "text-muted-foreground hover:bg-secondary")}>
                      {s === "all" ? `All ${category.plural}` : s}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div onClick={() => setVerifiedOnly(!verifiedOnly)} className={cn("w-5 h-5 rounded border flex items-center justify-center", verifiedOnly ? "bg-maroon border-maroon" : "border-border")}>
                  {verifiedOnly && <span className="text-white text-[10px] font-bold">✓</span>}
                </div>
                <span className="text-xs font-medium">Verified Only</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
