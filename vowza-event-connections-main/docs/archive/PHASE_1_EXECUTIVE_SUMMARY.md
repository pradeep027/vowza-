# PHASE 1 INSPECTION: Executive Summary

**Inspection Date:** July 22, 2026  
**Status:** ✅ COMPLETE - No Code Changes Made  
**Next:** Awaiting User Approval to Proceed to Phase 2A

---

## THE FINDING: Why Vowza Planner Acts Like a Chatbot

### Current Reality

Vowza Planner **DOES** have:
- ✅ Real vendor database (100+ photographers, decorators, DJs in production)
- ✅ Intent detection (understands "find photographers" vs "plan wedding")
- ✅ Context extraction (parses budget, location, guest count, event type)
- ✅ Conversation persistence (saves to Supabase)
- ✅ Admin Event Packages (Silver/Gold/Platinum tiers)
- ✅ Dual LLM modes (Groq + deterministic fallback)

### The Problem

Vowza Planner **DOES NOT** have:
- ❌ **Structured Planning State** — Context extracted but not used for decisions
- ❌ **Budget Allocation Engine** — No intelligent category-by-category breakdown
- ❌ **Real-Time Recalculation** — Doesn't update plan when requirements change
- ❌ **Trade-Off Optimization** — No "reduce decoration by X, increase photo by Y"
- ❌ **Unified Discovery** — Vendors and planning happen separately
- ❌ **Admin Package Integration** — Packages exist but AI doesn't recommend them
- ❌ **Context-Driven Planning** — Generates plan only if user explicitly says "plan"

### Example: Current vs Desired

**Current (Generic Chatbot):**
```
User:  "I'm planning a wedding for 300 guests, ₹5L budget. 
        I want traditional decoration, photography, DJ."

AI:    "Got it. I can help with that. What would you like to explore first?
        - Budget breakdown
        - Vendor recommendations  
        - Timeline
        - Something else?"
```

**Desired (Intelligent Event Planner):**
```
User:  "I'm planning a wedding for 300 guests, ₹5L budget. 
        I want traditional decoration, photography, DJ."

AI:    "✨ I've created your wedding plan:
        
        BUDGET BREAKDOWN:
        • Photography: ₹70,000 (I found 8 verified photographers)
        • Decoration: ₹100,000 (I found 12 verified decorators)
        • Catering: ₹180,000
        • DJ: ₹25,000
        • Makeup: ₹30,000
        • Contingency: ₹45,000
        
        RECOMMENDED PACKAGE:
        Gold Wedding Package (₹80,000) — Best fit for your budget
        
        NEXT STEPS:
        1. Review the photographers and decorators I found
        2. Customize your Gold package (optional)
        3. Let me know if you'd like to adjust priorities"
```

---

## Root Causes (Ranked by Impact)

| # | Root Cause | Current | Missing |
|---|-----------|---------|---------|
| 1 | No Planning State Machine | Message → Intent → Action | Structured state that persists across turns |
| 2 | Budget not allocated | Context extracted, never used | Budget engine allocates per category |
| 3 | Vendors decoupled from plan | "Find vendors" separate from "Plan" | Integrated discovery in plan context |
| 4 | No recalculation loop | Static plan generation | Real-time updates when context changes |
| 5 | Context in pills only | Shows at top, not in LLM prompt | Context sent on every AI turn |
| 6 | Admin packages invisible to AI | Exist in DB, AI unaware | PackageMatcher recommends tiers |
| 7 | No optimization | Budget exceeded = "sorry" | Trade-off engine offers alternatives |

---

## What's Already Working (Don't Break These)

| Component | Status | Evidence |
|-----------|--------|----------|
| Vendor Database | ✅ Working | 100+ verified vendors in `provider_profiles` |
| Intent Detection | ✅ Working | Orchestrator classifies 15+ intent types |
| Context Extraction | ✅ Working | Parses city, budget, guests, event type |
| RAG Retrieval | ✅ Working | Returns real vendors (never fabricates) |
| Admin Packages | ✅ Working | Silver/Gold/Platinum tiers created in Phase 2B |
| Conversation Persistence | ✅ Working | Saved to Supabase, restored on mount |
| Voice Input | ✅ Working | Web Speech API, English-IN |
| Auth/RLS | ✅ Working | Vendor visibility correctly restricted |

---

## What Must Be Built (Phase 2A-2F)

### Phase 2A: Planning State Machine
- Create `eventBudgetPlanner.ts` (allocates ₹5L into categories)
- Update `llm.ts` to use state machine
- Result: AI generates plan on sufficient context

### Phase 2B: Vendor-Plan Integration  
- Link retrieved vendors to budget categories
- Show vendors in context of allocated budget
- Result: "Photography: ₹70K (I found 8 vendors)"

### Phase 2C: Admin Package Integration
- Create `packageMatcher.ts` (match Silver/Gold/Platinum)
- Show packages alongside vendors
- Result: "I recommend Gold (₹80K) for your ₹5L budget"

