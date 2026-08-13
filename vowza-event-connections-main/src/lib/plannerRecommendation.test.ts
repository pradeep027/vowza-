import { describe, expect, it } from 'vitest';
import {
  extractPlannerSearchCriteria,
  rankMarketplaceVendors,
  type RankableMarketplaceVendor,
} from './plannerRecommendation';

const baseVendor: RankableMarketplaceVendor = {
  provider_id: 'provider-1',
  profession: 'photographer',
  city: 'Hyderabad',
  bio: 'Candid wedding photography and cinematic storytelling.',
  price_min: 45000,
  average_rating: 4.8,
  total_reviews: 126,
  total_bookings: 80,
  is_verified: true,
  is_available: true,
  experience_years: 8,
};

describe('planner marketplace recommendations', () => {
  it('extracts service, city, service budget, rating, and style constraints', () => {
    const criteria = extractPlannerSearchCriteria(
      'Find a candid photographer in Hyderabad under ₹50,000 with at least 4.5 stars',
      { eventType: 'wedding', eventDate: '2026-12-20' },
    );

    expect(criteria.professions).toEqual(['photographer']);
    expect(criteria.city).toBe('Hyderabad');
    expect(criteria.serviceBudget).toBe(50000);
    expect(criteria.minimumRating).toBe(4.5);
    expect(criteria.styleTerms).toContain('candid');
  });

  it('ranks only retrieved candidates and explains the matching evidence', () => {
    const ranked = rankMarketplaceVendors([baseVendor], {
      professions: ['photographer'],
      city: 'Hyderabad',
      eventDate: '2026-12-20',
      serviceBudget: 50000,
      minimumRating: 4.5,
      styleTerms: ['candid'],
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].recommendation_reasons).toContain('Matches the requested service');
    expect(ranked[0].recommendation_reasons).toContain('Hyderabad based');
    expect(ranked[0].availability_status).toBe('needs_confirmation');
  });

  it('does not rank a known unavailable candidate as available', () => {
    const ranked = rankMarketplaceVendors([{ ...baseVendor, is_available: false, availability_status: 'unavailable' }], {
      professions: ['photographer'],
      styleTerms: [],
    });

    expect(ranked[0].availability_status).toBe('unavailable');
    expect(ranked[0].recommendation_reasons).toContain('Provider is currently marked unavailable');
  });
});


import { isActiveCategoryListRequest, orchestrate } from './aiOrchestrator';

describe('planner active category directory routing', () => {
  it.each([
    'Show all active Vowza vendor categories.',
    'List marketplace categories.',
    'What categories do you have?',
    'Browse artist categories.',
  ])('recognizes %s as a live category-directory request', (message) => {
    expect(isActiveCategoryListRequest(message)).toBe(true);
  });

  it('does not confuse a concrete vendor search with the category directory', () => {
    expect(isActiveCategoryListRequest('Show me decorators.')).toBe(false);
  });
});

describe('planner marketplace request routing', () => {
  it.each([
    ['Show me decorators.', 'find_vendors', 'wedding_decorator'],
    ['Show me photographers.', 'find_vendors', 'photographer'],
    ['Show me decorators under ₹100000.', 'find_vendors', 'wedding_decorator'],
    ['Find decorators in Hyderabad.', 'find_vendors', 'wedding_decorator'],
    ['Which decorators are available on December 20?', 'find_vendors', 'wedding_decorator'],
    ['Compare these two decorators.', 'comparison', 'wedding_decorator'],
    ['I have ₹8 lakh for my wedding. Show me decorators.', 'find_vendors', 'wedding_decorator'],
    ['Actually, show me photographers instead.', 'find_vendors', 'photographer'],
  ] as const)('routes %s to live marketplace retrieval', (message, intent, profession) => {
    const result = orchestrate(message, {}, []);
    expect(result.intent).toBe(intent);
    expect(result.needsRetrieval).toBe(true);
    expect(result.professions).toContain(profession);
  });

  it('keeps an explicit budget request in budget planning rather than vendor discovery', () => {
    const result = orchestrate('Plan my wedding budget.', {}, []);
    expect(result.intent).toBe('budget_breakdown');
    expect(result.needsRetrieval).toBe(false);
  });
});