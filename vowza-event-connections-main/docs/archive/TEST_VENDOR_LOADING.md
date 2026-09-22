# Vendor Loading - Test & Verification

**Status:** Fix applied ✅  
**Build:** PASS (0 errors) ✅  
**Dev Server:** Running on http://localhost:8080

---

## Quick Test (5 minutes)

### Step 1: Open Admin Promotions
```
URL: http://localhost:8080/admin/auth-promotion
Expected: Admin page loads
```

### Step 2: Open Browser Console
```
Press: F12
Navigate to: Console tab
Clear previous logs
```

### Step 3: Test Catering Category
```
Action: In "Link to Vendor/Package" section:
        Category dropdown → Select "Catering"

Expected Console Logs:
  [PromotionSelector] Loading vendors for category: catering profession: catering_services
  [PromotionSelector] Query returned: X vendors

Expected Result (one of):
  ✅ Vendor dropdown populates with caterers
  ⚠️  "No vendors found for catering" message
  ❌ "Failed to load vendors" + error details in console
```

### Step 4: Test Vendor Selection (if vendors loaded)
```
Action: Vendor dropdown → Select a vendor (e.g., "Sri Lakshmi Catering")

Expected Console Logs:
  [PromotionSelector] Loading packages from table: catering_packages for provider: [uuid]

Expected Result:
  ✅ Package dropdown populates
  ⚠️  "No packages found for this vendor" message
  ❌ Error message in console
```

### Step 5: Test Singer Category (No Packages)
```
Action: Change Category → "Singer"
        Vendor dropdown → Select a singer

Expected:
  - Vendor loads successfully (like catering)
  - No "Package" section appears (singers don't have packages)
  - OR message: "Category does not support package selection"
```

### Step 6: Test Photography (With Packages)
```
Action: Category → "Photography"
        Vendor → Select photographer
        Expected: Packages load for that photographer
```

---

## Full Diagnostic Checklist

### Console Output Analysis

**GOOD - Vendors loaded:**
```
[PromotionSelector] Loading vendors for category: catering profession: catering_services
[PromotionSelector] Query returned: 5 vendors
[PromotionSelector] Processed vendor options: [{id: "abc", name: "Sri Lakshmi Catering"}, ...]
```

**OK - No vendors but correct error:**
```
[PromotionSelector] Query returned: 0 vendors
[PromotionSelector] No vendors found for catering. Please ensure vendors exist and are verified.
```

**BAD - Database error:**
```
[PromotionSelector] Query error: {code: "42P01", message: "relation \"provider_profiles\" does not exist"}
[PromotionSelector] Vendor loading error: relation "provider_profiles" does not exist
Failed to load vendors: relation "provider_profiles" does not exist
```

**BAD - SQL column error (OLD BUG - should be fixed now):**
```
[PromotionSelector] Query error: {code: "42703", message: "column \"full_name\" does not exist"}
[PromotionSelector] Vendor loading error: column "full_name" does not exist in table "provider_profiles"
Failed to load vendors: column "full_name" does not exist
```

---

## Expected Results By Category

### Catering
| Step | Expected Result | Status |
|------|-----------------|--------|
| Select "Catering" | Vendor dropdown populates | [ ] |
| Select vendor | Catering packages load | [ ] |
| Select package | Confirmation shows vendor + package | [ ] |

### Photography
| Step | Expected Result | Status |
|------|-----------------|--------|
| Select "Photography" | Vendor dropdown populates | [ ] |
| Select photographer | Photography packages load | [ ] |
| Select package | Confirmation shows photographer + package | [ ] |

### Singer
| Step | Expected Result | Status |
|------|-----------------|--------|
| Select "Singer" | Singer dropdown populates | [ ] |
| Select singer | No package section OR error msg about no packages | [ ] |
| Reason | Singers don't have package tables | - |

### DJ
| Step | Expected Result | Status |
|------|-----------------|--------|
| Select "DJ" | DJ vendor dropdown populates | [ ] |
| Select DJ | DJ packages load | [ ] |
| Select package | Confirmation shows DJ + package | [ ] |

