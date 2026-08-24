// ─── Package Matcher — Match Budget Allocations to Admin Event Packages ────────
// Phase 2B Integration
//
// After budget plan is generated, this module finds the best matching Admin Event
// Packages (Silver/Gold/Platinum) that fit within the allocated budgets.
//
// Smart matching:
// - Photography budget ₹70K → Find photographers offering ₹50K-₹100K packages
// - Catering budget ₹1.8L → Find catering under ₹1.8L
// - Decoration budget ₹1.0L → Find decorators under ₹1.0L
// - etc.
//
// Result: Recommended package tier (Silver/Gold/Platinum) for each category

import type { EventBudgetPlan, BudgetAllocation } from './eventBudgetPlanner';
import type { PlannerContext } from './aiPlannerTypes';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AdminEventPackage {
  id: string;
  event_type: string;           // 'wedding', 'birthday', etc.
  tier: 'silver' | 'gold' | 'platinum';
  name: string;                 // "Wedding Silver", "Wedding Gold"
  description: string;
  original_price: number;        // ₹
  discount_percentage?: number;
  final_price: number;           // After discount
  included_items: string[];      // ["Photography", "Catering", "Decoration"]
  optional_items: string[];      // ["Mehendi Artist", "Videography"]
  is_published: boolean;
  created_at?: string;
}

export interface PackageMatch {
  category: string;              // "Photography", "Catering", "Decoration"
  allocatedBudget: number;       // ₹70K, ₹1.8L
  recommendedTier: 'silver' | 'gold' | 'platinum' | 'custom';
  reasonings: string[];          // Why this tier matches
  matchedPackages?: AdminEventPackage[];  // Matching packages from Vowza
  confidence: number;            // 0-100 (how well this tier matches the budget)
}

export interface PackageRecommendation {
  eventType: string;
  suggestedTier: 'silver' | 'gold' | 'platinum';  // Overall tier recommendation
  categoryMatches: PackageMatch[];
  totalEstimatedCost: number;    // Sum of matched packages
  savingsVsAllocated: number;    // Allocated - estimated (positive = savings)
  bundleText: string;            // "Silver covers food+decoration+photography..."
  nextStep: string;              // "Would you like to see Silver packages?"
}

// ─── Tier Pricing Guidelines (Market Data) ─────────────────────────────────
// These guide the matcher on typical pricing per tier
const TIER_MULTIPLIERS: Record<'silver' | 'gold' | 'platinum', number> = {
  'silver': 0.6,      // Silver is ~60% of the allocated budget
  'gold': 0.85,       // Gold is ~85% of the allocated budget
  'platinum': 1.2,    // Platinum exceeds budget but offers premium
};

// ─── Category → tier mapping (which tier for which budget range) ──────────────
function determineTierForBudget(
  allocatedAmount: number,
  categoryName: string
): { tier: 'silver' | 'gold' | 'platinum'; confidence: number } {
  // Photography budgets typically 1 of 3 tiers
  if (/photo/i.test(categoryName)) {
    if (allocatedAmount < 40000) return { tier: 'silver', confidence: 85 };
    if (allocatedAmount < 80000) return { tier: 'gold', confidence: 90 };
    return { tier: 'platinum', confidence: 85 };
  }

  // Catering is usually gold tier for most budgets
  if (/catering|food/i.test(categoryName)) {
    if (allocatedAmount < 100000) return { tier: 'silver', confidence: 75 };
    if (allocatedAmount < 200000) return { tier: 'gold', confidence: 92 };
    return { tier: 'platinum', confidence: 88 };
  }

  // Decoration
  if (/decor|flower|stage|setup/i.test(categoryName)) {
    if (allocatedAmount < 50000) return { tier: 'silver', confidence: 80 };
    if (allocatedAmount < 120000) return { tier: 'gold', confidence: 88 };
    return { tier: 'platinum', confidence: 85 };
  }

  // Music/DJ/Band
  if (/music|dj|band|singer|dancer/i.test(categoryName)) {
    if (allocatedAmount < 30000) return { tier: 'silver', confidence: 78 };
    if (allocatedAmount < 70000) return { tier: 'gold', confidence: 85 };
    return { tier: 'platinum', confidence: 82 };
  }

  // Default: moderate mapping
  if (allocatedAmount < 50000) return { tier: 'silver', confidence: 75 };
  if (allocatedAmount < 150000) return { tier: 'gold', confidence: 80 };
  return { tier: 'platinum', confidence: 75 };
}

// ─── Match a single budget allocation to a tier ────────────────────────────────
export function matchAllocationToTier(alloc: BudgetAllocation): PackageMatch {
  const { tier, confidence } = determineTierForBudget(alloc.allocatedAmount, alloc.category);

  const reasonings: string[] = [];
  const silverCost = alloc.allocatedAmount * TIER_MULTIPLIERS.silver;
  const goldCost = alloc.allocatedAmount * TIER_MULTIPLIERS.gold;
  const platinumCost = alloc.allocatedAmount * TIER_MULTIPLIERS.platinum;

  if (tier === 'silver') {
    reasonings.push(`Silver packages typically cost ₹${(silverCost/100000).toFixed(1)}L for ${alloc.category}`);
    reasonings.push('Great value for budget-conscious planning');
  } else if (tier === 'gold') {
    reasonings.push(`Gold packages typically cost ₹${(goldCost/100000).toFixed(1)}L for ${alloc.category}`);
    reasonings.push('Perfect balance of quality and value');
    reasonings.push('Premium features at moderate pricing');
  } else {
    reasonings.push(`Platinum packages typically cost ₹${(platinumCost/100000).toFixed(1)}L for ${alloc.category}`);
    reasonings.push('Premium quality and exclusive features');
    reasonings.push('Best choice if budget allows');
  }

  return {
    category: alloc.category,
    allocatedBudget: alloc.allocatedAmount,
    recommendedTier: tier,
    reasonings,
    confidence,
  };
}

