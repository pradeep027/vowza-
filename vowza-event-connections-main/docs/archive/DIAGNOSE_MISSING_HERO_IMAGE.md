# Diagnose: Why Hero Image Not Displaying on Public About Page

## Problem
Admin successfully uploads image to About Us dashboard, but public /about page shows fallback (V logo) instead of the uploaded image.

## Comprehensive Diagnostic Guide

### STEP 1: Open Browser Console
1. Open http://localhost:8081/about (public About page)
2. Press `F12` or `Ctrl+Shift+I`
3. Click **Console** tab
4. Refresh the page (F5)

### STEP 2: Check Console Logs

Look for messages starting with `[About]` or `[HeroImageContainer]`

#### Expected Logs (SUCCESS - Image Should Display):
```
[About] Fetched About Us data: {
  id: "00000000-0000-0000-0000-000000000001",
  title: "Where Talent Meets Celebration",
  hero_image_url: "https://vavfeataqwwbpjonknne.supabase.co/storage/...",
  mission: "...",
  vision: "..."
}
[HeroImageContainer] Received imageUrl: "https://vavfeataqwwbpjonknne.supabase.co/storage/..."
[HeroImageContainer] Rendering image
[HeroImageContainer] Image loaded successfully
```

#### Scenario A: hero_image_url is NULL
```
[About] Fetched About Us data: {
  hero_image_url: null,  ← IMAGE URL IS NULL!
  ...
}
[HeroImageContainer] Received imageUrl: "null/undefined"
[HeroImageContainer] Rendering fallback (no image URL)
```

**This means**: Admin upload succeeded, but the URL was NOT saved to the database.

**Action**: Go to Admin Dashboard and re-upload. Watch browser console in Admin panel for:
- `[AboutVowzaEditor] Saving About Vowza content: { heroImageUrl: "https://..." }`
- `[AboutVowzaEditor] Database update successful`
- `[AboutVowzaEditor] Saved hero_image_url: "https://..."`

#### Scenario B: hero_image_url has a URL but image doesn't load
```
[About] Fetched About Us data: {
  hero_image_url: "https://...",  ← URL PRESENT
  ...
}
[HeroImageContainer] Received imageUrl: "https://..."
[HeroImageContainer] Rendering image
[HeroImageContainer] Image load failed: Network error  ← IMAGE WON'T LOAD
```

**This means**: Database has the URL, but Storage image can't be accessed (permission issue or URL is wrong).

**Action**:
1. Copy the URL from console
2. Open in new tab
3. If you get 403 or 401, it's a Storage permission issue
4. If you get 404, the file doesn't exist in Storage

#### Scenario C: No logs at all
```
(No [About] logs, no [HeroImageContainer] logs)
```

**This means**: Component didn't even load or fetch failed silently.

**Action**:
1. Check for JavaScript errors in console (red messages)
2. Reload page
3. Check network tab (F12 → Network) to see if Supabase query succeeded

### STEP 3: Manually Query the Database

Open Supabase SQL Editor and run:

```sql
SELECT id, title, hero_image_url, updated_at 
FROM public.about_us 
WHERE id = '00000000-0000-0000-0000-000000000001';
```

Expected result:
```
id                                    | title                               | hero_image_url                                        | updated_at
00000000-0000-0000-0000-000000000001  | Where Talent Meets Celebration      | https://vavfeataqwwbpjonknne.supabase.co/storage/... | 2026-01-XX ...
```

If `hero_image_url` is NULL or empty:
- Admin upload didn't save properly
- Or a different record is being updated

If `hero_image_url` has a URL:
- Database is fine
- Problem is storage access or rendering

### STEP 4: Test the Storage URL

1. From the database query above, copy the `hero_image_url` value
2. Open it in a new browser tab
3. Expected: Image displays
4. If 403/401: Storage permission issue
5. If 404: File doesn't exist in Storage

### STEP 5: Check Storage Bucket

