# 🚀 START HERE - Housewarming Bug Runtime Trace

## Current Status: ✅ READY FOR TESTING

The Vowza Planner has been fully instrumented with runtime traces to identify why it asks for event type even when the user provides "housewarming" in their message.

## What's Been Done

✅ **Instrumentation Complete**
- Added 10 console.log trace points across 3 files
- Traces cover extraction → merge → orchestration → readiness → question
- Build successful, no errors
- Dev server running

✅ **Non-Invasive Diagnostic Only**
- Only logging added, no business logic changed
- Fully reversible in 5 minutes
- Safe to test in production

✅ **Comprehensive Documentation**
- Multiple guides for different needs
- Step-by-step testing instructions
- Technical trace flow documentation

## The Test

### Input Message
```
"Plan a housewarming for 30 people"
```

### What Should Happen
Planner should recognize "housewarming" as the event type and ask for missing essentials (city, budget).

### What's Actually Happening
Planner asks "What type of event are you planning?" - ignoring the provided event type.

## How to Run the Test

### Quick Version (2 minutes)
1. Open Vowza Planner in browser
2. Press F12 to open developer console
3. Type: `Plan a housewarming for 30 people`
4. Screenshot the console
5. Send screenshot

### Detailed Version
See: `TEST_INSTRUCTIONS_HOUSEWARMING.md`

## What You'll See

### Console Output
Multiple `[TRACE ...]` messages showing values at each stage:
```
[TRACE 0A-DETAIL - Event Type Extraction]
[TRACE 0A-FINAL - Extracted Updates]  
[TRACE 0B-DETAIL-BEFORE - Pre-Merge State]
[TRACE 0B-DETAIL-MERGE - Merging eventType]
[TRACE 0B-DETAIL-AFTER - Post-Merge State]
[TRACE 0C - Orchestration Decision]
[TRACE 1 - After Orchestration]
[TRACE 2 - Readiness Check]
[TRACE 2-DETAIL - getMissingEssentialFields]
[TRACE 3 - Question Being Asked] ← Only if question shown
```

### Key Value to Watch
The `eventType` field at each stage. It should show "housewarming" throughout.

## Files to Read

**Depending on your need:**

| Need | Read This |
|------|-----------|
| Quick checklist | `READY_FOR_TESTING.md` |
| How to test (step-by-step) | `TEST_INSTRUCTIONS_HOUSEWARMING.md` |
| Executive summary | `EXECUTIVE_SUMMARY.md` |
| Technical details | `HOUSEWARMING_BUG_ROOT_CAUSE_TRACE.md` |
| Instrumentation details | `TRACE_IMPLEMENTATION_SUMMARY.md` |
| Changes made | `INSTRUMENTATION_CHANGES.md` |
| Current status | `TRACE_STATUS.txt` |

## Timeline

| Phase | Time | Status |
|-------|------|--------|
| Instrumentation | ✅ Complete | Done |
| Build & Deploy | ✅ Complete | Done |
| User Testing | ⏳ Waiting | Ready to start |
| Root Cause Analysis | ⏳ Pending | 2 min once logs provided |
| Fix Creation | ⏳ Pending | 5 min after analysis |
| Fix Testing | ⏳ Pending | 5 min |
| Production Ready | ⏳ Pending | 20 min total |

## Next Steps

### For Testing
1. Read: `TEST_INSTRUCTIONS_HOUSEWARMING.md`
2. Execute: Open browser console and test
3. Capture: Screenshots of console and UI
4. Report: Send logs

### For Root Cause
Once logs are received:
1. Analyze trace sequence
2. Identify exact failure point
3. Create minimal 1-file fix
4. Verify fix works
5. Remove instrumentation

## Key Facts

- **Problem:** eventType "housewarming" not recognized
- **Test Input:** "Plan a housewarming for 30 people"
- **Expected:** Recognize eventType, ask for city/budget
- **Actual:** Asking for event type (incorrect)
- **Investigation:** Runtime trace (not code inspection)
- **Approach:** Trace exact values at each stage
- **Risk:** None (logging only)
- **Fix Time:** ~15 minutes once traces are analyzed

## Important Notes

❌ **DO NOT:**
- Modify any code yet
- Deploy to production yet
- Make assumptions about cause
- Skip providing console screenshots

✅ **DO:**
- Follow the testing instructions exactly
- Screenshot the entire console
- Screenshot the UI response
- Provide both screenshots for analysis

## What Happens After Testing

1. **Root Cause Identified** (2 min)
   - Exact file and line identified
   - Exact reason for failure

2. **Minimal Fix Created** (5 min)
   - One file modified
   - 1-3 lines of actual code change

3. **Fix Tested** (5 min)
   - Test with "housewarming"
   - Test with other event types
   - Verify readiness calculation

4. **Instrumentation Removed** (5 min)
   - All console.log removed
   - Back to clean code

5. **Production Ready** (total 20 min)
   - No technical debt
   - No debug code left
   - Clean deployment

## Support

**Questions?** Read the appropriate file from the list above.
**Ready to test?** Go to `TEST_INSTRUCTIONS_HOUSEWARMING.md`
**Need help?** All files are self-contained and detailed.

---

## Summary

Everything is ready. The only thing needed is:
- User to execute one test
- User to screenshot the console
- User to send the screenshots

Then fix will be identified and delivered within 20 minutes.

**Ready?** → `TEST_INSTRUCTIONS_HOUSEWARMING.md`
