export interface PlannerMemoryContext {
  eventId?: string;
  eventLabel?: string;
  eventType?: string;
  city?: string;
  locality?: string;
  budget?: number;
  guestCount?: number;
  eventDate?: string;
  durationDays?: number;
  luxuryLevel?: string;
  theme?: string;
  colorPalette?: string;
  styleVibe?: string;
  foodPreference?: string;
  serviceStyle?: string;
  requestedServices?: string[];
  serviceBudgets?: Record<string, number>;
}

export interface MemoryRecallItem {
  text?: unknown;
  metadata?: Record<string, string> | null;
}

export interface MemoryRetentionRecord {
  content: string;
  context: string;
  timestamp: string;
  documentId: string;
  tags: string[];
  metadata: Record<string, string>;
}

interface EventStateSnapshot {
  eventId?: unknown;
  eventLabel?: unknown;
  eventType?: unknown;
  location?: { city?: unknown; area?: unknown };
  schedule?: { eventDate?: unknown; durationDays?: unknown };
  guests?: { count?: unknown };
  budget?: { total?: unknown; luxuryLevel?: unknown };
  style?: {
    theme?: unknown;
    colorPalette?: unknown;
    vibe?: unknown;
    foodPreference?: unknown;
    serviceStyle?: unknown;
  };
  requirements?: { serviceBudgets?: unknown };
  requestedServices?: unknown;
  updatedAt?: unknown;
}

const EVENT_TYPES = new Set([
  'wedding', 'reception', 'engagement', 'haldi', 'mehendi', 'sangeet',
  'birthday', 'babyshower', 'housewarming', 'anniversary', 'corporate',
  'conference', 'productlaunch', 'exhibition', 'collegefest', 'concert',
  'djnight', 'fashionshow', 'sportsEvent', 'temple', 'festival', 'charity',
  'privateparty',
]);

const KNOWN_CITIES = [
  'hyderabad', 'bangalore', 'mumbai', 'delhi', 'pune', 'chennai', 'vizag',
  'vijayawada', 'warangal', 'nagpur', 'kolkata', 'ahmedabad', 'surat',
  'jaipur', 'lucknow', 'kochi', 'indore', 'bhopal', 'coimbatore', 'vadodara',
];

const ALLOWED_RETENTION_FIELDS = new Set([
  'eventType',
  'location.city',
  'location.area',
  'schedule.eventDate',
  'schedule.durationDays',
  'guests.count',
  'budget.total',
  'budget.luxuryLevel',
  'style.theme',
  'style.colorPalette',
  'style.vibe',
  'style.foodPreference',
  'style.serviceStyle',
  'requirements.serviceBudgets',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 100): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = sanitizeRecallQuery(value.replace(/\p{Cc}/gu, ' ')).replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function positiveNumber(value: unknown, integer = false): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  if (integer && !Number.isInteger(value)) return undefined;
  return value;
}

function validEventId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
}

function metadataNumber(value: string | undefined, integer = false): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return positiveNumber(parsed, integer);
}

function parseServiceBudgets(value: string | undefined): Record<string, number> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) return undefined;
    const budgets = Object.fromEntries(Object.entries(parsed)
      .filter(([key, amount]) => /^[a-z][a-z0-9_ -]{1,60}$/i.test(key) && positiveNumber(amount))
      .map(([key, amount]) => [key, positiveNumber(amount)!]));
    return Object.keys(budgets).length ? budgets : undefined;
  } catch {
    return undefined;
  }
}

/** Stable Hindsight scope derived only from Supabase's authenticated UUID. */
export function hindsightBankIdForUser(userId: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return null;
  }
  return `vowza-user-${userId.toLowerCase()}`;
}

