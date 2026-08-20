# Test Instructions - Housewarming EventType Bug Trace

## What was done
- Added comprehensive console.log statements at EVERY stage of message processing
- Built the project (build successful)
- Dev server is running

## How to run the trace test

### Step 1: Open Browser Console
1. Open the Vowza Planner in your browser (usually http://localhost:5173)
2. Press **F12** to open Developer Tools
3. Go to the **Console** tab
4. Scroll to the very top (to clear old logs)

### Step 2: Type Test Message
1. In the Planner chat, type: `Plan a housewarming for 30 people`
2. Press Enter

### Step 3: Capture Logs
1. Immediately look at the browser console
2. You should see multiple `[TRACE ...]` messages
3. **Screenshot the entire console output** showing all traces

### Step 4: Expected Trace Sequence
You should see logs in this order:
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
[TRACE 2-DETAIL - Calculation Result]
[TRACE 3 - Question Being Asked] ← Only if question is shown
```

### Step 5: Key Values to Look For

In the logs, find these specific values:

| Log | Look for | Expected | Actual |
|-----|----------|----------|--------|
| TRACE 0A-DETAIL | `extractedEventType` | `"housewarming"` | ? |
| TRACE 0A-FINAL | `eventType` in allUpdates | `"housewarming"` | ? |
| TRACE 0B-BEFORE | `extractedUpdatesEventType` | `"housewarming"` | ? |
| TRACE 0B-MERGE | `value` | `"housewarming"` | ? |
| TRACE 0B-AFTER | `mergedEventType` | `"housewarming"` | ? |
| TRACE 0C | `mergedEventType` | `"housewarming"` | ? |
| TRACE 1 | `contextToUseEventType` | `"housewarming"` | ? |
| TRACE 2 | `contextEventType` | `"housewarming"` | ? |
| TRACE 2-DETAIL-getMissing | `contextEventType` | `"housewarming"` | ? |
| TRACE 2-DETAIL-Missing | `missingFields` | Should NOT include "eventType" | ? |

### Step 6: Planner UI Response

After the logs, the Planner should show ONE of:

**GOOD (Question NOT asked):**
```
Current plan: 30 guests
Progress: 3/4 essentials
What would you like next?
```

**BAD (Question ASKED - this is the bug):**
```
What type of event are you planning?
Current plan: 30 guests
Progress: 2/4 essentials
Examples: wedding, corporate event, ...
```

## How to Provide Results

Send:
1. **Screenshot of console showing all TRACE logs**
2. **Screenshot of the Planner UI response**
3. **Exact values** for each key from the table above
4. **Whether question was asked** (YES/NO)

## Analysis

Once you provide the logs, I will:
1. Find the exact point where eventType disappears or where readiness fails
2. Identify which function has the bug
3. Create a minimal fix
4. Test the fix
5. Provide the corrected code

---

**IMPORTANT**: Do NOT manually edit any code. Just capture the console logs and tell me what you see.
