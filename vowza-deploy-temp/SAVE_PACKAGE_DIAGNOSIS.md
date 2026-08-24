# Save Package Failure - Root Cause Diagnosis

## STATUS: ROOT CAUSE IDENTIFIED

The **Save Package** button fails with: "Database schema mismatch"

---

## ROOT CAUSE

**The application is trying to INSERT columns that don't exist in the remote Supabase database.**

### Columns Missing from Remote Schema

The application's save() function attempts to insert these columns:

1. **advance_percentage** (NUMERIC)
2. **event_type** (TEXT)

These columns were defined in the initial migration **20260822_photography_videography_unified.sql** but are **NOT present** in that table schema.

They are defined in the later migration **20261001000000_photography_videography_fixes.sql** using:
```sql
ALTER TABLE public.photography_videography_packages
ADD COLUMN IF NOT EXISTS advance_percentage NUMERIC(3,1) DEFAULT 20 CHECK (advance_percentage >= 0 AND advance_percentage <= 100);

ALTER TABLE public.photography_videography_packages
ADD COLUMN IF NOT EXISTS event_type TEXT;
```

---

## FAILED STAGE

**PACKAGE_INSERT** (when creating a new package)

The error occurs during the first database write:
```typescript
const r = await supabase
  .from('photography_videography_packages')
  .insert(payload)  // ❌ FAILS HERE
  .select('id')
  .single();
```

Error Code: **42703** (PostgreSQL: "column does not exist")

---

## EXACT ERROR MESSAGE

Supabase returns (captured in browser console):

```
Syntax error or access violation (42703)
column "advance_percentage" of relation "photography_videography_packages" does not exist
```

---

## PAYLOAD BEING SENT

The application constructs this payload:

```typescript
{
  provider_id: "UUID",
  name: "Test Package",
  description: "...",
  package_type: "photography_and_videography",
  event_type: "Wedding",           // ❌ Column doesn't exist
  status: "draft",
  price: 70000,
  advance_percentage: 20,           // ❌ Column doesn't exist
  travel_extra_charge: null,
  duration: "Full Day",
  photography_team_size: 1,
  photography_edited_photos: 500,
  // ... more fields ...
  videography_team_videographers: 1,
  // ... more fields ...
}
```

Both `advance_percentage` and `event_type` are included in the payload.

The remote database table `photography_videography_packages` does **NOT have these columns**.

---

## DATABASE SCHEMA COMPARISON

### What EXISTS in Remote (from 20260822_photography_videography_unified.sql)

```sql
CREATE TABLE IF NOT EXISTS public.photography_videography_packages (
  id UUID PRIMARY KEY,
  provider_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  package_type TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  duration TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_visible BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'active',
  view_count INTEGER DEFAULT 0,
  
  photography_team_size INTEGER,
  photography_edited_photos INTEGER,
  photography_unlimited_edited BOOLEAN,
  photography_raw_photos_included BOOLEAN,
  photography_album_included BOOLEAN,
  photography_pre_event_shoot BOOLEAN,
  photography_deliverables TEXT[],
  photography_delivery_time TEXT,
  
  videography_team_videographers INTEGER,
  videography_team_assistants INTEGER,
  videography_coverage_hours TEXT,
  videography_deliverables TEXT[],
  videography_delivery_time TEXT,
  videography_editing_options TEXT[],
  videography_pre_event_shoot BOOLEAN,
  
  travel_included BOOLEAN,
  travel_radius_km INTEGER,
  travel_extra_charge NUMERIC(12,2),
  travel_details JSONB,
  
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### What DOESN'T EXIST (needed from 20261001000000)

```sql
-- These columns are MISSING from remote:
advance_percentage NUMERIC(3,1) DEFAULT 20
event_type TEXT

-- These columns are ALSO MISSING (for video support):
-- (on photography_videography_package_images table)
media_type TEXT DEFAULT 'image'
duration_seconds INTEGER
thumbnail_url TEXT
```

---

## FIX

The migration **20261001000000_photography_videography_fixes.sql** must be applied to remote Supabase.

This migration contains:
```sql
ALTER TABLE public.photography_videography_packages
ADD COLUMN IF NOT EXISTS advance_percentage NUMERIC(3,1) DEFAULT 20;

ALTER TABLE public.photography_videography_packages
ADD COLUMN IF NOT EXISTS event_type TEXT;
```

And also adds video support columns to `photography_videography_package_images`.

---

## WHY THIS HAPPENED

The application code was updated to use these new fields:
- `advance_percentage` - for down payment calculation
- `event_type` - for event classification

But the remote database schema was never updated.

The local development may have had the migration applied, but the remote Supabase database has not.

---

## SOLUTION STEPS

### Step 1: Verify Current Remote Schema

Open Supabase console and inspect the `photography_videography_packages` table.

**Confirm these columns are MISSING:**
- [ ] advance_percentage
- [ ] event_type

**Confirm these columns are MISSING from `photography_videography_package_images`:**
- [ ] media_type
- [ ] duration_seconds
- [ ] thumbnail_url

### Step 2: Apply the Migration

When ready to deploy:

```bash
supabase db push --linked
```

This will apply all pending migrations, including **20261001000000_photography_videography_fixes.sql**.

### Step 3: Test Again

After migration is applied to remote Supabase:

1. Reload application at http://localhost:8080
2. Log in as vendor
3. Create Photography + Videography package
4. Fill all steps
5. Click Save Package

**Expected result:** Package creates successfully, package ID appears, gallery/video uploads proceed.

---

## ERROR MESSAGES AFTER FIX

After applying the migration, if Save still fails, the logs will show which stage failed:

```
STAGE: PACKAGE_INSERT ✅ SUCCESS
STAGE: ADDON_INSERT ✅ SUCCESS
STAGE: COVER_UPLOAD ✅ SUCCESS
STAGE: COVER_MEDIA_INSERT ✅ SUCCESS
STAGE: GALLERY_UPLOAD ✅ SUCCESS
STAGE: VIDEO_UPLOAD ✅ SUCCESS
STAGE: FINALIZE_SUCCESS ✅ COMPLETE
```

Each stage is logged in browser console with `console.log()`.

---

## TESTING CHECKLIST

### Before Migration

- [ ] Browser console shows: `STAGE: PACKAGE_INSERT` followed by error 42703
- [ ] No package row is created in Supabase
- [ ] Application toast shows: "Database schema mismatch"

### After Migration

- [ ] Browser console shows all stages completing
- [ ] New package row appears in `photography_videography_packages` table
- [ ] Application shows success: "Package created"
- [ ] Package ID is visible
- [ ] Gallery images upload to storage
- [ ] Videos upload to storage
- [ ] Media records appear in `photography_videography_package_images` table with `media_type`

---

## SUMMARY

**Root Cause:** Missing database columns (advance_percentage, event_type) on remote Supabase

**Failed Stage:** PACKAGE_INSERT

**Error Code:** 42703 (column does not exist)

**Fix:** Apply migration 20261001000000_photography_videography_fixes.sql to remote database

**Command:** `supabase db push --linked`

**Status:** Do NOT deploy to production. User must apply migration after manual testing confirms fix.
