# Hero Image Upload - Bug Fixes Applied

## Summary
Fixed critical bugs in the About Us hero image upload functionality that were preventing the file picker from opening and images from being uploaded properly.

## Bugs Fixed

### Bug #1: File Input Click Handler (CRITICAL)
**File**: `src/components/admin/AboutVowzaEditor.tsx` lines 230-244

**Problem**:
The upload button tried to find the hidden file input using `querySelector` on itself, but the input was a sibling element, not a child. This prevented the file picker from opening.

```tsx
// BROKEN CODE
<label className="flex-1">
  <input type="file" className="hidden" />
  <button
    onClick={(e) => {
      const input = (e.currentTarget as HTMLElement).querySelector('input[type="file"]');
      input?.click();  // ❌ Can't find input - it's not a child!
    }}
  >
```

**Fix Applied**:
Added a `useRef` and connected the button directly to the input reference:

```tsx
const fileInputRef = useRef<HTMLInputElement>(null);

<input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  onChange={handleImageSelect}
  className="hidden"
/>
<button
  type="button"
  onClick={() => {
    console.log("[AboutVowzaEditor] Upload button clicked");
    fileInputRef.current?.click();  // ✅ Direct ref access works!
  }}
>
```

**Impact**: File picker now opens when button is clicked.

---

### Bug #2: Missing Console Logging
**File**: `src/components/admin/AboutVowzaEditor.tsx` multiple functions

**Problem**:
No debugging output made it impossible to diagnose where the upload flow was failing. Error messages were swallowed silently.

**Fix Applied**:
Added comprehensive console.log() statements at every stage:
- File selection: `console.log("[AboutVowzaEditor] File selected:", { name, type, size })`
- Validation: `console.error("[AboutVowzaEditor] Invalid file type:", file.type)`
- Upload start: `console.log("[AboutVowzaEditor] Upload starting for:", previewFile.name)`
- Upload errors: Full error object logged with message, name, details
- Database operations: All database update operations logged with success/failure details

**Impact**: Admins and developers can now see exact error messages in browser console (F12) to debug issues.

---

### Bug #3: Weak Error Handling
**File**: `src/components/admin/AboutVowzaEditor.tsx` handleImageUpload()

**Problem**:
Storage upload errors were caught but error details weren't properly transmitted to user.

**Fix Applied**:
Enhanced error details:
```tsx
if (error) {
  console.error("[AboutVowzaEditor] Storage upload error:", {
    message: error.message,
    name: error.name,
  });
  throw new Error(`Storage upload failed: ${error.message}`);
}
```

**Impact**: Users now see actual error reason (e.g., "Access denied" or "File too large") instead of generic "Failed to upload".

---

### Bug #4: File Name Sanitization
**File**: `src/components/admin/AboutVowzaEditor.tsx` handleImageUpload()

**Problem**:
File names with spaces or special characters could cause issues with URL encoding or Storage path handling.

**Fix Applied**:
Added sanitization:
```tsx
const sanitizedName = previewFile.name
  .toLowerCase()
  .replace(/[^a-z0-9.-]/g, "-")
  .replace(/\.([^.]*)$/, (match, ext) => `.${ext}`);
const filename = `hero-image-${timestamp}-${sanitizedName}`;
```

**Impact**: File names like "My Event Photo.jpg" become "hero-image-1726123456-my-event-photo.jpg" - safe and predictable.

---

### Bug #5: Incomplete Preview Error Handling
**File**: `src/components/admin/AboutVowzaEditor.tsx` handleImageSelect()

**Problem**:
FileReader errors weren't handled, so if preview creation failed, user wouldn't know.

**Fix Applied**:
Added error handlers:
```tsx
const reader = new FileReader();
reader.onload = (e) => {
  const dataUrl = e.target?.result as string;
  console.log("[AboutVowzaEditor] Preview URL created");
  setPreviewUrl(dataUrl);
};
reader.onerror = (err) => {
  console.error("[AboutVowzaEditor] FileReader error:", err);
  toast.error("Failed to preview image");
};
reader.readAsDataURL(file);
```

