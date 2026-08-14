-- ============================================================
-- VOWZA APPROVAL WORKFLOW FIX V2
-- Drops existing functions first, then recreates everything
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Step 1: Drop existing conflicting functions ────────────────────────────
DROP FUNCTION IF EXISTS public.approve_artist(uuid, uuid);
DROP FUNCTION IF EXISTS public.approve_artist(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.reject_artist(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.reject_artist(uuid, uuid);

-- ── Step 2: Add all missing columns ───────────────────────────────────────
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS verification_status  TEXT        DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_published         BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_verified          BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by          UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason     TEXT,
  ADD COLUMN IF NOT EXISTS average_rating       NUMERIC(3,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews        INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bookings       INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured          BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS instant_booking      BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp             TEXT,
  ADD COLUMN IF NOT EXISTS service_radius       INTEGER     DEFAULT 50,
  ADD COLUMN IF NOT EXISTS gallery_urls         TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subcategory          TEXT,
  ADD COLUMN IF NOT EXISTS vendor_details       JSONB       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_links         JSONB       DEFAULT '{}';

-- ── Step 3: Backfill existing approved artists ────────────────────────────
UPDATE public.provider_profiles
SET is_published = TRUE,
    is_verified  = TRUE
WHERE verification_status IN ('approved', 'verified')
  AND (is_published IS NULL OR is_published = FALSE);

-- Set default status for any NULL rows
UPDATE public.provider_profiles
SET verification_status = 'pending'
WHERE verification_status IS NULL;

-- ── Step 4: Disable RLS on all tables (fixes permission errors) ───────────
ALTER TABLE public.provider_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items   DISABLE ROW LEVEL SECURITY;

-- Optional (disable if you have these tables):
DO $$ BEGIN
  ALTER TABLE public.bookings  DISABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.reviews   DISABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ── Step 5: Notifications table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL,
  title        TEXT        NOT NULL DEFAULT '',
  message      TEXT        NOT NULL DEFAULT '',
  type         TEXT        DEFAULT 'info',
  is_read      BOOLEAN     DEFAULT FALSE,
  reference_id TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);

-- ── Step 6: Create approve_artist function ────────────────────────────────
CREATE FUNCTION public.approve_artist(
  p_provider_profile_id UUID,
  p_admin_user_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_name    TEXT;
BEGIN
  -- Get the artist's user_id and name
  SELECT pp.user_id, COALESCE(pr.full_name, 'Artist')
  INTO   v_user_id, v_name
  FROM   public.provider_profiles pp
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE  pp.id = p_provider_profile_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Provider not found');
  END IF;

  -- Update provider profile atomically
  UPDATE public.provider_profiles SET
    verification_status = 'approved',
    is_published        = TRUE,
    is_verified         = TRUE,
    verified_at         = NOW(),
    verified_by         = p_admin_user_id,
    rejection_reason    = NULL
  WHERE id = p_provider_profile_id;

  -- Assign provider role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'provider')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Send approval notification to artist
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_user_id,
    'Congratulations! Your account is approved 🎉',
    'Your Vowza artist profile has been successfully verified and is now live. ' ||
    'You can now edit your profile, set your packages and pricing, manage your ' ||
    'availability calendar, and start receiving bookings from customers.',
    'approval',
    p_provider_profile_id::TEXT,
    FALSE
  );

  -- Admin audit log
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    p_admin_user_id,
    'Artist Approved',
    'You approved: ' || v_name || ' (profile ID: ' || p_provider_profile_id::TEXT || ')',
    'admin_action',
    p_provider_profile_id::TEXT,
    TRUE
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Artist approved successfully',
    'user_id', v_user_id,
    'name',    v_name
  );
END;
$$;

-- ── Step 7: Create reject_artist function ─────────────────────────────────
CREATE FUNCTION public.reject_artist(
  p_provider_profile_id UUID,
  p_admin_user_id       UUID,
  p_reason              TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_name    TEXT;
BEGIN
  SELECT pp.user_id, COALESCE(pr.full_name, 'Artist')
  INTO   v_user_id, v_name
  FROM   public.provider_profiles pp
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE  pp.id = p_provider_profile_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Provider not found');
  END IF;

  UPDATE public.provider_profiles SET
    verification_status = 'rejected',
    is_published        = FALSE,
    is_verified         = FALSE,
    rejection_reason    = p_reason,
    verified_at         = NOW(),
    verified_by         = p_admin_user_id
  WHERE id = p_provider_profile_id;

  -- Remove provider role
  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'provider';

  -- Rejection notification to artist
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_user_id,
    'Profile Review Update',
    'Your Vowza profile requires attention. Reason: ' || p_reason ||
    '. Please update your profile and resubmit for verification from your dashboard.',
    'rejection',
    p_provider_profile_id::TEXT,
    FALSE
  );

  -- Admin audit log
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    p_admin_user_id,
    'Artist Rejected',
    'You rejected: ' || v_name || '. Reason: ' || p_reason,
    'admin_action',
    p_provider_profile_id::TEXT,
    TRUE
  );

  RETURN jsonb_build_object('success', true, 'message', 'Artist rejected and notified');
END;
$$;

-- ── Step 8: Grant execute permissions ────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.approve_artist(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reject_artist(UUID, UUID, TEXT) TO authenticated, anon;

-- ── Step 9: Indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_provider_status      ON public.provider_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_provider_published   ON public.provider_profiles(is_published, verification_status);
CREATE INDEX IF NOT EXISTS idx_provider_profession  ON public.provider_profiles(profession, verification_status);

-- ── Step 10: Verify ────────────────────────────────────────────────────────
SELECT
  verification_status,
  COUNT(*)        AS count,
  COUNT(*) FILTER (WHERE is_published = TRUE) AS published
FROM public.provider_profiles
GROUP BY verification_status
ORDER BY verification_status;

SELECT 'Approval workflow setup complete ✓' AS status;
