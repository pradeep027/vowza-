// Server-only Hindsight adapter for the Vowza web app's AI Planner.
// Hindsight credentials are read exclusively from Edge Function secrets.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { HindsightClient, HindsightError } from "npm:@vectorize-io/hindsight-client@0.10.1";
import {
  buildRecallQuery,
  buildRetentionRecord,
  hindsightBankIdForUser,
  normalizePlannerMemoryContext,
  summarizeRecallResults,
  type PlannerMemoryContext,
} from "../_shared/plannerMemory.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const REQUEST_TIMEOUT_MS = 4_000;
const MAX_RECALL_TOKENS = 1_000;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

let cachedClient: HindsightClient | null = null;
function hindsightClient(): HindsightClient | null {
  if (cachedClient) return cachedClient;
  const baseUrl = Deno.env.get("HINDSIGHT_BASE_URL");
  const apiKey = Deno.env.get("HINDSIGHT_API_KEY");
  if (!baseUrl || !apiKey) return null;
  try {
    new URL(baseUrl);
  } catch {
    return null;
  }
  cachedClient = new HindsightClient({ baseUrl, apiKey, maxAttempts: 1, userAgent: "vowza-planner/1.0" });
  return cachedClient;
}

function httpStatus(error: unknown): number | undefined {
  if (error instanceof HindsightError) return error.statusCode;
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const value = (error as { statusCode?: unknown }).statusCode;
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function authenticate(req: Request): Promise<{ id: string; ownsConversation: (id: string) => Promise<boolean>; ownsEvent: (id: string) => Promise<boolean> } | null> {
  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !supabaseUrl || !supabaseAnonKey) return null;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return {
    id: user.id,
    ownsConversation: async (conversationId: string) => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) return false;
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      return !error && Boolean(data);
    },
    ownsEvent: async (eventId: string) => {
      if (!/^[0-9a-f-]{36}$/i.test(eventId)) return false;
      const { data, error } = await supabase
        .from('event_states')
        .select('event_id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();
      return !error && Boolean(data);
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await authenticate(req);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const bankId = hindsightBankIdForUser(user.id);
    if (!bankId) return json({ error: "Invalid authenticated user" }, 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (!isRecord(body) || (body.action !== "recall" && body.action !== "retain")) {
      return json({ error: "Unsupported memory action" }, 400);
    }

    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    if (!await user.ownsConversation(conversationId)) {
      // Do not reveal whether another user's conversation ID exists.
      return json({ error: "Conversation not found" }, 404);
    }

    const client = hindsightClient();
    if (!client) {
      console.warn("[PlannerMemory] Hindsight is not configured; continuing without persistent memory.");
      return json(body.action === "recall"
        ? { success: false, memories: [], context: {} }
        : { success: false, retained: false });
    }

    if (body.action === "recall") {
      const message = typeof body.message === "string" ? body.message.slice(0, 2_000) : "";
      if (!message.trim()) return json({ error: "A planning query is required" }, 400);
      const context: PlannerMemoryContext = normalizePlannerMemoryContext(body.context);
      if (!context.eventId || !await user.ownsEvent(context.eventId)) {
        return json({ success: true, memories: [], context: {} });
      }
      try {
        const result = await client.recall(
          bankId,
          buildRecallQuery(message, context),
          {
            maxTokens: MAX_RECALL_TOKENS,
            budget: "low",
            preferObservations: true,
            includeEntities: false,
            tags: ["vowza-planner", `vowza-event-${context.eventId}`],
            tagsMatch: "all_strict",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          },
        );
        const summary = summarizeRecallResults(result.results, context);
        console.info("[PlannerMemory] Recall completed", { resultCount: summary.memories.length });
        return json({ success: true, ...summary });
      } catch (error) {
        const status = httpStatus(error);
        // A first-time user has no bank yet; that is an empty-memory result, not an error.
        if (status === 404) return json({ success: true, memories: [], context: {} });
        console.warn("[PlannerMemory] Recall unavailable; chat continues without persistent memory.", { status });
        return json({ success: false, memories: [], context: {} });
      }
    }

    const userMessage = typeof body.userMessage === "string" ? body.userMessage.slice(0, 2_000) : "";
    const changedFields = Array.isArray(body.changedFields)
      ? body.changedFields.filter((value): value is string => typeof value === "string").slice(0, 40)
      : [];
    const stateEventId = isRecord(body.state) && typeof body.state.eventId === "string" ? body.state.eventId : "";
    if (!stateEventId || !await user.ownsEvent(stateEventId)) {
      return json({ success: true, retained: false });
    }
    const record = buildRetentionRecord(body.state, changedFields, userMessage, conversationId);
    if (!record) return json({ success: true, retained: false });

    try {
      await client.createBank(bankId, {
        name: "Vowza AI Planner",
        reflectMission: "Recall relevant user-provided event planning context for the Vowza AI Planner. Current user statements and current Vowza marketplace records take precedence over historical memories.",
        retainMission: "Retain only explicit event-planning facts and preferences in the supplied Vowza event-state snapshot. Never infer cultural or personal attributes; do not retain secrets, contact/payment credentials, vendor marketplace records, or unrelated conversation text.",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      await client.retain(bankId, record.content, {
        timestamp: record.timestamp,
        context: record.context,
        metadata: record.metadata,
        documentId: record.documentId,
        tags: record.tags,
        updateMode: "replace",
        async: false,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      console.info("[PlannerMemory] Event context retained", { fields: Object.keys(record.metadata).length - 3 });
      return json({ success: true, retained: true });
    } catch (error) {
      console.warn("[PlannerMemory] Retention unavailable; chat continues normally.", { status: httpStatus(error) });
      return json({ success: false, retained: false });
    }
  } catch {
    // Keep provider details and user text out of client responses and logs.
    console.warn("[PlannerMemory] Request failed; chat continues normally.");
    return json({ error: "Planner memory unavailable" }, 500);
  }
});
