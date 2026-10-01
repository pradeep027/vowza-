/**
 * P0 Phase C — booking state machine (generic `bookings` transition guard).
 *
 * STATIC / CONTRACT regression: with NO database, prove the *shape* of the
 * server-enforced state machine holds — the guard is a hardened row-level
 * BEFORE UPDATE trigger, the legal DAG is exactly the traced set of app
 * transitions, terminal states have no outgoing edges, no-op writes pass, and
 * admins bypass. The real Postgres behaviour is proven at APPLY time by the
 * migration's own $catalog$ / $verify$ blocks.
 *
 * The generic public.bookings table is the Phase C PILOT: it uses the
 * booking_status enum ('requested' at create) and — unlike the 15 vendor
 * categories — has no accept RPC, so before this guard every status edge was a
 * raw client PATCH gated only by RLS row-ownership (no value check, no
 * WITH CHECK): a party could jump requested -> completed or revive a terminal
 * booking.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const GUARD_SQL = repoFile('supabase/migrations/20261237000000_bookings_status_transition_guard.sql');

/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');
const GUARD_NOCMT = stripComments(GUARD_SQL);

/** The allowed-edge IN(...) list for a given source status in the trigger body. */
const allowedTargets = (fromStatus: string): string[] => {
  const m = GUARD_NOCMT.match(
    new RegExp(`v_old\\s*=\\s*'${fromStatus}'\\s+AND\\s+v_new\\s+IN\\s*\\(([^)]*)\\)`, 'i'),
  );
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.replace(/['\s]/g, ''))
    .filter(Boolean);
};

describe('bookings status transition guard — hardened trigger', () => {
  it('is a SECURITY DEFINER function with a hardened empty search_path', () => {
    expect(GUARD_SQL).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_bookings_status_transition/i,
    );
    expect(GUARD_SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(GUARD_SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('installs a row-level BEFORE UPDATE OF status trigger on public.bookings', () => {
    expect(GUARD_SQL).toMatch(
      /CREATE\s+TRIGGER\s+trg_enforce_bookings_status_transition\s+BEFORE\s+UPDATE\s+OF\s+status\s+ON\s+public\.bookings\s+FOR\s+EACH\s+ROW/i,
    );
  });

  it('is ADDITIVE — it revokes no privileges and touches no column grants', () => {
    expect(GUARD_NOCMT).not.toMatch(/REVOKE\s+/i);
    expect(GUARD_NOCMT).not.toMatch(/GRANT\s+UPDATE/i);
  });
});

describe('bookings status transition guard — legal DAG', () => {
  it('requested may only advance to accepted / rejected / cancelled', () => {
    expect(allowedTargets('requested').sort()).toEqual(
      ['accepted', 'cancelled', 'rejected'].sort(),
    );
  });

  it('accepted may only advance to in_progress / cancelled / rejected', () => {
    expect(allowedTargets('accepted').sort()).toEqual(
      ['cancelled', 'in_progress', 'rejected'].sort(),
    );
  });

  it('in_progress may only advance to completed / cancelled', () => {
    expect(allowedTargets('in_progress').sort()).toEqual(
      ['cancelled', 'completed'].sort(),
    );
  });

  it('terminal states (completed / cancelled / rejected) have NO outgoing edge', () => {
    expect(allowedTargets('completed')).toEqual([]);
    expect(allowedTargets('cancelled')).toEqual([]);
    expect(allowedTargets('rejected')).toEqual([]);
  });

  it('forbids illegal jumps and terminal reversion (not present as allowed edges)', () => {
    // requested -> completed / in_progress skip the machine.
    expect(allowedTargets('requested')).not.toContain('completed');
    expect(allowedTargets('requested')).not.toContain('in_progress');
    // accepted -> completed skips pay-advance / in_progress.
    expect(allowedTargets('accepted')).not.toContain('completed');
  });
});

describe('bookings status transition guard — bypass, no-op, and rejection', () => {
  it('lets an unchanged status write pass (benign other-column updates)', () => {
    expect(GUARD_NOCMT).toMatch(/v_new\s+IS\s+NOT\s+DISTINCT\s+FROM\s+v_old/i);
  });

  it('lets admins and super_admins bypass the machine via has_role', () => {
    expect(GUARD_NOCMT).toMatch(/has_role\(\s*auth\.uid\(\)\s*,\s*'admin'::public\.app_role\)/i);
    expect(GUARD_NOCMT).toMatch(/has_role\(\s*auth\.uid\(\)\s*,\s*'super_admin'::public\.app_role\)/i);
  });

  it('raises on any transition not explicitly allowed', () => {
    expect(GUARD_NOCMT).toMatch(/RAISE\s+EXCEPTION[\s\S]*?Illegal booking status transition/i);
    expect(GUARD_NOCMT).toMatch(/ERRCODE\s*=\s*'23514'/);
  });

  it('ships fail-closed $catalog$ preconditions and a $verify$ self-check', () => {
    expect(GUARD_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(GUARD_SQL).toMatch(/DO\s+\$verify\$/);
    expect(GUARD_SQL).toMatch(/NOTIFY\s+pgrst/i);
  });
});
