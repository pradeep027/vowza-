
// ─── Wedding Planner Engine ───────────────────────────────────────────────────
// Generates a complete day-by-day event plan like a professional wedding planner.
// Output order: Overview → Day-wise Itinerary → Budget → Vendors → Checklist → Tips

import type {
  PlannerContext, AIResponse, BudgetPlan, BudgetLineItem,
  EventTimeline, TimelineMilestone, HourlySlot, DaySchedule,
  VendorRecommendation, WeatherAdvice, ChecklistItem,
  FoodPlan, NegotiationMessage, RiskAnalysis, RiskItem,
  SuccessScore, ScoreCategory, EventPlan,
  EventCategory, Season, LuxuryLevel,
  // New wedding planner types
  WeddingPlan, WeddingOverview, DayPlan, DayBudget,
  DayChecklist, DayVendor, TimeSlot,
} from "./aiPlannerTypes";
// Appends ONE natural follow-up question (Veg/Non-Veg, Indoor/Outdoor, etc.)
// to a completed structured response — never blocks the plan itself.
// NOTE: aiOrchestrator is imported dynamically (not statically) to avoid a
// circular import cycle, matching the existing pattern used in processMessage().
function withFollowUp(text: string, ctx: PlannerContext): string {
  // Inline soft-followup logic (kept in sync with aiOrchestrator.SOFT_FOLLOWUPS)
  // to avoid a synchronous circular import while still asking ONE natural
  // follow-up question per response.
  if (!ctx.foodPreference) return `${text}\n\nWould you like **Veg**, **Non-Veg**, or **Both** for the food?`;
  if (!ctx.serviceStyle)   return `${text}\n\nShould the food service be **Buffet** or **Table Service**?`;
  if (!ctx.venueType)      return `${text}\n\nAre you thinking **Indoor** or **Outdoor** for the venue?`;
  if (!ctx.styleVibe)      return `${text}\n\nDo you prefer a **Traditional** or **Modern** theme?`;
  if (!ctx.luxuryLevel)    return `${text}\n\nShould I plan this as **Luxury**, **Premium**, **Standard**, or **Budget-friendly**?`;
  if (!ctx.timeOfDay)      return `${text}\n\nIs this a **Morning**, **Afternoon**, **Evening**, or **Night** event?`;
  return text;
}

const CITY_MUL: Record<string, number> = {
  mumbai: 1.55, delhi: 1.45, bangalore: 1.35, chennai: 1.15,
  hyderabad: 1.0, pune: 1.12, kolkata: 1.0, ahmedabad: 0.92,
  vizag: 0.87, vijayawada: 0.85, warangal: 0.80, nagpur: 0.92,
  jaipur: 0.95, lucknow: 0.9, surat: 0.9, indore: 0.88,
  kochi: 0.95, bhopal: 0.85, coimbatore: 0.9, vadodara: 0.9,
  default: 1.0,
};
const SEASON_MUL: Record<Season, number> = { winter: 1.3, autumn: 1.15, summer: 0.88, monsoon: 0.82 };
const LUXURY_MUL: Record<LuxuryLevel, number> = { budget: 0.58, standard: 1.0, premium: 1.65, luxury: 2.6 };

