# IMPLEMENTATION PLAN: VIDEO ADS UI FOR AUTH PROMOTION PAGE

**Date:** July 22, 2026  
**Status:** Pre-implementation inspection complete

---

## INSPECTION FINDINGS

### ✅ EXISTING INFRASTRUCTURE (Already Built)

All video ad infrastructure ALREADY EXISTS and is functional:

#### 1. Database Tables
- ✅ `auth_promotion_videos` — Stores videos with priority, position, user limit, status
- ✅ `auth_promotion_video_views` — Tracks unique user views with UNIQUE(video_id, user_id)
- ✅ Atomic RPC: `record_promotion_view()` — Enforces 15-user limit with database locks

#### 2. Backend Functions
**File:** `src/integrations/supabase/promotion-videos.ts` (240 LOC)
- ✅ `validatePromotionVideo()` — Validates MP4/WebM files
- ✅ `uploadPromotionVideo()` — Uploads to Supabase storage
- ✅ `createPromotionVideo()` — Creates DB record
- ✅ `fetchPromotionVideos()` — Lists all videos
- ✅ `updatePromotionVideo()` — Updates priority, position, status
- ✅ `deletePromotionVideo()` — Deletes video record
- ✅ `getActivePromotionVideo()` — RPC caller for active video
- ✅ `recordPromotionView()` — RPC caller for atomic view recording
- ✅ `deletePromotionVideoFile()` — Storage cleanup

#### 3. Frontend Components
**File:** `src/components/PromotionVideoOverlay.tsx` (185 LOC)
- ✅ Renders video overlay with close button
- ✅ Configurable position (top-left, top-right, bottom-left, bottom-right)
- ✅ Shows progress (current users / limit)
- ✅ Browser-safe autoplay (muted, playsInline)

#### 4. React Hooks
**File:** `src/hooks/usePromotionVideoAd.ts` (80 LOC)
- ✅ Fetches active video for authenticated user
- ✅ Checks if user already viewed
- ✅ Listens for admin updates via BroadcastChannel
- ✅ Provides recordView callback

#### 5. Storage Bucket
**File:** `supabase/migrations/20260923000000_auth_promotion_videos.sql`
- ✅ Bucket: `auth-promotional`
- ✅ RLS policies for public read, admin write
- ✅ Path: `promotion-videos/promo-{timestamp}-{id}.{ext}`

---

## CURRENT AUTH PROMOTION PAGE STRUCTURE

**File:** `src/pages/admin/AdminAuthPromotionalManager.tsx` (625 LOC)

Current sections (MUST NOT TOUCH):
1. ✅ Authentication Image (upload, preview, delete, overlay opacity)
2. ✅ Delete Authentication Image (red danger section)
3. ✅ Image Card 1 (slot 1, top-left, image carousel)
4. ✅ Image Card 2 (slot 2, top-right, image carousel)
5. ✅ Image Card 3 (slot 3, bottom-left, image carousel)
6. ✅ Image Card 4 (slot 4, bottom-right, image carousel)

**Note:** Sign In/Sign Out promotion sections appear to NOT be in this file (checked elsewhere or separate component)

---

## WHAT'S MISSING

**The Admin Auth Promotion page does NOT currently have:**
- ❌ UI to upload promotional videos
- ❌ UI to list promotional videos
- ❌ UI to preview videos
- ❌ UI to activate/deactivate videos
- ❌ UI to set priority order
- ❌ UI to change display position
- ❌ UI to set user limit
- ❌ UI to view unique user count
- ❌ UI to delete videos
- ❌ UI to reorder videos

**The backend infrastructure is 100% ready** — only the admin UI is missing.

---

## IMPLEMENTATION PLAN

### Files to Modify (Only 1)

**File:** `src/pages/admin/AdminAuthPromotionalManager.tsx`

**Changes:**
1. Import video management functions from `promotion-videos.ts`
2. Add state for video management (videos, uploading, etc.)
3. Add new `<section>` for "Promotional Video Ads" (after Homepage Promotion Media section)
4. Create reusable `VideoAdCard` component for each video
5. Add video upload form
6. Add video list

**Unchanged:**
- All existing image promotion sections
- All existing image upload logic
- All existing preview/delete logic
- No changes to other files

---

## NEW SECTION DESIGN

**Location:** After "Homepage Promotion Media" section

