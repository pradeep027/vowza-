# Event-Aware Budget Engine: Integration Test Checklist

## Status
- ✅ Core engine implemented: eventAwareBudgetEngine.ts (all 23 event types)
- ✅ Tests: 55/55 PASS
- ✅ Build: SUCCESS
- ✅ Integration: eventAwareBudgetEngine integrated into EventBudgetPlanner.allocate()
- ✅ Dev server: Running on http://localhost:8080/

## Manual UI Testing Checklist

### Test 1: Wedding with 300 guests, ₹10L budget
**User Input:**
```
"I am planning a wedding in Hyderabad for 300 guests"
"My budget is ₹10 lakh"
```

**Expected Output:**
- Budget breakdown shows 12-14 categories (venue, catering, decoration, photography, videography, makeup, entertainment, lighting/sound, rituals, mehendi/haldi, anchor, invitations)
- Catering: ~30% of ₹10L = ₹3L (realistic for 300 guests)
- Photography: ~9% = ₹90k
- Decoration: ~14% = ₹1.4L
- **NO warning messages** about catering being unrealistic
- Total budget = exactly ₹10L (no rounding errors)

**Verification:**
```
✓ Catering allocation: ₹2.8-3.2L (no warning)
✓ All allocations sum to ₹10L
✓ 12+ categories shown
✓ No "Budget Reality Check" warnings
```

---

### Test 2: Budget update - ₹10L → ₹12L
**User Input (follow-up to Test 1):**
```
"Actually make it ₹12 lakh"
```

**Expected Output:**
- Same 12-14 categories preserved
- All allocations increased proportionally
- Catering: ₹3.6L (30% of ₹12L, still realistic)
- Total budget = exactly ₹12L
- **NO warning messages** about catering

**Verification:**
```
✓ Categories unchanged (12-14 same as before)
✓ Photography: ₹108k (was ₹90k)
✓ Catering: ₹3.6L (was ₹3L)
✓ Total: ₹12L exactly
✓ No warnings triggered
```

---

### Test 3: Wedding without Videography
**User Input:**
```
"I am planning a wedding in Hyderabad for 200 guests with ₹8 lakh"
"I don't want videography"
```

**Expected Output:**
- Videography category: NOT shown
- Videography weight redistributed to other categories
- Photography: should be higher than wedding baseline (~10-11% instead of 9%)
- No videography line item
- Total = ₹8L exactly

**Verification:**
```
✓ Videography not in category list
✓ Photography percentage higher than normal
✓ 11 categories (12-1)
✓ Total: ₹8L exactly
```

---

### Test 4: Housewarming at Home vs External Venue

**Test 4a: Housewarming at home**
```
"I am planning a housewarming at my home for 100 guests with ₹3 lakh"
```

Expected:
- Venue category: NOT shown (0 allocation)
- Rituals/Priest: high priority category
- Catering: ~28%
- Decoration: ~12%
- **NO Venue Rental line**

**Test 4b: Housewarming at external venue**
```
"I am planning a housewarming at a rented venue for 100 guests with ₹4 lakh"
```

Expected:
- Venue Rental: shown (~15% = ₹600k)
- Same other categories as 4a
- Allocation difference: ~₹600k shifted to venue

**Verification:**
```
✓ Home: No venue line item
✓ External venue: Venue line item shown
✓ Home total: ₹3L exactly
✓ External venue total: ₹4L exactly
```

---

### Test 5: Haldi Event
**User Input:**
```
"I am planning a haldi event in Bangalore for 150 guests with ₹3.5 lakh"
```

**Expected Output:**
- Haldi-specific categories:
  - Decoration & Flowers: high (20%)
  - Catering: 25%
  - Photography: 15%
  - Makeup & Hair: 15%
  - Lighting & Sound: 5%