export function fmt(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)} lakh`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function getCityMul(city?: string): number { return CITY_MUL[city?.toLowerCase() ?? ""] ?? CITY_MUL.default; }
function getSeason(d?: string): Season {
  if (!d) return "winter";
  const l = d.toLowerCase();
  if (/jun|jul|aug|sep/.test(l)) return "monsoon";
  if (/mar|apr|may/.test(l)) return "summer";
  if (/oct/.test(l)) return "autumn";
  return "winter";
}
function getMul(ctx: PlannerContext): number {
  return getCityMul(ctx.city) * SEASON_MUL[getSeason(ctx.eventDate)] * LUXURY_MUL[ctx.luxuryLevel ?? "standard"];
}

const BUDGET_ALLOC: Record<string, { cat: string; pct: number; notes: string; canReduce: boolean; reduceTip: string }[]> = {
  wedding: [
    { cat: "Venue",           pct: 28, notes: "Hall, lawn, parking, electricity", canReduce: true,  reduceTip: "Weekday booking saves 25-35%" },
    { cat: "Catering",        pct: 30, notes: "Food & beverages",                 canReduce: true,  reduceTip: "Buffet over plated; fewer live counters" },
    { cat: "Photography",     pct: 10, notes: "Photographer + videographer",      canReduce: false, reduceTip: "Never cut — memories are forever" },
    { cat: "Decoration",      pct: 12, notes: "Floral, stage, mandap, lighting",  canReduce: true,  reduceTip: "Seasonal flowers save 25-40%" },
    { cat: "Entertainment",   pct: 6,  notes: "DJ / Band / Performers",           canReduce: true,  reduceTip: "Local talent vs. celebrity" },
    { cat: "Makeup & Mehendi",pct: 5,  notes: "Bridal makeup, mehendi, hair",     canReduce: false, reduceTip: "Book 4 months ahead" },
    { cat: "Invitations",     pct: 2,  notes: "Print, digital, return gifts",     canReduce: true,  reduceTip: "Digital saves ₹15K-₹40K" },
    { cat: "Transport",       pct: 3,  notes: "Guest shuttles, car hire",         canReduce: true,  reduceTip: "Limit to outstation guests" },
    { cat: "Emergency Buffer",pct: 4,  notes: "Unexpected costs always arise",    canReduce: false, reduceTip: "Never skip" },
  ],
  reception:  [ { cat:"Venue",pct:30,notes:"Hall/banquet",canReduce:true,reduceTip:"Compare 3 venues"},{cat:"Catering",pct:32,notes:"Dinner buffet",canReduce:true,reduceTip:"Finger foods reduce waste"},{cat:"Photography",pct:10,notes:"Photo+video",canReduce:false,reduceTip:""},{cat:"Decoration",pct:14,notes:"Stage, lighting",canReduce:true,reduceTip:"Drape is cheaper"},{cat:"Entertainment",pct:8,notes:"DJ, anchor",canReduce:true,reduceTip:""},{cat:"Misc",pct:6,notes:"Buffer",canReduce:false,reduceTip:""} ],
  birthday:   [ { cat:"Venue",pct:22,notes:"Hall or lawn",canReduce:true,reduceTip:"Home saves 25%"},{cat:"Catering",pct:30,notes:"Snacks, meals, cake",canReduce:true,reduceTip:"Order cake locally"},{cat:"Decoration",pct:22,notes:"Theme, balloons",canReduce:true,reduceTip:"DIY saves ₹5K"},{cat:"Entertainment",pct:15,notes:"DJ, games",canReduce:true,reduceTip:""},{cat:"Photography",pct:6,notes:"Photographer",canReduce:false,reduceTip:""},{cat:"Misc",pct:5,notes:"Gifts, buffer",canReduce:false,reduceTip:""} ],
  corporate:  [ { cat:"Venue",pct:35,notes:"Hall, AV",canReduce:true,reduceTip:"Book hotel directly"},{cat:"Catering",pct:25,notes:"Meals, breaks",canReduce:true,reduceTip:""},{cat:"AV & Tech",pct:15,notes:"Projectors, mics",canReduce:false,reduceTip:""},{cat:"Decoration",pct:10,notes:"Stage, branding",canReduce:true,reduceTip:""},{cat:"Entertainment",pct:8,notes:"Anchor",canReduce:true,reduceTip:""},{cat:"Misc",pct:7,notes:"Buffer",canReduce:false,reduceTip:""} ],
  sangeet:    [ { cat:"Venue",pct:22,notes:"Lawn/terrace",canReduce:true,reduceTip:""},{cat:"Entertainment",pct:30,notes:"DJ, band, dancers",canReduce:true,reduceTip:""},{cat:"Catering",pct:22,notes:"Dinner/snacks",canReduce:true,reduceTip:""},{cat:"Decoration",pct:16,notes:"LED, floral",canReduce:true,reduceTip:""},{cat:"Photography",pct:7,notes:"Candid",canReduce:false,reduceTip:""},{cat:"Misc",pct:3,notes:"Buffer",canReduce:false,reduceTip:""} ],
  engagement: [ { cat:"Venue",pct:26,notes:"Banquet/garden",canReduce:true,reduceTip:""},{cat:"Catering",pct:28,notes:"Lunch/dinner",canReduce:true,reduceTip:""},{cat:"Decoration",pct:22,notes:"Stage, rings",canReduce:true,reduceTip:""},{cat:"Photography",pct:12,notes:"Photo+video",canReduce:false,reduceTip:""},{cat:"Makeup",pct:7,notes:"Bridal makeup",canReduce:false,reduceTip:""},{cat:"Misc",pct:5,notes:"Buffer",canReduce:false,reduceTip:""} ],
  haldi:      [ { cat:"Decoration",pct:35,notes:"Floral, props",canReduce:true,reduceTip:""},{cat:"Catering",pct:25,notes:"Snacks, sweets",canReduce:true,reduceTip:""},{cat:"Photography",pct:20,notes:"Candid",canReduce:false,reduceTip:""},{cat:"Makeup",pct:12,notes:"Dress+makeup",canReduce:true,reduceTip:""},{cat:"Misc",pct:8,notes:"Haldi kits",canReduce:false,reduceTip:""} ],
  mehendi:    [ { cat:"Mehendi Artists",pct:40,notes:"Bridal+guest mehendi",canReduce:false,reduceTip:""},{cat:"Decoration",pct:20,notes:"Floral lounge",canReduce:true,reduceTip:""},{cat:"Catering",pct:22,notes:"Snacks & chai",canReduce:true,reduceTip:""},{cat:"Photography",pct:12,notes:"Candid",canReduce:false,reduceTip:""},{cat:"Misc",pct:6,notes:"Buffer",canReduce:false,reduceTip:""} ],
  concert:    [ { cat:"Artists",pct:35,notes:"Performer fee",canReduce:false,reduceTip:""},{cat:"Venue",pct:25,notes:"Stage, PA, lights",canReduce:true,reduceTip:""},{cat:"AV & Sound",pct:15,notes:"Sound system",canReduce:false,reduceTip:""},{cat:"Security",pct:8,notes:"Crowd management",canReduce:false,reduceTip:""},{cat:"Logistics",pct:10,notes:"Transport, backstage",canReduce:true,reduceTip:""},{cat:"Misc",pct:7,notes:"Buffer, permits",canReduce:false,reduceTip:""} ],
  djnight:    [ { cat:"DJ & Sound",pct:40,notes:"DJ fee + sound",canReduce:false,reduceTip:""},{cat:"Venue",pct:25,notes:"Club/lawn hire",canReduce:true,reduceTip:""},{cat:"Lighting",pct:15,notes:"LED, laser rigs",canReduce:true,reduceTip:""},{cat:"Catering",pct:12,notes:"Bar/snacks",canReduce:true,reduceTip:""},{cat:"Misc",pct:8,notes:"Security, buffer",canReduce:false,reduceTip:""} ],
};
const DEFAULT_ALLOC = BUDGET_ALLOC.wedding;

const MIN_CPG: Record<string, number> = {
  wedding:2500,reception:1800,birthday:800,corporate:2000,sangeet:1200,
  engagement:1500,haldi:600,mehendi:500,babyshower:700,housewarming:600,
  anniversary:1000,collegefest:400,concert:500,temple:300,privateparty:1000,
  festival:400,charity:800,productlaunch:2500,exhibition:2000,djnight:800,
  conference:2200,fashionshow:1500,sportsEvent:600,default:1000,
};

// ─── Budget Planner ───────────────────────────────────────────────────────────
export function generateBudgetPlan(ctx: PlannerContext): BudgetPlan {
  const { budget = 500000, guestCount = 200, city, eventType = "wedding" } = ctx;
  const m = getMul(ctx);
  const alloc = BUDGET_ALLOC[eventType] ?? DEFAULT_ALLOC;
  const breakdown: BudgetLineItem[] = alloc.map(a => {
    const adj = (budget * a.pct / 100) * m;
    return { category: a.cat, minCost: Math.round(adj * 0.8), maxCost: Math.round(adj * 1.25),
             recommended: Math.round(adj), percentage: a.pct, notes: a.notes, canReduce: a.canReduce, reduceTip: a.reduceTip };
  });
  const grandTotal = breakdown.reduce((s, b) => s + b.recommended, 0);
  const remaining  = budget - grandTotal;
  const minReq     = (MIN_CPG[eventType] ?? 1000) * guestCount * getCityMul(city);
  const isFeasible = budget >= minReq;
  return {
    totalBudget: budget, breakdown, grandTotal, remaining, isFeasible,
    feasibilityNote: isFeasible
      ? `${fmt(budget)} is workable for ${guestCount} guests in ${city ?? "your city"}. Buffer: ${fmt(Math.max(0, remaining))}.`
      : `${fmt(budget)} is tight for ${guestCount} guests. Minimum recommended: ${fmt(Math.round(minReq))}. Consider trimming the guest list to ${Math.floor(budget / ((MIN_CPG[eventType] ?? 1000) * getCityMul(city)))}.`,
    savingTips: [
      "Book all vendors 4-6 months ahead — 10-20% early-bird savings",
      "Bundle photographer + videographer for 15% package discount",
      "Weekday events save 25-35% on venue charges",
      "Seasonal local flowers save 25-40% on decoration",
      "Digital invitations save ₹15K-₹40K",
      "Limit live food counters to 2-3 (each costs ₹8K-₹15K)",
      "Offer upfront full payment to vendors — get 10-15% off",
    ],
    hiddenCosts: [
      "GST 18% on venue + catering — adds 15-20% to those bills",
      "Overtime charges if event overruns (₹5K-₹20K per hour)",
      "Generator/power backup (₹10K-₹25K for full day)",
      "Security personnel (₹3K-₹8K per guard per day)",
      "Parking management (₹5K-₹12K)",
      "Last-minute additions — budget ₹20K-₹50K extra",
      "Staff gratuity: 2-3% of total",
    ],
  };
}

// ─── Multi-Day Schedule Generator ────────────────────────────────────────────
function buildDaySchedule(day: number, label: string, eventType: string, isOutdoor: boolean): DaySchedule {
  const schedules: Record<string, HourlySlot[]> = {
    wedding: [
      {time:"05:30 AM",activity:"Decoration team arrives — mandap setup begins",who:"Vendor",note:"Critical — must start before guests arrive"},
      {time:"06:00 AM",activity:"Florist arrives — fresh flower arrangements",who:"Vendor"},
      {time:"06:30 AM",activity:"Electricians finalize lighting rigs",who:"Vendor"},
      {time:"07:00 AM",activity:"Bridal makeup begins",who:"Bride",note:"Book makeup artist confirmed night before"},
      {time:"08:00 AM",activity:"Catering team arrives — kitchen setup",who:"Vendor"},
      {time:"08:30 AM",activity:"Photography team arrives — venue & detail shots",who:"Vendor"},
      {time:"09:00 AM",activity:"Groom gets ready",who:"Groom"},
      {time:"10:00 AM",activity:"Pre-wedding photos — bride & groom separately",who:"Bride,Groom"},
      {time:"11:00 AM",activity:"Family portraits begin",who:"Family"},
      {time:"11:30 AM",activity:"Baraat / Groom's procession begins",who:"Groom",note:"DJ/Band leads procession"},
      {time:"12:30 PM",activity:"Welcome ceremony — exchange of garlands",who:"All"},
      {time:"01:00 PM",activity:"Lunch for guests (if day wedding)",who:"All"},
      {time:"02:00 PM",activity:"Main ceremony / Pheras / Rituals begin",who:"All",note:"Pandit to confirm muhurat"},
      {time:"04:30 PM",activity:"Ceremony concludes — couple portraits (Golden Hour prep)",who:"Bride,Groom"},
      {time:"05:30 PM",activity:"Golden Hour photography — outdoor/rooftop",who:"Bride,Groom",note:"Best natural light window"},
      {time:"06:30 PM",activity:"Cocktail hour / pre-dinner entertainment",who:"All"},
      {time:"07:30 PM",activity:"Dinner service opens",who:"All"},
      {time:"08:30 PM",activity:"DJ / Band performance begins",who:"All"},
      {time:"10:30 PM",activity:"Event winds down — family farewells",who:"All"},
      {time:"11:00 PM",activity:"Vendor wrap-up; final payments processed",who:"Coordinator"},
    ],
    sangeet: [
      {time:"04:00 PM",activity:"Decoration & LED stage setup",who:"Vendor"},
      {time:"05:00 PM",activity:"Sound check — DJ / Band",who:"Vendor"},
      {time:"06:00 PM",activity:"Makeup & getting ready",who:"Bride,Groom,Family"},
      {time:"07:00 PM",activity:"Guest arrival — welcome drinks",who:"All"},
      {time:"07:30 PM",activity:"Anchor opens the show",who:"All"},
      {time:"07:45 PM",activity:"Family dance performances",who:"Family"},
      {time:"08:30 PM",activity:"Professional dance performances",who:"Vendor"},
      {time:"09:00 PM",activity:"Dinner service opens (parallel)",who:"All"},
      {time:"09:30 PM",activity:"DJ night begins — open dance floor",who:"All"},
      {time:"11:00 PM",activity:"Event concludes",who:"All"},
    ],
    haldi: [
      {time:"09:00 AM",activity:"Floral decoration setup — marigold & marigold props",who:"Vendor"},
      {time:"10:00 AM",activity:"Bride/Groom seated for ceremony",who:"Bride,Groom"},
      {time:"10:15 AM",activity:"Haldi applied — family first, then friends",who:"Family"},
      {time:"11:30 AM",activity:"Photography — candid & posed shots",who:"All"},
      {time:"12:00 PM",activity:"Lunch / snacks served",who:"All"},
      {time:"01:00 PM",activity:"Event concludes — venue cleanup",who:"All"},
    ],
    mehendi: [
      {time:"10:00 AM",activity:"Mehendi artists arrive & setup",who:"Vendor"},
      {time:"10:30 AM",activity:"Bridal mehendi begins (takes 3-4 hrs)",who:"Bride"},
      {time:"11:00 AM",activity:"Guest mehendi begins",who:"Guests"},
      {time:"12:00 PM",activity:"Lunch served",who:"All"},
      {time:"02:00 PM",activity:"Photography — mehendi detail shots",who:"Vendor"},
      {time:"03:00 PM",activity:"Event winds down",who:"All"},
    ],
    birthday: [
      {time:"04:00 PM",activity:"Decoration setup — theme props, balloons, cake table",who:"Vendor"},
      {time:"05:30 PM",activity:"Guest arrival begins",who:"All"},
      {time:"06:00 PM",activity:"Games & entertainment",who:"All"},
      {time:"07:00 PM",activity:"Cake cutting — photography",who:"All"},
      {time:"07:30 PM",activity:"Dinner/snacks served",who:"All"},
      {time:"08:30 PM",activity:"DJ / music",who:"All"},
      {time:"09:30 PM",activity:"Event concludes",who:"All"},
    ],
    corporate: [
      {time:"08:00 AM",activity:"Venue setup — AV, seating, branding",who:"Vendor"},
      {time:"09:00 AM",activity:"Registration & breakfast",who:"All"},
      {time:"09:30 AM",activity:"Opening address",who:"Host"},
      {time:"10:00 AM",activity:"Session 1",who:"All"},
      {time:"11:15 AM",activity:"Tea break + networking",who:"All"},
      {time:"11:30 AM",activity:"Session 2",who:"All"},
      {time:"01:00 PM",activity:"Lunch break",who:"All"},
      {time:"02:00 PM",activity:"Session 3 / Workshop",who:"All"},
      {time:"03:30 PM",activity:"Tea break",who:"All"},
      {time:"03:45 PM",activity:"Panel discussion / Q&A",who:"All"},
      {time:"05:00 PM",activity:"Closing remarks",who:"Host"},
      {time:"05:30 PM",activity:"Networking cocktails (optional)",who:"All"},
    ],
  };

  const slots = schedules[eventType] ?? schedules.wedding;
  return {
    day, label, slots,
    sunrise: "06:15 AM",
    sunset:  isOutdoor ? "06:30 PM (Golden Hour: 05:30-06:30 PM — ideal for photos)" : undefined,
  };
}

export function generateTimeline(ctx: PlannerContext): EventTimeline {
  const { eventType = "wedding", durationDays = 1, venueType = "indoor" } = ctx;
  const isOutdoor = venueType === "outdoor" || venueType === "both";
  const isWedding = ["wedding","reception","sangeet","haldi","mehendi","engagement"].includes(eventType);

  const milestones: TimelineMilestone[] = [
    { timeframe: "6 Months Before", priority: "critical", tasks: [
        "Fix guest list & headcount", "Lock total budget & allocations",
        "Shortlist 3-5 venues — visit each", "Book venue (fills fast)",
        isWedding ? "Hire wedding planner/coordinator" : "Define event objectives & KPIs",
        "Begin photographer/videographer search",
    ]},
    { timeframe: "5 Months Before", priority: "critical", tasks: [
        "Book photographer & videographer (highest demand — book first)",
        "Book caterer — initial menu tasting",
        isWedding ? "Book makeup artist + trial date" : "Confirm entertainment requirements",
        "Book DJ or live band", "Begin invitation design",
    ]},
    { timeframe: "4 Months Before", priority: "important", tasks: [
        "Send invitations (print + digital)", "Book decorator — studio visit",
        isWedding ? "Order bridal outfit — first fitting" : "Order event merchandise/gifts",
        "Confirm outstation guest accommodation", "Arrange transport plan",
    ]},
    { timeframe: "3 Months Before", priority: "important", tasks: [
        "Collect RSVPs — finalize headcount", "Finalize food menu + dietary requirements",
        "Decoration briefing — mood board / color palette", "Book anchor/emcee",
        "Confirm all vendor payment schedules",
    ]},
    { timeframe: "2 Months Before", priority: "important", tasks: [
        "Final food tasting", "Confirm seating arrangement draft",
        "Order return gifts / wedding favors",
        "Photographer shot list coordination",
        "Plan emergency backup (generator, rain cover, first aid)",
    ]},
    { timeframe: "1 Month Before", priority: "critical", tasks: [
        "Final confirmation call with ALL vendors",
        "Pay remaining vendor advances",
        "Share event-day schedule with all vendors",
        "Assign coordinator roles to family/friends",
        "Prepare emergency kit (medicines, safety pins, tape)",
        "Confirm guest transport & parking",
    ]},
    { timeframe: "1 Week Before", priority: "critical", tasks: [
        "Venue walkthrough with decorator",
        "Rehearsal (if required)",
        "Confirm final headcount with caterer",
        "Pack all items for venue",
        "Share vendor contacts with coordinator",
        "Charge all devices; prepare backup batteries",
    ]},
  ];

  // Build multi-day schedule
  const multiDaySchedule: DaySchedule[] = [];
  const EVENT_DAY_LABELS: Record<string, string[]> = {
    wedding: ["Day 1 – Haldi & Mehendi", "Day 2 – Sangeet Night", "Day 3 – Wedding Day"],
    default: ["Event Day"],
  };
  const labels = durationDays > 1 ? (EVENT_DAY_LABELS[eventType] ?? EVENT_DAY_LABELS.default) : ["Event Day"];
  for (let d = 0; d < Math.min(durationDays, 3); d++) {
    const dayEventType = durationDays > 1
      ? (d === 0 ? "haldi" : d === 1 ? "sangeet" : eventType)
      : eventType;
    multiDaySchedule.push(buildDaySchedule(d + 1, labels[d] ?? `Day ${d + 1}`, dayEventType, isOutdoor));
  }

  // Legacy flat schedule (for backwards compatibility)
  const flat = multiDaySchedule[multiDaySchedule.length - 1]?.slots ?? [];
  const eventDaySchedule = flat.map(s => ({ time: s.time, activity: s.activity }));

  return { milestones, eventDaySchedule, multiDaySchedule };
}

// ─── Vendor Recommender ───────────────────────────────────────────────────────
export function recommendVendors(ctx: PlannerContext): VendorRecommendation[] {
  const { city = "Hyderabad", eventType = "wedding", guestCount = 200 } = ctx;
  const m = getMul(ctx);
  type T = { cat: string; reason: string; bMin: number; bMax: number; tips: string[]; slug: string; urgency: "book_now" | "flexible" };
  const templates: T[] = [
    { cat: "Photographer", reason: `Essential — captures memories that last forever. For a ${eventType}, invest here.`, bMin: 25000, bMax: 80000, tips: ["Ask for full-day coverage + RAW files", "View 3 complete albums before booking", "Book 5 months ahead — they fill fastest"], slug: "photographers", urgency: "book_now" },
    { cat: "Videographer", reason: "A cinematic video lets you relive the event for decades.", bMin: 20000, bMax: 70000, tips: ["Drone shots add Rs 5K-Rs 15K extra", "Request a 3-min highlight reel"], slug: "videographers", urgency: "book_now" },
    { cat: "Event Decorator", reason: `Decoration sets the entire mood. For ${guestCount} guests, invest in quality.`, bMin: 40000, bMax: 200000, tips: ["Agree on written scope before booking", "Seasonal flowers cut cost 25%", "Visit 2-3 completed setups"], slug: "decorators", urgency: "book_now" },
    { cat: "DJ / Live Band", reason: "Music is what keeps guests energised and dancing all night.", bMin: 15000, bMax: 60000, tips: ["Submit song list 2 weeks before", "Confirm backup sound system", "Sound system should be included in quote"], slug: "dj", urgency: "flexible" },
    { cat: "Makeup Artist", reason: "Professional bridal makeup is non-negotiable for the main event.", bMin: 8000, bMax: 40000, tips: ["Do a trial session 2 weeks before", "Confirm airbrush vs. HD makeup", "Check portfolio for your skin tone"], slug: "makeup", urgency: "book_now" },
    { cat: "Caterer", reason: `Food is what guests remember most. For ${guestCount} guests, plan carefully.`, bMin: Math.round(guestCount * 600 * getCityMul(city)), bMax: Math.round(guestCount * 1800 * getCityMul(city)), tips: ["Get per-plate pricing in writing", "Include service staff in quote", "Do a tasting before signing contract"], slug: "catering", urgency: "book_now" },
    { cat: "Anchor / Emcee", reason: "A professional anchor keeps the program flowing and guests engaged.", bMin: 8000, bMax: 35000, tips: ["Share complete script in advance", "Bilingual anchors cost 15-20% more"], slug: "anchors", urgency: "flexible" },
    { cat: "Mehendi Artist", reason: "For weddings and pre-wedding functions, skilled mehendi is a must.", bMin: 5000, bMax: 25000, tips: ["Book 4-5 artists for large parties", "Allow 3 hours for full bridal design"], slug: "mehendi", urgency: "flexible" },
  ];
  return templates.map(t => ({
    category: t.cat, reason: t.reason,
    minPrice: Math.round(t.bMin * m), maxPrice: Math.round(t.bMax * m),
    budgetRange: `${fmt(Math.round(t.bMin * m))} - ${fmt(Math.round(t.bMax * m))}`,
    tips: t.tips, bookingUrgency: t.urgency,
    vowzaSearchUrl: `/artists?category=${t.slug}&city=${encodeURIComponent(city)}`,
  }));
}

// ─── Weather Advisor ──────────────────────────────────────────────────────────
export function getWeatherAdvice(ctx: PlannerContext): WeatherAdvice {
  const { eventDate, venueType = "indoor", city = "Hyderabad" } = ctx;
  const season = getSeason(eventDate);
  const outdoor = venueType === "outdoor" || venueType === "both";
  const map: Record<Season, Omit<WeatherAdvice, "season">> = {
    winter: { risk: "low", advice: "Nov-Feb is peak wedding season in India. Cool weather, minimal rain — ideal conditions.", backupPlan: outdoor ? "Keep a standby tent/canopy. Nights can be chilly — arrange heaters." : "N/A for indoor.", decorationTips: ["Marigold and rose garlands thrive in winter", "String lights look magical on cool evenings", "Pashmina wraps work as stylish guest favours"], bestMonths: ["November","December","January","February"], avoidMonths: [], goldenHour: "5:00 PM - 6:00 PM" },
    summer: { risk: "medium", advice: "Mar-May can be very hot. Outdoor events become uncomfortable past 10 AM.", backupPlan: "Mandatory: industrial fans or air coolers. Schedule ceremony before 10 AM or after 6 PM. Chilled water stations throughout.", decorationTips: ["Avoid dark fabrics that absorb heat", "White and pastel palettes stay cooler", "Mist fans are stylish and practical"], bestMonths: ["March (early)","October","November"], avoidMonths: ["April","May"], goldenHour: "6:00 PM - 7:00 PM" },
    monsoon: { risk: "high", advice: "Jun-Sep brings heavy rain. Outdoor events carry significant risk — must have indoor backup.", backupPlan: "CRITICAL: Fully equipped indoor backup venue confirmed. Waterproof tents if outdoor. Rubber mats to prevent slipping. Check venue drainage.", decorationTips: ["Avoid elaborate floral installations outdoors", "LED lighting safer than candles in humidity", "Tropical leaf arrangements work well"], bestMonths: ["October","November","December"], avoidMonths: ["July","August","September"], goldenHour: "N/A (overcast)" },
    autumn: { risk: "low", advice: "October is transitional — post-monsoon freshness, pleasant evenings. Good for outdoor.", backupPlan: outdoor ? "Light rain possible in early Oct. Canopy on standby." : "N/A.", decorationTips: ["Earth tones and warm colours suit the season", "Marigold and sunflowers are in season and affordable", "Fairy lights create warmth in golden evenings"], bestMonths: ["October","November"], avoidMonths: [], goldenHour: "5:30 PM - 6:30 PM" },
  };
  return { season, ...map[season] };
}

// ─── Checklist Generator ──────────────────────────────────────────────────────
export function generateChecklist(ctx: PlannerContext): ChecklistItem[] {
  const { eventType = "wedding" } = ctx;
  const isWedding = ["wedding","reception","sangeet","haldi","engagement","mehendi"].includes(eventType);
  const base: Omit<ChecklistItem, "id" | "done">[] = [
    { task: "Government IDs for venue booking",            category: "Documents", dueWhen: "6 months before",  priority: "must", owner: "Coordinator" },
    { task: "All vendor contracts signed and saved",        category: "Documents", dueWhen: "On booking",       priority: "must", owner: "Coordinator" },
    { task: "Event insurance arranged (optional)",          category: "Documents", dueWhen: "2 months before",  priority: "nice", owner: "Family" },
    { task: "Venue advance payment paid",                   category: "Venue",     dueWhen: "On booking",       priority: "must", owner: "Family" },
    { task: "Venue final payment cleared",                  category: "Venue",     dueWhen: "1 week before",    priority: "must", owner: "Family" },
    { task: "Venue walkthrough with decorator",             category: "Venue",     dueWhen: "1 week before",    priority: "must", owner: "Coordinator" },
    { task: "Generator/power backup confirmed",             category: "Venue",     dueWhen: "1 month before",   priority: "should", owner: "Coordinator" },
    { task: "Parking arrangement confirmed",                category: "Venue",     dueWhen: "1 month before",   priority: "should", owner: "Coordinator" },
    { task: "Photographer briefed — shot list shared",      category: "Vendors",   dueWhen: "1 week before",    priority: "must", owner: "Couple" },
    { task: "Caterer final headcount confirmed",            category: "Vendors",   dueWhen: "3 days before",    priority: "must", owner: "Coordinator" },
    { task: "DJ / Band song list submitted",                category: "Vendors",   dueWhen: "2 weeks before",   priority: "must", owner: "Couple" },
    { task: "All vendor emergency contacts saved",          category: "Vendors",   dueWhen: "3 days before",    priority: "must", owner: "Coordinator" },
    { task: "Decorator mood board finalised & approved",    category: "Vendors",   dueWhen: "2 months before",  priority: "must", owner: "Couple" },
    { task: "Invitations sent (print + digital)",           category: "Guests",    dueWhen: "3 months before",  priority: "must", owner: "Family" },
    { task: "RSVP list updated",                            category: "Guests",    dueWhen: "1 month before",   priority: "must", owner: "Family" },
    { task: "Accommodation booked for outstation guests",   category: "Guests",    dueWhen: "2 months before",  priority: "should", owner: "Family" },
    { task: "Guest transport / shuttle arranged",           category: "Guests",    dueWhen: "1 month before",   priority: "should", owner: "Coordinator" },
    { task: "Emergency kit packed (medicines, pins, tape)", category: "Emergency", dueWhen: "1 week before",    priority: "must", owner: "Coordinator" },
    { task: "Backup power confirmed",                       category: "Emergency", dueWhen: "1 month before",   priority: "must", owner: "Coordinator" },
    { task: "First aid box at venue",                       category: "Emergency", dueWhen: "Event day",        priority: "must", owner: "Coordinator" },
    { task: "Rain backup plan ready (if outdoor)",          category: "Emergency", dueWhen: "1 month before",   priority: "should", owner: "Coordinator" },
    { task: "Nearby hospital / clinic address noted",       category: "Emergency", dueWhen: "1 week before",    priority: "should", owner: "Coordinator" },
    ...(isWedding ? [
      { task: "Bridal makeup trial done",                   category: "Bridal",    dueWhen: "2 weeks before",   priority: "must" as const, owner: "Bride" },
      { task: "Mehendi artist timing confirmed",            category: "Bridal",    dueWhen: "1 month before",   priority: "must" as const, owner: "Bride" },
      { task: "Bridal outfit final fitting",                category: "Bridal",    dueWhen: "2 weeks before",   priority: "must" as const, owner: "Bride" },
      { task: "Groom outfit ready",                         category: "Bridal",    dueWhen: "2 weeks before",   priority: "must" as const, owner: "Groom" },
    ] : []),
  ];
  return base.map((item, i) => ({ ...item, id: `chk-${i}`, done: false }));
}

// ─── Food Planner ─────────────────────────────────────────────────────────────
export function generateFoodPlan(ctx: PlannerContext): FoodPlan {
  const { guestCount = 200, city, luxuryLevel = "standard", foodPreference = "veg" } = ctx;
  const cMul = getCityMul(city);
  const lMul = LUXURY_MUL[luxuryLevel];
  const baseCPP = foodPreference === "veg" ? 700 : 950;
  const costPerPlate = Math.round(baseCPP * cMul * lMul);
  const totalFoodCost = costPerPlate * guestCount;
  const vegMenu = [
    { course: "Welcome Drinks",  items: ["Fresh Lime Soda","Thandai","Mocktails","Coconut Water"] },
    { course: "Starters",        items: ["Paneer Tikka","Veg Seekh Kebab","Hara Bhara Kabab","Spring Rolls"] },
    { course: "Main Course",     items: ["Dal Makhani","Paneer Butter Masala","Mixed Veg","Biryani","Naan & Roti","Steamed Rice"] },
    { course: "Accompaniments",  items: ["Raita","Pickle","Papad","Salad Bar"] },
    { course: "Desserts",        items: ["Gulab Jamun","Rasmalai","Ice Cream Counter","Halwa"] },
    { course: "Pan Counter",     items: ["Meetha Paan","Saunf","Elaichi"] },
  ];
  const nonVegAdd = [
    { course: "Non-Veg Starters", items: ["Chicken Tikka","Mutton Seekh","Fish Fry"] },
    { course: "Non-Veg Main",     items: ["Chicken Curry","Mutton Biryani"] },
  ];
  const menuSuggestions = foodPreference === "non-veg" ? [...vegMenu, ...nonVegAdd] : vegMenu;
  const liveCounters = luxuryLevel === "budget"   ? ["Chaat Counter","Ice Cream"] :
                       luxuryLevel === "standard" ? ["Chaat Counter","Ice Cream","Dosa Station"] :
                                                    ["Chaat Counter","Ice Cream","Dosa Station","Pasta Counter","Biryani Live Pot"];
  return {
    costPerPlate, totalFoodCost, menuSuggestions, liveCounters,
    wastageReductionTips: [
      "Use RSVP count + 10% buffer — never 20-30% over-order",
      "Staggered service reduces peak-load waste significantly",
      "Donate surplus to a local food bank — reduces guilt and waste",
      `Estimated cost: ${fmt(costPerPlate)}/plate x ${guestCount} guests = ${fmt(totalFoodCost)}`,
    ],
  };
}

// ─── Negotiation Message Generator ───────────────────────────────────────────
export function generateNegotiationMessage(vendorType: string, currentPrice: number, targetPrice: number): NegotiationMessage {
  const disc = Math.round(((currentPrice - targetPrice) / currentPrice) * 100);
  const message = `Hi,\n\nThank you for your quote of ${fmt(currentPrice)} for our ${vendorType} services.\n\nWe love your work and see you as the perfect fit. After reviewing our budget carefully, we can allocate ${fmt(targetPrice)} — a ${disc}% adjustment from your quote.\n\nTo make this work, we offer:\n• Immediate advance payment on agreement\n• A detailed event brief to minimise your prep time\n• Prominent social media credit (500+ followers)\n• A detailed 5-star review on completion\n\nCould you accommodate ${fmt(targetPrice)}, or suggest a modified package at this price?\n\nWarm regards,\n[Your Name]`;
  return {
    vendorType, currentPrice, targetPrice, message,
    tactics: [
      "Offer immediate full upfront payment — vendors love cash certainty (saves them 10-15%)",
      `Ask for a "modified package at ${fmt(targetPrice)}" — softer than asking for a discount`,
      "Mention you have 2-3 competing quotes, but prefer them — tactful not threatening",
      "Bundle services (photographer + videographer) for a combined package deal",
      "Off-peak dates/weekdays give you 15-25% extra negotiating power",
    ],
  };
}

// ─── Risk Analyser ────────────────────────────────────────────────────────────
export function analyseRisks(ctx: PlannerContext): RiskAnalysis {
  const { venueType = "indoor", eventDate, budget = 0, guestCount = 200, city = "Hyderabad" } = ctx;
  const season = getSeason(eventDate);
  const outdoor = venueType === "outdoor" || venueType === "both";
  const isMonsoon = season === "monsoon";
  const isLowBudget = budget > 0 && budget < (MIN_CPG["wedding"] ?? 1000) * guestCount * getCityMul(city);

  const risks: RiskItem[] = [
    { risk: "Vendor no-show on event day", probability: "low", impact: "critical", mitigation: "Signed contracts with advance payment and cancellation clauses", backupPlan: "Maintain a backup list of 2-3 vendors per category; call them 48 hrs before" },
    { risk: "Catering delay causing guest dissatisfaction", probability: "medium", impact: "high", mitigation: "Final headcount 48 hrs before; staggered service plan agreed in writing", backupPlan: "Pre-set snack tables ready 30 min before main service opens" },
    { risk: "Power failure at venue", probability: "medium", impact: "high", mitigation: "Confirm generator capacity covers all equipment (lights + sound + AC)", backupPlan: "Dedicated generator contract with on-site operator throughout event" },
    ...(outdoor && isMonsoon ? [{ risk: "Rain during outdoor ceremony", probability: "high" as const, impact: "critical" as const, mitigation: "Indoor backup venue confirmed and staged 100% — not an option, a guarantee", backupPlan: "Waterproof tent over ceremony area + rubber mats + drainage check 24 hrs before" }] : []),
    ...(outdoor ? [{ risk: "Extreme heat / weather discomfort", probability: season === "summer" ? "high" as const : "low" as const, impact: "medium" as const, mitigation: "Industrial fans/coolers confirmed for outdoor area; event scheduled outside peak heat hours", backupPlan: "Chilled water stations every 20 metres; shaded seating available" }] : []),
    ...(isLowBudget ? [{ risk: "Budget overrun mid-event", probability: "high" as const, impact: "high" as const, mitigation: "Lock all vendor prices in written contracts before event; no verbal agreements", backupPlan: "Keep 10-15% emergency cash buffer separate — never touch unless needed" }] : []),
    { risk: "Key family member / coordinator falls ill", probability: "low", impact: "high", mitigation: "Document all vendor contacts and event schedule; share with 3 people", backupPlan: "Assign a secondary coordinator who knows the full plan" },
    { risk: "Photography / videography equipment failure", probability: "low", impact: "high", mitigation: "Confirm backup camera bodies and lenses with your photographer", backupPlan: "Professional photographers carry backup gear — verify this explicitly" },
  ];

  const highCount = risks.filter(r => r.probability === "high" || r.probability === "critical").length;
  const overallRisk = highCount >= 3 ? "high" : highCount >= 1 ? "medium" : "low";

  return {
    overallRisk,
    risks,
    topConcern: risks.find(r => r.probability === "high" || r.probability === "critical")?.risk ?? risks[0].risk,
  };
}

// ─── Success Score Engine ─────────────────────────────────────────────────────
export function calculateSuccessScore(ctx: PlannerContext): SuccessScore {
  const { budget = 0, guestCount = 0, city, eventDate, venueType, luxuryLevel = "standard" } = ctx;
  const hasBudget  = budget > 0;
  const hasGuests  = guestCount > 0;
  const hasCity    = !!city;
  const hasDate    = !!eventDate;
  const hasVenue   = !!venueType;
  const isFeasible = hasBudget && hasGuests && budget >= (MIN_CPG["wedding"] ?? 1000) * guestCount * getCityMul(city);

  const cats: ScoreCategory[] = [
    { name: "Budget Planning",      score: hasBudget  ? (isFeasible ? 92 : 65) : 40, note: hasBudget ? (isFeasible ? "Budget is well-sized for the guest count" : "Budget is tight — optimisation needed") : "Budget not set yet" },
    { name: "Information Completeness", score: Math.round(([hasBudget,hasGuests,hasCity,hasDate,hasVenue].filter(Boolean).length / 5) * 100), note: "Based on how much event info you have provided" },
    { name: "Vendor Coordination",   score: 78, note: "Book key vendors 4-6 months ahead for optimal coordination" },
    { name: "Guest Comfort",         score: hasGuests ? 85 : 60, note: hasGuests ? "Guest count known — logistics can be planned" : "Guest count needed to plan seating and catering" },
    { name: "Risk Management",       score: (hasDate && hasVenue) ? 80 : 55, note: (hasDate && hasVenue) ? "Date and venue info allows risk planning" : "Add event date and venue type to improve this score" },
    { name: "Photography Timing",    score: 85, note: "Golden Hour window factored into the day schedule" },
  ];

  const overall = Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length);
  const confidence = Math.round(([hasBudget,hasGuests,hasCity,hasDate,hasVenue].filter(Boolean).length / 5) * 90 + 10);

  return {
    overall, confidence, categories: cats,
    summary: overall >= 88
      ? `Excellent — your event is well-planned with a strong foundation. Keep finalising vendors.`
      : overall >= 75
      ? `Good progress. A few key decisions will push this score above 90.`
      : `Early stage. Once budget, guest count, and venue are confirmed, the score will jump significantly.`,
    improvements: [
      !hasBudget  ? "Set your total budget to unlock full planning capabilities" : "",
      !hasGuests  ? "Confirm approximate guest count for accurate catering and seating" : "",
      !hasCity    ? "Specify the event city for local vendor and pricing recommendations" : "",
      !hasDate    ? "Set an event date or month for weather and availability planning" : "",
      !hasVenue   ? "Confirm indoor/outdoor preference for risk and decoration planning" : "",
    ].filter(Boolean),
  };
}

// ─── Intent Parser ────────────────────────────────────────────────────────────
const CITY_LIST = ["hyderabad","bangalore","mumbai","delhi","pune","chennai","vizag","vijayawada","warangal","nagpur","kolkata","ahmedabad","surat","jaipur","lucknow","kochi","indore","bhopal","coimbatore","vadodara"];
const EVENT_KW: Record<string, EventCategory> = {
  wedding:"wedding",reception:"reception",engagement:"engagement",haldi:"haldi",mehendi:"mehendi",mehndi:"mehendi",sangeet:"sangeet",birthday:"birthday","baby shower":"babyshower",babyshower:"babyshower",housewarming:"housewarming","house warming":"housewarming",anniversary:"anniversary",corporate:"corporate",conference:"conference",college:"collegefest",fest:"collegefest",concert:"concert",temple:"temple","private party":"privateparty",party:"privateparty",festival:"festival",charity:"charity",launch:"productlaunch","product launch":"productlaunch",exhibition:"exhibition","dj night":"djnight",djnight:"djnight","fashion show":"fashionshow","sports event":"sportsEvent",
};

function extractBudget(l: string): number | undefined {
  const pats = [ /(\d+(?:\.\d+)?)\s*(?:crore|cr\b)/i, /(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i, /(\d+)\s*k\b/i, /(?:rs\.?\s*|inr\s*|₹)(\d[\d,]*)/i ];
  for (const p of pats) {
    const m = l.match(p);
    if (m) {
      const v = parseFloat(m[1].replace(/,/g, ""));
      if (p.source.includes("crore")) return v * 10000000;
      if (p.source.includes("lakh")) return v * 100000;
      if (p.source.includes("k\\b")) return v * 1000;
      return v;
    }
  }
  return undefined;
}

function extractCtx(msg: string): Partial<PlannerContext> {
  const l = msg.toLowerCase();
  const u: Partial<PlannerContext> = {};
  const budget = extractBudget(l);                      if (budget)  u.budget = budget;
  const gm = l.match(/(\d+)\s*(?:guests?|people|pax|persons?|attendees?|heads?)/i); if (gm) u.guestCount = parseInt(gm[1]);
  for (const city of CITY_LIST) if (l.includes(city)) { u.city = city.charAt(0).toUpperCase() + city.slice(1); break; }
  for (const [kw, et] of Object.entries(EVENT_KW))    if (l.includes(kw)) { u.eventType = et; break; }
  if (/luxury/i.test(l))               u.luxuryLevel = "luxury";
  else if (/premium/i.test(l))         u.luxuryLevel = "premium";
  else if (/budget.friendly|low.budget/i.test(l)) u.luxuryLevel = "budget";
  if (/outdoor/i.test(l))              u.venueType = "outdoor";
  else if (/indoor/i.test(l))          u.venueType = "indoor";
  if (/non.veg/i.test(l))             u.foodPreference = "non-veg";
  else if (/\bveg\b/i.test(l))        u.foodPreference = "veg";
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  for (const m of months) if (l.includes(m)) { u.eventDate = m; break; }
  const dm = l.match(/(\d+)\s*days?/i); if (dm) u.durationDays = parseInt(dm[1]);
  const nm = msg.match(/(?:my name is|i am|i'm)\s+([A-Z][a-z]+)/i); if (nm) u.userName = nm[1];
  return u;
}

type Action = "budget"|"timeline"|"vendors"|"weather"|"checklist"|"food"|"negotiation"|"full_plan"|"wedding_plan"|"score"|"risks"|"question"|"followup"|"search"|"greeting";

function detectAction(l: string, ctx: PlannerContext): Action {
  const neg = l.match(/reduce.*?(\d[\d,]+).*?to.*?(\d[\d,]+)|negotiate.*?(\d[\d,]+).*?(\d[\d,]+)/i);
  if (neg) return "negotiation";
  if (/^(hi|hello|hey|namaste|hii|good\s*(morning|afternoon|evening))/i.test(l.trim())) return "greeting";
  // Wedding or multi-day event planning → always generate full wedding plan itinerary first
  if (/(wedding|3.day|three.day|multi.day|complete wedding|plan.*wedding|wedding.*plan)/i.test(l)) return "wedding_plan";
  if (/(plan everything|full plan|plan my|complete plan|plan the entire|plan a .+? for)/i.test(l)) return "wedding_plan";
  if (/(budget|cost|how much|afford|₹|lakh|estimate.*cost)/i.test(l) && (extractBudget(l) || ctx.budget)) return "budget";
  if (/(success score|score|how good|confidence|rate.*plan)/i.test(l)) return "score";
  if (/(risk|backup|what if|rain|cancel|fail|emergency)/i.test(l)) return "risks";
  if (/(timeline|schedule|when|months? before|week.*before|day.*plan)/i.test(l)) return "timeline";
  if (/(checklist|todo|to.do|what.*need|prepare|list)/i.test(l)) return "checklist";
  if (/(food|menu|catering|per plate|eat|cuisine|veg|non.veg)/i.test(l)) return "food";
  if (/(weather|rain|season|best month|outdoor)/i.test(l)) return "weather";
  if (/(vendor|recommend|photographer|decorator|dj|band|makeup|mehendi|anchor|caterer)/i.test(l)) return "vendors";
  if (/(find|search|book|available|hire|show me)/i.test(l)) return "search";
  if (/(enough|should i|can i|how many|which|difference|vs\b|better|is.*worth)/i.test(l)) return "question";
  return "followup";
}

// ─── Question Answerer ────────────────────────────────────────────────────────
function answerQ(msg: string, ctx: PlannerContext): string {
  const l = msg.toLowerCase();
  const { budget = 0, guestCount = 0, city = "Hyderabad", eventType = "wedding" } = ctx;

  if (/enough|afford|is.*lakh|sufficient/.test(l) && budget > 0 && guestCount > 0) {
    const min = Math.round((MIN_CPG[eventType] ?? 1000) * guestCount * getCityMul(city));
    return budget >= min
      ? `Yes — **${fmt(budget)} is feasible** for ${guestCount} guests in ${city} for a ${eventType}. Minimum realistic floor is ~${fmt(min)}. You have approximately **${fmt(budget - min)} buffer** for upgrades. Want me to generate the full budget breakdown?`
      : `**${fmt(budget)} will be tight** for ${guestCount} guests in ${city}. Minimum realistic estimate is ~${fmt(min)}. Options:\n1. Increase budget to ${fmt(min)}\n2. Reduce guest list to ~${Math.floor(budget / ((MIN_CPG[eventType] ?? 1000) * getCityMul(city)))}\n3. Simplify the format\n\nWant me to show you an optimised budget-friendly plan?`;
  }
  if (/best month|which month|when.*wedding|when.*plan/.test(l)) {
    const cl = city.toLowerCase();
    if (["hyderabad","vizag","vijayawada","warangal","bangalore","chennai"].includes(cl))
      return `For **${city}**, the best months are **November, December, January, February** — cool weather, minimal rain, festive season. Avoid June–September (heavy monsoon) and April–May (extreme heat). October is good if you want lower prices.`;
    return `Across most of India, **November–February** is the best wedding window. Peak season means 20-30% premium pricing — book 5-6 months ahead. For lower costs, try October or early March.`;
  }
  if (/how many photographer|how many camera/.test(l)) {
    if (guestCount > 500) return `For ${guestCount}+ guests: **3 photographers + 2 videographers** — one for rituals, one candid, one for crowd. Budget: ₹80K-₹1.5L.`;
    if (guestCount > 200) return `For ${guestCount} guests: **2 photographers + 1-2 videographers** — one for rituals/formals, one candid. Budget: ₹45K-₹90K.`;
    return `For up to 200 guests: **1-2 photographers + 1 videographer** is sufficient. Budget: ₹25K-₹60K.`;
  }
  if (/dj.*band|band.*dj|dj or|live band or/.test(l))
    return `**DJ vs. Live Band:**\n\n- **DJ** (₹15K-₹50K): Versatile, plays any song instantly, ideal for dance floors. Best for receptions, sangeet, birthdays.\n- **Live Band** (₹25K-₹1.5L): Premium experience, impressive visual impact. Best for formal weddings and corporate events.\n\n**My recommendation:** Live band for dinner hour + DJ for dancing after = ultimate combo. Budget ₹70K-₹1.2L total.`;
  if (/hidden.*cost|extra.*cost|surprise.*cost/.test(l))
    return `**Hidden wedding costs that surprise most couples:**\n\n1. **GST 18%** on venue + catering — adds ₹40K-₹1.5L\n2. **Overtime** if event overruns — ₹5K-₹20K/hr\n3. **Generator backup** — ₹10K-₹25K\n4. **Parking management** — ₹5K-₹12K\n5. **Security** — ₹3K-₹8K/guard/day\n6. **Last-minute changes** — always ₹15K-₹50K extra\n7. **Gratuity** — 2-3% of total\n8. **Alterations & dry cleaning** — ₹5K-₹15K\n\nAlways keep a **10-15% emergency buffer** in your budget.`;
  if (/reduce.*cost|save.*money|cut.*budget/.test(l))
    return `**Top 8 ways to cut costs without compromising quality:**\n\n1. Book 4-6 months ahead — save 15-20%\n2. Weekday events — venue costs 25-35% less\n3. Limit live food counters to 2-3 (₹8K-₹15K each)\n4. Digital invitations — save ₹15K-₹40K\n5. Seasonal flowers — 25-40% cheaper\n6. Bundle photographer + videographer — 15% off\n7. Trim guest list — each guest = ₹1.5K-₹3K in food alone\n8. Offer upfront payment — vendors give 10-15% off`;
  return `Great question about your ${eventType}. To give you the most precise answer — ${!budget ? "could you share your budget? " : ""}${!guestCount ? "and your expected guest count? " : ""}With those details I can give you an exact, data-backed answer.`;
}

// ─── Missing Fields Checker ───────────────────────────────────────────────────
const FIELD_QS: Record<string, string> = {
  eventType:   "What type of event are you planning? (e.g., Wedding, Birthday, Sangeet, Corporate, Concert...)",
  city:        "Which city will the event be held in?",
  budget:      "What is your total budget? (e.g., ₹8 lakh, ₹15 lakh, ₹2 crore)",
  guestCount:  "Approximately how many guests are you expecting?",
  eventDate:   "Do you have a date or month in mind?",
  durationDays:"How many days will the event run?",
  venueType:   "Would you prefer an indoor venue, outdoor, or are you open to both?",
  luxuryLevel: "What style are you going for? Budget-friendly, Standard, Premium, or Luxury?",
  foodPreference: "Do you prefer a vegetarian or non-vegetarian menu, or both?",
};

// ─── processMessage — main entry point (exported, used by llm.ts) ─────────────
// Now uses the orchestrator for intent detection instead of hardcoded switch/case.
// The orchestrator decides what to do; VEDA engine only runs for structured data.
export async function processMessage(
  message: string,
  context: PlannerContext,
  history?: import('./aiPlannerTypes').ChatMessage[]
): Promise<{ response: AIResponse; updatedContext: PlannerContext }> {
  const { orchestrate, extractContextUpdates } = await import('./aiOrchestrator');

  // Merge context updates from the current message
  const updates = extractContextUpdates(message, context);
  const ctx: PlannerContext = { ...context, ...updates };

  // Orchestrate — decide intent and strategy
  const result = orchestrate(message, ctx, history ?? []);
  const l = message.toLowerCase();

  // ── If we need to ask the next question, do that ─────────────────────────
  if (result.shouldAskNext) {
    const known: string[] = [];
    if (ctx.eventType)  known.push(`**${ctx.eventType}**`);
    if (ctx.city)       known.push(`in **${ctx.city}**`);
    if (ctx.budget)     known.push(`budget **${fmt(ctx.budget)}**`);
    if (ctx.guestCount) known.push(`**${ctx.guestCount} guests**`);
    const prefix = known.length > 0 ? `Got it — ${known.join(', ')}. ` : '';
    return {
      response: { type: 'question', text: `${prefix}${result.shouldAskNext}` },
      updatedContext: ctx,
    };
  }

  // ── Greeting (only on fresh sessions) ───────────────────────────────────
  if (result.intent === 'greeting') {
    const hasCtx = !!(ctx.eventType || ctx.city || ctx.budget || ctx.guestCount);
    if (hasCtx) {
      const known: string[] = [];
      if (ctx.eventType)  known.push(`${ctx.eventType}`);
      if (ctx.city)       known.push(`in ${ctx.city}`);
      if (ctx.budget)     known.push(`budget ${fmt(ctx.budget)}`);
      if (ctx.guestCount) known.push(`${ctx.guestCount} guests`);
      return {
        response: { type: 'text', text: `Hey! I still have your event details: ${known.join(' · ')}. What would you like to work on next?` },
        updatedContext: ctx,
      };
    }
    return {
      response: {
        type: 'text',
        text: `Hello! 👋 I'm your **Vowza AI Planner** — here to help you plan any event from start to finish.\n\nJust tell me what you're planning and I'll help with budgets, vendors, timelines, and more. What's your event?`,
      },
      updatedContext: ctx,
    };
  }

  // ── Context update acknowledgement ───────────────────────────────────────
  if (result.intent === 'context_update') {
    const changed: string[] = [];
    const up = extractContextUpdates(message, context);
    if (up.city)       changed.push(`city → **${up.city}**`);
    if (up.budget)     changed.push(`budget → **${fmt(up.budget!)}**`);
    if (up.guestCount) changed.push(`guests → **${up.guestCount}**`);
    if (up.eventType)  changed.push(`event → **${up.eventType}**`);
    const summary = changed.length
      ? `Got it — updated: ${changed.join(', ')}. `
      : `Noted. `;
    const canGenerate = ctx.eventType && ctx.city && ctx.budget && ctx.guestCount;
    return {
      response: {
        type: 'text',
        text: `${summary}${canGenerate ? `I'll update the plan for ${ctx.guestCount} guests in **${ctx.city}** with a budget of **${fmt(ctx.budget!)}**. Want me to regenerate the full plan?` : `What else should I know?`}`,
      },
      updatedContext: ctx,
    };
  }

  // ── VEDA structured responses (only when all context is available) ───────
  switch (result.intent) {
    case 'budget_breakdown':
      return { response: { type: 'budget_plan', text: withFollowUp(`Here's the budget breakdown for your **${ctx.eventType ?? 'event'}** in **${ctx.city ?? 'your city'}** for **${ctx.guestCount ?? 200} guests** — budget **${fmt(ctx.budget ?? 500000)}**.`, ctx), data: { budgetPlan: generateBudgetPlan(ctx) } }, updatedContext: ctx };

    case 'timeline':
      return { response: { type: 'timeline', text: withFollowUp(`Here's your complete planning timeline for the **${ctx.eventType ?? 'event'}**.`, ctx), data: { timeline: generateTimeline(ctx) } }, updatedContext: ctx };

    case 'checklist':
      return { response: { type: 'checklist', text: withFollowUp(`Here's your full checklist for the **${ctx.eventType ?? 'event'}** — every task prioritised and assigned.`, ctx), data: { checklist: generateChecklist(ctx) } }, updatedContext: ctx };

    case 'food_plan':
      return { response: { type: 'food_plan', text: withFollowUp(`Here's the food & catering plan for **${ctx.guestCount ?? 200} guests** in **${ctx.city ?? 'your city'}**.`, ctx), data: { foodPlan: generateFoodPlan(ctx) } }, updatedContext: ctx };

    case 'weather_advice':
      return { response: { type: 'weather_advice', text: `Here's the weather and season analysis for your **${ctx.eventType ?? 'event'}**${ctx.eventDate ? ` in ${ctx.eventDate}` : ''}.`, data: { weather: getWeatherAdvice(ctx) } }, updatedContext: ctx };

    case 'risk_analysis':
      return { response: { type: 'risk_analysis', text: `Here's the risk analysis for your **${ctx.eventType ?? 'event'}** — with mitigation strategies for each risk.`, data: { risks: analyseRisks(ctx) } }, updatedContext: ctx };

    case 'success_score':
      return { response: { type: 'success_score', text: `Here's your **Event Success Score** based on everything shared so far.`, data: { score: calculateSuccessScore(ctx) } }, updatedContext: ctx };

    case 'plan_event': {
      const plan = generateWeddingPlan(ctx);
      return {
        response: {
          type: 'wedding_plan',
          text: withFollowUp(`Here's your complete **${ctx.durationDays && ctx.durationDays > 1 ? `${ctx.durationDays}-day ` : ''}${ctx.eventType ?? 'event'} plan** for **${ctx.guestCount ?? 200} guests** in **${ctx.city ?? 'your city'}** — budget **${fmt(ctx.budget ?? 800000)}**.`, ctx),
          data: { weddingPlan: plan },
        },
        updatedContext: ctx,
      };
    }

    case 'negotiation': {
      const neg = l.match(/(\d[\d,]+).*?to.*?(\d[\d,]+)|from.*?(\d[\d,]+).*?to.*?(\d[\d,]+)/i);
      if (!neg) {
        return { response: { type: 'question', text: `Sure! Share the vendor type, current price, and your target price — e.g. *"Negotiate with photographer from ₹60K to ₹45K"*` }, updatedContext: ctx };
      }
      const cur = parseInt((neg[1] || neg[3] || '0').replace(/,/g, ''));
      const tgt = parseInt((neg[2] || neg[4] || '0').replace(/,/g, ''));
      const vt = /photographer/i.test(l) ? 'Photographer' : /decorator/i.test(l) ? 'Decorator' : /caterer/i.test(l) ? 'Caterer' : /dj/i.test(l) ? 'DJ' : 'Vendor';
      return { response: { type: 'negotiation', text: `Here's a professional negotiation message for your **${vt}**.`, data: { negotiation: generateNegotiationMessage(vt, cur, tgt) } }, updatedContext: ctx };
    }
  }

  // ── Anything else — let the LLM handle it with context ───────────────────
  // This covers: general_question, find_vendors (when no retrieval triggered),
  // comparison, follow_up, clarification, etc.
  // The LLM in llm.ts will receive the orchestration result + RAG context.
  return {
    response: { type: 'text', text: '' }, // placeholder — LLM will fill this
    updatedContext: ctx,
  };
}

