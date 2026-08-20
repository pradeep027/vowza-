// ─── Event Context Capturer ───────────────────────────────────────────────────
// Manages structured event context capture, readiness calculation, and
// intelligent question sequencing.
//
// Purpose: Ensure AI captures minimum required fields before planning:
// 1. Event type (wedding, corporate, birthday, etc.)
// 2. Location/City
// 3. Guest count
// 4. Budget
//
// Then optional: date, style, preferences, priority services

import type { PlannerContext } from './aiPlannerTypes';

// ─── Context Question Definition ───────────────────────────────────────────
export interface ContextQuestion {
  field: keyof PlannerContext;
  question: string;
  priority: 'essential' | 'optional';
  validator?: (value: any) => boolean;
  examples?: string[];
}

// ─── Essential questions (must have for planning) ────────────────────────────
export const CONTEXT_QUESTIONS: ContextQuestion[] = [
  {
    field: 'eventType',
    question: '🎉 What type of event are you planning?',
    priority: 'essential',
    examples: ['wedding', 'corporate event', 'birthday party', 'engagement', 'anniversary', 'gruhapravesam'],
    validator: (v) => !!v && typeof v === 'string' && v.length > 0,
  },
  {
    field: 'city',
    question: '📍 Which city is the event in?',
    priority: 'essential',
    examples: ['Hyderabad', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai'],
    validator: (v) => !!v && typeof v === 'string' && v.length > 0,
  },
  {
    field: 'budget',
    question: '💰 What is your total budget? (in ₹)',
    priority: 'essential',
    examples: ['₹1 lakh', '₹5 lakhs', '₹10 lakhs', '10,00,000'],
    validator: (v) => typeof v === 'number' && v > 0,
  },
  {
    field: 'guestCount',
    question: '👥 Approximately how many guests?',
    priority: 'essential',
    examples: ['50', '200', '300', '500'],
    validator: (v) => typeof v === 'number' && v > 0 && v <= 100000,
  },
  {
    field: 'date',
    question: '📅 When is the event planned? (optional)',
    priority: 'optional',
    examples: ['August 15', '2 months from now', 'next month'],
    validator: (v) => !v || (typeof v === 'string' && v.length > 0),
  },
  {
    field: 'style',
    question: '✨ What style do you prefer? (optional)',
    priority: 'optional',
    examples: ['traditional', 'modern', 'luxury', 'simple', 'theme-based'],
    validator: (v) => !v || (typeof v === 'string' && v.length > 0),
  },
];

// ─── Get all essential questions ───────────────────────────────────────────
export function getEssentialQuestions(): ContextQuestion[] {
  return CONTEXT_QUESTIONS.filter(q => q.priority === 'essential');
}

// ─── Get missing essential fields ──────────────────────────────────────────
export function getMissingEssentialFields(context: PlannerContext): ContextQuestion[] {
  return getEssentialQuestions().filter(q => {
    const value = context[q.field];
    // Consider missing if: undefined, null, empty string, zero
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'number' && value === 0) return true;
    return false;
  });
}

// ─── Calculate planning readiness (0-100%) ─────────────────────────────────
export interface ReadinessResult {
  readiness: number;           // 0-100%
  missingEssentials: string[]; // Field names still needed
  isSufficient: boolean;       // true if >= 100% (all essentials filled)
  nextQuestion?: ContextQuestion; // Suggested next question to ask
}

export function calculateContextReadiness(context: PlannerContext): ReadinessResult {
  const essentials = getEssentialQuestions();
  const missing = getMissingEssentialFields(context);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // [TRACE 2-DETAIL] Log readiness calculation in detail
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[TRACE 2-DETAIL - getMissingEssentialFields]', {
    contextEventType: context.eventType,
    contextGuestCount: context.guestCount,
    contextCity: context.city,
    contextBudget: context.budget,
    essentialsCount: essentials.length,
    essentialsFields: essentials.map(e => e.field),
    missingCount: missing.length,
    missingFields: missing.map(m => m.field),
    timestamp: new Date().toISOString(),
  });
  
  const filled = essentials.length - missing.length;
  const readiness = Math.round((filled / essentials.length) * 100);
  
  // Each essential = 25% (4 essentials total)
  const isSufficient = readiness >= 100;
  
  const nextQuestion = missing.length > 0 ? missing[0] : undefined;
  
  console.log('[TRACE 2-DETAIL - Calculation Result]', {
    essentialsCount: essentials.length,
    filledCount: filled,
    missingCount: missing.length,
    readinessScore: readiness,
    isSufficient,
    nextQuestionField: nextQuestion?.field,
    timestamp: new Date().toISOString(),
  });
  
  return {
    readiness,
    missingEssentials: missing.map(q => q.field),
    isSufficient,
    nextQuestion,
  };
}

