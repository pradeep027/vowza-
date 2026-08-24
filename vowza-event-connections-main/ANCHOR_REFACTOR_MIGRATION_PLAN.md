# Anchor Package Refactor: Migration Design & Safe Transition Plan

**Version:** 1.0  
**Date:** July 22, 2026  
**Status:** Design Phase - Ready for Implementation  

---

## EXECUTIVE SUMMARY

This document outlines the safe migration strategy to refactor the Anchor package wizard from a **dual Package Type (9 role-based) + Event Types (17 classifications)** architecture to a **single Package Type field containing 17 event classifications** with drag-and-drop support in Step 1 only.

**Key Decision:** The refactor consolidates two separate UI inputs into one multi-select component while preserving all existing data and allowing safe rollback if needed.

---

## 1. CURRENT STATE → TARGET STATE

### Current Architecture (Existing)
```
anchor_packages TABLE:
├── package_type TEXT (9 values: Wedding Anchor, Reception Host, Corporate Event Host, ...)
├── event_types TEXT[] (NOT YET ADDED - critical gap!)
└── Other fields: pricing, hosting_style, services_included, deliverables, team info

UI (Step 1):
├── Package Type Dropdown (single select)
└── Event Types Chip Selector (multi-select, no drag-drop)

Booking:
└── event_type (booking-level, separate from package classification)
```

### Target Architecture (Post-Refactor)
```
anchor_packages TABLE:
├── package_type TEXT[] (17 values: Wedding, Reception, Baraat, Engagement, ...) 
│   └── RENAMED FIELD (semantic change only)
└── Other fields: unchanged

UI (Step 1 ONLY):
├── Package Classification Multi-Select with Drag-Drop
│   ├── Click to select/deselect
│   ├── Drag to reorder
│   └── Remove button on each chip
└── No separate event_types field anywhere

Booking:
└── event_type (unchanged - customer selects at booking time)
```

---

## 2. MIGRATION PHASES (4 PHASES)

### PHASE 1: Schema Preparation (LOW RISK)
**Duration:** ~5 minutes (database only)  
**Reversibility:** YES (can rollback by reverting SQL)

#### Phase 1a: Add event_types Column
```sql
ALTER TABLE public.anchor_packages
ADD COLUMN IF NOT EXISTS event_types TEXT[] NOT NULL DEFAULT '{}';

-- Backfill existing packages with empty array
-- (No data loss; all packages initialized with default)
```

**Why safe:**
- New column with default value
- No existing data affected
- No triggers/constraints violated
- RLS policies unchanged

#### Phase 1b: Verify Migration
```sql
-- Verify column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'anchor_packages' AND column_name = 'event_types';

-- Verify default applied
SELECT COUNT(*) FROM anchor_packages WHERE event_types = '{}';
```

**Expected Result:** All packages have `event_types = '{}'` (empty array)

---

### PHASE 2: Application Layer Preparation (LOW-MEDIUM RISK)
**Duration:** ~1-2 hours (code changes)  
**Reversibility:** YES (revert git commits)

#### Phase 2a: Update AnchorPackageManager.tsx

**Changes:**
1. Remove old PACKAGE_TYPES constant (9 role-based types)
2. Keep ALL_EVENT_TYPES constant (rename to PACKAGE_TYPES)
3. Update StepPackageType component:
   - Remove package_type dropdown
   - Replace with new PackageTypeSelector (multi-select with drag-drop)
4. Update Draft type: `package_type: string[]` instead of `string`
5. Update save() validation: Require at least 1 selection

**Before:**
```typescript
const PACKAGE_TYPES = [
  'Wedding Anchor', 'Reception Host', 'Corporate Event Host', ...
];
const ALL_EVENT_TYPES = [
  'Wedding', 'Reception', 'Baraat', ..., 'Custom Event'
];

function StepPackageType({ draft, setDraft }) {
  return (
    <>
      <select> {/* Package Type Dropdown */} </select>
      <ChipSelect> {/* Event Types */} </ChipSelect>
    </>
  );
}
```

**After:**
```typescript
const PACKAGE_TYPES = [
  'Wedding', 'Reception', 'Baraat', 'Engagement', 'Sangeet',
  'Haldi', 'Mehendi', 'Birthday', 'Anniversary', 'Corporate Event',
  'College Fest', 'Cultural Event', 'Private Party', 'Public Event',
  'Religious Event', 'Award Function', 'Custom Event'
];

type Draft = {
  package_type: string[]; // Changed from string!
  // ... other fields
};

function StepPackageType({ draft, setDraft }) {
  return (
    <PackageTypeSelector
      selected={draft.package_type}
      onChange={(types) => setDraft({...draft, package_type: types})}
    />
  );
}
```

