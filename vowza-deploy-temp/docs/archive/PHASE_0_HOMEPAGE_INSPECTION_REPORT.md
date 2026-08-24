# PHASE 0 INSPECTION REPORT: Homepage Image Carousel + Auth Promotion Video Ads

**Date:** July 22, 2026  
**Status:** INSPECTION COMPLETE — AWAITING USER APPROVAL  
**Scope:** Homepage architecture, Auth Promotion system, database structure, admin interface

---

## EXECUTIVE SUMMARY

The Vowza homepage currently uses the **AuthPromotionMediaCards** component which renders:
- **Slot 1 (top-left):** Video promotional playlist
- **Slots 2-4 (remaining):** 10-second rotating image carousels

**REQUIREMENT:** Replace the video panel with an image-only carousel, AND create a separate Auth Promotion Video Ads system with 15-user atomic tracking.

**KEY FINDING:** Current system can be cleanly split into two independent systems with minimal changes to existing code.

---

## CURRENT ARCHITECTURE

### Homepage Layout (Index.tsx)
```
src/pages/Index.tsx
├─ Navbar
├─ Hero (DesktopHero + MobileHero)
│  ├─ AuthPromotionMediaCards (Desktop variant)
│  └─ AuthPromotionMediaCards (Mobile variant)
├─ TrendingCategories
├─ BrowseByEvent
├─ WhyVowza
├─ HowItWorks
├─ FAQSection
├─ DownloadApp
└─ Footer
```

### Hero Component (Hero.tsx)
- **Line 168:** `<AuthPromotionMediaCards variant="desktop" />`
- **Line 178:** Mobile fallback via MobileHero
- Displays 4 cards in 2×2 grid on desktop
- Responsive grid on mobile

### AuthPromotionMediaCards Component (AuthPromotionMediaCards.tsx)
```
AuthPromotionMediaCards
├─ Slot 1: VideoPromotionCard
│  ├─ Fetches active videos
│  ├─ Plays first video
│  ├─ Auto-advances on end
│  ├─ Respects visibility/focus state
│  └─ Supports mute/unmute
├─ Slot 2: PhotoPromotionCard (10-second rotation)
├─ Slot 3: PhotoPromotionCard (10-second rotation)
└─ Slot 4: PhotoPromotionCard (10-second rotation)
```

**Current Implementation Details:**
- **VideoPromotionCard:** Fully featured video player with browser autoplay policy handling
- **PhotoPromotionCard:** Simple image carousel with `PHOTO_DURATION_MS` (30 seconds default)
- **Fallback UI:** Shows branded fallback when no media assigned
- **Grid layout:** 2×2 on desktop, responsive on mobile

### Database Schema (auth_promotion_media)

```sql
CREATE TABLE public.auth_promotion_media (
  id UUID PRIMARY KEY,
  admin_id UUID NOT NULL (REFERENCES auth.users),
  media_type TEXT ('image' | 'video'),
  media_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  display_order INTEGER NOT NULL (≥0),
  slot_number INTEGER (1-4) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  file_size_bytes BIGINT (optional),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CONSTRAINTS:
- slot_number: 1-4 range OR NULL
- media_type + slot enforcement: video→slot 1, image→slots 2-4
- active_requires_slot: is_active=TRUE → slot_number NOT NULL
- unique_slot: UNIQUE(slot_number WHERE slot_number IS NOT NULL)
```

**Indexes:**
- `idx_auth_promotion_media_active_order`
- `idx_auth_promotion_media_unique_slot`
- `idx_auth_promotion_media_active_slot`

### Admin Interface (AdminAuthPromotionalManager.tsx)

**Features:**
- Upload images/videos per slot
- Preview before upload
- Toggle active/inactive
- Delete media
- Reorder via `display_order`
- File validation (JPG/PNG/WebP/MP4/WebM)
- Max file size: 100MB for videos, 10MB for images

**UI:**
- Separate card for each slot
- Shows current items with thumbnail
- Drag-n-drop upload
- Real-time preview

### Storage Setup (auth-promotional bucket)

```sql
Bucket: 'auth-promotional' (public)
Storage path structure:
  promotional-images/promo-{timestamp}-{uuid}.{ext}      (auth config images)
  promotion-media/{image|video}/promo-{timestamp}-{uuid}.{ext}
```