Open Supabase → Storage → about-us bucket

Expected:
- Bucket "about-us" exists
- Files named like `hero-image-1726xxxxxx-filename.jpg` are present
- Bucket is marked "Public"

If bucket is marked "Private":
- Images won't load on public page
- This is the bug

### STEP 6: Verify Upload Actually Happened

Go to Admin Dashboard → About Us

1. Check if preview image shows
2. Open browser console (F12)
3. Upload an image again
4. Watch for console logs:
   ```
   [AboutVowzaEditor] Upload button clicked
   [AboutVowzaEditor] File selected: {...}
   [AboutVowzaEditor] Upload starting for: ...
   [AboutVowzaEditor] Upload successful, path: ...
   [AboutVowzaEditor] Public URL generated: https://...
   [AboutVowzaEditor] Saving About Vowza content: { heroImageUrl: "https://..." }
   [AboutVowzaEditor] Database update successful
   [AboutVowzaEditor] Saved hero_image_url: "https://..."
   ```

If you see `Upload successful` but NOT `Database update successful`:
- Upload worked, but save failed
- Check browser console for database error details

### STEP 7: Verify Field Name Consistency

The field is consistently named across all layers:
- ✅ Admin saves to: `hero_image_url` column
- ✅ Public reads from: `hero_image_url` column  
- ✅ Component receives: `imageUrl` prop
- ✅ HeroImageContainer checks: `if (imageUrl) { render image } else { fallback }`

No mismatches found. The pipeline is correctly wired.

### STEP 8: Check React State

If the database has the URL but public page still shows fallback:

The problem might be React state not updating. Try:

1. Hard refresh: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear cache: Open DevTools → Right-click refresh → "Empty cache and hard refresh"
3. Close and reopen browser tab

---

## Diagnostic Decision Tree

```
START
  ↓
Visit http://localhost:8081/about
  ↓
Open F12 Console
  ↓
Do you see [About] and [HeroImageContainer] logs?
  ├─ NO → JavaScript error prevented fetch
  │ └─ Check console for errors, reload page
  │
  └─ YES
    ↓
    Does [About] log show hero_image_url with a URL?
    ├─ NO (null/undefined)
    │ └─ Admin upload didn't save URL to database
    │   └─ Go to Admin, re-upload, check console logs
    │
    └─ YES (has URL like https://...)
      ↓
      Does [HeroImageContainer] show "Image loaded successfully"?
      ├─ YES
      │ └─ IMAGE DISPLAYS ✓ (Problem solved!)
      │
      └─ NO (shows "Image load failed")
        ├─ Error is 403 or 401
        │ └─ Storage permission issue
        │   └─ Check bucket is public
        │   └─ Check RLS policies
        │
        └─ Error is 404
          └─ Image URL is wrong or file missing
            └─ Check URL matches actual file in Storage
```

---

## Common Issues & Fixes

### Issue #1: Database has NULL hero_image_url
**Symptom**: Console shows `hero_image_url: null`

**Cause**: Admin upload succeeded (image in Storage) but URL not saved to DB

**Fix**:
1. Go to Admin Dashboard → About Us
2. Open F12 Console  
3. Upload image again
4. Watch for `[AboutVowzaEditor] Database update successful`
5. Watch for `[AboutVowzaEditor] Saved hero_image_url: https://...`
6. Check console for database errors

### Issue #2: Storage returns 403 Forbidden
**Symptom**: Console shows `[HeroImageContainer] Image load failed: 403`

**Cause**: Bucket is private or RLS policy blocks public read

**Fix**: 
In Supabase SQL Editor:
```sql
SELECT public, avif_autodetection, file_size_limit 
FROM storage.buckets 
WHERE id = 'about-us';
```

Should show `public = TRUE`

If false, this is the bug. The bucket needs to be public for public page to display images.

### Issue #3: Storage returns 404 Not Found
**Symptom**: Console shows `[HeroImageContainer] Image load failed: 404`

