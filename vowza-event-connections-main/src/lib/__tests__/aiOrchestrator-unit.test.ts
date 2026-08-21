// ─── AI Orchestrator — Unit Tests ────────────────────────────────────────────
// Tests the orchestrator's intent classification, context extraction, and
// edge case handling. Covers the bug fixes for:
//   1. Intent ordering (specific intents before generic plan_event)
//   2. Guest count regex ("to N guests" patterns)
//   3. Context update detection ("increase/decrease" patterns)
//   4. mergeContextIntelligently edge cases
//   5. calculatePlanningReadiness scoring

import { describe, it, expect } from 'vitest';
import {
  orchestrate,
  extractContextUpdates,
  mergeContextIntelligently,
  calculatePlanningReadiness,
  nextSoftFollowUp,
  recordAskedQuestion,
  markFieldConfirmed,
  hasAskedQuestion,
  isFieldConfirmed,
  isActiveCategoryListRequest,
} from '../aiOrchestrator';
import type { PlannerContext, ChatMessage } from '../aiPlannerTypes';

// ─── Test Helpers ────────────────────────────────────────────────────────────
const emptyCtx = (): PlannerContext => ({});
const weddingCtx = (): PlannerContext => ({
  eventType: 'wedding', city: 'Hyderabad', budget: 500000, guestCount: 300,
});

