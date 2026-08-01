// ─── ProviderProfile — Corporate Premium Edition ─────────────────────────────
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { NotificationService } from "@/services/notificationService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, MapPin, Star, Clock, CheckCircle, User, Calendar,
  Sparkles, Share2, MessageCircle, Phone, Mail, Globe,
  Instagram, Facebook, Youtube, IndianRupee, Languages,
  Image as ImageIcon, Video, CalendarDays, Heart, Flag,
  Shield, TrendingUp, BadgeCheck, Zap, Users, Download,
  ChevronRight, X,
} from "lucide-react";
import BookingModal from "@/components/BookingModal";
import { useAvailability, useArtists } from "@/hooks/useArtists";
import type { Database } from "@/integrations/supabase/types";

type ProfessionType = Database["public"]["Enums"]["profession_type"];

const professionLabels: Record<string, string> = {
  normal_band:"Music Band", maharashtra_band:"Maharashtra Band", musician:"Musician",
  dj:"DJ", photographer:"Photographer", videographer:"Videographer",
  decorator:"Event Decorator", kuchipudi_dancer:"Kuchipudi Dancer",
  classical_dancer:"Classical Dancer", western_dancer:"Western Dancer",
  event_support:"Event Support", music_band:"Music Band",
  traditional_band:"Traditional Band", singer:"Singer",
  instrumental_artist:"Instrumental Artist", classical_musician:"Classical Musician",
  cinematographer:"Cinematographer", drone_operator:"Drone Operator",
  dancer:"Dancer", choreographer:"Choreographer", wedding_decorator:"Wedding Decorator",
  stage_decorator:"Stage Decorator", event_decorator:"Event Decorator",
  makeup_artist:"Makeup Artist", mehendi_artist:"Mehendi Artist",
  anchor:"Anchor / Emcee", host:"Host / Presenter", magician:"Magician",
  stand_up_comedian:"Stand-up Comedian", celebrity_artist:"Celebrity Artist",
  live_performer:"Live Performer", folk_artist:"Folk Artist",
  lighting_services:"Lighting Services", sound_services:"Sound Engineer",
  event_planner:"Event Planner", wedding_planner:"Wedding Planner",
  catering_services:"Catering Services", event_support_staff:"Event Support",
};

interface ProviderData { id:string; user_id:string; profession:ProfessionType;
  experience_years:number|null; min_price:number|null; max_price:number|null;
  bio:string|null; verification_status:string|null; specialties:any;
  languages:any; available_dates:string|null; gst_number:string|null;
  instagram:string|null; facebook:string|null; youtube:string|null;
  website:string|null; is_verified?:boolean; is_available?:boolean;
  average_rating?:number; total_reviews?:number; total_bookings?:number;
  price_min?:number; price_max?:number; stage_name?:string;
  cover_image_url?:string; whatsapp?:string; instant_booking?:boolean;
  [key:string]:any;
}
interface ProfileData { full_name:string; avatar_url:string|null; city:string|null;
  area:string|null; state?:string|null; phone:string|null; email:string|null; }
interface PortfolioItem { id:string; media_url:string; media_type:string;
  description:string|null; title?:string; }
interface Review { id:string; rating:number; review_text:string|null;
  created_at:string; customer_name:string; }

const fmt = (n:number) => n>=100000?`₹${(n/100000).toFixed(1)}L`:n>=1000?`₹${(n/1000).toFixed(0)}K`:`₹${n}`;

const StarRow = ({rating,onChange}:{rating:number;onChange:(n:number)=>void}) => (
  <div className="flex items-center gap-1">
    {[1,2,3,4,5].map(i=>(
      <button key={i} onClick={()=>onChange(i)}>
        <Star className={cn("w-6 h-6 transition-colors",i<=rating?"fill-yellow-400 text-yellow-400":"text-gray-200 hover:text-yellow-300")} />
      </button>
    ))}
  </div>
);