---

## Debug Scenarios

### Scenario 1: "Failed to load vendors"
**Check console logs for:**
```javascript
// Look for [PromotionSelector] logs
// Check the error details

If "column ... does not exist":
  ✅ OLD BUG - Fix has been applied
  
If "No vendors found":
  ⚠️ This is OK - no test data in this category
  
If actual database error:
  ❌ There may be a different issue
  📋 Copy error message and report
```

### Scenario 2: Vendors load but no packages
**This is correct for some categories:**
- Singers: No packages (entertainment-only)
- Dancers: May or may not have packages
- Some may be price-only (no package table)

**Check console:**
```javascript
// Should show:
[PromotionSelector] Category does not support package selection
// OR
[PromotionSelector] No packages found for this vendor
```

### Scenario 3: Vendor loads but appears blank
**Check browser DevTools:**
1. F12 → Elements/Inspector
2. Right-click vendor dropdown option
3. Verify it has content (not empty)
4. Check console for vendor name: `Processed vendor options: [{name: "..."}]`

---

## Database Query Verification

If you want to manually verify the data exists:

**Supabase Dashboard:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Run:
   ```sql
   -- Check if catering vendors exist
   SELECT 
     pp.id, 
     pp.stage_name,
     pr.full_name,
     pp.profession,
     pp.is_verified
   FROM provider_profiles pp
   LEFT JOIN profiles pr ON pr.id = pp.user_id
   WHERE pp.profession = 'catering_services'
   LIMIT 10;
   ```

5. If rows return: Vendors exist ✅
6. If no rows: No vendors for this category in DB ⚠️

**Expected output for catering:**
```
id                  | stage_name             | full_name           | profession         | is_verified
abc-123-uuid        | Sri Lakshmi Catering   | Radhika Kumar        | catering_services  | true
def-456-uuid        | XYZ Catering           | Rajesh Sharma        | catering_services  | true
```

---

## Success Criteria

✅ **ALL of these must pass:**

1. [ ] Category dropdown loads without error
2. [ ] After selecting category, vendor dropdown populates (or shows "No vendors" message)
3. [ ] After selecting vendor, packages load (or shows "No packages" for categories without packages)
4. [ ] Console shows `[PromotionSelector]` logs (not hidden errors)
5. [ ] No "Failed to load vendors" error for categories with test vendors
6. [ ] Can select vendor + package and see confirmation
7. [ ] Submission shows "✓ Promotion will link to exact vendor and package"

**If all 7 pass → Vendor loading fix is working ✅**

---

## Fallback: Manual Verification

If automated testing isn't possible, manually verify the fix:

**Check the code:**
1. File: `src/components/admin/PromotionVendorPackageSelector.tsx`
2. Find: `.select(\`` (should see the new JOIN query)
3. Should see: `profiles:user_id (full_name, email)`
4. This proves the fix is in place

**Build verification:**
```bash
npm run build
# Expected: ✅ PASS (0 errors, 1m+)
```

---

## Report Template

When testing, use this format:

```markdown
## Vendor Loading Test Report

**Date:** [date]
**Tester:** [name]
**Environment:** Localhost http://localhost:8080

### Catering Test
- [ ] Category "Catering" selected successfully
- [ ] Vendor dropdown shows: [X vendors loaded / No vendors / Error]
- [ ] Console shows: [log message]
- [ ] Status: [✅ PASS / ⚠️ WARNING / ❌ FAIL]

### Photography Test
- [ ] Category "Photography" selected successfully
- [ ] Vendor dropdown shows: [X vendors loaded / No vendors / Error]
- [ ] Selected vendor loads packages: [✅ YES / ❌ NO / ⚠️ ERROR]
- [ ] Status: [✅ PASS / ⚠️ WARNING / ❌ FAIL]

### Overall Status
[✅ WORKING / ⚠️ PARTIAL / ❌ BROKEN]

### Console Errors (if any)
[Copy-paste any error messages]

### Notes
[Additional observations]
```

---

**Ready to test?** Go to: http://localhost:8080/admin/auth-promotion