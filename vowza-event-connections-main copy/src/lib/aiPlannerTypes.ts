// ─── VEDA AI Event OS — Complete Type Definitions ────────────────────────────

export type EventCategory =
  | "wedding" | "reception" | "engagement" | "haldi" | "mehendi" | "sangeet"
  | "birthday" | "babyshower" | "housewarming" | "anniversary"
  | "corporate" | "conference" | "productlaunch" | "exhibition"
  | "collegefest" | "concert" | "djnight" | "fashionshow" | "sportsEvent"
  | "temple" | "festival" | "charity" | "privateparty";

export type LuxuryLevel = "budget" | "standard" | "premium" | "luxury";
export type VenueType   = "indoor" | "outdoor" | "both";
export type Season      = "winter" | "summer" | "monsoon" | "autumn";
export type RiskLevel   = "low" | "medium" | "high" | "critical";

// ─── Planning context ─────────────────────────────────────────────────────────
export interface PlannerContext {
  eventType?:           EventCategory;
  city?:                string;
  budget?:              number;
  guestCount?:          number;
  eventDate?:           string;
  durationDays?:        number;
  religion?:            string;
  venueType?:           VenueType;
  luxuryLevel?:         LuxuryLevel;
  theme?:               string;
  colorPalette?:        string;
  foodPreference?:      "veg" | "non-veg" | "both";
  language?:            string;
  season?:              Season;
  userName?:            string;
  venueName?:           string;
  hasVenue?:            boolean;
  guestCity?:           string;
  specialRequirements?: string;
}

// ─── Budget ───────────────────────────────────────────────────────────────────
export interface BudgetLineItem {
  category:    string;
  minCost:     number;
  maxCost:     number;
  recommended: number;
  percentage:  number;
  notes:       string;
  canReduce?:  boolean;
  reduceTip?:  string;
}
export interface BudgetPlan {
  totalBudget:     number;
  breakdown:       BudgetLineItem[];
  grandTotal:      number;
  remaining:       number;
  isFeasible:      boolean;
  feasibilityNote: string;
  savingTips:      string[];
  hiddenCosts:     string[];
}

// ─── Day itinerary slot ───────────────────────────────────────────────────────
export interface TimeSlot {
  time:     string;  // "9:00 AM"
  activity: string;  // "Guest Arrival"
  who:      string;  // "All Guests" | "Bride" | "Vendor"
  note?:    string;
  period:   "morning" | "afternoon" | "evening" | "night";
}

// ─── Per-day plan ─────────────────────────────────────────────────────────────
export interface DayPlan {
  day:         number;
  label:       string;       // "Day 1 – Haldi & Mehendi"
  theme:       string;       // "Vibrant & Playful"
  description: string;       // Brief overview of the day
  slots:       TimeSlot[];
  budget:      DayBudget;
  checklist:   DayChecklist[];
  vendors:     DayVendor[];
  aiTips:      string[];
  sunrise?:    string;
  goldenHour?: string;
}

export interface DayBudget {
  total:       number;
  breakdown:   { category: string; amount: number; note: string }[];
}

export interface DayChecklist {
  task:     string;
  priority: "must" | "should" | "nice";
  owner:    string;
}

export interface DayVendor {
  role:        string;
  description: string;
  budgetRange: string;
  searchUrl:   string;
  urgency:     "book_now" | "flexible";
}

// ─── Wedding overview ─────────────────────────────────────────────────────────
export interface WeddingOverview {
  days:          number;
  totalBudget:   number;
  guestCount:    number;
  location:      string;
  style:         string;
  season:        string;
  budgetPerDay:  number;
  feasibility:   "excellent" | "good" | "tight" | "insufficient";
  feasibilityNote: string;
}

// ─── Complete wedding plan (new planner output) ───────────────────────────────
export interface WeddingPlan {
  overview:    WeddingOverview;
  days:        DayPlan[];
  totalSpend:  number;
  remaining:   number;
  globalTips:  string[];
  successScore: number;
  confidence:  number;
}

