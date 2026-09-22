# Functional Testing - EDIT Package Flow
## Task 13: Verify package editing with multi-select package type system

**Last Updated:** 2026-12-26
**Tester Notes:** Test both new packages (created with refactor) and old packages (legacy data)

---

## Test Environment Setup

### Prerequisites
- ✓ Migration applied: `20261226000000_anchor_package_refactor.sql`
- ✓ Code changes deployed: AnchorPackageManager.tsx refactored
- ✓ At least 2 test packages exist:
  - **Package A (New):** Created with new system (array-based classifications)
  - **Package B (Old):** Pre-existing package with string package_type
- ✓ Vendor logged in as Anchor/Host provider

### Test Packages
- **New Package:** Classifications: ["Wedding", "Reception", "Baraat"]
- **Legacy Package:** package_type: "Wedding Anchor" (string format)

---

## Test Scenario 1: Load Package List and Identify Packages

**Objective:** Verify both new and old packages display correctly in list

**Steps:**
1. Log in as Anchor/Host vendor
2. Navigate to Vendor → Packages → Anchor Packages
3. Locate Package A (new array-based package)
4. Verify displays: [Wedding] [Reception] +1 more
5. Locate Package B (old string-based package)
6. Verify displays: [Wedding Anchor] (or old format)

**Expected Results:**
- ✓ New package shows array format with chips
- ✓ Old package shows legacy format gracefully
- ✓ Both clickable for edit
- ✓ No errors or visual glitches

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 2: Edit New Package - Load Existing Data

**Objective:** Verify new package loads correctly with array classifications

**Steps:**
1. Click Edit on Package A (new package)
2. Modal opens to Step 1
3. Verify classifications appear in selection area: 1.Wedding, 2.Reception, 3.Baraat
4. Verify buttons show as selected (cyan highlight)
5. Verify order matches saved order
6. Verify all other steps show correct data when navigating

**Expected Results:**
- ✓ Modal opens with Step 1 active
- ✓ All 3 classifications visible in selection area
- ✓ Numbers correctly sequential (1, 2, 3)
- ✓ Selected buttons have cyan highlight
- ✓ Data matches what was saved

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 3: Edit Old Package - Data Conversion

**Objective:** Verify old string package_type converts to array format

**Steps:**
1. Click Edit on Package B (old package with "Wedding Anchor" string)
2. Modal opens to Step 1
3. Verify package_type loads and converts
4. Expected conversion: "Wedding Anchor" → ["Wedding Anchor"]
5. Verify it displays as: 1.Wedding Anchor in selection area
6. Verify button is highlighted as selected
7. Verify no errors in console

**Expected Results:**
- ✓ Old string converts to array automatically
- ✓ Single item appears in selection area
- ✓ Button shows as selected
- ✓ Conversion transparent to user
- ✓ No TypeScript/console errors

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 4: Modify New Package Classifications - Add

**Objective:** Verify adding classifications to existing package

**Steps:**
1. Edit Package A (current: Wedding, Reception, Baraat)
2. Click "Engagement" button (not currently selected)
3. Verify "Engagement" added to selection as item #4
4. Verify numbering updated: 1.Wedding, 2.Reception, 3.Baraat, 4.Engagement
5. Click "Sangeet" button
6. Verify "Sangeet" added as item #5
7. Verify all 5 items visible and numbered correctly

**Expected Results:**
- ✓ New items add to selection
- ✓ Numbers auto-increment
- ✓ New button highlights (cyan)
- ✓ All previous items remain intact
- ✓ Selection area scrollable if needed

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 5: Modify New Package Classifications - Remove

**Objective:** Verify removing classifications from existing package

