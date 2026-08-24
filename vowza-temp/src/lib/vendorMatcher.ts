// ─── Vendor Matcher — Match Real Vendors to Budget Allocations ────────────────
// Purpose: Score and rank REAL vendors from Supabase against plan allocations.
// CRITICAL: Never invent vendors. Only use DBVendor records with verified=true.

import type { EventBudgetPlan, DBVendor, SelectedVendor } from './aiPlannerTypes';
import type { BudgetAllocation } from './eventBudgetPlanner';

// ─── Scoring weights for vendor matching ──────────────────────────────────────
const SCORING_WEIGHTS = {
  budgetFit: 0.35,      // Matches allocated budget
  categoryMatch: 0.25,  // Correct profession/category
  locationMatch: 0.20,  // Same city
  ratingQuality: 0.15,  // High rating & reviews
  verificationTrust: 0.05, // Verification status (baseline)
};

// ─── Category-to-profession mapping ───────────────────────────────────────────
const CATEGORY_TO_PROFESSIONS: { [key: string]: string[] } = {
  'Photography': ['photographer', 'videographer'],
  'Videography': ['videographer', 'cinematographer'],
  'Catering': ['caterer', 'food_service'],
  'Decoration': ['wedding_decorator', 'event_decorator', 'decorator'],
  'DJ': ['dj', 'music_dj'],
  'Music': ['musician', 'dj', 'music_band', 'singer', 'band'],
  'Makeup': ['makeup_artist', 'bridal_makeup', 'makeup'],
  'Venue': ['venue', 'banquet_hall', 'resort', 'farmhouse'],
  'Entertainment': ['entertainer', 'dancer', 'choreographer', 'artist'],
};

// ─── Score budget fit (0-1) ───────────────────────────────────────────────────
function scoreBudgetFit(vendorMin: number | undefined, vendorMax: number | undefined, allocatedBudget: number): number {
  if (!vendorMin || !vendorMax) return 0.5; // Unknown pricing = neutral

  // Perfect fit: vendor price range contains allocated budget
  if (vendorMin <= allocatedBudget && allocatedBudget <= vendorMax) {
    return 1.0;
  }

  // Vendor is cheaper than allocated: still good, but not perfect
  if (vendorMax < allocatedBudget) {
    const cushion = (allocatedBudget - vendorMax) / allocatedBudget;
    return Math.max(0.7, 1.0 - cushion * 0.3); // 0.7-1.0 based on cushion
  }

  // Vendor is more expensive than allocated: risky, reduce score
  if (vendorMin > allocatedBudget) {
    const overrun = (vendorMin - allocatedBudget) / allocatedBudget;
    return Math.max(0.0, 1.0 - overrun * 0.5); // Penalize overruns more heavily
  }

  return 0.5;
}

// ─── Score category match (0-1) ──────────────────────────────────────────────
function scoreCategoryMatch(vendorProfession: string, allocationCategory: string): number {
  const targetProfessions = CATEGORY_TO_PROFESSIONS[allocationCategory] || [];

  if (targetProfessions.length === 0) return 0.5; // Unknown category

  // Exact match
  if (targetProfessions.includes(vendorProfession)) {
    return 1.0;
  }

  // Partial match (e.g., photographer vs photography)
  const vendorLower = vendorProfession.toLowerCase();
  const categoryLower = allocationCategory.toLowerCase();

  if (vendorLower.includes(categoryLower) || categoryLower.includes(vendorLower)) {
    return 0.8;
  }

  // No match
  return 0.0;
}

// ─── Score location match (0-1) ──────────────────────────────────────────────
function scoreLocationMatch(vendorCity: string | undefined, planCity: string): number {
  if (!vendorCity) return 0.5; // Unknown location = neutral

  if (vendorCity.toLowerCase() === planCity.toLowerCase()) {
    return 1.0; // Same city = perfect
  }

  // Different city = penalty (travel costs, logistics)
  return 0.4;
}

// ─── Score rating quality (0-1) ──────────────────────────────────────────────
function scoreRatingQuality(averageRating: number, totalReviews: number): number {
  // No reviews yet
  if (totalReviews === 0) {
    return 0.5; // New vendor, give benefit of doubt
  }

  // Rating out of 5
  const ratingScore = averageRating / 5.0; // 0-1

  // More reviews = more confidence
  const confidenceBoost = Math.min(1.0, Math.log(totalReviews + 1) / Math.log(50)); // Log scale, caps at ~50 reviews

  return ratingScore * 0.7 + confidenceBoost * 0.3;
}

// ─── Calculate match score for a vendor against an allocation ─────────────────
export function calculateVendorMatchScore(
  vendor: DBVendor,
  allocation: BudgetAllocation,
  planCity: string
): number {
  const budgetScore = scoreBudgetFit(vendor.price_min, vendor.price_max, allocation.allocatedAmount);
  const categoryScore = scoreCategoryMatch(vendor.profession, allocation.category);
  const locationScore = scoreLocationMatch(vendor.city, planCity);
  const ratingScore = scoreRatingQuality(vendor.average_rating, vendor.total_reviews);
  const verificationScore = vendor.is_verified ? 1.0 : 0.5;

  // Weighted sum
  const totalScore =
    (budgetScore * SCORING_WEIGHTS.budgetFit) +
    (categoryScore * SCORING_WEIGHTS.categoryMatch) +
    (locationScore * SCORING_WEIGHTS.locationMatch) +
    (ratingScore * SCORING_WEIGHTS.ratingQuality) +
    (verificationScore * SCORING_WEIGHTS.verificationTrust);

  return totalScore;
}