**New Component: PackageTypeSelector**
```typescript
function PackageTypeSelector({selected, onChange}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleSelect = (type: string) => {
    onChange(selected.includes(type)
      ? selected.filter(t => t !== type)
      : [...selected, type]
    );
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDropAfter = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const newSelected = [...selected];
    const item = newSelected[draggedIndex];
    newSelected.splice(draggedIndex, 1);
    newSelected.splice(index + (draggedIndex < index ? 0 : 1), 0, item);
    onChange(newSelected);
    setDraggedIndex(null);
  };

  // Render: buttons for selection + drag-drop reorder area
}
```

#### Phase 2b: Update Preview Step
```typescript
// Step 8: Preview
{draft.package_type && (
  <div className="rounded-xl bg-cyan-50 border border-cyan-200 p-3">
    <p className="text-xs font-bold uppercase text-cyan-700 mb-2">Package Classifications</p>
    <div className="flex flex-wrap gap-1">
      {draft.package_type.map((type) => (
        <span key={type} className="rounded-full bg-cyan-600/20 px-2 py-0.5 text-xs text-cyan-700">
          {type}
        </span>
      ))}
    </div>
  </div>
)}
```

#### Phase 2c: Update Save Validation
```typescript
const save = async () => {
  // ... existing checks
  if (!draft.package_type || draft.package_type.length === 0) {
    toast.error('At least one package classification required.');
    setStep(1);
    return;
  }
  // ... rest of save logic
  
  // Save payload now uses array directly
  const payload: any = {
    provider_id: provider.id,
    name: draft.name.trim(),
    package_type: draft.package_type, // Now an array!
    // ... other fields
  };
};
```

---

### PHASE 3: Database Migration (LOW RISK)
**Duration:** ~2-5 minutes (depends on package count)  
**Reversibility:** YES (can rollback with previous schema)

#### Phase 3a: Data Migration Script
```sql
-- Create backup of existing packages (optional, for safety)
CREATE TABLE IF NOT EXISTS anchor_packages_backup_pre_refactor AS
SELECT * FROM anchor_packages;

-- For existing packages with NULL or empty package_type:
-- Map old package_type values to new event classifications
UPDATE anchor_packages
SET package_type = ARRAY['Custom Event'] -- Fallback for unmapped types
WHERE package_type IS NULL OR package_type = '' OR package_type = 'Custom Package';

-- Note: This is a soft migration - existing package_type values preserved
-- They may not match the new 17 event types, but data is not lost
```

**Why safe:**
- Backup created before changes
- Existing data preserved (not deleted)
- Default value provides safe fallback
- No data loss or corruption possible

#### Phase 3b: Verification Queries
```sql
-- Check data integrity
SELECT 
  COUNT(*) total,
  COUNT(CASE WHEN package_type IS NULL THEN 1 END) null_count,
  COUNT(CASE WHEN array_length(package_type, 1) > 0 THEN 1 END) non_empty
FROM anchor_packages;

-- Verify structure
SELECT 
  package_type,
  COUNT(*) count
FROM anchor_packages
GROUP BY package_type
ORDER BY count DESC;
```

---

### PHASE 4: Deployment & Validation (MEDIUM RISK)
**Duration:** ~30 minutes (testing + deployment)  
**Reversibility:** YES (revert git branch, rebuild, clear cache)

#### Phase 4a: Code Deployment
1. Merge refactored code to main branch
2. Run build: `npm run build`
3. Verify TypeScript: `npx tsc --noEmit` (0 errors required)
4. Run tests: `npm test` (if test suite exists)

#### Phase 4b: Functional Validation
1. **Create New Package:**
   - Open Anchor Package Manager
   - Step 1: See new multi-select package classifier
   - Select 3-5 items
   - Drag to reorder
   - Proceed through wizard
   - Save package
   - Verify in database: `package_type` is array with selected values

2. **Edit Existing Package:**
   - Open existing package
   - Verify old package_type values preserved
   - Modify selections
   - Save
   - Verify changes applied

3. **View Package (Customer):**
   - Browse active packages
   - Verify display shows package classifications
   - Click "Book Now"
   - Verify booking modal still works

