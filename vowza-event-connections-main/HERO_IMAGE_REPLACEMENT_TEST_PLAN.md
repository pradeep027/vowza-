# Vowza About Us — Hero Image Replacement Feature
## Test Plan & Verification Guide

**Feature**: Replace orbital SVG graphic with admin-uploadable hero image  
**Date Completed**: July 30, 2026  
**Dev Server**: http://localhost:8081/  
**Admin Panel**: http://localhost:8081/admin/about-us

---

## ✓ TASK #7: Test Image Upload in Admin

### Prerequisites
- Dev server running (http://localhost:8081/)
- Admin user authenticated
- Supabase Storage bucket `about-us` exists and is publicly readable
- Database migration applied (hero_image_url column added to about_us table)

### Test Steps

#### Step 1: Navigate to Admin About Us
1. Open browser to http://localhost:8081/admin/about-us
2. Verify page loads without errors
3. Confirm "About Us Management" heading visible
4. Check all sections present:
   - About Vowza Content (with image upload UI)
   - Founder Manager
   - Co-Founders Manager

#### Step 2: Verify Image Upload UI
1. Locate "📸 About Us Hero Image" section
2. Verify these elements exist:
   - Label: "About Us Hero Image"
   - Help text: "Upload an image... Max 5MB. Recommended: square aspect ratio."
   - Upload button: "Upload Hero Image" (or "Change Image" if image exists)
   - Preview area (if image is loaded)

#### Step 3: Upload an Image
1. Click "Upload Hero Image" button
2. Select a test image from your computer (JPG, PNG, or WebP)
   - **Recommended**: Square image (600x600 or larger)
   - **Max size**: 5MB
   - **Example**: Create a simple colored square image or use existing team photo
3. After file selection:
   - Preview should appear in the preview box
   - "Confirm Upload" button should appear below preview
4. Click "Confirm Upload"
5. Verify success toast: "Image uploaded successfully!" appears in top-right

#### Step 4: Verify Upload Completed
1. After upload success:
   - Preview image remains visible
   - "Confirm Upload" button disappears
   - "Remove Image" button appears in red
   - Image URL is stored (confirm by browser DevTools → Network or check database)

#### Step 5: Test Image Removal
1. Click "Remove Image" button
2. Verify removal toast: "Image removed successfully!" appears
3. Confirm:
   - Preview disappears
   - Button text changes back to "Upload Hero Image"
   - "Remove Image" button disappears

#### Step 6: Re-upload and Save
1. Upload a new image (repeat Steps 3-4)
2. Fill in other required fields if empty:
   - Title: "Where Talent Meets Celebration"
   - Our Story: "Vowza brings people together..."
   - Our Mission: "Make event planning simple..."
   - Our Vision: "India's most trusted event-planning ecosystem..."
3. Click "Save Changes"
4. Verify success toast: "About Vowza updated successfully!" appears
5. Check browser console for any errors (F12 → Console tab)

#### Step 7: Verify Data Persistence
1. Refresh the admin page (F5)
2. Navigate away to another admin page, then back to About Us
3. Verify:
   - Uploaded image still displays in preview
   - "Remove Image" button still shows
   - All form fields contain the saved values
   - No errors in console

---

## ✓ TASK #8: Verify Image Displays on Public About Page

### Prerequisites
- Image upload completed and saved in admin (Task #7 steps 1-6)
- Dev server still running
- Public About Us page accessible

### Test Steps

#### Step 1: Navigate to Public About Page
1. Open new tab: http://localhost:8081/about
2. Verify page loads without layout issues
3. Check for any console errors (F12 → Console)

#### Step 2: Verify Hero Section Layout
1. Scroll to top of page (hero section)
2. Check desktop layout (if window width > 1024px):
   - LEFT side: Hero text
     - Eyebrow: "ABOUT VOWZA" (gold bar + text)
     - Headline: "The future of event planning starts here."
     - Description paragraphs
   - RIGHT side: Hero image (rounded, contained)
3. Check mobile layout (if window width < 1024px):
   - TEXT on top
   - IMAGE below text (full width on mobile, max container width)

#### Step 3: Verify Uploaded Image Displays
1. Confirm the uploaded image appears in hero section
2. Verify:
   - Image has rounded corners (rounded-2xl class → ~16px border-radius)
   - Image respects aspect ratio (not stretched)
   - Image has subtle border (border-slate-200)
   - Image has shadow effect
   - Image is responsive (scales on mobile)

#### Step 4: Test Image Removal Fallback
1. Go back to admin panel (http://localhost:8081/admin/about-us)
2. Click "Remove Image" button
3. Click "Save Changes"
4. Go back to public About page (refresh if needed)
5. Verify fallback displays:
   - Background: Subtle gradient (slate-100 to slate-50)
   - Large "V" logo (text-6xl, gold color, font-bold)
   - Text: "Vowza"
   - Tagline: "Plan • Connect • Celebrate"
   - No broken image icon or errors

#### Step 5: Test Image Re-upload and Display
1. Go back to admin, upload a DIFFERENT image
2. Save changes
3. Go to public About page (refresh)
4. Verify new image displays (not the old one)

#### Step 6: Verify No Layout Overflow
1. Test on multiple screen sizes:
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)
2. On each size, verify:
   - No text clipping
   - No horizontal scrollbar
   - Hero image doesn't overflow container
   - All text is readable

#### Step 7: Verify Rest of Page Intact
1. Scroll through entire About page
2. Verify all sections still present:
   - ✓ Hero (with image)
   - ✓ Mission + Vision
   - ✓ "We Believe" section
   - ✓ Founder card (if founder exists)
   - ✓ Leadership team (if co-founders exist)
   - ✓ Closing section
   - ✓ Footer
3. Confirm NO orbital graphic remnants
4. Check no TypeScript/JSX errors in console

---

## 🔍 Verification Checklist

### Admin Panel (Task #7)
- [ ] Upload button visible and functional
- [ ] File validation works (rejects non-images, >5MB files)
- [ ] Preview displays after selection
- [ ] Upload completes successfully
- [ ] Success toast appears
- [ ] Image persists after refresh
- [ ] Remove button works
- [ ] Fallback scenario tested

### Public Page (Task #8)
- [ ] Uploaded image displays in hero section
- [ ] Image has correct styling (rounded, bordered, shadowed)
- [ ] Image is responsive on all screen sizes
- [ ] Fallback works when no image uploaded
- [ ] No text clipping or overflow
- [ ] No console errors
- [ ] Other page sections unchanged

---

## 📊 Success Criteria

✓ Feature is **COMPLETE** when:
1. Admin can upload/remove images without code changes
2. Uploaded image URL persists in database (hero_image_url column)
3. Public About page displays uploaded image with proper styling
4. Fallback (V logo + tagline) displays when no image uploaded
5. All responsive breakpoints work correctly
6. No console errors or TypeScript warnings
7. Original orbital graphic completely removed
8. Build passes (`npm run build` exit 0)

---

## 🛠️ Technical Details

### Database
- **Table**: `public.about_us`
- **Column**: `hero_image_url TEXT` (added via migration 20260730)
- **Record ID**: `00000000-0000-0000-0000-000000000001` (single About Us record)

### Storage
- **Bucket**: `about-us` (Supabase Storage, public read access)
- **Folder**: Root (no subfolders)
- **Naming**: `hero-image-{timestamp}-{filename}`
- **Max size**: 5MB

### Components
- **Admin**: `src/components/admin/AboutVowzaEditor.tsx` (image upload UI)
- **Public**: `src/pages/About.tsx` (display + fallback via HeroImageContainer)
- **Admin page**: `src/pages/admin/AdminAboutUs.tsx` (integrates editor)

### Files
- Migration: `supabase/migrations/20260730_add_hero_image_url_to_about_us.sql`

---

## ⚠️ Known Limitations / Notes
- Image upload only supports JPG, PNG, WebP
- Max 5MB per image
- Square aspect ratio recommended (but not enforced)
- Remove operation deletes file from Storage
- Admin save writes entire About Us record (title + description + mission + vision + image URL)

---

## 📝 Notes
- All timestamps in UTC (stored as ISO strings)
- Toast notifications use Sonner library (top-right corner)
- Fallback component matches premium About page aesthetic
- No breaking changes to existing public page sections

