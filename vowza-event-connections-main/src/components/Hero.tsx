import { useState, useRef, useEffect } from "react";
import { Search, MapPin, Calendar, Sparkles, TrendingUp, Clock, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { trendingSearches, popularCities } from "@/data/services";

// ─── Vowza Planner suggestions ────────────────────────────────────────────────
const plannerSuggestions = [
  "Plan a wedding for 300 guests in Hyderabad under ₹12 lakh",
  "Birthday party for 100 people in Bangalore under ₹2 lakh",
  "Corporate event for 200 guests in Mumbai under ₹5 lakh",
  "Sangeet night for 150 guests in Delhi under ₹3 lakh",
  "Engagement ceremony in Pune for 80 guests",
  "Full wedding package in Chennai for 500 guests with ₹20 lakh budget",
];

const eventOptions = [
  "Wedding", "Reception", "Birthday", "Corporate Event",
  "Haldi Ceremony", "Sangeet Night", "Engagement",
  "House Warming", "Baby Shower", "College Fest",
  "Temple Event", "Private Party",
];

const Hero = () => {
  const navigate = useNavigate();

  // ── Vowza Planner — opens the dedicated /ai-planner page ────────────────
  const openVowzaPlanner = (query?: string) => {
    if (query) sessionStorage.setItem("vowza_planner_prefill", query);
    // Navigate to the dedicated full-page experience
    navigate("/ai-planner");
  };

  // ── Form state ─────────────────────────────────────────────────────────────
  const [plannerQuery,    setPlannerQuery]    = useState("");
  const [eventType,       setEventType]       = useState("");
  const [city,            setCity]            = useState("");
  const [isAiMode,        setIsAiMode]        = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Quick search handler ───────────────────────────────────────────────────
  const handleQuickSearch = () => {
    const params = new URLSearchParams();
    if (eventType) params.set("event", eventType);
    if (city)      params.set("city", city);
    navigate(`/artists?${params.toString()}`);
  };

  const handleTrendingClick = (term: string) => navigate(`/artists?search=${encodeURIComponent(term)}`);
  const handleCityClick     = (cityName: string) => navigate(`/artists?city=${encodeURIComponent(cityName)}`);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 md:pt-20">

      {/* ── Background ───────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-br from-maroon via-maroon-dark to-foreground">
        <div className="absolute inset-0 bg-[url('/placeholder.svg')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-hero" />
      </div>

      {/* ── Decorative blobs ─────────────────────────────────────────────── */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-gold/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-maroon-light/20 rounded-full blur-3xl animate-float"
        style={{ animationDelay: "1s" }} />

      <div className="container relative z-10 px-4 py-16 md:py-28">
        <div className="max-w-4xl mx-auto text-center">

          {/* ── Badge ────────────────────────────────────────────────────── */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/20 border border-gold/30 mb-6 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-sm font-medium text-gold-light">1,500+ Verified Artists across India</span>
          </div>

          {/* ── Heading ──────────────────────────────────────────────────── */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-primary-foreground mb-6 animate-fade-in"
            style={{ animationDelay: "0.2s" }}>
            Where Talent Meets{" "}
            <span className="text-gradient-gold">Celebration</span>
          </h1>

          {/* ── Subheading ───────────────────────────────────────────────── */}
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto animate-fade-in"
            style={{ animationDelay: "0.4s" }}>
            Discover verified wedding and event professionals. Book musicians, DJs,
            photographers, dancers, and decorators for your special moments.
          </p>

          {/* ── Mode toggle ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-3 mb-4 animate-fade-in"
            style={{ animationDelay: "0.5s" }}>
            <button
              onClick={() => setIsAiMode(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                !isAiMode ? "bg-gold text-foreground shadow-gold" : "bg-white/10 text-primary-foreground/70 hover:bg-white/20"
              }`}
            >
              Quick Search
            </button>
            <button
              onClick={() => setIsAiMode(true)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                isAiMode ? "bg-gold text-foreground shadow-gold" : "bg-white/10 text-primary-foreground/70 hover:bg-white/20"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              ✨ Vowza Planner
            </button>
          </div>

          {/* ── Search / Planner Box ─────────────────────────────────────── */}
          <div className="bg-card/95 backdrop-blur-md rounded-2xl p-4 md:p-5 shadow-elevated max-w-3xl mx-auto animate-fade-in-up"
            style={{ animationDelay: "0.6s" }}>

            {isAiMode ? (
              /* ── Vowza Planner (AI event planning assistant) ─────────── */
              <div ref={suggestionsRef} className="relative">
                {/* Description strip */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Sparkles className="w-4 h-4 text-gold flex-shrink-0" />
                  <p className="text-xs text-muted-foreground text-left">
                    Describe your event and Vowza Planner will recommend vendors, estimate budget, and build a complete plan.
                  </p>
                </div>

                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary border-2 border-gold/30 focus-within:border-gold transition-colors">
                  <Sparkles className="w-5 h-5 text-gold flex-shrink-0" />
                  <input
                    type="text"
                    value={plannerQuery}
                    onChange={(e) => { setPlannerQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Describe your dream event... e.g., Plan a wedding for 300 guests in Hyderabad under ₹10 lakh."
                    className="flex-1 bg-transparent text-sm md:text-base font-medium text-foreground focus:outline-none placeholder:text-muted-foreground"
                  />
                  {plannerQuery && (
                    <button onClick={() => setPlannerQuery("")}>
                      <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                  <Button
                    onClick={() => openVowzaPlanner(plannerQuery || undefined)}
                    className="bg-gradient-gold text-foreground font-semibold hover:opacity-90 shadow-gold flex-shrink-0"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    Plan My Event
                  </Button>
                </div>

                {/* Suggestions dropdown */}
                {showSuggestions && plannerQuery.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl shadow-elevated border border-border z-50 overflow-hidden">
                    <p className="text-xs text-muted-foreground px-4 pt-3 pb-1 font-medium uppercase tracking-wide">
                      Start planning with
                    </p>
                    {plannerSuggestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => { openVowzaPlanner(q); setShowSuggestions(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-secondary transition-colors text-sm flex items-center gap-3"
                      >
                        <Sparkles className="w-4 h-4 text-gold flex-shrink-0" />
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* What Vowza Planner does */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 px-1">
                  {[
                    { icon: "🎯", text: "Vendor Matching" },
                    { icon: "💰", text: "Budget Planning" },
                    { icon: "📅", text: "Full Timeline" },
                    { icon: "✅", text: "Smart Checklist" },
                  ].map(item => (
                    <div key={item.text} className="flex items-center gap-1.5 text-xs text-primary-foreground/60">
                      <span>{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Quick structured search ─────────────────────────────── */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Event Type */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary relative">
                  <Calendar className="w-5 h-5 text-maroon flex-shrink-0" />
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Event Type</p>
                    <div className="relative">
                      <select
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                        className="bg-transparent text-sm font-medium text-foreground focus:outline-none w-full appearance-none pr-4"
                      >
                        <option value="">Select event</option>
                        {eventOptions.map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* City */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary">
                  <MapPin className="w-5 h-5 text-maroon flex-shrink-0" />
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">City</p>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Enter city"
                      className="bg-transparent text-sm font-medium text-foreground focus:outline-none w-full placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                {/* Search Button */}
                <Button
                  onClick={handleQuickSearch}
                  className="h-full min-h-[56px] bg-gradient-gold text-foreground font-semibold text-base hover:opacity-90 transition-opacity shadow-gold"
                >
                  <Search className="w-5 h-5 mr-2" />
                  Find Artists
                </Button>
              </div>
            )}
          </div>

          {/* ── Trending searches ─────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5 animate-fade-in"
            style={{ animationDelay: "0.75s" }}>
            <span className="flex items-center gap-1 text-xs text-primary-foreground/60">
              <TrendingUp className="w-3.5 h-3.5" />
              Trending:
            </span>
            {trendingSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleTrendingClick(term)}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-primary-foreground/80 text-xs font-medium transition-all hover:scale-105"
              >
                {term}
              </button>
            ))}
          </div>

          {/* ── Popular cities ────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 animate-fade-in"
            style={{ animationDelay: "0.85s" }}>
            <span className="flex items-center gap-1 text-xs text-primary-foreground/60">
              <MapPin className="w-3.5 h-3.5" />
              Cities:
            </span>
            {popularCities.slice(0, 6).map((c) => (
              <button
                key={c.id}
                onClick={() => handleCityClick(c.name)}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-primary-foreground/80 text-xs font-medium transition-all hover:scale-105"
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* ── Stats ────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 mt-10 animate-fade-in"
            style={{ animationDelay: "0.9s" }}>
            {[
              { value: "1,500+", label: "Verified Artists" },
              { value: "10,000+", label: "Events Completed" },
              { value: "4.8★", label: "Average Rating" },
              { value: "50+", label: "Cities Covered" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-gold">{stat.value}</p>
                <p className="text-sm text-primary-foreground/70">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* ── Vowza Planner CTA strip ───────────────────────────────────── */}
          <div className="mt-6 animate-fade-in" style={{ animationDelay: "1s" }}>
            <button
              onClick={() => openVowzaPlanner()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-primary-foreground/80 text-sm font-medium transition-all hover:scale-105 border border-white/20"
            >
              <Sparkles className="w-4 h-4 text-gold" />
              Open ✨ Vowza Planner — your personal AI event planning assistant
            </button>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
