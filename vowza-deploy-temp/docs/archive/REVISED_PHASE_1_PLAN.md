# REVISED PHASE 1 IMPLEMENTATION PLAN - VOWZA PLANNER AI FIX

**Status:** AWAITING USER APPROVAL - DO NOT IMPLEMENT YET

---

## EXECUTIVE SUMMARY

**Scope:** Fix 5 critical bugs preventing reliable event planning & vendor search
**Changes:** 4 TypeScript files modified, 1 SQL migration update (NO new columns needed)
**Duration:** Estimated 3-4 hours implementation + 2-3 hours testing
**Risk Level:** MEDIUM - RPC signature change requires codebase search for ALL callers
**Breaking Changes:** CONTROLLED - RPC signature changes from 5→6 parameters (internal migration only)

**Key Principle:** Keep event-planning context SEPARATE from vendor-search requirements.

---

## DATABASE SCHEMA ANALYSIS (EXISTING)

### profiles table (USER LOCATION DATA)
✓ city TEXT - Vendor's profile city (e.g., "Hyderabad")
✓ area TEXT - Vendor's exact area (e.g., "Beramguda")
✓ state TEXT - Vendor's state (e.g., "Telangana")
✓ address TEXT - Vendor's free-text address (NOT USED in Phase 1)
✓ These fields already exist and are properly joined to provider_profiles via user_id

### provider_profiles table (VENDOR SERVICE DATA)
✓ service_areas TEXT[] DEFAULT '{}' - Explicitly declared areas vendor serves
✓ service_radius INTEGER DEFAULT 50 - Metadata ONLY (Phase 1); no geographic calculation
✓ These fields already exist

### booking_locations table
✓ latitude, longitude - Represent EVENT/BOOKING locations, NOT vendor locations
✓ These fields are for events, not vendor home/business locations

**CRITICAL CONSTRAINT - NO TRUE GEOGRAPHIC SEARCH IN PHASE 1:**
- There is currently NO reliable vendor latitude/longitude source in the schema
- service_radius cannot be used for true geographic radius search without vendor coordinates
- booking_locations.latitude/longitude = event locations, NOT vendor locations
- Therefore: NO distance calculation, NO radius search, NO geographic proximity claims

**DECISION:** NO new columns needed. Use existing location fields in profiles table.
Phase 1 uses only: profiles.city, profiles.area, provider_profiles.service_areas
District/address filtering deferred (Phase 2+)

---

## CLARIFICATIONS (REQUIRED FOR CORRECTNESS)

### CLARIFICATION #1: LOCATION SEARCH - EXACT CAPABILITIES & LIMITATIONS

**Phase 1 Search Capabilities:**

1. **Exact Area Match (Priority 0 - HIGHEST)**
   - Source: profiles.area
   - Search: LOWER(profiles.area) LIKE LOWER('%{area}%')
   - Returns: Vendors where profiles.area contains requested area
   - Label: "Based in {area}"

2. **Service Area Match (Priority 1)**
   - Source: provider_profiles.service_areas (TEXT[] array, normalized)
   - Search: UNNEST + LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
   - Returns: Vendors who explicitly registered this area
   - Label: "Serves {area}"

3. **City Match (When No Area Specified)**
   - Source: profiles.city
   - Search: LOWER(profiles.city) LIKE LOWER('%{city}%')
   - Returns: Vendors matching city
   - Label: "Available in {city}"

4. **NO City Fallback When Area Specified**
   - WHERE clause: `(p_area IS NULL OR area_match OR service_areas_match)`
   - This means: when p_area is supplied, ONLY area/service-area vendors return
   - City-only vendors are EXCLUDED by design

**NOT Implemented in Phase 1:**
- ❌ District filtering (deferred - needs normalization)
- ❌ Address filtering (deferred - needs fuzzy matching)
- ❌ Geographic radius/nearby (no vendor lat/long available)

**User Language Interpretation:**
- "DJ in Beramguda" → area search (Beramguda exact/service areas only)
- "DJ near Beramguda" → SAME as above (interpret "near" as location intent, not distance)
- "DJ in Hyderabad" → city search
- Labels NEVER claim: "nearby", "within X km", "within service radius"

---

### CLARIFICATION #2: SERVICE AREA NORMALIZATION - EXACT SQL LOGIC

**Problem:** Raw array comparison fails on case/whitespace differences.

