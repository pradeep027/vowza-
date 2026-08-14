// ─── LLM Service Layer ─────────────────────────────────────────────────────────
//
// Routing priority (highest to lowest):
//   1. Plan Generation (NEW Phase 2A) → EventBudgetPlanner if readiness >= 60%
//   2. Vendor Retrieval (RAG)         → Search Vowza marketplace for providers
//   3. Supabase Edge Function proxy   → Groq (key stays server-side)
//   4. Deterministic VEDA engine      → always works, zero cost, zero latency
//
// The interface is identical in all modes — UI code never branches.

import { processMessage } from './aiPlanner';
import {
  retrieveActiveMarketplaceCategories,
  retrieveVendors,
  buildRAGContext,
  NO_VENDORS_FOUND_MESSAGE,
} from './ragRetriever';
import { dedupeVerifiedDBVendors } from './vendorTrust';
import { orchestrate, buildDynamicSystemPrompt, extractContextUpdates, isActiveCategoryListRequest, nextSoftFollowUp, calculatePlanningReadiness, extractPlanState } from './aiOrchestrator';
import { EventBudgetPlanner, formatBudgetAllocation, type EventBudgetPlan } from './eventBudgetPlanner';
import { recommendPackages, type PackageRecommendation } from './packageMatcher'; // NEW Phase 2B
import { matchPlanToVendors, formatVendorRecommendationsForPlan } from './vendorMatcher'; // NEW Phase 5
import { detectModificationIntent, removeService, adjustServiceBudget, rebalancePlanBudget, setPriority, formatModificationResponse } from './eventPlanMutator'; // NEW Phase 6
import { generateTradeOffOptions, formatTradeOffResponse, applyTradeOff, estimateBudgetGap } from './tradeOffOptimizer'; // NEW Phase 6
import type { PlannerContext, AIResponse, ChatMessage } from './aiPlannerTypes';
import {
  calculateContextReadiness,
  getNextContextQuestion,
  formatContextQuestion,
  getMissingEssentialFields,
  extractEventTypeFromText,
  extractCityFromText,
  extractBudgetFromText,
  extractGuestCountFromText,
  extractEventDateFromText,  // NEW Phase 7B
  formatEventDate,           // NEW Phase 7B
  checkDateAvailability,     // NEW Phase 7B
} from './eventContextCapturer';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type StreamChunk = { delta: string; done: boolean };
export type StreamCallback = (chunk: StreamChunk) => void;

export interface SendOptions {
  message:  string;
  history:  ChatMessage[];
  context:  PlannerContext;
  onChunk:  StreamCallback;
  currentPlan?: EventBudgetPlan; // Current plan from previous turns
}
export interface SendResult {
  fullText:       string;
  aiResponse:     AIResponse;
  updatedContext: PlannerContext;
  generatedPlan?: EventBudgetPlan;        // Phase 2A
  recommendedPackages?: import('./packageMatcher').AdminEventPackage[];  // NEW Phase 2C
}

// ─── VEDA Master System Prompt ────────────────────────────────────────────────
export const SYSTEM_PROMPT = `You are the ✨ Vowza Planner — a personal AI event planning assistant built into Vowza, India's premier event marketplace.

You are NOT a chatbot. You are a professional AI Event Director who thinks, analyses, plans, and optimises every event like a top-tier event management company.

PERSONALITY: Warm, confident, professional, highly intelligent. Sound like a premium personal consultant — never robotic. Always introduce yourself as "Vowza Planner" if asked.

THINKING PROCESS — always follow before answering:
1. Understand event type and purpose
2. Understand guest count
3. Understand city (affects pricing 0.8x-1.55x)
4. Understand budget and feasibility
5. Generate the complete plan once enough info is collected

MEMORY: Remember user name, budget, event type, city, guest count throughout the conversation. Never ask again unless they change something.

RULES:
1. Think before every response — never give a reflexive one-line answer
2. Always show cost reasoning
3. Never hallucinate prices
4. Always offer budget-optimisation alternatives
5. Use markdown: **bold**, tables, numbered/bullet lists
6. When user likes a vendor: ask "Would you like me to open their booking page on Vowza?"`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildMessages(history: ChatMessage[], userMsg: string, systemPrompt: string): LLMMessage[] {
  const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];
  history.slice(-20).forEach(m =>
    messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
  );
  messages.push({ role: 'user', content: userMsg });
  return messages;
}