- Mehendi Artist: NOT shown (that's a separate event)
- Total = ₹3.5L exactly

**Verification:**
```
✓ Decoration weight: 15-20%
✓ Photography: 10-15%
✓ Makeup: 12-15%
✓ No mehendi artist line
✓ Total: ₹3.5L
```

---

### Test 6: Mehendi Event
**User Input:**
```
"I am planning a mehendi event in Mumbai for 200 guests with ₹4 lakh"
```

**Expected Output:**
- Mehendi Artist: HIGH priority line item (~25%)
- Decoration: 18%
- Catering: 22%
- Photography: 12%
- Music/Entertainment: 10%
- Invitations: 1%
- Total = ₹4L exactly
- **City multiplier: Mumbai = 1.55x** (higher costs)

**Verification:**
```
✓ Mehendi Artist shown and high priority
✓ Mehendi: ₹1L (25%)
✓ Decoration: ₹720k (18%)
✓ Total: ₹4L exactly
✓ Mumbai multiplier reflected in recommendations
```

---

### Test 7: Sangeet Event
**User Input:**
```
"I am planning a sangeet in Delhi for 250 guests with ₹5 lakh"
```

**Expected Output:**
- Music/DJ/Band/Entertainment: HIGH (~20%)
- Dancers/Choreography: 15% (optional, should be shown if in activations)
- Catering: 20%
- Decoration: 12%
- Lighting & Sound: 8% (higher than wedding)
- Photography: 5%
- Anchor: 3%
- Total = ₹5L exactly

**Verification:**
```
✓ Entertainment: 20% = ₹1L
✓ Dancers: shown if activated
✓ Lighting & Sound: 8%
✓ Total: ₹5L exactly
✓ Delhi multiplier applied in recommendations
```

---

### Test 8: Wedding with DJ vs Band
**Test 8a: DJ only**
```
"I want a DJ at my wedding"
```

Expected:
- DJ line item shown
- Band NOT shown
- Entertainment weight in DJ, not band

**Test 8b: Band only**
```
"I want a live band at my wedding"
```

Expected:
- Band line item shown
- DJ NOT shown

**Test 8c: Both DJ and Band**
```
"I want both a DJ and a live band"
```

Expected:
- Both DJ and Band shown
- Each gets ~4% (split from 8% base)
- Total still ≤ 100%

**Verification:**
```
✓ DJ-only: Music/DJ shown, band not shown
✓ Band-only: Band shown, DJ not shown
✓ Both: DJ line (≈4%) + Band line (≈4%)
✓ Total: 100% with both
```

---

### Test 9: Corporate Event
**User Input:**
```
"I am planning a corporate event in Bangalore for 100 attendees with ₹5 lakh"
```

**Expected Output:**
- AV/Staging/Lighting: HIGH (25% of budget = ₹1.25L)
- Catering: 25% (₹1.25L)
- Venue: 20% (₹1L)
- Photography: 12% (₹600k)
- Videography: 8% (₹400k)
- Anchor/Host: 5% (₹250k)
- Music/Entertainment: 3% (₹150k)
- No "Decoration & Flowers", "Makeup", "Rituals" (these are NOT corporate)
- Total = ₹5L exactly

**Verification:**
```
✓ AV/Staging high priority
✓ Catering: 25% (not 30% like wedding)
✓ Photography: 12% (not 14% like wedding)
✓ No wedding-specific categories
✓ Total: ₹5L exactly
```

---

### Test 10: Large Guest Count Warning (700 guests, ₹10L)
**User Input:**
```
"I am planning a wedding in Hyderabad for 700 guests with ₹10 lakh"
```

**Expected Output:**
- ⚠️ Warning message: "Budget Reality Check: With 700 guests...catering alone will likely need ₹X...Y is unrealistic"
- Categories still shown (don't hide them)
- Recommendation to reduce guests, increase budget, or simplify menu
- Total = ₹10L (no hiding)

**Verification:**
```
✓ Warning triggered (700 guests is unrealistic for ₹10L in Hyderabad)
✓ Warning text includes guest count, estimated catering need, suggestion
✓ Budget still shown (not blocked)
✓ Venue venue scalability note for 500+ guests
```

---

### Test 11: Reception Event
**User Input:**
```
"I am planning a reception in Pune for 300 guests with ₹6 lakh"
```

**Expected Output:**
- Catering: HIGH (35% = ₹2.1L, higher than wedding 30%)
- Venue: 16% (₹960k)
- Decoration: 12% (₹720k)
- Photography: 9% (₹540k)
- Videography: 8% (₹480k)
- Entertainment/DJ: 12% (₹720k, higher than wedding 8%)
- Lighting & Sound: 5% (₹300k)
- Makeup: 2% (₹120k)
- Anchor: 2% (₹120k)
- Total = ₹6L exactly
- Catering should be highest allocation (not photography like wedding)

**Verification:**
```
✓ Catering: 35% (highest)
✓ Photography: 9% (not highest)
✓ Entertainment: 12% (higher than wedding)
✓ 9 categories shown
✓ Total: ₹6L exactly
```

---

### Test 12: Birthday Event
**User Input:**
```
"I am planning a birthday in Kolkata for 50 guests with ₹1.5 lakh"
```

**Expected Output:**
- Catering: 25% (₹37.5k)
- Entertainment: 18% (₹27k)
- Decoration: 20% (₹30k)
- Venue: 15% (₹22.5k)
- Photography: 10% (₹15k)
- Videography: 5% (₹7.5k)
- Lighting & Sound: 2% (₹3k)
- Cake line item (special for birthday)
- Total = ₹1.5L exactly

**Verification:**
```
✓ Entertainment: 18%
✓ Catering: 25%
✓ Cake (if shown): minimal
✓ Total: ₹1.5L exactly
✓ Kolkata multiplier: 0.95x (slightly lower than Hyderabad)
```

---

### Test 13: Multi-Function Wedding (5-day event)
**User Input:**
```
"I am planning a wedding in Chennai with Haldi, Mehendi, Sangeet, Wedding Day, and Reception (5 days total) for 300 guests with ₹15 lakh"
```

**Expected Output:**
- Catering: significantly higher allocation (300 guests * 5 events = 1500 guest-events)
- Photography: increased (multiple shoots needed)
- Decoration: increased (multi-day setup)
- Videography: increased
- Multi-day duration factor applied (up to 1.4x boost)
- Total = ₹15L exactly
- Recommendations mention multi-function complexity

**Verification:**
```
✓ Catering allocation: noticeably higher than single-day
✓ Photography/Videography: increased
✓ Duration multiplier applied (≤1.4x)
✓ Total: ₹15L exactly
✓ Recommendations mention 5-day logistics
```

---

### Test 14: Photography Priority
**User Input:**
```
"I am planning a wedding for 200 guests with ₹8 lakh. Photography is very important to me"
```

**Expected Output:**
- Photography: increased from 9% to ~13-15% (1.5x boost, capped)
- Other allocations rebalanced (decreased proportionally)
- Total still = ₹8L exactly
- Recommendations emphasize photography premium

**Verification:**
```
✓ Photography: 12-15% (vs normal 9%)
✓ Other categories: slightly lower
✓ Total: ₹8L exactly
✓ Recommendation: "Photography is high priority"
```

---

## Edge Cases to Verify

### Edge Case 1: Very Large Budget
```
"I am planning a wedding in Mumbai for 500 guests with ₹50 lakh"
```
- Should handle without overflow
- All percentages normalized correctly
- Total = ₹50L exactly

### Edge Case 2: Very Small Budget
```
"I am planning a wedding in Vizag for 50 guests with ₹1 lakh"
```
- Should show warning (unrealistic)
- Budget still allocated (not blocked)
- Total = ₹1L exactly

### Edge Case 3: Zero Guests (should default)
```
"I am planning a wedding with ₹5 lakh"
```
- Should use default 200 guests
- No errors
- Total = ₹5L exactly

---

## Architecture Verification

**Files Modified:**
1. `src/lib/eventBudgetPlanner.ts` - Updated `allocate()` to call eventAwareBudgetEngine
2. `src/lib/eventAwareBudgetEngine.ts` - Complete implementation (650+ lines)

**Files Created:**
1. `src/lib/__tests__/event-aware-budget-engine.test.ts` - 55 comprehensive tests

**Integration Flow:**
```
User Message (AIPlanner)
  → llm (Claude API)
  → aiPlanner/orchestrator
  → EventBudgetPlanner.allocate(context)
  → generateEventAwareBudget(context)
  → EventBudgetPlan object
  → Displayed to user
```

**One Source of Truth:**
- ✅ EventBudgetPlanner.allocate() is THE authoritative budget generation point
- ✅ No competing budget logic
- ✅ eventAwareBudgetEngine called from allocate()
- ✅ All results go through EventBudgetPlan format

---

## Success Criteria

- [x] Core engine: All 23 event types fully implemented
- [x] Tests: 55/55 PASS
- [x] Build: SUCCESS
- [x] Integration: eventAwareBudgetEngine wired into allocate()
- [ ] Manual UI: All 14 test cases PASS (user to verify)
- [ ] Final Report: Generated (next step)

---

## Notes for Manual Testing

1. **Location:** http://localhost:8080
2. **Component:** AIPlanner (Conversation interface)
3. **How to Test:** Type messages like "I am planning a wedding..." and observe the budget breakdown
4. **What to Look For:**
   - Correct number of categories for event type
   - Allocations sum to exact budget (no rounding errors)
   - No spurious warnings for realistic budgets
   - Warnings appear for unrealistic budgets
   - DJ/Band handling is correct
   - Multi-function weddings show increased allocations
5. **Compare With:** Test cases in this checklist
6. **Report:** Document any failures or unexpected behavior

---

## Next: Final Report

After manual UI verification, generate comprehensive final report including:
- Files modified and created
- Architecture changes
- Event-specific rules implemented
- Test results
- Build result
- Manual UI test results
- Remaining limitations (if any)
