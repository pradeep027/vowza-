-- Merge Photography & Videography into unified customer-facing category with package types
-- Adds package_type column to support photography_only, videography_only, and combined packages

-- ═════════════════════════════════════════════════════════════════════════════════
-- ADD PACKAGE_TYPE COLUMN TO photography_packages
-- ═════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.photography_packages
ADD COLUMN IF NOT EXISTS package_type TEXT DEFAULT 'photography_only' 
CHECK (package_type IN ('photography_only', 'videography_only', 'photography_and_videography'));

COMMENT ON COLUMN public.photography_packages.package_type IS 'Package type: photography_only, videography_only, or photography_and_videography';

-- ═════════════════════════════════════════════════════════════════════════════════
-- ADD VIDEOGRAPHY FIELDS TO photography_packages FOR COMBINED PACKAGES
-- ═════════════════════════════════════════════════════════════════════════════════

-- For combined packages, store videography details
ALTER TABLE public.photography_packages
ADD COLUMN IF NOT EXISTS videography_included BOOLEAN DEFAULT FALSE;

ALTER TABLE public.photography_packages
ADD COLUMN IF NOT EXISTS videography_team_videographers INTEGER DEFAULT 1;

ALTER TABLE public.photography_packages
ADD COLUMN IF NOT EXISTS videography_team_assistants INTEGER DEFAULT 0;

ALTER TABLE public.photography_packages
ADD COLUMN IF NOT EXISTS videography_team_drone_operator BOOLEAN DEFAULT FALSE;

ALTER TABLE public.photography_packages
ADD COLUMN IF NOT EXISTS videography_coverage_hours TEXT;

ALTER TABLE public.photography_packages
ADD COLUMN IF NOT EXISTS videography_deliverables TEXT[] DEFAULT '{}';

ALTER TABLE public.photography_packages
ADD COLUMN IF NOT EXISTS videography_delivery_time TEXT;

ALTER TABLE public.photography_packages
ADD COLUMN IF NOT EXISTS videography_equipment TEXT[] DEFAULT '{}';

ALTER TABLE public.photography_packages
ADD COLUMN IF NOT EXISTS videography_editing_options TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.photography_packages.videography_included IS 'Indicates if this combined package includes videography services';
COMMENT ON COLUMN public.photography_packages.videography_team_videographers IS 'Number of videographers for combined packages';
COMMENT ON COLUMN public.photography_packages.videography_coverage_hours IS 'Videography coverage hours for combined packages';

-- ═════════════════════════════════════════════════════════════════════════════════
-- ADD PHOTOGRAPHY FIELDS TO videography_packages FOR COMBINED PACKAGES
-- ═════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.videography_packages
ADD COLUMN IF NOT EXISTS package_type TEXT DEFAULT 'videography_only'
CHECK (package_type IN ('photography_only', 'videography_only', 'photography_and_videography'));

ALTER TABLE public.videography_packages
ADD COLUMN IF NOT EXISTS photography_included BOOLEAN DEFAULT FALSE;

ALTER TABLE public.videography_packages
ADD COLUMN IF NOT EXISTS photography_team_size INTEGER DEFAULT 1;

ALTER TABLE public.videography_packages
ADD COLUMN IF NOT EXISTS photography_team_size_custom TEXT;

ALTER TABLE public.videography_packages
ADD COLUMN IF NOT EXISTS photography_edited_photos INTEGER;

ALTER TABLE public.videography_packages
ADD COLUMN IF NOT EXISTS photography_unlimited_edited BOOLEAN DEFAULT FALSE;

ALTER TABLE public.videography_packages
ADD COLUMN IF NOT EXISTS photography_album_included BOOLEAN DEFAULT FALSE;

ALTER TABLE public.videography_packages
ADD COLUMN IF NOT EXISTS photography_album_details TEXT;

ALTER TABLE public.videography_packages
ADD COLUMN IF NOT EXISTS photography_deliverables TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.videography_packages.package_type IS 'Package type: photography_only, videography_only, or photography_and_videography';
COMMENT ON COLUMN public.videography_packages.photography_included IS 'Indicates if this combined package includes photography services';
COMMENT ON COLUMN public.videography_packages.photography_team_size IS 'Number of photographers for combined packages';