// ─── Match vendors to a plan allocation ──────────────────────────────────────
export function matchVendorsToAllocation(
  allocation: BudgetAllocation,
  availableVendors: DBVendor[],
  planCity: string,
  topN: number = 3
): SelectedVendor[] {
  // Filter vendors that match the category
  const relevantVendors = availableVendors.filter(v => {
    const targetProfessions = CATEGORY_TO_PROFESSIONS[allocation.category] || [];
    if (targetProfessions.length === 0) return true; // Unknown category, include all

    // Include if profession matches or partially matches
    const vendorLower = v.profession.toLowerCase();
    const categoryLower = allocation.category.toLowerCase();

    return (
      targetProfessions.includes(v.profession) ||
      vendorLower.includes(categoryLower) ||
      categoryLower.includes(vendorLower)
    );
  });

  // Score each vendor
  const scored = relevantVendors.map(v => ({
    vendor: v,
    score: calculateVendorMatchScore(v, allocation, planCity),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Convert to SelectedVendor format
  return scored.slice(0, topN).map(({ vendor, score }) => ({
    vendorId: vendor.provider_id,
    vendorName: vendor.stage_name || vendor.full_name || 'Unnamed Vendor',
    category: allocation.category,
    city: vendor.city || 'Unknown',
    allocatedBudget: allocation.allocatedAmount,
    basePrice: (vendor.price_min ?? 0 + (vendor.price_max ?? 0)) / 2,
    matchScore: score,
    matchReasons: generateMatchReasons(vendor, allocation, planCity, score),
  }));
}

// ─── Generate human-readable match reasons ────────────────────────────────────
function generateMatchReasons(
  vendor: DBVendor,
  allocation: BudgetAllocation,
  planCity: string,
  score: number
): string[] {
  const reasons: string[] = [];

  // Budget fit
  if (vendor.price_min && vendor.price_max) {
    if (vendor.price_min <= allocation.allocatedAmount && allocation.allocatedAmount <= vendor.price_max) {
      reasons.push('✓ Pricing matches your budget');
    } else if (vendor.price_max < allocation.allocatedAmount) {
      const savings = allocation.allocatedAmount - vendor.price_max;
      reasons.push(`✓ Priced ${(savings / 1000).toFixed(0)}K below allocation`);
    }
  }

  // Location
  if (vendor.city && vendor.city.toLowerCase() === planCity.toLowerCase()) {
    reasons.push('✓ Local to your city');
  }

  // Rating
  if (vendor.average_rating >= 4.5) {
    reasons.push(`✓ Highly rated (${vendor.average_rating}/5 ⭐)`);
  } else if (vendor.average_rating >= 4.0) {
    reasons.push(`✓ Well rated (${vendor.average_rating}/5)`);
  }

  // Bookings
  if (vendor.total_bookings && vendor.total_bookings > 10) {
    reasons.push(`✓ Experienced (${vendor.total_bookings}+ bookings)`);
  }

  // Fallback
  if (reasons.length === 0) {
    reasons.push('Matches your requirements');
  }

  return reasons.slice(0, 3); // Max 3 reasons
}

// ─── Match all allocations in a plan to vendors ───────────────────────────────
export function matchPlanToVendors(
  plan: EventBudgetPlan,
  allVendors: DBVendor[],
  topPerCategory: number = 3
): SelectedVendor[] {
  const allMatches: SelectedVendor[] = [];

  for (const allocation of plan.allocations) {
    const categoryMatches = matchVendorsToAllocation(allocation, allVendors, plan.city, topPerCategory);
    allMatches.push(...categoryMatches);
  }

  return allMatches;
}

// ─── Format vendors for display in plan ──────────────────────────────────────
export function formatVendorRecommendationsForPlan(vendors: SelectedVendor[]): string {
  if (vendors.length === 0) {
    return '';
  }

  // Group by category
  const byCategory: { [key: string]: SelectedVendor[] } = {};
  for (const vendor of vendors) {
    if (!byCategory[vendor.category]) {
      byCategory[vendor.category] = [];
    }
    byCategory[vendor.category].push(vendor);
  }

  let response = '\n### 💼 Recommended Vendors\n\n';

  for (const [category, categoryVendors] of Object.entries(byCategory)) {
    response += `**${category}** (Budget: ₹${(categoryVendors[0]?.allocatedBudget / 1000).toFixed(0)}K)\n`;

    for (let i = 0; i < Math.min(2, categoryVendors.length); i++) {
      const v = categoryVendors[i];
      const score = Math.round((v.matchScore || 0) * 100);

      response += `${i + 1}. **${v.vendorName}** (${score}% match)\n`;

      // Add match reasons
      if (v.matchReasons && v.matchReasons.length > 0) {
        response += `   ${v.matchReasons.join(' · ')}\n`;
      }

      if (v.basePrice) {
        response += `   💰 ₹${(v.basePrice / 1000).toFixed(0)}K\n`;
      }

      response += '\n';
    }
  }

  return response;
}

