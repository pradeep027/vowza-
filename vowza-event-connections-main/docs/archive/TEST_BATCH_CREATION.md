# Test Plan: Batch Package Creation Model

**Date:** July 22, 2026  
**Test Objective:** Verify that selecting multiple package types creates N independent DB records

---

## Manual Testing Steps

### Test 1: Single Package Creation
**Prerequisites:** Logged in as vendor, on Anchor Package Manager

1. Click "Add Package"
2. Step 1: Select ONLY "Wedding"
3. Fill in remaining steps (pricing, coverage, etc.)
4. Reach Preview step - should show 1 package card
5. Click "Save Package"
6. **Expected Result:** 
   - 1 record created in `anchor_packages`
   - `package_type = "Wedding"`
   - Can verify in Supabase dashboard

### Test 2: Triple Selection (Critical Test)
**Prerequisites:** Same as Test 1

1. Click "Add Package"
2. Step 1: Select "Wedding", "Reception", "Sangeet"
3. Verify UI shows:
   - "Packages to Create: 3"
   - Draggable queue with 3 items numbered 1,2,3
   - Each item shows: "1. Wedding", "2. Reception", "3. Sangeet"
4. Fill in steps 2-7 identically for all packages
5. Step 8 (Preview): Should show 3 separate package cards
   - Card 1: Wedding type, numbered ① 
   - Card 2: Reception type, numbered ②
   - Card 3: Sangeet type, numbered ③
6. Observe summary: "3 separate, independent package record(s) will be created"
7. Click "Save Package"
8. **Expected Result:**
   - 3 records created in `anchor_packages` table
   - Record 1: `package_type = "Wedding"`
   - Record 2: `package_type = "Reception"`
   - Record 3: `package_type = "Sangeet"`
   - All share same: name, price, coverage, inclusions
   - Each has unique: id (UUID), created_at
9. **Verification SQL** (in Supabase):
   ```sql
   SELECT id, package_type, name, package_price 
   FROM anchor_packages 
   WHERE name = 'YOUR_PACKAGE_NAME' 
   ORDER BY created_at;
   ```
   Should return exactly 3 rows with different `package_type` values.

### Test 3: Drag-and-Drop Reorder
**Prerequisites:** Complete Test 2 successfully

1. Click "Add Package"
2. Step 1: Select "Wedding", "Reception", "Sangeet"
3. Drag "Sangeet" to position 1 (top)
4. Queue should now show:
   - 1. Sangeet
   - 2. Wedding
   - 3. Reception
5. Complete remaining steps and save
6. **Expected Result:**
   - 3 records created
   - Order in Step 8 preview reflects drag reorder
   - But order doesn't matter for final result (each becomes independent package)

### Test 4: Customer View (AnchorMenu)
**Prerequisites:** Test 2 packages created and published (status = "active")

1. Go to customer browse page (not vendor dashboard)
2. Find the Anchor professional
3. View "Anchor Packages" section
4. Should see 3 separate package cards (one for each type)
5. Click on each card
6. **Expected Result:**
   - Each card shows single `package_type` value (not array)
   - Wedding card: type badge shows "Wedding"
   - Reception card: type badge shows "Reception"
   - Sangeet card: type badge shows "Sangeet"
   - Each card is independently bookable

### Test 5: Package Edit Flow
**Prerequisites:** Test 2 packages exist

1. Go to Vendor > Anchor Packages
2. Click Edit on one of the 3 Wedding packages
3. Step 1: `selectedPackageTypes` should be empty array (edit mode)
4. Modify description or price
5. Reach Preview
6. Should show 1 package card (because in edit mode, N=1)
7. Save
8. **Expected Result:**
   - Original package updated (not creating new)
   - No new records in DB
   - Other Wedding/Reception/Sangeet packages unaffected

### Test 6: Display on Marketplace
**Prerequisites:** Packages from Test 2 are active

1. Go to customer homepage
2. Search for or browse Anchor category
3. Find the vendor with 3 packages created
4. Click vendor name to view their packages
5. Should see 3 separate package listings
6. Each shows correct `package_type` badge (Wedding / Reception / Sangeet)

---

## Automated SQL Verification

**Run in Supabase SQL Editor:**

```sql
-- Verify batch creation result for TEST 2
SELECT 
  id,
  package_type,
  name,
  package_price,
  created_at
FROM anchor_packages
WHERE name = 'Premium Anchor Package'  -- Replace with your test package name
ORDER BY created_at;

-- Expected output (3 rows):
-- | id | package_type | name | price | created_at |
-- | (uuid1) | Wedding | Premium Anchor Package | 50000 | 2026-07-22 10:00:00 |
-- | (uuid2) | Reception | Premium Anchor Package | 50000 | 2026-07-22 10:00:00 |
-- | (uuid3) | Sangeet | Premium Anchor Package | 50000 | 2026-07-22 10:00:00 |
```

**Verify no array values:**

```sql
-- Check for any package_type values that look like arrays
SELECT 
  id,
  package_type,
  LENGTH(package_type) as type_length
FROM anchor_packages
WHERE package_type LIKE '[%' OR package_type LIKE '"%'
LIMIT 10;

-- Expected output: Empty (0 rows - no array-like values)
```

**Count packages by type (Test 2 result):**

```sql
SELECT 
  package_type,
  COUNT(*) as count
FROM anchor_packages
WHERE name = 'Premium Anchor Package'
GROUP BY package_type;

-- Expected output:
-- | package_type | count |
-- | Wedding | 1 |
-- | Reception | 1 |
-- | Sangeet | 1 |
```

---

## Failure Indicators

🔴 **FAIL:** If `package_type` contains array notation like `["Wedding","Reception"]`  
🔴 **FAIL:** If only 1 record created when 3 types selected  
🔴 **FAIL:** If selecting types creates "draft" records but no package records  
🔴 **FAIL:** If edit mode allows adding more types (should not)  
🔴 **FAIL:** If customer view shows array rendering like "+2 more"  

---

## Success Criteria

✅ **PASS:** N types selected → N independent records created  
✅ **PASS:** Each record has exactly one `package_type` (singular TEXT)  
✅ **PASS:** Each record has unique ID (UUID)  
✅ **PASS:** Edit mode operates on single package, not batch  
✅ **PASS:** Customer sees N separate package cards, each with singular type  
✅ **PASS:** Drag-and-drop reorder affects preview but not independence  
✅ **PASS:** Build passes with 0 TypeScript errors  

---

## Environment

- **Branch:** main
- **Commit:** 007b6bd (batch creation + summary)
- **Build Status:** ✅ Successful
- **Database:** Supabase
- **Frontend:** React + Vite

---

## Sign-Off

- [ ] Test 1 Passed: Single selection
- [ ] Test 2 Passed: Triple selection (critical)
- [ ] Test 3 Passed: Drag-and-drop reorder
- [ ] Test 4 Passed: Customer view
- [ ] Test 5 Passed: Edit existing
- [ ] Test 6 Passed: Marketplace display
- [ ] SQL Verification: Passed
- [ ] No array-like package_type values in DB

**Ready for Production:** When all tests pass

---

## Notes

- Use test account for vendor (avoid production data)
- Package name should be unique per test run
- Verify Vercel auto-deployed latest code
- Check browser console for any React errors
- Monitor Supabase logs for insert errors