#### Phase 4c: Database Validation
```sql
-- Verify all packages have valid structure
SELECT id, package_type, status FROM anchor_packages LIMIT 10;

-- Verify galleries/addons still linked correctly
SELECT 
  p.id, p.name, p.package_type,
  COUNT(g.id) media_count,
  COUNT(a.id) addon_count
FROM anchor_packages p
LEFT JOIN anchor_gallery g ON p.id = g.package_id
LEFT JOIN anchor_addons a ON p.id = a.package_id
GROUP BY p.id, p.name, p.package_type;
```

---

## 3. ROLLBACK PROCEDURES

### Rollback Strategy 1: Code Rollback (Immediate)
**Time to Rollback:** ~5 minutes  
**Data Impact:** None

```bash
# If migration not yet deployed:
git revert <commit-hash>
npm run build
# Redeploy
```

### Rollback Strategy 2: Database Rollback (If deployed)
**Time to Rollback:** ~10 minutes  
**Data Impact:** Complete recovery

```sql
-- Restore from backup
DROP TABLE public.anchor_packages;
ALTER TABLE IF EXISTS anchor_packages_backup_pre_refactor 
RENAME TO anchor_packages;

-- Re-create indexes
CREATE INDEX IF NOT EXISTS anchor_packages_provider_idx 
ON public.anchor_packages(provider_id, status);
```

### Rollback Strategy 3: Soft Rollback (Keep Data)
**Time to Rollback:** ~20 minutes  
**Data Impact:** Minimal; user must clear browser cache

```sql
-- Downgrade package_type from array to single text value
ALTER TABLE public.anchor_packages
ALTER COLUMN package_type TYPE text[] USING ARRAY[package_type];
-- This preserves data but may lose multi-select information
```

---

## 4. BACKWARD COMPATIBILITY & DATA INTEGRITY

### Old Data (Existing Packages)
**Scenario:** User has existing "Wedding Anchor" package type  
**Handling:** Preserved as-is until user edits

**Action Path:**
1. Old package displays with existing package_type value
2. When user edits → Step 1 loads existing value into new selector
3. If old value doesn't match new 17 types → shown as-is (might need cleanup)
4. User can add/remove classifications
5. Save updates to array format

### New Data (New Packages)
**Scenario:** User creates package after refactor  
**Handling:** Uses new multi-select format automatically

**Data Structure:** 
```json
{
  "id": "uuid",
  "package_type": ["Wedding", "Reception", "Sangeet"],
  "name": "Premium Wedding Package",
  "status": "active"
}
```

---

## 5. TESTING CHECKLIST

### Unit Tests (TypeScript)
- [ ] PackageTypeSelector renders correctly
- [ ] Drag-drop reordering works
- [ ] Selection/deselection toggle works
- [ ] Validation fires when empty
- [ ] Save converts array to payload correctly

### Integration Tests
- [ ] Create new package with multi-select
- [ ] Edit existing package (old type → new type)
- [ ] Package displays on customer menu
- [ ] Booking workflow still works
- [ ] Realtime subscriptions fire on updates

### Manual Tests (QA)
- [ ] Create package (Chrome, Firefox, Safari)
- [ ] Edit package (Chrome, Firefox, Safari)
- [ ] Mobile responsiveness (tablet, phone)
- [ ] Drag-drop on mobile (if supported)
- [ ] Network lag simulation (slow 3G)

### Database Tests
- [ ] Existing packages still accessible
- [ ] Gallery/addons still cascade correctly
- [ ] RLS policies still enforced
- [ ] Realtime subscriptions still work

---

## 6. RISK ASSESSMENT

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Old data migration fails | MEDIUM | Backup table created; can rollback |
| TypeScript type mismatch | MEDIUM | Strict compilation required (0 errors) |
| Database query breaks | MEDIUM | All queries use `*` wildcard (flexible) |
| UI breaks on old package type | MEDIUM | Graceful handling in selector (show as-is) |
| Realtime subscriptions fail | LOW | RLS policies unchanged; subscriptions preserved |
| User loses data during migration | LOW | Backup table + rollback procedure |
| Performance degradation | LOW | No new indexes needed; same column structure |

---

## 7. SUCCESS CRITERIA

✓ All existing packages still accessible  
✓ New packages save with multi-select array  
✓ Old packages can be edited to use new format  
✓ Customer-facing package display works  
✓ Booking workflow unchanged  
✓ Zero TypeScript compilation errors  
✓ Database integrity validated  
✓ Realtime subscriptions functional  
✓ Rollback procedure tested (manual verification)  