**Input Examples That Must All Match:**
- User says: "Beramguda"
- Database has: "beramguda" OR "BERAMGUDA" OR "  Beramguda  "

**Solution: UNNEST + Normalize Both Sides**

```sql
EXISTS (
  SELECT 1 FROM UNNEST(pp.service_areas) AS sa
  WHERE LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
)
```

**How It Works:**
1. UNNEST(pp.service_areas) → Expands array into rows
2. TRIM(sa) → Removes whitespace
3. LOWER(TRIM(sa)) = LOWER(TRIM(p_area)) → Case-insensitive exact match

**In search_vendors_sql WHERE Clause:**

```sql
AND (p_area IS NULL OR 
  LOWER(COALESCE(pr.area, '')) LIKE LOWER('%' || p_area || '%')
  OR
  EXISTS (
    SELECT 1 FROM UNNEST(pp.service_areas) AS sa
    WHERE LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
  )
)
```

---

### CLARIFICATION #3: RESULT LABELING - EXPLICIT MATCH TYPE DISTINCTION

**Result Labels (ONLY Use These):**

1. **Exact Area Match**
   - Label: "Based in {area}"
   - Use when: profiles.area matched
   - Example: "John's Photography - Based in Beramguda, 4.8★"

2. **Service Area Match**
   - Label: "Serves {area}"
   - Use when: service_areas array matched (normalized)
   - Example: "Event Decor Pro - Serves Beramguda, Banjara Hills"

3. **City Match**
   - Label: "Available in {city}"
   - Use when: profiles.city matched (and NO area search)
   - Example: "Best Caterers - Available in Hyderabad"

**FORBIDDEN LABELS IN PHASE 1:**
- ✗ "Near {area}" (no vendor coordinates)
- ✗ "Within X km" (no lat/long)
- ✗ "Within service radius" (metadata only)
- ✗ City fallback results when searching for area

**Example - Correct Area Search Response:**

```
User: "Find photographers in Beramguda"

Response:
"I found 2 photographers:
1. John's Photography - Based in Beramguda, 4.8★
2. Candid Moments - Serves Beramguda, 4.5★"

If no results:
"I didn't find any photographers in Beramguda.
Would you like me to search in Hyderabad instead?"
```

---

### CLARIFICATION #4: DISTRICT & ADDRESS - INTENTIONALLY DEFERRED

**Phase 1 Decision: District and Address Filtering NOT Implemented**

**Why Deferred:**

1. **District (profiles.district)**
   - Field exists but no normalization strategy
   - Problem: "Telangana" vs "TS" vs "Andhra Pradesh" format unclear
   - Defer to: Phase 2+ (after normalization rules)

2. **Address (profiles.address)**
   - Free-text field; requires fuzzy matching
   - Problem: "Beramguda" vs "H.No 123, Beramguda" vs "Sector 4, Beramguda"
   - Defer to: Phase 3+ (after address standardization)

**What IS Available in Phase 1:**
- ✓ profiles.city
- ✓ profiles.area
- ✓ provider_profiles.service_areas

**Planner WILL NOT Claim:**
- ❌ "District-level filtering"
- ❌ "Address-based search"
- ❌ "Specific sub-area precision"

---

### CLARIFICATION #5: match_vendors ARCHITECTURE SAFETY

**Current match_vendors Function:**
```sql
CREATE OR REPLACE FUNCTION public.match_vendors(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5,
  filter_profession TEXT DEFAULT NULL,
  filter_city TEXT DEFAULT NULL,
  filter_price_max NUMERIC DEFAULT NULL
)
```

**Why This Is Safe - NO CHANGES NEEDED:**

**Path Separation:**
- match_vendors: SEMANTIC/RAG path (embedding similarity)
- search_vendors_sql: STRUCTURED path (exact SQL filters)
- These paths DO NOT cross

**Architecture Guarantee:**

In ragRetriever.ts:
```typescript
// Only ONE path per request
if (structuredFiltersPresent) {
  // Use ONLY search_vendors_sql (structured filters applied)
} else {
  // Use ONLY match_vendors (semantic search)
}
```

When user says "5-star DJ in Beramguda":
- Triggers: profession=dj, area=Beramguda, minRating=5.0
- Path taken: search_vendors_sql ONLY
- match_vendors is NEVER called
- Therefore, match_vendors filters don't need updating

**Future Update:** When semantic search is re-enabled, match_vendors will also receive p_area parameter. NOT in Phase 1.

**Documentation to Add:**

