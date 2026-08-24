# Functional Testing - DATA VALIDATION
## Task 14: Verify data integrity, constraints, and backward compatibility

**Last Updated:** 2026-12-26
**Tester Notes:** Focus on boundary conditions, edge cases, and data consistency

---

## Test Environment Setup

### Prerequisites
- ✓ Migration applied: `20261226000000_anchor_package_refactor.sql`
- ✓ Database has both new and old packages
- ✓ Supabase RLS policies enabled
- ✓ Admin access for direct database queries

### Test Data Categories
- **New Packages:** Created with array-based package_type
- **Legacy Packages:** Pre-existing string-based package_type
- **Mixed Data:** Multiple vendors, multiple packages per vendor

---

## Test Scenario 1: Validation - Empty String Array

**Objective:** Verify empty array is rejected on save

**Steps:**
1. Create or edit package
2. Manually manipulate browser state to set package_type = []
3. Attempt to save
4. Verify validation error: "At least one package classification is required"

**Expected Results:**
- ✓ Empty array rejected
- ✓ Error toast displays
- ✓ Modal stays open
- ✓ Can't save with empty array

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 2: Validation - Null Package Type

**Objective:** Verify null package_type is handled

**Steps:**
1. Query database for package with NULL package_type (edge case)
2. Attempt to load in edit modal
3. Verify graceful handling or error message

**Expected Results:**
- ✓ NULL handled gracefully
- ✓ Either shows empty state or converts to []
- ✓ No crash or console error
- ✓ Can re-select classifications

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 3: Validation - Maximum Classifications

**Objective:** Verify no hard limit on classifications (or enforced limit)

**Steps:**
1. Create package with all 17 classifications selected
2. Verify all display correctly
3. Verify save succeeds
4. Query database to confirm all 17 stored

**Expected Results:**
- ✓ All 17 classifications can be selected
- ✓ All display in selection area
- ✓ Save succeeds
- ✓ Database stores all 17 as array

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 4: Validation - Duplicate Classifications

**Objective:** Verify no duplicates in package_type array

**Steps:**
1. Create package and select: Wedding, Reception, Wedding (attempt to add Wedding twice)
2. Verify second click deselects instead of duplicating
3. Query database to confirm no duplicates stored
4. Edit the package and verify clean state (no duplicates)

**Expected Results:**
- ✓ UI prevents duplicate selection
- ✓ Clicking selected item deselects it
- ✓ Database never stores duplicates
- ✓ No data corruption

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 5: Validation - Invalid Classification Names

**Objective:** Verify only valid classifications are accepted

**Steps:**
1. Manually edit database to insert invalid classification: `["Wedding", "INVALID_TYPE", "Reception"]`
2. Load package in edit modal
3. Verify invalid type displays
4. Attempt to save without changes
5. Verify save succeeds (preserving data)
6. Remove invalid and add valid: ["Wedding", "Reception", "Baraat"]
7. Verify save succeeds

**Expected Results:**
- ✓ Invalid types display but don't break UI
- ✓ UI doesn't validate classification names (only existence)
- ✓ Database stores as-is (user can edit)
- ✓ Can remove invalid and add valid

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 6: Validation - Array Type Consistency

**Objective:** Verify package_type always stored as array in database

**Steps:**
1. Create 5 different packages:
   - Package A: 1 classification
   - Package B: 3 classifications
   - Package C: 5 classifications
   - Package D: Edit old string to array
   - Package E: All 17 classifications
2. Query database:
   ```sql
   SELECT id, package_type, pg_typeof(package_type) FROM anchor_packages 
   WHERE provider_id = '[test_vendor_id]' ORDER BY created_at DESC LIMIT 5;
   ```
3. Verify all package_type values are type text[] (array)
4. Verify none are scalar text

**Expected Results:**
- ✓ All package_type stored as text[] array type
- ✓ None stored as scalar text
- ✓ Consistent data type across all records
- ✓ Database schema enforced

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 7: Backward Compatibility - Old String Format

**Objective:** Verify old string-based packages still load without error

**Steps:**
1. Verify database has package with: package_type = 'Wedding Anchor' (string, not array)
2. Load vendor dashboard
3. Verify package displays without errors
4. Open edit modal
5. Verify loads with conversion: ["Wedding Anchor"]
6. Verify UI doesn't crash
7. Re-save without changes
8. Verify still loads correctly

**Expected Results:**
- ✓ Old string format loads
- ✓ No console errors
- ✓ Converts to array on edit
- ✓ Can still save after conversion
- ✓ Backward compatible

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 8: Backward Compatibility - Mixed Array Types

