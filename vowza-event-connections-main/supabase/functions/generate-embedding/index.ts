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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
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

  const details = provider.vendor_details || provider.category_details || {};
  for (const [k, v] of Object.entries(details)) {
    if (v && typeof v !== "object") parts.push(`${k}: ${v}`);
  }

  return parts.join(". ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── Auth check ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return json({ error: "Supabase environment not configured" }, 500);
    }

    // Verify the user is authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // Verify user has admin role
    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return json({ error: "Admin role required" }, 403);
    }

    // ── Parse request ─────────────────────────────────────────────────────────
    let provider_id: string;
    try {
      const body = await req.json();
      provider_id = body.provider_id;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!provider_id || typeof provider_id !== "string") {
      return json({ error: "provider_id is required" }, 400);
    }

    // ── Check OpenAI key ──────────────────────────────────────────────────────
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey || !openaiKey.startsWith("sk-")) {
      return json(
        {
          error: "OPENAI_API_KEY not configured. Run: supabase secrets set OPENAI_API_KEY=sk-...",
          provider_id,
          success: false,
        },
        503
      );
    }

    // ── Fetch vendor data (using service role to bypass RLS) ──────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: provider, error: provErr } = await adminClient
      .from("provider_profiles")
      .select("*")
      .eq("id", provider_id)
      .single();

    if (provErr || !provider) {
      return json(
        { error: `Vendor not found: ${provErr?.message || "no data"}`, provider_id, success: false },
        404
      );
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
      return json(
        { error: "Vendor profile has no embeddable content", provider_id, success: false },
        422
      );
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
      return json(
        {
          error: `OpenAI API error ${openaiRes.status}: ${detail.slice(0, 200)}`,
          provider_id,
          success: false,
        },
        502
      );
    }

    const openaiData = await openaiRes.json();
    const embedding: number[] | undefined = openaiData?.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      return json(
        { error: "OpenAI returned no embedding data", provider_id, success: false },
        502
      );
    }

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      return json(
        {
          error: `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`,
          provider_id,
          success: false,
        },
        502
      );
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
      return json(
        {
          error: `Database write failed: ${upsertErr.message}`,
          provider_id,
          success: false,
        },
        500
      );
    }

    // ── Success ───────────────────────────────────────────────────────────────
    return json(
      {
        success: true,
        provider_id,
        dimensions: embedding.length,
        content_length: text.length,
      },
      200
    );
  } catch (err: any) {
    return json(
      { error: `Unexpected error: ${err?.message || "unknown"}`, success: false },
      500
    );
  }
});
