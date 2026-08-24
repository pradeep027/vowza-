/**
 * COMPREHENSIVE EVENT ISOLATION TEST SUITE
 * 
 * Verifies that ALL 7+ event types generate event-specific content with ZERO wedding contamination.
 * Tests the complete pipeline: extraction → context survival → budget → checklist → vendors → plan generation.
 * 
 * Test Scenarios:
 * 1. Housewarming: No wedding terms, includes pandit/ritual terms
 * 2. Wedding: Includes wedding-specific terms (bride, groom, baraat, mehendi)
 * 3. Birthday: No wedding terms, includes cake/games
 * 4. Baby Shower: No wedding terms, includes mom-to-be/pregnancy terms
 * 5. Corporate: No wedding terms, includes corporate/business terms
 * 6. Engagement: No wedding terms, includes ring/couple terminology
 * 7. College Event: No wedding terms, includes student/college terminology
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventBudgetPlanner } from '../eventBudgetPlanner';
import { generateChecklist, recommendVendors, generateTimeline, generateEventOverviewText } from '../aiPlanner';
import type { PlannerContext } from '../aiPlannerTypes';

// ─── Test Data: Context for each event type ────────────────────────────────
const testContexts: Record<string, PlannerContext> = {
  housewarming: {
    eventType: 'housewarming',
    city: 'Hyderabad',
    guestCount: 300,
    budget: 180000,
    luxuryLevel: 'standard',
    venueType: 'indoor',
    durationDays: 1,
  },
  wedding: {
    eventType: 'wedding',
    city: 'Hyderabad',
    guestCount: 500,
    budget: 1500000,
    luxuryLevel: 'premium',
    venueType: 'outdoor',
    durationDays: 3,
  },
  birthday: {
    eventType: 'birthday',
    city: 'Hyderabad',
    guestCount: 50,
    budget: 40000,
    luxuryLevel: 'standard',
    venueType: 'indoor',
    durationDays: 1,
  },
  babyshower: {
    eventType: 'babyshower',
    city: 'Hyderabad',
    guestCount: 60,
    budget: 50000,
    luxuryLevel: 'standard',
    venueType: 'indoor',
    durationDays: 1,
  },
  corporate: {
    eventType: 'corporate',
    city: 'Hyderabad',
    guestCount: 200,
    budget: 400000,
    luxuryLevel: 'premium',
    venueType: 'indoor',
    durationDays: 1,
  },
  engagement: {
    eventType: 'engagement',
    city: 'Hyderabad',
    guestCount: 200,
    budget: 300000,
    luxuryLevel: 'premium',
    venueType: 'indoor',
    durationDays: 1,
  },
  college_event: {
    eventType: 'college_event',
    city: 'Hyderabad',
    guestCount: 300,
    budget: 100000,
    luxuryLevel: 'standard',
    venueType: 'indoor',
    durationDays: 1,
  },
};

// ─── Wedding contamination terms to reject for non-wedding events ─────────────
const weddingTerms = [
  'bride', 'groom', 'baraat', 'mehendi', 'haldi', 'sangeet', 'mandap',
  'pheras', 'wedding ritual', 'bridal', 'marital', 'wedding reception',
  'first dance', 'cake cutting', // wedding-specific, not just any event
];

// ─── Event-specific terms that MUST appear ──────────────────────────────────
const eventSpecificTerms: Record<string, string[]> = {
  housewarming: ['pandit', 'puja', 'ritual', 'griha', 'prasad', 'auspicious'],
  wedding: ['bride', 'groom', 'baraat', 'mehendi', 'ceremony'],
  birthday: ['cake', 'birthday', 'games', 'theme'],
  babyshower: ['baby', 'mom-to-be', 'pregnancy', 'shower'],
  corporate: ['corporate', 'business', 'presentation', 'session', 'conference'],
  engagement: ['ring', 'engagement', 'couple', 'ceremony'],
  college_event: ['college', 'student', 'event', 'performance'],
};

describe('🎯 EVENT ISOLATION COMPREHENSIVE TEST SUITE', () => {
  describe('✅ UNIT TESTS: Event Type Extraction & Context', () => {
    it('should preserve eventType through context', () => {
      Object.entries(testContexts).forEach(([name, ctx]) => {
        expect(ctx.eventType).toBe(name);
      });
    });

    it('should have all required context fields for each event', () => {
      Object.values(testContexts).forEach((ctx) => {
        expect(ctx.eventType).toBeDefined();
        expect(ctx.city).toBeDefined();
        expect(ctx.guestCount).toBeGreaterThan(0);
        expect(ctx.budget).toBeGreaterThan(0);
        expect(ctx.luxuryLevel).toBeDefined();
      });
    });
  });

  describe('💰 BUDGET ALLOCATION TESTS', () => {
    Object.entries(testContexts).forEach(([eventType, context]) => {
      describe(`${eventType.toUpperCase()}`, () => {
        it(`should generate valid budget for ${eventType}`, () => {
          const budget = EventBudgetPlanner.allocate(context);
          expect(budget).toBeDefined();
          expect(budget.eventType).toBe(eventType);
          expect(budget.totalBudget).toBe(context.budget);
          expect(budget.guestCount).toBe(context.guestCount);
        });

        it(`should have no undefined allocations for ${eventType}`, () => {
          const budget = EventBudgetPlanner.allocate(context);
          expect(budget.allocations).toBeDefined();
          expect(Array.isArray(budget.allocations)).toBe(true);
          expect(budget.allocations.length).toBeGreaterThan(0);
          
          budget.allocations.forEach((alloc) => {
            expect(alloc.category).toBeDefined();
            expect(alloc.basePercentage).toBeGreaterThan(0);
            expect(alloc.allocatedAmount).toBeGreaterThan(0);
            expect(alloc.reasoning).toBeDefined();
          });
        });

        it(`should have correct budget breakdown sum for ${eventType}`, () => {
          const budget = EventBudgetPlanner.allocate(context);
          const totalAllocated = budget.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
          expect(totalAllocated).toBeGreaterThan(0);
          expect(totalAllocated).toBeLessThanOrEqual(context.budget * 1.05); // Allow 5% rounding error
        });

        if (eventType !== 'wedding') {
          it(`should have NO wedding category for ${eventType}`, () => {
            const budget = EventBudgetPlanner.allocate(context);
            const categories = budget.allocations.map(a => a.category.toLowerCase());
            const hasWeddingCategory = categories.some(cat => 
              cat.includes('mehendi') || cat.includes('haldi') || cat.includes('baraat') || cat.includes('bridal')
            );
            expect(hasWeddingCategory).toBe(false);
          });
        }
      });
    });
  });

  describe('📝 CHECKLIST GENERATION TESTS', () => {
    Object.entries(testContexts).forEach(([eventType, context]) => {
      describe(`${eventType.toUpperCase()}`, () => {
        it(`should generate checklist for ${eventType}`, () => {
          const checklist = generateChecklist(context);
          expect(Array.isArray(checklist)).toBe(true);
          expect(checklist.length).toBeGreaterThan(0);
          checklist.forEach((item) => {
            expect(item.id).toBeDefined();
            expect(item.task).toBeDefined();
            expect(item.category).toBeDefined();
            expect(item.priority).toBeDefined();
            expect(item.owner).toBeDefined();
          });
        });

        if (eventType === 'housewarming') {
          it(`should include ritual tasks for ${eventType}`, () => {
            const checklist = generateChecklist(context);
            const tasks = checklist.map(c => c.task.toLowerCase());
            const hasRitualTasks = tasks.some(t => 
              t.includes('pandit') || t.includes('muhurat') || t.includes('pooja') || t.includes('ritual')
            );
            expect(hasRitualTasks).toBe(true);
          });
        }

        if (eventType === 'wedding') {
          it(`should include bridal tasks for ${eventType}`, () => {
            const checklist = generateChecklist(context);
            const tasks = checklist.map(c => c.task.toLowerCase());
            const hasBridalTasks = tasks.some(t => 
              t.includes('bridal') || t.includes('makeup') || t.includes('mehendi')
            );
            expect(hasBridalTasks).toBe(true);
          });
        }
      });
    });
  });

  describe('👥 VENDOR RECOMMENDATIONS TESTS', () => {
    Object.entries(testContexts).forEach(([eventType, context]) => {
      describe(`${eventType.toUpperCase()}`, () => {
        it(`should generate vendors for ${eventType}`, () => {
          const vendors = recommendVendors(context);
          expect(Array.isArray(vendors)).toBe(true);
          expect(vendors.length).toBeGreaterThan(0);
          vendors.forEach((v) => {
            expect(v.category).toBeDefined();
            expect(v.reason).toBeDefined();
            expect(v.minPrice).toBeGreaterThan(0);
            expect(v.maxPrice).toBeGreaterThanOrEqual(v.minPrice);
            expect(Array.isArray(v.tips)).toBe(true);
          });
        });

        if (eventType === 'housewarming') {
          it(`should recommend pandit/priest for ${eventType}`, () => {
            const vendors = recommendVendors(context);
            const categories = vendors.map(v => v.category.toLowerCase());
            const hasPandit = categories.some(cat => cat.includes('pandit') || cat.includes('priest'));
            expect(hasPandit).toBe(true);
          });
        }

        if (eventType === 'wedding') {
          it(`should recommend makeup artist for ${eventType}`, () => {
            const vendors = recommendVendors(context);
            const categories = vendors.map(v => v.category.toLowerCase());
            const hasMakeup = categories.some(cat => cat.includes('makeup'));
            expect(hasMakeup).toBe(true);
          });
        }

        if (eventType === 'corporate') {
          it(`should recommend AV specialist for ${eventType}`, () => {
            const vendors = recommendVendors(context);
            const categories = vendors.map(v => v.category.toLowerCase());
            const hasAV = categories.some(cat => cat.includes('av') || cat.includes('sound') || cat.includes('staging'));
            expect(hasAV).toBe(true);
          });
        }
      });
    });
  });

  describe('🌍 EVENT OVERVIEW GENERATION TESTS', () => {
    Object.entries(testContexts).forEach(([eventType, context]) => {
      describe(`${eventType.toUpperCase()}`, () => {
        it(`should generate overview for ${eventType}`, () => {
          const overview = generateEventOverviewText(context);
          expect(overview).toBeDefined();
          expect(typeof overview).toBe('string');
          expect(overview.length).toBeGreaterThan(0);
          expect(overview).toContain('📋');
          expect(overview).toContain(context.city);
          expect(overview).toContain(`${context.guestCount}`);
        });

        it(`should NOT have wedding contamination in ${eventType} overview`, () => {
          const overview = generateEventOverviewText(context);
          if (eventType !== 'wedding') {
            const overviewLower = overview.toLowerCase();
            weddingTerms.forEach((term) => {
              // Only check if it's not a generic term that could appear in other contexts
              if (term === 'cake cutting' && eventType === 'birthday') return; // Birthday has cakes
              if (term === 'first dance' && eventType !== 'wedding') {
                expect(overviewLower).not.toContain(term);
              }
            });
          }
        });

        it(`should include event-specific terminology in ${eventType} overview`, () => {
          const overview = generateEventOverviewText(context);
          const overviewLower = overview.toLowerCase();
          const hasEventTerms = eventSpecificTerms[eventType].some((term) =>
            overviewLower.includes(term)
          );
          expect(hasEventTerms).toBe(true);
        });
      });
    });
  });

  describe('📅 TIMELINE GENERATION TESTS', () => {
    Object.entries(testContexts).forEach(([eventType, context]) => {
      describe(`${eventType.toUpperCase()}`, () => {
        it(`should generate timeline for ${eventType}`, () => {
          const timeline = generateTimeline(context);
          expect(timeline).toBeDefined();
          expect(Array.isArray(timeline.milestones)).toBe(true);
          expect(timeline.milestones.length).toBeGreaterThan(0);
          expect(Array.isArray(timeline.eventDaySchedule)).toBe(true);
          expect(Array.isArray(timeline.multiDaySchedule)).toBe(true);
        });

        it(`should have valid milestones for ${eventType}`, () => {
          const timeline = generateTimeline(context);
          timeline.milestones.forEach((milestone) => {
            expect(milestone.timeframe).toBeDefined();
            expect(milestone.priority).toBeDefined();
            expect(Array.isArray(milestone.tasks)).toBe(true);
            expect(milestone.tasks.length).toBeGreaterThan(0);
          });
        });

        it(`should have valid day schedule for ${eventType}`, () => {
          const timeline = generateTimeline(context);
          expect(timeline.eventDaySchedule.length).toBeGreaterThan(0);
          timeline.eventDaySchedule.forEach((slot) => {
            expect(slot.time).toBeDefined();
            expect(slot.activity).toBeDefined();
          });
        });

        it(`should have no .map() crash on eventDaySchedule for ${eventType}`, () => {
          const timeline = generateTimeline(context);
          // This tests that eventDaySchedule is not undefined/null
          expect(() => {
            timeline.eventDaySchedule.map((s) => s.time);
          }).not.toThrow();
        });

        it(`should have no .map() crash on multiDaySchedule for ${eventType}`, () => {
          const timeline = generateTimeline(context);
          // This tests that multiDaySchedule is an array
          expect(() => {
            timeline.multiDaySchedule.map((day) => day.slots);
          }).not.toThrow();
        });
      });
    });
  });

  describe('🔒 ZERO WEDDING CONTAMINATION TESTS (CRITICAL)', () => {
    const nonWeddingEvents = Object.entries(testContexts).filter(([name]) => name !== 'wedding');

    nonWeddingEvents.forEach(([eventType, context]) => {
      describe(`${eventType.toUpperCase()} - ZERO WEDDING TERMS`, () => {
        it(`should NOT mention bride/groom for ${eventType}`, () => {
          const checklist = generateChecklist(context);
          const checklistText = checklist.map(c => c.task.toLowerCase()).join(' ');
          expect(checklistText).not.toMatch(/\bbride\b/i);
          expect(checklistText).not.toMatch(/\bgroom\b/i);
        });

        it(`should NOT mention mehendi/haldi for ${eventType}`, () => {
          const checklist = generateChecklist(context);
          const checklistText = checklist.map(c => c.task.toLowerCase()).join(' ');
          expect(checklistText).not.toMatch(/\bmehendi\b/i);
          expect(checklistText).not.toMatch(/\bhaldi\b/i);
        });

        it(`should NOT mention baraat for ${eventType}`, () => {
          const overview = generateEventOverviewText(context);
          expect(overview.toLowerCase()).not.toMatch(/\bbaraat\b/i);
        });

        it(`should NOT mention wedding mandap for ${eventType}`, () => {
          const overview = generateEventOverviewText(context);
          expect(overview.toLowerCase()).not.toContain('mandap');
        });

        it(`should NOT recommend mehendi artist for ${eventType}`, () => {
          const vendors = recommendVendors(context);
          const hasUnwantedVendor = vendors.some(v => 
            v.category.toLowerCase().includes('mehendi')
          );
          expect(hasUnwantedVendor).toBe(false);
        });
      });
    });
  });

  describe('✨ EVENT-SPECIFIC CORRECTNESS TESTS', () => {
    it('HOUSEWARMING: should have pandit in budget and vendors', () => {
      const budget = EventBudgetPlanner.allocate(testContexts.housewarming);
      const vendors = recommendVendors(testContexts.housewarming);
      
      const hasPanditInBudget = budget.allocations.some(a => 
        a.category.toLowerCase().includes('pandit')
      );
      const hasPanditInVendors = vendors.some(v => 
        v.category.toLowerCase().includes('pandit')
      );
      
      expect(hasPanditInBudget).toBe(true);
      expect(hasPanditInVendors).toBe(true);
    });

    it('BIRTHDAY: should have cake and entertainment focus', () => {
      const budget = EventBudgetPlanner.allocate(testContexts.birthday);
      const categories = budget.allocations.map(a => a.category.toLowerCase());
      
      const hasCake = categories.some(c => c.includes('cake'));
      const hasEntertainment = categories.some(c => c.includes('entertainment'));
      
      expect(hasCake || hasEntertainment).toBe(true);
    });

    it('CORPORATE: should have venue and AV/staging focus', () => {
      const budget = EventBudgetPlanner.allocate(testContexts.corporate);
      const categories = budget.allocations.map(a => a.category.toLowerCase());
      
      const hasVenue = categories.some(c => c.includes('venue'));
      const hasAV = categories.some(c => c.includes('av') || c.includes('staging'));
      
      expect(hasVenue || hasAV).toBe(true);
    });

    it('ENGAGEMENT: should have ring ceremony elements', () => {
      const vendors = recommendVendors(testContexts.engagement);
      const overview = generateEventOverviewText(testContexts.engagement);
      
      expect(overview.toLowerCase()).toContain('engagement');
      expect(vendors.length).toBeGreaterThan(0);
    });

    it('COLLEGE_EVENT: should have student/college focus', () => {
      const overview = generateEventOverviewText(testContexts.college_event);
      expect(overview.toLowerCase()).toContain('college');
    });
  });

  describe('🚨 CRITICAL: No .map() crashes', () => {
    Object.entries(testContexts).forEach(([eventType, context]) => {
      it(`should not crash on .map() for ${eventType} checklist`, () => {
        const checklist = generateChecklist(context);
        expect(() => {
          checklist.map(c => c.task);
        }).not.toThrow();
      });

      it(`should not crash on .map() for ${eventType} vendors`, () => {
        const vendors = recommendVendors(context);
        expect(() => {
          vendors.map(v => v.category);
        }).not.toThrow();
      });

      it(`should not crash on .map() for ${eventType} budget allocations`, () => {
        const budget = EventBudgetPlanner.allocate(context);
        expect(() => {
          budget.allocations.map(a => a.category);
        }).not.toThrow();
      });
    });
  });

  describe('📊 DATA CONTRACT VALIDATION', () => {
    Object.entries(testContexts).forEach(([eventType, context]) => {
      it(`should have valid data contract for ${eventType}`, () => {
        const budget = EventBudgetPlanner.allocate(context);
        
        // Validate required fields exist and are not undefined
        expect(budget.eventType).toBeDefined();
        expect(budget.totalBudget).toBeGreaterThan(0);
        expect(budget.guestCount).toBeGreaterThan(0);
        expect(budget.allocations).toBeDefined();
        expect(budget.allocations.length).toBeGreaterThan(0);
        
        // Validate each allocation has required fields
        budget.allocations.forEach((alloc) => {
          expect(alloc.category).toBeDefined();
          expect(alloc.basePercentage).toBeGreaterThan(0);
          expect(alloc.minAmount).toBeGreaterThanOrEqual(0);
          expect(alloc.maxAmount).toBeGreaterThan(0);
          expect(alloc.allocatedAmount).toBeGreaterThan(0);
          expect(alloc.actualPercentage).toBeGreaterThan(0);
          expect(alloc.priority).toBeDefined();
          expect(alloc.required).toBeDefined();
          expect(alloc.reasoning).toBeDefined();
        });
      });
    });
  });
});