// ─── Wedding Planner Engine ───────────────────────────────────────────────────
// Generates a professional day-wise itinerary FIRST, then budget.

function buildTimeSlots(dayType: string, city: string, luxuryLevel: LuxuryLevel): TimeSlot[] {
  const slots: Record<string, TimeSlot[]> = {
    haldi: [
      { time:"07:00 AM", activity:"Venue decoration team arrives — marigold & floral setup", who:"Decorator", period:"morning", note:"Bright yellows and oranges — sets the festive tone" },
      { time:"08:00 AM", activity:"Photography team setup — venue detail shots", who:"Photographer", period:"morning" },
      { time:"09:00 AM", activity:"Bride & Groom get ready — traditional outfits", who:"Bride, Groom", period:"morning" },
      { time:"09:30 AM", activity:"Haldi ceremony begins — family applies first", who:"Family", period:"morning", note:"Pandit/elder to guide the ritual" },
      { time:"10:30 AM", activity:"Friends join — fun, candid haldi moments", who:"All Guests", period:"morning" },
      { time:"11:30 AM", activity:"Candid photography — golden haldi glow shots", who:"Photographer", period:"morning", note:"Best natural lighting for portraits" },
      { time:"12:30 PM", activity:"Lunch served — light, festive menu", who:"All Guests", period:"afternoon" },
      { time:"01:30 PM", activity:"Mehendi artists begin — bridal & guest mehendi", who:"Bride, Guests", period:"afternoon", note:"Book 4-5 artists for large parties" },
      { time:"03:30 PM", activity:"Music & folk songs — DJ or live folk artist", who:"All", period:"afternoon" },
      { time:"05:00 PM", activity:"Tea & snacks served", who:"All Guests", period:"evening" },
      { time:"05:30 PM", activity:"Mehendi photography — detail close-up shots", who:"Photographer", period:"evening" },
      { time:"06:30 PM", activity:"Event concludes — venue cleanup begins", who:"Coordinator", period:"evening" },
    ],
    sangeet: [
      { time:"03:00 PM", activity:"Stage & LED decoration setup", who:"Decorator", period:"afternoon", note:"LED panels, draping, and truss rigging take 3-4 hours" },
      { time:"04:30 PM", activity:"Sound check — DJ / Live Band", who:"DJ/Band", period:"afternoon" },
      { time:"05:30 PM", activity:"Makeup & getting ready — bride, groom, family", who:"Bride, Groom, Family", period:"evening" },
      { time:"07:00 PM", activity:"Guest arrival — welcome drinks & mocktails", who:"All Guests", period:"evening" },
      { time:"07:30 PM", activity:"Anchor introduces the evening & sets the vibe", who:"Anchor", period:"evening" },
      { time:"07:45 PM", activity:"Family dance performances — rehearsed groups", who:"Family", period:"evening", note:"Coordinate song list and order in advance" },
      { time:"08:30 PM", activity:"Professional dance performance (if booked)", who:"Performers", period:"evening" },
      { time:"09:00 PM", activity:"Dinner service opens — live food counters", who:"All Guests", period:"night" },
      { time:"09:30 PM", activity:"DJ night begins — open dance floor", who:"All", period:"night" },
      { time:"10:30 PM", activity:"Couple takes the floor — special romantic set", who:"Bride, Groom", period:"night" },
      { time:"11:00 PM", activity:"High-energy finale — all guests on floor", who:"All", period:"night" },
      { time:"11:30 PM", activity:"Event concludes — thank you to guests", who:"All", period:"night" },
    ],
    mehendi: [
      { time:"09:00 AM", activity:"Decoration setup — floral lounge, cushions, fairy lights", who:"Decorator", period:"morning" },
      { time:"10:00 AM", activity:"Mehendi artists arrive & setup workstations", who:"Mehendi Artists", period:"morning" },
      { time:"10:30 AM", activity:"Bridal mehendi begins (3-4 hours for full bridal design)", who:"Bride", period:"morning", note:"Book your best mehendi artist for the bride" },
      { time:"11:00 AM", activity:"Guest mehendi begins — fun designs", who:"Guests", period:"morning" },
      { time:"12:30 PM", activity:"Lunch served — finger foods & chai", who:"All", period:"afternoon" },
      { time:"01:30 PM", activity:"Live music or playlist — festive Bollywood songs", who:"DJ/Musician", period:"afternoon" },
      { time:"02:30 PM", activity:"Mehendi photography — hand close-ups, group shots", who:"Photographer", period:"afternoon" },
      { time:"04:00 PM", activity:"High tea & sweets", who:"All Guests", period:"afternoon" },
      { time:"05:00 PM", activity:"Event winds down — guests leave", who:"All", period:"evening" },
    ],
    wedding: [
      { time:"05:30 AM", activity:"Decoration team arrives — mandap & stage setup begins", who:"Decorator", period:"morning", note:"CRITICAL — must complete before guests arrive" },
      { time:"06:00 AM", activity:"Florist arrives — fresh flower arrangements", who:"Florist", period:"morning" },
      { time:"06:30 AM", activity:"Electricians finalize lighting rigs", who:"Electrician", period:"morning" },
      { time:"07:00 AM", activity:"Bridal makeup & hair begins", who:"Bride", period:"morning", note:"Allow 2-3 hours for bridal makeup" },
      { time:"08:00 AM", activity:"Catering team arrives — kitchen & buffet setup", who:"Caterer", period:"morning" },
      { time:"08:30 AM", activity:"Photography team arrives — venue detail shots", who:"Photographer", period:"morning" },
      { time:"09:00 AM", activity:"Groom gets ready with family", who:"Groom", period:"morning" },
      { time:"10:00 AM", activity:"Pre-wedding photos — bride & groom separately", who:"Bride, Groom", period:"morning" },
      { time:"11:00 AM", activity:"Family portraits — both sides", who:"Family", period:"morning" },
      { time:"11:30 AM", activity:"Baraat / Groom's procession begins — band leads", who:"Groom, Band/DJ", period:"morning", note:"Coordinate baraat route with venue in advance" },
      { time:"12:30 PM", activity:"Welcome ceremony — exchange of garlands (Varmala)", who:"All", period:"afternoon" },
      { time:"01:00 PM", activity:"Lunch served for guests (buffet opens)", who:"All Guests", period:"afternoon" },
      { time:"02:00 PM", activity:"Main ceremony — Pheras / Rituals begin", who:"Bride, Groom, Pandit", period:"afternoon", note:"Confirm auspicious muhurat with Pandit" },
      { time:"04:30 PM", activity:"Ceremony concludes — couple portraits", who:"Bride, Groom", period:"afternoon" },
      { time:"05:30 PM", activity:"Golden Hour photography — outdoor / rooftop", who:"Bride, Groom, Photographer", period:"evening", note:"BEST natural light of the day — do not skip this" },
      { time:"06:30 PM", activity:"Cocktail hour — welcome drinks, mingling", who:"All Guests", period:"evening" },
      { time:"07:30 PM", activity:"Dinner service opens — live food counters", who:"All Guests", period:"night" },
      { time:"08:30 PM", activity:"DJ / Live Band performance begins", who:"All", period:"night" },
      { time:"09:30 PM", activity:"First dance — couple takes the floor", who:"Bride, Groom", period:"night" },
      { time:"10:30 PM", activity:"Event winds down — family farewells", who:"All", period:"night" },
      { time:"11:00 PM", activity:"Vendor wrap-up & final payments", who:"Coordinator", period:"night" },
    ],
    reception: [
      { time:"04:00 PM", activity:"Banquet hall setup — stage, lighting, decoration", who:"Decorator", period:"afternoon" },
      { time:"05:30 PM", activity:"Photography setup — couple ready session", who:"Photographer", period:"evening" },
      { time:"06:00 PM", activity:"Makeup & getting ready", who:"Bride, Groom", period:"evening" },
      { time:"07:00 PM", activity:"Guest arrival begins — cocktail hour", who:"All Guests", period:"evening" },
      { time:"07:30 PM", activity:"Grand entry of the couple — DJ intro", who:"Bride, Groom, DJ", period:"evening", note:"Coordinate song choice in advance" },
      { time:"08:00 PM", activity:"Stage photo session — couple with guests", who:"All", period:"night" },
      { time:"08:30 PM", activity:"Dinner service opens", who:"All Guests", period:"night" },
      { time:"09:00 PM", activity:"DJ night — dance floor opens", who:"All", period:"night" },
      { time:"10:30 PM", activity:"Cake cutting (if planned)", who:"Bride, Groom", period:"night" },
      { time:"11:00 PM", activity:"Event concludes", who:"All", period:"night" },
    ],
  };
  return (slots[dayType] ?? slots.wedding).map(s => s);
}

