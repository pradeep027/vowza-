# Housewarming EventType Bug - Complete Root Cause Trace

## Problem Statement
User inputs: **"Plan a housewarming for 30 people"**

Current (WRONG) behavior:
- Planner asks: "What type of event are you planning?"
- This is incorrect - user explicitly provided "housewarming"

Expected (CORRECT) behavior:
- Planner should recognize "housewarming" as eventType
- Should ask for missing essentials (city, budget) instead

## Investigation Status: RUNTIME TRACE READY

All instrumentation is in place. No code has been changed. Only console logging added.

### Test Input
```
"Plan a housewarming for 30 people"
```

### Trace Chain (Sequential Execution)

```
User Input
    ↓
sendMessage() in llm.ts
    ↓
orchestrate() in aiOrchestrator.ts
    ├─ extractContextUpdates() → [TRACE 0A] Extract eventType="housewarming", guestCount=30
    ├─ mergeContextIntelligently() → [TRACE 0B] Merge extracted into context
    └─ Returns OrchestrationResult with updatedContext
    ↓
[TRACE 1] Log contextToUse before readiness check
    ↓
checkContextReadinessAndRespond() in llm.ts
    ├─ calculateContextReadiness() in eventContextCapturer.ts
    │  ├─ getEssentialQuestions() → Returns [eventType, city, budget, guestCount]
    │  ├─ getMissingEssentialFields() → [TRACE 2-DETAIL] Check which are missing
    │  └─ Calculate readiness = 50% (2/4 filled: eventType, guestCount)
    │
    ├─ [TRACE 2] Log readiness results
    │
    └─ If !isSufficient && nextQuestion:
       → [TRACE 3] Ask next question (should be "city" not "event_type")
    ↓
Return response to user
```

## Critical Decision Points

### Point 1: Event Type Extraction (extractContextUpdates)
```typescript
// Line ~570 in aiOrchestrator.ts
[/house.warm/i,'housewarming'] 
// Should match "housewarming" ✓
```

**Trace logs:**
- `[TRACE 0A-DETAIL]` → Should show extractedEventType = "housewarming"
- `[TRACE 0A-FINAL]` → Should show eventType in allUpdates

**If eventType = undefined:**
- Check regex pattern: `/house.warm/i`
- Check message.toLowerCase()
- Check eventMap iteration

### Point 2: Context Merge (mergeContextIntelligently)
```typescript
// Line ~512 in aiOrchestrator.ts
// Merge extractedUpdates into context
for (const [key, value] of Object.entries(extractedUpdates)) {
  if (value !== undefined && value !== null) {
    (merged as any)[key] = value;  // eventType should be set here
  }
}
```

**Trace logs:**
- `[TRACE 0B-BEFORE]` → Should show extractedUpdatesEventType = "housewarming"
- `[TRACE 0B-MERGE]` → Should show key="eventType", value="housewarming"
- `[TRACE 0B-AFTER]` → Should show mergedEventType = "housewarming"

**If eventType = undefined:**
- Check if ambiguous=true (would skip merge)
- Check if extractedUpdates.eventType was undefined (extraction failed)
- Check markFieldConfirmed() function

### Point 3: Context Passing (sendMessage)
```typescript
// Line ~368 in llm.ts
const contextToUse = orch.updatedContext || context;
```

**Trace logs:**
- `[TRACE 1]` → Should show contextToUseEventType = "housewarming"

**If eventType = undefined:**
- Check if orch.updatedContext is null/undefined
- Check if context is being reset somewhere
- Check context parameter passed to sendMessage()

### Point 4: Readiness Check (checkContextReadinessAndRespond)
```typescript
// Line ~271 in llm.ts
const readiness = calculateContextReadiness(context);
```

**Trace logs:**
- `[TRACE 2]` → Should show contextEventType = "housewarming"
- `[TRACE 2-DETAIL]` → Should show eventType NOT in missingFields

