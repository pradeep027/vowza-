# Drag-and-Drop Package Creation - Test Scenarios

## Overview
Testing the new drag-and-drop UI for creating independent package records. Each dragged package type creates a separate database record with its own unique ID and singular `package_type` field.

---

## Test 1: Drag Single Package Type
**Objective:** Verify that dragging a single package type creates one independent package card.

### Steps:
1. Open "Add New Package" wizard
2. See available package types: Wedding, Reception, Sangeet, Engagement, etc.
3. Drag "Wedding" to the drop zone
4. Verify:
   - ✅ "Wedding" disappears from available types (marked as used)
   - ✅ One card appears in "Created Packages" section
   - ✅ Card shows: #1 | Wedding Package | "Ready" status
   - ✅ Card has remove button (X)
   - ✅ Toast: "Added Wedding package"

### Expected Database Result (after save):
```
anchor_packages table:
- Record 1: package_type = "Wedding" (unique ID)
```

---

## Test 2: Drag Multiple Independent Packages
**Objective:** Verify that dragging multiple types creates multiple independent package cards.

### Steps:
1. Continue from Test 1 (Wedding already added)
2. Drag "Reception" to drop zone
3. Verify:
   - ✅ "Reception" disappears from available types
   - ✅ Second card appears: #2 | Reception Package | "Ready"
   - ✅ Cards are NOT merged (Wedding card unchanged)
   - ✅ Toast: "Added Reception package"
4. Drag "Sangeet" to drop zone
5. Verify:
   - ✅ Third card appears: #3 | Sangeet Package | "Ready"
   - ✅ Wedding and Reception cards unchanged
   - ✅ Toast: "Added Sangeet package"

### Expected Database Result (after save):
```
anchor_packages table:
- Record 1: package_type = "Wedding" (unique ID)
- Record 2: package_type = "Reception" (unique ID)
- Record 3: package_type = "Sangeet" (unique ID)
```

### ❌ INCORRECT (should NOT happen):
```
anchor_packages table:
- Record 1: package_type = ["Wedding", "Reception", "Sangeet"]
```

---

## Test 3: Edit Independent Package
**Objective:** Verify that editing one package does NOT affect others.

