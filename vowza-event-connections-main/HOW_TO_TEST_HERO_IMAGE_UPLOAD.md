# How to Test Hero Image Upload - Complete Guide

## Quick Start

### Step 1: Open Browser Developer Tools
Press `F12` or `Ctrl+Shift+I` → Click **Console** tab

### Step 2: Navigate to Admin Panel
Go to: http://localhost:8081/admin/about-us

### Step 3: Scroll to Image Upload Section
Find: **"📸 About Us Hero Image"**

### Step 4: Try Uploading
Click: **"Upload Hero Image"** button

---

## Expected Behavior (All Steps)

### STEP 1: File Picker Opens
**Click**: "Upload Hero Image" button

**Expected in Console**:
```
[AboutVowzaEditor] Upload button clicked
```

**Expected on Screen**:
- Operating system file picker window opens
- Can browse and select an image file

**If Fails**:
- File picker doesn't open
- Check console for JavaScript errors
- Console should show `[AboutVowzaEditor] Upload button clicked`
- If it doesn't appear, there's a JavaScript error preventing the click

---

### STEP 2: File Selection
**Select**: Any image file (JPG, PNG, WebP)

**Expected in Console**:
```
[AboutVowzaEditor] File selected: {
  name: "photo.jpg",
  type: "image/jpeg",
  size: 204800,
  sizeInMB: "0.20"
}
[AboutVowzaEditor] File validation passed, creating preview
[AboutVowzaEditor] Preview URL created
```

**Expected on Screen**:
- Preview image appears below the button
- "Confirm Upload" button appears
- "Clear" button appears

**If Fails**:
- Check console for validation errors
- Look for `[AboutVowzaEditor] Invalid file type` if selecting non-image
- Look for `[AboutVowzaEditor] File too large` if file > 5MB

---

### STEP 3: Upload Confirmation
**Click**: "Confirm Upload" button

**Expected in Console**:
```
[AboutVowzaEditor] Upload starting for: photo.jpg
[AboutVowzaEditor] Generated filename: hero-image-1726123456-photo.jpg
[AboutVowzaEditor] Upload successful, path: hero-image-1726123456-photo.jpg
[AboutVowzaEditor] Public URL generated: https://vavfeataqwwbpjonknne.supabase.co/storage/v1/object/public/about-us/hero-image-1726123456-photo.jpg
```

**Expected on Screen**:
- Button shows "Uploading..." with spinner
- After 1-5 seconds: Green success toast appears "Image uploaded successfully!"
- Preview image remains
- "Remove Image" button appears (red)

**If Fails**:
- Look for `[AboutVowzaEditor] Storage upload error` in console
- Common errors:
  - `Access denied` = Admin doesn't have upload permission (RLS issue)
  - `Bucket not found` = Storage bucket "about-us" doesn't exist
  - `File too large` = Despite earlier validation, server rejected it

---

### STEP 4: Form Save
**Fill Required Fields**:
1. Title (should be pre-filled)
2. Our Story (description text)
3. Our Mission (should be pre-filled)
4. Our Vision (should be pre-filled)

**Click**: "Save Changes" button

**Expected in Console**:
```
[AboutVowzaEditor] Saving About Vowza content: {
  title: "Where Talent Meets Celebration",
  descriptionLength: 150,
  missionLength: 85,
  visionLength: 70,
  heroImageUrl: "https://vavfeataqwwbpjonknne.supabase.co/storage/v1/..."
}
[AboutVowzaEditor] Database update successful
```

**Expected on Screen**:
- Button shows "Saving..." with spinner
- After 1-2 seconds: Green success toast "About Vowza updated successfully!"

**If Fails**:
- Look for `[AboutVowzaEditor] Supabase database error` in console
- Common errors:
  - `relation "about_us" does not exist` = Migration not applied, table missing
  - `permission denied` = Admin doesn't have database write permission (RLS)
  - `column "hero_image_url" does not exist` = Migration 20260730 not applied

---

### STEP 5: Verify Persistence
**Refresh Page**: Press F5

**Expected in Console**: No errors

**Expected on Screen**:
- Page reloads
- Admin panel loads
- Uploaded image appears in preview again
- "Remove Image" button still visible
- Form fields contain saved data

