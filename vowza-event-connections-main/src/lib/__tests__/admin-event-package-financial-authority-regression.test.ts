/**
 * P0-1 — booking financial authority (admin event-PACKAGE regression guard).
 *
 * STATIC / CONTRACT regressions run under `npm test` with NO database. They prove
 * the *shape* of the fix holds: the browser cannot set admin event-package booking
 * amounts, the create RPC derives the whole pricing snapshot server-side, and the
 * parked lockdown keeps the snapshot + identity columns un-PATCHable while INSERT
 * is RPC-only. What THIS file guards on every CI run is that nobody re-opens the
 * hole in the source: the RPC takes no price parameter, the single client path
 * (useEventPackages' useCreateEventPackageBooking, called by EventPackageSelector's
 * "Book Package Now") stops sending amounts, and the lockdown never re-grants the
 * protected columns. The real Postgres outcome is proven at APPLY time by the
 * migrations' own $catalog$ / $verify$ / $probe$ blocks.
 *
 * ADMIN-EVENT-PACKAGE-SPECIFIC #1 (NO accept RPC): these bookings are
 * admin-fulfilled — admin_event_package_bookings has NO provider_id column and NO
 * vendor accept step. UNLIKE the 15 vendor categories there is NO companion
 * accept_* RPC; only a create RPC exists.
 *
 * ADMIN-EVENT-PACKAGE-SPECIFIC #2 (snapshot; no multiplier; no addons): the price
 * snapshot is package_price = base_price, discount_applied = discount_percentage,
 * final_price = the GENERATED admin_event_packages.final_price
 * (= base_price * (1 - discount_percentage/100)), with the same arithmetic as a
 * defensive fallback if it is ever NULL. There are NO addons and NO quantity
 * multiplier; EventPackageSelector's "remove up to 2 inclusions" is DISPLAY-only.
 *
 * ADMIN-EVENT-PACKAGE-SPECIFIC #3 (single client path; no Checkout; no accept):
 * the ONLY browser insert path is useEventPackages.ts. Event packages are NOT in
 * the Checkout cart flow and have no vendor accept, so there is no Checkout or
 * VendorBookings rewire to guard.
 *
 * ADMIN-EVENT-PACKAGE-SPECIFIC #4 (lockdown split): admin_event_package_bookings
 * has 13 columns → lockdown 7 protected / 6 benign / 13 total. The three snapshot
 * amounts + the 4 identity/provenance columns are protected; the 6
 * lifecycle/logistics columns are benign. event_location and guest_count are
 * DESCRIPTIVE (never pricing inputs) → benign.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261235000000_admin_event_package_booking_server_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_admin_event_package_bookings_column_lockdown.sql');
const USE_EVENT_PACKAGES_TS = repoFile('src/hooks/useEventPackages.ts');

/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');

/** Columns inside `GRANT UPDATE ( ... ) ON public.admin_event_package_bookings TO authenticated`. */
const grantedUpdateColumns = (sql: string): string[] => {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.admin_event_package_bookings\s+TO\s+authenticated/i,
  );
  if (!m) return [];
  return m[1]
    .split(',')
    .map((c) => c.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean);
};

