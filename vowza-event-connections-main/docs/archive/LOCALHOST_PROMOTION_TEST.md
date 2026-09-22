# Localhost Promotion Testing Guide

**Application URL:** http://localhost:8080

**Status:** ✅ Development server running

---

## Quick Links

| Page | URL | Purpose |
|------|-----|---------|
| Homepage | http://localhost:8080 | View 4-card promotions |
| Admin Login | http://localhost:8080/auth | Login as admin |
| Admin Promotions | http://localhost:8080/admin/auth-promotion | Create/edit promotions |
| Vendor Profile | http://localhost:8080/provider/{id} | View promoted vendor |
| Vendor w/ Package | http://localhost:8080/provider/{id}?package={pkgid} | Pre-selected package |

---

## Test Scenario 1: Create Catering Promotion

### Step 1: Login as Admin
1. Open: http://localhost:8080/auth
2. Click "Login as Vendor/Artist"
3. Enter email: `admin@vowza.com` (or your admin email)
4. Enter password: (use your password)
5. ✓ Should see admin dashboard

### Step 2: Navigate to Promotion Manager
1. Open: http://localhost:8080/admin/auth-promotion
2. Scroll to "Homepage Promotion Media" section
3. You should see 4 image card slots (1, 2, 3, 4)

### Step 3: Upload Image for Slot 1
1. Click "Image Card 1" section
2. Click upload area (dashed border)
3. Select any JPG/PNG image (~1920x1080px recommended)
4. Preview appears

### Step 4: Select Category → Vendor → Package
1. Below preview, you see: "📌 Link to Vendor & Package (Optional)"
2. **Category Dropdown:** Select "Catering"
3. **Vendor Dropdown:** Auto-filters to caters, select "Sri Lakshmi Catering" (or available caterer)
4. **Package Dropdown:** Auto-filters to vendor's packages, select "Premium Wedding Catering" (or available)
5. ✓ Green box appears: "✓ Sri Lakshmi Catering • Premium Wedding Catering"

### Step 5: Upload and Publish
1. Click "Upload Image" button
2. Wait for upload to complete
3. Success toast: "Image uploaded successfully. Linked to Sri Lakshmi Catering."
4. Card now appears under "CURRENT ITEMS" showing:
   - Image thumbnail
   - "📍 Sri Lakshmi Catering • 📦 Premium Wedding Catering"
5. Click "Publish" button (changes to "Hide" when published)
6. ✓ Promotion now published

---

## Test Scenario 2: Verify Homepage Display

### Step 1: Go to Homepage
1. Open: http://localhost:8080
2. Scroll to "Hero" section (below navigation)
3. Look for 4 image cards in 2x2 grid

### Step 2: View Slot 1 Promotion
1. Top-left card should show uploaded promotion
2. Overlay text shows:
   - **Vendor Name:** Sri Lakshmi Catering
   - **Package Name:** Premium Wedding Catering
   - **Button:** "Book Now →"

### Step 3: Hover and Inspect
1. Hover over card → slight scale-up effect
2. Check browser DevTools Network tab for:
   - GraphQL query for `fetchActiveAuthPromotionMedia`
   - Response includes: `provider_id`, `package_id`, `vendor_name`, `package_name`

---

## Test Scenario 3: Verify Navigation & Pre-Selection

### Step 1: Click "Book Now" Button
1. On homepage, click "Book Now" button on Slot 1 card
2. ✓ Browser should navigate to URL like:
   ```
   http://localhost:8080/provider/abc-123-uuid?package=pkg-456-uuid
   ```
3. Check browser DevTools URL bar

### Step 2: Verify Provider Profile Loads
1. Page loads with vendor info: "Sri Lakshmi Catering"
2. Scroll to "Packages" tab (should be default)
3. Look for packages list

### Step 3: Verify Package Pre-Selection
1. **Expected:** "Premium Wedding Catering" package is highlighted/selected
2. Check DevTools Console for:
   ```
   promotedPackageId = "pkg-456-uuid"
   ```
3. Package should have different styling (gold border or highlight) vs other packages

### Step 4: Verify Book Now Works
1. Click "Book Now" on pre-selected package
2. BookingModal should open
3. Form shows:
   - Vendor: Sri Lakshmi Catering
   - Package: Premium Wedding Catering
   - Pricing matches selected package

---

## Test Scenario 4: Verify Booking Saves Correct IDs

### Step 1: Fill Booking Form
1. BookingModal is open
2. Fill form:
   - Event Date: (pick future date)
   - Number of Guests: 100
   - Location: (any location)
3. Click "Confirm Booking" (or "Continue to Payment")

### Step 2: Check Database (Supabase Dashboard)
1. Open: https://supabase.com/dashboard
2. Navigate to your project
3. Go to Tables → `bookings`
4. Find recent booking entry
5. **Verify columns contain:**
   - `provider_id` = Sri Lakshmi Catering's UUID (matches promotion provider_id)
   - `package_id` = Premium Wedding Catering's UUID (matches promotion package_id)
   - `customer_id` = logged-in user
   - `status` = "pending" (initial state)

---

## Test Scenario 5: Edit Promotion

### Step 1: Navigate to Promotions
1. Open: http://localhost:8080/admin/auth-promotion
2. Scroll to "Homepage Promotion Media"
3. Under "CURRENT ITEMS" for Slot 1, find your created promotion

### Step 2: Click "Edit Vendor"
1. Click "Edit Vendor" button on the promotion card
2. PromotionVendorPackageSelector should update:
   - Category: Shows "Catering"
   - Vendor: Shows "Sri Lakshmi Catering"
   - Package: Shows "Premium Wedding Catering"
3. ✓ Current selections are loaded