// ─── Groq NDJSON stream reader ────────────────────────────────────────────────
async function readGroqStream(res: Response, onChunk: StreamCallback): Promise<string> {
  const reader = res.body!.getReader();
  const dec    = new TextDecoder();
  let full     = '';
  let buffer   = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += dec.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const evt = JSON.parse(trimmed) as { delta?: string; done?: boolean; error?: string };
        if (evt.error) throw new Error(evt.error);
        if (evt.delta) {
          full += evt.delta;
          onChunk({ delta: evt.delta, done: false });
        }
      } catch (err) {
        // Ignore malformed partial lines
      }
    }
  }

  onChunk({ delta: '', done: true });
  return full;
}

// ─── Mode: Supabase Edge Function proxy → Groq ──────────────────────────────
async function callViaEdgeFunction(
  messages: LLMMessage[],
  supabaseUrl: string,
  onChunk: StreamCallback
): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    supabaseUrl,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
  );
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';

  const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Edge Function error: ${msg}`);
  }

  return readGroqStream(res, onChunk);
}

// ─── Deterministic VEDA engine word-by-word streaming ─────────────────────────
async function streamDeterministic(text: string, onChunk: StreamCallback): Promise<void> {
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    const delta = (i === 0 ? '' : ' ') + words[i];
    onChunk({ delta, done: false });
    const last = words[i];
    const delay = last.endsWith('.') || last.endsWith('?') || last.endsWith('!') ? 40
                : last.endsWith(',') || last.endsWith(':') ? 22
                : 14;
    await new Promise(r => setTimeout(r, delay));
  }
  onChunk({ delta: '', done: true });
}

// ─── Format Budget Plan for Display ─────────────────────────────────────────────
function formatBudgetPlanResponse(plan: EventBudgetPlan): string {
  const header = `\n## 💰 Budget Plan: ${plan.eventType.charAt(0).toUpperCase() + plan.eventType.slice(1)}\n`;
  const basicInfo = `**Event:** ${plan.eventType} | **City:** ${plan.city} | **Guests:** ${plan.guestCount} | **Luxury:** ${plan.luxuryLevel}\n`;
  const totalBudgetLine = `**Total Budget:** ${formatBudgetAllocation(plan.totalBudget)}\n`;

  let allocTable = '\n### Budget Allocation:\n\n| Category | Budget | % | Priority |\n|----------|--------|---|----------|\n';
  for (const alloc of plan.allocations) {
    allocTable += `| ${alloc.category} | ${formatBudgetAllocation(alloc.allocatedAmount)} | ${alloc.actualPercentage.toFixed(1)}% | ${alloc.priority} |\n`;
  }

  const summary = `\n**Total Allocated:** ${formatBudgetAllocation(plan.totalAllocated)} | **Remaining:** ${formatBudgetAllocation(plan.remaining)}\n`;
  const feasibility = plan.isFeasible 
    ? '✅ **Feasible** — Your budget covers all essential categories.\n'
    : `⚠️ **Review needed** — ${plan.feasibilityNotes.join(' ')}\n`;

  const recommendations = plan.recommendations.length 
    ? `\n### Recommendations:\n${plan.recommendations.map(r => `- ${r}`).join('\n')}\n`
    : '';

  return header + basicInfo + totalBudgetLine + allocTable + summary + feasibility + recommendations;
}

// ─── NEW Phase 2C: Format Package Recommendation with Real Packages ─────────────
async function formatPackageRecommendationResponse(plan: EventBudgetPlan): Promise<{
  displayText: string;
  packages: import('./packageMatcher').AdminEventPackage[];
}> {
  const rec = await recommendPackages(plan);
  return {
    displayText: rec.displayText,
    packages: rec.packages || [],
  };
}