**Cause**: File doesn't exist at that URL or was deleted

**Fix**:
1. Go to Supabase → Storage → about-us bucket
2. Look for file starting with `hero-image-`
3. If missing, re-upload from Admin
4. Verify URL in database matches actual file path

### Issue #4: Image URL in DB but still showing fallback (no error logs)
**Symptom**: 
- Database has URL
- Console shows image URL received
- But fallback displays anyway
- No error logs

**Cause**: React component not re-rendering despite data fetch

**Fix**:
1. Hard refresh: `Ctrl+F5`
2. Clear browser cache and cookies for localhost:8081
3. Close DevTools and reopen
4. Try private/incognito browser window

### Issue #5: Admin console shows upload succeeded but DB is still NULL
**Symptom**:
- Admin: `[AboutVowzaEditor] Upload successful`
- Admin: `[AboutVowzaEditor] Database update successful`
- But database query shows `hero_image_url IS NULL`

**Cause**: Different record being updated or admin permission issue

**Fix**:
Check in SQL editor:
```sql
SELECT * FROM public.about_us;
```

Make sure record with ID `'00000000-0000-0000-0000-000000000001'` exists and has hero_image_url populated.

---

## Direct Testing Steps

### Test 1: Verify Database Field Exists
```sql
-- In Supabase SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'about_us' 
ORDER BY column_name;
```

Expected: `hero_image_url` column with type `text`

### Test 2: Verify Current Database Value
```sql
SELECT hero_image_url 
FROM public.about_us 
WHERE id = '00000000-0000-0000-0000-000000000001';
```

Expected: URL starting with `https://vavfeataqwwbpjonknne.supabase.co/storage/`

### Test 3: Verify Bucket is Public
```sql
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'about-us';
```

Expected: `public = TRUE`

### Test 4: Verify File Exists in Storage
```sql
SELECT name, bucket_id 
FROM storage.objects 
WHERE bucket_id = 'about-us' 
ORDER BY created_at DESC 
LIMIT 5;
```

Expected: Files like `hero-image-1726xxxxx-filename.jpg`

### Test 5: Verify Admin Upload Flow
1. Go to Admin Dashboard → About Us
2. Open F12 Console
3. Upload image
4. Watch for all these logs (in order):
   - `[AboutVowzaEditor] Upload button clicked`
   - `[AboutVowzaEditor] File selected: {...}`
   - `[AboutVowzaEditor] Upload starting for: ...`
   - `[AboutVowzaEditor] Generated filename: hero-image-...`
   - `[AboutVowzaEditor] Upload successful, path: ...`
   - `[AboutVowzaEditor] Public URL generated: https://...`
   - Fill in required fields
   - Click "Save Changes"
   - `[AboutVowzaEditor] Saving About Vowza content: {...}`
   - `[AboutVowzaEditor] Database update successful`
   - `[AboutVowzaEditor] Saved hero_image_url: https://...`

All should appear in sequence with no errors.

---

## Next Steps Based on Findings

**If database has URL but image not displaying:**
→ Check Storage permissions (Scenario B above)

**If database is NULL:**
→ Admin upload not saving URL (Scenario A above)
→ Re-upload and check console

**If no logs at all:**
→ Component fetch failed (Scenario C above)
→ Check for JavaScript errors

**If all looks correct:**
→ Hard refresh browser
→ Clear browser cache
→ Try different browser or incognito window

---

## Summary

The code pipeline is correctly wired:
- ✅ Field names match (`hero_image_url`)
- ✅ Admin saves correctly (if upload succeeds)
- ✅ Public reads correctly (if database has data)
- ✅ Component renders correctly (if URL is not null)

The most likely issues:
1. **URL not being saved to database** (admin upload issue)
2. **Storage bucket not public** (permission issue)
3. **Browser cache** (stale fallback display)

Use this guide to identify exactly which layer is failing, then fix that specific issue.

