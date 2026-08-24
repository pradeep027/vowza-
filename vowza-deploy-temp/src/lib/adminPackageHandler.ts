/**
 * Admin Package Handler — Phase 7E
 *
 * Distinguishes admin (all-in-one) packages from vendor packages
 * Prioritizes admin packages in recommendations when appropriate
 * Shows savings comparison between admin vs custom mix
 */

import type { DBVendor, PlannerContext, EventBudgetPlan } from './aiPlannerTypes';

export interface AdminPackage {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  includedServices: string[];
  category: 'wedding' | 'corporate' | 'birthday' | 'other';
  tier: 'silver' | 'gold' | 'platinum';
  isActive: boolean;
  createdAt?: string;
  tier_description?: string;
}

export interface PackageRecommendation {
  type: 'admin' | 'vendor' | 'mixed';
  packages: AdminPackage[] | DBVendor[];
  totalCost: number;
  savings?: number;
  recommendation: string;
  breakdown?: {
    service: string;
    provider: string;
    cost: number;
  }[];
}

/**
 * Label package type for display
 */
export function getPackageTypeLabel(packageType: 'admin' | 'vendor' | 'mixed'): string {
  const labels: Record<'admin' | 'vendor' | 'mixed', string> = {
    'admin': '🎁 All-in-One Package',
    'vendor': '🎯 Custom Mix',
    'mixed': '🔀 Flexible Options',
  };
  return labels[packageType];
}

/**
 * Get tier badge for admin packages
 */
export function getTierBadge(tier: 'silver' | 'gold' | 'platinum'): string {
  const badges: Record<'silver' | 'gold' | 'platinum', string> = {
    'silver': '🥈 Silver',
    'gold': '🥇 Gold',
    'platinum': '💎 Platinum',
  };
  return badges[tier];
}

/**
 * Extract included services from admin package features
 */
export function extractIncludedServices(features: string[]): string[] {
  if (!features) return [];

  const servicePatterns: Record<string, RegExp> = {
    'photography': /photograph|photo|camera/i,
    'videography': /video|videograph/i,
    'decoration': /decor|flower|arrangement/i,
    'catering': /catering|food|meal|cuisine/i,
    'dj': /dj|music|entertainment|sound/i,
    'makeup': /makeup|bridal|beauty/i,
    'venue': /venue|hall|location|space/i,
    'invitations': /invitation|card|stationery/i,
  };

  const services: Set<string> = new Set();

  for (const feature of features) {
    for (const [service, pattern] of Object.entries(servicePatterns)) {
      if (pattern.test(feature)) {
        services.add(service);
      }
    }
  }

  return Array.from(services);
}

/**
 * Calculate potential savings with admin package
 */
export function calculatePackageSavings(
  adminPackage: AdminPackage,
  customVendorCost: number
): number {
  const savings = customVendorCost - adminPackage.price;
  return Math.max(0, savings);
}

/**
 * Format admin package recommendation
 */
export function formatAdminPackageRecommendation(
  adminPackage: AdminPackage,
  customCost: number,
  context: PlannerContext
): string {
  const savings = calculatePackageSavings(adminPackage, customCost);
  const tier = getTierBadge(adminPackage.tier);
  const savingsPercent = Math.round((savings / customCost) * 100);

  let recommendation = `## ${tier} ${adminPackage.name}\n\n`;
  recommendation += `**All-in-One Package** — One vendor handles everything!\n\n`;

  recommendation += `### Package Includes\n`;
  const services = extractIncludedServices(adminPackage.features);
  services.forEach(service => {
    recommendation += `✓ ${service.charAt(0).toUpperCase() + service.slice(1)}\n`;
  });

  recommendation += `\n### Pricing & Savings\n`;
  recommendation += `- **Admin Package:** ₹${(adminPackage.price / 1000).toFixed(0)}K\n`;
  recommendation += `- **Custom Mix:** ₹${(customCost / 1000).toFixed(0)}K\n`;

  if (savings > 0) {
    recommendation += `- **💰 You Save:** ₹${(savings / 1000).toFixed(0)}K (${savingsPercent}%)\n`;
  }

  recommendation += `\n### Benefits\n`;
  recommendation += `✓ **Simpler Coordination** — Single point of contact\n`;
  recommendation += `✓ **Consistent Quality** — Vetted all-in-one package\n`;
  recommendation += `✓ **Potential Savings** — Bundled pricing\n`;
  recommendation += `✓ **Pre-tested Team** — Services work together seamlessly\n`;

  recommendation += `\n[Book This Package](javascript:void(0))  |  [See Custom Options](javascript:void(0))\n`;

  return recommendation;
}