```typescript
// ARCHITECTURE SAFETY: Path Selection
// This function uses ONLY ONE path per request:
// 
// 1. If structured filters present (profession, city, budget, rating, area):
//    → Use search_vendors_sql RPC (applies SQL filters + verification)
//    → NEVER uses match_vendors
//
// 2. If NO structured filters AND semantic search enabled:
//    → Use match_vendors (embedding similarity, also enforces verification)
//
// Separation guarantees structured requirements are ALWAYS honored.
```

---

### CLARIFICATION #6: RISKS & REGRESSIONS - ACCURATE ASSESSMENT

**Status:** No known breaking changes identified. Implementation MUST pass ALL specified unit, integration, database, and regression tests before completion.

**Potential Risks & Mitigations:**

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| RPC signature change breaks callers | Medium | Critical | REQUIRED: grep entire codebase for search_vendors_sql before migration |
| Fallback query returns unfiltered vendors | Medium | Critical | FALLBACK MUST enforce verification_status, area filtering, two-tier ranking |
| Fallback causes city-level bloat when area specified | Medium | High | Fallback returns empty when area specified but no matches (fail closed) |
| extractLocality() regex extracts wrong text | Medium | High | Comprehensive unit tests (10+ edge cases) |
| is_verified hardcoded TRUE returns falsely verified | Low | Critical | SQL: use COALESCE(pp.is_verified, FALSE), tests verify actual value |
| Service area normalization too strict/loose | Medium | Medium | Test uppercase/lowercase/whitespace variations |
| Multi-turn context loss | Low | Medium | Guard with `!currentContext.locality` |
| Geographic proximity claimed without coordinates | High | Critical | NO "nearby", "within X km", "service radius" in labels |
| District/Address claims when not implemented | Medium | High | Documentation forbids; response templates guard |

**Pre-Release Checklist:**
- ✓ Codebase searched: ALL search_vendors_sql callers identified
- ✓ All TypeScript files modified (4 total)
- ✓ SQL migration applied
- ✓ Unit tests passing (100%)
- ✓ Integration tests passing (100%)
- ✓ Regression tests passing (100%)
- ✓ No geographic proximity claims in responses
- ✓ is_verified returns actual database value
- ✓ No city fallback when area specified
- ✓ Service area normalization tested
- ✓ Multi-turn context preserved

---

## CRITICAL BUGS TO FIX

### BUG #1: Event Classification - Haldi/Mehendi/Sangeet Grouped as "Engagement"
**File:** src/lib/eventContextCapturer.ts (line 291)
**Current:** Haldi, Mehendi, Sangeet mixed with engagement
**Fix:** Separate into distinct patterns
**Lines Changed:** 3-4

---

### BUG #2: 5-Star Rating Extracted as 4.0, Not 5.0
**Files:** src/lib/ragRetriever.ts (line 289), src/lib/aiOrchestrator.ts (line 542)
**Current:** Boolean match sets all to 4.0
**Fix:** Use extractMinimumRating() function
**Lines Changed:** 2

---

### BUG #3: Vendor Search Blocked by Event Planning Context Check
**File:** src/lib/llm.ts (line 358-360)
**Current:** Requires ALL 4 essentials even for vendor search
**Fix:** Intent-aware readiness check; skip for vendor search
**Lines Changed:** 8-10

---

### BUG #4: Location Search Fails for Localities
**File:** src/lib/aiOrchestrator.ts (line 125+)
**Current:** Only extracts CITY_LIST cities; misses Beramguda
**Fix:** Add extractLocality() function
**Lines Changed:** ~25 (new function)

---

### BUG #5: Profiles.area Column Ignored in Vendor Search RPC
**File:** supabase/migrations/20260917000000_harden_planner_vendor_search.sql
**Current:** Only filters on city
**Fix:** Add area filtering + service-area normalization + two-tier ranking
**Lines Changed:** ~60 (complete RPC)

---

## FALLBACK PATH ANALYSIS - CRITICAL ISSUE IDENTIFIED

**Current Behavior - DANGEROUS:**

In ragRetriever.ts::sqlSearch() (line 246-355), when search_vendors_sql RPC fails or returns empty:

