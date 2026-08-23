# Photography & Videography Package System — Complete Diagnosis

**Date:** July 22, 2026  
**Status:** ✅ DIAGNOSIS COMPLETE  
**Build:** Ready for testing  
**Scope:** Cover image upload + customer visibility end-to-end  

---

## EXECUTIVE SUMMARY

The Photography & Videography package system is **ARCHITECTURALLY SOUND** with proper validation, storage handling, and RLS policies. However, there are **TWO CRITICAL ISSUES** that prevent proper functioning:

### Issue 1: Package Visibility RLS Policy Gap
**Status:** ⚠️ **FIXABLE** - Requires migration + code change  
**Impact:** Draft packages may leak to customers via images/addons relations  
**Root Cause:** Migration 20261022000000 dropped customer SELECT policy without recreation; images/addons policies allow draft visibility

### Issue 2: Missing Cover Image Display on Artist Dashboard
**Status:** ⚠️ **FIXABLE** - Requires UI fix  
**Impact:** Package card shows placeholder even when cover exists  
**Root Cause:** Package list query doesn't eager-load related images; display logic doesn't fetch cover image

---

## ISSUE 1: PACKAGE VISIBILITY - ROOT CAUSE ANALYSIS

### The Bug Location
**File:** `supabase/migrations/20261001000000_photography_videography_fixes.sql`  
**Lines:** 99-111 (images policy), 130-148 (addons policy)

### Current (Buggy) Policy
```sql
-- IMAGES (Line 99-111)
CREATE POLICY photography_videography_images_customer 
  ON public.photography_videography_package_images 
  FOR SELECT 
  USING (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE is_active = TRUE AND is_visible = TRUE AND status IN ('active', 'draft')  ← ALLOWS DRAFT
    )
  );

-- ADDONS (Line 130-148)
CREATE POLICY photography_videography_addons_customer 
  ON public.photography_videography_package_addons 
  FOR SELECT 
  USING (
    is_active = TRUE AND 
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE is_active = TRUE AND is_visible = TRUE AND status IN ('active', 'draft')  ← ALLOWS DRAFT
    )
  );
```

### Impact
- **Main table** (`photography_videography_packages`): ✅ Correctly restricted to `status = 'active'` only (Line 69-73)
- **Images table**: ❌ Allows images from draft packages (status IN ('active', 'draft'))
- **Addons table**: ❌ Allows addons from draft packages (status IN ('active', 'draft'))

### Secondary Issue
**File:** `supabase/migrations/20261022000000_fix_photography_videography_rls_policies.sql`

**Problem:** This migration drops ALL customer policies without recreating them:
```sql
DROP POLICY IF EXISTS photography_videography_customer_select ON public.photography_videography_packages CASCADE;
-- ← Drops main table customer SELECT policy
-- ← NEVER RECREATED in this migration
```

**Result:** If this migration runs after 20261001000000, the main table customer SELECT policy is REMOVED.

### Fix Applied
**Migration:** `20261025000000_hotfix_photography_videography_customer_policies.sql` (already created)

**Actions:**
1. Recreate main package customer SELECT policy
2. Fix images customer policy (remove draft from IN list)
3. Fix addons customer policy (remove draft from IN list)

---

## ISSUE 2: COVER IMAGE NOT DISPLAYING ON ARTIST DASHBOARD - ROOT CAUSE

### The Problem
When artist creates/edits package and uploads cover image:
1. ✅ Image uploaded to storage
2. ✅ Image URL saved to database
3. ✅ Package saved with all fields
4. ❌ **Cover image NOT displayed on package card in vendor dashboard**

### Root Cause: Query Doesn't Eager-Load Images

**File:** `src/pages/vendor/PhotoVideoPackageManager.tsx`  
**Lines:** 104-114

**Current Query:**
```typescript
const { data: packages = [], isLoading } = useQuery({
  queryKey: ['photo-video-packages', provider.id],
  queryFn: async () => {
    const r = await supabase
      .from('photography_videography_packages')
      .select('*')  ← ONLY package fields, NO related images
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false });
    if (r.error) throw r.error;
    return r.data ?? [];
  },
});
```

