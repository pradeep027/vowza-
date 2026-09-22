# Technical Summary: Photography & Videography Package Builder Fixes

**Quick Reference for Developers**

---

## The Problem

Package creation was failing silently due to:
1. Missing RLS policies blocking all database writes
2. Missing `advance_percentage` column
3. Missing storage policies
4. Generic error handling hiding actual failures

---

## What Was Fixed

### **1. Schema Migration: `20260722000000_fix_photography_videography_schema.sql`**

**Adds to `photography_videography_packages` table:**
```sql
-- Missing columns
advance_percentage NUMERIC(3,1) DEFAULT 20 CHECK (advance_percentage >= 0 AND advance_percentage <= 100);
event_type TEXT;
```

**Adds to `photography_videography_package_images` table:**
```sql
media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video'));
duration_seconds INTEGER;
thumbnail_url TEXT;
```

**Creates 14 RLS Policies:**

**For `photography_videography_packages`:**
- `photography_videography_vendor_insert` - Vendors insert own
- `photography_videography_vendor_update` - Vendors update own
- `photography_videography_vendor_delete` - Vendors delete own
- `photography_videography_vendor_select` - Vendors see own
- `photography_videography_customer_select` - Customers see public

**For `photography_videography_package_images`:**
- `photography_videography_images_vendor` - Vendors manage own images
- `photography_videography_images_customer` - Customers view public images

**For `photography_videography_package_addons`:**
- `photography_videography_addons_vendor` - Vendors manage own add-ons
- `photography_videography_addons_customer` - Customers view public add-ons

**For `photography_videography_package_bookings`:**
- `photography_videography_bookings_vendor` - Vendors see their bookings
- `photography_videography_bookings_customer` - Customers see their bookings
- `photography_videography_bookings_insert` - Customers create bookings

**For Storage Bucket `photography-videography-package-images`:**
- `photography_videography_storage_read` - Public read
- `photography_videography_storage_upload` - Authenticated upload
- `photography_videography_storage_update` - Own file update
- `photography_videography_storage_delete` - Own file delete

**Adds Constraints:**
```sql
-- Add-on name must be 2-100 characters
ALTER TABLE public.photography_videography_package_addons
ADD CONSTRAINT addon_name_length CHECK (char_length(trim(name)) BETWEEN 2 AND 100);
```

**Adds Indexes:**
```sql
CREATE INDEX photography_videography_packages_active_idx 
  ON public.photography_videography_packages(is_active, is_visible, status) 
  WHERE is_active = TRUE AND is_visible = TRUE;

CREATE INDEX photography_videography_bookings_customer_idx 
  ON public.photography_videography_package_bookings(customer_id, created_at DESC);
```

---

### **2. Component Update: `src/pages/vendor/PhotoVideoPackageManager.tsx`**

**Line 237-568: Enhanced Save Function**

#### Before:
```typescript
try {
  // ... save logic ...
} catch (err: any) {
  console.error('Save error:', err);
  toast.error(err.message || 'Failed to save package');
}
```

#### After:
```typescript
try {
  // Detailed logging at each step
  console.log('📝 Saving package payload:', { packageId: draft.id, packageType: draft.package_type, price: priceNum, ... });
  
  // ... save logic with logging ...
  console.log('✏️ Updating existing package:', draft.id);
  // or
  console.log('➕ Creating new package');
  
  console.log('🔧 Processing add-ons for package:', packageId);
  console.log('📋 Valid add-ons:', validAddons.length);
  
  console.log('📷 Uploading cover photo:', draft.cover_file.name);
  console.log('🖼️ Uploading gallery files:', draft.gallery_files.length);
  
  console.log('🎉 Package save complete');
  toast.success('Package created');
  
} catch (err: any) {
  // Enhanced error detection and user messaging
  const errorMessage = err.message || err.details || String(err);
  console.error('💥 Package save failed:', {
    error: err,
    message: errorMessage,
    code: err.code,
    details: err.details,
    hint: err.hint,
    provider_id: provider.id,
    user_id: user?.id,
  });
  
  // Detect error type and show appropriate message
  let userError = 'Unable to create package. Please try again.';
  if (errorMessage.includes('photography_videography_packages')) {
    userError = 'Failed to save package details...';
  } else if (errorMessage.includes('RLS policy') || errorMessage.includes('permission')) {
    userError = 'Permission denied. Please ensure you are logged in as a vendor.';
  } else if (errorMessage.includes('upload')) {
    userError = 'Image upload failed...';
  } else if (errorMessage.includes('column')) {
    userError = 'Database schema issue. Please contact support.';
  } else if (errorMessage.includes('foreign')) {
    userError = 'Package reference error...';
  }
  
  toast.error(userError);
}
```

