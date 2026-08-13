// ─── LLM Service Layer ─────────────────────────────────────────────────────────
//
// Routing priority (highest to lowest):
//   1. Supabase Edge Function proxy → Groq (key stays server-side)
//   2. Deterministic VEDA engine    → always works, zero cost, zero latency
//
// The interface is identical in both modes — UI code never branches.
// The Groq API key lives ONLY in Supabase secrets (GROQ_API_KEY).
// It is never bundled into the browser.

import { processMessage } from './aiPlanner';
import {
  retrieveActiveMarketplaceCategories,
  retrieveVendors,
  buildRAGContext,
  NO_VENDORS_FOUND_MESSAGE,
} from './ragRetriever';
import { dedupeVerifiedDBVendors } from './vendorTrust';
import { orchestrate, buildDynamicSystemPrompt, extractContextUpdates, isActiveCategoryListRequest, nextSoftFollowUp } from './aiOrchestrator';
import type { PlannerContext, AIResponse, ChatMessage } from './aiPlannerTypes';

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
}
export interface SendResult {
  fullText:       string;
  aiResponse:     AIResponse;
  updatedContext: PlannerContext;
}

// ─── VEDA Master System Prompt ────────────────────────────────────────────────
export const SYSTEM_PROMPT = `You are the ✨ Vowza Planner — a personal AI event planning assistant built into Vowza, India's premier event marketplace.

You are NOT a chatbot. You are a professional AI Event Director who thinks, analyses, plans, and optimises every event like a top-tier event management company.

PERSONALITY: Warm, confident, professional, highly intelligent. Sound like a premium personal consultant — never robotic. Always introduce yourself as "Vowza Planner" if asked.

SUPPORTED EVENTS: Wedding, Reception, Engagement, Haldi, Mehendi, Sangeet, Birthday, Baby Shower, House Warming, Anniversary, Corporate, Conference, Product Launch, College Fest, DJ Night, Concert, Fashion Show, Sports Event, Temple Event, Charity, Private Party, Festival.

THINKING PROCESS — always follow before answering:
1. Understand event type and purpose
2. Understand duration (single/multi-day)
3. Understand guest count
4. Understand city (affects pricing 0.8x-1.55x)
5. Understand budget and feasibility
6. Understand venue type (indoor/outdoor/both)
7. Understand season and weather risk
8. Understand luxury level preference
9. Understand religion/culture if relevant
10. Identify missing info — ask ONE question at a time
11. Generate the complete plan once enough info is collected

COMPLETE PLAN must include:
- Executive Summary
- Budget Breakdown Table
- Month-by-month preparation timeline
- Hour-by-hour event day schedule
- Vendor recommendations with Vowza links (/artists?category=X&city=Y)
- Priority checklist with owner and deadline
- Weather analysis and backup plan
- Risk analysis with mitigation
- Success Score (0-100) with confidence %
- Hidden costs warning
- Improvements

PRICING RULES (realistic Indian market 2025):
- City: Mumbai 1.55x | Delhi 1.45x | Bangalore 1.35x | Chennai 1.15x | Hyderabad 1.0x | Pune 1.12x
- Season: Peak Nov-Feb 1.3x | Off-peak summer 0.88x | Monsoon 0.82x
- Style: Luxury 2.6x | Premium 1.65x | Standard 1.0x | Budget 0.58x

MEMORY: Remember user name, budget, event type, city, guest count, preferred vendors, theme, food preference throughout the conversation. Never ask again unless they change something.

RULES:
1. Think before every response — never give a reflexive one-line answer
2. Ask the single most important missing question
3. Always show cost reasoning
4. Never hallucinate prices
5. Always offer budget-optimisation alternatives
6. Use markdown: **bold**, tables, numbered/bullet lists
7. For multi-day events: generate a schedule per day
8. End every complete plan with a Success Score
9. When user likes a vendor: ask "Would you like me to open their booking page on Vowza?"
10. Always explain WHY each recommendation is made`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildMessages(history: ChatMessage[], userMsg: string, systemPrompt: string): LLMMessage[] {
  const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];
  // Last 20 turns for context window efficiency
  history.slice(-20).forEach(m =>
    messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
  );
  messages.push({ role: 'user', content: userMsg });
  return messages;
}

