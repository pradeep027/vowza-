/**
 * Self-booking prevention on the SECURITY DEFINER RPC path (SECURITY FIX +
 * BEHAVIOR PRESERVATION).
 *
 * THE HOLE: the universal "a vendor cannot book their own package" rule lived in
 * production ONLY as per-table INSERT RLS policies
 * (migrations-archive/20260918000000_prevent_self_booking.sql). Phase B then moved
 * booking creation onto per-category public.create_<cat>_booking(...) functions,
 * which are SECURITY DEFINER and therefore BYPASS RLS -- silently re-opening
 * self-booking on the live path (verified: create_dancer_booking /
 * create_catering_booking force customer_id = auth.uid() but never check owner).
 *
 * THE FIX (migration 20261247000000): one shared SECURITY DEFINER
 * enforce_booking_no_self_booking() + a BEFORE INSERT row trigger on each of the
 * 15 category tables. Triggers are NOT bypassed by SECURITY DEFINER, so the rule
 * holds on the RPC path and any residual direct INSERT.
 *
 * WHAT THIS TEST LOCKS: a STATIC contract regression (no network / DB). Runtime
 * enforcement is proven at APPLY time by the embedded DO $catalog$/$verify$
 * blocks. Here we lock the function's fail-closed shape, the exact 15-table
 * install set (and the documented out-of-scope exclusions), and that the trigger
 * is BEFORE INSERT, so the restored rule cannot silently regress again.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const MIGRATION = repoFile(
  'supabase/migrations/20261247000000_prevent_self_booking_on_rpc_path.sql',
);
// Comment-stripped view for negative "token must be absent" probes, so the
// header's OUT-OF-SCOPE prose (which legitimately names photography / admin
// tables) does not create a false positive.
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, '');

// The exact 15 categories that received a Phase B create_*_booking RPC AND
// carried a self-booking INSERT policy in the applied baseline.
const CATEGORY_TABLES = [
  'band_bookings', 'catering_bookings', 'anchor_bookings', 'decorator_bookings',
  'dancer_bookings', 'dj_bookings', 'drone_bookings', 'makeup_bookings',
  'mehendi_bookings', 'priest_bookings', 'rental_bookings', 'singer_bookings',
  'videography_bookings', 'water_bookings', 'banquet_bookings',
] as const;

describe('self-booking RPC-path guard — on the apply path', () => {
  it('lives in supabase/migrations/ (apply path), not parked under migrations-pending/', () => {
    expect(abs('supabase/migrations/20261247000000_prevent_self_booking_on_rpc_path.sql'))
      .toContain('migrations');
    expect(MIGRATION).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(MIGRATION).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });
});

describe('self-booking RPC-path guard — the shared function is fail-closed', () => {
  it('is one SECURITY DEFINER function with a hardened empty search_path', () => {
    expect(MIGRATION).toMatch(/CREATE OR REPLACE FUNCTION public\.enforce_booking_no_self_booking\(\)/);
    expect(MIGRATION).toMatch(
      /FUNCTION public\.enforce_booking_no_self_booking\(\)[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/,
    );
  });

  it('derives the actor from auth.uid() and lets a NULL subject (service_role) pass', () => {
    expect(MIGRATION).toMatch(/v_uid uuid := auth\.uid\(\)/);
    expect(MIGRATION).toMatch(/IF v_uid IS NULL THEN\s*RETURN NEW;/);
  });

  it('blocks only a proven self-booking (caller owns the booked provider_profile) with 42501', () => {
    expect(MIGRATION).toMatch(
      /SELECT 1 FROM public\.provider_profiles\s*WHERE id = NEW\.provider_id AND user_id = v_uid/,
    );
    expect(MIGRATION).toMatch(/RAISE EXCEPTION[\s\S]*?USING ERRCODE = '42501'/);
  });
});

describe('self-booking RPC-path guard — installed on exactly the 15 category tables', () => {
  it('names every one of the 15 tables', () => {
    for (const t of CATEGORY_TABLES) {
      expect(MIGRATION_SQL, `missing table ${t}`).toContain(`'${t}'`);
    }
  });

  it('is a row-level BEFORE INSERT trigger per table (not UPDATE)', () => {
    expect(MIGRATION).toMatch(/BEFORE INSERT ON public\.%1\$I/);
    expect(MIGRATION).toMatch(/trg_prevent_%1\$s_self_booking/);
    // This guard is a creation-time rule; it must not latch onto UPDATE.
    expect(MIGRATION_SQL).not.toMatch(/BEFORE UPDATE/);
  });

  it('excludes the documented out-of-scope tables from the install set', () => {
    // photography_package_bookings is still a direct INSERT (RLS still fires);
    // generic bookings + admin_event_package never had a self-booking rule.
    // They appear only in the header prose, which is stripped here.
    expect(MIGRATION_SQL).not.toContain(`'photography_package_bookings'`);
    expect(MIGRATION_SQL).not.toContain(`'admin_event_package_bookings'`);
    expect(MIGRATION_SQL).not.toContain(`'bookings'`);
  });
});

describe('self-booking RPC-path guard — fail-closed apply-time checks', () => {
  it('drift-guards provider_id (uuid) on each table and provider_profiles id/user_id', () => {
    expect(MIGRATION).toMatch(/provider_id/);
    expect(MIGRATION).toMatch(/ABORT self-booking guard: public\.%\.provider_id/);
    expect(MIGRATION).toMatch(/provider_profiles\.id does not exist/);
    expect(MIGRATION).toMatch(/provider_profiles\.user_id does not exist/);
  });

  it('self-checks the function is SECURITY DEFINER and the trigger is BEFORE INSERT ROW', () => {
    expect(MIGRATION).toMatch(/is not SECURITY DEFINER/);
    expect(MIGRATION).toMatch(/has no hardened search_path/);
    // tgtype bits: 1 = ROW, 2 = BEFORE, 4 = INSERT — all three asserted.
    expect(MIGRATION).toMatch(/t\.tgtype & 2/);
    expect(MIGRATION).toMatch(/t\.tgtype & 1/);
    expect(MIGRATION).toMatch(/t\.tgtype & 4/);
    expect(MIGRATION).toMatch(/is not a row-level BEFORE INSERT trigger/);
  });
});
