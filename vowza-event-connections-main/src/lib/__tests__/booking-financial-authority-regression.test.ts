/**
 * P0-1 — booking financial authority (band pilot regression guard).
 *
 * These are STATIC / CONTRACT regressions that run under `npm test` with NO
 * database. They prove the *shape* of the fix holds: the browser cannot send
 * booking amounts, the RPC derives them server-side, and the parked lockdown
 * keeps the amount columns un-PATCHable. They do NOT — and cannot, from this
 * environment — assert a real Postgres outcome. The behavioural proof runs at
 * APPLY time against a live database:
 *
 *   supabase/migrations/20261205000000_band_booking_server_authoritative.sql
 *     $catalog$  fails closed if the live band_* schema drifts from the columns
 *                / numeric types create_band_booking reads and writes.
 *   supabase/migrations-pending/PHASE_band_bookings_column_lockdown.sql
 *     $catalog$  proves the granted set === benign catalogue and that every
 *                live column is classified benign XOR protected.
 *     $probe$    impersonates `authenticated` and proves a direct PATCH of
 *                base_amount / addons_amount / total_amount is denied (42501)
 *                while status / advance_amount stay writable.
 *
 * What THIS file guards on every CI run is that nobody re-opens the hole in the
 * source: that the RPC takes no amount parameter, that BandMenu stops sending
 * amounts, and that the lockdown never re-grants the protected columns.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261205000000_band_booking_server_authoritative.sql');
const ACCEPT_SQL = repoFile('supabase/migrations/20261206000000_band_booking_accept_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_band_bookings_column_lockdown.sql');
const BAND_MENU_TSX = repoFile('src/components/BandMenu.tsx');
const VENDOR_BOOKINGS_TSX = repoFile('src/pages/vendor/VendorBookings.tsx');
const CHECKOUT_TSX = repoFile('src/pages/Checkout.tsx');

/** Parameter list between `create_band_booking(` and `) returns`. */
const RPC_SIGNATURE = (CREATE_SQL.match(
  /create\s+or\s+replace\s+function\s+public\.create_band_booking\s*\(([\s\S]*?)\)\s*returns/i,
) ?? [, ''])[1];

/** Parameter list between `accept_band_booking(` and `) returns`. */
const ACCEPT_SIGNATURE = (ACCEPT_SQL.match(
  /create\s+or\s+replace\s+function\s+public\.accept_band_booking\s*\(([\s\S]*?)\)\s*returns/i,
) ?? [, ''])[1];

/** The object literal passed to supabase.rpc('create_band_booking', { ... }) in a source file. */
const rpcCallArgs = (src: string, fn: string) =>
  (src.match(new RegExp(`supabase\\.rpc\\(\\s*['"]${fn}['"][\\s\\S]*?\\{([\\s\\S]*?)\\}\\s*\\)`)) ?? [, ''])[1];

/** The object literal passed to supabase.rpc('create_band_booking', { ... }). */
const RPC_CALL_ARGS = rpcCallArgs(BAND_MENU_TSX, 'create_band_booking');
/** The object literal passed to supabase.rpc('create_band_booking', { ... }) in Checkout. */
const CHECKOUT_RPC_ARGS = rpcCallArgs(CHECKOUT_TSX, 'create_band_booking');

/** Identifiers inside `GRANT UPDATE ( ... ) ON public.band_bookings TO authenticated`. */
function grantedUpdateColumns(sql: string): string[] {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.band_bookings\s+TO\s+authenticated/i,
  );
  return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
}

/** Quoted identifiers of a `<name> text[] := ARRAY[ ... ];` declaration. */
function sqlArray(sql: string, name: string): string[] {
  const m = sql.match(new RegExp(`\\b${name}\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([\\s\\S]*?)\\]`, 'i'));
  return m ? [...m[1].matchAll(/'([a-z0-9_]+)'/gi)].map((x) => x[1]) : [];
}