**RLS Policies:**
- Public: READ auth_promotion_media (is_active=true)
- Admin only: INSERT, UPDATE, DELETE
- Storage: Public read, admin write/delete

### Current Hooks & Types

**Hook: useAuthPromotionMedia.ts**
```typescript
function useAuthPromotionMedia(): {
  media: AuthPromotionMedia[],
  isLoading: boolean,
  refresh: () => Promise<void>
}
```
- Fetches active media on mount
- Listens to AUTH_PROMO_UPDATED_EVENT
- Real-time sync across tabs via BroadcastChannel

**Types (auth-promo.ts):**
```typescript
type AuthPromoMediaType = 'image' | 'video'

interface AuthPromotionMedia {
  id: string
  admin_id: string
  media_type: AuthPromoMediaType
  media_url: string
  storage_path: string
  display_order: number
  slot_number?: number    // Currently used but not typed in interface
  is_active: boolean
  created_at: string
  updated_at: string
}
```

---

## CURRENT PROBLEMS IDENTIFIED

1. **Type Definition Gap:** `slot_number` not in AuthPromotionMedia interface (stored in DB but not typed)
2. **Photo Duration:** 30 seconds hardcoded in promotionMediaPlaylist — should be 10 seconds per spec
3. **Video Slot Mandatory:** Currently Slot 1 always expects a video — should support image-only carousels
4. **No User Tracking:** Zero tracking of who viewed promotions
5. **No 15-User Limit:** No mechanism to limit videos to 15 unique users
6. **No Promotion Sequencing:** No concept of "next video after 15 users"
7. **No Overlay Positioning:** Promotional videos will need position config (top, bottom, left, right)

---

## PROPOSED ARCHITECTURE

### System 1: Homepage Image Carousel (Images Only)

**Changes:**
1. Modify `AuthPromotionMediaCards` to display **images only** in all 4 slots
2. Remove `VideoPromotionCard` component
3. Replace with `ImageCarouselCard` that rotates images every 10 seconds
4. Preserve existing Slot 1-4 system but make all slots image-based
5. Update database constraint to allow any media_type (no slot-type enforcement)

**Component Structure:**
```
AuthPromotionMediaCards (Homepage variant)
├─ ImageCarouselCard (Slot 1, 10-sec rotation)
├─ ImageCarouselCard (Slot 2, 10-sec rotation)
├─ ImageCarouselCard (Slot 3, 10-sec rotation)
└─ ImageCarouselCard (Slot 4, 10-sec rotation)
```

**Behavior:**
- Images auto-rotate every 10 seconds
- Loop infinitely
- Smooth transitions
- No page reloads
- Frontend-only state (no DB changes needed per rotation)

**Database Changes:** NONE for carousel itself

---

### System 2: Auth Promotion Video Ads (Separate, Overlay-Based)

**New Table: auth_promotion_videos**

```sql
CREATE TABLE public.auth_promotion_videos (
  id UUID PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id),
  video_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  priority_order INTEGER NOT NULL (≥0),  -- Admin-defined sequence
  display_position TEXT DEFAULT 'bottom-right',  -- top|bottom left|right
  user_limit INTEGER DEFAULT 15,         -- Max unique users per video
  unique_users_reached INTEGER DEFAULT 0, -- Incremental counter
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

UNIQUE INDEX: (priority_order) WHERE is_active=TRUE
-- Ensures only one video per priority when active
```

**New Table: auth_promotion_video_views**

```sql
CREATE TABLE public.auth_promotion_video_views (
  id UUID PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES auth_promotion_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT NOW(),
  watch_duration_seconds INTEGER,
  was_closed BOOLEAN DEFAULT FALSE,
  
  UNIQUE(video_id, user_id)  -- Prevent duplicate counting
);

INDEX: (video_id, viewed_at)
INDEX: (user_id, viewed_at)
```

**RPC Function: get_active_promotion_video()**

