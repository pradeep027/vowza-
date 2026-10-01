/**
 * P0-1 — booking financial authority (DJ regression guard).
 *
 * STATIC / CONTRACT regressions that run under `npm test` with NO database. They
 * prove the *shape* of the fix holds: the browser cannot send DJ booking amounts,
 * the RPCs derive them server-side, and the parked lockdown keeps the amount +
 * identity columns un-PATCHable while INSERT is RPC-only. They do NOT assert a
 * real Postgres outcome — that is proven at APPLY time by the $catalog$ /
 * $verify$ / $probe$ blocks inside the migrations themselves. What THIS file
 * guards on every CI run is that nobody re-opens the hole in the source: the RPCs
 * take no amount parameter, the client paths (DJMenu "Book Now", the Checkout
 * cart branch, the VendorBookings accept) stop sending/PATCHing amounts, and the
 * lockdown never re-grants the protected columns.
 *
 * DJ-SPECIFIC #1 (advance rate): DJ is a FLAT package_price model (base =
 * package_price), like band/anchor/decorator — NOT catering's per-plate model.
 * Its advance is a hardcoded FLAT 20% (matching DJMenu's Math.round(total * 0.2)),
 * NOT the per-package advance_percentage column (contrast dancer). accept_dj_booking
 * derives round(total * 20 / 100) and does NOT read dj_packages. This file asserts
 * that explicitly.
 *
 * DJ-SPECIFIC #2 (descriptive fields): expected_audience / song_requests /
 * special_instructions are DESCRIPTIVE — the total is package_price + addons
 * regardless of them. expected_audience in particular is NOT a pricing multiplier
 * (contrast catering's guest_count), so it is classified BENIGN, not protected.
 *
 * DJ-SPECIFIC #3 (defer-at-create): DJ does NOT store advance_amount /
 * remaining_amount at creation (mirroring DJMenu, which stores only base/addons/
 * total) — the create INSERT column list OMITS them; they are derived at accept.
 * (Contrast dancer, which stores all five at creation.)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261215000000_dj_booking_server_authoritative.sql');
const ACCEPT_SQL = repoFile('supabase/migrations/20261216000000_dj_booking_accept_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_dj_bookings_column_lockdown.sql');
const DJ_MENU_TSX = repoFile('src/components/DJMenu.tsx');
const CHECKOUT_TSX = repoFile('src/pages/Checkout.tsx');
const VENDOR_BOOKINGS_TSX = repoFile('src/pages/vendor/VendorBookings.tsx');

/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');

/** Columns inside `GRANT UPDATE ( ... ) ON public.dj_bookings TO authenticated`. */
const grantedUpdateColumns = (sql: string): string[] => {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.dj_bookings\s+TO\s+authenticated/i,
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

// Column list of the create RPC's INSERT INTO public.dj_bookings ( ... ) VALUES.
const INSERT_COLUMNS = (
  (stripComments(CREATE_SQL).match(
    /INSERT\s+INTO\s+public\.dj_bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
  ) ?? ['', ''])[1]
)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// Parameter list of each RPC's CREATE FUNCTION signature (create + accept).
const CREATE_SIGNATURE = (
  stripComments(CREATE_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_dj_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
const ACCEPT_SIGNATURE = (
  stripComments(ACCEPT_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_dj_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];

// The object literal of arguments passed to supabase.rpc('create_dj_booking', {...}).
const menuRpcArgs = (
  DJ_MENU_TSX.match(
    /supabase\.rpc\(\s*['"]create_dj_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];
const checkoutRpcArgs = (
  CHECKOUT_TSX.match(
    /supabase\.rpc\(\s*['"]create_dj_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];

// Amount keys a browser must never send as authoritative (Rule 3).
const AMOUNT_KEYS = [
  'base_amount',
  'addons_amount',
  'total_amount',
  'advance_amount',
  'remaining_amount',
];

describe('create_dj_booking — server derives every amount', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(CREATE_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_dj_booking/i);
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

  it('derives base from the package price and addons from dj_addons', () => {
    expect(CREATE_SQL).toMatch(/v_base\s*:=\s*coalesce\(\s*v_pkg\.package_price/i);
    expect(CREATE_SQL).toMatch(/from\s+public\.dj_addons/i);
    expect(CREATE_SQL).toMatch(/v_total\s*:=\s*v_base\s*\+\s*v_addons/i);
    // NOT a per-plate / guest-count model.
    expect(stripComments(CREATE_SQL)).not.toMatch(/price_per_plate|guest_count/i);
  });

  it('DEFERS advance/remaining — the INSERT stores base/addons/total ONLY', () => {
    expect(INSERT_COLUMNS).toContain('base_amount');
    expect(INSERT_COLUMNS).toContain('addons_amount');
    expect(INSERT_COLUMNS).toContain('total_amount');
    // DJ mirrors DJMenu: advance/remaining are NOT written at creation.
    expect(INSERT_COLUMNS).not.toContain('advance_amount');
    expect(INSERT_COLUMNS).not.toContain('remaining_amount');
    // And the create RPC never reads a per-package advance rate (DJ is flat).
    expect(stripComments(CREATE_SQL)).not.toMatch(/advance_percentage/i);
  });

  it('locks the package row and requires active status', () => {
    expect(CREATE_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(CREATE_SQL).toMatch(/status\s+IS\s+DISTINCT\s+FROM\s+'active'|status\s*<>\s*'active'/i);
  });

  it('grants EXECUTE to authenticated only and revokes public/anon', () => {
    expect(CREATE_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?create_dj_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(CREATE_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?create_dj_booking[\s\S]*?TO\s+authenticated/i);
  });

  it('ships its own fail-closed catalog + verify guards', () => {
    expect(CREATE_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(CREATE_SQL).toMatch(/DO\s+\$verify\$/);
  });
});

describe('accept_dj_booking — server re-derives on accept', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(ACCEPT_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_dj_booking/i);
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
    // DJ is flat: the accept RPC must NOT read the package or a per-package rate.
    expect(stripComments(ACCEPT_SQL)).not.toMatch(/advance_percentage/i);
    expect(stripComments(ACCEPT_SQL)).not.toMatch(/from\s+public\.dj_packages/i);
  });

  it('grants EXECUTE to authenticated only and ships its guards', () => {
    expect(ACCEPT_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?accept_dj_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(ACCEPT_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?accept_dj_booking[\s\S]*?TO\s+authenticated/i);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$verify\$/);
  });
});

describe('client creation paths route through create_dj_booking', () => {
  it('DJMenu "Book Now" calls the RPC and never direct-inserts a booking', () => {
    expect(DJ_MENU_TSX).toMatch(/supabase\.rpc\(\s*['"]create_dj_booking['"]/);
    expect(stripComments(DJ_MENU_TSX)).not.toMatch(
      /from\(\s*['"]dj_bookings['"]\s*\)\s*\.insert/,
    );
  });

  it('DJMenu passes no amount keys — only descriptive/logistics args', () => {
    expect(menuRpcArgs).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(menuRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    expect(menuRpcArgs).toMatch(/p_package_id/);
    expect(menuRpcArgs).toMatch(/p_expected_audience/);
    expect(menuRpcArgs).toMatch(/p_song_requests/);
  });

  it('Checkout routes DJ cart items through the RPC, not the generic INSERT', () => {
    expect(CHECKOUT_TSX).toMatch(/supabase\.rpc\(\s*['"]create_dj_booking['"]/);
    expect(checkoutRpcArgs).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(checkoutRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    expect(checkoutRpcArgs).toMatch(/p_package_id/);
  });
});

describe('vendor accept routes through accept_dj_booking', () => {
  it('maps the dj source to the dj_bookings table', () => {
    expect(VENDOR_BOOKINGS_TSX).toMatch(/dj_bookings/);
  });

  it('accepts dj via the RPC and PATCHes no amount client-side', () => {
    const m = VENDOR_BOOKINGS_TSX.match(
      /table\s*===\s*['"]dj_bookings['"][\s\S]*?\{([\s\S]*?)\}\s*else/,
    );
    const branch = (m ?? ['', ''])[1];
    expect(branch).toMatch(/supabase\.rpc\(\s*['"]accept_dj_booking['"]/);
    expect(branch).not.toMatch(/advance_amount\s*:/);
    expect(branch).not.toMatch(/remaining_amount\s*:/);
  });
});

describe('parked column lockdown — amounts + identity un-PATCHable, INSERT RPC-only', () => {
  const GRANTED = grantedUpdateColumns(LOCKDOWN_SQL);
  const PROTECTED = sqlArray(LOCKDOWN_SQL, 'protected_cols');
  const BENIGN = sqlArray(LOCKDOWN_SQL, 'benign_cols');
  const IDENTITY = ['id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids'];
  const DESCRIPTIVE = ['expected_audience', 'song_requests', 'special_instructions'];

  it('is PARKED and flagged do-not-push', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO NOT db push YET/i);
    expect(LOCKDOWN_SQL).toMatch(/create_dj_booking/);
    expect(LOCKDOWN_SQL).toMatch(/accept_dj_booking/);
  });

  it('REVOKEs INSERT + UPDATE before GRANTing the benign UPDATE allowlist', () => {
    const cleaned = stripComments(LOCKDOWN_SQL);
    const revoke = cleaned.search(/REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.dj_bookings/i);
    const grant = cleaned.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revoke).toBeGreaterThanOrEqual(0);
    expect(grant).toBeGreaterThan(revoke);
    expect(cleaned).toMatch(/FROM\s+PUBLIC,\s*anon,\s*authenticated/i);
  });

  it('never GRANTs INSERT back (creation is RPC-only)', () => {
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/GRANT\s+INSERT/i);
    expect(LOCKDOWN_SQL).toMatch(/has_table_privilege\(\s*'authenticated'\s*,\s*'public\.dj_bookings'\s*,\s*'INSERT'\s*\)/i);
  });

  it('grants UPDATE on exactly the benign allowlist (20 columns)', () => {
    expect([...GRANTED].sort()).toEqual([...BENIGN].sort());
    expect(BENIGN).toHaveLength(20);
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
    // DJ has no per-guest multiplier COLUMN at all (contrast catering). No
    // guest_count anywhere in the executable SQL or the classified lists.
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/guest_count/i);
    expect(PROTECTED).not.toContain('guest_count');
    expect(BENIGN).not.toContain('guest_count');
  });

  it('has disjoint protected/benign lists covering all 31 live columns', () => {
    expect(PROTECTED).toHaveLength(11);
    expect(BENIGN).toHaveLength(20);
    for (const col of PROTECTED) expect(BENIGN).not.toContain(col);
    expect(PROTECTED.length + BENIGN.length).toBe(31);
  });

  it('ships its own fail-closed catalog + runtime probe', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$probe\$/);
    expect(LOCKDOWN_SQL).toMatch(/SET\s+LOCAL\s+ROLE\s+authenticated/i);
  });
});