// ─── Get the next question to ask (soft follow-up) ────────────────────────
export function getNextContextQuestion(context: PlannerContext): ContextQuestion | null {
  const readiness = calculateContextReadiness(context);
  
  if (readiness.nextQuestion) {
    return readiness.nextQuestion;
  }
  
  // All essentials filled — suggest optional
  const optionalQuestions = CONTEXT_QUESTIONS.filter(q => q.priority === 'optional');
  const missing = optionalQuestions.filter(q => !context[q.field]);
  
  return missing.length > 0 ? missing[0] : null;
}

// ─── Format a question for display ─────────────────────────────────────────
export function formatContextQuestion(question: ContextQuestion, context: PlannerContext): string {
  const filled = Object.keys(context).filter(k => context[k as keyof PlannerContext]).length;
  const total = getEssentialQuestions().length;
  
  let response = `**${question.question}**\n\n`;
  
  // Show context already captured
  const captured = [];
  if (context.eventType) captured.push(`🎉 ${context.eventType}`);
  if (context.city) captured.push(`📍 ${context.city}`);
  if (context.budget) captured.push(`💰 ₹${(context.budget / 100000).toFixed(1)}L`);
  if (context.guestCount) captured.push(`👥 ${context.guestCount} guests`);
  
  if (captured.length > 0) {
    response += `**Current plan:** ${captured.join(' · ')}\n\n`;
  }
  
  // Show progress
  response += `**Progress:** ${filled}/${total} essentials\n\n`;
  
  // Show examples
  if (question.examples && question.examples.length > 0) {
    response += `Examples: ${question.examples.map(e => `_${e}_`).join(', ')}\n`;
  }
  
  return response;
}

// ─── Validate context field ───────────────────────────────────────────────
export function validateContextField(
  field: keyof PlannerContext,
  value: any
): { valid: boolean; error?: string } {
  const question = CONTEXT_QUESTIONS.find(q => q.field === field);
  
  if (!question) {
    return { valid: false, error: `Unknown context field: ${field}` };
  }
  
  if (question.validator) {
    const isValid = question.validator(value);
    if (!isValid) {
      return {
        valid: false,
        error: `Invalid value for ${field}: ${value}. Examples: ${question.examples?.join(', ')}`,
      };
    }
  }
  
  return { valid: true };
}

// ─── Merge new context into existing ──────────────────────────────────────
export function mergeContext(
  current: PlannerContext,
  updates: Partial<PlannerContext>
): { merged: PlannerContext; changes: string[] } {
  const changes: string[] = [];
  const merged = { ...current };
  
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) continue;
    
    const field = key as keyof PlannerContext;
    const validation = validateContextField(field, value);
    
    if (!validation.valid) {
      console.warn(`[Context] Invalid update: ${validation.error}`);
      continue;
    }
    
    if (current[field] !== value) {
      merged[field] = value;
      changes.push(`${field}: ${current[field] ?? '(empty)'} → ${value}`);
    }
  }
  
  return { merged, changes };
}

// ─── Extract budget from user text ────────────────────────────────────────
export function extractBudgetFromText(text: string): number | null {
  // Match patterns like: ₹5 lakh, 5 lakhs, 5,00,000, 500000, etc.
  const patterns = [
    /₹\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:lakh|lac|l)?/i,
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:lakh|lac|l)/i,
    /(?:budget|budget.*?)[:\s]+₹?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1].replace(/,/g, '');
      const num = parseFloat(numStr);
      
      // If it's a "lakh" amount, multiply by 100,000
      if (text.match(/lakh|lac|l/i)) {
        return num * 100000;
      }
      
      // If it's a reasonable budget (₹1K - ₹100L)
      if (num >= 1000 && num <= 10000000) {
        return num;
      }
    }
  }
  
  return null;
}