function buildDayBudget(dayType: string, totalBudget: number, durationDays: number, m: number): DayBudget {
  const dayShare = totalBudget / durationDays;
  const allocations: Record<string, { category: string; pct: number; note: string }[]> = {
    haldi:    [{ category:"Decoration",pct:35,note:"Floral & haldi props"},{category:"Catering",pct:25,note:"Lunch + snacks"},{category:"Photography",pct:18,note:"Candid coverage"},{category:"Mehendi Artists",pct:12,note:"2-4 artists"},{category:"Makeup",pct:6,note:"Bridal look"},{category:"Buffer",pct:4,note:"Contingency"}],
    mehendi:  [{ category:"Mehendi Artists",pct:40,note:"Bridal + guests"},{category:"Decoration",pct:20,note:"Lounge setup"},{category:"Catering",pct:22,note:"Lunch + chai"},{category:"Photography",pct:12,note:"Detail shots"},{category:"Buffer",pct:6,note:"Contingency"}],
    sangeet:  [{ category:"Entertainment",pct:30,note:"DJ + performers"},{category:"Decoration",pct:18,note:"LED + stage"},{category:"Catering",pct:24,note:"Dinner + drinks"},{category:"Venue",pct:14,note:"Hall hire"},{category:"Photography",pct:8,note:"Candid"},{category:"Buffer",pct:6,note:"Contingency"}],
    wedding:  [{ category:"Venue & Mandap",pct:28,note:"Hall + mandap setup"},{category:"Catering",pct:30,note:"Full-day food"},{category:"Photography",pct:12,note:"Full-day coverage"},{category:"Decoration",pct:14,note:"Floral + lighting"},{category:"Entertainment",pct:8,note:"Band + DJ"},{category:"Makeup",pct:4,note:"Bridal"},{category:"Buffer",pct:4,note:"Contingency"}],
    reception:[{ category:"Venue",pct:30,note:"Banquet hall"},{category:"Catering",pct:30,note:"Dinner"},{category:"Decoration",pct:16,note:"Stage + lighting"},{category:"Entertainment",pct:10,note:"DJ"},{category:"Photography",pct:10,note:"Coverage"},{category:"Buffer",pct:4,note:"Contingency"}],
  };
  const alloc = allocations[dayType] ?? allocations.wedding;
  const breakdown = alloc.map(a => ({
    category: a.category,
    amount:   Math.round(dayShare * a.pct / 100 * m),
    note:     a.note,
  }));
  return { total: Math.round(dayShare), breakdown };
}

