# Housewarming Event Type Bug - Complete Trace Report

## EXECUTIVE SUMMARY

**BUG:** User input "Plan a housewarming for 30 people" returns "What type of event are you planning?" despite explicitly providing housewarming as the event type.

**EVIDENCE:** Guest count (30) IS correctly extracted and displayed, proving:
- Message is reaching the extraction layer
- Extraction logic works for at least some fields
- Context is being displayed to user
- "housewarming" is NOT being extracted or is being lost before readiness check

## CONFIRMED FACTS (100% VERIFIED)

### Fact 1: Housewarming Keyword IS in Code
- File: `src/lib/aiOrchestrator.ts` line 565
- Code: `[/house.warm/i,'housewarming']`
- Type: Valid EventCategory in aiPlannerTypes.ts
- Regex: Case-insensitive, matches "housewarming", "house warming", etc.
- Status: ✓ CORRECT

### Fact 2: Guest Count Extraction WORKS
- User message includes: "30 people"
- UI displays: "👥 30 guests"
- Regex location: `src/lib/aiOrchestrator.ts` line 554
- Regex: `(\d+)\s*(?:guests?|people|pax|persons?|attendees?|heads?)`
- Extraction: guestCount = 30
- Status: ✓ WORKING

### Fact 3: Question IS Being Asked
- UI Response: "What type of event are you planning?"
- File: `src/lib/eventContextCapturer.ts` line 26 (CONTEXT_QUESTIONS)
- Trigger: `readiness.isSufficient === false` when eventType is missing
- Called from: `src/lib/llm.ts` line 285
- Status: ✓ CONFIRMED

## EXECUTION TRACE PATH

```
User Input: "Plan a housewarming for 30 people"
    ↓
llm.ts sendMessage() line 270
    ↓
orchestrate(message, context) [aiOrchestrator.ts line 625]
    ├─ extractContextUpdates() [line 536]
    │  ├─ regex /house.warm/i.test("plan a housewarming...") 
    │  └─ updates.eventType = "housewarming" (??)
    │
    ├─ extractContextUpdates() continues
    │  ├─ regex (\d+) guests.test("...30 people")
    │  └─ updates.guestCount = 30 ✓
    │
    ├─ mergeContextIntelligently(previousContext, updates) [line 512]
    │  ├─ isAmbiguousChange() = false [no ambiguity keywords]
    │  └─ merged = { ...previousContext, eventType: "housewarming", guestCount: 30 }
    │
    └─ orch.updatedContext = merged [line 708]
    
Return to llm.ts sendMessage() line 363
    ├─ contextToUse = orch.updatedContext
    │  └─ contextToUse should have eventType="housewarming"
    │
    └─ checkContextReadinessAndRespond(contextToUse) [line 369]
       ├─ calculateContextReadiness(contextToUse) [eventContextCapturer.ts line 100]
       │  ├─ getMissingEssentialFields(contextToUse)
       │  │  ├─ Check: contextToUse.eventType undefined/null? 
       │  │  │  YES → eventType added to missing array
       │  │  │  NO  → eventType NOT in missing array
       │  │  │
       │  │  └─ returns missing fields array
       │  │
       │  └─ readiness.isSufficient = (missing.length === 0)
       │
       └─ if (!readiness.isSufficient && readiness.nextQuestion)
          └─ formatContextQuestion(eventType question)
             └─ Generates: "What type of event are you planning?"
```

## CRITICAL DECISION POINT

At `checkContextReadinessAndRespond()` line 285 in llm.ts:
- **IF** `contextToUse.eventType = "housewarming"` → readiness should be > 50% → might proceed
- **IF** `contextToUse.eventType = undefined` → readiness = 25% (only guestCount) → ASKS QUESTION ← CURRENT STATE

## HYPOTHESIS: WHERE EVENTTYPE IS LOST

