/**
 * P0 Phase C — booking state machine, final raw-status-write table:
 * photography_package_bookings. It uses `status text` ('pending' default) and
 * shares the category lifecycle, so it reuses the shared validator
 * enforce_category_booking_status_transition() rather than defining its own.
 *
 * STATIC / CONTRACT regression (no database).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const GUARD_SQL = repoFile(
  'supabase/migrations/20261239000000_photography_bookings_status_transition_guard.sql',
);
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');
const GUARD_NOCMT = stripComments(GUARD_SQL);

describe('photography_package_bookings status transition guard', () => {
  it('reuses the shared category validator (no duplicate function definition)', () => {
    expect(GUARD_NOCMT).toMatch(/EXECUTE\s+FUNCTION\s+public\.enforce_category_booking_status_transition/i);
    // It must NOT re-CREATE the shared function.
    expect(GUARD_NOCMT).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i);
  });

  it('installs a row-level BEFORE UPDATE OF status trigger on the table', () => {
    expect(GUARD_NOCMT).toMatch(
      /CREATE\s+TRIGGER\s+trg_enforce_photography_package_bookings_status_transition\s+BEFORE\s+UPDATE\s+OF\s+status\s+ON\s+public\.photography_package_bookings\s+FOR\s+EACH\s+ROW/i,
    );
  });

  it('fail-closed $catalog$ requires a text status column and the shared validator', () => {
    expect(GUARD_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(GUARD_NOCMT).toMatch(/expected text/i);
    expect(GUARD_NOCMT).toMatch(/enforce_category_booking_status_transition\(\)\s+not found/i);
  });

  it('ships a $verify$ self-check and reloads PostgREST; is additive', () => {
    expect(GUARD_SQL).toMatch(/DO\s+\$verify\$/);
    expect(GUARD_SQL).toMatch(/NOTIFY\s+pgrst/i);
    expect(GUARD_NOCMT).not.toMatch(/REVOKE\s+/i);
    expect(GUARD_NOCMT).not.toMatch(/GRANT\s+UPDATE/i);
  });

  it('documents that admin_event_package_bookings is deliberately not guarded (admin-only writer)', () => {
    expect(GUARD_SQL).toMatch(/admin_event_package_bookings/i);
    expect(GUARD_SQL).toMatch(/NOT\s+GUARDED/i);
  });
});
