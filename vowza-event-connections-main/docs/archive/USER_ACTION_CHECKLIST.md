# User Action Checklist - Housewarming Bug Testing

## ✅ What's Been Done (Developer)

- [x] Added 10 trace points to code
- [x] Built and verified (no errors)
- [x] Started dev server
- [x] Created comprehensive documentation

## ⏳ What You Need to Do (User)

### Phase 1: Setup (1 minute)

- [ ] Open browser (Chrome/Firefox/Safari)
- [ ] Navigate to: http://localhost:5173
- [ ] Press F12 to open Developer Tools
- [ ] Click "Console" tab
- [ ] Scroll console to top

### Phase 2: Execute Test (2 minutes)

- [ ] In the Planner chat box, type exactly: `Plan a housewarming for 30 people`
- [ ] Press Enter
- [ ] Wait for response from Planner
- [ ] Wait for [TRACE ...] messages to appear in console

### Phase 3: Capture Evidence (2 minutes)

- [ ] Take screenshot of browser console showing all [TRACE ...] messages
- [ ] Take screenshot of Planner response in chat
- [ ] Note the exact values you see in console

### Phase 4: Report Results (1 minute)

In your message to me, provide:
- [ ] Screenshot of console (all [TRACE ...] visible)
- [ ] Screenshot of Planner response
- [ ] Exact eventType value at each TRACE point

**Example format:**
```
TRACE 0A-DETAIL eventType: "housewarming"
TRACE 0A-FINAL eventType: "housewarming"
TRACE 0B-AFTER eventType: "housewarming"
TRACE 1 contextToUseEventType: "housewarming"
TRACE 2 contextEventType: ??? (what you see)
TRACE 2-DETAIL missingFields: ??? (what you see)
TRACE 3 nextQuestion: ??? (if question shown)
```

---

## Total Time Required: 5-10 minutes

The test itself takes 2-3 minutes to execute.
Screenshots and reporting takes another 3-5 minutes.

---

## Important: What NOT to Do

❌ Don't modify any code
❌ Don't try to fix anything manually
❌ Don't make assumptions about the cause
❌ Don't skip the screenshots

---

## After You Submit

Once you provide screenshots and values:

1. **Developer analyzes** (2 min)
   - Identifies exact root cause
   - Determines which file to fix

2. **Developer creates fix** (5 min)
   - One file modified
   - 1-3 lines of actual code change

3. **Developer removes traces** (5 min)
   - All logging cleaned up
   - Code ready for production

4. **You test fix** (optional)
   - Verify "housewarming" now works
   - Test other event types too

5. **Production ready** (total ~20 min)
   - No debug code
   - Clean deployment

---

## Ready?

▶️ **Start Now:**
1. Open Planner in browser
2. Press F12
3. Click Console
4. Type: `Plan a housewarming for 30 people`
5. Press Enter
6. Screenshot console
7. Send screenshot

That's it!

---

## Questions?

- **How to test?** → Read: `TEST_INSTRUCTIONS_HOUSEWARMING.md`
- **Why this approach?** → Read: `EXECUTIVE_SUMMARY.md`  
- **What's being traced?** → Read: `HOUSEWARMING_BUG_ROOT_CAUSE_TRACE.md`

---

## Verify Your Setup

Before testing, verify:
- ✅ Browser is open
- ✅ Vowza Planner loaded (http://localhost:5173)
- ✅ Developer Tools opened (F12)
- ✅ Console tab active
- ✅ Console is empty or scrolled to top

**Then:** Type test message and press Enter

---

## Expected Console Output

You should see messages like:
```
[TRACE 0A-DETAIL - Event Type Extraction] {
  extractedEventType: "housewarming"
}

[TRACE 0A-FINAL - Extracted Updates] {
  eventType: "housewarming",
  guestCount: 30
}

... (more traces) ...
```

If you see `[TRACE` messages in console → instrumentation is working!

---

## Send These 3 Things

When reporting results, provide:

1. **Console Screenshot**
   - Show all [TRACE ...] messages
   - Show exact values

2. **UI Screenshot**  
   - Show Planner response
   - Show if question was asked

3. **Event Type Values**
   - Create simple table or list
   - Show eventType at each trace point

---

## Time Breakdown

| Task | Time |
|------|------|
| Open browser & console | 1 min |
| Type message & wait | 1 min |
| Screenshot console | 1 min |
| Screenshot UI | 1 min |
| Report results | 1 min |
| **Total** | **5 min** |

---

✅ **You're All Set!**

**Next:** Follow the steps above and report results.
