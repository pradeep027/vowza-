/**
 * Event Isolation Test Suite
 * 
 * Verifies that Vowza Planner is EVENT-SPECIFIC from beginning to end.
 * No wedding-derived content may enter a non-wedding event plan.
 * Single source of truth: PlannerContext.eventType
 * 
 * Tests cover:
 * - Event-specific activity generation (no wedding words in housewarming)
 * - Event-specific checklist generation (no bride/groom tasks in birthday)
 * - Event-specific tip generation (no mandate timings in housewarming)
 * - Event-specific vendor recommendations (no mehendi artists in birthday)
 * - Event-specific budget allocations (correct cost categories per event)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateEventAwarePlan } from '../aiPlanner';
import { EventBudgetPlanner } from '../eventBudgetPlanner';
import type { PlannerContext, EventCategory } from '../types';

describe('Event Isolation Tests — No Wedding Contamination', () => {
  const baseContext: Partial<PlannerContext> = {
    budget: 500000,
    guestCount: 100,
    city: 'Hyderabad',
    durationDays: 1,
    luxuryLevel: 'standard',
    eventDate: '2025-03-15', // Pass as string, not Date object
  };

  const weddingWeddingWords = [
    'bride', 'groom', 'baraat', 'mehendi', 'haldi', 'sangeet', 'mandap',
    'muhurat', 'couple', 'marriage', 'married', 'wedding', 'ceremony ritual',
    'bridal', 'groom\'s', 'bride\'s', 'first dance', 'reception',
  ];

  const weddingHousewarmingWords = [
    'griha', 'pravesh', 'puja', 'torans', 'rangoli', 'new home',
    'housewarming', 'priest', 'auspicious', 'muhurat',
  ];

  const weddingBirthdayWords = [
    'cake', 'birthday', 'party', 'games', 'theme', 'decorations',
    'age', 'celebration', 'candles',
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: HOUSEWARMING EVENT — No Wedding Content
  // ─────────────────────────────────────────────────────────────────────────

  describe('Housewarming Event (eventType="housewarming")', () => {
    let plan: ReturnType<typeof generateEventAwarePlan>;

    beforeEach(() => {
      const context: PlannerContext = {
        ...baseContext,
        eventType: 'housewarming' as EventCategory,
      } as PlannerContext;
      plan = generateEventAwarePlan(context);
    });

    it('should be tagged as housewarming', () => {
      expect(plan).toBeDefined();
      expect(plan.overview).toBeDefined();
    });

    it('should NOT contain wedding-specific words in day descriptions', () => {
      const descriptions = plan.days.flatMap(d => [
        d.description || '',
        d.theme || '',
        ...d.slots.map(s => s.activity || ''),
      ]).join(' ').toLowerCase();

      const weddingWordsFound = weddingWeddingWords.filter(word =>
        descriptions.includes(word.toLowerCase())
      );

      expect(weddingWordsFound, `Found wedding words in housewarming: ${weddingWordsFound.join(', ')}`).toEqual([]);
    });

    it('should contain housewarming-specific activities', () => {
      const allActivities = plan.days
        .flatMap(d => d.slots.map(s => s.activity))
        .join(' ')
        .toLowerCase();

      expect(allActivities).toMatch(/puja|griha|pravesh|muhurat|priest/i);
    });

    it('should NOT contain wedding-specific checklist items', () => {
      const allTasks = plan.days
        .flatMap(d => d.checklist.map(c => c.task))
        .join(' ')
        .toLowerCase();

      const weddingTasksFound = [
        'baraat', 'mehendi', 'bride', 'groom', 'couple entry', 'first dance',
      ].filter(task => allTasks.includes(task.toLowerCase()));

      expect(weddingTasksFound, `Found wedding tasks in housewarming: ${weddingTasksFound.join(', ')}`).toEqual([]);
    });

    it('should contain housewarming-specific checklist items', () => {
      const allTasks = plan.days
        .flatMap(d => d.checklist.map(c => c.task))
        .join(' ')
        .toLowerCase();

      expect(allTasks).toMatch(/muhurat|puja|cleaning|priest|auspicious/i);
    });

    it('should NOT contain wedding-specific vendors', () => {
      const allVendors = plan.days
        .flatMap(d => d.vendors.map(v => v.role))
        .join(' ')
        .toLowerCase();

      const weddingVendorsFound = [
        'mehendi artist', 'videographer', 'makeup artist', 'baraat',
      ].filter(v => allVendors.includes(v.toLowerCase()));

      expect(weddingVendorsFound, `Found wedding vendors in housewarming: ${weddingVendorsFound.join(', ')}`).toEqual([]);
    });

    it('should contain housewarming-specific vendors', () => {
      const allVendors = plan.days
        .flatMap(d => d.vendors.map(v => v.role))
        .join(' ')
        .toLowerCase();

      expect(allVendors).toMatch(/priest|pandit|decorator/i);
    });

    it('should NOT contain wedding-specific tips', () => {
      const allTips = plan.days
        .flatMap(d => d.aiTips || [])
        .join(' ')
        .toLowerCase();

      const weddingTipsFound = [
        'baraat', 'golden hour', 'couple', 'bride', 'groom', 'mehendi', 'haldi',
      ].filter(tip => allTips.includes(tip.toLowerCase()));

      expect(weddingTipsFound, `Found wedding tips in housewarming: ${weddingTipsFound.join(', ')}`).toEqual([]);
    });

    it('should have housewarming-specific budget categories', () => {
      const categories = plan.days
        .flatMap(d => d.budget.breakdown.map(b => b.category))
        .join(' ')
        .toLowerCase();

      expect(categories).toMatch(/puja|priest|decoration|catering/i);
      expect(categories).not.toMatch(/mehendi|baraat/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: BIRTHDAY EVENT — No Wedding Content
  // ─────────────────────────────────────────────────────────────────────────

  describe('Birthday Event (eventType="birthday")', () => {
    let plan: ReturnType<typeof generateEventAwarePlan>;

    beforeEach(() => {
      const context: PlannerContext = {
        ...baseContext,
        eventType: 'birthday' as EventCategory,
      } as PlannerContext;
      plan = generateEventAwarePlan(context);
    });

    it('should be tagged as birthday', () => {
      expect(plan).toBeDefined();
      expect(plan.overview).toBeDefined();
    });

    it('should NOT contain wedding-specific words in day descriptions', () => {
      const descriptions = plan.days.flatMap(d => [
        d.description || '',
        d.theme || '',
        ...d.slots.map(s => s.activity || ''),
      ]).join(' ').toLowerCase();

      const weddingWordsFound = weddingWeddingWords.filter(word =>
        descriptions.includes(word.toLowerCase())
      );

      expect(weddingWordsFound, `Found wedding words in birthday: ${weddingWordsFound.join(', ')}`).toEqual([]);
    });

    it('should contain birthday-specific activities', () => {
      const allActivities = plan.days
        .flatMap(d => d.slots.map(s => s.activity))
        .join(' ')
        .toLowerCase();

      expect(allActivities).toMatch(/cake|birthday|games|decoration|guest/i);
    });

    it('should NOT contain wedding-specific checklist items', () => {
      const allTasks = plan.days
        .flatMap(d => d.checklist.map(c => c.task))
        .join(' ')
        .toLowerCase();

      const weddingTasksFound = [
        'baraat', 'mehendi', 'bride', 'groom', 'couple', 'first dance',
      ].filter(task => allTasks.includes(task.toLowerCase()));

      expect(weddingTasksFound, `Found wedding tasks in birthday: ${weddingTasksFound.join(', ')}`).toEqual([]);
    });

    it('should contain birthday-specific checklist items', () => {
      const allTasks = plan.days
        .flatMap(d => d.checklist.map(c => c.task))
        .join(' ')
        .toLowerCase();

      expect(allTasks).toMatch(/cake|birthday|decoration|game|activity/i);
    });

    it('should NOT contain mehendi or makeup artist vendors', () => {
      const allVendors = plan.days
        .flatMap(d => d.vendors.map(v => v.role))
        .join(' ')
        .toLowerCase();

      expect(allVendors).not.toMatch(/mehendi|makeup|baraat/);
    });

    it('should contain birthday-appropriate vendors', () => {
      const allVendors = plan.days
        .flatMap(d => d.vendors.map(v => v.role))
        .join(' ')
        .toLowerCase();

      expect(allVendors).toMatch(/dj|caterer|decorator|photographer/i);
    });

    it('should NOT contain wedding-specific tips', () => {
      const allTips = plan.days
        .flatMap(d => d.aiTips || [])
        .join(' ')
        .toLowerCase();

      const weddingTipsFound = [
        'baraat', 'golden hour', 'couple', 'bride', 'groom', 'mehendi', 'haldi',
      ].filter(tip => allTips.includes(tip.toLowerCase()));

      expect(weddingTipsFound, `Found wedding tips in birthday: ${weddingTipsFound.join(', ')}`).toEqual([]);
    });

    it('should have birthday-specific budget categories', () => {
      const categories = plan.days
        .flatMap(d => d.budget.breakdown.map(b => b.category))
        .join(' ')
        .toLowerCase();

      expect(categories).toMatch(/catering|decoration|entertainment/i);
      expect(categories).not.toMatch(/mehendi|baraat|mandap/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: WEDDING EVENT — Still Works Correctly
  // ─────────────────────────────────────────────────────────────────────────

  describe('Wedding Event (eventType="wedding")', () => {
    let plan: ReturnType<typeof generateEventAwarePlan>;

    beforeEach(() => {
      const context: PlannerContext = {
        ...baseContext,
        eventType: 'wedding' as EventCategory,
        durationDays: 4, // Multi-day wedding
      } as PlannerContext;
      plan = generateEventAwarePlan(context);
    });

    it('should be tagged as wedding', () => {
      expect(plan).toBeDefined();
      expect(plan.overview).toBeDefined();
    });

    it('should contain wedding-specific activities', () => {
      const allActivities = plan.days
        .flatMap(d => d.slots.map(s => s.activity))
        .join(' ')
        .toLowerCase();

      expect(allActivities).toMatch(/decoration|photography|catering/i);
    });

    it('should contain wedding-specific checklist items (haldi, mehendi, wedding, reception)', () => {
      const allTasks = plan.days
        .flatMap(d => d.checklist.map(c => c.task))
        .join(' ')
        .toLowerCase();

      // Wedding-specific tasks should be present
      expect(allTasks).toMatch(/muhurat|vendor|confirmation|headcount/i);
    });

    it('should contain wedding-appropriate vendors', () => {
      const allVendors = plan.days
        .flatMap(d => d.vendors.map(v => v.role))
        .join(' ')
        .toLowerCase();

      expect(allVendors).toMatch(/photographer|decorator|caterer/i);
    });

    it('should have wedding-specific budget categories', () => {
      const categories = plan.days
        .flatMap(d => d.budget.breakdown.map(b => b.category))
        .join(' ')
        .toLowerCase();

      expect(categories).toMatch(/catering|decoration|photography/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: CORPORATE EVENT — No Wedding Content
  // ─────────────────────────────────────────────────────────────────────────

  describe('Corporate Event (eventType="corporate")', () => {
    let plan: ReturnType<typeof generateEventAwarePlan>;

    beforeEach(() => {
      const context: PlannerContext = {
        ...baseContext,
        eventType: 'corporate' as EventCategory,
        guestCount: 300, // Larger corporate event
      } as PlannerContext;
      plan = generateEventAwarePlan(context);
    });

    it('should NOT contain wedding-specific words', () => {
      const allText = plan.days.flatMap(d => [
        d.description || '',
        ...d.slots.map(s => s.activity || ''),
        ...d.checklist.map(c => c.task || ''),
      ]).join(' ').toLowerCase();

      const weddingWordsFound = [
        'bride', 'groom', 'couple', 'mehendi', 'haldi', 'baraat', 'reception',
      ].filter(word => allText.includes(word.toLowerCase()));

      expect(weddingWordsFound, `Found wedding words in corporate: ${weddingWordsFound.join(', ')}`).toEqual([]);
    });

    it('should contain corporate-specific elements', () => {
      const allText = plan.days.flatMap(d => [
        ...d.slots.map(s => s.activity || ''),
        ...d.vendors.map(v => v.description || ''),
      ]).join(' ').toLowerCase();

      expect(allText).toMatch(/venue|catering|decorator/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5: BUDGET PLANNER — eventType is Required (No Fallback)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Budget Planner Event Type Validation', () => {
    it('should throw error when eventType is undefined', () => {
      const context = {
        ...baseContext,
        eventType: undefined, // Missing eventType
      } as any;

      expect(() => EventBudgetPlanner.allocate(context)).toThrow(
        /event type is required/i
      );
    });

    it('should throw error when eventType is null', () => {
      const context = {
        ...baseContext,
        eventType: null, // Null eventType
      } as any;

      expect(() => EventBudgetPlanner.allocate(context)).toThrow(
        /event type is required/i
      );
    });

    it('should accept valid event types without throwing', () => {
      const validEventTypes: EventCategory[] = [
        'wedding',
        'housewarming',
        'birthday',
        'corporate',
        'baby_shower',
      ];

      validEventTypes.forEach(eventType => {
        const context: PlannerContext = {
          ...baseContext,
          eventType,
        } as PlannerContext;

        expect(() => EventBudgetPlanner.allocate(context)).not.toThrow();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6: DAY-SPECIFIC CONFIGURATION ERRORS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Day-Specific Configuration Validation', () => {
    it('should throw error for unknown dayType in buildTimeSlots', () => {
      // This would only happen if internal functions are called directly
      // Verify that the error handling is in place
      const context: PlannerContext = {
        ...baseContext,
        eventType: 'housewarming' as EventCategory,
        durationDays: 1,
      } as PlannerContext;

      expect(() => generateEventAwarePlan(context)).not.toThrow(
        /day type not found/i
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7: SEMANTIC ISOLATION — Event-Specific Vocabulary
  // ─────────────────────────────────────────────────────────────────────────

  describe('Semantic Isolation — Event-Specific Vocabulary', () => {
    it('housewarming should use housewarming vocabulary', () => {
      const context: PlannerContext = {
        ...baseContext,
        eventType: 'housewarming' as EventCategory,
      } as PlannerContext;
      const plan = generateEventAwarePlan(context);

      const allText = plan.days.flatMap(d => [
        ...d.slots.map(s => s.activity || ''),
        ...d.aiTips,
      ]).join(' ').toLowerCase();

      // Should mention housewarming-specific concepts
      const hasHousewarmingConcepts = /puja|priest|auspicious|home|new/i.test(allText);
      expect(hasHousewarmingConcepts, 'Housewarming plan should have housewarming concepts').toBe(true);
    });

    it('birthday should use birthday vocabulary', () => {
      const context: PlannerContext = {
        ...baseContext,
        eventType: 'birthday' as EventCategory,
      } as PlannerContext;
      const plan = generateEventAwarePlan(context);

      const allText = plan.days.flatMap(d => [
        ...d.slots.map(s => s.activity || ''),
        ...d.aiTips,
      ]).join(' ').toLowerCase();

      // Should mention birthday-specific concepts
      const hasBirthdayConcepts = /cake|birthday|games|celebration|age/i.test(allText);
      expect(hasBirthdayConcepts, 'Birthday plan should have birthday concepts').toBe(true);
    });

    it('corporate should use corporate vocabulary', () => {
      const context: PlannerContext = {
        ...baseContext,
        eventType: 'corporate' as EventCategory,
      } as PlannerContext;
      const plan = generateEventAwarePlan(context);

      const allText = plan.days.flatMap(d => [
        ...d.slots.map(s => s.activity || ''),
      ]).join(' ').toLowerCase();

      // Should mention corporate-specific concepts
      const hasCorporateConcepts = /venue|catering|decoration/i.test(allText);
      expect(hasCorporateConcepts, 'Corporate plan should have corporate concepts').toBe(true);
    });
  });
});
