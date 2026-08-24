# Functional Testing - CREATE Package Flow
## Task 12: Verify package creation with new multi-select package type system

**Last Updated:** 2026-12-26
**Tester Notes:** Follow each scenario exactly, verify output at each step

---

## Test Environment Setup

### Prerequisites
- ✓ Migration applied: `20261226000000_anchor_package_refactor.sql`
- ✓ Code changes deployed: AnchorPackageManager.tsx refactored
- ✓ TypeScript compiled: 0 errors
- ✓ Vendor logged in as Anchor/Host provider

### Test Data
- Test Vendor: Any Anchor or Host provider
- Test Classifications: Use from 17-item list (Wedding, Reception, Baraat, etc.)
- Browser: Chrome (latest), Firefox (latest), Safari (latest)
- Viewport: Desktop (1920x1080), Mobile (375x667)

---

## Test Scenario 1: Empty State - No Packages Exist

**Objective:** Verify empty state UI and "Add Package" button functionality

**Steps:**
1. Log in as Anchor/Host vendor
2. Navigate to Vendor → Packages → Anchor Packages
3. Verify page shows "No packages yet" message
4. Verify "Add Package" button displays

**Expected Results:**
- ✓ Empty state message visible
- ✓ "+ Add Package" button clickable
- ✓ Button opens package creation modal

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 2: New Package Creation Modal Opens

**Objective:** Verify modal launches with Step 1 displayed

**Steps:**
1. Click "+ Add Package" button
2. Verify modal appears with full wizard interface
3. Verify "Add New Package" header visible
4. Verify Step 1 is active (blue highlight, label visible)
5. Verify progress bar shows Step 1/8

**Expected Results:**
- ✓ Modal opens with proper styling
- ✓ "Add New Package" title visible
- ✓ Step indicator shows 1/8
- ✓ Next button enabled (not disabled)
- ✓ Cancel button visible

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 3: Step 1 - Package Type Selector (Single Selection)

**Objective:** Verify multi-select package type interface with single selection

**Steps:**
1. View Step 1 content
2. Verify title: "Package Classifications *"
3. Verify subtitle: "Select the types of events your anchoring package covers..."
4. Verify 17 classification buttons displayed:
   - Wedding, Reception, Baraat, Engagement, Sangeet, Haldi, Mehendi,
   - Birthday, Anniversary, Corporate Event, College Fest, Cultural Event,
   - Private Party, Public Event, Religious Event, Award Function, Custom Event
5. Click "Wedding" button
6. Verify "Wedding" button background changes (cyan highlight)
7. Verify "Wedding" appears in selection area below with number "1."
8. Verify remove (×) button appears next to "Wedding"

**Expected Results:**
- ✓ All 17 classifications visible as buttons
- ✓ Click toggles button appearance (cyan bg when selected)
- ✓ Selected item appears in selection area with ordering number
- ✓ Remove button clickable on selected item
- ✓ Next button remains enabled

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 4: Step 1 - Multiple Selection

**Objective:** Verify multi-select functionality with 3+ classifications

**Steps:**
1. From previous state (Wedding selected)
2. Click "Reception" button
3. Verify "Reception" added to selection (shows as "2. Reception")
4. Click "Baraat" button
5. Verify "Baraat" added (shows as "3. Baraat")
6. Click "Engagement" button
7. Verify "Engagement" added (shows as "4. Engagement")
8. Verify all 4 items visible in selection area
9. Verify counts are sequential: 1, 2, 3, 4

**Expected Results:**
- ✓ Each click adds item to selection
- ✓ Numbers auto-increment correctly
- ✓ All 4 items visible and properly ordered
- ✓ Remove buttons present for each item
- ✓ Next button remains enabled

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 5: Step 1 - Drag and Drop Reordering

**Objective:** Verify drag-drop reordering of selected classifications

