/**
 * Event Isolation E2E Test Suite
 * 
 * Simulates real user scenarios:
 * 1. "Plan a housewarming for 300 guests in Hyderabad" - Verify NO wedding content
 * 2. "Plan a wedding for 300 guests" - Verify wedding works correctly
 * 3. "Plan a birthday party for 50 people" - Verify birthday works correctly
 * 
 * These tests validate the complete event planning flow from user input through
 * complete plan generation, ensuring event-specific content throughout.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateEventAwarePlan } from '../aiPlanner';
import { EventBudgetPlanner } from '../eventBudgetPlanner';
import type { PlannerContext, EventCategory } from '../types';

describe('E2E Event Isolation Tests — Complete User Scenarios', () => {
  
  // ─────────────────────────────────────────────────────────────────────────
  // E2E #1: Housewarming for 300 guests in Hyderabad
  // ─────────────────────────────────────────────────────────────────────────

  describe('E2E #1: Housewarming Planning (300 guests, Hyderabad)', () => {
    let plan: ReturnType<typeof generateEventAwarePlan>;
    let budget: ReturnType<typeof EventBudgetPlanner.allocate>;

    beforeEach(() => {
      const context: PlannerContext = {
        eventType: 'housewarming' as EventCategory,
        budget: 500000,
        guestCount: 300,
        city: 'Hyderabad',
        durationDays: 1,
        luxuryLevel: 'standard',
        eventDate: '2025-03-15',
      } as PlannerContext;

      plan = generateEventAwarePlan(context);
      budget = EventBudgetPlanner.allocate(context);
    });

    it('should generate housewarming plan successfully', () => {
      expect(plan).toBeDefined();
      expect(plan.days).toBeDefined();
      expect(plan.days.length).toBeGreaterThan(0);
    });

    it('should have housewarming budget allocations (not wedding)', () => {
      expect(budget.allocations).toBeDefined();
      expect(budget.allocations.length).toBeGreaterThan(0);

      const categories = budget.allocations.map(a => a.category).join('|').toLowerCase();
      
      // Should have housewarming-relevant categories
      expect(categories).toMatch(/catering|decoration|priest|puja/i);
      
      // Should NOT have wedding-specific categories
      expect(categories).not.toMatch(/mehendi|baraat|bridal|mandap/i);
    });

    it('should generate ZERO wedding-specific activity content', () => {
      const allText = plan.days
        .flatMap(d => [
          ...d.slots.map(s => s.activity || ''),
          ...d.slots.map(s => s.note || ''),
        ])
        .join(' ')
        .toLowerCase();

      const weddingWords = [
        'bride', 'groom', 'baraat', 'mehendi', 'haldi', 'sangeet', 'mandap',
        'bridal', 'groom\'s', 'bride\'s', 'first dance', 'reception', 'couple entry',
      ];

      const found = weddingWords.filter(w => allText.includes(w.toLowerCase()));
      expect(found, `Found wedding words in housewarming activities: ${found.join(', ')}`).toEqual([]);
    });

    it('should generate ZERO wedding-specific vendor recommendations', () => {
      const allVendors = plan.days
        .flatMap(d => d.vendors.map(v => v.role.toLowerCase()))
        .join('|');

      expect(allVendors).not.toMatch(/mehendi|makeup artist|baraat|videographer/i);
    });

    it('should generate ZERO wedding-specific checklist tasks', () => {
      const allTasks = plan.days
        .flatMap(d => d.checklist.map(c => c.task.toLowerCase()))
        .join('|');

      expect(allTasks).not.toMatch(/baraat|mehendi|bride|groom|couple|golden hour/i);
    });

    it('should generate housewarming-specific AI tips', () => {
      const allTips = plan.days
        .flatMap(d => d.aiTips || [])
        .join(' ')
        .toLowerCase();

      // Should mention housewarming concepts
      expect(allTips).toMatch(/puja|priest|home|auspicious|griha|new|muhurat/i);
    });

    it('should NOT generate wedding-specific tips for housewarming', () => {
      const allTips = plan.days
        .flatMap(d => d.aiTips || [])
        .join(' ')
        .toLowerCase();

      const weddingTips = [
        'baraat', 'golden hour', 'couple', 'bride', 'groom', 'mehendi', 'haldi',
        'first dance', 'baraat dj',
      ];

      const found = weddingTips.filter(t => allTips.includes(t.toLowerCase()));
      expect(found, `Found wedding tips in housewarming: ${found.join(', ')}`).toEqual([]);
    });

    it('budget should show housewarming-level cost per guest', () => {
      const costPerGuest = budget.totalBudget / 300;
      // Housewarming is typically 1000-2000 per guest, not 2000-3000 like wedding
      expect(costPerGuest).toBeLessThan(2000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // E2E #2: Wedding for 300 guests
  // ─────────────────────────────────────────────────────────────────────────

  describe('E2E #2: Wedding Planning (300 guests)', () => {
    let plan: ReturnType<typeof generateEventAwarePlan>;
    let budget: ReturnType<typeof EventBudgetPlanner.allocate>;

    beforeEach(() => {
      const context: PlannerContext = {
        eventType: 'wedding' as EventCategory,
        budget: 800000,
        guestCount: 300,
        city: 'Hyderabad',
        durationDays: 4, // Multi-day wedding (haldi, mehendi, sangeet, wedding)
        luxuryLevel: 'premium',
        eventDate: '2025-03-15',
      } as PlannerContext;

      plan = generateEventAwarePlan(context);
      budget = EventBudgetPlanner.allocate(context);
    });

    it('should generate wedding plan successfully', () => {
      expect(plan).toBeDefined();
      expect(plan.days).toBeDefined();
      expect(plan.days.length).toBe(4); // 4-day wedding
    });

    it('should have wedding budget allocations', () => {
      expect(budget.allocations).toBeDefined();
      expect(budget.allocations.length).toBeGreaterThan(0);

      const categories = budget.allocations.map(a => a.category).join('|').toLowerCase();
      
      // Should have wedding-relevant categories
      expect(categories).toMatch(/photography|catering|decoration|venue/i);
    });

    it('should include multi-day wedding events (haldi, mehendi, sangeet, wedding)', () => {
      const dayDescriptions = plan.days
        .map(d => d.description || '')
        .join(' ')
        .toLowerCase();

      // Wedding should have these events across multiple days
      const hasMultiDayEvents = 
        dayDescriptions.includes('haldi') ||
        dayDescriptions.includes('mehendi') ||
        dayDescriptions.includes('sangeet') ||
        dayDescriptions.includes('wedding');

      expect(hasMultiDayEvents).toBe(true);
    });

    it('should generate wedding-specific vendor recommendations', () => {
      const allVendors = plan.days
        .flatMap(d => d.vendors.map(v => v.role.toLowerCase()))
        .join('|');

      // Wedding should have photography, videography, makeup
      expect(allVendors).toMatch(/photographer|videographer|decorator|caterer/i);
    });

    it('should have wedding day theme and description', () => {
      expect(plan.days).toBeDefined();
      expect(plan.days.length).toBeGreaterThan(0);

      const dayTheme = plan.days[plan.days.length - 1].theme || '';
      const dayDescription = plan.days[plan.days.length - 1].description || '';

      // Final day should NOT be generic or housewarming - should have wedding context
      const fullText = `${dayTheme}${dayDescription}`.toLowerCase();
      expect(fullText).not.toMatch(/puja|priest|home|griha/i);
      // Should have wedding-like descriptive language
      expect(fullText).toMatch(/sacred|union|celebrated|event|day|main/i);
    });

    it('budget should show wedding-level cost per guest', () => {
      const costPerGuest = budget.totalBudget / 300;
      // Wedding is typically 2000-3000+ per guest
      expect(costPerGuest).toBeGreaterThan(2000);
    });

    it('should generate wedding AI tips', () => {
      const allTips = plan.days
        .flatMap(d => d.aiTips || [])
        .join(' ')
        .toLowerCase();

      // Should mention wedding-specific concepts
      expect(allTips).toMatch(/photography|vendor|timing|coordination|guest|celebration/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // E2E #3: Birthday Party for 50 people
  // ─────────────────────────────────────────────────────────────────────────

  describe('E2E #3: Birthday Party Planning (50 people)', () => {
    let plan: ReturnType<typeof generateEventAwarePlan>;
    let budget: ReturnType<typeof EventBudgetPlanner.allocate>;

    beforeEach(() => {
      const context: PlannerContext = {
        eventType: 'birthday' as EventCategory,
        budget: 150000,
        guestCount: 50,
        city: 'Hyderabad',
        durationDays: 1,
        luxuryLevel: 'standard',
        eventDate: '2025-03-15',
      } as PlannerContext;

      plan = generateEventAwarePlan(context);
      budget = EventBudgetPlanner.allocate(context);
    });

    it('should generate birthday plan successfully', () => {
      expect(plan).toBeDefined();
      expect(plan.days).toBeDefined();
      expect(plan.days.length).toBeGreaterThan(0);
    });

    it('should have birthday budget allocations (not wedding)', () => {
      expect(budget.allocations).toBeDefined();
      expect(budget.allocations.length).toBeGreaterThan(0);

      const categories = budget.allocations.map(a => a.category).join('|').toLowerCase();
      
      // Should have birthday-relevant categories
      expect(categories).toMatch(/catering|decoration|entertainment/i);
      
      // Should NOT have wedding-specific categories
      expect(categories).not.toMatch(/mehendi|baraat|bridal/i);
    });

    it('should generate birthday-specific activities (cake, games, etc.)', () => {
      const allActivities = plan.days
        .flatMap(d => d.slots.map(s => s.activity || ''))
        .join(' ')
        .toLowerCase();

      // Birthday should include these activities
      expect(allActivities).toMatch(/cake|birthday|game|decoration|music|dance|celebration/i);
    });

    it('should NOT contain wedding-specific words in activities', () => {
      const allActivities = plan.days
        .flatMap(d => d.slots.map(s => s.activity || ''))
        .join(' ')
        .toLowerCase();

      const weddingWords = [
        'bride', 'groom', 'baraat', 'mehendi', 'haldi', 'sangeet', 'mandap',
        'bridal', 'couple', 'first dance', 'reception',
      ];

      const found = weddingWords.filter(w => allActivities.includes(w.toLowerCase()));
      expect(found, `Found wedding words in birthday activities: ${found.join(', ')}`).toEqual([]);
    });

    it('should have birthday-appropriate vendors (no mehendi, makeup)', () => {
      const allVendors = plan.days
        .flatMap(d => d.vendors.map(v => v.role.toLowerCase()))
        .join('|');

      // Should have general party vendors
      expect(allVendors).toMatch(/caterer|decorator|dj|photographer/i);
      
      // Should NOT have wedding-specific vendors
      expect(allVendors).not.toMatch(/mehendi|makeup|baraat|videographer/i);
    });

    it('should NOT contain wedding-specific checklist tasks', () => {
      const allTasks = plan.days
        .flatMap(d => d.checklist.map(c => c.task.toLowerCase()))
        .join('|');

      expect(allTasks).not.toMatch(/baraat|mehendi|bride|groom|couple|golden hour|muhurat/i);
    });

    it('should generate birthday-specific AI tips', () => {
      const allTips = plan.days
        .flatMap(d => d.aiTips || [])
        .join(' ')
        .toLowerCase();

      // Should mention birthday concepts
      expect(allTips).toMatch(/cake|birthday|party|game|music|celebration|theme/i);
    });

    it('should NOT contain wedding tips', () => {
      const allTips = plan.days
        .flatMap(d => d.aiTips || [])
        .join(' ')
        .toLowerCase();

      const weddingTips = [
        'baraat', 'golden hour', 'bride', 'groom', 'mehendi', 'haldi',
        'couple entry', 'first dance',
      ];

      const found = weddingTips.filter(t => allTips.includes(t.toLowerCase()));
      expect(found, `Found wedding tips in birthday: ${found.join(', ')}`).toEqual([]);
    });

    it('budget should show birthday-level cost per guest', () => {
      const costPerGuest = budget.totalBudget / 50;
      // Birthday is typically 2000-5000 per guest depending on scale
      expect(costPerGuest).toBeLessThan(5000);
      expect(costPerGuest).toBeGreaterThan(1000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CROSS-SCENARIO VALIDATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Cross-Scenario Event Isolation Validation', () => {
    
    it('housewarming and wedding should be COMPLETELY different', () => {
      const housewarmingContext: PlannerContext = {
        eventType: 'housewarming' as EventCategory,
        budget: 500000,
        guestCount: 300,
        city: 'Hyderabad',
        durationDays: 1,
        luxuryLevel: 'standard',
        eventDate: '2025-03-15',
      } as PlannerContext;

      const weddingContext: PlannerContext = {
        eventType: 'wedding' as EventCategory,
        budget: 800000,
        guestCount: 300,
        city: 'Hyderabad',
        durationDays: 4,
        luxuryLevel: 'premium',
        eventDate: '2025-03-15',
      } as PlannerContext;

      const housewarmingPlan = generateEventAwarePlan(housewarmingContext);
      const weddingPlan = generateEventAwarePlan(weddingContext);

      // They should have different number of days
      expect(housewarmingPlan.days.length).not.toBe(weddingPlan.days.length);

      // They should have completely different vendors
      const housewarmingVendors = housewarmingPlan.days
        .flatMap(d => d.vendors.map(v => v.role))
        .join('|')
        .toLowerCase();

      const weddingVendors = weddingPlan.days
        .flatMap(d => d.vendors.map(v => v.role))
        .join('|')
        .toLowerCase();

      // Wedding should have mehendi/makeup, housewarming should have priest/puja
      expect(weddingVendors).toMatch(/mehendi|makeup|videographer/i);
      expect(housewarmingVendors).not.toMatch(/mehendi|makeup|videographer/i);
    });

    it('birthday and wedding should have NO semantic overlap', () => {
      const birthdayContext: PlannerContext = {
        eventType: 'birthday' as EventCategory,
        budget: 150000,
        guestCount: 50,
        city: 'Hyderabad',
        durationDays: 1,
        luxuryLevel: 'standard',
        eventDate: '2025-03-15',
      } as PlannerContext;

      const weddingContext: PlannerContext = {
        eventType: 'wedding' as EventCategory,
        budget: 800000,
        guestCount: 300,
        city: 'Hyderabad',
        durationDays: 4,
        luxuryLevel: 'premium',
        eventDate: '2025-03-15',
      } as PlannerContext;

      const birthdayPlan = generateEventAwarePlan(birthdayContext);
      const weddingPlan = generateEventAwarePlan(weddingContext);

      const birthdayText = birthdayPlan.days
        .flatMap(d => [
          ...d.slots.map(s => s.activity),
          ...d.aiTips,
        ])
        .join(' ')
        .toLowerCase();

      const weddingText = weddingPlan.days
        .flatMap(d => [
          ...d.slots.map(s => s.activity),
          ...d.aiTips,
        ])
        .join(' ')
        .toLowerCase();

      // Wedding should have bride/groom/couple, birthday should NOT
      expect(weddingText).toMatch(/bride|groom|couple/i);
      expect(birthdayText).not.toMatch(/bride|groom|couple/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // COMPREHENSIVE SEMANTIC VALIDATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Comprehensive Semantic Content Analysis', () => {
    
    it('all event types should use ONLY event-appropriate vocabulary', () => {
      const eventTypes: Array<{ type: EventCategory; label: string; expectedWords: string[]; forbiddenWords: string[] }> = [
        {
          type: 'housewarming' as EventCategory,
          label: 'Housewarming',
          expectedWords: ['puja', 'priest', 'home', 'new', 'preparation', 'ceremony'],
          forbiddenWords: ['bride', 'groom', 'mehendi', 'baraat', 'makeup'],
        },
        {
          type: 'birthday' as EventCategory,
          label: 'Birthday',
          expectedWords: ['cake', 'party', 'game', 'music', 'celebration', 'theme'],
          forbiddenWords: ['bride', 'groom', 'mehendi', 'haldi', 'baraat', 'makeup'],
        },
        {
          type: 'wedding' as EventCategory,
          label: 'Wedding',
          expectedWords: ['bride', 'groom', 'ceremony', 'photography', 'decoration'],
          forbiddenWords: ['puja', 'priest', 'cake', 'games'],
        },
      ];

      eventTypes.forEach(({ type, label, expectedWords, forbiddenWords }) => {
        const context: PlannerContext = {
          eventType: type,
          budget: 500000,
          guestCount: 100,
          city: 'Hyderabad',
          durationDays: 1,
          luxuryLevel: 'standard',
          eventDate: '2025-03-15',
        } as PlannerContext;

        const plan = generateEventAwarePlan(context);
        const allText = plan.days
          .flatMap(d => [
            ...d.slots.map(s => s.activity || ''),
            ...d.aiTips,
          ])
          .join(' ')
          .toLowerCase();

        const foundExpected = expectedWords.filter(w => allText.includes(w.toLowerCase()));
        const foundForbidden = forbiddenWords.filter(w => allText.includes(w.toLowerCase()));

        expect(foundForbidden, 
          `${label}: Found forbidden words ${foundForbidden.join(', ')}`
        ).toEqual([]);
      });
    });
  });
});
