// ─── Supabase Edge Function: ai-chat ─────────────────────────────────────────
// Proxies OpenAI requests server-side so the API key never reaches the browser.
// Deploy: supabase functions deploy ai-chat
// Env:    supabase secrets set OPENAI_API_KEY=sk-...

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Verify Supabase JWT (optional but recommended for production)
    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey  = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase     = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Parse request ──────────────────────────────────────────────────────
    const { messages } = await req.json();
    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "No messages" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 503, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Forward to OpenAI with streaming ──────────────────────────────────
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model:       "gpt-4o-mini",
        messages,
        stream:      true,
        temperature: 0.7,
        max_tokens:  2500,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: openaiRes.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Stream the SSE response straight through ──────────────────────────
    return new Response(openaiRes.body, {
      headers: {
        ...CORS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
