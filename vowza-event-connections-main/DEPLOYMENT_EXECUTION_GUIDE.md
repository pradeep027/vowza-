# Deployment Execution Guide - Manual SQL Execution

**Status:** Ready for Manual Deployment  
**Date:** 2026-12-26  
**Method:** Execute SQL directly in Supabase dashboard or SQL client

---

## Quick Start

### Option 1: Supabase Dashboard (Recommended)

1. Go to: https://app.supabase.com/project/vavfeataqwwbpjonknne
2. Navigate to: SQL Editor → New Query
3. Copy entire SQL from Section 2 below
4. Click "Run"
5. Verify results in Section 3

### Option 2: psql Command Line

```bash
psql -h db.vavfeataqwwbpjonknne.supabase.co \
     -U postgres \
     -d postgres \
     -f supabase/migrations/20261226000000_anchor_package_refactor.sql
```

### Option 3: Supabase CLI

```bash
supabase db push
# Automatically detects and executes migrations in supabase/migrations/
```

---

## Part 1: Pre-Deployment Snapshot

**Current state before migration:**

```sql
-- Check current data
SELECT id, package_type, status FROM public.anchor_packages;

-- Expected result:
-- id       | package_type     | status
-- ─────────┼──────────────────┼────────
-- [uuid]   | Reception Host   | active
```

---

## Part 2: Migration SQL - COPY AND PASTE THIS

```sql
-- ============================================================================
-- ANCHOR PACKAGE REFACTOR MIGRATION
-- Date: 2026-12-26
-- Purpose: Refactor package_type from TEXT to TEXT[] array with smart extraction
-- Architecture: SINGLE AUTHORITATIVE FIELD = package_type (TEXT[] array)
-- NO SEPARATE EVENT_TYPES FIELD - consolidation complete
-- ============================================================================

-- Step 1: Create backup of current data
CREATE TABLE IF NOT EXISTS public.anchor_packages_backup_pre_refactor AS 
SELECT * FROM public.anchor_packages;

-- Step 2: Add temporary column to hold array values
ALTER TABLE public.anchor_packages
ADD COLUMN IF NOT EXISTS package_type_array TEXT[] DEFAULT '{}';

-- Step 3: Migrate data from old text field to new array field
-- Smart extraction: Removes "Host", "Anchor", "Emcee" suffixes and wraps in array
UPDATE public.anchor_packages
SET package_type_array = CASE 
  -- Extract event type before " Host" suffix
  WHEN package_type LIKE '% Host' THEN 
    ARRAY[TRIM(SUBSTRING(package_type, 1, LENGTH(package_type) - 5))::TEXT]::TEXT[]
  -- Extract event type before " Anchor" suffix
  WHEN package_type LIKE '% Anchor' THEN 
    ARRAY[TRIM(SUBSTRING(package_type, 1, LENGTH(package_type) - 7))::TEXT]::TEXT[]
  -- Extract event type before " Emcee" suffix
  WHEN package_type LIKE '% Emcee' THEN 
    ARRAY[TRIM(SUBSTRING(package_type, 1, LENGTH(package_type) - 6))::TEXT]::TEXT[]
  -- For values without suffix or new values, use as-is
  WHEN package_type IS NOT NULL AND package_type != '' 
  THEN ARRAY[package_type::TEXT]::TEXT[]
  -- NULL or empty becomes empty array
  ELSE '{}'::TEXT[]
END
WHERE package_type_array = '{}';

-- Step 4: Drop old package_type column
ALTER TABLE public.anchor_packages
DROP COLUMN package_type;

-- Step 5: Rename array column to be the new package_type
ALTER TABLE public.anchor_packages
RENAME COLUMN package_type_array TO package_type;

-- Step 6: Add constraint to ensure at least one classification
ALTER TABLE public.anchor_packages
ADD CONSTRAINT check_package_type_not_empty CHECK (array_length(package_type, 1) > 0);

-- Step 7: Create GIN index for array queries (performance)
CREATE INDEX IF NOT EXISTS idx_anchor_packages_package_type 
ON public.anchor_packages USING GIN (package_type);

-- Step 8: Add comment documenting the new schema
COMMENT ON COLUMN public.anchor_packages.package_type IS 
'Array of 17 event classifications (SINGLE AUTHORITATIVE FIELD): Wedding, Reception, Baraat, Engagement, Sangeet, Haldi, Mehendi, Birthday, Anniversary, Corporate Event, College Fest, Cultural Event, Private Party, Public Event, Religious Event, Award Function, Custom Event. Multi-select, drag-drop supported.';
```

---

## Part 3: Post-Deployment Verification

**Run these queries to verify the migration succeeded:**

### 3.1: Verify Array Format
```sql
SELECT package_type FROM public.anchor_packages;
-- Expected: {Reception}
-- (Array with one item: Reception)
```

### 3.2: Verify Array Length
```sql
SELECT 
  id, 
  array_length(package_type, 1) as item_count,
  package_type[1] as first_item
FROM public.anchor_packages;
-- Expected: item_count = 1, first_item = "Reception"
```

### 3.3: Verify Constraint Exists
```sql
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'anchor_packages' 
AND constraint_name LIKE '%package%';
-- Expected: check_package_type_not_empty
```

