import type { PlannerContext } from './aiPlannerTypes';

export type MarketplaceAvailabilityStatus = 'not_checked' | 'needs_confirmation' | 'unavailable';

export interface PlannerSearchCriteria {
  professions: string[];
  city?: string;
  eventDate?: string;
  serviceBudget?: number;
  minimumRating?: number;
  styleTerms: string[];
}

export interface RankableMarketplaceVendor {
  provider_id: string;
  profession: string;
  city?: string;
  bio?: string;
  price_min?: number;
  price_max?: number;
  average_rating: number;
  total_reviews: number;
  total_bookings: number;
  is_verified: boolean;
  is_available: boolean;
  experience_years?: number | null;
  packages?: Array<{ name: string; description?: string; features?: string[] }>;
  faqs?: Array<{ question: string; answer: string }>;
  availability_status?: MarketplaceAvailabilityStatus;
  availability_reason?: string;
}

export interface RankedMarketplaceVendor<T extends RankableMarketplaceVendor = RankableMarketplaceVendor> extends T {
  availability_status: MarketplaceAvailabilityStatus;
  recommendation_reasons: string[];
  match_score: number;
}

const SERVICE_TERMS: Array<[RegExp, string]> = [
  [/photograph|photo\b/i, 'photographer'],
  [/videograph|cinematograph|video\b/i, 'videographer'],
  [/drone/i, 'drone_operator'],
  [/\bdj\b/i, 'dj'],
  [/\bband\b|live music/i, 'music_band'],
  [/singer/i, 'singer'],
  [/dancer/i, 'dancer'],
  [/choreograph/i, 'choreographer'],
  [/decorat|\bdecor\b/i, 'wedding_decorator'],
  [/makeup/i, 'makeup_artist'],
  [/mehendi|mehndi|henna/i, 'mehendi_artist'],
  [/anchor|emcee|\bhost\b/i, 'anchor'],
  [/cater|food|menu/i, 'catering_services'],
  [/banquet|\bvenue\b|\bhall\b/i, 'banquet_hall'],
  [/pandit|priest|pooja/i, 'pandit'],
  [/rental|tent|shamiana/i, 'rentals'],
  [/lighting|lights/i, 'lighting_services'],
  [/sound|audio/i, 'sound_services'],
];

const STYLE_TERMS = [
  'candid', 'traditional', 'documentary', 'cinematic', 'editorial', 'modern',
  'minimal', 'luxury', 'floral', 'south indian', 'telugu', 'marwari', 'bollywood',
];

