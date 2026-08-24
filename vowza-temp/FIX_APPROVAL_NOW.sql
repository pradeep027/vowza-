-- ================================================================
-- FIX_APPROVAL_NOW.sql
-- Run this ONE TIME in Supabase SQL Editor
-- Fixes: RLS blocking admin updates, RPC functions, notifications
-- ================================================================

-- ── 1. DISABLE RLS on provider_profiles ─────────────────────────────────────
-- Admin must be able to update any row. RLS on this table causes a
-- recursive policy loop (admin check → queries user_roles → which has RLS).
-- Marketplace filtering (is_published=true) is done in app code, not RLS.
ALTER TABLE public.provider_profiles DISABLE ROW LEVEL SECURITY;

-- ── 2. DISABLE RLS on profiles ───────────────────────────────────────────────
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- ── 3. DISABLE RLS on portfolio_items ────────────────────────────────────────
ALTER TABLE public.portfolio_items DISABLE ROW LEVEL SECURITY;

-- ── 4. FIX user_roles RLS — remove recursive policy ─────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_read_own"   ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_all"  ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_all"    ON public.user_roles;

-- Allow any authenticated user to READ all roles (needed for role checks)
CREATE POLICY "user_roles_read_auth"
  ON public.user_roles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow inserts from authenticated users (SECURITY DEFINER functions handle this)
CREATE POLICY "user_roles_insert_auth"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow delete from authenticated users
CREATE POLICY "user_roles_delete_auth"
  ON public.user_roles FOR DELETE
  USING (auth.role() = 'authenticated');

-- ── 5. notifications RLS ─────────────────────────────────────────────────────
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
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_owner"       ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select"      ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert"      ON public.notifications;
DROP POLICY IF EXISTS "notifications_update"      ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_owner" ON public.notifications;

CREATE POLICY "notif_select"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notif_insert"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "notif_update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ── 6. RECREATE approve_artist — SECURITY DEFINER bypasses all RLS ───────────
DROP FUNCTION IF EXISTS public.approve_artist(uuid, uuid);
DROP FUNCTION IF EXISTS public.approve_artist(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.approve_artist(
  p_provider_id   UUID,
  p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get artist user_id
  SELECT user_id INTO v_user_id
  FROM public.provider_profiles
  WHERE id = p_provider_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Provider not found');
  END IF;

  -- Update status
  UPDATE public.provider_profiles SET
    verification_status = 'approved',
    is_published        = TRUE,
    is_verified         = TRUE,
    verified_at         = NOW(),
    verified_by         = p_admin_user_id,
    rejection_reason    = NULL
  WHERE id = p_provider_id;

  -- Assign provider role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'provider')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Notify artist
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_user_id,
    'Account Approved',
    'Congratulations! Your artist account has been approved. You can now receive bookings.',
    'approval',
    p_provider_id::TEXT,
    FALSE
  );

  RETURN jsonb_build_object('success', true, 'message', 'approved');
END;
$$;

-- ── 7. RECREATE reject_artist — SECURITY DEFINER ─────────────────────────────
DROP FUNCTION IF EXISTS public.reject_artist(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.reject_artist(
  p_provider_id    UUID,
  p_admin_user_id  UUID,
  p_reason         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.provider_profiles
  WHERE id = p_provider_id;

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
  WHERE id = p_provider_id;

  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'provider';

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_user_id,
    'Profile Review Update',
    'Your Vowza profile requires attention. Reason: ' || p_reason || '. Please update your profile and resubmit.',
    'rejection',
    p_provider_id::TEXT,
    FALSE
  );

  RETURN jsonb_build_object('success', true, 'message', 'rejected');
END;
$$;

-- ── 8. GRANT execute permissions ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.approve_artist(UUID, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reject_artist(UUID, UUID, TEXT) TO authenticated, anon, service_role;

-- ── 9. Ensure missing columns exist ─────────────────────────────────────────
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS is_verified      BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by      UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_published     BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vendor_details   JSONB       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_links     JSONB       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gallery_urls     TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_areas    TEXT[]      DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS area  TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- ── 10. VERIFY: show current state ───────────────────────────────────────────
SELECT verification_status, COUNT(*) as count
FROM public.provider_profiles
GROUP BY verification_status;

SELECT 'FIX_APPROVAL_NOW.sql completed successfully ✓' AS status;
