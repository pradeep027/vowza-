/**
 * P0-1 — booking financial authority (DANCER regression guard).
 *
 * STATIC / CONTRACT regressions that run under `npm test` with NO database. They
 * prove the *shape* of the fix holds: the browser cannot send dancer booking
 * amounts, the RPCs derive them server-side, and the parked lockdown keeps the
 * amount + identity columns un-PATCHable while INSERT is RPC-only. They do NOT
 * assert a real Postgres outcome — that is proven at APPLY time by the $catalog$
 * / $verify$ / $probe$ blocks inside the migrations themselves. What THIS file
 * guards on every CI run is that nobody re-opens the hole in the source: the RPCs
 * take no amount parameter, the client paths (DancerMenu "Book Now", the
 * Checkout cart branch, the VendorBookings accept) stop sending/PATCHing amounts,
 * and the lockdown never re-grants the protected columns.
 *
 * DANCER-SPECIFIC #1 (advance rate): dancer is a FLAT package_price model (base =
 * package_price), like band/anchor/decorator — NOT catering's per-plate model.
 * BUT unlike those flat categories (which use a hardcoded 20% advance), dancer's
 * authoritative advance rate is the package's PER-PACKAGE advance_percentage
 * column. Both RPCs derive the advance from it (round(total * advance_percentage
 * / 100)), and this file asserts that explicitly.
 *
 * DANCER-SPECIFIC #2 (descriptive fields): dance_type / number_of_dancers /
 * performance_duration / special_requirements are DESCRIPTIVE — the total is
 * package_price + addons regardless of them. number_of_dancers in particular is
 * NOT a pricing multiplier (contrast catering's guest_count), so it is classified
 * BENIGN, not protected. This file asserts that contrast explicitly.
 *
 * DANCER-SPECIFIC #3 (store-at-create): dancer STORES advance_amount /
 * remaining_amount at creation (mirroring DancerMenu), so the create INSERT column
 * list DOES include them — unlike decorator/anchor, which defer them to accept.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261213000000_dancer_booking_server_authoritative.sql');
const ACCEPT_SQL = repoFile('supabase/migrations/20261214000000_dancer_booking_accept_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_dancer_bookings_column_lockdown.sql');
const DANCER_MENU_TSX = repoFile('src/components/DancerMenu.tsx');
const CHECKOUT_TSX = repoFile('src/pages/Checkout.tsx');
const VENDOR_BOOKINGS_TSX = repoFile('src/pages/vendor/VendorBookings.tsx');

/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');

/** Columns inside `GRANT UPDATE ( ... ) ON public.dancer_bookings TO authenticated`. */
const grantedUpdateColumns = (sql: string): string[] => {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.dancer_bookings\s+TO\s+authenticated/i,
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

// Column list of the create RPC's INSERT INTO public.dancer_bookings ( ... ) VALUES.
const INSERT_COLUMNS = (
  (stripComments(CREATE_SQL).match(
    /INSERT\s+INTO\s+public\.dancer_bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
  ) ?? ['', ''])[1]
)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// Parameter list of each RPC's CREATE FUNCTION signature (create + accept).
const CREATE_SIGNATURE = (
  stripComments(CREATE_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_dancer_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
const ACCEPT_SIGNATURE = (
  stripComments(ACCEPT_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_dancer_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];

// The object literal of arguments passed to supabase.rpc('create_dancer_booking', {...}).
const menuRpcArgs = (
  DANCER_MENU_TSX.match(
    /supabase\.rpc\(\s*['"]create_dancer_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];
const checkoutRpcArgs = (
  CHECKOUT_TSX.match(
    /supabase\.rpc\(\s*['"]create_dancer_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];

// Amount keys a browser must never send as authoritative (Rule 3).
const AMOUNT_KEYS = [
  'base_amount',
  'addons_amount',
  'total_amount',
  'advance_amount',
  'remaining_amount',
];

describe('create_dancer_booking — server derives every amount', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(CREATE_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_dancer_booking/i);
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
    expect(CREATE_SQL).toMatch(/28000|not\s+authenticated/i);
  });

  it('derives base from the package price and addons from dancer_addons', () => {
    expect(CREATE_SQL).toMatch(/v_base\s*:=\s*coalesce\(\s*v_pkg\.package_price/i);
    expect(CREATE_SQL).toMatch(/from\s+public\.dancer_addons/i);
    expect(CREATE_SQL).toMatch(/v_total\s*:=\s*v_base\s*\+\s*v_addons/i);
    // NOT a per-plate / guest-count model.
    expect(stripComments(CREATE_SQL)).not.toMatch(/price_per_plate|guest_count/i);
  });

  it('derives advance from the package advance_percentage, NOT a hardcoded 20%', () => {
    expect(CREATE_SQL).toMatch(/v_pct\s*:=\s*coalesce\(\s*v_pkg\.advance_percentage/i);
    expect(CREATE_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*v_pct\s*\/\s*100/i);
    expect(CREATE_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
  });

  it('STORES all five amounts on the INSERT (dancer store-at-create)', () => {
    for (const key of AMOUNT_KEYS) {
      expect(INSERT_COLUMNS).toContain(key);
    }
  });

  it('locks the package row and requires active status', () => {
    expect(CREATE_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(CREATE_SQL).toMatch(/status\s+IS\s+DISTINCT\s+FROM\s+'active'|status\s*<>\s*'active'/i);
  });

  it('grants EXECUTE to authenticated only and revokes public/anon', () => {
    expect(CREATE_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?create_dancer_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(CREATE_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?create_dancer_booking[\s\S]*?TO\s+authenticated/i);
  });

  it('ships its own fail-closed catalog + verify guards', () => {
    expect(CREATE_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(CREATE_SQL).toMatch(/DO\s+\$verify\$/);
  });
});

describe('accept_dancer_booking — server re-derives on accept', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(ACCEPT_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_dancer_booking/i);
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

  it('re-derives the advance from the re-read advance_percentage over the STORED total', () => {
    expect(ACCEPT_SQL).toMatch(/from\s+public\.dancer_packages/i);
    expect(ACCEPT_SQL).toMatch(/advance_percentage/i);
    expect(ACCEPT_SQL).toMatch(/v_total\s*:=\s*coalesce\(\s*v_bkg\.total_amount/i);
    expect(ACCEPT_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*v_pct\s*\/\s*100/i);
    expect(ACCEPT_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
  });

  it('grants EXECUTE to authenticated only and ships its guards', () => {
    expect(ACCEPT_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?accept_dancer_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(ACCEPT_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?accept_dancer_booking[\s\S]*?TO\s+authenticated/i);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$verify\$/);
  });
});

describe('client creation paths route through create_dancer_booking', () => {
  it('DancerMenu "Book Now" calls the RPC and never direct-inserts a booking', () => {
    expect(DANCER_MENU_TSX).toMatch(/supabase\.rpc\(\s*['"]create_dancer_booking['"]/);
    expect(stripComments(DANCER_MENU_TSX)).not.toMatch(
      /from\(\s*['"]dancer_bookings['"]\s*\)\s*\.insert/,
    );
  });

  it('DancerMenu passes no amount keys — only descriptive/logistics args', () => {
    expect(menuRpcArgs).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(menuRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    expect(menuRpcArgs).toMatch(/p_package_id/);
    expect(menuRpcArgs).toMatch(/p_number_of_dancers/);
  });

  it('Checkout routes dancer cart items through the RPC, not the generic INSERT', () => {
    expect(CHECKOUT_TSX).toMatch(/supabase\.rpc\(\s*['"]create_dancer_booking['"]/);
    expect(checkoutRpcArgs).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(checkoutRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    expect(checkoutRpcArgs).toMatch(/p_package_id/);
  });
});

describe('vendor accept routes through accept_dancer_booking', () => {
  it('maps the dancer source to the dancer_bookings table', () => {
    expect(VENDOR_BOOKINGS_TSX).toMatch(/dancer_bookings/);
  });

  it('accepts dancer via the RPC and PATCHes no amount client-side', () => {
    const m = VENDOR_BOOKINGS_TSX.match(
      /table\s*===\s*['"]dancer_bookings['"][\s\S]*?\{([\s\S]*?)\}\s*else/,
    );
    const branch = (m ?? ['', ''])[1];
    expect(branch).toMatch(/supabase\.rpc\(\s*['"]accept_dancer_booking['"]/);
    expect(branch).not.toMatch(/advance_amount\s*:/);
    expect(branch).not.toMatch(/remaining_amount\s*:/);
  });
});

describe('parked column lockdown — amounts + identity un-PATCHable, INSERT RPC-only', () => {
  const GRANTED = grantedUpdateColumns(LOCKDOWN_SQL);
  const PROTECTED = sqlArray(LOCKDOWN_SQL, 'protected_cols');
  const BENIGN = sqlArray(LOCKDOWN_SQL, 'benign_cols');
  const IDENTITY = ['id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids'];
  const DESCRIPTIVE = ['number_of_dancers', 'dance_type', 'performance_duration', 'special_requirements'];

  it('is PARKED and flagged do-not-push', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO NOT db push YET/i);
    expect(LOCKDOWN_SQL).toMatch(/create_dancer_booking/);
    expect(LOCKDOWN_SQL).toMatch(/accept_dancer_booking/);
  });

  it('REVOKEs INSERT + UPDATE before GRANTing the benign UPDATE allowlist', () => {
    const cleaned = stripComments(LOCKDOWN_SQL);
    const revoke = cleaned.search(/REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.dancer_bookings/i);
    const grant = cleaned.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revoke).toBeGreaterThanOrEqual(0);
    expect(grant).toBeGreaterThan(revoke);
    expect(cleaned).toMatch(/FROM\s+PUBLIC,\s*anon,\s*authenticated/i);
  });

  it('never GRANTs INSERT back (creation is RPC-only)', () => {
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/GRANT\s+INSERT/i);
    expect(LOCKDOWN_SQL).toMatch(/has_table_privilege\(\s*'authenticated'\s*,\s*'public\.dancer_bookings'\s*,\s*'INSERT'\s*\)/i);
  });

  it('grants UPDATE on exactly the benign allowlist (21 columns)', () => {
    expect([...GRANTED].sort()).toEqual([...BENIGN].sort());
    expect(BENIGN).toHaveLength(21);
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
    // dancer has no per-guest multiplier COLUMN at all (contrast catering); the
    // only textual mention of guest_count is the explanatory comment, so assert
    // against comment-stripped executable SQL.
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/guest_count/i);
    expect(PROTECTED).not.toContain('guest_count');
    expect(BENIGN).not.toContain('guest_count');
  });

  it('has disjoint protected/benign lists covering all 32 live columns', () => {
    expect(PROTECTED).toHaveLength(11);
    expect(BENIGN).toHaveLength(21);
    for (const col of PROTECTED) expect(BENIGN).not.toContain(col);
    expect(PROTECTED.length + BENIGN.length).toBe(32);
  });

  it('ships its own fail-closed catalog + runtime probe', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$probe\$/);
    expect(LOCKDOWN_SQL).toMatch(/SET\s+LOCAL\s+ROLE\s+authenticated/i);
  });
});