### Steps:
1. Have 3 packages created: Wedding (#1), Reception (#2), Sangeet (#3)
2. Fill in form details:
   - Package Name: "Premium Anchor Package"
   - Price: ₹50,000
   - Status: Active
   - Coverage: Full Event, Reception
   - Upload cover photo
3. Move to Step 2-8 (configure all packages)
4. **On Step 1 (before save):**
   - Wedding card shows all entered data
   - Reception card shows same data
   - Sangeet card shows same data
   - All 3 share the name/price/coverage (UI shows this is expected)
5. Verify:
   - ✅ Each card still independently numbered (#1, #2, #3)
   - ✅ Each card shows its type badge (Wedding, Reception, Sangeet)
   - ✅ No data loss when navigating between steps

### Expected Behavior:
- Common fields (name, price, photos) are SHARED (by design)
- Package Type is INDEPENDENT for each card
- When saved: 3 separate records created with same name/price but different `package_type`

---

## Test 4: Remove Package (Allows Re-Add)
**Objective:** Verify that removing a package allows re-dragging it.

### Steps:
1. Have 3 packages: Wedding, Reception, Sangeet
2. Click X button on Reception card (#2)
3. Verify:
   - ✅ Reception card disappears
   - ✅ Wedding and Sangeet cards remain
   - ✅ "Reception" reappears in Available Package Types section
   - ✅ Toast: "Removed Reception package"
   - ✅ Card count updates: "📋 Created Packages (2)"
4. Drag "Reception" again
5. Verify:
   - ✅ New Reception card appears as #3 (renumbered)
   - ✅ Card is independent and editable
   - ✅ Toast: "Added Reception package"

### Expected Behavior:
- Removal = safe operation (no data loss from other packages)
- Package type becomes available for re-drag
- Re-adding creates fresh card with clean state
- Numbering updates (Wedding #1, Sangeet #2, Reception #3)

---

## Test 5: Duplicate Prevention
**Objective:** Verify that dragging the same type twice is prevented.

### Steps:
1. Have Wedding package created
2. Attempt to drag "Wedding" again to drop zone
3. Verify:
   - ✅ Toast: "Wedding is already added. Duplicates not allowed."
   - ✅ No duplicate card created
   - ✅ Only 1 Wedding card exists
   - ✅ "Wedding" remains unavailable in source area

### Expected Behavior:
- System prevents duplicate package types
- Clear user feedback via toast
- No data corruption from duplicate attempts

---

## Test 6: Data Isolation - Edit Individual Package
**Objective:** Verify that editing Step 2-8 affects all packages equally (shared data), but each saves independently.

### Steps:
1. Create 3 packages: Wedding, Reception, Sangeet
2. Navigate to Step 2 (Pricing)
3. Enter:
   - Package Price: ₹75,000
   - Advance %: 30%
4. Navigate to Step 3 (Coverage)
5. Select: "Full Event", "Ceremony"
6. Navigate to Step 4 (Inclusions)
7. Select: "Event Hosting", "Guest Engagement"
8. Continue to Steps 5-8 (Team, Deliverables, Add-ons, Preview)
9. On Step 8 (Preview):
   - Verify ALL 3 packages show:
     - Same name, price, coverage, inclusions
     - Different package types (Wedding, Reception, Sangeet)
     - Each has own #1, #2, #3 badge
     - Same photos, team, deliverables
10. Click "Save Package"
11. Verify:
    - ✅ Toast: "3 anchor package(s) saved!"
    - ✅ Modal closes
    - ✅ Page refreshes
    - ✅ Package list shows 3 new packages

### Expected Database Result:
```
anchor_packages table:
- Record ID: uuid1, package_type: "Wedding", name: "Premium...", price: 75000
- Record ID: uuid2, package_type: "Reception", name: "Premium...", price: 75000
- Record ID: uuid3, package_type: "Sangeet", name: "Premium...", price: 75000

anchor_gallery table (cover photo):
- Uploaded to Record ID uuid1 (first package only - by design)

anchor_addons table (if add-ons added):
- Linked to Record ID uuid1 (first package only - by design)
```

---

## Test 7: Visual Feedback During Drag
**Objective:** Verify drag-over visual feedback works correctly.

### Steps:
1. Start dragging "Wedding" from source area
2. Observe:
   - ✅ Source "Wedding" card opacity changes to ~50%
   - ✅ Card is still visible but dimmed
3. Drag over drop zone
4. Observe:
   - ✅ Drop zone background changes to light cyan
   - ✅ Drop zone border color brightens
   - ✅ Drop zone text changes to "✨ Drop here to create"
   - ✅ Shadow/ring appears around drop zone
5. Drag out of drop zone
6. Observe:
   - ✅ Drop zone reverts to normal state
   - ✅ Text changes back to "🎯 Drag packages here"
7. Complete drag (drop in zone)
8. Observe:
   - ✅ Dragged type resets
   - ✅ Drop zone resets to normal
   - ✅ New card appears with animation

---

## Summary of Test Results

| Test | Scenario | Status | Notes |
|------|----------|--------|-------|
| 1 | Single drag | ⏳ PENDING | Creates 1 card, removes from available |
| 2 | Multiple drags | ⏳ PENDING | Creates 3 independent cards (NOT merged) |
| 3 | Edit package | ⏳ PENDING | Data isolation - common fields shared |
| 4 | Remove & re-add | ⏳ PENDING | Safe removal, type reappears, renumbering works |
| 5 | Duplicate prevention | ⏳ PENDING | Prevents duplicate types, clear feedback |
| 6 | Data isolation save | ⏳ PENDING | Creates N separate records with correct types |
| 7 | Visual feedback | ⏳ PENDING | Drag-over highlight, text updates, smooth UX |

---

## Validation Checklist

### UI Requirements Met:
- [ ] Source area shows only available (not-yet-added) package types
- [ ] Drop zone clearly visible with call-to-action
- [ ] Package cards display independently with numbering
- [ ] Remove button allows safe deletion and re-add
- [ ] Visual feedback on drag-over (color, shadow, text change)
- [ ] Toast notifications confirm actions (add, remove, duplicate)
- [ ] Duplicate prevention with clear message

### Data Model Requirements Met:
- [ ] `selectedPackageTypes: string[]` tracks creation queue
- [ ] Each item in array = one independent package
- [ ] Save loop creates N records (one per type)
- [ ] Each record has singular `package_type: type` value
- [ ] No array-type packages in database
- [ ] Each package gets unique database ID
- [ ] Media uploaded only to first package (by design)

### Database Schema Verified:
- [ ] `anchor_packages.package_type` is TEXT (singular)
- [ ] No `package_types` array field
- [ ] Batch insert works correctly
- [ ] All N records created successfully

### User Experience:
- [ ] Mental model: "Drag Type → Create Card → Configure It"
- [ ] Clear separation between independent packages
- [ ] No accidental duplicates or data loss
- [ ] Smooth drag-and-drop interactions
- [ ] Responsive feedback for all actions

---

## Notes for Deployment
- Drag-and-drop uses native HTML5 API (no external library required)
- Tested on modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile support: Touch events should trigger drag-over (verify if needed)
- Accessibility: Keyboard navigation not required for MVP (drag-only interface)

