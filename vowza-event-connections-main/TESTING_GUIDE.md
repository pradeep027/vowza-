# Photography & Videography Package Builder - Testing Guide

**Version:** 1.0  
**Date:** July 29, 2026  
**Audience:** QA, Developers, Stakeholders

---

## TEST ENVIRONMENT SETUP

### Prerequisites
- [ ] Development environment running (`npm run dev`)
- [ ] Supabase connection active and authenticated
- [ ] Test vendor account with `photography_videography` profession
- [ ] Admin account for verification
- [ ] Modern browser (Chrome, Firefox, Safari, or Edge)

### Access URL
```
Local: http://localhost:8080/provider/dashboard/packages
```

---

## TEST SCENARIOS

### SECTION 1: VENDOR PACKAGE CREATION

#### Test 1.1: Create Photography Only Package
**Precondition:** Logged in as Photography & Videography vendor

**Steps:**
1. Navigate to VendorPackages page
2. Click "Create Package" button
3. Verify "Photography & Videography Packages" header shown
4. Click "Create Package" button (top right)

**Step 1 - Basics:**
1. Enter Package Name: "Professional Wedding Photography"
2. Select Package Type: "📸 Photography Only"
3. Verify only Steps 1, 4, 5, 6 shown (no videography)
4. Enter Price: "35000"
5. Select Duration: "Full Day"
6. Select Event Type: "Wedding"
7. Enter Description: "Professional wedding photography with 500+ edited photos"
8. Check "Visible to Customers"
9. Check "Active for Bookings"
10. Click "Next"

**Verification:**
- [ ] Step 1 validates required fields (name, price)
- [ ] Step indicators update
- [ ] All fields stored in state correctly

**Step 2 - Photography:**
1. Set "Number of Photographers": 2
2. Set "Edited Photos Count": 500
3. Set "Photo Delivery Time": "7 Days"
4. Check "Premium Album Included"
5. Check "Pre-Wedding Shoot Included"
6. Click "Next"

**Verification:**
- [ ] Photography fields are displayed
- [ ] All checkboxes toggle correctly
- [ ] State updates reflected

**Step 4 - Add-ons:**
1. Click template button: "+ Extra Photographer"
2. Verify add-on appears in "Your Add-ons" section
3. Click template button: "+ Premium Album"
4. Verify second add-on appears
5. Scroll to custom add-on form
6. Enter: Name = "Extended Album", Price = "5000"
7. Click "Add Custom Add-on"
8. Verify custom add-on appears
9. Click "Next"

**Verification:**
- [ ] Template add-ons appear in list
- [ ] Custom add-ons save correctly
- [ ] Add-ons display with prices

**Step 5 - Images:**
1. Click upload area or drag 2-3 images
2. Verify file validation works (only PNG/JPG/WebP accepted)
3. Verify 8MB limit enforced
4. Wait for images to appear in gallery
5. Click "Set as Cover" on first image
6. Verify "Cover" badge appears
7. Click "Next"

**Verification:**
- [ ] Images upload successfully
- [ ] Gallery displays thumbnails
- [ ] Cover image selection works
- [ ] Image deletion works

**Step 6 - Preview:**
1. Verify package name displayed
2. Verify "📸 Photography Only" badge shown
3. Verify price "₹35,000" displayed
4. Verify all photography features listed
5. Verify add-ons listed with prices
6. Verify package images displayed
7. Verify green "ready to publish" message shown
8. Click "Publish Package"

**Verification:**
- [ ] Preview renders correctly
- [ ] All data from previous steps shown
- [ ] Professional card layout

**Result:**
- [ ] Package created successfully
- [ ] Toast message: "Package created successfully"
- [ ] Redirected to package list
- [ ] New package visible in list with correct type

**Database Verification (via Supabase Dashboard):**
- [ ] Entry in `photography_videography_packages`
- [ ] `package_type = 'photography_only'`
- [ ] All photography fields populated
- [ ] Entries in `photography_videography_package_addons` (2 addons)
- [ ] Entries in `photography_videography_package_images` (images with cover marked)

---

