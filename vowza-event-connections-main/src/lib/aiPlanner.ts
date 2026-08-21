
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

import { EventBudgetPlanner } from "./eventBudgetPlanner";
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

// ─── DEPRECATED: Legacy fixed-percentage budget allocation ──────────────────
// This dictionary is DEPRECATED and replaced by EventBudgetPlanner.allocate()
// which uses requirement-driven, event-aware budget generation.
// Reason: Fixed percentages are not suitable for requirement-driven budgeting.
// The event-aware system in eventBudgetPlanner.ts is now the single authority.
// const BUDGET_ALLOC: Record<string, { cat: string; pct: number; notes: string; canReduce: boolean; reduceTip: string }[]> = { ... };
// const DEFAULT_ALLOC = BUDGET_ALLOC.wedding;

const MIN_CPG: Record<string, number> = {
  wedding:2500,reception:1800,birthday:800,corporate:2000,sangeet:1200,
  engagement:1500,haldi:600,mehendi:500,babyshower:700,housewarming:600,
  anniversary:1000,collegefest:400,concert:500,temple:300,privateparty:1000,
  festival:400,charity:800,productlaunch:2500,exhibition:2000,djnight:800,
  conference:2200,fashionshow:1500,sportsEvent:600,default:1000,
};

// ─── Budget Planner ───────────────────────────────────────────────────────────
// ─── Event Overview Generator ─────────────────────────────────────────────────
// Produces the "expert planner" narrative that accompanies every plan_event
// response: Decoration Ideas, Photography Plan, Entertainment Plan, Guest
// Management, Parking Plan, Weather Backup, Emergency Planning, and Money
// Saving Tips. This is pure AI knowledge — it never touches the vendor
// database and is always safe to show immediately.
const DECORATION_IDEAS: Record<string, string[]> = {
  wedding:       ["Floral mandap with marigold, roses & jasmine in gold/red/ivory palette", "Draped fabric backdrops with fairy lights for the stage", "Hanging floral chandeliers over the mandap and entrance", "Themed centerpieces per table matching the couple's colour scheme"],
  reception:     ["Elegant pastel florals with LED uplighting", "Modern geometric backdrop with the couple's monogram", "Candle-lit centerpieces for a romantic evening ambience", "Photo wall with fairy lights for guest photo-ops"],
  birthday:      ["Balloon garlands and backdrop matching the theme colour", "Personalised banner with name/age cutouts", "Table centerpieces with themed props", "Photo booth corner with fun props"],
  housewarming:  ["Traditional torans and rangoli at the entrance", "Diya and flower decor around the puja area", "Fresh flower garlands on doors and windows", "Simple elegant table settings for guests"],
  engagement:    ["Floral arch for the ring ceremony moment", "Fairy-lit backdrop in soft pastel tones", "Elegant centerpieces with candles and roses", "Welcome signage with the couple's names"],
  corporate:     ["Branded backdrop with company logo and colours", "Clean stage setup with LED screen for presentations", "Registration desk with branded standees", "Minimal, professional centerpieces"],
  corporate_event: ["Branded backdrop with company logo and colours", "Clean stage setup with LED screen for presentations", "Registration desk with branded standees", "Minimal, professional centerpieces"],
  babyshower:    ["Soft pastel balloon arch (pink/blue/neutral)", "Themed banner and welcome signage", "Baby-themed centerpieces and dessert table styling", "Photo corner with props for the mom-to-be"],
  college_event: ["Vibrant college colors and banners", "Photo booth with college branding", "Stage setup with sound system and LED screen", "Casual seating and standing areas with casual decor"],
  anniversary:   ["Romantic setup with candles and soft lighting", "Photo collage of the couple through the years", "Elegant floral arrangements in gold/silver tones", "Intimate seating arrangement for the couple"],
  default:       ["Backdrop styled to match your chosen theme and colour palette", "Fresh floral or fabric centerpieces for each table", "Entrance decor that sets the tone for guests", "Ambient lighting — fairy lights or uplighting for evening events"],
};

const PHOTOGRAPHY_PLANS: Record<string, string[]> = {
  wedding:   ["Pre-event detail shots — decor, venue, outfits (1 hr before guests arrive)", "Candid coverage through all rituals and the main ceremony", "Golden Hour couple portraits (typically 5:30–6:30 PM)", "Family group photos — allocate a dedicated 30-min slot", "Drone/aerial shots for wide venue coverage if outdoor"],
  reception: ["Couple's grand entry shot", "First dance and cake-cutting moments", "Candid guest interaction shots throughout the evening", "Formal family portraits early in the evening before it gets crowded"],
  birthday:  ["Candid shots throughout the party", "Cake-cutting and gift-opening moments", "Group photos with family and friends", "Fun/candid shots near the photo booth"],
  housewarming: ["Griha Pravesh ceremony moments", "Family inside the new home", "Group photos with guests", "Detail shots of decoration and ritual setup"],
  babyshower: ["Mom-to-be portrait shots", "Belly painting or maternity photos", "Group photos with friends and family", "Candid moments of games and celebrations"],
  engagement: ["Couple's ring exchange moment", "Formal couple portraits", "Family group photos", "Candid guest interaction shots"],
  college_event: ["Event opening and key moments", "Performer/artist shots", "Audience candid shots", "Award distribution moments"],
  corporate_event: ["Venue setup and registration", "Speaker/panelist shots during sessions", "Networking and casual interaction moments", "Award/recognition ceremony moments"],
  anniversary: ["Couple portrait shots", "Candid moments with guests", "Cake-cutting ceremony", "Special anniversary dance or moment"],
  default:   ["Candid coverage of key moments throughout the event", "Formal group photos with family/guests", "Detail shots of decor and setup", "Golden hour outdoor shots if the venue allows"],
};

const ENTERTAINMENT_PLANS: Record<string, string[]> = {
  wedding:    ["Baraat/procession music — live band or DJ", "Post-ceremony DJ set for dancing", "Optional: live singer for dinner-hour ambience"],
  sangeet:    ["Choreographed family performances", "Live band for the first half, DJ for dancing after", "Anchor/emcee to keep the flow smooth between acts"],
  reception:  ["Live band or DJ for background music during dinner", "Dedicated dance floor session post-dinner", "First dance moment choreographed in advance"],
  birthday:   ["Music playlist or DJ matched to the age group and theme", "Games/activities appropriate to guest ages", "Cake-cutting moment with a dedicated song"],
  housewarming: ["Soft background music during gathering", "Informal socializing and conversations", "Optional: light music during meal service"],
  babyshower: ["Soft, relaxing background music", "Fun games for guests", "Special moment for mom-to-be recognition"],
  engagement: ["Background music during cocktails", "First dance of the newly engaged couple", "DJ for dancing post-dinner"],
  corporate_event: ["Background music during sessions (if applicable)", "MC to manage agenda transitions smoothly", "Optional: live band or curated playlist for closing mixer"],
  college_event: ["Opening performance or cultural show", "Live performances/DJ for entertainment", "Energetic music and dancing"],
  anniversary: ["Romantic background music", "Special dance or renewal of vows moment", "DJ for evening dancing"],
  corporate:  ["Welcome/background music during networking", "MC to manage agenda transitions smoothly", "Optional: live band or curated playlist for closing mixer"],
  default:    ["Curated music playlist or DJ matched to the event mood", "An anchor/emcee if the event has a formal programme", "A dedicated moment for key highlights (e.g. speeches, cake, awards)"],
};

const GUEST_MANAGEMENT_TIPS: string[] = [
  "Send invitations (digital or print) at least 4-6 weeks in advance",
  "Use an RSVP tracker (spreadsheet or app) to finalise headcount 1-2 weeks before",
  "Assign a welcome desk/coordinator for guest check-in on the day",
  "Plan seating charts in advance for formal sit-down events",
  "Share venue location, parking, and dress code details in the invite",
];

const PARKING_PLANS: string[] = [
  "Confirm venue parking capacity matches your expected guest count",
  "Arrange valet service for venues with limited on-site parking",
  "Put up clear parking signage/volunteers to direct guests smoothly",
  "For large events, consider a shuttle service from an overflow parking area",
];

const EMERGENCY_PLANS: string[] = [
  "Keep a basic first-aid kit on-site and know the nearest hospital",
  "Have a backup power/generator plan in case of outages",
  "Assign one point-of-contact coordinator for vendor issues on the day",
  "Keep printed copies of all vendor contracts and contact numbers on hand",
  "Have a weather backup (indoor space or tent) confirmed for outdoor events",
];

function pick(map: Record<string, string[]>, key?: string): string[] {
  return map[key ?? ""] ?? map.default ?? Object.values(map)[0];
}

export function generateEventOverviewText(ctx: PlannerContext): string {
  const eventType = ctx.eventType ?? "wedding";
  const eventLabel = eventType.charAt(0).toUpperCase() + eventType.slice(1);
  const city = ctx.city ?? "your city";
  const guestCount = ctx.guestCount ?? 200;
  const isOutdoor = ctx.venueType === "outdoor" || ctx.venueType === "both";

  const decor = pick(DECORATION_IDEAS, eventType);
  const photo = pick(PHOTOGRAPHY_PLANS, eventType);
  const entertainment = pick(ENTERTAINMENT_PLANS, eventType);

  const lines: string[] = [
    `## 📋 ${eventLabel} Overview — ${city}, ${guestCount} guests`,
    ``,
    `### 🎨 Decoration Ideas`,
    ...decor.map(d => `- ${d}`),
    ``,
    `### 📸 Photography Plan`,
    ...photo.map(p => `- ${p}`),
    ``,
    `### 🎤 Entertainment Plan`,
    ...entertainment.map(e => `- ${e}`),
    ``,
    `### 👥 Guest Management`,
    ...GUEST_MANAGEMENT_TIPS.slice(0, 4).map(g => `- ${g}`),
    ``,
    `### 🚗 Parking Plan`,
    ...PARKING_PLANS.slice(0, 3).map(p => `- ${p}`),
  ];

  if (isOutdoor) {
    lines.push(``, `### 🌦️ Weather Backup`, `- Confirm an indoor backup venue or a covered tent option in case of rain or extreme heat`, `- Track the weather forecast closely in the week leading up to the event`);
  }

  lines.push(
    ``, `### 🚨 Emergency Planning`,
    ...EMERGENCY_PLANS.slice(0, 3).map(e => `- ${e}`),
    ``, `### 💰 Money Saving Tips`,
    "- Book vendors 4-6 months ahead for early-bird discounts",
    "- Choose weekday dates — venues are typically 25-35% cheaper",
    "- Use seasonal local flowers instead of imported blooms",
  );

  return lines.join('\n');
}

