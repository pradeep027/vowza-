-- ─── Document Verification Status Fields ─────────────────────────────────────
-- Adds verification status tracking for uploaded identity documents.
-- Tracks: aadhaar, pan, govt_id verification states per provider.

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS aadhaar_status text DEFAULT 'pending' CHECK (aadhaar_status IN ('pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS aadhaar_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pan_status text DEFAULT 'pending' CHECK (pan_status IN ('pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS pan_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS govt_id_status text DEFAULT 'pending' CHECK (govt_id_status IN ('pending','verified','rejected','not_uploaded')),
  ADD COLUMN IF NOT EXISTS govt_id_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS doc_verification_notes text;

-- Update existing records that already have documents uploaded
UPDATE provider_profiles
SET aadhaar_status = 'pending',
    pan_status = 'pending',
    govt_id_status = CASE
      WHEN (vendor_details->>'govt_id_url') IS NOT NULL AND (vendor_details->>'govt_id_url') != '' THEN 'pending'
      ELSE 'not_uploaded'
    END
WHERE aadhaar_status IS NULL;
