# VOWZA AI PLANNER - PHASE 2A PLAN (REVISED)

**Date:** August 17, 2026  
**Status:** DESIGN PHASE (NO IMPLEMENTATION YET)  
**Current Focus:** Phase 2A — Multi-Turn Context & Modification Tracking Only

---

## PHASE 2 CORE OBJECTIVE

Transform Vowza Planner into a specialized conversational AI for event planning that behaves like a specialized ChatGPT for event planning:

- ✅ Maintains natural multi-turn conversation flow
- ✅ Persists event context correctly across turns
- ✅ Never loses previously confirmed information
- ✅ Asks intelligent follow-up questions (context-aware)
- ✅ Handles context updates without losing confirmed information
- ✅ Recommends real Vowza vendors (never fabricated)
- ✅ Never repeats questions already answered
- ✅ Provides reactive planning that responds to user changes

**Implementation Approach:**
- Reuse existing functions/types wherever possible
- Do NOT duplicate existing planner logic
- Modify files ONLY if Phase 2A implementation genuinely requires it
- Focus on correctness and behavior, not line-count targets
- Maintain ALL Phase 1 behavior (locked)

---

## PHASE 2A SCOPE — MULTI-TURN CONTEXT & MODIFICATION TRACKING

### Phase 2A Goals

Transform the Planner from **stateless-between-turns** to **context-aware-persistent**.

**Only Phase 2A.** Do NOT implement Phase 2B+.

#### Goal 1: Preserve Context Between Turns

Load previous context from DB. Merge with user's new message. Only update fields mentioned in the message. Preserve all other fields.

#### Goal 2: Detect When User Changes Existing Requirements

- "I want a wedding in Hyderabad" → eventType=wedding, city=Hyderabad
- "Make it 300 guests" → Update guestCount=300; preserve wedding + Hyderabad
- "Actually make the budget 15 lakhs" → Update budget=1500000; preserve all other fields

#### Goal 3: Handle Ambiguous Changes

- "Maybe make it somewhere else" → Don't destroy city; ask clarification instead

#### Goal 4: Track Confirmed Information

Mark fields that user explicitly provided. Distinguish from fields that are assumed/inferred.

#### Goal 5: Prevent Repeated Questions

Track questions already asked in this conversation. Do not re-ask "What is your budget?" after user answered it.

#### Goal 6: Preserve Conversation History

All previous messages remain visible. Context restored on conversation load. No information lost on refresh/close.

---

### Phase 2A Core Examples

#### Example 1: Single Context Update

```
Turn 1 - User: "I am planning a wedding in Hyderabad."
Context created:
  eventType: 'wedding'
  city: 'Hyderabad'
  budget: undefined
  guestCount: undefined

Turn 2 - User: "Make it 300 guests."
Previous context loaded:
  eventType: 'wedding'
  city: 'Hyderabad'
Extracted from message: 
  guestCount: 300
Merged context:
  eventType: 'wedding'
  city: 'Hyderabad'
  guestCount: 300
```

#### Example 2: Multiple Context Updates

```
Turn 1 - User: "I want a wedding in Hyderabad with a 10 lakh budget."
Context:
  eventType: 'wedding'
  city: 'Hyderabad'
  budget: 1000000

Turn 2 - User: "Actually make the budget 15 lakhs."
Previous context loaded:
  eventType: 'wedding'
  city: 'Hyderabad'
  budget: 1000000
Extracted from message: 
  budget: 1500000
Merged context:
  eventType: 'wedding'          (preserved)
  city: 'Hyderabad'            (preserved)
  budget: 1500000              (updated)
```

#### Example 3: Ambiguous Change

```
Turn 1 - User: "Planning a wedding in Hyderabad with 300 guests."
Context:
  eventType: 'wedding'
  city: 'Hyderabad'
  guestCount: 300

Turn 2 - User: "Maybe make it somewhere else."
Extraction attempts:
  "somewhere else" → No specific city mentioned
  City extraction: undefined
Problem: Ambiguous. Don't destroy existing city.
Action: Clarify instead.
  Planner: "You said Hyderabad. Are you changing that to a different city?"
```

#### Example 4: Question Memory

```
Turn 1 - User: "Plan my wedding."
Planner: "What's your budget?"
Track: "budget question already asked"

Turn 2 - User: "₹8 lakhs"
Context updated: budget: 800000

Turn 3 - User: "Can you show me photographers?"
Planner should NOT ask "What's your budget?" again
It should either:
  a) Search photographers with known budget, OR
  b) Ask next important question (if context incomplete)
```

---

## PHASE 2A DOES NOT CHANGE

### Phase 1 Behavior — LOCKED

The following must remain unchanged:

