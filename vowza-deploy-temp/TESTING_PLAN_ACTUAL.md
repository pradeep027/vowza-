# Photography & Videography Package Builder - ACTUAL TESTING PLAN

**Status:** Before real testing begins  
**Date:** July 22, 2026  
**Goal:** Do NOT claim anything works unless it's actually tested

---

## Migration Status

✅ **Correct Migration Created**
- File: `supabase/migrations/20261001000000_photography_videography_fixes.sql`
- Timestamp: 20261001000000 (AFTER 20260929000000, safe sequence)
- Status: Local only (NOT applied to remote yet)
- Status column: Idempotent (DROP IF EXISTS + ADD IF NOT EXISTS)

✅ **Old Migration Removed**
- Deleted: `20260722000000_fix_photography_videography_schema.sql`
- Reason: Timestamp was before already-applied remote migrations (out of sequence)

❌ **NOT Applied to Remote Supabase Yet**
- Reason: Need actual testing first

---

## Test Plan

### **A. PRICE FIELD**

**Test A1: Empty Price (Should Fail)**
- [ ] Open package builder
- [ ] Leave price empty (blank field)
- [ ] Click "Save Package"
- [ ] Expected: Toast error "Package price is required"
- [ ] Expected: Package NOT saved
- [ ] Actual result: ____________

**Test A2: Price = 0 (Should Fail)**
- [ ] Enter price: 0
- [ ] Click "Save Package"
- [ ] Expected: Toast error "Package price must be greater than ₹0"
- [ ] Expected: Package NOT saved
- [ ] Actual result: ____________

**Test A3: Negative Price (Should Fail)**
- [ ] Enter price: -100
- [ ] Click "Save Package"
- [ ] Expected: Toast error "Package price must be greater than ₹0"
- [ ] Expected: Package NOT saved
- [ ] Actual result: ____________

**Test A4: Valid Price (Should Succeed)**
- [ ] Enter price: 50000
- [ ] Continue through all steps
- [ ] Click "Save Package"
- [ ] Expected: Toast success
- [ ] Expected: Browser console shows "✅ Package created"
- [ ] Expected: In Supabase, price = 50000 (NOT 0, NOT null)
- [ ] Actual result: ____________

---

### **B. SAVE PACKAGE - PHOTOGRAPHY + VIDEOGRAPHY**

**Test B1: Create Combined Package**
- [ ] Open package builder
- [ ] Fill:
  - Name: "Test Combined Package"
  - Type: "📸🎥 Photography + Videography"
  - Price: 50000
  - Event: "Wedding"
  - Coverage: "Full Day"
  - Description: "Complete package"
  - Photography: 2 photographers, 500 photos, Album included
  - Videography: 2 videographers, 8 hours coverage
- [ ] Click "Save Package"
- [ ] Expected: Toast "Package created"
- [ ] Expected: Package appears in vendor list
- [ ] Actual result: ____________

**Test B2: Verify Database**
```sql
SELECT id, name, package_type, price, advance_percentage, event_type
FROM photography_videography_packages
WHERE name = 'Test Combined Package'
LIMIT 1;
```
- [ ] package_type = 'photography_and_videography' (EXACT VALUE)
- [ ] price = 50000 (NOT 0, NOT null)
- [ ] advance_percentage = 20 (NOT null)
- [ ] event_type = 'Wedding' (NOT null)
- [ ] Actual result: ____________

---

### **C. IMAGES - COVER + GALLERY**

**Test C1: Upload Cover Image**
- [ ] Go to Step 8 (Images)
- [ ] Upload 1 image as cover
- [ ] Click "Save Package"
- [ ] Expected: Image uploads without error
- [ ] Expected: In Supabase photography_videography_package_images:
  - is_cover = true
  - media_type = 'image'
  - storage_path is set
  - public_url is set
- [ ] Actual result: ____________

**Test C2: Upload Gallery Images (Test Unlimited, Not 8 Limit)**
- [ ] Go to Step 8 (Images)
- [ ] Upload 10 gallery images (more than old 8-limit)
- [ ] Expected: UI accepts all 10
- [ ] Expected: UI does NOT show "max 8" error
- [ ] Click "Save Package"
- [ ] Expected: All 10 images upload without error
- [ ] Query Supabase:
  ```sql
  SELECT COUNT(*) FROM photography_videography_package_images
  WHERE package_id = '<pkg-id>' AND is_cover = false;
  ```
- [ ] Expected: COUNT = 10
- [ ] Actual result: ____________

---

### **D. VIDEOS (UPLOAD & STORAGE)**

