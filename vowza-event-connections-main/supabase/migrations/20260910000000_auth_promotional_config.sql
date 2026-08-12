-- Admin-managed promotional content for the soft-authentication modal.
-- Uses a unique timestamp because 20260822000000 is already allocated to a
-- different historical production migration.

CREATE TABLE IF NOT EXISTS public.auth_promotional_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  current_image_url TEXT,
  image_storage_path TEXT,
  overlay_opacity DECIMAL(3,2) NOT NULL DEFAULT 0.30,
  overlay_color TEXT NOT NULL DEFAULT 'rgba(0,0,0,1)',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT auth_promotional_config_overlay_opacity_check
    CHECK (overlay_opacity >= 0 AND overlay_opacity <= 1),
  CONSTRAINT auth_promotional_config_image_url_check
    CHECK (current_image_url IS NULL OR current_image_url <> '')
);

ALTER TABLE public.auth_promotional_config ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auth_promotional_config_active
  ON public.auth_promotional_config (is_active);
CREATE INDEX IF NOT EXISTS idx_auth_promotional_config_created
  ON public.auth_promotional_config (created_at DESC);

GRANT SELECT ON public.auth_promotional_config TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.auth_promotional_config TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotional_config'
      AND policyname = 'auth_promotional_config_select'
  ) THEN
    CREATE POLICY auth_promotional_config_select
      ON public.auth_promotional_config FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotional_config'
      AND policyname = 'auth_promotional_config_insert'
  ) THEN
    CREATE POLICY auth_promotional_config_insert
      ON public.auth_promotional_config FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotional_config'
      AND policyname = 'auth_promotional_config_update'
  ) THEN
    CREATE POLICY auth_promotional_config_update
      ON public.auth_promotional_config FOR UPDATE
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
    WHERE schemaname = 'public' AND tablename = 'auth_promotional_config'
      AND policyname = 'auth_promotional_config_delete'
  ) THEN
    CREATE POLICY auth_promotional_config_delete
      ON public.auth_promotional_config FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('auth-promotional', 'auth-promotional', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read auth promotional images'
  ) THEN
    CREATE POLICY "Public read auth promotional images"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'auth-promotional');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins insert auth promotional images'
  ) THEN
    CREATE POLICY "Admins insert auth promotional images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'auth-promotional'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins update auth promotional images'
  ) THEN
    CREATE POLICY "Admins update auth promotional images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'auth-promotional'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        bucket_id = 'auth-promotional'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins delete auth promotional images'
  ) THEN
    CREATE POLICY "Admins delete auth promotional images"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'auth-promotional'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;
