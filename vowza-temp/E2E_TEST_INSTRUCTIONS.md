# End-to-End Runtime Verification Tests

## Build Status
✅ Build successful - ready for testing

## How to Execute Tests

### Prerequisites
1. Dev server should be running at http://localhost:5173
2. Browser console (F12) should be open on the Console tab
3. Each test requires a NEW conversation (refresh page or clear history)

---

## TEST 1: HOUSEWARMING

**Steps:**
1. Open http://localhost:5173 in browser
2. Press F12 → Console tab
3. Clear any old messages
4. Type exactly: `Plan a housewarming for 30 people`
5. Press Enter
6. Wait for response
7. Screenshot console showing logs starting with `[E2E-TEST]` and `[TRACE 1]`

**What to verify in console:**
- `[E2E-TEST] Event extracted: { message: "Plan a housewarming for 30 people", regex: "...", extractedEventType: "housewarming" }`
- `[TRACE 1 - After Orchestration]: { orchestrateIntentEventType: "housewarming", contextToUseEventType: "housewarming", contextToUseGuestCount: 30, ... }`

**UI verification:**
- Response should NOT contain "What type of event are you planning?"
- Response should be appropriate for housewarming (not wedding-specific)
- No mention of: haldi, mehendi, sangeet, bridal photography, wedding-specific items

**Expected Pass Condition:**
- extractedEventType = "housewarming"
- contextToUseEventType = "housewarming"
- contextToUseGuestCount = 30
- No event-type question asked
- Housewarming-appropriate response

---

## TEST 2: BIRTHDAY

**Steps:**
1. Refresh page (new conversation)
2. Open console (F12)
3. Type: `Plan a birthday party for 50 people`
4. Press Enter
5. Screenshot console

**Expected Pass Condition:**
- extractedEventType = "birthday"
- contextToUseEventType = "birthday"
- contextToUseGuestCount = 50
- Response is birthday-appropriate, NOT wedding-focused

---

## TEST 3: BABY SHOWER

**Steps:**
1. Refresh page (new conversation)
2. Open console (F12)
3. Type: `Plan a baby shower for 40 people`
4. Press Enter
5. Screenshot console

**Expected Pass Condition:**
- extractedEventType = "babyshower"
- contextToUseEventType = "babyshower"
- contextToUseGuestCount = 40
- Response is baby-shower-appropriate

---

## TEST 4: COLLEGE EVENT

**Steps:**
1. Refresh page (new conversation)
2. Open console (F12)
3. Type: `Plan a college event for 200 students`
4. Press Enter
5. Screenshot console

**Expected Pass Condition:**
- extractedEventType = "collegefest"
- contextToUseEventType = "collegefest"
- contextToUseGuestCount = 200
- Response is college-event-appropriate

---

## TEST 5: HOUSEWARMING MULTI-TURN

**Steps:**
1. Refresh page (new conversation)
2. Open console (F12)
3. Type message 1: `Plan a housewarming for 30 people`
4. Press Enter, wait for response
5. Type message 2: `In Hyderabad`
6. Press Enter, wait for response
7. Type message 3: `What vendors do I need?`
8. Press Enter
9. Screenshot console showing all logs

**What to verify:**
- After message 1: extractedEventType = "housewarming", guestCount = 30
- After message 2: context still has eventType = "housewarming", guestCount = 30, AND city = "Hyderabad"
- After message 3: vendor recommendations are housewarming-appropriate
- NO wedding-specific vendors returned (no haldi decorators, mehendi artists, etc.)

**Expected Pass Condition:**
- Multi-turn context preserved
- eventType = "housewarming" maintained across turns
- guestCount = 30 maintained
- city = "Hyderabad" added in turn 2
- Vendor recommendations are for housewarming (not wedding)

---

## What to Look For

### Good Console Output Example
```
[E2E-TEST] Event extracted: { 
  message: "Plan a housewarming for 30 people", 
  regex: "\\bhouse\\s*[-]?\\s*warming\\b", 
  extractedEventType: "housewarming" 
}

[TRACE 1 - After Orchestration]: {
  userMessage: "Plan a housewarming for 30 people",
  orchestrateIntent: "plan_event",
  orchestrateIntentEventType: "housewarming",
  orchestrateUpdatedContextGuestCount: 30,
  contextToUseEventType: "housewarming",
  contextToUseGuestCount: 30,
  contextToUseCity: undefined,
  intent: "plan_event"
}
```

### BAD Console Output (indicates failure)
```
[E2E-TEST] Event extracted: { 
  extractedEventType: undefined 
}
```
OR
```
[TRACE 1] contextToUseEventType: undefined
```

---

## Reporting

After all 5 tests, provide:

### TEST 1: HOUSEWARMING
- Status: PASS / FAIL
- Evidence: Console screenshot
- extractedEventType value: ___
- contextToUseEventType value: ___
- guestCount: ___
- Response contains "What type of event": YES / NO
- Response is housewarming-appropriate: YES / NO

### TEST 2: BIRTHDAY
- Status: PASS / FAIL
- Evidence: Console screenshot
- extractedEventType: ___
- contextToUseEventType: ___
- guestCount: ___

### TEST 3: BABY SHOWER
- Status: PASS / FAIL
- Evidence: Console screenshot
- extractedEventType: ___
- contextToUseEventType: ___
- guestCount: ___

### TEST 4: COLLEGE EVENT
- Status: PASS / FAIL
- Evidence: Console screenshot
- extractedEventType: ___
- contextToUseEventType: ___
- guestCount: ___

### TEST 5: HOUSEWARMING MULTI-TURN
- Status: PASS / FAIL
- Evidence: Console screenshot (all 3 turns)
- Final eventType: ___
- Final guestCount: ___
- Final city: ___
- Vendors are housewarming-appropriate: YES / NO
- Vendors include wedding-specific items: YES / NO

---

## Key Points

✅ Use EXACTLY the test messages provided
✅ Use NEW conversation for each test (refresh page)
✅ Open console BEFORE typing message
✅ Look for `[E2E-TEST]` and `[TRACE 1]` logs
✅ Screenshot the console output
✅ Check UI response as well as console logs
✅ Do NOT assume pass until you verify all values
✅ If eventType shows as undefined, stop and report the value

---

**Ready to test?** Open browser, refresh, press F12, and start TEST 1.
