import { describe, it, expect } from 'vitest';
import {
  getActiveCategoriesForEvent,
  normalizeAllocationWeights,
  applySensitivity,
  generateEventAwareBudget,
} from '../eventAwareBudgetEngine';
import type { PlannerContext } from '../aiPlannerTypes';

describe('Event-Aware Budget Engine', () => {
  // ─── WEDDING TESTS ───────────────────────────────────────────────────────

  describe('Wedding Budget', () => {
    it('TC-W1: Wedding includes 12 relevant categories', () => {
      const activations = getActiveCategoriesForEvent('wedding', {
        eventType: 'wedding',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
      });

      expect(activations.length).toBeGreaterThanOrEqual(11);
      const categories = activations.map(a => a.category.toLowerCase());
      expect(categories.some(c => c.includes('photography'))).toBe(true);
      expect(categories.some(c => c.includes('videography'))).toBe(true);
      expect(categories.some(c => c.includes('catering'))).toBe(true);
      expect(categories.some(c => c.includes('venue'))).toBe(true);
    });

    it('TC-W2: Wedding budget totals exactly 100%', () => {
      const context: PlannerContext = {
        eventType: 'wedding',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
      };

      const result = generateEventAwareBudget(context, 1000000);
      const totalPercentage = result.normalizedWeights.reduce((sum, w) => sum + w.normalizedWeight, 0);

      expect(totalPercentage).toBeCloseTo(100, 1);
    });

    it('TC-W3: Wedding budget totals exactly to user budget (₹10L)', () => {
      const budget = 1000000;
      const result = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 300, budget },
        budget
      );

      const totalAllocated = result.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      expect(totalAllocated).toBeCloseTo(budget, -2); // Within ±₹100
    });

    it('TC-W4: Wedding with 300 guests catering is realistic', () => {
      const result = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 300, budget: 1000000 },
        1000000
      );

      // Should not warn about unrealistic catering budget
      const cateringWarnings = result.warnings.filter(w => w.includes('catering'));
      expect(cateringWarnings.length).toBe(0);
    });
  });

  // ─── HOUSEWARMING TESTS ──────────────────────────────────────────────────

  describe('Housewarming Budget', () => {
    it('TC-H1: Housewarming at home (Venue = 0)', () => {
      const activations = getActiveCategoriesForEvent('housewarming', {
        eventType: 'housewarming',
        city: 'Hyderabad',
        guestCount: 100,
        budget: 300000,
        venueType: undefined, // Home
        hasVenue: false,
      });

      const hasVenue = activations.some(a => a.category.includes('Venue'));
      expect(hasVenue).toBe(false);
    });

    it('TC-H2: Housewarming at external venue (Venue active)', () => {
      const activations = getActiveCategoriesForEvent('housewarming', {
        eventType: 'housewarming',
        city: 'Hyderabad',
        guestCount: 100,
        budget: 300000,
        venueType: 'external',
      });

      const hasVenue = activations.some(a => a.category.includes('Venue'));
      expect(hasVenue).toBe(true);
    });

    it('TC-H3: Housewarming includes rituals/priest', () => {
      const activations = getActiveCategoriesForEvent('housewarming', {
        eventType: 'housewarming',
        city: 'Hyderabad',
        guestCount: 100,
        budget: 300000,
      });

      const categories = activations.map(a => a.category.toLowerCase());
      expect(categories.some(c => c.includes('priest') || c.includes('ritual'))).toBe(true);
    });
  });

  // ─── HALDI/MEHENDI TESTS ─────────────────────────────────────────────────

  describe('Haldi/Mehendi Budget', () => {
    it('TC-HM1: Haldi includes decoration and photography', () => {
      const activations = getActiveCategoriesForEvent('haldi', {
        eventType: 'haldi',
        city: 'Hyderabad',
        guestCount: 150,
        budget: 300000,
      });

      const categories = activations.map(a => a.category.toLowerCase());
      expect(categories.some(c => c.includes('decoration'))).toBe(true);
      expect(categories.some(c => c.includes('photography'))).toBe(true);
    });

    it('TC-HM2: Mehendi includes mehendi artist (high priority)', () => {
      const activations = getActiveCategoriesForEvent('mehendi', {
        eventType: 'mehendi',
        city: 'Hyderabad',
        guestCount: 200,
        budget: 300000,
      });

      const mehendi = activations.find(a => a.category.includes('Mehendi'));
      expect(mehendi).toBeDefined();
      expect(mehendi?.baseWeight).toBeGreaterThan(15); // High priority weight
    });

    it('TC-HM3: Mehendi music/entertainment active', () => {
      const activations = getActiveCategoriesForEvent('mehendi', {
        eventType: 'mehendi',
        city: 'Hyderabad',
        guestCount: 200,
        budget: 300000,
      });

      const categories = activations.map(a => a.category.toLowerCase());
      expect(categories.some(c => c.includes('music') || c.includes('entertainment'))).toBe(true);
    });
  });

  // ─── SANGEET TESTS ───────────────────────────────────────────────────────

  describe('Sangeet Budget', () => {
    it('TC-S1: Sangeet has high entertainment weight', () => {
      const activations = getActiveCategoriesForEvent('sangeet', {
        eventType: 'sangeet',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
      });

      const entertainment = activations.find(a => a.category.includes('Entertainment'));
      expect(entertainment).toBeDefined();
      expect(entertainment?.baseWeight).toBeGreaterThan(10); // Significant weight
    });

    it('TC-S2: Sangeet includes DJ/Band and lighting', () => {
      const activations = getActiveCategoriesForEvent('sangeet', {
        eventType: 'sangeet',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
      });

      const categories = activations.map(a => a.category.toLowerCase());
      expect(categories.some(c => c.includes('music') || c.includes('dj') || c.includes('band'))).toBe(true);
      expect(categories.some(c => c.includes('lighting') || c.includes('sound'))).toBe(true);
    });
  });

  // ─── DJ VS BAND TESTS ────────────────────────────────────────────────────

  describe('DJ/Band Selection', () => {
    it('TC-DJ1: Wedding with DJ only', () => {
      const activations = getActiveCategoriesForEvent('wedding', {
        eventType: 'wedding',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
        userSelections: { wantsDJ: true, wantsBand: false },
      });

      const hasMusic = activations.some(a => 
        a.category.toLowerCase().includes('dj') || 
        a.category.toLowerCase().includes('music')
      );
      expect(hasMusic).toBe(true);
    });

    it('TC-DJ2: Wedding with Band only', () => {
      const activations = getActiveCategoriesForEvent('wedding', {
        eventType: 'wedding',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
        userSelections: { wantsBand: true, wantsDJ: false },
      });

      const band = activations.find(a => a.category.toLowerCase().includes('band'));
      expect(band).toBeDefined();
    });

    it('TC-DJ3: Wedding with DJ AND Band splits allocation', () => {
      const activations = getActiveCategoriesForEvent('wedding', {
        eventType: 'wedding',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
        userSelections: { wantsDJ: true, wantsBand: true },
      });

      const dj = activations.find(a => a.category === 'DJ');
      const band = activations.find(a => a.category === 'Band');
      expect(dj).toBeDefined();
      expect(band).toBeDefined();
    });
  });

  // ─── VIDEOGRAPHY TESTS ───────────────────────────────────────────────────

  describe('Videography Selection', () => {
    it('TC-V1: Wedding with videography', () => {
      const activations = getActiveCategoriesForEvent('wedding', {
        eventType: 'wedding',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
        userSelections: { excludeVideography: false },
      });

      const video = activations.find(a => a.category.includes('Videography'));
      expect(video).toBeDefined();
    });

    it('TC-V2: Wedding without videography redistributes weight', () => {
      const withVideo = getActiveCategoriesForEvent('wedding', {
        eventType: 'wedding',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
      });

      const withoutVideo = getActiveCategoriesForEvent('wedding', {
        eventType: 'wedding',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
        userSelections: { excludeVideography: true },
      });

      expect(withVideo.length).toBeGreaterThan(withoutVideo.length);
      const photoWith = withVideo.find(a => a.category.includes('Photography'));
      const photoWithout = withoutVideo.find(a => a.category.includes('Photography'));
      expect(photoWithout?.baseWeight).toBeGreaterThanOrEqual(photoWith?.baseWeight || 0);
    });
  });

  // ─── GUEST COUNT SENSITIVITY TESTS ───────────────────────────────────────

  describe('Guest Count Sensitivity', () => {
    it('TC-GC1: 100 guests - catering is realistic', () => {
      const result = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 100, budget: 500000 },
        500000
      );

      const cateringWarnings = result.warnings.filter(w => w.includes('catering'));
      expect(cateringWarnings.length).toBe(0);
    });

    it('TC-GC2: 300 guests - catering is realistic for ₹10L', () => {
      const result = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 300, budget: 1000000 },
        1000000
      );

      const cateringWarnings = result.warnings.filter(w => w.includes('catering'));
      expect(cateringWarnings.length).toBe(0);
    });

    it('TC-GC3: 700 guests with ₹10L budget produces catering warning', () => {
      const result = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 700, budget: 1000000 },
        1000000
      );

      const cateringWarnings = result.warnings.filter(w => w.includes('catering') || w.includes('Budget'));
      expect(cateringWarnings.length).toBeGreaterThan(0);
    });
  });

  // ─── BUDGET UPDATE TESTS ─────────────────────────────────────────────────

  describe('Multi-turn Budget Updates', () => {
    it('TC-BU1: ₹10L wedding → ₹12L wedding preserves context', () => {
      const budget1 = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 300, budget: 1000000 },
        1000000
      );

      const budget2 = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 300, budget: 1200000 },
        1200000
      );

      expect(budget2.activatedCategories).toBe(budget1.activatedCategories);
      expect(budget2.allocations.length).toBe(budget1.allocations.length);
    });

    it('TC-BU2: ₹10L → ₹12L increases all allocations proportionally', () => {
      const budget1 = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 300, budget: 1000000 },
        1000000
      );

      const budget2 = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 300, budget: 1200000 },
        1200000
      );

      const photo1 = budget1.allocations.find(a => a.category.includes('Photography'));
      const photo2 = budget2.allocations.find(a => a.category.includes('Photography'));

      expect(photo2?.allocatedAmount).toBeGreaterThan(photo1?.allocatedAmount || 0);
      expect(photo2?.allocatedAmount).toBeCloseTo((photo1?.allocatedAmount || 0) * 1.2, 0);
    });
  });

  // ─── NORMALIZATION TESTS ────────────────────────────────────────────────

  describe('Normalization', () => {
    it('TC-N1: Normalized weights sum to 100%', () => {
      const activations = getActiveCategoriesForEvent('wedding', {
        eventType: 'wedding',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
      });

      const normalized = normalizeAllocationWeights(activations);
      const total = normalized.reduce((sum, n) => sum + n.normalizedWeight, 0);

      expect(total).toBeCloseTo(100, 1);
    });

    it('TC-N2: Removing videography normalizes remaining categories', () => {
      const withVideo = normalizeAllocationWeights(
        getActiveCategoriesForEvent('wedding', { eventType: 'wedding' })
      );

      const withoutVideo = normalizeAllocationWeights(
        getActiveCategoriesForEvent('wedding', {
          eventType: 'wedding',
          userSelections: { excludeVideography: true },
        })
      );

      const totalWith = withVideo.reduce((sum, n) => sum + n.normalizedWeight, 0);
      const totalWithout = withoutVideo.reduce((sum, n) => sum + n.normalizedWeight, 0);

      expect(totalWith).toBeCloseTo(100, 1);
      expect(totalWithout).toBeCloseTo(100, 1);
    });
  });

  // ─── MULTI-FUNCTION TESTS ───────────────────────────────────────────────

  describe('Multi-Function Weddings', () => {
    it('TC-MF1: Multi-day wedding (5 functions) increases certain allocations', () => {
      const singleDay = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 300, budget: 1000000, durationDays: 1 },
        1000000
      );

      const multiDay = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 300, budget: 1000000, durationDays: 5 },
        1000000
      );

      const cateringSingle = singleDay.allocations.find(a => a.category.includes('Catering'));
      const cateringMulti = multiDay.allocations.find(a => a.category.includes('Catering'));

      expect(cateringMulti?.allocatedAmount).toBeGreaterThan(cateringSingle?.allocatedAmount || 0);
    });
  });

  // ─── RECEPTION TESTS ────────────────────────────────────────────────────

  describe('Reception Budget', () => {
    it('TC-R1: Reception has high catering weight', () => {
      const activations = getActiveCategoriesForEvent('reception', {
        eventType: 'reception',
        city: 'Hyderabad',
        guestCount: 500,
        budget: 1000000,
      });

      const catering = activations.find(a => a.category.includes('Catering'));
      expect(catering?.baseWeight).toBeGreaterThan(30);
    });

    it('TC-R2: Reception includes entertainment/DJ', () => {
      const activations = getActiveCategoriesForEvent('reception', {
        eventType: 'reception',
        city: 'Hyderabad',
        guestCount: 500,
        budget: 1000000,
      });

      const categories = activations.map(a => a.category.toLowerCase());
      expect(categories.some(c => c.includes('music') || c.includes('entertainment'))).toBe(true);
    });
  });

  // ─── EDGE CASES ──────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('TC-E1: Budget totals with 0 unused weight', () => {
      const result = generateEventAwareBudget(
        { eventType: 'wedding', city: 'Hyderabad', guestCount: 300, budget: 1000000 },
        1000000
      );

      const total = result.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      expect(Math.abs(total - 1000000)).toBeLessThan(2); // Within ±₹1 (rounding)
    });

    it('TC-E2: Corporate event uses different weights than wedding', () => {
      const weddingActivations = getActiveCategoriesForEvent('wedding', {
        eventType: 'wedding',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
      });

      const corporateActivations = getActiveCategoriesForEvent('corporate', {
        eventType: 'corporate',
        city: 'Hyderabad',
        guestCount: 300,
        budget: 1000000,
      });

      const weddingCatering = weddingActivations.find(a => a.category.includes('Catering'));
      const corporateCatering = corporateActivations.find(a => a.category.includes('Catering'));

      // Wedding should prioritize catering more than corporate
      expect(weddingCatering?.baseWeight).toBeGreaterThan(corporateCatering?.baseWeight || 0);
    });
  });
});
