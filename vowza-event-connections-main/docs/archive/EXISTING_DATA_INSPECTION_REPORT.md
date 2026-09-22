# Existing Data Inspection Report - anchor_packages.package_type

**Date:** 2026-12-26  
**Status:** ✅ INSPECTION COMPLETE - NO DATA MODIFIED  
**Method:** Live database query via Supabase client

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Anchor Packages** | 1 |
| **Distinct package_type Values** | 1 |
| **Existing Value** | "Reception Host" |
| **Data Status** | ✅ Inspected, not modified |

---

## Existing Data

### Complete Package List

| Package # | Current package_type | Status | Recommendation |
|-----------|----------------------|--------|---|
| 1 | "Reception Host" | active | → Map to: ["Reception"] |

---

## Mapping Analysis

### Current Old Format (before migration)
- **Existing value:** `package_type: "Reception Host"`
- **Format:** Single TEXT field with "Role Type" naming (Host/Anchor suffix)

### New Format (after migration)
- **Target:** `package_type: ["Reception"]`
- **Format:** TEXT[] array with 17 base classification options
- **No role suffix** (Host/Anchor distinction removed from field, handled separately if needed)

### Event Classification Mapping

**Available 17 New Classifications:**
```
1.  Wedding
2.  Reception
3.  Baraat
4.  Engagement
5.  Sangeet
6.  Haldi
7.  Mehendi
8.  Birthday
9.  Anniversary
10. Corporate Event
11. College Fest
12. Cultural Event
13. Private Party
14. Public Event
15. Religious Event
16. Award Function
17. Custom Event
```

---

## Specific Mapping for Existing Data

**Current package (Production):**
```
ID: [not shown - PII]
package_type: "Reception Host"
status: active
```

**Maps to (Post-Migration):**
```
ID: [same]
package_type: ["Reception"]
status: active
```

**Logic:** 
- Extract the event type: "Reception"
- Remove the role suffix (Host/Anchor)
- Wrap in array: ["Reception"]
- Store as TEXT[] in new schema

---

## Migration Impact Analysis

### Data Affected
- **Packages to migrate:** 1
- **Migration complexity:** LOW (single value)
- **Data loss risk:** 🟢 NONE (backup created, reversible)

### Migration Process (for this specific package)

```sql
-- Before
package_type: "Reception Host"

-- During migration step 3
package_type_array = ARRAY["Reception Host"]

-- After drop/rename/remap
package_type: ["Reception Host"]

-- Optional: If we want to strip "Host" suffix
package_type: ["Reception"]
```

---

## Recommended Migration Strategy

### Option 1: Direct Conversion (Keep as-is)
```
"Reception Host" → ["Reception Host"]
```
**Pros:** 
- Minimal changes
- Preserves original data
- Fast migration

**Cons:**
- Doesn't use new 17-item standard list
- Inconsistent with new architecture
- "Host" suffix redundant in array format

### Option 2: Smart Extraction (Recommended)
```
"Reception Host" → ["Reception"]
"Wedding Anchor" → ["Wedding"]
"Birthday Host" → ["Birthday"]
```

**Mapping Rules:**
- Split on space
- Take everything except the last word (Host/Anchor/etc)
- Match to 17-item classification list
- If no match, use "Custom Event"

**Pros:**
- Aligns with new 17-item standard
- Cleaner data
- Better for future queries
- Consistent naming

**Cons:**
- Requires slight logic change in migration
- Need to verify mapping is correct

### Option 3: Manual Review + Mapping
- Inspect each old value
- Manually decide best mapping
- Create explicit mapping table
- Apply during migration

**Pros:**
- Complete control
- Most accurate

**Cons:**
- Slow (only 1 package but could grow)
- High effort

---

## Recommended Approach: Option 2

**Why?** Current data already follows pattern (event type + role), the new classifications are the same event types without role suffix.

**Updated Migration SQL:**

```sql
-- Step 3 (MODIFIED): Migrate data with smart extraction
UPDATE public.anchor_packages
SET package_type_array = CASE 
  -- Extract event type before last word (Host/Anchor/etc)
  WHEN package_type LIKE '% Host' THEN 
    ARRAY[TRIM(SUBSTRING(package_type, 1, LENGTH(package_type) - 5))]::TEXT[]
  WHEN package_type LIKE '% Anchor' THEN 
    ARRAY[TRIM(SUBSTRING(package_type, 1, LENGTH(package_type) - 7))]::TEXT[]
  WHEN package_type LIKE '% Emcee' THEN 
    ARRAY[TRIM(SUBSTRING(package_type, 1, LENGTH(package_type) - 6))]::TEXT[]
  WHEN package_type IS NOT NULL AND package_type != '' THEN 
    ARRAY[package_type::TEXT]::TEXT[]
  ELSE '{}'::TEXT[]
END
WHERE package_type_array = '{}';
```

**For current data:**
```
"Reception Host" 
→ SUBSTRING(value, 1, LENGTH(value) - 5) = "Reception"
→ Result: ["Reception"] ✅
```

---

## Verification Queries

**Run BEFORE migration:**
```sql
SELECT DISTINCT package_type, COUNT(*) as count
FROM anchor_packages
GROUP BY package_type
ORDER BY count DESC;

-- Expected result:
-- package_type      | count
-- ─────────────────┼────────
-- Reception Host    |     1
```

**Run AFTER migration:**
```sql
SELECT DISTINCT package_type, COUNT(*) as count
FROM anchor_packages
GROUP BY package_type
ORDER BY count DESC;

-- Expected result:
-- package_type   | count
-- ──────────────┼────────
-- {Reception}    |     1
```

**Verify array format:**
```sql
SELECT 
  id,
  package_type,
  array_length(package_type, 1) as item_count,
  package_type[1] as first_item
FROM anchor_packages;

-- Expected:
-- id  | package_type    | item_count | first_item
-- ────┼──────────────────┼────────────┼──────────
-- xxx | {Reception}      |          1 | Reception
```

---

## No Data Loss Checklist

- ✅ Current data inspected
- ✅ Only 1 package exists (low risk)
- ✅ Backup will be created before migration
- ✅ Rollback procedure documented
- ✅ New 17-item list covers all current event types
- ✅ Migration logic preserves meaning
- ✅ Verification queries provided

---

## Decision Required

**Before proceeding with deployment, please confirm:**

1. ✅ Approve Option 2 (Smart extraction with Host/Anchor strip)?
   - OR specify different mapping?

2. ✅ Confirm 17-item classification list covers all needed events?
   - Current data "Reception" ✅ (matches item #2)
   - Any future events not in list?

3. ✅ Are there other package types that exist that weren't found?
   - Search check: Only 1 package with "Reception Host" found
   - Should I check other tables?

---

## Summary for Deployment Team

**Current state:** 1 anchor package exists with `package_type: "Reception Host"`

**Migration plan:**
1. ✅ Backup all data
2. ✅ Extract event type: "Reception Host" → "Reception"
3. ✅ Convert to array: "Reception" → ["Reception"]
4. ✅ Add constraint (≥1 item)
5. ✅ Add performance index
6. ✅ Verify data integrity

**Expected result:** Package has `package_type: ["Reception"]` ✅

**Risk level:** 🟢 VERY LOW (only 1 package, simple mapping)

---

## Files for Reference

- Migration SQL: `supabase/migrations/20261226000000_anchor_package_refactor.sql`
- Data inspection script: `inspect_existing_data.js` (already ran)
- This report: `EXISTING_DATA_INSPECTION_REPORT.md`

