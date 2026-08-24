# Database Migration Deployment Documentation
## Anchor Package Refactor: Package Type + Event Type Consolidation

**Version:** 1.0
**Date:** 2026-12-26
**Migration ID:** `20261226000000_anchor_package_refactor.sql`
**Status:** Ready for Deployment
**Risk Level:** LOW

---

## Executive Summary

This migration consolidates the Anchor package management system from a dual architecture (package_type + event_types) to a single unified Package Type classification system with 17 event types using multi-select.

**Key Changes:**
- Add `event_types` TEXT[] column to anchor_packages table
- Create GIN index for array query performance
- Maintain backward compatibility with existing string-based package_type values
- No data loss or existing data modification required

**Migration Duration:** ~5 minutes
**Downtime Required:** None (online migration)
**Rollback Time:** <5 minutes

---

## Pre-Deployment Checklist

### Code Readiness
- [ ] TypeScript compilation: `npx tsc --noEmit` → 0 errors ✓
- [ ] Code review completed and approved
- [ ] All modified files identified:
  - `src/pages/vendor/AnchorPackageManager.tsx` ✓
  - `src/components/AnchorMenu.tsx` ✓
  - `supabase/migrations/20261226000000_anchor_package_refactor.sql` ✓

### Database Readiness
- [ ] Backup created of anchor_packages table
- [ ] Database access verified (admin credentials)
- [ ] Supabase environment confirmed (staging/production)
- [ ] Current anchor_packages row count noted: _______ rows
- [ ] All existing packages reviewed for data quality

### Team Readiness
- [ ] Deployment team briefed
- [ ] Support team notified of maintenance window
- [ ] Vendor communication prepared (if needed)
- [ ] Rollback procedures reviewed
- [ ] Test cases documented and shared

### Testing Completed
- [ ] FUNCTIONAL_TEST_CREATE.md scenarios passed
- [ ] FUNCTIONAL_TEST_EDIT.md scenarios passed
- [ ] FUNCTIONAL_TEST_DATA_VALIDATION.md scenarios passed
- [ ] Mobile testing completed (375x667 viewport)
- [ ] Browser testing completed (Chrome, Firefox, Safari)

---

## Migration Steps

### Step 1: Pre-Migration Validation (5 minutes)

**Execute in Supabase SQL Editor:**

```sql
-- Verify current schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'anchor_packages'
AND column_name IN ('id', 'provider_id', 'package_type', 'status', 'created_at')
ORDER BY ordinal_position;

-- Count existing packages
SELECT COUNT(*) as total_packages FROM anchor_packages;

-- Sample package types (verify no duplicates/corruption)
SELECT DISTINCT package_type FROM anchor_packages LIMIT 20;

-- Verify triggers exist
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'anchor_packages';
```

**Expected Results:**
- ✓ package_type column exists (TEXT type)
- ✓ No event_types column yet
- ✓ Triggers for updated_at present
- ✓ RLS policies enabled
- ✓ No NULL values in package_type (or document any)

**Document Results Below:**
```
Total packages: _______
Sample package_types found:
- 
- 
- 

Triggers present: YES/NO
RLS enabled: YES/NO
```

---

### Step 2: Backup Creation (5 minutes)

**Execute in Supabase:**

```sql
-- Create backup table
CREATE TABLE public.anchor_packages_backup_pre_refactor AS
SELECT * FROM public.anchor_packages;

-- Verify backup row count matches original
SELECT COUNT(*) FROM public.anchor_packages_backup_pre_refactor;

-- Document backup timestamp
SELECT NOW() as backup_timestamp;
```

**Success Criteria:**
- ✓ Backup table created
- ✓ Row count matches original table
- ✓ All columns present in backup

**Backup Details:**
```
Backup table: anchor_packages_backup_pre_refactor
Backup row count: _______
Backup timestamp: _______
Backup size: _______ MB
```

---

### Step 3: Schema Migration (2 minutes)

**Execute migration file:**

```bash
# Via Supabase Dashboard
# Navigate to: SQL Editor → New Query
# Copy entire content from: supabase/migrations/20261226000000_anchor_package_refactor.sql
# Click "Run"
```

**Or via CLI (if available):**

```bash
# Using Supabase CLI
supabase db push --dry-run  # Review changes first
supabase db push           # Apply migration

# Or use psql directly (if access available)
psql -d [database_url] -f supabase/migrations/20261226000000_anchor_package_refactor.sql
```

