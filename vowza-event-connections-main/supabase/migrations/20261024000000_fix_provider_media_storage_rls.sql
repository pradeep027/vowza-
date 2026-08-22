-- ════════════════════════════════════════════════════════════════════════════════
-- Migration: 20261024000000_fix_provider_media_storage_rls
-- Purpose: Fix storage RLS policies for provider-media bucket
-- 
-- Issue: UPDATE/DELETE policies incorrectly extract folder name instead of user ID
-- from file path. Path format: covers/{vendorId}_{timestamp}.jpg
-- Old policy: auth.uid()::text = (storage.foldername(name))[1]
-- Problem: [1] extracts 'covers' not user ID, so auth check always fails
--
-- Solution: Restructure path to include user_id as first folder level
-- New format: {user_id}/{folder}/{file.jpg}
-- Example: 550e8400-e29b-41d4-a716-446655440000/covers/{vendorId}_{timestamp}.jpg
--
-- This allows correct policy: auth.uid()::text = (storage.foldername(name))[1]
-- ════════════════════════════════════════════════════════════════════════════════

-- Drop existing broken policies (they prevent UPDATE/DELETE for all users)
DROP POLICY IF EXISTS "Users can update own provider media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own provider media" ON storage.objects;

-- Create corrected UPDATE policy
-- Extracts user_id from first folder level: {user_id}/...
CREATE POLICY "Users can update own provider media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'provider-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create corrected DELETE policy
-- Extracts user_id from first folder level: {user_id}/...
CREATE POLICY "Users can delete own provider media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'provider-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Note: The file path structure in ImageUpload.tsx must be updated from:
--   covers/{vendorId}_{timestamp}.jpg
-- to:
--   {user_id}/covers/{vendorId}_{timestamp}.jpg
-- 
-- This ensures the first folder level is the user_id, which the RLS policy can extract.
-- ════════════════════════════════════════════════════════════════════════════════
