# 🎯 MANUAL E2E BROWSER TEST GUIDE
## Event Isolation Verification: Housewarming + Birthday

**Objective**: Verify that the Vowza AI Planner correctly handles event-specific content with ZERO wedding contamination for non-wedding events.

**Test Date**: July 2026  
**Build Status**: ✅ Passing (0 TypeScript errors, 38+ unit tests passing)

---

## 📋 TEST SCENARIOS

### Scenario 1: HOUSEWARMING (300 guests, Hyderabad)

#### Test 1.1: User Input & Event Type Extraction
**Steps:**
1. Navigate to: `http://localhost:8080/ai-planner`
2. Enter message: `Plan a housewarming for 300 guests in Hyderabad`
3. Click send

**Expected Results:**
- ✅ Message accepted without error
- ✅ System recognizes "housewarming" as event type
- ✅ Response begins planning a housewarming (not wedding)

#### Test 1.2: Event Overview (NO Wedding Terms)
**Observe the event overview response:**

**Must CONTAIN:**
- ✅ "housewarming" or "griha" references
- ✅ Pandit/priest references
- ✅ Puja/ritual references
- ✅ "300 guests" and "Hyderabad"
- ✅ Decoration ideas for housewarming (torans, rangoli, diyas)
- ✅ Photography ideas (family inside home, house tour)

**Must NOT CONTAIN:**
- ❌ "Bride" or "Groom"
- ❌ "Baraat"
- ❌ "Mehendi" or "Haldi"
- ❌ "Sangeet"
- ❌ "Wedding ceremony" or "wedding rituals"
- ❌ "Mandap"
- ❌ "First dance"

**Screenshot Evidence**: Capture the event overview section

---

#### Test 1.3: Budget Breakdown Request
**Steps:**
1. After receiving the plan, enter: `Show me the budget breakdown for housewarming`
2. Click send

**Expected Results:**
- ✅ Budget breakdown displays without crashing
- ✅ Shows budget categories
- ✅ No "undefined" values in UI
- ✅ Budget cards render properly

**Budget Categories Must Include:**
- ✅ Pandit/Priest allocation
- ✅ Catering allocation
- ✅ Decoration allocation
- ✅ Pooja items allocation
- ✅ Photography allocation
- ✅ Cleaning & Setup allocation

**Budget Categories Must NOT Include:**
- ❌ Mehendi Artist
- ❌ Haldi Artist
- ❌ Makeup & Hair (bridal)
- ❌ Baraat/Procession

**Screenshot Evidence**: Capture budget breakdown cards showing allocations

---

#### Test 1.4: Checklist (Housewarming-Specific Tasks)
**Steps:**
1. Continue conversation: `What's on my housewarming checklist?`
2. Observe the checklist section

**Checklist Must Include:**
- ✅ "Pandit availability confirmed"
- ✅ "Auspicious muhurat time fixed"
- ✅ "Pooja items list prepared"
- ✅ "Home deep-cleaned"
- ✅ "Ritual items purchased"

**Checklist Must NOT Include:**
- ❌ "Bridal makeup trial"
- ❌ "Mehendi artist timing confirmed"
- ❌ "Bridal outfit fitting"
- ❌ "Groom outfit ready"

**Screenshot Evidence**: Capture checklist items

---

#### Test 1.5: Vendor Recommendations
**Steps:**
1. Ask: `What vendors do I need for my housewarming?`
2. Observe vendor list

**Vendors Must Include:**
- ✅ Pandit/Priest
- ✅ Rituals Specialist
- ✅ Flower Arrangements
- ✅ Photographer
- ✅ Caterer
- ✅ Decorator

**Vendors Must NOT Include:**
- ❌ Mehendi Artist
- ❌ Makeup Artist (with bridal context)
- ❌ Wedding-specific performers

**Screenshot Evidence**: Capture vendor recommendation list

---

#### Test 1.6: Full Plan Generation (NO .map() Crashes)
**Steps:**
1. Ask: `Generate my complete housewarming plan`
2. Observe the full plan rendering

**Expected Behavior:**
- ✅ Page does NOT crash
- ✅ No browser console errors (F12 → Console tab)
- ✅ No "Cannot read properties of undefined (reading 'map')" errors
- ✅ Plan displays day schedule with time slots
- ✅ All sections render: budget, timeline, checklist, vendors

**Screenshot Evidence**: 
- Capture full plan page
- Capture browser console (should be clean of errors)

---

### Scenario 2: BIRTHDAY (50 guests, Mumbai)