```typescript
// FALLBACK: Direct table query if RPC fails or returns empty
let q = supabase
  .from('provider_profiles')
  .select(...)
  .eq('is_published', true)
  .eq('is_verified', true)
  // MISSING: verification_status check
  // MISSING: area filtering
  // MISSING: service_areas normalization
  // MISSING: two-tier ranking
  .order('average_rating', { ascending: false })
  .limit(limit);

if (profession) {
  q = q.ilike('profession', `%${profession}%`);
}
if (priceMax) q = q.lte('price_min', priceMax);
if (minRating) q = q.gte('average_rating', minRating);

// THEN filters by city AFTER fetching profiles
// But DOES NOT FILTER by area
// So "DJ in Beramguda" could return Hyderabad-only vendors on fallback
```

**PROBLEM:**

When search_vendors_sql fails:
- ❌ verification_status NOT checked (missing `IN ('approved', 'verified')`)
- ❌ area parameter IGNORED completely
- ❌ service_areas normalization NOT applied
- ❌ No two-tier ranking (returns unranked results)
- ❌ City fallback occurs even when area was specified
- ✓ Only is_published and is_verified checked (insufficient)

**IMPACT:**

- User: "DJ in Beramguda"
- If search_vendors_sql fails → returns ANY DJ with is_verified=true, is_published=true
- May return vendors from Hyderabad, Bangalore, etc.
- Violates "NO city fallback when area specified" rule
- Unverified vendors slip through (only is_verified checked, not verification_status)

---

## FILES TO MODIFY

### TypeScript Files (5 total to modify):
1. ✓ src/lib/eventContextCapturer.ts - Fix event patterns (3-4 lines)
2. ✓ src/lib/ragRetriever.ts - Fix rating + add area + new interface + **FIX FALLBACK** (50+ lines)
3. ✓ src/lib/aiOrchestrator.ts - Add locality function + fix rating (30 lines)
4. ✓ src/lib/llm.ts - Intent-aware readiness check (8-10 lines)
5. ⚠️ src/lib/llm.ts - Verify retrieveVendors calls pass area parameter (3-5 lines)

### Reference Files (NO CHANGES):
- N/A src/lib/plannerRecommendation.ts - extractMinimumRating() already correct
- N/A src/lib/aiPlannerTypes.ts - NO CHANGES (vendor search context separate)
- N/A src/lib/conversationRepository.ts - NO CHANGES (automatic JSONB handling)
- ✓ src/lib/eventIntelligenceLLMIntegration.ts - Verify retrieveVendors call (line 92-94) passes area hint
- ✓ src/lib/testVendorRetrieval.ts - Reference only, for testing

### SQL Files (1 total):
1. ✓ supabase/migrations/20260917000000_harden_planner_vendor_search.sql - Add area filter (60 lines)

---

## FALLBACK CORRECTION - ragRetriever.ts::sqlSearch

**NEW FALLBACK STRATEGY:**

The fallback must preserve ALL structured search filters from the RPC call:

