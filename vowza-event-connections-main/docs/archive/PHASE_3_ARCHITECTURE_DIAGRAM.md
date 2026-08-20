# VOWZA AI PLANNER — PHASE 3 ARCHITECTURE DIAGRAM

## Current State vs. Proposed State

### CURRENT ARCHITECTURE (Generic Chatbot + Vendor Search)

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                │
│                    "Plan my wedding"                              │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
                ┌──────────────────────────────┐
                │   Intent Detection           │
                │   (Weak pattern matching)    │
                └──────────────────────┬───────┘
                                       ↓
                ┌──────────────────────────────────────┐
                │   Call Groq LLM                      │
                │   (May hallucinate vendors/prices)   │
                └──────────────┬───────────────────────┘
                               ↓
                ┌──────────────────────────────────┐
                │   Vendor Search (if detected)    │
                │   Real vendors from Supabase     │
                └──────────────────────────┬───────┘
                                          ↓
                    ┌─────────────────────────────────┐
                    │   Combine LLM + Vendors         │
                    │   Return generic chat response  │
                    └──────────────┬──────────────────┘
                                   ↓
                       ┌───────────────────────┐
                       │   Display to User     │
                       │   (Text + vendor cards)
                       └───────────────────────┘

PROBLEMS:
✗ User says "wedding" — AI doesn't capture essential details
✗ AI generates budget without data validation
✗ No structured plan object across turns
✗ No real-time recalculation on modifications
✗ Trade-offs not offered
✗ Can't handle "remove DJ" → recalculate
```

---

### PROPOSED ARCHITECTURE (AI Event Intelligence Engine)

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                │
│                 Natural Language (Any phrasing)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
   ╔═══════════════════════════════════════════════════════════╗
   ║  LAYER 1: INTENT + REQUIREMENT EXTRACTION                ║
   ║  ──────────────────────────────────────────────────────  ║
   ║  • Detect intent: plan_event | budget | vendor_search    ║
   ║                  | trade_off | modify_plan               ║
   ║  • Extract event basics: type, city, budget, guests      ║
   ║  • Identify plan modifications (if returning user)       ║
   ║  • Update sessionStorage context                         ║
   ╚═════════════════════────┬════════════════════════════════╝
                             ↓
   ╔═══════════════════════════════════════════════════════════╗
   ║  LAYER 2: STRUCTURED CONTEXT MAINTENANCE                 ║
   ║  ──────────────────────────────────────────────────────  ║
   ║  • Merge new info into PlannerContext                    ║
   ║  • Calculate readiness % (essential fields filled)       ║
   ║  • IF readiness < 100%:                                 ║
   ║    → Ask next essential question + skip to Layer 7       ║
   ║  • Validate for consistency                              ║
   ║  • Persist to conversation_messages.context_summary      ║
   ╚═════════════════════════┬════════════════════════════════╝
                             ↓
   ╔═══════════════════════════════════════════════════════════╗
   ║  LAYER 3: REAL DATABASE RETRIEVAL                        ║
   ║  ──────────────────────────────────────────────────────  ║
   ║  • Query Supabase for:                                   ║
   ║    - Vendors by category, location, budget               ║
   ║    - Admin Event Packages (Silver/Gold/Platinum)         ║
   ║    - Categories active in marketplace                    ║
   ║  • Dedupe verified vendors                               ║
   ║  • Build RAG context (REAL DATA ONLY)                    ║
   ║  • Cache results for this turn                           ║
   ╚═════════════════════════┬════════════════════════════════╝
                             ↓
   ╔═══════════════════════════════════════════════════════════╗
   ║  LAYER 4: PLAN GENERATION (EventBudgetPlanner)          ║
   ║  ──────────────────────────────────────────────────────  ║
   ║  IF readiness >= 100% AND intent == 'plan_event':        ║
   ║                                                           ║
   ║  • Create EventPlan object with:                         ║
   ║    ├─ Event basics (type, city, guests, budget)         ║
   ║    ├─ Service requirements extracted from context        ║
   ║    ├─ Budget allocation (intelligent, non-equal):       ║
   ║    │  • Photography: higher % (guest count impact)       ║
   ║    │  • Catering: higher % (per-guest cost)             ║
   ║    │  • Decoration: medium %                             ║
   ║    │  • DJ: lower % (optional)                          ║
   ║    ├─ Feasibility check                                  ║
   ║    ├─ Recommendations to improve plan                    ║
   ║    └─ Customizations array (empty initially)            ║
   ║                                                           ║
   ║  • Store plan.versionNumber = 1 (tracks modifications)   ║
   ║  • Persist plan in currentPlan state                     ║
   ╚═════════════════════════┬════════════════════════════════╝
                             ↓
   ╔═══════════════════════════════════════════════════════════╗
   ║  LAYER 5: VENDOR + PACKAGE MATCHING                      ║
   ║  ──────────────────────────────────────────────────────  ║
   ║  IF plan exists:                                          ║
   ║                                                           ║
   ║  • For each budget allocation:                           ║
   ║    ├─ Match REAL vendors from Layer 3 cache              ║
   ║    ├─ Score by: location, rating, budget fit            ║
   ║    ├─ Return top 3 vendors per category                  ║
   ║    ├─ Store in plan.selectedVendors                      ║
   ║                                                           ║
   ║  • For admin packages:                                    ║
   ║    ├─ Retrieve Silver/Gold/Platinum for event_type       ║
   ║    ├─ Compare pricing vs. plan total budget              ║
   ║    ├─ Calculate fit percentages                          ║
   ║    ├─ Show package options with optional customization   ║
   ║    ├─ Store selected package in plan                     ║
   ║                                                           ║
   ║  NO FABRICATED VENDORS OR PACKAGES EVER                  ║
   ╚═════════════════════════┬════════════════════════════════╝
                             ↓
   ╔═══════════════════════════════════════════════════════════╗
   ║  LAYER 6: TRADE-OFF & OPTIMIZATION ENGINE                ║
   ║  ──────────────────────────────────────────────────────  ║
   ║  IF NOT plan.isFeasible (over budget):                   ║
   ║                                                           ║
   ║  • Generate Options A, B, C:                             ║
   ║    Option A: Reduce luxury tier → Save ₹X                ║
   ║    Option B: Remove optional service → Save ₹Y           ║
   ║    Option C: Combination A+B → Save ₹Z                   ║
   ║                                                           ║
   ║  IF user says "what if I increase budget to ₹6L":        ║
   ║                                                           ║
   ║  • Simulate scenario:                                    ║
   ║    ├─ Rebalance allocations proportionally               ║
   ║    ├─ Check new feasibility                              ║
   ║    ├─ Show new vendor options                            ║
   ║    ├─ Calculate impact on timeline (if applicable)       ║
   ║    └─ Return modified plan (don't commit yet)            ║
   ║                                                           ║
   ║  IF user says "increase photography budget":             ║
   ║                                                           ║
   ║  • Use EventPlanMutator to:                              ║
   ║    ├─ Add to photography allocation                      ║
   ║    ├─ Rebalance other categories                         ║
   ║    ├─ Check feasibility                                  ║
   ║    ├─ Re-match vendors to new budget                     ║
   ║    ├─ Increment plan.versionNumber                       ║
   ║    ├─ Add to plan.customizations array                   ║
   ║    └─ Persist updated plan                               ║
   ╚═════════════════════════┬════════════════════════════════╝
                             ↓
   ╔═══════════════════════════════════════════════════════════╗
   ║  LAYER 7: RESPONSE FORMATTING & BOOKING BRIDGE           ║
   ║  ──────────────────────────────────────────────────────  ║
   ║                                                           ║
   ║  Format response based on layer outputs:                 ║
   ║                                                           ║
   ║  IF Layer 2 output (missing essentials):                 ║
   ║    → "Sure, let me ask: [next question]"                ║
   ║                                                           ║
   ║  IF Layer 4 output (plan generated):                     ║
   ║    → Display complete plan with:                         ║
   ║      ├─ Event summary                                    ║
   ║      ├─ Budget allocation table                          ║
   ║      ├─ Real vendor cards (3 per category)               ║
   ║      ├─ Package comparison (Silver vs Gold vs Platinum)  ║
   ║      ├─ Trade-off options (if over budget)               ║
   ║      └─ "What would you like to change?" prompt          ║
   ║                                                           ║
   ║  IF Layer 6 output (modified plan):                      ║
   ║    → Show delta ("Photography budget ↑ ₹20K")            ║
   ║    → Show new total                                      ║
   ║    → Show re-matched vendors                             ║
   ║                                                           ║
   ║  IF user clicks "Book photographer":                      ║
   ║    → Link to existing Vowza booking flow                 ║
   ║    → DO NOT create parallel booking system               ║
   ║    → Preserve plan for post-booking reference            ║
   ║                                                           ║
   ║  Stream all responses word-by-word for natural feel       ║
   ╚═════════════════════════┬════════════════════════════════╝
                             ↓
                  ┌──────────────────────┐
                  │  Display to User     │
                  │ Complete Event Plan  │
                  │ with all options     │
                  └──────────┬───────────┘
                             ↓
         User can modify and return to Layer 1 again
         (The entire cycle repeats, maintaining plan state)
```