```sql
FUNCTION get_active_promotion_video(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  video_url TEXT,
  priority_order INTEGER,
  display_position TEXT,
  user_limit INTEGER,
  unique_users_reached INTEGER,
  has_user_viewed BOOLEAN
)

Logic:
1. Find first active video ordered by priority_order ASC
2. Check if user_id already in views for this video
3. Return video + has_user_viewed flag
4. If has_user_viewed=FALSE, caller should insert view record
```

**RPC Function: record_promotion_view()**

```sql
FUNCTION record_promotion_view(
  p_video_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN

Logic (ATOMIC):
1. Check if view already exists for this video+user
2. If exists: return FALSE (already viewed)
3. If new:
   a. INSERT into auth_promotion_video_views
   b. Get current unique_users_reached for video
   c. IF unique_users_reached < user_limit:
      - INCREMENT unique_users_reached
      - IF now equals user_limit: DEACTIVATE this video, ACTIVATE next
      - RETURN TRUE (view recorded successfully)
   d. ELSE: RETURN FALSE (limit reached, view not recorded)
```

---

## DATABASE CHANGES REQUIRED

### Migration 1: Create Promotion Video Tables

**File:** `supabase/migrations/20260923000000_auth_promotion_videos.sql`

```sql
-- New tables
CREATE TABLE public.auth_promotion_videos (...)
CREATE TABLE public.auth_promotion_video_views (...)

-- RLS Policies
-- admin_promotion_videos_select: public users see only active
-- admin_promotion_videos_insert/update/delete: admin only
-- user_video_views_insert: authenticated users only
-- user_video_views_select: users see only their own views

-- RPCs
CREATE FUNCTION get_active_promotion_video(UUID)
CREATE FUNCTION record_promotion_view(UUID, UUID)

-- Indexes & constraints
```

### Migration 2: Update Homepage Media Constraints (Optional)

**File:** `supabase/migrations/20260924000000_homepage_media_image_only.sql`

Remove type-to-slot constraints if separating video system:
```sql
ALTER TABLE public.auth_promotion_media
  DROP CONSTRAINT auth_promotion_media_slot_media_type;
  -- Or keep it and disallow videos entirely from slots
```

---

## FRONTEND CHANGES REQUIRED

### 1. New Component: ImageCarouselCard.tsx

```typescript
interface ImageCarouselCardProps {
  images: AuthPromotionMedia[]
  slot: 1 | 2 | 3 | 4
  rotationSeconds?: number  // default 10
}

Features:
- Auto-rotate every rotationSeconds
- Smooth fade transitions
- Handle empty state
- Responsive sizing
- No page reloads
```

### 2. Modified: AuthPromotionMediaCards.tsx

```typescript
Changes:
- Remove VideoPromotionCard component
- Replace all 4 slots with ImageCarouselCard
- Update variant to 'homepage' (desktop/mobile handling)
- Remove video-specific logic
```

### 3. New Component: PromotionVideoOverlay.tsx

```typescript
interface PromotionVideoOverlayProps {
  video: PromotionVideo
  onClose: () => void
  onVideoEnd?: () => void
}

Features:
- Render video as overlay
- Close button (X) visible
- Stop playback on close
- Auto-hide after close
- Respect position config (top/bottom/left/right)
- Browser autoplay policy handling
- Track view start (defer end until user confirms view)
```

### 4. New Hook: usePromotionVideoAd.ts

```typescript
function usePromotionVideoAd() {
  const [video, setVideo] = useState<PromotionVideo | null>(null)
  const [viewed, setViewed] = useState(false)
  const user = useAuth().user
  
  // On component mount:
  // 1. If authenticated: fetch active promotion video
  // 2. If has_user_viewed=FALSE: show overlay
  // 3. On close: call record_promotion_view RPC
  // 4. If RPC returns TRUE (recorded): mark as viewed
}
```

### 5. Modified: App.tsx or Root Layout

```typescript
Add <PromotionVideoOverlay /> at root level
- Persists across page navigations
- Only shows to authenticated users
- Dismissable permanently during session
```

### 6. Updated: AdminAuthPromotionalManager.tsx

```typescript
Add new section: "Promotional Videos"
- Separate from Slots 1-4 (homepage media)
- Upload video
- Set priority order
- Configure display position
- View user count / limit
- Enable/disable video
```

---

## IMPLEMENTATION PLAN

