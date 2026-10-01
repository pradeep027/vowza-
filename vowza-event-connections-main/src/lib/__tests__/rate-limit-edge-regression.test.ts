/**
 * Phase M — RATE LIMITING regression.
 *
 * THE GAP: a full distributed rate limiter (rate_limits table + atomic,
 * service_role-only increment_rate_limit RPC) existed in the DB baseline, but
 * NOTHING called it — the cost-incurring ai-chat edge function (proxies Groq)
 * accepted unlimited requests per authenticated user. generate-embedding is
 * admin-gated (not a broad vector) and the service-start OTP already bounds
 * itself (resend cooldown + max_attempts), so Phase M wires the generic limiter
 * into ai-chat via a shared helper.
 *
 * WHAT IS LOCKED:
 *  - The shared helper calls the atomic RPC, keys the bucket on a server-side
 *    identity (never the body), and FAILS OPEN on limiter error (a limiter
 *    outage must not break the product) but FAILS CLOSED on a real breach.
 *  - ai-chat enforces the limit after auth, keyed by the verified user id,
 *    returns 429 + Retry-After, builds the service-role client only in-function,
 *    and still refuses anonymous/non-POST callers.
 *  - The SQL contract: the RPC is atomic (FOR UPDATE), SECURITY DEFINER,
 *    search_path-pinned, service_role-only; the table has RLS + default deny.
 *
 * STATIC / CONTRACT regression (no network / no Deno runtime).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const HELPER = repoFile('supabase/functions/_shared/rateLimit.ts');
const AI_CHAT = repoFile('supabase/functions/ai-chat/index.ts');

// Strip // line and /* */ block comments so "absent token" probes test the CODE,
// not the prose (e.g. the helper's own comment says "...from the request body.").
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const HELPER_CODE = stripComments(HELPER);

// Locate the limiter SQL wherever it lives (archive / consolidated / future
// active migration) so this survives a squash/promote.
const SQL_ROOT = abs('supabase');
const RL_SQL = readdirSync(SQL_ROOT, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.sql$/i.test(f))
  .map((f) => readFileSync(`${SQL_ROOT}/${f}`, 'utf8'))
  .filter((s) => /increment_rate_limit/.test(s))
  .join('\n');

describe('rate limit helper — atomic RPC, server-side key, fails open', () => {
  it('delegates to the atomic increment_rate_limit RPC', () => {
    expect(HELPER).toMatch(/\.rpc\(\s*["']increment_rate_limit["']/);
    expect(HELPER).toMatch(/p_client_id/);
    expect(HELPER).toMatch(/p_is_authenticated/);
    expect(HELPER).toMatch(/p_limit/);
  });

  it('keys the bucket on identity, never on a body field', () => {
    expect(HELPER).toMatch(/auth:\$\{/);
    expect(HELPER).toMatch(/anon:/);
    expect(HELPER_CODE).not.toMatch(/body\./);
  });

  it('fails open on error and closed only on an explicit breach', () => {
    // both error branches return allowed: true (open); the gate is allowed !== false
    expect(HELPER).toMatch(/failing open/);
    expect(HELPER).toMatch(/allowed:\s*true/);
    expect(HELPER).toMatch(/allowed\s*=\s*row\?\.allowed\s*!==\s*false/);
  });
});

describe('ai-chat — the cost-incurring endpoint is throttled per user', () => {
  it('imports and invokes the shared limiter', () => {
    expect(AI_CHAT).toMatch(/from ["']\.\.\/_shared\/rateLimit\.ts["']/);
    expect(AI_CHAT).toMatch(/checkRateLimit\(/);
    expect(AI_CHAT).toMatch(/RATE_LIMITS\.AUTHENTICATED/);
  });

  it('keys the limit on the verified user id, not the request body', () => {
    expect(AI_CHAT).toMatch(/clientIdFor\(\s*\{\s*userId:\s*user\.id/);
    expect(AI_CHAT).not.toMatch(/clientIdFor\([^)]*body/);
  });

  it('returns 429 with Retry-After when the limit is exceeded', () => {
    expect(AI_CHAT).toMatch(/status:\s*429/);
    expect(AI_CHAT).toMatch(/["']Retry-After["']/);
  });

  it('builds the service-role client in-function and still guards auth/method', () => {
    expect(AI_CHAT).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(AI_CHAT).toMatch(/\b401\b/);
    expect(AI_CHAT).toMatch(/\b405\b/);
  });
});

describe('rate limit — the SQL contract is atomic and server-authoritative', () => {
  it('defines the atomic, service_role-only RPC', () => {
    expect(RL_SQL.length).toBeGreaterThan(0);
    expect(RL_SQL).toMatch(/increment_rate_limit/);
    expect(RL_SQL).toMatch(/FOR UPDATE/i);
    expect(RL_SQL).toMatch(/SECURITY DEFINER/i);
    expect(RL_SQL).toMatch(/search_path\s*=\s*public/i);
    expect(RL_SQL).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.increment_rate_limit[^;]*TO\s+service_role/i,
    );
  });

  it('locks the rate_limits table under RLS with a default deny', () => {
    expect(RL_SQL).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(RL_SQL).toMatch(/rate_limits_default_deny/i);
  });
});
