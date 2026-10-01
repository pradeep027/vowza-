/**
 * Server-authoritative price on the legacy add_artist_to_event RPC path
 * (SECURITY FIX + BEHAVIOR PRESERVATION).
 *
 * THE GAP: 20261246000000 (P0-L) closed the authz hole on add_artist_to_event
 * (auth + event-ownership) but documented that p_price was STILL browser-supplied
 * and inserted directly into artist_bookings.price. Because the function is
 * SECURITY DEFINER (bypasses RLS), an event-owner could attach a real provider at
 * any price (e.g. 0).
 *
 * THE FIX (migration 20261248000000): CREATE OR REPLACE add_artist_to_event with
 * the SAME signature but derive the price from provider_profiles.price_min for
 * p_provider_id and INSERT that server value, ignoring p_price. The honest client
 * (EventPlanning -> useArtists) already sends exactly provider_profiles.price_min
 * (`?? 0`), so legitimate bookings are unchanged; only a tampered price is closed.
 *
 * WHAT THIS TEST LOCKS: a STATIC contract regression (no network / DB). Runtime
 * enforcement is proven at APPLY time by the embedded price-override probe. Here
 * we lock the server-derived shape, that p_price is NOT the inserted value, the
 * preserved authz guard, the preserved grant lock, and that both probes are
 * present, so the restored price authority cannot silently regress.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const abs = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const repoFile = (rel: string) => readFileSync(abs(rel), 'utf8');

const MIGRATION = repoFile(
  'supabase/migrations/20261248000000_add_artist_to_event_server_authoritative_price.sql',
);
// Comment-stripped view for negative "token must be absent" probes.
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, '');

describe('add_artist_to_event price authority — on the apply path', () => {
  it('lives in supabase/migrations/ (apply path), wrapped BEGIN/COMMIT + schema reload', () => {
    expect(abs('supabase/migrations/20261248000000_add_artist_to_event_server_authoritative_price.sql'))
      .toContain('migrations');
    expect(MIGRATION).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(MIGRATION).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });

  it('re-creates the function with its EXACT legacy signature (call site unchanged)', () => {
    expect(MIGRATION).toMatch(
      /CREATE OR REPLACE FUNCTION public\.add_artist_to_event\(\s*p_event_id\s+UUID,\s*p_provider_id\s+UUID,\s*p_provider_name\s+TEXT,\s*p_category\s+TEXT,\s*p_price\s+INTEGER\s*\)/,
    );
    expect(MIGRATION).toMatch(/SECURITY DEFINER/);
    expect(MIGRATION).toMatch(/SET search_path = public, pg_temp/);
  });
});

describe('add_artist_to_event price authority — price is server-derived', () => {
  it('derives the price from provider_profiles.price_min for p_provider_id', () => {
    expect(MIGRATION).toMatch(
      /SELECT COALESCE\(pp\.price_min, 0\), TRUE\s*INTO v_price, v_found\s*FROM public\.provider_profiles pp\s*WHERE pp\.id = p_provider_id/,
    );
  });

  it('INSERTs the server value v_price, NOT the browser-supplied p_price', () => {
    // The INSERT ... VALUES tuple must bind v_price, and must not bind p_price.
    const insertMatch = MIGRATION_SQL.match(
      /INSERT INTO public\.artist_bookings[\s\S]*?VALUES\s*\(([\s\S]*?)\)\s*RETURNING id INTO v_booking_id/,
    );
    expect(insertMatch, 'INSERT INTO artist_bookings not found').toBeTruthy();
    const valuesTuple = insertMatch![1];
    expect(valuesTuple).toContain('v_price');
    expect(valuesTuple).not.toContain('p_price');
  });

  it('fails closed (42501) when the provider does not exist', () => {
    expect(MIGRATION).toMatch(/IF NOT v_found THEN/);
    expect(MIGRATION).toMatch(/provider % does not exist[\s\S]*?USING ERRCODE = '42501'/);
  });

  it('surfaces a tamper attempt (p_price <> v_price) as a non-fatal NOTICE, not a hard reject', () => {
    expect(MIGRATION).toMatch(/IF p_price IS DISTINCT FROM v_price THEN\s*RAISE NOTICE/);
    // It must NOT raise an exception on the mismatch (stale-but-honest client).
    expect(MIGRATION).not.toMatch(/IF p_price IS DISTINCT FROM v_price THEN\s*RAISE EXCEPTION/);
  });
});

describe('add_artist_to_event price authority — authz + grant lock preserved', () => {
  it('keeps the P0-L auth.uid() + event-ownership guard', () => {
    expect(MIGRATION).toMatch(/v_uid\s+UUID := auth\.uid\(\)/);
    expect(MIGRATION).toMatch(/authentication required[\s\S]*?USING ERRCODE = '42501'/);
    expect(MIGRATION).toMatch(
      /SELECT 1 FROM public\.event_bookings\s*WHERE id = p_event_id\s*AND customer_id = v_uid/,
    );
    expect(MIGRATION).toMatch(/is not owned by the caller[\s\S]*?USING ERRCODE = '42501'/);
  });

  it('re-asserts REVOKE from PUBLIC/anon + GRANT only to authenticated/service_role', () => {
    expect(MIGRATION).toMatch(
      /REVOKE ALL ON FUNCTION public\.add_artist_to_event\(uuid, uuid, text, text, integer\) FROM PUBLIC, anon/,
    );
    expect(MIGRATION).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.add_artist_to_event\(uuid, uuid, text, text, integer\) TO authenticated, service_role/,
    );
    expect(MIGRATION).toMatch(/has_function_privilege\('anon'/);
  });
});

describe('add_artist_to_event price authority — executable apply-time probes', () => {
  it('includes an anon-denied probe and a positive price-override probe', () => {
    expect(MIGRATION).toMatch(/SET LOCAL ROLE anon;/);
    expect(MIGRATION).toMatch(/PROBE_FAIL: anon add_artist_to_event was NOT rejected/);
    // Positive probe: tampered price in, authoritative price_min out.
    expect(MIGRATION).toMatch(/v_tamper := v_pmin \+ 1000000/);
    expect(MIGRATION).toMatch(/stored price % != authoritative price_min %/);
    expect(MIGRATION).toMatch(/ROLLBACK_POSITIVE_PROBE/);
    // Empty-DB conditional skip.
    expect(MIGRATION).toMatch(/probe B SKIPPED/);
  });
});