// ─── Mode 1: Supabase Edge Function proxy → Groq (production) ────────────────
// The Edge Function holds GROQ_API_KEY server-side — it never reaches the browser.
// Deploy with: supabase functions deploy ai-chat
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

// ─── Groq NDJSON stream reader ────────────────────────────────────────────────
// The Edge Function emits one JSON object per line: { delta, done } | { error, done }
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
    // Keep the last (possibly incomplete) line in the buffer
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
        // Re-throw real errors; ignore malformed partial lines
        if (err instanceof Error && err.message && !err.message.startsWith('Unexpected')) {
          throw err;
        }
      }
    }
  }

  onChunk({ delta: '', done: true });
  return full;
}

// ─── Mode 3: Deterministic VEDA engine word-by-word streaming ─────────────────
async function streamDeterministic(text: string, onChunk: StreamCallback): Promise<void> {
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    const delta = (i === 0 ? '' : ' ') + words[i];
    onChunk({ delta, done: false });
    // Variable delay: pause longer at sentence boundaries for natural cadence
    const last = words[i];
    const delay = last.endsWith('.') || last.endsWith('?') || last.endsWith('!') ? 40
                : last.endsWith(',') || last.endsWith(':') ? 22
                : 14;
    await new Promise(r => setTimeout(r, delay));
  }
  onChunk({ delta: '', done: true });
}

// ─── RAG injection for VEDA (deterministic) mode ─────────────────────────────
function injectRAGIntoVEDA(veDAText: string, ragResult: import('./ragRetriever').RAGResult): string {
  if (!ragResult.vendors.length) return veDAText;
  const lines: string[] = ['\n\n---\n### 🔍 Real Vendors Found on Vowza\n'];
  for (const v of ragResult.vendors.slice(0, 5)) {
    const name  = v.stage_name || v.full_name || 'Vendor';
    const prof  = v.profession.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const price = v.price_min ? (v.price_min >= 100000 ? `₹${(v.price_min/100000).toFixed(1)}L` : `₹${(v.price_min/1000).toFixed(0)}K`) : 'On Request';
    lines.push(`- **${name}** (${prof}, ${v.city ?? 'India'}) — ${price} | ${v.average_rating > 0 ? `${v.average_rating.toFixed(1)}⭐` : 'New'} ${v.is_verified ? '✅' : ''} — [Profile](/artist/${v.provider_id})`);
  }
  lines.push('\n_Powered by live Vowza data_');
  return veDAText + lines.join('\n');
}