**If eventType = missing:**
- Check getMissingEssentialFields() logic
- Check if context.eventType is the right property
- Check if field name matches CONTEXT_QUESTIONS

### Point 5: Question Generation (formatContextQuestion)
```typescript
// Line ~285 in llm.ts (inside checkContextReadinessAndRespond)
if (!readiness.isSufficient && readiness.nextQuestion) {
  const questionText = formatContextQuestion(readiness.nextQuestion, context);
  // [TRACE 3] logs here
  // UI shows this questionText
}
```

**Trace logs:**
- `[TRACE 3]` → Should show nextQuestion = "city" or "budget" (NOT "event_type")

**If nextQuestion = "event_type":**
- Missing essentials include "eventType"
- getMissingEssentialFields() returned eventType as missing
- Root cause is in readiness calculation

## Expected Outcomes for Each Root Cause

### Root Cause A: Extraction Failed
**Symptom:** eventType = undefined in TRACE 0A
**Location:** extractContextUpdates() in aiOrchestrator.ts (~570)
**Fix:** Debug regex pattern `/house.warm/i` or message.toLowerCase()

### Root Cause B: Merge Failed
**Symptom:** eventType = "housewarming" in TRACE 0A but undefined in TRACE 0B
**Location:** mergeContextIntelligently() in aiOrchestrator.ts (~512)
**Fix:** Check if merge is being skipped (ambiguous flag) or if eventType is not being copied

### Root Cause C: Context Lost Between Merge and Readiness
**Symptom:** eventType = "housewarming" in TRACE 1 but different in TRACE 2
**Location:** Between checkContextReadinessAndRespond call and inside the function
**Fix:** Check if context parameter is being modified or if wrong context is passed

### Root Cause D: Readiness Calc Wrong
**Symptom:** eventType = "housewarming" in TRACE 2 but marked as missing
**Location:** getMissingEssentialFields() in eventContextCapturer.ts (~76)
**Fix:** Check field name matching or value checking logic

### Root Cause E: Question Generation Wrong
**Symptom:** eventType present but still asking "What type of event?"
**Location:** formatContextQuestion() or readiness logic
**Fix:** Readiness nextQuestion should be "city" not "event_type"

## How to Trace

1. Open browser → F12 → Console tab
2. Type test message: "Plan a housewarming for 30 people"
3. Look for [TRACE ...] logs
4. For each TRACE point, note the value
5. Create table:
   | Trace | eventType Value | Expected | Match |
   |-------|-----------------|----------|-------|
   | 0A-DETAIL | ? | housewarming | ✓/✗ |
   | 0B-BEFORE | ? | housewarming | ✓/✗ |
   | 0B-AFTER | ? | housewarming | ✓/✗ |
   | 1 | ? | housewarming | ✓/✗ |
   | 2 | ? | housewarming | ✓/✗ |

6. Last row with ✗ is where bug occurs
7. That function needs fixing

## Deliverables from Test

Required from user:
1. Screenshot of console showing all [TRACE ...] logs
2. Screenshot of UI response
3. Table showing eventType value at each trace point
4. Exact file/line where eventType first becomes undefined or lost

This will identify exact root cause and minimal fix location.

---

## Implementation Details for Reference

### Files with Trace Logging

**src/lib/llm.ts**
- Line ~271: checkContextReadinessAndRespond with TRACE 2, 3
- Line ~368: sendMessage with TRACE 1

**src/lib/aiOrchestrator.ts**  
- Line ~512: mergeContextIntelligently with TRACE 0B
- Line ~539: extractContextUpdates with TRACE 0A
- Line ~625: orchestrate with TRACE 0C

**src/lib/eventContextCapturer.ts**
- Line ~94: calculateContextReadiness with TRACE 2-DETAIL

### Build Status
✅ npm run build: Success (no errors)
✅ Dev server: Running (http://localhost:5173)
✅ All traces: Deployed and ready

### NO Permanent Changes
- All logging uses console.log()
- Can be removed after testing
- No business logic changed
- No database queries changed
- Fully reversible
