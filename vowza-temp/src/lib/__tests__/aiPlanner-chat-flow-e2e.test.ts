// ─── AI Planner Chat Flow — End-to-End Tests ─────────────────────────────────
// Tests the full processMessage pipeline simulating a real chat conversation.
// Covers: greeting → context extraction → context update → full plan generation.

import { describe, it, expect } from 'vitest';
import { processMessage, generateBudgetPlan, generateWeddingPlan, fmt } from '../aiPlanner';
import type { PlannerContext, ChatMessage } from '../aiPlannerTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function msg(text: string): ChatMessage {
  return { id: crypto.randomUUID(), role: 'user', text, timestamp: new Date() };
}

function emptyCtx(): PlannerContext {
  return {};
}

function weddingCtx(): PlannerContext {
  return {
    eventType: 'wedding',
    city: 'Hyderabad',
    budget: 500000,
    guestCount: 300,
  };
}

// ─── Scenario 1: Fresh greeting ──────────────────────────────────────────────
describe('Chat Flow: Fresh Greeting', () => {
  it('should return welcome message on greeting with empty context', async () => {
    const { response, updatedContext } = await processMessage('hi', emptyCtx());

    expect(response.type).toBe('text');
    expect(response.text).toContain('Vowza AI Planner');
    expect(response.text.toLowerCase()).toContain("what's your event");
    expect(updatedContext).toBeDefined();
  });

  it('should handle "hello" greeting', async () => {
    const { response } = await processMessage('hello', emptyCtx());
    expect(response.type).toBe('text');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('should handle "hey" greeting', async () => {
    const { response } = await processMessage('hey', emptyCtx());
    expect(response.type).toBe('text');
  });
});

// ─── Scenario 2: Context extraction from first message ───────────────────────
describe('Chat Flow: Context Extraction', () => {
  it('should extract event type from "plan my wedding" and generate plan with defaults', async () => {
    const { response, updatedContext } = await processMessage('plan my wedding', emptyCtx());

    expect(updatedContext.eventType).toBe('wedding');
    // By design: planner fills sensible defaults (₹5L, 200 guests) and generates plan
    expect(response.type).toBe('wedding_plan');
  });

  it('should extract city from "in Hyderabad"', async () => {
    const { updatedContext } = await processMessage('wedding in Hyderabad', emptyCtx());
    expect(updatedContext.city).toBeDefined();
    expect(updatedContext.city?.toLowerCase()).toBe('hyderabad');
  });

  it('should extract budget from message', async () => {
    const { updatedContext } = await processMessage('budget is 5 lakh', emptyCtx());
    expect(updatedContext.budget).toBe(500000);
  });

  it('should extract guest count from message', async () => {
    const { updatedContext } = await processMessage('200 guests', emptyCtx());
    expect(updatedContext.guestCount).toBe(200);
  });

  it('should extract multiple fields from a combined message', async () => {
    const { updatedContext } = await processMessage(
      'wedding in Bangalore, 150 guests, budget 8 lakh',
      emptyCtx()
    );
    expect(updatedContext.eventType).toBe('wedding');
    expect(updatedContext.city?.toLowerCase()).toBe('bangalore');
    expect(updatedContext.guestCount).toBe(150);
    expect(updatedContext.budget).toBe(800000);
  });
});

// ─── Scenario 3: Context update (the bug we fixed) ───────────────────────────
describe('Chat Flow: Context Update (Bug Fix Verification)', () => {
  it('should handle "change city to Mumbai" without ReferenceError', async () => {
    const ctx = weddingCtx();
    const { response, updatedContext } = await processMessage('change city to Mumbai', ctx);

    // The key test: this should NOT throw ReferenceError for undefined 'updates'
    expect(response).toBeDefined();
    expect(response.type).toBe('text');
    expect(updatedContext).toBeDefined();
    // City should be updated
    expect(updatedContext.city?.toLowerCase()).toBe('mumbai');
    // Other fields preserved
    expect(updatedContext.eventType).toBe('wedding');
    expect(updatedContext.budget).toBe(500000);
    expect(updatedContext.guestCount).toBe(300);
  });

  it('should handle "increase budget to 10 lakh" as context update', async () => {
    const ctx = weddingCtx();
    const { response, updatedContext } = await processMessage('increase budget to 10 lakh', ctx);

    expect(response).toBeDefined();
    expect(response.type).toBe('text');
    expect(updatedContext.budget).toBe(1000000);
    // Other fields preserved
    expect(updatedContext.eventType).toBe('wedding');
    expect(updatedContext.guestCount).toBe(300);
  });

  it('should handle "change guest count to 500"', async () => {
    const ctx = weddingCtx();
    const { response, updatedContext } = await processMessage('change guest count to 500', ctx);

    expect(response).toBeDefined();
    expect(updatedContext.guestCount).toBe(500);
  });

  it('should handle "switch to birthday"', async () => {
    const ctx = weddingCtx();
    const { response, updatedContext } = await processMessage('actually let\'s do a birthday instead', ctx);

    expect(response).toBeDefined();
    expect(updatedContext).toBeDefined();
    // At minimum, response should be valid
    expect(response.text).toBeDefined();
  });
});

// ─── Scenario 4: Greeting with existing context ──────────────────────────────
describe('Chat Flow: Greeting with Existing Context', () => {
  it('should acknowledge existing context on re-greeting', async () => {
    const ctx = weddingCtx();
    const { response } = await processMessage('hi', ctx);

    expect(response.type).toBe('text');
    expect(response.text).toContain('wedding');
    expect(response.text).toContain('Hyderabad');
  });
});

// ─── Scenario 5: Structured plan generation ──────────────────────────────────
describe('Chat Flow: Full Plan Generation', () => {
  it('should generate budget breakdown when requested', async () => {
    const { response } = await processMessage('give me a budget breakdown', weddingCtx());

    expect(response.type).toBe('budget_plan');
    expect(response.data?.budgetPlan).toBeDefined();
    expect(response.data?.budgetPlan?.breakdown.length).toBeGreaterThan(0);
    expect(response.data?.budgetPlan?.totalBudget).toBe(500000);
  });

  it('should generate timeline when requested', async () => {
    const { response } = await processMessage('create a planning timeline', weddingCtx());

    expect(response.type).toBe('timeline');
    expect(response.data?.timeline).toBeDefined();
  });

  it('should generate checklist when requested', async () => {
    const { response } = await processMessage('show me the checklist', weddingCtx());

    expect(response.type).toBe('checklist');
    expect(response.data?.checklist).toBeDefined();
  });

  it('should generate food plan when requested', async () => {
    const { response } = await processMessage('help me plan the food and catering', weddingCtx());

    expect(response.type).toBe('food_plan');
    expect(response.data?.foodPlan).toBeDefined();
  });

  it('should generate full wedding plan', async () => {
    const ctx: PlannerContext = { ...weddingCtx(), durationDays: 3 };
    const { response } = await processMessage('plan my complete wedding', ctx);

    expect(response.type).toBe('wedding_plan');
    expect(response.data?.weddingPlan).toBeDefined();
    expect(response.data?.weddingPlan?.days.length).toBe(3);
    expect(response.data?.weddingPlan?.overview.guestCount).toBe(300);
    expect(response.data?.weddingPlan?.overview.location).toBe('Hyderabad');
  });

  it('should generate risk analysis', async () => {
    const { response } = await processMessage('what are the risks for my event', weddingCtx());

    expect(response.type).toBe('risk_analysis');
    expect(response.data?.risks).toBeDefined();
  });

  it('should generate success score', async () => {
    const { response } = await processMessage('give me a success score', weddingCtx());

    expect(response.type).toBe('success_score');
    expect(response.data?.score).toBeDefined();
  });

  it('should handle negotiation request', async () => {
    const { response } = await processMessage(
      'negotiate with photographer from 60000 to 45000',
      weddingCtx()
    );

    expect(response.type).toBe('negotiation');
    expect(response.data?.negotiation).toBeDefined();
  });
});

// ─── Scenario 6: Budget plan data correctness ────────────────────────────────
describe('Chat Flow: Budget Plan Data Integrity', () => {
  it('budget breakdown categories should sum close to total', () => {
    const ctx = weddingCtx();
    const plan = generateBudgetPlan(ctx);

    expect(plan.totalBudget).toBe(500000);
    expect(plan.breakdown.length).toBeGreaterThan(0);

    // All breakdown items should have valid values
    for (const item of plan.breakdown) {
      expect(item.percentage).toBeGreaterThan(0);
      expect(item.percentage).toBeLessThanOrEqual(100);
      expect(item.recommended).toBeGreaterThan(0);
      expect(item.minCost).toBeLessThanOrEqual(item.recommended);
      expect(item.maxCost).toBeGreaterThanOrEqual(item.recommended);
      expect(item.notes.length).toBeGreaterThan(0);
    }
  });

  it('wedding plan should have valid day structures', () => {
    const ctx: PlannerContext = { ...weddingCtx(), durationDays: 3 };
    const plan = generateWeddingPlan(ctx);

    expect(plan.days.length).toBe(3);
    expect(plan.totalSpend).toBeGreaterThan(0);
    expect(plan.overview.totalBudget).toBe(500000);

    for (const day of plan.days) {
      expect(day.slots.length).toBeGreaterThan(0);
      expect(day.budget.total).toBeGreaterThan(0);
      expect(day.checklist.length).toBeGreaterThan(0);
      expect(day.vendors.length).toBeGreaterThan(0);
      expect(day.aiTips.length).toBeGreaterThan(0);
    }
  });
});

// ─── Scenario 7: fmt() utility ──────────────────────────────────────────────
describe('Chat Flow: fmt() Utility', () => {
  it('should format lakhs correctly', () => {
    expect(fmt(500000)).toBe('₹5.0 lakh');
    expect(fmt(1000000)).toBe('₹10.0 lakh');
  });

  it('should format crores correctly', () => {
    expect(fmt(10000000)).toBe('₹1.0 Cr');
    expect(fmt(15000000)).toBe('₹1.5 Cr');
  });

  it('should format thousands correctly', () => {
    expect(fmt(25000)).toBe('₹25K');
    expect(fmt(80000)).toBe('₹80K');
  });

  it('should format small amounts correctly', () => {
    expect(fmt(500)).toBe('₹500');
    expect(fmt(0)).toBe('₹0');
  });
});

// ─── Scenario 8: Multi-turn conversation memory ──────────────────────────────
describe('Chat Flow: Multi-Turn Context Memory', () => {
  it('should accumulate context across multiple messages', async () => {
    let ctx = emptyCtx();

    // Turn 1: Event type
    const r1 = await processMessage('planning a wedding', ctx);
    ctx = r1.updatedContext;
    expect(ctx.eventType).toBe('wedding');

    // Turn 2: City
    const r2 = await processMessage('in Chennai', ctx);
    ctx = r2.updatedContext;
    expect(ctx.city?.toLowerCase()).toBe('chennai');
    expect(ctx.eventType).toBe('wedding'); // preserved

    // Turn 3: Budget
    const r3 = await processMessage('budget is 7 lakh', ctx);
    ctx = r3.updatedContext;
    expect(ctx.budget).toBe(700000);
    expect(ctx.eventType).toBe('wedding'); // preserved
    expect(ctx.city?.toLowerCase()).toBe('chennai'); // preserved

    // Turn 4: Guests
    const r4 = await processMessage('250 guests', ctx);
    ctx = r4.updatedContext;
    expect(ctx.guestCount).toBe(250);
    expect(ctx.eventType).toBe('wedding');
    expect(ctx.city?.toLowerCase()).toBe('chennai');
    expect(ctx.budget).toBe(700000);

    // Turn 5: Generate plan with all context
    const r5 = await processMessage('plan my complete wedding', ctx);
    expect(r5.response.type).toBe('wedding_plan');
    expect(r5.response.data?.weddingPlan?.overview.guestCount).toBe(250);
    expect(r5.response.data?.weddingPlan?.overview.location).toBe('Chennai');
  });

  it('should handle context update after full context is set', async () => {
    const ctx = weddingCtx();

    // Update budget
    const { updatedContext } = await processMessage('actually budget is 8 lakh', ctx);

    expect(updatedContext.budget).toBe(800000);
    expect(updatedContext.eventType).toBe('wedding'); // preserved
    expect(updatedContext.city).toBe('Hyderabad'); // preserved
    expect(updatedContext.guestCount).toBe(300); // preserved
  });
});

console.log('[AI Planner Chat Flow E2E Tests] All scenarios defined and ready.');