/** Keep secrets and common contact/payment identifiers out of Hindsight queries. */
export function sanitizeRecallQuery(value: string): string {
  return value
    .replace(/\b(?:password|passcode|one[- ]time code|otp|api[- ]?key|access token|secret)\s*[:=]\s*[^\s,;]+/gi, '[redacted]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    // Require at least nine digits so common YYYY-MM-DD / DD-MM-YYYY dates survive.
    .replace(/\+?\d(?:[ ().-]*\d){8,}/g, '[contact number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

/** Compose recall from the current request and only the event fields already known. */
export function buildRecallQuery(message: string, context: PlannerMemoryContext): string {
  const parts = [sanitizeRecallQuery(message)];
  const details = [
    context.eventId && `event scope ${context.eventId}`,
    context.eventLabel && `event label ${context.eventLabel}`,
    context.eventType && `event type ${context.eventType}`,
    context.city && `city ${context.city}`,
    context.locality && `locality ${context.locality}`,
    context.eventDate && `event date ${context.eventDate}`,
    context.guestCount && `guest count ${context.guestCount}`,
    context.budget && `budget INR ${context.budget}`,
    context.theme && `theme ${context.theme}`,
    context.foodPreference && `food preference ${context.foodPreference}`,
  ].filter((part): part is string => Boolean(part));
  if (details.length) parts.push(`Current event context: ${details.join('; ')}.`);
  return parts.filter(Boolean).join('\n').slice(0, 1200);
}

/** Parse only the allow-listed structured fields written by this Planner. */
export function plannerContextFromMetadata(metadata: Record<string, string> | null | undefined): PlannerMemoryContext {
  if (!metadata || metadata.vowza_source !== 'planner-event-state') return {};
  const context: PlannerMemoryContext = {};
  const eventId = validEventId(metadata.vowza_event_id);
  if (eventId) context.eventId = eventId;
  const eventLabel = cleanText(metadata.vowza_event_label, 100);
  if (eventLabel) context.eventLabel = eventLabel;
  const serviceBudgets = parseServiceBudgets(metadata.vowza_service_budgets);
  if (serviceBudgets) context.serviceBudgets = serviceBudgets;
  if (metadata.vowza_requested_services) {
    try {
      const parsed = JSON.parse(metadata.vowza_requested_services);
      if (Array.isArray(parsed)) context.requestedServices = parsed.filter((value): value is string => typeof value === 'string').slice(0, 20);
    } catch { /* ignore malformed optional metadata */ }
  }
  const eventType = cleanText(metadata.vowza_event_type, 40);
  if (eventType && EVENT_TYPES.has(eventType)) context.eventType = eventType;
  const city = cleanText(metadata.vowza_city, 80);
  if (city) context.city = city;
  const locality = cleanText(metadata.vowza_area, 80);
  if (locality) context.locality = locality;
  const eventDate = cleanText(metadata.vowza_event_date, 80);
  if (eventDate) context.eventDate = eventDate;
  const guestCount = metadataNumber(metadata.vowza_guest_count, true);
  if (guestCount) context.guestCount = guestCount;
  const budget = metadataNumber(metadata.vowza_budget_inr);
  if (budget) context.budget = budget;
  const durationDays = metadataNumber(metadata.vowza_duration_days, true);
  if (durationDays) context.durationDays = durationDays;
  const luxuryLevel = cleanText(metadata.vowza_luxury_level, 20);
  if (luxuryLevel && ['budget', 'standard', 'premium', 'luxury'].includes(luxuryLevel)) context.luxuryLevel = luxuryLevel;
  const theme = cleanText(metadata.vowza_theme, 80);
  if (theme) context.theme = theme;
  const colorPalette = cleanText(metadata.vowza_color_palette, 80);
  if (colorPalette) context.colorPalette = colorPalette;
  const styleVibe = cleanText(metadata.vowza_style_vibe, 20);
  if (styleVibe && ['traditional', 'modern'].includes(styleVibe)) context.styleVibe = styleVibe;
  const foodPreference = cleanText(metadata.vowza_food_preference, 20);
  if (foodPreference && ['veg', 'non-veg', 'both'].includes(foodPreference)) context.foodPreference = foodPreference;
  const serviceStyle = cleanText(metadata.vowza_service_style, 20);
  if (serviceStyle && ['buffet', 'table_service'].includes(serviceStyle)) context.serviceStyle = serviceStyle;
  return context;
}

/** Validate browser-supplied known context before using it to build a recall query. */
export function normalizePlannerMemoryContext(value: unknown): PlannerMemoryContext {
  if (!isRecord(value)) return {};
  const context: PlannerMemoryContext = {};
  const eventId = validEventId(value.eventId);
  if (eventId) context.eventId = eventId;
  const eventLabel = cleanText(value.eventLabel, 100);
  if (eventLabel) context.eventLabel = eventLabel;
  const eventType = cleanText(value.eventType, 40);
  if (eventType && EVENT_TYPES.has(eventType)) context.eventType = eventType;
  const city = cleanText(value.city, 80);
  if (city) context.city = city;
  const locality = cleanText(value.locality, 80);
  if (locality) context.locality = locality;
  const eventDate = cleanText(value.eventDate, 80);
  if (eventDate) context.eventDate = eventDate;
  const guestCount = positiveNumber(value.guestCount, true);
  if (guestCount) context.guestCount = guestCount;
  const budget = positiveNumber(value.budget);
  if (budget) context.budget = budget;
  const durationDays = positiveNumber(value.durationDays, true);
  if (durationDays) context.durationDays = durationDays;
  const luxuryLevel = cleanText(value.luxuryLevel, 20);
  if (luxuryLevel && ['budget', 'standard', 'premium', 'luxury'].includes(luxuryLevel)) context.luxuryLevel = luxuryLevel;
  const theme = cleanText(value.theme, 80);
  if (theme) context.theme = theme;
  const colorPalette = cleanText(value.colorPalette, 80);
  if (colorPalette) context.colorPalette = colorPalette;
  const styleVibe = cleanText(value.styleVibe, 20);
  if (styleVibe && ['traditional', 'modern'].includes(styleVibe)) context.styleVibe = styleVibe;
  const foodPreference = cleanText(value.foodPreference, 20);
  if (foodPreference && ['veg', 'non-veg', 'both'].includes(foodPreference)) context.foodPreference = foodPreference;
  const serviceStyle = cleanText(value.serviceStyle, 20);
  if (serviceStyle && ['buffet', 'table_service'].includes(serviceStyle)) context.serviceStyle = serviceStyle;
  return context;
}

/** Choose the best-ranked Vowza event scope and bounded relevant fact text. */
export function summarizeRecallResults(
  items: MemoryRecallItem[],
  currentContext: PlannerMemoryContext = {},
): {
  context: PlannerMemoryContext;
  memories: string[];
} {
  const relevant = items.filter((item) => typeof item.text === 'string' && item.text.trim());
  const vowzaItems = relevant.filter((item) => item.metadata?.vowza_source === 'planner-event-state');
  const requestedEventId = currentContext.eventId;
  // Event-specific facts are never eligible without a resolved scope. A
  // user-level bank may contain many events, so event type/city matching is
  // only a secondary compatibility check after this identity filter.
  const scopedVowzaItems = requestedEventId
    ? vowzaItems.filter((item) => item.metadata?.vowza_event_id === requestedEventId)
    : [];
  const timestamp = (item: MemoryRecallItem) => {
    const raw = item.metadata?.vowza_updated_at;
    const parsed = typeof raw === 'string' ? Date.parse(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const orderedVowzaItems = [...scopedVowzaItems].sort((a, b) => (timestamp(b) ?? 0) - (timestamp(a) ?? 0));
  const newestVowzaItem = orderedVowzaItems[0];
  const anchorContext = plannerContextFromMetadata(newestVowzaItem?.metadata);
  const anchorIsCompatible = (!currentContext.eventType || !anchorContext.eventType || currentContext.eventType === anchorContext.eventType)
    && (!currentContext.city || !anchorContext.city || currentContext.city.toLowerCase() === anchorContext.city.toLowerCase());
  const scopeEventType = currentContext.eventType ?? (anchorIsCompatible ? anchorContext.eventType : undefined);
  const scopeCity = currentContext.city ?? (anchorIsCompatible ? anchorContext.city : undefined);
  const compatibleItems = orderedVowzaItems.filter((item) => {
    const context = plannerContextFromMetadata(item.metadata);
    return (!scopeEventType || !context.eventType || context.eventType === scopeEventType)
      && (!scopeCity || !context.city || context.city.toLowerCase() === scopeCity.toLowerCase());
  });
  const newestCompatibleItem = compatibleItems[0];
  const newestCompatibleTimestamp = newestCompatibleItem ? timestamp(newestCompatibleItem) : null;
  const latestVowzaItems = newestCompatibleTimestamp === null
    ? compatibleItems.slice(0, 1)
    : compatibleItems.filter((item) => timestamp(item) === newestCompatibleTimestamp);
  const memoryItems = latestVowzaItems.length
    ? latestVowzaItems
    : scopedVowzaItems.length ? [] : [];
  let mergedContext: PlannerMemoryContext = {};
  for (const item of compatibleItems) {
    const snapshotContext = plannerContextFromMetadata(item.metadata);
    mergedContext = { ...snapshotContext, ...mergedContext };
  }
  mergedContext = mergePlannerMemoryContext(mergedContext, currentContext);
  const memories = [...new Set(memoryItems
    .map((item) => cleanText(item.text, 360))
    .filter((text): text is string => Boolean(text)))].slice(0, 5);
  return {
    context: mergedContext,
    memories,
  };
}

/** Current conversation facts always win; mismatched event types suppress old event details. */
export function mergePlannerMemoryContext(
  current: PlannerMemoryContext,
  recalled: PlannerMemoryContext,
): PlannerMemoryContext {
  if (current.eventType && recalled.eventType && current.eventType !== recalled.eventType) {
    return { ...current };
  }
  return { ...recalled, ...current };
}

export function asksAboutPlannerMemory(message: string): boolean {
  return /\b(?:what|which|do)\s+(?:do\s+)?(?:you\s+)?(?:remember|recall|know)\b|\bremind\s+me\s+(?:what|of|about)\b|\bwhat\s+have\s+i\s+told\s+you\s+about\b/i.test(message);
}

/** Recall for explicit memory questions or planning turns missing core event context. */
export function shouldRecallPlannerMemory(
  message: string,
  intent: string,
  context: PlannerMemoryContext,
): boolean {
  if (asksAboutPlannerMemory(message)) return true;
  const planningIntents = new Set([
    'find_vendors', 'comparison', 'plan_event', 'budget_breakdown', 'timeline',
    'checklist', 'food_plan', 'weather_advice', 'risk_analysis', 'negotiation',
  ]);
  if (!planningIntents.has(intent)) return false;
  return !(context.eventType && context.city && context.guestCount && context.budget);
}

function explicitFieldMention(field: string, userMessage: string): boolean {
  const text = userMessage.trim();
  switch (field) {
    case 'eventType':
      return /\b(wedding|marriage|reception|engagement|haldi|mehendi|mehndi|sangeet|birthday|baby shower|housewarming|gruhapravesam|anniversary|corporate event|conference|product launch|exhibition|college fest|concert|festival|private party|pooja|puja)\b/i.test(text);
    case 'location.city':
      return KNOWN_CITIES.some((city) => new RegExp(`\\b${city}\\b`, 'i').test(text))
        || /\bin\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/.test(text);
    case 'location.area':
      return /\b(?:near|area|locality|in)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/.test(text);
    case 'schedule.eventDate':
      return /\b(?:date|on|by|during|in)\s+(?:\d{1,2}[/-]\d{1,2}|\d{4}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|next\s+month|next\s+year)\b/i.test(text)
        || /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(text)
        || /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(text)
        || /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/i.test(text);
    case 'schedule.durationDays':
      return /\b\d+\s*[- ]?days?\b/i.test(text);
    case 'guests.count':
      return /\b(?:\d[\d,]*\s*(?:guests?|people|attendees?)|(?:guests?|people|attendees?)\s*(?:about|around|approximately|of)?\s*\d[\d,]*)\b/i.test(text);
    case 'budget.total':
      return /(?:₹|\b(?:rs\.?|inr|budget|spend|cost)\b|\b\d+(?:\.\d+)?\s*(?:lakh|lac|crore|cr|k)\b)/i.test(text);
    case 'requirements.serviceBudgets':
      return /\b(?:photograph|cater|decorat|dj|makeup|videograph|venue|budget|spend|cost|price)\w*\b/i.test(text);
    case 'budget.luxuryLevel':
      return /\b(?:budget[- ]friendly|standard|premium|luxury|high[- ]end|economical)\b/i.test(text);
    case 'style.theme':
      return /\b(?:theme|style|vibe|traditional|modern|rustic|minimalist|boho)\b/i.test(text);
    case 'style.colorPalette':
      return /\b(?:color|colour|palette|colors|colours)\b/i.test(text);
    case 'style.vibe':
      return /\b(?:traditional|modern)\b/i.test(text);
    case 'style.foodPreference':
      return /\b(?:veg|vegetarian|non[- ]?veg|both|food preference|cuisine)\b/i.test(text);
    case 'style.serviceStyle':
      return /\b(?:buffet|table service|service style)\b/i.test(text);
    default:
      return false;
  }
}

/** Build a minimal event snapshot only when this turn explicitly states a durable field. */
export function buildRetentionRecord(
  stateInput: unknown,
  changedFields: string[],
  userMessage: string,
  conversationId: string,
): MemoryRetentionRecord | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) return null;
  const hasExplicitMeaningfulChange = changedFields.some(
    (field) => ALLOWED_RETENTION_FIELDS.has(field) && explicitFieldMention(field, userMessage),
  );
  if (!hasExplicitMeaningfulChange || !isRecord(stateInput)) return null;

  const state = stateInput as EventStateSnapshot;
  const context: PlannerMemoryContext = {};
  const eventId = validEventId(state.eventId);
  if (!eventId) return null;
  context.eventId = eventId;
  const eventLabel = cleanText(state.eventLabel, 100);
  if (eventLabel) context.eventLabel = eventLabel;
  const eventType = cleanText(state.eventType, 40);
  if (eventType && EVENT_TYPES.has(eventType)) context.eventType = eventType;
  const location = isRecord(state.location) ? state.location : {};
  const city = cleanText(location.city, 80);
  if (city) context.city = city;
  const area = cleanText(location.area, 80);
  if (area) context.locality = area;
  const schedule = isRecord(state.schedule) ? state.schedule : {};
  const eventDate = cleanText(schedule.eventDate, 80);
  if (eventDate) context.eventDate = eventDate;
  const durationDays = positiveNumber(schedule.durationDays, true);
  if (durationDays) context.durationDays = durationDays;
  const guests = isRecord(state.guests) ? state.guests : {};
  const guestCount = positiveNumber(guests.count, true);
  if (guestCount) context.guestCount = guestCount;
  const budgetState = isRecord(state.budget) ? state.budget : {};
  const budget = positiveNumber(budgetState.total);
  if (budget) context.budget = budget;
  const luxuryLevel = cleanText(budgetState.luxuryLevel, 20);
  if (luxuryLevel && ['budget', 'standard', 'premium', 'luxury'].includes(luxuryLevel)) context.luxuryLevel = luxuryLevel;
  const style = isRecord(state.style) ? state.style : {};
  const theme = cleanText(style.theme, 80);
  if (theme) context.theme = theme;
  const colorPalette = cleanText(style.colorPalette, 80);
  if (colorPalette) context.colorPalette = colorPalette;
  const styleVibe = cleanText(style.vibe, 20);
  if (styleVibe && ['traditional', 'modern'].includes(styleVibe)) context.styleVibe = styleVibe;
  const foodPreference = cleanText(style.foodPreference, 20);
  if (foodPreference && ['veg', 'non-veg', 'both'].includes(foodPreference)) context.foodPreference = foodPreference;
  const serviceStyle = cleanText(style.serviceStyle, 20);
  if (serviceStyle && ['buffet', 'table_service'].includes(serviceStyle)) context.serviceStyle = serviceStyle;
  const requirements = isRecord(state.requirements) ? state.requirements : {};
  if (Array.isArray(state.requestedServices)) {
    context.requestedServices = state.requestedServices.filter((value): value is string => typeof value === 'string').slice(0, 20);
  }
  if (isRecord(requirements.serviceBudgets)) {
    const budgets = Object.fromEntries(Object.entries(requirements.serviceBudgets)
      .filter(([key, value]) => /^[a-z][a-z0-9_ -]{1,60}$/i.test(key) && positiveNumber(value))
      .map(([key, value]) => [key, positiveNumber(value)!]));
    if (Object.keys(budgets).length) context.serviceBudgets = budgets;
  }

  const lines = [
    context.eventId && `Event scope: ${context.eventId}.`,
    context.eventLabel && `Event label: ${context.eventLabel}.`,
    context.eventType && `Event type: ${context.eventType}.`,
    city && `Event city: ${city}.`,
    area && `Event area: ${area}.`,
    context.eventDate && `Event date: ${context.eventDate}.`,
    context.durationDays && `Event duration: ${context.durationDays} days.`,
    context.guestCount && `Expected guest count: ${context.guestCount}.`,
    context.budget && `Current total event budget: INR ${context.budget}.`,
    context.luxuryLevel && `Planning budget tier: ${context.luxuryLevel}.`,
    context.theme && `Event theme: ${context.theme}.`,
    context.colorPalette && `Preferred colors: ${context.colorPalette}.`,
    context.styleVibe && `Preferred style: ${context.styleVibe}.`,
    context.foodPreference && `Food preference: ${context.foodPreference}.`,
    context.serviceStyle && `Preferred food service: ${context.serviceStyle}.`,
    context.serviceBudgets && `Confirmed service budgets: ${Object.entries(context.serviceBudgets).map(([service, amount]) => `${service} INR ${amount}`).join('; ')}.`,
    context.requestedServices?.length && `Discussed services: ${context.requestedServices.join(', ')}.`,
  ].filter((line): line is string => Boolean(line));
  if (!lines.length) return null;

  const timestampCandidate = cleanText(state.updatedAt, 40);
  const timestamp = timestampCandidate && !Number.isNaN(Date.parse(timestampCandidate))
    ? new Date(timestampCandidate).toISOString()
    : new Date().toISOString();
  const metadata: Record<string, string> = {
    vowza_source: 'planner-event-state',
    vowza_event_id: context.eventId!,
    vowza_conversation_id: conversationId,
    vowza_updated_at: timestamp,
  };
  if (context.eventLabel) metadata.vowza_event_label = context.eventLabel;
  if (context.eventType) metadata.vowza_event_type = context.eventType;
  if (city) metadata.vowza_city = city;
  if (area) metadata.vowza_area = area;
  if (context.eventDate) metadata.vowza_event_date = context.eventDate;
  if (context.guestCount) metadata.vowza_guest_count = String(context.guestCount);
  if (context.budget) metadata.vowza_budget_inr = String(context.budget);
  if (context.durationDays) metadata.vowza_duration_days = String(context.durationDays);
  if (context.luxuryLevel) metadata.vowza_luxury_level = context.luxuryLevel;
  if (context.theme) metadata.vowza_theme = context.theme;
  if (context.colorPalette) metadata.vowza_color_palette = context.colorPalette;
  if (context.styleVibe) metadata.vowza_style_vibe = context.styleVibe;
  if (context.foodPreference) metadata.vowza_food_preference = context.foodPreference;
  if (context.serviceStyle) metadata.vowza_service_style = context.serviceStyle;
  if (context.serviceBudgets) metadata.vowza_service_budgets = JSON.stringify(context.serviceBudgets);
  if (context.requestedServices?.length) metadata.vowza_requested_services = JSON.stringify(context.requestedServices);

  return {
    content: `Current user-provided event planning context. Newer explicit user corrections supersede older values. ${lines.join(' ')}`,
    context: 'Vowza AI Planner event planning',
    timestamp,
    documentId: `${context.eventId}:${conversationId}`,
    tags: ['vowza-planner', `vowza-event-${context.eventId}`],
    metadata,
  };
}

/** Summarize context fields without exposing memory-bank identifiers or user data. */
export function plannerContextForDisplay(context: PlannerMemoryContext): string[] {
  const lines = [
    context.eventType && `Event: ${context.eventType}`,
    context.city && `City: ${context.city}`,
    context.eventDate && `Date: ${context.eventDate}`,
    context.guestCount && `Guests: ${context.guestCount}`,
    context.budget && `Budget: INR ${new Intl.NumberFormat('en-IN').format(context.budget)}`,
    context.theme && `Theme: ${context.theme}`,
    context.colorPalette && `Colors: ${context.colorPalette}`,
    context.styleVibe && `Style: ${context.styleVibe}`,
    context.foodPreference && `Food preference: ${context.foodPreference}`,
  ].filter((line): line is string => Boolean(line));
  return lines;
}
