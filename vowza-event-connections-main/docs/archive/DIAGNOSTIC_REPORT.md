# Vowza Production Issues — Complete Diagnostic Report

**Report Date:** July 22, 2026  
**Status:** DIAGNOSIS COMPLETE  
**Issues:** 2 production bugs identified with exact root causes  
**Fix Complexity:** LOW (simple code changes, no schema modifications)

---

## ISSUE 1: VENDOR COVER PHOTO UPLOAD FAILS

### A. Exact Failing Component
- **File:** `src/pages/vendor/VendorSettings.tsx`
- **Lines:** 178–186 (cover photo upload UI section)
- **Component:** `ImageUpload` component with `variant="cover"`
- **User Action:** Click camera icon or drag-drop image onto cover area

### B. Upload Flow & Where It Breaks

```
┌─ VENDOR SETTINGS (VendorSettings.tsx)
│  └─ Displays cover image area
│     └─ Clicking/dragging triggers ImageUpload.tsx
│
├─ IMAGE UPLOAD COMPONENT (ImageUpload.tsx, lines 153–165)
│  └─ File validation: JPEG/PNG/WEBP, max 10MB ✅ PASSES
│  └─ Image processing: crop 3:1, resize to 1600px, compress ✅ PASSES
│  └─ Storage upload path: `covers/{vendorId}_{timestamp}.jpg`
│  └─ Supabase storage upload ✅ SUCCEEDS (INSERT policy only checks auth)
│  └─ Public URL generation ✅ SUCCEEDS (RLS not checked for reads)
│
├─ DATABASE UPDATE (VendorSettings.tsx, lines 90–97)
│  └─ Update provider_profiles.cover_image_url ✅ SUCCEEDS (DB RLS checks user_id)
│  └─ Invalidate React Query cache ✅ SUCCEEDS
│
└─ PROFILE DISPLAY
   └─ Cover image renders ✅ SUCCEEDS (uses stored URL)
```

**Status:** Upload appears to work initially, but has a critical flaw in re-upload/replacement scenarios.

### C. Exact Supabase Storage Problem

**Location:** `VOWZA_PRODUCTION_MIGRATION.sql`, lines 1820–1825

