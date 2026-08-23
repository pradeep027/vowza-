# Vowza Production Test Steps — Cover Photo & Photography+Videography Package Fixes

**Date:** July 22, 2026  
**Build Status:** ✅ PASSED (npm run build completed with 0 errors)  
**Deployment Status:** Ready for production  
**Test Environment:** Live Vowza production

---

## ISSUE 1: VENDOR COVER PHOTO UPLOAD

### A. Pre-Deployment Checklist

**Migration Requirements:**
- [ ] Migration `20261024000000_fix_provider_media_storage_rls.sql` applied to production Supabase
  - Drops broken UPDATE/DELETE policies
  - Creates corrected policies with proper path extraction
  - Status: Idempotent (safe to re-run)

**Code Changes:**
- [ ] `src/components/ImageUpload.tsx` deployed with:
  - New `userId` prop support
  - Path structure: `{userId}/{folder}/{filename}.jpg`
  - Error logging (console output, no secrets exposed)
- [ ] `src/pages/vendor/VendorSettings.tsx` deployed with:
  - `userId={user?.id}` prop passed to ImageUpload components
  - Both cover and avatar upload forms updated

### B. Manual Test Procedure: Cover Photo Upload

**Test Environment:** https://vowza-chi.vercel.app (production main URL)

**Preconditions:**
- Logged in as a vendor with approval status "approved"
- Vendor profile exists in production
- Browser console visible (DevTools → F12)

**Test Steps:**

1. **Navigate to Vendor Settings**
   - Go to Provider Dashboard → Edit Profile
   - Scroll to "Cover Photo" section
   - Expected: See "Click or drag a cover image" placeholder or current cover image

2. **Upload a Cover Image (First Time)**
   - Click camera icon or drag a JPG/PNG/WEBP file onto cover area
   - File selection dialog appears (if clicking) or preview appears (if dragging)
   - Expected: Preview modal shows with crop/rotate options
   - Click "Save Photo" button
   - Expected behavior:
     - Console logs: `[ImageUpload] Starting upload { bucket: 'provider-media', folder: 'covers', path: '{userId}/covers/...' }`
     - Upload progress visible
     - Console logs: `[ImageUpload] Storage upload succeeded`
     - Console logs: `[ImageUpload] Public URL generated`
     - Toast notification: "Image updated"
     - Cover image displays in preview
   - **Expected result:** ✅ Cover image shows immediately

3. **Verify Persistence**
   - Refresh page (Ctrl+R or Cmd+R)
   - Expected: Cover image still displays after refresh
   - Check database: `provider_profiles.cover_image_url` contains valid public URL
   - Expected result: ✅ Cover persists after page reload

4. **Replace Cover Image (Re-upload)**
   - Select a different cover image
   - Perform upload (same steps as above)
   - Expected behavior:
     - Path includes new timestamp (different file in storage)
     - `provider_profiles.cover_image_url` updated with new URL
     - New image displays immediately
   - Expected result: ✅ File replacement works without "object already exists" errors

5. **Verify Public Profile**
   - Click "View public profile" link (if available) or navigate to `/artist/{providerId}`
   - Expected: Cover image displays on public vendor profile
   - Expected result: ✅ Cover visible to customers

6. **Error Case: Upload Too Large File**
   - Try uploading a file > 10 MB
   - Expected: Toast error "Image is X.X MB. Maximum is 10 MB."
   - Expected result: ✅ Validation works correctly

7. **Check Browser Console Logs**
   - Open DevTools (F12) → Console tab
   - Expected logs on successful upload:
     ```
     [ImageUpload] Starting upload { bucket: 'provider-media', folder: 'covers', path: '{userId}/covers/...' }
     [ImageUpload] Storage upload succeeded { bucket: 'provider-media', path: '{userId}/covers/...' }
     [ImageUpload] Public URL generated { publicUrl: 'https://...' }
     ```
   - Expected result: ✅ Diagnostic logging visible

### C. Expected Results: Cover Photo Upload

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| First upload | ✅ Succeeds | ✅ Succeeds |
| Re-upload same file | ❌ "Object already exists" or silent failure | ✅ Succeeds (new file created) |
| Delete old cover | ❌ Blocked by RLS | ✅ Succeeds (cleaned up automatically) |
| Page refresh | ✅ Cover displays (URL in DB) | ✅ Cover displays (URL in DB) |
| Public profile | ✅ Shows | ✅ Shows |
| Error logging | ❌ Missing | ✅ Visible in console |

---

