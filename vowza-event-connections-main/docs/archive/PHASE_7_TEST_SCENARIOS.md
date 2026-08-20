# Phase 7 Test Scenarios — End-to-End QA

## Overview
Comprehensive testing scenarios for Phase 7 features (7A-7F) covering all user workflows and edge cases.

---

## Test Scenario 1: Complete Booking Workflow
**User Goal:** Book a photographer for wedding on specific date

**Steps:**
1. User: "I'm planning a wedding for August 15, 2026"
   - ✓ System extracts event type (wedding)
   - ✓ System extracts event date (August 15, 2026)
   - ✓ System generates plan with photography allocation

2. User: "Show me photographers"
   - ✓ System retrieves photographers in city
   - ✓ System filters by availability on August 15
   - ✓ Only available photographers shown first

3. User: "Compare the first and second photographer"
   - ✓ System detects comparison intent
   - ✓ Shows side-by-side with scores (0-100)
   - ✓ Displays ratings, experience, package options
   - ✓ Cost per hour calculated
   - ✓ Strengths/weaknesses highlighted
   - ✓ 🥇🥈 medals assigned

4. User: "Book the first one"
   - ✓ System detects booking_request intent
   - ✓ Identifies photographer from prior context
   - ✓ Creates 24-hour hold on availability
   - ✓ Generates booking URL with pre-filled context
   - ✓ Shows hold expiration countdown (24h)
   - ✓ Confirms booking with vendor name, date, hold ID

**Expected Outcome:** Booking confirmed with 24-hour hold, user can proceed to payment

---

## Test Scenario 2: Dietary Preferences with Caterer Selection
**User Goal:** Find vegetarian caterer with availability

**Steps:**
1. User: "I need vegetarian catering for 100 guests on August 15"
   - ✓ System extracts dietary preference (vegetarian)
   - ✓ System extracts guest count (100)
   - ✓ System extracts event date (August 15)
   - ✓ System extracts vendor type (caterer)

2. System shows caterers:
   - ✓ Only vegetarian-supporting caterers shown
   - ✓ Match count displayed ("4 of 7 caterers")
   - ✓ Unavailable caterers marked with next date
   - ✓ Dietary badges shown (🥬 veg, 🌱 vegan, etc.)

3. User: "Which of these supports both veg and non-veg?"
   - ✓ System filters for "both" capability
   - ✓ Shows caterers with mixed menus
   - ✓ Highlights cost per plate for 100 guests

4. User: "Book the second one"
   - ✓ Booking confirmed for veg-capable caterer
   - ✓ 24-hour hold created
   - ✓ Dietary preferences stored in booking

**Expected Outcome:** Caterer booked with dietary preferences preserved in hold

---

## Test Scenario 3: Admin Package vs Custom Mix
**User Goal:** Compare all-in-one package with custom vendor selection

**Steps:**
1. User: "What are my options for wedding package?"
   - ✓ System shows admin packages if available
   - ✓ Admin packages labeled (🎁 All-in-One)
   - ✓ Tier badges shown (🥈 Silver, 🥇 Gold, 💎 Platinum)

2. System presents comparison:
   - ✓ Admin package price shown (₹X lakh)
   - ✓ Custom mix cost calculated
   - ✓ Savings highlighted if >10%
   - ✓ Side-by-side table shows:
     - Total cost (admin vs custom)
     - Coordination complexity
     - Flexibility
     - Quality guarantee
     - Overall complexity

3. User: "Show me the admin package details"
   - ✓ Package name and tier displayed
   - ✓ Included services listed (photography, catering, decoration, etc.)
   - ✓ Benefits highlighted:
     - One vendor coordination
     - Pre-tested team
     - Consistent quality
     - Potential savings

4. User: "Book the gold package"
   - ✓ Admin package booking initiated
   - ✓ All included services added to cart
   - ✓ 24-hour hold created on package
   - ✓ Savings amount highlighted

**Expected Outcome:** Admin package booked with all services at discounted rate

---

## Test Scenario 4: Real-Time Availability Filtering
**User Goal:** Find vendors available on specific date

**Steps:**
1. User: "Wedding in 2 weeks"
   - ✓ System calculates event date (July 22 + 14 = Aug 5)
   - ✓ Provides calendar view option

