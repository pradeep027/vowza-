/**
 * P0 Phase H — EDGE FUNCTION AUTHORIZATION regression for the create-booking
 * function.
 *
 * THE HOLE (was live, dead-but-reachable): supabase/functions/create-booking
 * was a second booking-creation path that read the authoritative financial
 * values base_amount / addons_amount / total_amount STRAIGHT FROM THE REQUEST
 * BODY and inserted them into the per-category booking tables, built its client
 * from the SERVICE_ROLE key, and advertised itself as a non-bypassable "safe
 * backend path". Its only caller, src/hooks/useSafeBooking.ts, was imported by
 * nothing; every real surface already calls the server-authoritative
 * public.create_<category>_booking RPC (Phase B), which derives all amounts
 * server-side and binds customer_id = auth.uid().
 *
 * THE FIX: the edge function is neutralized — it creates no DB client, reads no
 * financial field, inserts nothing, authenticates the caller, and returns 410
 * directing callers to the RPC. The dead hook is removed. Redeploying this
 * version closes the live hole through the normal deploy flow.
 *
 * STATIC / CONTRACT regression (no network / no Deno runtime): assert the
 * neutralization and that the dead path is gone.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const FN = repoFile('supabase/functions/create-booking/index.ts');
// Strip // comments so prose that names the old fields does not match code probes.
const CODE = FN.replace(/\/\/[^\n]*/g, '');

// Every production .ts/.tsx under src (tests excluded — this file names the dead
// symbols on purpose), for proving the dead path has no references left.
const SRC = abs('src');
const srcFiles = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/__tests__/.test(f))
  .map((f) => readFileSync(`${SRC}/${f}`, 'utf8'));

describe('create-booking edge function — neutralized, no browser-trusted writes', () => {
  it('reads no browser-supplied financial value', () => {
    for (const token of [
      'baseAmount', 'addonsAmount', 'totalAmount',
      'base_amount', 'addons_amount', 'total_amount',
    ]) {
      expect(CODE, `${token} must not appear in create-booking code`).not.toContain(token);
    }
  });

  it('creates no database client and inserts nothing', () => {
    expect(CODE).not.toMatch(/createClient/);
    expect(CODE).not.toMatch(/SERVICE_ROLE_KEY/);
    expect(CODE).not.toMatch(/\.insert\(/);
    expect(CODE).not.toMatch(/\.from\(/);
  });

  it('still refuses anonymous callers and non-POST methods', () => {
    expect(CODE).toMatch(/authorization/i);
    expect(CODE).toMatch(/\b401\b/);
    expect(CODE).toMatch(/\b405\b/);
  });

  it('returns 410 Gone with a deprecation code pointing at the RPC', () => {
    expect(CODE).toMatch(/\b410\b/);
    expect(CODE).toMatch(/DEPRECATED_USE_RPC/);
    expect(CODE).toMatch(/create_<category>_booking|create_.*_booking/);
  });
});

describe('create-booking — the dead client path is gone', () => {
  it('removes the useSafeBooking hook', () => {
    expect(existsSync(abs('src/hooks/useSafeBooking.ts'))).toBe(false);
  });

  it('leaves no source reference to the hook or the create-booking endpoint', () => {
    for (const src of srcFiles) {
      expect(src).not.toMatch(/useSafeBooking/);
      expect(src).not.toMatch(/functions\/v1\/create-booking/);
    }
  });

  it('keeps the server-authoritative per-category RPC path as the live one', () => {
    const anyRpc = srcFiles.some((s) => /create_[a-z_]+_booking/.test(s));
    expect(anyRpc, 'at least one create_<category>_booking RPC call must remain').toBe(true);
  });
});
