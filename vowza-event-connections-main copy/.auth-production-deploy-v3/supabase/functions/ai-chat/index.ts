// ─── Supabase Edge Function: ai-chat ─────────────────────────────────────────
// Proxies Groq (OpenAI-compatible Chat Completions) server-side so the API key
// never reaches the browser.
//
// Deploy:  supabase functions deploy ai-chat
// Secret:  supabase secrets set GROQ_API_KEY=<your key>
//
// Request:  { messages: [{ role: 'system'|'user'|'assistant', content: string }] }
// Response: application/x-ndjson — one JSON object per line:
//           { delta: string, done: boolean }  |  { error: string, done: true }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: "Supabase env not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    let messages: LLMMessage[] | undefined;
    try {
      ({ messages } = await req.json());
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (!messages?.length) return json({ error: "No messages" }, 400);

    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) return json({ error: "GROQ_API_KEY not configured" }, 503);

    // Groq is OpenAI-compatible: system/user/assistant roles pass through
    // unchanged, so no role remapping is needed.
    const payload = messages.filter((m) => m.content?.trim());
    if (!payload.length) return json({ error: "No usable message content" }, 400);

    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: payload,
        stream: true,
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => `HTTP ${upstream.status}`);
      return json({ error: `Groq error ${upstream.status}: ${detail}` }, 502);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const body = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

        const reader = upstream.body!.getReader();
        let buf = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });

            const lines = buf.split("\n");
            // Keep the last (possibly incomplete) line in the buffer
            buf = lines.pop() ?? "";

            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const data = t.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed?.choices?.[0]?.delta?.content ?? "";
                if (delta) send({ delta, done: false });
              } catch {
                // ignore partial/malformed SSE frames
              }
            }
          }
          send({ delta: "", done: true });
        } catch (streamErr) {
          send({
            error: streamErr instanceof Error
              ? streamErr.message
              : String(streamErr),
            done: true,
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        ...CORS,
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
