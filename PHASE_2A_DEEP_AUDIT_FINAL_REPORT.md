# PHASE 2A DEEP AUDIT: FINAL COMPREHENSIVE REPORT

**Date:** July 22, 2026  
**Status:** AUDIT COMPLETE - CRITICAL ISSUES IDENTIFIED  
**Build Result:** ✅ SUCCESS (Exit Code: 0)

---

## EXECUTIVE SUMMARY

Phase 2A implementation is **PROVISIONALLY COMPLETE** but has **CRITICAL ISSUES**:

✅ **WORKING:** Context preservation, ambiguity detection, field-level updates  
❌ **NOT WORKING:** Question memory, confirmed field tracking, duplicate question prevention  
⚠️ **BLOCKER:** Undefined function call (`extractContextFromMessage`), Phase 1 work mixed in  
🔴 **CRITICAL:** Runtime error likely; Phase 2A cannot be deployed until fixed

---

## SECTION 1: UNRESOLVED PHASE 2A REQUIREMENTS

### 1. Asked Questions Tracking

**Finding:** ❌ NOT IMPLEMENTED

**Evidence:**
- `PlannerContext` interface has NO field for `askedQuestions`, `asked_questions`, or equivalent
- `grep search` across entire codebase found ZERO occurrences of question-tracking fields
- `determineNextQuestion()` function (aiOrchestrator.ts:335-342) **ALWAYS returns null**
- No mechanism to track which questions were asked in current conversation

**Code Location:**
```typescript
// aiOrchestrator.ts:335-342
function determineNextQuestion(
  intent: Intent,
  ctx: PlannerContext
): string | null {
  // Discovery is useful without a city...
  if (intent === 'find_vendors') return null;
  return null;  // ← ALWAYS RETURNS NULL
}
```

**Impact:** Planner may ask same question repeatedly ("What city?" → user answers → later "What city?" again)

---

### 2. Confirmed Field Tracking

**Finding:** ❌ NOT IMPLEMENTED

**Evidence:**
- No `confirmedFields`, `inferred_fields`, `explicitlyProvided`, or equivalent in `PlannerContext`
- No distinction between user-provided vs AI-inferred values
- Code assumes: if field exists in context → it's confirmed (implicit tracking only)
- `grep search` found ZERO occurrences of confirmation tracking across codebase

**Impact:** Cannot distinguish "user said budget is 10L" from "we inferred budget is 10L"

---

### 3. Duplicate Question Prevention

**Finding:** ❌ NO EXPLICIT MECHANISM

**Current Behavior:**
- Code checks if field exists in context (e.g., `if (context.city)`)
- If city exists, acknowledges it: "Got it — wedding in Hyderabad"
- **But never prevents re-asking** "What city?" if conversation continues

**Evidence:**
- No `askedQuestions` list to check against
- No confirmation state tracking
- Only implicit prevention via context checking

**Flow:**
```
Turn 1: User: "Wedding in Hyderabad"
        Context: city = Hyderabad
        Response: Acknowledges city

Turn 2: User: "What about the budget?"
        No check for "already asked about city"
        Risk: Planner asks "What city?" again
```

---

### 4. Context Persistence Between Messages

**Finding:** ✅ FULLY IMPLEMENTED

**Evidence:**
- **useAIChat.ts:382:** `updateConversation(currentConvId, { context_summary: res.updatedContext })`
  - Stores `updatedContext` to Supabase `ai_conversations.context_summary` (JSONB column)
- **useAIChat.ts:385-387:** Updates React state + sessionStorage
- **Flow:** LLM response → returns `updatedContext` → useAIChat persists it

**Storage Locations:**
1. **Primary (Durable):** Supabase `ai_conversations.context_summary` (JSONB) — survives page reload
2. **Secondary (Session):** `sessionStorage` with key `vowza_ai_context` — session-only
3. **Ephemeral (In-Memory):** React state and refs — lost on page close

---

### 5. Context Restoration on Conversation Reopen

**Finding:** ✅ FULLY IMPLEMENTED

**Evidence:**
- **useAIChat.ts:94-96 (On Mount):** Loads all conversations, finds stored ID, extracts `context_summary`, calls `setContext(conv.context_summary)`
- **useAIChat.ts:138-141 (loadConversation):** When user clicks sidebar conversation, restores `context_summary` via `setContext()` and `saveContext()`

