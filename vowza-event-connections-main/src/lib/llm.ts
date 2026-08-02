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
function buildMessages(history: ChatMessage[], userMsg: string, ragContext = ''): LLMMessage[] {
  const systemWithRAG = ragContext
    ? SYSTEM_PROMPT + ragContext
    : SYSTEM_PROMPT;
  const messages: LLMMessage[] = [{ role: 'system', content: systemWithRAG }];
  // Keep last 20 turns to stay within context window
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
// When OpenAI is not configured, we still inject real vendor data at the end
// of the deterministic response so users see actual Vowza vendors.
function injectRAGIntoVEDA(veDAText: string, ragResult: import('./ragRetriever').RAGResult): string {
  if (!ragResult.vendors.length) return veDAText;

  const vendorLines: string[] = ['\n\n---\n### 🔍 Real Vendors Found on Vowza\n'];
  for (const v of ragResult.vendors.slice(0, 5)) {
    const name  = v.stage_name || v.full_name || 'Vendor';
    const prof  = v.profession.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const price = v.price_min ? (v.price_min >= 100000 ? `₹${(v.price_min/100000).toFixed(1)}L` : `₹${(v.price_min/1000).toFixed(0)}K`) : 'On Request';
    vendorLines.push(`- **${name}** (${prof}, ${v.city ?? 'India'}) — Starting ${price} | ${v.average_rating > 0 ? `${v.average_rating.toFixed(1)}⭐` : 'New'} | ${v.is_verified ? '✅ Verified' : ''} — [View Profile](/artist/${v.provider_id})`);
  }
  vendorLines.push('\n_Powered by live Vowza marketplace data_');
  return veDAText + vendorLines.join('\n');
}
export async function sendMessage(opts: SendOptions): Promise<SendResult> {
  const { message, history, context, onChunk } = opts;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
  const directKey   = import.meta.env.VITE_OPENAI_KEY    as string | undefined;
  const useEdge     = import.meta.env.VITE_USE_AI_PROXY   === 'true';

  // Always run the deterministic context extractor to update PlannerContext
  // regardless of which LLM mode we use.
  const { updatedContext } = await processMessage(message, context);

  // ── RAG: Retrieve real vendor data BEFORE calling the LLM ─────────────────
  // This runs in parallel with context extraction for performance.
  const ragResult = await retrieveVendors(message, updatedContext, 8);
  const ragContext = buildRAGContext(ragResult);

  // ── Mode 1: Edge Function proxy ────────────────────────────────────────────
  if (useEdge && supabaseUrl) {
    try {
      const messages = buildMessages(history, message, ragContext);
      const fullText = await callViaEdgeFunction(messages, supabaseUrl, onChunk);
      return { fullText, aiResponse: { type: 'text', text: fullText }, updatedContext };
    } catch (err) {
      console.warn('[VEDA] Edge Function failed, falling back to deterministic:', err);
      // fall through to deterministic
    }
  }

  // ── Mode 2: Direct OpenAI ──────────────────────────────────────────────────
  if (directKey && directKey.startsWith('sk-') && directKey !== 'sk-your-key-here') {
    try {
      const messages = buildMessages(history, message, ragContext);
      const fullText = await callDirectOpenAI(messages, directKey, onChunk);
      return { fullText, aiResponse: { type: 'text', text: fullText }, updatedContext };
    } catch (err) {
      console.warn('[VEDA] OpenAI direct call failed, falling back to deterministic:', err);
      // fall through to deterministic
    }
  }

  // ── Mode 3: Deterministic VEDA engine ─────────────────────────────────────
  // Inject RAG vendor data into the deterministic response if vendors were found
  const { response } = await processMessage(message, context);
  const finalText = ragResult.vendors.length > 0
    ? injectRAGIntoVEDA(response.text, ragResult)
    : response.text;
  await streamDeterministic(finalText, onChunk);
  return { fullText: finalText, aiResponse: { ...response, text: finalText }, updatedContext };
}