**If Fails**:
- Image doesn't reappear = Data not saved to database
- Check database directly:
  ```sql
  SELECT hero_image_url FROM public.about_us 
  WHERE id = '00000000-0000-0000-0000-000000000001';
  ```

---

### STEP 6: Public Page Display
**Open New Tab**: http://localhost:8081/about

**Expected on Screen**:
- Hero section displays uploaded image
- Image is in the right side column (desktop)
- Image is below text (mobile)
- Image has rounded corners and subtle border
- NO broken image icon

**If Fails**:
- Check browser console (F12) for image load errors
- Verify image URL is correct:
  1. Right-click on image → "Inspect"
  2. Check src= in HTML
  3. Verify URL matches what was shown in admin console
  4. Try opening URL directly in new tab

---

### STEP 7: Image Replacement
**Go Back to Admin**: http://localhost:8081/admin/about-us

**Upload Different Image**: Select a completely different image

**Expected in Console**:
```
[AboutVowzaEditor] Storage upload error: (if old image wasn't cleaned up, but this is OK)
[AboutVowzaEditor] Upload starting for: newphoto.jpg
[AboutVowzaEditor] Upload successful, path: hero-image-1726123999-newphoto.jpg
[AboutVowzaEditor] Database update successful
```

**Expected on Screen**:
- Old preview is replaced with new preview
- "Save Changes"
- Success toast appears

**Go to Public Page**: Refresh http://localhost:8081/about

**Expected**: New image displays (not old one)

**If Fails**:
- Browser cache might show old image
- Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
- Check console for image load errors

---

### STEP 8: Image Removal
**Go to Admin**: http://localhost:8081/admin/about-us

**Click**: "Remove Image" button (red button)

**Expected in Console**:
```
[AboutVowzaEditor] Removing image from Storage: https://vavfeataqwwbpjonknne.supabase.co/storage/v1/...
[AboutVowzaEditor] Extracted filename: hero-image-1726123456-photo.jpg
[AboutVowzaEditor] File removed from Storage
```

**Expected on Screen**:
- Preview disappears
- Button changes back to "Upload Hero Image"
- Success toast "Image removed successfully!"

**Click**: "Save Changes"

**Expected**: Success toast

**Go to Public**: http://localhost:8081/about

**Expected**: Fallback displays
- Large "V" logo (gold color)
- Text "Vowza"
- Tagline "Plan • Connect • Celebrate"
- NO image, NO broken image icon

**If Fails**:
- Look for `[AboutVowzaEditor] Error removing image` in console
- Could be permission issue (RLS)

---

## Troubleshooting Common Issues

### Issue: File Picker Doesn't Open
**Symptom**: Click button, nothing happens

**Debug**:
1. Open F12 console
2. Click button again
3. Check console - should show `[AboutVowzaEditor] Upload button clicked`

**Solutions**:
- If message appears: Issue is in file input ref → Check browser for JS errors
- If message doesn't appear: Click handler not firing → Check if button is disabled
- If no console messages at all: Check for global JavaScript error at top of console

**Quick Test**:
```javascript
// Type this in browser console:
document.querySelector('input[type="file"]')
// Should return an input element, not null
```

---

### Issue: File Validation Fails
**Symptom**: Select image, get error toast

**Errors**:
- "Please select a valid image file (JPG, PNG, or WebP)"
  → You selected a non-image file
  → Try again with JPG, PNG, or WebP

- "Image must be less than 5MB"
  → File is too large
  → Compress image or select smaller file

**Quick Test**:
```javascript
// Type in console to check file size:
file = document.querySelector('input[type="file"]').files[0]
console.log(file.size / 1024 / 1024) // Size in MB
```

---

### Issue: Upload Fails
**Symptom**: Select image, click "Confirm Upload", get error toast

**Debug Steps**:
1. Check console for `[AboutVowzaEditor] Storage upload error:`
2. Note the error message

**Common Errors**:

| Error | Cause | Fix |
|-------|-------|-----|
| Access denied | Admin not authorized | Check user_roles table |
| Bucket not found | Storage "about-us" missing | Create bucket |
| File too large | Despite validation, server rejected | Check bucket max size |
| Policy violation | Storage RLS blocking upload | Check storage policies |