function buildDayVendors(dayType: string, city: string, m: number): DayVendor[] {
  const base = `/artists?city=${encodeURIComponent(city)}`;
  const maps: Record<string, DayVendor[]> = {
    haldi: [
      { role:"Decorator",      description:"Floral & haldi decoration — marigold theme",   budgetRange:`${fmt(Math.round(20000*m))}–${fmt(Math.round(60000*m))}`,  searchUrl:`${base}&category=decorators`,    urgency:"book_now"  },
      { role:"Photographer",   description:"Candid & fun coverage of haldi moments",        budgetRange:`${fmt(Math.round(15000*m))}–${fmt(Math.round(35000*m))}`,  searchUrl:`${base}&category=photographers`, urgency:"book_now"  },
      { role:"Mehendi Artist", description:"2-4 artists for bridal & guest mehendi",         budgetRange:`${fmt(Math.round(8000*m))}–${fmt(Math.round(20000*m))}`,   searchUrl:`${base}&category=mehendi`,       urgency:"flexible"  },
      { role:"Caterer",        description:"Lunch + snacks for the day",                    budgetRange:`${fmt(Math.round(400*m))}/plate`,                           searchUrl:`${base}&category=catering`,      urgency:"book_now"  },
    ],
    sangeet: [
      { role:"DJ / Live Band", description:"High-energy entertainment for the night",        budgetRange:`${fmt(Math.round(20000*m))}–${fmt(Math.round(60000*m))}`,  searchUrl:`${base}&category=dj`,            urgency:"book_now"  },
      { role:"Anchor / Emcee", description:"Keeps the program flowing all night",            budgetRange:`${fmt(Math.round(10000*m))}–${fmt(Math.round(30000*m))}`,  searchUrl:`${base}&category=anchors`,       urgency:"book_now"  },
      { role:"Decorator",      description:"LED stage, draping, lighting effects",           budgetRange:`${fmt(Math.round(40000*m))}–${fmt(Math.round(100000*m))}`, searchUrl:`${base}&category=decorators`,    urgency:"book_now"  },
      { role:"Choreographer",  description:"Family dance choreography (optional)",           budgetRange:`${fmt(Math.round(15000*m))}–${fmt(Math.round(40000*m))}`,  searchUrl:`${base}&category=choreographers`,urgency:"flexible"  },
    ],
    wedding: [
      { role:"Photographer",   description:"Full-day wedding coverage — must book 5 months ahead", budgetRange:`${fmt(Math.round(30000*m))}–${fmt(Math.round(80000*m))}`,  searchUrl:`${base}&category=photographers`, urgency:"book_now"  },
      { role:"Videographer",   description:"Cinematic wedding film",                         budgetRange:`${fmt(Math.round(25000*m))}–${fmt(Math.round(70000*m))}`,  searchUrl:`${base}&category=videographers`, urgency:"book_now"  },
      { role:"Decorator",      description:"Mandap, stage & full venue decoration",          budgetRange:`${fmt(Math.round(60000*m))}–${fmt(Math.round(200000*m))}`, searchUrl:`${base}&category=decorators`,    urgency:"book_now"  },
      { role:"Caterer",        description:"Full-day catering — all meals",                  budgetRange:`${fmt(Math.round(600*m))}/plate`,                           searchUrl:`${base}&category=catering`,      urgency:"book_now"  },
      { role:"Makeup Artist",  description:"Bridal makeup — book trial 2 weeks before",     budgetRange:`${fmt(Math.round(10000*m))}–${fmt(Math.round(40000*m))}`,  searchUrl:`${base}&category=makeup`,        urgency:"book_now"  },
    ],
    reception: [
      { role:"DJ",             description:"Dance floor energy all night",                   budgetRange:`${fmt(Math.round(15000*m))}–${fmt(Math.round(45000*m))}`,  searchUrl:`${base}&category=dj`,            urgency:"book_now"  },
      { role:"Photographer",   description:"Reception coverage",                             budgetRange:`${fmt(Math.round(20000*m))}–${fmt(Math.round(50000*m))}`,  searchUrl:`${base}&category=photographers`, urgency:"book_now"  },
      { role:"Decorator",      description:"Banquet hall styling",                           budgetRange:`${fmt(Math.round(40000*m))}–${fmt(Math.round(100000*m))}`, searchUrl:`${base}&category=decorators`,    urgency:"book_now"  },
    ],
  };
  return maps[dayType] ?? maps.wedding;
}

