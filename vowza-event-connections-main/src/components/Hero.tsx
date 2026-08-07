// ─── Hero — Premium Edition ───────────────────────────────────────────────────
// Same functionality as before (search, AI planner toggle, navigation) —
// visuals upgraded: bigger display type, layered ambient glow, drifting
// particles, faint grid, a floating glass "bento" composition of vendor
// categories, and Framer Motion micro-interactions throughout.
import { useState, useRef, useEffect, useCallback, memo } from "react";
import VowzaIcon from '@/components/VowzaIcon';
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, TrendingUp, ChevronDown, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import MobileHero from "./MobileHero";

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  return isMobile;
};

const EVENT_OPTIONS = [
  "Wedding","Reception","Birthday Party","Corporate Event",
  "Haldi Ceremony","Sangeet Night","Engagement","House Warming",
  "Baby Shower","College Fest","Private Party","Anniversary",
] as const;

const PLANNER_SUGGESTIONS = [
  "Plan a wedding for 300 guests in Hyderabad under ₹12 lakh",
  "Birthday party for 100 people in Bangalore under ₹2 lakh",
  "Corporate event for 200 guests in Mumbai under ₹5 lakh",
  "Sangeet night for 150 guests in Delhi under ₹3 lakh",
  "Engagement ceremony in Pune for 80 guests",
] as const;

const TRENDING = [
  "Wedding Photographers","DJ for Sangeet","Bridal Makeup","Wedding Decorators","Caterers",
] as const;

// ── Right-side floating premium service cards — real photography + glass ────
// Each card uses a real photo (Unsplash, lazy-loaded) with a dark gradient
// overlay for legibility, glassmorphism border, category icon, title and
// subtitle. Positions/sizes tuned per-card for an organic "floating" feel.
const VISUAL_CARDS = [
  { icon: null,     label: "Wedding Photography", sub: null,                  img: "/images/wedding-photography.jpg", pos: "top-0 left-8 w-[172px] h-[208px]",     rotate: -3, delay: 0    },
  { icon: null,     label: "DJ & Music",          sub: "Professional DJs & Live Entertainment", img: "/images/dj-music.jpg", pos: "top-6 right-0 w-[146px] h-[154px]",    rotate: 2,  delay: 0.4  },
  { icon: null,     label: "Wedding Decoration",  sub: "Luxury Wedding Decor", img: "/images/wedding-decoration.jpg", pos: "bottom-28 left-0 w-[154px] h-[154px]", rotate: -2, delay: 0.8 },
  { icon: null,     label: "Bridal Makeup",       sub: "Professional Bridal Makeup", img: "/images/bridal-makeup.jpg", pos: "bottom-0 left-24 w-[156px] h-[168px]", rotate: 3,  delay: 1.2 },
  { icon: null,     label: "Catering",            sub: null,                  img: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=75&auto=format&fit=crop", pos: "bottom-6 right-2 w-[154px] h-[144px]", rotate: -2, delay: 1.6 },
  { icon: null,     label: "Live Band",           sub: "Professional Live Performers", img: "/images/live-band.jpg", pos: "top-32 right-16 w-[132px] h-[132px]",  rotate: 2,  delay: 2.0 },
] as const;

// ── Deterministic ambient particle field (computed once at module scope) ─────
const PARTICLES = Array.from({ length: 20 }, (_, i) => {
  const seed = i * 47.37;
  return {
    left:     (Math.sin(seed) * 0.5 + 0.5) * 100,
    top:      (Math.cos(seed * 1.31) * 0.5 + 0.5) * 100,
    size:     2 + (i % 3),
    duration: 8 + (i % 6) * 1.4,
    delay:    (i % 10) * 0.7,
    driftX:   (i % 2 === 0 ? 1 : -1) * (12 + (i % 5) * 7),
    driftY:   -(90 + (i % 6) * 22),
    opacity:  0.18 + (i % 4) * 0.1,
  };
});

const HeroBg = memo(() => (
  <>
    {/* Primary maroon/gold glow — animated pulse */}
    <div aria-hidden className="glow-orb animate-glow-pulse"
      style={{ top:"-18%", left:"50%", transform:"translateX(-50%)", width:"min(94vw,900px)", height:"min(78vw,740px)", background:"radial-gradient(ellipse 58% 52% at 40% 34%, hsl(345 72% 30% / 0.62) 0%, transparent 68%),radial-gradient(ellipse 48% 42% at 64% 22%, hsl(40 95% 52% / 0.22) 0%, transparent 65%)" }} />
    {/* Royal blue undertone */}
    <div aria-hidden className="glow-orb"
      style={{ bottom:0, left:"50%", transform:"translateX(-50%)", width:"min(68vw,660px)", height:"min(44vw,400px)", background:"radial-gradient(ellipse at center, hsl(224 60% 36% / 0.14) 0%, transparent 68%)" }} />
    {/* Secondary gold accent — top right, slow float */}
    <div aria-hidden className="glow-orb animate-float"
      style={{ top:"6%", right:"2%", width:"min(38vw,340px)", height:"min(30vw,260px)", background:"radial-gradient(ellipse at center, hsl(40 95% 56% / 0.16) 0%, transparent 70%)" }} />
    {/* Fine grid — very low opacity */}
    <div aria-hidden className="absolute inset-0 bg-grid-fine pointer-events-none"
      style={{ maskImage:"radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 75%)", WebkitMaskImage:"radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 75%)" }} />
    {/* Drifting ambient particles */}
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p, i) => (
        <span key={i} className="particle-dot animate-particle-drift"
          style={{
            left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size,
            "--particle-duration": `${p.duration}s`,
            "--particle-opacity": p.opacity,
            "--drift-x": `${p.driftX}px`,
            "--drift-y": `${p.driftY}px`,
            animationDelay: `${p.delay}s`,
          } as React.CSSProperties} />
      ))}
    </div>
  </>
));
HeroBg.displayName = "HeroBg";