**Check Admin Authorization**:
```sql
-- In Supabase SQL editor:
SELECT * FROM public.user_roles 
WHERE user_id = auth.uid();
-- Should show role = 'admin'
```

**Check Storage Bucket**:
```sql
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'about-us';
-- Should exist and file_size_limit = 5242880 (5MB)
```

---

### Issue: Save Fails
**Symptom**: Upload succeeds, but "Save Changes" fails

**Debug**:
1. Check console for `[AboutVowzaEditor] Supabase database error:`
2. Note the code and message

**Common Errors**:

| Error | Cause | Fix |
|-------|-------|-----|
| relation "about_us" does not exist | Table missing | Apply migration 20260928 |
| column "hero_image_url" does not exist | Column missing | Apply migration 20260730 |
| permission denied | Admin not authorized | Check RLS policy |

**Check Database Schema**:
```sql
-- In Supabase SQL editor:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'about_us' 
ORDER BY column_name;
-- Should include: hero_image_url, mission, vision, title, description
```

**Check RLS Policies**:
```sql
SELECT name, definition 
FROM pg_policies 
WHERE tablename = 'about_us';
-- Should have policies for admin write access
```

---

### Issue: Public Page Doesn't Show Image
**Symptom**: Image saves, but public /about page blank/fallback

**Debug**:
1. Admin console shows image saved ✓
2. But public page shows fallback
3. Check console (F12) on public page

**Solutions**:
1. **Stale cache**: Hard refresh Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
2. **URL broken**: Right-click image → Inspect → Check src= URL
3. **Permission issue**: Check Storage policy allows public read
4. **Bucket access**: Verify "about-us" bucket is public

**Check Storage Read Policy**:
```sql
SELECT name, definition 
FROM storage.policies 
WHERE bucket_id = 'about-us' 
AND operation = 'SELECT';
-- Should have about-us-public-read policy
```

**Test Image URL Directly**:
1. Find the image URL from admin console logs
2. Copy it
3. Open in new tab
4. Image should display

---

## Console Log Reference

### Normal Flow (Success)
```
[AboutVowzaEditor] Upload button clicked
[AboutVowzaEditor] File selected: {name: ..., type: ..., size: ...}
[AboutVowzaEditor] File validation passed, creating preview
[AboutVowzaEditor] Preview URL created
[AboutVowzaEditor] Upload starting for: ...
[AboutVowzaEditor] Generated filename: hero-image-{timestamp}-{name}
[AboutVowzaEditor] Upload successful, path: ...
[AboutVowzaEditor] Public URL generated: https://...
[AboutVowzaEditor] Saving About Vowza content: {...}
[AboutVowzaEditor] Database update successful
✅ SUCCESS
```

### Validation Failure
```
[AboutVowzaEditor] Upload button clicked
[AboutVowzaEditor] File selected: {name: "file.pdf", type: "application/pdf", size: ...}
[AboutVowzaEditor] Invalid file type: application/pdf
❌ ERROR: "Please select a valid image file"
```

### Upload Failure
```
[AboutVowzaEditor] Upload starting for: ...
[AboutVowzaEditor] Generated filename: ...
[AboutVowzaEditor] Storage upload error: {message: "Access denied", name: "AuthApiError"}
❌ ERROR: "Storage upload failed: Access denied"
```

### Save Failure
```
[AboutVowzaEditor] Upload successful (image uploaded OK ✓)
[AboutVowzaEditor] Saving About Vowza content: {...}
[AboutVowzaEditor] Supabase database error: {message: "relation \"about_us\" does not exist", code: "42P01"}
❌ ERROR: "relation \"about_us\" does not exist"
```

---

## Final Checklist

- [ ] File picker opens
- [ ] Can select JPG/PNG/WebP
- [ ] Invalid files rejected
- [ ] Files > 5MB rejected
- [ ] Preview appears
- [ ] Upload succeeds
- [ ] Image URL generates
- [ ] Save succeeds
- [ ] Refresh shows image persists
- [ ] Public /about displays image
- [ ] New image replaces old
- [ ] Remove image works
- [ ] Fallback displays after removal
- [ ] No console errors

**All pass?** ✅ Feature complete, ready for production!

**Any fails?** Check the Troubleshooting section above or provide console error message for further debugging.

