/**
 * P0-1 — booking financial authority (generic `bookings` regression guard).
 *
 * The generic public.bookings table is the ORIGINAL direct-booking flow
 * (BookingModal.tsx via ProviderProfile.tsx) that predates the 15 vendor
 * category tables and the admin event-package flow — the LAST Phase B table.
 *
 * STATIC / CONTRACT regressions run under `npm test` with NO database. They prove
 * the *shape* of the fix holds: the browser cannot set the booking `amount` when a
 * package is selected, the create RPC decides amount/platform_fee/status/customer
 * server-side, and the parked lockdown keeps the financial + identity columns
 * un-PATCHable while INSERT is RPC-only. The real Postgres outcome is proven at
 * APPLY time by the migrations' own $catalog$ / $verify$ / $probe$ blocks.
 *
 * GENERIC-BOOKINGS-SPECIFIC #1 (TWO amount branches): when a package is chosen the
 * amount is server-authoritative (= pricing_packages.price of a package that must
 * belong to the provider). With NO package the "Offered Amount" is a genuine
 * customer NEGOTIATION — the customer legitimately names the price, there is no
 * server-authoritative source, and the RPC HONORS p_offered_amount (enforcing only
 * > 0). p_offered_amount is the ONLY amount-shaped parameter and is ignored by the
 * package branch.
 *
 * GENERIC-BOOKINGS-SPECIFIC #2 (no accept RPC): the provider accept/reject path
 * writes ONLY status (no financial value) and advance_amount/remaining_amount are
 * never written by any app path, so — unlike the 15 vendor categories — there is
 * NO companion accept_* RPC, only the create RPC.
 *
 * GENERIC-BOOKINGS-SPECIFIC #3 (package_id bug fix): public.bookings has NO
 * package_id column (the only package_id in the schema is on auth_promotion_media).
 * The old BookingModal insert sent a package_id key that PostgREST would reject;
 * the RPC uses the package id ONLY to look up the price and never stores it.
 *
 * GENERIC-BOOKINGS-SPECIFIC #4 (lockdown split): public.bookings has 34 columns →
 * lockdown 8 protected / 26 benign / 34 total. The 4 financial amounts (amount,
 * advance_amount, remaining_amount, platform_fee) + the 4 identity/provenance
 * columns are protected; the 26 lifecycle/logistics/state columns are benign.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const CREATE_SQL = repoFile('supabase/migrations/20261236000000_bookings_server_authoritative.sql');
const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_bookings_column_lockdown.sql');
const BOOKING_MODAL_TSX = repoFile('src/components/BookingModal.tsx');
const USE_BOOKINGS_TS = repoFile('src/hooks/useBookings.ts');

/** Strip `-- ...` line comments so absence assertions never false-match prose. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');

const CREATE_NOCMT = stripComments(CREATE_SQL);
const LOCKDOWN_NOCMT = stripComments(LOCKDOWN_SQL);

/** The RPC parameter list, comment-stripped. */
const CREATE_SIGNATURE = (() => {
  const m = CREATE_NOCMT.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_generic_booking\s*\(([\s\S]*?)\)\s*RETURNS/i,
  );
  return m ? m[1] : '';
})();

/** The INSERT INTO public.bookings (...) column list, comment-stripped. */
const INSERT_COLUMNS = (() => {
  const m = CREATE_NOCMT.match(
    /INSERT\s+INTO\s+public\.bookings\s*\(([\s\S]*?)\)\s*VALUES/i,
  );
  return m
    ? m[1].split(',').map((c) => c.trim()).filter(Boolean)
    : [];
})();

/** Columns the parked lockdown GRANTs UPDATE back to authenticated. */
const grantedUpdateColumns = (() => {
  const m = LOCKDOWN_SQL.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.bookings\s+TO\s+authenticated/i,
  );
  return m
    ? m[1].split(',').map((c) => c.replace(/--[^\n]*/g, '').trim()).filter(Boolean)
    : [];
})();