// ─── DEPRECATED: Legacy fixed-percentage budget planner ───────────────────────
// This function is DEPRECATED. Use EventBudgetPlanner.allocate() instead.
// Reason: This function uses fixed percentages per event type (BUDGET_ALLOC),
//         which is not suitable for requirement-driven budget generation.
// Migration: The event-aware system in eventBudgetPlanner.ts is now the single
//            source of truth for budget allocation. It activates categories based
//            on actual requirements, not fixed templates.
// 
// export function generateBudgetPlan(ctx: PlannerContext): BudgetPlan {
//   const { budget = 500000, guestCount = 200, city, eventType = "wedding" } = ctx;
//   const m = getMul(ctx);
//   const alloc = BUDGET_ALLOC[eventType] ?? DEFAULT_ALLOC;
//   const breakdown: BudgetLineItem[] = alloc.map(a => {
//     const adj = (budget * a.pct / 100) * m;
//     return { category: a.cat, minCost: Math.round(adj * 0.8), maxCost: Math.round(adj * 1.25),
//              recommended: Math.round(adj), percentage: a.pct, notes: a.notes, canReduce: a.canReduce, reduceTip: a.reduceTip };
//   });
//   const grandTotal = breakdown.reduce((s, b) => s + b.recommended, 0);
//   const remaining  = budget - grandTotal;
//   const minReq     = (MIN_CPG[eventType] ?? 1000) * guestCount * getCityMul(city);
//   const isFeasible = budget >= minReq;
//   return {
//     totalBudget: budget, breakdown, grandTotal, remaining, isFeasible,
//     feasibilityNote: isFeasible
//       ? `${fmt(budget)} is workable for ${guestCount} guests in ${city ?? "your city"}. Buffer: ${fmt(Math.max(0, remaining))}.`
//       : `${fmt(budget)} is tight for ${guestCount} guests. Minimum recommended: ${fmt(Math.round(minReq))}. Consider trimming the guest list to ${Math.floor(budget / ((MIN_CPG[eventType] ?? 1000) * getCityMul(city)))}.`,
//     savingTips: [
//       "Book all vendors 4-6 months ahead — 10-20% early-bird savings",
//       "Bundle photographer + videographer for 15% package discount",
//       "Weekday events save 25-35% on venue charges",
//       "Seasonal local flowers save 25-40% on decoration",
//       "Digital invitations save ₹15K-₹40K",
//       "Limit live food counters to 2-3 (each costs ₹8K-₹15K)",
//       "Offer upfront full payment to vendors — get 10-15% off",
//     ],
//     hiddenCosts: [
//       "GST 18% on venue + catering — adds 15-20% to those bills",
//       "Overtime charges if event overruns (₹5K-₹20K per hour)",
//       "Generator/power backup (₹10K-₹25K for full day)",
//       "Security personnel (₹3K-₹8K per guard per day)",
//       "Parking management (₹5K-₹12K)",
//       "Last-minute additions — budget ₹20K-₹50K extra",
//       "Staff gratuity: 2-3% of total",
//     ],
//   };
// }

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
    housewarming: [
      {time:"08:00 AM",activity:"Venue cleaning & final prep",who:"Vendors",note:"Deep clean before ritual"},
      {time:"09:00 AM",activity:"Decoration & flower arrangement",who:"Vendor"},
      {time:"09:30 AM",activity:"Pooja items setup — incense, lamps, flowers",who:"Family"},
      {time:"10:00 AM",activity:"Pandit/Priest arrives — puja preparations",who:"Pandit"},
      {time:"10:30 AM",activity:"Guest arrival begins",who:"All"},
      {time:"11:00 AM",activity:"Griha Pravesh ceremony begins — auspicious ritual",who:"All",note:"Confirm muhurat with pandit"},
      {time:"12:00 PM",activity:"Offerings & distribution of prasad",who:"All"},
      {time:"12:30 PM",activity:"Photography — family inside home",who:"Vendor"},
      {time:"01:00 PM",activity:"Lunch/snacks served",who:"All"},
      {time:"02:00 PM",activity:"House tour & informal gathering",who:"All"},
      {time:"03:30 PM",activity:"Entertainment & music (if planned)",who:"All"},
      {time:"05:00 PM",activity:"Guests depart",who:"All"},
      {time:"05:30 PM",activity:"Cleanup & vendor wrap-up",who:"Coordinator"},
    ],
    babyshower: [
      {time:"02:00 PM",activity:"Venue decoration — pastels, baby themes",who:"Vendor"},
      {time:"02:30 PM",activity:"Guest arrival & welcome",who:"All"},
      {time:"03:00 PM",activity:"Games & icebreakers for guests",who:"All"},
      {time:"03:45 PM",activity:"Mom-to-be gets pampered — chair decoration",who:"Family"},
      {time:"04:15 PM",activity:"Gift opening ceremony",who:"All"},
      {time:"05:00 PM",activity:"Photography — belly painting or maternity shots",who:"Vendor"},
      {time:"05:30 PM",activity:"Snacks & refreshments served",who:"All"},
      {time:"06:00 PM",activity:"Cake cutting & desserts",who:"All"},
      {time:"06:30 PM",activity:"Event concludes",who:"All"},
    ],
    engagement: [
      {time:"04:00 PM",activity:"Venue & decoration setup",who:"Vendor"},
      {time:"05:00 PM",activity:"Guest arrival — welcome drinks & snacks",who:"All"},
      {time:"05:30 PM",activity:"Couple formal introduction",who:"Couple"},
      {time:"06:00 PM",activity:"Ring exchange ceremony",who:"Couple"},
      {time:"06:30 PM",activity:"Photography — couple portraits",who:"Vendor"},
      {time:"07:00 PM",activity:"Entertainment & music begins",who:"All"},
      {time:"07:30 PM",activity:"Dinner service opens",who:"All"},
      {time:"08:30 PM",activity:"Dancing & celebration",who:"All"},
      {time:"10:00 PM",activity:"Event concludes",who:"All"},
    ],
    college_event: [
      {time:"04:00 PM",activity:"Stage setup — sound, lighting, branding",who:"Vendor"},
      {time:"04:30 PM",activity:"Registration & guest check-in",who:"Staff"},
      {time:"05:00 PM",activity:"Guest arrival — welcome address",who:"Host"},
      {time:"05:30 PM",activity:"Opening performance / cultural show",who:"Artists"},
      {time:"06:30 PM",activity:"Main event / talks / competitions",who:"All"},
      {time:"07:30 PM",activity:"Refreshment break",who:"All"},
      {time:"08:00 PM",activity:"Awards / prize distribution",who:"Host"},
      {time:"08:30 PM",activity:"DJ / dancing",who:"All"},
      {time:"10:00 PM",activity:"Event concludes",who:"All"},
    ],
    anniversary: [
      {time:"05:00 PM",activity:"Venue decoration — romantic setup",who:"Vendor"},
      {time:"06:00 PM",activity:"Guest arrival — cocktails",who:"All"},
      {time:"06:30 PM",activity:"Couple's dance / special moment",who:"Couple"},
      {time:"07:00 PM",activity:"Dinner service begins",who:"All"},
      {time:"08:00 PM",activity:"Cake cutting & toasts",who:"All"},
      {time:"08:30 PM",activity:"Music & dancing",who:"All"},
      {time:"10:00 PM",activity:"Event concludes",who:"All"},
    ],
    corporate_event: [
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

  // ✅ NO FALLBACK TO WEDDING - if eventType not found, throw error instead of silent fallback
  const slots = schedules[eventType];
  if (!slots) {
    console.error(`❌ CRITICAL: No schedule defined for eventType="${eventType}". This should never happen. Please add eventType to schedules object in buildDaySchedule().`);
    // Fallback to generic schedule to prevent crash, but log loudly
    const genericSlots: HourlySlot[] = [
      {time:"09:00 AM",activity:"Event setup and guest arrival",who:"All"},
      {time:"10:00 AM",activity:"Main event begins",who:"All"},
      {time:"01:00 PM",activity:"Lunch break",who:"All"},
      {time:"03:00 PM",activity:"Continuation of event",who:"All"},
      {time:"05:00 PM",activity:"Event concludes",who:"All"},
    ];
    return { day, label, slots: genericSlots, sunrise: "06:15 AM", sunset: isOutdoor ? "06:30 PM" : undefined };
  }
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
    housewarming: ["Griha Pravesh Day"],
    birthday: ["Birthday Celebration Day"],
    babyshower: ["Baby Shower Celebration"],
    engagement: ["Engagement Ceremony"],
    college_event: ["College Event Day"],
    anniversary: ["Anniversary Celebration"],
    corporate_event: ["Corporate Event Day"],
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
  
  // Base templates for all events
  const baseTemplates: T[] = [
    { cat: "Photographer", reason: `Essential — captures memories that last forever. For a ${eventType}, invest here.`, bMin: 25000, bMax: 80000, tips: ["Ask for full-day coverage + RAW files", "View 3 complete albums before booking", "Book 5 months ahead — they fill fastest"], slug: "photographers", urgency: "book_now" },
    { cat: "Videographer", reason: "A cinematic video lets you relive the event for decades.", bMin: 20000, bMax: 70000, tips: ["Drone shots add Rs 5K-Rs 15K extra", "Request a 3-min highlight reel"], slug: "videographers", urgency: "book_now" },
    { cat: "Event Decorator", reason: `Decoration sets the entire mood. For ${guestCount} guests, invest in quality.`, bMin: 40000, bMax: 200000, tips: ["Agree on written scope before booking", "Seasonal flowers cut cost 25%", "Visit 2-3 completed setups"], slug: "decorators", urgency: "book_now" },
    { cat: "DJ / Live Band", reason: "Music is what keeps guests energised and dancing all night.", bMin: 15000, bMax: 60000, tips: ["Submit song list 2 weeks before", "Confirm backup sound system", "Sound system should be included in quote"], slug: "dj", urgency: "flexible" },
    { cat: "Caterer", reason: `Food is what guests remember most. For ${guestCount} guests, plan carefully.`, bMin: Math.round(guestCount * 600 * getCityMul(city)), bMax: Math.round(guestCount * 1800 * getCityMul(city)), tips: ["Get per-plate pricing in writing", "Include service staff in quote", "Do a tasting before signing contract"], slug: "catering", urgency: "book_now" },
    { cat: "Anchor / Emcee", reason: "A professional anchor keeps the program flowing and guests engaged.", bMin: 8000, bMax: 35000, tips: ["Share complete script in advance", "Bilingual anchors cost 15-20% more"], slug: "anchors", urgency: "flexible" },
  ];

  // Event-specific vendor additions
  const eventSpecificAdditions: Record<string, T[]> = {
    wedding: [
      { cat: "Makeup Artist", reason: "Professional bridal makeup is non-negotiable for the main event.", bMin: 8000, bMax: 40000, tips: ["Do a trial session 2 weeks before", "Confirm airbrush vs. HD makeup", "Check portfolio for your skin tone"], slug: "makeup", urgency: "book_now" },
      { cat: "Mehendi Artist", reason: "For weddings and pre-wedding functions, skilled mehendi is a must.", bMin: 5000, bMax: 25000, tips: ["Book 4-5 artists for large parties", "Allow 3 hours for full bridal design"], slug: "mehendi", urgency: "flexible" },
    ],
    housewarming: [
      { cat: "Pandit / Priest", reason: "Essential for Griha Pravesh ceremony — performs auspicious rituals.", bMin: 3000, bMax: 12000, tips: ["Confirm availability 2 weeks before", "Discuss ritual preferences & timing", "Prepare puja items list in advance"], slug: "pandit", urgency: "book_now" },
      { cat: "Rituals Specialist", reason: "Expert guidance on housewarming pooja items, sequence, and significance.", bMin: 2000, bMax: 8000, tips: ["Book with pandit for coordination", "Clarify which items are essential vs optional"], slug: "rituals", urgency: "book_now" },
      { cat: "Flower Arrangements", reason: "Fresh flowers for pooja, entry decoration, and auspiciousness.", bMin: 5000, bMax: 15000, tips: ["Marigold & roses are traditional", "Order day before to ensure freshness"], slug: "flowers", urgency: "flexible" },
    ],
    birthday: [
      { cat: "Cake Designer", reason: "The cake is the centerpiece — custom design makes it memorable.", bMin: 3000, bMax: 12000, tips: ["Order 1 week in advance", "Confirm flavor & design preferences", "Ask for tasting session"], slug: "cakes", urgency: "book_now" },
    ],
    babyshower: [
      { cat: "Baby Shower Planner", reason: "Specialized games, themes, and coordination for mom-to-be comfort.", bMin: 5000, bMax: 15000, tips: ["Confirm mother's preferences first", "Include belly painting option"], slug: "babyshower", urgency: "flexible" },
    ],
    engagement: [
      { cat: "Ring Bearer Ceremony", reason: "Special choreography for ring exchange to make it memorable.", bMin: 2000, bMax: 8000, tips: ["Rehearse timing with couple", "Ensure smooth transitions"], slug: "ceremony-coord", urgency: "flexible" },
    ],
    corporate_event: [
      { cat: "AV/Sound System Specialist", reason: "Professional audio-visual setup for presentations & visibility.", bMin: 30000, bMax: 100000, tips: ["Check screen & projector quality", "Confirm backup power", "Test microphones day before"], slug: "av-tech", urgency: "book_now" },
      { cat: "Event Coordinator", reason: "Professional coordination for schedule, vendor management, guest flow.", bMin: 15000, bMax: 50000, tips: ["Clarify scope & deliverables", "Confirm emergency contact protocol"], slug: "coordinators", urgency: "book_now" },
    ],
  };

  // Combine base + event-specific
  const templates = [...baseTemplates, ...(eventSpecificAdditions[eventType] ?? [])];
  
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
  const isHousewarming = eventType === "housewarming" || eventType === "gruhapravesam";
  const isHouseWarmingCeremony = ["housewarming", "gruhapravesam"].includes(eventType);
  
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
    ...(isHouseWarmingCeremony ? [
      { task: "Pandit/Priest availability confirmed",       category: "Ritual",    dueWhen: "1 month before",   priority: "must" as const, owner: "Family" },
      { task: "Auspicious muhurat time fixed with pandit",  category: "Ritual",    dueWhen: "2 weeks before",   priority: "must" as const, owner: "Family" },
      { task: "Pooja items list prepared (flowers, oil, etc.)", category: "Ritual", dueWhen: "1 week before", priority: "must" as const, owner: "Family" },
      { task: "Ritual items purchased & organized",         category: "Ritual",    dueWhen: "3 days before",    priority: "must" as const, owner: "Family" },
      { task: "Home deep-cleaned before ceremony",          category: "Ritual",    dueWhen: "1 day before",     priority: "must" as const, owner: "Family" },
      { task: "Invitations specify 'Griha Pravesh' timing", category: "Guests",    dueWhen: "2 months before",  priority: "must" as const, owner: "Family" },
      { task: "Prasad distribution plan finalized",         category: "Ritual",    dueWhen: "1 week before",    priority: "should" as const, owner: "Family" },
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
  const { orchestrate } = await import('./aiOrchestrator');

  // ─── PHASE 2A: Orchestrate handles extraction and merging (single merge point) ──
  const result = orchestrate(message, context, history ?? []);
  
  // Use the updated context from orchestrate (already merged and validated)
  const finalContext = result.updatedContext || context;
  const ambiguous = (result as any).ambiguousChange ?? false;

  // ── If ambiguous change, ask for clarification ──────────────────────────
  if (ambiguous) {
    const known: string[] = [];
    if (context.city) known.push(`in **${context.city}**`);
    if (context.eventType) known.push(`**${context.eventType}**`);
    return {
      response: {
        type: 'question',
        text: `I want to make sure I understand correctly. You have ${known.join(', ')}. What specific change would you like to make?`
      },
      updatedContext: context,  // Keep old context until ambiguity is resolved
    };
  }

  // ── If we need to ask the next question, do that ─────────────────────────
  if (result.shouldAskNext) {
    const known: string[] = [];
    if (finalContext.eventType)  known.push(`**${finalContext.eventType}**`);
    if (finalContext.city)       known.push(`in **${finalContext.city}**`);
    if (finalContext.budget)     known.push(`budget **${fmt(finalContext.budget)}**`);
    if (finalContext.guestCount) known.push(`**${finalContext.guestCount} guests**`);
    const prefix = known.length > 0 ? `Got it — ${known.join(', ')}. ` : '';
    return {
      response: { type: 'question', text: `${prefix}${result.shouldAskNext}` },
      updatedContext: finalContext,
    };
  }

  // ── Greeting (only on fresh sessions) ───────────────────────────────────
  if (result.intent === 'greeting') {
    const hasCtx = !!(finalContext.eventType || finalContext.city || finalContext.budget || finalContext.guestCount);
    if (hasCtx) {
      const known: string[] = [];
      if (finalContext.eventType)  known.push(`${finalContext.eventType}`);
      if (finalContext.city)       known.push(`in ${finalContext.city}`);
      if (finalContext.budget)     known.push(`budget ${fmt(finalContext.budget)}`);
      if (finalContext.guestCount) known.push(`${finalContext.guestCount} guests`);
      return {
        response: { type: 'text', text: `Hey! I still have your event details: ${known.join(' · ')}. What would you like to work on next?` },
        updatedContext: finalContext,
      };
    }
    return {
      response: {
        type: 'text',
        text: `Hello! 👋 I'm your **Vowza AI Planner** — here to help you plan any event from start to finish.\n\nJust tell me what you're planning and I'll help with budgets, vendors, timelines, and more. What's your event?`,
      },
      updatedContext: finalContext,
    };
  }

  // ── Context update acknowledgement ───────────────────────────────────────
  if (result.intent === 'context_update') {
    const changed: string[] = [];
    // Compute diffs between original and updated context
    const up: Partial<PlannerContext> = {};
    if (finalContext.city !== context.city && finalContext.city) up.city = finalContext.city;
    if (finalContext.budget !== context.budget && finalContext.budget) up.budget = finalContext.budget;
    if (finalContext.guestCount !== context.guestCount && finalContext.guestCount) up.guestCount = finalContext.guestCount;
    if (finalContext.eventType !== context.eventType && finalContext.eventType) up.eventType = finalContext.eventType;
    if (up.city)       changed.push(`city → **${up.city}**`);
    if (up.budget)     changed.push(`budget → **${fmt(up.budget)}**`);
    if (up.guestCount) changed.push(`guests → **${up.guestCount}**`);
    if (up.eventType)  changed.push(`event → **${up.eventType}**`);
    const summary = changed.length
      ? `Got it — updated: ${changed.join(', ')}. `
      : `Noted. `;
    const canGenerate = finalContext.eventType && finalContext.city && finalContext.budget && finalContext.guestCount;
    return {
      response: {
        type: 'text',
        text: `${summary}${canGenerate ? `I'll update the plan for ${finalContext.guestCount} guests in **${finalContext.city}** with a budget of **${fmt(finalContext.budget!)}**. Want me to regenerate the full plan?` : `What else should I know?`}`,
      },
      updatedContext: finalContext,
    };
  }

  // ── VEDA structured responses (only when all context is available) ───────
  switch (result.intent) {
    case 'budget_breakdown': {
      // Use event-aware budget system and transform to BudgetPlan schema
      const eventAwareBudget = EventBudgetPlanner.allocate(finalContext);
      // Transform EventBudgetPlan (allocations[]) → BudgetPlan (breakdown[])
      const budgetPlan: BudgetPlan = {
        totalBudget: eventAwareBudget.totalBudget,
        breakdown: eventAwareBudget.allocations.map(a => ({
          category: a.category,
          minCost: a.minAmount,
          maxCost: a.maxAmount,
          recommended: a.allocatedAmount,
          percentage: a.actualPercentage || a.basePercentage || 0,
          notes: a.reasoning || "Budget allocation for this category",
          canReduce: a.priority === 'low',
          reduceTip: a.priority === 'low' ? `${a.category} can be reduced if needed` : undefined,
        })),
        grandTotal: eventAwareBudget.totalAllocated,
        remaining: eventAwareBudget.remaining,
        isFeasible: eventAwareBudget.isFeasible,
        feasibilityNote: eventAwareBudget.feasibilityNotes?.[0] ?? "Budget analysis complete",
        savingTips: eventAwareBudget.recommendations,
        hiddenCosts: [],
      };
      return { response: { type: 'budget_plan', text: withFollowUp(`Here's the budget breakdown for your **${finalContext.eventType ?? 'event'}** in **${finalContext.city ?? 'your city'}** for **${finalContext.guestCount ?? 200} guests** — budget **${fmt(finalContext.budget ?? 500000)}**.`, finalContext), data: { budgetPlan } }, updatedContext: finalContext };
    }

    case 'timeline':
      return { response: { type: 'timeline', text: withFollowUp(`Here's your complete planning timeline for the **${finalContext.eventType ?? 'event'}**.`, finalContext), data: { timeline: generateTimeline(finalContext) } }, updatedContext: finalContext };

    case 'checklist':
      return { response: { type: 'checklist', text: withFollowUp(`Here's your full checklist for the **${finalContext.eventType ?? 'event'}** — every task prioritised and assigned.`, finalContext), data: { checklist: generateChecklist(finalContext) } }, updatedContext: finalContext };

    case 'food_plan':
      return { response: { type: 'food_plan', text: withFollowUp(`Here's the food & catering plan for **${finalContext.guestCount ?? 200} guests** in **${finalContext.city ?? 'your city'}**.`, finalContext), data: { foodPlan: generateFoodPlan(finalContext) } }, updatedContext: finalContext };

    case 'weather_advice':
      return { response: { type: 'weather_advice', text: `Here's the weather and season analysis for your **${finalContext.eventType ?? 'event'}**${finalContext.eventDate ? ` in ${finalContext.eventDate}` : ''}.`, data: { weather: getWeatherAdvice(finalContext) } }, updatedContext: finalContext };

    case 'risk_analysis':
      return { response: { type: 'risk_analysis', text: `Here's the risk analysis for your **${finalContext.eventType ?? 'event'}** — with mitigation strategies for each risk.`, data: { risks: analyseRisks(finalContext) } }, updatedContext: finalContext };

    case 'success_score':
      return { response: { type: 'success_score', text: `Here's your **Event Success Score** based on everything shared so far.`, data: { score: calculateSuccessScore(finalContext) } }, updatedContext: finalContext };

    case 'plan_event': {
      // Use event-aware plan generator (EventBudgetPlanner is the single source of truth for ALL budgets)
      const plan = generateEventAwarePlan(finalContext);
      
      const intro = `Here's your complete **${finalContext.durationDays && finalContext.durationDays > 1 ? `${finalContext.durationDays}-day ` : ''}${finalContext.eventType ?? 'event'} plan** for **${finalContext.guestCount ?? 200} guests** in **${finalContext.city ?? 'your city'}** — budget **${fmt(finalContext.budget ?? 800000)}**.`;
      const overview = generateEventOverviewText(finalContext);
      return {
        response: {
          type: 'wedding_plan',
          text: withFollowUp(`${intro}\n\n${overview}`, finalContext),
          data: { 
            weddingPlan: plan,
          },
        },
        updatedContext: finalContext,
      };
    }

    case 'negotiation': {
      const l = message.toLowerCase();
      const neg = l.match(/(\d[\d,]+).*?to.*?(\d[\d,]+)|from.*?(\d[\d,]+).*?to.*?(\d[\d,]+)/i);
      if (!neg) {
        return { response: { type: 'question', text: `Sure! Share the vendor type, current price, and your target price — e.g. *"Negotiate with photographer from ₹60K to ₹45K"*` }, updatedContext: finalContext };
      }
      const cur = parseInt((neg[1] || neg[3] || '0').replace(/,/g, ''));
      const tgt = parseInt((neg[2] || neg[4] || '0').replace(/,/g, ''));
      const vt = /photographer/i.test(l) ? 'Photographer' : /decorator/i.test(l) ? 'Decorator' : /caterer/i.test(l) ? 'Caterer' : /dj/i.test(l) ? 'DJ' : 'Vendor';
      return { response: { type: 'negotiation', text: `Here's a professional negotiation message for your **${vt}**.`, data: { negotiation: generateNegotiationMessage(vt, cur, tgt) } }, updatedContext: finalContext };
    }
  }

  // ── Anything else — let the LLM handle it with context ───────────────────
  // This covers: general_question, find_vendors (when no retrieval triggered),
  // comparison, follow_up, clarification, etc.
  // The LLM in llm.ts will receive the orchestration result + RAG context.
  return {
    response: { type: 'text', text: '' }, // placeholder — LLM will fill this
    updatedContext: finalContext,
  };
}

// ─── Event-Aware Planner Engine ──────────────────────────────────────────────
// Generates event-specific day structures with event-aware budgets.
// EventBudgetPlanner is the SINGLE SOURCE OF TRUTH for ALL budget allocation.

function getEventDayTypes(eventType: string, durationDays: number): string[] {
  const eventTypeLower = (eventType || 'event').toLowerCase();
  
  // Event-specific day mappings
  const eventDayMaps: Record<string, Record<number, string[]>> = {
    wedding: {
      1: ['wedding'],
      2: ['mehendi', 'wedding'],
      3: ['haldi', 'sangeet', 'wedding'],
      4: ['haldi', 'mehendi', 'sangeet', 'wedding'],
    },
    housewarming: {
      1: ['housewarming'],
      2: ['preparation', 'housewarming'],
      3: ['preparation', 'ceremony', 'gathering'],
      4: ['preparation', 'ceremony', 'gathering', 'celebration'],
    },
    birthday: {
      1: ['birthday'],
      2: ['setup', 'birthday'],
      3: ['setup', 'birthday', 'post-party'],
      4: ['setup', 'birthday', 'activities', 'post-party'],
    },
    'baby shower': {
      1: ['baby_shower'],
      2: ['setup', 'baby_shower'],
      3: ['setup', 'baby_shower', 'post-event'],
      4: ['setup', 'baby_shower', 'activities', 'post-event'],
    },
    'baby-shower': {
      1: ['baby_shower'],
      2: ['setup', 'baby_shower'],
      3: ['setup', 'baby_shower', 'post-event'],
      4: ['setup', 'baby_shower', 'activities', 'post-event'],
    },
    engagement: {
      1: ['engagement'],
      2: ['rehearsal', 'engagement'],
      3: ['preparation', 'engagement', 'post-engagement'],
      4: ['preparation', 'rehearsal', 'engagement', 'celebration'],
    },
    anniversary: {
      1: ['anniversary'],
      2: ['preparation', 'anniversary'],
      3: ['preparation', 'anniversary', 'celebration'],
      4: ['setup', 'preparation', 'anniversary', 'post-event'],
    },
    'corporate event': {
      1: ['event'],
      2: ['setup', 'event'],
      3: ['setup', 'event', 'post-event'],
      4: ['setup', 'event', 'post-event', 'followup'],
    },
    corporate: {
      1: ['event'],
      2: ['setup', 'event'],
      3: ['setup', 'event', 'post-event'],
      4: ['setup', 'event', 'post-event', 'followup'],
    },
    'college event': {
      1: ['event'],
      2: ['setup', 'event'],
      3: ['setup', 'event', 'post-event'],
      4: ['rehearsal', 'setup', 'event', 'post-event'],
    },
    college: {
      1: ['event'],
      2: ['setup', 'event'],
      3: ['setup', 'event', 'post-event'],
      4: ['rehearsal', 'setup', 'event', 'post-event'],
    },
    'college fest': {
      1: ['fest'],
      2: ['setup', 'fest'],
      3: ['setup', 'fest', 'post-fest'],
      4: ['setup', 'fest', 'post-fest', 'followup'],
    },
    conference: {
      1: ['conference'],
      2: ['setup', 'conference'],
      3: ['setup', 'conference', 'post-conference'],
      4: ['registration', 'conference', 'conference', 'post-conference'],
    },
    'product launch': {
      1: ['launch'],
      2: ['setup', 'launch'],
      3: ['rehearsal', 'launch', 'post-launch'],
      4: ['rehearsal', 'setup', 'launch', 'post-launch'],
    },
    exhibition: {
      1: ['exhibition'],
      2: ['setup', 'exhibition'],
      3: ['setup', 'exhibition', 'post-event'],
      4: ['setup', 'exhibition', 'exhibition', 'post-event'],
    },
    'dj night': {
      1: ['dj_night'],
      2: ['setup', 'dj_night'],
      3: ['setup', 'dj_night', 'post-event'],
      4: ['setup', 'dj_night', 'post-event', 'followup'],
    },
    'fashion show': {
      1: ['fashion_show'],
      2: ['rehearsal', 'fashion_show'],
      3: ['setup', 'rehearsal', 'fashion_show'],
      4: ['setup', 'rehearsal', 'fashion_show', 'post-event'],
    },
    'sports event': {
      1: ['sports_event'],
      2: ['setup', 'sports_event'],
      3: ['setup', 'sports_event', 'post-event'],
      4: ['setup', 'sports_event', 'post-event', 'awards'],
    },
    'religious event': {
      1: ['event'],
      2: ['preparation', 'event'],
      3: ['preparation', 'event', 'post-event'],
      4: ['preparation', 'ritual', 'event', 'post-event'],
    },
    festival: {
      1: ['festival'],
      2: ['setup', 'festival'],
      3: ['setup', 'festival', 'post-event'],
      4: ['setup', 'festival', 'post-event', 'cleanup'],
    },
    'charity event': {
      1: ['event'],
      2: ['setup', 'event'],
      3: ['setup', 'event', 'post-event'],
      4: ['setup', 'event', 'post-event', 'reporting'],
    },
    grihapravesam: {
      1: ['ceremony'],
      2: ['preparation', 'ceremony'],
      3: ['preparation', 'ceremony', 'gathering'],
      4: ['preparation', 'ritual', 'ceremony', 'gathering'],
    },
  };

  const map = eventDayMaps[eventTypeLower] || eventDayMaps.corporate;
  const days = Math.min(durationDays, 4);
  return map[days] || map[3];
}

function getEventDayLabels(eventType: string, durationDays: number): string[] {
  const eventTypeLower = (eventType || 'event').toLowerCase();
  
  const eventLabelMaps: Record<string, Record<number, string[]>> = {
    wedding: {
      1: ['Wedding Day'],
      2: ['Day 1 – Mehendi Ceremony', 'Day 2 – Wedding Day'],
      3: ['Day 1 – Haldi Ceremony', 'Day 2 – Sangeet Night', 'Day 3 – Wedding Day'],
      4: ['Day 1 – Haldi Ceremony', 'Day 2 – Mehendi Night', 'Day 3 – Sangeet Night', 'Day 4 – Wedding Day'],
    },
    housewarming: {
      1: ['Housewarming Day'],
      2: ['Day 1 – Preparation', 'Day 2 – Housewarming Ceremony'],
      3: ['Day 1 – Preparation', 'Day 2 – Housewarming Ceremony', 'Day 3 – Gathering'],
      4: ['Day 1 – Preparation', 'Day 2 – Ceremony', 'Day 3 – Gathering', 'Day 4 – Celebration'],
    },
    birthday: {
      1: ['Birthday Day'],
      2: ['Day 1 – Setup', 'Day 2 – Birthday Party'],
      3: ['Day 1 – Setup', 'Day 2 – Birthday Party', 'Day 3 – Post-Party'],
      4: ['Day 1 – Setup', 'Day 2 – Birthday Party', 'Day 3 – Activities', 'Day 4 – Post-Party'],
    },
    'baby shower': {
      1: ['Baby Shower Day'],
      2: ['Day 1 – Setup', 'Day 2 – Baby Shower'],
      3: ['Day 1 – Setup', 'Day 2 – Baby Shower', 'Day 3 – Post-Event'],
      4: ['Day 1 – Setup', 'Day 2 – Baby Shower', 'Day 3 – Activities', 'Day 4 – Post-Event'],
    },
    'baby-shower': {
      1: ['Baby Shower Day'],
      2: ['Day 1 – Setup', 'Day 2 – Baby Shower'],
      3: ['Day 1 – Setup', 'Day 2 – Baby Shower', 'Day 3 – Post-Event'],
      4: ['Day 1 – Setup', 'Day 2 – Baby Shower', 'Day 3 – Activities', 'Day 4 – Post-Event'],
    },
    engagement: {
      1: ['Engagement Day'],
      2: ['Day 1 – Rehearsal', 'Day 2 – Engagement'],
      3: ['Day 1 – Preparation', 'Day 2 – Engagement', 'Day 3 – Post-Engagement'],
      4: ['Day 1 – Preparation', 'Day 2 – Rehearsal', 'Day 3 – Engagement', 'Day 4 – Celebration'],
    },
    anniversary: {
      1: ['Anniversary Day'],
      2: ['Day 1 – Preparation', 'Day 2 – Anniversary Celebration'],
      3: ['Day 1 – Preparation', 'Day 2 – Anniversary', 'Day 3 – Celebration'],
      4: ['Day 1 – Setup', 'Day 2 – Preparation', 'Day 3 – Anniversary', 'Day 4 – Post-Event'],
    },
    corporate: {
      1: ['Event Day'],
      2: ['Day 1 – Setup', 'Day 2 – Event'],
      3: ['Day 1 – Setup', 'Day 2 – Event', 'Day 3 – Post-Event'],
      4: ['Day 1 – Setup', 'Day 2 – Event', 'Day 3 – Post-Event', 'Day 4 – Follow-up'],
    },
    'college event': {
      1: ['Event Day'],
      2: ['Day 1 – Setup', 'Day 2 – Event'],
      3: ['Day 1 – Setup', 'Day 2 – Event', 'Day 3 – Post-Event'],
      4: ['Day 1 – Rehearsal', 'Day 2 – Setup', 'Day 3 – Event', 'Day 4 – Post-Event'],
    },
    conference: {
      1: ['Conference Day'],
      2: ['Day 1 – Setup & Registration', 'Day 2 – Conference Sessions'],
      3: ['Day 1 – Setup & Registration', 'Day 2 – Conference Sessions', 'Day 3 – Post-Conference'],
      4: ['Day 1 – Registration', 'Day 2 – Day 1 Sessions', 'Day 3 – Day 2 Sessions', 'Day 4 – Closing'],
    },
    'product launch': {
      1: ['Launch Day'],
      2: ['Day 1 – Setup', 'Day 2 – Product Launch'],
      3: ['Day 1 – Rehearsal', 'Day 2 – Product Launch', 'Day 3 – Post-Launch'],
      4: ['Day 1 – Rehearsal', 'Day 2 – Setup', 'Day 3 – Product Launch', 'Day 4 – Post-Launch'],
    },
    exhibition: {
      1: ['Exhibition Day'],
      2: ['Day 1 – Setup', 'Day 2 – Exhibition'],
      3: ['Day 1 – Setup', 'Day 2 – Exhibition', 'Day 3 – Post-Event'],
      4: ['Day 1 – Setup', 'Day 2 – Exhibition', 'Day 3 – Exhibition', 'Day 4 – Post-Event'],
    },
    festival: {
      1: ['Festival Day'],
      2: ['Day 1 – Setup', 'Day 2 – Festival'],
      3: ['Day 1 – Setup', 'Day 2 – Festival', 'Day 3 – Post-Event'],
      4: ['Day 1 – Setup', 'Day 2 – Festival', 'Day 3 – Post-Event', 'Day 4 – Cleanup'],
    },
    grihapravesam: {
      1: ['Grihapravesam Day'],
      2: ['Day 1 – Preparation', 'Day 2 – Grihapravesam Ceremony'],
      3: ['Day 1 – Preparation', 'Day 2 – Ceremony', 'Day 3 – Gathering'],
      4: ['Day 1 – Preparation', 'Day 2 – Ritual', 'Day 3 – Ceremony', 'Day 4 – Gathering'],
    },
  };

  const map = eventLabelMaps[eventTypeLower] || eventLabelMaps.corporate;
  const days = Math.min(durationDays, 4);
  return map[days] || map[3];
}

function getEventDayThemes(dayType: string): string {
  const themes: Record<string, string> = {
    // Wedding
    haldi: 'Vibrant & Playful — Yellows and Oranges',
    mehendi: 'Intimate & Artistic — Earthy Tones',
    sangeet: 'Glam & High-Energy — Bold Colours & LED',
    wedding: 'Grand & Traditional — Gold, Red & Ivory',
    reception: 'Elegant & Modern — Pastels & Whites',
    // Housewarming
    housewarming: 'Warm & Welcoming — Earth Tones & Lights',
    ceremony: 'Traditional & Sacred — Gold & Flowers',
    gathering: 'Casual & Warm — Soft Colours',
    preparation: 'Practical & Organized — Clean & Fresh',
    // Birthday
    birthday: 'Fun & Festive — Bright Colours & Balloons',
    // Baby Shower
    baby_shower: 'Soft & Joyful — Pastels & Cute Themes',
    // Engagement
    engagement: 'Romantic & Celebratory — Gold & Flowers',
    'post-engagement': 'Light & Happy — Soft Colours',
    // Anniversary
    anniversary: 'Romantic & Elegant — Gold & Red',
    celebration: 'Joyful & Elegant — Pastels & Lights',
    // Corporate
    event: 'Professional & Modern — Blues & Greys',
    'post-event': 'Casual & Relaxed — Warm Tones',
    followup: 'Light & Informal — Neutral Colours',
    // Conference
    conference: 'Professional & Focused — Blues & Whites',
    'post-conference': 'Relaxed & Casual — Warm Tones',
    registration: 'Organized & Welcoming — Neutrals',
    // Product Launch
    'product launch': 'Bold & Innovative — Brand Colours',
    'post-launch': 'Celebratory — Champagne & Gold',
    // Fashion Show
    'fashion_show': 'Chic & Bold — Black & Golds',
    rehearsal: 'Organized & Professional — Neutral Colours',
    setup: 'Practical & Functional — Clean Spaces',
    // Sports Event
    'sports_event': 'Energetic & Dynamic — Bold Colours & Team Spirit',
    awards: 'Celebratory & Triumphant — Golds & Reds',
    // Festival
    festival: 'Vibrant & Joyful — Rainbow Colours',
    cleanup: 'Practical & Organized — Clean',
    // General
    activities: 'Fun & Engaging — Bright Colours',
    ritual: 'Traditional & Sacred — Gold & Flowers',
    'post-party': 'Relaxed — Soft Tones',
  };

  return themes[dayType] || 'Elegant & Traditional — Warm Tones';
}

function getEventDayDescriptions(dayType: string): string {
  const descriptions: Record<string, string> = {
    // Wedding
    haldi: 'A joyful pre-wedding ritual filled with colour, laughter, and love. The haldi ceremony cleanses and blesses the bride and groom before their big day.',
    mehendi: 'An intimate evening of intricate artistry. Mehendi symbolises love and new beginnings — a beautiful tradition celebrated with music and togetherness.',
    sangeet: 'A night of music, dance, and celebration. Families come together to perform, enjoy, and create memories that last a lifetime.',
    wedding: 'The main event — a sacred union witnessed by family and friends. Every detail of this day has been planned to create an unforgettable experience.',
    reception: 'A grand celebration of the newlyweds. An evening of elegance, dancing, and dining to welcome the couple into their new life together.',
    // Housewarming
    housewarming: 'A celebration of a new home. Friends and family gather to bless the space, share warmth, and create new memories together.',
    grihapravesam: 'The sacred ceremony welcoming a family into their new home, with rituals and blessings for prosperity and happiness.',
    // Birthday
    birthday: 'A day to celebrate and honour the birthday person with joy, laughter, food, and the company of loved ones.',
    // Baby Shower
    baby_shower: 'A joyful gathering to celebrate the upcoming arrival of a new baby with games, gifts, and togetherness.',
    // Engagement
    engagement: 'The celebration of a commitment — a day of joy and anticipation as two families come together.',
    'post-engagement': 'Time to celebrate and plan the exciting journey ahead with loved ones.',
    // Anniversary
    anniversary: 'A celebration of love and commitment. Honouring the journey together and creating new memories.',
    // General
    ceremony: 'An important ritual or formal gathering marking a significant occasion.',
    preparation: 'Planning and setting up to ensure everything is ready for the main event.',
    gathering: 'A time for people to come together, connect, and share experiences.',
    celebration: 'A time of joy and togetherness, marking a special occasion.',
    setup: 'Organizing the space and logistics for a smooth event experience.',
    'post-event': 'Wrapping up and enjoying the aftermath of a successful event.',
    'post-party': 'Time to relax and recover after the celebrations.',
    event: 'A professionally organized gathering with purpose and structure.',
    activities: 'Engaging moments and interactive experiences for guests.',
    ritual: 'A traditional or ceremonial practice marking the significance of the occasion.',
    followup: 'Post-event activities to maintain connections and gather feedback.',
    rehearsal: 'Practice and coordination to ensure smooth execution on the day.',
  };

  return descriptions[dayType] || 'A day dedicated to your event celebration and memories.';
}

export function generateEventAwarePlan(ctx: PlannerContext): WeddingPlan {
  const {
    budget = 800000, guestCount = 200, city = "Hyderabad",
    durationDays = 3, eventType = "event",
    luxuryLevel = "standard", eventDate, theme = "Traditional & Elegant",
  } = ctx;

  // Use EventBudgetPlanner for ALL budget allocation
  const eventAwareBudget = EventBudgetPlanner.allocate(ctx);

  const m = getMul(ctx);
  const season = getSeason(eventDate);
  const seasonLabel = { winter:"Winter (Nov–Feb)", summer:"Summer (Mar–May)", monsoon:"Monsoon (Jun–Sep)", autumn:"Autumn (Oct)" }[season];

  // Get event-specific day types
  const dayTypes = getEventDayTypes(eventType, durationDays);
  const dayLabels = getEventDayLabels(eventType, durationDays);
  const days = dayTypes.length;

  // Build day plans using event-aware budget allocations
  const dayPlans: DayPlan[] = dayTypes.map((dt, i) => {
    // Get event-aware budget for this specific day (distribute equally across days)
    const dayBudget = eventAwareBudget.totalBudget / days;
    
    return {
      day: i + 1,
      label: dayLabels[i] ?? `Day ${i + 1}`,
      theme: getEventDayThemes(dt),
      description: getEventDayDescriptions(dt),
      slots: buildTimeSlots(dt, eventType, city, luxuryLevel),
      budget: {
        total: Math.round(dayBudget),
        breakdown: buildEventDayBudgetBreakdown(dt, dayBudget, m),
      },
      checklist: buildDayChecklist(dt, eventType),
      vendors: buildDayVendors(dt, city, m),
      aiTips: buildAiTips(dt, eventType, ctx),
      sunrise: "06:15 AM",
      goldenHour: "05:30 PM – 06:30 PM",
    };
  });

  const totalSpend = dayPlans.reduce((s, d) => s + d.budget.total, 0);
  const remaining = budget - totalSpend;
  
  // Use event-aware cost calculation
  const cpgKey = eventType?.toLowerCase() || 'event';
  const minBudget = (MIN_CPG[cpgKey] ?? MIN_CPG['event'] ?? 2500) * guestCount * getCityMul(city);
  
  const feasibility: WeddingOverview["feasibility"] =
    budget >= minBudget * 1.2 ? "excellent" :
    budget >= minBudget ? "good" :
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
      ? `${fmt(budget)} is excellent for a ${days}-day ${eventType} with ${guestCount} guests in ${city}. You have room for premium vendors.`
      : feasibility === "good"
      ? `${fmt(budget)} is workable for ${guestCount} guests in ${city}. Stick to the per-day allocations and you'll be fine.`
      : feasibility === "tight"
      ? `${fmt(budget)} is tight for ${guestCount} guests. We've optimised the plan to stay within budget — follow vendor suggestions carefully.`
      : `${fmt(budget)} is below the recommended minimum (${fmt(Math.round(minBudget))}) for ${guestCount} guests. Consider reducing the guest list to ${Math.floor(budget / ((MIN_CPG[cpgKey] ?? 2500) * getCityMul(city)))}.`,
  };

  return {
    overview,
    days: dayPlans,
    totalSpend,
    remaining,
    globalTips: [
      `Book ALL key vendors at least 4-6 months in advance — ${season === "winter" ? "peak season" : "popular dates"} book out fast`,
      "Always get written contracts with cancellation clauses for every vendor",
      `Assign one dedicated coordinator — not a family member, to reduce stress`,
      "Keep 10% of total budget as emergency buffer — unexpected costs always arise",
      `${season === "winter" ? "Peak season pricing applies — expect 20-30% premium on all vendors" : season === "monsoon" ? "Monsoon pricing is 15-20% lower — but ALWAYS have indoor backup" : "Off-peak season — great opportunity to negotiate better vendor rates"}`,
      `Photography/videography is investment-level — never cut this budget for important moments`,
    ],
    successScore: Math.min(100, Math.round(
      (feasibility === "excellent" ? 92 : feasibility === "good" ? 82 : feasibility === "tight" ? 68 : 50) *
      ([budget, guestCount, city, eventDate].filter(Boolean).length / 4)
    )),
    confidence: Math.round(([budget, guestCount, city, eventDate, luxuryLevel].filter(Boolean).length / 5) * 90 + 10),
  };
}

function buildEventDayBudgetBreakdown(dayType: string, dayBudget: number, m: number): { category: string; amount: number; note: string }[] {
  // Event-aware category allocations (NOT hardcoded percentages)
  const allocations: Record<string, { category: string; pct: number; note: string }[]> = {
    // Wedding
    haldi: [
      { category: "Decoration", pct: 35, note: "Floral & haldi props" },
      { category: "Catering", pct: 25, note: "Lunch + snacks" },
      { category: "Photography", pct: 18, note: "Candid coverage" },
      { category: "Mehendi Artists", pct: 12, note: "2-4 artists" },
      { category: "Makeup", pct: 6, note: "Bridal look" },
      { category: "Buffer", pct: 4, note: "Contingency" },
    ],
    mehendi: [
      { category: "Mehendi Artists", pct: 40, note: "Bridal + guests" },
      { category: "Decoration", pct: 20, note: "Lounge setup" },
      { category: "Catering", pct: 22, note: "Lunch + chai" },
      { category: "Photography", pct: 12, note: "Detail shots" },
      { category: "Buffer", pct: 6, note: "Contingency" },
    ],
    sangeet: [
      { category: "Entertainment", pct: 30, note: "DJ + performers" },
      { category: "Decoration", pct: 18, note: "LED + stage" },
      { category: "Catering", pct: 24, note: "Dinner + drinks" },
      { category: "Venue", pct: 14, note: "Hall hire" },
      { category: "Photography", pct: 8, note: "Candid" },
      { category: "Buffer", pct: 6, note: "Contingency" },
    ],
    wedding: [
      { category: "Venue & Mandap", pct: 28, note: "Hall + mandap setup" },
      { category: "Catering", pct: 30, note: "Full-day food" },
      { category: "Photography", pct: 12, note: "Full-day coverage" },
      { category: "Decoration", pct: 14, note: "Floral + lighting" },
      { category: "Entertainment", pct: 8, note: "Band + DJ" },
      { category: "Makeup", pct: 4, note: "Bridal" },
      { category: "Buffer", pct: 4, note: "Contingency" },
    ],
    reception: [
      { category: "Venue", pct: 30, note: "Banquet hall" },
      { category: "Catering", pct: 30, note: "Dinner" },
      { category: "Decoration", pct: 16, note: "Stage + lighting" },
      { category: "Entertainment", pct: 10, note: "DJ" },
      { category: "Photography", pct: 10, note: "Coverage" },
      { category: "Buffer", pct: 4, note: "Contingency" },
    ],
    // Housewarming
    housewarming: [
      { category: "Catering", pct: 35, note: "Refreshments & snacks" },
      { category: "Decoration", pct: 25, note: "Flowers & lights" },
      { category: "Preparation", pct: 20, note: "Cleaning & setup" },
      { category: "Photography", pct: 12, note: "Event coverage" },
      { category: "Miscellaneous", pct: 5, note: "Supplies" },
      { category: "Buffer", pct: 3, note: "Contingency" },
    ],
    preparation: [
      { category: "Cleaning", pct: 40, note: "Professional cleaning" },
      { category: "Decoration", pct: 35, note: "Setup & arrangement" },
      { category: "Supplies", pct: 15, note: "Linens, flowers" },
      { category: "Buffer", pct: 10, note: "Contingency" },
    ],
    ceremony: [
      { category: "Catering", pct: 30, note: "Refreshments & snacks" },
      { category: "Decoration", pct: 25, note: "Ceremonial décor" },
      { category: "Photography", pct: 20, note: "Event coverage" },
      { category: "Miscellaneous", pct: 15, note: "Ritual supplies" },
      { category: "Buffer", pct: 10, note: "Contingency" },
    ],
    gathering: [
      { category: "Catering", pct: 40, note: "Meals & beverages" },
      { category: "Decoration", pct: 20, note: "Ambiance" },
      { category: "Photography", pct: 15, note: "Candid moments" },
      { category: "Entertainment", pct: 15, note: "Optional activities" },
      { category: "Buffer", pct: 10, note: "Contingency" },
    ],
    // Birthday
    birthday: [
      { category: "Catering", pct: 35, note: "Food & cake" },
      { category: "Decoration", pct: 25, note: "Theme & setup" },
      { category: "Entertainment", pct: 20, note: "Music/games/DJ" },
      { category: "Photography", pct: 12, note: "Event photos" },
      { category: "Miscellaneous", pct: 5, note: "Supplies & gifts" },
      { category: "Buffer", pct: 3, note: "Contingency" },
    ],
    setup: [
      { category: "Venue", pct: 40, note: "Space hire" },
      { category: "Decoration", pct: 35, note: "Setup & arrangement" },
      { category: "Supplies", pct: 20, note: "Equipment rental" },
      { category: "Buffer", pct: 5, note: "Contingency" },
    ],
    // Baby Shower
    baby_shower: [
      { category: "Catering", pct: 35, note: "Snacks & refreshments" },
      { category: "Decoration", pct: 25, note: "Theme & setup" },
      { category: "Games & Activities", pct: 20, note: "Baby shower games" },
      { category: "Photography", pct: 12, note: "Event coverage" },
      { category: "Gifts & Favours", pct: 5, note: "Party favours" },
      { category: "Buffer", pct: 3, note: "Contingency" },
    ],
    // Engagement
    engagement: [
      { category: "Catering", pct: 30, note: "Meals & drinks" },
      { category: "Decoration", pct: 25, note: "Venue décor" },
      { category: "Photography", pct: 20, note: "Event coverage" },
      { category: "Entertainment", pct: 15, note: "Music/programme" },
      { category: "Miscellaneous", pct: 5, note: "Supplies" },
      { category: "Buffer", pct: 5, note: "Contingency" },
    ],
    // Anniversary
    anniversary: [
      { category: "Catering", pct: 35, note: "Meals & cake" },
      { category: "Decoration", pct: 25, note: "Romantic setup" },
      { category: "Entertainment", pct: 15, note: "Music/programme" },
      { category: "Photography", pct: 15, note: "Memories" },
      { category: "Miscellaneous", pct: 5, note: "Supplies" },
      { category: "Buffer", pct: 5, note: "Contingency" },
    ],
    // Corporate
    event: [
      { category: "Venue", pct: 30, note: "Space hire" },
      { category: "Catering", pct: 35, note: "Food & beverages" },
      { category: "AV & Technology", pct: 20, note: "Projectors, mics" },
      { category: "Miscellaneous", pct: 10, note: "Supplies & materials" },
      { category: "Buffer", pct: 5, note: "Contingency" },
    ],
    // General/Default
    activities: [
      { category: "Entertainment", pct: 35, note: "Activities" },
      { category: "Catering", pct: 30, note: "Food & drinks" },
      { category: "Decoration", pct: 20, note: "Setup" },
      { category: "Miscellaneous", pct: 10, note: "Supplies" },
      { category: "Buffer", pct: 5, note: "Contingency" },
    ],
    ritual: [
      { category: "Ceremonial Supplies", pct: 35, note: "Ritual items" },
      { category: "Catering", pct: 30, note: "Prasad & refreshments" },
      { category: "Decoration", pct: 20, note: "Décor" },
      { category: "Photography", pct: 10, note: "Coverage" },
      { category: "Buffer", pct: 5, note: "Contingency" },
    ],
  };

  if (!allocations[dayType]) {
    throw new Error(
      `Event budget configuration missing: dayType='${dayType}'. ` +
      `Budget allocation not found in database. Please report this to support.`
    );
  }

  const alloc = allocations[dayType];
  return alloc.map(a => ({
    category: a.category,
    amount: Math.round(dayBudget * a.pct / 100 * m),
    note: a.note,
  }));
}

// ─── Wedding Planner Engine ───────────────────────────────────────────────────
// DEPRECATED: Use generateEventAwarePlan() instead for all event types.
// Kept for backward compatibility only.

// ─── Wedding Planner Engine ───────────────────────────────────────────────────
// Generates a professional day-wise itinerary FIRST, then budget.

function buildTimeSlots(dayType: string, eventType: string, city: string, luxuryLevel: LuxuryLevel): TimeSlot[] {
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
    // HOUSEWARMING: Event-specific activities
    housewarming: [
      { time:"08:00 AM", activity:"Cleaners arrive — final home preparation & cleaning", who:"Cleaning crew", period:"morning", note:"Deep clean all areas" },
      { time:"09:00 AM", activity:"Florist delivers flowers & rangoli materials", who:"Florist", period:"morning" },
      { time:"09:30 AM", activity:"Rangoliartist begins rangoli at entrance", who:"Rangoli Artist", period:"morning", note:"Traditional welcome design" },
      { time:"10:00 AM", activity:"Decoration setup — torans, lights, flowers around house", who:"Decorator", period:"morning" },
      { time:"11:00 AM", activity:"Priest/Pandit arrives — puja preparations", who:"Priest", period:"morning", note:"Confirm muhurat timing with priest 1 week before" },
      { time:"11:30 AM", activity:"Kitchen team setup — catering service begins", who:"Caterer", period:"morning" },
      { time:"12:00 PM", activity:"Puja ceremony begins — Griha Pravesh ritual", who:"Family & Priest", period:"afternoon", note:"Auspicious muhurat time — family members lead" },
      { time:"01:00 PM", activity:"Prasad distribution — blessed offerings to guests", who:"Family", period:"afternoon" },
      { time:"01:30 PM", activity:"Lunch service — home-cooked feast or catered meal", who:"All Guests", period:"afternoon" },
      { time:"02:30 PM", activity:"Photography — home & family portraits", who:"Photographer", period:"afternoon", note:"Optional: candid shots of guests" },
      { time:"03:30 PM", activity:"Tea & snacks served", who:"All Guests", period:"afternoon" },
      { time:"04:00 PM", activity:"Family stories & conversations — guests mingle", who:"All Guests", period:"evening" },
      { time:"05:00 PM", activity:"Distribution of return gifts (if planned)", who:"Family", period:"evening" },
      { time:"05:30 PM", activity:"Guests bid farewell — thank you notes", who:"All", period:"evening" },
      { time:"06:00 PM", activity:"Final cleanup & vendor wrap-up", who:"Coordinator", period:"evening" },
    ],
    // BIRTHDAY: Event-specific activities
    birthday: [
      { time:"09:00 AM", activity:"Venue setup — balloon decorations & banners", who:"Decorator", period:"morning" },
      { time:"10:00 AM", activity:"Catering team arrives — food & drink station setup", who:"Caterer", period:"morning" },
      { time:"10:30 AM", activity:"Photography crew setup — ready for candid shots", who:"Photographer", period:"morning" },
      { time:"11:00 AM", activity:"Games & activities setup — party games for guests", who:"Event coordinator", period:"morning" },
      { time:"11:30 AM", activity:"Birthday person final prep — get ready", who:"Birthday person & family", period:"morning" },
      { time:"12:00 PM", activity:"Guest arrival — welcome & refreshments", who:"All Guests", period:"afternoon" },
      { time:"12:30 PM", activity:"Games & entertainment — fun activities for all ages", who:"All Guests", period:"afternoon" },
      { time:"01:30 PM", activity:"Lunch service — themed food & drinks", who:"All Guests", period:"afternoon" },
      { time:"02:30 PM", activity:"Cake cutting — birthday cake ceremony", who:"Birthday person & close family", period:"afternoon", note:"Take photos & videos of this moment" },
      { time:"03:00 PM", activity:"Cake served — dessert time with everyone", who:"All Guests", period:"afternoon" },
      { time:"03:30 PM", activity:"Music & dancing — DJ or playlist", who:"All Guests", period:"afternoon" },
      { time:"04:30 PM", activity:"Gift opening — birthday person opens gifts", who:"All Guests", period:"evening", note:"Optional activity" },
      { time:"05:00 PM", activity:"Party winds down — guests depart", who:"All", period:"evening" },
    ],
  };

  // Provide generic fallback for intermediate/generic day types (event, setup, post-event, etc.)
  if (!slots[dayType]) {
    // Return a generic event day configuration for unknown day types
    return [
      { time:"09:00 AM", activity:"Event setup & preparation", who:"Coordinator", period:"morning" },
      { time:"10:00 AM", activity:"Decoration & ambiance setup", who:"Decorator", period:"morning" },
      { time:"11:00 AM", activity:"Catering & refreshments station setup", who:"Caterer", period:"morning" },
      { time:"03:00 PM", activity:"Guest arrival begins", who:"All Guests", period:"afternoon" },
      { time:"04:00 PM", activity:"Main activities & programme", who:"All", period:"afternoon" },
      { time:"05:30 PM", activity:"Dinner service", who:"All Guests", period:"evening" },
      { time:"06:30 PM", activity:"Closing remarks & thanks", who:"Organizer", period:"evening" },
    ];
  }

  return slots[dayType].map(s => s);
}