---

## State Management Across Turns

```
TURN 1: "I'm planning a wedding in Hyderabad for 300 guests, ₹5L"

useAIChat State after TURN 1:
  {
    context: {
      eventType: 'wedding',
      city: 'Hyderabad',
      guestCount: 300,
      budget: 500000
    },
    currentPlan: {
      eventType: 'wedding',
      city: 'Hyderabad',
      guestCount: 300,
      totalBudget: 500000,
      allocations: [
        { category: 'Photography', allocatedAmount: 70000, ... },
        { category: 'Catering', allocatedAmount: 180000, ... },
        ...
      ],
      selectedVendors: [vendor1, vendor2, vendor3],
      selectedPackages: [silverWeddingPackage],
      customizations: [],
      versionNumber: 1
    }
  }

USER TURN 2: "Make photography more important"

Layer 6 logic:
  1. EventPlanMutator.prioritizeService('Photography')
  2. Rebalance allocations
  3. Create new plan with versionNumber: 2
  4. Add to customizations: [{ change: 'Prioritized photography', ... }]
  5. Re-match vendors with new photography budget
  6. Return modified plan

useAIChat State after TURN 2:
  {
    context: { same },
    currentPlan: {
      ... same fields ...
      allocations: [
        { category: 'Photography', allocatedAmount: 85000, ... },  // ↑ increased
        { category: 'Catering', allocatedAmount: 165000, ... },    // ↓ decreased
        ...
      ],
      selectedVendors: [newPhotographer1, newPhotographer2, ...],  // re-matched
      customizations: [
        { change: 'Prioritized photography', timestamp: ..., ... }
      ],
      versionNumber: 2
    }
  }

USER TURN 3: "Remove DJ"

Layer 6 logic:
  1. EventPlanMutator.removeService('DJ')
  2. Reallocate freed DJ budget (₹25K)
  3. Create new plan with versionNumber: 3
  4. Add to customizations: [{ change: 'Removed DJ', impactOnBudget: -25000, ... }]
  5. Return modified plan

useAIChat State after TURN 3:
  {
    context: { same },
    currentPlan: {
      ... same fields ...
      allocations: [
        { category: 'Photography', allocatedAmount: 90000, ... },  // ↑ got extra 5K
        { category: 'Catering', allocatedAmount: 170000, ... },    // ↑ got extra 20K
        // DJ removed
      ],
      customizations: [
        { change: 'Prioritized photography', ... },
        { change: 'Removed DJ', impactOnBudget: -25000, ... }
      ],
      versionNumber: 3
    }
  }
```