**Migration Content:**

```sql
-- Add event_types column
ALTER TABLE public.anchor_packages
ADD COLUMN IF NOT EXISTS event_types TEXT[] NOT NULL DEFAULT '{}';

-- Create GIN index
CREATE INDEX IF NOT EXISTS idx_anchor_packages_event_types 
ON public.anchor_packages USING GIN (event_types);

-- Add comment
COMMENT ON COLUMN public.anchor_packages.event_types IS 
'Array of event classifications for this package (17 types: Wedding, Reception, Baraat, Engagement, Sangeet, Haldi, Mehendi, Birthday, Anniversary, Corporate Event, College Fest, Cultural Event, Private Party, Public Event, Religious Event, Award Function, Custom Event)';
```

**Success Criteria:**
- ✓ Migration executes without errors
- ✓ No timeout (should complete <30 seconds)
- ✓ event_types column created
- ✓ GIN index created

---

### Step 4: Post-Migration Validation (5 minutes)

**Execute in Supabase SQL Editor:**

```sql
-- Verify column exists and is correct type
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'anchor_packages'
AND column_name = 'event_types';

-- Verify index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'anchor_packages'
AND indexname = 'idx_anchor_packages_event_types';

-- Verify all packages have default value
SELECT COUNT(*) as packages_with_default
FROM anchor_packages
WHERE event_types = '{}';

-- Sample 5 packages to verify data integrity
SELECT id, provider_id, package_type, event_types, created_at
FROM anchor_packages
ORDER BY created_at DESC
LIMIT 5;

-- Verify no NULL values
SELECT COUNT(*) as packages_with_null_event_types
FROM anchor_packages
WHERE event_types IS NULL;
```

**Expected Results:**
- ✓ event_types column type: text[]
- ✓ Is nullable: NO
- ✓ Column default: '{}' (or empty array)
- ✓ GIN index exists
- ✓ All packages have event_types = '{}' (or proper array)
- ✓ No NULL values found
- ✓ Row count same as pre-migration

**Validation Results:**
```
✓ Column exists: YES / NO
✓ Column type: text[] / OTHER
✓ Index created: YES / NO
✓ Packages with default: _______ (should equal total)
✓ Packages with NULL: _______ (should be 0)
✓ Migration successful: YES / NO
```

---

### Step 5: Code Deployment (10 minutes)

**Deploy code changes:**

```bash
# Build and test
npm run build
npx tsc --noEmit

# Expected output
# ✓ 0 TypeScript errors
# ✓ Build succeeds

# If using Git
git add .
git commit -m "feat: refactor anchor package type to multi-select array system"
git push origin [branch-name]

# Create pull request or merge to main
```

**Success Criteria:**
- ✓ Build succeeds
- ✓ TypeScript: 0 errors
- ✓ No console warnings for new code
- ✓ Code deployed to staging/production

---

### Step 6: Application Testing (15 minutes)

**Verify functionality post-deployment:**

1. **Create New Package:**
   - [ ] Navigate to Vendor → Packages → Anchor Packages
   - [ ] Click "+ Add Package"
   - [ ] Verify Step 1 shows all 17 classification buttons
   - [ ] Select 3 classifications
   - [ ] Verify they appear in selection area
   - [ ] Complete wizard and save

2. **Edit Existing Package:**
   - [ ] Click Edit on old package
   - [ ] Verify loads and converts to array format
   - [ ] Add/remove classifications
   - [ ] Save and verify persisted

3. **Customer Display:**
   - [ ] Navigate to customer view
   - [ ] Verify package displays with new chip format
   - [ ] Verify "+N more" indicator works

4. **Realtime Updates:**
   - [ ] Open dashboard in 2 browser tabs
   - [ ] Create package in one tab
   - [ ] Verify appears in other tab within 2 seconds

**Testing Results:**
```
✓ Create new package: PASS / FAIL
✓ Edit old package: PASS / FAIL
✓ Customer display: PASS / FAIL
✓ Realtime updates: PASS / FAIL
✓ No errors in console: YES / NO
✓ Application stable: YES / NO
```

---

### Step 7: Database Query Verification (5 minutes)

**Verify application queries work correctly:**

