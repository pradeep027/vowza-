/**
 * P0 Phase C — booking state machine FAN-OUT to the 15 per-vendor category
 * booking tables (band/catering/anchor/decorator/dancer/dj/drone/makeup/
 * mehendi/priest/rental/singer/videography/water/banquet).
 *
 * STATIC / CONTRACT regression (no database): prove the shared text-status
 * validator is hardened, the DAG is exactly the traced app transitions
 * (source 'pending', since these tables use `status text` not the enum),
 * terminal states are final, and one row-level BEFORE UPDATE trigger is
 * installed per table. Real Postgres behaviour is proven at APPLY time by the
 * migration's own $catalog$ / $verify$ blocks.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const GUARD_SQL = repoFile(
  'supabase/migrations/20261238000000_category_bookings_status_transition_guard.sql',
);
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');
const GUARD_NOCMT = stripComments(GUARD_SQL);

const CATEGORY_TABLES = [
  'band_bookings', 'catering_bookings', 'anchor_bookings', 'decorator_bookings',
  'dancer_bookings', 'dj_bookings', 'drone_bookings', 'makeup_bookings',
  'mehendi_bookings', 'priest_bookings', 'rental_bookings', 'singer_bookings',
  'videography_bookings', 'water_bookings', 'banquet_bookings',
];

/** The allowed-edge IN(...) list for a given source status in the trigger body. */
const allowedTargets = (fromStatus: string): string[] => {
  const m = GUARD_NOCMT.match(
    new RegExp(`v_old\\s*=\\s*'${fromStatus}'\\s+AND\\s+v_new\\s+IN\\s*\\(([^)]*)\\)`, 'i'),
  );
  if (!m) return [];
  return m[1].split(',').map((s) => s.replace(/['\s]/g, '')).filter(Boolean);
};

describe('category bookings status guard — shared hardened validator', () => {
  it('is a SECURITY DEFINER function with a hardened empty search_path', () => {
    expect(GUARD_SQL).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_category_booking_status_transition/i,
    );
    expect(GUARD_SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(GUARD_SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('compares plain text status (these tables are text, not the booking_status enum)', () => {
    expect(GUARD_NOCMT).toMatch(/v_old\s+text\s*:=\s*OLD\.status/i);
    expect(GUARD_NOCMT).toMatch(/v_new\s+text\s*:=\s*NEW\.status/i);
    // No enum casts on the status comparison for category tables.
    expect(GUARD_NOCMT).not.toMatch(/::public\.booking_status/);
  });

  it('is ADDITIVE — revokes no privileges and touches no column grants', () => {
    expect(GUARD_NOCMT).not.toMatch(/REVOKE\s+/i);
    expect(GUARD_NOCMT).not.toMatch(/GRANT\s+UPDATE/i);
  });
});

describe('category bookings status guard — installs on all 15 tables', () => {
  it('the $catalog$ precondition and $install$/$verify$ loops name all 15 category tables', () => {
    for (const t of CATEGORY_TABLES) {
      expect(GUARD_SQL).toMatch(new RegExp(`'${t}'`));
    }
  });

  it('installs a row-level BEFORE UPDATE OF status trigger via the shared function', () => {
    // The CREATE TRIGGER statement is built with format() over the table name
    // (%1$s / %1$I) and split across concatenated string literals; assert its
    // defining fragments rather than one contiguous match.
    expect(GUARD_NOCMT).toMatch(/CREATE\s+TRIGGER\s+trg_enforce_%1\$s_status_transition/i);
    expect(GUARD_NOCMT).toMatch(/BEFORE\s+UPDATE\s+OF\s+status\s+ON\s+public\.%1\$I/i);
    expect(GUARD_NOCMT).toMatch(
      /FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.enforce_category_booking_status_transition/i,
    );
  });

  it('drops any pre-existing trigger first (idempotent re-apply)', () => {
    expect(GUARD_NOCMT).toMatch(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_enforce_%1\$s_status_transition/i);
  });
});

describe('category bookings status guard — legal DAG (source pending)', () => {
  it('pending may only advance to accepted / rejected / cancelled', () => {
    expect(allowedTargets('pending').sort()).toEqual(
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

  it('terminal states have NO outgoing edge, and illegal jumps are absent', () => {
    expect(allowedTargets('completed')).toEqual([]);
    expect(allowedTargets('cancelled')).toEqual([]);
    expect(allowedTargets('rejected')).toEqual([]);
    expect(allowedTargets('pending')).not.toContain('completed');
    expect(allowedTargets('pending')).not.toContain('in_progress');
    expect(allowedTargets('accepted')).not.toContain('completed');
  });
});

describe('category bookings status guard — bypass, no-op, rejection, self-checks', () => {
  it('lets an unchanged status write pass, and admins/super_admins bypass', () => {
    expect(GUARD_NOCMT).toMatch(/v_new\s+IS\s+NOT\s+DISTINCT\s+FROM\s+v_old/i);
    expect(GUARD_NOCMT).toMatch(/has_role\(\s*auth\.uid\(\)\s*,\s*'admin'::public\.app_role\)/i);
    expect(GUARD_NOCMT).toMatch(/has_role\(\s*auth\.uid\(\)\s*,\s*'super_admin'::public\.app_role\)/i);
  });

  it('raises 23514 on any transition not explicitly allowed', () => {
    expect(GUARD_NOCMT).toMatch(/RAISE\s+EXCEPTION[\s\S]*?Illegal booking status transition/i);
    expect(GUARD_NOCMT).toMatch(/ERRCODE\s*=\s*'23514'/);
  });

  it('ships fail-closed $catalog$ (text-status check) + $verify$ (all 15 triggers)', () => {
    expect(GUARD_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(GUARD_SQL).toMatch(/DO\s+\$verify\$/);
    expect(GUARD_NOCMT).toMatch(/expected text/i);
    expect(GUARD_SQL).toMatch(/NOTIFY\s+pgrst/i);
  });
});
