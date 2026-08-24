-- Verify migration 20261001000000 was applied successfully
-- Check for new columns on photography_videography_packages

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name IN ('photography_videography_packages', 'photography_videography_package_images')
  AND column_name IN ('advance_percentage', 'event_type', 'media_type', 'duration_seconds', 'thumbnail_url')
ORDER BY table_name, column_name;