function buildDayBudget(dayType: string, totalBudget: number, durationDays: number, m: number): DayBudget {
  const dayShare = totalBudget / durationDays;
  const allocations: Record<string, { category: string; pct: number; note: string }[]> = {
    haldi:    [{ category:"Decoration",pct:35,note:"Floral & haldi props"},{category:"Catering",pct:25,note:"Lunch + snacks"},{category:"Photography",pct:18,note:"Candid coverage"},{category:"Mehendi Artists",pct:12,note:"2-4 artists"},{category:"Makeup",pct:6,note:"Bridal look"},{category:"Buffer",pct:4,note:"Contingency"}],
    mehendi:  [{ category:"Mehendi Artists",pct:40,note:"Bridal + guests"},{category:"Decoration",pct:20,note:"Lounge setup"},{category:"Catering",pct:22,note:"Lunch + chai"},{category:"Photography",pct:12,note:"Detail shots"},{category:"Buffer",pct:6,note:"Contingency"}],
    sangeet:  [{ category:"Entertainment",pct:30,note:"DJ + performers"},{category:"Decoration",pct:18,note:"LED + stage"},{category:"Catering",pct:24,note:"Dinner + drinks"},{category:"Venue",pct:14,note:"Hall hire"},{category:"Photography",pct:8,note:"Candid"},{category:"Buffer",pct:6,note:"Contingency"}],
    wedding:  [{ category:"Venue & Mandap",pct:28,note:"Hall + mandap setup"},{category:"Catering",pct:30,note:"Full-day food"},{category:"Photography",pct:12,note:"Full-day coverage"},{category:"Decoration",pct:14,note:"Floral + lighting"},{category:"Entertainment",pct:8,note:"Band + DJ"},{category:"Makeup",pct:4,note:"Bridal"},{category:"Buffer",pct:4,note:"Contingency"}],
    reception:[{ category:"Venue",pct:30,note:"Banquet hall"},{category:"Catering",pct:30,note:"Dinner"},{category:"Decoration",pct:16,note:"Stage + lighting"},{category:"Entertainment",pct:10,note:"DJ"},{category:"Photography",pct:10,note:"Coverage"},{category:"Buffer",pct:4,note:"Contingency"}],
    // HOUSEWARMING: Event-specific budget breakdown
    housewarming:[{ category:"Puja & Priest",pct:8,note:"Muhurat & ritual guidance"},{category:"Decoration",pct:20,note:"Torans, rangoli, flowers"},{category:"Catering",pct:40,note:"Prasad & refreshments"},{category:"Photography",pct:12,note:"Key moments"},{category:"Return Gifts",pct:12,note:"For guests"},{category:"Buffer",pct:8,note:"Contingency"}],
    // BIRTHDAY: Event-specific budget breakdown
    birthday: [{ category:"Venue",pct:20,note:"Hall or lawn rental"},{category:"Catering",pct:35,note:"Food, cake, drinks"},{category:"Decoration",pct:18,note:"Theme decorations"},{category:"Entertainment",pct:12,note:"DJ or music"},{category:"Photography",pct:8,note:"Candid & cake moments"},{category:"Buffer",pct:7,note:"Contingency"}],
  };
  
  if (!allocations[dayType]) {
    throw new Error(
      `Budget configuration missing: dayType='${dayType}'. ` +
      `Budget allocation not found in database. Please report this to support.`
    );
  }
  
  const alloc = allocations[dayType];
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
    // HOUSEWARMING: Event-specific vendors
    housewarming: [
      { role:"Priest/Pandit",  description:"Griha Pravesh muhurat & puja guidance",          budgetRange:`${fmt(Math.round(2000*m))}–${fmt(Math.round(10000*m))}`,   searchUrl:`${base}&category=pandit`,        urgency:"book_now"  },
      { role:"Decorator",      description:"Torans, rangoli, floral & lighting setup",       budgetRange:`${fmt(Math.round(15000*m))}–${fmt(Math.round(40000*m))}`,  searchUrl:`${base}&category=decorators`,    urgency:"book_now"  },
      { role:"Caterer",        description:"Prasad, refreshments & light refreshments",     budgetRange:`${fmt(Math.round(200*m))}/plate`,                           searchUrl:`${base}&category=catering`,      urgency:"book_now"  },
      { role:"Photographer",   description:"Puja moments & family gathering shots",          budgetRange:`${fmt(Math.round(8000*m))}–${fmt(Math.round(20000*m))}`,   searchUrl:`${base}&category=photographers`, urgency:"flexible"  },
    ],
    // BIRTHDAY: Event-specific vendors
    birthday: [
      { role:"Caterer",        description:"Food, cake, drinks for party",                  budgetRange:`${fmt(Math.round(300*m))}/plate`,                           searchUrl:`${base}&category=catering`,      urgency:"book_now"  },
      { role:"DJ / Music",     description:"Music for dancing & entertainment",              budgetRange:`${fmt(Math.round(5000*m))}–${fmt(Math.round(15000*m))}`,   searchUrl:`${base}&category=dj`,            urgency:"book_now"  },
      { role:"Decorator",      description:"Theme-based balloons, banners & decorations",   budgetRange:`${fmt(Math.round(10000*m))}–${fmt(Math.round(30000*m))}`,  searchUrl:`${base}&category=decorators`,    urgency:"book_now"  },
      { role:"Photographer",   description:"Candid & cake-cutting moments",                  budgetRange:`${fmt(Math.round(5000*m))}–${fmt(Math.round(15000*m))}`,   searchUrl:`${base}&category=photographers`, urgency:"flexible"  },
    ],
  };
  
  // Provide generic fallback for intermediate/generic day types (event, setup, post-event, etc.)
  if (!maps[dayType]) {
    return [
      { role:"Caterer",        description:"Catering & refreshments service",                  budgetRange:`${fmt(Math.round(300*m))}/plate`,                           searchUrl:`${base}&category=catering`,      urgency:"book_now"  },
      { role:"Decorator",      description:"Venue decoration & ambiance setup",                budgetRange:`${fmt(Math.round(20000*m))}–${fmt(Math.round(50000*m))}`,  searchUrl:`${base}&category=decorators`,    urgency:"book_now"  },
      { role:"Photographer",   description:"Event coverage & key moments",                     budgetRange:`${fmt(Math.round(10000*m))}–${fmt(Math.round(30000*m))}`,  searchUrl:`${base}&category=photographers`, urgency:"flexible"  },
      { role:"DJ / Music",     description:"Entertainment & music",                            budgetRange:`${fmt(Math.round(8000*m))}–${fmt(Math.round(25000*m))}`,   searchUrl:`${base}&category=dj`,            urgency:"flexible"  },
    ];
  }
  return maps[dayType];
}

