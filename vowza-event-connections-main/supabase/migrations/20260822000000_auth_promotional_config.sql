-- Create auth_promotional_config table for admin-managed promotional images
CREATE TABLE IF NOT EXISTS public.auth_promotional_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Image storage
  current_image_url TEXT,
  image_storage_path TEXT,
  
  -- Styling
  overlay_opacity DECIMAL(3,2) DEFAULT 0.3,
  overlay_color TEXT DEFAULT 'rgba(0,0,0,1)',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  
  -- Constraints
  CONSTRAINT check_overlay_opacity CHECK (overlay_opacity >= 0 AND overlay_opacity <= 1),
  CONSTRAINT check_url_not_empty CHECK (current_image_url IS NULL OR current_image_url != '')
);

-- Enable RLS
ALTER TABLE public.auth_promotional_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can SELECT (read public config)
CREATE POLICY auth_promotional_config_select ON public.auth_promotional_config
  FOR SELECT
  USING (true);

-- RLS Policy: Only admins can INSERT
CREATE POLICY auth_promotional_config_insert ON public.auth_promotional_config
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policy: Only admins can UPDATE
CREATE POLICY auth_promotional_config_update ON public.auth_promotional_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policy: Only admins can DELETE
CREATE POLICY auth_promotional_config_delete ON public.auth_promotional_config
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_auth_promotional_config_active ON public.auth_promotional_config(is_active);
CREATE INDEX idx_auth_promotional_config_created ON public.auth_promotional_config(created_at DESC);

-- Grant permissions
GRANT SELECT ON public.auth_promotional_config TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.auth_promotional_config TO authenticated;