### Step 3: Change Vendor/Package
1. Category Dropdown: Select "Photography"
2. Vendor Dropdown: Auto-filters to photographers, select different photographer
3. Package Dropdown: Select different photography package
4. Green box updates: "✓ [New Photographer] • [New Package]"

### Step 4: Upload New Image & Save
1. Select new image file
2. Click "Upload Image"
3. Success toast confirms update

---

## Browser DevTools Inspection

### Check Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Filter: "graphql" or "fetch"
4. Look for:
   - `fetchActiveAuthPromotionMedia` — returns VendorPackagePromotion[]
   - Response includes: `provider_id`, `package_id`, `vendor_name`, `package_name`

### Check Console Logs
1. Open DevTools Console (F12 → Console)
2. Look for:
   - No TypeScript/JavaScript errors
   - Navigation logs when clicking promotion

### Check Local Storage / Session Storage
1. Open DevTools → Application → Local Storage
2. Check for auth tokens, user info
3. Should show logged-in user data

### Inspect Component State
1. Install React DevTools (if not already installed)
2. Open DevTools → Components tab
3. Find: `ImageCarouselCard` component
4. Check props:
   - `media` = array of VendorPackagePromotion objects
   - Each item has: `provider_id`, `package_id`, `vendor_name`, `package_name`

---

## Troubleshooting

### Issue: Homepage shows blank promotion cards
**Solution:**
1. Check: Is migration applied? (Run `supabase db push --include-all`)
2. Check: Are promotions published? (Admin portal → Publish button)
3. Check: Console for errors (F12 → Console)
4. Refresh page (Ctrl+F5 hard refresh)

### Issue: Clicking "Book Now" doesn't navigate
**Solution:**
1. Check: Browser console for errors
2. Check: provider_id is not null (inspect element)
3. Check: React Router is working (try navigating to /artists page)
4. Restart dev server: `npm run dev`

### Issue: Package not pre-selected on provider profile
**Solution:**
1. Check: URL has ?package=... query param
2. Check: Package ID matches a real package in database
3. Check: Console for error message "This promoted package is no longer available"
4. Check: useEffect hook is running (add console.log to verify)

### Issue: Booking shows wrong vendor/package
**Solution:**
1. Check: selectedPackage prop is passed to BookingModal
2. Check: Package UUID matches promotion UUID (compare in database)
3. Check: No other package selection happened after navigation
4. Verify: Database booking record has correct IDs

### Issue: Admin selector doesn't show vendors
**Solution:**
1. Check: Vendors exist in database for selected category
2. Check: Vendors have profession set correctly
3. Check: Vendors are not deleted (is_deleted = false)
4. Check: Category name matches exactly (case-sensitive in some places)

---

## Quick Verification Checklist

| Check | Expected Result | Status |
|-------|-----------------|--------|
| Dev server running | http://localhost:8080 loads | [ ] |
| Admin can login | /admin/auth-promotion accessible | [ ] |
| Category dropdown works | Shows catering, photography, etc. | [ ] |
| Vendor dropdown filters | Shows vendors for selected category | [ ] |
| Package dropdown filters | Shows packages for selected vendor | [ ] |
| Image uploads | Success toast appears | [ ] |
| Homepage displays card | Vendor name + package name visible | [ ] |
| "Book Now" navigates | URL includes ?package={id} | [ ] |
| Package pre-selected | Exact package highlighted on profile | [ ] |
| Booking saves IDs | Database has exact provider_id + package_id | [ ] |

---

## Database Query (Verify Integration)

### Check Promotions in Supabase
```sql
-- Run in Supabase SQL Editor
SELECT 
  id,
  slot_number,
  provider_id,
  package_id,
  vendor_name,
  package_name,
  category,
  is_published,
  created_at
FROM auth_promotion_media
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:**
- Columns: `provider_id` (UUID), `package_id` (UUID), `vendor_name` (string), `package_name` (string)
- `is_published = true` for visible promotions
- `provider_id` NOT NULL for vendor/package promotions
- `package_id` NOT NULL for vendor/package promotions

### Check Bookings Created from Promotion
```sql
SELECT 
  id,
  provider_id,
  package_id,
  customer_id,
  event_date,
  created_at
FROM bookings
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Expected:**
- `provider_id` matches promotion `provider_id`
- `package_id` matches promotion `package_id`
- Booking created within last hour

---

## Performance Checks

### Page Load Time
1. DevTools → Network tab
2. Load homepage
3. Expected: < 3 seconds total load
4. Check: Large images are lazy-loaded

### Image Carousel Rotation
1. View promotion card on homepage
2. Wait 10 seconds
3. Expected: Image rotates to next promotion (if multiple per slot)
4. Check: Smooth fade transition

### Admin Responsiveness
1. Upload image to promotion
2. Expected: UI remains responsive during upload
3. Check: Loading spinner visible
4. Check: Success/error toast shows

---

## Success Criteria

✅ **ALL of the following must be true:**

1. ✅ Admin can create promotion with Vendor + Package selection
2. ✅ Homepage displays vendor name + package name on card
3. ✅ Clicking "Book Now" navigates to `/provider/{id}?package={pkgid}`
4. ✅ ProviderProfile pre-selects exact package (highlighted)
5. ✅ Booking modal shows correct vendor + package
6. ✅ Database booking has exact provider_id + package_id
7. ✅ No TypeScript/JavaScript errors in console
8. ✅ Build verified: `npm run build` PASS (0 errors)

**If ALL 8 are true → Integration is 100% successful**

---

## Contact / Issues

If you encounter any issues:
1. Check browser console for errors (F12)
2. Check network tab for failed requests
3. Verify migration was applied: `supabase db push --include-all`
4. Verify dev server is running: http://localhost:8080
5. Hard refresh page: Ctrl+F5

---

**Happy testing!** 🚀
