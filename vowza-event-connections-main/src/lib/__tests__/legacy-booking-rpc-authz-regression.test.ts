/**
 * P0-L — legacy booking RPC authorization regression (SECURITY FIX).
 *
 * THE HOLE: public.create_event_booking / add_artist_to_event /
 * update_artist_booking_status were SECURITY DEFINER functions created with the
 * default PUBLIC EXECUTE and NO internal auth check, so any anon caller could
 * create/modify event & artist bookings unauthenticated (and create events "as"
 * any user id, since the browser supplied p_customer_id).
 *
 * THE FIX (migration 20261246000000): CREATE OR REPLACE all three with a
 * fail-closed auth.uid()/ownership/actor guard, REVOKE EXECUTE from PUBLIC/anon,
 * GRANT only to authenticated + service_role, and prove it at apply time with
 * role probes.
 *
 * WHAT THIS TEST LOCKS: this is a STATIC contract regression (no network / DB).
 * Enforcement itself is proven at APPLY time by the embedded `DO $probe$` blocks
 * (anon denied, foreign-customer denied, non-owner denied, non-actor denied,
 * legitimate self succeeds). Here we lock the migration so those guards, grants,
 * and probes cannot silently regress, and we tie the frontend caller to the
 * self-only guard so the live flow stays compatible.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const MIGRATION = repoFile(
  'supabase/migrations/20261246000000_revoke_legacy_booking_rpc_public_execute.sql',
);
// Comment-stripped view for negative "token must be absent" probes, so the
// documented ROLLBACK header (which legitimately mentions `GRANT ... TO PUBLIC`)
// does not create a false positive.
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, '');
const EVENT_PLANNING = repoFile('src/pages/EventPlanning.tsx');

const FNS = [
  'create_event_booking',
  'add_artist_to_event',
  'update_artist_booking_status',
] as const;

describe('P0-L migration — grants are locked down', () => {
  it('is on the APPLY path (supabase/migrations/, not parked under migrations-pending/)', () => {
    // The file is read from supabase/migrations/ above; its presence there is the
    // contract. Guard against anyone relocating the lockdown out of the apply path.
    expect(abs('supabase/migrations/20261246000000_revoke_legacy_booking_rpc_public_execute.sql'))
      .toContain('migrations');
    expect(MIGRATION).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(MIGRATION).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });

  it('revokes EXECUTE from PUBLIC and anon for all three functions', () => {
    for (const fn of FNS) {
      const re = new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon;`);
      expect(MIGRATION, `missing REVOKE for ${fn}`).toMatch(re);
    }
  });

  it('grants EXECUTE only to authenticated + service_role (never anon/PUBLIC)', () => {
    for (const fn of FNS) {
      const re = new RegExp(
        `GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO authenticated, service_role;`,
      );
      expect(MIGRATION, `missing GRANT for ${fn}`).toMatch(re);
    }
    // No grant to PUBLIC or anon anywhere (comment-stripped, so the documented
    // rollback header does not trip this).
    expect(MIGRATION_SQL).not.toMatch(/GRANT[^;]*\bTO\b[^;]*\b(PUBLIC|anon)\b/);
  });

  it('asserts (by privilege) anon has no EXECUTE and authenticated does', () => {
    expect(MIGRATION).toMatch(/has_function_privilege\('anon',\s*v_oid,\s*'EXECUTE'\)/);
    expect(MIGRATION).toMatch(/NOT has_function_privilege\('authenticated',\s*v_oid,\s*'EXECUTE'\)/);
  });
});

describe('P0-L migration — functions are fail-closed inside the body', () => {
  it('every function hardens search_path and reads auth.uid()', () => {
    for (const fn of FNS) {
      const body = new RegExp(
        `FUNCTION public\\.${fn}\\([\\s\\S]*?SET search_path = public, pg_temp[\\s\\S]*?auth\\.uid\\(\\)`,
      );
      expect(MIGRATION, `${fn} missing search_path/auth.uid guard`).toMatch(body);
    }
    // Every denial raises insufficient_privilege (42501).
    expect(MIGRATION.match(/ERRCODE = '42501'/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  it('create_event_booking is self-only (p_customer_id must equal auth.uid())', () => {
    expect(MIGRATION).toMatch(/p_customer_id IS DISTINCT FROM v_uid/);
    // Defense-in-depth: the row is inserted with v_uid, not the raw argument.
    expect(MIGRATION).toMatch(/VALUES \(\s*v_uid,/);
  });

  it('add_artist_to_event requires the caller to own the target event', () => {
    expect(MIGRATION).toMatch(
      /EXISTS \(\s*SELECT 1 FROM public\.event_bookings\s*WHERE id = p_event_id\s*AND customer_id = v_uid/,
    );
  });

  it('update_artist_booking_status binds to event-owner OR assigned provider', () => {
    expect(MIGRATION).toMatch(/eb\.customer_id = v_uid/);
    expect(MIGRATION).toMatch(/pp\.user_id = v_uid/);
  });
});

describe('P0-L migration — apply-time probes cover every required scenario', () => {
  it('6a anonymous call is denied', () => {
    expect(MIGRATION).toMatch(/SET LOCAL ROLE anon;[\s\S]*create_event_booking/);
    expect(MIGRATION).toMatch(/probe 6a OK/);
  });
  it('6b authenticated wrong-user (foreign customer_id) is denied', () => {
    expect(MIGRATION).toMatch(/probe 6b OK/);
  });
  it('6c authenticated non-owner add_artist is denied', () => {
    expect(MIGRATION).toMatch(/probe 6c OK/);
  });
  it('6d unauthorized vendor/customer status update is denied', () => {
    expect(MIGRATION).toMatch(/probe 6d OK/);
  });
  it('6e legitimate self caller succeeds (and is rolled back)', () => {
    expect(MIGRATION).toMatch(/ROLLBACK_POSITIVE_PROBE/);
    expect(MIGRATION).toMatch(/probe 6e OK/);
  });
});

describe('P0-L — the live caller stays compatible with the self-only guard', () => {
  it('EventPlanning creates events with p_customer_id = the signed-in user id', () => {
    expect(EVENT_PLANNING).toMatch(/create_event_booking/);
    expect(EVENT_PLANNING).toMatch(/p_customer_id:\s*user\?\.id/);
    expect(EVENT_PLANNING).toMatch(/add_artist_to_event/);
  });
});

