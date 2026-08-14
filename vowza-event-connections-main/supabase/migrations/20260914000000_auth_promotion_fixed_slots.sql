-- Convert the existing ordered homepage promotion collection into four fixed slots.
-- This is intentionally additive and is NOT applied by this code change.
-- auth_promotional_config remains untouched: it controls sign-in/authentication promotion.

ALTER TABLE public.auth_promotion_media
  ADD COLUMN IF NOT EXISTS slot_number INTEGER,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- Preserve the earliest video for Slot 1 and the earliest three images for
-- Slots 2–4. Any extra legacy records are retained but hidden and unassigned,
-- so the homepage can never render more than four active cards.
WITH ranked_media AS (
  SELECT
    id,
    media_type,
    ROW_NUMBER() OVER (
      PARTITION BY media_type
      ORDER BY display_order ASC, created_at ASC, id ASC
    ) AS type_rank
  FROM public.auth_promotion_media
)
UPDATE public.auth_promotion_media AS media
SET
  slot_number = CASE
    WHEN ranked_media.media_type = 'video' AND ranked_media.type_rank = 1 THEN 1
    WHEN ranked_media.media_type = 'image' AND ranked_media.type_rank BETWEEN 1 AND 3 THEN (ranked_media.type_rank + 1)::INTEGER
    ELSE NULL
  END,
  is_active = CASE
    WHEN ranked_media.media_type = 'video' AND ranked_media.type_rank = 1 THEN media.is_active
    WHEN ranked_media.media_type = 'image' AND ranked_media.type_rank BETWEEN 1 AND 3 THEN media.is_active
    ELSE FALSE
  END
FROM ranked_media
WHERE media.id = ranked_media.id
  AND media.slot_number IS NULL;

-- Existing data may have a photo in the first ordered position or a video in a
-- later position. Preserve it, hide it, and detach it from the fixed slot rather
-- than forcing an invalid type into a card. Admins can then safely replace the
-- affected empty slot.
UPDATE public.auth_promotion_media
SET
  is_active = FALSE,
  slot_number = NULL
WHERE (slot_number = 1 AND media_type <> 'video')
   OR (slot_number BETWEEN 2 AND 4 AND media_type <> 'image')
   OR slot_number IS NULL
   OR slot_number NOT BETWEEN 1 AND 4;

-- Remove surplus legacy rows only after preserving the earliest row assigned to
-- each slot. This keeps the first deterministic record for every slot and makes
-- the uniqueness constraint possible without deleting any records.
WITH duplicate_slots AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY slot_number ORDER BY display_order ASC, created_at ASC, id ASC) AS duplicate_rank
  FROM public.auth_promotion_media
  WHERE slot_number BETWEEN 1 AND 4
)
UPDATE public.auth_promotion_media AS media
SET is_active = FALSE,
    slot_number = NULL
FROM duplicate_slots
WHERE media.id = duplicate_slots.id
  AND duplicate_slots.duplicate_rank > 1;

ALTER TABLE public.auth_promotion_media
  ADD CONSTRAINT auth_promotion_media_slot_number_range
    CHECK (slot_number BETWEEN 1 AND 4) NOT VALID,
  ADD CONSTRAINT auth_promotion_media_slot_media_type
    CHECK (
      (slot_number = 1 AND media_type = 'video')
      OR (slot_number BETWEEN 2 AND 4 AND media_type = 'image')
      OR slot_number IS NULL
    ) NOT VALID,
  ADD CONSTRAINT auth_promotion_media_file_size_nonnegative
    CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0) NOT VALID,
  ADD CONSTRAINT auth_promotion_media_active_requires_slot
    CHECK (slot_number IS NOT NULL OR is_active = FALSE) NOT VALID;

-- Exactly one database row may own each homepage card. Slots can be empty after
-- deletion; the frontend renders the matching branded fallback in that case.
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_promotion_media_unique_slot
  ON public.auth_promotion_media (slot_number)
  WHERE slot_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_active_slot
  ON public.auth_promotion_media (is_active, slot_number)
  WHERE slot_number IS NOT NULL;

-- Legacy rows retain a NULL slot only while hidden; active records must always
-- belong to one of the four slots. The application always writes a slot number.

-- Validate after the deterministic backfill and type cleanup above.
ALTER TABLE public.auth_promotion_media
  VALIDATE CONSTRAINT auth_promotion_media_slot_number_range,
  VALIDATE CONSTRAINT auth_promotion_media_slot_media_type,
  VALIDATE CONSTRAINT auth_promotion_media_file_size_nonnegative,
  VALIDATE CONSTRAINT auth_promotion_media_active_requires_slot;