describe('P0-1 band pilot — create_band_booking is server-authoritative', () => {
  it('exists as a SECURITY DEFINER RPC with a hardened (empty) search_path', () => {
    expect(CREATE_SQL).toMatch(/create\s+or\s+replace\s+function\s+public\.create_band_booking/i);
    expect(CREATE_SQL).toMatch(/security\s+definer/i);
    expect(CREATE_SQL).toMatch(/set\s+search_path\s*=\s*''/i);
  });

  it('accepts NO financial parameter — the browser cannot pass any amount', () => {
    expect(RPC_SIGNATURE.length).toBeGreaterThan(0);
    // identifiers / selections / descriptors only.
    expect(RPC_SIGNATURE).toMatch(/p_package_id\s+uuid/i);
    expect(RPC_SIGNATURE).toMatch(/p_addon_ids\s+uuid\[\]/i);
    // the whole signature must not mention an amount/fee/price parameter.
    expect(RPC_SIGNATURE).not.toMatch(/amount/i);
    expect(RPC_SIGNATURE).not.toMatch(/platform_fee|\bprice\b/i);
  });

  it('forces customer identity from auth.uid(), never a client parameter', () => {
    expect(CREATE_SQL).toMatch(/auth\.uid\(\)/);
    expect(RPC_SIGNATURE).not.toMatch(/customer_id|p_customer/i);
    expect(CREATE_SQL).toMatch(/Authentication required/);
  });

  it('derives every amount server-side from the trusted package + addon rows', () => {
    // base from the package, addons summed from band_addons scoped to the package
    expect(CREATE_SQL).toMatch(/coalesce\(\s*v_pkg\.package_price/i);
    expect(CREATE_SQL).toMatch(/sum\(\s*a\.price\s*\)[\s\S]*from\s+public\.band_addons/i);
    expect(CREATE_SQL).toMatch(/a\.package_id\s*=\s*v_pkg\.id/i);
    // advance reproduces `Number(pkg.advance_percentage || 20)` (null OR 0 -> 20)
    expect(CREATE_SQL).toMatch(/coalesce\(\s*nullif\(\s*v_pkg\.advance_percentage\s*,\s*0\s*\)\s*,\s*20\s*\)/i);
    expect(CREATE_SQL).toMatch(/v_total\s*:=\s*v_base\s*\+\s*v_addons/i);
    expect(CREATE_SQL).toMatch(/v_remaining\s*:=\s*v_total\s*-\s*v_advance/i);
  });

  it('only lets an ACTIVE package be booked (mirrors the client status filter)', () => {
    expect(CREATE_SQL).toMatch(/status\s*=\s*'active'/i);
    expect(CREATE_SQL).toMatch(/for\s+update/i);
  });

  it('is EXECUTE-able only by authenticated, never anon/public', () => {
    expect(CREATE_SQL).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.create_band_booking[\s\S]*?to\s+authenticated/i,
    );
    expect(CREATE_SQL).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.create_band_booking[\s\S]*?from\s+public,\s*anon/i,
    );
  });

  it('fails closed: aborts if the live band schema drifts', () => {
    expect(CREATE_SQL).toMatch(/DO \$catalog\$/);
    expect(CREATE_SQL).toMatch(/ABORT create_band_booking/);
  });
});

describe('P0-1 band pilot — accept_band_booking is server-authoritative', () => {
  it('exists as a SECURITY DEFINER RPC with a hardened (empty) search_path', () => {
    expect(ACCEPT_SQL).toMatch(/create\s+or\s+replace\s+function\s+public\.accept_band_booking/i);
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

  it('derives advance/remaining server-side from the STORED total_amount', () => {
    // advance = round(stored total * 20%); never a client-supplied number.
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
      /grant\s+execute\s+on\s+function\s+public\.accept_band_booking[\s\S]*?to\s+authenticated/i,
    );
    expect(ACCEPT_SQL).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.accept_band_booking[\s\S]*?from\s+public,\s*anon/i,
    );
  });

  it('carries the drift guard and the fail-closed self-check', () => {
    expect(ACCEPT_SQL).toMatch(/DO \$catalog\$/);
    expect(ACCEPT_SQL).toMatch(/ABORT accept_band_booking/);
    expect(ACCEPT_SQL).toMatch(/DO \$verify\$/);
  });
});

