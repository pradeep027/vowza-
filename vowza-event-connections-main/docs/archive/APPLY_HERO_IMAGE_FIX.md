# CRITICAL: Apply Hero Image Fix to Supabase Database

## Status

**❌ DATABASE NOT YET FIXED**

The frontend code is correct and ready. But the Supabase database is missing:

1. ❌ `about_us.hero_image_url` column
2. ❌ `about-us` storage bucket
3. ❌ Storage RLS policies

## Root Cause

The migration file (`20260928000000_create_about_us.sql`) was empty when deployed to Supabase. Therefore:

- The table was created with only basic fields
- The `hero_image_url` column was never added
- The storage bucket was never created
- RLS policies were never configured

Later migration files tried to add the column, but if Supabase already had the table, they may have been skipped.

---

## Solution: Apply the SQL Fix

### Step 1: Open Supabase SQL Editor

1. Go to: **https://supabase.com/dashboard/project/vavfeataqwwbpjonknne**
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Copy and Paste This SQL

```sql
-- ═════════════════════════════════════════════════════════════════════════════
-- 1. ADD hero_image_url COLUMN TO about_us TABLE
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.about_us
ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

COMMENT ON COLUMN public.about_us.hero_image_url IS 'URL to the uploaded hero image displayed in the About Us page (stored in Supabase Storage about-us bucket)';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. CREATE STORAGE BUCKET: about-us
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'about-us',
  'about-us',
  TRUE,
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. RLS POLICIES FOR STORAGE: about-us bucket
-- ═════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "about-us-public-read" ON storage.objects;
DROP POLICY IF EXISTS "about-us-admin-upload" ON storage.objects;
DROP POLICY IF EXISTS "about-us-admin-delete" ON storage.objects;

CREATE POLICY "about-us-public-read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'about-us');

CREATE POLICY "about-us-admin-upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'about-us'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "about-us-admin-delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'about-us'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
```

### Step 3: Execute

Click **Run** (or press `Ctrl+Enter`)

Expected output: **Success** (no errors)

### Step 4: Verify

In the SQL Editor, run:

```sql
SELECT id, title, hero_image_url FROM public.about_us WHERE id = '00000000-0000-0000-0000-000000000001';
```

You should see:
- ✓ A row with `id = 00000000-0000-0000-0000-000000000001`
- ✓ `hero_image_url` column exists (currently NULL)

---

## After Database Fix

### 1. Refresh Your Application

Close and reopen your browser to the app running on **http://localhost:8081**

### 2. Test the Complete Flow

**Admin Dashboard:**
1. Go to Admin Dashboard → About Us
2. Upload a real image
3. Click "Save Changes"

**Check Console Logs (F12 → Console):**
- Should see: `[AboutVowzaEditor] Saved record: { hero_image_url: "https://..." }`
- Should see: `[AboutVowzaEditor] VERIFICATION - Fresh database SELECT: { hero_image_url: "https://..." }`

**Public About Page:**
1. Navigate to **http://localhost:8081/about**
2. Check Console for:
   - `[About.tsx] RECEIVED DATA from database: { hero_image_url: "https://..." }`
   - `[HeroImageContainer] RECEIVED imageUrl: "https://..."`
   - `[HeroImageContainer] ✓ Image loaded successfully`

**Visual Verification:**
- The hero section should display the uploaded image (not the fallback "V" placeholder)

---

## If You Get Errors

### Error: "relation "storage.buckets" does not exist"

This means storage tables aren't available. This is rare but can happen on certain Supabase setups. Contact Supabase support if this occurs.

### Error: "permission denied"

Ensure you're logged in as the project owner in the Supabase Dashboard, not as a different user.

### Error: "column already exists"

This is expected if running the migration twice. It's safe to ignore (the `IF NOT EXISTS` clause handles it).

---

## Success Criteria

After applying this fix:

1. ✓ Admin can upload image from Dashboard
2. ✓ Image URL is saved to database
3. ✓ Public /about page displays the image
4. ✓ Image doesn't revert after page refresh
5. ✓ Console logs show complete data flow: Admin Save → DB → Public Fetch → Component Render → Image Display