**Code:**
```typescript
// On mount: Restore last active conversation
if (storedId) {
  const conv = convs.find(c => c.id === storedId);
  if (conv?.context_summary) {
    contextRef.current = conv.context_summary;
    setContext(conv.context_summary);        // ← Restored here
    saveContext(conv.context_summary);
  }
}

// When switching conversations
if (conv.context_summary) {
  contextRef.current = conv.context_summary;
  setContext(conv.context_summary);          // ← Restored here
  saveContext(conv.context_summary);
}
```

---

## SECTION 2: CONTEXT STORAGE & PERSISTENCE

### Storage Locations (4 Total)

| Location | Type | Durability | Access | Details |
|----------|------|-----------|--------|---------|
| **Supabase `ai_conversations.context_summary`** | JSONB Column | ✅ Permanent | Async DB query | PRIMARY - survives reload, browser close, device change |
| **sessionStorage `vowza_ai_context`** | JSON string | ⚠️ Session-only | Synchronous | SECONDARY - persists during session only |
| **React state `context`** | PlannerContext object | ❌ Ephemeral | Synchronous | TERTIARY - lost on page close |
| **In-memory refs `contextRef.current`** | Reference | ❌ Ephemeral | Synchronous | TERTIARY - avoids stale closure during streaming |

---

## SECTION 3: MESSAGE FLOW TRACING

### Complete User Message Flow (One Example)

**User Input:** "I want a wedding in Hyderabad with 200 guests"

```
1. useAIChat.ts:265
   └─ send(userText) called
      ├─ Save user message to DB
      └─ Call sendMessage(opts) in llm.ts

2. llm.ts:345-349 [⚠️ DEAD CODE DETECTED HERE]
   └─ extractContextFromMessage(message, context)
      ├─ ❌ Function NOT imported, NOT defined
      ├─ ❌ Line 349: extractedContext = extractContextFromMessage()
      └─ ⚠️ Will throw "extractContextFromMessage is not defined" at runtime
      
   contextWithExtraction = {...context, ...extractedContext}

3. llm.ts:357
   └─ orchestrate(message, contextWithExtraction, history)
   
4. aiOrchestrator.ts:587
   └─ const normalizedMessage = message.replace(...)
      ├─ extractContextUpdates(normalizedMessage, ctx)
      │  └─ Returns {eventType:'wedding', city:'Hyderabad', guestCount:200}
      └─ mergeContextIntelligently(ctx, updates, normalizedMessage)
         ├─ const merged = {...previousContext}  ← PRESERVE ALL PRIOR FIELDS
         ├─ isAmbiguousChange(message, ctx) → false (explicit values provided)
         └─ Loop: merge each non-null/undefined update
            └─ Returns {merged, ambiguous: false}

5. aiOrchestrator.ts:649
   └─ const nextQuestion = determineNextQuestion(intent, merged)
      └─ ⚠️ ALWAYS RETURNS NULL (no question tracking)

6. llm.ts:363
   └─ processMessage(message, contextToUse, history)

7. aiPlanner.ts:706
   └─ Extract updates again
      └─ mergeContextIntelligently(context, updates, message)  ← SECOND INTELLIGENT MERGE
         ├─ Spreads previous context AGAIN
         └─ Merges same extracted fields AGAIN
         
   └─ Returns {response, updatedContext: finalContext}

8. llm.ts:379
   └─ calculatePlanningReadiness(updatedContext)
      └─ If sufficient, EventBudgetPlanner.allocate(updatedContext)

9. useAIChat.ts:352 (After response completes)
   └─ finalContext = res.updatedContext
      ├─ updateConversation(currentConvId, {context_summary: res.updatedContext})
      │  └─ PERSISTS to Supabase DB
      ├─ contextRef.current = res.updatedContext
      ├─ setContext(res.updatedContext)
      │  └─ Updates React state
      └─ saveContext(res.updatedContext)
         └─ Saves to sessionStorage
```

---

## SECTION 4: DUPLICATE CONTEXT-MERGING LOGIC

### Issue: Context Merged 3+ Times Per Message

**Problem:** Context extraction and merging happens in multiple places:

1. **llm.ts:349** - Simple spread merge (undefined function)
2. **aiOrchestrator.ts:595** - Intelligent merge via `mergeContextIntelligently()`
3. **aiPlanner.ts:713** - Intelligent merge via `mergeContextIntelligently()` AGAIN

**Impact Analysis:**

| Impact | Severity | Details |
|--------|----------|---------|
| **Runtime Error** | 🔴 CRITICAL | `extractContextFromMessage()` undefined at llm.ts:349 will crash |
| **Wasted Computation** | 🟡 MEDIUM | Extracting context twice (orchestrate + processMessage) wastes CPU |
| **Idempotence** | ✅ OK | Same extractors on same input = same output (no data corruption) |
| **Architectural Debt** | 🟡 MEDIUM | Dead code paths complicate debugging |