```typescript
async function sqlSearch(
  profession?: string,
  city?: string,
  area?: string,           // NEW PARAMETER
  priceMax?: number,
  minRating = 0,
  limit = 8
): Promise<RetrievedVendor[]> {
  
  // Try RPC first
  const { data, error } = await supabase.rpc('search_vendors_sql' as any, {
    p_profession: profession ?? null,
    p_city: city ?? null,
    p_area: area ?? null,           // NEW
    p_price_max: priceMax ?? null,
    p_min_rating: minRating,
    p_limit: limit,
  });

  if (!error && data && data.length > 0) {
    // RPC succeeded - use it
    return /* map data */;
  }

  // FALLBACK: Direct query that preserves ALL filters
  console.warn('[RAG] RPC failed, using fallback direct query:', error?.message);
  
  // Fetch provider_profiles with structured filters
  let q = supabase
    .from('provider_profiles')
    .select('id, profession, stage_name, bio, price_min, price_max, average_rating, total_reviews, total_bookings, is_verified, is_available, experience_years, cover_image_url, user_id')
    // CRITICAL: Enforce verification rules same as RPC
    .in('verification_status', ['approved', 'verified'])  // NEW: Must match RPC
    .eq('is_verified', true)
    .eq('is_published', true)
    .order('average_rating', { ascending: false })
    .limit(limit);

  if (profession) {
    q = q.ilike('profession', `%${profession}%`);
  }
  if (priceMax) {
    q = q.lte('price_min', priceMax);
  }
  if (minRating) {
    q = q.gte('average_rating', minRating);
  }

  const { data: fallback, error: fallbackError } = await q;
  
  if (fallbackError) {
    console.error('[RAG] Fallback query failed:', fallbackError.message);
    // FAIL CLOSED - return empty rather than unfiltered results
    return [];
  }
  
  if (!fallback || fallback.length === 0) {
    console.log('[RAG] No vendors found in fallback');
    return [];
  }

  // Fetch profiles to get city, area, avatar_url
  const userIds = fallback.map((v: any) => v.user_id).filter(Boolean);
  if (!userIds.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, city, area, avatar_url')  // NEW: include area
    .in('id', userIds);

  if (profileError) {
    console.error('[RAG] Failed to fetch profiles:', profileError.message);
    return [];
  }

  const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  // NEW: Filter by area if specified (preserve area-only search)
  // If area was specified, ONLY return area/service_area matches
  let filtered = fallback;
  
  if (area) {
    filtered = fallback.filter((v: any) => {
      const profile = pm.get(v.user_id) ?? {};
      const vendorArea = profile.area ?? '';
      const inServiceAreas = (v.service_areas ?? []).some((sa: string) =>
        sa.toLowerCase().trim() === area.toLowerCase().trim()
      );
      // Match if: exact area OR service_areas contains area
      return vendorArea.toLowerCase().includes(area.toLowerCase()) || inServiceAreas;
    });
    
    if (filtered.length === 0) {
      console.log('[RAG] Fallback: no vendors in specified area', area);
      // FAIL CLOSED: return empty rather than city fallback
      return [];
    }
  } else if (city) {
    // City filter (when area NOT specified)
    filtered = fallback.filter((v: any) => {
      const vendorCity = pm.get(v.user_id)?.city ?? '';
      return vendorCity.toLowerCase().includes(city.toLowerCase());
    });
  }

  // Convert to RetrievedVendor
  return filtered.map((v: any): RetrievedVendor => {
    const p = pm.get(v.user_id) ?? {};
    return {
      provider_id: v.id,
      profession: v.profession,
      stage_name: v.stage_name,
      full_name: (p as any).full_name || v.stage_name,
      bio: v.bio,
      city: (p as any).city,
      area: (p as any).area,         // NEW
      price_min: v.price_min,
      price_max: v.price_max,
      average_rating: v.average_rating ?? 0,
      total_reviews: v.total_reviews ?? 0,
      total_bookings: v.total_bookings ?? 0,
      is_verified: v.is_verified ?? false,
      is_available: v.is_available ?? true,
      experience_years: v.experience_years ?? null,
      cover_image_url: v.cover_image_url ?? null,
      avatar_url: (p as any).avatar_url,
    };
  });
}
```

**Key Changes to Fallback:**

