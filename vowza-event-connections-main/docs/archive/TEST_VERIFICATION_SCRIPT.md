# Test Verification Script - Photography & Videography Packages

## Objective
Verify the complete artist → database → customer flow after fixes

## Prerequisites
- Artist account with provider_id (role: photographer, videographer, or photography_videography)
- Customer account with user_id
- Test package name: "Test Cover Image Package"
- Test cover image: JPG/PNG file (any size)

---

## PHASE 1: Artist Package Creation (Vendor Dashboard)

### Steps:
1. Login as artist user
2. Navigate to Vendor → Photography & Videography Packages
3. Click "Create New Package"
4. Fill form:
   - Package Name: "Test Cover Image Package"
   - Package Type: "Combined (Photography & Videography)"
   - Photography Type: "Wedding"
   - Videography Type: "Same Day Edit"
   - Price: ₹50,000
5. Upload Cover Image:
   - Click "Upload Cover Photo"
   - Select any JPG/PNG file from computer
   - Image should appear in preview (not placeholder)
6. Fill Additional Details:
   - Photography Details:
     - Team Size: 2
     - Edited Photos: 500
     - Duration: "Full Day (10 Hours)"
     - Delivery Time: "30 Days"
     - Travel Included: Yes, 50 km
   - Videography Details:
     - Duration: "Full Day (8 Hours)"
     - Delivery: "SDE + Cinematic"
     - Editing Options: Both
     - Delivery Time: "14 Days"
7. Add Pricing Details:
   - Base Price: ₹50,000
   - Travel Charges: ₹5,000
   - Mark as "Active" (status = active)
8. Click Save

### Expected Result ✓
- Package saves successfully
- Page refreshes
- Package appears in "Your Packages" list
- **CRITICAL:** Cover image displays on card (not camera placeholder)
- Status badge shows "ACTIVE"
- Price displays: "₹50,000"

### Verification Checkpoint:
- [ ] Package created without errors
- [ ] Cover image visible on dashboard (not placeholder)
- [ ] Status shows ACTIVE
- [ ] Price displays correctly

---

## PHASE 2: Database Verification

### Query: Check Package Record

Open Supabase Studio → SQL Editor and run:

```sql
-- Find the test package
SELECT 
  id,
  provider_id,
  name,
  status,
  is_active,
  is_visible,
  price,
  created_at
FROM public.photography_videography_packages
WHERE name = 'Test Cover Image Package'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
```
id           | (some UUID)
provider_id  | (artist's provider_id)
name         | Test Cover Image Package
status       | active
is_active    | true
is_visible   | true
price        | 50000
created_at   | (recent timestamp)
```

**Verification Checkpoint:**
- [ ] Package row exists
- [ ] status = 'active' (NOT 'draft')
- [ ] is_active = true
- [ ] is_visible = true
- [ ] price is correct

---

### Query: Check Image Record

```sql
-- Find the test package images
SELECT 
  id,
  package_id,
  public_url,
  is_cover,
  media_type,
  storage_path,
  sort_order,
  created_at
FROM public.photography_videography_package_images
WHERE package_id IN (
  SELECT id FROM public.photography_videography_packages
  WHERE name = 'Test Cover Image Package'
)
ORDER BY sort_order;
```

**Expected Result (at least one row):**
```
id           | (some UUID)
package_id   | (matches package id from previous query)
public_url   | https://vavfeataqwwbpjonknne.supabase.co/storage/v1/object/public/photography-videography-package-images/{user_id}/covers/{uuid}.jpg
is_cover     | true
media_type   | image
storage_path | {user_id}/covers/{uuid}.jpg
sort_order   | 0
created_at   | (recent timestamp)
```

**Verification Checkpoint:**
- [ ] Image row exists
- [ ] package_id matches package
- [ ] is_cover = true
- [ ] public_url populated (not NULL)
- [ ] media_type = 'image'
- [ ] storage_path not NULL

---

### Query: Verify Storage File Exists

Use the `public_url` from previous query. In browser:

```
https://vavfeataqwwbpjonknne.supabase.co/storage/v1/object/public/photography-videography-package-images/{user_id}/covers/{uuid}.jpg
```

**Expected Result:**
- Image displays in browser (not 404)
- File exists in public Storage bucket
- Publicly accessible (no auth required for read)

**Verification Checkpoint:**
- [ ] Storage file accessible
- [ ] Image displays in browser

---

## PHASE 3: RLS Policy Verification

### Check Current RLS Policies

```sql
-- List all policies on photography_videography_packages
SELECT 
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'photography_videography_packages'
ORDER BY policyname;
```

**Expected Policies:**
1. `photography_videography_vendor_select` - FOR SELECT
2. `photography_videography_vendor_insert` - FOR INSERT
3. `photography_videography_vendor_update` - FOR UPDATE
4. `photography_videography_vendor_delete` - FOR DELETE
5. `photography_videography_customer_select` - FOR SELECT (with status = 'active' condition)

**Critical Check:**
- [ ] `photography_videography_customer_select` policy EXISTS
- [ ] Policy condition includes `status = 'active'` (NOT `status IN ('active', 'draft')`)

---

### Check Images Table Policies

```sql
-- List all policies on photography_videography_package_images
SELECT 
  policyname,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'photography_videography_package_images'
ORDER BY policyname;
```

**Expected Policies:**
1. `photography_videography_images_vendor` - FOR ALL
2. `photography_videography_images_customer` - FOR SELECT (with active package condition)

**Critical Check:**
- [ ] `photography_videography_images_customer` policy condition includes `status = 'active'` (NOT draft)

---

### Check Add-ons Table Policies

```sql
-- List all policies on photography_videography_package_addons
SELECT 
  policyname,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'photography_videography_package_addons'
ORDER BY policyname;
```

**Expected Policies:**
1. `photography_videography_addons_vendor` - FOR ALL
2. `photography_videography_addons_customer` - FOR SELECT (with active package condition)

**Critical Check:**
- [ ] `photography_videography_addons_customer` policy condition includes `status = 'active'` (NOT draft)

---

## PHASE 4: Customer Visibility Test

### Step 1: Login as Customer

1. Open new private/incognito browser window
2. Navigate to Vowza app
3. Login with customer account (different from artist)
4. Navigate to "Photography & Videography" section

### Step 2: Verify Package Appears

**Expected Result:**
- Test package "Test Cover Image Package" appears in listing
- Cover image displays (from public_url)
- Price shows "₹50,000"
- Package is clickable/selectable

**Verification Checkpoint:**
- [ ] Package visible to customer
- [ ] Cover image displays
- [ ] Price displays
- [ ] Can click to view details

---

### Step 3: Verify Package Details

Click on package to view full details:

**Expected Result:**
- Package name displays correctly
- Cover image displays
- All pricing tiers visible
- Photography deliverables visible
- Videography deliverables visible
- Add-ons visible (if any)
- "Select Package" / "Book Now" button available

**Verification Checkpoint:**
- [ ] All package details display correctly
- [ ] No errors or missing data
- [ ] Can proceed to booking

---

### Step 4: Draft Package Invisibility Test

**As Artist:**
1. Create another test package
2. Keep status as "DRAFT" (do NOT mark active)
3. Upload cover image
4. Save

**As Customer (private window):**
1. Refresh Photography & Videography page
2. Search for the draft package

**Expected Result:**
- Draft package does NOT appear in listing
- Only active package is visible
- No way to access draft package details
- RLS policies block visibility

**Verification Checkpoint:**
- [ ] Draft package not visible to customer
- [ ] Only active packages appear
- [ ] Security verified - RLS policies work

---

## PHASE 5: Customer Booking Flow

### Step 1: Select Package

1. As customer, click on active test package
2. Click "Book Now" or "Select Package"

### Step 2: Complete Booking

1. Fill in booking details:
   - Event Date
   - Event Location
   - Event Type
   - Special Requests
2. Review pricing
3. Proceed to payment

### Step 3: Complete Payment

1. Enter payment details
2. Process payment (or use test card if available)
3. Confirm booking

**Expected Result:**
- Booking created successfully
- Order confirmation displayed
- Email sent to both artist and customer
- Booking appears on artist dashboard
- Booking appears on customer dashboard

**Verification Checkpoint:**
- [ ] Booking created without errors
- [ ] Both dashboards updated
- [ ] Full flow works end-to-end

---

## SUMMARY VERIFICATION TABLE

| Check | Expected | Status |
|-------|----------|--------|
| Artist can create package | ✅ Yes | [ ] |
| Cover image uploads to Storage | ✅ Yes | [ ] |
| Cover image displays on dashboard | ✅ Yes | [ ] |
| Package record in database | ✅ Exists | [ ] |
| Image record in database | ✅ Exists | [ ] |
| public_url populated | ✅ Yes | [ ] |
| is_cover = true | ✅ Yes | [ ] |
| Storage file accessible | ✅ Yes | [ ] |
| Customer SELECT policy exists | ✅ Yes | [ ] |
| Policy allows status='active' only | ✅ Yes | [ ] |
| Images policy blocks draft | ✅ Yes | [ ] |
| Add-ons policy blocks draft | ✅ Yes | [ ] |
| Customer sees active package | ✅ Yes | [ ] |
| Customer sees cover image | ✅ Yes | [ ] |
| Customer cannot see draft package | ✅ No | [ ] |
| RLS blocks draft visibility | ✅ Yes | [ ] |
| Customer can complete booking | ✅ Yes | [ ] |

---

## RESULT

If all checkboxes are ✅ complete:
- **PASS** - All fixes verified working
- Complete artist → database → customer flow functional
- RLS policies correctly enforcing draft visibility
- Ready for production deployment

If any checkbox is ❌ failed:
- Document the failure
- Check the analysis report
- Verify which fix is missing
- Re-apply fixes if needed

---

## TROUBLESHOOTING

### Issue: Cover image not displaying on artist dashboard
- **Check:** Query #1 - Package record created?
- **Check:** Query #2 - Image record exists with is_cover=true?
- **Check:** Is public_url populated?
- **Check:** Can you access the URL directly in browser?
- **Solution:** Re-read PhotoVideoPackageManager.tsx lines 1077-1082 to verify cover image extraction logic

### Issue: Customer cannot see package
- **Check:** Query #1 - Package status = 'active'?
- **Check:** is_active = true and is_visible = true?
- **Check:** Query #5 - Does photography_videography_customer_select policy exist?
- **Check:** Policy condition includes status = 'active'?
- **Solution:** Apply migration 20261025000000 to recreate missing policy

### Issue: Customer sees draft packages
- **Check:** Query #6 - Images policy condition?
- **Check:** Query #7 - Add-ons policy condition?
- **Check:** Do they include 'draft' in status condition?
- **Solution:** Apply migration 20261025000000 to fix draft visibility

### Issue: Build fails
- **Check:** Run `npm run build` again
- **Check:** Any TypeScript errors?
- **Check:** If errors, verify PhotoVideoPackageManager.tsx syntax
- **Solution:** Refer to code changes section in PHOTOGRAPHY_VIDEOGRAPHY_FIX_ANALYSIS.md

---

## NEXT ACTION

Once all verifications pass:
1. Document timestamp of successful test
2. Generate final report with all checks passed
3. Mark as ready for production
4. Create PR/commit with code changes
5. Deploy code changes to production
6. Apply migration 20261025000000 to production Supabase
7. Re-test in production environment
8. Monitor for any issues