### Phase 2D: Trade-Off Engine
- Detect budget overages
- Offer alternatives ("reduce decoration by X")
- Result: "Your plan exceeds budget. Options: ..."

### Phase 2E: What-If Simulation
- Support "what if I add 100 guests?"
- Recalculate without modifying plan
- Result: Real-time impact analysis

### Phase 2F: Polish
- Refine system prompt
- Soft follow-up questions
- Performance optimization

---

## Files to Create (8 New)

```
src/lib/eventBudgetPlanner.ts          ← Intelligent budget allocation
src/lib/tradeOffEngine.ts              ← Budget optimization
src/lib/planningStateMachine.ts        ← State machine
src/lib/packageMatcher.ts              ← Admin package integration
src/hooks/useEventPlan.ts              ← Plan state hook
src/components/ai/PlanningCards.tsx    ← Plan + vendors display
src/components/ai/TradeOffModal.tsx    ← Budget trade-off UI
src/components/ai/PackageComparison.tsx ← Tier comparison
```

---

## Files to Modify (7 Existing)

```
src/lib/llm.ts                         ← Route to planning state machine
src/lib/aiOrchestrator.ts              ← Add planning detection
src/lib/aiPlanner.ts                   ← Use budget planner
src/lib/ragRetriever.ts                ← Link vendors to budget
src/components/ai/useAIChat.ts         ← Pass plan state
src/lib/aiPlannerTypes.ts              ← Add types for plan
src/pages/AIPlanner.tsx                ← Display plan cards
```

---

## Demo Scenario (Must Work End-to-End)

**Turn 1:** Customer describes event with context
```
"I'm planning a wedding in Hyderabad for 300 guests. 
 My budget is ₹5 lakh. I want traditional decoration, photography, DJ."
```
**Expected:** AI generates complete plan with vendors + packages

**Turn 2:** Customer reprioritizes
```
"Photography is most important."
```
**Expected:** AI recalculates budget, re-ranks vendors (no re-asking)

**Turn 3:** Customer adjusts budget
```
"Remove DJ, put that money into decoration."
```
**Expected:** AI reallocates, shows updated vendors

**Turn 4:** Customer filters vendors
```
"Show photographers under ₹80,000."
```
**Expected:** Real vendors from DB (never fabricated)

**Turn 5:** Customer asks for recommendation
```
"Which photographer is best for my wedding?"
```
**Expected:** AI compares and explains (not just lists)

**Turn 6:** Customer books
```
"Book this photographer."
```
**Expected:** Initiates existing Vowza booking flow

---

## What Must NOT Change

- ✗ Authentication (AuthContext)
- ✗ Existing bookings (event_bookings table)
- ✗ Vendor packages (vendor-created)
- ✗ Browse Artists
- ✗ Homepage / Promotions
- ✗ Admin Event Packages DB schema
- ✗ RLS policies

---

## Database Changes Needed

**New RPC:** 1 function
```sql
match_admin_event_package(event_type_id, budget, guests)
→ Returns Silver/Gold/Platinum recommendation
```

**Existing Tables Used (No Schema Changes):**
- ✅ provider_profiles
- ✅ artist_categories
- ✅ event_types
- ✅ admin_event_packages (created in Phase 2B)
- ✅ admin_event_package_inclusions (created in Phase 2B)
- ✅ conversations
- ✅ conversation_messages

---

## Success Criteria

**After Phase 2F, Vowza Planner will:**

1. ✅ Remember all event context across turns
2. ✅ Auto-generate plan on sufficient context (no "What would you like?")
3. ✅ Allocate budget intelligently per category
4. ✅ Show real vendors in budget context
5. ✅ Recommend Admin Event Packages
6. ✅ Recalculate when priorities change
7. ✅ Offer trade-offs on budget overages
8. ✅ Support what-if scenarios
9. ✅ Never re-ask known information
10. ✅ Feel like talking to an expert event planner (not a chatbot)

---

## Timeline Estimate

- **Phase 2A:** 4-6 hours (budget planner)
- **Phase 2B:** 3-4 hours (vendor integration)
- **Phase 2C:** 3-4 hours (package integration)
- **Phase 2D:** 4-6 hours (trade-off engine)
- **Phase 2E:** 3-4 hours (what-if simulation)
- **Phase 2F:** 2-3 hours (polish + testing)

**Total:** ~20-30 hours of development

---

## Next Action: Approval

**This inspection found:**
- 🎯 Exact root causes of generic behavior
- 📋 Complete architecture needed to fix it
- 📁 Specific files to create/modify
- 🗓️ Implementation plan (6 phases)
- ✅ No breaking changes required

**Ready to proceed?**
- User reviews this report
- User approves proposed architecture
- Move to Phase 2A: Create Planning State Machine

---

**Prepared by:** Kiro AI  
**Inspection Level:** Complete (15 source files analyzed)  
**Code Changes:** 0 (inspection only)  
**Ready:** ✅ Yes
