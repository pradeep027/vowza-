/**
 * P0-1 — booking financial authority (Mehendi regression guard).
 *
 * STATIC / CONTRACT regressions that run under `npm test` with NO database. They
 * prove the *shape* of the fix holds: the browser cannot send Mehendi booking
 * amounts, the RPCs derive them server-side, and the parked lockdown keeps the
 * amount + identity columns un-PATCHable while INSERT is RPC-only. They do NOT
 * assert a real Postgres outcome — that is proven at APPLY time by the $catalog$ /
 * $verify$ / $probe$ blocks inside the migrations themselves. What THIS file
 * guards on every CI run is that nobody re-opens the hole in the source: the RPCs
 * take no amount parameter, the client paths (MehendiMenu "Book Now", the Checkout
 * cart branch, the VendorBookings accept) stop sending/PATCHing amounts, and the
 * lockdown never re-grants the protected columns.
 *
 * MEHENDI-SPECIFIC #1 (base price): Mehendi base is the SINGLE package_price column
 * (mirroring MehendiMenu's Number(pkg.package_price || 0)) — a single
 * coalesce(package_price, 0), NOT a first-truthy nullif chain like drone, and NOT
 * the price_per_hand / price_per_person / *_charges columns mehendi_packages also
 * has (the menu uses ONLY package_price). This file asserts the single-column base.
 *
 * MEHENDI-SPECIFIC #2 (advance rate): Mehendi HONORS the package's per-package
 * advance_percentage (matching MehendiMenu's Number(pkg.advance_percentage || 20)),
 * NOT a hardcoded flat 20% like band/anchor/decorator/dj/drone. accept_mehendi_booking
 * re-reads mehendi_packages.advance_percentage via the booking's package_id and
 * derives round(total * pct / 100), with a NULL-or-0 -> 20 fallback
 * (coalesce(nullif(advance_percentage, 0), 20)). This file asserts that explicitly.
 *
 * MEHENDI-SPECIFIC #3 (defer-at-create): Mehendi does NOT store advance_amount /
 * remaining_amount at creation (mirroring MehendiMenu, which stores only base/addons/
 * total) — the create INSERT column list OMITS them; they are derived at accept.
 * Same HONOR-advance_percentage + defer-at-create combination as Makeup.
 *
 * MEHENDI-SPECIFIC #4 (addons NOT is_active-filtered): mehendi_addons HAS an
 * is_active column, but MehendiMenu fetches mehendi_addons(*) unfiltered and sums the
 * selected ones, so create_mehendi_booking sums the passed ids that belong to the
 * package with NO is_active filter — behavior preservation; the price is
 * authoritative regardless. This file asserts the RPC does not filter is_active.
 *
 * MEHENDI-SPECIFIC #5 (num_clients is DESCRIPTIVE, not a multiplier): mehendi_bookings
 * has an extra num_clients column MehendiMenu collects (with an "extra clients may
 * cost more" NOTICE), but the total is base + addons regardless — the menu NEVER
 * multiplies by num_clients. It is stored descriptively and classified BENIGN
 * (browser-writable). This is the ONE structural delta vs makeup (30 cols vs 29).
 * event_type / venue / city / special_requirements are likewise descriptive.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261221000000_mehendi_booking_server_authoritative.sql');
const ACCEPT_SQL = repoFile('supabase/migrations/20261222000000_mehendi_booking_accept_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_mehendi_bookings_column_lockdown.sql');
const MEHENDI_MENU_TSX = repoFile('src/components/MehendiMenu.tsx');
const CHECKOUT_TSX = repoFile('src/pages/Checkout.tsx');
const VENDOR_BOOKINGS_TSX = repoFile('src/pages/vendor/VendorBookings.tsx');
/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');

/** Columns inside `GRANT UPDATE ( ... ) ON public.mehendi_bookings TO authenticated`. */
const grantedUpdateColumns = (sql: string): string[] => {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.mehendi_bookings\s+TO\s+authenticated/i,
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
// Column list of the create RPC's INSERT INTO public.mehendi_bookings ( ... ) VALUES.
const INSERT_COLUMNS = (
  (stripComments(CREATE_SQL).match(
    /INSERT\s+INTO\s+public\.mehendi_bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
  ) ?? ['', ''])[1]
)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// Parameter list of each RPC's CREATE FUNCTION signature (create + accept).
const CREATE_SIGNATURE = (
  stripComments(CREATE_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_mehendi_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
const ACCEPT_SIGNATURE = (
  stripComments(ACCEPT_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_mehendi_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
// The object literal of arguments passed to supabase.rpc('create_mehendi_booking', {...}).
const menuRpcArgs = (
  MEHENDI_MENU_TSX.match(
    /supabase\.rpc\(\s*['"]create_mehendi_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];
const checkoutRpcArgs = (
  CHECKOUT_TSX.match(
    /supabase\.rpc\(\s*['"]create_mehendi_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];

// Amount keys a browser must never send as authoritative (Rule 3).
const AMOUNT_KEYS = [
  'base_amount',
  'addons_amount',
  'total_amount',
  'advance_amount',
  'remaining_amount',
];
describe('create_mehendi_booking — server derives every amount', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(CREATE_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_mehendi_booking/i);
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
  it('derives base from the SINGLE package_price column (not a nullif chain)', () => {
    // Mirrors MehendiMenu's Number(pkg.package_price || 0) via a single
    // coalesce(package_price, 0) — NOT a first-truthy chain, and NOT the
    // price_per_hand / price_per_person / *_charges columns mehendi_packages has.
    expect(CREATE_SQL).toMatch(/v_base\s*:=\s*coalesce\(\s*v_pkg\.package_price\s*,\s*0\s*\)/i);
    expect(CREATE_SQL).toMatch(/from\s+public\.mehendi_addons/i);
    expect(CREATE_SQL).toMatch(/v_total\s*:=\s*v_base\s*\+\s*v_addons/i);
    // NOT a per-hand / per-person / per-plate / guest-count model.
    expect(stripComments(CREATE_SQL)).not.toMatch(/price_per_hand|price_per_person|price_per_plate|guest_count/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/festival_charges|travel_charges|outside_city_charges|group_discount/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/starting_price|fixed_price|hourly_price/i);
  });

  it('sums addons WITHOUT an is_active filter (behavior preservation)', () => {
    // MehendiMenu fetches mehendi_addons(*) unfiltered; the RPC must not add an
    // is_active filter. The price is authoritative regardless.
    expect(CREATE_SQL).toMatch(/a\.package_id\s*=\s*v_pkg\.id\s*[\s\S]*?a\.id\s*=\s*ANY/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/is_active/i);
  });
  it('DEFERS advance/remaining — the INSERT stores base/addons/total ONLY', () => {
    expect(INSERT_COLUMNS).toContain('base_amount');
    expect(INSERT_COLUMNS).toContain('addons_amount');
    expect(INSERT_COLUMNS).toContain('total_amount');
    // Mehendi mirrors MehendiMenu: advance/remaining are NOT written at creation.
    expect(INSERT_COLUMNS).not.toContain('advance_amount');
    expect(INSERT_COLUMNS).not.toContain('remaining_amount');
    // And the create RPC never reads a per-package advance rate (deferred to accept).
    expect(stripComments(CREATE_SQL)).not.toMatch(/advance_percentage/i);
  });

  it('stores num_clients descriptively and NEVER multiplies price by it', () => {
    // num_clients is collected by MehendiMenu and stored for the provider, but the
    // total is base + addons regardless — it is NOT a pricing multiplier. The RPC
    // must accept + store it without ever multiplying an amount by it.
    expect(CREATE_SIGNATURE).toMatch(/p_num_clients\s+integer/i);
    expect(INSERT_COLUMNS).toContain('num_clients');
    const created = stripComments(CREATE_SQL);
    expect(created).not.toMatch(/\*\s*(v_)?p?_?num_clients/i);
    expect(created).not.toMatch(/(v_)?p?_?num_clients\s*\*/i);
  });

  it('locks the package row and requires active status', () => {
    expect(CREATE_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(CREATE_SQL).toMatch(/status\s+IS\s+DISTINCT\s+FROM\s+'active'|status\s*<>\s*'active'/i);
  });

  it('grants EXECUTE to authenticated only and revokes public/anon', () => {
    expect(CREATE_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?create_mehendi_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(CREATE_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?create_mehendi_booking[\s\S]*?TO\s+authenticated/i);
  });

  it('ships its own fail-closed catalog + verify guards', () => {
    expect(CREATE_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(CREATE_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('accept_mehendi_booking — server re-derives on accept', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(ACCEPT_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_mehendi_booking/i);
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
  it('re-derives the advance HONORING the package advance_percentage over the STORED total', () => {
    expect(ACCEPT_SQL).toMatch(/v_total\s*:=\s*coalesce\(\s*v_bkg\.total_amount/i);
    // Mehendi HONORS the per-package rate (like dancer/makeup), NOT a flat 20%
    // (unlike dj/drone). Faithful `|| 20` mirror: NULL or 0 -> 20 via nullif.
    expect(ACCEPT_SQL).toMatch(
      /coalesce\(\s*nullif\(\s*dp\.advance_percentage\s*,\s*0\s*\)\s*,\s*20\s*\)/i,
    );
    expect(ACCEPT_SQL).toMatch(/from\s+public\.mehendi_packages/i);
    expect(ACCEPT_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*v_pct\s*\/\s*100/i);
    expect(ACCEPT_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
    // Must NOT be a hardcoded flat 20% (that would ignore advance_percentage).
    expect(ACCEPT_SQL).not.toMatch(/round\(\s*v_total\s*\*\s*20\s*\/\s*100/i);
  });

  it('grants EXECUTE to authenticated only and ships its guards', () => {
    expect(ACCEPT_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?accept_mehendi_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(ACCEPT_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?accept_mehendi_booking[\s\S]*?TO\s+authenticated/i);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('client creation paths route through create_mehendi_booking', () => {
  it('MehendiMenu "Book Now" calls the RPC and never direct-inserts a booking', () => {
    expect(MEHENDI_MENU_TSX).toMatch(/supabase\.rpc\(\s*['"]create_mehendi_booking['"]/);
    expect(stripComments(MEHENDI_MENU_TSX)).not.toMatch(
      /from\(\s*['"]mehendi_bookings['"]\s*\)\s*\.insert/,
    );
  });

  it('MehendiMenu passes no amount keys — only descriptive/logistics args', () => {
    expect(menuRpcArgs).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(menuRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    expect(menuRpcArgs).toMatch(/p_package_id/);
    expect(menuRpcArgs).toMatch(/p_num_clients/);
    expect(menuRpcArgs).toMatch(/p_special_requirements/);
    expect(menuRpcArgs).toMatch(/p_addon_ids/);
  });

  it('Checkout routes Mehendi cart items through the RPC, not the generic INSERT', () => {
    expect(CHECKOUT_TSX).toMatch(/supabase\.rpc\(\s*['"]create_mehendi_booking['"]/);
    expect(checkoutRpcArgs).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(checkoutRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    expect(checkoutRpcArgs).toMatch(/p_package_id/);
  });
});

describe('vendor accept routes through accept_mehendi_booking', () => {
  it('maps the mehendi source to the mehendi_bookings table', () => {
    expect(VENDOR_BOOKINGS_TSX).toMatch(/mehendi_bookings/);
  });

  it('accepts mehendi via the RPC and PATCHes no amount client-side', () => {
    const m = VENDOR_BOOKINGS_TSX.match(
      /table\s*===\s*['"]mehendi_bookings['"][\s\S]*?\{([\s\S]*?)\}\s*else/,
    );
    const branch = (m ?? ['', ''])[1];
    expect(branch).toMatch(/supabase\.rpc\(\s*['"]accept_mehendi_booking['"]/);
    expect(branch).not.toMatch(/advance_amount\s*:/);
    expect(branch).not.toMatch(/remaining_amount\s*:/);
  });
});
describe('parked column lockdown — amounts + identity un-PATCHable, INSERT RPC-only', () => {
  const GRANTED = grantedUpdateColumns(LOCKDOWN_SQL);
  const PROTECTED = sqlArray(LOCKDOWN_SQL, 'protected_cols');
  const BENIGN = sqlArray(LOCKDOWN_SQL, 'benign_cols');
  const IDENTITY = ['id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids'];
  const DESCRIPTIVE = ['event_type', 'venue', 'city', 'special_requirements', 'num_clients'];

  it('is PARKED and flagged do-not-push', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO NOT db push YET/i);
    expect(LOCKDOWN_SQL).toMatch(/create_mehendi_booking/);
    expect(LOCKDOWN_SQL).toMatch(/accept_mehendi_booking/);
  });

  it('REVOKEs INSERT + UPDATE before GRANTing the benign UPDATE allowlist', () => {
    const cleaned = stripComments(LOCKDOWN_SQL);
    const revoke = cleaned.search(/REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.mehendi_bookings/i);
    const grant = cleaned.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revoke).toBeGreaterThanOrEqual(0);
    expect(grant).toBeGreaterThan(revoke);
    expect(cleaned).toMatch(/FROM\s+PUBLIC,\s*anon,\s*authenticated/i);
  });

  it('never GRANTs INSERT back (creation is RPC-only)', () => {
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/GRANT\s+INSERT/i);
    expect(LOCKDOWN_SQL).toMatch(/has_table_privilege\(\s*'authenticated'\s*,\s*'public\.mehendi_bookings'\s*,\s*'INSERT'\s*\)/i);
  });

  it('grants UPDATE on exactly the benign allowlist (19 columns)', () => {
    expect([...GRANTED].sort()).toEqual([...BENIGN].sort());
    expect(BENIGN).toHaveLength(19);
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

  it('classifies num_clients + descriptive fields BENIGN — none is a pricing multiplier', () => {
    for (const col of DESCRIPTIVE) {
      expect(BENIGN).toContain(col);
      expect(GRANTED).toContain(col);
      expect(PROTECTED).not.toContain(col);
    }
    // num_clients is descriptive (NOT the rental-style quantity multiplier). It is
    // browser-writable; it is NEVER a protected pricing input.
    expect(BENIGN).toContain('num_clients');
    expect(PROTECTED).not.toContain('num_clients');
    // Mehendi has no guest_count / quantity_required multiplier column (contrast
    // catering guest_count / rental quantity_required).
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/guest_count|quantity_required/i);
    expect(PROTECTED).not.toContain('guest_count');
    expect(BENIGN).not.toContain('guest_count');
  });

  it('has disjoint protected/benign lists covering all 30 live columns', () => {
    expect(PROTECTED).toHaveLength(11);
    expect(BENIGN).toHaveLength(19);
    for (const col of PROTECTED) expect(BENIGN).not.toContain(col);
    expect(PROTECTED.length + BENIGN.length).toBe(30);
  });

  it('ships its own fail-closed catalog + runtime probe', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$probe\$/);
    expect(LOCKDOWN_SQL).toMatch(/SET\s+LOCAL\s+ROLE\s+authenticated/i);
  });
});
