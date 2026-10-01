/**
 * Generic public.bookings UPDATE policy hardening (SECURITY FIX / defense-in-depth).
 *
 * THE FINDING: the baseline "Booking parties can update" policy on public.bookings
 * (migrations-archive/CONSOLIDATED_MIGRATION.sql) is FOR UPDATE with:
 *   - no `TO authenticated` (written against PUBLIC), and
 *   - no explicit `WITH CHECK`.
 * It is NOT an open write (anon is revoked at the table grant by
 * 20261201000005, and Postgres reuses USING as the new-row check when WITH CHECK
 * is omitted), so this is peer-consistency + robustness, not an active exploit.
 *
 * THE FIX (migration 20261250000000): recreate the SAME-named policy with the SAME
 * ownership predicate but scoped `TO authenticated` and with an EXPLICIT WITH CHECK
 * equal to USING. Predicate-preserving; no financial/column lockdown here.
 *
 * WHAT THIS TEST LOCKS: a STATIC contract regression (no DB). Row-level enforcement
 * is proven at APPLY time by the migration's catalog assertion + anon probe. Here we
 * lock the recreated shape (TO authenticated, USING + WITH CHECK both carrying the
 * ownership predicate), that it does NOT widen to a financial-column write, and that
 * the apply-time proofs are present, so the hardening cannot silently regress.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const MIGRATION = repoFile(
  'supabase/migrations/20261250000000_tighten_generic_bookings_update_policy.sql',
);

describe('generic bookings UPDATE hardening — on the apply path', () => {
  it('lives in supabase/migrations/ (apply path), wrapped BEGIN/COMMIT + schema reload', () => {
    expect(abs('supabase/migrations/20261250000000_tighten_generic_bookings_update_policy.sql'))
      .toContain('migrations');
    expect(MIGRATION).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(MIGRATION).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });
});

describe('generic bookings UPDATE hardening — the recreated policy', () => {
  it('recreates "Booking parties can update" FOR UPDATE TO authenticated', () => {
    expect(MIGRATION).toMatch(/DROP POLICY IF EXISTS "Booking parties can update" ON public\.bookings/);
    expect(MIGRATION).toMatch(
      /CREATE POLICY "Booking parties can update" ON public\.bookings\s*FOR UPDATE TO authenticated/,
    );
  });

  it('preserves the ownership predicate in BOTH USING and an explicit WITH CHECK', () => {
    // The block must contain a USING(...) and a WITH CHECK(...), each with the
    // customer-or-provider ownership predicate.
    const usingBlock = MIGRATION.match(/USING \(([\s\S]*?)\)\s*WITH CHECK/);
    expect(usingBlock, 'USING(...) block not found').toBeTruthy();
    expect(usingBlock![1]).toMatch(/auth\.uid\(\) = customer_id/);
    expect(usingBlock![1]).toMatch(/id = provider_id AND user_id = auth\.uid\(\)/);

    const checkBlock = MIGRATION.match(/WITH CHECK \(([\s\S]*?)\)\s*;/);
    expect(checkBlock, 'WITH CHECK(...) block not found').toBeTruthy();
    expect(checkBlock![1]).toMatch(/auth\.uid\(\) = customer_id/);
    expect(checkBlock![1]).toMatch(/id = provider_id AND user_id = auth\.uid\(\)/);
  });

  it('does NOT lock any financial column (that is the PARKED Phase B companion)', () => {
    // Guard against scope creep: this hardening touches only role + WITH CHECK.
    expect(MIGRATION).not.toMatch(/\bamount\b/i);
    expect(MIGRATION).not.toMatch(/platform_fee/i);
    expect(MIGRATION).not.toMatch(/total_amount/i);
  });
});

describe('generic bookings UPDATE hardening — apply-time proofs', () => {
  it('includes an executable anon-denied UPDATE probe', () => {
    expect(MIGRATION).toMatch(/SET LOCAL ROLE anon;/);
    expect(MIGRATION).toMatch(/UPDATE public\.bookings SET status = status/);
    expect(MIGRATION).toMatch(/PROBE_FAIL: anon UPDATE on public\.bookings was NOT rejected/);
  });

  it('asserts via pg_policies that the policy is strictly TO authenticated with WITH CHECK', () => {
    expect(MIGRATION).toMatch(/FROM pg_policies/);
    expect(MIGRATION).toMatch(/policyname = 'Booking parties can update'/);
    expect(MIGRATION).toMatch(/v_cmd <> 'UPDATE'/);
    expect(MIGRATION).toMatch(/'authenticated' = ANY \(v_roles\)/);
    // Must reject a lingering PUBLIC scope and a NULL WITH CHECK.
    expect(MIGRATION).toMatch(/'public' = ANY \(v_roles\)/);
    expect(MIGRATION).toMatch(/v_check IS NULL/);
  });
});