2. User: "Show photographers available that day"
   - ✓ System checks provider_availability table
   - ✓ Filters to only available photographers
   - ✓ Shows availability status for each:
     - ✅ Available (2 slots)
     - ❌ Booked (next: Aug 7)
     - ⏱ No data

3. User: "Which ones have morning slots?"
   - ✓ System filters for 09:00-12:00 slots
   - ✓ Shows available morning photographers
   - ✓ Displays exact time windows

4. User: "Put a hold on photographer A for 9am"
   - ✓ 24-hour hold created
   - ✓ Hold ID generated
   - ✓ Expiration countdown shown (23h 59m)
   - ✓ Slot locked from other bookings

**Expected Outcome:** Vendor slot held for 24 hours with expiration alert

---

## Test Scenario 5: Multiple Dates, Multiple Vendors
**User Goal:** Check availability across different vendors for different dates

**Steps:**
1. User: "Wedding August 15, but flexible if needed"
   - ✓ Primary date: August 15
   - ✓ Flexibility acknowledged

2. User: "Show availability for photographers"
   - ✓ Availability comparison table shows:
     | Vendor | August 15 | August 20 | Next Available |
     | PhotoA | ✅ 2 slots | ❌ Booked | Aug 22 |
     | PhotoB | ❌ Booked | ✅ 3 slots | Aug 20 |
   - ✓ Recommendations offered:
     - PhotoA available on preferred date
     - PhotoB available on August 20

3. User: "What if we move to August 20?"
   - ✓ System re-filters vendors for Aug 20
   - ✓ Shows which vendors newly available
   - ✓ Cost impact calculated

**Expected Outcome:** Multi-date comparison showing optimal vendor selection

---

## Test Scenario 6: Hold Expiration Warning
**User Goal:** Complete booking before hold expires

**Steps:**
1. User creates hold on caterer for August 15
   - ✓ Hold created with 24-hour countdown
   - ✓ Hold ID: hold_vendor_123_1234567890

2. After 23 hours:
   - ✓ System alerts: "Expires in 59 minutes"
   - ✓ UI shows prominent expiration warning
   - ✓ Booking action button highlighted

3. User attempts to complete booking at 24h 01m:
   - ✓ System detects hold expired
   - ✓ Error: "Hold expired. Please select vendor again."
   - ✓ System offers to create new hold

4. User creates new hold (within 5 minutes of expiry):
   - ✓ New hold created successfully
   - ✓ New 24-hour countdown starts
   - ✓ Old hold ID discarded

**Expected Outcome:** Expired holds properly handled with user-friendly recovery

---

## Test Scenario 7: Dietary + Comparison + Booking
**User Goal:** Complex workflow: Find, compare, and book with dietary requirements

**Steps:**
1. User: "I need caterers - we're 80% vegetarian, 20% non-veg, for 150 people on Sept 1"
   - ✓ Dietary prefs extracted (veg/non-veg mix)
   - ✓ Guest count: 150
   - ✓ Event date: Sept 1
   - ✓ Vendor type: caterer

2. System retrieves & filters:
   - ✓ Only caterers with mixed menu options shown
   - ✓ Availability checked for Sept 1
   - ✓ Cost calculated: price per guest (estimated ₹300-400)

3. User: "Compare the top 3"
   - ✓ Comparison shows:
     - Rank 1: Caterer A (score 92/100)
       - Strengths: 4.9 rating, 200+ reviews, mixed menu
       - Cost: ₹350/guest
     - Rank 2: Caterer B (score 85/100)
       - Strengths: 4.7 rating, 150 reviews
       - Cost: ₹320/guest
     - Rank 3: Caterer C (score 78/100)
       - Cost: ₹300/guest, newer but good
   - ✓ Medals assigned (🥇🥈🥉)

4. User: "Show me Caterer B's menu for dietary options"
   - ✓ System displays menu items
   - ✓ Vegetarian items tagged (✓ 45 veg items)
   - ✓ Non-veg items available (✓ 12 non-veg items)
   - ✓ Cost breakdown: ₹320/guest = ₹48,000 for 150

5. User: "Book Caterer B for Sept 1"
   - ✓ Booking intent detected
   - ✓ Caterer B identified from context
   - ✓ 24-hour hold created
   - ✓ Dietary preferences saved
   - ✓ Guest count saved: 150
   - ✓ Confirmation shows all details