// ─── Extract guest count from user text ──────────────────────────────────
export function extractGuestCountFromText(text: string): number | null {
  const patterns = [
    /(\d+)\s*(?:guests?|people|attendees)/i,
    /(?:for|with)\s*(\d+)\s*(?:people|guests)/i,
    /(\d+)\s*(?:-\s*)?(?:people|guests|attendees|people)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num <= 100000) {
        return num;
      }
    }
  }
  
  return null;
}

// ─── Extract city from user text ────────────────────────────────────────
export function extractCityFromText(text: string): string | null {
  // Common Indian cities
  const cities = [
    'Hyderabad', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata',
    'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Chandigarh', 'Indore',
    'Surat', 'Nagpur', 'Coimbatore', 'Kochi', 'Visakhapatnam', 'Varanasi',
    'Guwahati', 'Patna', 'Vadodara', 'Goa', 'Bhopal', 'Agra',
  ];
  
  const textLower = text.toLowerCase();
  
  for (const city of cities) {
    if (textLower.includes(city.toLowerCase())) {
      return city;
    }
  }
  
  return null;
}

// ─── Extract event type from user text ──────────────────────────────────
export function extractEventTypeFromText(text: string): string | null {
  const eventPatterns: { [key: string]: RegExp } = {
    'wedding': /wedding|shaadi|vivah|marriage|bride|groom|nikah/i,
    'corporate event': /corporate|conference|summit|seminar|team.*?outing|office.*?party|business.*?event|launch/i,
    'birthday': /birthday|bday|cake.*?cutting|turning (\d+)/i,
    'haldi': /\bhaldi\b/i,
    'mehendi': /\bmehendi\b|\bmehndi\b/i,
    'sangeet': /\bsangeet\b/i,
    'engagement': /\bengagement\b|\broka\b|\bsagan\b/i,
    'anniversary': /anniversary|aniversary|silver.*?jubilee|golden.*?jubilee/i,
    'gruhapravesam': /gruhapravesam|gruhapravesh|house.*?warming|housewarming/i,
    'baby shower': /baby.*?shower|expecting|maternity|mom.*?to.*?be/i,
    'retirement': /retirement|farewell|send.*?off/i,
    'party': /party|celebration|get.*?together|gathering/i,
  };
  
  for (const [eventType, pattern] of Object.entries(eventPatterns)) {
    if (pattern.test(text)) {
      return eventType;
    }
  }
  
  return null;
}

// ─── Extract style/theme from user text ────────────────────────────────
export function extractStyleFromText(text: string): string | null {
  const stylePatterns: { [key: string]: RegExp } = {
    'traditional': /traditional|cultural|ethnic|desi|indian|classical/i,
    'modern': /modern|contemporary|minimalist|sleek|chic|trendy/i,
    'luxury': /luxury|luxe|premium|high.*?end|extravagant|grand|lavish/i,
    'simple': /simple|casual|modest|minimal|budget.*?friendly|economical/i,
    'rustic': /rustic|vintage|boho|bohemian|earthy|nature|outdoor/i,
    'theme-based': /theme|themed|circus|retro|gothic|masquerade/i,
  };
  
  for (const [style, pattern] of Object.entries(stylePatterns)) {
    if (pattern.test(text)) {
      return style;
    }
  }
  
  return null;
}

// ─── Extract required services from user text ───────────────────────────
export function extractRequiredServicesFromText(text: string): string[] {
  const servicePatterns: { [key: string]: RegExp } = {
    'photography': /photography|photographer|photos|pictures|video|videographer|video.*?graphy|shoot/i,
    'catering': /catering|food|menu|cuisine|vegetarian|non-vegetarian|buffet|meals|snacks|dinner|lunch/i,
    'decoration': /decoration|decor|flowers|floral|setup|themes|lighting|stage/i,
    'dj': /dj|music|dance|songs|playlist|live.*?music|orchestra/i,
    'makeup': /makeup|makeup artist|beauty|bridal|facial|hair/i,
    'venue': /venue|location|halls|banquet|hotel|resort|farm|lawn/i,
    'invitations': /invitation|cards|printing|stationery/i,
    'entertainment': /entertainment|artist|performer|band|live|singer|dancers|comedy/i,
  };
  
  const services: string[] = [];
  
  for (const [service, pattern] of Object.entries(servicePatterns)) {
    if (pattern.test(text)) {
      services.push(service);
    }
  }
  
  return services;
}

