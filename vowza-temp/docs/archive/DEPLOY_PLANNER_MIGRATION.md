# DEPLOY PLANNER VENDOR-SEARCH MIGRATION

## ⚠️ IMPORTANT

The SQL migration `20260917000000_harden_planner_vendor_search.sql` is ready to deploy to Supabase, but **I cannot apply it programmatically without your Supabase service role key**.

To protect your database credentials, you must deploy this migration manually via the Supabase Dashboard.

---

## STEP 1: Get Your Service Role Key (One-Time Setup)

1. Go to **https://app.supabase.com**
2. Log in with your account
3. Select project: **vavfeataqwwbpjonknne**
4. Go to: **Settings** → **API** (left sidebar)
5. Copy the **"service_role" key** (labeled "Service role secret")
6. Add to your `.env` file:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<paste your key here>
   ```
7. Save the file (do NOT commit to Git)

---

## STEP 2: Deploy Via Supabase Dashboard (Recommended)

### Quick Method:

1. Open **https://app.supabase.com**
2. Select project: **vavfeataqwwbpjonknne**
3. Go to: **SQL Editor** (in left sidebar)
4. Click: **"New Query"**
5. Open the file: `supabase/migrations/20260917000000_harden_planner_vendor_search.sql`
6. Copy ALL the SQL code
7. Paste into the Supabase SQL Editor
8. Click: **"Run"** button (or Cmd+Enter)
9. Wait for completion ✅

**Expected Result:**
- ✅ Green success message
- ✅ Function created/replaced
- ✅ Permissions granted

---

## STEP 3: Verify Migration Applied

### Check 1: Function Exists

In Supabase **SQL Editor**, run:
```sql
SELECT 
  proname AS function_name,
  pronargs AS param_count,
  pronamespace::regnamespace AS schema
FROM pg_proc
WHERE proname = 'search_vendors_sql';
```

**Expected Output:**
- `function_name`: `search_vendors_sql`
- `param_count`: `6` (new signature has 6 parameters)
- `schema`: `public`

### Check 2: Function Signature

Run:
```sql
SELECT pg_get_functiondef('public.search_vendors_sql'::regprocedure);
```

**Expected Output:** Should include:
- `p_profession TEXT DEFAULT NULL`
- `p_city TEXT DEFAULT NULL`
- `p_price_max NUMERIC DEFAULT NULL`
- `p_min_rating FLOAT DEFAULT 0`
- `p_area TEXT DEFAULT NULL` ← NEW
- `p_limit INT DEFAULT 10`

### Check 3: Return Columns

Run:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'search_vendors_sql'
ORDER BY ordinal_position;
```

**Expected to include:**
- `provider_id`
- `profession`
- `stage_name`
- `bio`
- `price_min`
- `price_max`
- `average_rating`
- `total_reviews`
- `total_bookings`
- `is_verified`
- `is_available`
- `experience_years`
- `cover_image_url`
- `city`
- `area` ← NEW
- `full_name`
- `avatar_url`

---

## STEP 4: Check Real Vendor Data

Before running manual tests, verify there are actual vendors in the database:

### Query 1: Verified Vendors Count

```sql
SELECT 
  COUNT(*) as verified_vendors,
  COUNT(DISTINCT pp.user_id) as unique_vendors,
  COUNT(DISTINCT pr.city) as cities_with_vendors,
  COUNT(DISTINCT pr.area) as areas_with_vendors
FROM provider_profiles pp
LEFT JOIN profiles pr ON pr.id = pp.user_id
WHERE pp.verification_status IN ('approved', 'verified')
  AND COALESCE(pp.is_verified, FALSE) = TRUE
  AND COALESCE(pp.is_published, FALSE) = TRUE;
```

**Expected Output:**
- `verified_vendors`: > 0 (should have some vendors)
- `unique_vendors`: ≥ verified_vendors
- `cities_with_vendors`: ≥ 1
- `areas_with_vendors`: ≥ 0 (may be 0 if area field is not populated)

### Query 2: Vendor Service Distribution

```sql
SELECT 
  profession,
  COUNT(*) as vendor_count,
  COUNT(DISTINCT city) as cities_served,
  COUNT(DISTINCT area) as areas_served,
  AVG(average_rating) as avg_rating,
  COUNT(service_areas) as with_service_areas
FROM provider_profiles pp
LEFT JOIN profiles pr ON pr.id = pp.user_id
WHERE pp.verification_status IN ('approved', 'verified')
  AND COALESCE(pp.is_verified, FALSE) = TRUE
  AND COALESCE(pp.is_published, FALSE) = TRUE
GROUP BY profession
ORDER BY vendor_count DESC;
```

**Expected Output:**
- Row for each profession (DJ, Photographer, etc.)
- Cities and areas should be > 0
- Ratings should be between 0 and 5

### Query 3: Area Coverage

```sql
SELECT 
  pr.area,
  COUNT(*) as vendor_count,
  COUNT(DISTINCT pp.profession) as professions,
  ROUND(AVG(pp.average_rating)::numeric, 1) as avg_rating
FROM provider_profiles pp
LEFT JOIN profiles pr ON pr.id = pp.user_id
WHERE pp.verification_status IN ('approved', 'verified')
  AND COALESCE(pp.is_verified, FALSE) = TRUE
  AND COALESCE(pp.is_published, FALSE) = TRUE
  AND pr.area IS NOT NULL
GROUP BY pr.area
ORDER BY vendor_count DESC;
```

**Expected Output:**
- List of areas (Beramguda, Jubilee Hills, etc.)
- Vendor count per area
- Average rating per area

---

## STEP 5: Run Manual Tests

Once migration is verified and you confirm real vendor data exists, proceed to manual testing:

See: `PHASE_1_MANUAL_TEST_PLAN.md` for test cases A-I.

---

## TROUBLESHOOTING

### Problem: "Function already exists"

**Solution:**
- The migration includes `CREATE OR REPLACE`, which should update the function
- If you get an error, the old function may have a different signature
- Try dropping the old function first:
  ```sql
  DROP FUNCTION IF EXISTS public.search_vendors_sql(TEXT, TEXT, NUMERIC, FLOAT, INTEGER);
  ```
- Then re-run the migration

### Problem: "Column not found in function results"

**Solution:**
- Verify the function definition includes all 17 return columns
- Run the `SELECT pg_get_functiondef()` check above
- If missing, drop and recreate the function

### Problem: "Permission denied"

**Solution:**
- Ensure you're logged in as a Supabase admin
- Verify your account has SQL Editor access
- Check project settings

### Problem: "Syntax error in SQL"

**Solution:**
- Copy the migration file again carefully
- Ensure all semicolons are present
- Check for any special characters that were corrupted during copy/paste
- Try deploying section by section

---

## NEXT STEPS (After Deployment)

1. ✅ Verify migration applied (checks above)
2. ✅ Check real vendor data exists
3. ✅ Run manual tests A-I
4. ✅ Report results honestly
5. Do NOT push to GitHub yet
6. Do NOT deploy to Vercel yet

---

**Migration Status:** Ready for deployment  
**File:** `supabase/migrations/20260917000000_harden_planner_vendor_search.sql`  
**Size:** ~2.5 KB  
**Statements:** 3 (DROP, CREATE, GRANT)