-- ═════════════════════════════════════════════════════════════════════════════════
-- CREATE photography_videography_packages TABLE FOR UNIFIED MANAGEMENT
-- ═════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.photography_videography_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  
  -- Core fields
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  description TEXT,
  package_type TEXT NOT NULL CHECK (package_type IN ('photography_only', 'videography_only', 'photography_and_videography')),
  
  -- Pricing
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  duration TEXT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  view_count INTEGER NOT NULL DEFAULT 0,
  
  -- Photography fields
  photography_team_size INTEGER DEFAULT 1,
  photography_team_size_custom TEXT,
  photography_edited_photos INTEGER,
  photography_unlimited_edited BOOLEAN DEFAULT FALSE,
  photography_raw_photos_included BOOLEAN DEFAULT FALSE,
  photography_album_included BOOLEAN DEFAULT FALSE,
  photography_album_details TEXT,
  photography_pre_event_shoot BOOLEAN DEFAULT FALSE,
  photography_deliverables TEXT[] DEFAULT '{}',
  photography_delivery_time TEXT,
  
  -- Videography fields
  videography_team_videographers INTEGER DEFAULT 1,
  videography_team_assistants INTEGER DEFAULT 0,
  videography_team_drone_operator BOOLEAN DEFAULT FALSE,
  videography_team_editor INTEGER DEFAULT 1,
  videography_coverage_hours TEXT,
  videography_event_types TEXT[] DEFAULT '{}',
  videography_included_services TEXT[] DEFAULT '{}',
  videography_deliverables TEXT[] DEFAULT '{}',
  videography_delivery_time TEXT,
  videography_equipment TEXT[] DEFAULT '{}',
  videography_editing_options TEXT[] DEFAULT '{}',
  videography_pre_event_shoot BOOLEAN DEFAULT FALSE,
  
  -- Travel
  travel_included BOOLEAN DEFAULT FALSE,
  travel_radius_km INTEGER,
  travel_extra_charge NUMERIC(12,2),
  travel_details JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photography_videography_packages_provider_idx 
  ON public.photography_videography_packages(provider_id, is_active, is_visible);
CREATE INDEX IF NOT EXISTS photography_videography_packages_type_idx 
  ON public.photography_videography_packages(package_type);

-- ═════════════════════════════════════════════════════════════════════════════════
-- CREATE RELATED TABLES FOR UNIFIED PACKAGES
-- ═════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.photography_videography_package_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.photography_videography_packages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  alt_text TEXT,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photography_videography_images_package_idx 
  ON public.photography_videography_package_images(package_id);

CREATE TABLE IF NOT EXISTS public.photography_videography_package_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.photography_videography_packages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photography_videography_addons_package_idx 
  ON public.photography_videography_package_addons(package_id);

CREATE TABLE IF NOT EXISTS public.photography_videography_package_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.photography_videography_packages(id),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  event_type TEXT,
  event_date DATE NOT NULL,
  event_time TEXT,
  venue TEXT,
  notes TEXT,
  selected_addon_ids UUID[] NOT NULL DEFAULT '{}',
  base_amount NUMERIC(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photography_videography_bookings_provider_idx 
  ON public.photography_videography_package_bookings(provider_id, created_at DESC);

-- ═════════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═════════════════════════════════════════════════════════════════════════════════

DO $$ DECLARE t text; BEGIN 
  FOREACH t IN ARRAY ARRAY['photography_videography_packages', 'photography_videography_package_images', 'photography_videography_package_addons', 'photography_videography_package_bookings'] 
  LOOP 
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN 
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t); 
    END IF; 
  END LOOP; 
END $$;

-- ═════════════════════════════════════════════════════════════════════════════════
-- TRIGGERS FOR UPDATED_AT
-- ═════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.photography_videography_updated_at() 
RETURNS TRIGGER LANGUAGE plpgsql AS $$ 
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END $$;

DROP TRIGGER IF EXISTS photography_videography_packages_updated_at ON public.photography_videography_packages;
CREATE TRIGGER photography_videography_packages_updated_at 
  BEFORE UPDATE ON public.photography_videography_packages 
  FOR EACH ROW EXECUTE FUNCTION public.photography_videography_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKET
-- ═════════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets(id, name, public) 
VALUES ('photography-videography-package-images', 'photography-videography-package-images', true) 
ON CONFLICT(id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════════
-- REALTIME PUBLICATION
-- ═════════════════════════════════════════════════════════════════════════════════

DO $$ DECLARE t text; BEGIN 
  FOREACH t IN ARRAY ARRAY['photography_videography_packages', 'photography_videography_package_images', 'photography_videography_package_addons', 'photography_videography_package_bookings'] 
  LOOP 
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN 
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t); 
    END IF; 
  END LOOP; 
  EXCEPTION WHEN OTHERS THEN NULL; 
END $$;
