# HERO IMAGE FEATURE — URGENT DATABASE FIX

## ROOT CAUSE CONFIRMED ✗

The `hero_image_url` column **DOES NOT EXIST** in your Supabase database.

**Current about_us table columns:**
- id
- title
- description
- updated_at
- updated_by
- mission
- vision

**Missing column:**
- ❌ hero_image_url

## WHY IT'S BROKEN

1. Admin uploads image → stores URL in temporary state
2. Admin clicks "Save Changes"
3. Backend tries to save `hero_image_url` to non-existent column
4. **Database silently rejects the update** (column doesn't exist)
5. Public page queries for `hero_image_url` → not found
6. **Fallback displays** (V Vowza Plan • Connect • Celebrate)

## IMMEDIATE FIX

### Step 1: Open Supabase SQL Editor

1. Go to: **https://supabase.com/dashboard/project/vavfeataqwwbpjonknne**
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Run This SQL

```sql
ALTER TABLE public.about_us
ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

COMMENT ON COLUMN public.about_us.hero_image_url IS 'URL to the uploaded hero image displayed in the About Us page (stored in Supabase Storage about-us bucket)';
```

### Step 3: Execute

Click **Run** or press `Ctrl+Enter`

Expected result: **Success** (no errors)

### Step 4: Verify

Run this verification query:

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name='about_us' 
AND column_name='hero_image_url';
```

Should return: **hero_image_url**

---

## AFTER DATABASE FIX

1. **Refresh your browser** (http://localhost:8081)
2. **Admin Dashboard → About Us**:
   - Upload a real image
   - Click "Save Changes"
3. **Go to public /about page**:
   - The image should now display
   - Fallback should disappear

---

## WHY MIGRATIONS DIDN'T APPLY

Supabase doesn't automatically apply migrations from the `/migrations` folder. They need to be:
1. Manually run in the SQL Editor, OR
2. Applied via Supabase CLI (`supabase db push`)

The migration file `20260928000000_create_about_us.sql` exists but was never applied to your database.

---

## FILES CREATED FOR REFERENCE

- `URGENT_ADD_HERO_IMAGE_COLUMN.sql` - The exact SQL to run
- `test-schema-direct.js` - Verification script that found the missing column