#### Test 1.2: Create Videography Only Package
**Precondition:** Same as Test 1.1

**Steps:** (Similar to 1.1, but select "🎥 Videography Only")

**Key Differences:**
- Package Type: "🎥 Videography Only"
- Step 2 shows Videography fields (NOT photography)
- Fields: videographers, coverage hours, drone coverage, delivery time
- Verify Step 3 (Photography) is NOT shown

**Expected Result:**
- [ ] Package created with `package_type = 'videography_only'`
- [ ] Only videography fields in database
- [ ] Photography fields NULL or default values

---

#### Test 1.3: Create Combined Package
**Precondition:** Same as Test 1.1

**Steps:** (Similar to 1.1, but select "📸🎥 Photography + Videography")

**Key Differences:**
- Package Type: "📸🎥 Photography + Videography"
- Step 2: Photography Services (shown)
- Step 3: Videography Services (shown) - NEW STEP
- Enter videography: 2 videographers, drone coverage, etc.
- Step 4: Add-ons (can add both photography and videography upgrades)

**Expected Result:**
- [ ] Package created with `package_type = 'photography_and_videography'`
- [ ] Both photography and videography fields populated
- [ ] Database shows combined data

---

#### Test 1.4: Validate Form Requirements
**Precondition:** On Step 1 (Basics)

**Steps:**
1. Leave "Package Name" empty
2. Try to proceed to next step (should fail)
3. Verify red error text appears below name field
4. Verify toast error: "Please fill in all required fields"
5. Fill name with "A" (too short)
6. Try to proceed
7. Verify error: "Package name must be at least 2 characters"
8. Enter valid name
9. Set price to "0"
10. Try to proceed
11. Verify error: "Price must be greater than 0"
12. Set valid price
13. Verify "Next" button becomes enabled (green)
14. Click "Next" successfully

**Verification:**
- [ ] Form validation triggers on invalid input
- [ ] Error messages display correctly
- [ ] Button states (enabled/disabled) reflect validation
- [ ] Toast notifications appear for errors

---

#### Test 1.5: Save Package as Draft
**Precondition:** Creating a new package

**Steps:**
1. Fill in Step 1 (Basics) only
2. Go through remaining steps (minimal data)
3. On Step 6 (Preview), click "Save as Draft"
4. Verify "Package created successfully" toast
5. Return to package list
6. Find newly created package
7. Verify status badge: "Draft"
8. Verify visibility: Not clearly marked as visible to customers

**Verification:**
- [ ] Draft package saved to database
- [ ] `status = 'draft'` in database
- [ ] Draft packages don't appear in customer search
- [ ] Draft packages editable

---

#### Test 1.6: Edit Existing Package
**Precondition:** Package exists in list

**Steps:**
1. Click pencil icon on any package
2. Verify all fields pre-populate with existing data
3. Change package name to "Updated: " + old name
4. Modify price (increase by 5000)
5. Add new add-on
6. Proceed through all steps
7. On preview, click "Publish Package"
8. Verify "Package updated successfully" toast
9. Return to list
10. Verify package shows updated name and price

**Verification:**
- [ ] Old data loads correctly in form
- [ ] Changes save to database
- [ ] Add-ons updated correctly
- [ ] Images reloaded if not changed

---

#### Test 1.7: Delete Package
**Precondition:** Package exists in list

**Steps:**
1. Click trash icon on a package
2. Confirm deletion in browser dialog
3. Verify "Package deleted" toast
4. Verify package removed from list
5. Check database: package still exists (soft delete via is_active flag)

**Verification:**
- [ ] Package removed from UI
- [ ] Database entry preserved
- [ ] Add-ons cascade-deleted
- [ ] Images cascade-deleted

---

### SECTION 2: ADD-ONS FUNCTIONALITY

#### Test 2.1: Add-ons Templates
**Precondition:** On Step 4 (Add-ons) of package creation

**Steps:**
1. See 8 template buttons
2. Click each template and verify it appears in "Your Add-ons"
3. Verify prices are reasonable (8,000 - 10,000)
4. Try clicking same template twice
5. Verify toast: "This add-on is already added"
6. Delete one add-on from list
7. Re-click its template
8. Verify it adds again

