import { describe, expect, it } from 'vitest';
import { dedupeVerifiedDBVendors, normalizeVendorSearchMessage, toVerifiedDBVendor, uniqueProviderIds } from './vendorTrust';
import { orchestrate } from './aiOrchestrator';

const firstId = '1e00180a-505b-44c1-a95a-b115e20f66f5';
const secondId = '2439f091-ab67-48ce-9ba6-4bd0e4c55dd5';

const vendor = (provider_id = firstId) => ({
  provider_id,
  profession: 'videographer',
  stage_name: 'Verified Video Studio',
  average_rating: 0,
  total_reviews: 0,
  total_bookings: 0,
  is_verified: true,
  is_available: true,
});

describe('marketplace vendor trust boundary', () => {
  it('keeps each valid verified provider UUID exactly once', () => {
    const vendors = dedupeVerifiedDBVendors([vendor(), vendor(), vendor(secondId)]);

    expect(vendors).toHaveLength(2);
    expect(vendors.map((item) => item.provider_id)).toEqual([firstId, secondId]);
  });

  it('rejects malformed IDs, unverified rows, and invalid numeric facts', () => {
    expect(toVerifiedDBVendor(vendor('not-a-uuid'))).toBeNull();
    expect(toVerifiedDBVendor({ ...vendor(), is_verified: false })).toBeNull();
    expect(toVerifiedDBVendor({ ...vendor(), average_rating: 6 })).toBeNull();
    expect(toVerifiedDBVendor({ ...vendor(), total_reviews: -1 })).toBeNull();
  });

  it('returns no display-safe cards when no real valid record is supplied', () => {
    expect(dedupeVerifiedDBVendors([{ provider_id: 'not-a-uuid' }, { ...vendor(), is_verified: false }])).toEqual([]);
  });

  it('normalizes the reported spaced videographer phrasing before lookup', () => {
    expect(normalizeVendorSearchMessage('show me video graphers in Hyderabad')).toBe('show me videographer in Hyderabad');
  });

  it('routes the reported spaced videographer phrasing through verified retrieval', () => {
    const result = orchestrate('show me video graphers in Hyderabad', {}, []);
    expect(result.intent).toBe('find_vendors');
    expect(result.needsRetrieval).toBe(true);
    expect(result.professions).toEqual(['videographer']);
  });

  it('extracts only unique valid IDs from persisted untrusted data', () => {
    const ids = uniqueProviderIds([{ provider_id: firstId }, { provider_id: firstId }, { provider_id: 'broken' }, secondId]);
    expect(ids).toEqual([firstId, secondId]);
  });
});