---

## Type Hierarchy & Flow

```
AIPlanner.tsx (UI)
  ├─ useAIChat() hook
  │   ├─ messages: ChatMessage[]          (persisted to DB)
  │   ├─ context: PlannerContext          (session storage + DB)
  │   ├─ currentPlan: EventPlan           (THIS TURN ONLY)
  │   ├─ send(message)                    (triggers Layer 1-7)
  │   └─ editAndResend(message)           (retriggers from this point)
  │
  └─ sendMessage(opts) in llm.ts          (ORCHESTRATION)
      ├─ Layer 1: Orchestrate
      │   └─ Updated context, intent
      ├─ Layer 2: Context maintenance
      │   └─ Readiness check
      ├─ Layer 3: Database retrieval
      │   └─ Vendors + packages cache
      ├─ Layer 4: Plan generation
      │   └─ EventBudgetPlanner.allocate()
      ├─ Layer 5: Vendor + package matching
      │   └─ VendorMatcher + PackageMatcher
      ├─ Layer 6: Trade-off optimization
      │   └─ TradeOffOptimizer + EventPlanMutator
      └─ Layer 7: Response formatting
          └─ formatEventPlan() + streaming

AI Response Card Components
  ├─ EventPlanDisplay (table + summary)
  ├─ VendorCard (reusable, REAL data only)
  ├─ PackageComparisonCard (Silver/Gold/Platinum)
  ├─ TradeOffPanel (Options A/B/C)
  └─ ServiceConfigurator (add/remove/customize)
```

---

## Database Schema (Existing + New Fields)

### Existing Table: `conversation_messages`