- ✅ **Event Classification:** Haldi/mehendi/sangeet remain distinct from engagement
- ✅ **Birthday Classification:** Birthday remains birthday
- ✅ **Rating Extraction:** "5-star" → 5.0 (not 4.0)
- ✅ **Vendor Search Readiness:** Intent detection for find_vendors bypasses context requirement
- ✅ **Area Extraction:** "in Beramguda" → extracts locality
- ✅ **Exact Area Matching:** profiles.area matching (LOWER/TRIM)
- ✅ **Service Area Matching:** provider_profiles.service_areas matching (normalized)
- ✅ **City Fallback Logic:** No city fallback when area explicitly requested
- ✅ **Vendor Filtering:** Verified + published + approved vendors only
- ✅ **Verification Status:** Actual database is_verified value (never hardcoded TRUE)
- ✅ **No Fabrication:** No fabricated vendors, ratings, availability, or radius

### Deferred Features — NOT Phase 2A

- ❌ Context confirmation prompts (Phase 2B)
- ❌ Event-aware follow-up questions (Phase 2C)
- ❌ Reactive dependency analysis (Phase 2D)
- ❌ Vendor-search context integration (Phase 2E)
- ❌ District filtering
- ❌ Address filtering
- ❌ Geographic radius search
- ❌ Vendor availability booking integration

---

## PHASE 2A TEST CASES

Define and implement tests for:

### Test Category A: Preserve Context

- **A1:** User provides event type only ("wedding") → Load conversation → Verify context has eventType=wedding preserved across turns
- **A2:** User provides city only ("Hyderabad") → Load conversation → Verify context has city preserved
- **A3:** Multi-field context ("wedding", "Hyderabad", "300 guests") → Verify all fields preserved

### Test Category B: Update One Field

- **B1:** Previous context has (wedding, Hyderabad, ?, ?). User says "300 guests" → Verify only guestCount updated; eventType and city preserved
- **B2:** Previous context has (wedding, Hyderabad, 300, ?). User says "Budget is ₹8 lakh" → Verify only budget updated; other fields preserved
- **B3:** Previous context has (wedding, Hyderabad, 300, ₹8L). User says "Actually evening please" → Verify timeOfDay updated; other fields preserved

### Test Category C: Update Multiple Fields

- **C1:** Previous context has (wedding, Hyderabad, ?, ?). User says "300 guests and ₹10 lakh" → Verify both guestCount and budget updated; eventType and city preserved
- **C2:** Previous context has (wedding, Hyderabad, 300, ₹8L). User says "Change guests to 200 and budget to 12 lakhs" → Verify both updated; eventType and city preserved

### Test Category D: Ambiguous Change

- **D1:** User says "Maybe make it somewhere else" with no city mentioned → Verify system asks clarification instead of destroying city
- **D2:** User says "100 guests. Actually 300 guests" → Verify no ambiguity; latest value (300) is used
- **D3:** User says "Somewhere in the north" with no specific city → Verify asks clarification instead of overwriting

### Test Category E: Prevent Repeated Questions

- **E1:** Turn 1: Planner asks "What is your budget?" → Turn 2: User answers "₹8 lakh" → Verify "budget" marked as confirmed
- **E2:** Turn 1: Planner asks "What is your budget?" → Turn 2: User answers → Turn 3: Planner does NOT ask same question again
- **E3:** Turn 1: Planner asks "What city?" → Turn 2: User answers "Hyderabad" → Turn 3: Different context question asked (or no question if context complete)

### Test Category F: Restore Conversation Context

- **F1:** User creates conversation, provides context (wedding, Hyderabad, 300 guests) → Close browser → Reopen → Verify context restored from DB
- **F2:** User adds more context in Turn 2 → Close → Reopen → Verify all accumulated context present
- **F3:** User modifies context in Turn 3 → Close → Reopen → Verify latest merged context restored

### Test Category G: Preserve Phase 1 Vendor Search

- **G1:** User says "Find photographers in Beramguda" → Verify search_vendors_sql returns area-matched results (Phase 1 RPC)
- **G2:** User plans wedding → Then asks "Show photographers" → Verify Phase 1 location filtering still works
- **G3:** Vendor results include only verified + published vendors → No fabrication

### Test Category H: Regression — Phase 1 Event Classification & Rating Extraction

- **H1:** User says "Haldi" → Verify event type is 'haldi' (not engagement)
- **H2:** User says "Birthday" → Verify event type is 'birthday'
- **H3:** Vendor has "5-star rating" in description → Verify extracted as 5.0 (not 4.0)
- **H4:** Vendor has no rating → Verify rating not fabricated

---

## PHASE 2A IMPLEMENTATION APPROACH

### Step 1: Load Previous Context

When user opens conversation or sends new message:

```
1. Load conversation from ai_conversations table
   → Get context_summary (previous PlannerContext)
   → Store as previousContext

2. If no previous context exists, start fresh
```

### Step 2: Extract Context Updates from New Message

```
1. Parse user message with existing extractContextUpdates()
   → Get updates = { field: value, ... }

2. Identify which fields the user mentioned:
   - Budget: "₹10L", "10 lakh", "1000000"
   - City: "Hyderabad", "Mumbai", etc.
   - Guest count: "300 guests", "100 people"
   - Event type: "wedding", "birthday", etc.
   - Date: "Jan 15", "June", "15th"
   - Etc.
```

### Step 3: Detect Ambiguous Changes