### Phase 3A: Database Migrations
1. Create auth_promotion_videos table
2. Create auth_promotion_video_views table
3. Create RPCs (get_active_promotion_video, record_promotion_view)
4. Add RLS policies

### Phase 3B: Frontend - Homepage Carousel
1. Create ImageCarouselCard.tsx component
2. Modify AuthPromotionMediaCards.tsx (remove video)
3. Update slot rendering logic
4. Test 10-second rotation

### Phase 3C: Frontend - Promotion Overlay
1. Create PromotionVideoOverlay.tsx component
2. Create usePromotionVideoAd hook
3. Integrate into App/Root layout
4. Handle authentication gating

### Phase 3D: Admin Interface
1. Extend AdminAuthPromotionalManager.tsx
2. Add "Promotional Videos" section
3. Implement upload, reorder, enable/disable
4. Show unique user count / remaining slots

### Phase 3E: Testing & Validation
1. Verify homepage carousel rotates correctly
2. Test 15-user limit enforcement (concurrent users)
3. Test video overlay behavior
4. Verify RLS security
5. npm run build (0 errors)

---

## SECURITY PLAN

### RLS Policies

**auth_promotion_videos:**
- SELECT: `is_active=TRUE` OR user is admin
- INSERT/UPDATE/DELETE: admin only

**auth_promotion_video_views:**
- INSERT: authenticated only (user_id = auth.uid())
- SELECT: users see only their own views, admins see all
- UPDATE/DELETE: admin only

**Storage:**
- Public read (auth-promotional bucket)
- Admin write/delete

### Backend Enforcement (RPC)

**record_promotion_view RPC:**
- Runs as postgres role (not user)
- Atomic transaction (prevents race conditions)
- Checks UNIQUE(video_id, user_id) before insert
- Increments counter safely
- Cannot be called twice for same video+user

### Frontend Safeguards

- Only show overlay to authenticated users
- Close button always visible
- No audio autoplay without user interaction
- Respect browser visibility API

---

## SEPARATION OF CONCERNS

### Homepage Image Carousel
- **Purpose:** Visual presentation, homepage aesthetics
- **Media:** Images only
- **Source:** auth_promotion_media table, Slots 1-4
- **Rotation:** 10 seconds, frontend-only
- **No tracking:** Images don't track views
- **Admin control:** Upload, reorder, activate/deactivate

### Auth Promotion Video Ads
- **Purpose:** Promotional advertising
- **Media:** Videos only
- **Source:** auth_promotion_videos table
- **Display:** Overlay on authenticated pages
- **Tracking:** 15-user atomic limit per video
- **Sequencing:** Admin-defined priority order
- **User limit:** Enforced at database level (RPC)

**NO INTERACTION:** These two systems never interfere with each other.

---

## EXISTING FUNCTIONALITY PROTECTION

### Preserved & Unchanged
✅ Authentication system  
✅ Auth Promotion Banner/Config (sign-in page)  
✅ Vowza AI Planner  
✅ Artist Browse/Search  
✅ Vendor profiles  
✅ Booking system  
✅ Admin dashboard  
✅ All other Vowza features  

### Modified (Backward Compatible)
✅ Homepage Hero section (video→carousel, no layout break)  
✅ AuthPromotionMediaCards (images only, RLS unchanged)  
✅ AdminAuthPromotionalManager (new "Videos" section added)  

### New Systems
✨ Auth Promotion Video Ads  
✨ Promotion Video Views Tracking  
✨ 15-User Atomic Limit Enforcement  

---

## RISK ANALYSIS

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Race condition in 15-user limit | Medium | High | Use atomic RPC + UNIQUE constraint |
| Video doesn't play due to browser policy | Low | Medium | Fallback to muted + user unmute option |
| Carousel rotation janky on slow devices | Low | Low | Use requestAnimationFrame, lazy loading |
| Admin accidentally uploads wrong file type | Low | Low | File validation + preview before upload |
| RLS policies don't block admin-only ops | Medium | High | Test with non-admin user account |

---

## BUILD VERIFICATION

```bash
npm run build

Expected:
✓ 0 TypeScript errors
✓ 0 build warnings
✓ All migrations apply cleanly
✓ RLS policies compile
```

