/**
 * P0-1 — booking financial authority (Rental regression guard).
 *
 * STATIC / CONTRACT regressions that run under `npm test` with NO database. They
 * prove the *shape* of the fix holds: the browser cannot send Rental booking
 * amounts, the RPCs derive them server-side, and the parked lockdown keeps the
 * amount + identity + quantity columns un-PATCHable while INSERT is RPC-only. They
 * do NOT assert a real Postgres outcome — that is proven at APPLY time by the
 * $catalog$ / $verify$ / $probe$ blocks inside the migrations themselves. What THIS
 * file guards on every CI run is that nobody re-opens the hole in the source: the
 * RPCs take no amount parameter, the client paths (RentalMenu "Book Now", the
 * Checkout cart branch, the VendorBookings accept) stop sending/PATCHing amounts,
 * and the lockdown never re-grants the protected columns.
 *
 * RENTAL-SPECIFIC #1 (base price): Rental base is the SINGLE price column
 * RE-MULTIPLIED by the quantity (mirroring RentalMenu's Number(pkg.price || 0) *
 * qty) — coalesce(price, 0) * v_qty, NOT the ancillary security_deposit /
 * transportation / installation / outside_city / extra_hour / late_return charge
 * columns rental_packages also has (the menu totals ONLY price x qty + addons).
 *
 * RENTAL-SPECIFIC #2 (advance rate): Rental HONORS the package's per-package
 * advance_percentage (matching RentalMenu's Number(pkg.advance_percentage || 20)),
 * NOT a hardcoded flat 20% like band/anchor/decorator/dj/drone. Both create and
 * accept derive round(total * pct / 100) with pct = coalesce(nullif(
 * advance_percentage, 0), 20) — a NULL-or-0 -> 20 fallback.
 *
 * RENTAL-SPECIFIC #3 (STORE-at-create): Rental STORES advance_amount /
 * remaining_amount AT CREATION (mirroring RentalMenu, which writes all five amounts
 * at insert time — like dancer/priest, UNLIKE makeup/mehendi which defer). accept
 * RE-CONFIRMS them from the trusted total.
 *
 * RENTAL-SPECIFIC #4 (addons NOT is_active-filtered): rental_addons HAS an
 * is_active column, but RentalMenu fetches rental_addons(*) unfiltered and sums the
 * selected ones, so create_rental_booking sums the passed ids that belong to the
 * package with NO is_active filter — behavior preservation.
 *
 * RENTAL-SPECIFIC #5 (the ONLY REAL quantity multiplier): quantity_required IS a
 * PRICING input — base = price x quantity_required. The server CLAMPS it to >= 1
 * (greatest(1, ...)) and re-multiplies with the trusted price, and enforces
 * available_units. quantity_required is therefore PROTECTED in the lockdown. Rental
 * writes special_instructions + delivery_address/city, NOT special_requirements/
 * venue (the old generic Checkout else wrote the latter — already broken for rental).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261225000000_rental_booking_server_authoritative.sql');
const ACCEPT_SQL = repoFile('supabase/migrations/20261226000000_rental_booking_accept_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_rental_bookings_column_lockdown.sql');
const RENTAL_MENU_TSX = repoFile('src/components/RentalMenu.tsx');
const CHECKOUT_TSX = repoFile('src/pages/Checkout.tsx');
const VENDOR_BOOKINGS_TSX = repoFile('src/pages/vendor/VendorBookings.tsx');
/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');

/** Columns inside `GRANT UPDATE ( ... ) ON public.rental_bookings TO authenticated`. */
const grantedUpdateColumns = (sql: string): string[] => {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.rental_bookings\s+TO\s+authenticated/i,
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
// Column list of the create RPC's INSERT INTO public.rental_bookings ( ... ) VALUES.
const INSERT_COLUMNS = (
  (stripComments(CREATE_SQL).match(
    /INSERT\s+INTO\s+public\.rental_bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
  ) ?? ['', ''])[1]
)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);
// Parameter list of each RPC's CREATE FUNCTION signature (create + accept).
const CREATE_SIGNATURE = (
  stripComments(CREATE_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_rental_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
const ACCEPT_SIGNATURE = (
  stripComments(ACCEPT_SQL).match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_rental_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  ) ?? ['', ''])[1];
// The object literal of arguments passed to supabase.rpc('create_rental_booking', {...}).
const menuRpcArgs = (
  RENTAL_MENU_TSX.match(
    /supabase\.rpc\(\s*['"]create_rental_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];
const checkoutRpcArgs = (
  CHECKOUT_TSX.match(
    /supabase\.rpc\(\s*['"]create_rental_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  ) ?? ['', ''])[1];

// Amount keys a browser must never send as authoritative (Rule 3).
const AMOUNT_KEYS = [
  'base_amount',
  'addons_amount',
  'total_amount',
  'advance_amount',
  'remaining_amount',
];
describe('create_rental_booking — server derives every amount', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(CREATE_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_rental_booking/i);
    expect(CREATE_SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(CREATE_SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('takes NO client-supplied amount parameter (Rule 3)', () => {
    expect(CREATE_SIGNATURE).not.toBe('');
    for (const key of AMOUNT_KEYS) {
      expect(CREATE_SIGNATURE).not.toMatch(new RegExp(key, 'i'));
    }
    // The signature carries p_quantity_required (a selection the server clamps and
    // re-multiplies), but NEVER a raw amount / advance rate / price.
    expect(CREATE_SIGNATURE).not.toMatch(/\bamount\b|advance_percent|p_price|p_base|p_total/i);
  });

  it('requires an authenticated caller', () => {
    expect(CREATE_SQL).toMatch(/auth\.uid\(\)/);
    expect(CREATE_SQL).toMatch(/28000|not\s+authenticated|Authentication required/i);
  });
  it('derives base = the SINGLE price column RE-MULTIPLIED by the server-clamped qty', () => {
    // Mirrors RentalMenu's Number(pkg.price || 0) * qty via coalesce(price,0) * v_qty
    // — NOT the ancillary charge columns rental_packages carries but the menu ignores.
    expect(CREATE_SQL).toMatch(/v_base\s*:=\s*coalesce\(\s*v_pkg\.price\s*,\s*0\s*\)\s*\*\s*v_qty/i);
    expect(CREATE_SQL).toMatch(/from\s+public\.rental_addons/i);
    expect(CREATE_SQL).toMatch(/v_total\s*:=\s*v_base\s*\+\s*v_addons/i);
    // NOT the ancillary charge columns the menu never totals.
    expect(stripComments(CREATE_SQL)).not.toMatch(/security_deposit|transportation|installation|outside_city|extra_hour|late_return/i);
    // NOT another category's price column.
    expect(stripComments(CREATE_SQL)).not.toMatch(/service_price|package_price|price_per_plate|price_per_person|guest_count|starting_price|hourly_price/i);
  });

  it('CLAMPS the quantity multiplier to >= 1 and enforces available_units', () => {
    // quantity_required is the ONLY real multiplier; the server clamps it (a client
    // can never drive it below 1) and re-multiplies with the trusted price.
    expect(CREATE_SQL).toMatch(/v_qty\s*:=\s*greatest\(\s*1\s*,\s*coalesce\(\s*p_quantity_required\s*,\s*1\s*\)\s*\)/i);
    // Availability is enforced server-side when available_units is set.
    expect(CREATE_SQL).toMatch(/available_units\s+IS\s+NOT\s+NULL\s+AND\s+v_qty\s*>\s*v_pkg\.available_units/i);
  });

  it('sums addons WITHOUT an is_active filter (behavior preservation)', () => {
    // RentalMenu fetches rental_addons(*) unfiltered; the RPC must not add an
    // is_active filter. The price is authoritative regardless.
    expect(CREATE_SQL).toMatch(/a\.package_id\s*=\s*v_pkg\.id\s*[\s\S]*?a\.id\s*=\s*ANY/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/is_active/i);
  });
  it('STORES all five amounts at create AND derives advance HONORING advance_percentage', () => {
    // Rental mirrors RentalMenu: advance/remaining ARE written at creation (like
    // dancer/priest, UNLIKE makeup/mehendi). The INSERT stores all five amounts.
    expect(INSERT_COLUMNS).toContain('base_amount');
    expect(INSERT_COLUMNS).toContain('addons_amount');
    expect(INSERT_COLUMNS).toContain('total_amount');
    expect(INSERT_COLUMNS).toContain('advance_amount');
    expect(INSERT_COLUMNS).toContain('remaining_amount');
    // The multiplier is stored as the server-clamped value that produced base.
    expect(INSERT_COLUMNS).toContain('quantity_required');
    // The create RPC itself derives the advance HONORING the per-package rate
    // (NULL or 0 -> 20 via nullif), NOT a flat 20%.
    expect(CREATE_SQL).toMatch(
      /v_pct\s*:=\s*coalesce\(\s*nullif\(\s*v_pkg\.advance_percentage\s*,\s*0\s*\)\s*,\s*20\s*\)/i,
    );
    expect(CREATE_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*v_pct\s*\/\s*100/i);
    expect(CREATE_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
    expect(CREATE_SQL).not.toMatch(/round\(\s*v_total\s*\*\s*20\s*\/\s*100/i);
  });
  it('does NOT default event_type to package_type (stores eventType || null)', () => {
    // Unlike priest, RentalMenu stores eventType || null — no package_type fallback.
    expect(CREATE_SQL).toMatch(/nullif\(\s*p_event_type\s*,\s*''\s*\)/i);
    expect(stripComments(CREATE_SQL)).not.toMatch(/coalesce\(\s*nullif\(\s*p_event_type[\s\S]*?package_type/i);
  });

  it('writes special_instructions + delivery_address/city (NOT special_requirements/venue)', () => {
    expect(CREATE_SIGNATURE).toMatch(/p_special_instructions\s+text/i);
    expect(INSERT_COLUMNS).toContain('special_instructions');
    expect(INSERT_COLUMNS).toContain('delivery_address');
    expect(INSERT_COLUMNS).toContain('city');
    expect(INSERT_COLUMNS).not.toContain('special_requirements');
    expect(INSERT_COLUMNS).not.toContain('venue');
  });

  it('locks the package row and requires active status', () => {
    expect(CREATE_SQL).toMatch(/FOR\s+UPDATE/i);
    expect(CREATE_SQL).toMatch(/status\s+IS\s+DISTINCT\s+FROM\s+'active'|status\s*<>\s*'active'/i);
  });

  it('grants EXECUTE to authenticated only and revokes public/anon', () => {
    expect(CREATE_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?create_rental_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(CREATE_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?create_rental_booking[\s\S]*?TO\s+authenticated/i);
  });

  it('ships its own fail-closed catalog + verify guards', () => {
    expect(CREATE_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(CREATE_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('accept_rental_booking — server re-derives the advance, never the client', () => {
  it('is SECURITY DEFINER with a locked-down search_path', () => {
    expect(ACCEPT_SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.accept_rental_booking/i);
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
      /coalesce\(\s*nullif\(\s*dp\.advance_percentage\s*,\s*0\s*\)\s*,\s*20\s*\)[\s\S]*?from\s+public\.rental_packages/i,
    );
    expect(ACCEPT_SQL).toMatch(/v_total\s*:=\s*coalesce\(\s*v_bkg\.total_amount\s*,\s*0\s*\)/i);
    expect(ACCEPT_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*v_pct\s*\/\s*100/i);
    expect(ACCEPT_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
    expect(ACCEPT_SQL).not.toMatch(/round\(\s*v_total\s*\*\s*20\s*\/\s*100/i);
  });

  it('grants EXECUTE to authenticated only and ships catalog + verify guards', () => {
    expect(ACCEPT_SQL).toMatch(/REVOKE\s+ALL[\s\S]*?accept_rental_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i);
    expect(ACCEPT_SQL).toMatch(/GRANT\s+EXECUTE[\s\S]*?accept_rental_booking[\s\S]*?TO\s+authenticated/i);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(ACCEPT_SQL).toMatch(/DO\s+\$verify\$/);
  });
});
describe('client creation paths route through create_rental_booking (no browser amounts)', () => {
  it('RentalMenu "Book Now" calls the RPC and never direct-inserts rental_bookings', () => {
    expect(RENTAL_MENU_TSX).toMatch(/supabase\.rpc\(\s*['"]create_rental_booking['"]/);
    // No direct table INSERT into rental_bookings from the browser anymore.
    expect(RENTAL_MENU_TSX).not.toMatch(/\.from\(\s*['"]rental_bookings['"]\s*\)\s*\.insert/);
  });

  it('RentalMenu sends identifiers/selections + quantity ONLY — no authoritative amount keys', () => {
    expect(menuRpcArgs).not.toBe('');
    expect(menuRpcArgs).toMatch(/p_package_id/);
    expect(menuRpcArgs).toMatch(/p_special_instructions/);
    expect(menuRpcArgs).toMatch(/p_addon_ids/);
    // Rental IS the category with a real multiplier — the quantity selection is sent
    // (the server clamps + re-multiplies), but never a raw amount.
    expect(menuRpcArgs).toMatch(/p_quantity_required/);
    for (const key of AMOUNT_KEYS) {
      expect(menuRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    // customer_id / provider_id are FORCED server-side.
    expect(menuRpcArgs).not.toMatch(/customer_id|provider_id/i);
  });
  it('Checkout routes rental cart items through the RPC, not the generic amount INSERT', () => {
    expect(CHECKOUT_TSX).toMatch(/item\.bookingTable\s*===\s*['"]rental_bookings['"]/);
    expect(checkoutRpcArgs).not.toBe('');
    expect(checkoutRpcArgs).toMatch(/p_package_id/);
    expect(checkoutRpcArgs).toMatch(/p_addon_ids/);
    for (const key of AMOUNT_KEYS) {
      expect(checkoutRpcArgs).not.toMatch(new RegExp(key, 'i'));
    }
    // The old generic else wrote special_requirements + venue (columns rental lacks);
    // the rental branch sends special_instructions + delivery_address instead.
    expect(checkoutRpcArgs).toMatch(/p_special_instructions/);
    expect(checkoutRpcArgs).toMatch(/p_delivery_address/);
  });
});
describe('VendorBookings accept routes rental through accept_rental_booking (no client PATCH)', () => {
  // The rental branch body: from `=== 'rental_bookings')` to the generic `} else {`.
  const RENTAL_ACCEPT_BRANCH = (
    VENDOR_BOOKINGS_TSX.match(/===\s*['"]rental_bookings['"]\s*\)([\s\S]*?)\}\s*else\s*\{/) ?? ['', ''])[1];

  it('maps the rental source to the rental_bookings table', () => {
    expect(VENDOR_BOOKINGS_TSX).toMatch(/_source\s*===\s*['"]rental['"]\s*\?\s*['"]rental_bookings['"]/);
  });

  it('calls accept_rental_booking with only the booking id', () => {
    expect(RENTAL_ACCEPT_BRANCH).not.toBe('');
    expect(RENTAL_ACCEPT_BRANCH).toMatch(/supabase\.rpc\(\s*['"]accept_rental_booking['"]/);
    expect(RENTAL_ACCEPT_BRANCH).toMatch(/p_booking_id/);
  });

  it('does NOT PATCH advance_amount / remaining_amount from the browser', () => {
    // No client-side UPDATE of the money columns in the rental branch — the RPC owns them.
    expect(RENTAL_ACCEPT_BRANCH).not.toMatch(/advance_amount\s*:/i);
    expect(RENTAL_ACCEPT_BRANCH).not.toMatch(/remaining_amount\s*:/i);
    expect(RENTAL_ACCEPT_BRANCH).not.toMatch(/\.update\(/i);
    // It only trusts the server-derived advance for the notification copy.
    expect(RENTAL_ACCEPT_BRANCH).toMatch(/serverAdvance\s*=\s*Number\(\s*\(data as any\)\?\.advance_amount\s*\)/i);
  });
});
describe('parked column lockdown — amounts, identity & quantity un-PATCHable, INSERT RPC-only', () => {
  const protectedCols = sqlArray(LOCKDOWN_SQL, 'protected_cols');
  const benignCols = sqlArray(LOCKDOWN_SQL, 'benign_cols');
  const grantedCols = grantedUpdateColumns(LOCKDOWN_SQL);
  const EXPECTED_BENIGN = [
    'accepted_at', 'advance_paid_at', 'calendar_locked', 'city', 'confirmed_at',
    'delivery_address', 'event_date', 'event_time', 'event_type', 'expired_at',
    'inventory_reserved', 'otp_verified_at', 'payment_deadline', 'rental_duration',
    'settlement_status', 'special_instructions', 'start_requested_at', 'status',
    'work_completed_at', 'work_started_at',
  ];
  const EXPECTED_PROTECTED = [
    'base_amount', 'addons_amount', 'total_amount', 'advance_amount', 'remaining_amount',
    'quantity_required',
    'id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids',
  ];

  it('is PARKED with a do-not-push banner referencing both RPCs and the 3 rewired files', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+NOT\s+db\s+push\s+YET/i);
    expect(LOCKDOWN_SQL).toMatch(/20261225000000_rental_booking_server_authoritative/);
    expect(LOCKDOWN_SQL).toMatch(/20261226000000_rental_booking_accept_authoritative/);
    expect(LOCKDOWN_SQL).toMatch(/RentalMenu\.tsx/);
    expect(LOCKDOWN_SQL).toMatch(/Checkout\.tsx/);
    expect(LOCKDOWN_SQL).toMatch(/VendorBookings\.tsx/);
  });

  it('REVOKEs INSERT+UPDATE before granting back, and never re-grants INSERT', () => {
    const revokeIdx = LOCKDOWN_SQL.search(
      /REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.rental_bookings\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    const grantIdx = LOCKDOWN_SQL.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revokeIdx).toBeGreaterThanOrEqual(0);
    expect(grantIdx).toBeGreaterThan(revokeIdx);
    // The only GRANT INSERT lives inside the ROLLBACK comment — never in live SQL.
    expect(stripComments(LOCKDOWN_SQL)).not.toMatch(/GRANT\s+INSERT/i);
  });
  it('grants UPDATE on EXACTLY the 20 benign columns — no amount/quantity column among them', () => {
    expect(grantedCols.sort()).toEqual([...EXPECTED_BENIGN].sort());
    expect(benignCols.sort()).toEqual([...EXPECTED_BENIGN].sort());
    for (const amt of AMOUNT_KEYS) {
      expect(grantedCols).not.toContain(amt);
    }
    // The quantity multiplier is NEVER granted UPDATE (it re-prices the booking).
    expect(grantedCols).not.toContain('quantity_required');
    // Identity/provenance columns are never granted UPDATE either.
    for (const idc of ['id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids']) {
      expect(grantedCols).not.toContain(idc);
    }
    // Descriptive fields ARE benign (never pricing inputs).
    for (const d of ['event_type', 'delivery_address', 'city', 'rental_duration', 'special_instructions']) {
      expect(grantedCols).toContain(d);
    }
  });
  it('protects all five amounts + the quantity multiplier + identity (12 protected), disjoint from benign', () => {
    expect(protectedCols.sort()).toEqual([...EXPECTED_PROTECTED].sort());
    for (const amt of AMOUNT_KEYS) {
      expect(protectedCols).toContain(amt);
    }
    // Rental's defining trait: quantity_required is PROTECTED (a real pricing input).
    expect(protectedCols).toContain('quantity_required');
    // 12 protected + 20 benign = 32 live columns, and the two lists never overlap.
    expect(protectedCols.length).toBe(12);
    expect(benignCols.length).toBe(20);
    expect(protectedCols.length + benignCols.length).toBe(32);
    const overlap = protectedCols.filter((c) => benignCols.includes(c));
    expect(overlap).toEqual([]);
  });

  it('ships the fail-closed catalog + runtime probe (assumes the authenticated role)', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$probe\$/);
    expect(LOCKDOWN_SQL).toMatch(/SET\s+LOCAL\s+ROLE\s+authenticated/i);
    // catalog proves INSERT was revoked; probe proves a protected amount PATCH AND
    // the protected quantity PATCH are denied while a benign PATCH is allowed and a
    // direct INSERT is denied.
    expect(LOCKDOWN_SQL).toMatch(/has_table_privilege\(\s*'authenticated'[\s\S]*?'INSERT'\s*\)/i);
    expect(LOCKDOWN_SQL).toMatch(/SET\s+quantity_required\s*=\s*quantity_required/i);
  });
});