function msg(text: string, role: 'user' | 'assistant' = 'user'): ChatMessage {
  return { id: crypto.randomUUID(), role, text, timestamp: new Date() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. INTENT ORDERING — Specific intents must win over generic plan_event
// ═══════════════════════════════════════════════════════════════════════════════
describe('Intent Ordering', () => {
  describe('Budget intent BEFORE plan_event', () => {
    it('"give me a budget breakdown for my wedding" → budget_breakdown', () => {
      const r = orchestrate('give me a budget breakdown for my wedding', weddingCtx(), []);
      expect(r.intent).toBe('budget_breakdown');
    });

    it('"how much will a wedding cost" → budget_breakdown', () => {
      const r = orchestrate('how much will a wedding cost', weddingCtx(), []);
      expect(r.intent).toBe('budget_breakdown');
    });

    it('"estimate the price list" → budget_breakdown', () => {
      const r = orchestrate('estimate the price list', weddingCtx(), []);
      expect(r.intent).toBe('budget_breakdown');
    });
  });

  describe('Timeline intent BEFORE plan_event', () => {
    it('"create a planning timeline for my wedding" → timeline', () => {
      const r = orchestrate('create a planning timeline for my wedding', weddingCtx(), []);
      expect(r.intent).toBe('timeline');
    });

    it('"what should I do 3 months before" → timeline', () => {
      const r = orchestrate('what should I do 3 months before', weddingCtx(), []);
      expect(r.intent).toBe('timeline');
    });

    it('"planning schedule" → timeline', () => {
      const r = orchestrate('planning schedule', weddingCtx(), []);
      expect(r.intent).toBe('timeline');
    });
  });

  describe('Checklist intent BEFORE plan_event', () => {
    it('"show me the checklist" → checklist', () => {
      const r = orchestrate('show me the checklist', weddingCtx(), []);
      expect(r.intent).toBe('checklist');
    });

    it('"what do I need to prepare" → checklist', () => {
      const r = orchestrate('what do I need to prepare', weddingCtx(), []);
      expect(r.intent).toBe('checklist');
    });

    it('"things to arrange for the wedding" → checklist', () => {
      const r = orchestrate('things to arrange for the wedding', weddingCtx(), []);
      expect(r.intent).toBe('checklist');
    });
  });

  describe('Food intent BEFORE plan_event', () => {
    it('"help me plan the food and catering" → food_plan', () => {
      const r = orchestrate('help me plan the food and catering', weddingCtx(), []);
      expect(r.intent).toBe('food_plan');
    });

    it('"what food options for 200 guests" → food_plan', () => {
      const r = orchestrate('what food options for 200 guests', weddingCtx(), []);
      expect(r.intent).toBe('food_plan');
    });

    it('"help with menu and catering plan" → food_plan', () => {
      const r = orchestrate('help with menu and catering plan', weddingCtx(), []);
      expect(r.intent).toBe('food_plan');
    });

    it('"buffet vs veg options" → food_plan', () => {
      const r = orchestrate('buffet vs veg options', weddingCtx(), []);
      expect(r.intent).toBe('food_plan');
    });
  });

  describe('Generic plan_event still works', () => {
    it('"plan my wedding" → plan_event', () => {
      const r = orchestrate('plan my wedding', emptyCtx(), []);
      expect(r.intent).toBe('plan_event');
    });

    it('"create a complete plan" → plan_event', () => {
      const r = orchestrate('create a complete plan', weddingCtx(), []);
      expect(r.intent).toBe('plan_event');
    });

    it('"full plan for the event" → plan_event', () => {
      const r = orchestrate('full plan for the event', weddingCtx(), []);
      expect(r.intent).toBe('plan_event');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. GUEST COUNT EXTRACTION — "to N" patterns
// ═══════════════════════════════════════════════════════════════════════════════
describe('Guest Count Extraction', () => {
  describe('Standard patterns (number before word)', () => {
    it('"200 guests" → 200', () => {
      const u = extractContextUpdates('200 guests', emptyCtx());
      expect(u.guestCount).toBe(200);
    });

    it('"500 people" → 500', () => {
      const u = extractContextUpdates('500 people', emptyCtx());
      expect(u.guestCount).toBe(500);
    });

    it('"150 pax" → 150', () => {
      const u = extractContextUpdates('150 pax', emptyCtx());
      expect(u.guestCount).toBe(150);
    });

    it('"200 attendees" → 200', () => {
      const u = extractContextUpdates('200 attendees', emptyCtx());
      expect(u.guestCount).toBe(200);
    });

    it('"100 persons" → 100', () => {
      const u = extractContextUpdates('100 persons', emptyCtx());
      expect(u.guestCount).toBe(100);
    });

    it('"300 heads" → 300', () => {
      const u = extractContextUpdates('300 heads', emptyCtx());
      expect(u.guestCount).toBe(300);
    });
  });

  describe('"to N" patterns (number after connector)', () => {
    it('"change guest count to 500" → 500', () => {
      const u = extractContextUpdates('change guest count to 500', emptyCtx());
      expect(u.guestCount).toBe(500);
    });

    it('"guest count of 300" → 300', () => {
      const u = extractContextUpdates('guest count of 300', emptyCtx());
      expect(u.guestCount).toBe(300);
    });

    it('"expecting 200 guests" → 200', () => {
      const u = extractContextUpdates('expecting 200 guests', emptyCtx());
      expect(u.guestCount).toBe(200);
    });

    it('"expect 400 people" → 400', () => {
      const u = extractContextUpdates('expect 400 people', emptyCtx());
      expect(u.guestCount).toBe(400);
    });

    it('"expected 250 guests" → 250', () => {
      const u = extractContextUpdates('expected 250 guests', emptyCtx());
      expect(u.guestCount).toBe(250);
    });

    it('"about 150 guests" → 150', () => {
      const u = extractContextUpdates('about 150 guests', emptyCtx());
      expect(u.guestCount).toBe(150);
    });

    it('"around 300 guests" → 300', () => {
      const u = extractContextUpdates('around 300 guests', emptyCtx());
      expect(u.guestCount).toBe(300);
    });

    it('"with 200 guests" → 200', () => {
      const u = extractContextUpdates('with 200 guests', emptyCtx());
      expect(u.guestCount).toBe(200);
    });

    it('"having 100 guests" → 100', () => {
      const u = extractContextUpdates('having 100 guests', emptyCtx());
      expect(u.guestCount).toBe(100);
    });

    it('"total 500 guests" → 500', () => {
      const u = extractContextUpdates('total 500 guests', emptyCtx());
      expect(u.guestCount).toBe(500);
    });
  });

  describe('Mixed sentences', () => {
    it('"wedding in Bangalore, 150 guests, budget 8 lakh" → 150', () => {
      const u = extractContextUpdates('wedding in Bangalore, 150 guests, budget 8 lakh', emptyCtx());
      expect(u.guestCount).toBe(150);
    });

    it('"I have 350 guests coming" → 350', () => {
      const u = extractContextUpdates('I have 350 guests coming', emptyCtx());
      expect(u.guestCount).toBe(350);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CONTEXT UPDATE DETECTION — increase/decrease patterns
// ═══════════════════════════════════════════════════════════════════════════════
describe('Context Update Detection', () => {
  it('"change city to Mumbai" → context_update', () => {
    const r = orchestrate('change city to Mumbai', weddingCtx(), []);
    expect(r.intent).toBe('context_update');
    expect(r.updatedContext.city?.toLowerCase()).toBe('mumbai');
  });

  it('"increase budget to 10 lakh" → context_update', () => {
    const r = orchestrate('increase budget to 10 lakh', weddingCtx(), []);
    expect(r.intent).toBe('context_update');
    expect(r.updatedContext.budget).toBe(1000000);
  });

  it('"decrease budget" → context_update', () => {
    const r = orchestrate('decrease budget to 3 lakh', weddingCtx(), []);
    expect(r.intent).toBe('context_update');
  });

  it('"actually let\'s do a birthday" → context_update', () => {
    const r = orchestrate("actually let's do a birthday", weddingCtx(), []);
    expect(r.intent).toBe('context_update');
  });

  it('"switch to Chennai" → context_update', () => {
    const r = orchestrate('switch to Chennai', weddingCtx(), []);
    expect(r.intent).toBe('context_update');
  });

  it('"modify the guest count to 400" → context_update', () => {
    const r = orchestrate('modify the guest count to 400', weddingCtx(), []);
    expect(r.intent).toBe('context_update');
    expect(r.updatedContext.guestCount).toBe(400);
  });

  it('"make it luxury" → context_update', () => {
    const r = orchestrate('make it luxury', weddingCtx(), []);
    expect(r.intent).toBe('context_update');
    expect(r.updatedContext.luxuryLevel).toBe('luxury');
  });

  it('"raise budget to 15 lakh" → context_update', () => {
    const r = orchestrate('raise budget to 15 lakh', weddingCtx(), []);
    expect(r.intent).toBe('context_update');
    expect(r.updatedContext.budget).toBe(1500000);
  });

  it('"reduce guest count" → context_update', () => {
    const r = orchestrate('reduce guest count to 100', weddingCtx(), []);
    expect(r.intent).toBe('context_update');
    expect(r.updatedContext.guestCount).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MERGE CONTEXT INTELLIGENTLY — preservation and override
// ═══════════════════════════════════════════════════════════════════════════════
describe('mergeContextIntelligently', () => {
  it('should preserve existing fields when updating one field', () => {
    const prev = weddingCtx();
    const updates = { city: 'Mumbai' };
    const { merged } = mergeContextIntelligently(prev, updates, 'change city to Mumbai');

    expect(merged.city).toBe('Mumbai');
    expect(merged.eventType).toBe('wedding');
    expect(merged.budget).toBe(500000);
    expect(merged.guestCount).toBe(300);
  });

  it('should override existing field with new value', () => {
    const prev = weddingCtx();
    const updates = { budget: 1000000 };
    const { merged } = mergeContextIntelligently(prev, updates, 'budget is 10 lakh');

    expect(merged.budget).toBe(1000000);
    expect(merged.city).toBe('Hyderabad'); // preserved
  });

  it('should handle multiple simultaneous updates', () => {
    const prev = weddingCtx();
    const updates = { city: 'Chennai', budget: 800000, guestCount: 150 };
    const { merged } = mergeContextIntelligently(prev, updates, 'Chennai, 150 guests, budget 8 lakh');

    expect(merged.city).toBe('Chennai');
    expect(merged.budget).toBe(800000);
    expect(merged.guestCount).toBe(150);
    expect(merged.eventType).toBe('wedding'); // preserved
  });

  it('should not overwrite fields with undefined values', () => {
    const prev = weddingCtx();
    const updates = { city: undefined };
    const { merged } = mergeContextIntelligently(prev, updates, 'change city');

    expect(merged.city).toBe('Hyderabad'); // unchanged
  });

  it('should not overwrite fields with null values', () => {
    const prev = weddingCtx();
    const updates = { budget: null as any };
    const { merged } = mergeContextIntelligently(prev, updates, 'remove budget');

    expect(merged.budget).toBe(500000); // unchanged
  });

  it('should mark updated fields as confirmed', () => {
    const prev = weddingCtx();
    const updates = { city: 'Mumbai' };
    const { merged } = mergeContextIntelligently(prev, updates, 'change city to Mumbai');

    expect(merged.confirmedFields).toContain('city');
  });

  it('should handle empty updates gracefully', () => {
    const prev = weddingCtx();
    const { merged } = mergeContextIntelligently(prev, {}, 'hi');

    expect(merged).toEqual(expect.objectContaining({
      eventType: 'wedding',
      city: 'Hyderabad',
      budget: 500000,
      guestCount: 300,
    }));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CALCULATE PLANNING READINESS
// ═══════════════════════════════════════════════════════════════════════════════
describe('calculatePlanningReadiness', () => {
  it('full context → readiness score', () => {
    const { readiness, isSufficient } = calculatePlanningReadiness(weddingCtx());
    // eventType(25) + contextScore>=15(20) = 45; need luxuryLevel(+15) to reach 60
    expect(readiness).toBe(45);
    expect(isSufficient).toBe(false); // needs luxuryLevel or eventDate to reach 60
  });

  it('empty context → low readiness', () => {
    const { readiness, isSufficient, missingFields } = calculatePlanningReadiness(emptyCtx());
    expect(readiness).toBeLessThan(60);
    expect(isSufficient).toBe(false);
    expect(missingFields).toContain('eventType');
    expect(missingFields).toContain('budget');
  });

  it('event type only → still insufficient', () => {
    const ctx: PlannerContext = { eventType: 'wedding' };
    const { readiness, isSufficient } = calculatePlanningReadiness(ctx);
    expect(isSufficient).toBe(false);
    expect(readiness).toBeLessThan(60);
  });

  it('event + budget + luxuryLevel → sufficient (≥60)', () => {
    const ctx: PlannerContext = { eventType: 'wedding', budget: 500000, luxuryLevel: 'premium' };
    const { isSufficient } = calculatePlanningReadiness(ctx);
    // eventType(25) + contextScore(20) + luxuryLevel(15) = 60
    expect(isSufficient).toBe(true);
  });

  it('event + budget without luxury → insufficient', () => {
    const ctx: PlannerContext = { eventType: 'wedding', budget: 500000 };
    const { isSufficient } = calculatePlanningReadiness(ctx);
    // eventType(25) + contextScore(20) = 45
    expect(isSufficient).toBe(false);
  });

  it('event + city + guests without luxury → insufficient', () => {
    const ctx: PlannerContext = { eventType: 'wedding', city: 'Hyderabad', guestCount: 200 };
    const { isSufficient } = calculatePlanningReadiness(ctx);
    // eventType(25) + contextScore(20) = 45
    expect(isSufficient).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CONTEXT EXTRACTION — extractContextUpdates
// ═══════════════════════════════════════════════════════════════════════════════
describe('extractContextUpdates', () => {
  it('should extract event type', () => {
    const u = extractContextUpdates('planning a birthday', emptyCtx());
    expect(u.eventType).toBe('birthday');
  });

  it('should extract city from known cities', () => {
    const u = extractContextUpdates('in Hyderabad', emptyCtx());
    expect(u.city).toBe('Hyderabad');
  });

  it('should extract city from "in + City" pattern', () => {
    const u = extractContextUpdates('in Goa', emptyCtx());
    expect(u.city).toBe('Goa');
  });

  it('should extract budget in lakhs', () => {
    const u = extractContextUpdates('budget is 8 lakh', emptyCtx());
    expect(u.budget).toBe(800000);
  });

  it('should extract budget in crores', () => {
    const u = extractContextUpdates('2 crore budget', emptyCtx());
    expect(u.budget).toBe(20000000);
  });

  it('should extract budget in thousands', () => {
    const u = extractContextUpdates('budget 50k', emptyCtx());
    expect(u.budget).toBe(50000);
  });

  it('should extract venue type', () => {
    const u = extractContextUpdates('outdoor venue', emptyCtx());
    expect(u.venueType).toBe('outdoor');
  });

  it('should extract food preference', () => {
    const u = extractContextUpdates('non-veg menu', emptyCtx());
    expect(u.foodPreference).toBe('non-veg');
  });

  it('should extract luxury level', () => {
    const u = extractContextUpdates('premium wedding', emptyCtx());
    expect(u.luxuryLevel).toBe('premium');
  });

  it('should extract duration', () => {
    const u = extractContextUpdates('3 days event', emptyCtx());
    expect(u.durationDays).toBe(3);
  });

  it('should extract multiple fields at once', () => {
    const u = extractContextUpdates('wedding in Bangalore, 150 guests, budget 8 lakh', emptyCtx());
    expect(u.eventType).toBe('wedding');
    expect(u.city).toBe('Bangalore');
    expect(u.guestCount).toBe(150);
    expect(u.budget).toBe(800000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
describe('Utility Functions', () => {
  describe('nextSoftFollowUp', () => {
    it('should ask food preference first when empty', () => {
      const q = nextSoftFollowUp(emptyCtx());
      expect(q).toContain('Veg');
    });

    it('should ask service style after food pref', () => {
      const ctx: PlannerContext = { foodPreference: 'veg' };
      const q = nextSoftFollowUp(ctx);
      expect(q).toContain('Buffet');
    });

    it('should return null when all preferences are set', () => {
      const ctx: PlannerContext = {
        foodPreference: 'veg', serviceStyle: 'buffet', venueType: 'indoor',
        styleVibe: 'traditional', luxuryLevel: 'premium', timeOfDay: 'evening',
      };
      const q = nextSoftFollowUp(ctx);
      expect(q).toBeNull();
    });
  });

  describe('hasAskedQuestion / recordAskedQuestion', () => {
    it('should record and detect asked questions', () => {
      let ctx = emptyCtx();
      expect(hasAskedQuestion(ctx, 'What city?')).toBe(false);

      ctx = recordAskedQuestion(ctx, 'What city?');
      expect(hasAskedQuestion(ctx, 'What city?')).toBe(true);
      expect(hasAskedQuestion(ctx, 'What budget?')).toBe(false);
    });

    it('should not duplicate questions', () => {
      let ctx = emptyCtx();
      ctx = recordAskedQuestion(ctx, 'What city?');
      ctx = recordAskedQuestion(ctx, 'What city?');
      expect(ctx.askedQuestions?.length).toBe(1);
    });
  });

  describe('markFieldConfirmed / isFieldConfirmed', () => {
    it('should track confirmed fields', () => {
      let ctx = emptyCtx();
      expect(isFieldConfirmed(ctx, 'city')).toBe(false);

      ctx = markFieldConfirmed(ctx, 'city');
      expect(isFieldConfirmed(ctx, 'city')).toBe(true);
      expect(isFieldConfirmed(ctx, 'budget')).toBe(false);
    });
  });

  describe('isActiveCategoryListRequest', () => {
    it('"show categories" → true', () => {
      expect(isActiveCategoryListRequest('show categories')).toBe(true);
    });

    it('"list all vendor categories" → true', () => {
      expect(isActiveCategoryListRequest('list all vendor categories')).toBe(true);
    });

    it('"what are marketplace categories" → true', () => {
      expect(isActiveCategoryListRequest('what are marketplace categories')).toBe(true);
    });

    it('"find photographers" → false', () => {
      expect(isActiveCategoryListRequest('find photographers')).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. FULL ORCHESTRATE — Integration
// ═══════════════════════════════════════════════════════════════════════════════
describe('orchestrate: Full Integration', () => {
  it('should update context and return correct intent', () => {
    const r = orchestrate('change city to Mumbai', weddingCtx(), []);
    expect(r.intent).toBe('context_update');
    expect(r.updatedContext.city?.toLowerCase()).toBe('mumbai');
    expect(r.updatedContext.eventType).toBe('wedding'); // preserved
  });

  it('should handle sequential context updates', () => {
    let ctx = emptyCtx();

    const r1 = orchestrate('wedding in Hyderabad', ctx, []);
    ctx = r1.updatedContext;
    expect(ctx.eventType).toBe('wedding');
    expect(ctx.city).toBe('Hyderabad');

    const r2 = orchestrate('500 guests, budget 10 lakh', ctx, []);
    ctx = r2.updatedContext;
    expect(ctx.guestCount).toBe(500);
    expect(ctx.budget).toBe(1000000);
    expect(ctx.eventType).toBe('wedding'); // preserved
  });

  it('should not break on empty message', () => {
    const r = orchestrate('', weddingCtx(), []);
    expect(r.intent).toBeDefined();
    expect(r.updatedContext).toBeDefined();
  });

  it('should not break on very long message', () => {
    const longMsg = 'a'.repeat(1000);
    const r = orchestrate(longMsg, weddingCtx(), []);
    expect(r.intent).toBeDefined();
    expect(r.updatedContext).toBeDefined();
  });
});

console.log('[AI Orchestrator Unit Tests] All scenarios defined and ready.');
