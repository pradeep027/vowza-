/**
 * P0 Phase C — BUG FIX regression for the photography actor-binding defect.
 *
 * The actor binding shipped in 20261240000000 re-defined the shared category
 * validator enforce_category_booking_status_transition() to read OLD.provider_id.
 * That one function is attached to 16 tables, and photography_package_bookings
 * names its provider column `photographer_id`, not `provider_id`. plpgsql
 * resolves OLD.provider_id per row at RUNTIME, so the first non-bypassed status
 * transition on a photography booking raised `record "old" has no field
 * "provider_id"` (42703) and the UPDATE was rejected.
 *
 * 20261241000000 re-defines the validator to resolve BOTH ids generically from
 * to_jsonb(OLD) — provider id = coalesce(provider_id, photographer_id) — so the
 * single shared function serves photography and the 15 provider_id tables alike.
 *
 * STATIC / CONTRACT regression (no database): assert the generic resolution, the
 * preserved DAG + actor check + bypass ordering, and that the function stays
 * hardened. Real Postgres behaviour is proven at APPLY time by the migration's
 * own $catalog$/$verify$ blocks.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const SQL = repoFile(
  'supabase/migrations/20261241000000_category_actor_binding_photographer_fix.sql',
);
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');
const NOCMT = stripComments(SQL);

describe('photographer fix — generic id resolution via to_jsonb(OLD)', () => {
  it('re-defines ONLY the shared category validator (not the generic bookings one)', () => {
    expect(SQL).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_category_booking_status_transition\s*\(\s*\)/i,
    );
    // The generic bookings validator must NOT be touched by this fix.
    expect(SQL).not.toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_bookings_status_transition/i,
    );
  });

  it('resolves customer_id and the provider id from to_jsonb(OLD), coalescing photographer_id', () => {
    expect(NOCMT).toMatch(/v_row\s+jsonb\s*:=\s*to_jsonb\(OLD\)/i);
    expect(NOCMT).toMatch(/v_customer_id\s+uuid\s*:=\s*\(v_row\s*->>\s*'customer_id'\)::uuid/i);
    expect(NOCMT).toMatch(
      /v_provider_id\s+uuid\s*:=\s*coalesce\(\s*v_row\s*->>\s*'provider_id'\s*,\s*v_row\s*->>\s*'photographer_id'\s*\)::uuid/i,
    );
  });

  it('does NOT reference OLD.provider_id directly (the field photography lacks)', () => {
    expect(NOCMT).not.toMatch(/OLD\.provider_id/i);
  });

  it('passes the generically-resolved ids into the actor helper', () => {
    expect(NOCMT).toMatch(
      /public\.booking_transition_actor_allowed\(\s*v_customer_id,\s*v_provider_id,\s*v_old,\s*v_new\s*\)/i,
    );
    expect(NOCMT).toMatch(/Not authorized to change booking status/i);
    expect(NOCMT).toMatch(/ERRCODE\s*=\s*'42501'/);
  });
});

describe('photographer fix — DAG, bypass and hardening preserved', () => {
  it('keeps the pending-based category DAG and raises 23514 on illegal transitions', () => {
    expect(NOCMT).toMatch(/v_old\s*=\s*'pending'\s+AND\s+v_new\s+IN\s*\(\s*'accepted',\s*'rejected',\s*'cancelled'\s*\)/i);
    expect(NOCMT).toMatch(/Illegal booking status transition/i);
    expect(NOCMT).toMatch(/ERRCODE\s*=\s*'23514'/);
  });

  it('keeps the no-op + service_role(null uid) + admin bypass ahead of both checks', () => {
    expect(NOCMT).toMatch(/v_new\s+IS\s+NOT\s+DISTINCT\s+FROM\s+v_old/i);
    expect(NOCMT).toMatch(
      /auth\.uid\(\)\s+IS\s+NULL\s+OR\s+public\.has_role\(\s*auth\.uid\(\)\s*,\s*'admin'::public\.app_role\)/i,
    );
    const bypassIdx = NOCMT.search(/auth\.uid\(\)\s+IS\s+NULL/i);
    const dagRaiseIdx = NOCMT.search(/Illegal booking status transition/i);
    const actorRaiseIdx = NOCMT.search(/Not authorized to change booking status/i);
    expect(bypassIdx).toBeGreaterThan(0);
    expect(bypassIdx).toBeLessThan(dagRaiseIdx);
    expect(dagRaiseIdx).toBeLessThan(actorRaiseIdx);
  });

  it('stays SECURITY DEFINER with a hardened empty search_path', () => {
    expect(SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('ships fail-closed $catalog$ (asserts photographer_id + a provider_id table) + $verify$ and reloads PostgREST', () => {
    expect(SQL).toMatch(/DO\s+\$catalog\$/);
    expect(SQL).toMatch(/photography_package_bookings[\s\S]*?photographer_id/i);
    expect(SQL).toMatch(/DO\s+\$verify\$/);
    expect(SQL).toMatch(/NOTIFY\s+pgrst/i);
  });
});