**Objective:** Verify mixed old and new packages display correctly

**Steps:**
1. Dashboard shows 3 packages:
   - Package A (old): "Reception Host" (string)
   - Package B (new): ["Wedding", "Reception", "Baraat"] (array)
   - Package C (old): "Wedding Anchor" (string)
2. Verify all display without errors
3. Verify cards show appropriate chip format
4. Verify no cross-data contamination
5. Edit each sequentially and verify data integrity

**Expected Results:**
- ✓ Mixed formats display correctly
- ✓ No data leakage between packages
- ✓ Old and new coexist peacefully
- ✓ Card display works for both

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 9: Validation - RLS (Row-Level Security)

**Objective:** Verify RLS policies enforced on package_type

**Steps:**
1. Vendor A creates package with classifications: Wedding, Reception
2. Vendor B attempts to query/modify Vendor A's package:
   ```sql
   SELECT * FROM anchor_packages WHERE provider_id = '[vendor_a_id]';
   UPDATE anchor_packages SET package_type = '["Hacking"]' 
   WHERE provider_id = '[vendor_a_id]';
   ```
3. Verify RLS denies unauthorized access
4. Vendor A can view own package

**Expected Results:**
- ✓ Vendor B cannot read Vendor A's packages
- ✓ Vendor B cannot update Vendor A's packages
- ✓ RLS policy enforced
- ✓ No data leakage

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 10: Validation - Case Sensitivity

**Objective:** Verify classification names are case-sensitive

**Steps:**
1. Create package: ["Wedding", "Reception"]
2. Verify buttons match case exactly
3. Attempt to save variation: ["wedding", "reception"] (lowercase)
4. Verify saves as-is (case preserved)
5. Load and verify case preserved in database

**Expected Results:**
- ✓ Case preserved in storage
- ✓ UI buttons case-sensitive
- ✓ Matching is case-sensitive
- ✓ No automatic case conversion

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 11: Validation - Unicode and Special Characters

**Objective:** Verify handling of special characters in classifications

**Steps:**
1. Database contains package with special chars (if any): ["Wedding", "Réception", "Haldi"]
2. Load in edit modal
3. Verify display without corruption
4. Verify can edit and save
5. Verify special chars preserved in database

**Expected Results:**
- ✓ Unicode characters stored correctly
- ✓ Display without corruption
- ✓ Can edit with special chars
- ✓ Database preserves encoding

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 12: Validation - Whitespace in Classifications

**Objective:** Verify handling of leading/trailing whitespace

**Steps:**
1. Manually insert package: ["Wedding ", " Reception", "Baraat"]
2. Load in edit modal
3. Verify displays (may show extra space)
4. Save without changes
5. Verify database preserves whitespace or trims

**Expected Results:**
- ✓ Handles gracefully
- ✓ Displays without crash
- ✓ Preserves or trims consistently
- ✓ No data corruption

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 13: Validation - Concurrent Edits

**Objective:** Verify concurrent edits don't corrupt data

**Steps:**
1. User A opens edit on Package X (classifications: Wedding, Reception)
2. User B opens edit on same Package X
3. User A adds Baraat → saves (now: Wedding, Reception, Baraat)
4. User B adds Engagement → saves (now: Wedding, Reception, Engagement)
5. Query database for Package X
6. Verify one edit wins or error on conflict

**Expected Results:**
- ✓ No data corruption
- ✓ Either last-write-wins or conflict error
- ✓ Realtime updates show latest state
- ✓ Refresh shows correct data

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 14: Validation - Migration Data Integrity

**Objective:** Verify migration script applied correctly

**Steps:**
1. (Admin) Check if event_types column exists:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'anchor_packages' AND column_name = 'event_types';
   ```
2. Verify column type is text[]
3. Verify default value is '{}'
4. Verify GIN index created:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'anchor_packages' AND indexname LIKE '%event_types%';
   ```
5. Verify all packages have event_types = '{}' (default)

**Expected Results:**
- ✓ event_types column exists
- ✓ Type is text[]
- ✓ Default is '{}' (empty array)
- ✓ GIN index created for performance
- ✓ All packages initialized with default

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 15: Validation - Package with Null Fields

**Objective:** Verify package_type validation with other null fields

**Steps:**
1. Create or find package with:
   - package_type: ["Wedding"] ✓
   - description: NULL
   - deliverables: NULL or []
   - services_included: NULL or []
2. Load in edit modal
3. Verify loads without crashing
4. Verify can edit package_type
5. Verify save succeeds