**Steps:**
1. Current selection: 1.Wedding, 2.Reception, 3.Baraat, 4.Engagement
2. Drag "Baraat" (item #3) over "Wedding" (item #1) and drop
3. Verify new order: 1.Baraat, 2.Wedding, 3.Reception, 4.Engagement
4. Verify numbers automatically renumbered
5. Drag "Engagement" (item #4) and drop on "Reception" (item #3)
6. Verify new order: 1.Baraat, 2.Wedding, 3.Engagement, 4.Reception
7. Verify numbers reflect new sequence

**Expected Results:**
- ✓ Drag-drop accepts mouse/touch events
- ✓ Items reorder on drop
- ✓ Numbers auto-renumber after reorder
- ✓ Visual feedback during drag (opacity change or highlight)
- ✓ Selection array updates correctly

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 6: Step 1 - Remove Item

**Objective:** Verify removing items from selection

**Steps:**
1. Current selection: 1.Baraat, 2.Wedding, 3.Engagement, 4.Reception
2. Click remove (×) button on "Wedding" (item #2)
3. Verify "Wedding" removed from selection
4. Verify remaining items renumbered: 1.Baraat, 2.Engagement, 3.Reception
5. Click remove button on "Baraat" (now item #1)
6. Verify "Baraat" removed, remaining: 1.Engagement, 2.Reception
7. Remove "Reception" as well
8. Verify only "Engagement" remains (item #1)

**Expected Results:**
- ✓ Remove button is clickable
- ✓ Item disappears from selection
- ✓ Numbers auto-renumber after removal
- ✓ Empty selection area still visible (ready for new selections)
- ✓ Next button remains enabled even with 1 item

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 7: Step 1 - Deselect by Clicking Button Again

**Objective:** Verify deselecting by clicking selected button

**Steps:**
1. Current selection: 1.Engagement
2. Click "Engagement" button again
3. Verify "Engagement" removed from selection
4. Verify "Engagement" button no longer highlighted
5. Verify selection area is now empty

**Expected Results:**
- ✓ Clicking selected item deselects it
- ✓ Button highlight removed
- ✓ Selection area clears
- ✓ Next button remains enabled

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 8: Step 1 - Validation (No Selection)

**Objective:** Verify validation prevents advancing without selection

**Steps:**
1. Ensure selection area is empty (no items selected)
2. Click "Next" button
3. Wait 1 second
4. Verify error toast appears: "At least one package classification is required."
5. Verify modal stays on Step 1
6. Verify progress bar still shows Step 1/8

**Expected Results:**
- ✓ Next button click triggers validation
- ✓ Error toast displays with correct message
- ✓ Modal doesn't advance to Step 2
- ✓ Step indicator unchanged

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 9: Complete Create Flow - Proceed to Step 2

**Objective:** Verify advancing from Step 1 with valid selection

**Steps:**
1. Select 3 classifications: Wedding, Reception, Baraat
2. Verify they appear in selection area as 1, 2, 3
3. Click "Next" button
4. Wait for modal to advance

**Expected Results:**
- ✓ Modal advances to Step 2
- ✓ Step indicator updates to 2/8
- ✓ Step 1 button shows checkmark (✓)
- ✓ Step 2 title visible (should show pricing section)
- ✓ Back button now says "Back" (not Cancel)

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 10: Data Persistence Through Wizard

**Objective:** Verify selected classifications persist through modal wizard

**Steps:**
1. Selections on Step 1: Wedding, Reception, Baraat
2. Fill Step 2 (pricing): Price = 5000, Advance % = 20
3. Click Next → Step 3
4. Click Back multiple times to return to Step 1
5. Verify package classifications still show: 1.Wedding, 2.Reception, 3.Baraat
6. Verify exact order preserved (no reordering)
7. Click Next → Forward through steps
8. Verify classifications persist on each step

**Expected Results:**
- ✓ Classifications persist when navigating back/forward
- ✓ Order maintained (numbers don't change)
- ✓ No data loss on navigation
- ✓ All other step data also preserved

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 11: Complete Package Save

**Objective:** Verify final save operation with new package type system

**Steps:**
1. Complete full wizard:
   - Step 1: Select Wedding, Reception, Baraat
   - Step 2: Price = 10000, Advance = 20%
   - Step 3: Select hosting styles (e.g., Formal, Casual)
   - Step 4: Select services included
   - Step 5: Team size (Lead = 1, Assistant = 0)
   - Step 6: Add deliverables
   - Step 7: Add optional add-ons
   - Step 8: Review all data
2. Click "Save Package" button
3. Wait for save to complete

**Expected Results:**
- ✓ "Saving…" state visible briefly
- ✓ Success toast displays: "Anchor package saved!"
- ✓ Modal closes automatically
- ✓ Modal returns to Step 1 (ready for next package)
- ✓ New package appears in package list

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 12: Saved Package Display in Card

**Objective:** Verify new package appears correctly in card preview

**Steps:**
1. Find newly created package in package list
2. Verify package name displays
3. Verify price displays as "₹10,000"
4. Verify status badge shows "draft" (or "active" depending on settings)
5. Verify classifications display as chips:
   - First 2 shown: "Wedding", "Reception"
   - "+1 more" indicator visible (since 3 total)
6. Click Edit to re-open package

**Expected Results:**
- ✓ Package card shows all required info
- ✓ Package type chips show first 2 items
- ✓ "+N more" correctly indicates remaining items
- ✓ Edit button opens wizard with saved data
- ✓ All data matches what was entered

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 13: Database Verification (Admin/Query)

**Objective:** Verify package saved correctly in database

**Steps:**
1. (Admin access) Query database:
   ```sql
   SELECT id, name, package_type, status FROM anchor_packages 
   WHERE provider_id = '[test_vendor_id]' 
   ORDER BY created_at DESC LIMIT 1;
   ```
2. Verify response shows:
   - package_type value: `["Wedding", "Reception", "Baraat"]`
   - Type is array (not string)
   - Status matches UI

**Expected Results:**
- ✓ Query returns newly created package
- ✓ package_type stored as array in database
- ✓ Array elements match selections
- ✓ Order matches selection order
- ✓ Type is text[] in Postgres

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 14: Mobile Responsiveness

**Objective:** Verify create flow works on mobile (375x667 viewport)

**Steps:**
1. Resize browser to 375x667 (mobile)
2. Follow Test Scenario 1-11 on mobile viewport
3. Verify all buttons are clickable (touch-friendly sizing)
4. Verify drag-drop works on mobile (or shows alternative UI)
5. Verify modal doesn't overflow viewport
6. Verify keyboard doesn't obscure form inputs

**Expected Results:**
- ✓ All UI elements visible without horizontal scroll
- ✓ Buttons have adequate touch targets (48px+ min)
- ✓ Chips display properly on small screen
- ✓ Modal is responsive or scrollable
- ✓ Drag-drop works or graceful fallback exists

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 15: Error Handling - Network Failure

**Objective:** Verify graceful error handling on save failure

**Steps:**
1. Open DevTools → Network tab
2. Set network to "Offline"
3. Complete package wizard through Step 8
4. Click "Save Package" button
5. Wait for network request to fail
6. Verify error message displays

**Expected Results:**
- ✓ Error toast shows with descriptive message
- ✓ Modal stays open (doesn't close)
- ✓ Save button re-enabled for retry
- ✓ No duplicate entries in package list

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 16: Data Type Consistency Check

**Objective:** Verify package_type is consistently stored as array

**Steps:**
1. Create 3 different packages with different selection counts:
   - Package A: 1 classification (Wedding)
   - Package B: 3 classifications (Reception, Baraat, Engagement)
   - Package C: 5 classifications (all previous + Sangeet, Haldi)
2. Query database for all three:
   ```sql
   SELECT name, package_type FROM anchor_packages 
   WHERE provider_id = '[test_vendor_id]' 
   ORDER BY created_at;
   ```
3. Verify all package_type values are arrays (not strings)
4. Verify array lengths match selection counts

**Expected Results:**
- ✓ Package A: ["Wedding"] (length 1)
- ✓ Package B: ["Reception", "Baraat", "Engagement"] (length 3)
- ✓ Package C: ["Reception", "Baraat", "Engagement", "Sangeet", "Haldi"] (length 5)
- ✓ All are arrays ([ ] notation in database)
- ✓ No string values present

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Summary

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Empty State | [ ] | |
| 2. Modal Opens | [ ] | |
| 3. Single Selection | [ ] | |
| 4. Multiple Selection | [ ] | |
| 5. Drag-Drop | [ ] | |
| 6. Remove Item | [ ] | |
| 7. Deselect | [ ] | |
| 8. Validation | [ ] | |
| 9. Proceed Step 2 | [ ] | |
| 10. Data Persistence | [ ] | |
| 11. Package Save | [ ] | |
| 12. Card Display | [ ] | |
| 13. DB Verification | [ ] | |
| 14. Mobile | [ ] | |
| 15. Error Handling | [ ] | |
| 16. Type Consistency | [ ] | |

**Total Tests:** 16
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