function buildDayChecklist(dayType: string): DayChecklist[] {
  const lists: Record<string, DayChecklist[]> = {
    haldi:   [{ task:"Confirm decoration setup time with vendor", priority:"must", owner:"Coordinator"},{task:"Prepare haldi paste — fresh & organic",priority:"must",owner:"Family"},{task:"Arrange extra towels/old clothes for guests",priority:"should",owner:"Family"},{task:"Confirm mehendi artist arrival time",priority:"must",owner:"Bride"},{task:"Create haldi photo shot list",priority:"should",owner:"Couple"},{task:"Keep backup outfits ready",priority:"should",owner:"Bride, Groom"}],
    sangeet: [{ task:"Submit song list to DJ — 48 hrs before", priority:"must", owner:"Family"},{task:"Rehearse all family dance performances",priority:"must",owner:"Family"},{task:"Confirm anchor script & programme order",priority:"must",owner:"Coordinator"},{task:"Test all microphones & sound levels",priority:"must",owner:"DJ/Sound"},{task:"Coordinate couple's grand entry song",priority:"must",owner:"Couple"},{task:"Arrange props for performances",priority:"should",owner:"Family"}],
    wedding: [{ task:"Confirm muhurat timings with Pandit", priority:"must", owner:"Family"},{task:"Baraat route confirmed with venue",priority:"must",owner:"Coordinator"},{task:"All vendor arrival times confirmed — 1 week before",priority:"must",owner:"Coordinator"},{task:"Final headcount sent to caterer",priority:"must",owner:"Family"},{task:"Golden hour location scouted",priority:"must",owner:"Photographer"},{task:"Emergency kit ready (medicines, pins, tape)",priority:"must",owner:"Coordinator"},{task:"Groom outfit finalised & pressed",priority:"must",owner:"Groom"}],
    mehendi: [{ task:"Confirm number of mehendi artists needed", priority:"must", owner:"Bride"},{task:"Design references shared with artist",priority:"must",owner:"Bride"},{task:"Seating arrangement for mehendi lounge",priority:"should",owner:"Coordinator"},{task:"Music playlist ready",priority:"should",owner:"Family"},{task:"Keep lemon & sugar water for mehendi setting",priority:"should",owner:"Family"}],
    reception:[{ task:"Couple's grand entry song finalised", priority:"must", owner:"Couple"},{task:"Stage slot for couple photos confirmed",priority:"must",owner:"Photographer"},{task:"DJ playlist submitted",priority:"must",owner:"Family"},{task:"Guest seating chart finalised",priority:"should",owner:"Coordinator"}],
  };
  return lists[dayType] ?? lists.wedding;
}