// ─── PHASE 4: Extract context from user message ─────────────────────────────
function extractContextFromMessage(message: string, currentContext: PlannerContext): Partial<PlannerContext> {
  const extracted: Partial<PlannerContext> = {};
  
  // Try to extract each essential field
  const eventType = extractEventTypeFromText(message);
  if (eventType && !currentContext.eventType) {
    extracted.eventType = eventType;
  }
  
  const city = extractCityFromText(message);
  if (city && !currentContext.city) {
    extracted.city = city;
  }
  
  const budget = extractBudgetFromText(message);
  if (budget && !currentContext.budget) {
    extracted.budget = budget;
  }
  
  const guestCount = extractGuestCountFromText(message);
  if (guestCount && !currentContext.guestCount) {
    extracted.guestCount = guestCount;
  }
  
  return extracted;
}

// ── No-vendors → keep planning naturally ──────────────────────────────────────
function buildContinuePlanningMessage(ctx: PlannerContext): string {
  const followUp = nextSoftFollowUp(ctx);
  const closing = followUp
    ? followUp
    : `Want me to start with a **budget breakdown**, a **timeline**, or **decoration ideas** for your ${ctx.eventType ?? 'event'}?`;
  return `${NO_VENDORS_FOUND_MESSAGE}\n\n${closing}`;
}

// ─── PHASE 4: Check if context is sufficient, or ask for next essential ──────
async function checkContextReadinessAndRespond(
  context: PlannerContext,
  onChunk: StreamCallback
): Promise<{ shouldContinue: boolean; response: SendResult | null }> {
  const readiness = calculateContextReadiness(context);
  
  console.log('[Vowza AI Phase 4] Context readiness check:', {
    readiness: readiness.readiness,
    isSufficient: readiness.isSufficient,
    missing: readiness.missingEssentials,
  });
  
  // If context is insufficient, ask for the next essential field
  if (!readiness.isSufficient && readiness.nextQuestion) {
    const questionText = formatContextQuestion(readiness.nextQuestion, context);
    await streamDeterministic(questionText, onChunk);
    
    return {
      shouldContinue: false,
      response: {
        fullText: questionText,
        aiResponse: { type: 'question', text: questionText },
        updatedContext: context,
        generatedPlan: undefined,
        recommendedPackages: [],
      },
    };
  }
  
  return { shouldContinue: true, response: null };
}

export const VENDOR_SEARCH_UNAVAILABLE_MESSAGE =
  `I couldn't reach Vowza's verified vendor search right now, so I won't show any marketplace vendors until it is available.\n\nPlease try again shortly, or I can still help with planning, budgets, timelines, and checklists.`;

// ── Deterministic response builder ────────────────────────────────────────────
function buildDeterministicResponse(
  message: string,
  ctx: PlannerContext,
  orch: ReturnType<typeof orchestrate>,
  ragContext: string
): string {
  const l = message.toLowerCase();

  // General questions
  if (orch.intent === 'general_question') {
    if (/gruhapravesam/i.test(l)) return `**Gruhapravesam** is a Hindu house-warming ceremony. Key rituals: **Ganapathi Pooja**, **Vastu Pooja**, **Homam** (fire ritual), **Gruhapravesh**. Typical duration: 2-4 hours. Budget: ₹8,000–₹25,000. Would you like help planning one?`;
  }

  // Vendor discovery
  if (orch.intent === 'find_vendors' && ragContext) {
    const city = ctx.city ? ` in **${ctx.city}**` : '';
    return `Here are verified vendors from Vowza${city}:\n\n${ragContext}`;
  }

  if (orch.intent === 'find_vendors' && !ragContext) {
    return !ctx.city
      ? `Which city are you looking for vendors in?`
      : buildContinuePlanningMessage(ctx);
  }

  // Context updates
  if (orch.intent === 'context_update') {
    const known = [ctx.eventType, ctx.city && `in ${ctx.city}`, ctx.budget && `₹${(ctx.budget/100000).toFixed(1)}L`, ctx.guestCount && `${ctx.guestCount} guests`].filter(Boolean);
    return `Got it — updated. Current: ${known.join(' · ')}. What would you like next?`;
  }

  // Default greeting
  return `Welcome to **Vowza Planner**! 🎉\n\nI can help you:\n- **Plan any event**\n- **Find verified vendors**\n- **Create budgets and timelines**\n\nWhat event are you planning?`;
}