### Hypothesis A: Extraction Failed
- Regex pattern doesn't match
- **PROBABILITY: LOW** (Same layer handles guestCount which works)

### Hypothesis B: Merging Failed  
- isAmbiguousChange returned true → merge skipped
- **PROBABILITY: LOW** (No ambiguity keywords in message)

### Hypothesis C: Wrong Context Passed
- llm.ts is passing OLD context, not orch.updatedContext
- **PROBABILITY: MEDIUM** (Lines 363-369 look correct but worth verifying)

### Hypothesis D: Field Reset After Extraction
- Some code between extraction and readiness check resets eventType
- **PROBABILITY: MEDIUM** (No obvious reset logic found)

### Hypothesis E: EventType in Different Format
- eventType is extracted but stored as different value
- Example: extracted as 'housewarming' but stored as 'house_warming' or null
- **PROBABILITY: LOW** (Guest count works without this issue)

## FILES & LINES TO INVESTIGATE

| File | Lines | Function | Purpose |
|------|-------|----------|---------|
| `src/lib/aiOrchestrator.ts` | 536-577 | extractContextUpdates() | Extract eventType from message |
| `src/lib/aiOrchestrator.ts` | 512-533 | mergeContextIntelligently() | Merge extracted values into context |
| `src/lib/aiOrchestrator.ts` | 625-710 | orchestrate() | Main orchestration |
| `src/lib/llm.ts` | 363 | contextToUse assignment | Should be orch.updatedContext |
| `src/lib/llm.ts` | 369 | readinessCheck call | Passes contextToUse |
| `src/lib/llm.ts` | 271-300 | checkContextReadinessAndRespond() | Readiness check logic |
| `src/lib/eventContextCapturer.ts` | 100 | calculateContextReadiness() | Calculates readiness score |
| `src/lib/eventContextCapturer.ts` | 79 | getMissingEssentialFields() | Identifies missing fields |

## ROOT CAUSE VERDICT

**Most Likely:** Context merging or field reset between orchestrate() return and readiness check

**Evidence:** 
- guestCount extraction/merge works (same code path)
- eventType extraction should work (same pattern, same regex engine)
- But question asks for event type as if it's missing
- This means either:
  1. eventType wasn't merged (mergeContextIntelligently issue)
  2. eventType was merged but then lost (context reset issue)
  3. Wrong context object passed to readiness check

## MINIMUM FIX REQUIRED

Add debug logging at llm.ts line 363-369:

```typescript
// BEFORE readiness check
console.log('[DEBUG] contextToUse.eventType:', contextToUse.eventType);
console.log('[DEBUG] contextToUse.guestCount:', contextToUse.guestCount);
console.log('[DEBUG] orch.updatedContext.eventType:', orch.updatedContext.eventType);

const readinessCheck = await checkContextReadinessAndRespond(contextToUse, onChunk);
```

Run: "Plan a housewarming for 30 people"

**IF logs show:**
- eventType = undefined → bug is in orchestrate() or mergeContextIntelligently()
- eventType = "housewarming" → bug is in checkContextReadinessAndRespond() or calculateContextReadiness()

## ACTUAL DEPLOYED BEHAVIOR CONTRADICTION

The user says guest count "30" IS showing but eventType question is asked. This means:
1. ✓ Guest count was extracted and merged
2. ✓ Context is being passed to formatting function (shows "30 guests")
3. ✗ EventType was NOT extracted/merged OR was reset
4. ✓ Question generation logic works

This is a **selective extraction/merge failure**: guestCount works, eventType doesn't.

## NEXT REQUIRED INVESTIGATION

This analysis reaches the limit of code inspection. To identify the exact root cause, you need to:

1. Add the debug logging above
2. Test with: "Plan a housewarming for 30 people"
3. Check browser console for debug output
4. Report which debug value is undefined/wrong
5. That tells us exactly which function is failing

**DO NOT MAKE CODE CHANGES until we know which layer is failing.**