function buildAiTips(dayType: string, ctx: PlannerContext): string[] {
  const season = getSeason(ctx.eventDate);
  const tips: Record<string, string[]> = {
    haldi:   ["Use real marigold flowers — they photograph beautifully and are cost-effective",`For ${ctx.city ?? "your city"} in ${season}, ${season === "summer" ? "schedule haldi before 10 AM to avoid heat" : season === "monsoon" ? "keep it indoor to avoid rain disruption" : "10 AM start is perfect"}`, "Hire a drone operator for stunning aerial haldi shots if budget allows","Prepare fun props — sunglasses, flower garlands, coloured powders for candid shots","Natural haldi paste (not turmeric powder) is gentler on skin and photographs better"],
    sangeet: ["Start sangeet preparations 3 weeks in advance — give family time to rehearse","A professional anchor makes the difference between a chaotic and seamless night","Live band for dinner hour + DJ for dancing after = the best combo",`December in ${ctx.city ?? "your city"} means cool evenings — perfect for an outdoor sangeet stage`,"Hire a choreographer for the bride's/groom's family — they'll thank you later","Keep a backup indoor option if sangeet is planned outdoors"],
    mehendi: ["Full bridal design takes 3-4 hours — start the bride's mehendi first","Book 1 artist per 8-10 guests for a comfortable pace","Cone quality matters — always check artist's cone brand before booking","Create a cozy, intimate atmosphere — low seating, fairy lights, floor cushions","The darker the mehendi, the deeper the love — lemon juice + sugar solution helps"],
    wedding: ["The ceremony timing (muhurat) is sacred — confirm with your Pandit at least 2 months before","Golden Hour (5:30–6:30 PM) is the single most important photography window — protect it","Book your baraat DJ/band separately from the main evening entertainment","Have a coordinator whose only job is to manage vendor timings — not a family member",`${season === "monsoon" ? "⚠️ RAIN ALERT: Have a fully equipped indoor backup venue confirmed" : `${season} weddings in ${ctx.city ?? "India"} are beautiful — but have a generator backup confirmed`}`,"First dance song — practice it at least once before the wedding day"],
    reception:[`Reception in ${season} — perfect for an elegant evening celebration`,"Keep reception programme tight — maximum 3 hours of structured events, rest is free flow","Photo booth with props is a crowd favourite and great for candid shots","Arrange special dietary options — at least one vegan counter for urban guest lists","Coordinate with photographer on key shots: couple entry, first dance, cake cut, family groups"],
  };
  return tips[dayType] ?? tips.wedding;
}

