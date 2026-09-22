# ✅ HOUSEWARMING BUG - READY FOR RUNTIME TRACE TEST

## What Has Been Done

### ✅ Comprehensive Instrumentation
- Added 10 trace points across 4 critical files
- Traces cover: extraction → merge → orchestration → readiness → question generation
- All console.log statements ready
- Build successful (no errors)
- Dev server running

### ✅ Documentation Created
1. `HOUSEWARMING_BUG_ROOT_CAUSE_TRACE.md` - Complete trace flow diagram
2. `RUNTIME_TRACE_INSTRUMENTATION.md` - Detailed trace point documentation
3. `TEST_INSTRUCTIONS_HOUSEWARMING.md` - Step-by-step user guide
4. `TRACE_IMPLEMENTATION_SUMMARY.md` - Technical implementation details
5. This file - Quick action checklist

### ✅ No Code Logic Changes
- Only console.log() statements added
- No business logic modified
- No database queries changed
- Fully reversible
- Safe to test in production

## What You Need to Do

### STEP 1: Open Browser Console
```
1. Navigate to Vowza Planner (http://localhost:5173)
2. Press F12 to open Developer Tools
3. Click "Console" tab
4. Scroll to top to clear old logs
```

### STEP 2: Type Test Message
```
In the Planner chat, type exactly:
"Plan a housewarming for 30 people"

Then press Enter
```

### STEP 3: Capture Console Output
```
1. Look for [TRACE ...] messages
2. Screenshot entire console area showing:
   - All [TRACE ...] messages
   - Their exact values
   - Their order
3. Also screenshot the Planner response
```

### STEP 4: Report Results
Provide:
1. Screenshot of console (all traces visible)
2. Screenshot of Planner response
3. One of these:
   - eventType IS "housewarming" at all stages → go to SCENARIO B
   - eventType is "undefined" somewhere → go to SCENARIO A
   - Question shows "What type of event?" → go to SCENARIO C

## Expected Behavior

### If Bug is Triggered (Current State)
Console shows:
```
[TRACE 0A-DETAIL - Event Type Extraction] { extractedEventType: "housewarming" }
[TRACE 0A-FINAL - Extracted Updates] { eventType: "housewarming", guestCount: 30 }
[TRACE 0B-DETAIL-AFTER] { mergedEventType: "housewarming", mergedGuestCount: 30 }
[TRACE 1 - After Orchestration] { contextToUseEventType: "housewarming" }
[TRACE 2 - Readiness Check] { contextEventType: ???, isSufficient: ??? }
[TRACE 3 - Question Being Asked] { nextQuestion: "event_type" }  ← BUG!
```

UI Response:
```
What type of event are you planning?
Current plan: 30 guests
Progress: 2/4 essentials
Examples: wedding, corporate event, ...
```

## Diagnostic Scenarios

### SCENARIO A: eventType = undefined somewhere
**Pattern:** TRACE shows eventType = undefined after extraction or merge

**Root cause could be:**
1. Regex pattern doesn't match "housewarming"
2. Message normalization strips the keyword
3. Merge operation skips eventType
4. Context is reset before readiness check

**Next:** Need to examine exact TRACE point where it disappears

### SCENARIO B: eventType = "housewarming" everywhere
**Pattern:** All TRACEs show eventType = "housewarming" but question still asked

**Root cause could be:**
1. Readiness calculation doesn't recognize eventType
2. CONTEXT_QUESTIONS field name doesn't match
3. Question generation logic is wrong
4. Frontend state is stale

**Next:** Need to check getMissingEssentialFields() logic

### SCENARIO C: eventType present but wrong question
**Pattern:** eventType is set but question asks for event_type instead of city/budget

**Root cause could be:**
1. readiness.nextQuestion is wrong
2. formatContextQuestion() using wrong field
3. Question ordering is incorrect

**Next:** Need to check determineNextQuestion() logic

## Quick Reference

| File | Line | Function | Purpose |
|------|------|----------|---------|
| llm.ts | ~368 | sendMessage | TRACE 1 - After orchestration |
| llm.ts | ~271-300 | checkContextReadinessAndRespond | TRACE 2, 3 - Readiness & question |
| aiOrchestrator.ts | ~539-600 | extractContextUpdates | TRACE 0A - Extraction |
| aiOrchestrator.ts | ~512-560 | mergeContextIntelligently | TRACE 0B - Merge |
| aiOrchestrator.ts | ~625-700 | orchestrate | TRACE 0C - Orchestration |
| eventContextCapturer.ts | ~94-140 | calculateContextReadiness | TRACE 2-DETAIL - Readiness calc |

## What NOT to Do

❌ Don't manually edit code yet
❌ Don't assume the cause
❌ Don't skip providing console screenshots
❌ Don't modify vendor search logic
❌ Don't deploy these changes

## After Testing

Once you provide the console logs:

1. I will identify exact root cause
2. I will create minimal 1-file fix
3. I will remove all trace logging
4. I will rebuild and verify fix
5. You will verify it works
6. Ready for production

---

## Start Testing Now

**Ready?** Go to: `TEST_INSTRUCTIONS_HOUSEWARMING.md`

**Questions?** Review: `HOUSEWARMING_BUG_ROOT_CAUSE_TRACE.md`

**Technical details?** See: `TRACE_IMPLEMENTATION_SUMMARY.md`

---

**This trace will definitively identify the root cause. No guessing. No assumptions. Just facts from the runtime.**
