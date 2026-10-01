/**
 * dancer_bookings customer UPDATE authorization parity (BUG FIX).
 *
 * THE GAP: all 14 non-photography category booking tables carry a
 * `<cat>_bookings_customer_update` RLS policy
 * (FOR UPDATE TO authenticated USING (customer_id = auth.uid())
 *  WITH CHECK (customer_id = auth.uid())). dancer_bookings is the ONLY one
 * missing it. src/hooks/useBookings.ts cancelBooking() nonetheless issues a
 * direct customer `.update({ status: 'cancelled' })` on dancer_bookings, so
 * without the policy the customer's dancer cancellation silently matches 0 rows.
 *
 * THE FIX (migration 20261249000000): add dancer_bookings_customer_update in the
 * canonical peer form and harden dancer_bookings_provider_update to parity.
 *
 * WHAT THIS TEST LOCKS: a STATIC contract regression (no DB). The row-level
 * enforcement is proven at APPLY time by the migration's catalog assertion; here
 * we lock that the policy is created with the exact peer shape, that it is scoped
 * TO authenticated with USING + WITH CHECK on customer_id = auth.uid(), that the
 * provider policy is hardened, and -- so the "real gap, not cosmetic" rationale
 * cannot rot -- that the dancer cancel caller still exists in useBookings.ts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const MIGRATION = repoFile(
  'supabase/migrations/20261249000000_dancer_bookings_customer_update_policy.sql',
);
const USE_BOOKINGS = repoFile('src/hooks/useBookings.ts');

describe('dancer customer_update parity — on the apply path', () => {
  it('lives in supabase/migrations/ (apply path), wrapped BEGIN/COMMIT + schema reload', () => {
    expect(abs('supabase/migrations/20261249000000_dancer_bookings_customer_update_policy.sql'))
      .toContain('migrations');
    expect(MIGRATION).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(MIGRATION).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });
});

describe('dancer customer_update parity — the policy mirrors its 14 peers', () => {
  it('creates dancer_bookings_customer_update FOR UPDATE TO authenticated', () => {
    expect(MIGRATION).toMatch(/DROP POLICY IF EXISTS dancer_bookings_customer_update ON public\.dancer_bookings/);
    expect(MIGRATION).toMatch(
      /CREATE POLICY dancer_bookings_customer_update ON public\.dancer_bookings\s*FOR UPDATE TO authenticated/,
    );
  });

  it('gates BOTH USING and WITH CHECK on customer_id = auth.uid()', () => {
    const block = MIGRATION.match(
      /CREATE POLICY dancer_bookings_customer_update[\s\S]*?WITH CHECK \(customer_id = auth\.uid\(\)\);/,
    );
    expect(block, 'customer_update policy block not found').toBeTruthy();
    expect(block![0]).toMatch(/USING \(customer_id = auth\.uid\(\)\)/);
    expect(block![0]).toMatch(/WITH CHECK \(customer_id = auth\.uid\(\)\)/);
  });

  it('hardens dancer_bookings_provider_update to parity (TO authenticated + WITH CHECK)', () => {
    const block = MIGRATION.match(
      /CREATE POLICY dancer_bookings_provider_update ON public\.dancer_bookings[\s\S]*?WITH CHECK \(EXISTS[\s\S]*?\);/,
    );
    expect(block, 'provider_update policy block not found').toBeTruthy();
    expect(block![0]).toMatch(/FOR UPDATE TO authenticated/);
    expect(block![0]).toMatch(/pp\.id = provider_id AND pp\.user_id = auth\.uid\(\)/);
  });
});

describe('dancer customer_update parity — apply-time catalog assertion', () => {
  it('asserts the policy exists with cmd=UPDATE, authenticated, USING + WITH CHECK', () => {
    expect(MIGRATION).toMatch(/FROM pg_policies/);
    expect(MIGRATION).toMatch(/policyname = 'dancer_bookings_customer_update'/);
    expect(MIGRATION).toMatch(/v_cmd <> 'UPDATE'/);
    expect(MIGRATION).toMatch(/'authenticated' = ANY \(v_roles\)/);
    expect(MIGRATION).toMatch(/USING lacks customer_id = auth\.uid\(\)/);
    expect(MIGRATION).toMatch(/WITH CHECK lacks customer_id = auth\.uid\(\)/);
  });
});

describe('dancer customer_update parity — the gap is real, not cosmetic', () => {
  it('useBookings.ts cancelBooking still issues a customer UPDATE on dancer_bookings', () => {
    // If this caller is ever removed, the "silent 0-row cancel" rationale changes
    // and this fix should be re-evaluated -- hence we lock the caller too.
    expect(USE_BOOKINGS).toMatch(/source === 'dancer'/);
    expect(USE_BOOKINGS).toMatch(
      /from\('dancer_bookings' as any\)\.update\(\{ status: 'cancelled' \}\)/,
    );
  });
});
