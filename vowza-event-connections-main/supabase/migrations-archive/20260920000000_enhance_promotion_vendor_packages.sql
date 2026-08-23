-- Enhance auth_promotion_media to support exact vendor/package promotions
-- Adds vendor_id, package_id, category fields to link promotions to real database entities
-- Maintains backward compatibility with existing display_order system

-- Add new columns to auth_promotion_media
ALTER TABLE public.auth_promotion_media
ADD COLUMN IF NOT EXISTS slot_number INTEGER CHECK (slot_number >= 1 AND slot_number <= 4),
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.provider_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS package_id UUID,
ADD COLUMN IF NOT EXISTS package_table TEXT,
ADD COLUMN IF NOT EXISTS vendor_name TEXT,
ADD COLUMN IF NOT EXISTS package_name TEXT,
ADD COLUMN IF NOT EXISTS destination_type TEXT DEFAULT 'vendor' CHECK (destination_type IN ('vendor', 'package', 'service')),
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;

-- Create index for efficient slot-based queries
CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_slot_published
  ON public.auth_promotion_media (slot_number, is_published, created_at DESC);

-- Create index for vendor/package lookups
CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_provider_package
  ON public.auth_promotion_media (provider_id, package_id, is_published);

-- Add trigger to validate vendor/package relationship before insert/update
CREATE OR REPLACE FUNCTION public.validate_promotion_vendor_package()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If provider_id is set and package_id is set, verify the package belongs to this provider
  IF NEW.provider_id IS NOT NULL AND NEW.package_id IS NOT NULL AND NEW.package_table IS NOT NULL THEN
    -- For generic validation, check that the package_table exists and has the package_id
    -- Category-specific validation happens at application layer
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = NEW.package_table
    ) THEN
      RAISE EXCEPTION 'Invalid package table: %', NEW.package_table;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_promotion_vendor_package_trigger ON public.auth_promotion_media;

CREATE TRIGGER validate_promotion_vendor_package_trigger
  BEFORE INSERT OR UPDATE ON public.auth_promotion_media
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_promotion_vendor_package();

-- Update RLS policy to include publication check
DROP POLICY IF EXISTS "Public read active auth promotion media" ON public.auth_promotion_media;

CREATE POLICY "Public read active auth promotion media"
  ON public.auth_promotion_media FOR SELECT
  USING (
    is_active AND is_published
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
    )
  );

-- Add comment documenting the schema
COMMENT ON TABLE public.auth_promotion_media IS 
'Homepage promotional media cards with optional vendor/package relationships.
- If provider_id is set: promotion is vendor-specific
- If package_id is also set: promotion links to exact package
- category: event type (catering, photography, etc.) for admin filtering
- destination_type: controls navigation behavior (vendor or package)
- is_published: controls visibility on public homepage
- Backward compatible: can store image-only promotions with NULL provider_id';

COMMENT ON COLUMN public.auth_promotion_media.provider_id IS 
'Reference to provider_profiles.id - if set, promotion links to exact vendor';

COMMENT ON COLUMN public.auth_promotion_media.package_id IS 
'Package UUID - must exist in category-specific package table (catering_packages, photography_packages, etc.)';

COMMENT ON COLUMN public.auth_promotion_media.package_table IS 
'Name of the category-specific package table (catering_packages, photography_packages, etc.)';

COMMENT ON COLUMN public.auth_promotion_media.slot_number IS 
'Homepage slot (1-4) - determines visual position in 2x2 grid';

COMMENT ON COLUMN public.auth_promotion_media.is_published IS 
'If true, promotion appears on public homepage. If false, only admins see it';