const ProviderProfile = () => {
  const {id} = useParams<{id:string}>();
  const navigate = useNavigate();
  const {user} = useAuth();
  const {addToCart, isInCart} = useCart();

  const [provider,        setProvider]        = useState<ProviderData|null>(null);
  const [profile,         setProfile]         = useState<ProfileData|null>(null);
  const [portfolio,       setPortfolio]       = useState<PortfolioItem[]>([]);
  const [reviews,         setReviews]         = useState<Review[]>([]);
  const [pricingPackages, setPricingPackages] = useState<any[]>([]);
  const [timeSlots,       setTimeSlots]       = useState<any[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [showBooking,     setShowBooking]     = useState(false);
  const [isFavorite,      setIsFavorite]      = useState(false);
  const [selectedDate,    setSelectedDate]    = useState<Date|null>(null);
  const [reviewRating,    setReviewRating]    = useState(5);
  const [reviewText,      setReviewText]      = useState("");
  const [submittingReview,setSubmittingReview]= useState(false);
  const [activeGallery,   setActiveGallery]   = useState<string|null>(null);
  const [reportOpen,      setReportOpen]      = useState(false);
  const [reportReason,    setReportReason]    = useState("");
  const [activeTab,       setActiveTab]       = useState<"about"|"gallery"|"reviews"|"packages">("about");

  const {data:isAvailable} = useAvailability(id||"", selectedDate||new Date());
  const {data:similarArtists=[]} = useArtists({category:provider?.profession,sortBy:"rating"},!!provider?.profession);

  useEffect(()=>{ if(id){ fetchAll(); checkFav(); } },[id,user]);

  const checkFav = async()=>{
    if(!user||!id) return;
    const {data} = await supabase.from("favorites" as any).select("*").eq("user_id",user.id).eq("provider_id",id).maybeSingle();
    setIsFavorite(!!data);
  };

  const fetchAll = async()=>{
    try{
      const {data:p,error:pErr} = await supabase.from("provider_profiles").select("*").eq("id",id).single();
      if(pErr) throw pErr;
      setProvider(p as any);
      const {data:prof} = await supabase.from("profiles").select("full_name,avatar_url,city,area,phone,state,email").eq("id",p.user_id).single();
      if(prof) setProfile(prof as any);
      const {data:port} = await supabase.from("portfolio_items").select("*").eq("provider_id",id);
      if(port) setPortfolio(port);
      const {data:rev} = await supabase.from("reviews").select("id,rating,review_text,created_at,customer_id").eq("provider_id",id).order("created_at",{ascending:false}).limit(10);
      if(rev){
        const ids=rev.map((r:any)=>r.customer_id);
        const {data:cust} = await supabase.from("profiles").select("id,full_name").in("id",ids);
        setReviews(rev.map((r:any)=>({...r,customer_name:cust?.find((c:any)=>c.id===r.customer_id)?.full_name||"Anonymous"})));
      }
      const {data:pkgs} = await supabase.from("pricing_packages" as any).select("*").eq("provider_id",id).order("sort_order");
      if(pkgs) setPricingPackages(pkgs);
      const {data:slots} = await supabase.from("provider_time_slots" as any).select("*").eq("provider_id",id).order("day_of_week");
      if(slots) setTimeSlots(slots);
    }catch(e:any){ toast.error("Failed to load profile"); navigate("/artists"); }
    finally{ setIsLoading(false); }
  };

  const toggleFav = async()=>{
    if(!user){ toast.error("Login to save"); return; }
    if(isFavorite){
      await supabase.from("favorites" as any).delete().eq("user_id",user.id).eq("provider_id",id);
      toast.success("Removed from saved"); setIsFavorite(false);
    } else {
      await supabase.from("favorites" as any).insert({user_id:user.id,provider_id:id});
      toast.success("Saved!"); setIsFavorite(true);
    }
  };

  const handleBookNow=()=>{ if(!user){toast.error("Please login");navigate("/auth");return;} setShowBooking(true); };

  const handleAddToCart=(pkg?:any)=>{
    if(!user){toast.error("Please login");navigate("/auth");return;}
    if(!provider||!profile) return;
    addToCart({providerId:provider.id,providerName:profile.full_name,profession:professionLabels[provider.profession]||provider.profession,price:pkg?.price||provider.price_min||0,date:new Date().toLocaleDateString(),time:"Flexible",duration:pkg?.duration||"1",package:pkg?.name||"Standard"});
    toast.success("Added to cart");
  };

  const submitReview = async()=>{
    if(!user){toast.error("Login to review");return;} if(!provider) return;
    setSubmittingReview(true);
    try{
      const {data:bk} = await supabase.from("bookings").select("id").eq("customer_id",user.id).eq("provider_id",provider.id).eq("status","completed").limit(1).maybeSingle();
      if(!bk){toast.error("You can only review after a completed booking");return;}
      const {error} = await supabase.from("reviews").insert({booking_id:bk.id,customer_id:user.id,provider_id:provider.id,rating:reviewRating,review_text:reviewText.trim()||null});
      if(error){toast.error(error.code==="23505"?"Already reviewed":"Failed to submit");return;}
      toast.success("Review submitted!"); setReviewText(""); setReviewRating(5); fetchAll();
    }finally{setSubmittingReview(false);}
  };

  if(isLoading) return(
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-maroon border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    </div>
  );

  if(!provider||!profile) return(
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center"><p className="text-lg font-semibold mb-2">Profile not found</p>
        <button onClick={()=>navigate("/artists")} className="btn-primary">Browse Artists</button>
      </div>
    </div>
  );

  const langs = Array.isArray(provider.languages)?provider.languages:typeof provider.languages==="string"?provider.languages.split(","):[];
  const specs  = Array.isArray(provider.specialties)?provider.specialties:typeof provider.specialties==="string"?provider.specialties.split(","):[];

  return(
    <div className="min-h-screen bg-background">
      {/* ── Sticky mini-header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-border/60 shadow-xs">
        <div className="container px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={()=>navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-maroon flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-base font-display font-bold text-foreground">Vowza</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleFav} className={cn("p-2 rounded-lg border transition-all",isFavorite?"border-rose-300 bg-rose-50 text-rose-500":"border-border text-muted-foreground hover:border-border/80")}>
              <Heart className={cn("w-4 h-4",isFavorite&&"fill-current")} />
            </button>
            <button onClick={()=>{navigator.clipboard.writeText(window.location.href);toast.success("Link copied");}} className="p-2 rounded-lg border border-border text-muted-foreground hover:border-border/80 transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
            <button onClick={handleBookNow} disabled={!provider.is_available} className="btn-primary py-2 px-5 text-xs">
              {provider.is_available?"Book Now":"Unavailable"}
            </button>
          </div>
        </div>
      </header>

      <main className="pt-14">
        {/* ── Cover banner ── */}
        <div className="relative h-64 md:h-80 bg-gradient-to-br from-maroon via-maroon-dark to-[#0a0a0f] overflow-hidden">
          {provider.cover_image_url&&<img src={provider.cover_image_url} alt="cover" className="w-full h-full object-cover opacity-60"/>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
        </div>

        <div className="container px-4">
          {/* ── Profile header card ── */}
          <div className="relative -mt-16 mb-8">
            <div className="bg-surface-1 rounded-3xl border border-border/60 p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-muted">
                    {profile.avatar_url?<img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover"/>:<User className="w-12 h-12 text-muted-foreground m-auto mt-4"/>}
                  </div>
                  {provider.is_verified&&<div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-md"><BadgeCheck className="w-4 h-4 text-white"/></div>}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{provider.stage_name||profile.full_name}</h1>
                    {provider.is_verified&&<span className="badge-verified mt-1"><BadgeCheck className="w-3 h-3"/>Verified</span>}
                    {(provider as any).is_featured&&<span className="badge-featured mt-1">⭐ Featured</span>}
                    {provider.instant_booking&&<span className="badge-instant mt-1"><Zap className="w-3 h-3"/>Instant Book</span>}
                  </div>
                  <p className="text-muted-foreground font-medium mb-3">{professionLabels[provider.profession]||provider.profession}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {profile.city&&<span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/>{profile.city}{profile.area&&`, ${profile.area}`}</span>}
                    <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400"/>{provider.average_rating?.toFixed(1)||"0.0"} <span className="text-muted-foreground">({provider.total_reviews||0} reviews)</span></span>
                    {provider.experience_years&&<span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/>{provider.experience_years} yrs exp</span>}
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/>{provider.total_bookings||0} events</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Two-column layout ── */}
          <div className="flex flex-col lg:flex-row gap-8 mb-16">
            {/* Left — main content */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Tab nav */}
              <div className="flex gap-1 p-1 bg-secondary rounded-xl border border-border/50 w-fit">
                {(["about","gallery","reviews","packages"] as const).map(t=>(
                  <button key={t} onClick={()=>setActiveTab(t)}
                    className={cn("px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all",
                      activeTab===t?"bg-white dark:bg-gray-900 text-foreground shadow-xs":"text-muted-foreground hover:text-foreground")}>
                    {t}
                  </button>
                ))}
              </div>

              {/* ── About tab ── */}
              {activeTab==="about"&&(
                <div className="space-y-5">
                  {/* Bio */}
                  <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">About</h2>
                    <p className="text-sm text-foreground leading-relaxed">{provider.bio||"No description provided."}</p>
                    {specs.length>0&&(
                      <div className="mt-5">
                        <p className="text-xs font-semibold text-muted-foreground mb-2.5">Specialties</p>
                        <div className="flex flex-wrap gap-2">
                          {specs.map((s:string,i:number)=>(
                            <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-gold/8 text-gold-dark border border-gold/20">{s.trim()}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Languages */}
                  {langs.length>0&&(
                    <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Languages</h2>
                      <div className="flex flex-wrap gap-2">
                        {langs.map((l:string,i:number)=>(
                          <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary border border-border/60 text-foreground">{l.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Socials */}
                  {(provider.instagram||provider.facebook||provider.youtube||provider.website)&&(
                    <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Connect</h2>
                      <div className="flex flex-wrap gap-3">
                        {provider.instagram&&<a href={provider.instagram.startsWith("http")?provider.instagram:`https://instagram.com/${provider.instagram.replace("@","")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold"><Instagram className="w-3.5 h-3.5"/>Instagram</a>}
                        {provider.facebook&&<a href={provider.facebook.startsWith("http")?provider.facebook:`https://facebook.com/${provider.facebook}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"><Facebook className="w-3.5 h-3.5"/>Facebook</a>}
                        {provider.youtube&&<a href={provider.youtube.startsWith("http")?provider.youtube:`https://youtube.com/${provider.youtube}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"><Youtube className="w-3.5 h-3.5"/>YouTube</a>}
                        {provider.website&&<a href={provider.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-700 text-white text-xs font-semibold"><Globe className="w-3.5 h-3.5"/>Website</a>}
                      </div>
                    </div>
                  )}
                  {/* Availability */}
                  {timeSlots.length>0&&(
                    <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Weekly Availability</h2>
                      <div className="space-y-2">
                        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day,idx)=>{
                          const slots=timeSlots.filter(s=>s.day_of_week===idx);
                          if(!slots.length) return null;
                          return(
                            <div key={day} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                              <span className="text-xs font-semibold text-foreground w-10">{day}</span>
                              <div className="flex gap-2 flex-wrap">
                                {slots.map((s:any)=>(
                                  <span key={s.id} className="text-[11px] font-medium bg-secondary border border-border px-2 py-0.5 rounded-md">{s.start_time}–{s.end_time}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Gallery tab ── */}
              {activeTab==="gallery"&&(
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-5">Portfolio & Gallery</h2>
                  {portfolio.length===0?<p className="text-sm text-muted-foreground text-center py-8">No portfolio items yet.</p>:(
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {portfolio.map(item=>(
                        <button key={item.id} onClick={()=>setActiveGallery(item.media_url)} className="relative group aspect-square rounded-xl overflow-hidden bg-muted">
                          {item.media_type==="video"?<div className="w-full h-full flex items-center justify-center"><Video className="w-10 h-10 text-muted-foreground"/></div>
                            :<img src={item.media_url} alt={item.title||""} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"/>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Packages tab ── */}
              {activeTab==="packages"&&(
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-5">Pricing & Packages</h2>
                  {pricingPackages.length===0?(
                    (provider.price_min||provider.price_max)?(
                      <div className="flex items-center justify-between p-5 rounded-xl bg-secondary">
                        <div>
                          <p className="text-2xl font-bold text-foreground">{fmt(provider.price_min||0)} – {fmt(provider.price_max||0)}</p>
                          <p className="text-xs text-muted-foreground mt-1">Starting price range</p>
                        </div>
                        <button onClick={()=>handleAddToCart()} disabled={isInCart(provider.id)} className="btn-gold text-sm py-2.5">{isInCart(provider.id)?"In Cart":"Add to Cart"}</button>
                      </div>
                    ):<p className="text-sm text-muted-foreground text-center py-8">Pricing available on request.</p>
                  ):(
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {pricingPackages.map((pkg:any,i:number)=>(
                        <div key={pkg.id} className={cn("p-5 rounded-2xl border relative",i===1?"border-gold/40 bg-gradient-to-b from-gold/5 to-transparent shadow-gold":"border-border/60 bg-surface-2")}>
                          {i===1&&<span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-gradient-gold text-gray-900 px-3 py-0.5 rounded-full">Most Popular</span>}
                          <h3 className="font-semibold text-foreground mb-2">{pkg.name}</h3>
                          <p className="text-2xl font-bold mb-3">{fmt(pkg.price)}</p>
                          {pkg.duration&&<p className="text-xs text-muted-foreground mb-1">Duration: {pkg.duration}</p>}
                          {pkg.description&&<p className="text-xs text-muted-foreground mb-4 leading-relaxed">{pkg.description}</p>}
                          <button onClick={()=>handleAddToCart(pkg)} disabled={isInCart(provider.id)} className={cn("w-full py-2.5 rounded-xl text-xs font-semibold transition-all",i===1?"btn-gold":"btn-outline")}>
                            {isInCart(provider.id)?"In Cart":"Add to Cart"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Reviews tab ── */}
              {activeTab==="reviews"&&(
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6 space-y-6">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Reviews ({provider.total_reviews||0})</h2>
                  {reviews.length===0?<p className="text-sm text-muted-foreground text-center py-8">No reviews yet. Be the first!</p>:(
                    <div className="space-y-5">
                      {reviews.map(r=>(
                        <div key={r.id} className="pb-5 border-b border-border/40 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground"/></div>
                              <span className="text-sm font-semibold text-foreground">{r.customer_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {[1,2,3,4,5].map(i=><Star key={i} className={cn("w-3.5 h-3.5",i<=r.rating?"fill-yellow-400 text-yellow-400":"text-gray-200")}/>)}
                            </div>
                          </div>
                          {r.review_text&&<p className="text-sm text-muted-foreground leading-relaxed">{r.review_text}</p>}
                          <p className="text-[11px] text-muted-foreground mt-2">{new Date(r.created_at).toLocaleDateString("en-IN",{year:"numeric",month:"short",day:"numeric"})}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {user&&(
                    <div className="pt-5 border-t border-border">
                      <h3 className="text-sm font-semibold mb-3">Write a Review</h3>
                      <StarRow rating={reviewRating} onChange={setReviewRating}/>
                      <textarea value={reviewText} onChange={e=>setReviewText(e.target.value)} placeholder="Share your experience… (optional)" rows={3} className="input-premium mt-3 resize-none"/>
                      <button onClick={submitReview} disabled={submittingReview} className="btn-primary mt-3 text-xs py-2.5">
                        {submittingReview?"Submitting…":"Submit Review"}
                      </button>
                      <p className="text-[11px] text-muted-foreground mt-2">Only available after a completed booking.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Sticky sidebar ── */}
            <div className="lg:w-80 xl:w-88 flex-shrink-0">
              <div className="sticky top-16 space-y-4">
                {/* Booking card */}
                <div className="bg-surface-1 rounded-2xl border border-border/60 p-6 shadow-lg">
                  <div className="text-center mb-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Starting from</p>
                    <p className="text-3xl font-bold text-foreground">
                      {provider.price_min?fmt(provider.price_min):provider.price_max?fmt(provider.price_max):"On Request"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">per event</p>
                  </div>
                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[{label:"Events",val:provider.total_bookings||0},{label:"Rating",val:(provider.average_rating||0).toFixed(1)},{label:"Exp.",val:`${provider.experience_years||0}yr`}].map(s=>(
                      <div key={s.label} className="text-center p-2.5 rounded-xl bg-secondary">
                        <p className="text-sm font-bold text-foreground">{s.val}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleBookNow} disabled={!provider.is_available}
                    className={cn("w-full py-3.5 rounded-xl text-sm font-bold transition-all",provider.is_available?"btn-primary justify-center w-full":"w-full py-3.5 rounded-xl text-sm font-bold bg-muted text-muted-foreground cursor-not-allowed")}>
                    {provider.is_available?"Book Now":"Currently Unavailable"}
                  </button>
                  {/* Availability check */}
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs font-semibold text-foreground mb-2">Check Availability</p>
                    <input type="date" className="input-premium text-sm py-2" min={new Date().toISOString().split("T")[0]} onChange={e=>setSelectedDate(e.target.value?new Date(e.target.value):null)}/>
                    {selectedDate&&isAvailable!==undefined&&(
                      <p className={cn("text-xs font-medium mt-2",isAvailable?.available?"text-emerald-600":"text-red-600")}>
                        {isAvailable?.available?"✓ Available on this date":"✗ Not available on this date"}
                      </p>
                    )}
                  </div>
                  {/* Contact */}
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                    {profile.phone&&<a href={`tel:${profile.phone}`} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"><Phone className="w-3.5 h-3.5"/>Call Now</a>}
                    {(provider.whatsapp||profile.phone)&&<a href={`https://wa.me/${(provider.whatsapp||profile.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"><MessageCircle className="w-3.5 h-3.5"/>WhatsApp</a>}
                    {profile.email&&<a href={`mailto:${profile.email}`} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"><Mail className="w-3.5 h-3.5"/>Email</a>}
                  </div>
                </div>
                {/* Trust */}
                <div className="bg-surface-2 rounded-2xl border border-border/50 p-4 space-y-3">
                  {[{icon:Shield,label:"Secure escrow payment"},{icon:BadgeCheck,label:"Verified professional"},{icon:TrendingUp,label:"Money-back guarantee"}].map(({icon:Icon,label})=>(
                    <div key={label} className="flex items-center gap-2.5 text-xs text-muted-foreground"><Icon className="w-4 h-4 text-emerald-500"/>{label}</div>
                  ))}
                </div>
                <button onClick={()=>setReportOpen(true)} className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center gap-1.5 py-2">
                  <Flag className="w-3 h-3"/>Report this profile
                </button>
              </div>
            </div>
          </div>

          {/* ── Similar Artists ── */}
          {similarArtists.filter(a=>a.id!==id).length>0&&(
            <section className="mb-16">
              <h2 className="text-xl font-display font-bold text-foreground mb-6">Similar {professionLabels[provider.profession]||"Artists"}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {similarArtists.filter(a=>a.id!==id).slice(0,4).map(a=>(
                  <button key={a.id} onClick={()=>navigate(`/artist/${a.id}`)} className="group text-left rounded-2xl overflow-hidden border border-border/60 hover:border-gold/25 hover:shadow-lg bg-surface-1 transition-all duration-300 hover:-translate-y-1">
                    <div className="relative h-36 bg-muted overflow-hidden">
                      <img src={a.cover_image_url||a.avatar_url||"/placeholder.svg"} alt={a.full_name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"/>
                      <div className="absolute bottom-2 left-3 flex items-center gap-1 text-white"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400"/><span className="text-xs font-bold">{a.average_rating.toFixed(1)}</span></div>
                      {a.is_verified&&<div className="absolute bottom-2 right-2.5"><BadgeCheck className="w-4 h-4 text-emerald-400"/></div>}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-maroon transition-colors">{a.stage_name||a.full_name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{a.city||"India"}</p>
                      <p className="text-xs font-bold text-foreground mt-1.5">{a.price_min>0?fmt(a.price_min):"On Request"}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Booking modal */}
      {provider&&profile&&<BookingModal isOpen={showBooking} onClose={()=>setShowBooking(false)} provider={{id:provider.id,price_min:provider.price_min||provider.min_price||0,price_max:provider.price_max||provider.max_price||0}} providerName={profile.full_name}/>}

      {/* Gallery lightbox */}
      {activeGallery&&(
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={()=>setActiveGallery(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
          <img src={activeGallery} alt="Gallery" className="max-w-full max-h-[90vh] rounded-2xl object-contain" onClick={e=>e.stopPropagation()}/>
        </div>
      )}

      {/* Report modal */}
      {reportOpen&&(
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-semibold mb-4">Report Profile</h3>
            <textarea value={reportReason} onChange={e=>setReportReason(e.target.value)} placeholder="Describe the issue…" rows={4} className="input-premium resize-none mb-4"/>
            <div className="flex gap-3">
              <button onClick={()=>{setReportOpen(false);setReportReason("");}} className="btn-outline flex-1 justify-center py-2.5 text-sm">Cancel</button>
              <button onClick={async()=>{if(!reportReason.trim()){toast.error("Please provide a reason");return;}await supabase.from("notifications" as any).insert({user_id:user?.id,title:"Profile Reported",message:`Profile ${id} reported: ${reportReason}`,type:"report",reference_id:id});toast.success("Reported");setReportOpen(false);setReportReason("");}} className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors">Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderProfile;