/** Elements of a `name text[] := ARRAY[ 'a','b', ... ]` declaration. */
const sqlArray = (sql: string, name: string): string[] => {
  const m = sql.match(new RegExp(`${name}\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([\\s\\S]*?)\\]`, 'i'));
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

// Column list of the create RPC's INSERT INTO public.admin_event_package_bookings ( ... ) VALUES.
const INSERT_COLUMNS = (
  (stripComments(CREATE_SQL).match(
    /INSERT\s+INTO\s+public\.admin_event_package_bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
  ) ?? ['', ''])[1]
)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// Parameter list of the create RPC's CREATE FUNCTION signature.
const CREATE_SIGNATURE = (
  stripComments(CREATE_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_admin_event_package_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];

// The object literal of arguments passed to supabase.rpc('create_admin_event_package_booking', {...}).
const hookRpcArgs = (
  USE_EVENT_PACKAGES_TS.match(
    /supabase\.rpc\(\s*['"]create_admin_event_package_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];

// Snapshot keys a browser must never send as authoritative (Rule 3).
const AMOUNT_KEYS = ['package_price', 'discount_applied', 'final_price'];

describe('create_admin_event_package_booking — server derives the whole pricing snapshot', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(CREATE_SQL).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_admin_event_package_booking/i,
    );
    expect(CREATE_SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(CREATE_SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('takes NO client-supplied price/snapshot parameter (Rule 3)', () => {
    expect(CREATE_SIGNATURE).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(CREATE_SIGNATURE).not.toMatch(new RegExp(key, 'i'));
    }
    expect(CREATE_SIGNATURE).not.toMatch(/price|discount|\bamount\b/i);
  });

  it('requires an authenticated caller', () => {
    expect(CREATE_SQL).toMatch(/auth\.uid\(\)/);
    expect(CREATE_SQL).toMatch(/28000|Authentication required/i);
  });

  it('derives the snapshot from the authoritative admin_event_packages row', () => {
    expect(CREATE_SQL).toMatch(/from\s+public\.admin_event_packages/i);
    // package_price = base_price; discount_applied = discount_percentage.
    expect(CREATE_SQL).toMatch(/v_price\s*:=\s*coalesce\(\s*v_pkg\.base_price\s*,\s*0\s*\)/i);
    expect(CREATE_SQL).toMatch(/v_discount\s*:=\s*coalesce\(\s*v_pkg\.discount_percentage\s*,\s*0\s*\)/i);
    // final_price = the GENERATED admin_event_packages.final_price, with the same
    // base_price*(1-discount/100) arithmetic as a defensive NULL fallback.
    expect(CREATE_SQL).toMatch(
      /v_final\s*:=\s*coalesce\(\s*v_pkg\.final_price\s*,\s*round\(\s*v_price\s*\*\s*\(\s*1\s*-\s*v_discount\s*\/\s*100/i,
    );
    // NO addons and NO quantity/guest multiplier feed the price.
    expect(stripComments(CREATE_SQL)).not.toMatch(/addon/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/guest_count\s*\*|\*\s*p_guest_count|\*\s*v_guest/i);
  });
  it('INSERTs the derived snapshot, forces the caller as customer, sets pending/unpaid', () => {
    for (const col of ['customer_id', 'package_id', 'event_date', 'event_location',
      'guest_count', 'package_price', 'discount_applied', 'final_price',
      'status', 'payment_status']) {
      expect(INSERT_COLUMNS).toContain(col);
    }
    // customer_id is forced to auth.uid(), never a client value.
    expect(CREATE_SQL).toMatch(/v_uid\s+uuid\s*:=\s*auth\.uid\(\)/i);
    expect(CREATE_SQL).toMatch(/'pending'/);
    expect(CREATE_SQL).toMatch(/'unpaid'/);
  });

  it('locks the package row and requires an active package', () => {
    expect(CREATE_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(CREATE_SQL).toMatch(/is_active/i);
  });

  it('grants EXECUTE to authenticated only and revokes public/anon', () => {
    expect(CREATE_SQL).toMatch(
      /REVOKE\s+ALL[\s\S]*?create_admin_event_package_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i,
    );
    expect(CREATE_SQL).toMatch(
      /GRANT\s+EXECUTE[\s\S]*?create_admin_event_package_booking[\s\S]*?TO\s+authenticated/i,
    );
  });

  it('ships its own fail-closed catalog + verify guards', () => {
    expect(CREATE_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(CREATE_SQL).toMatch(/DO\s+\$verify\$/);
  });

  it('has NO provider/accept step (admin-fulfilled — no provider_id, no accept RPC)', () => {
    expect(stripComments(CREATE_SQL)).not.toMatch(/provider_id|accept_/i);
  });
});
describe('client creation path routes through create_admin_event_package_booking (no browser amounts)', () => {
  it('useCreateEventPackageBooking calls the RPC and never direct-inserts the table', () => {
    expect(USE_EVENT_PACKAGES_TS).toMatch(
      /supabase\.rpc\(\s*['"]create_admin_event_package_booking['"]/,
    );
    // The old direct .from('admin_event_package_bookings').insert(...) path is gone.
    // (SELECT reads via .from(...).select(...) are fine; only .insert must be absent.)
    expect(USE_EVENT_PACKAGES_TS).not.toMatch(
      /\.from\(\s*['"]admin_event_package_bookings['"]\s*\)\s*\.insert\(/,
    );
  });

  it('the hook forwards identifiers/descriptive fields ONLY — no authoritative snapshot keys', () => {
    expect(hookRpcArgs).not.toBe('');
    expect(hookRpcArgs).toMatch(/p_package_id/);
    expect(hookRpcArgs).toMatch(/p_event_date/);
    expect(hookRpcArgs).toMatch(/p_event_location/);
    expect(hookRpcArgs).toMatch(/p_guest_count/);
    for (const key of AMOUNT_KEYS) {
      expect(hookRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    // customer_id is forced server-side; the browser must not send it.
    expect(hookRpcArgs).not.toMatch(/customer_id/i);
  });
});

describe('parked column lockdown — snapshot & identity un-PATCHable, INSERT RPC-only', () => {
  const protectedCols = sqlArray(LOCKDOWN_SQL, 'protected_cols');
  const benignCols = sqlArray(LOCKDOWN_SQL, 'benign_cols');
  const grantedCols = grantedUpdateColumns(LOCKDOWN_SQL);
  const EXPECTED_PROTECTED = [
    'package_price', 'discount_applied', 'final_price',
    'id', 'customer_id', 'package_id', 'created_at',
  ];
  const EXPECTED_BENIGN = [
    'event_date', 'event_location', 'guest_count',
    'payment_status', 'status', 'updated_at',
  ];

  it('is PARKED with a do-not-push banner referencing the create RPC and the rewired hook', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+NOT\s+db\s+push\s+YET/i);
    expect(LOCKDOWN_SQL).toMatch(/20261235000000_admin_event_package_booking_server_authoritative/);
    expect(LOCKDOWN_SQL).toMatch(/useEventPackages\.ts/);
  });

  it('REVOKEs INSERT+UPDATE before granting back, and never re-grants INSERT', () => {
    const revokeIdx = LOCKDOWN_SQL.search(
      /REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.admin_event_package_bookings\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    const grantIdx = LOCKDOWN_SQL.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revokeIdx).toBeGreaterThanOrEqual(0);
    expect(grantIdx).toBeGreaterThan(revokeIdx);
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/GRANT\s+INSERT/i);
  });
  it('grants UPDATE on EXACTLY the 6 benign columns — no snapshot column among them', () => {
    expect(grantedCols.slice().sort()).toEqual([...EXPECTED_BENIGN].sort());
    expect(benignCols.slice().sort()).toEqual([...EXPECTED_BENIGN].sort());
    for (const amt of AMOUNT_KEYS) {
      expect(grantedCols).not.toContain(amt);
    }
    for (const idc of ['id', 'customer_id', 'package_id', 'created_at']) {
      expect(grantedCols).not.toContain(idc);
    }
  });

  it('protects the 3 snapshot amounts + 4 identity columns (7 protected), disjoint from benign', () => {
    expect(protectedCols.slice().sort()).toEqual([...EXPECTED_PROTECTED].sort());
    for (const amt of AMOUNT_KEYS) {
      expect(protectedCols).toContain(amt);
    }
    expect(protectedCols.length).toBe(7);
    expect(benignCols.length).toBe(6);
    expect(protectedCols.length + benignCols.length).toBe(13);
    const overlap = protectedCols.filter((c) => benignCols.includes(c));
    expect(overlap).toEqual([]);
  });

  it('classifies event_location and guest_count as BENIGN (descriptive, not pricing inputs)', () => {
    expect(benignCols).toContain('event_location');
    expect(benignCols).toContain('guest_count');
    expect(protectedCols).not.toContain('event_location');
    expect(protectedCols).not.toContain('guest_count');
  });

  it('ships the fail-closed catalog + runtime probe (assumes the authenticated role)', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$probe\$/);
    expect(LOCKDOWN_SQL).toMatch(/SET\s+LOCAL\s+ROLE\s+authenticated/i);
    expect(LOCKDOWN_SQL).toMatch(/has_table_privilege\(\s*'authenticated'[\s\S]*?'INSERT'\s*\)/i);
  });
});