**Test D1: Upload Video File**
- [ ] Go to Step 8 (Images)
- [ ] Try to upload a video file (.mp4, .mov, or .webm)
- [ ] Current behavior: UI might reject (image-only)
  
**Option A: Video upload already enabled**
- [ ] Video uploads successfully
- [ ] In Supabase:
  ```sql
  SELECT media_type, duration_seconds, thumbnail_url
  FROM photography_videography_package_images
  WHERE package_id = '<pkg-id>' AND media_type = 'video';
  ```
- [ ] media_type = 'video'
- [ ] Actual result: ____________

**Option B: Video upload not yet enabled in UI**
- [ ] UI rejects video file (says image-only)
- [ ] Note: Schema is ready for videos, but UI needs enabling
- [ ] Actual result: ____________

---

### **E. PREVIEW STEP**

**Test E1: Preview Shows Correct Package Type**
- [ ] Go to Step 9 (Preview)
- [ ] Check the text showing package type
- [ ] Expected for combined package: "📸🎥 Photography + Videography"
- [ ] NOT: "📸 Photography"
- [ ] NOT: "🎥 Videography"
- [ ] Actual result: ____________

**Test E2: Preview Shows Correct Duration**
- [ ] Preview should also show: "Full Day"
- [ ] Expected: "📸🎥 Photography + Videography · Full Day"
- [ ] Actual result: ____________

---

### **F. CUSTOMER VIEW**

**Test F1: Package Visible in Photography & Videography Category**
- [ ] Log out (vendor) → Log in as customer (or browse public)
- [ ] Navigate to: "Photography & Videography" category
- [ ] Search/scroll for "Test Combined Package"
- [ ] Expected: Package appears in list
- [ ] Expected: Shows name, price (₹50,000), duration (Full Day)
- [ ] Actual result: ____________

**Test F2: Package Details Display**
- [ ] Click on package
- [ ] Expected displays:
  - [ ] Package type: "📸🎥 Photography + Videography"
  - [ ] Price: ₹50,000
  - [ ] Duration: Full Day
  - [ ] Description: "Complete package"
  - [ ] Photography details: 2 photographers, 500 photos, Album
  - [ ] Videography details: 2 videographers, 8 hours
  - [ ] Cover image displays
  - [ ] Gallery images display
  - [ ] Add-ons listed (if any added)
- [ ] Actual result: ____________

---

### **G. BOOKING FLOW**

**Test G1: Add Package to Booking**
- [ ] Customer: Click "Book Now" on test package
- [ ] Expected: Booking flow starts
- [ ] Step 1: Event Details
  - [ ] Select event date
  - [ ] Select time
  - [ ] Enter venue
- [ ] Expected: Base price shown: ₹50,000
- [ ] Actual result: ____________

**Test G2: Add-ons Selection**
- [ ] Step: Add-ons
- [ ] Expected: Any add-ons created are listed with prices
- [ ] Add some add-ons to booking
- [ ] Expected: Price updates correctly
  - [ ] Base: ₹50,000
  - [ ] Add-ons: (e.g., ₹8,000 + ₹5,000)
  - [ ] Total: ₹63,000
- [ ] Actual result: ____________

**Test G3: Checkout & Booking**
- [ ] Proceed to Checkout
- [ ] Expected: Final price correct (NOT ₹0, NOT base only)
- [ ] Complete booking
- [ ] Expected: Booking created successfully
- [ ] Query Supabase:
  ```sql
  SELECT base_amount, addons_amount, total_amount
  FROM photography_videography_package_bookings
  WHERE package_id = '<pkg-id>'
  ORDER BY created_at DESC
  LIMIT 1;
  ```
- [ ] Expected:
  - base_amount = 50000
  - addons_amount = (sum of selected add-ons, NOT 0)
  - total_amount = 50000 + addons_amount
- [ ] Actual result: ____________

---

### **H. ADD-ONS**

**Test H1: Add-on with Valid Price**
- [ ] Step 7: Add-ons
- [ ] Add: "Extra Photographer - ₹8,000"
- [ ] Click "Save Package"
- [ ] Expected: Add-on saved in Supabase
- [ ] Query:
  ```sql
  SELECT name, price FROM photography_videography_package_addons
  WHERE package_id = '<pkg-id>';
  ```
- [ ] Expected: price = 8000 (NOT 0)
- [ ] Actual result: ____________

**Test H2: Add-on with ₹0 Price (Should Be Filtered)**
- [ ] Step 7: Add-ons
- [ ] Add: "Something - ₹0"
- [ ] Click "Save Package"
- [ ] Expected: Add-on NOT saved (filtered by price > 0 validation)
- [ ] Query: Should NOT see this add-on
- [ ] Actual result: ____________