---

## TESTING CHECKLIST

### Homepage Carousel
- [ ] Open homepage on desktop
- [ ] Confirm 4 images visible in 2×2 grid
- [ ] Wait 10 seconds
- [ ] Confirm images change (no page reload)
- [ ] Repeat 3 times (verify loop)
- [ ] Open on mobile, confirm responsive
- [ ] Test tablet responsiveness

### Promotion Video Ads
- [ ] Upload 5 test videos via admin
- [ ] Set priority order
- [ ] Login as User 1
- [ ] Confirm video overlay appears
- [ ] Click X close button
- [ ] Verify video stops playing
- [ ] Refresh page
- [ ] Confirm same video NOT shown (already viewed)
- [ ] Login as Users 2-15 (15 unique users)
- [ ] Each should see same video
- [ ] Login as User 16
- [ ] Confirm SECOND video appears
- [ ] Verify first video limit reached

### Security
- [ ] Test non-admin cannot upload video
- [ ] Test non-admin cannot modify priority
- [ ] Test non-admin cannot see inactive videos
- [ ] Confirm RLS blocks unauthorized access

### Performance
- [ ] Carousel rotation doesn't cause page jank
- [ ] Video overlay doesn't block page navigation
- [ ] Admin upload doesn't timeout (100MB file)
- [ ] Homepage loads without carousel delay

---

## FILES TO CREATE

```
src/components/ImageCarouselCard.tsx
src/components/PromotionVideoOverlay.tsx
src/hooks/usePromotionVideoAd.ts
src/lib/promotionVideoUtils.ts
src/integrations/supabase/promotion-videos.ts  (new types/functions)
supabase/migrations/20260923000000_auth_promotion_videos.sql
supabase/migrations/20260924000000_homepage_media_image_only.sql  (optional)
```

---

## FILES TO MODIFY

```
src/components/AuthPromotionMediaCards.tsx
src/components/Hero.tsx
src/pages/admin/AdminAuthPromotionalManager.tsx
src/App.tsx  (or root layout)
src/integrations/supabase/auth-promo.ts  (add slot_number to type)
```

---

## KEY DECISIONS TO CONFIRM

### Decision 1: Image Carousel Rotation Duration
- ✓ SPEC SAYS: 10 seconds
- Current: 30 seconds in photos
- **Action:** Change to 10 seconds

### Decision 2: Promotion Video Limit
- ✓ SPEC SAYS: 15 unique authenticated users per video
- Enforcement: Database RPC (atomic)
- **Action:** Implement atomic RPC

### Decision 3: Video Overlay Position
- ✓ SPEC SAYS: Configurable (top/bottom, left/right)
- Default: "bottom-right"
- **Action:** Admin can change display_position

### Decision 4: Video Autoplay Sound
- ✓ SPEC SAYS: Browser-safe (muted, playsInline)
- Fallback: Offer unmute after initial play
- **Action:** Use autoplay muted, allow user unmute

### Decision 5: Promotion Sequencing
- ✓ SPEC SAYS: Admin-defined priority order (not newest first)
- Enforcement: Database priority_order column
- **Action:** Strict priority-based sequencing

---

## NEXT STEP: AWAIT USER APPROVAL

**User must confirm:**
1. ✅ Two systems are properly separated (carousel ≠ video ads)
2. ✅ Database schema is acceptable
3. ✅ RPC approach for 15-user limit is appropriate
4. ✅ Frontend components match requirements
5. ✅ Admin interface extensions are sufficient
6. ✅ All security measures are in place
7. ✅ No breaking changes to existing Vowza features

**User can request:**
- Alternative database designs
- Different RPC implementation
- UI/UX adjustments
- Additional admin features
- Different technical approach

---

## SUMMARY

| Item | Status |
|------|--------|
| Architecture Inspection | ✅ COMPLETE |
| Database Design | ✅ COMPLETE |
| Component Design | ✅ COMPLETE |
| Security Plan | ✅ COMPLETE |
| Admin Interface Plan | ✅ COMPLETE |
| Risk Analysis | ✅ COMPLETE |
| Testing Plan | ✅ COMPLETE |
| Implementation Ready | ⏳ AWAITING APPROVAL |