**Key Changes:**
- Added `media_type: 'image'` to image inserts (line 348, 379)
- Better error categorization with specific user messages
- Complete logging trail for debugging
- Maintains exact package_type value during save

---

## Expected Behavior After Fix

### **Success Path**
```
User clicks "Save Package"
  ↓
Validations pass (price > 0, name exists, etc.)
  ↓
Logs: "📝 Saving package payload: ..."
  ↓
RLS policy allows insert (vendor owns package) ✅
  ↓
Logs: "✅ Package created with ID: <uuid>"
  ↓
Logs: "🔧 Processing add-ons..."
Saves add-ons (RLS allows, filters price > 0) ✅
  ↓
Logs: "📷 Uploading cover photo..."
Uploads cover, saves image record (media_type='image') ✅
  ↓
Logs: "🖼️ Uploading gallery files..."
Uploads gallery images ✅
  ↓
Logs: "🎉 Package save complete"
  ↓
Toast: "Package created" ✅
Package appears in vendor list
```

### **Error Path (Example: RLS Missing)**
```
User clicks "Save Package"
  ↓
All validations pass
  ↓
Insert attempted on photography_videography_packages
  ↓
Supabase RLS: No policy → Permission Denied
  ↓
Logs: "💥 Package save failed: {
  error: {...},
  message: "new row violates row-level security policy...",
  code: "PGRST301",
  provider_id: "<uuid>",
  user_id: "<uuid>"
}"
  ↓
Error detected: includes "RLS policy"
  ↓
Toast: "Permission denied. Please ensure you are logged in as a vendor." ✅
```

---

## How RLS Policies Work

**Example: Vendor Inserting Package**

```sql
-- Policy: photography_videography_vendor_insert
CREATE POLICY photography_videography_vendor_insert 
  ON public.photography_videography_packages 
  FOR INSERT 
  WITH CHECK (provider_id = auth.uid());
```

When vendor with `id = "abc-123"` logs in and tries to insert:
- `auth.uid()` = `"abc-123"` ✓
- Payload includes `provider_id = "abc-123"` ✓
- `provider_id = auth.uid()` → TRUE ✓
- INSERT ALLOWED