function buildDayChecklist(dayType: string, eventType: string): DayChecklist[] {
  const lists: Record<string, DayChecklist[]> = {
    haldi:   [{ task:"Confirm decoration setup time with vendor", priority:"must", owner:"Coordinator"},{task:"Prepare haldi paste — fresh & organic",priority:"must",owner:"Family"},{task:"Arrange extra towels/old clothes for guests",priority:"should",owner:"Family"},{task:"Confirm mehendi artist arrival time",priority:"must",owner:"Bride"},{task:"Create haldi photo shot list",priority:"should",owner:"Couple"},{task:"Keep backup outfits ready",priority:"should",owner:"Bride, Groom"}],
    sangeet: [{ task:"Submit song list to DJ — 48 hrs before", priority:"must", owner:"Family"},{task:"Rehearse all family dance performances",priority:"must",owner:"Family"},{task:"Confirm anchor script & programme order",priority:"must",owner:"Coordinator"},{task:"Test all microphones & sound levels",priority:"must",owner:"DJ/Sound"},{task:"Coordinate couple's grand entry song",priority:"must",owner:"Couple"},{task:"Arrange props for performances",priority:"should",owner:"Family"}],
    wedding: [{ task:"Confirm muhurat timings with Pandit", priority:"must", owner:"Family"},{task:"Baraat route confirmed with venue",priority:"must",owner:"Coordinator"},{task:"All vendor arrival times confirmed — 1 week before",priority:"must",owner:"Coordinator"},{task:"Final headcount sent to caterer",priority:"must",owner:"Family"},{task:"Golden hour location scouted",priority:"must",owner:"Photographer"},{task:"Emergency kit ready (medicines, pins, tape)",priority:"must",owner:"Coordinator"},{task:"Groom outfit finalised & pressed",priority:"must",owner:"Groom"}],
    mehendi: [{ task:"Confirm number of mehendi artists needed", priority:"must", owner:"Bride"},{task:"Design references shared with artist",priority:"must",owner:"Bride"},{task:"Seating arrangement for mehendi lounge",priority:"should",owner:"Coordinator"},{task:"Music playlist ready",priority:"should",owner:"Family"},{task:"Keep lemon & sugar water for mehendi setting",priority:"should",owner:"Family"}],
    reception:[{ task:"Couple's grand entry song finalised", priority:"must", owner:"Couple"},{task:"Stage slot for couple photos confirmed",priority:"must",owner:"Photographer"},{task:"DJ playlist submitted",priority:"must",owner:"Family"},{task:"Guest seating chart finalised",priority:"should",owner:"Coordinator"}],
    // HOUSEWARMING: Event-specific checklist
    housewarming: [{ task:"Confirm auspicious muhurat with priest", priority:"must", owner:"Family"},{task:"Home deep cleaning completed",priority:"must",owner:"Coordinator"},{task:"Puja materials & flowers ordered",priority:"must",owner:"Family"},{task:"Catering menu finalized",priority:"must",owner:"Caterer"},{task:"Guest list & arrival times confirmed",priority:"must",owner:"Family"},{task:"Photography & videography booked (if planned)",priority:"should",owner:"Coordinator"},{task:"Return gifts ready (if planned)",priority:"should",owner:"Family"},{task:"House orientation & parking arranged",priority:"should",owner:"Coordinator"}],
    // BIRTHDAY: Event-specific checklist
    birthday: [{ task:"Cake order confirmed with delivery time", priority:"must", owner:"Coordinator"},{task:"All decorations & supplies purchased",priority:"must",owner:"Coordinator"},{task:"Catering headcount finalized",priority:"must",owner:"Caterer"},{task:"Games & activities planned & ready",priority:"should",owner:"Event coordinator"},{task:"Music playlist created",priority:"should",owner:"Coordinator"},{task:"Photographer/videographer arrival time confirmed",priority:"should",owner:"Coordinator"},{task:"Birthday person outfit finalised",priority:"should",owner:"Birthday person"}],
    // GENERIC DAY TYPES: Intermediate day types used across event types
    preparation: [{ task:"Venue & setup confirmed", priority:"must", owner:"Coordinator"},{task:"All supplies & materials ordered",priority:"must",owner:"Coordinator"},{task:"Catering contact & menu finalized",priority:"must",owner:"Caterer"},{task:"Decorator arrival time confirmed",priority:"should",owner:"Decorator"},{task:"Backup plan ready for weather/emergencies",priority:"should",owner:"Coordinator"}],
    ceremony: [{ task:"Auspicious time/muhurat confirmed", priority:"must", owner:"Family"},{task:"Priest/officiant arrival time confirmed",priority:"must",owner:"Coordinator"},{task:"All ceremonial items prepared & ready",priority:"must",owner:"Family"},{task:"Photographer positioned for key moments",priority:"should",owner:"Photographer"},{task:"Music/audio system tested",priority:"should",owner:"Coordinator"}],
    gathering: [{ task:"Final guest headcount confirmed", priority:"must", owner:"Family"},{task:"Seating arrangement finalized",priority:"should",owner:"Coordinator"},{task:"Catering service times & menu review",priority:"must",owner:"Caterer"},{task:"Entertainment/activities schedule confirmed",priority:"should",owner:"Coordinator"},{task:"Photography coverage plan reviewed",priority:"should",owner:"Photographer"}],
    celebration: [{ task:"Entertainment & music finalized", priority:"must", owner:"Coordinator"},{task:"Dessert & cake cutting time scheduled",priority:"should",owner:"Caterer"},{task:"Photography coverage extended if needed",priority:"should",owner:"Photographer"},{task:"Guest departure logistics arranged",priority:"should",owner:"Coordinator"}],
    ritual: [{ task:"Ritual specialist/priest confirmed", priority:"must", owner:"Family"},{task:"All ritual items & materials prepared",priority:"must",owner:"Family"},{task:"Timing of ritual synchronized with schedule",priority:"must",owner:"Coordinator"},{task:"Photography permission & positioning confirmed",priority:"should",owner:"Photographer"}],
  };

  // If dayType is not found, throw explicit error (no fallback to wedding)
  if (!lists[dayType]) {
    throw new Error(
      `Event planning configuration missing: eventType='${eventType}', dayType='${dayType}'. ` +
      `Checklist not found in database. Please report this to support.`
    );
  }
  return lists[dayType];
}

