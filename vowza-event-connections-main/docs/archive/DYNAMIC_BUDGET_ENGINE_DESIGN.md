# Event-Aware Dynamic Budget Engine — Architecture & Design

## Overview

Transform EventBudgetPlanner from a fixed-percentage allocator into an intelligent event-aware engine that:
1. Activates only relevant categories per event type
2. Redistributes unused allocation weight dynamically
3. Adjusts for guest count, function count, and selected services
4. Validates budget feasibility with contextual warnings

---

## Core Principle

**DO NOT allocate money to irrelevant categories.**

- Housewarming at user's home → Venue allocation = 0
- Housewarming at rented venue → Venue allocation = relevant
- Wedding with no videography → Videography allocation = 0
- Sangeet → Entertainment weight increases
- Simple ceremony → Entertainment may be minimal or 0

---

## Phase 1: Wedding/Marriage Baseline Weights

Used as the primary reference. All other events derive from or adjust this baseline.

```
Venue:                 16%
Catering/Food:         30%
Decoration & Flowers:  14%
Photography:            9%
Videography:            8%
Makeup & Hair:          5%
Music/DJ/Band/Ent:      8%
Lighting & Sound:       3%
Mehendi/Haldi Artists:  2%
Anchor/Host:            1%
Invitations:            2%
Priest/Rituals:         2%
─────────────────────
TOTAL:               100%
```

### Not Included in Budget Model (Intentional)
- Attire/Clothing
- Jewellery
- Transportation
- Contingency (may add as 0-2% later)

---

## Category Activation Matrix

### Wedding/Marriage (Primary Reference)
**All 12 baseline categories active.**

Modifiers:
- Videography: Optional (user can remove)
- Mehendi/Haldi: Depends on calendar (is it a separate function or part of wedding?)
- Priest/Rituals: Depends on religion/ceremony type

---

### Engagement
**Remove**: Mehendi/Haldi (not typical for engagement)

**Categories**:
- Venue (16%)
- Catering (30%)
- Decoration (14%)
- Photography (9%)
- Videography (8% optional)
- Makeup (5%)
- Music/DJ/Band (8%)
- Lighting/Sound (3%)
- Anchor/Host (1%)
- Invitations (2%)
- Priest/Rituals (2%)
= 10 categories, 98% (rebalance to 100%)

---

### Haldi (Pre-Wedding Ritual)
**Characteristics**: Yellow oil application, female-focused, 2-4 hours, 50-200 guests

**Active categories**:
- Decoration (high: 20%) — yellow flowers, props
- Catering (moderate: 25%) — tea, snacks, sweets
- Photography (high: 15%) — candid, rituals
- Videography (optional: 10%)
- Makeup (high: 15%) — bride preparation
- Lighting/Sound (5%)
- Mehendi (0%) — not mehendi event
- Music/DJ (5%)
- Venue (depends: if home=0%, if external=10%)
- Priest/Rituals (2%)
- Anchor (0%)
- Invitations (3%)
= Variable 7-9 categories (adjust to 100%)

---

### Mehendi (Henna Application)
**Characteristics**: Bride's female friends/family apply henna, music/dance, longer event (4-6 hours), 100-300 guests

**Active categories**:
- Mehendi Artist (VERY HIGH: 25%) — core service
- Decoration (high: 18%) — mehendi stage, props
- Catering (high: 22%) — full meal + refreshments
- Photography (high: 12%) — ritual documentation
- Videography (optional: 8%)
- Music/DJ/Entertainment (high: 10%) — music, dancing
- Makeup (low: 3%) — touch-ups
- Lighting/Sound (3%)
- Venue (depends: 0% if home, 8% if external)
- Priest/Rituals (0%) — not ritualistic
- Anchor (0%)
- Invitations (1%)
= Variable 8-10 categories (adjust to 100%)

---

### Sangeet (Music Night)
**Characteristics**: Professional music/dance performances, mixed audience, 3-5 hours, 200-500 guests

**Active categories**:
- Music/DJ/Band (VERY HIGH: 20%) — professional musicians
- Entertainment/Dancers (HIGH: 15%) — choreographed acts
- Venue (high: 15%) — larger space needed
- Catering (high: 20%) — dinner service
- Decoration (medium: 12%) — stage setup
- Lighting/Sound (high: 8%) — professional sound system
- Photography (medium: 5%)
- Videography (optional: 2%)
- Makeup (0%)
- Mehendi (0%)
- Priest (0%)
- Anchor/Host (medium: 3%)
- Invitations (0%)
= 9 categories (adjust to 100%)

