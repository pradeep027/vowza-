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

import type { ChatMessage, PlannerContext } from './aiPlannerTypes';
import { fmt } from './aiPlanner';

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
}

export type ResponseStrategy =
  | 'stream_with_rag'     // retrieve vendors then stream LLM answer
  | 'stream_veda'         // use VEDA engine + stream
  | 'stream_general'      // pure LLM answer (no retrieval needed)
  | 'ask_question'        // ask user for missing info
  | 'update_context'      // acknowledge context change + continue

// ── Missing field priority order ──────────────────────────────────────────────
const FIELD_QUESTIONS: Record<string, string> = {
  eventType:   'What type of event are you planning? (Wedding, Birthday, Corporate, Housewarming...)',
  city:        'Which city will the event take place in?',
  budget:      'What is your total budget? (e.g. ₹8 lakh, ₹15 lakh)',
  guestCount:  'How many guests are you expecting approximately?',
  eventDate:   'Do you have a date or month in mind?',
};

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

  // Context updates — user correcting/changing something
  if (/change|update|modify|make it|instead|actually|correction|not \w+|switch to/i.test(l)) {
    return 'context_update';
  }

  // Follow-up references
  if (/^(that one|this one|the first|the second|the last|tell me more|more about|expand|explain more|details|elaborate|what about that|go ahead)[\s.?]*$/i.test(l)) {
    return 'follow_up';
  }

  // Vendor-specific searches
  if (detectProfessions(message).length > 0) {
    if (/find|show|search|recommend|suggest|best|top|available|list|book/i.test(l) ||
        /under|below|within|budget|cheap|affordable/i.test(l) ||
        /in\s+\w+/i.test(l)) {
      return 'find_vendors';
    }
    if (/compare|vs\b|versus|difference|which is better|which one/i.test(l)) {
      return 'comparison';
    }
  }

  // Planning
  if (/(plan|full plan|complete plan|plan everything|plan my|plan a .+? for|wedding plan|create plan)/i.test(l)) {
    return 'plan_event';
  }

  // Budget
  if (/(budget|cost breakdown|how much|afford|₹|lakh|crore|estimate|quote|price list)/i.test(l)) {
    return 'budget_breakdown';
  }

  // Timeline
  if (/(timeline|schedule|when to|months before|planning schedule|what to do when)/i.test(l)) {
    return 'timeline';
  }

  // Checklist
  if (/(checklist|to.do|what.* need|prepare|things to arrange|list of)/i.test(l)) {
    return 'checklist';
  }

  // Food
  if (/(food|catering|menu|per plate|buffet|veg|non.veg|cuisine)/i.test(l)) {
    return 'food_plan';
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
function determineNextQuestion(
  intent: Intent,
  ctx: PlannerContext
): string | null {
  // General questions and vendor searches don't need full context
  if (['general_question', 'follow_up', 'greeting', 'context_update'].includes(intent)) return null;

  // Vendor searches need at minimum a city
  if (intent === 'find_vendors') {
    if (!ctx.city) return FIELD_QUESTIONS.city;
    return null;
  }

  // Planning intents need more context
  if (['plan_event', 'budget_breakdown', 'timeline', 'checklist', 'food_plan'].includes(intent)) {
    if (!ctx.eventType) return FIELD_QUESTIONS.eventType;
    if (!ctx.city)      return FIELD_QUESTIONS.city;
    if (!ctx.budget)    return FIELD_QUESTIONS.budget;
    if (!ctx.guestCount)return FIELD_QUESTIONS.guestCount;
  }

  return null;
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

  // Guest count
  const gm = message.match(/(\d+)\s*(?:guests?|people|pax|persons?|attendees?|heads?)/i);
  if (gm) updates.guestCount = parseInt(gm[1]);

  // City
  const city = extractCity(message);
  if (city) updates.city = city;

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
    if (re.test(l)) { updates.eventType = et as any; break; }
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

  // Date / month
  const months = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  for (const m of months) if (l.includes(m)) { updates.eventDate = m; break; }

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
  // 1. Merge any new context from the message
  const updates = extractContextUpdates(message, ctx);
  const merged: PlannerContext = { ...ctx, ...updates };

  // 2. Classify intent
  const intent = classifyIntent(message, merged, history);

  // 3. Detect vendor professions
  const professions = detectProfessions(message);

  // 4. Extract search parameters
  const city = merged.city ?? extractCity(message);
  const priceMax = extractBudget(message) ?? merged.budget ?? null;
  const minRating = /highly.rated|top.rated|best|verified/i.test(message) ? 4.0 : 0;

  // 5. Decide if retrieval is needed
  const needsRetrieval = (
    intent === 'find_vendors' ||
    intent === 'comparison' ||
    (intent === 'food_plan' && professions.includes('catering_services')) ||
    (intent === 'clarification' && professions.length > 0) ||
    /show me|find me|book|available|who is|which photographer|best .* in/i.test(message)
  );

  // 6. Rewrite query for better retrieval
  const rewrittenQuery = needsRetrieval
    ? buildRetrievalQuery(message, merged, professions)
    : message;

  // 7. Determine response strategy
  let responseStrategy: ResponseStrategy;
  const nextQuestion = determineNextQuestion(intent, merged);

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
8. For vendor questions, ONLY use the real data provided in the RAG CONTEXT below.
9. NEVER invent vendor names, prices, or ratings.
10. When context is missing for a plan, ask ONLY the single most important missing question.

CURRENT SESSION:
${hasCtx ? `You already know: ${result.contextSummary.replace(/[\[\]]/g,'').trim()}` : 'Fresh conversation — no event details yet.'}
Conversation turns so far: ${turnCount}
Detected intent this turn: ${result.intent}

${ragContext ? `\nRAG CONTEXT — REAL VOWZA MARKETPLACE DATA:\n${ragContext}\n\nWhen answering vendor questions, cite these real vendors by name and include their profile links.\n` : ''}

RESPONSE STYLE:
- Conversational, direct, helpful
- Use markdown: **bold** for emphasis, bullet lists, tables where useful
- Match the user's energy — if they're casual, be casual; if formal, be professional
- Keep responses focused — don't dump everything at once
- End with ONE relevant follow-up offer (not multiple options)

VOWZA MARKETPLACE KNOWLEDGE:
- 20 vendor categories: Photographers, Videographers, DJs, Bands, Singers, Dancers, Choreographers, Decorators, Makeup Artists, Mehendi Artists, Magicians, Anchors, Caterers, Banquet Halls, Pandits/Priests, Rentals, Water Suppliers, Lighting, Sound, Drone Photography
- Pricing varies by city: Mumbai 1.55x | Delhi 1.45x | Bangalore 1.35x | Chennai 1.15x | Hyderabad 1.0x | Pune 1.12x
- Peak season (Nov–Feb): 20-30% premium | Monsoon (Jun–Sep): 15-20% discount
- All vendors on Vowza are verified — profiles at /artist/[id]`;
}
