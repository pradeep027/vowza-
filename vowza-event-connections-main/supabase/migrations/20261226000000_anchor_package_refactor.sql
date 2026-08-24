-- Anchor Package Refactor Migration
-- Date: 2026-12-26
-- Purpose: Refactor package_type from single text value to array of 17 event classifications
-- Architecture: SINGLE AUTHORITATIVE FIELD = package_type (TEXT[] array)
-- NO SEPARATE EVENT_TYPES FIELD - consolidation complete
-- Risk: LOW - data migration is backward compatible

-- Step 1: Create backup of current data
CREATE TABLE IF NOT EXISTS public.anchor_packages_backup_pre_refactor AS 
SELECT * FROM public.anchor_packages;

-- Step 2: Add temporary column to hold array values
ALTER TABLE public.anchor_packages
ADD COLUMN IF NOT EXISTS package_type_array TEXT[] DEFAULT '{}';

-- Step 3: Migrate data from old text field to new array field
-- Converts single string value (e.g., "Reception Host") to array
-- Smart extraction: Removes "Host", "Anchor", "Emcee" suffixes and wraps in array
-- Examples: 
--   "Reception Host" → ["Reception"]
--   "Wedding Anchor" → ["Wedding"]  
--   "Birthday Emcee" → ["Birthday"]
--   "Custom value" → ["Custom value"]
UPDATE public.anchor_packages
SET package_type_array = CASE 
  -- Extract event type before " Host" suffix
  WHEN package_type LIKE '% Host' THEN 
    ARRAY[TRIM(SUBSTRING(package_type, 1, LENGTH(package_type) - 5))::TEXT]::TEXT[]
  -- Extract event type before " Anchor" suffix
  WHEN package_type LIKE '% Anchor' THEN 
    ARRAY[TRIM(SUBSTRING(package_type, 1, LENGTH(package_type) - 7))::TEXT]::TEXT[]
  -- Extract event type before " Emcee" suffix
  WHEN package_type LIKE '% Emcee' THEN 
    ARRAY[TRIM(SUBSTRING(package_type, 1, LENGTH(package_type) - 6))::TEXT]::TEXT[]
  -- For values without suffix or new values, use as-is
  WHEN package_type IS NOT NULL AND package_type != '' 
  THEN ARRAY[package_type::TEXT]::TEXT[]
  -- NULL or empty becomes empty array
  ELSE '{}'::TEXT[]
END
WHERE package_type_array = '{}';

-- Step 4: Drop old package_type column
ALTER TABLE public.anchor_packages
DROP COLUMN package_type;

-- Step 5: Rename array column to be the new package_type
ALTER TABLE public.anchor_packages
RENAME COLUMN package_type_array TO package_type;

-- Step 6: Add constraint to ensure at least one classification
ALTER TABLE public.anchor_packages
ADD CONSTRAINT check_package_type_not_empty CHECK (array_length(package_type, 1) > 0);

-- Step 7: Create GIN index for array queries (performance)
CREATE INDEX IF NOT EXISTS idx_anchor_packages_package_type 
ON public.anchor_packages USING GIN (package_type);

-- Step 8: Add comment documenting the new schema
COMMENT ON COLUMN public.anchor_packages.package_type IS 
'Array of 17 event classifications (SINGLE AUTHORITATIVE FIELD - replaces old text field): Wedding, Reception, Baraat, Engagement, Sangeet, Haldi, Mehendi, Birthday, Anniversary, Corporate Event, College Fest, Cultural Event, Private Party, Public Event, Religious Event, Award Function, Custom Event. Multi-select, drag-drop supported. NO separate event_types field.';

-- Verification queries (run these to verify migration):
-- SELECT COUNT(*) FROM public.anchor_packages WHERE array_length(package_type, 1) IS NULL;
-- SELECT COUNT(*) FROM public.anchor_packages WHERE array_length(package_type, 1) = 0;
-- SELECT DISTINCT package_type FROM public.anchor_packages LIMIT 5;

-- Rollback script (if needed - must run in reverse order):
-- ALTER TABLE public.anchor_packages DROP COLUMN IF EXISTS package_type;
-- ALTER TABLE public.anchor_packages RENAME COLUMN package_type_backup TO package_type;
-- DROP INDEX IF EXISTS idx_anchor_packages_package_type;
-- DROP TABLE IF EXISTS public.anchor_packages_backup_pre_refactor;
