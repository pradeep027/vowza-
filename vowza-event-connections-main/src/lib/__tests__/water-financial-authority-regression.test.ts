/**
 * P0-1 — booking financial authority (Water regression guard).
 *
 * STATIC / CONTRACT regressions run under `npm test` with NO database. They
 * prove the *shape* of the fix holds: the browser cannot send Water booking
 * amounts, the RPCs derive them server-side, and the parked lockdown keeps the
 * amount + identity columns un-PATCHable while INSERT is RPC-only. What THIS
 * file guards on every CI run is that nobody re-opens the hole in the source:
 * the RPCs take no amount parameter, the client paths (WaterSupplyMenu "Book
 * Now", the Checkout cart branch, the VendorBookings accept) stop
 * sending/PATCHing amounts, and the lockdown never re-grants the protected
 * columns. The real Postgres outcome is proven at APPLY time by the migrations'
 * own $catalog$ / $verify$ / $probe$ blocks.
 *
 * WATER-SPECIFIC #1 (base): base is the SINGLE base_price column
 * (WaterSupplyMenu's Number(pkg.base_price || 0)) — coalesce(nullif(base_price,
 * 0), 0), NOT a two-column chain and NOT any other category's price column.
 * Water has NO quantity/multiplier: quantity_required is FREE TEXT (a delivery
 * note like "20 cans"), never a pricing input — total is base + addons.
 *
 * WATER-SPECIFIC #2 (advance rate): Water HONORS the package's per-package
 * advance_percentage (WaterSupplyMenu's Number(pkg.advance_percentage || 20)),
 * NOT a flat 20% like band/anchor/decorator/dj/drone. create + accept both
 * derive round(total * pct / 100) with pct = coalesce(nullif(advance_percentage,
 * 0), 20) — NULL-or-0 -> 20.
 *
 * WATER-SPECIFIC #3 (STORE-at-create): Water STORES advance_amount /
 * remaining_amount AT CREATION (like dancer/priest/rental/singer/videography,
 * UNLIKE makeup/mehendi which defer). The create INSERT lists all five amounts;
 * accept RE-CONFIRMS them from the trusted stored total.
 *
 * WATER-SPECIFIC #4 (addons LIVE, NO is_active filter): water_addons HAS an
 * is_active column, but — matching the band pilot / singer convention — the RPC
 * does NOT filter on it: it sums the passed ids that belong to the package.
 * UNLIKE singer/videography, water addons ARE live in the UI (WaterSupplyMenu
 * has a real add-on picker), so a real selection prices from the trusted rows.
 *
 * WATER-SPECIFIC #5 (event_type FALLS BACK to package_type; special_instructions;
 * delivery_* fields): LIKE priest and UNLIKE singer/videography, event_type
 * falls back to the package's package_type SERVER-SIDE (coalesce(nullif(
 * p_event_type,''), nullif(v_pkg.package_type,''))). Water writes
 * special_INSTRUCTIONS (col special_instructions) + delivery_address / city /
 * delivery_time / quantity_required (all descriptive). water_bookings has 30
 * columns → lockdown 11 protected / 19 benign / 30 total.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261231000000_water_booking_server_authoritative.sql');
const ACCEPT_SQL = repoFile('supabase/migrations/20261232000000_water_booking_accept_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_water_bookings_column_lockdown.sql');
const WATER_MENU_TSX = repoFile('src/components/WaterSupplyMenu.tsx');
const CHECKOUT_TSX = repoFile('src/pages/Checkout.tsx');
const VENDOR_BOOKINGS_TSX = repoFile('src/pages/vendor/VendorBookings.tsx');
/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');

/** Columns inside `GRANT UPDATE ( ... ) ON public.water_bookings TO authenticated`. */
const grantedUpdateColumns = (sql: string): string[] => {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.water_bookings\s+TO\s+authenticated/i,
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
// Column list of the create RPC's INSERT INTO public.water_bookings ( ... ) VALUES.
const INSERT_COLUMNS = (
  (stripComments(CREATE_SQL).match(
    /INSERT\s+INTO\s+public\.water_bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
  ) ?? ['', ''])[1]
)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// Parameter list of each RPC's CREATE FUNCTION signature (create + accept).
const CREATE_SIGNATURE = (
  stripComments(CREATE_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_water_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
const ACCEPT_SIGNATURE = (
  stripComments(ACCEPT_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_water_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
// The object literal of arguments passed to supabase.rpc('create_water_booking', {...}).
const menuRpcArgs = (
  WATER_MENU_TSX.match(
    /supabase\.rpc\(\s*['"]create_water_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];
const checkoutRpcArgs = (
  CHECKOUT_TSX.match(
    /supabase\.rpc\(\s*['"]create_water_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];

// Amount keys a browser must never send as authoritative (Rule 3).
const AMOUNT_KEYS = [
  'base_amount',
  'addons_amount',
  'total_amount',
  'advance_amount',
  'remaining_amount',
];
describe('create_water_booking — server derives every amount', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(CREATE_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_water_booking/i);
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
  it('derives base from the SINGLE base_price column (no multiplier)', () => {
    // Mirrors WaterSupplyMenu's Number(pkg.base_price || 0): a single-column
    // coalesce(nullif(base_price,0),0), and NO quantity multiplier.
    expect(CREATE_SQL).toMatch(
      /v_base\s*:=\s*coalesce\(\s*nullif\(\s*v_pkg\.base_price\s*,\s*0\s*\)\s*,\s*0\s*\)/i,
    );
    expect(CREATE_SQL).toMatch(/from\s+public\.water_addons/i);
    expect(CREATE_SQL).toMatch(/v_total\s*:=\s*v_base\s*\+\s*v_addons/i);
    // Total is base + addons — never base multiplied by a quantity/units factor.
    expect(stripComments(CREATE_SQL)).not.toMatch(/v_base\s*\*/i);
    // Not any OTHER category's price column, and not the ancillary water charge cols.
    expect(stripComments(CREATE_SQL)).not.toMatch(/service_price|hall_rental_price|package_price|starting_price|price_per_plate|price_per_hand|price_per_person/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/transportation_charges|outside_city_charges|night_delivery_charges|emergency_delivery_charges|additional_tank_charges|discount_percentage/i);
  });
  it('sums addons WITHOUT an is_active filter (band pilot / singer convention)', () => {
    // water_addons HAS an is_active column, but the RPC deliberately does NOT
    // filter on it (matching band/singer): the id must belong to the package, and
    // the price is taken from the trusted row. Water addons ARE live in the UI.
    expect(CREATE_SQL).toMatch(/a\.package_id\s*=\s*v_pkg\.id\s*[\s\S]*?a\.id\s*=\s*ANY/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/is_active/i);
  });
  it('STORES all five amounts at create AND derives advance HONORING advance_percentage', () => {
    // Water mirrors WaterSupplyMenu: advance/remaining ARE written at creation
    // (like dancer/priest/rental/singer/videography). The INSERT stores all five.
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

  it('FALLS BACK event_type to package_type (WaterSupplyMenu writes eventType || pkg.package_type)', () => {
    // LIKE priest and UNLIKE singer/videography: event_type coalesces to the
    // package's package_type server-side when the caller sends none.
    expect(CREATE_SQL).toMatch(
      /coalesce\(\s*nullif\(\s*p_event_type\s*,\s*''\s*\)\s*,\s*nullif\(\s*v_pkg\.package_type\s*,\s*''\s*\)\s*\)/i,
    );
  });

  it('writes special_instructions (NOT special_requirements), plus delivery_address/city/delivery_time/quantity_required', () => {
    expect(CREATE_SIGNATURE).toMatch(/p_special_instructions\s+text/i);
    expect(INSERT_COLUMNS).toContain('special_instructions');
    expect(INSERT_COLUMNS).not.toContain('special_requirements');
    // water_bookings has delivery_* descriptive fields — the create RPC writes them.
    expect(INSERT_COLUMNS).toContain('delivery_address');
    expect(INSERT_COLUMNS).toContain('delivery_time');
    expect(INSERT_COLUMNS).toContain('city');
    expect(INSERT_COLUMNS).toContain('event_type');
    // quantity_required is a DESCRIPTIVE free-text delivery note (written, never priced).
    expect(CREATE_SIGNATURE).toMatch(/p_quantity_required\s+text/i);
    expect(INSERT_COLUMNS).toContain('quantity_required');
  });

  it('locks the package row and requires active status', () => {
    expect(CREATE_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(CREATE_SQL).toMatch(/status\s+IS\s+DISTINCT\s+FROM\s+'active'|status\s*<>\s*'active'/i);
  });

  it('grants EXECUTE to authenticated only and revokes public/anon', () => {
    expect(CREATE_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?create_water_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(CREATE_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?create_water_booking[\s\S]*?TO\s+authenticated/i);
  });

  it('ships its own fail-closed catalog + verify guards', () => {
    expect(CREATE_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(CREATE_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('accept_water_booking — server re-derives the advance, never the client', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(ACCEPT_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_water_booking/i);
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
      /coalesce\(\s*nullif\(\s*dp\.advance_percentage\s*,\s*0\s*\)\s*,\s*20\s*\)[\s\S]*?from\s+public\.water_packages/i,
    );
    expect(ACCEPT_SQL).toMatch(/v_total\s*:=\s*coalesce\(\s*v_bkg\.total_amount\s*,\s*0\s*\)/i);
    expect(ACCEPT_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*v_pct\s*\/\s*100/i);
    expect(ACCEPT_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
    expect(ACCEPT_SQL).not.toMatch(/round\(\s*v_total\s*\*\s*20\s*\/\s*100/i);
  });

  it('grants EXECUTE to authenticated only and ships catalog + verify guards', () => {
    expect(ACCEPT_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?accept_water_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(ACCEPT_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?accept_water_booking[\s\S]*?TO\s+authenticated/i);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('client creation paths route through create_water_booking (no browser amounts)', () => {
  it('WaterSupplyMenu "Book Now" calls the RPC and never direct-inserts water_bookings', () => {
    expect(WATER_MENU_TSX).toMatch(/supabase\.rpc\(\s*['"]create_water_booking['"]/);
    // No direct table INSERT into water_bookings from the browser anymore.
    expect(WATER_MENU_TSX).not.toMatch(/\.from\(\s*['"]water_bookings['"]\s*\)/);
  });

  it('WaterSupplyMenu sends identifiers/selections ONLY — no authoritative amount keys', () => {
    expect(menuRpcArgs).not.toBe('');
    expect(menuRpcArgs).toMatch(/p_package_id/);
    expect(menuRpcArgs).toMatch(/p_special_instructions/);
    expect(menuRpcArgs).toMatch(/p_addon_ids/);
    for (const key of AMOUNT_KEYS) {
      expect(menuRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    // customer_id + provider_id are FORCED server-side (never sent from the browser).
    expect(menuRpcArgs).not.toMatch(/customer_id/i);
    expect(menuRpcArgs).not.toMatch(/provider_id/i);
  });

  it('Checkout routes water cart items through the RPC, not the generic amount INSERT', () => {
    expect(CHECKOUT_TSX).toMatch(/item\.bookingTable\s*===\s*['"]water_bookings['"]/);
    expect(checkoutRpcArgs).not.toBe('');
    expect(checkoutRpcArgs).toMatch(/p_package_id/);
    expect(checkoutRpcArgs).toMatch(/p_addon_ids/);
    for (const key of AMOUNT_KEYS) {
      expect(checkoutRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    // Water's descriptive free-text field flows as p_special_instructions.
    expect(checkoutRpcArgs).toMatch(/p_special_instructions/);
  });
});
describe('VendorBookings accept routes water through accept_water_booking (no client PATCH)', () => {
  // The water branch body: from `=== 'water_bookings')` to the next `} else {`.
  const WATER_ACCEPT_BRANCH = (
    VENDOR_BOOKINGS_TSX.match(/===\s*['"]water_bookings['"]\s*\)([\s\S]*?)\}\s*else\s*\{/) ?? ['', ''])[1];

  it('maps the water source to the water_bookings table', () => {
    expect(VENDOR_BOOKINGS_TSX).toMatch(/_source\s*===\s*['"]water['"]\s*\?\s*['"]water_bookings['"]/);
  });

  it('calls accept_water_booking with only the booking id', () => {
    expect(WATER_ACCEPT_BRANCH).not.toBe('');
    expect(WATER_ACCEPT_BRANCH).toMatch(/supabase\.rpc\(\s*['"]accept_water_booking['"]/);
    expect(WATER_ACCEPT_BRANCH).toMatch(/p_booking_id/);
  });

  it('does NOT PATCH advance_amount / remaining_amount from the browser', () => {
    // No client-side UPDATE of the money columns in the water branch — the RPC owns them.
    expect(WATER_ACCEPT_BRANCH).not.toMatch(/advance_amount\s*:/i);
    expect(WATER_ACCEPT_BRANCH).not.toMatch(/remaining_amount\s*:/i);
    expect(WATER_ACCEPT_BRANCH).not.toMatch(/\.update\(/i);
    // It only trusts the server-derived advance for the notification copy.
    expect(WATER_ACCEPT_BRANCH).toMatch(/serverAdvance\s*=\s*Number\(\s*\(data as any\)\?\.advance_amount\s*\)/i);
  });
});
describe('parked column lockdown — amounts & identity un-PATCHable, INSERT RPC-only', () => {
  const protectedCols = sqlArray(LOCKDOWN_SQL, 'protected_cols');
  const benignCols = sqlArray(LOCKDOWN_SQL, 'benign_cols');
  const grantedCols = grantedUpdateColumns(LOCKDOWN_SQL);
  const EXPECTED_BENIGN = [
    'accepted_at', 'advance_paid_at', 'calendar_locked', 'city', 'confirmed_at',
    'delivery_address', 'delivery_time', 'event_date', 'event_type', 'expired_at',
    'otp_verified_at', 'payment_deadline', 'quantity_required', 'settlement_status',
    'special_instructions', 'start_requested_at', 'status', 'work_completed_at',
    'work_started_at',
  ];
  const EXPECTED_PROTECTED = [
    'base_amount', 'addons_amount', 'total_amount', 'advance_amount', 'remaining_amount',
    'id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids',
  ];

  it('is PARKED with a do-not-push banner referencing both RPCs and the 3 rewired files', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+NOT\s+db\s+push\s+YET/i);
    expect(LOCKDOWN_SQL).toMatch(/20261231000000_water_booking_server_authoritative/);
    expect(LOCKDOWN_SQL).toMatch(/20261232000000_water_booking_accept_authoritative/);
    expect(LOCKDOWN_SQL).toMatch(/WaterSupplyMenu\.tsx/);
    expect(LOCKDOWN_SQL).toMatch(/Checkout\.tsx/);
    expect(LOCKDOWN_SQL).toMatch(/VendorBookings\.tsx/);
  });

  it('REVOKEs INSERT+UPDATE before granting back, and never re-grants INSERT', () => {
    const revokeIdx = LOCKDOWN_SQL.search(
      /REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.water_bookings\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
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
    // Descriptive fields ARE benign (never pricing inputs), including the free-text
    // quantity_required delivery note.
    for (const d of ['event_type', 'delivery_address', 'city', 'special_instructions', 'quantity_required']) {
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

  it('classifies quantity_required as BENIGN (free-text note, not a multiplier)', () => {
    // Water's quantity_required is a descriptive delivery note, NOT a pricing
    // multiplier (unlike rental's integer quantity_required). It is benign.
    expect(benignCols).toContain('quantity_required');
    expect(protectedCols).not.toContain('quantity_required');
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