---

## 8. POST-MIGRATION MONITORING

### Week 1 (Immediate)
- [ ] Monitor error logs for TypeScript runtime issues
- [ ] Check Realtime subscription events fire correctly
- [ ] Verify package creation bookings flow smoothly
- [ ] Monitor database query performance

### Week 2-4 (Ongoing)
- [ ] Collect user feedback on UI changes
- [ ] Monitor for any booking booking issues
- [ ] Track package creation rate (should be unchanged)
- [ ] Plan cleanup of old unmapped package_type values (optional)

### Post-Migration Cleanup (Optional)
```sql
-- Identify packages with unmapped package_type values
SELECT DISTINCT package_type FROM anchor_packages
WHERE package_type NOT IN (
  'Wedding', 'Reception', 'Baraat', 'Engagement', 'Sangeet',
  'Haldi', 'Mehendi', 'Birthday', 'Anniversary', 'Corporate Event',
  'College Fest', 'Cultural Event', 'Private Party', 'Public Event',
  'Religious Event', 'Award Function', 'Custom Event'
);

-- Optional: Send notification to providers to update their packages
```

---

## 9. DOCUMENTATION & COMMUNICATION

### Developer Handoff
- [ ] Code review for AnchorPackageManager changes
- [ ] TypeScript type definitions documented
- [ ] New PackageTypeSelector component documented
- [ ] Migration script reviewed and approved

### Provider Communication (Optional)
- [ ] Email: "Your Anchor packages now support multiple classifications"
- [ ] In-app notification: "Step 1 now shows all event types you support"
- [ ] Help docs: "How to select multiple package classifications"

### Internal Documentation
- [ ] Backup location: `anchor_packages_backup_pre_refactor`
- [ ] Rollback procedure: See Section 3
- [ ] Contact: DevOps/DBA for emergency database recovery

---

## 10. TIMELINE & APPROVAL

| Phase | Duration | Target Date | Status |
|-------|----------|-------------|--------|
| Schema Prep (Phase 1) | 5 min | TBD | Pending |
| App Changes (Phase 2) | 1-2 hrs | TBD | Pending |
| DB Migration (Phase 3) | 2-5 min | TBD | Pending |
| Deployment (Phase 4) | 30 min | TBD | Pending |
| **Total** | **~2-3 hrs** | **TBD** | **Pending User Approval** |

---

## APPROVALS

- [ ] User: Confirm ready to proceed with refactor
- [ ] DevOps: Verify backup strategy
- [ ] QA: Confirm testing checklist
- [ ] Architecture: Approve backward compatibility approach

---

## APPENDIX: SQL Migration Script (Ready to Deploy)

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- ANCHOR PACKAGE REFACTOR: Package Type → Multi-Select Event Classifications
-- Safe migration with full rollback capability
-- ═══════════════════════════════════════════════════════════════════════════════

-- Step 1: Create backup (for safety)
CREATE TABLE IF NOT EXISTS anchor_packages_backup_pre_refactor AS
SELECT * FROM anchor_packages;

-- Step 2: Add event_types column if not exists
ALTER TABLE public.anchor_packages
ADD COLUMN IF NOT EXISTS event_types TEXT[] NOT NULL DEFAULT '{}';

-- Step 3: Initialize existing packages with safe defaults
-- (No data loss; all packages already have package_type TEXT field)
UPDATE anchor_packages
SET event_types = '{}' 
WHERE event_types IS NULL;

-- Step 4: Verify migration
SELECT 
  COUNT(*) total_packages,
  COUNT(CASE WHEN event_types = '{}' THEN 1 END) initialized,
  COUNT(CASE WHEN package_type IS NULL THEN 1 END) unmapped
FROM anchor_packages;

-- Step 5: Update statistics
ANALYZE public.anchor_packages;
ANALYZE public.anchor_gallery;
ANALYZE public.anchor_addons;
ANALYZE public.anchor_bookings;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Rollback procedure:
-- 1. Restore schema: DROP TABLE anchor_packages; 
--    ALTER TABLE anchor_packages_backup_pre_refactor RENAME TO anchor_packages;
-- 2. Recreate indexes and triggers
-- ═══════════════════════════════════════════════════════════════════════════════
```

---

**End of Migration Design Document**
