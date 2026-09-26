/**
 * P0-1 — booking financial authority (ANCHOR regression guard).
 *
 * STATIC / CONTRACT regressions that run under `npm test` with NO database. They
 * prove the *shape* of the fix holds: the browser cannot send anchor booking
 * amounts, the RPCs derive them server-side, and the parked lockdown keeps the
 * amount + identity columns un-PATCHable while INSERT is RPC-only. They do NOT
 * assert a real Postgres outcome — that is proven at APPLY time by the $catalog$
 * / $verify$ / $probe$ blocks inside the migrations themselves. What THIS file
 * guards on every CI run is that nobody re-opens the hole in the source: the RPCs
 * take no amount parameter, the client paths (AnchorMenu "Book Now", the Checkout
 * cart branch, the VendorBookings accept) stop sending/PATCHing amounts, and the
 * lockdown never re-grants the protected columns.
 *
 * ANCHOR-SPECIFIC: anchor is a FLAT package_price model (base = package_price),
 * like band — NOT catering's per-plate model. It therefore has NO guest_count
 * pricing multiplier: expected_audience is a DESCRIPTIVE field (the total is
 * package_price + addons regardless of the client count), so it is classified
 * BENIGN, not protected. This file asserts that contrast explicitly.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261209000000_anchor_booking_server_authoritative.sql');
const ACCEPT_SQL = repoFile('supabase/migrations/20261210000000_anchor_booking_accept_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_anchor_bookings_column_lockdown.sql');
const ANCHOR_MENU_TSX = repoFile('src/components/AnchorMenu.tsx');
const CHECKOUT_TSX = repoFile('src/pages/Checkout.tsx');
const VENDOR_BOOKINGS_TSX = repoFile('src/pages/vendor/VendorBookings.tsx');

/** Parameter list between `create_anchor_booking(` and `) returns`. */
const RPC_SIGNATURE = (CREATE_SQL.match(
  /create\s+or\s+replace\s+function\s+public\.create_anchor_booking\s*\(([\s\S]*?)\)\s*returns/i,
) ?? ['', ''])[1];

/** Parameter list between `accept_anchor_booking(` and `) returns`. */
const ACCEPT_SIGNATURE = (ACCEPT_SQL.match(
  /create\s+or\s+replace\s+function\s+public\.accept_anchor_booking\s*\(([\s\S]*?)\)\s*returns/i,
) ?? ['', ''])[1];

/** The column list between `INSERT INTO public.anchor_bookings (` and `) VALUES`. */
const INSERT_COLUMNS = (CREATE_SQL.match(
  /INSERT\s+INTO\s+public\.anchor_bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
) ?? ['', ''])[1];

/** The object literal passed to supabase.rpc('<fn>', { ... }) in a source file. */
const rpcCallArgs = (src: string, fn: string) =>
  (src.match(new RegExp(`supabase\\.rpc\\(\\s*['"]${fn}['"][\\s\\S]*?\\{([\\s\\S]*?)\\}\\s*\\)`)) ?? ['', ''])[1];

const MENU_RPC_ARGS = rpcCallArgs(ANCHOR_MENU_TSX, 'create_anchor_booking');

/** Identifiers inside `GRANT UPDATE ( ... ) ON public.anchor_bookings TO authenticated`. */
function grantedUpdateColumns(sql: string): string[] {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.anchor_bookings\s+TO\s+authenticated/i,
  );
  return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
}

/** Quoted identifiers of a `<name> text[] := ARRAY[ ... ];` declaration. */
function sqlArray(sql: string, name: string): string[] {
  const m = sql.match(new RegExp(`\\b${name}\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([\\s\\S]*?)\\]`, 'i'));
  return m ? [...m[1].matchAll(/'([a-z0-9_]+)'/gi)].map((x) => x[1]) : [];
}

