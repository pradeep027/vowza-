# Debug Hero Image Upload Flow

## Issue Summary
Admin can see the upload UI but:
- File picker may not open
- Image doesn't upload
- URL doesn't save
- Public page doesn't display

## Analysis

### Problem #1: File Input Click Handler
**File**: `AboutVowzaEditor.tsx` lines 231-244

Current code has a potential bug in the button click handler:
```tsx
<button
  type="button"
  onClick={(e) => {
    const input = (e.currentTarget as HTMLElement).querySelector('input[type="file"]') as HTMLInputElement;
    input?.click();
  }}
```

**Issue**: The button is trying to find a file input as a child using querySelector, but the file input is a sibling (hidden with display:none).

**Fix needed**: Use a ref or fix the selector.

### Problem #2: Upload Validation Error Handling
**File**: `AboutVowzaEditor.tsx` lines 42-52

File validation happens but if it fails, the handler just returns silently. Need to verify the user sees the error.

### Problem #3: Upload State Management
**File**: `AboutVowzaEditor.tsx` lines 26-33

State tracking for `previewFile`, `heroImageUrl`, `previewUrl` - need to verify these sync correctly.

### Problem #4: Database Record ID
**File**: `AboutVowzaEditor.tsx` line 165

Save uses hardcoded UUID: `'00000000-0000-0000-0000-000000000001'`

This must match AdminAboutUs which should be passing the ID. Check if ID is actually being used.

### Problem #5: RLS Permission Check
The admin uploading must have the `admin` role in `user_roles` table.

If not, the upload and database update will fail silently.

## Testing Steps

### Test 1: File Picker Opens
1. Admin goes to `/admin/about-us`
2. Scrolls to "About Us Hero Image" section
3. Clicks "Upload Hero Image"
4. **Expected**: Operating system file picker opens
5. **If fails**: Check console for JavaScript errors

### Test 2: File Selection
1. Select any image file (JPG, PNG, WebP)
2. **Expected**: Preview appears in the component
3. **If fails**: Check browser console for errors in `handleImageSelect`

### Test 3: File Validation
1. Try selecting a non-image file (TXT, PDF, etc.)
2. **Expected**: Error toast appears saying "Please select a valid image file"
3. **If fails**: Validation isn't triggering

### Test 4: File Size Limit
1. Try selecting a file > 5MB
2. **Expected**: Error toast appears saying "Image must be less than 5MB"
3. **If fails**: Size validation isn't triggering

### Test 5: Upload Confirmation
1. After file selection, look for "Confirm Upload" button
2. Click it
3. **Expected**: Loading state, then success toast
4. **If fails**: Check console for Supabase upload error

### Test 6: Database Save
1. After upload success, click "Save Changes"
2. **Expected**: Success toast "About Vowza updated successfully!"
3. **If fails**: RLS permission issue or database field missing

### Test 7: Persistence
1. Refresh the admin page
2. **Expected**: Uploaded image still shows in preview
3. **If fails**: Data not saving to database

### Test 8: Public Display
1. Go to public `/about` page
2. **Expected**: Hero section shows uploaded image
3. **If fails**: About.tsx not reading hero_image_url correctly

## Browser Console Debugging

When testing, check browser console (F12) for:
```
[AboutVowzaEditor] File selected:
[AboutVowzaEditor] Validation:
[AboutVowzaEditor] Upload starting:
[AboutVowzaEditor] Upload error:
[AboutVowzaEditor] Database update:
```

Add these logs to AboutVowzaEditor to debug easily.

## Database Schema Check

Run in Supabase SQL editor:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'about_us';
```

Expected columns:
- id
- title
- description
- mission
- vision
- hero_image_url (added by 20260730 migration)
- updated_at
- updated_by

## RLS Permission Check

Run in Supabase SQL editor:
```sql
SELECT * FROM public.user_roles 
WHERE user_id = '{current-admin-user-id}';
```

Must show role = 'admin' for upload to work.

## Storage Bucket Check

Run in Supabase SQL editor:
```sql
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE name = 'about-us';
```

Expected:
- public = true
- file_size_limit = 5242880
- allowed_mime_types = ['image/jpeg', 'image/png', 'image/webp']

## Supabase Storage Policies Check

Run in Supabase SQL editor:
```sql
SELECT name, definition 
FROM storage.policies 
WHERE bucket_id = 'about-us';
```

Expected policies:
- about-us-public-read (anyone can read)
- about-us-admin-upload (admin can insert)
- about-us-admin-delete (admin can delete)

## Fix Implementation Order

1. **First**: Add console logs to AboutVowzaEditor to track where upload fails
2. **Second**: Verify file picker opens (ref/selector issue)
3. **Third**: Verify Supabase client is initialized correctly
4. **Fourth**: Verify RLS permissions in database
5. **Fifth**: Verify Storage bucket policies
6. **Sixth**: Test end-to-end after each fix