// ── Floating premium service card (right-side composition) ───────────────────
// Real photography + 60-70% dark gradient overlay for legibility, glass
// border, rounded-3xl (24px), soft shadow. Slow infinite float + slight
// rotation drift, staggered delay per card, gentle hover lift + glow.
const VisualCard = memo(({ card, idx }: { card: typeof VISUAL_CARDS[number]; idx: number }) => {
  const Icon = card.icon as React.ElementType | null;
  return (
    <motion.div
      className={`absolute ${card.pos} rounded-3xl overflow-hidden shadow-2xl border border-white/12`}
      initial={{ opacity: 0, y: 24, scale: 0.92, rotate: 0 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.3 + idx * 0.09, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -10, scale: 1.045, rotate: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
      style={{ zIndex: 10 - idx }}
    >
      {/* Slow floating + slight rotation drift — infinite, staggered by delay */}
      <motion.div
        className="relative w-full h-full group"
        animate={{ y: [0, -10, 0], rotate: [0, card.rotate, 0] }}
        transition={{ duration: 6 + idx * 0.7, repeat: Infinity, ease: "easeInOut", delay: card.delay }}
      >
        {/* Real photography — lazy loaded */}
        <img
          src={card.img}
          alt={card.label}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark gradient overlay — ~65% for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
        {/* Glassmorphism sheen */}
        <div className="absolute inset-0 backdrop-blur-[0.5px] bg-white/[0.03]" />
        {/* Glow ring on hover */}
        <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 1.5px hsl(40 95% 62% / 0.55), 0 0 28px 4px hsl(40 95% 56% / 0.25)" }} />

        <div className="relative z-10 h-full flex flex-col justify-between p-4">
          {Icon ? (
            <div className="w-9 h-9 rounded-xl bg-white/12 border border-white/20 flex items-center justify-center backdrop-blur-md">
              <Icon className="w-4.5 h-4.5 text-white" />
            </div>
          ) : <div />}
          <div>
            <p className="text-white text-[13px] font-semibold leading-tight drop-shadow-sm">{card.label}</p>
            {card.sub && (
              <p className="text-white/70 text-[10.5px] font-medium leading-tight mt-0.5">{card.sub}</p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
VisualCard.displayName = "VisualCard";

const HeroVisual = memo(() => (
  <div className="relative hidden lg:block" style={{ height: 460 }}>
    {/* Backdrop glow anchoring the composition */}
    <div aria-hidden className="glow-orb animate-glow-pulse"
      style={{ top: "20%", left: "10%", width: 380, height: 380, background: "radial-gradient(circle, hsl(40 95% 52% / 0.18) 0%, transparent 70%)" }} />
    {VISUAL_CARDS.map((card, i) => <VisualCard key={card.label} card={card} idx={i} />)}
  </div>
));
HeroVisual.displayName = "HeroVisual";

// ── Mobile/tablet fallback: swipeable carousel of the same premium cards ─────
// Below lg breakpoint the absolute-positioned bento layout doesn't fit, so
// the same real-photo cards become a horizontally swipeable strip instead.
const HeroVisualMobile = memo(() => (
  <div className="lg:hidden -mx-4 px-4">
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1" style={{ scrollSnapType: "x mandatory" }}>
      {VISUAL_CARDS.map((card, i) => {
        const Icon = card.icon as React.ElementType | null;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.97 }}
            className="relative flex-shrink-0 w-[152px] h-[172px] rounded-3xl overflow-hidden shadow-xl border border-white/12"
            style={{ scrollSnapAlign: "start" }}
          >
            <img src={card.img} alt={card.label} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
            <div className="relative z-10 h-full flex flex-col justify-between p-3.5">
              {Icon ? (
                <div className="w-8 h-8 rounded-lg bg-white/12 border border-white/20 flex items-center justify-center backdrop-blur-md">
                  <Icon className="w-4 h-4 text-white" />
                </div>
              ) : <div />}
              <div>
                <p className="text-white text-[12px] font-semibold leading-tight">{card.label}</p>
                {card.sub && (
                  <p className="text-white/70 text-[10px] font-medium leading-tight mt-0.5">{card.sub}</p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  </div>
));
HeroVisualMobile.displayName = "HeroVisualMobile";

// ── SearchField — module-scope component so text-center never bleeds in ────────
interface FieldProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}
const SearchField = ({ icon, label, children, style }: FieldProps) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flex: 1,
      padding: "15px 18px",
      background: "hsl(220 14% 97%)",
      minWidth: 0,
      textAlign: "left",
      transition: "background 0.2s ease",
      ...style,
    }}
  >
    <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
      {icon}
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{
        display: "block",
        fontSize: "9.5px",
        fontWeight: 700,
        color: "#9ca3af",
        textTransform: "uppercase",
        letterSpacing: "0.09em",
        lineHeight: 1,
        marginBottom: "4px",
        textAlign: "left",
      }}>
        {label}
      </span>
      {children}
    </div>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "#111",
  border: "none",
  outline: "none",
  lineHeight: 1.2,
  padding: 0,
  margin: 0,
  textAlign: "left",
};

// ── Ripple spawner for premium buttons ────────────────────────────────────────
function spawnRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget;
  const circle = document.createElement("span");
  const d = Math.max(btn.clientWidth, btn.clientHeight) * 1.6;
  const rect = btn.getBoundingClientRect();
  circle.className = "ripple";
  circle.style.width = circle.style.height = `${d}px`;
  circle.style.left = `${e.clientX - rect.left - d / 2}px`;
  circle.style.top = `${e.clientY - rect.top - d / 2}px`;
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 650);
}

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show:   (delay = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] } }),
};