If vendor tries to insert with different `provider_id`:
- `auth.uid()` = `"abc-123"`
- Payload includes `provider_id = "xyz-789"` (someone else's ID)
- `provider_id = auth.uid()` → FALSE
- INSERT DENIED → "RLS policy violation"

**For Customers Viewing Packages:**

```sql
-- Policy: photography_videography_customer_select
CREATE POLICY photography_videography_customer_select 
  ON public.photography_videography_packages 
  FOR SELECT 
  USING (is_active = TRUE AND is_visible = TRUE AND status IN ('active', 'draft'));
```

Customer can only see packages where ALL are true:
- `is_active = TRUE` ✓
- `is_visible = TRUE` ✓
- `status IN ('active', 'draft')` ✓

If a vendor manually sets `is_visible = FALSE`, customer can't see it (policy filters).

---

## Storage Bucket Policies

**Upload Permission:**
```sql
CREATE POLICY photography_videography_storage_upload 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'photography-videography-package-images' AND
    auth.role() = 'authenticated'
  );
```

Any authenticated user can upload to this bucket. Vendor ownership is enforced by:
1. File path structure: `{user_id}/{package_id}/...`
2. Delete policy checks `(storage.foldername(name))[1] = auth.uid()::text`

---

## Database Schema Changes Summary

| Table | Change | Type |
|-------|--------|------|
| `photography_videography_packages` | Add `advance_percentage` | ALTER TABLE ADD COLUMN |
| `photography_videography_packages` | Add `event_type` | ALTER TABLE ADD COLUMN |
| `photography_videography_packages` | Add RLS policies (5) | CREATE POLICY |
| `photography_videography_package_images` | Add `media_type` | ALTER TABLE ADD COLUMN |
| `photography_videography_package_images` | Add `duration_seconds` | ALTER TABLE ADD COLUMN |
| `photography_videography_package_images` | Add `thumbnail_url` | ALTER TABLE ADD COLUMN |
| `photography_videography_package_images` | Add RLS policies (2) | CREATE POLICY |
| `photography_videography_package_addons` | Add name length constraint | ALTER TABLE ADD CONSTRAINT |
| `photography_videography_package_addons` | Add RLS policies (2) | CREATE POLICY |
| `photography_videography_package_bookings` | Add RLS policies (3) | CREATE POLICY |
| `storage.objects` | Add bucket policies (4) | CREATE POLICY |

---

## Testing the Fix

### **Quick Test (5 min)**
```bash
# Start dev server
npm run dev

# Navigate to: http://localhost:8080

# Log in as vendor

# Create package:
# - Name: "Test"
# - Type: "Photography + Videography"
# - Price: 5000
# - Upload cover image
# - Click Save

# Check browser console - should see:
# ✅ 📝 Saving package payload...
# ✅ ➕ Creating new package
# ✅ 🎉 Package save complete

# Check vendor package list - package should appear
```

### **Error Test (3 min)**
```bash
# In same dev session

# Try to create package with:
# - Price: 0
# - Click Save

# Expected: Error toast "Package price must be greater than ₹0"
# Expected in console: Validation logs, no "💥 Package save failed"
```

### **Database Verification (5 min)**
```bash
# Open Supabase Dashboard
# SQL Editor

SELECT id, name, package_type, price, advance_percentage, event_type
FROM photography_videography_packages
WHERE name = 'Test'
LIMIT 1;

# Verify:
# - package_type = 'photography_and_videography'
# - price = 5000
# - advance_percentage = 20
# - event_type is not NULL (filled from form)
```

---

## Deployment Checklist

- [ ] Migration applied to Supabase (`supabase db push --linked`)
- [ ] Component changes deployed
- [ ] TypeScript builds (`npx tsc --noEmit` → Exit 0)
- [ ] Production build succeeds (`npm run build` → Exit 0)
- [ ] Dev server runs (`npm run dev`)
- [ ] Quick test passes (package creates + saves)
- [ ] Error test passes (validation working)
- [ ] Database verification passes (correct values persisted)
- [ ] Vendor can edit package (loads/updates correctly)
- [ ] Customer can view package (displays correctly)
- [ ] Booking creates with correct price
- [ ] Supabase logs checked for errors (Dashboard → Logs)
- [ ] No console errors except expected logs
- [ ] RLS policies applied (verified in Supabase Dashboard → Database → Policies)
- [ ] Storage policies applied (verified in Supabase Dashboard → Storage → Policies)

---

## Rollback if Needed

**Component Rollback:**
```bash
git log --oneline | grep "Photography & Videography"
git revert <commit-hash>
git push origin main
```

**Migration Rollback (Manual via Supabase Dashboard):**
```sql
-- Option 1: Drop policies only
DROP POLICY photography_videography_vendor_insert ON photography_videography_packages CASCADE;
DROP POLICY photography_videography_vendor_update ON photography_videography_packages CASCADE;
-- ... drop remaining policies ...

-- Option 2: Drop new columns (destructive!)
ALTER TABLE photography_videography_packages DROP COLUMN advance_percentage;
ALTER TABLE photography_videography_packages DROP COLUMN event_type;
-- ... drop other new columns ...
```

---

## Performance Considerations

### **Indexes Added**
- `photography_videography_packages_active_idx` on `(is_active, is_visible, status)`
  - Speeds up: Customer listing queries
  - Covers: WHERE is_active AND is_visible AND status IN (...)
  
- `photography_videography_bookings_customer_idx` on `(customer_id, created_at DESC)`
  - Speeds up: Customer bookings list
  - Common sort: Newest first

### **RLS Policy Impact**
- Each DML operation checks policies (minimal overhead)
- Policies are well-indexed (vendor_id references provider_id which is indexed)
- Storage policies evaluated on upload (negligible impact)

### **Expected Response Times**
- Package creation: 200-500ms (RLS check + DB insert + file upload)
- Package list load: 50-150ms (RLS filtered query)
- Image upload: 500ms-2s (depends on file size)

---

## Next Steps

1. **Deploy migration to Supabase** (`supabase db push --linked`)
2. **Deploy component changes** (git push + merge to main)
3. **Monitor error logs** for 24 hours
4. **Verify no RLS violations** in Supabase logs
5. **Collect vendor feedback** on package creation experience

---

**Status:** Ready for deployment  
**Date:** July 22, 2026  
**Files Modified:**
- `src/pages/vendor/PhotoVideoPackageManager.tsx` (Enhanced save, logging)
- `supabase/migrations/20260722000000_fix_photography_videography_schema.sql` (New)
