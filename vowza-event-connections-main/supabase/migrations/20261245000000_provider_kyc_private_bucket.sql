-- 20261245000000_provider_kyc_private_bucket.sql
--
-- P0 Phase G (storage / document privacy) -- SECURITY FIX.
--
-- THE HOLE (live): provider KYC + liveness artifacts -- the registration selfie
-- and the Aadhaar / PAN / Government-ID document images -- are uploaded by
-- ProviderRegistration.tsx to the `provider-media` bucket, which is PUBLIC
-- (public = true), and persisted into provider_profiles.vendor_details as raw
-- getPublicUrl() links (selfie_url / aadhaar_url / pan_url / govt_id_url). A
-- public bucket serves every object at a stable, unauthenticated URL, so a
-- provider's identity documents are effectively world-readable. KYC / identity
-- documents must never live in a public bucket.
--
-- THE FIX (ADDITIVE, safe to apply any time, before or after the frontend):
-- introduce a dedicated PRIVATE bucket `provider-kyc` (public = false) with
-- owner-scoped storage.objects RLS -- a provider may INSERT / SELECT / UPDATE /
-- DELETE only objects under their own `{auth.uid()}/...` prefix, and an admin or
-- super_admin may SELECT any object in the bucket so the verification drawer can
-- still review documents, through a time-limited createSignedUrl() rather than a
-- permanent public URL. The frontend half of this phase (same commit) rewires
-- ProviderRegistration to upload selfie + documents to `provider-kyc` at
-- `{user.id}/{kind}/...` paths and store the object PATH (not a public URL) under
-- new vendor_details keys (selfie_path / aadhaar_path / pan_path / govt_id_path);
-- AdminArtistDetail resolves those paths through signed URLs with a fallback to
-- the legacy *_url keys so records written before the cutover keep displaying.
--
-- PARKED (NOT in this migration -- hits STOP conditions: live storage + prod
-- data migration): the backfill that MOVES already-uploaded objects out of the
-- public `provider-media/docs/*` + `provider-media/selfies/*` into `provider-kyc`
-- and strips the legacy public *_url values from existing vendor_details rows.
-- Those historical objects stay publicly reachable until that parked remediation
-- runs against production. This migration only guarantees that NEW registrations
-- are private; it does not retroactively un-publish historical uploads.
--
-- CLASSIFICATION: SECURITY FIX (removes KYC / identity documents from a public
--   bucket for all new uploads). ADDITIVE -- creates one bucket + four
--   owner/admin RLS policies; revokes nothing; the public `provider-media`
--   bucket and its own policies are left entirely untouched.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS provider_kyc_owner_insert        ON storage.objects;
--   DROP POLICY IF EXISTS provider_kyc_owner_or_admin_read ON storage.objects;
--   DROP POLICY IF EXISTS provider_kyc_owner_update        ON storage.objects;
--   DROP POLICY IF EXISTS provider_kyc_owner_delete        ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'provider-kyc';  -- only if empty
--   NOTIFY pgrst, 'reload schema';
BEGIN;

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- Fail-closed drift guard: the policies below depend on storage.objects,
-- storage.foldername() and public.has_role(). If any has been renamed or
-- removed, abort at APPLY time rather than installing a policy that silently
-- never matches -- which for the SELECT policy would lock admins out of the
-- verification queue, and for INSERT would break every registration upload.
-- ---------------------------------------------------------------------------
DO $catalog$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'ABORT provider_kyc_private_bucket: storage.objects missing';
  END IF;
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'ABORT provider_kyc_private_bucket: storage.buckets missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'storage' AND p.proname = 'foldername'
  ) THEN
    RAISE EXCEPTION 'ABORT provider_kyc_private_bucket: storage.foldername() missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  ) THEN
    RAISE EXCEPTION 'ABORT provider_kyc_private_bucket: public.has_role() missing';
  END IF;
END
$catalog$;

-- ---------------------------------------------------------------------------
-- The private bucket. public = false => no getPublicUrl; every read goes
-- through an RLS-checked signed URL. ON CONFLICT keeps this idempotent and
-- never flips an existing bucket's visibility (the $verify$ below still fails
-- the apply if a pre-existing provider-kyc bucket is public).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('provider-kyc', 'provider-kyc', false)
ON CONFLICT (id) DO NOTHING;
-- ---------------------------------------------------------------------------
-- Owner-scoped RLS. Path convention: {auth.uid()}/{kind}/{file}, so
-- (storage.foldername(name))[1] is the owning user's id. SELECT additionally
-- allows an admin / super_admin so the verification drawer can review via a
-- signed URL. Every policy is scoped by bucket_id = 'provider-kyc', so the
-- public `provider-media` bucket and its policies are entirely unaffected.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS provider_kyc_owner_insert ON storage.objects;
CREATE POLICY provider_kyc_owner_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'provider-kyc'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS provider_kyc_owner_or_admin_read ON storage.objects;
CREATE POLICY provider_kyc_owner_or_admin_read
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'provider-kyc'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

DROP POLICY IF EXISTS provider_kyc_owner_update ON storage.objects;
CREATE POLICY provider_kyc_owner_update
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'provider-kyc'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'provider-kyc'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS provider_kyc_owner_delete ON storage.objects;
CREATE POLICY provider_kyc_owner_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'provider-kyc'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
-- ---------------------------------------------------------------------------
-- Self-check: the bucket exists and is private, and all four policies are
-- installed. Roll the migration back otherwise.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_public boolean;
  v_count  int;
BEGIN
  SELECT public INTO v_public FROM storage.buckets WHERE id = 'provider-kyc';
  IF v_public IS NULL THEN
    RAISE EXCEPTION 'VERIFY provider_kyc_private_bucket: bucket not created';
  END IF;
  IF v_public IS TRUE THEN
    RAISE EXCEPTION 'VERIFY provider_kyc_private_bucket: bucket is PUBLIC, expected private';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname IN (
      'provider_kyc_owner_insert',
      'provider_kyc_owner_or_admin_read',
      'provider_kyc_owner_update',
      'provider_kyc_owner_delete'
    );
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'VERIFY provider_kyc_private_bucket: expected 4 policies, found %', v_count;
  END IF;
END
$verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