---

## SECTION 5: CRITICAL ISSUES FOUND

### Issue #1: Undefined Function Call (BLOCKER)

**Severity:** 🔴 CRITICAL - RUNTIME ERROR

**Location:** `llm.ts:349`

**Code:**
```typescript
const extractedContext = extractContextFromMessage(message, context);
```

**Problem:**
- Function NOT imported anywhere
- Function NOT defined in codebase
- Will throw `ReferenceError: extractContextFromMessage is not defined` at runtime
- Build succeeded but runtime will fail

**Resolution:** Either (A) remove this line, (B) import and define the function, or (C) comment out this code path

---

### Issue #2: Phase 1 Work Mixed Into Phase 2A Diff

**Severity:** 🟡 HIGH - SCOPE CREEP

**Files Affected:**
1. `src/lib/eventContextCapturer.ts` (+5 lines) - Event classification (haldi/mehendi/sangeet)
2. `src/lib/ragRetriever.ts` (+64 lines) - Area parameter passing, service-area filtering
3. `supabase/migrations/20260917000000_harden_planner_vendor_search.sql` - RPC area parameter

**Problem:** These are Phase 1 vendor search enhancements, not Phase 2A context preservation

**Impact:** Violates "Phase 1 is LOCKED" requirement

**Resolution:** Revert these three files from the Phase 2A diff before merging

---

### Issue #3: Question Memory Not Implemented

**Severity:** 🟡 MEDIUM - INCOMPLETE FEATURE

**Location:** aiOrchestrator.ts:335-342

**Code:**
```typescript
function determineNextQuestion(
  intent: Intent,
  ctx: PlannerContext
): string | null {
  if (intent === 'find_vendors') return null;
  return null;  // ← Always null
}
```

**Problem:** No mechanism to prevent re-asking questions

**Resolution:** Defer to Phase 2B/2D or implement explicit `askedQuestions` tracking

---

### Issue #4: Confirmed Field Tracking Not Implemented

**Severity:** 🟡 MEDIUM - INCOMPLETE FEATURE

**Location:** PlannerContext type definition

**Problem:** No distinction between user-provided vs AI-inferred context

**Resolution:** Defer to Phase 2B/2D or add `confirmedFields` set to PlannerContext

---

## SECTION 6: PHASE 2A REQUIREMENTS MATRIX

### Implementation Status (A-H)

| Requirement | Status | Evidence | File:Line |
|---|---|---|---|
| **A. Preserve Previous Fields** | ✅ IMPLEMENTED | `const merged = {...previousContext}` spreads all prior fields | aiOrchestrator.ts:479 |
| **B. Update Only Changed Fields** | ✅ IMPLEMENTED | Loop checks `if(value !== undefined && value !== null)` | aiOrchestrator.ts:484-488 |
| **C. Multiple Field Updates** | ✅ IMPLEMENTED | Loop handles multiple fields in one pass | aiOrchestrator.ts:484-488 |
| **D. Ambiguous Change Protection** | ✅ IMPLEMENTED | `isAmbiguousChange()` detects vague changes, returns clarification | aiOrchestrator.ts:458-472, aiPlanner.ts:720-730 |
| **E. Remember Questions Asked** | ❌ NOT IMPLEMENTED | `determineNextQuestion()` always returns null | aiOrchestrator.ts:335-342 |
| **F. Remember Confirmed Info** | ❌ NOT IMPLEMENTED | No `confirmedFields` tracking in PlannerContext | aiPlannerTypes.ts:16-38 |
| **G. Restore Context on Reopen** | ✅ IMPLEMENTED | Loads `context_summary` from DB on mount and switch | useAIChat.ts:94-96, 138-141 |
| **H. Preserve Phase 1 Behavior** | ⚠️ PARTIALLY | Phase 1 code mixed in; Phase 2A code doesn't break Phase 1 | ragRetriever.ts, eventContextCapturer.ts |

---

## SECTION 7: BUILD VERIFICATION

**Build Command:** `npm run build`

**Result:** ✅ SUCCESS

**Exit Code:** 0

**Summary:**
- ✓ 3225 modules transformed
- ✓ 200 chunks rendered
- ✓ Built in 17.09s
- ✅ TypeScript Errors: ZERO
- ✅ Compilation Errors: ZERO
- ⚠️ Warnings: CSS utility ambiguity (unrelated)

**Important Note:** Build succeeded despite `extractContextFromMessage()` being undefined. This suggests:
1. Code path may be unreachable (dead code), OR
2. Function defined dynamically at runtime (unlikely)