const BUDGET_PATTERNS: Array<{ pattern: RegExp; multiplier: number }> = [
  { pattern: /(?:under|below|within|budget(?:\s+is)?|less than)\s*(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b/i, multiplier: 100000 },
  { pattern: /(?:under|below|within|budget(?:\s+is)?|less than)\s*(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*k\b/i, multiplier: 1000 },
  { pattern: /(?:under|below|within|budget(?:\s+is)?|less than)\s*(?:₹|rs\.?\s*)?(\d[\d,]*)\b/i, multiplier: 1 },
  { pattern: /₹\s*(\d[\d,]*)\b/i, multiplier: 1 },
];

const CITY_PATTERN = /\b(?:in|near|around)\s+([a-z][a-z .'-]{1,50}?)(?=\s+(?:for|under|below|with|on|who|and|,|$)|$)/i;

export const extractServiceBudget = (message: string): number | undefined => {
  for (const { pattern, multiplier } of BUDGET_PATTERNS) {
    const match = message.match(pattern);
    if (match) return Math.round(Number(match[1].replace(/,/g, '')) * multiplier);
  }
  return undefined;
};

export const extractMinimumRating = (message: string): number | undefined => {
  const explicit = message.match(/(?:at\s*least|minimum|min\.?|above|over)\s*(\d(?:\.\d)?)\s*(?:stars?|★)/i)
    ?? message.match(/(\d(?:\.\d)?)\s*\+\s*(?:stars?|★)/i);
  if (explicit) return Number(explicit[1]);
  if (/highly rated|top rated|best rated/i.test(message)) return 4;
  return undefined;
};

export function extractPlannerSearchCriteria(
  message: string,
  context: PlannerContext,
  hints: Partial<PlannerSearchCriteria> = {},
): PlannerSearchCriteria {
  const professions = hints.professions?.length
    ? hints.professions
    : [...new Set(SERVICE_TERMS.filter(([pattern]) => pattern.test(message)).map(([, profession]) => profession))];
  const normalizedMessage = message.toLowerCase();
  const styleTerms = STYLE_TERMS.filter((term) => normalizedMessage.includes(term));
  const cityMatch = message.match(CITY_PATTERN)?.[1]?.trim();

  return {
    professions,
    city: hints.city ?? cityMatch ?? context.city,
    eventDate: context.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(context.eventDate) ? context.eventDate : undefined,
    serviceBudget: hints.serviceBudget ?? extractServiceBudget(message),
    minimumRating: hints.minimumRating ?? extractMinimumRating(message),
    styleTerms,
  };
}

const hasTextMatch = (vendor: RankableMarketplaceVendor, terms: string[]) => {
  if (!terms.length) return false;
  const searchable = [
    vendor.bio,
    ...(vendor.packages ?? []).flatMap((item) => [item.name, item.description, ...(item.features ?? [])]),
    ...(vendor.faqs ?? []).flatMap((item) => [item.question, item.answer]),
  ].filter(Boolean).join(' ').toLowerCase();
  return terms.some((term) => searchable.includes(term));
};

const locationMatches = (vendorCity: string | undefined, requestedCity: string | undefined) =>
  Boolean(vendorCity && requestedCity && vendorCity.trim().toLowerCase() === requestedCity.trim().toLowerCase());

export function rankMarketplaceVendors<T extends RankableMarketplaceVendor>(
  vendors: T[],
  criteria: PlannerSearchCriteria,
): RankedMarketplaceVendor<T>[] {
  return vendors.map((vendor) => {
    const availabilityStatus = vendor.availability_status
      ?? (vendor.is_available ? 'needs_confirmation' : 'unavailable');
    const reasons: string[] = [];
    let score = 0;

    if (!criteria.professions.length || criteria.professions.includes(vendor.profession)) {
      score += 30;
      reasons.push('Matches the requested service');
    }
    if (locationMatches(vendor.city, criteria.city)) {
      score += 18;
      reasons.push(`${vendor.city} based`);
    }
    if (criteria.serviceBudget && vendor.price_min !== undefined && vendor.price_min > 0) {
      if (vendor.price_min <= criteria.serviceBudget) {
        score += 16;
        reasons.push('Starting price fits the stated service budget');
      }
    }
    if (criteria.minimumRating && vendor.average_rating >= criteria.minimumRating) {
      score += 12;
      reasons.push(`${vendor.average_rating.toFixed(1)}★ meets the rating preference`);
    } else if (vendor.average_rating > 0) {
      score += Math.min(10, vendor.average_rating * 2);
      reasons.push(`${vendor.average_rating.toFixed(1)}★ from ${vendor.total_reviews} review${vendor.total_reviews === 1 ? '' : 's'}`);
    }
    if (vendor.total_reviews > 0) score += Math.min(8, Math.log10(vendor.total_reviews + 1) * 4);
    if (vendor.is_verified) {
      score += 8;
      reasons.push('Verified Vowza profile');
    }
    if (vendor.experience_years && vendor.experience_years > 0) {
      score += Math.min(6, vendor.experience_years / 2);
      reasons.push(`${vendor.experience_years} years of experience listed`);
    }
    if (hasTextMatch(vendor, criteria.styleTerms)) {
      score += 10;
      reasons.push(`Profile mentions ${criteria.styleTerms.find((term) => hasTextMatch(vendor, [term]))} style`);
    }
    if (availabilityStatus === 'unavailable') {
      score -= 40;
      reasons.push(vendor.availability_reason ?? (vendor.is_available
        ? 'Unavailable for the requested date'
        : 'Provider is currently marked unavailable'));
    } else if (criteria.eventDate) {
      reasons.push('Availability still needs confirmation for the requested date');
    }

    return {
      ...vendor,
      availability_status: availabilityStatus,
      recommendation_reasons: reasons.slice(0, 5),
      match_score: Math.max(0, Math.round(score)),
    };
  }).sort((left, right) => right.match_score - left.match_score || right.average_rating - left.average_rating || right.total_reviews - left.total_reviews);
}
