# ROOT CAUSE ANALYSIS: Housewarming Event Type Not Being Recognized

## USER INPUT
```
"Plan a housewarming for 30 people"
```

## ACTUAL UI RESPONSE
```
What type of event are you planning?
Current plan: 👥 30 guests
Progress: 1/4 essentials
Examples: _wedding_, _corporate event_, _birthday party_, _engagement_, _anniversary_, _gruhapravesam_
```

## ISSUE
The planner asks "What type of event are you planning?" despite the user explicitly providing "housewarming". The guest count (30) IS captured correctly, proving partial extraction works.

## EXECUTION FLOW TRACED

### STEP 1: Message Entry → llm.ts sendMessage()
- User input: "Plan a housewarming for 30 people"
- Calls orchestrate() from aiOrchestrator.ts

### STEP 2: orchestrate() in aiOrchestrator.ts line 625
- Calls extractContextUpdates() which tests regex patterns
- eventMap line 565: `[/house.warm/i,'housewarming']`
- Expected result: updates.eventType = 'housewarming' ✓
- Guest count regex line 554: `(\d+)\s*(?:guests?|people|pax|persons?|attendees?|heads?)`
- Expected result: updates.guestCount = 30 ✓

### STEP 3: mergeContextIntelligently() in aiOrchestrator.ts line 512
- Merges extracted updates into previousContext
- Should result in merged.eventType = 'housewarming'
- Should result in merged.guestCount = 30
- Returns: { merged, ambiguous: false }

### STEP 4: orchestrate() continues
- Sets orch.updatedContext = merged (which should have eventType='housewarming')
- Line 706: `shouldAskNext: responseStrategy === 'ask_question' ? nextQuestion : null`
- Note: nextQuestion is determined by determineNextQuestion()

### STEP 5: Return to llm.ts sendMessage() line 363
- `const contextToUse = orch.updatedContext || context;`
- contextToUse should have eventType='housewarming' and guestCount=30

### STEP 6: Readiness Check - llm.ts line 369
```typescript
if (orch.intent !== 'find_vendors') {
  const readinessCheck = await checkContextReadinessAndRespond(contextToUse, onChunk);
  if (!readinessCheck.shouldContinue && readinessCheck.response) {
    return readinessCheck.response;  // ← RETURNS EARLY HERE
  }
}
```

### STEP 7: checkContextReadinessAndRespond() - llm.ts line 271
- Calls calculateContextReadiness(contextToUse) from eventContextCapturer.ts line 100
- calculateContextReadiness checks: eventContextCapturer.ts line 79

```typescript
export function getMissingEssentialFields(context: PlannerContext): ContextQuestion[] {
  return getEssentialQuestions().filter(q => {
    const value = context[q.field];  // ← Checks context.eventType, context.city, etc.
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'number' && value === 0) return true;
    return false;
  });
}
```

### STEP 8: Question Generation
- If eventType is in missing fields, readiness.nextQuestion = CONTEXT_QUESTIONS[0] (eventType question)
- Line 285: `const questionText = formatContextQuestion(readiness.nextQuestion, context);`
- Generates: "What type of event are you planning?" with Current plan showing only guests

## CRITICAL FINDINGS

### Fact A: Guest count IS extracted
- The UI shows "👥 30 guests" 
- This proves guestCount extraction works
- eventMap line 554 regex works: `(\d+)\s*(?:guests?|people|pax...)`

### Fact B: eventType SHOULD be extracted
- eventMap line 565: `/house.warm/i` should match "housewarming" ✓
- EventCategory union type includes "housewarming" ✓
- Regex is case-insensitive (i flag) ✓
- "Plan a housewarming for 30 people" contains "housewarming" ✓

### Fact C: Probability Analysis
Since guestCount IS working, there are only 3 possibilities:
1. eventType extraction FAILED (unlikely - same pattern as guestCount)
2. eventType merging FAILED (ambiguity check or context reset)
3. eventType is being OVERWRITTEN or RESET somewhere

## ROOT CAUSE HYPOTHESIS

**The issue is likely in calculateContextReadiness or the context being passed to it.**

Potential causes:
1. **Field naming mismatch**: eventContextCapturer.ts checks for 'eventType' but contextToUse might not have it populated
2. **Old context being used**: An older context object (without the extracted eventType) is passed to checkContextReadinessAndRespond instead of orch.updatedContext
3. **Context reset**: Some code path resets the context between extraction and readiness check
4. **Type coercion issue**: eventType is set but to an invalid value that fails the "empty check"

## FILES INVOLVED

### Primary Files in Request Flow:
1. **llm.ts** (lines 273-395) - Main logic for readiness check and response
2. **aiOrchestrator.ts** (lines 625-710) - orchestrate() function that extracts and merges
3. **eventContextCapturer.ts** (lines 79-110) - Readiness calculation logic
4. **aiPlannerTypes.ts** (lines 15-45) - Type definitions

### Key Functions:
- `orchestrate()` → extractContextUpdates() → eventType='housewarming'
- `orchestrate()` → mergeContextIntelligently() → merged.eventType should equal 'housewarming'
- `checkContextReadinessAndRespond()` → calculateContextReadiness() → checks if eventType exists
- `calculateContextReadiness()` → getMissingEssentialFields() → returns eventType as missing

## NEXT STEPS FOR FIX

### Option 1: Add Debug Logging
Log contextToUse.eventType value before passing to checkContextReadinessAndRespond()

###  Option 2: Use Correct Readiness Calculator
Check if there are TWO different readiness calculators and use the correct one:
- calculateContextReadiness() in eventContextCapturer.ts (used in llm.ts)
- calculatePlanningReadiness() in aiOrchestrator.ts (might be the new version)

### Option 3: Verify Context Merging
Ensure mergeContextIntelligently is actually merging the extracted eventType into the context object

### Option 4: Check for Earlier Return
Verify that the code path reaches checkContextReadinessAndRespond() and doesn't return earlier

## MINIMAL PROPOSED FIX

In llm.ts line 369, add logging:
```typescript
console.log('[TRACE] contextToUse.eventType before readiness check:', contextToUse.eventType);
const readinessCheck = await checkContextReadinessAndRespond(contextToUse, onChunk);
```

Then run "Plan a housewarming for 30 people" and check console for the eventType value.

If eventType is undefined there, the bug is in orchestrate() or mergeContextIntelligently().
If eventType has the correct value but question is still asked, the bug is in checkContextReadinessAndRespond() or calculateContextReadiness().