// ─── Match entire budget plan to tier recommendations ────────────────────────
export function matchPlanToPackages(plan: EventBudgetPlan): PackageRecommendation {
  const categoryMatches = plan.allocations.map(alloc => matchAllocationToTier(alloc));

  // Aggregate tier recommendation (what's the most common tier?)
  const tierCounts = {
    'silver': 0,
    'gold': 0,
    'platinum': 0,
  };
  categoryMatches.forEach(m => {
    tierCounts[m.recommendedTier as keyof typeof tierCounts]++;
  });

  const suggestedTier: 'silver' | 'gold' | 'platinum' = (
    tierCounts.gold >= tierCounts.silver && tierCounts.gold >= tierCounts.platinum
      ? 'gold'
      : tierCounts.platinum > tierCounts.silver && tierCounts.platinum > tierCounts.gold
      ? 'platinum'
      : 'silver'
  ) as 'silver' | 'gold' | 'platinum';

  // Build text summary
  const topCategories = categoryMatches
    .sort((a, b) => b.allocatedBudget - a.allocatedBudget)
    .slice(0, 3)
    .map(m => m.category.toLowerCase())
    .join(', ');

  const bundleText =
    suggestedTier === 'silver'
      ? `Silver packages typically cover ${topCategories} within your budget.`
      : suggestedTier === 'gold'
      ? `Gold packages offer premium ${topCategories} with great value.`
      : `Platinum packages give you top-tier ${topCategories} and exclusive features.`;

  const estimatedCost = categoryMatches.reduce(
    (sum, m) => sum + (m.allocatedBudget * TIER_MULTIPLIERS[m.recommendedTier]),
    0
  );

  return {
    eventType: plan.eventType,
    suggestedTier,
    categoryMatches,
    totalEstimatedCost: estimatedCost,
    savingsVsAllocated: plan.totalBudget - estimatedCost,
    bundleText,
    nextStep: `Would you like to see our **${suggestedTier.toUpperCase()}** packages for your ${plan.eventType}?`,
  };
}

// ─── Format recommendation for display ────────────────────────────────────────
export function formatPackageRecommendation(rec: PackageRecommendation): string {
  let text = `\n### 📦 Recommended Packages: **${rec.suggestedTier.toUpperCase()}**\n\n`;
  text += rec.bundleText + '\n\n';

  text += `**Category Breakdown:**\n`;
  for (const match of rec.categoryMatches) {
    const tierBudget = match.allocatedBudget * TIER_MULTIPLIERS[match.recommendedTier];
    text += `- **${match.category}** (${match.recommendedTier}): ₹${(tierBudget/100000).toFixed(1)}L\n`;
  }

  text += `\n**Estimated Total:** ₹${(rec.totalEstimatedCost/100000).toFixed(1)}L | `;
  text += `**Savings:** ₹${(rec.savingsVsAllocated/100000).toFixed(1)}L\n\n`;

  text += `${rec.nextStep}\n`;

  return text;
}

// ─── Filter & rank packages from DB via RPC ──────────────────────────────────
export async function findMatchingPackages(
  eventType: string,
  tier: 'silver' | 'gold' | 'platinum',
  maxBudget: number,
  city?: string
): Promise<AdminEventPackage[]> {
  try {
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
    );

    // Call RPC: match_admin_event_package
    const { data, error } = await supabase.rpc('match_admin_event_package', {
      p_event_type: eventType,
      p_max_budget: maxBudget,
      p_tier: tier,
      p_guest_count: null, // Could be enhanced with guest count context
      p_city: city ?? null,
    });

    if (error) {
      console.error('[PackageMatcher] RPC error:', error);
      return [];
    }

    // Convert RPC response to AdminEventPackage[]
    if (!Array.isArray(data)) return [];

    const packages: AdminEventPackage[] = data.map(pkg => ({
      id: pkg.id,
      event_type: eventType,
      tier: pkg.tier,
      name: pkg.display_name,
      description: pkg.description,
      original_price: Number(pkg.base_price),
      discount_percentage: Number(pkg.discount_percentage),
      final_price: Number(pkg.final_price),
      included_items: [], // Will be fetched separately if needed
      optional_items: [],
      is_published: pkg.is_active,
    }));

    console.log(
      `[PackageMatcher] Found ${packages.length} ${tier} ${eventType} packages under ₹${(maxBudget/100000).toFixed(1)}L`
    );
    return packages;
  } catch (err) {
    console.error('[PackageMatcher] findMatchingPackages error:', err);
    return [];
  }
}

// ─── Get a one-liner explanation of tier choice ────────────────────────────────
export function getTierExplanation(tier: 'silver' | 'gold' | 'platinum'): string {
  if (tier === 'silver') return '💰 Budget-friendly with essential services';
  if (tier === 'gold') return '⭐ Premium features at great value';
  return '👑 Top-tier luxury experience';
}

// ─── Full recommendation flow ──────────────────────────────────────────────────
export async function recommendPackages(plan: EventBudgetPlan): Promise<{
  recommendation: PackageRecommendation;
  displayText: string;
  packages?: AdminEventPackage[];
}> {
  const recommendation = matchPlanToPackages(plan);
  const displayText = formatPackageRecommendation(recommendation);

  // Try to fetch actual packages (Phase 2C only)
  const packages = await findMatchingPackages(
    plan.eventType,
    recommendation.suggestedTier,
    recommendation.totalEstimatedCost,
    plan.city
  );

  return { recommendation, displayText, packages };
}
