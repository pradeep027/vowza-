/**
 * Executable security probes — apply-time negative regression gate (SECURITY).
 *
 * WHY THIS EXISTS: the self-booking (20261247000000), server-authoritative amount
 * (20261213000000) and status-DAG (20261238000000) protections are enforced in
 * the DATABASE (SECURITY DEFINER RPCs + BEFORE triggers), which vitest cannot
 * execute. Migration 20261251000000 adds EXECUTABLE apply-time probes that drive
 * those invariants through the real production RPC/trigger path and ABORT the
 * push if any regressed. This test is the STATIC guard on that gate: it locks the
 * probe migration's shape so the executable proofs cannot silently rot or be
 * weakened into no-ops.
 *
 * It makes NO DB connection — the real proof runs at `supabase db push`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const MIGRATION = repoFile(
  'supabase/migrations/20261251000000_executable_security_probes.sql',
);
// Comment-stripped view so negative/token assertions can't be satisfied by prose.
const CODE = MIGRATION.replace(/--[^\n]*/g, '');

describe('executable security probes — on the apply path', () => {
  it('lives in supabase/migrations/ (apply path), wrapped BEGIN/COMMIT + schema reload', () => {
    expect(abs('supabase/migrations/20261251000000_executable_security_probes.sql'))
      .toContain('migrations');
    expect(CODE).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(CODE).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });

  it('is schema-NEUTRAL — adds no table/column/policy/function/trigger', () => {
    expect(CODE).not.toMatch(/CREATE\s+TABLE/i);
    expect(CODE).not.toMatch(/ALTER\s+TABLE/i);
    expect(CODE).not.toMatch(/CREATE\s+POLICY/i);
    expect(CODE).not.toMatch(/CREATE\s+(OR REPLACE\s+)?FUNCTION/i);
    expect(CODE).not.toMatch(/CREATE\s+TRIGGER/i);
  });

  it('drives the probes through the authoritative RPC/trigger path (not raw INSERT)', () => {
    expect(CODE).toMatch(/public\.create_dancer_booking\(/);
    // Impersonation is driven by the request.jwt.claims GUC only (auth.uid()),
    // NOT a SQL-role switch: `SET LOCAL ROLE authenticated` made these probes
    // brittle under `supabase db push` (spurious 42501 permission-denied on a
    // category table) — the same apply-session artifact fixed in 20261248000000.
    // The SECURITY DEFINER RPC + triggers key off auth.uid(), so the JWT claim
    // alone drives every proof; locking out SET LOCAL ROLE prevents regression.
    expect(CODE).toMatch(/set_config\('request\.jwt\.claims'/);
    expect(CODE).not.toMatch(/SET LOCAL ROLE/);
  });
});

describe('executable security probes — the three invariants', () => {
  it('probe 1 asserts self-booking is rejected 42501 on the RPC path', () => {
    expect(CODE).toMatch(/insufficient_privilege/); // 42501
    expect(CODE).toMatch(/PROBE_FAIL: provider self-booked their own dancer package/);
  });

  it('probe 2 asserts the stored total_amount equals the authoritative package price', () => {
    expect(CODE).toMatch(/total_amount\b/);
    expect(CODE).toMatch(/v_stored IS DISTINCT FROM v_price/);
    expect(CODE).toMatch(/PROBE_FAIL: stored total_amount .* authoritative package price/);
  });

  it('probe 2 asserts an illegal pending->completed status jump is rejected 23514', () => {
    expect(CODE).toMatch(/UPDATE public\.dancer_bookings SET status = 'completed'/);
    expect(CODE).toMatch(/check_violation/); // 23514
    expect(CODE).toMatch(/SQLSTATE = '23514'/);
    expect(CODE).toMatch(/PROBE_FAIL: illegal pending->completed status jump was NOT rejected/);
  });
});

describe('executable security probes — safe + non-destructive', () => {
  it('skips cleanly when the DB lacks fixtures (empty CI/shadow DB)', () => {
    expect(CODE).toMatch(/probe 1 SKIPPED/);
    expect(CODE).toMatch(/probe 2 SKIPPED/);
  });

  it('discards any seeded row with a ROLLBACK_PROBE sentinel — nothing persists', () => {
    expect(CODE).toMatch(/RAISE EXCEPTION 'ROLLBACK_PROBE'/);
    expect(CODE).toMatch(/SQLERRM LIKE 'ROLLBACK_PROBE%'/);
  });

  it('needs a NON-owner customer for the amount/status probe (not a self-booking)', () => {
    expect(CODE).toMatch(/FROM auth\.users WHERE id <> v_owner/);
  });
});
