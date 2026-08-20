-- Ordered image/video collection for homepage Auth Promotion media cards.
-- Additive only: the existing single-image auth_promotional_config remains the
-- source for the sign-in page and authentication modal.

CREATE TABLE IF NOT EXISTS public.auth_promotion_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL CHECK (media_url <> ''),
  storage_path TEXT NOT NULL CHECK (storage_path <> ''),
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_active_order
  ON public.auth_promotion_media (is_active, display_order, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_order
  ON public.auth_promotion_media (display_order, created_at);

CREATE OR REPLACE FUNCTION public.set_auth_promotion_media_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_auth_promotion_media_updated_at
  BEFORE UPDATE ON public.auth_promotion_media
  FOR EACH ROW EXECUTE FUNCTION public.set_auth_promotion_media_updated_at();

ALTER TABLE public.auth_promotion_media ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.auth_promotion_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.auth_promotion_media TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_media'
      AND policyname = 'Public read active auth promotion media'
  ) THEN
    CREATE POLICY "Public read active auth promotion media"
      ON public.auth_promotion_media FOR SELECT
      USING (
        is_active
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_media'
      AND policyname = 'Admins insert auth promotion media'
  ) THEN
    CREATE POLICY "Admins insert auth promotion media"
      ON public.auth_promotion_media FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_media'
      AND policyname = 'Admins update auth promotion media'
  ) THEN
    CREATE POLICY "Admins update auth promotion media"
      ON public.auth_promotion_media FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_media'
      AND policyname = 'Admins delete auth promotion media'
  ) THEN
    CREATE POLICY "Admins delete auth promotion media"
      ON public.auth_promotion_media FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

-- Reuses the existing public auth-promotional bucket and its existing admin
-- storage policies, which are type-agnostic and also permit video objects.