**Expected Outcome:** Complex booking with dietary prefs maintained through entire workflow

---

## Test Scenario 8: Regression Test — All Features Still Work
**Goal:** Verify no regressions in existing Phase 1-6 functionality

**Tests:**
- ✓ Budget planning still accurate
- ✓ Package recommendations unaffected
- ✓ Vendor search returns correct results
- ✓ RAG retrieval works
- ✓ Context extraction accurate
- ✓ LLM routing functional
- ✓ Edge Function proxy working
- ✓ VEDA deterministic engine responsive

---

## Test Scenario 9: Performance Monitoring
**Goal:** Ensure Phase 7 doesn't degrade system performance

**Metrics:**
- Build time: Target < 30s (current: 25.17s ✓)
- Bundle size: Target < 300KB (AIPlanner: 210.02 kB ✓)
- Vendor retrieval: Target < 2s
- Comparison generation: Target < 500ms
- Availability filtering: Target < 300ms
- Hold creation: Target < 200ms

**Load Test:**
- 100 concurrent users
- 500 vendor comparisons
- 50 simultaneous holds
- System response time < 1s

---

## Test Scenario 10: Edge Cases
**Goal:** Verify system handles edge cases gracefully

**Cases:**

### 10.1: No Availability
- User: "Book photographer for past date"
  - ✓ System rejects past dates
  - ✓ Suggests next available date
  - ✓ Guides user to choose future date

### 10.2: Fully Booked
- User: "Show photographers available Sept 1"
  - ✓ All photographers booked
  - ✓ System shows: "No photographers available. Next slots: Sept 3"
  - ✓ Offers to create alert for future dates

### 10.3: No Dietary Options
- User: "Vegan caterer available Aug 15"
  - ✓ No vegan caterers available
  - ✓ System shows: "0 of 5 caterers support vegan"
  - ✓ Suggests nearby dates or non-vegan options

### 10.4: Multiple Holds by Same User
- User: "Hold caterer A for Aug 15"
  - ✓ Hold created
- User: "Actually, hold caterer B for Aug 15"
  - ✓ New hold created on different vendor
  - ✓ First hold still active (can complete either booking)
  - ✓ Alert if holds conflict (same vendor/date)

### 10.5: Hold Expiry During Booking
- User has hold, begins payment process
- Hold expires mid-payment
  - ✓ System detects expiry
  - ✓ Payment declined with clear message
  - ✓ Offers to renew hold and restart

---

## Test Scenario 11: Admin Package Edge Cases

### 11.1: No Admin Packages
- Admin packages not available
  - ✓ System shows only custom vendor options
  - ✓ No admin package UI shown
  - ✓ Works seamlessly without admin packages

### 11.2: Admin Package Doesn't Fit Budget
- Budget: ₹100K, Admin package: ₹200K
  - ✓ Admin package not recommended
  - ✓ Custom mix shown as primary option
  - ✓ Admin package shown as "premium alternative"

### 11.3: Savings < 10%
- Admin package: ₹200K, Custom mix: ₹205K (2.4% savings)
  - ✓ Admin package not prioritized
  - ✓ Both options shown equally
  - ✓ User chooses based on flexibility, not savings

---

## Quality Checklist

- [ ] All 7A-7F features integrated
- [ ] No build errors (target: 0)
- [ ] Build time < 30s
- [ ] Bundle size < 300KB (AIPlanner)
- [ ] All test scenarios pass
- [ ] Cross-phase workflows functional
- [ ] Regression tests pass
- [ ] Edge cases handled gracefully
- [ ] Performance targets met
- [ ] User feedback messages clear
- [ ] Error handling comprehensive
- [ ] Hold expiration tracking accurate
- [ ] Availability sync with database
- [ ] Booking confirmations include all context
- [ ] Dietary preferences preserved through workflow

---

## Sign-Off Criteria

**Phase 7G Testing Complete when:**
1. ✓ All 11 test scenarios pass
2. ✓ 0 build errors
3. ✓ All regression tests pass
4. ✓ Performance benchmarks met
5. ✓ Edge cases handled
6. ✓ User feedback comprehensive
7. ✓ Documentation complete
8. ✓ Ready for Phase 7H deployment

---

## Next: Phase 7H - Deployment
- Push to main branch
- Deploy to Vercel
- Edge Function updates
- Monitor logs
- Production validation