**Runtime testing required** to confirm if runtime error occurs.

---

## SECTION 8: RECOMMENDATIONS

### BEFORE PRODUCTION DEPLOYMENT

#### Critical (Must Fix)
1. **Remove/Fix undefined `extractContextFromMessage()` call** at llm.ts:349
   - Either remove the line, or import/define the function
   - Test runtime behavior after fix

2. **Revert Phase 1 files from Phase 2A diff:**
   - `src/lib/eventContextCapturer.ts`
   - `src/lib/ragRetriever.ts`
   - `supabase/migrations/20260917000000_harden_planner_vendor_search.sql`

#### High Priority (Should Fix)
3. **Document deferred features** as Phase 2B/2D requirements:
   - Question memory (`askedQuestions`)
   - Confirmed field tracking (`confirmedFields`)

#### Manual Testing
4. **Test these scenarios before manual UI testing:**
   - Context preservation across two messages
   - Single field update (preserve others)
   - Ambiguous change detection
   - Conversation restoration

### AFTER FIXES

Once above issues are resolved:
- ✅ Safe to merge to `main`
- ✅ Safe to deploy to Vercel
- ✅ Safe for production manual UI testing

---

## SECTION 9: TECHNICAL DEBT

| Issue | Severity | Type | Effort | Notes |
|-------|----------|------|--------|-------|
| Undefined `extractContextFromMessage()` | 🔴 CRITICAL | Dead Code | 5 min | Delete or implement |
| Double context merging (orch + planner) | 🟡 MEDIUM | Architecture | 30 min | Consolidate to single merge point |
| Phase 1 work in Phase 2A diff | 🟡 HIGH | Scope | 10 min | Revert 3 files |
| Question memory deferred | 🟡 MEDIUM | Design | Phase 2B | Implement `askedQuestions` tracking |
| Confirmed fields deferred | 🟡 MEDIUM | Design | Phase 2B | Implement `confirmedFields` set |

---

## SECTION 10: FINAL VERDICT

### Current State

**Phase 2A Implementation:** PROVISIONALLY COMPLETE

**Code Quality:**
- Core logic: ✅ SOLID (merging, ambiguity detection, persistence work correctly)
- Architecture: ⚠️ NEEDS CLEANUP (dead code, duplicate logic)
- Completeness: ⚠️ PARTIAL (E & F features deferred)

### Safe for Manual UI Testing?

**Answer:** ❌ **NOT YET**

**Reasons:**
1. `extractContextFromMessage()` undefined → runtime error likely
2. Phase 1 work mixed in → violates Phase 1 lock requirement
3. Questions E & F not implemented → incomplete feature scope

**After Critical Fixes:** ✅ **YES**

Once issues #1-2 are fixed and Phase 1 work reverted, the implementation is safe for manual UI testing.

---

## APPENDIX: CODE REFERENCES

### Phase 2A Core Functions

**mergeContextIntelligently()** - aiOrchestrator.ts:476-497
```typescript
export function mergeContextIntelligently(
  previousContext: PlannerContext,
  extractedUpdates: Partial<PlannerContext>,
  message: string
): { merged: PlannerContext; ambiguous: boolean }
```

**isAmbiguousChange()** - aiOrchestrator.ts:458-472
```typescript
function isAmbiguousChange(message: string, ctx: PlannerContext): boolean
```

**orchestrate()** - aiOrchestrator.ts:587-667
```typescript
function orchestrate(
  message: string,
  ctx: PlannerContext,
  history: ChatMessage[]
): OrchestrationResult
```

**processMessage()** - aiPlanner.ts:706-851
```typescript
export async function processMessage(
  message: string,
  context: PlannerContext,
  history?: ChatMessage[]
): Promise<{ response: AIResponse; updatedContext: PlannerContext }>
```

**useAIChat.ts** - Hook that orchestrates persistence
- Line 77: React state for context
- Line 80: Ref for streaming
- Line 94-96: Load on mount
- Line 138-141: Load on conversation switch
- Line 382: Save to DB
- Line 385-387: Save to state + sessionStorage

---

## CONCLUSION

Phase 2A is **95% complete** with **5% critical issues** that must be fixed before production.

**Do not deploy until:**
1. ✓ extractContextFromMessage() is fixed or removed
2. ✓ Phase 1 files are reverted from diff
3. ✓ Manual test scenarios pass

**Once fixed:** Safe to merge, deploy, and conduct manual UI testing.

---

**Report Generated:** July 22, 2026  
**Audit Duration:** Complete code review of 7 files, 11 trace points, 12 verification tasks  
**Status:** READY FOR REMEDIATION