**Verification:**
- [ ] All 8 templates work
- [ ] Prices set correctly
- [ ] Duplicate prevention works
- [ ] Deletion and re-add works

---

#### Test 2.2: Custom Add-ons
**Precondition:** On Step 4 (Add-ons)

**Steps:**
1. Scroll to "Add Custom Add-on" section
2. Leave name empty, try to add
3. Verify error: "Enter add-on name and price"
4. Enter name: "Engagement Photography", price: "", try to add
5. Verify error: "Enter add-on name and price"
6. Enter name: "Same-Day Video Edit", price: "2500"
7. Click "Add Custom Add-on"
8. Verify add-on appears in list
9. Verify input fields cleared for next add-on
10. Add another custom: "Guest Book Photo", "1500"
11. Add another: "Drone Footage", "3500"
12. Proceed through wizard
13. On preview, verify all 3 custom add-ons listed with prices

**Verification:**
- [ ] Validation prevents invalid add-ons
- [ ] Custom add-ons save correctly
- [ ] Multiple custom add-ons supported
- [ ] Prices displayed correctly in preview

---

### SECTION 3: IMAGE UPLOAD & GALLERY

#### Test 3.1: Image Upload
**Precondition:** On Step 5 (Images)

**Steps:**
1. Drag 2 image files to upload area
2. Verify files appear as thumbnails in gallery
3. Verify image count: "2 images uploaded"
4. Try uploading non-image file (PDF)
5. Verify: No upload (validation fails)
6. Try uploading image > 8MB
7. Verify: No upload (size validation fails)
8. Upload 3 more images (total 5)
9. Verify all 5 display in grid
10. Try uploading 6th image (reaches 10 limit)
11. Upload 5 more to reach 10 max
12. Try uploading 11th
13. Verify: No upload (limit enforced)

**Verification:**
- [ ] Drag-drop works
- [ ] File type validation works (PNG/JPG/WebP only)
- [ ] Size limit enforced (8MB)
- [ ] 10-image maximum enforced
- [ ] Progress display accurate

---

#### Test 3.2: Set Cover Image
**Precondition:** Multiple images uploaded

**Steps:**
1. See grid of 3+ images
2. Hover over image 1
3. Verify overlay appears with "[Set as Cover]" button
4. Click "Set as Cover" on image 2
5. Verify "Cover" badge appears on image 2
6. Verify badge removed from any previous cover
7. Hover over different image
8. Click "Set as Cover"
9. Verify badge moves to new image
10. Proceed to Preview
11. Verify preview shows correct cover image

**Verification:**
- [ ] Cover image can be set
- [ ] Only one cover at a time
- [ ] Cover displayed in preview
- [ ] Database: `is_cover = true` only for cover

---

#### Test 3.3: Delete Images
**Precondition:** Multiple images uploaded

**Steps:**
1. Hover over image 1
2. Verify trash icon appears
3. Click trash icon
4. Verify image removed from gallery immediately
5. Count displayed: now 1 less
6. If deleted image was cover, verify "Cover" badge moved to remaining image
7. Delete all but one image
8. Try to delete last image
9. Verify deletion works (allows 0 images)

**Verification:**
- [ ] Images delete immediately
- [ ] Count updates correctly
- [ ] Cover reassigned if deleted
- [ ] Can proceed with 0 images (optional)

---

### SECTION 4: PACKAGE PREVIEW

#### Test 4.1: Preview Rendering
**Precondition:** Filled out all steps, on Preview (Step 6)

**Expected Display:**
```
[Package Cover Image (if uploaded)]

Package Name (large, bold)
📸🎥 Package Type Badge
₹Price | Duration

Description text

📸 Photography
✓ N Photographers
✓ X Edited Photos
✓ Album/Raw/Pre-wedding (if enabled)
✓ Delivery in Y Days

🎥 Videography (if combined/videography)
✓ N Videographers
✓ Coverage Hours
✓ Drone/Pre-wedding (if enabled)
✓ Delivery in Y Days

Optional Add-ons
+ Add-on 1 — ₹Price
+ Add-on 2 — ₹Price

[Additional gallery images]

✓ Ready to publish message
```

