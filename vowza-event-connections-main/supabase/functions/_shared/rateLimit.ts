// ─── Shared: distributed rate limiting for Edge Functions ────────────────────
// Thin wrapper over the server-authoritative public.increment_rate_limit RPC
// (atomic, SECURITY DEFINER, service_role-only — see the rate_limits migration).
// The RPC and its rate_limits table already exist in the DB baseline but NOTHING
// called them; this is the client side that finally wires an un-throttled,
// cost-incurring function (ai-chat → Groq) to it.
//
// SECURITY:
//   - The caller identity is NEVER taken from the request body. Authenticated
//     callers are keyed by the JWT-verified user id ("auth:{id}"); anonymous
//     callers by their forwarded IP ("anon:{ip}").
//   - This module reads no secrets; it uses whatever service-role client the
//     calling function already built in-function.
//   - FAILS OPEN on any limiter error (RPC unreachable / unexpected shape): a
//     limiter outage must never take down the product. It FAILS CLOSED only on
//     an explicit allowed=false, i.e. a real quota breach.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** 60-second windows, matching the rate_limits migration design. */
export const WINDOW_SECONDS = 60;

/** Per-window request ceilings documented in the rate_limits migration. */
export const RATE_LIMITS = {
  AUTHENTICATED: 50,
  ANONYMOUS: 10,
} as const;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Build the rate-limit bucket key. A verified user id yields an authenticated
 * bucket; otherwise the forwarded IP yields an anonymous bucket. Never derive
 * identity from the request body.
 */
export function clientIdFor(
  opts: { userId?: string | null; req?: Request },
): { clientId: string; isAuthenticated: boolean } {
  if (opts.userId) return { clientId: `auth:${opts.userId}`, isAuthenticated: true };
  const fwd = opts.req?.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || "unknown";
  return { clientId: `anon:${ip}`, isAuthenticated: false };
}

/**
 * Atomically consume one unit against (clientId, 60s window) via the RPC.
 * Fails open on error; fails closed only on an explicit allowed=false.
 */
export async function checkRateLimit(
  serviceClient: SupabaseClient,
  clientId: string,
  isAuthenticated: boolean,
  limit: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_SECONDS * 1000);

  try {
    const { data, error } = await serviceClient.rpc("increment_rate_limit", {
      p_client_id: clientId,
      p_is_authenticated: isAuthenticated,
      p_window_start: windowStart.toISOString(),
      p_now: now.toISOString(),
      p_limit: limit,
    });

    if (error) {
      console.error("[rateLimit] RPC error (failing open):", error.message);
      return { allowed: true, limit, remaining: limit, retryAfterSeconds: 0 };
    }

    const row = Array.isArray(data) ? data[0] : data;
    const count: number = row?.new_count ?? 0;
    const allowed = row?.allowed !== false;
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: allowed ? 0 : WINDOW_SECONDS,
    };
  } catch (err) {
    console.error(
      "[rateLimit] unexpected error (failing open):",
      err instanceof Error ? err.message : String(err),
    );
    return { allowed: true, limit, remaining: limit, retryAfterSeconds: 0 };
  }
}