export function generateWeddingPlan(ctx: PlannerContext): WeddingPlan {
  const {
    budget = 800000, guestCount = 200, city = "Hyderabad",
    durationDays = 3, eventType = "wedding",
    luxuryLevel = "standard", eventDate, theme = "Traditional & Elegant",
  } = ctx;

  const m = getMul(ctx);
  const season = getSeason(eventDate);
  const seasonLabel = { winter:"Winter (Nov–Feb)", summer:"Summer (Mar–May)", monsoon:"Monsoon (Jun–Sep)", autumn:"Autumn (Oct)" }[season];

  // Day type mapping based on duration
  const dayTypes: Record<number, string[]> = {
    1: [eventType],
    2: ["mehendi", eventType],
    3: ["haldi", "sangeet", eventType === "wedding" ? "wedding" : "reception"],
    4: ["haldi", "mehendi", "sangeet", "wedding"],
  };
  const days = Math.min(durationDays, 4);
  const dayTypeList = dayTypes[days] ?? dayTypes[3];

  // Day labels
  const dayLabels: Record<number, string[]> = {
    1: [`${eventType.charAt(0).toUpperCase() + eventType.slice(1)} Day`],
    2: ["Day 1 – Mehendi Ceremony", "Day 2 – Wedding Day"],
    3: ["Day 1 – Haldi Ceremony", "Day 2 – Sangeet Night", "Day 3 – Wedding Day"],
    4: ["Day 1 – Haldi Ceremony", "Day 2 – Mehendi Night", "Day 3 – Sangeet Night", "Day 4 – Wedding Day"],
  };
  const labels = dayLabels[days] ?? dayLabels[3];

  const dayThemes: Record<string, string> = {
    haldi: "Vibrant & Playful — Yellows and Oranges",
    mehendi: "Intimate & Artistic — Earthy Tones",
    sangeet: "Glam & High-Energy — Bold Colours & LED",
    wedding: "Grand & Traditional — Gold, Red & Ivory",
    reception: "Elegant & Modern — Pastels & Whites",
  };

  const dayDescriptions: Record<string, string> = {
    haldi: "A joyful pre-wedding ritual filled with colour, laughter, and love. The haldi ceremony cleanses and blesses the bride and groom before their big day.",
    mehendi: "An intimate evening of intricate artistry. Mehendi symbolises love and new beginnings — a beautiful tradition celebrated with music and togetherness.",
    sangeet: "A night of music, dance, and celebration. Families come together to perform, enjoy, and create memories that last a lifetime.",
    wedding: "The main event — a sacred union witnessed by family and friends. Every detail of this day has been planned to create an unforgettable experience.",
    reception: "A grand celebration of the newlyweds. An evening of elegance, dancing, and dining to welcome the couple into their new life together.",
  };

  // Build day plans
  const dayPlans: DayPlan[] = dayTypeList.map((dt, i) => ({
    day:         i + 1,
    label:       labels[i] ?? `Day ${i + 1}`,
    theme:       dayThemes[dt] ?? "Elegant & Traditional",
    description: dayDescriptions[dt] ?? "",
    slots:       buildTimeSlots(dt, city, luxuryLevel),
    budget:      buildDayBudget(dt, budget, days, m),
    checklist:   buildDayChecklist(dt),
    vendors:     buildDayVendors(dt, city, m),
    aiTips:      buildAiTips(dt, ctx),
    sunrise:     "06:15 AM",
    goldenHour:  "05:30 PM – 06:30 PM",
  }));

  const totalSpend = dayPlans.reduce((s, d) => s + d.budget.total, 0);
  const remaining  = budget - totalSpend;
  const minBudget  = (MIN_CPG["wedding"] ?? 2500) * guestCount * getCityMul(city);
  const feasibility: WeddingOverview["feasibility"] =
    budget >= minBudget * 1.2 ? "excellent" :
    budget >= minBudget       ? "good" :
    budget >= minBudget * 0.7 ? "tight" : "insufficient";

  const overview: WeddingOverview = {
    days,
    totalBudget: budget,
    guestCount,
    location: city,
    style: theme,
    season: seasonLabel,
    budgetPerDay: Math.round(budget / days),
    feasibility,
    feasibilityNote: feasibility === "excellent"
      ? `${fmt(budget)} is excellent for a ${days}-day wedding with ${guestCount} guests in ${city}. You have room for premium vendors.`
      : feasibility === "good"
      ? `${fmt(budget)} is workable for ${guestCount} guests in ${city}. Stick to the per-day allocations and you'll be fine.`
      : feasibility === "tight"
      ? `${fmt(budget)} is tight for ${guestCount} guests. We've optimised the plan to stay within budget — follow vendor suggestions carefully.`
      : `${fmt(budget)} is below the recommended minimum (${fmt(Math.round(minBudget))}) for ${guestCount} guests. Consider reducing the guest list to ${Math.floor(budget / ((MIN_CPG["wedding"] ?? 2500) * getCityMul(city)))}.`,
  };

  return {
    overview,
    days: dayPlans,
    totalSpend,
    remaining,
    globalTips: [
      "Book ALL vendors at least 4-6 months in advance — wedding season books out fast",
      "Always get written contracts with cancellation clauses for every vendor",
      "Assign one dedicated coordinator per day — not a family member",
      "Keep 10% of total budget as emergency buffer — unexpected costs always arise",
      `${season === "winter" ? "Peak season pricing applies — expect 20-30% premium on all vendors" : season === "monsoon" ? "Monsoon pricing is 15-20% lower — but ALWAYS have indoor backup" : "Off-peak season — great opportunity to negotiate better vendor rates"}`,
      "Photography & videography are the only things you cannot redo — never cut this budget",
    ],
    successScore: Math.min(100, Math.round(
      (feasibility === "excellent" ? 92 : feasibility === "good" ? 82 : feasibility === "tight" ? 68 : 50) *
      ([budget, guestCount, city, eventDate].filter(Boolean).length / 4)
    )),
    confidence: Math.round(([budget, guestCount, city, eventDate, luxuryLevel].filter(Boolean).length / 5) * 90 + 10),
  };
}

// ─── Quick Prompts ────────────────────────────────────────────────────────────
export const QUICK_PROMPTS = [
  { label: "Plan my wedding",        prompt: "Plan my complete wedding",                                              icon: "💒" },
  { label: "Budget breakdown",       prompt: "Give me a detailed budget breakdown for my event",                      icon: "💰" },
  { label: "Full event plan",        prompt: "Create a complete plan for my event with timeline and vendors",         icon: "📋" },
  { label: "Event timeline",         prompt: "Create a complete planning timeline for my event",                      icon: "📅" },
  { label: "Vendor recommendations", prompt: "Recommend the best vendors for my event",                               icon: "🎯" },
  { label: "Success score",          prompt: "Give me an event success score for my current plan",                    icon: "📊" },
  { label: "Risk analysis",          prompt: "Analyse the risks for my event and suggest backup plans",               icon: "⚠️" },
  { label: "Food planning",          prompt: "Help me plan food and catering for my event",                           icon: "🍽️" },
  { label: "Best month to book",     prompt: "Which month is best for a wedding in Hyderabad?",                       icon: "🌤️" },
  { label: "Negotiate vendor price", prompt: "Help me negotiate with my photographer from Rs 60,000 to Rs 45,000",    icon: "🤝" },
  { label: "Hidden costs",           prompt: "What are the hidden costs in a wedding I should know about?",           icon: "💡" },
  { label: "Is my budget enough?",   prompt: "Is Rs 8 lakh enough for a wedding with 400 guests in Hyderabad?",      icon: "🤔" },
];