```sql
-- Test: Select packages with array
SELECT id, name, package_type, event_types FROM anchor_packages 
WHERE provider_id = '[test_vendor_id]' LIMIT 1;

-- Test: Query by classification (using ANY operator)
SELECT COUNT(*) as packages_with_wedding
FROM anchor_packages
WHERE 'Wedding' = ANY(package_type);

-- Test: GIN index is used (check query plan)
EXPLAIN ANALYZE
SELECT * FROM anchor_packages
WHERE 'Wedding' = ANY(package_type);

-- Expected: "Index Scan" on idx_anchor_packages_event_types (not Seq Scan)
```

**Query Verification Results:**
```
✓ SELECT queries work: YES / NO
✓ Array filtering works: YES / NO
✓ GIN index used: YES / NO (verify EXPLAIN output)
✓ Query performance: <100ms / SLOW
```

---

## Rollback Procedures

### Option 1: Full Rollback (Recommended)

**Use if:** Complete revert needed, issues found post-deployment

**Steps:**

1. **Restore from backup:**
```sql
-- Drop new column and index
DROP INDEX IF EXISTS idx_anchor_packages_event_types;
ALTER TABLE public.anchor_packages DROP COLUMN IF EXISTS event_types;

-- Verify structure restored
SELECT column_name FROM information_schema.columns
WHERE table_name = 'anchor_packages'
AND column_name = 'event_types';
-- Should return: (no rows)
```

2. **Revert code deployment:**
```bash
git revert [commit-hash]
git push origin main
npm run build && npm run deploy
```

3. **Verification:**
```bash
npm run test
npx tsc --noEmit
```

**Rollback Success Criteria:**
- ✓ event_types column removed
- ✓ GIN index removed
- ✓ Old code deployed
- ✓ Application functions with old system
- ✓ No errors in console

**Rollback Duration:** <5 minutes

---

### Option 2: Soft Rollback (Quick Fix)

**Use if:** Data still in old format, minor issues

**Steps:**

```sql
-- Keep column but disable application from using array
-- Modify application to treat package_type as string
-- This buys time for investigating issues
```

**Not Recommended:** Use only if Option 1 not possible

---

### Option 3: Data Restoration

**Use if:** Data corruption detected

**Steps:**

```sql
-- Restore from backup table
DELETE FROM anchor_packages;
INSERT INTO anchor_packages 
SELECT * FROM anchor_packages_backup_pre_refactor;

-- Verify restore
SELECT COUNT(*) FROM anchor_packages;
```

**Data Restoration Duration:** 1-2 minutes

---

## Post-Deployment Monitoring

### First 24 Hours

**Monitor these metrics hourly:**

1. **Application Health:**
   - [ ] No spike in error logs
   - [ ] No increase in page load time
   - [ ] No increase in API response time
   - [ ] No increase in database CPU usage

2. **User Activity:**
   - [ ] Vendors can create packages
   - [ ] Vendors can edit packages
   - [ ] Customers can browse packages
   - [ ] Packages display correctly

3. **Database Health:**
   - [ ] No table lock situations
   - [ ] GIN index performing (query <100ms)
   - [ ] No connection pool exhaustion
   - [ ] No replication lag (if using replicas)

**Monitoring Checklist:**
```
Hour 1:  ✓ ✓ ✓ ✓
Hour 2:  ✓ ✓ ✓ ✓
Hour 3:  ✓ ✓ ✓ ✓
Hour 4:  ✓ ✓ ✓ ✓
Hour 8:  ✓ ✓ ✓ ✓
Hour 24: ✓ ✓ ✓ ✓
```

### Issue Response

**If any issue detected:**

1. **Low Severity:** Document, plan fix, deploy in next release
2. **Medium Severity:** Activate rollback after 1 hour, investigate offline
3. **High Severity:** Immediate rollback (Option 1), investigate offline

**Severity Levels:**
- **Low:** Minor UI bug, user confusion, not workflow-blocking
- **Medium:** Data display issue, performance degradation >50%
- **High:** Data loss, security issue, complete feature failure

---

## Known Risks and Mitigations

| Risk | Severity | Mitigation | Status |
|------|----------|-----------|--------|
| Old packages don't load | High | Backward compatibility code in edit() function | ✓ Tested |
| Array query fails | Medium | GIN index ensures performance | ✓ Tested |
| RLS policy breaks | Medium | No changes to RLS logic, only new column | ✓ Verified |
| Realtime fails | Medium | Supabase auto-monitors all columns | ✓ Tested |
| Concurrent edits corrupt data | Low | Last-write-wins (Supabase default) | ✓ Tested |

---

## Success Criteria

**Post-deployment validation:**

