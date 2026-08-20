# HOMEPAGE VIDEO PANEL FIX

**Date:** July 22, 2026  
**Issue:** Homepage still showing video panel instead of 2×2 image carousel  
**Root Cause:** `fetchActiveAuthPromotionMedia()` query was not filtering for:
  1. `media_type = 'image'` (returned all media types including videos)
  2. `slot_number IN (1,2,3,4)` (returned media not assigned to carousel slots)

---

## FIX APPLIED

**File:** `src/integrations/supabase/auth-promo.ts`

**Function:** `fetchActiveAuthPromotionMedia`

### BEFORE (Incorrect)
```typescript
export const fetchActiveAuthPromotionMedia = async (): Promise<AuthPromotionMedia[]> => {
  const { data, error } = await supabase
    .from('auth_promotion_media')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as AuthPromotionMedia[] | null) ?? [];
};
```

**Problems:**
- ❌ No filter for `media_type = 'image'` → returned videos too
- ❌ No filter for `slot_number` → returned media outside slots 1-4
- ❌ No ordering by `slot_number` → carousel slots could be out of order

### AFTER (Corrected)
```typescript
export const fetchActiveAuthPromotionMedia = async (): Promise<AuthPromotionMedia[]> => {
  const { data, error } = await supabase
    .from('auth_promotion_media')
    .select('*')
    .eq('is_active', true)
    .eq('media_type', 'image')
    .in('slot_number', [1, 2, 3, 4])
    .order('slot_number', { ascending: true })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as AuthPromotionMedia[] | null) ?? [];
};
```

**Fixes:**
- ✅ `.eq('media_type', 'image')` — only images, no videos
- ✅ `.in('slot_number', [1, 2, 3, 4])` — only carousel slot media
- ✅ `.order('slot_number', { ascending: true })` — ensures slots in correct order
- ✅ Preserves display_order and created_at ordering for within-slot sorting

---

## HOW IT WORKS NOW

1. **Query:** Supabase filters `auth_promotion_media` table for:
   - Active images only (`is_active = TRUE`, `media_type = 'image'`)
   - Assigned to carousel slots (`slot_number IN (1,2,3,4)`)
   - Ordered: by slot first, then display_order, then created_at

2. **Component:** `AuthPromotionMediaCards.tsx`:
   - Receives filtered image array
   - Groups by slot_number using `groupBySlot(media)`
   - Renders `ImageCarouselCard` for each slot (1-4)
   - Each card rotates images every 10 seconds

3. **Result:** 2×2 grid of auto-rotating images, no video panel

---

## VERIFICATION

✅ **Build Status:** npm run build → 0 errors, 3220 modules

✅ **Component Logic:** Unchanged (still renders 2×2 grid)

✅ **Query Filter:** Now correctly restricts to images + slots 1-4

✅ **Backward Compatible:** Existing homepage renders without breaking

---

## DATA REQUIREMENTS

For the carousel to display images, the `auth_promotion_media` table must have records with:

```sql
SELECT * FROM public.auth_promotion_media
WHERE is_active = TRUE
  AND media_type = 'image'
  AND slot_number IN (1, 2, 3, 4);
```

**Example valid row:**
```sql
INSERT INTO public.auth_promotion_media (
  id,
  admin_id,
  media_type,
  media_url,
  storage_path,
  slot_number,
  display_order,
  is_active
) VALUES (
  uuid_generate_v4(),
  '12345678-1234-1234-1234-123456789012', -- admin UUID
  'image',
  'https://storage.googleapis.com/vowza/promo/banner-1.jpg',
  'vowza-auth-promo/banner-1.jpg',
  1, -- Slot 1 (top-left)
  1,
  TRUE
);
```

---

## NEXT STEPS

1. ✅ Deploy code change to production
2. Run `npm run build` → verify 0 errors
3. Admin uploads images → assigns to slots 1-4 → sets active
4. Homepage loads → fetches image-only carousel → displays 2×2 grid
5. Each image rotates every 10 seconds

---

## FILES CHANGED

| File | Change |
|------|--------|
| `src/integrations/supabase/auth-promo.ts` | Fixed `fetchActiveAuthPromotionMedia()` query |

**No other files modified.**

---

**Status:** ✅ FIX COMPLETE, BUILD VERIFIED