**Steps:**
1. Verify all package details display
2. Verify cover image displayed at top (if exists)
3. Verify correct service sections shown (photography/video/both)
4. Verify all features listed under each service
5. Verify add-ons listed with prices
6. Verify additional gallery images shown below
7. Verify green "ready to publish" banner

**Verification:**
- [ ] All entered data visible in preview
- [ ] Layout matches customer-facing view
- [ ] Professional appearance

---

#### Test 4.2: Preview for Different Package Types

**Photography Only Package:**
- [ ] Only "📸 Photography" section shown
- [ ] No videography section
- [ ] Only photography add-ons shown

**Videography Only Package:**
- [ ] Only "🎥 Videography" section shown
- [ ] No photography section
- [ ] Only videography add-ons shown

**Combined Package:**
- [ ] Both "📸 Photography" and "🎥 Videography" sections shown
- [ ] Both add-ons shown
- [ ] Single unified package presentation

---

### SECTION 5: PUBLISH WORKFLOW

#### Test 5.1: Publish Active Package
**Precondition:** Completed package, on Preview

**Steps:**
1. Click "Publish Package" button
2. Verify button shows loading spinner
3. Verify "Package created successfully" toast
4. Wait 2 seconds
5. Verify redirected to package list
6. Verify new package appears in list
7. Verify package status: "Active"
8. Check database: `status = 'active'`, `is_active = true`

**Verification:**
- [ ] Package transitions to active status
- [ ] Package visible in customer search (test with customer account)
- [ ] Database updated correctly

---

#### Test 5.2: Publish Draft Later
**Precondition:** Draft package exists

**Steps:**
1. Find draft package in list
2. Click pencil icon to edit
3. Make minor changes (e.g., update price)
4. On preview, click "Publish Package"
5. Verify "Package updated successfully" toast
6. Verify package now shows "Active" status
7. Verify package appears in customer search

**Verification:**
- [ ] Draft conversion to active works
- [ ] Published package visible to customers

---

### SECTION 6: CUSTOMER EXPERIENCE (BOOKING FLOW)

#### Test 6.1: Customer Sees Published Package
**Precondition:** Photography & Videography package published

**Steps (as Customer):**
1. Log in as customer
2. Search for "Photography & Videography"
3. Browse packages in category
4. Find published package
5. Click on package details
6. Verify package name, price, description shown
7. Verify cover image displayed
8. Verify photography and videography services listed
9. Verify add-ons shown
10. Verify gallery images displayed

**Verification:**
- [ ] Package visible to customer
- [ ] All information displayed correctly
- [ ] Professional presentation

---

#### Test 6.2: Book Package
**Precondition:** Published package visible

**Steps:**
1. Click "Book Now" on package
2. Fill in booking details:
   - Event Date: (future date)
   - Event Time: (pick time)
   - Venue: (enter address)
   - Notes: (optional)
3. Select 1-2 add-ons
4. Click "Continue"
5. Proceed through checkout
6. Verify total includes base package + add-ons
7. Complete payment
8. Verify booking confirmation
9. Check database: Entry in `photography_videography_package_bookings`

**Verification:**
- [ ] Booking flow works
- [ ] Add-ons included in total
- [ ] Booking saved to database
- [ ] Vendor receives booking notification

---

### SECTION 7: REGRESSION TESTS

#### Test 7.1: Old Packages Still Work
**Precondition:** Old packages exist (from previous manager)

**Steps:**
1. Check if old packages still visible in dashboard
2. Try to edit old package
3. Verify old data loads correctly
4. Make minor change
5. Save package
6. Verify save succeeds
7. Try to book old package as customer
8. Verify booking still works

**Verification:**
- [ ] Old packages not broken
- [ ] Editable with new builder
- [ ] Bookings still functional

---

#### Test 7.2: Photographer & Videographer Vendors Unaffected
**Precondition:** Vendors with `photographer` or `videographer` profession