```
1. If user says "somewhere else" but no specific city mentioned:
   → Flag as ambiguous
   → Ask clarification instead of destroying existing city

2. If user says two conflicting things ("100 guests and 300"):
   → Flag as ambiguous
   → Ask which one is correct
```

### Step 4: Merge Context Intelligently

```
1. Start with previousContext (all existing fields)

2. For each field in updates:
   a) If explicitly non-ambiguous:
      → Replace oldValue with newValue
   
   b) If ambiguous:
      → Do not change; request clarification
   
   c) If field not in updates (user didn't mention):
      → Keep previousValue unchanged

3. Result: mergedContext preserves all non-changed fields
```

### Step 5: Track Confirmed Information

```
1. Mark which fields were explicitly provided by user:
   confirmedFields = ["eventType", "city", "guestCount"]

2. Mark which questions were already asked:
   askedQuestions = ["What is your budget?"]

3. Store in conversation for next turn reference
```

### Step 6: Pass Context to LLM

```
1. Include previousContext in system prompt:
   "[PREVIOUS EVENT CONTEXT: wedding, Hyderabad, 300 guests]"

2. Include confirmedFields:
   "[CONFIRMED FIELDS: eventType, city, guestCount]"

3. Include askedQuestions:
   "[ALREADY ASKED: 'What is your budget?']"

4. Instruct LLM:
   "Do NOT ask questions about fields that are confirmed.
    Do NOT repeat questions from ALREADY ASKED.
    Do NOT destroy context fields the user did not mention."
```

### Step 7: Save Updated Context

```
1. Save mergedContext to ai_conversations.context_summary

2. Save message to ai_messages with metadata:
   - confirmedFields
   - askedQuestions
   - contextUpdates (which fields changed)
```

---

## CANDIDATE FILES FOR PHASE 2A

**Important:** These are candidates only. Modify ONLY if Phase 2A implementation genuinely requires it.

### Likely Candidates for Phase 2A

1. **`src/lib/aiOrchestrator.ts`** (Candidate — MEDIUM likelihood)
   - May need: Enhanced context merging logic
   - May need: Detection of ambiguous changes
   - May need: Clarification detection

2. **`src/hooks/useAIChat.ts`** (Candidate — MEDIUM likelihood)
   - May need: Track confirmed fields across turns
   - May need: Track questions already asked
   - May need: Context restoration logic

3. **`src/repository/conversationRepository.ts`** (Candidate — MEDIUM likelihood)
   - May need: Enhance message load to properly restore context
   - May need: Extract metadata about confirmed fields

4. **`src/lib/llm.ts`** (Candidate — LOW likelihood)
   - May need: System prompt enhancement to reference confirmed context
   - May need: Instructions to avoid re-asking questions

### Unlikely to Change (Phase 2A)

- ❌ `aiPlannerTypes.ts` — Use existing PlannerContext
- ❌ `ragRetriever.ts` — Vendor search unchanged for Phase 2A
- ❌ `AIResponseCards.tsx` — Response formatting unchanged for Phase 2A
- ❌ Database — No schema changes for Phase 2A

---

## DATABASE CHANGES

**Decision:** NO database schema changes for Phase 2A.

Phase 1 context persistence already stores PlannerContext in `ai_conversations.context_summary` (JSONB). This is sufficient for Phase 2A.

Metadata about confirmed fields and asked questions can be stored in existing `ai_messages.ai_response` JSONB.

---

## WHAT PHASE 2A DELIVERS

Once Phase 2A is complete:

1. **Implementation:**
   - Code changes (only in files where necessary)
   - Test suite (unit + integration tests for A-H)
   - TypeScript compilation (0 errors)

2. **Verification:**
   - All Phase 2A tests pass (A-H)
   - All Phase 1 tests pass (event classification, rating extraction, vendor search)
   - No regressions

3. **Documentation:**
   - Summary of which files changed and why
   - Summary of logic changes

4. **Code Quality:**
   - No duplication of existing logic
   - Reuse of existing functions/types
   - Clear, maintainable code

---

## NEXT STEPS

**Current Status:** Phase 2A design complete; awaiting user approval

**User review needed:**

1. ✅ Is Phase 2A scope clear? (Multi-turn context + modification tracking ONLY)
2. ✅ Do the test cases (A-H) match your requirements?
3. ✅ Are the candidate files correct? (aiOrchestrator, useAIChat, conversationRepository — MEDIUM; llm — LOW)
4. ✅ Is the implementation approach sound?
5. ✅ Confirm Phase 2A does NOT include: smart follow-ups, reactive analysis, context-aware questions

**Once approved:**
- I will implement Phase 2A systematically
- Build tests alongside code
- Verify TypeScript compilation
- Run full test suite
- Report which files changed and verification results
- STOP before GitHub/Vercel deployment
- Await your review before proceeding

**I will NOT:**
- Modify any code until you approve this plan
- Change database schema
- Push to GitHub
- Deploy to Vercel
- Implement Phase 2B+ features yet

---

**END OF PHASE 2A PLAN**
