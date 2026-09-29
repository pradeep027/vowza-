/**
 * P0-1 — booking financial authority (Priest regression guard).
 *
 * STATIC / CONTRACT regressions that run under `npm test` with NO database. They
 * prove the *shape* of the fix holds: the browser cannot send Priest booking
 * amounts, the RPCs derive them server-side, and the parked lockdown keeps the
 * amount + identity columns un-PATCHable while INSERT is RPC-only. They do NOT
 * assert a real Postgres outcome — that is proven at APPLY time by the $catalog$ /
 * $verify$ / $probe$ blocks inside the migrations themselves. What THIS file
 * guards on every CI run is that nobody re-opens the hole in the source: the RPCs
 * take no amount parameter, the client paths (PriestMenu "Book Now", the Checkout
 * cart branch, the VendorBookings accept) stop sending/PATCHing amounts, and the
 * lockdown never re-grants the protected columns.
 *
 * PRIEST-SPECIFIC #1 (base price): Priest base is the SINGLE service_price column
 * (mirroring PriestMenu's Number(pkg.service_price || 0)) — a single
 * coalesce(service_price, 0), NOT a nullif chain, and NOT the travel_charges /
 * outside_city_charges / extra_ritual_charges / extra_hours_charges columns
 * priest_packages also has (the menu uses ONLY service_price).
 *
 * PRIEST-SPECIFIC #2 (advance rate): Priest HONORS the package's per-package
 * advance_percentage (matching PriestMenu's Number(pkg.advance_percentage || 20)),
 * NOT a hardcoded flat 20% like band/anchor/decorator/dj/drone. Both create and
 * accept derive round(total * pct / 100) with pct = coalesce(nullif(
 * advance_percentage, 0), 20) — a NULL-or-0 -> 20 fallback.
 *
 * PRIEST-SPECIFIC #3 (STORE-at-create): Priest STORES advance_amount /
 * remaining_amount AT CREATION (mirroring PriestMenu, which writes all five
 * amounts at insert time — like dancer, UNLIKE makeup/mehendi which defer). The
 * create INSERT column list INCLUDES them, and the create RPC itself reads the
 * package advance_percentage. accept RE-CONFIRMS them from the trusted total.
 *
 * PRIEST-SPECIFIC #4 (addons NOT is_active-filtered): priest_addons HAS an
 * is_active column, but PriestMenu fetches priest_addons(*) unfiltered and sums the
 * selected ones, so create_priest_booking sums the passed ids that belong to the
 * package with NO is_active filter — behavior preservation; the price is
 * authoritative regardless.
 *
 * PRIEST-SPECIFIC #5 (no multiplier column): priest has NO quantity/num_clients/
 * guest_count multiplier — the total is service_price + addons. event_type / venue /
 * city / special_instructions are descriptive only. Priest writes special_INSTRUCTIONS
 * (col special_instructions), NOT special_requirements.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261223000000_priest_booking_server_authoritative.sql');
const ACCEPT_SQL = repoFile('supabase/migrations/20261224000000_priest_booking_accept_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_priest_bookings_column_lockdown.sql');
const PRIEST_MENU_TSX = repoFile('src/components/PriestMenu.tsx');
const CHECKOUT_TSX = repoFile('src/pages/Checkout.tsx');
const VENDOR_BOOKINGS_TSX = repoFile('src/pages/vendor/VendorBookings.tsx');
/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');

/** Columns inside `GRANT UPDATE ( ... ) ON public.priest_bookings TO authenticated`. */
const grantedUpdateColumns = (sql: string): string[] => {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.priest_bookings\s+TO\s+authenticated/i,
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
// Column list of the create RPC's INSERT INTO public.priest_bookings ( ... ) VALUES.
const INSERT_COLUMNS = (
  (stripComments(CREATE_SQL).match(
    /INSERT\s+INTO\s+public\.priest_bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
  ) ?? ['', ''])[1]
)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// Parameter list of each RPC's CREATE FUNCTION signature (create + accept).
const CREATE_SIGNATURE = (
  stripComments(CREATE_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_priest_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
const ACCEPT_SIGNATURE = (
  stripComments(ACCEPT_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_priest_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
// The object literal of arguments passed to supabase.rpc('create_priest_booking', {...}).
const menuRpcArgs = (
  PRIEST_MENU_TSX.match(
    /supabase\.rpc\(\s*['"]create_priest_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];
const checkoutRpcArgs = (
  CHECKOUT_TSX.match(
    /supabase\.rpc\(\s*['"]create_priest_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];

// Amount keys a browser must never send as authoritative (Rule 3).
const AMOUNT_KEYS = [
  'base_amount',
  'addons_amount',
  'total_amount',
  'advance_amount',
  'remaining_amount',
];
describe('create_priest_booking — server derives every amount', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(CREATE_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_priest_booking/i);
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
  it('derives base from the SINGLE service_price column (not a nullif chain)', () => {
    // Mirrors PriestMenu's Number(pkg.service_price || 0) via a single
    // coalesce(service_price, 0) — NOT a first-truthy chain, and NOT the ancillary
    // *_charges columns priest_packages has.
    expect(CREATE_SQL).toMatch(/v_base\s*:=\s*coalesce\(\s*v_pkg\.service_price\s*,\s*0\s*\)/i);
    expect(CREATE_SQL).toMatch(/from\s+public\.priest_addons/i);
    expect(CREATE_SQL).toMatch(/v_total\s*:=\s*v_base\s*\+\s*v_addons/i);
    // NOT the ancillary charge columns priest_packages carries but the menu ignores.
    expect(stripComments(CREATE_SQL)).not.toMatch(/travel_charges|outside_city_charges|extra_ritual_charges|extra_hours_charges/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/price_per_hand|price_per_person|price_per_plate|guest_count/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/starting_price|package_price|hourly_price/i);
  });

  it('sums addons WITHOUT an is_active filter (behavior preservation)', () => {
    // PriestMenu fetches priest_addons(*) unfiltered; the RPC must not add an
    // is_active filter. The price is authoritative regardless.
    expect(CREATE_SQL).toMatch(/a\.package_id\s*=\s*v_pkg\.id\s*[\s\S]*?a\.id\s*=\s*ANY/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/is_active/i);
  });
  it('STORES all five amounts at create AND derives advance HONORING advance_percentage', () => {
    // Priest mirrors PriestMenu: advance/remaining ARE written at creation (like
    // dancer, UNLIKE makeup/mehendi). The INSERT stores all five amounts.
    expect(INSERT_COLUMNS).toContain('base_amount');
    expect(INSERT_COLUMNS).toContain('addons_amount');
    expect(INSERT_COLUMNS).toContain('total_amount');
    expect(INSERT_COLUMNS).toContain('advance_amount');
    expect(INSERT_COLUMNS).toContain('remaining_amount');
    // The create RPC itself derives the advance HONORING the per-package rate
    // (NULL or 0 -> 20 via nullif), NOT a flat 20%.
    expect(CREATE_SQL).toMatch(
      /v_pct\s*:=\s*coalesce\(\s*nullif\(\s*v_pkg\.advance_percentage\s*,\s*0\s*\)\s*,\s*20\s*\)/i,
    );
    expect(CREATE_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*v_pct\s*\/\s*100/i);
    expect(CREATE_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
    expect(CREATE_SQL).not.toMatch(/round\(\s*v_total\s*\*\s*20\s*\/\s*100/i);
  });

  it('falls back event_type to the package_type when the caller omits it', () => {
    // Mirrors PriestMenu's eventType || pkg.package_type. Descriptive only.
    expect(CREATE_SQL).toMatch(/coalesce\(\s*nullif\(\s*p_event_type\s*,\s*''\s*\)\s*,\s*v_pkg\.package_type\s*\)/i);
  });

  it('writes special_instructions (NOT special_requirements)', () => {
    expect(CREATE_SIGNATURE).toMatch(/p_special_instructions\s+text/i);
    expect(INSERT_COLUMNS).toContain('special_instructions');
    expect(INSERT_COLUMNS).not.toContain('special_requirements');
  });

  it('locks the package row and requires active status', () => {
    expect(CREATE_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(CREATE_SQL).toMatch(/status\s+IS\s+DISTINCT\s+FROM\s+'active'|status\s*<>\s*'active'/i);
  });

  it('grants EXECUTE to authenticated only and revokes public/anon', () => {
    expect(CREATE_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?create_priest_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(CREATE_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?create_priest_booking[\s\S]*?TO\s+authenticated/i);
  });

  it('ships its own fail-closed catalog + verify guards', () => {
    expect(CREATE_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(CREATE_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('accept_priest_booking — server re-derives the advance, never the client', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(ACCEPT_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_priest_booking/i);
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
      /coalesce\(\s*nullif\(\s*dp\.advance_percentage\s*,\s*0\s*\)\s*,\s*20\s*\)[\s\S]*?from\s+public\.priest_packages/i,
    );
    expect(ACCEPT_SQL).toMatch(/v_total\s*:=\s*coalesce\(\s*v_bkg\.total_amount\s*,\s*0\s*\)/i);
    expect(ACCEPT_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*v_pct\s*\/\s*100/i);
    expect(ACCEPT_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
    expect(ACCEPT_SQL).not.toMatch(/round\(\s*v_total\s*\*\s*20\s*\/\s*100/i);
  });

  it('grants EXECUTE to authenticated only and ships catalog + verify guards', () => {
    expect(ACCEPT_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?accept_priest_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(ACCEPT_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?accept_priest_booking[\s\S]*?TO\s+authenticated/i);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('client creation paths route through create_priest_booking (no browser amounts)', () => {
  it('PriestMenu "Book Now" calls the RPC and never direct-inserts priest_bookings', () => {
    expect(PRIEST_MENU_TSX).toMatch(/supabase\.rpc\(\s*['"]create_priest_booking['"]/);
    // No direct table INSERT into priest_bookings from the browser anymore.
    expect(PRIEST_MENU_TSX).not.toMatch(/\.from\(\s*['"]priest_bookings['"]\s*\)/);
  });

  it('PriestMenu sends identifiers/selections ONLY — no authoritative amount keys', () => {
    expect(menuRpcArgs).not.toBe('');
    expect(menuRpcArgs).toMatch(/p_package_id/);
    expect(menuRpcArgs).toMatch(/p_special_instructions/);
    expect(menuRpcArgs).toMatch(/p_addon_ids/);
    for (const key of AMOUNT_KEYS) {
      expect(menuRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    // customer_id is FORCED server-side; priest has no client-count multiplier.
    expect(menuRpcArgs).not.toMatch(/customer_id/i);
    expect(menuRpcArgs).not.toMatch(/num_clients|guest_count|quantity/i);
  });

  it('Checkout routes priest cart items through the RPC, not the generic amount INSERT', () => {
    expect(CHECKOUT_TSX).toMatch(/item\.bookingTable\s*===\s*['"]priest_bookings['"]/);
    expect(checkoutRpcArgs).not.toBe('');
    expect(checkoutRpcArgs).toMatch(/p_package_id/);
    expect(checkoutRpcArgs).toMatch(/p_addon_ids/);
    for (const key of AMOUNT_KEYS) {
      expect(checkoutRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    // The old generic else wrote special_requirements (a column priest lacks); the
    // priest branch sends special_instructions instead.
    expect(checkoutRpcArgs).toMatch(/p_special_instructions/);
  });
});
describe('VendorBookings accept routes priest through accept_priest_booking (no client PATCH)', () => {
  // The priest branch body: from `=== 'priest_bookings')` to the generic `} else {`.
  const PRIEST_ACCEPT_BRANCH = (
    VENDOR_BOOKINGS_TSX.match(/===\s*['"]priest_bookings['"]\s*\)([\s\S]*?)\}\s*else\s*\{/) ?? ['', ''])[1];

  it('maps the priest source to the priest_bookings table', () => {
    expect(VENDOR_BOOKINGS_TSX).toMatch(/_source\s*===\s*['"]priest['"]\s*\?\s*['"]priest_bookings['"]/);
  });

  it('calls accept_priest_booking with only the booking id', () => {
    expect(PRIEST_ACCEPT_BRANCH).not.toBe('');
    expect(PRIEST_ACCEPT_BRANCH).toMatch(/supabase\.rpc\(\s*['"]accept_priest_booking['"]/);
    expect(PRIEST_ACCEPT_BRANCH).toMatch(/p_booking_id/);
  });

  it('does NOT PATCH advance_amount / remaining_amount from the browser', () => {
    // No client-side UPDATE of the money columns in the priest branch — the RPC owns them.
    expect(PRIEST_ACCEPT_BRANCH).not.toMatch(/advance_amount\s*:/i);
    expect(PRIEST_ACCEPT_BRANCH).not.toMatch(/remaining_amount\s*:/i);
    expect(PRIEST_ACCEPT_BRANCH).not.toMatch(/\.update\(/i);
    // It only trusts the server-derived advance for the notification copy.
    expect(PRIEST_ACCEPT_BRANCH).toMatch(/serverAdvance\s*=\s*Number\(\s*\(data as any\)\?\.advance_amount\s*\)/i);
  });
});
describe('parked column lockdown — amounts & identity un-PATCHable, INSERT RPC-only', () => {
  const protectedCols = sqlArray(LOCKDOWN_SQL, 'protected_cols');
  const benignCols = sqlArray(LOCKDOWN_SQL, 'benign_cols');
  const grantedCols = grantedUpdateColumns(LOCKDOWN_SQL);
  const EXPECTED_BENIGN = [
    'accepted_at', 'advance_paid_at', 'calendar_locked', 'city', 'confirmed_at',
    'event_date', 'event_time', 'event_type', 'expired_at', 'otp_verified_at',
    'payment_deadline', 'settlement_status', 'special_instructions',
    'start_requested_at', 'status', 'venue', 'work_completed_at', 'work_started_at',
  ];
  const EXPECTED_PROTECTED = [
    'base_amount', 'addons_amount', 'total_amount', 'advance_amount', 'remaining_amount',
    'id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids',
  ];

  it('is PARKED with a do-not-push banner referencing both RPCs and the 3 rewired files', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+NOT\s+db\s+push\s+YET/i);
    expect(LOCKDOWN_SQL).toMatch(/20261223000000_priest_booking_server_authoritative/);
    expect(LOCKDOWN_SQL).toMatch(/20261224000000_priest_booking_accept_authoritative/);
    expect(LOCKDOWN_SQL).toMatch(/PriestMenu\.tsx/);
    expect(LOCKDOWN_SQL).toMatch(/Checkout\.tsx/);
    expect(LOCKDOWN_SQL).toMatch(/VendorBookings\.tsx/);
  });

  it('REVOKEs INSERT+UPDATE before granting back, and never re-grants INSERT', () => {
    const revokeIdx = LOCKDOWN_SQL.search(
      /REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.priest_bookings\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    const grantIdx = LOCKDOWN_SQL.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revokeIdx).toBeGreaterThanOrEqual(0);
    expect(grantIdx).toBeGreaterThan(revokeIdx);
    // The only GRANT INSERT lives inside the ROLLBACK comment — never in live SQL.
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/GRANT\s+INSERT/i);
  });
  it('grants UPDATE on EXACTLY the 18 benign columns — no amount column among them', () => {
    expect(grantedCols.sort()).toEqual([...EXPECTED_BENIGN].sort());
    expect(benignCols.sort()).toEqual([...EXPECTED_BENIGN].sort());
    for (const amt of AMOUNT_KEYS) {
      expect(grantedCols).not.toContain(amt);
    }
    // Identity/provenance columns are never granted UPDATE either.
    for (const idc of ['id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids']) {
      expect(grantedCols).not.toContain(idc);
    }
    // Descriptive fields ARE benign (never pricing inputs).
    for (const d of ['event_type', 'venue', 'city', 'special_instructions']) {
      expect(grantedCols).toContain(d);
    }
  });

  it('protects all five amounts + identity columns (11 protected), disjoint from benign', () => {
    expect(protectedCols.sort()).toEqual([...EXPECTED_PROTECTED].sort());
    for (const amt of AMOUNT_KEYS) {
      expect(protectedCols).toContain(amt);
    }
    // 11 protected + 18 benign = 29 live columns, and the two lists never overlap.
    expect(protectedCols.length).toBe(11);
    expect(benignCols.length).toBe(18);
    expect(protectedCols.length + benignCols.length).toBe(29);
    const overlap = protectedCols.filter((c) => benignCols.includes(c));
    expect(overlap).toEqual([]);
  });

  it('has NO multiplier column classified anywhere (priest total = service_price + addons)', () => {
    // Priest has no quantity/guest_count/num_clients multiplier to protect or allow.
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