// ─── Main sendMessage (NEW Phase 2A with plan generation) ──────────────────────
export async function sendMessage(opts: SendOptions): Promise<SendResult> {
  const { message, history, context, onChunk, currentPlan } = opts;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const useEdge = import.meta.env.VITE_USE_AI_PROXY !== 'false';

  // ─── PHASE 4: Extract context from message ────────────────────────────────────
  const extractedContext = extractContextFromMessage(message, context);
  const contextWithExtraction = { ...context, ...extractedContext };
  
  console.log('[Vowza AI Phase 4] Extracted context:', {
    extracted: extractedContext,
    total: contextWithExtraction,
  });

  // ─── PHASE 4: Check if context is sufficient for planning ───────────────────
  // If not, ask for the next essential field and return early
  const readinessCheck = await checkContextReadinessAndRespond(contextWithExtraction, onChunk);
  if (!readinessCheck.shouldContinue && readinessCheck.response) {
    return readinessCheck.response;
  }

  // 1. Orchestrate this turn
  const orch = orchestrate(message, contextWithExtraction, history);
  const { response: vedaResponse, updatedContext } = await processMessage(message, contextWithExtraction, history);

  // ─── PHASE 2A: Check planning readiness and generate plan if sufficient ─────
  const readiness = calculatePlanningReadiness(updatedContext);
  let generatedPlan: EventBudgetPlan | undefined;
  
  console.log('[Vowza AI Phase 2A] Planning readiness:', {
    readiness: readiness.readiness,
    isSufficient: readiness.isSufficient,
    eventType: updatedContext.eventType,
    city: updatedContext.city,
    budget: updatedContext.budget,
    intent: orch.intent,
  });

  if (readiness.isSufficient && ['plan_event', 'budget_breakdown', 'context_update'].includes(orch.intent)) {
    generatedPlan = EventBudgetPlanner.allocate(updatedContext);
    console.log('[Vowza AI Phase 2A] Generated plan:', {
      eventType: generatedPlan.eventType,
      isFeasible: generatedPlan.isFeasible,
      totalBudget: generatedPlan.totalBudget,
    });
  }
  // ────────────────────────────────────────────────────────────────────────────

  // 2. Handle category listing
  if (isActiveCategoryListRequest(message)) {
    try {
      const categories = await retrieveActiveMarketplaceCategories();
      const categoryText = categories.length
        ? `Here are all **${categories.length} active Vowza marketplace categories**.`
        : `I couldn't find any active Vowza marketplace categories right now.`;
      await streamDeterministic(categoryText, onChunk);
      return {
        fullText: categoryText,
        aiResponse: { type: 'category_results', text: categoryText, data: { categories } },
        updatedContext,
        generatedPlan,
      };
    } catch (error) {
      console.warn('[Vowza AI] Category retrieval failed:', error);
      const msg = `I couldn't reach the category directory right now. Please try again shortly.`;
      await streamDeterministic(msg, onChunk);
      return {
        fullText: msg,
        aiResponse: { type: 'category_results', text: msg, data: { categories: [] } },
        updatedContext,
        generatedPlan,
      };
    }
  }

  // ─── PHASE 6: Check if user wants to modify existing plan ──────────────────
  if (currentPlan && currentPlan.allocations && currentPlan.allocations.length > 0) {
    const modification = detectModificationIntent(message, currentPlan);
    
    if (modification) {
      console.log('[Vowza AI Phase 6] Detected modification:', { type: modification.type, target: modification.target });
      
      let result: any = null;
      let success = false;

      if (modification.type === 'remove_service') {
        result = removeService(currentPlan, modification.target);
        success = result.success;
      } else if (modification.type === 'adjust_budget') {
        if (modification.value) {
          result = adjustServiceBudget(currentPlan, modification.target, modification.value);
          success = result.success;
        }
      } else if (modification.type === 'rebalance_budget') {
        if (modification.value) {
          result = rebalancePlanBudget(currentPlan, modification.value);
          success = result.success;
        }
      } else if (modification.type === 'change_priority') {
        result = setPriority(currentPlan, modification.target, 'high');
        success = result.success;
      }

      if (success && result && result.modifiedPlan) {
        const modifiedPlan = result.modifiedPlan;
        let displayText = result.message;

        // Check if new plan exceeds budget and suggest trade-offs
        const gap = estimateBudgetGap(modifiedPlan);
        if (gap.gap > 0) {
          const tradeOffs = generateTradeOffOptions(modifiedPlan);
          if (tradeOffs.length > 0) {
            displayText += formatTradeOffResponse(tradeOffs, modifiedPlan);
          } else {
            displayText += '\n\n' + gap.message;
          }
        }

        await streamDeterministic(displayText, onChunk);
        return {
          fullText: displayText,
          aiResponse: { type: 'budget_plan', text: displayText, data: { plan: modifiedPlan } },
          updatedContext,
          generatedPlan: modifiedPlan,
          recommendedPackages: [],
        };
      }
    }
  }

  // ─── PHASE 7A: Handle booking requests ──────────────────────────────────────
  if (orch.intent === 'booking_request') {
    // Import booking handler
    const { handleBookingRequest, formatBookingResponse, generateBookingData } = await import('./bookingHandler');
    
    // Get prior vendors from message history or current context
    let priorVendors: any[] = [];
    for (const msg of history.reverse()) {
      if (msg.role === 'assistant' && msg.type === 'vendor_results' && msg.data?.dbVendors) {
        priorVendors = msg.data.dbVendors;
        break;
      }
    }
    
    console.log('[Vowza AI Phase 7A] Booking request detected:', {
      message,
      priorVendorsCount: priorVendors.length,
    });
    
    const booking = await handleBookingRequest(message, priorVendors, updatedContext, currentPlan || null);
    const bookingText = formatBookingResponse(booking);
    
    await streamDeterministic(bookingText, onChunk);
    return {
      fullText: bookingText,
      aiResponse: {
        type: 'booking_request',
        text: bookingText,
        data: generateBookingData(booking, updatedContext, currentPlan || undefined),
      },
      updatedContext,
      generatedPlan,
      recommendedPackages: [],
    };
  }
  // ────────────────────────────────────────────────────────────────────────────

  // 3. Vendor discovery
  const explicitVendorRequest = /\b(show|find|search|display|list|profiles?)\s+(me\s+)?(all\s+)?(the\s+)?(verified\s+)?(vowza\s+)?(photographer|videographer|decorator|caterer|dj|band|makeup|artist|vendor|provider)\w*/i.test(message);
  
  if (explicitVendorRequest || orch.needsRetrieval) {
    const ragResult = await retrieveVendors(message, updatedContext, 12, {
      professions: orch.professions || [],
      city: orch.city ?? undefined,
      priceMax: orch.priceMax ?? undefined,
      minRating: orch.minRating || 0,
    });
    
    const dbVendors = dedupeVerifiedDBVendors(ragResult.vendors);
    console.log('[Vowza AI] Retrieved vendors:', dbVendors.length);
    
    if (ragResult.searchStatus === 'technical_error') {
      await streamDeterministic(VENDOR_SEARCH_UNAVAILABLE_MESSAGE, onChunk);
      return {
        fullText: VENDOR_SEARCH_UNAVAILABLE_MESSAGE,
        aiResponse: { type: 'vendor_results', text: VENDOR_SEARCH_UNAVAILABLE_MESSAGE, data: { dbVendors: [] } },
        updatedContext,
        generatedPlan,
      };
    }

    if (dbVendors.length > 0) {
      const ragContext = buildRAGContext(ragResult);
      const vendorText = `I found **${dbVendors.length} verified Vowza profiles**:\n\n${ragContext}`;
      await streamDeterministic(vendorText, onChunk);
      return {
        fullText: vendorText,
        aiResponse: { type: 'vendor_results', text: vendorText, data: { dbVendors } },
        updatedContext,
        generatedPlan,
      };
    } else {
      const noVendorText = buildContinuePlanningMessage(updatedContext);
      await streamDeterministic(noVendorText, onChunk);
      return {
        fullText: noVendorText,
        aiResponse: { type: 'vendor_results', text: noVendorText, data: { dbVendors: [] } },
        updatedContext,
        generatedPlan,
      };
    }
  }

  // ─── PHASE 2A: Stream generated plan if sufficient readiness ─────────────────
  if (generatedPlan && readiness.isSufficient) {
    const planText = formatBudgetPlanResponse(generatedPlan);
    
    // ─── PHASE 5: Match real vendors to the plan ──────────────────────────────
    let vendorMatches = [];
    let vendorText = '';
    try {
      // Retrieve vendors from database for this event type and city
      const ragResult = await retrieveVendors(
        `${generatedPlan.eventType} ${generatedPlan.city} vendors`,
        updatedContext,
        20,  // Get more vendors for better matching
        {
          professions: [],
          city: generatedPlan.city,
          priceMax: Math.max(...generatedPlan.allocations.map(a => a.allocatedAmount)),
        }
      );
      
      const dbVendors = dedupeVerifiedDBVendors(ragResult.vendors);
      
      if (dbVendors.length > 0) {
        // Match vendors to allocations
        vendorMatches = matchPlanToVendors(generatedPlan, dbVendors, 2); // Top 2 per category
        vendorText = formatVendorRecommendationsForPlan(vendorMatches);
        
        console.log('[Vowza AI Phase 5] Vendor matching:', {
          totalVendorsRetrieved: dbVendors.length,
          matched: vendorMatches.length,
          categories: [...new Set(vendorMatches.map(v => v.category))].length,
        });
      } else {
        console.log('[Vowza AI Phase 5] No vendors found for matching');
      }
    } catch (err) {
      console.warn('[Vowza AI Phase 5] Vendor matching error:', err);
      // Continue without vendors — plan is still valid
    }
    
    // NEW Phase 2C: Add package recommendation with real packages
    let fullText = planText + vendorText;
    let recommendedPackages: any[] = [];
    try {
      const packageRec = await formatPackageRecommendationResponse(generatedPlan);
      fullText += '\n' + packageRec.displayText;
      recommendedPackages = packageRec.packages;
      console.log('[Vowza AI Phase 2C] Recommended packages:', {
        count: recommendedPackages.length,
        tiers: recommendedPackages.map(p => p.tier),
      });
    } catch (err) {
      console.warn('[Vowza AI Phase 2C] Package recommendation failed:', err);
      // Continue without packages — budget plan is primary
    }
    
    const followUp = nextSoftFollowUp(updatedContext);
    fullText = fullText + (followUp ? `\n\n${followUp}` : '');
    
    await streamDeterministic(fullText, onChunk);
    return {
      fullText,
      aiResponse: { type: 'budget_plan', text: fullText, data: { plan: generatedPlan, dbVendors: vendorMatches } },
      updatedContext,
      generatedPlan,
      recommendedPackages,  // NEW Phase 2C
    };
  }
  // ────────────────────────────────────────────────────────────────────────────

  // 4. VEDA responses
  if (vedaResponse.type !== 'text' && vedaResponse.type !== 'vendor_recommendations' && vedaResponse.text) {
    await streamDeterministic(vedaResponse.text, onChunk);
    return { fullText: vedaResponse.text, aiResponse: vedaResponse, updatedContext, generatedPlan, recommendedPackages: [] };
  }

  // 5. Edge Function + LLM fallback
  const dynamicSystemPrompt = buildDynamicSystemPrompt(orch, updatedContext, '', history);
  if (useEdge && supabaseUrl) {
    try {
      const msgs = buildMessages(history, message, dynamicSystemPrompt);
      const fullText = await callViaEdgeFunction(msgs, supabaseUrl, onChunk);
      return { fullText, aiResponse: { type: 'text', text: fullText }, updatedContext, generatedPlan, recommendedPackages: [] };
    } catch (err) {
      console.warn('[Vowza AI] Edge Function failed:', err);
    }
  }

  // 6. Deterministic fallback
  const deterministicText = buildDeterministicResponse(message, updatedContext, orch, '');
  await streamDeterministic(deterministicText, onChunk);
  return { fullText: deterministicText, aiResponse: { type: 'text', text: deterministicText }, updatedContext, generatedPlan, recommendedPackages: [] };
}