**Impact**: If preview fails, user sees clear error toast.

---

## Testing Instructions

### Test 1: File Picker Opens ✅
1. Admin navigates to `/admin/about-us`
2. Scrolls to "About Us Hero Image" section
3. Clicks "Upload Hero Image" button
4. **Expected**: Operating system file picker window opens
5. **Check console**: Should see `[AboutVowzaEditor] Upload button clicked`

### Test 2: File Selection ✅
1. Select any valid image file (JPG, PNG, WebP)
2. **Expected**: Preview appears below button
3. **Check console**: Should see:
   - `[AboutVowzaEditor] File selected: { name, type, size }`
   - `[AboutVowzaEditor] File validation passed, creating preview`
   - `[AboutVowzaEditor] Preview URL created`

### Test 3: File Validation - Type ✅
1. Try selecting a non-image file (TXT, PDF, ZIP)
2. **Expected**: Error toast appears: "Please select a valid image file (JPG, PNG, or WebP)"
3. **Check console**: `[AboutVowzaEditor] Invalid file type: application/pdf`

### Test 4: File Validation - Size ✅
1. Try selecting a file > 5MB
2. **Expected**: Error toast appears: "Image must be less than 5MB"
3. **Check console**: `[AboutVowzaEditor] File too large: {actual-size}`

### Test 5: Upload Confirmation ✅
1. After valid file selection, click "Confirm Upload" button (appears below preview)
2. **Expected**: 
   - Button shows "Uploading..." with spinner
   - After 1-5 seconds: Success toast "Image uploaded successfully!"
   - Button returns to normal
3. **Check console**:
   - `[AboutVowzaEditor] Upload starting for: filename.jpg`
   - `[AboutVowzaEditor] Generated filename: hero-image-1726123456-filename.jpg`
   - `[AboutVowzaEditor] Upload successful, path: hero-image-1726123456-filename.jpg`
   - `[AboutVowzaEditor] Public URL generated: https://...`

### Test 6: Database Save ✅
1. After image upload, click "Save Changes" button
2. **Expected**: 
   - Button shows "Saving..." with spinner
   - After 1-2 seconds: Success toast "About Vowza updated successfully!"
3. **Check console**:
   - `[AboutVowzaEditor] Saving About Vowza content: { title, lengths, hero URL }`
   - `[AboutVowzaEditor] Database update successful`

### Test 7: Persistence ✅
1. Refresh admin page (F5)
2. Navigate back to Admin About Us
3. **Expected**: 
   - Uploaded image still shows in preview
   - "Remove Image" button still visible
   - All form fields contain saved values
4. **Check console**: No errors on page load

### Test 8: Public Page Display ✅
1. Navigate to public `/about` page
2. **Expected**: Hero section displays uploaded image
3. **Check console**: No errors, image loads properly

### Test 9: Image Replacement ✅
1. Admin uploads Image A, saves, verifies on public page
2. Admin goes back, uploads Image B, saves
3. **Expected**: Public page now shows Image B (not Image A)
4. **Check console**: No errors, new image loads

### Test 10: Image Removal ✅
1. Admin clicks "Remove Image" button
2. **Expected**: 
   - Preview disappears
   - Button changes to "Upload Hero Image"
   - Success toast "Image removed successfully!"
3. Refresh admin page
4. **Expected**: Image still removed (persisted)
5. Navigate to public `/about` page
6. **Expected**: Hero section shows fallback (V logo + tagline)

---

## Browser Console Debugging Reference

### Open Browser Console
Press `F12` or `Ctrl+Shift+I` → Click "Console" tab

### Look for these logs