**Expected Results:**
- ✓ Null fields don't prevent package_type validation
- ✓ Only package_type validation required
- ✓ Other fields can be null/empty
- ✓ No forced validation of unrelated fields

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 16: Validation - Foreign Key Integrity

**Objective:** Verify package_type not involved in foreign key constraints

**Steps:**
1. Delete a package that has bookings
2. Verify cascade behavior works (bookings deleted)
3. Verify no foreign key constraint on package_type field
4. Create package with classifications, book it, modify classifications, delete package
5. Verify all cascades work correctly

**Expected Results:**
- ✓ No foreign key on package_type
- ✓ Cascade deletes work
- ✓ Bookings deleted with package
- ✓ No constraint violations

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 17: Validation - Realtime Subscriptions

**Objective:** Verify Realtime works with array package_type

**Steps:**
1. User A opens vendor dashboard (subscribes to packages)
2. User B creates new package with classifications: Wedding, Reception
3. Verify User A sees new package immediately (Realtime update)
4. User B edits to: Wedding, Reception, Baraat
5. Verify User A sees updated classifications immediately
6. User C deletes User B's package
7. Verify User A sees package removed

**Expected Results:**
- ✓ Realtime reflects new packages
- ✓ Realtime reflects array changes
- ✓ Realtime reflects deletions
- ✓ No data staleness
- ✓ All users see consistent data

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 18: Validation - Index Performance

**Objective:** Verify GIN index on array package_type performs

**Steps:**
1. Create 100+ packages with various classifications
2. Query filtering by classification:
   ```sql
   SELECT COUNT(*) FROM anchor_packages 
   WHERE 'Wedding' = ANY(package_type);
   ```
3. Verify query completes in <100ms
4. Check query plan uses GIN index:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM anchor_packages 
   WHERE 'Wedding' = ANY(package_type);
   ```
5. Verify "Index Scan" in plan (not Seq Scan)

**Expected Results:**
- ✓ GIN index used for queries
- ✓ Query fast (<100ms for 100+ records)
- ✓ EXPLAIN shows Index Scan
- ✓ No Seq Scan overhead

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 19: Validation - Sorting and Ordering

**Objective:** Verify packages display in correct order

**Steps:**
1. Create packages in this order:
   - Package 1: ["Wedding"]
   - Package 2: ["Wedding", "Reception"]
   - Package 3: ["Baraat"]
2. Load vendor dashboard
3. Verify packages display in correct order (created_at DESC by default)
4. Query database to verify order preservation

**Expected Results:**
- ✓ Packages display in creation order (newest first)
- ✓ Order consistent between UI and database
- ✓ Sorting unaffected by array content

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Test Scenario 20: Validation - Null vs Empty Array

**Objective:** Verify distinction between NULL and empty array

**Steps:**
1. Verify new packages initialize with: package_type = '{}' (not NULL)
2. Attempt to insert NULL: 
   ```sql
   INSERT INTO anchor_packages (..., package_type) VALUES (..., NULL);
   ```
3. Verify DEFAULT constraint prevents NULL
4. Verify {} always used instead of NULL

**Expected Results:**
- ✓ Migration sets DEFAULT '{}'
- ✓ NULL prevented by constraint
- ✓ All packages have array (even if empty during draft)
- ✓ Database enforces non-null array

**Actual Result:** [To be filled by tester]
- [ ] Pass
- [ ] Fail - Details: ________________

---

## Summary

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Empty Array | [ ] | |
| 2. Null Package Type | [ ] | |
| 3. Maximum Classifications | [ ] | |
| 4. No Duplicates | [ ] | |
| 5. Invalid Classifications | [ ] | |
| 6. Array Type Consistency | [ ] | |
| 7. Old String Format | [ ] | |
| 8. Mixed Types | [ ] | |
| 9. RLS Enforcement | [ ] | |
| 10. Case Sensitivity | [ ] | |
| 11. Unicode Support | [ ] | |
| 12. Whitespace Handling | [ ] | |
| 13. Concurrent Edits | [ ] | |
| 14. Migration Integrity | [ ] | |
| 15. Null Fields | [ ] | |
| 16. Foreign Keys | [ ] | |
| 17. Realtime | [ ] | |
| 18. Index Performance | [ ] | |
| 19. Sorting/Ordering | [ ] | |
| 20. Null vs Empty Array | [ ] | |

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

**Critical Issues Found:**
```
[List any critical data integrity issues found]




```

**Notes:**
```
[Additional observations and recommendations]




```
