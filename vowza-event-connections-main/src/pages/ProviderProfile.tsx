// ─── ProviderProfile — Enhanced with category-specific fields ────────────────
import { useState, useEffect, memo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, MapPin, Star, Clock, CheckCircle, User,
  Sparkles, Share2, MessageCircle, Phone, Mail, Globe,
  Instagram, Facebook, Youtube, Heart, Flag,
  Shield, TrendingUp, BadgeCheck, Zap, Users, X,
  ChevronDown, ChevronUp, Package, UtensilsCrossed,
  Landmark, Video as VideoIcon, Image as ImageIcon,
} from "lucide-react";
import BookingModal from "@/components/BookingModal";
import AppLogo from "@/components/AppLogo";
import { useAvailability, useArtists } from "@/hooks/useArtists";
import { trackProfileView } from "@/hooks/useVendorData";
import { getCategoryByProfession } from "@/data/categoryConfig";
import { isPhotographer, isWaterSupplier } from "@/lib/providerCategory";
import WaterSupplierMenu from "@/components/WaterSupplierMenu";
import PhotographerPackages from "@/components/PhotographerPackages";

const fmt = (n: number) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(0)}K` : `₹${n}`;

const professionLabels: Record<string, string> = {
  normal_band:"Music Band", maharashtra_band:"Maharashtra Band", musician:"Musician",
  dj:"DJ", photographer:"Photographer", videographer:"Videographer",
  decorator:"Event Decorator", kuchipudi_dancer:"Kuchipudi Dancer",
  classical_dancer:"Classical Dancer", western_dancer:"Western Dancer",
  event_support:"Event Support", music_band:"Music Band",
  traditional_band:"Traditional Band", singer:"Singer",
  instrumental_artist:"Instrumental Artist", classical_musician:"Classical Musician",
  cinematographer:"Cinematographer", drone_operator:"Drone Operator",
  dancer:"Dancer", choreographer:"Choreographer", wedding_decorator:"Decorator",
  stage_decorator:"Stage Decorator", event_decorator:"Event Decorator",
  makeup_artist:"Makeup Artist", mehendi_artist:"Mehendi Artist",
  anchor:"Anchor / Emcee", host:"Host / Presenter", magician:"Magician",
  stand_up_comedian:"Stand-up Comedian", celebrity_artist:"Celebrity Artist",
  live_performer:"Live Performer", folk_artist:"Folk Artist",
  lighting_services:"Lighting Services", sound_services:"Sound Engineer",
  event_planner:"Event Planner", wedding_planner:"Wedding Planner",
  catering_services:"Catering Services", event_support_staff:"Event Support",
  banquet_hall:"Banquet Hall", pandit:"Pandit / Priest",
  water_supplier:"Drinking Water Supplier", rentals:"Rental Services",
};

// Star rating row
const StarRow = memo(({ rating, onChange }: { rating: number; onChange: (n: number) => void }) => (
  <div className="flex items-center gap-1">
    {[1,2,3,4,5].map(i => (
      <button key={i} type="button" onClick={() => onChange(i)}>
        <Star className={cn("w-6 h-6 transition-colors", i <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200 hover:text-yellow-300")} />
      </button>
    ))}
  </div>
));
StarRow.displayName = "StarRow";

// Category-specific detail renderer
const CategoryDetails = memo(({ profession, details }: { profession: string; details: Record<string, any> }) => {
  const cat = getCategoryByProfession(profession);
  if (!cat || !details || Object.keys(details).length === 0) return null;

  const entries = cat.fields.filter(f => f.section === "services" && details[f.key] !== undefined && details[f.key] !== null && details[f.key] !== "");

  if (entries.length === 0) return null;

  return (
    <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Service Details</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {entries.map(f => {
          const val = details[f.key];
          if (f.type === "boolean") return (
            <div key={f.key}>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">{f.label}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{val ? "✓ Yes" : "✗ No"}</p>
            </div>
          );
          if (f.type === "tags" && Array.isArray(val)) return (
            <div key={f.key} className="col-span-2 md:col-span-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{f.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {val.map((v: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary border border-border/60 text-foreground">{v}</span>
                ))}
              </div>
            </div>
          );
          return (
            <div key={f.key}>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">{f.label}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{String(val)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
});
CategoryDetails.displayName = "CategoryDetails";

const ProviderProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();

  const [provider, setProvider] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [rentalItems, setRentalItems] = useState<any[]>([]);
  const [poojaServices, setPoojaServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [activeGallery, setActiveGallery] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"about" | "gallery" | "reviews" | "packages" | "menu" | "rentals" | "poojas">("about");

  const { data: isAvailable } = useAvailability(id || "", selectedDate || new Date());
  const { data: similarArtists = [] } = useArtists({ category: provider?.profession, sortBy: "rating" }, !!provider?.profession);

  useEffect(() => { if (id) { fetchAll(); checkFav(); } }, [id, user]);

  // Record a profile view (real analytics for the vendor dashboard).
  // Deduped per session so a refresh does not inflate the count.
  useEffect(() => {
    if (!id) return;
    const key = `pv_${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    trackProfileView(id, user?.id ?? null, 'direct');
  }, [id, user?.id]);

  const checkFav = async () => {
    if (!user || !id) return;
    const { data } = await supabase.from("favorites" as any).select("id").eq("user_id", user.id).eq("provider_id", id).maybeSingle();
    setIsFavorite(!!data);
  };

  const fetchAll = async () => {
    try {
      const { data: p, error } = await supabase.from("provider_profiles").select("*").eq("id", id).single();
      if (error) throw error;
      setProvider(p);

      const { data: prof } = await supabase.from("profiles").select("full_name,avatar_url,city,area,phone,state,email").eq("id", p.user_id).single();
      if (prof) setProfile(prof);

      const [portRes, revRes, pkgRes, faqRes, menuRes, rentalRes, poojaRes] = await Promise.allSettled([
        supabase.from("portfolio_items").select("*").eq("provider_id", id).order("created_at", { ascending: false }),
        supabase.from("reviews").select("id,rating,review_text,created_at,customer_id").eq("provider_id", id).order("created_at", { ascending: false }).limit(15),
        supabase.from("pricing_packages" as any).select("*").eq("provider_id", id).order("sort_order"),
        supabase.from("provider_faqs" as any).select("*").eq("provider_id", id).order("sort_order"),
        supabase.from("menu_items" as any).select("*").eq("provider_id", id).order("sort_order"),
        supabase.from("rental_items" as any).select("*").eq("provider_id", id).order("created_at"),
        supabase.from("pooja_services" as any).select("*").eq("provider_id", id).order("sort_order"),
      ]);

      if (portRes.status === "fulfilled" && portRes.value.data) setPortfolio(portRes.value.data);
      if (pkgRes.status  === "fulfilled" && pkgRes.value.data)  setPackages(pkgRes.value.data);
      if (faqRes.status  === "fulfilled" && faqRes.value.data)  setFaqs(faqRes.value.data);
      if (menuRes.status === "fulfilled" && menuRes.value.data) setMenuItems(menuRes.value.data);
      if (rentalRes.status === "fulfilled" && rentalRes.value.data) setRentalItems(rentalRes.value.data);
      if (poojaRes.status  === "fulfilled" && poojaRes.value.data) setPoojaServices(poojaRes.value.data);

      if (revRes.status === "fulfilled" && revRes.value.data) {
        const revData = revRes.value.data;
        const ids = revData.map((r: any) => r.customer_id);
        const { data: cust } = await supabase.from("profiles").select("id,full_name").in("id", ids);
        const cm = new Map((cust ?? []).map((c: any) => [c.id, c.full_name]));
        setReviews(revData.map((r: any) => ({ ...r, customer_name: cm.get(r.customer_id) || "Anonymous" })));
      }
    } catch (e: any) { toast.error("Failed to load profile"); navigate("/artists"); }
    finally { setIsLoading(false); }
  };

  const toggleFav = async () => {
    if (!user) { toast.error("Login to save"); return; }
    if (isFavorite) {
      await supabase.from("favorites" as any).delete().eq("user_id", user.id).eq("provider_id", id);
      toast.success("Removed from saved"); setIsFavorite(false);
    } else {
      await supabase.from("favorites" as any).insert({ user_id: user.id, provider_id: id });
      toast.success("Saved!"); setIsFavorite(true);
    }
  };

  const handleBookNow = () => { if (!user) { toast.error("Please login"); navigate("/auth"); return; } setShowBooking(true); };
  const handleAddToCart = (pkg?: any) => {
    if (!user) { toast.error("Please login"); navigate("/auth"); return; }
    if (!provider || !profile) return;
    addToCart({ providerId: provider.id, providerName: profile.full_name, profession: professionLabels[provider.profession] || provider.profession, price: pkg?.price || provider.price_min || 0, date: new Date().toLocaleDateString(), time: "Flexible", duration: pkg?.duration || "1", package: pkg?.name || "Standard" });
    toast.success("Added to cart");
  };

  const submitReview = async () => {
    if (!user) { toast.error("Login to review"); return; }
    setSubmittingReview(true);
    try {
      const { data: bk } = await supabase.from("bookings").select("id").eq("customer_id", user.id).eq("provider_id", provider.id).eq("status", "completed").limit(1).maybeSingle();
      if (!bk) { toast.error("Only available after a completed booking"); return; }
      const { error } = await supabase.from("reviews").insert({ booking_id: bk.id, customer_id: user.id, provider_id: provider.id, rating: reviewRating, review_text: reviewText.trim() || null });
      if (error) { toast.error(error.code === "23505" ? "Already reviewed" : "Failed to submit"); return; }
      toast.success("Review submitted!"); setReviewText(""); setReviewRating(5); fetchAll();
    } finally { setSubmittingReview(false); }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-maroon border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    </div>
  );

  if (!provider || !profile) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-semibold mb-2">Profile not found</p>
        <button onClick={() => navigate("/artists")} className="btn-primary">Browse Artists</button>
      </div>
    </div>
  );

  const langs = Array.isArray(provider.languages) ? provider.languages : (provider.languages || "").split(",").filter(Boolean);
  const specs  = Array.isArray(provider.specialties) ? provider.specialties : (provider.specialties || "").split(",").filter(Boolean);
  const details = provider.vendor_details || provider.category_details || {};
  const catDef = getCategoryByProfession(provider.profession);
  const socialLinks = provider.social_links || {};

  // Determine which tabs to show
  const tabs: { key: string; label: string }[] = [
    { key: "about",    label: "About"    },
    { key: "gallery",  label: "Gallery"  },
    { key: "packages", label: "Packages" },
    { key: "reviews",  label: "Reviews"  },
    ...(menuItems.length > 0    ? [{ key: "menu",    label: "Menu"    }] : []),
    ...(rentalItems.length > 0  ? [{ key: "rentals", label: "Rentals" }] : []),
    ...(poojaServices.length > 0? [{ key: "poojas",  label: "Poojas"  }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-border/60 shadow-xs">
        <div className="container px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary"><ArrowLeft className="w-4 h-4" /></button>
            <AppLogo size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleFav} className={cn("p-2 rounded-lg border transition-all", isFavorite ? "border-rose-300 bg-rose-50 text-rose-500" : "border-border text-muted-foreground")}>
              <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
            </button>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }} className="p-2 rounded-lg border border-border text-muted-foreground">
              <Share2 className="w-4 h-4" />
            </button>
            <button onClick={handleBookNow} disabled={!provider.is_available} className="btn-primary py-2 px-5 text-xs">
              {provider.is_available ? "Book Now" : "Unavailable"}
            </button>
          </div>
        </div>
      </header>

      <main className="pt-14">
        {/* Cover */}
        <div className="relative h-56 md:h-72 overflow-hidden" style={{ background: catDef?.gradient || "linear-gradient(135deg,hsl(345 72% 30%),#0a0a0f)" }}>
          {provider.cover_image_url && <img src={provider.cover_image_url} alt="cover" className="w-full h-full object-cover opacity-60" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        <div className="container px-4">
          {/* Profile card */}
          <div className="relative -mt-14 mb-8">
            <div className="bg-surface-1 rounded-3xl border border-border/60 p-5 md:p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-muted">
                    {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-muted-foreground m-auto mt-4" />}
                  </div>
                  {provider.is_verified && <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-md"><BadgeCheck className="w-3.5 h-3.5 text-white" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-1.5">
                    <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">{provider.stage_name || profile.full_name}</h1>
                    {provider.is_verified && <span className="badge-verified"><BadgeCheck className="w-3 h-3" />Verified</span>}
                    {provider.is_featured && <span className="badge-featured">⭐ Featured</span>}
                    {provider.instant_booking && <span className="badge-instant"><Zap className="w-3 h-3" />Instant</span>}
                  </div>
                  <p className="text-muted-foreground font-medium text-sm mb-2">{professionLabels[provider.profession] || provider.profession}{provider.subcategory ? ` · ${provider.subcategory}` : ""}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {profile.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.city}{profile.area ? `, ${profile.area}` : ""}</span>}
                    <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{(provider.average_rating || 0).toFixed(1)} ({provider.total_reviews || 0} reviews)</span>
                    {provider.experience_years > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{provider.experience_years} yrs exp</span>}
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{provider.total_bookings || 0} events</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-7 mb-16">
            <div className="flex-1 min-w-0 space-y-5">
              {/* Tab nav — scrollable on mobile */}
              <div className="flex gap-1 p-1 bg-secondary rounded-xl border border-border/50 overflow-x-auto no-scrollbar">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key as any)}
                    className={cn("flex-shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap",
                      activeTab === t.key ? "bg-white dark:bg-gray-900 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── ABOUT TAB ── */}
              {activeTab === "about" && (
                <div className="space-y-5">
                  <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">About</h2>
                    <p className="text-sm text-foreground leading-relaxed">{provider.bio || "No description provided."}</p>
                    {specs.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Specialties</p>
                        <div className="flex flex-wrap gap-2">
                          {specs.map((s: string, i: number) => (
                            <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-gold/8 text-gold-dark border border-gold/20">{s.trim()}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category-specific fields */}
                  <CategoryDetails profession={provider.profession} details={details} />

                  {/* Languages */}
                  {langs.length > 0 && (
                    <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Languages</h2>
                      <div className="flex flex-wrap gap-2">
                        {langs.map((l: string, i: number) => (
                          <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary border border-border/60 text-foreground">{l.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Social links */}
                  {(provider.instagram || provider.facebook || provider.youtube || provider.website || socialLinks.instagram || socialLinks.youtube) && (
                    <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Connect</h2>
                      <div className="flex flex-wrap gap-3">
                        {(provider.instagram || socialLinks.instagram) && <a href={`https://instagram.com/${(provider.instagram || socialLinks.instagram).replace("@","")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold"><Instagram className="w-3.5 h-3.5" />Instagram</a>}
                        {(provider.facebook || socialLinks.facebook) && <a href={provider.facebook || socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"><Facebook className="w-3.5 h-3.5" />Facebook</a>}
                        {(provider.youtube || socialLinks.youtube) && <a href={provider.youtube || socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"><Youtube className="w-3.5 h-3.5" />YouTube</a>}
                        {(provider.website || socialLinks.website) && <a href={provider.website || socialLinks.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-700 text-white text-xs font-semibold"><Globe className="w-3.5 h-3.5" />Website</a>}
                      </div>
                    </div>
                  )}

                  {/* FAQs */}
                  {faqs.length > 0 && (
                    <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">FAQs</h2>
                      <div className="space-y-2">
                        {faqs.map((f: any, i: number) => (
                          <div key={f.id} className={cn("rounded-xl border transition-colors", openFaq === i ? "border-maroon/30 bg-maroon/3" : "border-border/60")}>
                            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-4 py-3 text-left gap-3">
                              <span className="text-sm font-medium text-foreground">{f.question}</span>
                              {openFaq === i ? <ChevronUp className="w-4 h-4 text-maroon flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                            </button>
                            {openFaq === i && <div className="px-4 pb-4"><p className="text-xs text-muted-foreground leading-relaxed">{f.answer}</p></div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── GALLERY TAB ── */}
              {activeTab === "gallery" && (
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">Portfolio & Gallery</h2>
                  {portfolio.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No portfolio items yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {portfolio.map((item: any) => (
                        <button key={item.id} onClick={() => setActiveGallery(item.media_url)} className="relative group aspect-square rounded-xl overflow-hidden bg-muted">
                          {item.media_type === "video" ? (
                            <div className="w-full h-full flex items-center justify-center"><VideoIcon className="w-8 h-8 text-muted-foreground" /></div>
                          ) : (
                            <img src={item.media_url} alt={item.title || ""} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── PACKAGES TAB ── */}
              {activeTab === "packages" && (isWaterSupplier(provider) ? <WaterSupplierMenu provider={provider} profile={profile} /> : isPhotographer(provider) ? <PhotographerPackages provider={provider} profile={profile} /> : (
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">Pricing & Packages</h2>
                  {packages.length === 0 ? (
                    (provider.price_min || provider.price_max) ? (
                      <div className="flex items-center justify-between p-5 rounded-xl bg-secondary">
                        <div>
                          <p className="text-2xl font-bold text-foreground">{fmt(provider.price_min || 0)}{provider.price_max ? ` – ${fmt(provider.price_max)}` : "+"}</p>
                          <p className="text-xs text-muted-foreground mt-1">Starting price</p>
                        </div>
                        <button onClick={() => handleAddToCart()} disabled={isInCart(provider.id)} className="btn-gold text-sm py-2.5">{isInCart(provider.id) ? "In Cart" : "Book Now"}</button>
                      </div>
                    ) : <p className="text-sm text-muted-foreground text-center py-8">Pricing available on request.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {packages.map((pkg: any, i: number) => (
                        <div key={pkg.id} className={cn("p-5 rounded-2xl border relative", i === 1 ? "border-gold/40 bg-gradient-to-b from-gold/5 to-transparent shadow-gold" : "border-border/60 bg-surface-2")}>
                          {i === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-gradient-gold text-gray-900 px-3 py-0.5 rounded-full">Most Popular</span>}
                          <h3 className="font-semibold text-foreground mb-2">{pkg.name}</h3>
                          <p className="text-2xl font-bold mb-3">{fmt(pkg.price)}</p>
                          {pkg.duration && <p className="text-xs text-muted-foreground mb-1">Duration: {pkg.duration}</p>}
                          {pkg.description && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{pkg.description}</p>}
                          {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                            <ul className="space-y-1 mb-4">
                              {pkg.features.map((f: string, fi: number) => (
                                <li key={fi} className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />{f}</li>
                              ))}
                            </ul>
                          )}
                          <button onClick={() => handleAddToCart(pkg)} disabled={isInCart(provider.id)} className={cn("w-full py-2.5 rounded-xl text-xs font-semibold", i === 1 ? "btn-gold" : "btn-outline")}>
                            {isInCart(provider.id) ? "In Cart" : "Add to Cart"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* ── REVIEWS TAB ── */}
              {activeTab === "reviews" && (
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6 space-y-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Reviews ({provider.total_reviews || 0})</h2>
                  {reviews.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No reviews yet. Be the first!</p> : (
                    <div className="space-y-5">
                      {reviews.map((r: any) => (
                        <div key={r.id} className="pb-5 border-b border-border/40 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground" /></div>
                              <span className="text-sm font-semibold text-foreground">{r.customer_name}</span>
                            </div>
                            <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={cn("w-3.5 h-3.5", i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200")} />)}</div>
                          </div>
                          {r.review_text && <p className="text-sm text-muted-foreground leading-relaxed">{r.review_text}</p>}
                          <p className="text-[11px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {user && (
                    <div className="pt-5 border-t border-border">
                      <h3 className="text-sm font-semibold mb-3">Write a Review</h3>
                      <StarRow rating={reviewRating} onChange={setReviewRating} />
                      <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Share your experience…" rows={3} className="input-premium mt-3 resize-none w-full" />
                      <button onClick={submitReview} disabled={submittingReview} className="btn-primary mt-3 text-xs py-2.5">{submittingReview ? "Submitting…" : "Submit Review"}</button>
                      <p className="text-[11px] text-muted-foreground mt-2">Only available after a completed booking.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── MENU ITEMS TAB (Caterers) ── */}
              {activeTab === "menu" && (
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">Menu</h2>
                  {menuItems.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Menu not yet added.</p> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {menuItems.filter((m: any) => m.is_available !== false).map((m: any) => (
                        <div key={m.id} className="flex gap-3 p-4 rounded-xl bg-surface-2 border border-border/60">
                          {m.image_url && <img src={m.image_url} alt={m.dish_name} loading="lazy" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground">{m.dish_name}</p>
                            {m.category && <p className="text-[10px] text-muted-foreground font-semibold uppercase">{m.category}</p>}
                            {m.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.description}</p>}
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-sm font-bold text-foreground">{fmt(m.price_per_plate)}<span className="text-[10px] text-muted-foreground font-normal"> /plate</span></p>
                              {m.min_order && <p className="text-[10px] text-muted-foreground">Min: {m.min_order} plates</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── RENTAL ITEMS TAB ── */}
              {activeTab === "rentals" && (
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">Rental Items</h2>
                  {rentalItems.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No rental items listed yet.</p> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {rentalItems.filter((r: any) => r.is_available !== false).map((r: any) => (
                        <div key={r.id} className="p-4 rounded-xl bg-surface-2 border border-border/60">
                          {r.image_url && <img src={r.image_url} alt={r.item_name} loading="lazy" className="w-full h-32 rounded-lg object-cover mb-3" />}
                          <p className="font-semibold text-sm text-foreground">{r.item_name}</p>
                          {r.category && <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">{r.category}</p>}
                          {r.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{r.description}</p>}
                          <div className="space-y-1">
                            {r.price_per_day > 0 && <p className="text-xs font-semibold text-foreground">{fmt(r.price_per_day)} <span className="font-normal text-muted-foreground">/ day</span></p>}
                            {r.price_per_event > 0 && <p className="text-xs font-semibold text-foreground">{fmt(r.price_per_event)} <span className="font-normal text-muted-foreground">/ event</span></p>}
                            {r.quantity_available > 0 && <p className="text-[10px] text-muted-foreground">Qty available: {r.quantity_available}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── POOJA SERVICES TAB (Pandits) ── */}
              {activeTab === "poojas" && (
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">Pooja Services</h2>
                  {poojaServices.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No services listed yet.</p> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {poojaServices.filter((p: any) => p.is_available !== false).map((p: any) => (
                        <div key={p.id} className="p-4 rounded-xl bg-surface-2 border border-border/60">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-semibold text-sm text-foreground">{p.pooja_name}</p>
                            {p.religion && <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-medium flex-shrink-0">{p.religion}</span>}
                          </div>
                          {p.description && <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{p.description}</p>}
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-foreground">{p.price > 0 ? fmt(p.price) : "On Request"}</p>
                            <div className="flex gap-2">
                              {p.duration_minutes && <p className="text-[10px] text-muted-foreground">{p.duration_minutes} min</p>}
                              {p.materials_included && <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">Materials ✓</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Similar artists */}
              {similarArtists.filter((a: any) => a.id !== id).length > 0 && (
                <div className="mt-4">
                  <h2 className="text-lg font-display font-bold text-foreground mb-4">Similar {professionLabels[provider.profession] || "Professionals"}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {similarArtists.filter((a: any) => a.id !== id).slice(0, 4).map((a: any) => (
                      <button key={a.id} onClick={() => navigate(`/artist/${a.id}`)} className="group text-left rounded-2xl overflow-hidden border border-border/60 hover:border-gold/25 hover:shadow-lg bg-surface-1 transition-all duration-300 hover:-translate-y-1">
                        <div className="relative h-32 bg-muted overflow-hidden">
                          <img src={a.cover_image_url || a.avatar_url || "/placeholder.svg"} alt={a.full_name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          <div className="absolute bottom-2 left-2.5 flex items-center gap-1 text-white"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /><span className="text-xs font-bold">{(a.average_rating || 0).toFixed(1)}</span></div>
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-semibold text-foreground truncate group-hover:text-maroon">{a.stage_name || a.full_name}</p>
                          <p className="text-[11px] text-muted-foreground">{a.city || "India"}</p>
                          <p className="text-xs font-bold mt-1">{a.price_min > 0 ? fmt(a.price_min) : "On Request"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Sticky booking sidebar ── */}
            <div className="lg:w-76 xl:w-80 flex-shrink-0">
              <div className="sticky top-16 space-y-4">
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6 shadow-lg">
                  <div className="text-center mb-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Starting from</p>
                    <p className="text-3xl font-bold text-foreground">{provider.price_min ? fmt(provider.price_min) : provider.price_max ? fmt(provider.price_max) : "On Request"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">per event</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {[{ label: "Events", val: provider.total_bookings || 0 }, { label: "Rating", val: (provider.average_rating || 0).toFixed(1) }, { label: "Exp.", val: `${provider.experience_years || 0}yr` }].map(s => (
                      <div key={s.label} className="text-center p-2.5 rounded-xl bg-secondary">
                        <p className="text-sm font-bold text-foreground">{s.val}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleBookNow} disabled={!provider.is_available}
                    className={cn("w-full py-3.5 rounded-xl text-sm font-bold transition-all", provider.is_available ? "btn-primary justify-center" : "bg-muted text-muted-foreground cursor-not-allowed")}>
                    {provider.is_available ? "Book Now" : "Currently Unavailable"}
                  </button>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs font-semibold text-foreground mb-2">Check Availability</p>
                    <input type="date" className="input-premium text-sm py-2 w-full" min={new Date().toISOString().split("T")[0]} onChange={e => setSelectedDate(e.target.value ? new Date(e.target.value) : null)} />
                    {selectedDate && isAvailable !== undefined && (
                      <p className={cn("text-xs font-medium mt-2", (isAvailable as any)?.available ? "text-emerald-600" : "text-red-600")}>
                        {(isAvailable as any)?.available ? "✓ Available on this date" : "✗ Not available on this date"}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                    {profile.phone && <a href={`tel:${profile.phone}`} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary"><Phone className="w-3.5 h-3.5" />Call Now</a>}
                    {(provider.whatsapp || profile.phone) && <a href={`https://wa.me/${(provider.whatsapp || profile.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600"><MessageCircle className="w-3.5 h-3.5" />WhatsApp</a>}
                    {profile.email && <a href={`mailto:${profile.email}`} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary"><Mail className="w-3.5 h-3.5" />Email</a>}
                  </div>
                </div>
                <div className="bg-surface-2 rounded-2xl border border-border/50 p-4 space-y-3">
                  {[{ icon: Shield, label: "Secure escrow payment" }, { icon: BadgeCheck, label: "Verified professional" }, { icon: TrendingUp, label: "Money-back guarantee" }].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5 text-xs text-muted-foreground"><Icon className="w-4 h-4 text-emerald-500" />{label}</div>
                  ))}
                </div>
                <button onClick={() => setReportOpen(true)} className="w-full text-xs text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5 py-2">
                  <Flag className="w-3 h-3" />Report this profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {provider && profile && <BookingModal isOpen={showBooking} onClose={() => setShowBooking(false)} provider={{ id: provider.id, price_min: provider.price_min || 0, price_max: provider.price_max || 0 }} providerName={profile.full_name} />}

      {activeGallery && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setActiveGallery(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><X className="w-5 h-5" /></button>
          <img src={activeGallery} alt="Gallery" className="max-w-full max-h-[90vh] rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-semibold mb-4">Report Profile</h3>
            <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Describe the issue…" rows={4} className="input-premium resize-none mb-4 w-full" />
            <div className="flex gap-3">
              <button onClick={() => { setReportOpen(false); setReportReason(""); }} className="btn-outline flex-1 justify-center py-2.5 text-sm">Cancel</button>
              <button onClick={async () => {
                if (!reportReason.trim()) { toast.error("Please provide a reason"); return; }
                await supabase.from("notifications" as any).insert({ user_id: user?.id, title: "Profile Reported", message: `Profile ${id} reported: ${reportReason}`, type: "report", reference_id: id || null });
                toast.success("Reported"); setReportOpen(false); setReportReason("");
              }} className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90">Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderProfile;