// ─── Extract priority services from user text ──────────────────────────
export function extractPriorityServicesFromText(text: string): string[] {
  const patterns = [
    /important.*?:?\s*([^.]+)/gi,
    /priority.*?:?\s*([^.]+)/gi,
    /focus.*?on.*?:?\s*([^.]+)/gi,
    /most important.*?:?\s*([^.]+)/gi,
  ];
  
  const priorityText: string[] = [];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      priorityText.push(match[1]);
    }
  }
  
  const priorities: string[] = [];
  
  for (const text of priorityText) {
    const services = extractRequiredServicesFromText(text);
    priorities.push(...services);
  }
  
  return [...new Set(priorities)]; // Dedupe
}

// ─── Calculate percent confidence in extracted field ────────────────────
export function getExtractionConfidence(
  field: keyof PlannerContext,
  value: any,
  sourceText: string
): number {
  if (!value) return 0;
  
  // Explicit mentions have high confidence
  if (field === 'eventType' && sourceText.includes(value)) return 0.95;
  if (field === 'city' && sourceText.includes(value)) return 0.95;
  if (field === 'budget' && sourceText.match(/lakh|lac|₹|\d+,\d+,\d+/)) return 0.9;
  if (field === 'guestCount' && sourceText.match(/\d+\s*(?:guests?|people)/)) return 0.9;
  
  // Contextual inference has medium confidence
  return 0.6;
}



// ─── Event Date Extraction (NEW Phase 7B) ──────────────────────────────────
/**
 * Extract event date from user message
 * Supports multiple formats:
 * - Absolute dates: "June 15", "15-06-2026", "June 15 2026"
 * - Relative dates: "2 weeks from now", "next month", "in 30 days"
 * - Fuzzy dates: "summer 2026", "winter", "monsoon season"
 * - Days of week: "next Saturday", "this Friday"
 */