// ── No-vendors → keep planning naturally ──────────────────────────────────────
// The AI must NEVER end the conversation just because the DB search was empty.
// It states the honest empty-state, then immediately offers to keep helping
// with budget/food/decor/timeline, and asks ONE relevant follow-up question.
function buildContinuePlanningMessage(ctx: PlannerContext): string {
  const followUp = nextSoftFollowUp(ctx);
  const closing = followUp
    ? followUp
    : `Want me to start with a **budget breakdown**, a **timeline**, or **decoration ideas** for your ${ctx.eventType ?? 'event'}?`;
  return `${NO_VENDORS_FOUND_MESSAGE}\n\n${closing}`;
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
  const { intent } = orch;
  const l = message.toLowerCase();

  if (intent === 'general_question') {
    if (/gruhapravesam/i.test(l)) return `**Gruhapravesam** is a Hindu house-warming ceremony performed when a family moves into a new home. It involves prayers, a Homam (fire ritual), and blessings from a Pandit to purify the home and invite prosperity.\n\nKey rituals:\n- **Ganapathi Pooja** — removing obstacles\n- **Vastu Pooja** — blessing directions\n- **Homam** — fire purification ritual\n- **Gruhapravesh** — first entry with right foot\n\nTypical duration: 2-4 hours. Budget: ₹8,000–₹25,000 for Pandit + materials.\n\nWould you like help planning a Gruhapravesam? I can suggest Pandits${ctx.city ? ` in ${ctx.city}` : ''} and build a complete plan.`;
    if (/rag|retrieval.augmented/i.test(l)) return `**RAG (Retrieval-Augmented Generation)** is an AI technique where the AI first searches a real database, then uses that data to generate accurate answers — instead of guessing.\n\nVowza AI uses RAG to find real vendors, real prices, and real availability from the Vowza marketplace before answering your questions.`;
    if (/what is vowza/i.test(l)) return `**Vowza** is India's premier event marketplace — book verified photographers, DJs, decorators, caterers, makeup artists, mehendi artists, pandits, and 50+ more categories.\n\nWhat event are you planning? I'll help you find vendors and build a complete plan.`;
  }

  if (intent === 'find_vendors' && ragContext) {
    const city = ctx.city ? ` in **${ctx.city}**` : '';
    return `Here are verified vendors from Vowza${city}:\n\n${ragContext}\n\nWould you like to compare any two, see more details, or book one?`;
  }

  if (intent === 'find_vendors' && !ragContext) {
    const profs = orch.professions.map(p => p.replace(/_/g, ' ')).join(', ') || 'vendors';
    return !ctx.city
      ? `I'll search Vowza for **${profs}** — which city are you looking in?`
      : buildContinuePlanningMessage(ctx);
  }

  if (intent === 'context_update') {
    const known = [ctx.eventType, ctx.city && `in ${ctx.city}`, ctx.budget && `₹${(ctx.budget/100000).toFixed(1)}L budget`, ctx.guestCount && `${ctx.guestCount} guests`].filter(Boolean);
    return `Got it — updated. Current: ${known.join(' · ')}.\n\nWhat would you like next — budget breakdown, vendor recommendations, or the complete plan?`;
  }

  if (intent === 'follow_up') {
    const known = [ctx.eventType, ctx.city, ctx.budget ? `₹${(ctx.budget/100000).toFixed(1)}L` : '', ctx.guestCount ? `${ctx.guestCount} guests` : ''].filter(Boolean);
    return known.length
      ? `Continuing from our discussion — your ${known.join(', ')}. What specifically would you like to explore? Budget details, vendor options, timeline, or something else?`
      : `Sure, what would you like to know more about?`;
  }

  if (intent === 'comparison') {
    return !ctx.city
      ? `For a comparison, which city are you in?`
      : `Let me search Vowza in **${ctx.city}** — what two categories or vendors would you like me to compare?`;
  }

  // CRITICAL FIX: Use sensible defaults instead of re-asking.
  // Never ask "What type of event?" if we already know. Instead, assume
  // defaults and generate useful output immediately.
  const withDefaults: PlannerContext = {
    eventType: ctx.eventType ?? 'wedding',
    city: ctx.city ?? 'your city',
    budget: ctx.budget ?? 500000, // ₹5 lakh default
    guestCount: ctx.guestCount ?? 200,
    ...ctx,
  };

  // If planning intent detected and we have at least ONE piece of context,
  // generate immediately instead of asking.
  const hasContext = !!(ctx.eventType || ctx.city || ctx.budget || ctx.guestCount);
  if (hasContext || orch.intent === 'plan_event' || orch.intent === 'budget_breakdown' || orch.intent === 'timeline' || orch.intent === 'checklist' || orch.intent === 'food_plan') {
    return `I have everything I need — **${withDefaults.eventType}** in **${withDefaults.city}** for **${withDefaults.guestCount} guests** with a budget of **₹${(withDefaults.budget!/100000).toFixed(1)}L**.\n\nWhat would you like?\n- **Complete plan** (day-by-day itinerary)\n- **Budget breakdown** (category-wise)\n- **Vendor recommendations** (real Vowza vendors)\n- **Planning timeline**`;
  }

  // NEVER re-ask. Generate a welcome + next steps instead.
  return `Welcome to **Vowza Planner**! 🎉\n\nI can help you:\n- **Plan any event** (weddings, birthdays, corporate, housewarming...)\n- **Find verified vendors** (photographers, decorators, caterers, DJs, and 50+ more)\n- **Create budgets** and timelines\n- **Get expert advice**\n\nWhat event are you planning?`;
}

