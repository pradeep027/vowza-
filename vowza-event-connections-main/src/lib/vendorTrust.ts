// ─── Marketplace vendor trust boundary ──────────────────────────────────────
// Cards may only consume objects which pass this runtime validation. TypeScript
// types alone cannot make persisted JSON or RPC output trustworthy.

import type { DBVendor, ProviderId, VendorAvailabilityStatus } from './aiPlannerTypes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AVAILABILITY_STATUSES: ReadonlySet<VendorAvailabilityStatus> = new Set([
  'not_checked',
  'needs_confirmation',
  'unavailable',
]);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function requiredCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function optionalAvailabilityStatus(value: unknown): VendorAvailabilityStatus | undefined {
  return typeof value === 'string' && AVAILABILITY_STATUSES.has(value as VendorAvailabilityStatus)
    ? value as VendorAvailabilityStatus
    : undefined;
}

/**
 * Converts untrusted RPC/JSON input to the one contract that marketplace cards
 * accept. Reject rather than coerce suspicious identity, verification, or
 * numeric values so bad data cannot become a profile route.
 */
export function toVerifiedDBVendor(value: unknown): DBVendor | null {
  if (!isRecord(value) || !isProviderId(value.provider_id) || value.is_verified !== true) return null;

  const profession = requiredString(value.profession);
  const averageRating = optionalNonNegativeNumber(value.average_rating);
  const totalReviews = requiredCount(value.total_reviews);
  const totalBookings = requiredCount(value.total_bookings);
  if (!profession || averageRating === undefined || averageRating > 5 || totalReviews === null || totalBookings === null || typeof value.is_available !== 'boolean') {
    return null;
  }

  const priceMin = optionalNonNegativeNumber(value.price_min);
  const priceMax = optionalNonNegativeNumber(value.price_max);
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) return null;

  const experienceYears = value.experience_years === null
    ? null
    : optionalNonNegativeNumber(value.experience_years);
  if (value.experience_years !== undefined && value.experience_years !== null && experienceYears === undefined) return null;

  return {
    provider_id: value.provider_id,
    profession,
    stage_name: optionalString(value.stage_name),
    full_name: optionalString(value.full_name),
    bio: optionalString(value.bio),
    city: optionalString(value.city),
    price_min: priceMin,
    price_max: priceMax,
    average_rating: averageRating,
    total_reviews: totalReviews,
    total_bookings: totalBookings,
    is_verified: true,
    is_available: value.is_available,
    availability_status: optionalAvailabilityStatus(value.availability_status),
    availability_reason: optionalString(value.availability_reason),
    recommendation_reasons: Array.isArray(value.recommendation_reasons)
      ? value.recommendation_reasons.filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0)
      : undefined,
    match_score: optionalNonNegativeNumber(value.match_score),
    experience_years: experienceYears,
    cover_image_url: optionalString(value.cover_image_url) ?? null,
    avatar_url: optionalString(value.avatar_url),
  };
}

/** Keeps the first validated occurrence of every provider UUID, preserving rank. */
export function dedupeVerifiedDBVendors(values: readonly unknown[]): DBVendor[] {
  const byProviderId = new Map<ProviderId, DBVendor>();
  for (const value of values) {
    const vendor = toVerifiedDBVendor(value);
    if (vendor && !byProviderId.has(vendor.provider_id)) byProviderId.set(vendor.provider_id, vendor);
  }
  return [...byProviderId.values()];
}

/** Extracts only syntactically valid, unique provider IDs from untrusted JSON. */
export function uniqueProviderIds(values: readonly unknown[]): ProviderId[] {
  const ids = new Set<ProviderId>();
  for (const value of values) {
    const candidate = isRecord(value) ? value.provider_id : value;
    if (isProviderId(candidate)) ids.add(candidate);
  }
  return [...ids];
}

/** Normalizes the common spaced/plural videographer wording before matching. */
export function normalizeVendorSearchMessage(message: string): string {
  return message.replace(/\bvideo\s+graphers?\b/gi, 'videographer');
}
