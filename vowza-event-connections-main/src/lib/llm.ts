// ─── LLM Service Layer ─────────────────────────────────────────────────────────
//
// Routing priority (highest to lowest):
//   1. Supabase Edge Function proxy  — VITE_SUPABASE_URL present (production, key stays server-side)
//   2. Direct OpenAI streaming       — VITE_OPENAI_KEY=sk-… set (local dev convenience)
//   3. Deterministic VEDA engine     — always works, zero cost, zero latency
//
// The interface is identical in all three modes — UI code never branches.

import { processMessage } from './aiPlanner';
import { retrieveVendors, buildRAGContext } from './ragRetriever';
import { orchestrate, buildDynamicSystemPrompt, extractContextUpdates } from './aiOrchestrator';
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

// ─── Mode 1: Supabase Edge Function proxy (production) ───────────────────────
// The Edge Function holds the OpenAI key server-side — it never reaches the browser.
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

  return readOpenAIStream(res, onChunk);
}

// ─── Mode 2: Direct OpenAI (local dev with VITE_OPENAI_KEY set) ───────────────
async function callDirectOpenAI(
  messages: LLMMessage[],
  apiKey: string,
  onChunk: StreamCallback
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       'gpt-4o-mini',
      messages,
      stream:      true,
      temperature: 0.7,
      max_tokens:  2048,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `OpenAI error ${res.status}`);
  }

  return readOpenAIStream(res, onChunk);
}

// ─── Shared SSE reader ────────────────────────────────────────────────────────
async function readOpenAIStream(res: Response, onChunk: StreamCallback): Promise<string> {
  const reader = res.body!.getReader();
  const dec    = new TextDecoder();
  let full     = '';

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = dec.decode(value, { stream: true }).split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break outer;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content ?? '';
        if (delta) { full += delta; onChunk({ delta, done: false }); }
      } catch { /* ignore malformed SSE lines */ }
    }
  }

  // Signal completion AFTER the loop — fixes the race condition where
  // `result` was referenced before the promise resolved.
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
      : `I searched Vowza for **${profs}** in **${ctx.city}**. No verified vendors found yet — the marketplace is growing daily! I can suggest what to look for and typical price ranges. Would that help?`;
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

  const canGenerate = ctx.eventType && ctx.city && ctx.budget && ctx.guestCount;
  if (canGenerate) {
    return `I have everything I need — **${ctx.eventType}** in **${ctx.city}** for **${ctx.guestCount} guests** with a budget of **₹${(ctx.budget!/100000).toFixed(1)}L**.\n\nWhat would you like?\n- **Complete plan** (day-by-day itinerary)\n- **Budget breakdown** (category-wise)\n- **Vendor recommendations** (real Vowza vendors)\n- **Planning timeline**`;
  }

  return !ctx.eventType ? 'What type of event are you planning?'
    : !ctx.city         ? 'Which city will the event be in?'
    : !ctx.budget       ? 'What is your total budget?'
    :                     'How many guests are you expecting?';
}

// ─── Main sendMessage ─────────────────────────────────────────────────────────
export async function sendMessage(opts: SendOptions): Promise<SendResult> {
  const { message, history, context, onChunk } = opts;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const directKey   = import.meta.env.VITE_OPENAI_KEY   as string | undefined;
  const useEdge     = import.meta.env.VITE_USE_AI_PROXY  === 'true';

  // ── Step 1: Orchestrate — understand intent before doing anything ─────────
  const orch = orchestrate(message, context, history);

  // ── Step 2: Run VEDA engine for structured outputs ────────────────────────
  const { response: vedaResponse, updatedContext } =
    await processMessage(message, context, history);

  // If VEDA produced a real non-empty structured response → stream it directly
  if (vedaResponse.type !== 'text' && vedaResponse.text) {
    await streamDeterministic(vedaResponse.text, onChunk);
    return { fullText: vedaResponse.text, aiResponse: vedaResponse, updatedContext };
  }

  // If VEDA decided to ask a question (missing context) → stream the question
  if (vedaResponse.type === 'question' && vedaResponse.text) {
    await streamDeterministic(vedaResponse.text, onChunk);
    return { fullText: vedaResponse.text, aiResponse: vedaResponse, updatedContext };
  }

  // ── Step 3: RAG retrieval (only when orchestrator flagged it needed) ───────
  let ragContext = '';
  if (orch.needsRetrieval) {
    const ragResult = await retrieveVendors(message, updatedContext, 8, {
      professions: orch.professions,
      city:        orch.city ?? undefined,
      priceMax:    orch.priceMax ?? undefined,
      minRating:   orch.minRating,
    });
    ragContext = buildRAGContext(ragResult);
  }

  // ── Step 4: Build dynamic context-aware system prompt ────────────────────
  const dynamicSystemPrompt = buildDynamicSystemPrompt(orch, updatedContext, ragContext, history);

  // ── Step 5: Route to LLM ──────────────────────────────────────────────────

  // Mode 1: Supabase Edge Function proxy (production — key stays server-side)
  if (useEdge && supabaseUrl) {
    try {
      const msgs = buildMessages(history, message, dynamicSystemPrompt);
      const fullText = await callViaEdgeFunction(msgs, supabaseUrl, onChunk);
      return { fullText, aiResponse: { type: 'text', text: fullText }, updatedContext };
    } catch (err) {
      console.warn('[VEDA] Edge Function failed, falling back:', err);
    }
  }

  // Mode 2: Direct OpenAI (local dev only)
  if (directKey && directKey.startsWith('sk-') && directKey !== 'sk-your-key-here') {
    try {
      const msgs = buildMessages(history, message, dynamicSystemPrompt);
      const fullText = await callDirectOpenAI(msgs, directKey, onChunk);
      return { fullText, aiResponse: { type: 'text', text: fullText }, updatedContext };
    } catch (err) {
      console.warn('[VEDA] OpenAI failed, falling back:', err);
    }
  }

  // Mode 3: Deterministic VEDA — always works, zero cost, context-aware
  const deterministicText = buildDeterministicResponse(message, updatedContext, orch, ragContext);
  await streamDeterministic(deterministicText, onChunk);
  return { fullText: deterministicText, aiResponse: { type: 'text', text: deterministicText }, updatedContext };
}
