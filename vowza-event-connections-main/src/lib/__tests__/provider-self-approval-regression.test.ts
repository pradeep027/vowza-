/**
 * P0-2 — provider self-approval prevention (regression guard).
 *
 * These are STATIC / CONTRACT regressions that run under `npm test` with no
 * database. They do NOT replace the behavioural DB proof — that lives in the
 * migrations and runs at apply time against a real Postgres:
 *
 *   supabase/migrations-pending/PHASE_provider_column_lockdown.sql
 *     $catalog$  proves the column-privilege matrix (drift / overlap /
 *                protected-locked / benign-writable) against the LIVE table.
 *     $probe$    impersonates `authenticated` and proves a direct PATCH of a
 *                protected column is denied (42501) while a benign column is
 *                allowed — mandated cases 1-6.
 *   supabase/migrations/20261204000000_provider_verification_authority.sql
 *     proves admin approve/reject succeed and any non-admin caller is denied
 *     — mandated cases 7-9 — via the has_role / ownership gates in the RPCs.
 *
 * What THIS file guards, on every CI run and BEFORE the parked migration is
 * ever pushed, is that nobody edits the lockdown so a protected/approval column
 * is handed back to `authenticated`, and that the frontend keeps routing every
 * protected-column write through the SECURITY DEFINER RPCs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

const LOCKDOWN_SQL = repoFile('supabase/migrations-pending/PHASE_provider_column_lockdown.sql');
const AUTHORITY_SQL = repoFile('supabase/migrations/20261204000000_provider_verification_authority.sql');
const APPROVAL_TS = repoFile('src/services/approvalService.ts');
const ADMIN_TSX = repoFile('src/pages/AdminDashboard.tsx');
const VENDOR_EDIT_TSX = repoFile('src/pages/VendorEditProfile.tsx');
const VENDOR_DATA_TS = repoFile('src/hooks/useVendorData.ts');

/**
 * The authoritative live column set of public.provider_profiles (69), captured
 * by read-only prod introspection. The migration's own $catalog$ drift guard
 * re-checks this against the live table at apply time; this list pins the
 * expectation that the classification below stays exhaustive.
 */
const ALL_COLUMNS = [
  'aadhaar_status', 'aadhaar_verified_at', 'available_dates', 'available_days',
  'average_rating', 'band_category', 'bank_account_holder', 'bank_account_number',
  'bank_ifsc', 'bank_name', 'bio', 'branch_name', 'business_hours', 'category_details',
  'cover_banner_url', 'cover_image_url', 'created_at', 'doc_verification_notes',
  'experience_years', 'extra_charges', 'facebook', 'faqs', 'featured_until',
  'gallery_urls', 'govt_id_status', 'govt_id_verified_at', 'gst_number', 'id',
  'instagram', 'instant_booking', 'is_available', 'is_bank_verified', 'is_featured',
  'is_published', 'is_verified', 'languages', 'liveness_attempts', 'liveness_provider',
  'liveness_session_id', 'liveness_verified', 'liveness_verified_at', 'onboarding_completed',
  'pan_status', 'pan_verified_at', 'performance_type', 'price_max', 'price_min',
  'pricing_type', 'profession', 'rejection_reason', 'service_areas', 'service_radius',
  'social_links', 'specialties', 'stage_name', 'subcategory', 'total_bookings',
  'total_reviews', 'travel_charges', 'updated_at', 'user_id', 'vendor_details',
  'verification_status', 'verified_at', 'verified_by', 'video_urls', 'website',
  'whatsapp', 'youtube',
];

/**
 * Columns a signed-in vendor must NEVER be able to PATCH directly: approval /
 * verification state, reputation counters, KYC / liveness facts, and identity /
 * ownership. The mandate named verification_status / is_verified / is_published
 * / is_featured explicitly, plus "any equivalent approval/reputation/admin-only
 * fields" — this is that equivalent set.
 */
const SECURITY_CRITICAL = [
  'verification_status', 'is_verified', 'is_published', 'is_featured',
  'verified_by', 'verified_at', 'rejection_reason', 'is_bank_verified',
  'average_rating', 'total_bookings', 'total_reviews',
  'aadhaar_status', 'aadhaar_verified_at', 'govt_id_status', 'govt_id_verified_at',
  'pan_status', 'pan_verified_at', 'liveness_verified', 'liveness_verified_at',
  'liveness_attempts', 'liveness_provider', 'liveness_session_id',
  'doc_verification_notes', 'featured_until', 'profession', 'id', 'user_id', 'created_at',
];