**Steps:**
1. Log in as photographer vendor
2. Verify they see PhotographerPackageManager (old interface)
3. Verify they do NOT see new builder
4. Create a package using old interface
5. Verify package saved
6. Log in as videographer
7. Verify they see VideographyPackageManager
8. Create a package
9. Verify package saved

**Verification:**
- [ ] Photographers still use old manager
- [ ] Videographers still use old manager
- [ ] Combined vendors use new builder
- [ ] No cross-contamination

---

#### Test 7.3: Booking Flow Unchanged
**Precondition:** Customer logged in

**Steps:**
1. Navigate to photography category
2. Find any package (old or new)
3. Click "Book Now"
4. Complete booking flow
5. Verify success page
6. Check notification
7. Log in as vendor
8. Verify booking shows in VendorBookings

**Verification:**
- [ ] Booking flow unchanged
- [ ] All steps work
- [ ] Vendor notified
- [ ] Customer confirmed

---

#### Test 7.4: Database Integrity
**Precondition:** Various packages created/edited

**Steps (via Supabase Dashboard):**
1. Open `photography_videography_packages` table
2. Verify all created packages exist
3. Verify `package_type` values are correct
4. Verify no orphaned records
5. Open `photography_videography_package_addons`
6. Verify all add-ons linked to correct packages
7. Verify cascade delete worked (check deleted package addons)
8. Open `photography_videography_package_images`
9. Verify images linked to correct packages
10. Verify storage paths are valid

**Verification:**
- [ ] No corrupted data
- [ ] Foreign keys intact
- [ ] Cascade deletes work
- [ ] Data types correct

---

## PERFORMANCE TESTS

### Test P1: Page Load Time
**Precondition:** Package list page

**Steps:**
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Measure load time
5. Acceptable: < 3 seconds
6. Verify no failed requests

**Expected:** < 3 seconds ✅

---

### Test P2: Image Upload Performance
**Precondition:** On Step 5 (Images)

**Steps:**
1. Select 5 images at once
2. Measure upload time
3. Acceptable: < 10 seconds total
4. Verify UI responsive during upload

**Expected:** < 10 seconds ✅

---

### Test P3: Database Query Performance
**Precondition:** 50+ packages exist in database

**Steps:**
1. Open VendorPackages
2. Verify package list loads quickly
3. Open DevTools Network tab
4. Check query time
5. Acceptable: < 1 second

**Expected:** < 1 second ✅

---

## MOBILE RESPONSIVENESS TESTS

### Test M1: Mobile Layout
**Precondition:** Open on mobile device or emulate 375x812

**Steps:**
1. Verify header text readable
2. Verify form fields full width
3. Verify buttons full width and tappable (44+ px)
4. Verify image grid adapts to mobile (1-2 columns)
5. Verify step indicators readable
6. Verify no horizontal scroll

**Verification:**
- [ ] All elements readable
- [ ] Touch targets adequate
- [ ] No overflow

---

### Test M2: Mobile Add-ons
**Precondition:** Mobile, on Step 4

**Steps:**
1. Verify template buttons stack properly
2. Verify custom form inputs full width
3. Verify add-ons list readable

**Verification:**
- [ ] Mobile-optimized layout

---

## ACCESSIBILITY TESTS

### Test A1: Keyboard Navigation
**Precondition:** On package creation form

**Steps:**
1. Tab through form
2. Verify tab order logical
3. Verify all interactive elements reachable
4. Verify focus visible
5. Press Enter on buttons (should activate)
6. Press Escape (should not crash)

**Verification:**
- [ ] Full keyboard navigation
- [ ] Focus visible
- [ ] Logical tab order

---

### Test A2: Screen Reader (NVDA/JAWS)
**Precondition:** On package page, screen reader running

**Steps:**
1. Verify headings read correctly
2. Verify form labels read with inputs
3. Verify buttons have accessible names
4. Verify images have alt text or marked as decorative
5. Verify error messages announced

**Verification:**
- [ ] Screen reader compatible
- [ ] All content accessible

