import { describe, it, expect } from 'vitest';
import type { PlannerContext, BudgetPlan, AIResponse } from '@/lib/aiPlannerTypes';
import { processMessage } from '@/lib/aiPlanner';

describe('Budget Crash Regression Test: EventBudgetPlan → BudgetPlan Schema', () => {
  const createContext = (eventType: string): PlannerContext => ({
    eventType,
    city: 'Hyderabad',
    budget: 500000, // ₹5 lakhs
    guestCount: 300,
    eventDate: new Date('2025-03-15').toISOString(),
    luxuryLevel: 'standard',
    durationDays: 3,
    timeOfDay: 'evening',
  });

  describe('Budget Breakdown Response Schema', () => {
    it('Housewarming: Should transform EventBudgetPlan to BudgetPlan with breakdown array', async () => {
      const ctx = createContext('housewarming');
      const result = await processMessage('Budget breakdown for my housewarming', ctx, []);

      // Verify response exists
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response.type).toBe('budget_plan');

      // Verify data structure
      expect(result.response.data).toBeDefined();
      expect(result.response.data?.budgetPlan).toBeDefined();

      const budgetPlan = result.response.data?.budgetPlan as BudgetPlan;

      // CRITICAL: breakdown array must exist (this was undefined before fix)
      expect(budgetPlan.breakdown).toBeDefined();
      expect(Array.isArray(budgetPlan.breakdown)).toBe(true);
      expect(budgetPlan.breakdown.length).toBeGreaterThan(0);
    });

    it('Housewarming: breakdown items must have all required fields for BudgetCard rendering', async () => {
      const ctx = createContext('housewarming');
      const result = await processMessage('Budget breakdown for my housewarming', ctx, []);
      const budgetPlan = result.response.data?.budgetPlan as unknown as any;

      expect(budgetPlan).toBeDefined();
      expect(budgetPlan.breakdown).toBeDefined();
      expect(Array.isArray(budgetPlan.breakdown)).toBe(true);
      expect(budgetPlan.breakdown.length).toBeGreaterThan(0);

      // Each item needs these fields for BudgetCard to render (line 53 in AIResponseCards.tsx)
      for (let i = 0; i < budgetPlan.breakdown.length; i++) {
        const item = budgetPlan.breakdown[i];
        expect(item).toBeDefined(`breakdown[${i}] is undefined`);
        expect(item.category).toBeDefined(`breakdown[${i}].category is undefined`);
        expect(item.percentage).toBeDefined(`breakdown[${i}].percentage is undefined`);
        expect(item.recommended).toBeDefined(`breakdown[${i}].recommended is undefined`);
      }
    });

    it('Housewarming: MUST NOT crash on .map() call (root cause of original crash)', async () => {
      const ctx = createContext('housewarming');
      const result = await processMessage('Budget breakdown for my housewarming', ctx, []);
      const budgetPlan = result.response.data?.budgetPlan as BudgetPlan;

      // This would crash if breakdown was undefined
      expect(() => {
        budgetPlan.breakdown.map((item) => ({
          category: item.category,
          percentage: item.percentage,
          recommended: item.recommended,
        }));
      }).not.toThrow();
    });

    it('Housewarming: Should have all BudgetCard-required fields', async () => {
      const ctx = createContext('housewarming');
      const result = await processMessage('Budget breakdown for my housewarming', ctx, []);
      const budgetPlan = result.response.data?.budgetPlan as BudgetPlan;

      // BudgetCard uses these fields
      expect(budgetPlan.isFeasible).toBeDefined();
      expect(typeof budgetPlan.isFeasible).toBe('boolean');
      expect(budgetPlan.feasibilityNote).toBeDefined();
      expect(typeof budgetPlan.feasibilityNote).toBe('string');
      expect(budgetPlan.savingTips).toBeDefined();
      expect(Array.isArray(budgetPlan.savingTips)).toBe(true);
      expect(budgetPlan.remaining).toBeDefined();
      expect(typeof budgetPlan.remaining).toBe('number');
      expect(budgetPlan.grandTotal).toBeDefined();
      expect(typeof budgetPlan.grandTotal).toBe('number');
    });

    it('Birthday: Should work for birthday events', async () => {
      const ctx = createContext('birthday');
      ctx.guestCount = 50;
      ctx.budget = 100000;
      const result = await processMessage('Budget breakdown for my birthday', ctx, []);

      expect(result.response.type).toBe('budget_plan');
      const budgetPlan = result.response.data?.budgetPlan as BudgetPlan;
      expect(budgetPlan.breakdown).toBeDefined();
      expect(Array.isArray(budgetPlan.breakdown)).toBe(true);
    });

    it('Wedding: Should work for wedding events', async () => {
      const ctx = createContext('wedding');
      ctx.budget = 800000;
      const result = await processMessage('Budget breakdown for my wedding', ctx, []);

      expect(result.response.type).toBe('budget_plan');
      const budgetPlan = result.response.data?.budgetPlan as BudgetPlan;
      expect(budgetPlan.breakdown).toBeDefined();
      expect(Array.isArray(budgetPlan.breakdown)).toBe(true);
    });
  });

  describe('Plan Event Response Schema', () => {
    it('Housewarming: Full plan should have required structure', async () => {
      const ctx = createContext('housewarming');
      const result = await processMessage('Plan my complete housewarming event', ctx, []);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response.type).toBe('wedding_plan');
      expect(result.response.data?.weddingPlan).toBeDefined();

      const weddingPlan = result.response.data?.weddingPlan;
      expect(weddingPlan?.days).toBeDefined();
      expect(Array.isArray(weddingPlan?.days)).toBe(true);
    });

    it('Housewarming: Day plans should have arrays needed by UI', async () => {
      const ctx = createContext('housewarming');
      const result = await processMessage('Plan my complete housewarming event', ctx, []);
      const days = result.response.data?.weddingPlan?.days;

      expect(days).toBeDefined();
      if (days && days.length > 0) {
        const day = days[0];
        // All these arrays are used by DayCard component
        expect(day.slots).toBeDefined();
        expect(Array.isArray(day.slots)).toBe(true);
        expect(day.checklist).toBeDefined();
        expect(Array.isArray(day.checklist)).toBe(true);
        expect(day.vendors).toBeDefined();
        expect(Array.isArray(day.vendors)).toBe(true);
        expect(day.aiTips).toBeDefined();
        expect(Array.isArray(day.aiTips)).toBe(true);
      }
    });

    it('Housewarming: Should NOT have undefined arrays that would crash on .map()', async () => {
      const ctx = createContext('housewarming');
      const result = await processMessage('Plan my complete housewarming event', ctx, []);
      const days = result.response.data?.weddingPlan?.days;

      if (days && days.length > 0) {
        const day = days[0];
        // These .map() calls would crash if arrays were undefined
        expect(() => day.slots.map((s) => s.activity)).not.toThrow();
        expect(() => day.checklist.map((c) => c.task)).not.toThrow();
        expect(() => day.vendors.map((v) => v.role)).not.toThrow();
        expect(() => day.aiTips.map((t) => t)).not.toThrow();
      }
    });
  });

  describe('Event Isolation: Housewarming Must NOT Contain Wedding Content', () => {
    it('Housewarming plan should NOT contain wedding terminology', async () => {
      const ctx = createContext('housewarming');
      const result = await processMessage('Plan my complete housewarming event', ctx, []);

      const fullResponse = JSON.stringify(result.response);
      const weddingTerms = ['bride', 'groom', 'haldi', 'mehendi', 'sangeet', 'baraat', 'bridal', 'mandap', 'wedding ceremony'];
      
      for (const term of weddingTerms) {
        // Case-insensitive check (but excluding cases where these might be legitimate labels)
        const matches = (fullResponse.match(new RegExp(term, 'gi')) || []).length;
        expect(matches).toBe(0, `Housewarming response should not contain "${term}"`);
      }
    });

    it('Housewarming plan should contain housewarming-specific terminology', async () => {
      const ctx = createContext('housewarming');
      const result = await processMessage('Plan my complete housewarming event', ctx, []);

      const fullResponse = JSON.stringify(result.response).toLowerCase();
      
      // At least one of these should appear
      const housewarmingTerms = ['housewarming', 'puja', 'griha pravesh', 'ritual', 'ceremony', 'home'];
      const foundTerms = housewarmingTerms.filter(term => fullResponse.includes(term.toLowerCase()));
      
      expect(foundTerms.length).toBeGreaterThan(0, 'Housewarming plan should contain housewarming-specific terminology');
    });
  });

  describe('Real User Flow: Budget Submission After Planning', () => {
    it('Should handle sequence: Planning message → Budget request', async () => {
      const ctx = createContext('housewarming');

      // Step 1: Initial planning message
      const planResult = await processMessage('Plan my complete housewarming event', ctx, []);
      expect(planResult.response.type).toBe('wedding_plan');
      expect(planResult.response.data?.weddingPlan?.days).toBeDefined();

      // Step 2: Update context with the result
      const updatedCtx = planResult.updatedContext;

      // Step 3: Request budget breakdown
      const budgetResult = await processMessage('Give me budget breakdown', updatedCtx, []);
      expect(budgetResult.response.type).toBe('budget_plan');
      expect(budgetResult.response.data?.budgetPlan?.breakdown).toBeDefined();
      expect(Array.isArray(budgetResult.response.data?.budgetPlan?.breakdown)).toBe(true);
    });
  });
});
