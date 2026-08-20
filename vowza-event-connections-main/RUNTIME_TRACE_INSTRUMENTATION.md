# Runtime Trace Instrumentation for Housewarming Bug

## Objective
Trace the exact execution flow for user input: **"Plan a housewarming for 30 people"**

Identify WHERE and WHY the eventType is lost between extraction and readiness check.

## Instrumentation Added

### 1. TRACE 0A - Extraction Phase (extractContextUpdates)
**File:** `src/lib/aiOrchestrator.ts` (line ~560)
**What it logs:**
- User message received
- Normalized message
- All extracted updates from regex patterns
- Specific event type extraction with matched regex pattern
- Final extracted updates object including eventType, guestCount, city, budget

**Expected output for "Plan a housewarming for 30 people":**
```
[TRACE 0A-DETAIL - Event Type Extraction]: {
  message: "Plan a housewarming for 30 people",
  matchedRegex: "/house.warm/i",
  extractedEventType: "housewarming"
}

[TRACE 0A-FINAL - Extracted Updates]: {
  eventType: "housewarming",
  guestCount: 30,
  allUpdates: { eventType: "housewarming", guestCount: 30 }
}
```

### 2. TRACE 0B - Merge Phase (mergeContextIntelligently)
**File:** `src/lib/aiOrchestrator.ts` (line ~512)
**What it logs:**
- Pre-merge state (previousContext.eventType vs extractedUpdates.eventType)
- Whether merge is ambiguous
- Per-field merge operations (especially eventType)
- Post-merge state

**Expected output:**
```
[TRACE 0B-DETAIL-BEFORE - Pre-Merge State]: {
  previousContextEventType: undefined,
  extractedUpdatesEventType: "housewarming",
  ambiguous: false
}

[TRACE 0B-DETAIL-MERGE - Merging eventType]: {
  key: "eventType",
  value: "housewarming",
  mergedEventType: "housewarming"
}

[TRACE 0B-DETAIL-AFTER - Post-Merge State]: {
  mergedEventType: "housewarming",
  mergedGuestCount: 30
}
```

### 3. TRACE 0C - Orchestration Decision (orchestrate)
**File:** `src/lib/aiOrchestrator.ts` (line ~625)
**What it logs:**
- Intent classification
- Next question determination
- Response strategy assignment
- Merged context eventType

**Expected output:**
```
[TRACE 0C - Orchestration Decision]: {
  intent: "plan_event",
  nextQuestion: undefined (or null if eventType sufficient),
  mergedEventType: "housewarming"
}
```

### 4. TRACE 1 - Context After Orchestration (sendMessage)
**File:** `src/lib/llm.ts` (line ~368)
**What it logs:**
- orchestrate() result
- contextToUse assignment
- Both eventType values before readiness check

**Expected output:**
```
[TRACE 1 - After Orchestration]: {
  userMessage: "Plan a housewarming for 30 people",
  orchestrateUpdatedContextEventType: "housewarming",
  contextToUseEventType: "housewarming"
}
```

### 5. TRACE 2 - Readiness Check (checkContextReadinessAndRespond)
**File:** `src/lib/llm.ts` (line ~271)
**What it logs:**
- Input context properties
- Readiness calculation result
- Missing essentials
- Next question

**Expected output:**
```
[TRACE 2 - Readiness Check]: {
  contextEventType: "housewarming",
  contextGuestCount: 30,
  readinessScore: 50 (or higher if eventType counted),
  isSufficient: true (if eventType accepted)
}
```

### 6. TRACE 2-DETAIL - Readiness Calculation Details (calculateContextReadiness)
**File:** `src/lib/eventContextCapturer.ts` (line ~94)
**What it logs:**
- Which fields are considered essential
- Which fields are missing
- Readiness calculation breakdown

**Expected output:**
```
[TRACE 2-DETAIL - getMissingEssentialFields]: {
  contextEventType: "housewarming",
  contextGuestCount: 30,
  essentialsFields: ["eventType", "guestCount", "city", "budget"],
  missingFields: ["city", "budget"] (or [] if eventType counted)
}
```

### 7. TRACE 3 - Question Generation (checkContextReadinessAndRespond)
**File:** `src/lib/llm.ts` (line ~285)
**What it logs:**
- Question that will be displayed
- Context values when question is being asked

**Expected output IF BUG OCCURS:**
```
[TRACE 3 - Question Being Asked]: {
  nextQuestion: "event_type",
  questionText: "What type of event are you planning?...",
  contextEventType: undefined (BUG) OR "housewarming" (OK)
}
```

## Testing Procedure

1. **Open browser console** (F12 → Console tab)
2. **Filter for traces**: Search for `TRACE` in console
3. **Input message**: "Plan a housewarming for 30 people"
4. **Expected sequence**: TRACE 0A → TRACE 0B → TRACE 0C → TRACE 1 → TRACE 2 → TRACE 2-DETAIL
5. **If question appears**: Also check for TRACE 3

## Root Cause Diagnosis

### Scenario A: eventType = undefined at TRACE 1
- **Root cause**: Extraction or merge failed
- **Bug location**: extractContextUpdates() or mergeContextIntelligently()
- **Investigation**: Check TRACE 0A and 0B logs

### Scenario B: eventType = "housewarming" at TRACE 1, but question still asked
- **Root cause**: Readiness check or question generation logic
- **Bug location**: calculateContextReadiness() or getMissingEssentialFields()
- **Investigation**: Check TRACE 2 and 2-DETAIL logs

### Scenario C: eventType = "housewarming" at all traces, but question shown
- **Root cause**: Frontend state, stale UI, or answer caching issue
- **Bug location**: React component state or conversation history
- **Investigation**: Check if context is being passed correctly to UI components

## Critical Values to Compare

| Stage | Variable | Expected | Actual |
|-------|----------|----------|--------|
| Extraction | extractedUpdates.eventType | "housewarming" | ? |
| Merge | merged.eventType | "housewarming" | ? |
| Orchestration | merged.eventType | "housewarming" | ? |
| SendMessage | contextToUse.eventType | "housewarming" | ? |
| Readiness | context.eventType | "housewarming" | ? |
| Readiness | isSufficient | true | ? |
| Question | nextQuestion | undefined/null | ? |

## Next Steps After Collecting Logs

1. Screenshot browser console showing all TRACE logs
2. Identify exact value mismatch
3. Trace backwards to root cause function
4. Minimal code fix only to that function
5. Rebuild and re-test
6. Verify fix works for other event types
7. Remove all TRACE logging
