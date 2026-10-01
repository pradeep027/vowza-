/**
 * P0 Phase C — booking state machine ACTOR BINDING. The DAG guards say which
 * status transitions are legal; this layer says WHO may perform each legal edge,
 * closing the customer-self-approve / customer-self-complete holes RLS left open.
 *
 * STATIC / CONTRACT regression (no database): assert the shared actor helper's
 * per-edge authorization, that both validators consult it after the DAG check
 * and raise 42501 when unauthorized, and that the service_role/admin bypass
 * stays ahead of both checks. Real Postgres behaviour is proven at APPLY time by
 * the migration's own $catalog$/$verify$ blocks.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const SQL = repoFile(
  'supabase/migrations/20261240000000_booking_status_transition_actor_binding.sql',
);
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');
const NOCMT = stripComments(SQL);

/** Body of the actor helper's `IF p_to = 'X' THEN RETURN <expr>` branch. */
const actorRule = (toStatus: string): string => {
  const m = NOCMT.match(
    new RegExp(`p_to\\s*=\\s*'${toStatus}'\\s+THEN\\s+RETURN\\s+([^;]+);`, 'i'),
  );
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
};

describe('actor helper — hardened and per-edge authorization', () => {
  it('is a STABLE SECURITY DEFINER helper with a hardened empty search_path', () => {
    expect(SQL).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.booking_transition_actor_allowed\s*\(\s*[\s\S]*?uuid[\s\S]*?text[\s\S]*?\)/i,
    );
    expect(NOCMT).toMatch(/STABLE/i);
    expect(SQL).toMatch(/SECURITY\s+DEFINER/i);
    expect(SQL).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('derives is_provider from provider_profiles(id, user_id) and is_customer from customer_id', () => {
    expect(NOCMT).toMatch(
      /FROM\s+public\.provider_profiles\s+pp\s+WHERE\s+pp\.id\s*=\s*p_provider_id\s+AND\s+pp\.user_id\s*=\s*v_uid/i,
    );
    expect(NOCMT).toMatch(/v_uid\s*=\s*p_customer_id/i);
  });

  it('binds accept / reject / complete to the PROVIDER only', () => {
    expect(actorRule('accepted')).toBe('is_provider');
    expect(actorRule('rejected')).toBe('is_provider');
    expect(actorRule('completed')).toBe('is_provider');
  });

  it('allows either party to pay-advance (in_progress) or cancel', () => {
    expect(actorRule('in_progress')).toBe('is_customer OR is_provider');
    expect(actorRule('cancelled')).toBe('is_customer OR is_provider');
  });
});

describe('both validators consult the actor helper after the DAG check', () => {
  it('re-defines both trigger functions', () => {
    expect(SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_bookings_status_transition/i);
    expect(SQL).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_category_booking_status_transition/i);
  });

  it('calls booking_transition_actor_allowed and raises 42501 when unauthorized', () => {
    const calls = NOCMT.match(/public\.booking_transition_actor_allowed\(/gi) ?? [];
    // once in each of the two trigger functions.
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(NOCMT).toMatch(/Not authorized to change booking status/i);
    expect(NOCMT).toMatch(/ERRCODE\s*=\s*'42501'/);
  });

  it('generic validator passes enum status as text; category passes text directly', () => {
    // generic: v_old::text / v_new::text
    expect(NOCMT).toMatch(/booking_transition_actor_allowed\(\s*OLD\.customer_id,\s*OLD\.provider_id,\s*v_old::text,\s*v_new::text\s*\)/i);
    // category: v_old / v_new (already text)
    expect(NOCMT).toMatch(/booking_transition_actor_allowed\(\s*OLD\.customer_id,\s*OLD\.provider_id,\s*v_old,\s*v_new\s*\)/i);
  });
});

describe('bypass ordering and self-checks', () => {
  it('keeps the no-op + service_role(null uid) + admin bypass ahead of the DAG and actor checks', () => {
    expect(NOCMT).toMatch(/v_new\s+IS\s+NOT\s+DISTINCT\s+FROM\s+v_old/i);
    expect(NOCMT).toMatch(/auth\.uid\(\)\s+IS\s+NULL\s+OR\s+public\.has_role\(\s*auth\.uid\(\)\s*,\s*'admin'::public\.app_role\)/i);
    // The bypass block must appear before the first DAG raise in the file.
    const bypassIdx = NOCMT.search(/auth\.uid\(\)\s+IS\s+NULL/i);
    const dagRaiseIdx = NOCMT.search(/Illegal booking status transition/i);
    expect(bypassIdx).toBeGreaterThan(0);
    expect(bypassIdx).toBeLessThan(dagRaiseIdx);
  });

  it('ships fail-closed $catalog$ + $verify$ and reloads PostgREST', () => {
    expect(SQL).toMatch(/DO\s+\$catalog\$/);
    expect(SQL).toMatch(/DO\s+\$verify\$/);
    expect(SQL).toMatch(/NOTIFY\s+pgrst/i);
  });
});