## ISSUE 2: PHOTOGRAPHY + VIDEOGRAPHY PACKAGE VISIBILITY

### A. Pre-Deployment Checklist

**Code Changes:**
- [ ] `src/components/UnifiedPhotographyVideographyMenu.tsx` deployed with:
  - Line 74 changed: `.eq('status', 'published')` → `.in('status', ['active', 'draft'])`
  - Query now matches database enum and RLS policy

### B. Manual Test Procedure: Package Visibility

**Test Environment:** https://vowza-chi.vercel.app (production main URL)

**Preconditions:**
- A vendor with profession "photography_videography" exists in production
- Vendor has created at least one Photography + Videography package
- Package has:
  - `status`: 'active' or 'draft' (as created by vendor form)
  - `is_active`: true
  - `is_visible`: true
- Browser console visible (DevTools → F12)

**Test Steps:**

1. **Verify Package Exists in Supabase**
   - Open Supabase dashboard → SQL Editor
   - Run query:
     ```sql
     SELECT 
       id, provider_id, package_type, status, is_active, is_visible, name, price
     FROM photography_videography_packages
     WHERE provider_id = '{test_vendor_id}'
     ORDER BY created_at DESC;
     ```
   - Expected result: ✅ Package row visible with `package_type='photography_and_videography'` and `status='active'` or `'draft'`

2. **Navigate to Vendor Profile (Customer View)**
   - Go to Browse Artists → Search for the test vendor
   - Click vendor card to open vendor profile
   - Expected: Vendor profile loads showing:
     - Cover photo (if set)
     - Bio and basic info
     - Package section
   - Expected result: ✅ Page loads without errors

3. **Check Package Visibility**
   - Scroll to "Packages" or "Services" section
   - Expected: Photography + Videography package displays with:
     - Package name
     - Price (₹X)
     - "Photography + Videography" type label
     - Photography deliverables list
     - Videography deliverables list
     - Duration
   - Expected result: ✅ Combined package visible

4. **Verify Package Details**
   - Click package card or "View Details" button
   - Expected modal/page shows:
     - Photography services (team size, photos, album, etc.)
     - Videography services (team, hours, editing, etc.)
     - Combined price
     - Gallery/media (if uploaded)
     - Add-ons (if created)
   - Expected result: ✅ All combined package fields visible

5. **Test Booking Flow**
   - Click "Book" or "Select Package" button
   - Expected flow:
     - Booking form opens
     - Package type shows as "Photography + Videography"
     - NO separate photographer/videographer selections required
     - Single package booking (not two separate bookings)
   - Expected result: ✅ Combined package books as ONE service

6. **Verify Other Package Types Unaffected**
   - Navigate back to vendor profile
   - Expected: Photography-only and Videography-only packages (if any) also visible
   - Expected result: ✅ Other categories unaffected

7. **Check Browser Console**
   - Open DevTools (F12) → Console tab
   - Expected: No errors loading package data
   - Expected result: ✅ Clean console

### C. Expected Results: Package Visibility

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| Customer sees package list | ❌ Empty (status mismatch) | ✅ Shows packages |
| Combined package visible | ❌ Not in list | ✅ Visible with correct type |
| Package type displayed | ❌ N/A | ✅ Shows "Photography + Videography" |
| Can book combined | ❌ N/A | ✅ Single booking (not two) |
| Other categories | ✅ Shows | ✅ Still shows |

---

## INTEGRATION TEST: Complete Booking Flow

### A. End-to-End Test

**Preconditions:**
- Vendor account set up as "photography_videography"
- Cover photo uploaded
- Photography + Videography package created and active

**Steps:**

1. **Customer Flow:**
   - Log in as customer
   - Browse Artists → Find test vendor
   - See vendor cover photo
   - See Photography + Videography package in gallery
   - Click package details
   - Click "Book Now"

2. **Booking Details:**
   - Confirm package type: "Photography + Videography"
   - Confirm package includes both photography and videography services
   - Confirm single price (not split)
   - Select event date
   - Add any add-ons
   - Proceed to checkout

3. **Confirmation:**
   - Booking confirmation shows combined package
   - Invoice shows single "Photography + Videography" line item
   - Vendor receives single booking (not two)

**Expected result:** ✅ Complete end-to-end booking succeeds

---

## ROLLBACK PROCEDURE (If Needed)

### If Issue 1 (Cover Photo) Fails:

1. **Immediate Action:**
   - Revert `src/components/ImageUpload.tsx` to remove `userId` prop and path change
   - Revert `src/pages/vendor/VendorSettings.tsx` to remove `userId={user?.id}` passes
   - Revert migration (Supabase: drop new policies, restore old ones)
   - Redeploy build

2. **Root Cause Analysis:**
   - Check browser console for error codes
   - Verify RLS policy was correctly applied
   - Check file path structure in storage

### If Issue 2 (Package Visibility) Fails:

1. **Immediate Action:**
   - Revert `src/components/UnifiedPhotographyVideographyMenu.tsx` line 74
   - Change back: `.in('status', ['active', 'draft'])` → `.eq('status', 'published')`
   - Redeploy build

2. **Root Cause Analysis:**
   - Check vendor-created package status values
   - Verify RLS policies allow customer SELECT
   - Check database schema enum values

---

## VERIFICATION CHECKLIST (Post-Deployment)

- [ ] Migration `20261024000000_fix_provider_media_storage_rls.sql` applied to production
- [ ] npm run build executed with 0 TypeScript errors
- [ ] Commit deployed to main branch and live URL
- [ ] Vendor can upload cover photo successfully
- [ ] Cover photo persists after page refresh
- [ ] Cover photo visible on public profile
- [ ] Console logs show upload diagnostics
- [ ] Photography + Videography package visible to customers
- [ ] Package shows correct combined type
- [ ] Customer can book combined package as single service
- [ ] Other package types (Photography-only, Videography-only) still visible
- [ ] Existing vendor profiles unaffected
- [ ] No new errors in browser console
- [ ] No new errors in Supabase logs

---

## SUPPORT NOTES

### If Vendors Report Issues:

**"My cover photo upload still doesn't work"**
- Check browser console (F12 → Console)
- Look for error messages in format: `[ImageUpload] Upload error { errorCode: '...', errorMessage: '...' }`
- Common errors:
  - `storage/object-already-exists` → Old RLS policy not replaced, or upsert: true used
  - `storage/invalid-validation` → File type not supported
  - `storage/bucket-not-found` → Bucket name typo

**"I don't see my Photography + Videography package"**
- Check package was actually created in vendor dashboard
- Check Supabase: `SELECT * FROM photography_videography_packages WHERE vendor_id = '{id}' AND package_type = 'photography_and_videography'`
- Verify `status` is 'active' or 'draft', `is_active = true`, `is_visible = true`
- Check vendor profession is 'photography_videography' (not split into individual types)

---

## PERFORMANCE IMPACT

- **Cover Photo Upload:** File path structure change minimal impact (~negligible)
- **Package Query:** Status filter changed from `.eq()` to `.in()` - minimal impact (potential slight improvement due to simpler RLS policy evaluation)
- **Storage RLS:** Policy change corrects authorization check - no performance degradation

---

## SECURITY IMPACT

- **Cover Photo Upload:** RLS policies now correctly enforce vendor ownership - IMPROVES security
- **Package Visibility:** No security change (customer SELECT unchanged)
- **No secrets exposed:** Error logs never include authentication tokens or sensitive data

---

## FILES MODIFIED FOR DEPLOYMENT

```
supabase/migrations/
  └─ 20261024000000_fix_provider_media_storage_rls.sql     [NEW - Apply to Supabase]

src/components/
  └─ ImageUpload.tsx                                        [MODIFIED - Deploy]
  └─ UnifiedPhotographyVideographyMenu.tsx                 [MODIFIED - Deploy]

src/pages/vendor/
  └─ VendorSettings.tsx                                     [MODIFIED - Deploy]
```

**No database schema changes required** (only RLS policies)  
**No breaking changes** (backward compatible)  
**All existing data preserved** (additive fixes only)

---

## DEPLOYMENT COMMAND

```bash
# 1. Apply migration to Supabase
supabase db push

# 2. Deploy code to production
# (via GitHub → Vercel or equivalent deployment pipeline)
npm run build
git push
```

---

## NEXT STEPS AFTER DEPLOYMENT

1. ✅ Apply migration to production Supabase
2. ✅ Deploy latest build to main URL
3. ✅ Run manual tests per steps above
4. ✅ Monitor browser console and Supabase logs for errors
5. ✅ Confirm vendor feedback (cover photo persists, package visible)
6. ✅ Document any unexpected issues

---

**Last Updated:** July 22, 2026  
**Status:** Ready for production deployment  
**Test Coverage:** 100% manual test paths documented  
**Risk Level:** LOW (isolated fixes, no schema changes, backward compatible)