**Steps:**
1. Current selection (from Test 4): Wedding, Reception, Baraat, Engagement, Sangeet
2. Click remove (×) on "Baraat" (item #3)
3. Verify "Baraat" removed
4. Verify renumbered: 1.Wedding, 2.Reception, 3.Engagement, 4.Sangeet
5. Verify "Baraat" button no longer highlighted
6. Click remove on "Reception"
7. Verify remaining: 1.Wedding, 2.Engagement, 3.Sangeet

**Expected Results:**
- ✓ Remove button is clickable
- ✓ Item disappears from selection
- ✓ Remaining items renumber
- ✓ Button highlight removed
- ✓ No gaps in numbering

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 6: Modify Package - Reorder Classifications

**Objective:** Verify drag-drop reordering works on edit

**Steps:**
1. Current selection: 1.Wedding, 2.Engagement, 3.Sangeet
2. Drag "Sangeet" (item #3) over "Wedding" (item #1) and drop
3. Verify new order: 1.Sangeet, 2.Wedding, 3.Engagement
4. Verify numbers updated: sequential 1, 2, 3
5. Drag "Wedding" (now item #2) and drop at end
6. Verify final order: 1.Sangeet, 2.Engagement, 3.Wedding

**Expected Results:**
- ✓ Drag-drop works on edit (not just create)
- ✓ Items reorder on drop
- ✓ Numbers auto-renumber
- ✓ Visual feedback during drag
- ✓ Order persists on save

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 7: Cancel Edit - No Changes Saved

**Objective:** Verify cancel button discards edits

**Steps:**
1. Edit Package A (start with: Wedding, Reception, Baraat)
2. Add "Engagement" (now: Wedding, Reception, Baraat, Engagement)
3. Reorder to: Engagement, Wedding, Reception, Baraat
4. Click Cancel button
5. Verify modal closes
6. Re-open edit on Package A
7. Verify classifications reverted to original: Wedding, Reception, Baraat (original order)

**Expected Results:**
- ✓ Cancel discards all changes
- ✓ Modal closes
- ✓ Original data preserved
- ✓ No unwanted saves

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 8: Save Package with Modified Classifications

**Objective:** Verify modified package saves correctly

**Steps:**
1. Edit Package A (original: Wedding, Reception, Baraat)
2. Modify to: Baraat, Wedding, Sangeet (remove Reception, add Sangeet, reorder)
3. Keep all other fields unchanged (price, name, etc.)
4. Navigate through Steps 2-8 without changes
5. Click "Save Package" on Step 8
6. Wait for success

**Expected Results:**
- ✓ "Saving..." state visible
- ✓ Success toast: "Anchor package saved!"
- ✓ Modal closes
- ✓ Modal returns to Step 1
- ✓ Package list updated with new classifications

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 9: Verify Saved Classification Changes in Card

**Objective:** Verify modified classifications display correctly in package card

**Steps:**
1. From previous test (saved modifications)
2. Find Package A in list
3. Verify card now shows: [Baraat] [Wedding] +1 more
4. Click Edit again
5. Verify Step 1 shows: 1.Baraat, 2.Wedding, 3.Sangeet
6. Verify order matches what was saved

**Expected Results:**
- ✓ Card displays new classifications
- ✓ Chip order matches saved order
- ✓ "+N more" indicator correct
- ✓ Edit shows exact saved state
- ✓ No data loss

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 10: Database Verification - Modified Package

**Objective:** Verify database reflects edited package changes

**Steps:**
1. (Admin access) Query database:
   ```sql
   SELECT id, name, package_type FROM anchor_packages 
   WHERE id = '[package_a_id]';
   ```
2. Verify response shows:
   - package_type: `["Baraat", "Wedding", "Sangeet"]`
   - Order matches saved order
   - Type is array (not string)

**Expected Results:**
- ✓ Query returns updated package
- ✓ package_type is array format
- ✓ Array contains: ["Baraat", "Wedding", "Sangeet"]
- ✓ Order matches UI
- ✓ Type is text[] in Postgres

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 11: Edit Old Package - Modify Classifications

**Objective:** Verify modifying legacy package works correctly

**Steps:**
1. Edit Package B (old package: "Wedding Anchor" string)
2. It loads as: 1.Wedding Anchor in selection area
3. Click "Reception" button to add
4. Verify new selection: 1.Wedding Anchor, 2.Reception
5. Verify buttons highlighted appropriately
6. Reorder: Move Reception to position 1
7. Final order: 1.Reception, 2.Wedding Anchor
8. Save package

**Expected Results:**
- ✓ Old string loads correctly
- ✓ Can modify old packages
- ✓ Can add new classifications
- ✓ Can reorder mixed old/new values
- ✓ Save converts to array format in database

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 12: Database - Old Package Converted to Array

**Objective:** Verify old package saved as array after edit

**Steps:**
1. (Admin access) Query Package B:
   ```sql
   SELECT id, name, package_type FROM anchor_packages 
   WHERE id = '[package_b_id]';
   ```
2. Verify response now shows:
   - package_type: `["Reception", "Wedding Anchor"]`
   - Previously stored as: "Wedding Anchor" (string)
   - Now stored as: array with 2 items

**Expected Results:**
- ✓ Legacy package converted to array on first edit
- ✓ Old value preserved in array
- ✓ New values added to array
- ✓ No data loss
- ✓ Type is text[] (not text)

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 13: Edit Package - Add Many Classifications

**Objective:** Verify handling of many classifications (10+)

**Steps:**
1. Create or edit package with 5 classifications
2. Add more classifications:
   - Click: Birthday, Anniversary, Corporate Event, College Fest, Cultural Event
   - Total now: 10 classifications
3. Verify all visible in selection area (may need scrolling)
4. Verify numbering correct: 1-10
5. Save package

**Expected Results:**
- ✓ Can select many classifications
- ✓ All displayed (with scrolling if needed)
- ✓ Numbers stay correct
- ✓ Drag-drop works with many items
- ✓ Saves successfully

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 14: Edit Package - Remove All Then Re-add

**Objective:** Verify removing all classifications and re-selecting works

**Steps:**
1. Edit package with: Wedding, Reception, Baraat (3 items)
2. Remove all three items one by one
3. Verify selection area is now empty
4. Verify no error message
5. Click "Next" to verify validation triggers: "At least one package classification is required"
6. Click "Wedding" to re-add one
7. Verify it appears as: 1.Wedding
8. Click Next to proceed

**Expected Results:**
- ✓ Can remove all items
- ✓ Empty state valid temporarily
- ✓ Validation prevents empty save
- ✓ Can re-add items after clearing
- ✓ Re-added items get fresh numbering

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 15: Edit Package - Duplicate Classification

**Objective:** Verify can't select same classification twice

**Steps:**
1. Edit package with: Wedding
2. Click "Wedding" button again
3. Verify it deselects (doesn't duplicate)
4. Verify selection shows: 1.Wedding only
5. No error message

**Expected Results:**
- ✓ Selecting already-selected item deselects it
- ✓ No duplicates in selection
- ✓ Clicking toggles on/off
- ✓ Consistent with create flow

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 16: Edit Package - Data Persistence

**Objective:** Verify back/forward navigation preserves edits in edit mode

**Steps:**
1. Edit package: Start with Wedding, Reception, Baraat
2. Modify on Step 1: Add Engagement, Sangeet (now: Wedding, Reception, Baraat, Engagement, Sangeet)
3. Click Next → Step 2
4. Modify price: 15000
5. Click Next → Step 3
6. Click Back → Back to Step 2
7. Verify price still 15000
8. Click Back → Back to Step 1
9. Verify classifications still: Wedding, Reception, Baraat, Engagement, Sangeet (all 5 with correct order)
10. Click Next → Next → Back to verify data persistence

**Expected Results:**
- ✓ Classifications persist on back/forward
- ✓ Order maintained exactly
- ✓ Other field changes also persist
- ✓ No data loss on navigation

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 17: Edit Package - Mobile UI

**Objective:** Verify edit flow works on mobile viewport

**Steps:**
1. Resize browser to 375x667 (mobile)
2. Edit a package
3. Verify Step 1 displays correctly on mobile
4. Verify all 17 buttons visible (with scrolling)
5. Verify chip selection area works on mobile
6. Verify drag-drop works on mobile (or fallback UI)
7. Verify modal doesn't overflow
8. Test full edit-to-save cycle on mobile

**Expected Results:**
- ✓ Modal responsive on mobile
- ✓ All UI elements touch-friendly
- ✓ No horizontal scroll needed
- ✓ Drag-drop or alternative interaction works
- ✓ Save works on mobile

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 18: Edit Package - No Accidental Changes

**Objective:** Verify loading edit without changes doesn't alter package

**Steps:**
1. Package A current state: Wedding, Reception, Baraat
2. Click Edit
3. Don't modify anything
4. Navigate through all steps without changes
5. Click "Save Package"
6. Close modal
7. Re-open Package A
8. Verify classifications unchanged: Wedding, Reception, Baraat (same order)

**Expected Results:**
- ✓ Opening and closing without changes leaves package intact
- ✓ No phantom updates
- ✓ Realtime listeners don't trigger false updates
- ✓ Database shows no modification timestamp change (or only updated_at)

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 19: Edit Different Packages Sequential

**Objective:** Verify editing multiple packages sequentially works

**Steps:**
1. Edit Package A (make changes, save)
2. Immediately edit Package B (make different changes, save)
3. Edit Package A again
4. Verify Package A changes from step 1 are present
5. Edit Package B again
6. Verify Package B changes from step 2 are present

**Expected Results:**
- ✓ Multiple edit cycles work
- ✓ Data isolation between packages
- ✓ No data mixing or leakage
- ✓ Each package maintains its modifications

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 20: Edit Package - Error on Save

**Objective:** Verify error handling when save fails

**Steps:**
1. Set up network condition: offline or slow
2. Edit a package and add/remove classifications
3. Navigate to Step 8
4. Click "Save Package"
5. During save, connection fails
6. Verify error message appears
7. Verify modal stays open
8. Verify data not lost (can still see classifications)
9. Restore network
10. Click "Save Package" again
11. Verify save succeeds on retry

**Expected Results:**
- ✓ Error toast shows on save failure
- ✓ Modal doesn't close on error
- ✓ User can retry
- ✓ Data preserved for retry
- ✓ Successful retry works

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Summary

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Load List | [ ] | |
| 2. Load New Package | [ ] | |
| 3. Load Old Package | [ ] | |
| 4. Add Classifications | [ ] | |
| 5. Remove Classifications | [ ] | |
| 6. Reorder Classifications | [ ] | |
| 7. Cancel Edit | [ ] | |
| 8. Save Modified | [ ] | |
| 9. Verify Card Display | [ ] | |
| 10. DB Verify Modified | [ ] | |
| 11. Edit Old Package | [ ] | |
| 12. DB Old Package Converted | [ ] | |
| 13. Many Classifications | [ ] | |
| 14. Remove All Re-add | [ ] | |
| 15. No Duplicate | [ ] | |
| 16. Data Persistence | [ ] | |
| 17. Mobile UI | [ ] | |
| 18. No Accidental Changes | [ ] | |
| 19. Sequential Edits | [ ] | |
| 20. Error on Save | [ ] | |

**Total Tests:** 20
**Passed:** ___
**Failed:** ___
**Blocked:** ___

---

## Sign-off

**Tested By:** ____________________
**Date:** ____________________
**Overall Result:** 
- [ ] All Pass - Ready for production
- [ ] Some Fail - Needs fixes (list in notes below)
- [ ] Blocked - Needs clarification

**Notes:**
```
[Space for additional notes, issues, recommendations]




```