---

### Reception (Post-Wedding Celebration)
**Characteristics**: Formal reception, dinner, dancing, 300-700 guests, single-event

**Active categories**:
- Venue (high: 16%)
- Catering (VERY HIGH: 35%) — full formal dinner
- Decoration (medium: 12%) — elegant stage setup
- Photography (medium: 9%)
- Videography (medium: 8%)
- Music/DJ/Band (high: 12%) — dancing essential
- Lighting/Sound (high: 5%)
- Makeup (medium: 2%)
- Anchor/Host (high: 2%)
- Invitations (0%) — already sent for wedding
- Mehendi (0%)
- Priest (0%)
- Rituals (0%)
= 9 categories (adjust to 100%)

---

### Housewarming / Gruhapravesh
**Decision point**: Home or rented venue?

#### If at Home
**Active**:
- Decoration (12%) — flowers, pooja area
- Catering (28%) — snacks/meal
- Photography (8%)
- Videography (optional: 5%)
- Priest/Rituals (25%) — VERY HIGH — core ceremony
- Lighting/Sound (0%) — not needed
- Music (0%)
- Makeup (0%)
- Mehendi (0%)
- Venue (0%) — own home
- Anchor (0%)
- Invitations (2%)
- Flowers (10%)
= 7 categories

#### If at Rented Venue
**Add**:
- Venue (15%)
Adjust all others down proportionally.

---

### Corporate Event
**Characteristics**: Professional audience, business-focused, AV essential, no rituals

**Active**:
- Venue (20%)
- Catering (30%) — continental, professional
- AV/Staging/Lighting (20%) — MUST HAVE
- Photography (12%)
- Videography (optional: 8%)
- Anchor/Host (5%)
- Music/Entertainment (3%)
- Decoration (0%) — minimal
- Makeup (0%)
- Mehendi (0%)
- Priest (0%)
- Invitations (0%)
- Flowers (2%)
= 8 categories

---

### Birthday Party
**Characteristics**: Can vary widely (kids, adults, at home, venue), shorter duration

**Decision points**:
1. Home or venue?
2. Kids or adults?
3. Simple or elaborate?

**Baseline** (mid-range, venue):
- Catering (25%)
- Decoration (20%) — theme important
- Venue (15%)
- Entertainment (18%) — games, DJ, activities
- Photography (10%)
- Cake (5%)
- Videography (optional: 5%)
- Lighting (2%)
- Makeup (0%)
- Mehendi (0%)
- Priest (0%)
- Anchor (0%)
- Invitations (0%)
= 8 categories

---

## Algorithm: Event-Aware Allocation

### Step 1: Determine Active Categories

```typescript
function getActiveCategoriesForEvent(
  eventType: EventCategory,
  context: PlannerContext
): { category: string; baseWeight: number }[] {
  
  const activated = [];
  
  switch (eventType) {
    case 'wedding':
      activated = [
        'Venue', 'Catering', 'Decoration', 'Photography', 'Videography',
        'Makeup', 'Music/DJ/Band', 'Lighting/Sound', 'Mehendi/Haldi',
        'Anchor/Host', 'Invitations', 'Priest/Rituals'
      ];
      break;
      
    case 'housewarming':
      if (context.hasVenue || context.venueType === 'external') {
        activated = ['Venue', 'Catering', 'Decoration', 'Photography', 
                     'Priest/Rituals', 'Flowers'];
      } else {
        activated = ['Catering', 'Decoration', 'Photography',
                     'Priest/Rituals', 'Flowers'];
      }
      break;
      
    case 'mehendi':
      activated = ['Mehendi Artist', 'Decoration', 'Catering', 'Photography',
                   'Videography', 'Music/DJ', 'Lighting/Sound'];
      if (context.hasVenue) activated.push('Venue');
      break;
      
    // ... etc for all 23 event types
  }
  
  // Step 2: Apply User Selections
  // Remove if user said "no videography"
  if (context.userSelections?.excludeVideography) {
    activated = activated.filter(c => c !== 'Videography');
  }
  
  // Add if user said "I want live band"
  if (context.userSelections?.wantsBand) {
    activated.push('Band'); // Separate from 'Music/DJ/Band' if needed
  }
  
  return activated;
}
```

### Step 2: Dynamic Normalization