```
═══════════════════════════════════════════════════════════════
                    EXISTING SECTIONS
═══════════════════════════════════════════════════════════════

  • Authentication Image
  • Delete Authentication Image
  • Homepage Promotion Media (4 Image Cards)

═══════════════════════════════════════════════════════════════
                    NEW SECTION (TO ADD)
═══════════════════════════════════════════════════════════════

                PROMOTIONAL VIDEO ADS

┌─────────────────────────────────────────────────┐
│                                                 │
│  Manage promotional videos that appear as      │
│  overlay advertisements. Each video can be     │
│  viewed by up to 15 unique users.              │
│                                                 │
│  [Upload Video Ad]  [Reload]                   │
│                                                 │
└─────────────────────────────────────────────────┘

VIDEO UPLOAD FORM (if not uploading):
┌─────────────────────────────────────────────────┐
│ Click to upload video or drag file              │
│ MP4 or WebM • Max 100MB                         │
└─────────────────────────────────────────────────┘

VIDEO LIST:
┌─────────────────────────────────────────────────┐
│ Video 1                                         │
│ ┌──────────────┐                               │
│ │ Preview      │ Priority: 1                    │
│ │ (thumbnail)  │ Position: Bottom-Right         │
│ │              │ Limit: 15 users                │
│ │ [▶ Play]     │ Status: ACTIVE                 │
│ └──────────────┘ Reached: 8/15 users            │
│                                                 │
│ [Preview] [Activate] [Delete] [↑ ↓ Move]       │
└─────────────────────────────────────────────────┘

Video 2 (inactive)
Video 3 (inactive)
Video 4 (inactive)
...

═══════════════════════════════════════════════════════════════
```

---

## COMPONENT STRUCTURE

### Main Component Changes

**AdminAuthPromotionalManager.tsx:**
```
- Add state hooks for videos
- Add fetch and management handlers
- Add VideoUploadForm component
- Add VideoListSection component
- Add VideoCard component (repeating)
```

### New Sub-Components (inline)

**VideoUploadForm:**
- File input with drag-drop
- Preview before upload
- Upload button
- Cancel button

**VideoCard:**
- Video preview/thumbnail
- Priority number
- Display position selector
- User limit input
- Status badge (Active/Inactive)
- User count (reached / limit)
- Action buttons:
  - Preview (opens video in modal)
  - Activate/Deactivate (toggles is_active)
  - Delete (removes video + storage cleanup)
  - Priority up/down arrows (reorder)

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Setup
- [ ] Add imports from `promotion-videos.ts`
- [ ] Add state variables for videos, loading, uploading
- [ ] Add useEffect to fetch videos on mount
- [ ] Add video management handlers (create, update, delete, activate, etc.)

### Phase 2: UI Components
- [ ] Create VideoUploadForm component
- [ ] Create VideoCard component
- [ ] Create VideoListSection component

### Phase 3: Wiring
- [ ] Connect upload handler to upload function
- [ ] Connect activate/deactivate to updatePromotionVideo
- [ ] Connect delete to deletePromotionVideo + deletePromotionVideoFile
- [ ] Connect priority up/down to reorder function
- [ ] Connect preview button to modal/player

### Phase 4: Testing
- [ ] Verify existing 4 image panels unchanged
- [ ] Verify upload works
- [ ] Verify preview plays without counting
- [ ] Verify activate/deactivate toggles
- [ ] Verify delete removes video + storage
- [ ] Verify priority reorder works
- [ ] Verify user count displays
- [ ] npm run build → 0 errors

---

## REUSED EXISTING CODE

**These will be REUSED (not duplicated):**
- `uploadPromotionVideo()` — Upload to storage
- `createPromotionVideo()` — Insert to database
- `fetchPromotionVideos()` — Load all videos
- `updatePromotionVideo()` — Modify video settings
- `deletePromotionVideo()` — Delete from database
- `deletePromotionVideoFile()` — Remove from storage
- `getActivePromotionVideo()` — RPC to get active video
- `recordPromotionView()` — RPC to record view

**These will be REUSED (not duplicated):**
- Existing `toast` for notifications
- Existing Vowza UI components (buttons, inputs)
- Existing error handling patterns
- Existing RLS policies (already in database)

**No duplicate:**
- Tables
- RPCs
- Storage buckets
- Backend logic

---

## SECURITY VERIFICATION

✅ **Admin-only access:**
- Check `useAdmin()` hook (already in place)
- Only authenticated admins can access this component

✅ **RLS policies:**
- Public read: only `is_active = TRUE`
- Admin write: admin role check
- Already defined in migration 20260923000000

✅ **No service-role exposure:**
- All operations use authenticated user context
- Storage paths validated server-side

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| `src/pages/admin/AdminAuthPromotionalManager.tsx` | MODIFY | Add video section + handlers |
| `src/integrations/supabase/promotion-videos.ts` | NO CHANGE | Reuse existing functions |
| `src/components/PromotionVideoOverlay.tsx` | NO CHANGE | Already working |
| `src/hooks/usePromotionVideoAd.ts` | NO CHANGE | Already working |
| All other files | NO CHANGE | Untouched |

---

## READY TO IMPLEMENT

✅ All backend infrastructure exists  
✅ All video functions ready  
✅ Database tables ready  
✅ RLS policies ready  
✅ Storage bucket ready  
✅ Only UI missing  
✅ No code duplication needed  
✅ No regression risk  

**Proceeding with implementation…**