// ─── Main sendMessage ─────────────────────────────────────────────────────────
export async function sendMessage(opts: SendOptions): Promise<SendResult> {
  const { message, history, context, onChunk } = opts;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const useEdge = import.meta.env.VITE_USE_AI_PROXY !== 'false';

  // Understand the turn and merge its planning context first. Marketplace
  // retrieval deliberately happens before structured VEDA output: a request
  // for vendor records must never become a generic budget/plan response.
  const orch = orchestrate(message, context, history);
  const { response: vedaResponse, updatedContext } = await processMessage(message, context, history);

  // The category directory is an explicit, database-grounded Planner response.
  // It deliberately bypasses generic planning and LLM text so every displayed
  // category is currently active in artist_categories.
  if (isActiveCategoryListRequest(message)) {
    try {
      const categories = await retrieveActiveMarketplaceCategories();
      const categoryText = categories.length
        ? `Here are all **${categories.length} active Vowza marketplace categories**. Choose one and I’ll search verified profiles for it.`
        : `I couldn't find any active Vowza marketplace categories right now.`;
      await streamDeterministic(categoryText, onChunk);
      return {
        fullText: categoryText,
        aiResponse: { type: 'category_results', text: categoryText, data: { categories } },
        updatedContext,
      };
    } catch (error) {
      console.warn('[Vowza AI] active category retrieval failed:', error);
      const unavailableMessage = `I couldn't reach Vowza's active category directory right now, so I won't show a stale category list. Please try again shortly.`;
      await streamDeterministic(unavailableMessage, onChunk);
      return {
        fullText: unavailableMessage,
        aiResponse: { type: 'category_results', text: unavailableMessage, data: { categories: [] } },
        updatedContext,
      };
    }
  }

  // CRITICAL: If user explicitly mentions finding vendors, ALWAYS retrieve and show them
  // Do not let this fall through to planning logic
  const explicitVendorRequest = /\b(show|find|search|display|list|profiles?)\s+(me\s+)?(all\s+)?(the\s+)?(verified\s+)?(vowza\s+)?(photographer|videographer|decorator|caterer|dj|band|makeup|artist|vendor|provider)\w*/i.test(message);
  
  if (explicitVendorRequest) {
    console.log('[Vowza AI] Explicit vendor request detected:', message);
    const ragResult = await retrieveVendors(message, updatedContext, 12, {
      professions: orch.professions || [],
      city: orch.city ?? undefined,
      priceMax: orch.priceMax ?? undefined,
      minRating: orch.minRating || 0,
    });
    
    const dbVendors = dedupeVerifiedDBVendors(ragResult.vendors);
    console.log('[Vowza AI] Retrieved vendors:', dbVendors.length);
    
    if (dbVendors.length > 0) {
      const vendor_text = `I found **${dbVendors.length} verified Vowza ${orch.professions?.[0] || 'vendor'} profiles**. Here they are:`;
      await streamDeterministic(vendor_text, onChunk);
      return {
        fullText: vendor_text,
        aiResponse: { 
          type: 'vendor_results', 
          text: vendor_text, 
          data: { dbVendors } 
        },
        updatedContext,
      };
    } else {
      const noResultText = `I couldn't find any verified ${orch.professions?.[0] || 'vendor'} profiles${orch.city ? ` in ${orch.city}` : ''} right now on Vowza. Try a different category or location!`;
      await streamDeterministic(noResultText, onChunk);
      return {
        fullText: noResultText,
        aiResponse: { 
          type: 'vendor_results', 
          text: noResultText, 
          data: { dbVendors: [] } 
        },
        updatedContext,
      };
    }
  }

  const hasDiscoveryLanguage = /\b(find|show|search|recommend|suggest|list|profiles?|vendors?|providers?|available|book|hire|looking for|need)\b/i.test(message);
  const marketplaceCandidate = orch.needsRetrieval || hasDiscoveryLanguage;

  let ragContext = '';
  let dbVendors: import('./aiPlannerTypes').DBVendor[] | undefined;
  let marketplaceTurn = false;
  let vendorSearchFailed = false;

  if (marketplaceCandidate) {
    const ragResult = await retrieveVendors(message, updatedContext, 8, {
      professions: orch.professions,
      city: orch.city ?? undefined,
      priceMax: orch.priceMax ?? undefined,
      minRating: orch.minRating,
    });
    ragContext = buildRAGContext(ragResult);
    vendorSearchFailed = ragResult.searchStatus === 'technical_error';
    marketplaceTurn = orch.intent === 'find_vendors'
      || orch.intent === 'comparison'
      || ragResult.searchStatus !== 'not_requested';
    if (marketplaceTurn) dbVendors = dedupeVerifiedDBVendors(ragResult.vendors);
  }

  // A database/search error never falls through to the model where a vendor
  // could be invented. An empty but successful query is an honest empty state.
  if (marketplaceTurn && vendorSearchFailed) {
    await streamDeterministic(VENDOR_SEARCH_UNAVAILABLE_MESSAGE, onChunk);
    return {
      fullText: VENDOR_SEARCH_UNAVAILABLE_MESSAGE,
      aiResponse: { type: 'vendor_results', text: VENDOR_SEARCH_UNAVAILABLE_MESSAGE, data: { dbVendors: [] } },
      updatedContext,
    };
  }

  if (marketplaceTurn && dbVendors?.length === 0) {
    const continueMsg = buildContinuePlanningMessage(updatedContext);
    await streamDeterministic(continueMsg, onChunk);
    return {
      fullText: continueMsg,
      aiResponse: { type: 'vendor_results', text: continueMsg, data: { dbVendors: [] } },
      updatedContext,
    };
  }

  // Text and cards originate from the exact same validated, database-backed
  // set. The LLM/Edge path cannot alter or fabricate marketplace records.
  if (marketplaceTurn && dbVendors) {
    const databaseText = orch.intent === 'comparison'
      ? `Here are the verified Vowza profiles I found for comparison:\n\n${ragContext}\n\nChoose any two profiles and I can compare only their listed prices, ratings, packages, and availability information.`
      : `Here are the verified Vowza profiles I found:\n\n${ragContext}\n\nWould you like to narrow these by location, budget, or date?`;
    await streamDeterministic(databaseText, onChunk);
    return {
      fullText: databaseText,
      aiResponse: { type: 'vendor_results', text: databaseText, data: { dbVendors } },
      updatedContext,
    };
  }

  // Non-marketplace requests preserve the existing deterministic planning
  // capabilities after database discovery has had a chance to claim its turn.
  if (vedaResponse.type !== 'text' && vedaResponse.type !== 'vendor_recommendations' && vedaResponse.text) {
    await streamDeterministic(vedaResponse.text, onChunk);
    return { fullText: vedaResponse.text, aiResponse: vedaResponse, updatedContext };
  }
  if (vedaResponse.type === 'question' && vedaResponse.text) {
    await streamDeterministic(vedaResponse.text, onChunk);
    return { fullText: vedaResponse.text, aiResponse: vedaResponse, updatedContext };
  }

  const dynamicSystemPrompt = buildDynamicSystemPrompt(orch, updatedContext, ragContext, history);
  if (useEdge && supabaseUrl) {
    try {
      const msgs = buildMessages(history, message, dynamicSystemPrompt);
      const fullText = await callViaEdgeFunction(msgs, supabaseUrl, onChunk);
      return { fullText, aiResponse: { type: 'text', text: fullText }, updatedContext };
    } catch (err) {
      console.warn('[Vowza AI] Groq Edge Function failed, using deterministic engine:', err);
    }
  }

  const deterministicText = buildDeterministicResponse(message, updatedContext, orch, ragContext);
  await streamDeterministic(deterministicText, onChunk);
  return { fullText: deterministicText, aiResponse: { type: 'text', text: deterministicText }, updatedContext };
}
