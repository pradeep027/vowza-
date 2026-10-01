/**
 * P0 Phase E — SECURITY FIX regression for server-authoritative advance payment.
 *
 * Before this, the "Pay 20% Advance" flow ran in the browser: both
 * src/pages/MyBookings.tsx::handlePayAdvance and the inline onClick in
 * src/pages/customer/MyBookingsPage.tsx raw-UPDATEd the booking row
 * (advance_paid_at / confirmed_at / calendar_locked / status='in_progress')
 * with a client-computed advance, and never persisted advance_amount. Any
 * signed-in user who could UPDATE the row could flip those lifecycle flags out
 * of order, on an unaccepted booking, or as the wrong party.
 *
 * 20261243000000 moves the whole step into a hardened SECURITY DEFINER RPC,
 * public.pay_booking_advance(p_booking_id uuid, p_booking_source text) RETURNS
 * numeric; both call sites now pass ONLY the booking id + source.
 *
 * STATIC / CONTRACT regression (no database): assert the server derives every
 * authoritative value and binds the caller to the customer. Real Postgres
 * behaviour is proven at APPLY time by the migration's $catalog$/$verify$.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const SQL = repoFile(
  'supabase/migrations/20261243000000_pay_booking_advance_authoritative.sql',
);
const MYBOOKINGS = repoFile('src/pages/MyBookings.tsx');
const MYBOOKINGSPAGE = repoFile('src/pages/customer/MyBookingsPage.tsx');
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');
const NOCMT = stripComments(SQL);
// handlePayAdvance body only, so client assertions can't be satisfied by the
// unrelated cancel/reschedule raw-updates later in the file.
const PAY_FN = MYBOOKINGS.slice(
  MYBOOKINGS.indexOf('const handlePayAdvance'),
  MYBOOKINGS.indexOf('const handleConfirmCancel'),
);
describe('pay_booking_advance — hardening + least privilege', () => {
  it('is a SECURITY DEFINER function with an empty, hardened search_path returning numeric', () => {
    expect(SQL).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.pay_booking_advance\s*\(\s*p_booking_id\s+uuid\s*,\s*p_booking_source\s+text\s*\)/i,
    );
    expect(SQL).toMatch(/RETURNS\s+numeric/i);
    expect(SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('takes ONLY the booking id + source — no amount / advance / ownership parameters', () => {
    const sig = SQL.match(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.pay_booking_advance\s*\(([\s\S]*?)\)\s*RETURNS/i,
    );
    expect(sig).not.toBeNull();
    const params = sig![1];
    expect(params).not.toMatch(/amount|advance|fee|earning|vendor_id|provider|customer/i);
  });

  it('is authenticated-only: revokes PUBLIC + anon and grants EXECUTE to authenticated', () => {
    expect(NOCMT).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.pay_booking_advance\([^)]*\)\s+FROM\s+PUBLIC/i);
    expect(NOCMT).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.pay_booking_advance\([^)]*\)\s+FROM\s+anon/i);
    expect(NOCMT).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.pay_booking_advance\([^)]*\)\s+TO\s+authenticated/i);
  });
});

describe('pay_booking_advance — server derives everything, client supplies nothing', () => {
  it('resolves the table + provider/amount columns from a FIXED whitelist, unknown source -> 22023', () => {
    expect(NOCMT).toMatch(/WHEN\s+'generic'[\s\S]*?v_table\s*:=\s*'bookings'[\s\S]*?v_acol\s*:=\s*'amount'/i);
    expect(NOCMT).toMatch(/WHEN\s+'photography'[\s\S]*?v_pcol\s*:=\s*'photographer_id'/i);
    expect(NOCMT).toMatch(/Unknown booking source[\s\S]*?ERRCODE\s*=\s*'22023'/i);
  });

  it('reads the authoritative amount/customer/status from the stored row, locked FOR UPDATE', () => {
    expect(NOCMT).toMatch(/EXECUTE\s+format\(/i);
    expect(NOCMT).toMatch(/FROM\s+public\.%I\s+WHERE\s+id\s*=\s*\$1\s+FOR\s+UPDATE/i);
    expect(NOCMT).toMatch(/INTO\s+v_status,\s*v_customer_id,[\s\S]*?v_amount,\s*v_advance_at/i);
  });

  it('authorizes the caller as the booking CUSTOMER else 42501', () => {
    expect(NOCMT).toMatch(/v_uid\s+uuid\s*:=\s*auth\.uid\(\)/i);
    expect(NOCMT).toMatch(/v_customer_id\s+IS\s+DISTINCT\s+FROM\s+v_uid[\s\S]*?ERRCODE\s*=\s*'42501'/i);
  });
  it('server-derives the advance as 20% and persists it + the lifecycle flags + status', () => {
    expect(NOCMT).toMatch(/v_advance\s*:=\s*round\(\s*v_amount\s*\*\s*0\.2\s*\)/i);
    expect(NOCMT).toMatch(/advance_amount\s*=\s*\$1,\s*advance_paid_at\s*=\s*now\(\),\s*confirmed_at\s*=\s*now\(\),\s*calendar_locked\s*=\s*true,\s*status\s*=/i);
    expect(NOCMT).toMatch(/status\s*=\s*%L::public\.booking_status/i);
  });
});

describe('pay_booking_advance — idempotency, state guard, drift guard', () => {
  it('is idempotent: an already-paid advance returns without re-writing', () => {
    expect(NOCMT).toMatch(/IF\s+v_advance_at\s+IS\s+NOT\s+NULL\s+THEN[\s\S]*?RETURN\s+round/i);
  });

  it('requires an accepted booking (55000) and a valid amount (22023)', () => {
    expect(NOCMT).toMatch(/v_status\s*<>\s*'accepted'[\s\S]*?ERRCODE\s*=\s*'55000'/i);
    expect(NOCMT).toMatch(/v_amount\s+IS\s+NULL\s+OR\s+v_amount\s*<\s*0[\s\S]*?ERRCODE\s*=\s*'22023'/i);
  });

  it('ships a fail-closed $catalog$ drift guard + $verify$ self-check and reloads PostgREST', () => {
    expect(SQL).toMatch(/DO\s+\$catalog\$/);
    expect(SQL).toMatch(/ABORT\s+pay_booking_advance/i);
    expect(SQL).toMatch(/DO\s+\$verify\$/);
    expect(NOCMT).toMatch(/has_function_privilege\(\s*'anon'/i);
    expect(SQL).toMatch(/NOTIFY\s+pgrst/i);
  });
});

describe('pay-advance clients — pass id + source only, no raw lifecycle write', () => {
  it('MyBookings.handlePayAdvance invokes the RPC with exactly p_booking_id + p_booking_source', () => {
    expect(PAY_FN).toMatch(/supabase\.rpc\(\s*'pay_booking_advance'/i);
    expect(PAY_FN).toMatch(/p_booking_id:\s*booking\.id/);
    expect(PAY_FN).toMatch(/p_booking_source:\s*booking\._source/);
  });

  it('MyBookings.handlePayAdvance no longer raw-updates the lifecycle flags from the browser', () => {
    expect(PAY_FN).not.toMatch(/\.update\(/);
    expect(PAY_FN).not.toMatch(/advance_paid_at|calendar_locked|status:\s*'in_progress'/);
  });

  it('MyBookingsPage pay-advance invokes the RPC and drops the raw table update', () => {
    expect(MYBOOKINGSPAGE).toMatch(/supabase\.rpc\(\s*'pay_booking_advance'/i);
    expect(MYBOOKINGSPAGE).toMatch(/p_booking_source:\s*booking\._source/);
    expect(MYBOOKINGSPAGE).not.toMatch(/advance_paid_at:\s*new Date\(\)\.toISOString\(\)/);
    expect(MYBOOKINGSPAGE).not.toMatch(/calendar_locked:\s*true/);
  });
});