// ─── Legacy timeline (kept for backward compat) ───────────────────────────────
export interface TimelineMilestone {
  timeframe: string;
  tasks:     string[];
  priority:  "critical" | "important" | "optional";
}
export interface HourlySlot {
  time:     string;
  activity: string;
  who:      string;
  note?:    string;
}
export interface DaySchedule {
  day:      number;
  label:    string;
  slots:    HourlySlot[];
  sunrise?: string;
  sunset?:  string;
}
export interface EventTimeline {
  milestones:       TimelineMilestone[];
  eventDaySchedule: { time: string; activity: string }[];
  multiDaySchedule?: DaySchedule[];
}

// ─── Vendor ───────────────────────────────────────────────────────────────────
export interface VendorRecommendation {
  category:        string;
  reason:          string;
  budgetRange:     string;
  minPrice:        number;
  maxPrice:        number;
  tips:            string[];
  vowzaSearchUrl:  string;
  bookingUrgency?: "book_now" | "flexible";
}

// ─── Weather ──────────────────────────────────────────────────────────────────
export interface WeatherAdvice {
  season:         Season;
  risk:           "low" | "medium" | "high";
  advice:         string;
  backupPlan:     string;
  decorationTips: string[];
  bestMonths:     string[];
  avoidMonths:    string[];
  goldenHour?:    string;
}

// ─── Checklist ────────────────────────────────────────────────────────────────
export interface ChecklistItem {
  id:       string;
  task:     string;
  category: string;
  dueWhen:  string;
  priority: "must" | "should" | "nice";
  done:     boolean;
  owner?:   string;
}

// ─── Food ─────────────────────────────────────────────────────────────────────
export interface FoodPlan {
  costPerPlate:         number;
  totalFoodCost:        number;
  menuSuggestions:      { course: string; items: string[] }[];
  liveCounters:         string[];
  wastageReductionTips: string[];
}

// ─── Negotiation ──────────────────────────────────────────────────────────────
export interface NegotiationMessage {
  vendorType:   string;
  currentPrice: number;
  targetPrice:  number;
  message:      string;
  tactics:      string[];
}

// ─── Risk ─────────────────────────────────────────────────────────────────────
export interface RiskItem {
  risk:        string;
  probability: RiskLevel;
  impact:      RiskLevel;
  mitigation:  string;
  backupPlan:  string;
}
export interface RiskAnalysis {
  overallRisk: RiskLevel;
  risks:       RiskItem[];
  topConcern:  string;
}

// ─── Score ────────────────────────────────────────────────────────────────────
export interface ScoreCategory {
  name:  string;
  score: number;
  note:  string;
}
export interface SuccessScore {
  overall:      number;
  confidence:   number;
  categories:   ScoreCategory[];
  summary:      string;
  improvements: string[];
}

// ─── Event Plan (legacy) ──────────────────────────────────────────────────────
export interface EventPlan {
  executiveSummary: string;
  budget:           BudgetPlan;
  timeline:         EventTimeline;
  vendors:          VendorRecommendation[];
  checklist:        ChecklistItem[];
  weather?:         WeatherAdvice;
  risks:            RiskAnalysis;
  score:            SuccessScore;
  nearbyServices?:  { type: string; note: string }[];
  improvements:     string[];
}

// ─── AI Response ──────────────────────────────────────────────────────────────
export type ResponseType =
  | "text" | "question" | "tip"
  | "budget_plan" | "timeline" | "vendor_recommendations"
  | "weather_advice" | "checklist" | "food_plan"
  | "negotiation" | "risk_analysis" | "success_score"
  | "full_plan" | "wedding_plan";

export interface AIResponse {
  type: ResponseType;
  text: string;
  data?: {
    budgetPlan?:    BudgetPlan;
    timeline?:      EventTimeline;
    vendors?:       VendorRecommendation[];
    weather?:       WeatherAdvice;
    checklist?:     ChecklistItem[];
    foodPlan?:      FoodPlan;
    negotiation?:   NegotiationMessage;
    risks?:         RiskAnalysis;
    score?:         SuccessScore;
    fullPlan?:      EventPlan;
    weddingPlan?:   WeddingPlan;
    missingFields?: (keyof PlannerContext)[];
  };
}

// ─── Chat message ─────────────────────────────────────────────────────────────
export interface ChatMessage {
  id:        string;
  role:      "user" | "assistant";
  text:      string;
  response?: AIResponse;
  timestamp: Date;
}

export interface QuickPrompt {
  label:  string;
  prompt: string;
  icon:   string;
}