#### Test 2.1: User Input & Event Type Extraction
**Steps:**
1. Start new conversation
2. Enter: `Plan a birthday party for 50 people in Mumbai`
3. Click send

**Expected Results:**
- ✅ Message accepted
- ✅ System recognizes "birthday" as event type
- ✅ Response is birthday-specific (not wedding)

#### Test 2.2: Birthday Event Overview (NO Wedding Terms)
**Observe the event overview:**

**Must CONTAIN:**
- ✅ "Birthday" references
- ✅ Cake/dessert references
- ✅ Entertainment/games references
- ✅ Decoration themes (balloons, props)
- ✅ "50 guests" and "Mumbai"

**Must NOT CONTAIN:**
- ❌ "Bride" or "Groom"
- ❌ "Baraat"
- ❌ "Mehendi" or "Haldi"
- ❌ "Wedding"
- ❌ "Ceremony" (in wedding context)
- ❌ "Mandap"

**Screenshot Evidence**: Capture birthday overview

---

#### Test 2.3: Birthday Budget (NO Wedding Categories)
**Steps:**
1. Ask: `What's my birthday budget breakdown?`
2. Observe budget cards

**Budget Must Include:**
- ✅ Catering allocation
- ✅ Cake/Desserts allocation
- ✅ Entertainment/Music allocation
- ✅ Decoration allocation
- ✅ Photography allocation

**Budget Must NOT Include:**
- ❌ Mehendi Artist
- ❌ Haldi Artist
- ❌ Makeup & Hair (bridal)
- ❌ Pandit/Priest (inappropriate for birthday)

**Screenshot Evidence**: Capture birthday budget cards

---

#### Test 2.4: Birthday Checklist (NO Bridal Tasks)
**Steps:**
1. Ask: `What's on my birthday checklist?`
2. Observe checklist

**Checklist Must Include:**
- ✅ Cake ordering/customization
- ✅ Entertainment booking
- ✅ Game planning
- ✅ Decoration setup

**Checklist Must NOT Include:**
- ❌ "Bridal makeup trial"
- ❌ "Mehendi artist timing"
- ❌ "Pandit confirmation"
- ❌ "Groom outfit ready"

**Screenshot Evidence**: Capture birthday checklist

---

#### Test 2.5: Full Birthday Plan (NO Crashes)
**Steps:**
1. Ask: `Generate my complete birthday plan`
2. Observe rendering

**Expected:**
- ✅ No page crash
- ✅ Clean console (F12 → Console)
- ✅ All sections render
- ✅ No .map() errors

**Screenshot Evidence**:
- Full birthday plan page
- Clean browser console

---

## 🚨 CRITICAL VERIFICATION

### Test C1: Zero Wedding Contamination in Housewarming
**Automated Check:**
```javascript
// In browser console (F12):
// Copy-paste to verify no wedding terms in DOM:
const text = document.body.innerText.toLowerCase();
const weddingTerms = ['bride', 'groom', 'baraat', 'mehendi', 'haldi', 'mandap'];
const found = weddingTerms.filter(term => text.includes(term));
console.log('Wedding terms found:', found);
// Expected output: []
```

**Manual Check:**
- Search page with Ctrl+F for: "bride", "groom", "baraat", "mehendi"
- All searches must return: **0 results** for housewarming plan

**Screenshot Evidence**: Browser find dialog showing "0 of 0"

---

### Test C2: No .map() Crashes Across Both Events
**Steps:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Keep it open throughout all tests
4. Perform all housewarming + birthday flows

**Expected:**
- ✅ NO errors mentioning "map" or "undefined"
- ✅ NO red error messages
- ✅ All messages should be informational only

**Common Bad Errors (should NOT appear):**
- ❌ `Cannot read properties of undefined (reading 'map')`
- ❌ `TypeError: allocations is not iterable`
- ❌ `Cannot read properties of undefined (reading 'length')`

**Screenshot Evidence**: Browser console (clean, no red errors)

---

### Test C3: Context Persistence Across Multi-Turn Conversation
**Steps:**
1. Enter housewarming message
2. Ask follow-up: `What's the budget?`
3. Ask another follow-up: `Customize the decoration budget`
4. Ask final follow-up: `Show me the full plan`

**Expected:**
- ✅ All responses stay in housewarming context
- ✅ No fallback to wedding planning
- ✅ Pandit continues to be mentioned
- ✅ Bride/Groom never mentioned

**Screenshot Evidence**: Multi-turn conversation showing consistent housewarming context

---

## ✅ PASS/FAIL CRITERIA

