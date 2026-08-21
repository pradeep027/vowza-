// ─── AI Orchestrator ─────────────────────────────────────────────────────────
// The reasoning brain of the Vowza AI.
// Before EVERY response it:
//   1. Reads the full conversation history
//   2. Understands what the user actually wants
//   3. Decides if DB retrieval is needed
//   4. Rewrites the query for better retrieval
//   5. Determines the response strategy
//   6. Builds the full context for the LLM
//
// This replaces the old switch/case decision tree entirely.

import type { ChatMessage, PlannerContext, PlanningStateData, EventBudgetPlan } from './aiPlannerTypes';
import { fmt } from './aiPlanner';
import { EventBudgetPlanner } from './eventBudgetPlanner';
import { extractEventDateFromText } from './eventContextCapturer';
import { extractMinimumRating } from './plannerRecommendation';

// ── Intent categories ─────────────────────────────────────────────────────────
export type Intent =
  | 'find_vendors'        // "show me photographers in hyderabad"
  | 'plan_event'          // "plan my wedding" / "create full plan"
  | 'budget_breakdown'    // "give me budget breakdown"
  | 'timeline'            // "create timeline"
  | 'checklist'           // "what do I need to prepare"
  | 'food_plan'           // "help me plan food"
  | 'weather_advice'      // "which month is best"
  | 'risk_analysis'       // "what could go wrong"
  | 'success_score'       // "score my plan"
  | 'negotiation'         // "help negotiate with vendor"
  | 'comparison'          // "compare these two options"
  | 'booking_request'     // "book this photographer" / "reserve vendor" (NEW Phase 7A)
  | 'general_question'    // "what is Gruhapravesam"
  | 'context_update'      // "change city to mumbai" / "increase budget"
  | 'follow_up'           // "tell me more about that" / "that one"
  | 'greeting'            // "hi" / "hello"
  | 'clarification'       // answering a question the AI asked

// ── Orchestration result ──────────────────────────────────────────────────────
export interface OrchestrationResult {
  intent:           Intent;
  needsRetrieval:   boolean;
  rewrittenQuery:   string;         // optimised for DB search
  professions:      string[];       // vendor categories to retrieve
  city:             string | null;
  priceMax:         number | null;
  minRating:        number;
  responseStrategy: ResponseStrategy;
  contextSummary:   string;         // what we know so far — injected into LLM
  shouldAskNext:    string | null;  // next question if info is missing
  adminPackageContext?: string;     // NEW Phase 7E: admin packages context
  liveAvailabilityContext?: string; // NEW Phase 7F: real-time availability
  updatedContext:   PlannerContext; // PHASE 2A: merged and validated context
  ambiguousChange:  boolean;        // PHASE 2A: whether change was ambiguous
}

export type ResponseStrategy =
  | 'stream_with_rag'     // retrieve vendors then stream LLM answer
  | 'stream_veda'         // use VEDA engine + stream
  | 'stream_general'      // pure LLM answer (no retrieval needed)
  | 'ask_question'        // ask user for missing info
  | 'update_context'      // acknowledge context change + continue

// ── Missing field priority order ──────────────────────────────────────────────
const FIELD_QUESTIONS: Record<string, string> = {
  eventType:     'What type of event are you planning? (Wedding, Birthday, Corporate, Housewarming...)',
  city:          'Which city will the event take place in?',
  budget:        'What is your total budget? (e.g. ₹8 lakh, ₹15 lakh)',
  guestCount:    'How many guests are you expecting approximately?',
  eventDate:     'Do you have a date or month in mind?',
  foodPreference:'Would you like Veg, Non-Veg, or Both for the food?',
  venueType:     'Would you prefer Indoor or Outdoor for this event?',
};

// ── Lightweight follow-up questions — asked ONE at a time, never block a plan.
// These make the AI feel like a natural planner ("Veg or Non-Veg? Buffet or
// Table Service?") without gating core generation.
const SOFT_FOLLOWUPS: { field: keyof PlannerContext; question: string; when?: (ctx: PlannerContext) => boolean }[] = [
  { field: 'foodPreference', question: 'Would you like **Veg**, **Non-Veg**, or **Both** for the food?' },
  { field: 'serviceStyle',   question: 'Should the food service be **Buffet** or **Table Service**?' },
  { field: 'venueType',      question: 'Are you thinking **Indoor** or **Outdoor** for the venue?' },
  { field: 'styleVibe',      question: 'Do you prefer a **Traditional** or **Modern** theme?' },
  { field: 'luxuryLevel',    question: 'Should I plan this as **Luxury**, **Premium**, **Standard**, or **Budget-friendly**?' },
  { field: 'timeOfDay',      question: 'Is this a **Morning**, **Afternoon**, **Evening**, or **Night** event?' },
];

