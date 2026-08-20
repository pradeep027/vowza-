-- ============================================================
-- Vowza Platform Settings
-- Global configuration for platform fee (percentage or fixed).
-- Admin-only write access. All authenticated users can read (needed at checkout).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Seed the default platform fee setting (5% percentage)
INSERT INTO public.platform_settings (key, value)
VALUES ('platform_fee', '{"type": "percentage", "rate": 5, "enabled": true}')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings (needed for checkout calculation)
CREATE POLICY "anyone_can_read_settings" ON public.platform_settings
FOR SELECT USING (true);

-- Only admin/super_admin can insert/update
CREATE POLICY "admin_can_update_settings" ON public.platform_settings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "admin_can_insert_settings" ON public.platform_settings
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
  )
);
