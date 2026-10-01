/**
 * P0-1 — booking financial authority (Drone regression guard).
 *
 * STATIC / CONTRACT regressions that run under `npm test` with NO database. They
 * prove the *shape* of the fix holds: the browser cannot send Drone booking
 * amounts, the RPCs derive them server-side, and the parked lockdown keeps the
 * amount + identity columns un-PATCHable while INSERT is RPC-only. They do NOT
 * assert a real Postgres outcome — that is proven at APPLY time by the $catalog$ /
 * $verify$ / $probe$ blocks inside the migrations themselves. What THIS file
 * guards on every CI run is that nobody re-opens the hole in the source: the RPCs
 * take no amount parameter, the client paths (DroneMenu "Book Now", the Checkout
 * cart branch, the VendorBookings accept) stop sending/PATCHing amounts, and the
 * lockdown never re-grants the protected columns.
 *
 * DRONE-SPECIFIC #1 (base price chain): Drone base is the FIRST TRUTHY of four
 * package columns — package_price OR starting_price OR fixed_price OR hourly_price
 * — mirroring DroneMenu's JS `||` chain. The create RPC reproduces that with a
 * coalesce(nullif(col,0), ...) chain, NOT a single coalesce(package_price,0) like
 * DJ. This file asserts the full 4-candidate nullif chain explicitly.
 *
 * DRONE-SPECIFIC #2 (advance rate): Drone is a FLAT package model, advance is a
 * hardcoded FLAT 20% (matching DroneMenu's Math.round(total * 0.2)), NOT the
 * per-package advance_percentage column — even though drone_packages HAS that
 * column (contrast dancer). accept_drone_booking derives round(total * 20 / 100)
 * and does NOT read drone_packages. This file asserts that explicitly.
 *
 * DRONE-SPECIFIC #3 (descriptive fields): coverage_duration / indoor_outdoor /
 * drone_permission_available / restricted_area / special_requests are DESCRIPTIVE
 * — the total is base + addons regardless of them. None is a pricing multiplier
 * (there is no guest_count / quantity multiplier for drone), so all are BENIGN.
 *
 * DRONE-SPECIFIC #4 (defer-at-create): Drone does NOT store advance_amount /
 * remaining_amount at creation (mirroring DroneMenu, which stores only base/addons/
 * total) — the create INSERT column list OMITS them; they are derived at accept.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261217000000_drone_booking_server_authoritative.sql');
const ACCEPT_SQL = repoFile('supabase/migrations/20261218000000_drone_booking_accept_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_drone_bookings_column_lockdown.sql');
const DRONE_MENU_TSX = repoFile('src/components/DroneMenu.tsx');
const CHECKOUT_TSX = repoFile('src/pages/Checkout.tsx');
const VENDOR_BOOKINGS_TSX = repoFile('src/pages/vendor/VendorBookings.tsx');
/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');

/** Columns inside `GRANT UPDATE ( ... ) ON public.drone_bookings TO authenticated`. */
const grantedUpdateColumns = (sql: string): string[] => {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.drone_bookings\s+TO\s+authenticated/i,
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

// Column list of the create RPC's INSERT INTO public.drone_bookings ( ... ) VALUES.
const INSERT_COLUMNS = (
  (stripComments(CREATE_SQL).match(
    /INSERT\s+INTO\s+public\.drone_bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
  ) ?? ['', ''])[1]
)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// Parameter list of each RPC's CREATE FUNCTION signature (create + accept).
const CREATE_SIGNATURE = (
  stripComments(CREATE_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_drone_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
const ACCEPT_SIGNATURE = (
  stripComments(ACCEPT_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_drone_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];

// The object literal of arguments passed to supabase.rpc('create_drone_booking', {...}).
const menuRpcArgs = (
  DRONE_MENU_TSX.match(
    /supabase\.rpc\(\s*['"]create_drone_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];
const checkoutRpcArgs = (
  CHECKOUT_TSX.match(
    /supabase\.rpc\(\s*['"]create_drone_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];

// Amount keys a browser must never send as authoritative (Rule 3).
const AMOUNT_KEYS = [
  'base_amount',
  'addons_amount',
  'total_amount',
  'advance_amount',
  'remaining_amount',
];
describe('create_drone_booking — server derives every amount', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(CREATE_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_drone_booking/i);
    expect(CREATE_SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(CREATE_SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('takes NO client-supplied amount parameter (Rule 3)', () => {
    expect(CREATE_SIGNATURE).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(CREATE_SIGNATURE).not.toMatch(new RegExp(key, 'i'));
    }
    expect(CREATE_SIGNATURE).not.toMatch(/\bamount\b|advance_percent|p_price/i);
  });

  it('requires an authenticated caller', () => {
    expect(CREATE_SQL).toMatch(/auth\.uid\(\)/);
    expect(CREATE_SQL).toMatch(/28000|not\s+authenticated|Authentication required/i);
  });

  it('derives base from the FIRST-TRUTHY 4-candidate package price chain', () => {
    // Mirrors DroneMenu's `package_price || starting_price || fixed_price ||
    // hourly_price || 0` via a coalesce(nullif(col,0), ...) chain — NOT a single
    // coalesce(package_price,0). All four candidates must be present, in order.
    expect(CREATE_SQL).toMatch(
      /v_base\s*:=\s*coalesce\(\s*nullif\(\s*v_pkg\.package_price\s*,\s*0\s*\)/i,
    );
    expect(CREATE_SQL).toMatch(/nullif\(\s*v_pkg\.starting_price\s*,\s*0\s*\)/i);
    expect(CREATE_SQL).toMatch(/nullif\(\s*v_pkg\.fixed_price\s*,\s*0\s*\)/i);
    expect(CREATE_SQL).toMatch(/nullif\(\s*v_pkg\.hourly_price\s*,\s*0\s*\)/i);
    expect(CREATE_SQL).toMatch(/from\s+public\.drone_addons/i);
    expect(CREATE_SQL).toMatch(/v_total\s*:=\s*v_base\s*\+\s*v_addons/i);
    // NOT a per-plate / guest-count model.
    expect(stripComments(CREATE_SQL)).not.toMatch(/price_per_plate|guest_count/i);
  });

  it('DEFERS advance/remaining — the INSERT stores base/addons/total ONLY', () => {
    expect(INSERT_COLUMNS).toContain('base_amount');
    expect(INSERT_COLUMNS).toContain('addons_amount');
    expect(INSERT_COLUMNS).toContain('total_amount');
    // Drone mirrors DroneMenu: advance/remaining are NOT written at creation.
    expect(INSERT_COLUMNS).not.toContain('advance_amount');
    expect(INSERT_COLUMNS).not.toContain('remaining_amount');
    // And the create RPC never reads a per-package advance rate (Drone is flat).
    expect(stripComments(CREATE_SQL)).not.toMatch(/advance_percentage/i);
  });

  it('locks the package row and requires active status', () => {
    expect(CREATE_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(CREATE_SQL).toMatch(/status\s+IS\s+DISTINCT\s+FROM\s+'active'|status\s*<>\s*'active'/i);
  });

  it('grants EXECUTE to authenticated only and revokes public/anon', () => {
    expect(CREATE_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?create_drone_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(CREATE_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?create_drone_booking[\s\S]*?TO\s+authenticated/i);
  });

  it('ships its own fail-closed catalog + verify guards', () => {
    expect(CREATE_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(CREATE_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('accept_drone_booking — server re-derives on accept', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(ACCEPT_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_drone_booking/i);
    expect(ACCEPT_SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(ACCEPT_SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('takes only the booking id — no client amount parameter', () => {
    expect(ACCEPT_SIGNATURE).toMatch(/p_booking_id\s+uuid/i);
    for (const key of AMOUNT_KEYS) {
      expect(ACCEPT_SIGNATURE).not.toMatch(new RegExp(key, 'i'));
    }
    expect(ACCEPT_SIGNATURE).not.toMatch(/\bamount\b|advance_percent|p_price/i);
  });

  it('enforces provider ownership before accepting', () => {
    expect(ACCEPT_SQL).toMatch(/auth\.uid\(\)/);
    expect(ACCEPT_SQL).toMatch(/from\s+public\.provider_profiles/i);
    expect(ACCEPT_SQL).toMatch(/pp\.user_id\s+INTO\s+v_owner_uid/i);
    expect(ACCEPT_SQL).toMatch(/v_owner_uid\s*(<>|IS\s+DISTINCT\s+FROM)\s*v_uid/i);
    expect(ACCEPT_SQL).toMatch(/Only the booking provider/i);
  });

  it('accepts only a pending booking and locks the row', () => {
    expect(ACCEPT_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(ACCEPT_SQL).toMatch(/status\s+IS\s+DISTINCT\s+FROM\s+'pending'|status\s*<>\s*'pending'/i);
  });

  it('re-derives the advance at a FLAT 20% over the STORED total, NOT advance_percentage', () => {
    expect(ACCEPT_SQL).toMatch(/v_total\s*:=\s*coalesce\(\s*v_bkg\.total_amount/i);
    expect(ACCEPT_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*20\s*\/\s*100/i);
    expect(ACCEPT_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
    // Drone is flat: the accept RPC must NOT read the package or a per-package rate.
    expect(stripComments(ACCEPT_SQL)).not.toMatch(/advance_percentage/i);
    expect(stripComments(ACCEPT_SQL)).not.toMatch(/from\s+public\.drone_packages/i);
  });

  it('grants EXECUTE to authenticated only and ships its guards', () => {
    expect(ACCEPT_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?accept_drone_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(ACCEPT_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?accept_drone_booking[\s\S]*?TO\s+authenticated/i);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$verify\$/);
  });
});

describe('client creation paths route through create_drone_booking', () => {
  it('DroneMenu "Book Now" calls the RPC and never direct-inserts a booking', () => {
    expect(DRONE_MENU_TSX).toMatch(/supabase\.rpc\(\s*['"]create_drone_booking['"]/);
    expect(stripComments(DRONE_MENU_TSX)).not.toMatch(
      /from\(\s*['"]drone_bookings['"]\s*\)\s*\.insert/,
    );
  });

  it('DroneMenu passes no amount keys — only descriptive/logistics args', () => {
    expect(menuRpcArgs).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(menuRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    expect(menuRpcArgs).toMatch(/p_package_id/);
    expect(menuRpcArgs).toMatch(/p_coverage_duration/);
    expect(menuRpcArgs).toMatch(/p_indoor_outdoor/);
    expect(menuRpcArgs).toMatch(/p_addon_ids/);
  });

  it('Checkout routes Drone cart items through the RPC, not the generic INSERT', () => {
    expect(CHECKOUT_TSX).toMatch(/supabase\.rpc\(\s*['"]create_drone_booking['"]/);
    expect(checkoutRpcArgs).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(checkoutRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    expect(checkoutRpcArgs).toMatch(/p_package_id/);
  });
});

describe('vendor accept routes through accept_drone_booking', () => {
  it('maps the drone source to the drone_bookings table', () => {
    expect(VENDOR_BOOKINGS_TSX).toMatch(/drone_bookings/);
  });

  it('accepts drone via the RPC and PATCHes no amount client-side', () => {
    const m = VENDOR_BOOKINGS_TSX.match(
      /table\s*===\s*['"]drone_bookings['"][\s\S]*?\{([\s\S]*?)\}\s*else/,
    );
    const branch = (m ?? ['', ''])[1];
    expect(branch).toMatch(/supabase\.rpc\(\s*['"]accept_drone_booking['"]/);
    expect(branch).not.toMatch(/advance_amount\s*:/);
    expect(branch).not.toMatch(/remaining_amount\s*:/);
  });
});
describe('parked column lockdown — amounts + identity un-PATCHable, INSERT RPC-only', () => {
  const GRANTED = grantedUpdateColumns(LOCKDOWN_SQL);
  const PROTECTED = sqlArray(LOCKDOWN_SQL, 'protected_cols');
  const BENIGN = sqlArray(LOCKDOWN_SQL, 'benign_cols');
  const IDENTITY = ['id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids'];
  const DESCRIPTIVE = ['coverage_duration', 'indoor_outdoor', 'drone_permission_available', 'restricted_area', 'special_requests'];

  it('is PARKED and flagged do-not-push', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO NOT db push YET/i);
    expect(LOCKDOWN_SQL).toMatch(/create_drone_booking/);
    expect(LOCKDOWN_SQL).toMatch(/accept_drone_booking/);
  });

  it('REVOKEs INSERT + UPDATE before GRANTing the benign UPDATE allowlist', () => {
    const cleaned = stripComments(LOCKDOWN_SQL);
    const revoke = cleaned.search(/REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.drone_bookings/i);
    const grant = cleaned.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revoke).toBeGreaterThanOrEqual(0);
    expect(grant).toBeGreaterThan(revoke);
    expect(cleaned).toMatch(/FROM\s+PUBLIC,\s*anon,\s*authenticated/i);
  });

  it('never GRANTs INSERT back (creation is RPC-only)', () => {
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/GRANT\s+INSERT/i);
    expect(LOCKDOWN_SQL).toMatch(/has_table_privilege\(\s*'authenticated'\s*,\s*'public\.drone_bookings'\s*,\s*'INSERT'\s*\)/i);
  });

  it('grants UPDATE on exactly the benign allowlist (22 columns)', () => {
    expect([...GRANTED].sort()).toEqual([...BENIGN].sort());
    expect(BENIGN).toHaveLength(22);
  });

  it('keeps all five amount columns protected and never grants them', () => {
    for (const key of AMOUNT_KEYS) {
      expect(PROTECTED).toContain(key);
      expect(GRANTED).not.toContain(key);
    }
  });

  it('keeps the identity/provenance columns protected', () => {
    for (const col of IDENTITY) {
      expect(PROTECTED).toContain(col);
      expect(GRANTED).not.toContain(col);
    }
  });

  it('classifies the descriptive fields BENIGN — none is a pricing multiplier', () => {
    for (const col of DESCRIPTIVE) {
      expect(BENIGN).toContain(col);
      expect(GRANTED).toContain(col);
      expect(PROTECTED).not.toContain(col);
    }
    // Drone has no per-guest / quantity multiplier COLUMN at all (contrast catering
    // / rental). No guest_count anywhere in the executable SQL or the classified lists.
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/guest_count/i);
    expect(PROTECTED).not.toContain('guest_count');
    expect(BENIGN).not.toContain('guest_count');
  });

  it('has disjoint protected/benign lists covering all 33 live columns', () => {
    expect(PROTECTED).toHaveLength(11);
    expect(BENIGN).toHaveLength(22);
    for (const col of PROTECTED) expect(BENIGN).not.toContain(col);
    expect(PROTECTED.length + BENIGN.length).toBe(33);
  });

  it('ships its own fail-closed catalog + runtime probe', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$probe\$/);
    expect(LOCKDOWN_SQL).toMatch(/SET\s+LOCAL\s+ROLE\s+authenticated/i);
  });
});