// Returns ONE natural follow-up question for whatever preference is still
// unknown, or null if everything relevant is already known. Never blocks
// plan generation — callers append this to the end of a completed response.
export function nextSoftFollowUp(ctx: PlannerContext): string | null {
  for (const f of SOFT_FOLLOWUPS) {
    if (!ctx[f.field] && (!f.when || f.when(ctx))) return f.question;
  }
  return null;
}

// ── PHASE 2A: Record an asked question in the context ────────────────────────
export function recordAskedQuestion(
  context: PlannerContext,
  question: string
): PlannerContext {
  const asked = context.askedQuestions ?? [];
  if (!asked.includes(question)) {
    asked.push(question);
  }
  return { ...context, askedQuestions: asked };
}

// ── PHASE 2A: Mark a field as explicitly confirmed by the user ────────────────
export function markFieldConfirmed(
  context: PlannerContext,
  fieldName: string
): PlannerContext {
  const confirmed = context.confirmedFields ?? [];
  if (!confirmed.includes(fieldName)) {
    confirmed.push(fieldName);
  }
  return { ...context, confirmedFields: confirmed };
}

// ── PHASE 2A: Check if a question has been asked before ──────────────────────
export function hasAskedQuestion(context: PlannerContext, question: string): boolean {
  return (context.askedQuestions ?? []).includes(question);
}

// ── PHASE 2A: Check if a field has been explicitly confirmed ──────────────────
export function isFieldConfirmed(context: PlannerContext, fieldName: string): boolean {
  return (context.confirmedFields ?? []).includes(fieldName);
}

// ── Vendor keyword → profession_type map ──────────────────────────────────────
const VENDOR_KEYWORDS: [RegExp, string][] = [
  [/photograph/i,       'photographer'],
  [/videograph|cinema/i,'videographer'],
  [/drone/i,            'drone_operator'],
  [/\bdj\b/i,           'dj'],
  [/\bband\b|music band/i, 'music_band'],
  [/\bsinger/i,         'singer'],
  [/\bdancer/i,         'dancer'],
  [/choreograph/i,      'choreographer'],
  [/decorator|decor|decoration/i, 'wedding_decorator'],
  [/event.decorator/i, 'event_decorator'],
  [/stage.decorator/i, 'stage_decorator'],
  [/makeup|bridal makeup/i, 'makeup_artist'],
  [/mehendi|mehndi|henna/i, 'mehendi_artist'],
  [/magician/i,         'magician'],
  [/anchor|emcee|host/i,'anchor'],
  [/cater|food|meal|menu/i, 'catering_services'],
  [/banquet|hall|venue/i,'banquet_hall'],
  [/pandit|priest|pooja/i,'pandit'],
  [/rental|tent|shamiana|stage\s+rental/i,'rentals'],
  [/water|can water|drinking/i,'water_supplier'],
  [/lighting|lights/i,  'lighting_services'],
  [/sound|audio/i,      'sound_services'],
];

// ── City extractor ────────────────────────────────────────────────────────────
const CITY_LIST = ['hyderabad','bangalore','mumbai','delhi','pune','chennai','vizag',
  'vijayawada','warangal','nagpur','kolkata','ahmedabad','surat','jaipur',
  'lucknow','kochi','indore','bhopal','coimbatore','vadodara'];

function extractCity(text: string): string | null {
  const l = text.toLowerCase();
  for (const c of CITY_LIST) if (l.includes(c)) return c.charAt(0).toUpperCase() + c.slice(1);
  const m = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  return m?.[1] ?? null;
}

// ── Locality/Area extractor ───────────────────────────────────────────────────
function extractLocality(text: string): string | null {
  // Extract areas/localities mentioned with "in" or "near"
  // "in Beramguda", "in Banjara Hills", "near Whitefield"
  const patterns = [
    /\b(?:in|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,  // "in Beramguda"
    /,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,  // ", Beramguda"
  ];
  
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m[1];
  }
  return null;
}