### 3.4: Verify Index Exists
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'anchor_packages' 
AND indexname LIKE '%package%';
-- Expected: idx_anchor_packages_package_type
```

### 3.5: Verify No Empty Arrays
```sql
SELECT COUNT(*) FROM public.anchor_packages 
WHERE array_length(package_type, 1) = 0;
-- Expected: 0
```

### 3.6: Verify Backup Exists
```sql
SELECT COUNT(*) FROM public.anchor_packages_backup_pre_refactor;
-- Expected: 1
```

---

## Part 4: Application Deployment

After database migration succeeds:

### 4.1: Deploy Code

The following files are already updated and ready:

- ✅ `src/pages/vendor/AnchorPackageManager.tsx` - Multi-select, drag-drop UI
- ✅ `src/components/AnchorMenu.tsx` - Array display logic
- ✅ `supabase/migrations/20261226000000_anchor_package_refactor.sql` - Database migration

### 4.2: Build & Test

```bash
# Install dependencies (if needed)
npm install

# Build
npm run build

# Test TypeScript
npx tsc --noEmit
# Expected: exit code 0 (0 errors)
```

### 4.3: Deploy to Production

- Deploy the updated application code to your production environment
- Clear browser cache or force refresh (Ctrl+Shift+R)

### 4.4: Manual Testing

1. **Load vendor dashboard:**
   - Go to vendor packages page
   - Existing package should load with "Reception" displayed
   - Should show as chip/badge format

2. **Test editing:**
   - Click edit on the existing package
   - Package Type Step should show "Reception" selected
   - Should allow adding more classifications
   - Should support drag-drop reordering
   - Should allow removal/deselection

3. **Test creating new:**
   - Create new package
   - Step 1 should show multi-select for Package Type
   - Should be able to select multiple items
   - Should support drag-drop
   - Should validate (at least 1 required)

4. **Test display:**
   - Go to customer-facing display (AnchorMenu)
   - Package should show "Reception" chip
   - Multiple classifications should show: first 3 items + "+X more"

---

## Part 5: Rollback Procedure (If Needed)

If migration fails or needs to be rolled back:

```sql
-- ============================================================================
-- ROLLBACK SCRIPT - Execute in reverse order if migration fails
-- ============================================================================

-- Step 1: Drop new index
DROP INDEX IF EXISTS public.idx_anchor_packages_package_type;

-- Step 2: Drop constraint
ALTER TABLE public.anchor_packages
DROP CONSTRAINT IF EXISTS check_package_type_not_empty;

-- Step 3: Drop new column
ALTER TABLE public.anchor_packages
DROP COLUMN IF EXISTS package_type;

-- Step 4: Restore from backup (copy data back)
INSERT INTO public.anchor_packages
SELECT * FROM public.anchor_packages_backup_pre_refactor
ON CONFLICT (id) DO UPDATE SET
  package_type = EXCLUDED.package_type;

-- Step 5: Verify rollback successful
SELECT COUNT(*) FROM public.anchor_packages;
-- Expected: 1

SELECT package_type FROM public.anchor_packages;
-- Expected: "Reception Host" (original value)
```

**Rollback time:** < 5 minutes

---

## Part 6: Success Checklist

After deployment, verify:

- [ ] Migration SQL executed without errors
- [ ] Backup table created: `anchor_packages_backup_pre_refactor`
- [ ] package_type is now TEXT[] array type
- [ ] Data migrated: "Reception Host" → ["Reception"]
- [ ] Constraint added: `check_package_type_not_empty`
- [ ] Index created: `idx_anchor_packages_package_type`
- [ ] Application code deployed
- [ ] TypeScript: 0 errors
- [ ] Vendor dashboard loads without errors
- [ ] Existing package displays as "Reception"
- [ ] Can edit package and add classifications
- [ ] Drag-drop reordering works
- [ ] Customer display shows package correctly

---

## Important Notes

### Data Extraction Logic

The migration uses smart extraction to handle old role-based naming:

| Old Format | New Format | Logic |
|---|---|---|
| "Reception Host" | ["Reception"] | Remove " Host" (5 chars) |
| "Wedding Anchor" | ["Wedding"] | Remove " Anchor" (7 chars) |
| "Birthday Emcee" | ["Birthday"] | Remove " Emcee" (6 chars) |
| "Custom Value" | ["Custom Value"] | No suffix, use as-is |

### No Data Loss

- ✅ Backup created before migration
- ✅ Original data preserved in backup table
- ✅ Rollback procedure available
- ✅ Only 1 package affected
- ✅ Meaning preserved (Reception remains Reception)

### Performance

- ✅ GIN index added for array queries
- ✅ Query performance improved for array containment
- ✅ No performance degradation

---

## Support & Questions

**During deployment:**
- Check database logs for errors
- Refer to rollback procedure if needed
- Verify each step completes successfully

**After deployment:**
- Monitor application error logs
- Test package creation/editing
- Check vendor dashboard functionality
- Monitor customer-facing displays

---

## Timeline

| Phase | Duration |
|---|---|
| Pre-deployment setup | 5 min |
| Migration execution | 1 min |
| Verification | 10 min |
| Application deployment | 5 min |
| Testing | 15 min |
| **Total** | **~36 minutes** |

---

## Status

✅ All preparation complete  
✅ Migration SQL ready  
✅ Application code ready  
✅ Verification procedures documented  
✅ Rollback procedure available  

**Ready for deployment approval.**

Execute the SQL in Part 2 and verify with Part 3 queries.