---

## ERROR HANDLING TESTS

### Test E1: Network Error During Upload
**Precondition:** On Step 5, uploading images

**Steps:**
1. Disable internet during upload
2. Observe error handling
3. Verify graceful error message
4. Verify UI doesn't crash
5. Re-enable internet
6. Try upload again
7. Verify retry works

**Verification:**
- [ ] Error handled gracefully
- [ ] Clear error message
- [ ] Retry possible

---

### Test E2: Database Error
**Precondition:** About to save package

**Steps (Advanced - requires Supabase simulator or intentional error):**
1. Intentionally cause database error (e.g., set invalid data)
2. Try to save
3. Verify error message
4. Verify UI remains responsive
5. Verify toast shows error
6. Verify can try again

**Verification:**
- [ ] Database errors handled
- [ ] User informed
- [ ] Can retry

---

## EDGE CASE TESTS

### Test EC1: Very Long Package Name
**Precondition:** On Step 1

**Steps:**
1. Enter 200+ character name
2. Try to save
3. Verify DB accepts (max 150 chars due to constraint)
4. Verify error: "name must be at least 2 characters" (or similar validation)

**Verification:**
- [ ] Input validation works
- [ ] No crashes

---

### Test EC2: Very Large Price
**Precondition:** On Step 1

**Steps:**
1. Enter price: 99999999999
2. Save and proceed
3. Verify price displays correctly (formatted with commas)
4. On preview: Verify "₹99,999,999,999" displays

**Verification:**
- [ ] Large numbers handled
- [ ] Formatting works

---

### Test EC3: Rapid Clicks
**Precondition:** On preview

**Steps:**
1. Rapidly click "Publish Package" multiple times (5+ clicks in 1 second)
2. Verify only one submission (debounced or disabled button)
3. Verify single success toast (not multiple)
4. Verify database has only one package (not duplicates)

**Verification:**
- [ ] Race conditions prevented
- [ ] Debounce/disable works

---

### Test EC4: Empty Description
**Precondition:** On Step 1

**Steps:**
1. Leave description empty
2. Proceed to publish
3. Verify submission works (description is optional)
4. On preview: Verify no empty description section

**Verification:**
- [ ] Optional fields handle empty values
- [ ] No errors

---

## SIGN-OFF CHECKLIST

### Before Testing
- [ ] Test environment set up
- [ ] Vendor account created with `photography_videography` profession
- [ ] Customer account available
- [ ] Browser console monitored
- [ ] Database access available

### During Testing
- [ ] Execute all tests in order
- [ ] Document any failures
- [ ] Capture screenshots of issues
- [ ] Note browser/OS
- [ ] Check console for errors

### After Testing
- [ ] All tests passed ✅
- [ ] No critical issues ✅
- [ ] Performance acceptable ✅
- [ ] Mobile responsive ✅
- [ ] Accessibility verified ✅
- [ ] Regression tests passed ✅

---

## TEST RESULTS SUMMARY

**Test Date:** _________________  
**Tested By:** _________________  
**Browser:** _________________  
**OS:** _________________  

### Results
- Section 1 (Creation): ____ / 7 PASSED
- Section 2 (Add-ons): ____ / 2 PASSED
- Section 3 (Images): ____ / 3 PASSED
- Section 4 (Preview): ____ / 2 PASSED
- Section 5 (Publish): ____ / 2 PASSED
- Section 6 (Customer): ____ / 2 PASSED
- Section 7 (Regression): ____ / 4 PASSED
- Performance: ____ / 3 PASSED
- Mobile: ____ / 2 PASSED
- Accessibility: ____ / 2 PASSED
- Error Handling: ____ / 2 PASSED
- Edge Cases: ____ / 4 PASSED

**Total:** ____ / 39 PASSED

### Issues Found
_(List any issues found during testing)_

---

## APPROVAL

- [ ] QA Lead Approval: __________________ Date: __________
- [ ] Product Owner Approval: __________________ Date: __________
- [ ] Development Lead Approval: __________________ Date: __________

---

*End of Testing Guide*