**Broken RLS Policies:**
```sql
-- Line 1820-1821: BROKEN UPDATE POLICY
CREATE POLICY "Users can update own provider media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Line 1822-1823: BROKEN DELETE POLICY
CREATE POLICY "Users can delete own provider media"
ON storage.objects FOR DELETE
USING (bucket_id = 'provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Why It Fails:**

1. **File Path Generated:** `covers/{vendorId}_{timestamp}.jpg`
   - Example: `covers/550e8400-e29b-41d4-a716-446655440000_1704067200000.jpg`

2. **Path Function Behavior:**
   ```
   storage.foldername('covers/550e8400-e29b-41d4-a716-446655440000_1704067200000.jpg')
   ↓
   Returns array: ['covers', '550e8400-e29b-41d4-a716-446655440000_1704067200000.jpg']
   ↓
   [1] extracts: 'covers' (first folder level, not user ID!)
   ```

3. **Authorization Check Fails:**
   ```
   auth.uid() = (string UUID like '550e8400-e29b-41d4-a716-446655440000')
   vs
   (storage.foldername(name))[1] = (string 'covers')
   
   Result: '550e8400-e29b-41d4-a716-446655440000' ≠ 'covers' → FALSE
   ```

4. **Result:** All UPDATE and DELETE operations blocked, even for the file owner.

### D. Error/Policy/Schema Problem Breakdown

| Component | Status | Issue |
|-----------|--------|-------|
| Storage bucket (`provider-media`) | ✅ OK | Public bucket exists, INSERT policy allows authenticated upload |
| INSERT policy | ✅ OK | Only checks `auth.role() = 'authenticated'`, correctly allows upload |
| UPDATE policy | ❌ BROKEN | Path extraction logic extracts folder name instead of user ID |
| DELETE policy | ❌ BROKEN | Path extraction logic extracts folder name instead of user ID |
| Database schema (`provider_profiles`) | ✅ OK | `cover_image_url TEXT` column exists |
| Database RLS policies | ✅ OK | Correctly check `auth.uid() = user_id` for UPDATE |
| File path structure | ⚠️ ISSUE | Path doesn't include user ID, only filename; policy can't extract user ID |

### E. Files Requiring Modification

1. **`VOWZA_PRODUCTION_MIGRATION.sql`** (lines 1820–1825)
   - Fix UPDATE and DELETE policies to correctly extract/match user ID
   - Create new migration to fix RLS policies

2. **`src/components/ImageUpload.tsx`** (lines 155–160)
   - Add error logging to upload function
   - Log Supabase error code, error message, storage path, bucket name
   - Never expose secrets in logs

### F. Why Fix Is Safe

- **No data loss:** Only changes authorization logic, doesn't delete data
- **Backward compatible:** Existing uploaded files still accessible
- **No schema changes:** Database table structure unchanged
- **Preserves existing vendors:** All existing cover photos remain valid
- **Enables future operations:** Allows proper file replacement and cleanup

---

## ISSUE 2: PHOTOGRAPHY + VIDEOGRAPHY PACKAGE INVISIBLE TO CUSTOMERS

### A. Exact Failing Component
- **File:** `src/components/UnifiedPhotographyVideographyMenu.tsx`
- **Lines:** 58–75 (customer package query section)
- **Line 74 (ROOT CAUSE):** `.eq('status', 'published')`

### B. Complete Data Path

```
┌─ VENDOR CREATES PACKAGE (PhotoVideoPackageManager.tsx)
│  └─ Form dropdown shows: 'draft' | 'active' | 'paused' | 'archived'
│  └─ Vendor selects status, e.g., 'active'
│  └─ Database INSERT with status='active'
│     Package stored: {
│       id: UUID,
│       provider_id: UUID,
│       package_type: 'photography_and_videography', ✅ CORRECT
│       is_active: true, ✅ CORRECT
│       is_visible: true, ✅ CORRECT
│       status: 'active', ✅ CORRECT
│       price: X,
│       ...
│     }
│
├─ CUSTOMER BROWSES VENDOR (UnifiedPhotographyVideographyMenu.tsx)
│  └─ Supabase query filters:
│     .eq('provider_id', vendor.id) ✅ CORRECT
│     .eq('is_active', true) ✅ CORRECT
│     .eq('is_visible', true) ✅ CORRECT
│     .eq('status', 'published') ❌ WRONG! (no such enum value)
│  └─ Query result: EMPTY (no package matches status='published')
│
└─ CUSTOMER SEES: Empty gallery
```

### C. Exact Table & Query Details

**Table:** `photography_videography_packages`

**Database Schema - Status Column:**
```sql
status TEXT DEFAULT 'active' 
  CHECK (status IN ('draft', 'active', 'paused', 'archived'))