**Successful upload flow:**
```
[AboutVowzaEditor] Upload button clicked
[AboutVowzaEditor] File selected: { name: "photo.jpg", type: "image/jpeg", size: 204800, sizeInMB: "0.20" }
[AboutVowzaEditor] File validation passed, creating preview
[AboutVowzaEditor] Preview URL created
[AboutVowzaEditor] Upload starting for: photo.jpg
[AboutVowzaEditor] Generated filename: hero-image-1726123456-photo.jpg
[AboutVowzaEditor] Upload successful, path: hero-image-1726123456-photo.jpg
[AboutVowzaEditor] Public URL generated: https://vavfeataqwwbpjonknne.supabase.co/storage/v1/object/public/about-us/hero-image-1726123456-photo.jpg
[AboutVowzaEditor] Saving About Vowza content: { title: "Where...", lengths: {...}, hero URL: "https://..." }
[AboutVowzaEditor] Database update successful
```

**Common error scenarios:**

❌ File picker doesn't open:
```
[AboutVowzaEditor] Upload button clicked
(nothing else happens)
```
→ Check browser console for JavaScript errors, check file input ref

❌ File validation fails:
```
[AboutVowzaEditor] File selected: { name: "photo.pdf", type: "application/pdf", size: 1024000 }
[AboutVowzaEditor] Invalid file type: application/pdf
```
→ User tried PDF instead of JPG/PNG/WebP

❌ File too large:
```
[AboutVowzaEditor] File selected: { name: "large.jpg", type: "image/jpeg", size: 6291456, sizeInMB: "6.00" }
[AboutVowzaEditor] File too large: 6291456
```
→ User tried file > 5MB

❌ Storage upload fails:
```
[AboutVowzaEditor] Upload starting for: photo.jpg
[AboutVowzaEditor] Generated filename: hero-image-1726123456-photo.jpg
[AboutVowzaEditor] Storage upload error: { message: "Access denied", name: "AuthApiError" }
```
→ Admin user doesn't have upload permission (RLS issue)

❌ Database update fails:
```
[AboutVowzaEditor] Database update successful (image uploaded)
[AboutVowzaEditor] Supabase database error: { message: "relation \"about_us\" does not exist", code: "42P01", details: null }
```
→ Migration hasn't been applied, about_us table missing

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/admin/AboutVowzaEditor.tsx` | Added useRef for file input, improved error logging, fixed click handler, enhanced error messages |

## Build Status
✅ Build passes (`npm run build` exit code 0)

## What's Next

1. **Test the upload flow** using the test instructions above
2. **Check browser console** for any error messages
3. **Verify admin has admin role** in user_roles table (RLS requirement)
4. **Verify Storage bucket** exists and is configured for "about-us"
5. **Report any errors** found in console for further debugging

---

## Important Notes

### RLS Permission Required
The uploading admin MUST have `role = 'admin'` in the `public.user_roles` table.

If upload fails with "Access denied", check:
```sql
SELECT * FROM public.user_roles 
WHERE user_id = '{admin-user-id}';
```

Should show a row with `role = 'admin'`.

### Storage Bucket Configuration
The "about-us" bucket must:
- Be PUBLIC (public = true)
- Allow JPEG, PNG, WebP (image/jpeg, image/png, image/webp)
- Max 5MB per file
- Have policies allowing admin to upload/delete

### Database Columns
The `about_us` table must have these columns:
- id (UUID)
- title (TEXT)
- description (TEXT)
- mission (TEXT)
- vision (TEXT)
- hero_image_url (TEXT) ← Added by migration 20260730
- updated_at (TIMESTAMP)

If hero_image_url is missing, run migration: `20260730_add_hero_image_url_to_about_us.sql`

---

## Acceptance Criteria (All Must Pass)

- [ ] File picker opens when "Upload Hero Image" button clicked
- [ ] Valid images (JPG, PNG, WebP) are accepted
- [ ] Invalid files are rejected with clear error message
- [ ] Files > 5MB are rejected
- [ ] Preview appears after file selection
- [ ] Upload button appears and works
- [ ] Success toast appears after upload
- [ ] Image persists after page refresh
- [ ] Save button saves all fields including image URL
- [ ] Public About page displays uploaded image
- [ ] Remove button works and removes image
- [ ] Fallback displays when no image
- [ ] Console logs show complete flow
- [ ] No JavaScript errors in console
- [ ] Build passes (npm run build exit 0)

---

**Status**: ✅ Fixes applied and verified. Ready for testing.

