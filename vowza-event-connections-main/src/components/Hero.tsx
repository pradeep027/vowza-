// ─── Hero — Balanced, Compact, Investor-Ready ────────────────────────────────
// Desktop: single horizontal search bar [Event Type | Location | Button]
// Tablet/Mobile: stacked layout
// Only heading + description + toggle + search + 5 trending chips above the fold

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Search, MapPin, Sparkles, TrendingUp, ChevronDown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ── Static data ───────────────────────────────────────────────────────────────
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

// Exactly 5 trending chips
const TRENDING = [
  "Wedding Photographers",
  "DJ for Sangeet",
  "Bridal Makeup",
  "Wedding Decorators",
  "Caterers",
] as const;

// ── Background — module scope, never remounts ─────────────────────────────────
const HeroBg = memo(() => (
  <>
    <div
      aria-hidden
      style={{
        position:"absolute", top:"-18%", left:"50%",
        transform:"translateX(-50%) translateZ(0)",
        width:"min(94vw,900px)", height:"min(78vw,740px)",
        background:
          "radial-gradient(ellipse 58% 52% at 40% 34%, hsl(345 72% 30% / 0.62) 0%, transparent 68%)," +
          "radial-gradient(ellipse 48% 42% at 64% 22%, hsl(40 95% 52% / 0.22) 0%, transparent 65%)",
        filter:"blur(56px)", pointerEvents:"none",
      }}
    />
    <div
      aria-hidden
      style={{
        position:"absolute", bottom:0, left:"50%",
        transform:"translateX(-50%) translateZ(0)",
        width:"min(68vw,660px)", height:"min(44vw,400px)",
        background:"radial-gradient(ellipse at center, hsl(224 60% 36% / 0.14) 0%, transparent 68%)",
        filter:"blur(72px)", pointerEvents:"none",
      }}
    />
    <div
      aria-hidden
      style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:
          "linear-gradient(hsl(0 0% 100% / 0.020) 1px, transparent 1px)," +
          "linear-gradient(90deg, hsl(0 0% 100% / 0.020) 1px, transparent 1px)",
        backgroundSize:"72px 72px",
      }}
    />
  </>
));
HeroBg.displayName = "HeroBg";