```typescript
function normalizeAllocationWeights(
  categories: { category: string; baseWeight: number }[]
): { category: string; normalizedWeight: number }[] {
  
  // Sum all weights (may not be 100% after activation)
  const totalWeight = categories.reduce((sum, c) => sum + c.baseWeight, 0);
  
  // Normalize so they sum to exactly 100%
  return categories.map(c => ({
    category: c.category,
    normalizedWeight: (c.baseWeight / totalWeight) * 100
  }));
}
```

### Step 3: Apply Guest Count Sensitivity

```typescript
function applySensitivity(
  allocations: { category: string; normalizedWeight: number }[],
  guestCount: number,
  eventType: EventCategory
): { category: string; finalWeight: number }[] {
  
  // Catering scales with guest count
  const perGuestCateringMin = PER_GUEST_RANGES[eventType].min;
  const estimatedCateringCost = guestCount * perGuestCateringMin;
  
  // If catering is disproportionate to budget, adjust other allocations
  const cateringAllocation = allocations.find(a => a.category === 'Catering');
  if (cateringAllocation && estimatedCateringCost > budget * (cateringAllocation.normalizedWeight / 100)) {
    // Catering will exceed allocation — warn user
    // Keep catering at required level, reduce lower-priority categories
  }
  
  return allocations.map(a => ({
    category: a.category,
    finalWeight: a.normalizedWeight
  }));
}
```

### Step 4: Convert to Monetary Amounts

```typescript
function convertToMonetary(
  allocations: { category: string; finalWeight: number }[],
  totalBudget: number
): BudgetAllocation[] {
  
  return allocations.map(a => {
    const amount = (totalBudget * a.finalWeight) / 100;
    
    return {
      category: a.category,
      allocatedAmount: amount,
      actualPercentage: a.finalWeight,
      minAmount: amount * 0.8,  // 20% flexibility
      maxAmount: amount * 1.25, // 25% flexibility
      reasoning: CATEGORY_REASONING[a.category]
    };
  });
}
```

---

## User-Selected Service Activation

### Example 1: DJ vs Band vs Both

**User says**: "I need a live band"
→ Detect via message extraction (VENDOR_KEYWORDS includes 'band')
→ Update context: `userSelections.wantsBand = true`
→ In getActiveCategoriesForEvent(): If wantsBand, ensure 'Band' is active
→ During normalization: If both DJ and Band are active, split Music/DJ/Band allocation between them

**Example allocation**:
```
WITHOUT user specification:
Music/DJ/Band: 8%

WITH "I want live band":
Music/DJ/Band: 8% → becomes → Band: 8%

WITH "I want DJ and band":
Music/DJ/Band: 8% → becomes → DJ: 4%, Band: 4%
```

### Example 2: Videography Removal

**User says**: "I don't need videography"
→ Detect via detectModificationIntent()
→ Remove 'Videography' from active categories
→ Remaining categories: 11 (excluding Videography)
→ Normalize: sum = 92%, renormalize to 100%
→ Result: All other allocations increase proportionally

**Before**:
```
Photography: 9%
Videography: 8%
Catering: 30%
... (100% total)
```

**After removing Videography**:
```
Photography: 9 / 92 * 100 = 9.78%
Videography: 0%
Catering: 30 / 92 * 100 = 32.61%
... (100% total, all except Video rescaled)
```

---

## Guest Count Sensitivity

### Catering Budget Pressure Warning

```typescript
function checkCateringBudgetPressure(
  guestCount: number,
  totalBudget: number,
  cateringAllocation: number,
  city: string,
  eventType: EventCategory
): string | null {
  
  const cityMult = CITY_MULTIPLIER[city] ?? 1.0;
  const perGuestMin = PER_GUEST_RANGES[eventType].min;
  const estimatedCateringNeeded = guestCount * perGuestMin * cityMult;
  const cateringAllocated = totalBudget * (cateringAllocation / 100);
  
  if (estimatedCateringNeeded > cateringAllocated * 1.2) {
    // Catering will likely be 20%+ over budget
    return `With ${guestCount} guests and ₹${(totalBudget / 100000).toFixed(1)}L budget,` +
           ` catering alone may cost ₹${(estimatedCateringNeeded / 100000).toFixed(1)}L.` +
           ` Consider: reducing guest count, increasing budget, or simplifying menu.`;
  }
  
  return null;
}
```

### Venue Scalability

Similar logic for venue: outdoor venues may need higher allocation for large guest counts (tent rental, parking, etc.)

---

## Function Count Sensitivity

### Multi-Function Wedding

**User says**: "Haldi + Mehendi + Sangeet + Wedding + Reception"
→ Parse functionCount = 5
→ Create separate allocations for each function
→ OR: Create combined budget across all functions with event-specific weights