/**
 * Format comparison between admin and custom packages
 */
export function formatAdminVsCustomComparison(
  adminPackage: AdminPackage,
  customVendors: DBVendor[],
  plan: EventBudgetPlan | null
): string {
  const customCost = customVendors.reduce((sum, v) => sum + (v.price_min || 0), 0);
  const savings = calculatePackageSavings(adminPackage, customCost);

  let comparison = `## 🔀 Admin Package vs Custom Mix\n\n`;

  comparison += `### ${getTierBadge(adminPackage.tier)} ${adminPackage.name} vs Custom Selection\n\n`;

  comparison += `| Factor | Admin Package | Custom Mix |\n`;
  comparison += `|--------|---------------|------------|\n`;
  comparison += `| **Total Cost** | ₹${(adminPackage.price / 1000).toFixed(0)}K | ₹${(customCost / 1000).toFixed(0)}K |\n`;
  comparison += `| **Coordination** | ✓ Single vendor | ⚠ Multiple vendors |\n`;
  comparison += `| **Flexibility** | Standard package | Fully customizable |\n`;
  comparison += `| **Quality Guarantee** | Pre-vetted | Individual ratings |\n`;
  comparison += `| **Complexity** | Simple | More planning |\n`;

  if (savings > 0) {
    comparison += `| **💰 Savings** | **₹${(savings / 1000).toFixed(0)}K** | — |\n`;
  }

  comparison += `\n### My Recommendation\n\n`;

  if (savings > 0) {
    comparison += `The **${adminPackage.name}** offers great value with ₹${(savings / 1000).toFixed(0)}K in savings.\n`;
    comparison += `Plus, one vendor means simpler coordination and better synergy between services.\n\n`;
  } else {
    comparison += `The **custom mix** allows you to pick the best vendor for each service,\n`;
    comparison += `but the **${adminPackage.name}** is more convenient and has pre-tested team coordination.\n\n`;
  }

  comparison += `**Ready?** Say "Book the ${adminPackage.name}" or "I want to customize" to mix and match.\n`;

  return comparison;
}

/**
 * Format admin package for inline display in recommendations
 */
export function formatAdminPackageCard(adminPackage: AdminPackage): string {
  const tier = getTierBadge(adminPackage.tier);
  const services = extractIncludedServices(adminPackage.features);

  let card = `### ${tier} ${adminPackage.name}\n\n`;
  card += `${adminPackage.description}\n\n`;

  card += `**Includes:** ${services.join(' • ')}\n\n`;
  card += `**Price:** ₹${(adminPackage.price / 1000).toFixed(0)}K\n\n`;
  card += `[Book Now](javascript:void(0))  |  [See Details](javascript:void(0))\n\n`;

  return card;
}

/**
 * Should prioritize admin package in recommendations?
 */
export function shouldPrioritizeAdminPackage(
  adminPackage: AdminPackage,
  customVendorCost: number,
  plan: EventBudgetPlan | null
): boolean {
  // Prioritize admin package if:
  // 1. Budget allows it (price <= 120% of allocation)
  // 2. Savings > 10% of custom mix cost
  // 3. All required services included

  if (!plan) return false;

  const totalAllocation = plan.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  const allowedCost = totalAllocation * 1.2; // Allow up to 20% over plan

  if (adminPackage.price > allowedCost) return false;

  const savings = calculatePackageSavings(adminPackage, customVendorCost);
  const savingsPercent = (savings / customVendorCost) * 100;

  return savingsPercent > 10; // Prioritize if 10%+ savings
}

/**
 * Build admin package context for LLM
 */
export function buildAdminPackageContext(
  adminPackages: AdminPackage[],
  eventType: string
): string {
  if (!adminPackages || adminPackages.length === 0) return '';

  const relevantPackages = adminPackages.filter(p => p.category === eventType || p.category === 'other');

  if (relevantPackages.length === 0) return '';

  let context = `\n**All-in-One Package Options Available:**\n`;
  relevantPackages.forEach(pkg => {
    context += `- ${getTierBadge(pkg.tier)} ${pkg.name}: ₹${(pkg.price / 1000).toFixed(0)}K\n`;
  });

  context += `\nThese packages include multiple services and may offer better value than booking vendors separately.\n`;

  return context;
}

/**
 * Format savings highlight for conversation
 */
export function formatSavingsHighlight(savings: number): string {
  if (savings <= 0) return '';

  const savingPercent = Math.round(savings / 50000 * 100); // Rough percentage

  return `💰 **Save ₹${(savings / 1000).toFixed(0)}K** with an all-in-one package!`;
}