### All Tests PASS If:
- [x] Housewarming event recognized correctly
- [x] Housewarming budget shows pandit allocation
- [x] Housewarming checklist includes ritual tasks
- [x] Housewarming vendors include pandit/rituals
- [x] Housewarming plan contains NO wedding terms
- [x] Birthday event recognized correctly
- [x] Birthday budget shows NO pandit (irrelevant)
- [x] Birthday checklist includes cake/games (NO wedding tasks)
- [x] Birthday plan contains NO wedding terms
- [x] NO .map() crashes in both scenarios
- [x] NO console errors throughout
- [x] Context persists across multi-turn conversations
- [x] All UI elements render without "undefined" values

### Any Test FAILS If:
- ❌ Any wedding term appears in non-wedding event plans
- ❌ Any .map() error appears in console
- ❌ Plan page crashes/freezes
- ❌ "undefined" values visible in budget cards
- ❌ Context switches unexpectedly to wedding
- ❌ Housewarming missing pandit/ritual references
- ❌ Birthday includes bridal/mehendi tasks

---

## 📸 REQUIRED SCREENSHOTS

Please capture and save:

1. **Housewarming Overview** - showing no wedding terms
2. **Housewarming Budget** - showing pandit allocation
3. **Housewarming Checklist** - showing ritual tasks
4. **Housewarming Vendors** - showing pandit recommendation
5. **Housewarming Full Plan** - complete rendered plan
6. **Birthday Overview** - showing birthday-specific content
7. **Birthday Budget** - showing birthday categories
8. **Birthday Checklist** - showing no bridal tasks
9. **Birthday Full Plan** - complete rendered plan
10. **Browser Console (Housewarming)** - clean, no errors
11. **Browser Console (Birthday)** - clean, no errors
12. **Find Dialog - Housewarming** - searching "bride" = 0 results
13. **Multi-turn Conversation** - showing context persistence

---

## 🏃 QUICK TEST (5 minutes)

If time is limited, run this core test:

1. **Housewarming Test**:
   - Input: "Plan a housewarming for 300 guests in Hyderabad"
   - Check: Contains "pandit", does NOT contain "bride"
   - Check: Budget shows pandit allocation
   - Check: No .map() error in console

2. **Birthday Test**:
   - Input: "Plan a birthday for 50 people in Mumbai"
   - Check: Contains "cake", does NOT contain "bride"
   - Check: Budget shows cake allocation
   - Check: No .map() error in console

**If both pass**: ✅ Event isolation is working

---

## 📝 TEST REPORT TEMPLATE

```
TEST EXECUTION REPORT
Date: [YYYY-MM-DD]
Tester: [Name]
Build: [Version]

HOUSEWARMING TESTS:
- Event Recognition: [PASS/FAIL]
- No Wedding Contamination: [PASS/FAIL]
- Budget Generation: [PASS/FAIL]
- Checklist Generation: [PASS/FAIL]
- Vendor Recommendations: [PASS/FAIL]
- Full Plan Rendering: [PASS/FAIL]
- No .map() Crashes: [PASS/FAIL]

BIRTHDAY TESTS:
- Event Recognition: [PASS/FAIL]
- No Wedding Contamination: [PASS/FAIL]
- Budget Generation: [PASS/FAIL]
- Checklist Generation: [PASS/FAIL]
- Vendor Recommendations: [PASS/FAIL]
- Full Plan Rendering: [PASS/FAIL]
- No .map() Crashes: [PASS/FAIL]

OVERALL RESULT: [PASS/FAIL]

Notes: [Any issues encountered]
Console Errors: [Yes/No] - [If yes, list]
Screenshots Attached: [Y/N]
```

---

## 🚀 STARTING THE APPLICATION

```bash
# Terminal 1: Start dev server
cd vowza-event-connections-main
npm run dev

# Opens on http://localhost:8080/ai-planner
```

The AI Planner chat interface will be available. Start with the housewarming scenario above.

---

## ✨ SUCCESS CRITERIA

**The fix is complete and correct if:**

1. ✅ User says "housewarming" → entire plan is about housewarming
2. ✅ No wedding terminology appears unless explicitly requested
3. ✅ Budget categories match the event type
4. ✅ Checklists include event-specific tasks
5. ✅ Vendors are event-appropriate
6. ✅ No .map() crashes on any array rendering
7. ✅ Multiple event types work independently (housewarming ≠ birthday ≠ wedding)

**Final Acceptance Criterion (from requirements):**
> **ANY EVENT USER SPECIFIES → ENTIRE PLANNER STAYS ABOUT THAT EVENT.**

---

**Test Date Completed**: [Your date]  
**Result**: [PASS/FAIL]  
**Tested By**: [Your name]