export function extractEventDateFromText(text: string): Date | null {
  if (!text || typeof text !== 'string') return null;

  const now = new Date();
  const msg = text.toLowerCase().trim();

  // Pattern 1: Relative days ("2 weeks from now", "in 30 days", "next month")
  const relativePattern = /(?:in|within|about|around|roughly)\s+(\d+)\s+(days?|weeks?|months?|years?)/i;
  const relativeMatch = msg.match(relativePattern);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const result = new Date(now);
    
    if (unit.startsWith('day')) result.setDate(result.getDate() + value);
    else if (unit.startsWith('week')) result.setDate(result.getDate() + value * 7);
    else if (unit.startsWith('month')) result.setMonth(result.getMonth() + value);
    else if (unit.startsWith('year')) result.setFullYear(result.getFullYear() + value);
    
    return result;
  }

  // Pattern 2: "next month", "this month", "next week"
  if (/^(next|this)\s+(month|week|year)$/i.test(msg)) {
    const result = new Date(now);
    if (msg.includes('next month')) result.setMonth(result.getMonth() + 1);
    else if (msg.includes('next week')) result.setDate(result.getDate() + 7);
    else if (msg.includes('next year')) result.setFullYear(result.getFullYear() + 1);
    return result;
  }

  // Pattern 3: Days of week ("next Saturday", "this Friday")
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayPattern = new RegExp(`(next|this|this coming)\\s+(${daysOfWeek.join('|')})`, 'i');
  const dayMatch = msg.match(dayPattern);
  if (dayMatch) {
    const targetDay = daysOfWeek.indexOf(dayMatch[2].toLowerCase());
    const result = new Date(now);
    const currentDay = result.getDay();
    let daysAhead = targetDay - currentDay;
    
    if (dayMatch[1].toLowerCase() === 'next') {
      if (daysAhead <= 0) daysAhead += 7;
    } else {
      // "this Friday"
      if (daysAhead <= 0) daysAhead = 0; // If today is Friday and they say "this Friday", use today
      if (daysAhead === 0 && targetDay === currentDay) daysAhead = 0;
    }
    
    result.setDate(result.getDate() + daysAhead);
    return result;
  }

  // Pattern 4: Absolute dates (Multiple formats)
  // Format: "June 15", "June 15 2026", "15-06-2026", "15/06/2026", "15.06.2026"
  const months = ['january', 'february', 'march', 'april', 'may', 'june',
                   'july', 'august', 'september', 'october', 'november', 'december'];
  const monthPattern = `(${months.join('|')})`;
  
  // "June 15" or "June 15 2026"
  const monthDayPattern = new RegExp(`${monthPattern}\\s+(\\d{1,2})(?:\\s+(\\d{4}))?`, 'i');
  const monthDayMatch = msg.match(monthDayPattern);
  if (monthDayMatch) {
    const month = months.indexOf(monthDayMatch[1].toLowerCase());
    const day = parseInt(monthDayMatch[2]);
    const year = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : now.getFullYear();
    
    const result = new Date(year, month, day);
    // If the constructed date is in the past, assume next year
    if (result < now) {
      result.setFullYear(year + 1);
    }
    return result;
  }

  // "15 June" or "15 June 2026"
  const dayMonthPattern = new RegExp(`(\\d{1,2})\\s+${monthPattern}(?:\\s+(\\d{4}))?`, 'i');
  const dayMonthMatch = msg.match(dayMonthPattern);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1]);
    const month = months.indexOf(dayMonthMatch[2].toLowerCase());
    const year = dayMonthMatch[3] ? parseInt(dayMonthMatch[3]) : now.getFullYear();
    
    const result = new Date(year, month, day);
    if (result < now) {
      result.setFullYear(year + 1);
    }
    return result;
  }

  // Numeric formats: "15-06-2026", "15/06/2026", "06/15/2026"
  const numericPattern = /(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/;
  const numericMatch = msg.match(numericPattern);
  if (numericMatch) {
    const part1 = parseInt(numericMatch[1]);
    const part2 = parseInt(numericMatch[2]);
    const year = parseInt(numericMatch[3]);
    
    // Try DD-MM-YYYY first (common in India)
    let month = part2 - 1;
    let day = part1;
    
    if (month > 11) {
      // If month > 11, try MM-DD-YYYY format
      month = part1 - 1;
      day = part2;
    }
    
    if (day > 31) {
      // If day > 31, swap
      [day, month] = [month + 1, day - 1];
    }
    
    const result = new Date(year, month, day);
    return result;
  }

  // Pattern 5: Season/Month names ("August", "summer", "monsoon")
  const monthMatch = msg.match(new RegExp(monthPattern, 'i'));
  if (monthMatch) {
    const month = months.indexOf(monthMatch[0].toLowerCase());
    const result = new Date(now.getFullYear(), month, 1);
    
    // If the month is in the past, move to next year
    if (result < now) {
      result.setFullYear(now.getFullYear() + 1);
    }
    
    return result;
  }

  // Pattern 6: Seasons
  const seasonMap: Record<string, number> = {
    'summer': 5, // June
    'monsoon': 6, // July
    'autumn': 8, // September
    'fall': 8,
    'winter': 11, // December
    'spring': 2, // March
  };

  for (const [season, month] of Object.entries(seasonMap)) {
    if (msg.includes(season)) {
      const result = new Date(now.getFullYear(), month, 1);
      if (result < now) {
        result.setFullYear(now.getFullYear() + 1);
      }
      return result;
    }
  }

  return null;
}

/**
 * Format event date for display
 * Returns human-readable format like "June 15, 2026" or "in 30 days"
 */
export function formatEventDate(date: Date): string {
  if (!date) return 'TBD';

  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
  
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  // Calculate days from now
  const diff = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff <= 30) return `in ${diff} days`;
  if (diff > 30 && diff <= 60) return `in ${Math.round(diff / 7)} weeks`;

  return `${month} ${day}, ${year}`;
}

