import { useState } from "react";
import { ChevronDown, MapPin, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EVENT_OPTIONS = [
  "Wedding", "Reception", "Birthday Party", "Corporate Event",
  "Haldi Ceremony", "Sangeet Night", "Engagement", "House Warming",
  "Baby Shower", "College Fest", "Private Party", "Anniversary",
] as const;

const MOBILE_CARDS = [
  { label: "Wedding Photography", image: "/images/wedding-photography.jpg" },
  { label: "Wedding Decoration", image: "/images/wedding-decoration.jpg" },
  { label: "DJ & Music", image: "/images/dj-music.jpg" },
  { label: "Bridal Makeup", image: "/images/bridal-makeup.jpg" },
  { label: "Catering", image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=75&auto=format&fit=crop" },
] as const;

const MobileHero = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"search" | "ai">("search");
  const [eventType, setEventType] = useState("");
  const [location, setLocation] = useState("");
  const [plannerQuery, setPlannerQuery] = useState("");

  const findArtists = () => {
    const params = new URLSearchParams();
    if (eventType) params.set("event", eventType);
    if (location.trim()) params.set("city", location.trim());
    navigate(`/artists?${params.toString()}`);
  };

  const openPlanner = () => {
    if (plannerQuery.trim()) {
      sessionStorage.setItem("vowza_planner_prefill", plannerQuery.trim());
    }
    navigate("/ai-planner");
  };

  return (
    <section className="flex w-full flex-col overflow-x-hidden bg-[#07060d] px-4 pb-8 pt-[72px]">
      <div className="mx-auto flex w-full max-w-[600px] flex-col">
        {/* ── Heading block ── */}
        <div className="flex w-full flex-col text-center">
          <div className="mb-3 inline-flex self-center items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <Sparkles className="h-3 w-3 text-gold" />
            <span className="text-[10.5px] font-semibold tracking-wide text-white/70">India&apos;s Premium Event Marketplace</span>
          </div>

          <h1 className="w-full overflow-visible break-normal font-display text-[clamp(36px,11vw,44px)] font-bold leading-[1.08] tracking-[-0.03em] text-white">
            Where <span className="text-gradient-gold">Talent</span><br />
            Meets <span className="text-gradient-maroon">Celebration</span>
          </h1>

          <p className="mt-3 w-full max-w-[480px] text-[clamp(15px,4.2vw,18px)] font-semibold leading-[2.1] text-white/60">
            One Platform.<br />
            Trusted Professionals.<br />
            Unforgettable Celebrations.
          </p>
        </div>

        {/* ── Quick Search / AI Planner toggle ── */}
        <div className="mt-5 flex w-full gap-2">
          <button
            type="button"
            onClick={() => setMode("search")}
            className={`flex h-11 flex-1 items-center justify-center rounded-xl text-[13px] font-semibold transition-colors ${mode === "search" ? "bg-white text-zinc-950" : "border border-white/15 bg-white/5 text-white/75"}`}
          >
            Quick Search
          </button>
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-colors ${mode === "ai" ? "bg-gradient-gold text-zinc-950" : "border border-white/15 bg-white/5 text-white/75"}`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Planner
          </button>
        </div>

        {/* ── Search card ── */}
        {mode === "search" ? (
          <div className="mt-3 flex w-full flex-col rounded-2xl bg-white p-2 shadow-2xl">
            <label className="mb-2 flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left">
              <Sparkles className="h-[14px] w-[14px] shrink-0 text-maroon" />
              <span className="min-w-0 flex-1">
                <span className="mb-0.5 block text-[9px] font-bold uppercase leading-none tracking-[0.09em] text-gray-400">Event Type</span>
                <span className="block w-full">
                  <select value={eventType} onChange={(event) => setEventType(event.target.value)} className="w-full appearance-none bg-transparent pr-4 text-[13px] font-semibold text-zinc-900 outline-none">
                    <option value="">Select Event Type</option>
                    {EVENT_OPTIONS.map((event) => <option key={event} value={event}>{event}</option>)}
                  </select>
                </span>
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
            </label>

            <label className="mb-2 flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left">
              <MapPin className="h-[14px] w-[14px] shrink-0 text-maroon" />
              <span className="min-w-0 flex-1">
                <span className="mb-0.5 block text-[9px] font-bold uppercase leading-none tracking-[0.09em] text-gray-400">Location</span>
                <input value={location} onChange={(event) => setLocation(event.target.value)} onKeyDown={(event) => event.key === "Enter" && findArtists()} placeholder="Search by City, District or State" className="w-full bg-transparent text-[13px] font-semibold text-zinc-900 outline-none placeholder:text-gray-400" />
              </span>
            </label>

            <button type="button" onClick={findArtists} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-maroon text-[13px] font-bold text-white shadow-lg">
              <Search className="h-4 w-4" />
              Find Verified Artists
            </button>
          </div>
        ) : (
          <div className="mt-3 flex w-full flex-col rounded-2xl bg-white p-2 shadow-2xl">
            <label className="mb-2 flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left">
              <Sparkles className="h-[14px] w-[14px] shrink-0 text-gold-dark" />
              <span className="min-w-0 flex-1">
                <span className="mb-0.5 block text-[9px] font-bold uppercase leading-none tracking-[0.09em] text-gray-400">Tell us about your event</span>
                <input value={plannerQuery} onChange={(event) => setPlannerQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && openPlanner()} placeholder="Plan a wedding for 300 guests…" className="w-full bg-transparent text-[13px] font-semibold text-zinc-900 outline-none placeholder:text-gray-400" />
              </span>
            </label>
            <button type="button" onClick={openPlanner} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold text-[13px] font-bold text-zinc-950 shadow-lg">
              <Sparkles className="h-4 w-4" />
              Plan My Event
            </button>
          </div>
        )}

        {/* ── Category quick cards — visible immediately after search ── */}
        <div className="mt-4 flex w-full gap-2.5 overflow-x-auto pb-1 no-scrollbar" aria-label="Browse event categories">
          {MOBILE_CARDS.map((card) => (
            <button key={card.label} type="button" onClick={() => navigate(`/artists?search=${encodeURIComponent(card.label)}`)} className="flex w-[130px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/10 text-left shadow-xl">
              <img src={card.image} alt="" className="h-20 w-full object-cover" loading="lazy" />
              <span className="flex min-h-[44px] items-center px-2.5 text-[11px] font-semibold leading-tight text-white">{card.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MobileHero;
