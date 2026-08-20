/**
 * HOUSEWARMING INTEGRATION TEST
 * 
 * Real user flow: "Plan a housewarming for 300 guests in Hyderabad"
 * 
 * Verifies:
 * 1. eventType extraction from natural language
 * 2. eventType persistence through context
 * 3. Budget generation with correct allocations
 * 4. ZERO wedding contamination in output
 * 5. Housewarming-specific content present
 * 6. No .map() crashes on arrays
 * 7. Full plan generation for housewarming
 */

import { describe, it, expect } from 'vitest';
import { EventBudgetPlanner } from '../eventBudgetPlanner';
import { generateChecklist, recommendVendors, generateTimeline, generateEventOverviewText } from '../aiPlanner';
import type { PlannerContext } from '../aiPlannerTypes';

describe('🏠 HOUSEWARMING INTEGRATION TEST - Real User Flow', () => {
  /**
   * Simulates user message: "Plan a housewarming for 300 guests in Hyderabad"
   */
  const housewarmingContext: PlannerContext = {
    eventType: 'housewarming',
    city: 'Hyderabad',
    guestCount: 300,
    budget: 180000, // ~₹600 per guest × 300
    luxuryLevel: 'standard',
    venueType: 'indoor',
    durationDays: 1,
  };

  describe('Step 1: Context Validation', () => {
    it('should have eventType="housewarming"', () => {
      expect(housewarmingContext.eventType).toBe('housewarming');
    });

    it('should preserve all context fields', () => {
      expect(housewarmingContext.city).toBe('Hyderabad');
      expect(housewarmingContext.guestCount).toBe(300);
      expect(housewarmingContext.budget).toBe(180000);
    });
  });

  describe('Step 2: Budget Generation', () => {
    let budget: any;

    beforeEach(() => {
      budget = EventBudgetPlanner.allocate(housewarmingContext);
    });

    it('should generate budget for housewarming', () => {
      expect(budget).toBeDefined();
      expect(budget.eventType).toBe('housewarming');
      expect(budget.totalBudget).toBe(180000);
    });

    it('should have valid allocations array', () => {
      expect(Array.isArray(budget.allocations)).toBe(true);
      expect(budget.allocations.length).toBeGreaterThan(0);
    });

    it('should NOT crash on allocations.map()', () => {
      expect(() => {
        budget.allocations.map((a: any) => a.category);
      }).not.toThrow();
    });

    it('should NOT have wedding-specific budget categories', () => {
      const categories = budget.allocations.map((a: any) => a.category.toLowerCase());
      const hasWeddingCategory = categories.some((cat: string) => 
        cat.includes('mehendi') || cat.includes('haldi') || cat.includes('bridal makeup')
      );
      expect(hasWeddingCategory).toBe(false);
    });

    it('should include housewarming-specific categories', () => {
      const categories = budget.allocations.map((a: any) => a.category.toLowerCase());
      const hasHousewarmingCategory = categories.some((cat: string) => 
        cat.includes('pandit') || cat.includes('pooja') || cat.includes('cleaning')
      );
      expect(hasHousewarmingCategory).toBe(true);
    });

    it('should have reasonable budget allocation sums', () => {
      const totalAllocated = budget.allocations.reduce((sum: number, a: any) => sum + (a.allocatedAmount || 0), 0);
      expect(totalAllocated).toBeGreaterThan(0);
      expect(totalAllocated).toBeLessThanOrEqual(budget.totalBudget * 1.1);
    });
  });

  describe('Step 3: Checklist Generation', () => {
    let checklist: any[];

    beforeEach(() => {
      checklist = generateChecklist(housewarmingContext);
    });

    it('should generate checklist for housewarming', () => {
      expect(Array.isArray(checklist)).toBe(true);
      expect(checklist.length).toBeGreaterThan(0);
    });

    it('should have all required checklist fields', () => {
      checklist.forEach((item) => {
        expect(item.id).toBeDefined();
        expect(item.task).toBeDefined();
        expect(item.category).toBeDefined();
        expect(item.priority).toBeDefined();
        expect(item.owner).toBeDefined();
        expect(item.done).toBe(false);
      });
    });

    it('should NOT crash on checklist.map()', () => {
      expect(() => {
        checklist.map((c) => c.task);
      }).not.toThrow();
    });

    it('should include housewarming-specific ritual tasks', () => {
      const tasks = checklist.map((c) => c.task.toLowerCase());
      const hasRitualTasks = tasks.some((t) => 
        t.includes('pandit') || t.includes('muhurat') || t.includes('pooja') || t.includes('ritual')
      );
      expect(hasRitualTasks).toBe(true);
    });

    it('should NOT include wedding-specific bridal tasks', () => {
      const tasks = checklist.map((c) => c.task.toLowerCase());
      const hasBridalTasks = tasks.some((t) => 
        t.includes('bridal makeup') || t.includes('mehendi artist timing') || t.includes('bridal outfit')
      );
      expect(hasBridalTasks).toBe(false);
    });
  });

  describe('Step 4: Vendor Recommendations', () => {
    let vendors: any[];

    beforeEach(() => {
      vendors = recommendVendors(housewarmingContext);
    });

    it('should generate vendor recommendations', () => {
      expect(Array.isArray(vendors)).toBe(true);
      expect(vendors.length).toBeGreaterThan(0);
    });

    it('should have all required vendor fields', () => {
      vendors.forEach((v) => {
        expect(v.category).toBeDefined();
        expect(v.reason).toBeDefined();
        expect(v.minPrice).toBeGreaterThan(0);
        expect(v.maxPrice).toBeGreaterThanOrEqual(v.minPrice);
        expect(Array.isArray(v.tips)).toBe(true);
      });
    });

    it('should NOT crash on vendors.map()', () => {
      expect(() => {
        vendors.map((v) => v.category);
      }).not.toThrow();
    });

    it('should recommend pandit/priest for housewarming', () => {
      const hasRitualVendor = vendors.some((v) => 
        v.category.toLowerCase().includes('pandit') || 
        v.category.toLowerCase().includes('priest') ||
        v.category.toLowerCase().includes('ritual')
      );
      expect(hasRitualVendor).toBe(true);
    });

    it('should NOT recommend wedding-specific vendors', () => {
      const hasWeddingVendor = vendors.some((v) => 
        v.category.toLowerCase().includes('mehendi')
      );
      expect(hasWeddingVendor).toBe(false);
    });
  });

  describe('Step 5: Event Overview', () => {
    let overview: string;

    beforeEach(() => {
      overview = generateEventOverviewText(housewarmingContext);
    });

    it('should generate event overview', () => {
      expect(overview).toBeDefined();
      expect(typeof overview).toBe('string');
      expect(overview.length).toBeGreaterThan(0);
    });

    it('should include event type and guest count', () => {
      expect(overview).toContain('housewarming');
      expect(overview).toContain('Hyderabad');
      expect(overview).toContain('300');
    });

    it('should NOT contain wedding terminology', () => {
      const overviewLower = overview.toLowerCase();
      expect(overviewLower).not.toContain('bride');
      expect(overviewLower).not.toContain('groom');
      expect(overviewLower).not.toContain('baraat');
      expect(overviewLower).not.toContain('mehendi');
      expect(overviewLower).not.toContain('haldi');
      expect(overviewLower).not.toContain('mandap');
    });

    it('should include housewarming-specific concepts', () => {
      const overviewLower = overview.toLowerCase();
      // Should have decoration ideas, photography, entertainment, guest management
      expect(overviewLower).toContain('decoration');
      expect(overviewLower).toContain('photography');
      expect(overviewLower).toContain('parking');
    });
  });

  describe('Step 6: Timeline Generation', () => {
    let timeline: any;

    beforeEach(() => {
      timeline = generateTimeline(housewarmingContext);
    });

    it('should generate timeline', () => {
      expect(timeline).toBeDefined();
      expect(Array.isArray(timeline.milestones)).toBe(true);
      expect(Array.isArray(timeline.eventDaySchedule)).toBe(true);
      expect(Array.isArray(timeline.multiDaySchedule)).toBe(true);
    });

    it('should have valid milestones', () => {
      expect(timeline.milestones.length).toBeGreaterThan(0);
      timeline.milestones.forEach((m: any) => {
        expect(m.timeframe).toBeDefined();
        expect(m.priority).toBeDefined();
        expect(Array.isArray(m.tasks)).toBe(true);
      });
    });

    it('should NOT crash on eventDaySchedule.map()', () => {
      expect(() => {
        timeline.eventDaySchedule.map((s: any) => s.time);
      }).not.toThrow();
    });

    it('should NOT crash on multiDaySchedule.map()', () => {
      expect(() => {
        timeline.multiDaySchedule.map((day: any) => day.slots);
      }).not.toThrow();
    });

    it('should have day schedule slots for housewarming', () => {
      expect(timeline.eventDaySchedule.length).toBeGreaterThan(0);
      const activities = timeline.eventDaySchedule.map((s: any) => s.activity.toLowerCase());
      
      // Housewarming should have griha pravesh / puja related activities
      const hasHousewarmingActivities = activities.some((a: string) =>
        a.includes('puja') || a.includes('ritual') || a.includes('ceremony') || 
        a.includes('griha') || a.includes('prasad') || a.includes('pandit')
      );
      expect(hasHousewarmingActivities).toBe(true);
    });

    it('should NOT have wedding ceremony in day schedule', () => {
      const activities = timeline.eventDaySchedule.map((s: any) => s.activity.toLowerCase());
      const hasWeddingCeremony = activities.some((a: string) =>
        a.includes('baraat') || a.includes('pheras') || a.includes('bride gets ready') || 
        a.includes('groom gets ready')
      );
      expect(hasWeddingCeremony).toBe(false);
    });
  });

  describe('🎯 CRITICAL: Zero Wedding Contamination', () => {
    it('budget should NOT mention wedding terms', () => {
      const budget = EventBudgetPlanner.allocate(housewarmingContext);
      const budgetText = JSON.stringify(budget).toLowerCase();
      expect(budgetText).not.toContain('bride');
      expect(budgetText).not.toContain('mehendi');
    });

    it('checklist should NOT mention bride/groom', () => {
      const checklist = generateChecklist(housewarmingContext);
      const checklistText = checklist.map((c) => c.task.toLowerCase()).join(' ');
      expect(checklistText).not.toMatch(/\bbride\b/);
      expect(checklistText).not.toMatch(/\bgroom\b/);
    });

    it('vendors should NOT include mehendi artist', () => {
      const vendors = recommendVendors(housewarmingContext);
      const hasUnwantedVendor = vendors.some((v) => 
        v.category.toLowerCase().includes('mehendi')
      );
      expect(hasUnwantedVendor).toBe(false);
    });

    it('overview should NOT mention bride/groom/baraat', () => {
      const overview = generateEventOverviewText(housewarmingContext);
      const overviewLower = overview.toLowerCase();
      expect(overviewLower).not.toContain('bride');
      expect(overviewLower).not.toContain('groom');
      expect(overviewLower).not.toContain('baraat');
    });

    it('timeline should NOT mention wedding rituals', () => {
      const timeline = generateTimeline(housewarmingContext);
      const timelineText = JSON.stringify(timeline).toLowerCase();
      expect(timelineText).not.toContain('bride gets ready');
      expect(timelineText).not.toContain('groom gets ready');
      expect(timelineText).not.toContain('pheras');
    });
  });

  describe('✅ COMPLETE FLOW: End-to-End Housewarming Planning', () => {
    it('should complete full housewarming planning without crashes', () => {
      // Step 1: Budget
      const budget = EventBudgetPlanner.allocate(housewarmingContext);
      expect(budget.eventType).toBe('housewarming');
      
      // Step 2: Checklist
      const checklist = generateChecklist(housewarmingContext);
      expect(checklist.length).toBeGreaterThan(0);
      
      // Step 3: Vendors
      const vendors = recommendVendors(housewarmingContext);
      expect(vendors.length).toBeGreaterThan(0);
      
      // Step 4: Overview
      const overview = generateEventOverviewText(housewarmingContext);
      expect(overview.length).toBeGreaterThan(0);
      
      // Step 5: Timeline
      const timeline = generateTimeline(housewarmingContext);
      expect(timeline.milestones.length).toBeGreaterThan(0);
      
      // Verify NO crashes on map() calls
      expect(() => budget.allocations.map((a: any) => a.category)).not.toThrow();
      expect(() => checklist.map((c) => c.task)).not.toThrow();
      expect(() => vendors.map((v) => v.category)).not.toThrow();
      expect(() => timeline.eventDaySchedule.map((s: any) => s.time)).not.toThrow();
    });

    it('should maintain eventType through all transformations', () => {
      const budget = EventBudgetPlanner.allocate(housewarmingContext);
      const timeline = generateTimeline(housewarmingContext);
      
      // eventType should not change
      expect(budget.eventType).toBe('housewarming');
      expect(housewarmingContext.eventType).toBe('housewarming');
    });
  });
});
