// ─── Supabase Edge Function: delete-account ──────────────────────────────────
// Self-service account deletion. The caller may ONLY delete their own account
// (identity is derived from the caller's JWT, never from a client-supplied ID)
// — this is the safety boundary that makes this endpoint acceptable to expose.
//
// Deploy:  supabase functions deploy delete-account
// Requires SUPABASE_SERVICE_ROLE_KEY to be set as a function secret (Supabase
// sets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY automatically in most projects;
// verify with `supabase secrets list` and set manually if missing).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Supabase env not configured" }, 500);
  }

  // 1) Identify the caller from their own JWT (anon-scoped client — cannot be spoofed)
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  // 2) Perform the deletion with the service role client, scoped strictly to user.id
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    await admin.from("notifications").delete().eq("user_id", user.id);
    await admin.from("favorites").delete().eq("user_id", user.id);
    await admin.from("ai_conversations").delete().eq("user_id", user.id);
    await admin.from("user_roles").delete().eq("user_id", user.id);
    await admin.from("profiles").delete().eq("id", user.id);

    const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      console.error("[delete-account] auth.deleteUser:", deleteErr.message);
      return json({ error: "Failed to delete account" }, 500);
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error("[delete-account] unexpected:", err);
    return json({ error: "Failed to delete account" }, 500);
  }
});
