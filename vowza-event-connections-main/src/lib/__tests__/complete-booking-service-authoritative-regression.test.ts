/**
 * P0 Phase D — SECURITY FIX regression for server-authoritative service
 * completion + settlement.
 *
 * Before this, src/services/bookingExecutionService.ts::completeService ran in
 * the browser: it accepted a client-passed bookingAmount AND platformFeeRate and
 * raw-inserted a vendor_settlements row with those values, so a vendor could
 * inflate booking_amount / vendor_earnings or zero the fee and fabricate the
 * payout (the authenticated_insert_settlements RLS policy lets ANY authenticated
 * user insert ANY settlement).
 *
 * 20261242000000 moves the whole completion + settlement into one hardened
 * SECURITY DEFINER RPC, public.complete_booking_service(p_booking_id uuid,
 * p_booking_source text) RETURNS uuid; completeService now passes ONLY the
 * booking id + source.
 *
 * STATIC / CONTRACT regression (no database): assert the server derives every
 * authoritative value and the client supplies none. Real Postgres behaviour is
 * proven at APPLY time by the migration's own $catalog$/$verify$ blocks.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const SQL = repoFile(
  'supabase/migrations/20261242000000_complete_booking_service_authoritative.sql',
);
const CLIENT = repoFile('src/services/bookingExecutionService.ts');
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');
const NOCMT = stripComments(SQL);
// completeService body only, so client assertions can't be satisfied by the
// unrelated OTP helpers earlier in the file.
const COMPLETE_FN = CLIENT.slice(CLIENT.indexOf('export async function completeService'));

describe('complete_booking_service — hardening + least privilege', () => {
  it('is a SECURITY DEFINER function with an empty, hardened search_path returning uuid', () => {
    expect(SQL).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.complete_booking_service\s*\(\s*p_booking_id\s+uuid\s*,\s*p_booking_source\s+text\s*\)/i,
    );
    expect(SQL).toMatch(/RETURNS\s+uuid/i);
    expect(SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('takes ONLY the booking id + source — no amount / fee / ownership parameters', () => {
    const sig = SQL.match(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.complete_booking_service\s*\(([\s\S]*?)\)\s*RETURNS/i,
    );
    expect(sig).not.toBeNull();
    const params = sig![1];
    expect(params).not.toMatch(/amount|fee|earning|vendor_id|provider|customer/i);
  });

  it('is authenticated-only: revokes PUBLIC + anon and grants EXECUTE to authenticated', () => {
    expect(NOCMT).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.complete_booking_service\([^)]*\)\s+FROM\s+PUBLIC/i);
    expect(NOCMT).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.complete_booking_service\([^)]*\)\s+FROM\s+anon/i);
    expect(NOCMT).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.complete_booking_service\([^)]*\)\s+TO\s+authenticated/i);
  });
});

describe('complete_booking_service — server derives everything, client supplies nothing', () => {
  it('resolves the table + provider/amount columns from a FIXED whitelist, unknown source -> 22023', () => {
    // Fixed CASE arms, never client-supplied SQL. Spot-check the two shapes.
    expect(NOCMT).toMatch(/WHEN\s+'generic'[\s\S]*?v_table\s*:=\s*'bookings'[\s\S]*?v_acol\s*:=\s*'amount'/i);
    expect(NOCMT).toMatch(/WHEN\s+'photography'[\s\S]*?v_pcol\s*:=\s*'photographer_id'/i);
    expect(NOCMT).toMatch(/Unknown booking source[\s\S]*?ERRCODE\s*=\s*'22023'/i);
  });

  it('reads the authoritative amount/provider/customer from the stored row, locked FOR UPDATE', () => {
    expect(NOCMT).toMatch(/EXECUTE\s+format\(/i);
    expect(NOCMT).toMatch(/FROM\s+public\.%I\s+WHERE\s+id\s*=\s*\$1\s+FOR\s+UPDATE/i);
    // The money comes from the row (v_amount), never from a parameter.
    expect(NOCMT).toMatch(/INTO\s+v_status,\s*v_work_completed,\s*v_customer_id,\s*v_provider_id,\s*v_amount/i);
  });

  it('authorizes the caller as the booking provider via provider_profiles else 42501', () => {
    expect(NOCMT).toMatch(/v_uid\s+uuid\s*:=\s*auth\.uid\(\)/i);
    expect(NOCMT).toMatch(
      /FROM\s+public\.provider_profiles\s+pp[\s\S]*?pp\.id\s*=\s*v_provider_id\s+AND\s+pp\.user_id\s*=\s*v_uid/i,
    );
    expect(NOCMT).toMatch(/not authorized to complete this service[\s\S]*?ERRCODE\s*=\s*'42501'/i);
  });

  it('derives the platform fee from platform_settings (percentage / fixed / disabled)', () => {
    expect(NOCMT).toMatch(/FROM\s+public\.platform_settings\s+WHERE\s+key\s*=\s*'platform_fee'/i);
    expect(NOCMT).toMatch(/v_platform_fee\s*:=\s*round\(\s*v_amount\s*\*\s*v_fee_rate\s*\/\s*100\s*\)/i);
    expect(NOCMT).toMatch(/v_vendor_earnings\s*:=\s*v_amount\s*-\s*v_platform_fee/i);
  });

  it('writes the settlement with server identity: vendor_user_id = v_uid, vendor_id = v_provider_id', () => {
    expect(NOCMT).toMatch(/INSERT\s+INTO\s+public\.vendor_settlements/i);
    expect(NOCMT).toMatch(/v_provider_id::text,\s*v_uid,\s*v_customer_id/i);
  });
});

describe('complete_booking_service — idempotency, state guard, drift guard', () => {
  it('is idempotent: an existing settlement for the booking is returned, not duplicated', () => {
    expect(NOCMT).toMatch(/SELECT\s+id\s+INTO\s+v_existing[\s\S]*?FROM\s+public\.vendor_settlements[\s\S]*?booking_id\s*=\s*p_booking_id\s+AND\s+booking_table\s*=\s*v_table/i);
    expect(NOCMT).toMatch(/IF\s+v_existing\s+IS\s+NOT\s+NULL\s+THEN[\s\S]*?RETURN\s+v_existing/i);
  });

  it('requires in_progress + not-yet-completed (55000) and a valid amount (22023)', () => {
    expect(NOCMT).toMatch(/v_work_completed\s+IS\s+NOT\s+NULL[\s\S]*?ERRCODE\s*=\s*'55000'/i);
    expect(NOCMT).toMatch(/v_status\s*<>\s*'in_progress'[\s\S]*?ERRCODE\s*=\s*'55000'/i);
    expect(NOCMT).toMatch(/v_amount\s+IS\s+NULL\s+OR\s+v_amount\s*<\s*0[\s\S]*?ERRCODE\s*=\s*'22023'/i);
  });

  it('ships a fail-closed $catalog$ drift guard + $verify$ self-check and reloads PostgREST', () => {
    expect(SQL).toMatch(/DO\s+\$catalog\$/);
    expect(SQL).toMatch(/vendor_settlements\.%\s*missing|ABORT\s+complete_booking_service/i);
    expect(SQL).toMatch(/DO\s+\$verify\$/);
    expect(NOCMT).toMatch(/has_function_privilege\(\s*'anon'/i);
    expect(SQL).toMatch(/NOTIFY\s+pgrst/i);
  });
});

describe('completeService client — passes id + source only, no authoritative values', () => {
  it('invokes the RPC with exactly p_booking_id + p_booking_source', () => {
    expect(COMPLETE_FN).toMatch(/supabase\.rpc\(\s*'complete_booking_service'/i);
    expect(COMPLETE_FN).toMatch(/p_booking_id:\s*bookingId/);
    expect(COMPLETE_FN).toMatch(/p_booking_source:\s*bookingSource/);
  });

  it('sends no amount / fee / earnings / ownership value from the browser', () => {
    expect(COMPLETE_FN).not.toMatch(/booking_amount|platform_fee|vendor_earnings|bookingAmount|platformFeeRate|vendor_id|vendor_user_id/i);
  });
});