// ── Hero ──────────────────────────────────────────────────────────────────────
const Hero = () => {
  const navigate = useNavigate();

  const [tab,             setTab]          = useState<"search"|"ai">("search");
  const [eventType,       setEventType]    = useState("");
  const [location,        setLocation]     = useState("");
  const [plannerQuery,    setPlannerQuery] = useState("");
  const [showSuggestions, setShowSuggest]  = useState(false);
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

  // shared inline styles
  const fieldWrap: React.CSSProperties = {
    display:"flex", alignItems:"center", gap:"10px",
    flex:1, padding:"9px 14px",
    borderRadius:"12px", background:"hsl(220 14% 97%)",
    minWidth:0,
  };
  const fieldLabel: React.CSSProperties = {
    fontSize:"9px", fontWeight:700, color:"#9ca3af",
    textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"1px",
  };
  const fieldInput: React.CSSProperties = {
    width:"100%", background:"transparent",
    fontSize:"13px", fontWeight:600, color:"#111",
    border:"none", outline:"none",
  };

  return (
    <section className="relative overflow-hidden" style={{ background:"#07060d" }}>
      <HeroBg />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div
        className="relative z-10"
        style={{
          paddingTop:"clamp(4.5rem, 9vw, 6.5rem)",
          paddingBottom:"clamp(3.5rem, 7vw, 5rem)",
        }}
      >
        <div className="container px-4">
          <div style={{ maxWidth:"740px", margin:"0 auto", textAlign:"center" }}>

            {/* ── Heading ─────────────────────────────────────────────── */}
            <h1
              className="font-display font-bold text-white animate-fade-up"
              style={{
                fontSize:"clamp(2.2rem, 5.2vw, 3.75rem)",
                lineHeight:1.09,
                letterSpacing:"-0.025em",
                marginBottom:"clamp(1rem, 2.2vw, 1.35rem)",
              }}
            >
              Where{" "}
              <span style={{
                background:"linear-gradient(135deg,hsl(40 95% 68%) 0%,hsl(40 90% 52%) 55%,hsl(36 85% 44%) 100%)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
              }}>
                Talent
              </span>{" "}Meets{" "}
              {/* "Celebration" ~4% smaller via font-size on the span */}
              <span style={{
                fontSize:"0.96em",
                background:"linear-gradient(135deg,hsl(345 68% 60%) 0%,hsl(345 72% 42%) 100%)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
              }}>
                Celebration
              </span>
            </h1>

            {/* ── Description ─────────────────────────────────────────── */}
            <p
              className="animate-fade-up delay-100"
              style={{
                fontSize:"clamp(0.96rem, 1.7vw, 1.075rem)",
                lineHeight:1.72,
                color:"hsl(0 0% 100% / 0.52)",
                maxWidth:"580px",
                margin:"0 auto",
                marginBottom:"clamp(1.75rem, 3.5vw, 2.5rem)",
              }}
            >
              Find and book verified event professionals across India—from
              photographers and decorators to DJs, caterers, bands, and
              entertainers—all in one trusted platform.
            </p>

            {/* ── Toggle ──────────────────────────────────────────────── */}
            <div
              className="flex justify-center animate-fade-up delay-200"
              style={{ marginBottom:"clamp(0.9rem, 1.8vw, 1.25rem)" }}
            >
              <div style={{
                display:"inline-flex", alignItems:"center", gap:"3px",
                padding:"4px", borderRadius:"13px",
                background:"hsl(0 0% 100% / 0.065)",
                border:"1px solid hsl(0 0% 100% / 0.09)",
                backdropFilter:"blur(14px)",
              }}>
                <button
                  type="button"
                  onClick={() => setTab("search")}
                  style={{
                    padding:"7px 18px", borderRadius:"10px",
                    fontSize:"12.5px", fontWeight:600,
                    border:"none", cursor:"pointer",
                    transition:"all 0.18s cubic-bezier(0.4,0,0.2,1)",
                    ...(tab==="search"
                      ? { background:"#fff", color:"#111", boxShadow:"0 1px 8px hsl(0 0% 0% / 0.13)" }
                      : { background:"transparent", color:"hsl(0 0% 100% / 0.48)" }),
                  }}
                >
                  Quick Search
                </button>
                <button
                  type="button"
                  onClick={() => setTab("ai")}
                  style={{
                    display:"flex", alignItems:"center", gap:"5px",
                    padding:"7px 18px", borderRadius:"10px",
                    fontSize:"12.5px", fontWeight:600,
                    border:"none", cursor:"pointer",
                    transition:"all 0.18s cubic-bezier(0.4,0,0.2,1)",
                    ...(tab==="ai"
                      ? {
                          background:"linear-gradient(135deg,hsl(40 95% 56%),hsl(36 85% 44%))",
                          color:"#111", boxShadow:"0 3px 14px hsl(40 95% 52% / 0.30)",
                        }
                      : { background:"transparent", color:"hsl(0 0% 100% / 0.48)" }),
                  }}
                >
                  <Sparkles style={{ width:"13px", height:"13px" }} />
                  Vowza AI Planner
                </button>
              </div>
            </div>

            {/* ── Search box ──────────────────────────────────────────── */}
            <div
              className="animate-fade-up delay-300"
              style={{ maxWidth:"680px", margin:"0 auto" }}
            >
              {tab === "search" ? (
                /* ── Quick Search ── */
                <div
                  style={{
                    borderRadius:"16px",
                    padding:"5px",
                    background:"hsl(0 0% 100% / 0.97)",
                    boxShadow:
                      "0 0 0 1px hsl(0 0% 0% / 0.05)," +
                      "0 16px 50px -8px hsl(0 0% 0% / 0.42)",
                  }}
                >
                  {/* DESKTOP: single row */}
                  <div className="hidden md:flex items-center gap-0">

                    {/* Event Type */}
                    <div style={{ ...fieldWrap, borderRadius:"12px 0 0 12px", borderRight:"1px solid #e5e7eb" }}>
                      <Sparkles style={{ width:"15px", height:"15px", color:"hsl(345 72% 36%)", flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={fieldLabel}>Event Type</p>
                        <div style={{ position:"relative" }}>
                          <select
                            value={eventType}
                            onChange={e => setEventType(e.target.value)}
                            style={{ ...fieldInput, appearance:"none", paddingRight:"14px", cursor:"pointer" }}
                          >
                            <option value="">Select Event Type</option>
                            {EVENT_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                          <ChevronDown style={{
                            position:"absolute", right:0, top:"50%",
                            transform:"translateY(-50%)",
                            width:"11px", height:"11px", color:"#9ca3af", pointerEvents:"none",
                          }} />
                        </div>
                      </div>
                    </div>

                    {/* Location */}
                    <div style={{ ...fieldWrap, borderRadius:0 }}>
                      <MapPin style={{ width:"15px", height:"15px", color:"hsl(345 72% 36%)", flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={fieldLabel}>Location</p>
                        <input
                          type="text"
                          value={location}
                          onChange={e => setLocation(e.target.value)}
                          onKeyDown={e => e.key==="Enter" && handleSearch()}
                          placeholder="Search by City, District or State"
                          autoComplete="off"
                          style={{ ...fieldInput, color: location ? "#111" : undefined }}
                        />
                      </div>
                    </div>

                    {/* Button — ~18% narrower than full-width */}
                    <button
                      type="button"
                      onClick={handleSearch}
                      style={{
                        display:"flex", alignItems:"center", justifyContent:"center",
                        gap:"6px",
                        padding:"10px 18px",
                        borderRadius:"0 12px 12px 0",
                        background:"linear-gradient(135deg,hsl(345 72% 36%),hsl(345 78% 26%))",
                        color:"#fff", fontWeight:700, fontSize:"12.5px",
                        border:"none", cursor:"pointer", flexShrink:0,
                        boxShadow:"0 5px 16px -4px hsl(345 72% 32% / 0.52)",
                        transition:"all 0.18s cubic-bezier(0.4,0,0.2,1)",
                        whiteSpace:"nowrap",
                        margin:"0",
                        alignSelf:"stretch",
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.transform = "translateY(-1px)";
                        el.style.boxShadow = "0 9px 22px -4px hsl(345 72% 32% / 0.60)";
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.transform = "translateY(0)";
                        el.style.boxShadow = "0 5px 16px -4px hsl(345 72% 32% / 0.52)";
                      }}
                    >
                      <Search style={{ width:"14px", height:"14px" }} />
                      Find Verified Artists
                    </button>
                  </div>

                  {/* MOBILE/TABLET: stacked */}
                  <div className="flex flex-col gap-1.5 md:hidden">
                    <div style={{ ...fieldWrap, borderRadius:"12px" }}>
                      <Sparkles style={{ width:"15px", height:"15px", color:"hsl(345 72% 36%)", flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={fieldLabel}>Event Type</p>
                        <div style={{ position:"relative" }}>
                          <select
                            value={eventType}
                            onChange={e => setEventType(e.target.value)}
                            style={{ ...fieldInput, appearance:"none", paddingRight:"14px", cursor:"pointer" }}
                          >
                            <option value="">Select Event Type</option>
                            {EVENT_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                          <ChevronDown style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)", width:"11px", height:"11px", color:"#9ca3af", pointerEvents:"none" }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ ...fieldWrap, borderRadius:"12px" }}>
                      <MapPin style={{ width:"15px", height:"15px", color:"hsl(345 72% 36%)", flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={fieldLabel}>Location</p>
                        <input
                          type="text"
                          value={location}
                          onChange={e => setLocation(e.target.value)}
                          onKeyDown={e => e.key==="Enter" && handleSearch()}
                          placeholder="Search by City, District or State"
                          autoComplete="off"
                          style={fieldInput}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSearch}
                      style={{
                        display:"flex", alignItems:"center", justifyContent:"center",
                        gap:"6px", padding:"11px 0", borderRadius:"12px",
                        background:"linear-gradient(135deg,hsl(345 72% 36%),hsl(345 78% 26%))",
                        color:"#fff", fontWeight:700, fontSize:"13px",
                        border:"none", cursor:"pointer",
                        boxShadow:"0 5px 16px -4px hsl(345 72% 32% / 0.52)",
                      }}
                    >
                      <Search style={{ width:"14px", height:"14px" }} />
                      Find Verified Artists
                    </button>
                  </div>
                </div>

              ) : (
                /* ── Vowza AI Planner ── */
                <div ref={suggestRef} style={{ position:"relative" }}>
                  <div style={{
                    borderRadius:"16px", padding:"5px",
                    display:"flex", gap:"5px",
                    background:"hsl(0 0% 100% / 0.97)",
                    boxShadow:"0 0 0 1px hsl(0 0% 0% / 0.05),0 16px 50px -8px hsl(0 0% 0% / 0.42)",
                  }}>
                    <div style={{ ...fieldWrap, borderRadius:"12px" }}>
                      <Sparkles style={{ width:"15px", height:"15px", color:"hsl(40 90% 46%)", flexShrink:0 }} />
                      <input
                        type="text"
                        value={plannerQuery}
                        onChange={e => { setPlannerQuery(e.target.value); setShowSuggest(true); }}
                        onFocus={() => setShowSuggest(true)}
                        placeholder="Plan a wedding for 300 guests in Hyderabad under ₹12 lakh…"
                        autoComplete="off"
                        style={{ ...fieldInput, flex:1 }}
                      />
                      {plannerQuery && (
                        <button type="button" onClick={() => setPlannerQuery("")}
                          style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex" }}>
                          <X style={{ width:"13px", height:"13px", color:"#9ca3af" }} />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openPlanner(plannerQuery || undefined)}
                      style={{
                        display:"flex", alignItems:"center", gap:"6px",
                        padding:"10px 18px", borderRadius:"12px",
                        background:"linear-gradient(135deg,hsl(40 95% 58%),hsl(36 85% 46%))",
                        color:"#111", fontWeight:700, fontSize:"12.5px",
                        border:"none", cursor:"pointer", flexShrink:0,
                        boxShadow:"0 5px 16px -4px hsl(40 95% 52% / 0.46)",
                        transition:"all 0.18s cubic-bezier(0.4,0,0.2,1)",
                        whiteSpace:"nowrap",
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.transform = "translateY(-1px)";
                        el.style.boxShadow = "0 9px 22px -4px hsl(40 95% 52% / 0.56)";
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.transform = "translateY(0)";
                        el.style.boxShadow = "0 5px 16px -4px hsl(40 95% 52% / 0.46)";
                      }}
                    >
                      <Sparkles style={{ width:"14px", height:"14px" }} />
                      Plan My Event
                    </button>
                  </div>

                  {showSuggestions && !plannerQuery && (
                    <div
                      className="animate-scale-in"
                      style={{
                        position:"absolute", top:"calc(100% + 8px)",
                        left:0, right:0, borderRadius:"16px",
                        overflow:"hidden", zIndex:50,
                        background:"#fff",
                        boxShadow:"0 18px 52px -10px hsl(0 0% 0% / 0.18),0 0 0 1px hsl(0 0% 0% / 0.05)",
                      }}
                    >
                      <p style={{ fontSize:"9px", fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.1em", padding:"14px 16px 4px" }}>
                        Try asking
                      </p>
                      {PLANNER_SUGGESTIONS.map((q, i) => (
                        <button
                          key={i} type="button"
                          onClick={() => { openPlanner(q); setShowSuggest(false); }}
                          style={{
                            width:"100%", textAlign:"left",
                            display:"flex", alignItems:"center", gap:"12px",
                            padding:"10px 16px", background:"none",
                            border:"none", cursor:"pointer",
                            fontSize:"13px", color:"#374151",
                            transition:"background 0.12s",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                        >
                          <Sparkles style={{ width:"13px", height:"13px", color:"hsl(40 90% 46%)", flexShrink:0 }} />
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Trending — 5 chips, single row, horizontal scroll on mobile ── */}
            <div
              className="animate-fade-up delay-400"
              style={{
                marginTop:"clamp(1.1rem, 2.4vw, 1.6rem)",
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                gap:"7px",
                overflowX:"auto",
                paddingBottom:"2px",
                WebkitOverflowScrolling:"touch",
                scrollbarWidth:"none",
              }}
            >
              <span style={{
                display:"flex", alignItems:"center", gap:"4px",
                fontSize:"10.5px", fontWeight:600,
                color:"hsl(0 0% 100% / 0.27)",
                flexShrink:0, whiteSpace:"nowrap",
              }}>
                <TrendingUp style={{ width:"11px", height:"11px" }} />
                Trending
              </span>

              {TRENDING.map(term => (
                <button
                  key={term}
                  type="button"
                  onClick={() => navigate(`/artists?search=${encodeURIComponent(term)}`)}
                  style={{
                    padding:"5.5px 13px",
                    borderRadius:"100px",
                    fontSize:"11px", fontWeight:500,
                    cursor:"pointer",
                    border:"1px solid hsl(0 0% 100% / 0.09)",
                    background:"hsl(0 0% 100% / 0.055)",
                    color:"hsl(0 0% 100% / 0.52)",
                    transition:"all 0.15s ease",
                    flexShrink:0, whiteSpace:"nowrap",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background   = "hsl(0 0% 100% / 0.11)";
                    el.style.borderColor  = "hsl(0 0% 100% / 0.22)";
                    el.style.color        = "hsl(0 0% 100% / 0.88)";
                    el.style.boxShadow    = "0 0 10px hsl(0 0% 100% / 0.06)";
                    el.style.transform    = "translateY(-1px)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background   = "hsl(0 0% 100% / 0.055)";
                    el.style.borderColor  = "hsl(0 0% 100% / 0.09)";
                    el.style.color        = "hsl(0 0% 100% / 0.52)";
                    el.style.boxShadow    = "none";
                    el.style.transform    = "translateY(0)";
                  }}
                >
                  {term}
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