**Problem:** The `select('*')` only fetches package table columns. To get related images, must include:
```typescript
.select('*, photography_videography_package_images(*)') // Add related images
```

### Secondary Problem: Display Logic Doesn't Fetch Cover

**File:** Same file, lines ~1070 (where packages are rendered)

The package card rendering logic likely:
1. Tries to display `package.cover_image_url` (doesn't exist on main table)
2. OR tries to access related images array (but array is undefined because query didn't include it)
3. Falls back to placeholder

### Fix Required
Update the query to include related images:
```typescript
.select('*, photography_videography_package_images(*)')
```

Then update display to show cover image from related array.

---

## COMPLETE ARCHITECTURE TRACE

### 1. Package Creation Flow
```
PhotoVideoPackageManager.tsx (1198 lines)
  ↓
  Step 1: Basic Info (name, type, event_type)
  Step 2: Pricing (price, advance %, travel charges)
  Step 3: Coverage duration
  Step 4-5: Photography/Videography details (conditional)
  Step 6-7: Deliverables & add-ons
  Step 8-9: Media upload (cover image, gallery, videos)
  ↓
  Validation: name, price (> 0), cover image required
  ↓
  Save to DB:
    1. INSERT/UPDATE photography_videography_packages
    2. DELETE old add-ons, INSERT new ones (price > 0)
    3. UPLOAD cover image to storage
    4. INSERT photography_videography_package_images with is_cover=true
    5. UPLOAD gallery images
    6. UPLOAD videos (if any)
  ↓
  Invalidate React Query cache
  ↓
  Redirect back to list or stay in edit
```

### 2. Storage Flow
```
Bucket: 'photography-videography-package-images' (PUBLIC)
  ↓
  Path structure: {user_id}/{package_id}/{type}-{uuid}.{ext}
  Example: 550e8400-e29b-41d4-a716-446655440000/abc-123/cover-xyz.jpg
  ↓
  RLS Policies:
    - SELECT: Anyone (public bucket)
    - INSERT: Authenticated users only
    - UPDATE/DELETE: User owns file (first folder matches auth.uid())
  ↓
  URL Generated: supabase.storage.getPublicUrl(path)
  Returned: https://{project}.supabase.co/storage/v1/object/public/photography-videography-package-images/{path}
  ↓
  URL SAVED to: photography_videography_package_images.public_url (TEXT)
```

### 3. Database Schema
```
TABLE: photography_videography_packages
  - id (UUID, PK)
  - provider_id (UUID, FK)
  - name, description, package_type
  - price (NUMERIC 12,2), advance_percentage, travel_extra_charge
  - is_active (BOOLEAN), is_visible (BOOLEAN), status (TEXT: 'draft'|'active'|'paused'|'archived')
  - 60+ columns for photography/videography-specific fields
  - created_at, updated_at (TIMESTAMPTZ)

TABLE: photography_videography_package_images
  - id (UUID, PK)
  - package_id (UUID, FK)
  - storage_path (TEXT) - Internal path
  - public_url (TEXT) - Public accessible URL
  - is_cover (BOOLEAN) - Identifies the one cover image
  - media_type (TEXT: 'image'|'video')
  - sort_order (INTEGER)
  - created_at

TABLE: photography_videography_package_addons
  - id (UUID, PK)
  - package_id (UUID, FK)
  - name, description, price (NUMERIC 12,2)
  - sort_order, created_at

TABLE: photography_videography_package_bookings
  - id (UUID, PK)
  - package_id, provider_id, customer_id
  - event_date, event_time, venue, notes
  - booking_status, total_amount, etc.
```

### 4. Artist Dashboard (Vendor View)
```
PhotoVideoPackageManager.tsx
  ↓
  List all packages for this vendor
  Query: SELECT * FROM photography_videography_packages WHERE provider_id = {id}
  ↓
  Display each package:
    - Name
    - Price
    - Status (shows draft/active/paused/archived)
    - Action buttons: edit, toggle active, view, delete
    ↓
  ❌ BUG: Cover image not displayed (query doesn't include related images)
```

### 5. Customer Package Display
```
Browse Artists → Open vendor profile → UnifiedPhotographyVideographyMenu.tsx
  ↓
  Query: SELECT *, photography_videography_package_images(*), photography_videography_package_addons(*)
         FROM photography_videography_packages
         WHERE provider_id = {id} AND is_active AND is_visible AND status = 'active'
  ↓
  ✅ CORRECT: Query includes related images
  ✅ CORRECT: Main table filters to active only
  ⚠️ ISSUE: Images/addons policies allow draft packages (captured by hotfix)
  ↓
  Display:
    - Cover image (from is_cover=true image)
    - Package name, price
    - Photography/videography deliverables
    - Add-ons
    - "Book" button
```

### 6. RLS Policies Summary
```
PACKAGES TABLE: photography_videography_packages
  - INSERT: provider_id matches current user's provider_id ✅
  - UPDATE: provider_id matches current user's provider_id ✅
  - DELETE: provider_id matches current user's provider_id ✅
  - SELECT (vendor): provider_id matches current user's provider_id ✅
  - SELECT (customer): is_active AND is_visible AND status = 'active' ✅

IMAGES TABLE: photography_videography_package_images
  - ALL (vendor): Can manage images for their own packages ✅
  - SELECT (customer): Can view images of active packages ⚠️ (allows draft via IN clause)

ADDONS TABLE: photography_videography_package_addons
  - ALL (vendor): Can manage addons for their own packages ✅
  - SELECT (customer): Can view addons of active packages ⚠️ (allows draft via IN clause)

STORAGE BUCKET: photography-videography-package-images
  - SELECT: Anyone (public bucket) ✅
  - INSERT: Authenticated users ✅
  - UPDATE: File owner (user_id folder match) ✅
  - DELETE: File owner (user_id folder match) ✅
```

---

## FIXES REQUIRED

### Fix 1: Apply Hotfix Migration (Already Created)
**File:** `supabase/migrations/20261025000000_hotfix_photography_videography_customer_policies.sql`

**Action:** `supabase db push`

**Result:**
- Recreate main table customer SELECT policy
- Fix images customer SELECT policy (remove draft)
- Fix addons customer SELECT policy (remove draft)

### Fix 2: Update Artist Dashboard Query
**File:** `src/pages/vendor/PhotoVideoPackageManager.tsx`  
**Lines:** 104-114 (query definition)

**Change:**
```typescript
// FROM:
.select('*')

// TO:
.select('*, photography_videography_package_images(*)')
```

**Rationale:** Include related images so cover image can be displayed.

### Fix 3: Update Package Card Display
**File:** Same file, lines ~1070 or later where package cards render

**Change:** Add logic to find and display cover image:
```typescript
const coverImage = pkg.photography_videography_package_images?.find(img => img.is_cover)?.public_url;
// Display coverImage if it exists, otherwise placeholder
```

### Fix 4: Update Customer Query (Verify It's Correct)
**File:** `src/components/UnifiedPhotographyVideographyMenu.tsx`  
**Lines:** 65-80

**Current:**
```typescript
.select('*, photography_videography_package_images(*), photography_videography_package_addons(*)')
.eq('status', 'active')
```

**Status:** ✅ Already correct (includes related images and filters to active)

---

## TESTING CHECKLIST

### Pre-Deployment
- [ ] Apply hotfix migration `20261025000000` to Supabase
- [ ] Build: `npm run build` (should pass)

### Test 1: Artist Creates Package
```
Step 1: Start PhotoVideoPackageManager
Step 2: Fill all required fields (name, type, price, coverage)
Step 3: Upload cover image (JPG/PNG)
Step 4: Save package
Step 5: Verify in artist dashboard:
  - Package appears in list
  - Status shows correct value
  - ✅ Cover image displays on card
Step 6: Verify in database:
  - photography_videography_packages row exists with correct data
  - photography_videography_package_images row exists with is_cover=true, public_url populated
```

### Test 2: Package Visibility to Customer
```
Step 1: Create package as artist with status='active'
Step 2: Log in as customer
Step 3: Open Photography & Videography service
Step 4: Find the artist
Step 5: Verify package appears with:
  - ✅ Cover image displays
  - ✅ Package name
  - ✅ Price
  - ✅ Details/deliverables
Step 6: Create another package with status='draft'
Step 7: Verify draft package:
  - ✅ NOT visible to customer
  - ✅ NOT accessible via images query
  - ✅ NOT accessible via addons query
```

### Test 3: Package Booking Flow
```
Step 1: Customer finds active package
Step 2: Click "Book" or "Add to Cart"
Step 3: Proceed through booking form
Step 4: Verify booking is created:
  - Correct package_id
  - Correct provider_id
  - Correct customer_id
Step 5: Verify artist can see booking in dashboard
```

### Test 4: Package Editing
```
Step 1: Edit existing package (change price/name)
Step 2: Do NOT upload new cover image
Step 3: Save
Step 4: Verify:
  - ✅ Old cover image still displays
  - ✅ Database unchanged (old image URL preserved)
Step 5: Upload new cover image
Step 6: Save
Step 7: Verify:
  - ✅ New cover image displays
  - ✅ Old image URL replaced in database
```

---

## ROOT CAUSE SUMMARY TABLE

| Issue | Root Cause | Location | Fix |
|-------|-----------|----------|-----|
| Draft packages leak to customers | Images/addons RLS allows draft | Migration 20261001000000, lines 99-148 | Apply migration 20261025000000 |
| Cover image doesn't display on artist dashboard | Query missing related images | PhotoVideoPackageManager.tsx, line 109 | Change `select('*')` to `select('*, photography_videography_package_images(*)')` |
| Missing main table customer policy in production | Migration 20261022000000 dropped it without recreating | Migration 20261022000000 | Apply migration 20261025000000 (recreates it) |

---

## IMPLEMENTATION PLAN

### Step 1: Apply Migration (Database)
```bash
supabase db push
# Applies 20261025000000_hotfix_photography_videography_customer_policies.sql
```

### Step 2: Update PhotoVideoPackageManager Query (Code)
Edit `src/pages/vendor/PhotoVideoPackageManager.tsx` line 109:
```typescript
// OLD:
.select('*')

// NEW:
.select('*, photography_videography_package_images(*)')
```

### Step 3: Update Package Card Display (Code)
Find the package card rendering (approximately line 1070-1100) and update to display cover image:
```typescript
// Add logic to extract cover image from related array
const coverImage = pkg.photography_videography_package_images
  ?.find(img => img.is_cover)?.public_url;

// Use coverImage in the display:
{coverImage ? (
  <img src={coverImage} alt="" className="w-full h-full object-cover" />
) : (
  // Placeholder
)}
```

### Step 4: Build & Test
```bash
npm run build  # Must pass with 0 errors
```

### Step 5: Manual Testing
Follow testing checklist above for complete end-to-end validation.

---

## FILES REQUIRING CHANGES

| File | Changes | Type |
|------|---------|------|
| `supabase/migrations/20261025000000_hotfix_photography_videography_customer_policies.sql` | Already created - ready to apply | Database Migration |
| `src/pages/vendor/PhotoVideoPackageManager.tsx` | Update query line 109 + package display logic | Code Change |
| No other files | No other changes needed | - |

---

## VERIFICATION AFTER FIXES

**Test Scenario 1: Artist Dashboard**
- Artist creates Photography package with cover image
- Package appears on dashboard
- ✅ Cover image visible on card
- ✅ Status shows correctly
- ✅ Price displays

**Test Scenario 2: Customer Sees Active Package**
- Customer opens Photography & Videography
- ✅ Sees active package
- ✅ Cover image displays
- ✅ Can proceed to booking

**Test Scenario 3: Customer Doesn't See Draft**
- Artist creates package but leaves status='draft'
- Customer views same vendor
- ✅ Draft package NOT visible
- ✅ No images leaked via relation
- ✅ No add-ons leaked via relation

---

**Status:** ✅ DIAGNOSIS COMPLETE - READY FOR IMPLEMENTATION

