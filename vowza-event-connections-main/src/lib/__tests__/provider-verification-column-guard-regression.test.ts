/**
 * P0 Phase F — SECURITY FIX regression for the provider trust-column guard.
 *
 * The admin-approval + vendor-resubmit flows were already routed through the
 * SECURITY DEFINER RPCs (admin_set_provider_verification /
 * provider_resubmit_for_review, 20261204000000), and the comprehensive
 * column-privilege lockdown exists — but is PARKED (breaking) in
 * supabase/migrations-pending/PHASE_provider_column_lockdown.sql. Until that
 * lands, a signed-in vendor can still bypass the frontend and PATCH their OWN
 * provider_profiles row to verification_status='approved' / is_verified=true /
 * is_published=true / is_featured=true / the KYC + reputation columns, because
 * the owner RLS UPDATE policy + table-wide UPDATE grant permit it.
 *
 * 20261244000000 closes that hole ADDITIVELY with a BEFORE UPDATE trigger,
 * public.provider_profiles_guard_trust_columns, that rejects (42501) any change
 * to the guarded columns unless it comes from an authorized path (service /
 * NULL-uid context, an admin via has_role, or the exact owner resubmit
 * rejected->pending transition). It revokes nothing, so legitimate profile
 * edits are untouched and the breaking lockdown stays parked.
 *
 * STATIC / CONTRACT regression (no database): assert the trigger's authority
 * matrix. Real Postgres behaviour is proven at APPLY time by the migration's
 * own $catalog$/$verify$.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');
const repoDir = (rel: string) =>
  readdirSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)));

const SQL = repoFile(
  'supabase/migrations/20261244000000_provider_verification_column_guard.sql',
);
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');
const NOCMT = stripComments(SQL);

// Columns the trigger's fast path compares OLD vs NEW (is_bank_verified is
// handled specially — guarded only on the ->true edge — so it is listed apart).
const GUARDED = [
  'verification_status', 'is_verified', 'is_published', 'is_featured',
  'featured_until', 'verified_at', 'verified_by',
  'aadhaar_status', 'aadhaar_verified_at', 'pan_status', 'pan_verified_at',
  'govt_id_status', 'govt_id_verified_at', 'liveness_verified',
  'liveness_verified_at', 'liveness_session_id', 'liveness_provider',
  'liveness_attempts', 'doc_verification_notes', 'average_rating',
  'total_reviews', 'total_bookings',
];

describe('provider trust-column guard — trigger shape', () => {
  it('is a plpgsql trigger fn with a hardened search_path that binds auth.uid()', () => {
    expect(SQL).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.provider_profiles_guard_trust_columns\s*\(\s*\)\s*[\s\S]*?RETURNS\s+trigger/i,
    );
    expect(SQL).toMatch(/LANGUAGE\s+plpgsql/i);
    expect(SQL).toMatch(/SET\s+search_path\s*=\s*public,\s*pg_temp/i);
    expect(NOCMT).toMatch(/v_uid\s+uuid\s*:=\s*auth\.uid\(\)/i);
  });

  it('installs a BEFORE UPDATE FOR EACH ROW trigger idempotently', () => {
    expect(NOCMT).toMatch(
      /DROP\s+TRIGGER\s+IF\s+EXISTS\s+provider_profiles_guard_trust_columns\s+ON\s+public\.provider_profiles/i,
    );
    expect(NOCMT).toMatch(
      /CREATE\s+TRIGGER\s+provider_profiles_guard_trust_columns\s+BEFORE\s+UPDATE\s+ON\s+public\.provider_profiles\s+FOR\s+EACH\s+ROW/i,
    );
  });

  it('ships a fail-closed $catalog$ drift guard + $verify$ self-check and reloads PostgREST', () => {
    expect(SQL).toMatch(/DO\s+\$catalog\$/);
    expect(SQL).toMatch(/ABORT provider_verification_column_guard/i);
    expect(SQL).toMatch(/DO\s+\$verify\$/);
    expect(NOCMT).toMatch(/tgtype\s*&\s*2/); // BEFORE bit
    expect(NOCMT).toMatch(/tgtype\s*&\s*16/); // ROW-level bit
    expect(SQL).toMatch(/COMMIT;/i);
    expect(SQL).toMatch(/NOTIFY\s+pgrst/i);
  });
});

describe('provider trust-column guard — guards the trust columns', () => {
  it('fast-path compares every guarded verification/approval/KYC/reputation column', () => {
    for (const col of GUARDED) {
      expect(
        NOCMT,
        `${col} must be compared OLD vs NEW in the guard`,
      ).toMatch(new RegExp(`NEW\\.${col}\\s+IS\\s+NOT\\s+DISTINCT\\s+FROM\\s+OLD\\.${col}`, 'i'));
    }
  });

  it('guards is_bank_verified only on the ->true edge (a ->false downgrade stays allowed)', () => {
    expect(NOCMT).toMatch(/NEW\.is_bank_verified\s+IS\s+DISTINCT\s+FROM\s+OLD\.is_bank_verified/i);
    expect(NOCMT).toMatch(/COALESCE\(\s*NEW\.is_bank_verified\s*,\s*false\s*\)\s*=\s*true/i);
  });

  it('rejects an unauthorized guarded-column change with 42501 and names the RPCs', () => {
    expect(NOCMT).toMatch(/RAISE\s+EXCEPTION[\s\S]*?USING\s+ERRCODE\s*=\s*'42501'/i);
    expect(SQL).toMatch(/not directly writable/i);
    expect(SQL).toMatch(/admin_set_provider_verification\s*\/\s*provider_resubmit_for_review/i);
  });

  it("$catalog$ enumerates the guarded columns + has_role so a rename aborts the apply", () => {
    const arr = NOCMT.match(/v_cols\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\]/i);
    expect(arr).not.toBeNull();
    const listed = [...arr![1].matchAll(/'([a-z0-9_]+)'/gi)].map((m) => m[1]);
    for (const col of [...GUARDED, 'is_bank_verified']) {
      expect(listed, `${col} must be drift-checked`).toContain(col);
    }
    expect(NOCMT).toMatch(/has_role/i);
  });
});

describe('provider trust-column guard — authorized paths carved out', () => {
  it('allows a trusted non-session context (auth.uid() IS NULL -> service_role / definers)', () => {
    expect(NOCMT).toMatch(/IF\s+v_uid\s+IS\s+NULL\s+THEN\s+RETURN\s+NEW\s*;/i);
  });

  it('allows an admin / super_admin via public.has_role', () => {
    expect(NOCMT).toMatch(
      /public\.has_role\(\s*v_uid\s*,\s*'admin'\s*\)\s*OR\s+public\.has_role\(\s*v_uid\s*,\s*'super_admin'\s*\)/i,
    );
  });

  it('allows ONLY the owner resubmit transition rejected -> pending, nothing broader', () => {
    const slice = NOCMT.slice(
      NOCMT.indexOf("OLD.verification_status = 'rejected'"),
    );
    expect(NOCMT).toMatch(/OLD\.verification_status\s*=\s*'rejected'/i);
    expect(slice).toMatch(/NEW\.verification_status\s*=\s*'pending'/i);
    // the carve-out must hold every OTHER guarded column constant
    for (const col of ['is_verified', 'is_published', 'is_featured', 'verified_by', 'average_rating']) {
      expect(slice.slice(0, slice.indexOf('RETURN NEW'))).toMatch(
        new RegExp(`NEW\\.${col}\\s+IS\\s+NOT\\s+DISTINCT\\s+FROM\\s+OLD\\.${col}`, 'i'),
      );
    }
  });
});

describe('provider trust-column guard — additive, breaking lockdown stays parked', () => {
  it('is additive: no REVOKE and no table-wide UPDATE grant in this migration', () => {
    expect(NOCMT).not.toMatch(/\bREVOKE\b/i);
    expect(NOCMT).not.toMatch(/GRANT\s+UPDATE\s+ON\s+public\.provider_profiles/i);
  });

  it('leaves the breaking column lockdown parked in migrations-pending/, not promoted', () => {
    const pending = repoDir('supabase/migrations-pending');
    expect(pending).toContain('PHASE_provider_column_lockdown.sql');
    const promoted = repoDir('supabase/migrations').filter((f) => /column_lockdown/i.test(f));
    expect(promoted).toEqual([]);
  });
});