/** Identifiers inside `GRANT UPDATE ( ... ) ON public.provider_profiles TO authenticated`. */
function grantedUpdateColumns(sql: string): string[] {
  const m = sql.match(
    /GRANT\s+UPDATE\s*\(([\s\S]*?)\)\s*ON\s+public\.provider_profiles\s+TO\s+authenticated/i,
  );
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

/** Quoted identifiers of a `<name> text[] := ARRAY[ ... ];` declaration. */
function sqlArray(sql: string, name: string): string[] {
  const m = sql.match(new RegExp(`\\b${name}\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([\\s\\S]*?)\\]`, 'i'));
  if (!m) return [];
  return [...m[1].matchAll(/'([a-z0-9_]+)'/gi)].map((x) => x[1]);
}

const granted = grantedUpdateColumns(LOCKDOWN_SQL);
const benign = sqlArray(LOCKDOWN_SQL, 'benign');
const protectedCols = sqlArray(LOCKDOWN_SQL, 'protected');

describe('P0-2 provider self-approval prevention — column lockdown', () => {
  it('grants UPDATE only on the benign allowlist (granted set === benign catalogue)', () => {
    expect(granted.length).toBeGreaterThan(0);
    expect([...granted].sort()).toEqual([...benign].sort());
  });

  it('classifies every live column as benign XOR protected (exhaustive, disjoint)', () => {
    const overlap = benign.filter((c) => protectedCols.includes(c));
    expect(overlap).toEqual([]);
    expect([...benign, ...protectedCols].sort()).toEqual([...ALL_COLUMNS].sort());
  });

  it('never grants a security-critical approval/reputation/KYC column to authenticated', () => {
    for (const col of SECURITY_CRITICAL) {
      expect(protectedCols, `${col} must be classified protected`).toContain(col);
      expect(granted, `${col} must NOT be granted to authenticated`).not.toContain(col);
    }
  });

  it('revokes table-wide UPDATE from authenticated before re-granting the allowlist', () => {
    const revokeAt = LOCKDOWN_SQL.search(
      /REVOKE\s+UPDATE\s+ON\s+public\.provider_profiles\s+FROM[^;]*authenticated/i,
    );
    const grantAt = LOCKDOWN_SQL.search(/GRANT\s+UPDATE\s*\(/i);
    expect(revokeAt).toBeGreaterThanOrEqual(0);
    expect(grantAt).toBeGreaterThan(revokeAt);
  });
});

describe('P0-2 — server-side authority (additive migration)', () => {
  it('defines admin_set_provider_verification as a has_role-gated SECURITY DEFINER RPC', () => {
    expect(AUTHORITY_SQL).toMatch(
      /create\s+or\s+replace\s+function\s+public\.admin_set_provider_verification/i,
    );
    expect(AUTHORITY_SQL).toMatch(/security\s+definer/i);
    expect(AUTHORITY_SQL).toMatch(/has_role/i);
  });

  it('defines provider_resubmit_for_review', () => {
    expect(AUTHORITY_SQL).toMatch(
      /create\s+or\s+replace\s+function\s+public\.provider_resubmit_for_review/i,
    );
  });

  it('does not re-open the hole by re-granting table-wide UPDATE to authenticated', () => {
    // A column-scoped `GRANT UPDATE ( ... )` is fine; a table-wide
    // `GRANT UPDATE ON public.provider_profiles` (no column list) would undo
    // the whole lockdown, so it must never appear in the additive migration.
    expect(AUTHORITY_SQL).not.toMatch(
      /GRANT\s+UPDATE\s+ON\s+public\.provider_profiles\s+TO\s+authenticated/i,
    );
  });
});

describe('P0-2 — frontend routes protected-column writes through the RPCs', () => {
  it('approvalService approve/reject/suspend call the RPC, not a direct verification PATCH', () => {
    expect(APPROVAL_TS).toMatch(/admin_set_provider_verification/);
    expect(APPROVAL_TS).toMatch(/p_action:\s*'approve'/);
    expect(APPROVAL_TS).toMatch(/p_action:\s*'reject'/);
    expect(APPROVAL_TS).toMatch(/p_action:\s*'suspend'/);
    // no surviving `.update({ ... verification_status ... })` on provider_profiles.
    expect(APPROVAL_TS).not.toMatch(/\.update\(\s*\{[^}]*verification_status/);
  });

  it('AdminDashboard handleVerification calls admin_set_provider_verification', () => {
    expect(ADMIN_TSX).toMatch(/admin_set_provider_verification/);
  });

  it('VendorEditProfile resubmit calls provider_resubmit_for_review', () => {
    expect(VENDOR_EDIT_TSX).toMatch(/provider_resubmit_for_review/);
  });

  it('useVendorData saveBankDetails no longer writes is_bank_verified from the client', () => {
    // The bank-reverify BEFORE UPDATE trigger owns this column server-side; the
    // client must not send `is_bank_verified: true|false` in any payload.
    expect(VENDOR_DATA_TS).not.toMatch(/is_bank_verified\s*:\s*(true|false)/);
  });
});
