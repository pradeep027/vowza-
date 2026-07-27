// ─── Supabase Edge Function: ai-chat ─────────────────────────────────────────
// Secure server-side proxy for OpenAI.
// The OPENAI_API_KEY lives only in Supabase secrets — never in the browser.
//
// Deploy:
//   supabase secrets set OPENAI_API_KEY=sk-...
//   supabase functions deploy ai-chat
//
// Then in .env set:  VITE_USE_AI_PROXY=true

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL          = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are VEDA (Vowza Event Digital Assistant) — the AI Event Director for Vowza, India's premier event marketplace.

You are NOT a chatbot. You are a professional AI Event Director who thinks, analyses, plans, and optimises every event like a top-tier event management company.

PERSONALITY: Warm, confident, professional, highly intelligent. Sound like a premium personal consultant — never robotic.

SUPPORTED EVENTS: Wedding, Reception, Engagement, Haldi, Mehendi, Sangeet, Birthday, Baby Shower, House Warming, Anniversary, Corporate, Conference, Product Launch, College Fest, DJ Night, Concert, Fashion Show, Sports Event, Temple Event, Charity, Private Party, Festival.

PRICING RULES (realistic Indian market 2025):
- City: Mumbai 1.55x | Delhi 1.45x | Bangalore 1.35x | Chennai 1.15x | Hyderabad 1.0x | Pune 1.12x
- Season: Peak Nov-Feb 1.3x | Off-peak summer 0.88x | Monsoon 0.82x
- Style: Luxury 2.6x | Premium 1.65x | Standard 1.0x | Budget 0.58x

RULES:
1. Think before every response
2. Use markdown formatting: **bold**, tables, bullet lists
3. Never hallucinate prices
4. Always show cost reasoning
5. End every complete plan with a Success Score (0-100)`;

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: Message[];
}

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Validate API key ────────────────────────────────────────────────────────
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY not configured. Run: supabase secrets set OPENAI_API_KEY=sk-..." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Parse request ───────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages = [] } = body;

  // Always prepend the VEDA system prompt
  const fullMessages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.filter((m: Message) => m.role !== "system").slice(-20), // keep last 20
  ];

  // ── Forward to OpenAI with streaming ───────────────────────────────────────
  const openaiRes = await fetch(OPENAI_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       MODEL,
      messages:    fullMessages,
      stream:      true,
      temperature: 0.7,
      max_tokens:  2048,
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: `OpenAI API error ${openaiRes.status}: ${errText}` }),
      { status: openaiRes.status, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Stream OpenAI response directly back to client ─────────────────────────
  return new Response(openaiRes.body, {
    status:  200,
    headers: {
      "Content-Type":                "text/event-stream; charset=utf-8",
      "Cache-Control":               "no-cache",
      "Connection":                  "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