```sql
CREATE TABLE conversation_messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  user_id uuid NOT NULL,
  role text NOT NULL ('user' or 'assistant'),
  content text,
  response jsonb,  -- EXTEND: Add plan_version, plan snapshot here
  created_at timestamp
);
```

### Updated Field: `response` JSONB Structure

```json
{
  "type": "budget_plan",
  "text": "Here's your plan...",
  "data": {
    "plan": {
      "eventType": "wedding",
      "city": "Hyderabad",
      "guestCount": 300,
      "totalBudget": 500000,
      "allocations": [...],
      "selectedVendors": [...],
      "selectedPackages": [...],
      "customizations": [...],
      "versionNumber": 1,
      "generatedAt": "2026-07-22T...",
      "isFeasible": true
    },
    "vendors": [
      {
        "id": "vendor_123",
        "name": "Kapoor Photography",
        "category": "Photography",
        "city": "Hyderabad",
        "rating": 4.8,
        "basePrice": 70000
      }
    ],
    "packages": [
      {
        "id": "pkg_silver_wedding",
        "tier": "silver",
        "name": "Silver Wedding",
        "basePrice": 150000,
        "includedServices": [...]
      }
    ],
    "tradeOffs": [
      {
        "label": "Option A",
        "description": "Reduce luxury tier",
        "savings": 50000
      }
    ]
  }
}
```

### Updated Table: `conversations`

```sql
ALTER TABLE conversations ADD COLUMN (
  current_plan_version int DEFAULT 0,  -- Latest version number
  latest_plan_snapshot jsonb            -- Snapshot of current EventPlan
);
```

---

## Integration Points (No Breaking Changes)

```
✅ EXISTING FUNCTIONALITY PRESERVED:
   • User authentication (AuthContext.tsx)
   • Google Sign-In flow
   • Vendor registration & profiles
   • Admin dashboard
   • Booking flow (untouched)
   • Payment processing (untouched)
   • Portfolio management
   • Browse Artists page
   • Existing chat persistence

✅ ONLY AI PLANNER CHANGES:
   • sendMessage() routing + response types
   • Context capture + maintenance
   • Plan generation trigger
   • Vendor display (enhanced with plan context)
   • Package recommendations (new)
   • Trade-off UI (new)

✅ NO DATABASE SCHEMA BREAKING CHANGES:
   • Only add optional columns
   • Existing queries still work
   • RLS policies unchanged
   • Backward compatible
```

---

## Deployment & Testing Strategy

```
PHASE 4 DEPLOYMENT:
1. Create EventContextCapturer service
2. Enhance EventBudgetPlanner
3. Modify llm.ts to check readiness
4. Add currentPlan state to useAIChat
5. Test with demo scenario (partial)
6. npm run build
7. Merge to main → Vercel auto-deploys

PHASE 5 DEPLOYMENT:
1. Create VendorMatcher
2. Create PackageMatcher UI components
3. Integrate with sendMessage()
4. Test vendor cards display
5. npm run build
6. Merge to main

PHASE 6 DEPLOYMENT:
1. Create TradeOffOptimizer
2. Create EventPlanMutator
3. Add plan modification logic
4. Create UI for modifications
5. Test with full demo scenario
6. npm run build
7. Merge to main

PHASE 7 DEPLOYMENT:
1. Full e2e test
2. Production validation
3. Monitoring setup
4. User feedback collection
```

---

## Success Metrics

```
TECHNICAL:
✓ npm run build succeeds (0 errors)
✓ All tests pass
✓ No console warnings
✓ Streaming latency < 2s (first token)
✓ Plan generation < 500ms
✓ Vendor query < 1s
✓ Database query time < 500ms

FUNCTIONAL:
✓ Demo scenario 100% works
✓ No fabricated vendors ever shown
✓ No fabricated prices ever shown
✓ Plan correctly updates on modifications
✓ Budget always sums correctly
✓ Context persists across turns
✓ Context cleared on new chat

USER EXPERIENCE:
✓ Feels like professional event planner
✓ Fast responses (streaming)
✓ Clear budget reasoning
✓ Easy vendor selection
✓ Intuitive plan modification
✓ Accessible on mobile
```

---

## Roll-Out Timeline

| Phase | Milestone | Timeline |
|-------|-----------|----------|
| 3 (Design) | Architecture approved | 1 day |
| 4 | Core plan generation | 3-4 days |
| 5 | Vendor + package integration | 3-4 days |
| 6 | Trade-off + modifications | 3-4 days |
| 7 | Testing + deployment | 2-3 days |
| **TOTAL** | **Production Ready** | **~12-15 days** |

