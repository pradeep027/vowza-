# SLOT 1 IMAGE UPLOAD FIX

**Date:** July 22, 2026  
**Issue:** Admin panel Slot 1 was still showing "Upload Video" instead of "Upload Image"  
**Root Cause:** AdminAuthPromotionalManager component had separate logic for Slot 1 (video) vs Slots 2-4 (images)

---

## FIXES APPLIED

### File: `src/pages/admin/AdminAuthPromotionalManager.tsx`

#### **FIX 1: Updated Section Header**
- **Before:** "Video Card" icon + "Manage four fixed media cards on the homepage. Upload video or photos for each position."
- **After:** "Image Card" icon + "Manage four fixed image cards on the homepage in a 2×2 grid. Upload images for each position."

#### **FIX 2: Unified All 4 Slots to Image-Only**
- **Before:** 
  - Slot 1: Video upload only
  - Slots 2-4: Image upload only
  
- **After:**
  - Slots 1-4: All image upload only

#### **FIX 3: Updated Slot Titles & Descriptions**
- **Before:** 
  - Slot 1: "Video Card"
  - Slots 2-4: "Photo Card 1", "Photo Card 2", "Photo Card 3"

- **After:**
  - Slot 1: "Image Card 1" (top-left position)
  - Slot 2: "Image Card 2" (top-right position)
  - Slot 3: "Image Card 3" (bottom-left position)
  - Slot 4: "Image Card 4" (bottom-right position)

#### **FIX 4: Force media_type = 'image' for All Slots**
Changed upload logic from:
```typescript
media_type: uploaded.mediaType  // Could be video or image
```

To:
```typescript
media_type: 'image'  // Always image
```

This ensures even if a video file somehow passes validation, it's stored as 'image' type.

#### **FIX 5: Import Type for Type Safety**
Added import:
```typescript
type HomepagePromotionSlotNumber,
```

And applied proper TypeScript casting in slot numbering.

---

## CHANGES SUMMARY

| Component | Before | After |
|-----------|--------|-------|
| Homepage Promotion Section | Video icon + mixed media | Image icon + image-only |
| Slot 1 Upload | "Upload Video" button | "Upload Image" button |
| Slot 1 File Types | MP4, WebM | JPG, PNG, WebP |
| Slot 1 Description | "Homepage top-left video position" | "Homepage top-left image position" |
| All Slot Media Type | Mixed (video/image) | Images only |
| All Slot Titles | Inconsistent | Consistent "Image Card 1-4" |

---

## BUILD VERIFICATION

✅ **npm run build:** 0 errors, 3220 modules transformed

✅ **No TypeScript errors**

✅ **Component renders correctly with all 4 image-upload slots**

---

## WHAT USERS WILL SEE

### Admin Panel: `/admin/auth-promotion`

**Homepage Promotion Media Section:**

1. **Image Card 1** (top-left image position)
   - Upload button: "Upload Image"
   - File types: JPG, PNG, WebP
   - Max 100MB

2. **Image Card 2** (top-right image position)
   - Upload button: "Upload Image"
   - File types: JPG, PNG, WebP
   - Max 100MB

3. **Image Card 3** (bottom-left image position)
   - Upload button: "Upload Image"
   - File types: JPG, PNG, WebP
   - Max 100MB

4. **Image Card 4** (bottom-right image position)
   - Upload button: "Upload Image"
   - File types: JPG, PNG, WebP
   - Max 100MB

All slots now consistently ask for images only.

---

## SYSTEM 2 (NOT AFFECTED)

The "Auth Promotion Video Ads" system (separate from homepage carousel) is unaffected. This is the overlay video system that:
- Uses `auth_promotion_videos` table (separate from `auth_promotion_media`)
- Can still upload videos
- Displays as overlay advertisement
- Managed from a different admin section

---

## DEPLOYMENT

After deploying this code change:

1. Admin navigates to `/admin/auth-promotion`
2. Scrolls to "Homepage Promotion Media" section
3. Sees 4 "Image Card" slots (1-4)
4. All slots now show "Upload Image" button
5. All slots accept only JPG, PNG, WebP
6. No more "Upload Video" option for Slot 1

---

## VERIFICATION CHECKLIST

- ✅ Slot 1 no longer shows "Upload Video"
- ✅ Slot 1 shows "Upload Image"
- ✅ All 4 slots accept images only
- ✅ All 4 slots have consistent UI/UX
- ✅ Images auto-rotate every 10 seconds on homepage
- ✅ Build succeeds (0 errors)
- ✅ No breaking changes to other features

---

**Status:** ✅ COMPLETE, READY FOR DEPLOYMENT

