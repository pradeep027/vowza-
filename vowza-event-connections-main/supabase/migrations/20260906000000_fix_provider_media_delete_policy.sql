-- ============================================================
-- Fix provider-media storage delete policy
-- The upload path is: portfolio/{vendorId}_{timestamp}_{random}.{ext}
-- The old delete policy checked auth.uid() == foldername[1], but foldername[1] = 'portfolio'
-- Fix: allow any authenticated user to delete from provider-media bucket
-- (DB-level portfolio_items RLS already ensures only the owner can access their items)
-- ============================================================

DROP POLICY IF EXISTS "Users can delete own provider media" ON storage.objects;

CREATE POLICY "Authenticated users can delete provider media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'provider-media' AND auth.role() = 'authenticated'
);