/** The `{...}` args object of a `supabase.rpc('create_generic_booking', {...})` call. */
const rpcArgsIn = (src: string) => {
  const m = src.match(
    /supabase\.rpc\(\s*['"]create_generic_booking['"][\s\S]*?\{([\s\S]*?)\}\s*\)/,
  );
  return m ? m[1] : '';
};
const MODAL_RPC_ARGS = rpcArgsIn(BOOKING_MODAL_TSX);
const USE_BOOKINGS_RPC_ARGS = rpcArgsIn(USE_BOOKINGS_TS);

/** The 8 protected + 26 benign columns the lockdown's $catalog$ split declares. */
const PROTECTED_COLS = [
  'amount', 'advance_amount', 'remaining_amount', 'platform_fee',
  'id', 'customer_id', 'provider_id', 'created_at',
];
const BENIGN_COLS = [
  'accepted_at', 'advance_paid_at', 'calendar_locked', 'confirmed_at',
  'customer_notes', 'event_date', 'event_duration_hours', 'event_time',
  'event_type_id', 'expired_at', 'invoice_generated_at', 'invoice_number',
  'invoice_url', 'otp_verified_at', 'payment_deadline', 'provider_notes',
  'requirements', 'settlement_status', 'start_requested_at', 'status',
  'updated_at', 'venue_address', 'venue_area', 'venue_city',
  'work_completed_at', 'work_started_at',
];
describe('create_generic_booking RPC — server-authoritative create', () => {
  it('is a SECURITY DEFINER function with a hardened empty search_path', () => {
    expect(CREATE_SQL).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_generic_booking/i,
    );
    expect(CREATE_SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(CREATE_SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('exposes p_offered_amount as the ONLY amount-shaped parameter — no trusted financial params', () => {
    expect(CREATE_SIGNATURE).toMatch(/p_offered_amount/);
    expect(CREATE_SIGNATURE).toMatch(/p_package_id/);
    expect(CREATE_SIGNATURE).toMatch(/p_provider_id/);
    // No client-supplied authoritative financial / identity / status inputs.
    expect(CREATE_SIGNATURE).not.toMatch(/platform_fee/i);
    expect(CREATE_SIGNATURE).not.toMatch(/advance_amount/i);
    expect(CREATE_SIGNATURE).not.toMatch(/remaining_amount/i);
    expect(CREATE_SIGNATURE).not.toMatch(/total_amount/i);
    expect(CREATE_SIGNATURE).not.toMatch(/base_amount/i);
    expect(CREATE_SIGNATURE).not.toMatch(/p_customer_id/i);
    expect(CREATE_SIGNATURE).not.toMatch(/p_status/i);
  });

  it('forces customer identity from auth.uid() and rejects an unauthenticated caller', () => {
    expect(CREATE_SQL).toMatch(/auth\.uid\(\)/);
    expect(CREATE_SQL).toMatch(/ERRCODE\s*=\s*'28000'/);
  });

  it('PACKAGE branch: derives amount from the row-locked pricing_packages.price', () => {
    expect(CREATE_NOCMT).toMatch(
      /FROM\s+public\.pricing_packages[\s\S]*?WHERE\s+id\s*=\s*p_package_id[\s\S]*?FOR\s+UPDATE/i,
    );
    expect(CREATE_NOCMT).toMatch(/v_amount\s*:=\s*coalesce\(\s*v_pkg\.price/i);
  });

  it('PACKAGE branch: server-enforces that the package belongs to the provider being booked', () => {
    expect(CREATE_NOCMT).toMatch(
      /v_pkg\.provider_id\s+IS\s+DISTINCT\s+FROM\s+p_provider_id/i,
    );
  });

  it('PACKAGE branch: applies NO is_active gate (a listed package stays bookable — behavior preserved)', () => {
    expect(CREATE_NOCMT).not.toMatch(/is_active/i);
  });

  it('NO-PACKAGE branch: honors the customer offer (p_offered_amount) confirming the provider exists, with NO price_min floor', () => {
    expect(CREATE_NOCMT).toMatch(
      /FROM\s+public\.provider_profiles\s+WHERE\s+id\s*=\s*p_provider_id/i,
    );
    expect(CREATE_NOCMT).toMatch(/v_amount\s*:=\s*coalesce\(\s*p_offered_amount/i);
    // The offer is a negotiation: no server floor from provider suggestions.
    expect(CREATE_NOCMT).not.toMatch(/price_min/i);
    expect(CREATE_NOCMT).not.toMatch(/price_max/i);
  });

  it('both branches reject a non-positive amount', () => {
    expect(CREATE_NOCMT).toMatch(/v_amount\s*<=\s*0/);
  });

  it('INSERT forces platform_fee, status=requested and customer_id; never stores package_id or advance/remaining', () => {
    // Financial + identity truth is written by the server, not the caller.
    expect(INSERT_COLUMNS).toContain('customer_id');
    expect(INSERT_COLUMNS).toContain('amount');
    expect(INSERT_COLUMNS).toContain('platform_fee');
    expect(INSERT_COLUMNS).toContain('status');
    // package_id is NOT a real column on public.bookings (old insert bug) — never written.
    expect(INSERT_COLUMNS).not.toContain('package_id');
    // No app path writes these at create.
    expect(INSERT_COLUMNS).not.toContain('advance_amount');
    expect(INSERT_COLUMNS).not.toContain('remaining_amount');
    // platform_fee pinned to 0, status pinned to 'requested'.
    expect(CREATE_NOCMT).toMatch(/'requested'::public\.booking_status/);
  });

  it('is authenticated-only: EXECUTE revoked from PUBLIC/anon, granted to authenticated', () => {
    expect(CREATE_SQL).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_generic_booking[\s\S]*?FROM\s+PUBLIC,\s*anon/i,
    );
    expect(CREATE_SQL).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_generic_booking[\s\S]*?TO\s+authenticated/i,
    );
  });

  it('ships fail-closed $catalog$ drift guard and $verify$ self-check', () => {
    expect(CREATE_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(CREATE_SQL).toMatch(/DO\s+\$verify\$/);
    expect(CREATE_SQL).toMatch(/NOTIFY\s+pgrst/i);
  });

  it('has NO companion accept_* RPC (provider accept/reject is status-only)', () => {
    expect(CREATE_NOCMT).not.toMatch(/accept_generic_booking/i);
  });
});
describe('frontend creation paths route through the RPC (no direct browser INSERT)', () => {
  it('BookingModal.tsx creates via supabase.rpc(create_generic_booking) and no longer inserts into bookings', () => {
    expect(BOOKING_MODAL_TSX).toMatch(/supabase\.rpc\(\s*['"]create_generic_booking['"]/);
    expect(BOOKING_MODAL_TSX).not.toMatch(/\.from\(\s*['"]bookings['"]\s*\)\s*\.insert\(/);
  });

  it('BookingModal.tsx forwards identifiers + package id but sends NO trusted financial/identity keys', () => {
    expect(MODAL_RPC_ARGS).toMatch(/p_provider_id/);
    expect(MODAL_RPC_ARGS).toMatch(/p_package_id/);
    expect(MODAL_RPC_ARGS).toMatch(/p_offered_amount/);
    expect(MODAL_RPC_ARGS).not.toMatch(/platform_fee/i);
    expect(MODAL_RPC_ARGS).not.toMatch(/customer_id/i);
    expect(MODAL_RPC_ARGS).not.toMatch(/\bstatus\b/i);
    // p_package_id is a lookup-only argument (never stored); no amount key is sent.
    expect(MODAL_RPC_ARGS).not.toMatch(/\bamount:/i);
  });

  it('BookingModal.tsx offers an amount ONLY when no package is chosen (package branch is server-authoritative)', () => {
    expect(MODAL_RPC_ARGS).toMatch(
      /p_offered_amount:\s*selectedPackage\s*\?\s*null\s*:/,
    );
  });

  it('useBookings.ts createBooking routes through the RPC (dead path kept safe) and never direct-inserts bookings', () => {
    expect(USE_BOOKINGS_TS).toMatch(/supabase\.rpc\(\s*['"]create_generic_booking['"]/);
    expect(USE_BOOKINGS_TS).not.toMatch(/\.from\(\s*['"]bookings['"]\s*\)\s*\.insert\(/);
  });

  it('useBookings.ts maps the client amount to p_offered_amount (no-package branch)', () => {
    expect(USE_BOOKINGS_RPC_ARGS).toMatch(/p_offered_amount:\s*bookingData\.amount/);
    expect(USE_BOOKINGS_RPC_ARGS).not.toMatch(/platform_fee/i);
    expect(USE_BOOKINGS_RPC_ARGS).not.toMatch(/customer_id/i);
  });
});
describe('parked column lockdown — financial/identity columns un-PATCHable, INSERT RPC-only', () => {
  it('is PARKED with a DO-NOT-push banner and its preconditions (RPC live + frontend rewired)', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+NOT\s+db\s+push\s+YET/i);
    expect(LOCKDOWN_SQL).toMatch(/20261236000000_bookings_server_authoritative\.sql/);
    expect(LOCKDOWN_SQL).toMatch(/BookingModal\.tsx/);
    expect(LOCKDOWN_SQL).toMatch(/useBookings\.ts/);
  });

  it('REVOKEs INSERT + UPDATE from PUBLIC/anon/authenticated and never re-grants INSERT', () => {
    expect(LOCKDOWN_SQL).toMatch(
      /REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.bookings\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    // Only UPDATE is granted back — never INSERT.
    expect(LOCKDOWN_NOCMT).not.toMatch(/GRANT\s+INSERT/i);
  });

  it('grants UPDATE back on EXACTLY the 26 benign lifecycle columns', () => {
    expect(grantedUpdateColumns.slice().sort()).toEqual(BENIGN_COLS.slice().sort());
    expect(grantedUpdateColumns).toHaveLength(26);
  });

  it('never grants UPDATE on any of the 8 protected financial/identity columns', () => {
    for (const col of PROTECTED_COLS) {
      expect(grantedUpdateColumns).not.toContain(col);
    }
  });

  it('classifies all 4 financial amounts as protected and status/event_date as benign', () => {
    for (const fin of ['amount', 'advance_amount', 'remaining_amount', 'platform_fee']) {
      expect(PROTECTED_COLS).toContain(fin);
    }
    expect(BENIGN_COLS).toContain('status');
    expect(BENIGN_COLS).toContain('event_date');
  });

  it('protected + benign lists are disjoint and cover all 34 live columns', () => {
    const overlap = PROTECTED_COLS.filter((c) => BENIGN_COLS.includes(c));
    expect(overlap).toEqual([]);
    expect(PROTECTED_COLS.length + BENIGN_COLS.length).toBe(34);
  });

  it('ships fail-closed $catalog$ split guard and a $probe$ that assumes the authenticated role', () => {
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$catalog\$/);
    expect(LOCKDOWN_SQL).toMatch(/DO\s+\$probe\$/);
    expect(LOCKDOWN_SQL).toMatch(/SET\s+LOCAL\s+ROLE\s+authenticated/i);
    expect(LOCKDOWN_SQL).toMatch(/has_table_privilege\(\s*'authenticated'[\s\S]*?'INSERT'\s*\)/i);
  });

  it('$catalog$ declares the same 8 protected / 26 benign split this test asserts', () => {
    for (const col of PROTECTED_COLS) {
      expect(LOCKDOWN_SQL).toMatch(new RegExp(`'${col}'`));
    }
    for (const col of BENIGN_COLS) {
      expect(LOCKDOWN_SQL).toMatch(new RegExp(`'${col}'`));
    }
  });
});