function buildAiTips(dayType: string, eventType: string, ctx: PlannerContext): string[] {
  const season = getSeason(ctx.eventDate);
  const tips: Record<string, string[]> = {
    haldi:   ["Use real marigold flowers — they photograph beautifully and are cost-effective",`For ${ctx.city ?? "your city"} in ${season}, ${season === "summer" ? "schedule haldi before 10 AM to avoid heat" : season === "monsoon" ? "keep it indoor to avoid rain disruption" : "10 AM start is perfect"}`, "Hire a drone operator for stunning aerial haldi shots if budget allows","Prepare fun props — sunglasses, flower garlands, coloured powders for candid shots","Natural haldi paste (not turmeric powder) is gentler on skin and photographs better"],
    sangeet: ["Start sangeet preparations 3 weeks in advance — give family time to rehearse","A professional anchor makes the difference between a chaotic and seamless night","Live band for dinner hour + DJ for dancing after = the best combo",`December in ${ctx.city ?? "your city"} means cool evenings — perfect for an outdoor sangeet stage`,"Hire a choreographer for the bride's/groom's family — they'll thank you later","Keep a backup indoor option if sangeet is planned outdoors"],
    mehendi: ["Full bridal design takes 3-4 hours — start the bride's mehendi first","Book 1 artist per 8-10 guests for a comfortable pace","Cone quality matters — always check artist's cone brand before booking","Create a cozy, intimate atmosphere — low seating, fairy lights, floor cushions","The darker the mehendi, the deeper the love — lemon juice + sugar solution helps"],
    wedding: ["The ceremony timing (muhurat) is sacred — confirm with your Pandit at least 2 months before","Golden Hour (5:30–6:30 PM) is the single most important photography window — protect it","Book your baraat DJ/band separately from the main evening entertainment","Have a coordinator whose only job is to manage vendor timings — not a family member",`${season === "monsoon" ? "⚠️ RAIN ALERT: Have a fully equipped indoor backup venue confirmed" : `${season} weddings in ${ctx.city ?? "India"} are beautiful — but have a generator backup confirmed`}`,"First dance song — practice it at least once before the wedding day"],
    reception:[`Reception in ${season} — perfect for an elegant evening celebration`,"Keep reception programme tight — maximum 3 hours of structured events, rest is free flow","Photo booth with props is a crowd favourite and great for candid shots","Arrange special dietary options — at least one vegan counter for urban guest lists","Coordinate with photographer on key shots: couple entry, first dance, cake cut, family groups"],
    // HOUSEWARMING: Event-specific tips
    housewarming: [`Confirm auspicious muhurat with your priest — typically 15-45 minutes for Griha Pravesh ritual in ${ctx.city ?? "your city"}`,"Home must be cleaned thoroughly before puja — consider professional cleaning 1-2 days before","Fresh flowers & rangoli materials should be purchased day-before to ensure freshness","Arrange for proper seating — guests should be comfortable, especially elders","Photography focus: puja moments, family gathering, first meal in new home — these are lasting memories",`In ${season}, ensure AC/ventilation is working properly for guest comfort`,"Prepare a welcome note/card for guests — personal touch for the new home",`Consider a small Griha Pravesh token/gift for guests — reflects blessings for the home`],
    // BIRTHDAY: Event-specific tips
    birthday: ["Book the cake minimum 5-7 days in advance — custom designs take time",`In ${season}, ensure cold storage is available for cake & desserts until serving time`,"Games & activities should be appropriate for all age groups attending",`Choose decorations matching the birthday person's interests — personalization makes it special`,"Photography should capture candid moments, not just posed shots — hire a photographer familiar with event photography","Music playlist balance — mix of current hits and favorites of the birthday person",`Have a small emergency kit: extra batteries, pain relief, first aid — always helpful at parties`],
    // GENERIC DAY TYPES: Used across event types
    preparation: [`Arrive early to set up in ${season} — allow extra time for weather challenges if needed`,`Confirm all vendor timings 1 week before — especially catering and setup teams`,"Have backup plan for any last-minute changes","Double-check all supplies & equipment are on-site","Test all audio/visual equipment & connectivity"],
    ceremony: [` The ceremony timing is important — confirm all rituals & timings in advance`,`Golden Hour (5:30–6:30 PM) is the best for photography — protect this time if ceremony is outdoors`,"Have a coordinator managing vendor & guest flow — not a family member","Ensure proper seating & comfort for all guests","Have an emergency kit ready — first aid, tissues, water for guests"],
    gathering: [` Guests should be comfortable — arrange proper seating & temperature control`,"Keep activities & entertainment flowing smoothly — have backup entertainment if needed",`Music & food service should match the event vibe — coordinate with caterer & DJ`,"Photography should capture candid moments — natural moments are best",`Have a small welcome/goodbye touch — thank guests for celebrating`],
    celebration: [`Celebrations in ${season} require planning — outdoor events need weather backup`,"Entertainment & music should keep energy high but allow for conversations","Dessert/cake moment should be well-photographed — coordinate timing","Dance floor should have good music & space","Comfortable guest departure — arrange transportation if needed"],
    ritual: [`Ritual timing is sacred — confirm with priest/specialist well in advance`,"Ritual items should be procured authentically — not last-minute substitutes",`Photography during ritual should be respectful & pre-approved by family`,"Have proper seating & comfort for elderly guests during longer rituals",`Music/chanting should be clear & audible — test audio system beforehand`],
  };

  // Provide generic fallback for any missing day types
  if (!tips[dayType]) {
    return [
      `Event in ${season} — plan accordingly for weather and guest comfort`,
      `Confirm all vendor timings 1 week before — especially catering and setup teams`,
      `Have a coordinator whose only job is to manage vendor timings — not a family member`,
      `Photography focus on key moments and guest candids — natural moments are best`,
      `Music & entertainment should match the event vibe — coordinate with DJ/musician`,
      `Have an emergency kit ready — first aid, batteries, pins, tape — always helpful`,
    ];
  }
  return tips[dayType];
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
  { label: "Browse categories",      prompt: "Show all active Vowza vendor categories.",                              icon: "🗂️" },
  { label: "Success score",          prompt: "Give me an event success score for my current plan",                    icon: "📊" },
  { label: "Risk analysis",          prompt: "Analyse the risks for my event and suggest backup plans",               icon: "⚠️" },
  { label: "Food planning",          prompt: "Help me plan food and catering for my event",                           icon: "🍽️" },
  { label: "Best month to book",     prompt: "Which month is best for a wedding in Hyderabad?",                       icon: "🌤️" },
  { label: "Negotiate vendor price", prompt: "Help me negotiate with my photographer from Rs 60,000 to Rs 45,000",    icon: "🤝" },
  { label: "Hidden costs",           prompt: "What are the hidden costs in a wedding I should know about?",           icon: "💡" },
  { label: "Is my budget enough?",   prompt: "Is Rs 8 lakh enough for a wedding with 400 guests in Hyderabad?",      icon: "🤔" },
];