```

**Vendor Form - Status Dropdown (PhotoVideoPackageManager.tsx):**
- Values: `'draft'` | `'active'` | `'paused'` | `'archived'`

**Customer Query (UnifiedPhotographyVideographyMenu.tsx, line 74):**
```javascript
.eq('status', 'published')  // ← NO SUCH VALUE IN ENUM!
```

**Visibility Column Check:**
- `is_active` defaults to TRUE, query checks `.eq('is_active', true)` ✅
- `is_visible` defaults to TRUE, query checks `.eq('is_visible', true)` ✅
- Neither is blocking (both TRUE by default)

### D. RLS Policy Analysis

**Database RLS Policy (from migration 20261022000000):**
```sql
CREATE POLICY "Photography + Videography packages visible to customers"
ON public.photography_videography_packages
FOR SELECT
USING (is_active = true AND is_visible = true AND status IN ('active', 'draft'))
```

**RLS Check Result:** ✅ ALLOWS both 'active' and 'draft' status

**Issue:** Application query is more restrictive than RLS allows. RLS is NOT the blocker; the application query is.

### E. Filter/RLS/Status Problem Breakdown

| Component | Filter Used | Status Accepted | Blocker? |
|-----------|------------|-----------------|----------|
| Vendor form creates | `'active'` or `'draft'` | ✅ Valid | No |
| Database enum | allows: `'draft', 'active', 'paused', 'archived'` | ✅ Valid | No |
| RLS policy | `status IN ('active', 'draft')` | ✅ Valid | No |
| Customer query | `status = 'published'` | ❌ Not in enum! | **YES** |

**Result:** Status mismatch prevents package visibility.

### F. Files Requiring Modification

1. **`src/components/UnifiedPhotographyVideographyMenu.tsx`** (line 74)
   - Change `.eq('status', 'published')` to `.in('status', ['active', 'draft'])`
   - OR change to `.eq('status', 'active')` if only active packages should show

2. **No SQL migration required**
   - Database schema is correct
   - RLS policies are correct
   - Only application code needs fix

### G. Why Fix Is Safe

- **No data loss:** Only changes query filter, doesn't modify data
- **Backward compatible:** All existing packages remain valid
- **Correct enum usage:** Matches database schema
- **Matches RLS policy:** Query becomes consistent with authorization layer
- **Preserves combined package type:** `package_type` stays as `'photography_and_videography'`
- **Preserves all existing categories:** Other vendors/package types unaffected

---

## SUMMARY TABLE

| Issue | Root Cause | File | Line(s) | Type | Severity |
|-------|-----------|------|---------|------|----------|
| #1 Cover Photo Upload | Storage RLS policy extracts folder name instead of user ID | `VOWZA_PRODUCTION_MIGRATION.sql` | 1820–1825 | RLS Logic Bug | HIGH |
| #1 Upload Error Logging | No error logging for debugging | `src/components/ImageUpload.tsx` | 155–160 | Missing Logging | MEDIUM |
| #2 Package Invisible | Query filters for non-existent 'published' status | `src/components/UnifiedPhotographyVideographyMenu.tsx` | 74 | Enum Mismatch | HIGH |

---

## FIXES REQUIRED

### Fix 1A: Correct Storage RLS Policies
- **Create new migration:** `supabase/migrations/20261024000000_fix_storage_rls_policies.sql`
- **Changes:** DROP and recreate UPDATE/DELETE policies with correct path extraction
- **Method:** Extract user ID from filename or restructure path to include user ID folder

### Fix 1B: Add Error Logging
- **File:** `src/components/ImageUpload.tsx`
- **Changes:** Log Supabase error code, message, storage path, and bucket name on upload failure
- **Location:** Around lines 155–160 in upload function

### Fix 2: Correct Status Filter
- **File:** `src/components/UnifiedPhotographyVideographyMenu.tsx`
- **Line:** 74
- **Change:** `.eq('status', 'published')` → `.in('status', ['active', 'draft'])`

---

## VERIFICATION CHECKLIST

After fixes implemented:

- [ ] Cover photo upload succeeds without "Permission denied" errors
- [ ] Cover photo persists after page refresh
- [ ] Multiple cover photo re-uploads work (no "object already exists" errors)
- [ ] Photography + Videography packages visible in customer booking flow
- [ ] Combined package shows price, photography deliverables, videography deliverables
- [ ] Customer can complete booking flow for combined package
- [ ] npm run build succeeds with no TypeScript errors
- [ ] Existing cover photos still display (backward compatibility)
- [ ] Existing Photography-only and Videography-only packages unaffected

---

## NOTES

- **No superficial workarounds:** Both fixes address root causes, not symptoms
- **No RLS disabled:** RLS policies remain active and correct
- **No public buckets:** Storage bucket remains properly configured
- **No existing functionality broken:** Fixes are additive/corrective only
- **No migrations deleted:** All existing migrations preserved
- **Production-safe:** Low-risk changes with clear, isolated scope