/**
 * Check vendor availability on event date
 * Returns: 'available' | 'unavailable' | 'not_checked'
 */
export function checkDateAvailability(
  vendorId: string,
  eventDate: Date | null,
  unavailableDates: Array<{ date: string; reason: string }>
): 'available' | 'unavailable' | 'not_checked' {
  if (!eventDate || !vendorId) return 'not_checked';

  const eventDateStr = eventDate.toISOString().split('T')[0]; // "2026-06-15"

  for (const unavailable of unavailableDates) {
    if (unavailable.date === eventDateStr) {
      return 'unavailable';
    }
  }

  return 'available';
}


// ─── Dietary Preferences Extraction (NEW Phase 7C) ────────────────────────
/**
 * Extract dietary preferences from user message
 * Supports:
 * - Vegetarian: "veg", "vegetarian"
 * - Non-veg: "non-veg", "non-vegetarian", "meat"
 * - Vegan: "vegan"
 * - Gluten-free: "gluten-free", "gluten free"
 * - Dairy-free: "dairy-free", "lactose"
 * - Halal: "halal"
 * - Kosher: "kosher"
 * - Jain: "jain"
 * - Both: "both veg and non-veg", "mixed"
 */
export type DietaryPreference = 
  | 'vegetarian'
  | 'non-veg'
  | 'vegan'
  | 'gluten-free'
  | 'dairy-free'
  | 'halal'
  | 'kosher'
  | 'jain'
  | 'both';

export function extractDietaryPreferencesFromText(text: string): DietaryPreference[] {
  if (!text || typeof text !== 'string') return [];

  const msg = text.toLowerCase().trim();
  const preferences: Set<DietaryPreference> = new Set();

  // Both veg and non-veg (must check before individual veg/non-veg)
  if (/both\s+(?:veg|non[\s-]?veg|vegetarian|meat)|(?:veg|non[\s-]?veg).*and.*(?:veg|non[\s-]?veg)|mix(?:ed)?.*(?:veg|non[\s-]?veg)|flexible.*diet/i.test(msg)) {
    preferences.add('both');
    return Array.from(preferences);
  }

  // Vegetarian
  if (/\bveg(?:etarian)?\b|vegetarian|no\s+meat|no\s+non[\s-]?veg/i.test(msg)) {
    preferences.add('vegetarian');
  }

  // Non-veg
  if (/\bnon[\s-]?veg(?:etarian)?\b|non-vegetarian|meat|chicken|fish|mutton|lamb/i.test(msg)) {
    preferences.add('non-veg');
  }

  // Vegan
  if (/\bvegan\b|no\s+dairy|no\s+eggs|plant[\s-]?based/i.test(msg)) {
    preferences.add('vegan');
  }

  // Gluten-free
  if (/gluten[\s-]?free|celiac|coeliac/i.test(msg)) {
    preferences.add('gluten-free');
  }

  // Dairy-free
  if (/dairy[\s-]?free|lactose[\s-]?(?:free|intolerant)|no\s+dairy|no\s+milk/i.test(msg)) {
    preferences.add('dairy-free');
  }

  // Halal
  if (/\bhalal\b/i.test(msg)) {
    preferences.add('halal');
  }

  // Kosher
  if (/\bkosher\b/i.test(msg)) {
    preferences.add('kosher');
  }

  // Jain
  if (/\bjain\b|jain\s+diet/i.test(msg)) {
    preferences.add('jain');
  }

  return Array.from(preferences);
}

/**
 * Check if menu item matches dietary preferences
 * @param menuItem Menu item with category/tags
 * @param preferences User's dietary preferences
 * @returns true if menu item is suitable
 */