describe('P0-1 anchor — create_anchor_booking is server-authoritative', () => {
  it('exists as a SECURITY DEFINER RPC with a hardened (empty) search_path', () => {
    expect(CREATE_SQL).toMatch(/create\s+or\s+replace\s+function\s+public\.create_anchor_booking/i);
    expect(CREATE_SQL).toMatch(/security\s+definer/i);
    expect(CREATE_SQL).toMatch(/set\s+search_path\s*=\s*''/i);
  });

  it('accepts NO financial parameter — the browser cannot pass any amount', () => {
    expect(RPC_SIGNATURE.length).toBeGreaterThan(0);
    // identifiers / selections / descriptors only.
    expect(RPC_SIGNATURE).toMatch(/p_package_id\s+uuid/i);
    expect(RPC_SIGNATURE).toMatch(/p_addon_ids\s+uuid\[\]/i);
    // expected_audience is a DESCRIPTIVE text field, never a numeric quantity.
    expect(RPC_SIGNATURE).toMatch(/p_expected_audience\s+text/i);
    // the whole signature must not mention an amount/fee/price parameter.
    expect(RPC_SIGNATURE).not.toMatch(/amount/i);
    expect(RPC_SIGNATURE).not.toMatch(/platform_fee|\bprice\b/i);
  });

  it('forces customer identity from auth.uid(), never a client parameter', () => {
    expect(CREATE_SQL).toMatch(/auth\.uid\(\)/);
    expect(RPC_SIGNATURE).not.toMatch(/customer_id|p_customer/i);
    expect(CREATE_SQL).toMatch(/Authentication required/);
  });

  it('derives base FLAT from package_price (not per-plate) and addons server-side', () => {
    // base = package_price  (flat; anchor is NOT priced per plate / per guest)
    expect(CREATE_SQL).toMatch(/v_base\s*:=\s*coalesce\(\s*v_pkg\.package_price/i);
    // anchor has no per-plate / guest_count multiplier anywhere in the RPC.
    expect(CREATE_SQL).not.toMatch(/price_per_plate|guest_count/i);
    // addons summed from anchor_addons scoped to the package.
    expect(CREATE_SQL).toMatch(/sum\(\s*a\.price\s*\)[\s\S]*from\s+public\.anchor_addons/i);
    expect(CREATE_SQL).toMatch(/a\.package_id\s*=\s*v_pkg\.id/i);
    expect(CREATE_SQL).toMatch(/v_total\s*:=\s*v_base\s*\+\s*v_addons/i);
  });

  it('leaves advance/remaining at creation-time defaults (derived only at accept)', () => {
    // the INSERT column list stores base/addons/total but NOT advance/remaining,
    // reproducing AnchorMenu's current behaviour.
    expect(INSERT_COLUMNS.length).toBeGreaterThan(0);
    expect(INSERT_COLUMNS).toMatch(/base_amount/i);
    expect(INSERT_COLUMNS).toMatch(/addons_amount/i);
    expect(INSERT_COLUMNS).toMatch(/total_amount/i);
    expect(INSERT_COLUMNS).not.toMatch(/advance_amount/i);
    expect(INSERT_COLUMNS).not.toMatch(/remaining_amount/i);
  });

  it('only lets an ACTIVE package be booked and row-locks it', () => {
    expect(CREATE_SQL).toMatch(/status\s*=\s*'active'/i);
    expect(CREATE_SQL).toMatch(/for\s+update/i);
  });

  it('is EXECUTE-able only by authenticated, never anon/public', () => {
    expect(CREATE_SQL).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.create_anchor_booking[\s\S]*?to\s+authenticated/i,
    );
    expect(CREATE_SQL).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.create_anchor_booking[\s\S]*?from\s+public,\s*anon/i,
    );
  });

  it('fails closed: aborts if the live anchor schema drifts', () => {
    expect(CREATE_SQL).toMatch(/DO \$catalog\$/);
    expect(CREATE_SQL).toMatch(/ABORT create_anchor_booking/);
    expect(CREATE_SQL).toMatch(/DO \$verify\$/);
  });
});

