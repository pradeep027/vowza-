# VOWZA: PERMANENT SELF-BOOKING PREVENTION FIX

## THE PROBLEM

Artists/vendors can still book their own packages across all service categories.

**Expected behavior:** Artist A creates Package A → Artist A should NOT be able to book Package A

**Actual behavior:** Artist A can book Package A (vulnerability)

---

## ROOT CAUSE

The migration `20260918000000_prevent_self_booking.sql` was created but **NEVER APPLIED** to the production Supabase database.

Migration status:
```
Local:  20260918000000
Remote: [empty]
```

The RLS policies that should block self-bookings do not exist in production.

---

## SOLUTION

Apply the RLS policies to ALL 15+ booking tables in production using the SQL file:

**`APPLY_SELF_BOOKING_FIX_NOW.sql`**

This file contains 16 RLS INSERT policies (one per booking table) that enforce:
- `customer_id = auth.uid()` (user is booking for themselves)
- `NOT EXISTS (provider_profiles WHERE id=provider_id AND user_id=auth.uid())` (user doesn't own the vendor profile)

If BOTH conditions pass → booking allowed  
If condition 2 fails → RLS rejects: "new row violates row-level security policy"

---

## STEP 1: APPLY THE SQL

### Option A: Via Supabase Dashboard (RECOMMENDED)

1. **Go to:** https://app.supabase.com/project/vavfeataqwwbpjonknne/sql/new
2. **Open file:** `APPLY_SELF_BOOKING_FIX_NOW.sql`
3. **Copy entire SQL** into the editor
4. **Click "Run"**
5. **Wait for success** - You should see "16 policies created"

### Option B: Via Supabase CLI (if working)

```bash
supabase db push  # Will fail - too many pending migrations
```

Instead, manually execute specific SQL in the dashboard.

---

## STEP 2: VERIFY THE FIX

Run this SQL query to confirm all 16 RLS policies were created:

```sql
SELECT 
  tablename, 
  policyname, 
  cmd,
  qual
FROM pg_policies 
WHERE tablename LIKE '%_bookings' 
  AND policyname LIKE '%customer_insert%'
ORDER BY tablename;
```

**Expected output:** 16 rows showing all booking tables with `customer_insert` policies

Each policy's `qual` column should contain:
```
customer_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM provider_profiles WHERE id = provider_id AND user_id = auth.uid())
```

---

## STEP 3: TEST WITH REAL ARTIST ACCOUNT

### Test Case 1: Artist booking own package (should FAIL)

1. Log in as Artist A
2. Note Artist A's auth.uid() and provider_profiles.id
3. Create a catering package as Artist A
4. Try to book that package as Artist A
5. **Expected:** Error message "new row violates row-level security policy"

### Test Case 2: Artist booking another artist's package (should SUCCEED)

1. Log in as Artist A
2. Find a package created by Artist B
3. Attempt to book Artist B's package
4. **Expected:** Booking succeeds

### Test Case 3: Normal customer booking (should SUCCEED)

1. Log in as a normal customer (not an artist)
2. Book any package
3. **Expected:** Booking succeeds

---

## AFFECTED BOOKING TABLES

All 15+ service categories are protected:

1. **catering_bookings**
2. **photography_package_bookings** (uses `photographer_id` column)
3. **dj_bookings**
4. **videography_bookings**
5. **drone_bookings**
6. **decorator_bookings**
7. **makeup_bookings**
8. **mehendi_bookings**
9. **band_bookings**
10. **dancer_bookings**
11. **singer_bookings**
12. **priest_bookings**
13. **water_bookings**
14. **rental_bookings**
15. **banquet_bookings**
16. **anchor_bookings**

---

## TECHNICAL DETAILS

### Database Ownership Chain

```
auth.users.id (authentication)
    ↓ [FOREIGN KEY]
provider_profiles.user_id (vendor identity)
    ↓ [artist owns this provider profile]
provider_profiles.id (vendor ID, unique per artist)
    ↓ [FOREIGN KEY]
[category]_packages.provider_id (package owner)
    ↓ [customer selects package]
[category]_bookings.package_id (booking links to package)
    ↓ [booking references vendor]
[category]_bookings.provider_id (copied from package at booking time)
```

### RLS Policy Logic

When Artist A attempts to INSERT a booking for their own package:

```sql
WITH CHECK (
    customer_id = auth.uid()  -- ✓ TRUE (booking for self)
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id  -- Provider ID is from package
      AND user_id = auth.uid()  -- ✗ FALSE (Artist A owns this provider)
    )
)
-- Overall: TRUE AND FALSE = FALSE → INSERT REJECTED
```

When Artist A attempts to INSERT a booking for Artist B's package:

```sql
WITH CHECK (
    customer_id = auth.uid()  -- ✓ TRUE (booking for self)
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id  -- Provider ID is from Artist B's package
      AND user_id = auth.uid()  -- ✓ TRUE (Artist A doesn't own this)
    )
)
-- Overall: TRUE AND TRUE = TRUE → INSERT ALLOWED
```

---

## WHAT HAPPENS IF VENDOR TRIES TO BYPASS

### Frontend Manipulation

If an artist manually changes the package ID or tries to call the booking API directly with cURL/Postman:

```bash
curl -X POST https://supabase.co/rest/v1/catering_bookings \
  -H "Authorization: Bearer TOKEN" \
  -d '{"package_id":"victim-pkg","provider_id":"victim-id","customer_id":"attacker-id"}'
```

**Result:** RLS policy rejection - "new row violates row-level security policy"

### Database Manipulation

If an artist somehow got direct database access and tried INSERT without going through Supabase:

**Result:** PostgreSQL POLICY violation - same rejection

### Mobile App / Alternative Client

If using Supabase SDKs on mobile or web:

```typescript
const { error } = await supabase
  .from('catering_bookings')
  .insert({...})  // Even if provider_id is manually set
// Returns error: "new row violates row-level security policy"
```

**Result:** RLS policy enforces - cannot be bypassed

---

## FRONTEND GUARDS (OPTIONAL UX IMPROVEMENT)

In addition to backend RLS, we've added frontend guards to improve UX:

- **CateringCartPage.tsx**: Shows "You cannot book your own package" before attempting
- Should be added to all other booking menus for consistency

Frontend guards are NOT security - they're UX. Backend RLS is the security.

---

## TIMELINE

- **2026-09-18**: Migration `20260918000000_prevent_self_booking.sql` created
- **2026-09-18**: Committed to GitHub, deployed to Vercel
- **PRESENT**: RLS policies NOT yet applied to production database
- **NOW**: Applying RLS policies using dashboard SQL editor

---

## WHAT'S NOT CHANGING

This fix ONLY adds self-booking prevention. It does NOT change:

✓ Authentication  
✓ Google Sign-In  
✓ Package creation  
✓ Package editing  
✓ Artist registration  
✓ Normal booking workflow  
✓ Payments  
✓ Reviews  
✓ Planner  
✓ Vendor search  

Only the specific RLS policy for booking INSERT is added.

---

## QUESTIONS?

If booking still fails after applying these policies, check:

1. **Are the policies created?** Run the verification query above
2. **Is the vendor's provider_profiles record linked to their auth.uid()?** Query provider_profiles table
3. **Is the package ownership set correctly?** Check package's provider_id column
4. **What's the exact error message?** Should be "new row violates row-level security policy"

---

## FILES

- **APPLY_SELF_BOOKING_FIX_NOW.sql** - The SQL to execute (this file)
- **supabase/migrations/20260918000000_prevent_self_booking.sql** - Original migration (for reference)
- **src/utils/bookingGuard.ts** - Frontend guard utility
- **src/hooks/useCanBookPackage.ts** - Frontend hook to check if booking allowed

