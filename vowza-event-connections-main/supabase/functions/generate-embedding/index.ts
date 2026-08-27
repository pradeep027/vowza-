// ─── Supabase Edge Function: generate-embedding ──────────────────────────────
// Generates OpenAI text-embedding-3-small vectors for vendor profiles and stores
// them in public.vendor_embeddings for pgvector semantic search.
//
// Deploy:  supabase functions deploy generate-embedding
// Secret:  supabase secrets set OPENAI_API_KEY=sk-...
//
// Request:  { provider_id: string }
// Response: { success: boolean, error?: string, provider_id: string }
//
// Security:
//   - Requires authenticated user with admin role
//   - OpenAI API key is server-side only (never sent to client)
//   - Uses service_role to bypass RLS for vendor_embeddings writes

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  Deno.env.get("SUPABASE_URL") || "",
  "https://vavfeataqwwbpjonknne.supabase.co",
  "https://vowza.co.in",
  "https://www.vowza.co.in",
  "http://localhost:5173",
  "http://localhost:8080",
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

// ── Build vendor text for embedding (same logic as frontend embeddingGenerator.ts) ──
function buildVendorText(provider: any, profile: any): string {
  const parts: string[] = [];

  const name = provider.stage_name || profile?.full_name || "";
  const city = provider.service_city || profile?.city || "";
  const prof = (provider.profession ?? "").replace(/_/g, " ");

  if (name) parts.push(`Name: ${name}`);
  if (prof) parts.push(`Category: ${prof}`);
  if (city) parts.push(`City: ${city}`);
  if (provider.bio) parts.push(`About: ${provider.bio.slice(0, 300)}`);

  if (Array.isArray(provider.specialties) && provider.specialties.length)
    parts.push(`Specialties: ${provider.specialties.join(", ")}`);

  if (Array.isArray(provider.languages) && provider.languages.length)
    parts.push(`Languages: ${provider.languages.join(", ")}`);

  if (provider.price_min) {
    const p =
      provider.price_min >= 100000
        ? `₹${(provider.price_min / 100000).toFixed(1)} lakh`
        : `₹${(provider.price_min / 1000).toFixed(0)}K`;
    parts.push(`Starting price: ${p}`);
  }

  if (provider.experience_years)
    parts.push(`Experience: ${provider.experience_years} years`);

  // Deliberately exclude vendor_details/category_details: these JSON fields
  // may contain KYC, bank, address, or document references and must never be
  // copied into searchable embedding content.

  return parts.join(". ");
}

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  try {
    // ── Auth check ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)       return json({ error: "Missing authorization" }, 401, cors);


    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return json({ error: "Service temporarily unavailable" }, 503, cors);
    }

    // Verify the user is authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

    // Verify user has admin role
    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return json({ error: "Admin role required" }, 403, cors);
    }

    // ── Parse request ─────────────────────────────────────────────────────────
    let provider_id: string;
    try {
      const body = await req.json();
      provider_id = body.provider_id;
    } catch {
      return json({ error: "Invalid JSON body" }, 400, cors);
    }

    if (!provider_id || typeof provider_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(provider_id)) {
      return json({ error: "Valid provider_id is required" }, 400, cors);
    }

    // ── Check OpenAI key ──────────────────────────────────────────────────────
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey || !openaiKey.startsWith("sk-")) {
      return json({ error: "Embedding service temporarily unavailable", success: false }, 503, cors);
    }

    // ── Fetch vendor data (using service role to bypass RLS) ──────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: provider, error: provErr } = await adminClient
      .from("provider_profiles")
      .select("id,user_id,stage_name,service_city,profession,bio,specialties,languages,price_min,experience_years")
      .eq("id", provider_id)
      .single();

    if (provErr || !provider) {
      return json({ error: "Vendor not found", provider_id, success: false }, 404, cors);
    }

    // Fetch linked profile for name/city
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name, city, area")
      .eq("id", provider.user_id)
      .maybeSingle();

    // ── Build embedding text ──────────────────────────────────────────────────
    const text = buildVendorText(provider, profile);
    if (!text.trim()) {
      return json({ error: "Vendor profile has no embeddable content", provider_id, success: false }, 422, cors);
    }

    // ── Call OpenAI Embeddings API ────────────────────────────────────────────
    const openaiRes = await fetch(OPENAI_EMBEDDING_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000),
      }),
    });

    if (!openaiRes.ok) {
      const detail = await openaiRes.text().catch(() => `HTTP ${openaiRes.status}`);
      console.error("[generate-embedding] upstream status", openaiRes.status);
      return json({ error: "Embedding provider request failed", provider_id, success: false }, 502, cors);
    }

    const openaiData = await openaiRes.json();
    const embedding: number[] | undefined = openaiData?.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      return json({ error: "Embedding provider returned no data", provider_id, success: false }, 502, cors);
    }

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      return json({ error: "Embedding provider returned invalid data", provider_id, success: false }, 502, cors);
    }

    // ── Store in vendor_embeddings (service role bypasses RLS) ─────────────────
    const { error: upsertErr } = await adminClient
      .from("vendor_embeddings")
      .upsert(
        {
          provider_id,
          content: text,
          embedding: JSON.stringify(embedding),
          content_type: "profile",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider_id" }
      );

    if (upsertErr) {
      console.error("[generate-embedding] database write failed");
      return json({ error: "Embedding could not be saved", provider_id, success: false }, 500, cors);
    }

    // ── Success ───────────────────────────────────────────────────────────────
    return json({ success: true, provider_id, dimensions: embedding.length, content_length: text.length }, 200, cors);
  } catch (err) {
    console.error("[generate-embedding] unexpected error", err instanceof Error ? err.message : "unknown");
    return json({ error: "Embedding request failed", success: false }, 500, cors);
  }
});