export function isMenuItemSuitableForDiet(
  menuItem: any,
  preferences: DietaryPreference[]
): boolean {
  if (!preferences || preferences.length === 0) return true;

  const itemTags = (menuItem.tags || []).map((t: string) => t.toLowerCase());
  const itemCat = (menuItem.category || '').toLowerCase();
  const itemDesc = (menuItem.description || '').toLowerCase();
  const itemName = (menuItem.name || '').toLowerCase();

  for (const pref of preferences) {
    switch (pref) {
      case 'vegetarian':
        // Exclude non-veg items
        if (/meat|chicken|fish|mutton|lamb|beef|pork|shrimp|prawn|non[\s-]?veg|egg|seafood/i.test(itemName + itemDesc + itemCat)) {
          return false;
        }
        if (itemTags.includes('non-veg') || itemTags.includes('meat')) {
          return false;
        }
        break;

      case 'non-veg':
        // Non-veg preference is usually inclusive, but if mixed, needs meat
        // This is less restrictive, so we skip explicit rejection
        break;

      case 'vegan':
        // Exclude dairy, eggs, meat
        if (/dairy|milk|cheese|yogurt|butter|cream|egg|meat|fish|honey|non[\s-]?veg/i.test(itemName + itemDesc)) {
          return false;
        }
        if (itemTags.includes('dairy') || itemTags.includes('eggs') || itemTags.includes('meat')) {
          return false;
        }
        break;

      case 'gluten-free':
        // Exclude items with wheat, bread, pasta unless marked gluten-free
        if (/wheat|bread|pasta|noodles|flour|gluten|maida/i.test(itemName + itemDesc)) {
          if (!itemTags.includes('gluten-free')) {
            return false;
          }
        }
        if (itemTags.includes('contains-gluten')) {
          return false;
        }
        break;

      case 'dairy-free':
        // Exclude dairy products
        if (/dairy|milk|cheese|yogurt|butter|cream|paneer|ghee|lactose/i.test(itemName + itemDesc)) {
          if (!itemTags.includes('dairy-free')) {
            return false;
          }
        }
        if (itemTags.includes('dairy')) {
          return false;
        }
        break;

      case 'halal':
        // Check if item is halal or non-halal
        if (itemTags.includes('non-halal')) {
          return false;
        }
        // If not explicitly tagged, assume acceptable (most Indian food is halal-compatible)
        break;

      case 'kosher':
        // Check if item is kosher
        if (itemTags.includes('non-kosher')) {
          return false;
        }
        break;

      case 'jain':
        // Jain diet: no root vegetables, no meat, no dairy typically
        if (/onion|garlic|potato|carrot|radish|meat|fish|dairy|milk|egg|honey/i.test(itemName + itemDesc)) {
          if (!itemTags.includes('jain')) {
            return false;
          }
        }
        break;

      case 'both':
        // Accept both veg and non-veg
        break;
    }
  }

  return true;
}

/**
 * Filter caterers by dietary preference support
 * @param vendors Caterer vendors
 * @param preferences User dietary preferences
 * @returns Caterers that support the preferences
 */
export function filterCaterersByDietaryPreferences(
  vendors: any[],
  preferences: DietaryPreference[]
): any[] {
  if (!preferences || preferences.length === 0) return vendors;

  return vendors.filter(vendor => {
    // Check if vendor has menu data
    if (!vendor.menu_items || vendor.menu_items.length === 0) {
      // If no menu data, can't filter, so include anyway
      return true;
    }

    // Check if vendor has at least one suitable menu item
    const hasSuitableItem = vendor.menu_items.some((item: any) =>
      isMenuItemSuitableForDiet(item, preferences)
    );

    return hasSuitableItem;
  });
}

/**
 * Get dietary preference badge/tag for display
 */
export function getDietaryPreferenceBadge(preference: DietaryPreference): string {
  const badges: Record<DietaryPreference, string> = {
    'vegetarian': '🥬 Vegetarian',
    'non-veg': '🍗 Non-Veg',
    'vegan': '🌱 Vegan',
    'gluten-free': '🚫 Gluten-Free',
    'dairy-free': '🥛 Dairy-Free',
    'halal': '☪️ Halal',
    'kosher': '✡️ Kosher',
    'jain': '🙏 Jain',
    'both': '🍽️ Mixed Menu',
  };
  return badges[preference] || preference;
}

/**
 * Format dietary preferences for display in context
 */
export function formatDietaryPreferences(preferences: DietaryPreference[]): string {
  if (!preferences || preferences.length === 0) return 'No dietary restrictions';

  const badges = preferences.map(p => getDietaryPreferenceBadge(p));
  return badges.join(' • ');
}
