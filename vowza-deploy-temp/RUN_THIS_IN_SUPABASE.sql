-- ============================================================
-- VOWZA — RUN THIS IN SUPABASE SQL EDITOR (ONE TIME)
-- This is the single definitive migration file.
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. DISABLE RLS on all tables the admin panel reads
--    (Admin must see all rows; marketplace filtering is done in code)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.provider_profiles  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles         DISABLE ROW LEVEL SECURITY;

DO $$ BEGIN ALTER TABLE public.bookings        DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reviews         DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications   DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.pricing_packages DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.provider_faqs   DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. ADD MISSING COLUMNS to provider_profiles
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS verification_status  TEXT          DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_published         BOOLEAN       DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_verified          BOOLEAN       DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by          UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason     TEXT,
  ADD COLUMN IF NOT EXISTS average_rating       NUMERIC(3,1)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews        INTEGER       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bookings       INTEGER       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured          BOOLEAN       DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS instant_booking      BOOLEAN       DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp             TEXT,
  ADD COLUMN IF NOT EXISTS service_radius       INTEGER       DEFAULT 50,
  ADD COLUMN IF NOT EXISTS gallery_urls         TEXT[]        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subcategory          TEXT,
  ADD COLUMN IF NOT EXISTS vendor_details       JSONB         DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_links         JSONB         DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_areas        TEXT[]        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stage_name           TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url      TEXT,
  ADD COLUMN IF NOT EXISTS specialties          TEXT[]        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_city         TEXT,
  ADD COLUMN IF NOT EXISTS service_state        TEXT,
  ADD COLUMN IF NOT EXISTS service_area         TEXT;

-- ─────────────────────────────────────────────────────────────
-- 3. ADD MISSING COLUMNS to profiles
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state      TEXT,
  ADD COLUMN IF NOT EXISTS area       TEXT,
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────
-- 4. ENSURE NULL status rows are set to 'pending'
-- ─────────────────────────────────────────────────────────────
UPDATE public.provider_profiles
SET verification_status = 'pending'
WHERE verification_status IS NULL;

-- Backfill: already-approved artists must be published
UPDATE public.provider_profiles
SET is_published = TRUE,
    is_verified  = TRUE
WHERE verification_status IN ('approved', 'verified')
  AND (is_published IS NULL OR is_published = FALSE);

-- ─────────────────────────────────────────────────────────────
-- 5. NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_time ON public.notifications(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 6. INDEXES for fast admin queries
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pp_status     ON public.provider_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_pp_published  ON public.provider_profiles(is_published, verification_status);
CREATE INDEX IF NOT EXISTS idx_pp_profession ON public.provider_profiles(profession, verification_status);
CREATE INDEX IF NOT EXISTS idx_pp_user_id    ON public.provider_profiles(user_id);

-- ─────────────────────────────────────────────────────────────
-- 7. DROP old conflicting RPC functions (if any exist)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.approve_artist(uuid, uuid);
DROP FUNCTION IF EXISTS public.approve_artist(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.reject_artist(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.reject_artist(uuid, uuid);

-- ─────────────────────────────────────────────────────────────
-- 8. RECREATE approve_artist RPC (returns JSONB for easy error handling)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_artist(
  p_provider_profile_id UUID,
  p_admin_user_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_name    TEXT;
BEGIN
  SELECT pp.user_id, COALESCE(pr.full_name, 'Artist')
  INTO   v_user_id, v_name
  FROM   public.provider_profiles pp
  LEFT   JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE  pp.id = p_provider_profile_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Provider not found');
  END IF;

  UPDATE public.provider_profiles SET
    verification_status = 'approved',
    is_published        = TRUE,
    is_verified         = TRUE,
    verified_at         = NOW(),
    verified_by         = p_admin_user_id,
    rejection_reason    = NULL
  WHERE id = p_provider_profile_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'provider')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_user_id,
    'Congratulations! Your account is approved 🎉',
    'Your Vowza artist profile is now live. You can now receive bookings, manage your profile, set packages and pricing.',
    'approval', p_provider_profile_id::TEXT, FALSE
  );

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    p_admin_user_id, 'Artist Approved',
    'Approved: ' || v_name || ' (id: ' || p_provider_profile_id::TEXT || ')',
    'admin_action', p_provider_profile_id::TEXT, TRUE
  );

  RETURN jsonb_build_object('success', true, 'message', 'Artist approved', 'user_id', v_user_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 9. RECREATE reject_artist RPC
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_artist(
  p_provider_profile_id UUID,
  p_admin_user_id       UUID,
  p_reason              TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_name    TEXT;
BEGIN
  SELECT pp.user_id, COALESCE(pr.full_name, 'Artist')
  INTO   v_user_id, v_name
  FROM   public.provider_profiles pp
  LEFT   JOIN public.profiles pr ON pr.id = pp.user_id
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

  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'provider';

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_user_id,
    'Profile Review Update',
    'Your Vowza profile requires attention. Reason: ' || p_reason ||
    '. Please update and resubmit from your dashboard.',
    'rejection', p_provider_profile_id::TEXT, FALSE
  );

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    p_admin_user_id, 'Artist Rejected',
    'Rejected: ' || v_name || '. Reason: ' || p_reason,
    'admin_action', p_provider_profile_id::TEXT, TRUE
  );

  RETURN jsonb_build_object('success', true, 'message', 'Artist rejected and notified');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 10. GRANT PERMISSIONS
-- ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.approve_artist(UUID, UUID)       TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reject_artist(UUID, UUID, TEXT)  TO authenticated, anon, service_role;

GRANT ALL ON TABLE public.provider_profiles  TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.profiles           TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.user_roles         TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.notifications      TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.portfolio_items    TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────────────────────
-- 11. VERIFY — check current data state
-- ─────────────────────────────────────────────────────────────
SELECT
  verification_status,
  COUNT(*)                                              AS total,
  COUNT(*) FILTER (WHERE is_published = TRUE)          AS published,
  COUNT(*) FILTER (WHERE is_verified  = TRUE)          AS verified
FROM public.provider_profiles
GROUP BY verification_status
ORDER BY verification_status;

SELECT 'RUN_THIS_IN_SUPABASE.sql completed successfully ✓' AS status;