**Approach 1: Separate Budgets (Current)**
- Each function gets its own budget (already supported via timeline)
- Haldi: 10% of wedding budget
- Mehendi: 12% of wedding budget
- Sangeet: 8% of wedding budget
- Wedding: 50% of wedding budget
- Reception: 20% of wedding budget
- Total: 100% of user's stated budget

**Approach 2: Unified Budget (Future)**
- One budget line item per category across all functions
- "Photography (Across 5 functions)": 15% (higher because 5 events)
- "Catering (Across 5 functions)": 35% (higher because 5 meals)
- Requires separate logic for multi-function planning

---

## Budget Totals Guarantee

**Every generated budget MUST satisfy**:
```
sum(allocations[].allocatedAmount) = totalBudget (within ±₹1 rounding)
sum(allocations[].actualPercentage) = 100.0% (within ±0.1%)
```

---

## Implementation Checklist

- [ ] Define EVENT_CATEGORY_ACTIVATIONS mapping (category matrix per event type)
- [ ] Implement getActiveCategoriesForEvent()
- [ ] Implement normalizeAllocationWeights()
- [ ] Implement applySensitivity() (guest count, function count)
- [ ] Implement checkBudgetPressure() (catering, venue)
- [ ] Update PlannerContext to track userSelections
- [ ] Update extractContextUpdates() to detect service preferences
- [ ] Update EventBudgetPlanner.allocate() to use new logic
- [ ] Add comprehensive tests
- [ ] Update BUDGET_TEMPLATES with baseline weights
- [ ] Test all 23 event types
- [ ] Test multi-turn context preservation
- [ ] Manual UI testing

---

## Examples Post-Implementation

### Example 1: Wedding ₹10L, 300 guests, Hyderabad
```
Active Categories: 12
Normalization: 100%
Guest Pressure: ₹{catering_estimate}
Allocation:
  Venue: ₹1.60L (16%)
  Catering: ₹3.00L (30%)
  Decoration: ₹1.40L (14%)
  Photography: ₹0.90L (9%)
  Videography: ₹0.80L (8%)
  Makeup: ₹0.50L (5%)
  Music: ₹0.80L (8%)
  Lighting: ₹0.30L (3%)
  Mehendi: ₹0.20L (2%)
  Anchor: ₹0.10L (1%)
  Invitations: ₹0.20L (2%)
  Priest: ₹0.20L (2%)
  ──────────────
  TOTAL: ₹10.00L (100%)
```

### Example 2: Same Wedding, but "No Videography"
```
Active Categories: 11 (removed Videography)
Weights before normalization: 92%
Normalization factor: 100/92 = 1.087

Allocation:
  Venue: ₹1.74L (17.4%)
  Catering: ₹3.26L (32.6%)
  Decoration: ₹1.52L (15.2%)
  Photography: ₹0.98L (9.8%)
  Videography: ₹0.00L (0%)
  Makeup: ₹0.54L (5.4%)
  Music: ₹0.87L (8.7%)
  Lighting: ₹0.33L (3.3%)
  Mehendi: ₹0.22L (2.2%)
  Anchor: ₹0.11L (1.1%)
  Invitations: ₹0.22L (2.2%)
  Priest: ₹0.22L (2.2%)
  ──────────────
  TOTAL: ₹10.00L (100%)
```

### Example 3: Mehendi Ceremony ₹3L, 150 guests, Home
```
Active Categories: 7 (no Venue, no Anchor, no Priest if non-ritualistic)
Baseline weights (from Mehendi template):
  Mehendi Artist: 25%
  Decoration: 18%
  Catering: 22%
  Photography: 12%
  Videography: 8%
  Music: 10%
  Lighting/Sound: 3%
  (Venue: 0%)
  
Allocation:
  Mehendi Artist: ₹0.75L (25%)
  Decoration: ₹0.54L (18%)
  Catering: ₹0.66L (22%)
  Photography: ₹0.36L (12%)
  Videography: ₹0.24L (8%)
  Music: ₹0.30L (10%)
  Lighting/Sound: ₹0.09L (3%)
  Venue: ₹0.00L (0%)
  ──────────────
  TOTAL: ₹3.00L (100%)
```

---

## Next Steps

1. Implement EVENT_CATEGORY_ACTIVATIONS (all 23 event types)
2. Implement getActiveCategoriesForEvent() + normalizeAllocationWeights()
3. Integrate into EventBudgetPlanner.allocate()
4. Add tests
5. Manual verification