const DesktopHero = () => {
  const navigate = useNavigate();

  const [tab,          setTab]       = useState<"search"|"ai">("search");
  const [eventType,    setEventType] = useState("");
  const [location,     setLocation]  = useState("");
  const [plannerQuery, setQuery]     = useState("");
  const [showSuggest,  setShowSuggest] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node))
        setShowSuggest(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleSearch = useCallback(() => {
    const p = new URLSearchParams();
    if (eventType)       p.set("event", eventType);
    if (location.trim()) p.set("city",  location.trim());
    navigate(`/artists?${p.toString()}`);
  }, [eventType, location, navigate]);

  const openPlanner = useCallback((q?: string) => {
    if (q) sessionStorage.setItem("vowza_planner_prefill", q);
    navigate("/ai-planner");
  }, [navigate]);

  return (
    <section className="relative overflow-hidden" style={{ background:"#07060d" }}>
      <HeroBg />

      <div className="relative z-10" style={{ paddingTop:"clamp(4.5rem,9vw,7rem)", paddingBottom:"clamp(3.5rem,7vw,5.5rem)" }}>
        <div className="container px-4">

          <div className="grid lg:grid-cols-[1.08fr,0.92fr] gap-8 lg:gap-4 items-center">

            {/* ── Left column: heading, search, chips ── */}
            <div>
              <div className="lg:max-w-[600px] mx-auto lg:mx-0 text-center lg:text-left">

                {/* Eyebrow badge */}
                <motion.div
                  initial="hidden" animate="show" variants={fadeUp} custom={0}
                  className="inline-flex items-center gap-1.5 mb-5 px-3.5 py-1.5 rounded-full glass-premium"
                >
                  <VowzaIcon className="w-3 h-3 text-gold" />
                  <span className="text-[11px] font-semibold text-white/70 tracking-wide">India's Premium Event Marketplace</span>
                </motion.div>

                {/* Heading — significantly larger, smoother spacing */}
                <motion.h1
                  initial="hidden" animate="show" variants={fadeUp} custom={0.08}
                  className="font-display font-bold text-white"
                  style={{ fontSize:"clamp(2.6rem,6.2vw,4.75rem)", lineHeight:1.05, letterSpacing:"-0.03em", marginBottom:"clamp(1.1rem,2.4vw,1.5rem)" }}
                >
                  Where{" "}
                  <span style={{ background:"linear-gradient(135deg,hsl(40 95% 68%) 0%,hsl(40 90% 52%) 55%,hsl(36 85% 44%) 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Talent</span>
                  {" "}Meets{" "}
                  <span style={{ fontSize:"0.96em", background:"linear-gradient(135deg,hsl(345 68% 60%) 0%,hsl(345 72% 42%) 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Celebration</span>
                </motion.h1>

                {/* Description */}
                <motion.p
                  initial="hidden" animate="show" variants={fadeUp} custom={0.16}
                  style={{ fontSize:"clamp(1.1rem,1.9vw,1.3rem)", lineHeight:2.2, fontWeight:600, color:"hsl(0 0% 100% / 0.62)", marginBottom:"clamp(1.75rem,3.5vw,2.5rem)" }}
                  className="mx-auto lg:mx-0 max-w-[520px]"
                >
                  One Platform.<br />
                  Trusted Professionals.<br />
                  Unforgettable Celebrations.
                </motion.p>

                {/* Toggle — premium AI planner treatment */}
                <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0.24}
                  className="flex justify-center lg:justify-start" style={{ marginBottom:"clamp(1rem,2vw,1.4rem)" }}>
                  <div className="relative inline-flex items-center gap-1 p-1 rounded-2xl glass-premium">
                    <button type="button" onClick={() => setTab("search")}
                      className="relative px-4 py-2 rounded-xl text-[12.5px] font-semibold z-10"
                      style={{ color: tab === "search" ? "#111" : "hsl(0 0% 100% / 0.5)" }}>
                      {tab === "search" && (
                        <motion.div layoutId="heroTabBg" className="absolute inset-0 rounded-xl bg-white -z-10"
                          style={{ boxShadow:"0 1px 8px hsl(0 0% 0% / 0.15)" }}
                          transition={{ type: "spring", bounce: 0.22, duration: 0.5 }} />
                      )}
                      Quick Search
                    </button>

                    <button type="button" onClick={() => setTab("ai")}
                      className="relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-semibold z-10"
                      style={{ color: tab === "ai" ? "#111" : "hsl(0 0% 100% / 0.5)" }}>
                      {tab === "ai" && (
                        <motion.div layoutId="heroTabBg" className="absolute inset-0 rounded-xl -z-10"
                          style={{ background:"linear-gradient(135deg,hsl(40 95% 56%),hsl(36 85% 44%))", boxShadow:"0 3px 16px hsl(40 95% 52% / 0.4)" }}
                          transition={{ type: "spring", bounce: 0.22, duration: 0.5 }} />
                      )}
                      <motion.span
                        animate={{ rotate: [0, 18, -12, 0], scale: [1, 1.18, 1] }}
                        transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
                        className="inline-flex"
                      >
                        <VowzaIcon className="w-3.5 h-3.5" />
                      </motion.span>
                      Vowza AI Planner
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold tracking-wide"
                        style={{ background: tab === "ai" ? "hsl(0 0% 0% / 0.12)" : "hsl(40 95% 56% / 0.18)", color: tab === "ai" ? "#111" : "hsl(40 95% 68%)" }}>
                        AI
                      </span>
                    </button>

                    {/* Soft ambient pulse ring around the whole toggle, every few seconds */}
                    <motion.div
                      aria-hidden
                      className="absolute inset-0 rounded-2xl pointer-events-none"
                      animate={{ boxShadow: [
                        "0 0 0 0 hsl(40 95% 52% / 0)",
                        "0 0 0 6px hsl(40 95% 52% / 0.12)",
                        "0 0 0 0 hsl(40 95% 52% / 0)",
                      ] }}
                      transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              </div>

              {/* ── Search box ── */}
              <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0.32}
                className="lg:max-w-[600px] mx-auto lg:mx-0">
                <AnimatePresence mode="wait">
                  {tab === "search" ? (
                    <motion.div key="search"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      whileHover={{ y: -4 }}
                      style={{
                        borderRadius: "22px",
                        padding: "8px",
                        background: "hsl(0 0% 100% / 0.98)",
                        boxShadow: "0 0 0 1px hsl(0 0% 0% / 0.05), 0 22px 64px -10px hsl(0 0% 0% / 0.5)",
                        transition: "box-shadow 0.3s ease",
                      }}
                      className="hover:shadow-[0_0_0_1px_hsl(40_95%_52%/0.25),0_28px_74px_-10px_hsl(0_0%_0%/0.55)] focus-within:shadow-[0_0_0_2.5px_hsl(40_95%_52%/0.55),0_28px_74px_-10px_hsl(0_0%_0%/0.55)]"
                    >
                      {/* DESKTOP: single horizontal row */}
                      <div className="hidden md:flex" style={{ alignItems:"stretch" }}>
                        <SearchField
                          icon={<VowzaIcon style={{ width:"15px", height:"15px", color:"hsl(345 72% 36%)" }} />}
                          label="Event Type"
                          style={{ borderRadius:"18px 0 0 18px", borderRight:"1px solid #e5e7eb" }}
                        >
                          <div style={{ position:"relative" }}>
                            <select value={eventType} onChange={e => setEventType(e.target.value)}
                              style={{ ...inputStyle, appearance:"none", paddingRight:"16px", cursor:"pointer" }}>
                              <option value="">Select Event Type</option>
                              {EVENT_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                            <ChevronDown style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)", width:"11px", height:"11px", color:"#9ca3af", pointerEvents:"none" }} />
                          </div>
                        </SearchField>

                        <SearchField
                          icon={<MapPin style={{ width:"15px", height:"15px", color:"hsl(345 72% 36%)" }} />}
                          label="Location"
                          style={{ borderRadius:0 }}
                        >
                          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                            onKeyDown={e => e.key==="Enter" && handleSearch()}
                            placeholder="Search by City, District or State"
                            autoComplete="off"
                            style={inputStyle} />
                        </SearchField>

                        <motion.button type="button" onClick={handleSearch} onMouseDown={spawnRipple}
                          whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.97 }}
                          className="btn-ripple flex items-center justify-center gap-2 flex-shrink-0"
                          style={{ padding:"0 24px", borderRadius:"0 18px 18px 0", background:"linear-gradient(135deg,hsl(345 72% 40%),hsl(345 80% 24%))", color:"#fff", fontWeight:700, fontSize:"13px", border:"none", cursor:"pointer", boxShadow:"0 8px 24px -4px hsl(345 72% 32% / 0.6)", transition:"box-shadow 0.25s ease", whiteSpace:"nowrap", alignSelf:"stretch", minWidth:"172px" }}
                        >
                          <Search style={{ width:"14px", height:"14px" }} />
                          Find Verified Artists
                        </motion.button>
                      </div>

                      {/* MOBILE: stacked */}
                      <div className="flex flex-col gap-1.5 md:hidden">
                        <SearchField
                          icon={<VowzaIcon style={{ width:"15px", height:"15px", color:"hsl(345 72% 36%)" }} />}
                          label="Event Type"
                          style={{ borderRadius:"14px" }}
                        >
                          <div style={{ position:"relative" }}>
                            <select value={eventType} onChange={e => setEventType(e.target.value)}
                              style={{ ...inputStyle, appearance:"none", paddingRight:"16px", cursor:"pointer" }}>
                              <option value="">Select Event Type</option>
                              {EVENT_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                            <ChevronDown style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)", width:"11px", height:"11px", color:"#9ca3af", pointerEvents:"none" }} />
                          </div>
                        </SearchField>

                        <SearchField
                          icon={<MapPin style={{ width:"15px", height:"15px", color:"hsl(345 72% 36%)" }} />}
                          label="Location"
                          style={{ borderRadius:"14px" }}
                        >
                          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                            onKeyDown={e => e.key==="Enter" && handleSearch()}
                            placeholder="Search by City, District or State"
                            autoComplete="off"
                            style={inputStyle} />
                        </SearchField>

                        <motion.button type="button" onClick={handleSearch} onMouseDown={spawnRipple}
                          whileTap={{ scale: 0.97 }}
                          className="btn-ripple flex items-center justify-center gap-2"
                          style={{ padding:"13px 0", borderRadius:"14px", background:"linear-gradient(135deg,hsl(345 72% 38%),hsl(345 80% 24%))", color:"#fff", fontWeight:700, fontSize:"13.5px", border:"none", cursor:"pointer", boxShadow:"0 6px 20px -4px hsl(345 72% 32% / 0.55)" }}>
                          <Search style={{ width:"14px", height:"14px" }} />
                          Find Verified Artists
                        </motion.button>
                      </div>
                    </motion.div>

                  ) : (
                    /* ── Vowza AI Planner ── */
                    <motion.div key="ai" ref={suggestRef}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      style={{ position:"relative" }}
                    >
                      <motion.div whileHover={{ y: -3 }}
                        style={{ borderRadius:"20px", padding:"7px", display:"flex", gap:"6px", background:"hsl(0 0% 100% / 0.98)", boxShadow:"0 0 0 1px hsl(40 95% 52% / 0.15), 0 20px 60px -10px hsl(0 0% 0% / 0.5)", transition:"box-shadow 0.3s ease" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"10px", flex:1, padding:"13px 18px", borderRadius:"16px", background:"hsl(220 14% 97%)", minWidth:0 }}>
                          <VowzaIcon style={{ width:"15px", height:"15px", color:"hsl(40 90% 46%)", flexShrink:0 }} />
                          <input type="text" value={plannerQuery}
                            onChange={e => { setQuery(e.target.value); setShowSuggest(true); }}
                            onFocus={() => setShowSuggest(true)}
                            placeholder="Plan a wedding for 300 guests in Hyderabad under ₹12 lakh…"
                            autoComplete="off"
                            style={{ ...inputStyle, flex:1 }} />
                          {plannerQuery && (
                            <button type="button" onClick={() => setQuery("")}
                              style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex" }}>
                              <X style={{ width:"13px", height:"13px", color:"#9ca3af" }} />
                            </button>
                          )}
                        </div>
                        <motion.button type="button" onClick={() => openPlanner(plannerQuery || undefined)} onMouseDown={spawnRipple}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                          className="btn-ripple flex items-center gap-2 flex-shrink-0"
                          style={{ padding:"0 22px", borderRadius:"16px", background:"linear-gradient(135deg,hsl(40 95% 58%),hsl(36 85% 46%))", color:"#111", fontWeight:700, fontSize:"13px", border:"none", cursor:"pointer", boxShadow:"0 6px 20px -4px hsl(40 95% 52% / 0.5)", whiteSpace:"nowrap" }}>
                          <VowzaIcon style={{ width:"14px", height:"14px" }} />
                          Plan My Event
                        </motion.button>
                      </motion.div>

                      {showSuggest && !plannerQuery && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          style={{ position:"absolute", top:"calc(100% + 8px)", left:0, right:0, borderRadius:"18px", overflow:"hidden", zIndex:50, background:"#fff", boxShadow:"0 18px 52px -10px hsl(0 0% 0% / 0.18),0 0 0 1px hsl(0 0% 0% / 0.05)" }}>
                          <p style={{ fontSize:"9px", fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.1em", padding:"14px 16px 4px" }}>Try asking</p>
                          {PLANNER_SUGGESTIONS.map((q, i) => (
                            <button key={i} type="button"
                              onClick={() => { openPlanner(q); setShowSuggest(false); }}
                              style={{ width:"100%", textAlign:"left", display:"flex", alignItems:"center", gap:"12px", padding:"10px 16px", background:"none", border:"none", cursor:"pointer", fontSize:"13px", color:"#374151", transition:"background 0.12s" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background="#f9fafb"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background="none"; }}>
                              <VowzaIcon style={{ width:"13px", height:"13px", color:"hsl(40 90% 46%)", flexShrink:0 }} />
                              {q}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Trending chips */}
              <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0.4}
                className="lg:max-w-[600px] mx-auto lg:mx-0 flex items-center justify-center lg:justify-start gap-2 overflow-x-auto no-scrollbar"
                style={{ marginTop:"clamp(1.2rem,2.4vw,1.7rem)", paddingBottom:"2px" }}>
                <span style={{ display:"flex", alignItems:"center", gap:"4px", fontSize:"10.5px", fontWeight:600, color:"hsl(0 0% 100% / 0.27)", flexShrink:0, whiteSpace:"nowrap" }}>
                  <TrendingUp style={{ width:"11px", height:"11px" }} /> Trending
                </span>
                {TRENDING.map((term, i) => (
                  <motion.button key={term} type="button"
                    whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/artists?search=${encodeURIComponent(term)}`)}
                    style={{ padding:"6px 14px", borderRadius:"100px", fontSize:"11px", fontWeight:500, cursor:"pointer", border:"1px solid hsl(0 0% 100% / 0.09)", background:"hsl(0 0% 100% / 0.055)", color:"hsl(0 0% 100% / 0.55)", flexShrink:0, whiteSpace:"nowrap", transition:"background 0.2s, border-color 0.2s, color 0.2s" }}
                    className="hover:!bg-white/10 hover:!border-white/20 hover:!text-white/90"
                  >
                    {term}
                  </motion.button>
                ))}
              </motion.div>

              {/* Mobile/tablet: swipeable service card carousel */}
              <div className="mt-6">
                <HeroVisualMobile />
              </div>
            </div>

            {/* ── Right column: premium visual composition (desktop only) ── */}
            <HeroVisual />
          </div>

        </div>
      </div>
    </section>
  );
};

const Hero = () => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileHero /> : <DesktopHero />;
};

export default Hero;