// ── Budget extractor ──────────────────────────────────────────────────────────
function extractBudget(text: string): number | null {
  const l = text.toLowerCase();
  const patterns: [RegExp, number][] = [
    [/(\d+(?:\.\d+)?)\s*(?:crore|cr\b)/i, 10000000],
    [/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i, 100000],
    [/(\d+)\s*k\b/i, 1000],
    [/₹\s*(\d[\d,]*)/i, 1],
    [/rs\.?\s*(\d[\d,]*)/i, 1],
  ];
  for (const [re, mul] of patterns) {
    const m = l.match(re);
    if (m) return parseFloat(m[1].replace(/,/g,'')) * mul;
  }
  return null;
}

// ── Detect professions mentioned ──────────────────────────────────────────────
function detectProfessions(text: string): string[] {
  const found: string[] = [];
  for (const [re, prof] of VENDOR_KEYWORDS) {
    if (re.test(text) && !found.includes(prof)) found.push(prof);
  }
  return found;
}

/**
 * Identifies explicit requests to browse the live Vowza category directory.
 * Concrete requests such as "show decorators" remain vendor searches.
 */
export function isActiveCategoryListRequest(message: string): boolean {
  return /\b(?:show|list|browse|view|what(?:\s+are)?|which)\b[\s\w-]{0,40}\b(?:vendor|artist|service|marketplace)?\s*categories\b/i.test(message)
    || /\bwhat\s+(?:vendor|artist|service|marketplace)\s+(?:categories|services)\s+(?:do|are)\b/i.test(message);
}

