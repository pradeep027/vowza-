// ─── Supabase Edge Function: admin-user-roles ────────────────────────────────
// Grants and revokes roles. Replaces the browser-side INSERT/DELETE on
// public.user_roles in src/pages/admin/AdminAdmins.tsx, which migration
// 20261201000002 revoked.
//
// Deploy:  supabase functions deploy admin-user-roles
//
// ─── WHY THIS IS A SEPARATE FUNCTION ─────────────────────────────────────────
// Not folded into admin-provider-verification, because that one authorizes on
// `admin` and this one must authorize on `super_admin`. Sharing a deployable
// would mean one accidental refactor of the shared gate silently widens who can
// mint admins. The role-mutation primitive gets its own blast radius.
//
// ─── WHERE THE AUTHORIZATION ACTUALLY LIVES ──────────────────────────────────
// Not here. This function's only security job is to establish *who is calling*
// by verifying their JWT, and to pass that verified id to
// public.admin_set_user_role, which decides everything else and writes the
// audit row in the same transaction as the mutation.
//
// That split is deliberate. If the gate lived here, an authorization decision
// and the state change it guards would sit in two different systems with a
// network hop between them, and a denial would be recorded — if at all — by the
// party being denied. In the RPC they cannot come apart: either both the role
// change and its audit row commit, or neither does.
//
// So this file must never make an allow/deny decision of its own. The
// validation below is input hygiene, to fail obvious junk cheaply — it is not a
// substitute for anything the RPC checks, and the RPC re-checks all of it.
//
// ─── ENVIRONMENT ─────────────────────────────────────────────────────────────
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Supabase injects
// all three; confirm with `supabase secrets list`. verify_jwt stays at its
// default of true (see config.toml) so GoTrue rejects anonymous callers before
// this code runs — one layer above the check performed here.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Explicit allowlist. Vercel preview deployments are deliberately absent: a
// preview URL is world-guessable and this endpoint mints admins.
const ALLOWED_ORIGINS = new Set([
  "https://vowza.co.in",
  "https://www.vowza.co.in",
  "https://vowza-chi.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);

const BASE_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

// Reflects the origin only when it is on the list. An unlisted browser origin
// gets no Access-Control-Allow-Origin at all, so the browser refuses to hand
// the response to the page rather than being told a wrong-but-plausible value.
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin };
  }
  return { ...BASE_HEADERS };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(["grant", "revoke"]);
// 'admin' only. super_admin is excluded because there is one of them; provider
// and customer are excluded because those roles travel with provider_profiles
// rows that make_provider / approve_artist / reject_artist move together, and a
// bare role change here would leave a vendor half-provisioned. The RPC enforces
// the same restriction, and that copy is the authoritative one.
const ROLES = new Set(["admin"]);

// Maps the RPC's result code to a status. Kept as data so adding a code to the
// function cannot silently start returning 200 for a refusal.
const STATUS_BY_CODE: Record<string, number> = {
  APPLIED: 200,
  NO_CHANGE: 200,
  INVALID_ACTION: 400,
  INVALID_TARGET: 400,
  ROLE_NOT_MANAGEABLE: 400,
  SELF_MODIFICATION: 400,
  FORBIDDEN: 403,
  TARGET_PROTECTED: 409,
  TARGET_AMBIGUOUS: 409,
  USER_NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, message: "Not signed in." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[admin-user-roles] missing env: url=%s anon=%s service=%s",
      !!supabaseUrl, !!anonKey, !!serviceRoleKey);
    return json({ success: false, message: "Server is not configured." }, 500);
  }

  // ── Establish the caller. This is the only thing this function proves. ──
  // The anon-key client with the caller's Authorization forwarded means GoTrue
  // validates the signature and expiry. The resulting user.id cannot be
  // influenced by the request body.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: authError } = await callerClient.auth.getUser();
  const caller = userData?.user;
  if (authError || !caller) {
    return json({ success: false, message: "Your session has expired. Sign in again." }, 401);
  }

  // ── Input hygiene. Not authorization. ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, message: "Invalid request body." }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (!ACTIONS.has(action)) {
    return json({ success: false, code: "INVALID_ACTION", message: "Invalid action." }, 400);
  }
  if (!ROLES.has(role)) {
    return json({ success: false, code: "ROLE_NOT_MANAGEABLE", message: "That role cannot be changed here." }, 400);
  }

  // Exactly one identifier. userId is the trustworthy one (it comes from
  // user_roles.user_id, which no client can write); email exists for inviting
  // someone whose id the admin does not know yet. Accepting both at once would
  // leave which of the two wins as an implicit detail of the SQL, so refuse.
  if (!!email === !!userId) {
    return json({ success: false, code: "INVALID_TARGET",
      message: "Provide either an email address or a user id." }, 400);
  }
  if (email && !EMAIL_RE.test(email)) {
    return json({ success: false, code: "INVALID_TARGET", message: "Enter a valid email address." }, 400);
  }
  if (userId && !UUID_RE.test(userId)) {
    return json({ success: false, code: "INVALID_TARGET", message: "Invalid user id." }, 400);
  }

  // ── Hand off. The RPC authorizes, mutates and audits atomically. ──
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // All five parameters are always sent, including the nulls, so PostgREST
  // resolves one unambiguous signature rather than relying on SQL defaults.
  const { data, error } = await serviceClient.rpc("admin_set_user_role", {
    p_actor_id: caller.id,
    p_action: action,
    p_role: role,
    p_target_id: userId || null,
    p_target_email: email || null,
  });

  if (error) {
    // A transport or permission failure reaching the RPC. Nothing was audited,
    // because nothing ran — so this line is the only record. Log the actor and
    // the database's message; never the target's email.
    console.error("[admin-user-roles] rpc failed actor=%s action=%s role=%s code=%s msg=%s",
      caller.id, action, role, error.code ?? "", error.message);
    return json({ success: false, code: "SERVER_ERROR", message: "The role change could not be completed." }, 500);
  }

  const result = (data ?? {}) as { success?: boolean; code?: string; message?: string };
  const code = result.code ?? (result.success ? "APPLIED" : "SERVER_ERROR");
  // Unrecognised code from a newer migration: treat as a failure, not a success.
  // hasOwn, not a bare index: STATUS_BY_CODE is a plain object, so a code of
  // "toString" or "constructor" would return an inherited function instead of
  // undefined, ?? would not fire, and `new Response` would throw with the CORS
  // headers already lost. Unreachable while every code is an RPC literal, but
  // this map is the thing standing between an unknown code and a 200.
  const status = Object.hasOwn(STATUS_BY_CODE, code)
    ? STATUS_BY_CODE[code]
    : (result.success ? 200 : 400);

  if (!result.success) {
    console.warn("[admin-user-roles] refused actor=%s action=%s role=%s code=%s",
      caller.id, action, role, code);
  }

  return json(result, status);
});
