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
  
  const filled = essentials.length - missing.length;
  const readiness = Math.round((filled / essentials.length) * 100);
  
  // Each essential = 25% (4 essentials total)
  const isSufficient = readiness >= 100;
  
  const nextQuestion = missing.length > 0 ? missing[0] : undefined;
  
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
    'engagement': /engagement|roka|sagan|mehendi|haldi|sangeet/i,
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