describe('P0-1 band pilot — client accept/create paths route through the RPCs', () => {
  it('VendorBookings accepts band bookings via accept_band_booking, gated on the band table', () => {
    expect(VENDOR_BOOKINGS_TSX).toMatch(/supabase\.rpc\(\s*['"]accept_band_booking['"]/);
    expect(VENDOR_BOOKINGS_TSX).toMatch(/table === 'band_bookings'/);
  });

  it('VendorBookings never PATCHes advance/remaining for the band table', () => {
    // The client advance/remaining UPDATE payload must live only in the non-band
    // branch. Slice out the band branch and prove it carries no amount write.
    const bandBranch = (VENDOR_BOOKINGS_TSX.match(
      /if\s*\(table === 'band_bookings'\)\s*\{([\s\S]*?)\}\s*else\s*\{/,
    ) ?? [, ''])[1];
    expect(bandBranch.length).toBeGreaterThan(0);
    expect(bandBranch).toMatch(/accept_band_booking/);
    expect(bandBranch).not.toMatch(/advance_amount\s*:/);
    expect(bandBranch).not.toMatch(/remaining_amount\s*:/);
  });

  it('Checkout creates band cart items via create_band_booking (no client amounts)', () => {
    expect(CHECKOUT_TSX).toMatch(/supabase\.rpc\(\s*['"]create_band_booking['"]/);
    expect(CHECKOUT_TSX).toMatch(/item\.bookingTable === 'band_bookings'/);
    expect(CHECKOUT_RPC_ARGS.length).toBeGreaterThan(0);
    expect(CHECKOUT_RPC_ARGS).toMatch(/p_package_id/);
    expect(CHECKOUT_RPC_ARGS).not.toMatch(/amount/i);
    expect(CHECKOUT_RPC_ARGS).not.toMatch(/base_amount|total_amount|advance_amount|remaining_amount/i);
  });
});

describe('P0-1 band pilot — BandMenu routes creation through the RPC', () => {
  it('creates via the create_band_booking RPC', () => {
    expect(BAND_MENU_TSX).toMatch(/supabase\.rpc\(\s*['"]create_band_booking['"]/);
  });

  it('no longer inserts into band_bookings directly from the browser', () => {
    expect(BAND_MENU_TSX).not.toMatch(/\.from\(\s*['"]band_bookings['"]\s*\)\s*\.insert/);
  });

  it('sends NO amount in the RPC payload (identifiers/selections only)', () => {
    expect(RPC_CALL_ARGS.length).toBeGreaterThan(0);
    expect(RPC_CALL_ARGS).toMatch(/p_package_id/);
    expect(RPC_CALL_ARGS).not.toMatch(/amount/i);
    expect(RPC_CALL_ARGS).not.toMatch(/base_amount|total_amount|advance_amount|remaining_amount/i);
  });
});

describe('P0-1 band pilot — parked column lockdown protects the amount columns', () => {
  const granted = grantedUpdateColumns(LOCKDOWN_SQL);
  const benign = sqlArray(LOCKDOWN_SQL, 'benign');
  const protectedCols = sqlArray(LOCKDOWN_SQL, 'protected');
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

  it('locks INSERT: revokes it and never grants it back to authenticated (creation is RPC-only)', () => {
    const execSql = LOCKDOWN_SQL.replace(/--[^\n]*/g, '');
    // INSERT must be revoked alongside UPDATE.
    expect(execSql).toMatch(/REVOKE\s+INSERT[\s\S]*?ON\s+public\.band_bookings\s+FROM[\s\S]*?authenticated/i);
    // and never granted back — neither table-wide nor column-scoped.
    expect(execSql).not.toMatch(/GRANT\s+INSERT[\s\S]*?ON\s+public\.band_bookings\s+TO\s+authenticated/i);
    // the $catalog$ guard must assert the INSERT privilege is gone.
    expect(LOCKDOWN_SQL).toMatch(/has_table_privilege\([^)]*'INSERT'\)/i);
  });

  it('protects the identity columns too (id/customer/provider/package/created_at)', () => {
    for (const col of ['id', 'customer_id', 'provider_id', 'package_id', 'created_at']) {
      expect(protectedCols, `${col} must be protected`).toContain(col);
    }
  });

  it('benign and protected are disjoint', () => {
    expect(benign.filter((c) => protectedCols.includes(c))).toEqual([]);
  });

  it('revokes table-wide UPDATE before re-granting the allowlist, and never re-opens it', () => {
    const revokeAt = LOCKDOWN_SQL.search(
      /REVOKE\s+[A-Z, ]*UPDATE\s+ON\s+public\.band_bookings\s+FROM[^;]*authenticated/i,
    );
    const grantAt = LOCKDOWN_SQL.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revokeAt).toBeGreaterThanOrEqual(0);
    expect(grantAt).toBeGreaterThan(revokeAt);
    // a column-less table-wide GRANT UPDATE would undo the whole lockdown. Check
    // executable SQL only — the ROLLBACK note legitimately shows it in a comment.
    const execSql = LOCKDOWN_SQL.replace(/--[^\n]*/g, '');
    expect(execSql).not.toMatch(/GRANT\s+UPDATE\s+ON\s+public\.band_bookings\s+TO\s+authenticated/i);
  });

  it('carries both the static ($catalog$) and runtime ($probe$) apply-time proofs', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO \$catalog\$/);
    expect(LOCKDOWN_SQL).toMatch(/DO \$probe\$/);
  });
});
