/**
 * P0-1 — booking financial authority (Videography regression guard).
 *
 * STATIC / CONTRACT regressions run under `npm test` with NO database. They
 * prove the *shape* of the fix holds: the browser cannot send Videography
 * booking amounts, the RPCs derive them server-side, and the parked lockdown
 * keeps the amount + identity columns un-PATCHable while INSERT is RPC-only.
 * What THIS file guards on every CI run is that nobody re-opens the hole in the
 * source: the RPCs take no amount parameter, the client paths (VideographyMenu
 * "Book Now", the Checkout cart branch, the VendorBookings accept) stop
 * sending/PATCHing amounts, and the lockdown never re-grants the protected
 * columns. The real Postgres outcome is proven at APPLY time by the migrations'
 * own $catalog$ / $verify$ / $probe$ blocks.
 *
 * VIDEOGRAPHY-SPECIFIC #1 (base): base is a TWO-column first-truthy chain
 * starting_price then package_price (VideographyMenu's Number(pkg.starting_price
 * || pkg.package_price || 0)) — coalesce(nullif(starting_price,0),
 * nullif(package_price,0), 0), NOT a single column and NOT any other category's
 * price column. Videography has NO quantity/multiplier — total is base + addons.
 *
 * VIDEOGRAPHY-SPECIFIC #2 (advance rate): Videography HONORS the package's
 * per-package advance_percentage (VideographyMenu's Number(pkg.advance_percentage
 * || 20)), NOT a flat 20% like band/anchor/decorator/dj/drone. create + accept
 * both derive round(total * pct / 100) with pct = coalesce(nullif(
 * advance_percentage, 0), 20) — NULL-or-0 -> 20.
 *
 * VIDEOGRAPHY-SPECIFIC #3 (STORE-at-create): Videography STORES advance_amount /
 * remaining_amount AT CREATION (like dancer/priest/rental/singer, UNLIKE
 * makeup/mehendi which defer). The create INSERT lists all five amounts; accept
 * RE-CONFIRMS them from the trusted stored total.
 *
 * VIDEOGRAPHY-SPECIFIC #4 (addons dead-but-supported, NO is_active filter):
 * videography_addons HAS an is_active column, but — matching the band pilot /
 * singer convention — the RPC does NOT filter on it: it sums the passed ids that
 * belong to the package. VideographyMenu passes NO addon ids today
 * (selected_addon_ids = [], addons_amount = 0), so today yields 0 addons while a
 * future addon-carrying caller is priced from the trusted rows.
 *
 * VIDEOGRAPHY-SPECIFIC #5 (no multiplier, no event_type fallback, special_requirements,
 * extra `notes` column): videography has NO quantity/guest_count multiplier
 * (guestCount is collected in the UI but never written — videography_bookings has
 * no such column). Unlike priest, event_type is NOT defaulted to package_type
 * (VideographyMenu writes eventType || null); the RPC stores nullif(p_event_type,
 * ''). Videography writes special_REQUIREMENTS (col special_requirements). The
 * table has an extra `notes` column (benign) singer lacked → lockdown 11
 * protected / 19 benign / 30 total.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261229000000_videography_booking_server_authoritative.sql');
const ACCEPT_SQL = repoFile('supabase/migrations/20261230000000_videography_booking_accept_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_videography_bookings_column_lockdown.sql');
const VIDEOGRAPHY_MENU_TSX = repoFile('src/components/VideographyMenu.tsx');
const CHECKOUT_TSX = repoFile('src/pages/Checkout.tsx');
const VENDOR_BOOKINGS_TSX = repoFile('src/pages/vendor/VendorBookings.tsx');
/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');

/** Columns inside `GRANT UPDATE ( ... ) ON public.videography_bookings TO authenticated`. */
const grantedUpdateColumns = (sql: string): string[] => {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.videography_bookings\s+TO\s+authenticated/i,
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
// Column list of the create RPC's INSERT INTO public.videography_bookings ( ... ) VALUES.
const INSERT_COLUMNS = (
  (stripComments(CREATE_SQL).match(
    /INSERT\s+INTO\s+public\.videography_bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
  ) ?? ['', ''])[1]
)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// Parameter list of each RPC's CREATE FUNCTION signature (create + accept).
const CREATE_SIGNATURE = (
  stripComments(CREATE_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_videography_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
const ACCEPT_SIGNATURE = (
  stripComments(ACCEPT_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_videography_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
// The object literal of arguments passed to supabase.rpc('create_videography_booking', {...}).
const menuRpcArgs = (
  VIDEOGRAPHY_MENU_TSX.match(
    /supabase\.rpc\(\s*['"]create_videography_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];
const checkoutRpcArgs = (
  CHECKOUT_TSX.match(
    /supabase\.rpc\(\s*['"]create_videography_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];

// Amount keys a browser must never send as authoritative (Rule 3).
const AMOUNT_KEYS = [
  'base_amount',
  'addons_amount',
  'total_amount',
  'advance_amount',
  'remaining_amount',
];
describe('create_videography_booking — server derives every amount', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(CREATE_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_videography_booking/i);
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
  it('derives base from the TWO-column starting_price||package_price chain (no multiplier)', () => {
    // Mirrors VideographyMenu's Number(pkg.starting_price || pkg.package_price ||
    // 0): starting_price wins when non-zero, else package_price, else 0 — a
    // coalesce(nullif(...),nullif(...),0) chain, and NO quantity multiplier.
    expect(CREATE_SQL).toMatch(
      /v_base\s*:=\s*coalesce\(\s*nullif\(\s*v_pkg\.starting_price\s*,\s*0\s*\)\s*,\s*nullif\(\s*v_pkg\.package_price\s*,\s*0\s*\)\s*,\s*0\s*\)/i,
    );
    expect(CREATE_SQL).toMatch(/from\s+public\.videography_addons/i);
    expect(CREATE_SQL).toMatch(/v_total\s*:=\s*v_base\s*\+\s*v_addons/i);
    // Not any OTHER category's price column, and no ancillary videography price cols.
    expect(stripComments(CREATE_SQL)).not.toMatch(/service_price|hall_rental_price|base_price|price_per_hand|price_per_person|price_per_plate/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/hourly_price|full_day_price|half_day_price|extra_hour_cost|extra_coverage_cost/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/guest_count|num_clients|quantity/i);
  });
  it('sums addons WITHOUT an is_active filter (band pilot / singer convention)', () => {
    // videography_addons HAS an is_active column, but the RPC deliberately does
    // NOT filter on it (matching band/singer): the id must belong to the package,
    // and the price is taken from the trusted row.
    expect(CREATE_SQL).toMatch(/a\.package_id\s*=\s*v_pkg\.id\s*[\s\S]*?a\.id\s*=\s*ANY/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/is_active/i);
  });
  it('STORES all five amounts at create AND derives advance HONORING advance_percentage', () => {
    // Videography mirrors VideographyMenu: advance/remaining ARE written at
    // creation (like dancer/priest/rental/singer). The INSERT stores all five.
    expect(INSERT_COLUMNS).toContain('base_amount');
    expect(INSERT_COLUMNS).toContain('addons_amount');
    expect(INSERT_COLUMNS).toContain('total_amount');
    expect(INSERT_COLUMNS).toContain('advance_amount');
    expect(INSERT_COLUMNS).toContain('remaining_amount');
    // The create RPC derives the advance HONORING the per-package rate (NULL or
    // 0 -> 20 via nullif), NOT a flat 20%.
    expect(CREATE_SQL).toMatch(
      /v_pct\s*:=\s*coalesce\(\s*nullif\(\s*v_pkg\.advance_percentage\s*,\s*0\s*\)\s*,\s*20\s*\)/i,
    );
    expect(CREATE_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*v_pct\s*\/\s*100/i);
    expect(CREATE_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
    expect(CREATE_SQL).not.toMatch(/round\(\s*v_total\s*\*\s*20\s*\/\s*100/i);
  });

  it('does NOT fall back event_type to package_type (VideographyMenu writes eventType || null)', () => {
    // Unlike priest, videography stores nullif(p_event_type, '') with NO fallback.
    expect(CREATE_SQL).toMatch(/nullif\(\s*p_event_type\s*,\s*''\s*\)/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/package_type/i);
  });

  it('writes special_requirements (NOT special_instructions), plus venue/city/event_type', () => {
    expect(CREATE_SIGNATURE).toMatch(/p_special_requirements\s+text/i);
    expect(INSERT_COLUMNS).toContain('special_requirements');
    expect(INSERT_COLUMNS).not.toContain('special_instructions');
    // videography_bookings HAS venue/city/event_type — the create RPC writes them.
    expect(INSERT_COLUMNS).toContain('venue');
    expect(INSERT_COLUMNS).toContain('city');
    expect(INSERT_COLUMNS).toContain('event_type');
  });

  it('locks the package row and requires active status', () => {
    expect(CREATE_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(CREATE_SQL).toMatch(/status\s+IS\s+DISTINCT\s+FROM\s+'active'|status\s*<>\s*'active'/i);
  });

  it('grants EXECUTE to authenticated only and revokes public/anon', () => {
    expect(CREATE_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?create_videography_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(CREATE_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?create_videography_booking[\s\S]*?TO\s+authenticated/i);
  });

  it('ships its own fail-closed catalog + verify guards', () => {
    expect(CREATE_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(CREATE_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('accept_videography_booking — server re-derives the advance, never the client', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(ACCEPT_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_videography_booking/i);
    expect(ACCEPT_SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(ACCEPT_SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
    expect(ACCEPT_SQL).toMatch(/RETURNS\s+jsonb/i);
    expect(ACCEPT_SQL).toMatch(/jsonb_build_object/i);
  });

  it('takes ONLY the booking id — no client advance/amount parameter', () => {
    expect(ACCEPT_SIGNATURE).toMatch(/p_booking_id\s+uuid/i);
    for (const key of AMOUNT_KEYS) {
      expect(ACCEPT_SIGNATURE).not.toMatch(new RegExp(key, 'i'));
    }
    expect(ACCEPT_SIGNATURE).not.toMatch(/\bamount\b|advance_percent|p_pct/i);
  });

  it('requires an authenticated caller who OWNS the booking provider', () => {
    expect(ACCEPT_SQL).toMatch(/auth\.uid\(\)/);
    expect(ACCEPT_SQL).toMatch(/28000|Authentication required/i);
    // provider_id -> provider_profiles.id -> provider_profiles.user_id = auth.uid().
    expect(ACCEPT_SQL).toMatch(/from\s+public\.provider_profiles\s+pp[\s\S]*?pp\.id\s*=\s*v_bkg\.provider_id/i);
    expect(ACCEPT_SQL).toMatch(/v_owner_uid\s+IS\s+NULL\s+OR\s+v_owner_uid\s*<>\s*v_uid/i);
    expect(ACCEPT_SQL).toMatch(/42501/);
  });

  it('accepts only a pending booking and row-locks it', () => {
    expect(ACCEPT_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(ACCEPT_SQL).toMatch(/status\s+IS\s+DISTINCT\s+FROM\s+'pending'/i);
  });

  it('re-derives advance from the STORED total HONORING advance_percentage (not flat 20)', () => {
    // pct from the package, NULL-or-0 -> 20; advance = round(stored_total * pct/100).
    expect(ACCEPT_SQL).toMatch(
      /coalesce\(\s*nullif\(\s*dp\.advance_percentage\s*,\s*0\s*\)\s*,\s*20\s*\)[\s\S]*?from\s+public\.videography_packages/i,
    );
    expect(ACCEPT_SQL).toMatch(/v_total\s*:=\s*coalesce\(\s*v_bkg\.total_amount\s*,\s*0\s*\)/i);
    expect(ACCEPT_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*v_pct\s*\/\s*100/i);
    expect(ACCEPT_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
    expect(ACCEPT_SQL).not.toMatch(/round\(\s*v_total\s*\*\s*20\s*\/\s*100/i);
  });

  it('grants EXECUTE to authenticated only and ships catalog + verify guards', () => {
    expect(ACCEPT_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?accept_videography_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(ACCEPT_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?accept_videography_booking[\s\S]*?TO\s+authenticated/i);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('client creation paths route through create_videography_booking (no browser amounts)', () => {
  it('VideographyMenu "Book Now" calls the RPC and never direct-inserts videography_bookings', () => {
    expect(VIDEOGRAPHY_MENU_TSX).toMatch(/supabase\.rpc\(\s*['"]create_videography_booking['"]/);
    // No direct table INSERT into videography_bookings from the browser anymore.
    expect(VIDEOGRAPHY_MENU_TSX).not.toMatch(/\.from\(\s*['"]videography_bookings['"]\s*\)/);
  });

  it('VideographyMenu sends identifiers/selections ONLY — no authoritative amount keys', () => {
    expect(menuRpcArgs).not.toBe('');
    expect(menuRpcArgs).toMatch(/p_package_id/);
    expect(menuRpcArgs).toMatch(/p_special_requirements/);
    expect(menuRpcArgs).toMatch(/p_addon_ids/);
    for (const key of AMOUNT_KEYS) {
      expect(menuRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    // customer_id is FORCED server-side; videography has no quantity multiplier.
    expect(menuRpcArgs).not.toMatch(/customer_id/i);
    expect(menuRpcArgs).not.toMatch(/num_clients|guest_count|quantity/i);
  });

  it('Checkout routes videography cart items through the RPC, not the generic amount INSERT', () => {
    expect(CHECKOUT_TSX).toMatch(/item\.bookingTable\s*===\s*['"]videography_bookings['"]/);
    expect(checkoutRpcArgs).not.toBe('');
    expect(checkoutRpcArgs).toMatch(/p_package_id/);
    expect(checkoutRpcArgs).toMatch(/p_addon_ids/);
    for (const key of AMOUNT_KEYS) {
      expect(checkoutRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    // Videography's descriptive free-text field flows as p_special_requirements.
    expect(checkoutRpcArgs).toMatch(/p_special_requirements/);
  });
});
describe('VendorBookings accept routes videography through accept_videography_booking (no client PATCH)', () => {
  // The videography branch body: from `=== 'videography_bookings')` to the next `} else {`.
  const VIDEOGRAPHY_ACCEPT_BRANCH = (
    VENDOR_BOOKINGS_TSX.match(/===\s*['"]videography_bookings['"]\s*\)([\s\S]*?)\}\s*else\s*\{/) ?? ['', ''])[1];

  it('maps the videography source to the videography_bookings table', () => {
    expect(VENDOR_BOOKINGS_TSX).toMatch(/_source\s*===\s*['"]videography['"]\s*\?\s*['"]videography_bookings['"]/);
  });

  it('calls accept_videography_booking with only the booking id', () => {
    expect(VIDEOGRAPHY_ACCEPT_BRANCH).not.toBe('');
    expect(VIDEOGRAPHY_ACCEPT_BRANCH).toMatch(/supabase\.rpc\(\s*['"]accept_videography_booking['"]/);
    expect(VIDEOGRAPHY_ACCEPT_BRANCH).toMatch(/p_booking_id/);
  });

  it('does NOT PATCH advance_amount / remaining_amount from the browser', () => {
    // No client-side UPDATE of the money columns in the videography branch — the RPC owns them.
    expect(VIDEOGRAPHY_ACCEPT_BRANCH).not.toMatch(/advance_amount\s*:/i);
    expect(VIDEOGRAPHY_ACCEPT_BRANCH).not.toMatch(/remaining_amount\s*:/i);
    expect(VIDEOGRAPHY_ACCEPT_BRANCH).not.toMatch(/\.update\(/i);
    // It only trusts the server-derived advance for the notification copy.
    expect(VIDEOGRAPHY_ACCEPT_BRANCH).toMatch(/serverAdvance\s*=\s*Number\(\s*\(data as any\)\?\.advance_amount\s*\)/i);
  });
});
describe('parked column lockdown — amounts & identity un-PATCHable, INSERT RPC-only', () => {
  const protectedCols = sqlArray(LOCKDOWN_SQL, 'protected_cols');
  const benignCols = sqlArray(LOCKDOWN_SQL, 'benign_cols');
  const grantedCols = grantedUpdateColumns(LOCKDOWN_SQL);
  const EXPECTED_BENIGN = [
    'accepted_at', 'advance_paid_at', 'calendar_locked', 'city', 'confirmed_at',
    'event_date', 'event_time', 'event_type', 'expired_at', 'notes', 'otp_verified_at',
    'payment_deadline', 'settlement_status', 'special_requirements',
    'start_requested_at', 'status', 'venue', 'work_completed_at', 'work_started_at',
  ];
  const EXPECTED_PROTECTED = [
    'base_amount', 'addons_amount', 'total_amount', 'advance_amount', 'remaining_amount',
    'id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids',
  ];

  it('is PARKED with a do-not-push banner referencing both RPCs and the 3 rewired files', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+NOT\s+db\s+push\s+YET/i);
    expect(LOCKDOWN_SQL).toMatch(/20261229000000_videography_booking_server_authoritative/);
    expect(LOCKDOWN_SQL).toMatch(/20261230000000_videography_booking_accept_authoritative/);
    expect(LOCKDOWN_SQL).toMatch(/VideographyMenu\.tsx/);
    expect(LOCKDOWN_SQL).toMatch(/Checkout\.tsx/);
    expect(LOCKDOWN_SQL).toMatch(/VendorBookings\.tsx/);
  });

  it('REVOKEs INSERT+UPDATE before granting back, and never re-grants INSERT', () => {
    const revokeIdx = LOCKDOWN_SQL.search(
      /REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.videography_bookings\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    const grantIdx = LOCKDOWN_SQL.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revokeIdx).toBeGreaterThanOrEqual(0);
    expect(grantIdx).toBeGreaterThan(revokeIdx);
    // The only GRANT INSERT lives inside the ROLLBACK comment — never in live SQL.
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/GRANT\s+INSERT/i);
  });
  it('grants UPDATE on EXACTLY the 19 benign columns — no amount column among them', () => {
    expect(grantedCols.sort()).toEqual([...EXPECTED_BENIGN].sort());
    expect(benignCols.sort()).toEqual([...EXPECTED_BENIGN].sort());
    for (const amt of AMOUNT_KEYS) {
      expect(grantedCols).not.toContain(amt);
    }
    // Identity/provenance columns are never granted UPDATE either.
    for (const idc of ['id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids']) {
      expect(grantedCols).not.toContain(idc);
    }
    // Descriptive fields ARE benign (never pricing inputs), including the extra `notes`.
    for (const d of ['event_type', 'venue', 'city', 'special_requirements', 'notes']) {
      expect(grantedCols).toContain(d);
    }
  });

  it('protects all five amounts + identity columns (11 protected), disjoint from benign', () => {
    expect(protectedCols.sort()).toEqual([...EXPECTED_PROTECTED].sort());
    for (const amt of AMOUNT_KEYS) {
      expect(protectedCols).toContain(amt);
    }
    // 11 protected + 19 benign = 30 live columns, and the two lists never overlap.
    expect(protectedCols.length).toBe(11);
    expect(benignCols.length).toBe(19);
    expect(protectedCols.length + benignCols.length).toBe(30);
    const overlap = protectedCols.filter((c) => benignCols.includes(c));
    expect(overlap).toEqual([]);
  });

  it('has NO multiplier column classified anywhere (videography total = base + addons)', () => {
    // Videography has no quantity/guest_count/num_clients multiplier to protect or allow.
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/num_clients|guest_count|quantity_required|number_of/i);
  });

  it('ships the fail-closed catalog + runtime probe (assumes the authenticated role)', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$probe\$/);
    expect(LOCKDOWN_SQL).toMatch(/SET\s+LOCAL\s+ROLE\s+authenticated/i);
    // catalog proves INSERT was revoked; probe proves a protected PATCH is denied
    // while a benign PATCH is allowed and a direct INSERT is denied.
    expect(LOCKDOWN_SQL).toMatch(/has_table_privilege\(\s*'authenticated'[\s\S]*?'INSERT'\s*\)/i);
  });
});
