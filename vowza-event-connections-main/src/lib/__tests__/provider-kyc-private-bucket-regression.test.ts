/**
 * P0 Phase G — SECURITY FIX regression for provider KYC / identity-document
 * privacy.
 *
 * THE HOLE (was live): ProviderRegistration.tsx uploaded the registration selfie
 * and the Aadhaar / PAN / Government-ID images to the `provider-media` bucket,
 * which is PUBLIC, and stored raw getPublicUrl() links in
 * provider_profiles.vendor_details (selfie_url / aadhaar_url / pan_url /
 * govt_id_url). A public bucket serves every object at a stable, unauthenticated
 * URL, so identity documents were effectively world-readable.
 *
 * THE FIX (ADDITIVE): migration 20261245000000 creates a PRIVATE `provider-kyc`
 * bucket (public = false) with owner-scoped storage.objects RLS plus an
 * admin/super_admin SELECT carve-out; ProviderRegistration now uploads to that
 * bucket at {user.id}/{kind}/... and stores the object PATH under new
 * vendor_details keys (*_path); AdminArtistDetail resolves those paths through
 * short-lived createSignedUrl() with a fallback to the legacy *_url keys; and the
 * vendor completion check accepts either shape. The breaking backfill of
 * historical public objects is PARKED (live storage + prod data migration).
 *
 * STATIC / CONTRACT regression (no database / no DOM render): assert the
 * migration's bucket + RLS shape and that all four read/write sites were rewired.
 * Real Postgres + storage behaviour is proven at APPLY time by the migration's
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
  'supabase/migrations/20261245000000_provider_kyc_private_bucket.sql',
);
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');
const NOCMT = stripComments(SQL);

const REG = repoFile('src/pages/ProviderRegistration.tsx');
const ADMIN = repoFile('src/pages/admin/AdminArtistDetail.tsx');
const HOOK = repoFile('src/hooks/useVendorData.ts');

const POLICIES = [
  'provider_kyc_owner_insert',
  'provider_kyc_owner_or_admin_read',
  'provider_kyc_owner_update',
  'provider_kyc_owner_delete',
];
describe('provider-kyc migration — a PRIVATE bucket', () => {
  it('creates the provider-kyc bucket as public = false, idempotently', () => {
    expect(NOCMT).toMatch(
      /INSERT\s+INTO\s+storage\.buckets\s*\(\s*id\s*,\s*name\s*,\s*public\s*\)\s*VALUES\s*\(\s*'provider-kyc'\s*,\s*'provider-kyc'\s*,\s*false\s*\)/i,
    );
    expect(NOCMT).toMatch(/ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+NOTHING/i);
    // must never create or flip it to a PUBLIC bucket
    expect(NOCMT).not.toMatch(/'provider-kyc'\s*,\s*true/i);
  });

  it('does not touch the existing public provider-media bucket', () => {
    expect(NOCMT).not.toMatch(/'provider-media'/i);
  });
});

describe('provider-kyc migration — owner-scoped + admin-read RLS', () => {
  it('installs all four provider_kyc_* policies on storage.objects, idempotently', () => {
    for (const name of POLICIES) {
      expect(NOCMT, `${name} must be dropped-if-exists then created`).toMatch(
        new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${name}\\s+ON\\s+storage\\.objects`, 'i'),
      );
      expect(NOCMT).toMatch(
        new RegExp(`CREATE\\s+POLICY\\s+${name}\\s+ON\\s+storage\\.objects`, 'i'),
      );
    }
  });

  it('scopes every policy to the provider-kyc bucket and the owner folder', () => {
    // owner match: auth.uid()::text = (storage.foldername(name))[1]
    const owner = /auth\.uid\(\)::text\s*=\s*\(storage\.foldername\(name\)\)\[1\]/gi;
    expect([...NOCMT.matchAll(owner)].length).toBeGreaterThanOrEqual(4);
    expect([...NOCMT.matchAll(/bucket_id\s*=\s*'provider-kyc'/gi)].length).toBeGreaterThanOrEqual(4);
    expect(NOCMT).toMatch(/FOR\s+INSERT\s+TO\s+authenticated/i);
    expect(NOCMT).toMatch(/FOR\s+SELECT\s+TO\s+authenticated/i);
    expect(NOCMT).toMatch(/FOR\s+UPDATE\s+TO\s+authenticated/i);
    expect(NOCMT).toMatch(/FOR\s+DELETE\s+TO\s+authenticated/i);
  });

  it('lets an admin / super_admin SELECT any provider-kyc object (verification drawer)', () => {
    const read = NOCMT.slice(NOCMT.indexOf('provider_kyc_owner_or_admin_read'));
    expect(read).toMatch(/public\.has_role\(\s*auth\.uid\(\)\s*,\s*'admin'\s*\)/i);
    expect(read).toMatch(/public\.has_role\(\s*auth\.uid\(\)\s*,\s*'super_admin'\s*\)/i);
  });

  it('ships a fail-closed $catalog$ drift guard + $verify$ self-check and reloads PostgREST', () => {
    expect(SQL).toMatch(/DO\s+\$catalog\$/);
    expect(SQL).toMatch(/ABORT provider_kyc_private_bucket/i);
    expect(NOCMT).toMatch(/storage\.foldername/i);
    expect(NOCMT).toMatch(/has_role/i);
    expect(SQL).toMatch(/DO\s+\$verify\$/);
    // $verify$ asserts the bucket is private and all four policies exist
    expect(NOCMT).toMatch(/v_public\s+IS\s+TRUE/i);
    expect(NOCMT).toMatch(/v_count\s*<>\s*4/);
    expect(SQL).toMatch(/COMMIT;/i);
    expect(SQL).toMatch(/NOTIFY\s+pgrst/i);
  });

  it('is additive — revokes nothing and drops no provider-media policy', () => {
    expect(NOCMT).not.toMatch(/\bREVOKE\b/i);
    expect(NOCMT).not.toMatch(/DROP\s+POLICY[^\n]*provider-media/i);
  });
});
describe('ProviderRegistration — uploads KYC to the private bucket, stores paths', () => {
  it('uploads selfie + documents to provider-kyc, never provider-media', () => {
    expect(REG).toMatch(/from\(\s*'provider-kyc'\s*\)\s*\.upload/i);
    // selfie + docs no longer go to the public bucket; only portfolio may.
    expect(REG).not.toMatch(/selfies\/\$\{user\.id\}/);
    expect(REG).not.toMatch(/docs\/\$\{user\.id\}/);
  });

  it('uses an owner-matching {user.id}/... object path so storage RLS matches', () => {
    expect(REG).toMatch(/`\$\{user\.id\}\/selfie\//);
    expect(REG).toMatch(/`\$\{user\.id\}\/\$\{prefix\}\//);
  });

  it('persists object PATHS under *_path keys and never getPublicUrl()s a KYC doc', () => {
    expect(REG).toMatch(/selfie_path\s*:/);
    expect(REG).toMatch(/aadhaar_path\s*:/);
    expect(REG).toMatch(/pan_path\s*:/);
    expect(REG).toMatch(/govt_id_path\s*:/);
    // the old public-URL write keys must be gone from vendor_details
    expect(REG).not.toMatch(/selfie_url\s*:/);
    expect(REG).not.toMatch(/aadhaar_url\s*:/);
    expect(REG).not.toMatch(/govt_id_url\s*:/);
  });
});

describe('AdminArtistDetail — resolves private paths via signed URL, legacy fallback', () => {
  it('signs provider-kyc paths with a short-lived createSignedUrl', () => {
    expect(ADMIN).toMatch(/from\(\s*'provider-kyc'\s*\)\s*\.createSignedUrl\(/i);
  });

  it('falls back to the legacy public *_url for pre-cutover records', () => {
    // the resolver reads *_path then returns vd[urlKey] || undefined
    expect(ADMIN).toMatch(/resolve\(\s*'selfie_path'\s*,\s*'selfie_url'\s*\)/);
    expect(ADMIN).toMatch(/resolve\(\s*'aadhaar_path'\s*,\s*'aadhaar_url'\s*\)/);
    expect(ADMIN).toMatch(/resolve\(\s*'govt_id_path'\s*,\s*'govt_id_url'\s*\)/);
  });

  it('counts a document as present from either the path or the legacy url', () => {
    expect(ADMIN).toMatch(/vd\.aadhaar_url\s*\|\|\s*vd\.aadhaar_path/);
    expect(ADMIN).toMatch(/vd\.govt_id_url\s*\|\|\s*vd\.govt_id_path/);
    expect(ADMIN).toMatch(/vd\.selfie_url\s*\|\|\s*vd\.selfie_path/);
  });
});

describe('useVendorData — completion accepts the private-path shape', () => {
  it('treats *_path as a satisfied Documents check', () => {
    expect(HOOK).toMatch(/vd\.aadhaar_url\s*\|\|\s*vd\.aadhaar_path/);
    expect(HOOK).toMatch(/vd\.govt_id_url\s*\|\|\s*vd\.govt_id_path/);
  });
});

describe('provider-kyc — the breaking backfill stays parked', () => {
  it('this migration moves no historical object and strips no legacy url', () => {
    // no data migration of existing public objects / vendor_details in this file
    expect(NOCMT).not.toMatch(/UPDATE\s+public\.provider_profiles/i);
    expect(NOCMT).not.toMatch(/provider-media\/docs/i);
    expect(NOCMT).not.toMatch(/provider-media\/selfies/i);
  });

  it('no provider-kyc migration other than this one has been added', () => {
    const kyc = repoDir('supabase/migrations').filter((f) => /provider[_-]kyc/i.test(f));
    expect(kyc).toEqual(['20261245000000_provider_kyc_private_bucket.sql']);
  });
});