describe('P0-1 anchor — accept_anchor_booking is server-authoritative', () => {
  it('exists as a SECURITY DEFINER RPC with a hardened (empty) search_path', () => {
    expect(ACCEPT_SQL).toMatch(/create\s+or\s+replace\s+function\s+public\.accept_anchor_booking/i);
    expect(ACCEPT_SQL).toMatch(/security\s+definer/i);
    expect(ACCEPT_SQL).toMatch(/set\s+search_path\s*=\s*''/i);
  });

  it('takes ONLY the booking id — no advance/remaining/amount parameter', () => {
    expect(ACCEPT_SIGNATURE.length).toBeGreaterThan(0);
    expect(ACCEPT_SIGNATURE).toMatch(/p_booking_id\s+uuid/i);
    expect(ACCEPT_SIGNATURE).not.toMatch(/amount/i);
    expect(ACCEPT_SIGNATURE).not.toMatch(/advance|remaining|\bprice\b/i);
  });

  it('authorizes the caller as the owning provider (provider_profiles.user_id = auth.uid())', () => {
    expect(ACCEPT_SQL).toMatch(/auth\.uid\(\)/);
    expect(ACCEPT_SQL).toMatch(/from\s+public\.provider_profiles/i);
    expect(ACCEPT_SQL).toMatch(/user_id[\s\S]*?<>\s*v_uid/i);
    expect(ACCEPT_SQL).toMatch(/Only the booking provider/i);
  });

  it('derives advance/remaining server-side from the STORED total_amount (flat 20%)', () => {
    expect(ACCEPT_SQL).toMatch(/v_total\s*:=\s*coalesce\(\s*v_bkg\.total_amount/i);
    expect(ACCEPT_SQL).toMatch(/v_advance\s*:=\s*round\(\s*v_total\s*\*\s*20\s*\/\s*100/i);
    expect(ACCEPT_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
  });

  it('only accepts a pending booking and row-locks it', () => {
    expect(ACCEPT_SQL).toMatch(/status\s+is\s+distinct\s+from\s+'pending'/i);
    expect(ACCEPT_SQL).toMatch(/for\s+update/i);
  });

  it('is EXECUTE-able only by authenticated, never anon/public', () => {
    expect(ACCEPT_SQL).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.accept_anchor_booking[\s\S]*?to\s+authenticated/i,
    );
    expect(ACCEPT_SQL).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.accept_anchor_booking[\s\S]*?from\s+public,\s*anon/i,
    );
  });

  it('carries the drift guard and the fail-closed self-check', () => {
    expect(ACCEPT_SQL).toMatch(/DO \$catalog\$/);
    expect(ACCEPT_SQL).toMatch(/ABORT accept_anchor_booking/);
    expect(ACCEPT_SQL).toMatch(/DO \$verify\$/);
  });
});

describe('P0-1 anchor — client create/accept paths route through the RPCs', () => {
  it('AnchorMenu "Book Now" creates via create_anchor_booking (no direct insert)', () => {
    expect(ANCHOR_MENU_TSX).toMatch(/supabase\.rpc\(\s*['"]create_anchor_booking['"]/);
    // the direct amount-carrying INSERT into anchor_bookings is gone.
    expect(ANCHOR_MENU_TSX).not.toMatch(/\.from\(\s*['"]anchor_bookings['"](\s+as\s+any)?\s*\)\s*\.insert/);
    // and no DB amount column is written from the client anymore (the local
    // camelCase consts used for the success-screen display are not these).
    expect(ANCHOR_MENU_TSX).not.toMatch(/base_amount\s*:/);
    expect(ANCHOR_MENU_TSX).not.toMatch(/total_amount\s*:/);
    expect(ANCHOR_MENU_TSX).not.toMatch(/advance_amount\s*:/);
    expect(ANCHOR_MENU_TSX).not.toMatch(/remaining_amount\s*:/);
  });

  it('AnchorMenu sends NO amount in the RPC payload (identifiers/selections only)', () => {
    expect(MENU_RPC_ARGS.length).toBeGreaterThan(0);
    expect(MENU_RPC_ARGS).toMatch(/p_package_id/);
    expect(MENU_RPC_ARGS).toMatch(/p_expected_audience/);
    expect(MENU_RPC_ARGS).not.toMatch(/amount/i);
  });

  it('Checkout routes anchor cart items through create_anchor_booking (no generic INSERT)', () => {
    const anchorBranch = (CHECKOUT_TSX.match(
      /item\.bookingTable === 'anchor_bookings'\)\s*\{([\s\S]*?)\}\s*else\s*\{/,
    ) ?? ['', ''])[1];
    expect(anchorBranch.length).toBeGreaterThan(0);
    expect(anchorBranch).toMatch(/supabase\.rpc\(\s*['"]create_anchor_booking['"]/);
    expect(anchorBranch).not.toMatch(/\.insert\(/);
    expect(anchorBranch).not.toMatch(/base_amount|total_amount|advance_amount|remaining_amount/i);
  });

  it('VendorBookings accepts anchor via accept_anchor_booking, gated on the anchor table', () => {
    expect(VENDOR_BOOKINGS_TSX).toMatch(/supabase\.rpc\(\s*['"]accept_anchor_booking['"]/);
    expect(VENDOR_BOOKINGS_TSX).toMatch(/table === 'anchor_bookings'/);
  });

  it('VendorBookings never PATCHes advance/remaining for the anchor table', () => {
    const anchorBranch = (VENDOR_BOOKINGS_TSX.match(
      /else if \(table === 'anchor_bookings'\)\s*\{([\s\S]*?)\}\s*else\s*\{/,
    ) ?? ['', ''])[1];
    expect(anchorBranch.length).toBeGreaterThan(0);
    expect(anchorBranch).toMatch(/accept_anchor_booking/);
    expect(anchorBranch).not.toMatch(/advance_amount\s*:/);
    expect(anchorBranch).not.toMatch(/remaining_amount\s*:/);
  });
});

describe('P0-1 anchor — parked column lockdown protects the amount + identity columns', () => {
  const granted = grantedUpdateColumns(LOCKDOWN_SQL);
  const benign = sqlArray(LOCKDOWN_SQL, 'benign_cols');
  const protectedCols = sqlArray(LOCKDOWN_SQL, 'protected_cols');
  const AMOUNTS = ['base_amount', 'addons_amount', 'total_amount', 'advance_amount', 'remaining_amount'];

  it('is parked (not shippable by `supabase db push`)', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO NOT db push YET/);
  });

  it('grants UPDATE only on the benign allowlist (granted set === benign catalogue)', () => {
    expect(granted.length).toBeGreaterThan(0);
    expect([...granted].sort()).toEqual([...benign].sort());
  });

  it('classifies all five amount columns as protected and never grants them', () => {
    for (const col of AMOUNTS) {
      expect(protectedCols, `${col} must be protected`).toContain(col);
      expect(granted, `${col} must NOT be granted to authenticated`).not.toContain(col);
    }
  });

  it('classifies expected_audience as BENIGN — it is descriptive, NOT a pricing multiplier', () => {
    // The anchor-specific contrast with catering: catering protects guest_count
    // (a per-plate multiplier); anchor's expected_audience does not affect any
    // amount, so it stays browser-writable.
    expect(benign).toContain('expected_audience');
    expect(granted).toContain('expected_audience');
    expect(protectedCols).not.toContain('expected_audience');
    // and there is no guest_count column classified at all (anchor has none).
    expect(protectedCols).not.toContain('guest_count');
    expect(benign).not.toContain('guest_count');
  });

  it('locks INSERT: revokes it and never grants it back to authenticated (creation is RPC-only)', () => {
    const execSql = LOCKDOWN_SQL.replace(/--[^\n]*/g, '');
    expect(execSql).toMatch(/REVOKE\s+INSERT[\s\S]*?ON\s+public\.anchor_bookings\s+FROM[\s\S]*?authenticated/i);
    expect(execSql).not.toMatch(/GRANT\s+INSERT[\s\S]*?ON\s+public\.anchor_bookings\s+TO\s+authenticated/i);
    expect(LOCKDOWN_SQL).toMatch(/has_table_privilege\([^)]*'INSERT'\)/i);
  });

  it('protects the identity columns too (id/customer/provider/package/created_at/selected_addon_ids)', () => {
    for (const col of ['id', 'customer_id', 'provider_id', 'package_id', 'created_at', 'selected_addon_ids']) {
      expect(protectedCols, `${col} must be protected`).toContain(col);
    }
  });

  it('benign and protected are disjoint', () => {
    expect(benign.filter((c) => protectedCols.includes(c))).toEqual([]);
  });

  it('classifies every one of the 30 live columns (11 protected + 19 benign)', () => {
    expect(protectedCols.length).toBe(11);
    expect(benign.length).toBe(19);
  });

  it('revokes table-wide UPDATE before re-granting the allowlist, and never re-opens it', () => {
    const revokeAt = LOCKDOWN_SQL.search(
      /REVOKE\s+[A-Z, ]*UPDATE\s+ON\s+public\.anchor_bookings\s+FROM[^;]*authenticated/i,
    );
    const grantAt = LOCKDOWN_SQL.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revokeAt).toBeGreaterThanOrEqual(0);
    expect(grantAt).toBeGreaterThan(revokeAt);
    const execSql = LOCKDOWN_SQL.replace(/--[^\n]*/g, '');
    expect(execSql).not.toMatch(/GRANT\s+UPDATE\s+ON\s+public\.anchor_bookings\s+TO\s+authenticated/i);
  });

  it('carries both the static ($catalog$) and runtime ($probe$) apply-time proofs', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO \$catalog\$/);
    expect(LOCKDOWN_SQL).toMatch(/DO \$probe\$/);
  });
});
