-- Allow ordered playlists inside the existing four immutable homepage cards.
-- This follows 20260913000000 and 20260914000000 and is NOT applied by this local change.
-- Reuses is_active as the existing publication flag; auth_promotional_config remains untouched.

-- The previous partial unique index allowed only one row per card. Remove it so
-- slot 1 can own multiple videos and slots 2–4 can own independent photo lists.
DROP INDEX IF EXISTS public.idx_auth_promotion_media_unique_slot;

-- Normalise existing fixed-slot content to the first list position, retaining
-- all existing records and preserving hidden/unassigned legacy rows.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY slot_number ORDER BY display_order, created_at, id) - 1 AS ordered_position
  FROM public.auth_promotion_media
  WHERE slot_number BETWEEN 1 AND 4
)
UPDATE public.auth_promotion_media media
SET display_order = ranked.ordered_position
FROM ranked
WHERE media.id = ranked.id;

-- Each card may have many entries, but every order position belongs to exactly
-- one record within that card. The prior slot/type constraint still enforces
-- one video card (#1) and three image cards (#2–#4).
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_promotion_media_unique_slot_order
  ON public.auth_promotion_media (slot_number, display_order)
  WHERE slot_number IS NOT NULL;

DROP INDEX IF EXISTS public.idx_auth_promotion_media_active_slot;
CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_active_slot_order
  ON public.auth_promotion_media (slot_number, display_order, created_at)
  WHERE is_active = TRUE AND slot_number IS NOT NULL;