---

### **I. ERROR HANDLING - BROWSER CONSOLE**

**Test I1: Check Console During Save**
- [ ] Open browser DevTools → Console
- [ ] Create and save package
- [ ] Expected console logs (in order):
  - [ ] `📝 Saving package payload: {...}`
  - [ ] `➕ Creating new package` (or `✏️ Updating...`)
  - [ ] `✅ Package created with ID: <uuid>`
  - [ ] `🔧 Processing add-ons...`
  - [ ] `📋 Valid add-ons: X`
  - [ ] `📷 Uploading cover photo...`
  - [ ] `✅ Cover image saved`
  - [ ] `🖼️ Uploading gallery files...`
  - [ ] `✅ Gallery images saved`
  - [ ] `🎉 Package save complete`
- [ ] Expected: NO errors like "💥 Package save failed"
- [ ] Actual result: ____________

**Test I2: Check Console on Error**
- [ ] Try to save package with price = 0
- [ ] Expected console:
  - [ ] NO "💥 Package save failed"
  - [ ] Validation happens client-side
  - [ ] Error toast shows
- [ ] Actual result: ____________

---

### **J. EDIT EXISTING PACKAGE**

**Test J1: Load Package for Edit**
- [ ] Vendor: Open saved package in edit mode
- [ ] Expected fields load correctly:
  - [ ] Name: "Test Combined Package"
  - [ ] Price: 50000 (as string input value, NOT 50000.00 or similar)
  - [ ] Type: "photography_and_videography"
  - [ ] Photographers: 2
  - [ ] Videographers: 2
  - [ ] Add-ons: Shown correctly
  - [ ] Images: Cover + all gallery images shown
- [ ] Actual result: ____________

**Test J2: Edit and Save**
- [ ] Change price to 60000
- [ ] Click "Save Package"
- [ ] Expected: Update succeeds
- [ ] Query database: price = 60000
- [ ] Actual result: ____________

---

### **K. PHOTOGRAPHY_ONLY PACKAGE**

**Test K1: Create Photography Only**
- [ ] Package type: "📸 Photography Only"
- [ ] Verify Step 5 (Videography) is NOT shown
- [ ] Fill photography details only
- [ ] Save
- [ ] Expected: Saved as package_type = 'photography_only'
- [ ] Actual result: ____________

---

### **L. VIDEOGRAPHY_ONLY PACKAGE**

**Test L1: Create Videography Only**
- [ ] Package type: "🎥 Videography Only"
- [ ] Verify Step 4 (Photography) is NOT shown
- [ ] Fill videography details only
- [ ] Save
- [ ] Expected: Saved as package_type = 'videography_only'
- [ ] Actual result: ____________

---

## Summary Table

| Test | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| A1 - Empty price fails | Error | | |
| A2 - Zero price fails | Error | | |
| A3 - Negative price fails | Error | | |
| A4 - Valid price saves | Success | | |
| B1 - Combined package creates | Success | | |
| B2 - Database values correct | Correct | | |
| C1 - Cover image uploads | Success | | |
| C2 - Gallery unlimited | Success | | |
| D1 - Video upload | (Schema ready) | | |
| E1 - Preview shows correct type | Combined | | |
| E2 - Preview shows duration | Correct | | |
| F1 - Package visible to customer | Yes | | |
| F2 - Package details display | Complete | | |
| G1 - Booking starts | Success | | |
| G2 - Add-ons calculate | Correct | | |
| G3 - Booking completes | Success | | |
| H1 - Valid add-on saves | Success | | |
| H2 - ₹0 add-on filtered | Filtered | | |
| I1 - Console logs correct | Yes | | |
| I2 - Error handling works | Yes | | |
| J1 - Package loads for edit | Correct | | |
| J2 - Edit and save | Success | | |
| K1 - Photography only | Success | | |
| L1 - Videography only | Success | | |

---

## What I Will Actually Test

**Before declaring anything works, I will:**

1. Actually create a package in dev environment
2. Check browser console for logs
3. Query Supabase to verify data saved
4. Try all 3 package types
5. Test price validation (empty, 0, negative, valid)
6. Upload images (test unlimited, not 8)
7. Check customer view
8. Run booking flow
9. Document EXACTLY what passed and what failed

**I will NOT:**
- Claim tests passed without running them
- Assume features work without verification
- Report success before checking database
- Ignore actual errors

---

**Status:** Ready to begin actual testing  
**Next:** Execute tests above and document results
