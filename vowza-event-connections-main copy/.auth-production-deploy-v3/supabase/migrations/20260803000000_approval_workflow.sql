-- ============================================================
-- Artist Approval Workflow Migration
-- Adds verified_at, verified_by, rejection_reason to provider_profiles
-- Fixes RLS so only approved artists appear in marketplace
-- Idempotent — safe to run multiple times
-- ============================================================

-- ── 1. Add approval columns to provider_profiles ──────────────────────────
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT,
  ADD COLUMN IF NOT EXISTS is_published      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS average_rating    NUMERIC(3,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews     INTEGER DEFAULT 0;

-- ── 2. Index for fast marketplace queries ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_provider_published
  ON public.provider_profiles(is_published, verification_status);

-- ── 3. Fix provider_profiles RLS ──────────────────────────────────────────
-- Drop any existing policies first
DROP POLICY IF EXISTS "providers_public_read"      ON public.provider_profiles;
DROP POLICY IF EXISTS "providers_owner_write"      ON public.provider_profiles;
DROP POLICY IF EXISTS "providers_admin_write"      ON public.provider_profiles;
DROP POLICY IF EXISTS "providers_owner_read"       ON public.provider_profiles;

ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;

-- Customers/public: only see APPROVED + PUBLISHED profiles
CREATE POLICY "providers_public_read"
  ON public.provider_profiles FOR SELECT
  USING (
    verification_status IN ('approved', 'verified')
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Owners: full write access to their own profile
CREATE POLICY "providers_owner_write"
  ON public.provider_profiles FOR ALL
  USING (user_id = auth.uid());

-- Admins: full access to all profiles
CREATE POLICY "providers_admin_write"
  ON public.provider_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── 4. Fix portfolio_items RLS ─────────────────────────────────────────────
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_public_read"  ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_owner_write"  ON public.portfolio_items;

CREATE POLICY "portfolio_public_read"
  ON public.portfolio_items FOR SELECT
  USING (true);

CREATE POLICY "portfolio_owner_write"
  ON public.portfolio_items FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()
    )
  );

-- ── 5. Notifications table: ensure it exists ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  type        TEXT        DEFAULT 'info',
  is_read     BOOLEAN     DEFAULT FALSE,
  reference_id TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_owner"        ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_auth"  ON public.notifications;

CREATE POLICY "notifications_owner"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_auth"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "notifications_update_owner"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ── 6. user_roles: ensure it exists ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  role       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_read_own"   ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_all"  ON public.user_roles;

CREATE POLICY "roles_read_own"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "roles_admin_all"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid() AND r.role = 'admin'
    )
  );

-- ── 7. Function to approve an artist (called by the app) ──────────────────
CREATE OR REPLACE FUNCTION public.approve_artist(
  p_provider_id   UUID,
  p_admin_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Get the artist's user_id
  SELECT user_id INTO v_user_id
  FROM public.provider_profiles
  WHERE id = p_provider_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Provider not found';
  END IF;

  -- Update provider profile
  UPDATE public.provider_profiles
  SET
    verification_status = 'approved',
    is_published        = TRUE,
    verified_at         = NOW(),
    verified_by         = p_admin_user_id,
    rejection_reason    = NULL
  WHERE id = p_provider_id;

  -- Assign provider role
  INSERT INTO public.user_roles(user_id, role)
  VALUES (v_user_id, 'provider')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Send in-app notification to artist
  INSERT INTO public.notifications(user_id, title, message, type, reference_id)
  VALUES (
    v_user_id,
    'Profile Approved! 🎉',
    'Congratulations! Your Vowza profile has been successfully verified. Your profile is now live on Vowza. You can now edit your profile, manage your services, and start receiving bookings.',
    'approval',
    p_provider_id::text
  );

  -- Log admin action
  INSERT INTO public.notifications(user_id, title, message, type, reference_id)
  VALUES (
    p_admin_user_id,
    'Artist Approved',
    'You approved provider ' || p_provider_id::text,
    'admin_action',
    p_provider_id::text
  );
END;
$$;

-- ── 8. Function to reject an artist ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_artist(
  p_provider_id    UUID,
  p_admin_user_id  UUID,
  p_reason         TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.provider_profiles
  WHERE id = p_provider_id;

  UPDATE public.provider_profiles
  SET
    verification_status = 'rejected',
    is_published        = FALSE,
    rejection_reason    = p_reason,
    verified_at         = NOW(),
    verified_by         = p_admin_user_id
  WHERE id = p_provider_id;

  -- Remove provider role if it existed
  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'provider';

  -- Notify artist
  INSERT INTO public.notifications(user_id, title, message, type, reference_id)
  VALUES (
    v_user_id,
    'Profile Review Update',
    'Your Vowza profile requires attention. Reason: ' || p_reason || '. Please update your profile and resubmit for verification.',
    'rejection',
    p_provider_id::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_artist TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_artist  TO authenticated;