// ── Core intent classifier ────────────────────────────────────────────────────
function classifyIntent(
  message: string,
  ctx: PlannerContext,
  history: ChatMessage[]
): Intent {
  const l = message.toLowerCase().trim();
  const prevAIMsg = [...history].reverse().find(m => m.role === 'assistant');
  const prevAskedAbout = prevAIMsg?.text?.toLowerCase() ?? '';

  // Greeting — only when no context exists
  if (/^(hi|hello|hey|namaste|hii|good\s*(morning|afternoon|evening|day))[\s!.]*$/i.test(l)) {
    return 'greeting';
  }

  // Context updates — except when the same turn explicitly changes the
  // marketplace request ("Actually, show me photographers instead").
  const switchesMarketplaceRequest = detectProfessions(message).length > 0
    && /find|show|search|recommend|suggest|list|profiles?|vendors?|providers?|available|book|hire|looking for|need/i.test(l);
  if (/change|update|modify|make it|instead|actually|correction|not \w+|switch to|increase|decrease|raise|lower|reduce|bump|up to|down to/i.test(l) && !switchesMarketplaceRequest) {
    return 'context_update';
  }

  // Follow-up references
  if (/^(that one|this one|the first|the second|the last|tell me more|more about|expand|explain more|details|elaborate|what about that|go ahead)[\s.?]*$/i.test(l)) {
    return 'follow_up';
  }

  // Marketplace discovery has priority over generic planning whenever a known
  // service category is paired with a request for profiles or booking options.
  // This prevents "decorator profiles" from falling through to a budget card.
  const professions = detectProfessions(message);
  if (professions.length > 0) {
    // Comparison request — when user asks to compare vendors
    // NEW Phase 7D: Enhanced comparison detection
    const comparisonPatterns = /compare|vs\b|versus|difference|which is better|which one|best option|choose|comparison|vs\.|who's better|side\s*by\s*side/i;
    if (comparisonPatterns.test(l)) {
      return 'comparison';
    }

    if (/compare|vs\b|versus|difference|which is better|which one/i.test(l)) {
      return 'comparison';
    }

    // Booking request — when user explicitly asks to book/reserve/schedule
    // NEW Phase 7A: Separate booking from vendor discovery
    const isBookingRequest = /\b(book|reserve|schedule.*consultation|next.*available|want to book|ready to book|let's book|proceed with booking|confirm booking|book now)/i.test(l);
    if (isBookingRequest) {
      return 'booking_request';
    }

    const asksForMarketplaceRecords = /find|show|search|recommend|suggest|best|top|available|list|profile|profiles|vendor|vendors|provider|providers|need|looking for|hire|want/i.test(l);
    const isShortCategoryRequest = l.split(/\s+/).filter(Boolean).length <= 4;
    if (asksForMarketplaceRecords || isShortCategoryRequest || /under|below|within|cheap|affordable/i.test(l) || /in\s+\w+/i.test(l)) {
      return 'find_vendors';
    }
  }

  // Budget — check BEFORE plan_event so "budget" keywords are not swallowed
  if (/(budget|cost breakdown|how much|afford|₹|lakh|crore|estimate|quote|price list)/i.test(l)) {
    return 'budget_breakdown';
  }

  // Timeline — check BEFORE plan_event so "timeline" is not swallowed by "plan"
  if (/(timeline|schedule|when to|months before|planning schedule|what to do when)/i.test(l)) {
    return 'timeline';
  }

  // Checklist — check BEFORE plan_event
  if (/(checklist|to.do|what.* need|prepare|things to arrange|list of)/i.test(l)) {
    return 'checklist';
  }

  // Food — check BEFORE plan_event so "plan the food" hits food_plan
  if (/(food|catering|menu|per plate|buffet|veg|non.veg|cuisine)/i.test(l)) {
    return 'food_plan';
  }

  // Planning — AFTER specific intents so it only catches generic "plan my wedding" etc.
  if (/(\bplan\b|full plan|complete plan|plan everything|plan my|plan a .+? for|wedding plan|create plan)/i.test(l)
      && !/(budget|cost breakdown|how much|afford|₹|lakh|crore|estimate|quote|price list)/i.test(l)) {
    return 'plan_event';
  }

  // Holistic event description — user just describes their event with enough
  // detail (event type + at least one of budget/city/guests) without using
  // the word "plan". Vowza Planner should proactively generate a full plan
  // instead of asking "what would you like to know?".
  {
    const mentionsEvent = /wedding|reception|engagement|haldi|mehendi|sangeet|birthday|housewarming|baby.shower|anniversary|corporate|conference|college|cultural|festival/i.test(l);
    const mentionsDetail = /₹|lakh|crore|\bguests?\b|\bpeople\b|\bpax\b|in\s+[A-Z][a-z]+/i.test(message);
    if (mentionsEvent && mentionsDetail && !/find|show|search|recommend|book|vendor|photographer|decorator|caterer|dj\b/i.test(l)) {
      return 'plan_event';
    }
  }

  // Weather
  if (/(weather|best month|which month|season|rain|outdoor|monsoon)/i.test(l)) {
    return 'weather_advice';
  }

  // Risk
  if (/(risk|backup|what if|emergency|cancel|fail|go wrong)/i.test(l)) {
    return 'risk_analysis';
  }

  // Score
  if (/(score|rate|how good|confidence|success rate)/i.test(l)) {
    return 'success_score';
  }

  // Negotiation
  if (/(negotiate|reduce.*price|lower.*cost|discount|bargain)/i.test(l)) {
    return 'negotiation';
  }

  // If previous AI asked a question, this is likely a clarification
  if (prevAskedAbout.includes('?') && l.length < 80) {
    return 'clarification';
  }

  // General questions (not event-related)
  if (/(what is|what are|explain|define|tell me about|how does|why is|who is|describe)/i.test(l)) {
    return 'general_question';
  }

  return 'general_question';
}

// ── Build context summary string (injected into LLM) ─────────────────────────
function buildContextSummary(ctx: PlannerContext): string {
  const parts: string[] = [];
  if (ctx.eventType)  parts.push(`Event: ${ctx.eventType}`);
  if (ctx.city)       parts.push(`City: ${ctx.city}`);
  if (ctx.budget)     parts.push(`Budget: ${fmt(ctx.budget)}`);
  if (ctx.guestCount) parts.push(`Guests: ${ctx.guestCount}`);
  if (ctx.eventDate)  parts.push(`Date: ${ctx.eventDate}`);
  if (ctx.venueType)  parts.push(`Venue: ${ctx.venueType}`);
  if (ctx.luxuryLevel)parts.push(`Style: ${ctx.luxuryLevel}`);
  if (ctx.foodPreference) parts.push(`Food: ${ctx.foodPreference}`);
  if (!parts.length)  return '';
  return `\n[CURRENT EVENT CONTEXT: ${parts.join(' | ')}]\n`;
}

// ── Determine the next question to ask if info is missing ─────────────────────
// IMPORTANT: Vowza Planner must behave like an expert planner, not a form.
// Planning intents (plan_event/budget_breakdown/timeline/checklist/food_plan)
// NEVER block on a question anymore — aiPlanner.ts fills sensible defaults
// (₹5L budget, 200 guests, "wedding", "your city") and generates useful
// output immediately. Missing preferences are instead asked as ONE soft
// follow-up appended AFTER the plan (see nextSoftFollowUp / withFollowUp).
function determineNextQuestion(
  intent: Intent,
  ctx: PlannerContext
): string | null {
  // Discovery is useful without a city. The retriever searches the public,
  // verified marketplace first and ranks any city/budget context when present.
  // Do not gate a specific category request behind an unnecessary question.
  if (intent === 'find_vendors') return null;

  return null;
}

// ── Calculate Planning Readiness (NEW in Phase 2A) ──────────────────────────────
// Returns a score 0-100 indicating how ready we are to generate a full plan.
// Threshold: >= 60% means we have sufficient context to generate meaningful allocation.
export function calculatePlanningReadiness(ctx: PlannerContext): {
  readiness: number;
  missingFields: (keyof PlannerContext)[];
  isSufficient: boolean;
} {
  let score = 0;
  const missing: (keyof PlannerContext)[] = [];

  // Event type is ALWAYS required (25 points)
  if (ctx.eventType) score += 25;
  else missing.push('eventType');

  // Budget (20 points) — OR city (15) — OR guests (15)
  // Need at least ONE of these three to make realistic allocation
  let contextScore = 0;
  if (ctx.budget) contextScore += 20;
  else missing.push('budget');

  if (ctx.city) contextScore += 15;
  else missing.push('city');

  if (ctx.guestCount) contextScore += 15;
  else missing.push('guestCount');

  // Take the best combo
  if (contextScore >= 15) score += 20; // Has at least one detail
  else score += 0;

  // Luxury level helps but is optional (15 points)
  if (ctx.luxuryLevel) score += 15;

  // Date is nice-to-have (10 points)
  if (ctx.eventDate) score += 10;

  // Food pref, style, venue type are nice-to-have (each 5 points)
  if (ctx.foodPreference) score += 5;
  if (ctx.styleVibe) score += 5;
  if (ctx.venueType) score += 5;

  return {
    readiness: Math.min(100, score),
    missingFields: missing,
    isSufficient: score >= 60, // >= 60% is "go generate a plan"
  };
}

// ── Extract Plan State (NEW in Phase 2A) ───────────────────────────────────────
export function extractPlanState(
  ctx: PlannerContext,
  currentPlan: EventBudgetPlan | null
): PlanningStateData {
  const { readiness, missingFields, isSufficient } = calculatePlanningReadiness(ctx);
  
  const completedSteps: string[] = [];
  if (ctx.eventType) completedSteps.push('extracted_event_type');
  if (ctx.budget) completedSteps.push('extracted_budget');
  if (ctx.city) completedSteps.push('extracted_city');
  if (ctx.guestCount) completedSteps.push('extracted_guests');
  if (ctx.eventDate) completedSteps.push('extracted_date');
  if (currentPlan) completedSteps.push('generated_plan');

  let state: import('./aiPlannerTypes').PlanningState;
  if (currentPlan) state = 'COMPLETE' as any;
  else if (isSufficient) state = 'PLANNING' as any;
  else state = 'GATHERING_INFO' as any;

  return {
    state,
    completedSteps,
    missingInfo: missingFields,
    readiness,
  };
}

function extractEventDate(text: string): string | undefined {
  // NEW Phase 7B: Use enhanced date extraction from eventContextCapturer
  // This replaces the basic regex-only extraction with comprehensive parsing
  
  try {
    const dateObj = extractEventDateFromText(text);
    if (!dateObj) return undefined;
    
    // Convert Date object to ISO string format (YYYY-MM-DD)
    const iso = dateObj.toISOString().split('T')[0];
    return iso;
  } catch (e) {
    // Fallback to original logic if enhanced extraction fails
  }

  // Original fallback logic
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const named = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/i);
  if (!named) return undefined;

  const month = ['january','february','march','april','may','june','july','august','september','october','november','december']
    .indexOf(named[1].toLowerCase());
  if (month < 0) return undefined;
  const day = Number(named[2]);
  let year = named[3] ? Number(named[3]) : new Date().getFullYear();
  const candidate = new Date(year, month, day);
  if (!named[3] && candidate < new Date(new Date().toDateString())) year += 1;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── PHASE 2A: Detect ambiguous changes ─────────────────────────────────────
// If user says "somewhere else" without specifying a city, flag as ambiguous
function isAmbiguousChange(message: string, ctx: PlannerContext): boolean {
  const l = message.toLowerCase();
  
  // "Maybe somewhere else" / "Maybe in a different city" but NO city mentioned
  if ((/somewhere else|different.*city|another.*city|change.*city/i.test(l)) && !extractCity(message)) {
    return true;
  }
  
  // "Not sure about..." patterns without specifics
  if (/not.*sure.*about|maybe.*change|possibly.*change/i.test(l) && !extractBudget(message) && !extractCity(message)) {
    return true;
  }
  
  return false;
}

// ── PHASE 2A: Merge context intelligently ──────────────────────────────────
// Preserve all existing fields; only update fields mentioned in the message
export function mergeContextIntelligently(
  previousContext: PlannerContext,
  extractedUpdates: Partial<PlannerContext>,
  message: string
): { merged: PlannerContext; ambiguous: boolean } {
  // Start with all previous values
  let merged = { ...previousContext };
  
  // Check for ambiguous changes first
  const ambiguous = isAmbiguousChange(message, previousContext);
  
  // Only merge non-ambiguous updates
  if (!ambiguous) {
    // Merge each extracted field
    for (const [key, value] of Object.entries(extractedUpdates)) {
      if (value !== undefined && value !== null) {
        (merged as any)[key] = value;
        // Mark the field as confirmed (explicitly provided by user)
        merged = markFieldConfirmed(merged, key);
      }
    }
  }
  
  return { merged, ambiguous };
}

// ── Extract context updates from message ─────────────────────────────────────
export function extractContextUpdates(
  message: string,
  ctx: PlannerContext
): Partial<PlannerContext> {
  const updates: Partial<PlannerContext> = {};
  const l = message.toLowerCase();

  // Budget
  const budget = extractBudget(message);
  if (budget) updates.budget = budget;

  // Guest count — supports both "500 guests" and "guest count to 500"
  const gm = message.match(/(\d+)\s*(?:guests?|people|pax|persons?|attendees?|heads?)/i)
    ?? message.match(/(?:guest\s*count|expect(?:ed)?|about|around|with|having|total)\s*(?:of\s*)?(?:to\s*)?(?:about\s*)?(?:around\s*)?(\d+)/i);
  if (gm) updates.guestCount = parseInt(gm[1]);

  // City
  const city = extractCity(message);
  if (city) updates.city = city;

  // Locality/Area
  const locality = extractLocality(message);
  if (locality && !updates.city) updates.city = locality;  // Use as fallback area hint

  // Event type
  const eventMap: [RegExp, string][] = [
    [/\bwedding\b/i,'wedding'], [/\breception\b/i,'reception'],
    [/\bengagement\b/i,'engagement'], [/\bhaldi\b/i,'haldi'],
    [/\bmehendi\b|mehndi/i,'mehendi'], [/\bsangeet\b/i,'sangeet'],
    [/\bbirthday\b/i,'birthday'], [/\bbaby.shower\b/i,'babyshower'],
    [/house.warm/i,'housewarming'], [/\banniversary\b/i,'anniversary'],
    [/\bcorporate\b/i,'corporate'], [/\bconcert\b/i,'concert'],
    [/\bparty\b/i,'privateparty'], [/\bnaming.ceremony\b/i,'housewarming'],
    [/\bgruhapravesam\b/i,'housewarming'], [/\bconference\b/i,'conference'],
  ];
  for (const [re, et] of eventMap) {
    if (re.test(l)) { updates.eventType = et as PlannerContext['eventType']; break; }
  }

  // Style
  if (/\bluxury\b/i.test(l))         updates.luxuryLevel = 'luxury';
  else if (/\bpremium\b/i.test(l))   updates.luxuryLevel = 'premium';
  else if (/budget.friendly|low.budget/i.test(l)) updates.luxuryLevel = 'budget';

  // Venue type
  if (/\boutdoor\b/i.test(l))        updates.venueType = 'outdoor';
  else if (/\bindoor\b/i.test(l))    updates.venueType = 'indoor';

  // Food
  if (/non.veg/i.test(l))            updates.foodPreference = 'non-veg';
  else if (/\bveg\b/i.test(l))       updates.foodPreference = 'veg';
  else if (/\bboth\b.*(veg|food)|veg.*non.veg/i.test(l)) updates.foodPreference = 'both';

  // Service style
  if (/\bbuffet\b/i.test(l))         updates.serviceStyle = 'buffet';
  else if (/table\s*service/i.test(l)) updates.serviceStyle = 'table_service';

  // Time of day
  if (/\bmorning\b/i.test(l))        updates.timeOfDay = 'morning';
  else if (/\bafternoon\b/i.test(l)) updates.timeOfDay = 'afternoon';
  else if (/\bevening\b/i.test(l))   updates.timeOfDay = 'evening';
  else if (/\bnight\b/i.test(l))     updates.timeOfDay = 'night';

  // Style vibe
  if (/\btraditional\b/i.test(l))    updates.styleVibe = 'traditional';
  else if (/\bmodern\b|contemporary/i.test(l)) updates.styleVibe = 'modern';

  // Keep an exact date when supplied so marketplace availability can be checked.
  // A month-only statement remains useful planning context but is never treated
  // as confirmation of a provider's calendar availability.
  const exactDate = extractEventDate(message);
  if (exactDate) {
    updates.eventDate = exactDate;
  } else {
    const months = ['january','february','march','april','may','june',
      'july','august','september','october','november','december'];
    for (const month of months) if (l.includes(month)) { updates.eventDate = month; break; }
  }

  // Duration
  const dm = message.match(/(\d+)\s*days?/i);
  if (dm) updates.durationDays = parseInt(dm[1]);

  return updates;
}

// ── Main orchestrate function ─────────────────────────────────────────────────
export function orchestrate(
  message: string,
  ctx: PlannerContext,
  history: ChatMessage[]
): OrchestrationResult {
  const normalizedMessage = message.replace(/\bvideo\s+graphers?\b/gi, 'videographer');
  
  // ─── PHASE 2A: Extract and merge context intelligently ───────────────────
  const updates = extractContextUpdates(normalizedMessage, ctx);
  const { merged, ambiguous } = mergeContextIntelligently(ctx, updates, normalizedMessage);
  
  // ─── PHASE 2A: If ambiguous, include this in the result ──────────────────
  if (ambiguous) {
    console.log('[Vowza AI Phase 2A] Ambiguous context change detected:', { message, updates });
  }
  
  // 2. Classify intent
  const intent = classifyIntent(normalizedMessage, merged, history);

  // 3. Detect vendor professions
  const professions = detectProfessions(normalizedMessage);

  // 4. Extract search parameters
  const city = merged.city ?? extractCity(normalizedMessage);
  const priceMax = extractBudget(normalizedMessage) ?? merged.budget ?? null;
  const minRating = extractMinimumRating(normalizedMessage) ?? 0;

  // 5. Decide if retrieval is needed
  // STRICT RULE: only search the Vowza database when the user explicitly
  // asks for vendors (e.g. "find photographers", "recommend caterers",
  // "show decorators"). Food menus, budgets, decoration ideas, and general
  // event planning must be answered from AI knowledge — never trigger a
  // vendor search just because a related keyword (e.g. "catering") appears.
  const needsRetrieval = (
    intent === 'find_vendors' ||
    intent === 'comparison' ||
    (intent === 'clarification' && professions.length > 0)
  );

  // 6. Rewrite query for better retrieval
  const rewrittenQuery = needsRetrieval
    ? buildRetrievalQuery(message, merged, professions)
    : message;

  // 7. Determine response strategy
  let responseStrategy: ResponseStrategy;
  let nextQuestion = determineNextQuestion(intent, merged);
  
  // PHASE 2A: Record the question if we're about to ask it
  if (nextQuestion && ['plan_event','budget_breakdown','timeline','checklist','food_plan'].includes(intent)) {
    if (!hasAskedQuestion(merged, nextQuestion)) {
      merged = recordAskedQuestion(merged, nextQuestion);
    }
  }

  if (intent === 'greeting') {
    responseStrategy = 'stream_general';
  } else if (nextQuestion && ['plan_event','budget_breakdown','timeline','checklist','food_plan'].includes(intent)) {
    responseStrategy = 'ask_question';
  } else if (needsRetrieval) {
    responseStrategy = 'stream_with_rag';
  } else if (['general_question', 'follow_up', 'comparison', 'context_update'].includes(intent)) {
    responseStrategy = 'stream_general';
  } else if (['plan_event','budget_breakdown','timeline','checklist',
              'food_plan','weather_advice','risk_analysis','success_score',
              'negotiation','clarification'].includes(intent)) {
    responseStrategy = 'stream_veda';
  } else {
    responseStrategy = 'stream_general';
  }

  return {
    intent,
    needsRetrieval,
    rewrittenQuery,
    professions,
    city,
    priceMax,
    minRating,
    responseStrategy,
    contextSummary: buildContextSummary(merged),
    shouldAskNext: responseStrategy === 'ask_question' ? nextQuestion : null,
    updatedContext: merged,               // ─ NEW: Phase 2A ─
    ambiguousChange: ambiguous,           // ─ NEW: Phase 2A ─
  };
}

// ── Build an optimised retrieval query ────────────────────────────────────────
function buildRetrievalQuery(
  message: string,
  ctx: PlannerContext,
  professions: string[]
): string {
  const parts: string[] = [message];
  if (ctx.city && !message.toLowerCase().includes(ctx.city.toLowerCase())) {
    parts.push(`in ${ctx.city}`);
  }
  if (ctx.budget && !/lakh|₹|\d+k/i.test(message)) {
    parts.push(`under ${fmt(ctx.budget)}`);
  }
  if (ctx.eventType && !message.toLowerCase().includes(ctx.eventType)) {
    parts.push(`for ${ctx.eventType}`);
  }
  return parts.join(' ');
}

// ── Build the full system prompt enriched with context ────────────────────────
export function buildDynamicSystemPrompt(
  result: OrchestrationResult,
  ctx: PlannerContext,
  ragContext: string,
  history: ChatMessage[]
): string {
  const hasCtx = !!(ctx.eventType || ctx.city || ctx.budget || ctx.guestCount);
  const turnCount = history.length;

  return `You are the ✨ Vowza Planner — an intelligent AI event planning assistant built into Vowza, India's premier event marketplace.

PERSONALITY: Warm, confident, knowledgeable. Sound like a brilliant personal consultant — never robotic, never repetitive. You think before you respond.

CRITICAL RULES:
1. NEVER show the welcome message again after the first interaction.
2. NEVER ask a question that was already answered.
3. NEVER restart the conversation or repeat the same greeting.
4. If you know the city, budget, or event type — USE IT. Don't ask again.
5. Answer the user's EXACT question first, then offer the next useful step.
6. If the user says "hi" or "hello" mid-conversation, just acknowledge briefly and continue.
7. For general questions (not event-related), answer naturally like ChatGPT.
8. For vendor questions, ONLY use the real records provided in the MARKETPLACE EVIDENCE below.
9. NEVER invent vendor names, prices, ratings, IDs, reviews, packages, experience, locations, or availability.
10. Treat availability marked "needs confirmation" as exactly that: never call a provider available until Vowza data confirms it.
11. Generated budget allocations and timelines are planning guidance, not vendor quotes; clearly distinguish them from retrieved marketplace prices.
12. You are an EXPERT EVENT PLANNER, not a vendor search bot. When the user mentions an event,
    budget, guest count, or city, immediately generate useful planning content — budget
    allocation, timeline, checklist, food suggestions, decoration ideas, photography plan,
    entertainment plan, guest management, parking plan, weather backup, emergency planning,
    and money-saving tips. Use sensible defaults for anything unstated. NEVER withhold useful
    suggestions just to ask a clarifying question first.
11. Search the Vowza database ONLY when the user explicitly asks to find/recommend/show
    vendors (e.g. "find photographers", "recommend caterers", "show decorators"). Do NOT
    search vendors for food menus, budget planning, decoration ideas, or general event
    planning questions — answer those from AI knowledge instead.
12. If a vendor search returns zero real results, say so honestly, then IMMEDIATELY continue
    helping with budget estimation, food planning, decoration ideas, timelines, or checklists.
    NEVER end the conversation just because no vendors were found.
13. Ask ONE natural follow-up at a time when relevant, e.g. Veg or Non-Veg? Buffet or Table
    Service? Indoor or Outdoor? Traditional or Modern? Morning or Evening? Luxury or Budget?
    Never ask a preference that is already known from context, and never let a follow-up
    question block or delay the actual planning content.

CURRENT SESSION:
${hasCtx ? `You already know: ${result.contextSummary.replaceAll('[', '').replaceAll(']', '').trim()}` : 'Fresh conversation — no event details yet.'}
Conversation turns so far: ${turnCount}
Detected intent this turn: ${result.intent}

${ragContext ? `\nRAG CONTEXT — REAL VOWZA MARKETPLACE DATA:\n${ragContext}\n\nWhen answering vendor questions, cite these real vendors by name and include their profile links.\n` : ''}

${result.adminPackageContext ? `\nADMIN EVENT PACKAGES — Phase 7E:\n${result.adminPackageContext}\n` : ''}

${result.liveAvailabilityContext ? `\nREAL-TIME AVAILABILITY — Phase 7F:\n${result.liveAvailabilityContext}\n` : ''}

RESPONSE STYLE:
- Conversational, direct, helpful
- Use markdown: **bold** for emphasis, bullet lists, tables where useful
- Match the user's energy — if they're casual, be casual; if formal, be professional
- Keep responses focused — don't dump everything at once
- End with ONE relevant follow-up offer (not multiple options)

VOWZA MARKETPLACE:
- Categories and provider fields are discovered from Vowza marketplace evidence; do not imply that a category, package, price, rating, or verification state exists unless it appears in that evidence.
- Never expose private contact details. Profile, portfolio, availability, and booking actions must stay inside Vowza's existing flow.`;
}