1. ✓ ADD p_area parameter to function signature
2. ✓ ADD verification_status check to fallback (MUST match RPC)
3. ✓ ADD area filtering logic (exact area OR service_areas match)
4. ✓ NEW: Fail CLOSED when area specified but no matches (don't return city fallback)
5. ✓ Preserve minRating, priceMax, profession, city filters
6. ✓ Fetch profiles with area column
7. ✓ Map area to RetrievedVendor output

**Caller Update - retrieveVendors() and llm.ts:**

In retrieveVendors() at line 569:

```typescript
// Before:
allVendors = await sqlSearch(profession, city, priceMax, minRating, limit);

// After:
const area = criteria.area;  // from extractPlannerSearchCriteria
allVendors = await sqlSearch(profession, city, area, priceMax, minRating, limit);
```

In llm.ts calls (lines 306, 528, 570, 644):

Before:
```typescript
const ragResult = await retrieveVendors(message, updatedContext, 8, {
  professions: orch.professions,
  city: orch.city ?? undefined,
  priceMax: hints?.priceMax ?? undefined,
  minRating: hints?.minRating ?? undefined,
});
```

After - ADD area hint:
```typescript
const ragResult = await retrieveVendors(message, updatedContext, 8, {
  professions: orch.professions,
  city: orch.city ?? undefined,
  area: orch.area ?? undefined,       // NEW
  priceMax: hints?.priceMax ?? undefined,
  minRating: hints?.minRating ?? undefined,
});
```

---

### New Types/Interfaces:
1. VendorSearchContext (in ragRetriever.ts) - 8 lines, Phase 1 only

---

## SQL MIGRATION - COMPLETE RPC DEFINITION

### File: supabase/migrations/20260917000000_harden_planner_vendor_search.sql

#### REQUIRED PRE-IMPLEMENTATION CHECKLIST:

**STEP 1: Search Entire Codebase**

```bash
grep -r "search_vendors_sql" --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.js"
```

Expected result: ragRetriever.ts ONLY

If OTHER files reference search_vendors_sql:
- DO NOT proceed with migration
- Update ALL callers first
- Re-verify only ragRetriever.ts remains

**STEP 2: Verify Existing Function**

```sql
SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
WHERE p.proname = 'search_vendors_sql';
```

Note the current signature and ensure it matches the old 5-parameter signature.

#### Migration Steps:

**Step 1: DROP old function**

```sql
DROP FUNCTION IF EXISTS public.search_vendors_sql(
  TEXT, TEXT, NUMERIC, DOUBLE PRECISION, INTEGER
);
```

**Step 2: CREATE new function with p_area parameter, service-area normalization, and two-tier ranking**

```sql
CREATE OR REPLACE FUNCTION public.search_vendors_sql(
  p_profession TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_min_rating FLOAT DEFAULT 0,
  p_area TEXT DEFAULT NULL,              -- NEW PARAMETER (before p_limit)
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  provider_id UUID,
  profession TEXT,
  stage_name TEXT,
  bio TEXT,
  price_min NUMERIC,
  price_max NUMERIC,
  average_rating FLOAT,
  total_reviews INT,
  total_bookings INT,
  is_verified BOOLEAN,                   -- ACTUAL value, not TRUE
  is_available BOOLEAN,
  experience_years INT,
  cover_image_url TEXT,
  city TEXT,
  area TEXT,                             -- NEW OUTPUT
  full_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id,
    pp.profession::TEXT,
    pp.stage_name::TEXT,
    pp.bio::TEXT,
    pp.price_min::NUMERIC,
    pp.price_max::NUMERIC,
    COALESCE(pp.average_rating, 0)::FLOAT,
    COALESCE(pp.total_reviews, 0)::INT,
    COALESCE(pp.total_bookings, 0)::INT,
    COALESCE(pp.is_verified, FALSE)::BOOLEAN,  -- ACTUAL value, NOT TRUE
    COALESCE(pp.is_available, TRUE)::BOOLEAN,
    pp.experience_years::INT,
    pp.cover_image_url::TEXT,
    pr.city::TEXT,
    pr.area::TEXT,                        -- NEW OUTPUT
    pr.full_name::TEXT,
    pr.avatar_url::TEXT
  FROM public.provider_profiles pp
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE pp.verification_status IN ('approved', 'verified')
    AND COALESCE(pp.is_verified, FALSE) = TRUE
    AND COALESCE(pp.is_published, FALSE) = TRUE
    AND (p_profession IS NULL OR pp.profession::TEXT = p_profession)
    AND (p_city IS NULL OR LOWER(COALESCE(pr.city, '')) LIKE LOWER('%' || p_city || '%'))
    -- NEW: Area filtering with service-areas normalization
    AND (p_area IS NULL OR 
      LOWER(COALESCE(pr.area, '')) LIKE LOWER('%' || p_area || '%')
      OR
      EXISTS (
        SELECT 1 FROM UNNEST(pp.service_areas) AS sa
        WHERE LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
      )
    )
    AND (p_price_max IS NULL OR pp.price_min IS NULL OR pp.price_min <= p_price_max)
    AND COALESCE(pp.average_rating, 0) >= p_min_rating
  ORDER BY 
    -- TWO-TIER LOCATION RANKING (no city fallback when area specified)
    CASE 
      WHEN LOWER(COALESCE(pr.area, '')) LIKE LOWER('%' || p_area || '%') THEN 0
      WHEN EXISTS (
        SELECT 1 FROM UNNEST(pp.service_areas) AS sa
        WHERE LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
      ) THEN 1
    END,
    COALESCE(pp.average_rating, 0) DESC,
    COALESCE(pp.total_bookings, 0) DESC
  LIMIT p_limit;
END;
$$;

-- Ensure permissions
GRANT EXECUTE ON FUNCTION public.search_vendors_sql TO authenticated, anon;
```

#### TypeScript Caller Update (ragRetriever.ts::sqlSearch)

**Before:**
```typescript
const { data, error } = await supabase.rpc('search_vendors_sql', {
  p_profession: profession ?? null,
  p_city: city ?? null,
  p_price_max: priceMax ?? null,
  p_min_rating: minRating,
  p_limit: limit,
});
```

**After:**
```typescript
const { data, error } = await supabase.rpc('search_vendors_sql', {
  p_profession: profession ?? null,
  p_city: city ?? null,
  p_price_max: priceMax ?? null,
  p_min_rating: minRating,
  p_area: area ?? null,        -- NEW
  p_limit: limit,
});
```

#### RPC Testing Requirements (Must Pass Before Release)

1. **Backward Compat (area = NULL):**
   - Should return vendors as before (city search unchanged)

2. **Area Exact Match:**
   - Should return ONLY vendors with profiles.area containing area
   - Ranked: profiles.area first

3. **Service Areas Match:**
   - Should return vendors with service_areas containing area (normalized)
   - Ranked: exact area first (CASE 0), service areas second (CASE 1)

4. **is_verified Must Be Actual Value:**
   - Verify is_verified = actual pp.is_verified, not hardcoded TRUE

5. **No City Fallback When Area Specified:**
   - All returned vendors should have area OR service_areas match
   - NO vendors should appear with city match only

6. **Verification Filtering:**
   - Unverified, unpublished, unapproved vendors MUST NOT appear

---

## NEW TYPES/INTERFACES

### VendorSearchContext (ragRetriever.ts) - PHASE 1 ONLY

```typescript
export interface VendorSearchContext {
  profession?: string;           // 'photographer', 'dj', 'caterer', etc.
  city?: string;                 // From profiles.city (supported)
  area?: string;                 // From profiles.area or extracted locality (supported)
  minimumRating?: number;        // 4.0, 4.5, 5.0, etc.
  serviceBudget?: number;        // Vendor service price budget (optional)
  locationIntent?: "city" | "area" | "service_area";  // How user specified location
}
```

**Explicitly NOT in Phase 1 (Deferred):**
- district (requires normalization)
- address (requires fuzzy matching)
- serviceRadius (metadata only, not calculated)
- nearbySearch (no vendor coordinates for distance)

---

## TEST PLAN

### Unit Tests

**1. eventContextCapturer.ts**
```
✓ extractEventTypeFromText("haldi ceremony") → "haldi" (NOT "engagement")
✓ extractEventTypeFromText("mehendi artist") → "mehendi"
✓ extractEventTypeFromText("sangeet performance") → "sangeet"
✓ extractEventTypeFromText("engagement party") → "engagement"
```

**2. plannerRecommendation.ts**
```
✓ extractMinimumRating("5-star") → 5.0 (NOT 4.0)
✓ extractMinimumRating("4.5 stars") → 4.5
✓ extractMinimumRating("4+ stars") → 4.0
```

**3. ragRetriever.ts**
```
✓ VendorSearchContext interface compiles
✓ sqlSearch() passes p_area parameter
```

**4. aiOrchestrator.ts**
```
✓ extractLocality("Find DJ in Beramguda") → "Beramguda"
✓ extractLocality("near Banjara Hills") → "Banjara Hills"
```

**5. llm.ts**
```
✓ find_vendors intent skips readiness check
✓ plan_event intent keeps readiness check
```

### Integration Tests

**Multi-Turn Context:**
```
"18th birthday" → vendor search → "5-star caterer in Beramguda"
✓ Birthday context retained
✓ Birthday NOT converted to wedding
✓ Beramguda area search works
```

**Location Search - NO CITY FALLBACK:**
```
"Find DJ in Beramguda"
  → Returns ONLY: profiles.area matches + service_areas matches
  → Labels: "Based in Beramguda" or "Serves Beramguda"
  → NO vendors with just city="Hyderabad"

"Find DJ near Beramguda"
  → Same as above (interpret "near" as location, not distance)

"DJs in Hyderabad" (no area)
  → Returns: city matches
  → Label: "Available in Hyderabad"
```

**Vendor Filtering:**
```
✓ Unpublished vendors excluded
✓ Unverified vendors excluded
✓ Unapproved vendors excluded
✓ is_verified returns ACTUAL value
✓ 5-star requirement enforced
```

### Regression Tests
```
✓ Existing vendor searches work (area = NULL)
✓ Existing event planning works
✓ Budget extraction unchanged
✓ City extraction unchanged
✓ Conversation history preserved
✓ All existing event types recognized
✓ Fallback query preserves area filter (forces RPC failure, verifies area-only results)
✓ Fallback query enforces verification_status (forces RPC failure, verifies unverified excluded)
✓ No city fallback in fallback query when area specified
✓ Fallback returns empty (fail closed) when area specified but no matches
```

### FALLBACK-SPECIFIC REGRESSION TEST

**Test Case: Fallback Preserves Structured Filters**

```typescript
// Setup: Assume RPC search_vendors_sql will fail (e.g., network error)
// Manually trigger: Mock Supabase RPC to fail

Given: "5-star DJs in Beramguda"
  Parsed: profession=dj, area=Beramguda, minRating=5.0

When: search_vendors_sql RPC fails
Then: Fallback query should:
  ✓ Return ONLY vendors with area=Beramguda OR service_areas contains Beramguda
  ✓ NOT return generic Hyderabad DJs
  ✓ Enforce minRating >= 5.0
  ✓ Enforce verification_status IN ('approved', 'verified')
  ✓ Enforce is_verified=true
  ✓ Enforce is_published=true
  ✓ Return empty if no Beramguda vendors exist (fail closed)

Alternative: "Photographers in Hyderabad" (city search)
  ✓ Fallback returns city matches (area=NULL)
  ✓ Verification filters still enforced

Alternative: "Photographers" (no location specified)
  ✓ Fallback returns published+verified photographers
  ✓ Sorted by rating, limited to N results
```

---

---

---

## IMPLEMENTATION SEQUENCE

### Phase 1A - Bug Fixes (1-2 hours):
1. Fix event patterns in eventContextCapturer.ts (haldi/mehendi/sangeet)
2. Fix rating extraction in ragRetriever.ts (use extractMinimumRating)
3. Fix rating extraction in aiOrchestrator.ts (use extractMinimumRating)
4. Add extractLocality() function to aiOrchestrator.ts
5. Update extractContextUpdates() to call extractLocality()

### Phase 1B - Vendor Search Context & Fallback (1.5 hours):
6. Add p_area parameter to ragRetriever.ts::sqlSearch() signature
7. Add VendorSearchContext interface to ragRetriever.ts
8. **CRITICAL: Fix fallback query in sqlSearch()** - add verification_status check + area filtering + fail closed
9. Update retrieveVendors() to pass area to sqlSearch()
10. Update llm.ts retrieveVendors() calls (4 locations) to pass area hint

### Phase 1C - Readiness & Intent Check (30 min):
11. Restructure readiness check in llm.ts (intent-aware)
12. Move orchestrate() call before readiness check

### Phase 1D - RPC Enhancement (30 min):
13. Update search_vendors_sql RPC (add p_area parameter, service-area normalization, two-tier ranking)
14. Ensure RPC verification_status/is_verified/is_published logic matches fallback

### Phase 1E - Testing & Verification (2-3 hours):
15. Write unit tests (event classification, rating extraction, locality extraction)
16. Run integration tests (multi-turn, location search, no city fallback)
17. **CRITICAL: Run fallback regression tests** (force RPC failure, verify fallback preserves filters)
18. Run all regression tests (existing functionality unchanged)
19. Manual QA with test cases

---

## SUCCESS CRITERIA

After Phase 1, these must work:

**Event Classification:**
- ✓ "haldi" → eventType="haldi" (NOT "engagement")
- ✓ "mehendi" → eventType="mehendi"
- ✓ "sangeet" → eventType="sangeet"
- ✓ "18th birthday" → eventType="birthday" (NOT "wedding")

**Rating Extraction:**
- ✓ "5-star photographers" → minRating=5.0 (NOT 4.0)
- ✓ "4.5+ star DJ" → minRating=4.5

**Vendor Search Without Full Context:**
- ✓ "Find DJs" works without budget/guests
- ✓ "Show photographers" works without event type

**Location Search (NO CITY FALLBACK):**
- ✓ "DJ in Beramguda" → area search only (exact/service-area)
- ✓ "DJ near Beramguda" → same as above
- ✓ "Photographer in Hyderabad" → city search

**Multi-Turn Context:**
- ✓ "18th birthday" → birthday retained (not converted to wedding)

**Data Integrity:**
- ✓ No fabricated vendor data
- ✓ is_verified returns actual database value
- ✓ No geographic proximity claims without coordinates
- ✓ All existing functionality preserved

---

## NEXT STEPS

**AWAITING USER APPROVAL**

After approval, implementation will:
1. Modify 4 TypeScript files
2. Update SQL migration (with full codebase search first)
3. Write and run all tests
4. Verify all success criteria met
5. Prepare Phase 1 completion report

---

