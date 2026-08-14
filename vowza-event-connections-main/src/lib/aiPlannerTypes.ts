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
  // ── Intelligent follow-up preferences (asked naturally, one at a time) ─────
  serviceStyle?:        "buffet" | "table_service";
  timeOfDay?:           "morning" | "afternoon" | "evening" | "night";
  styleVibe?:           "traditional" | "modern";
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

// ─── Real DB Vendor (from marketplace retrieval — never invented) ────────────
export type VendorAvailabilityStatus = 'not_checked' | 'needs_confirmation' | 'unavailable';

/** A UUID that passed Vowza's runtime marketplace-record validation. */
export type ProviderId = string & { readonly __providerId: unique symbol };

/**
 * A display-safe marketplace record. This is deliberately stricter than an
 * arbitrary provider-profile row: cards may only receive a validated UUID and
 * a provider whose verification flag is explicitly true.
 */
export interface DBVendor {
  provider_id:       ProviderId;
  profession:        string;
  stage_name?:       string;
  full_name?:        string;
  bio?:              string;
  city?:             string;
  price_min?:        number;
  price_max?:        number;
  average_rating:    number;
  total_reviews:     number;
  total_bookings:    number;
  is_verified:       true;
  is_available:      boolean;
  availability_status?: VendorAvailabilityStatus;
  availability_reason?: string;
  recommendation_reasons?: string[];
  match_score?: number;
  experience_years?: number | null;
  cover_image_url?:  string | null;
  avatar_url?:       string;
}

// ─── Active marketplace category (from artist_categories) ─────────────────────
export interface MarketplaceCategory {
  id:              string;
  name:            string;
  profession_type: string;
  description?:    string | null;
  icon?:           string | null;
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
  | "budget_plan" | "timeline" | "vendor_recommendations" | "vendor_results" | "category_results"
  | "weather_advice" | "checklist" | "food_plan"
  | "negotiation" | "risk_analysis" | "success_score"
  | "full_plan" | "wedding_plan";

// ─── Planning State (NEW in Phase 2A) ──────────────────────────────────────────
export enum PlanningState {
  GATHERING_INFO = 'gathering_info',           // Asking for missing context
  SUFFICIENT_CONTEXT = 'sufficient_context',   // Have event + budget/city/guests
  PLANNING = 'planning',                       // Generating complete plan
  CUSTOMIZING = 'customizing',                 // Customer modifying plan
  DISCOVERING_VENDORS = 'discovering_vendors', // Showing vendor options
  COMPLETE = 'complete',                       // Plan ready
}

export interface PlanningStateData {
  state: PlanningState;
  completedSteps: string[];              // ["extracted_event_type", "estimated_budget", ...]
  missingInfo: (keyof PlannerContext)[]; // ["budget", "city"]
  readiness: number;                     // 0-100 (how ready to generate plan)
}

// ─── Aliased from eventBudgetPlanner for convenience ────────────────────────────
export type BudgetAllocation = import('./eventBudgetPlanner').BudgetAllocation;
export type EventBudgetPlan = import('./eventBudgetPlanner').EventBudgetPlan;

export interface AIResponse {
  type: ResponseType;
  text: string;
  data?: {
    budgetPlan?:    BudgetPlan;
    timeline?:      EventTimeline;
    vendors?:       VendorRecommendation[];
    dbVendors?:     DBVendor[];   // real vendors retrieved from Vowza DB — never invented
    categories?:    MarketplaceCategory[]; // active categories from Vowza DB — never hardcoded
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
  reaction?: "like" | "dislike"; // user feedback on assistant messages (client-side)
}

export interface QuickPrompt {
  label:  string;
  prompt: string;
  icon:   string;
}

// ─── NEW Phase 4: Structured Event Plan (Active Planning Object) ──────────────
/**
 * This is the main plan object that persists across turns.
 * When user says "remove DJ" or "increase photography", this plan is updated.
 */
export interface ServiceLine {
  category: string;              // "Photography", "Catering", "DJ"
  required: boolean;             // true = must have
  optional: boolean;             // true = can customize
  estimatedCost: number;         // From vendor database or estimate
  allocatedBudget?: number;      // What planner allocated
  reason?: string;               // Why this amount?
}

export interface SelectedVendor {
  vendorId: string;              // Real Supabase provider ID only
  vendorName: string;
  category: string;
  city: string;
  allocatedBudget: number;
  basePrice?: number;
  matchScore?: number;           // Scoring from matcher
  matchReasons?: string[];       // Why this vendor?
}

export interface SelectedPackage {
  packageId: string;             // Real admin package ID
  packageName: string;           // "Silver Wedding"
  tier: 'silver' | 'gold' | 'platinum';
  basePrice: number;
  includedServices: string[];
  optionalServices: string[];
  removedOptionals?: string[];   // Up to 2 can be removed
  totalPrice: number;
}

export interface TradeOffOption {
  label: string;                 // "Option A", "Option B"
  description: string;           // "Reduce decoration"
  changes: string[];             // List of changes
  savingsAmount: number;         // How much savings?
  newTotalBudget: number;
  reasoning?: string;
}

export interface Customization {
  timestamp: Date;
  userMessage: string;           // What user said
  change: string;                // What was modified?
  oldValue?: any;
  newValue?: any;
  impactOnBudget: number;        // +/- impact
  reasoning?: string;
}

/**
 * Complete structured event plan.
 * This is what gets displayed to user, modified by user, and persisted in DB.
 */
export interface StructuredEventPlan {
  // Immutable event definition
  eventType: string;
  city: string;
  guestCount: number;
  totalBudget: number;
  date?: string;
  style?: string;
  
  // Service breakdown
  services: ServiceLine[];
  
  // Budget allocation
  allocations: BudgetAllocation[];
  totalAllocated: number;
  remaining: number;
  isFeasible: boolean;
  feasibilityNotes?: string[];
  
  // Selected vendors (real IDs only, NO fabrication)
  selectedVendors: SelectedVendor[];
  
  // Selected packages (real package IDs only)
  selectedPackages: SelectedPackage[];
  
  // Trade-off scenarios (if over budget)
  tradeOffOptions?: TradeOffOption[];
  
  // User decisions & customizations
  customizations: Customization[];
  
  // Recommendations from planner
  recommendations: string[];
  
  // Metadata
  generatedAt: Date;
  modifiedAt: Date;
  versionNumber: number;
  generatedBy: 'ai' | 'user';
}
