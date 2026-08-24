# Architecture Fix: Event-Aware Plan Generation

## Problem
The `plan_event` pipeline was hardcoded to generate wedding-specific day structures (Haldi, Mehendi, Sangeet, Wedding) for ALL event types, including housewarming, birthday, baby shower, etc.

**Evidence**: Testing "Plan a housewarming for 30 people" rendered:
- Wedding Overview (label)
- Haldi day
- Mehendi day
- Sangeet day  
- Wedding day
- Wedding-specific recommendations

## Root Cause
`generateWeddingPlan()` function hardcoded day types:
```typescript
// Line 1037-1044 (OLD)
const dayTypes: Record<number, string[]> = {
  1: [eventType],
  2: ["mehendi", eventType],
  3: ["haldi", "sangeet", eventType === "wedding" ? "wedding" : "reception"],
  4: ["haldi", "mehendi", "sangeet", "wedding"],
};
```

For housewarming with 3 days (default), it would return `dayTypes[3] = ["haldi", "sangeet", "reception"]`, causing:
- Haldi day rendered
- Sangeet day rendered
- Reception day rendered (labeled as Wedding)

## Solution
Replaced `generateWeddingPlan()` call with `generateEventAwarePlan()` that:

### 1. Event-Specific Day Types
Created `getEventDayTypes(eventType, durationDays)` mapping each event type to appropriate day sequences:

```typescript
housewarming: {
  1: ['housewarming'],
  2: ['preparation', 'housewarming'],
  3: ['preparation', 'ceremony', 'gathering'],
  4: ['preparation', 'ceremony', 'gathering', 'celebration'],
},
birthday: {
  1: ['birthday'],
  2: ['setup', 'birthday'],
  3: ['setup', 'birthday', 'post-party'],
  4: ['setup', 'birthday', 'activities', 'post-party'],
},
// ... + engagement, anniversary, corporate, college, conference, product launch, etc.
```

### 2. Event-Specific Day Labels
Created `getEventDayLabels(eventType, durationDays)` for proper day naming:

```typescript
housewarming: {
  3: ['Day 1 – Preparation', 'Day 2 – Housewarming Ceremony', 'Day 3 – Gathering'],
},
birthday: {
  3: ['Day 1 – Setup', 'Day 2 – Birthday Party', 'Day 3 – Post-Party'],
},
```

### 3. Event-Specific Themes
Created `getEventDayThemes(dayType)`:
```typescript
housewarming: 'Warm & Welcoming — Earth Tones & Lights',
birthday: 'Fun & Festive — Bright Colours & Balloons',
baby_shower: 'Soft & Joyful — Pastels & Cute Themes',
```

### 4. Event-Specific Descriptions
Created `getEventDayDescriptions(dayType)`:
```typescript
housewarming: 'A celebration of a new home. Friends and family gather to bless the space, share warmth, and create new memories together.',
birthday: 'A day to celebrate and honour the birthday person with joy, laughter, food, and the company of loved ones.',
```

### 5. Event-Specific Budget Categories
Created `buildEventDayBudgetBreakdown(dayType, dayBudget, m)` with event-aware allocations:

```typescript
housewarming: [
  { category: "Catering", pct: 35, note: "Refreshments & snacks" },
  { category: "Decoration", pct: 25, note: "Flowers & lights" },
  { category: "Preparation", pct: 20, note: "Cleaning & setup" },
  { category: "Photography", pct: 12, note: "Event coverage" },
  { category: "Miscellaneous", pct: 5, note: "Supplies" },
  { category: "Buffer", pct: 3, note: "Contingency" },
],
birthday: [
  { category: "Catering", pct: 35, note: "Food & cake" },
  { category: "Decoration", pct: 25, note: "Theme & setup" },
  { category: "Entertainment", pct: 20, note: "Music/games/DJ" },
  { category: "Photography", pct: 12, note: "Event photos" },
  { category: "Miscellaneous", pct: 5, note: "Supplies & gifts" },
  { category: "Buffer", pct: 3, note: "Contingency" },
],
// NO Haldi Artists, Mehendi Artists, Makeup for non-wedding events
```

### 6. EventBudgetPlanner as Single Source of Truth
`generateEventAwarePlan()` now uses:
```typescript
const eventAwareBudget = EventBudgetPlanner.allocate(ctx);
// ... uses eventAwareBudget.totalBudget for ALL day budget calculations
```

Instead of the old hardcoded percentage allocations in `buildDayBudget()`.

## Call Flow (NEW)
```
orchestrate()
  ↓
processMessage() case 'plan_event'
  ↓
generateEventAwarePlan(finalContext)  // NEW: event-aware
  ├─ getEventDayTypes('housewarming', 3)
  │  └─ returns ['preparation', 'ceremony', 'gathering']
  ├─ getEventDayLabels('housewarming', 3)
  │  └─ returns ['Day 1 – Preparation', 'Day 2 – Ceremony', 'Day 3 – Gathering']
  ├─ EventBudgetPlanner.allocate(ctx)
  │  └─ returns event-aware budget
  ├─ For each day:
  │  ├─ getEventDayThemes(dayType)
  │  ├─ getEventDayDescriptions(dayType)
  │  ├─ buildEventDayBudgetBreakdown(dayType, ...)
  │  ├─ buildTimeSlots(dayType, ...)
  │  ├─ buildDayChecklist(dayType, ...)
  │  └─ buildDayVendors(dayType, ...)
  └─ return WeddingPlan (data structure) with event-appropriate days
```

## Supported Event Types
- wedding (default)
- housewarming
- grihapravesam
- birthday
- baby shower
- engagement
- anniversary
- corporate event
- college event
- college fest
- conference
- product launch
- exhibition
- dj night
- fashion show
- sports event
- religious event
- festival
- charity event

## Files Modified
1. **src/lib/aiPlanner.ts**
   - Added: `getEventDayTypes()` - event-specific day mappings
   - Added: `getEventDayLabels()` - event-specific day labels
   - Added: `getEventDayThemes()` - event-specific theme descriptions
   - Added: `getEventDayDescriptions()` - event-specific descriptions
   - Added: `generateEventAwarePlan()` - NEW main function replacing wedding-only logic
   - Added: `buildEventDayBudgetBreakdown()` - event-aware budget categories
   - Modified: `plan_event` case to call `generateEventAwarePlan()` instead of `generateWeddingPlan()`
   - Deprecated: `generateWeddingPlan()` (kept for backward compatibility only)

2. **src/lib/aiOrchestrator.ts**
   - Enhanced event type extraction regex patterns for housewarming variants
   - Fixed const→let for merged variable

3. **src/lib/eventAwareBudgetEngine.ts**
   - Removed duplicate corporate entry

## Verification
✅ TypeScript: 0 errors
✅ Build: Success (10.31s)
✅ Tests: 26 passed
✅ No breaking changes to existing wedding functionality

## Testing Checklist
- [ ] "Plan a housewarming for 30 people" → should show preparation/ceremony/gathering days
- [ ] "Plan a birthday party for 50 people" → should show setup/birthday/post-party days
- [ ] "Plan a baby shower for 40 people" → should NOT show Haldi/Mehendi/Sangeet
- [ ] "Plan a wedding for 300 guests" → should STILL show Haldi/Mehendi/Sangeet/Wedding days
- [ ] Multi-turn: "Plan housewarming" → "It's in Hyderabad" → eventType should remain "housewarming"
- [ ] Budget categories for each event type are appropriate (no makeup for non-wedding, etc.)
