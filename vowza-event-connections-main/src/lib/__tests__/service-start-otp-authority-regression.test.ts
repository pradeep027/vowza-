/**
 * P0 Phase I — OTP / APPLICATION-LEVEL VERIFICATION regression.
 *
 * The service-start OTP is a critical, settlement-adjacent flow (it is the gate
 * a vendor must pass, with a customer-held code, before a booking flips to
 * in_progress and work begins). It was already hardened historically, but it had
 * ZERO automated coverage, so a future refactor could silently regress any of
 * its guarantees. This pins the security contract.
 *
 * WHAT IS LOCKED (all verified live):
 *  - Edge functions derive the vendor identity SERVER-SIDE from the verified JWT
 *    (auth.getUser() → userData.user.id) and never from a client-supplied id;
 *    the service_role client is only ever built in the function, never exposed.
 *  - verify refuses anything but a 6-digit code; neither function ever logs the
 *    plaintext OTP; both require a Bearer token and POST.
 *  - The RPCs store only a bcrypt hash (never plaintext), use a CSPRNG, expire,
 *    attempt-limit, bind the actor to provider_profiles server-side, are
 *    SECURITY DEFINER + search_path pinned, and are REVOKEd from
 *    PUBLIC/anon/authenticated (service_role only). The OTP table has RLS on and
 *    no client grant, so no browser can read even the hash.
 *  - The browser only forwards bookingId/bookingSource/otp — it never generates
 *    or compares a code.
 *  - ProviderRegistration's phone "OTP" is a cosmetic client gate (STOP 1: real
 *    verification needs an SMS provider + credentials). It must therefore NEVER
 *    persist a phone-verification trust field — that would be a browser-controlled
 *    approval value. This asserts it stays non-persisted.
 *
 * STATIC / CONTRACT regression (no network / no Deno runtime). Real Postgres
 * behaviour is proven at APPLY time by the migrations themselves.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const SEND = repoFile('supabase/functions/send-service-start-otp/index.ts');
const VERIFY = repoFile('supabase/functions/verify-service-start-otp/index.ts');
const SVC = repoFile('src/services/bookingExecutionService.ts');
const REG = repoFile('src/pages/ProviderRegistration.tsx');

// The authoritative OTP SQL may live under migrations-archive/, the consolidated
// baseline, or a future active migration — find it wherever it is so this
// survives a squash/promote. Concatenate every SQL file that defines the RPC.
const SQL_ROOT = abs('supabase');
const OTP_SQL = readdirSync(SQL_ROOT, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.sql$/i.test(f))
  .map((f) => readFileSync(`${SQL_ROOT}/${f}`, 'utf8'))
  .filter((s) => /create_service_start_otp/.test(s))
  .join('\n');

describe('service-start OTP — edge functions derive identity server-side', () => {
  it('sender takes the vendor id from the verified JWT, never from the body', () => {
    expect(SEND).toMatch(/auth\.getUser\(\)/);
    expect(SEND).toMatch(/p_vendor_user_id:\s*userData\.user\.id/);
    expect(SEND).not.toMatch(/p_vendor_user_id:\s*body\./);
    // identity is resolved on an anon-key client scoped to the caller's header;
    // the service_role client is only built in-function to call the RPC.
    expect(SEND).toMatch(/createClient\(\s*supabaseUrl\s*,\s*anonKey/);
    expect(SEND).toMatch(/createClient\(\s*supabaseUrl\s*,\s*serviceRoleKey\s*\)/);
  });

  it('verifier binds the vendor id to the JWT and only accepts a 6-digit code', () => {
    expect(VERIFY).toMatch(/p_vendor_user_id:\s*userData\.user\.id/);
    expect(VERIFY).not.toMatch(/p_vendor_user_id:\s*body\./);
    expect(VERIFY).toMatch(/\/\^\[0-9\]\{6\}\$\//);
    expect(VERIFY).toMatch(/verify_service_start_otp/);
  });

  it('both functions require POST + a Bearer token', () => {
    for (const fn of [SEND, VERIFY]) {
      expect(fn).toMatch(/\b405\b/);
      expect(fn).toMatch(/\b401\b/);
      expect(fn).toMatch(/Bearer /);
    }
  });

  it('neither function ever logs the plaintext OTP', () => {
    expect(SEND).not.toMatch(/console\.(log|info|warn|error)\([^)]*otp_code/);
    expect(VERIFY).not.toMatch(/console\.(log|info|warn|error)\([^)]*body\.otp/);
    expect(VERIFY).not.toMatch(/console\.(log|info|warn|error)\([^)]*p_otp/);
  });
});

describe('service-start OTP — the SQL contract is server-authoritative', () => {
  it('defines the hardened RPC somewhere in the SQL corpus', () => {
    expect(OTP_SQL.length).toBeGreaterThan(0);
    expect(OTP_SQL).toMatch(/verify_service_start_otp/);
  });

  it('stores a bcrypt hash from a CSPRNG, never plaintext, and expires', () => {
    expect(OTP_SQL).toMatch(/gen_random_bytes/);
    expect(OTP_SQL).toMatch(/crypt\(/);
    expect(OTP_SQL).toMatch(/gen_salt\(\s*'bf'/);
    expect(OTP_SQL).toMatch(/otp_hash/);
    expect(OTP_SQL).toMatch(/interval\s*'10 minutes'/);
  });

  it('attempt-limits and binds the actor to provider_profiles server-side', () => {
    expect(OTP_SQL).toMatch(/max_attempts/);
    expect(OTP_SQL).toMatch(/too_many_attempts/);
    expect(OTP_SQL).toMatch(/UNAUTHORIZED_VENDOR/);
    expect(OTP_SQL).toMatch(/provider_profiles/);
  });

  it('is SECURITY DEFINER, search_path pinned, and service_role-only', () => {
    expect(OTP_SQL).toMatch(/SECURITY DEFINER/i);
    expect(OTP_SQL).toMatch(/search_path\s*=\s*public/i);
    expect(OTP_SQL).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_service_start_otp[^;]*FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(OTP_SQL).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_service_start_otp[^;]*TO\s+service_role/i,
    );
  });

  it('locks the OTP table under RLS with no client grant', () => {
    expect(OTP_SQL).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(OTP_SQL).toMatch(
      /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.booking_start_otps\s+FROM\s+anon,\s*authenticated/i,
    );
  });
});

describe('service-start OTP — the browser never generates or compares a code', () => {
  it('only forwards bookingId/bookingSource/otp to the edge function', () => {
    expect(SVC).toMatch(/functions\.invoke\(/);
    expect(SVC).toMatch(/action === 'verify'/);
    expect(SVC).not.toMatch(/Math\.random/);
    expect(SVC).not.toMatch(/gen_random/);
    // the browser must not pretend to know the vendor identity
    expect(SVC).not.toMatch(/vendor_user_id|vendorUserId/);
  });
});

describe('provider registration — the cosmetic phone gate persists no trust', () => {
  it('never writes a phone-verification field (would be a browser-trusted flag)', () => {
    // The simulated phone OTP is a client-only step gate. Wiring real SMS needs a
    // provider + credentials (parked). Until then it must grant NO server trust:
    // persisting phone_verified from the client gate would be a forbidden
    // browser-controlled approval value.
    expect(REG).not.toMatch(/phone_verified/);
  });
});