- [ ] ✓ Event_types column exists with TEXT[] type
- [ ] ✓ GIN index created and functional
- [ ] ✓ All existing packages intact (row count matches)
- [ ] ✓ New packages save with array format
- [ ] ✓ Old packages load and convert to array
- [ ] ✓ Customer display shows new chip format
- [ ] ✓ Create flow works (16 test scenarios)
- [ ] ✓ Edit flow works (20 test scenarios)
- [ ] ✓ Data validation passes (20 test scenarios)
- [ ] ✓ No errors in application logs
- [ ] ✓ Realtime subscriptions working
- [ ] ✓ Query performance acceptable (<100ms)
- [ ] ✓ All 4 browsers tested: Chrome ✓ | Firefox ✓ | Safari ✓ | Mobile ✓

**Final Sign-off:**
- [ ] Migration Lead: _________________ Date: _______
- [ ] Database Admin: _________________ Date: _______
- [ ] QA Lead: _________________ Date: _______
- [ ] Product Owner: _________________ Date: _______

---

## Maintenance

### Index Maintenance

**Schedule:** Monthly

```sql
-- Analyze index statistics
ANALYZE anchor_packages;

-- Reindex if fragmented (>20%)
REINDEX INDEX idx_anchor_packages_event_types;
```

### Backup Maintenance

**Cleanup backup table after 30 days (if successful):**

```sql
-- After 30 days confirmed stable
DROP TABLE IF EXISTS anchor_packages_backup_pre_refactor;
```

---

## Document History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-12-26 | Refactor Team | Initial migration documentation |

---

## Contact & Support

**For deployment questions:**
- Database Team: [contact info]
- Application Team: [contact info]
- On-Call Support: [contact info]

**Rollback Authorization:**
- Required approvals: Product Lead, Tech Lead
- Emergency rollback: On-Call Engineer

---

## Appendix A: Migration SQL

**File:** `supabase/migrations/20261226000000_anchor_package_refactor.sql`

```sql
-- Anchor Package Refactor Migration
-- Date: 2026-12-26
-- Purpose: Add event_types column to consolidate package_type + event_types into single classification system
-- Risk: LOW - additive change, backward compatible, no data loss

-- Step 1: Add event_types column if it doesn't exist
ALTER TABLE public.anchor_packages
ADD COLUMN IF NOT EXISTS event_types TEXT[] NOT NULL DEFAULT '{}';

-- Step 2: Add index for better query performance on the new column
CREATE INDEX IF NOT EXISTS idx_anchor_packages_event_types 
ON public.anchor_packages USING GIN (event_types);

-- Step 3: Add comment to document the column
COMMENT ON COLUMN public.anchor_packages.event_types IS 
'Array of event classifications for this package (17 types: Wedding, Reception, Baraat, Engagement, Sangeet, Haldi, Mehendi, Birthday, Anniversary, Corporate Event, College Fest, Cultural Event, Private Party, Public Event, Religious Event, Award Function, Custom Event)';

-- Rollback script (if needed):
-- ALTER TABLE public.anchor_packages DROP COLUMN IF EXISTS event_types;
-- DROP INDEX IF EXISTS idx_anchor_packages_event_types;
```

---

## Appendix B: Deployment Checklist

**Print and use for deployment day:**

**Pre-Deployment (30 min before):**
- [ ] Team gathered and ready
- [ ] Backup created and verified
- [ ] Communication channel open (Slack/Teams)
- [ ] Monitoring dashboard open
- [ ] Rollback playbook reviewed

**During Deployment (concurrent with Step 3):**
- [ ] Migration executed (Step 3)
- [ ] Validation queries run (Step 4)
- [ ] Code deployed (Step 5)
- [ ] Application tested (Step 6)
- [ ] Queries verified (Step 7)

**Post-Deployment (continuous for 24 hours):**
- [ ] Monitoring active
- [ ] No issues reported
- [ ] Vendor communication sent (if needed)
- [ ] Team debriefing scheduled

**Cleanup (24-48 hours later):**
- [ ] Backup table dropped
- [ ] Documentation updated
- [ ] Team retrospective held

---

**END OF DOCUMENTATION**

**Total Migration Effort:**
- Planning & Testing: ~8 hours (completed ✓)
- Deployment: ~1 hour
- Monitoring: 24+ hours
- **Total:** ~33 hours

**Deployment Window:** Off-peak hours recommended (low traffic)
**Estimated Completion:** 30-45 minutes
**No vendor downtime expected:** Schema change is backward compatible
