-- Fix: Allow all 4 slots to accept images (not just videos for Slot 1)
-- Previous constraint forced Slot 1 to be video-only
-- Now all 4 slots accept images only

-- Drop the old constraint that enforced video-only for Slot 1
ALTER TABLE public.auth_promotion_media
DROP CONSTRAINT IF EXISTS auth_promotion_media_slot_media_type;

-- Drop the unique index that allowed only one video per slot
DROP INDEX IF EXISTS public.idx_auth_promotion_media_unique_slot;

-- Deactivate and clear slot_number from any videos that might exist
UPDATE public.auth_promotion_media
SET is_active = FALSE, slot_number = NULL
WHERE slot_number BETWEEN 1 AND 4 AND media_type = 'video';

-- Add new constraint: all slots 1-4 can only have images (no more videos in slots)
ALTER TABLE public.auth_promotion_media
ADD CONSTRAINT auth_promotion_media_slot_image_only
  CHECK (
    (slot_number BETWEEN 1 AND 4 AND media_type = 'image')
    OR slot_number IS NULL
  );

-- Create new unique index allowing multiple images per slot (display_order differentiates them)
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_promotion_media_unique_slot_order
  ON public.auth_promotion_media (slot_number, display_order)
  WHERE slot_number IS NOT NULL;

-- Verify constraint and index are in place
CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_active_slot_order
  ON public.auth_promotion_media (slot_number, display_order, created_at)
  WHERE is_active = TRUE AND slot_number IS NOT NULL;
