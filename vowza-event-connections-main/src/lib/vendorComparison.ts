/**
 * Vendor Comparison — Phase 7D
 *
 * Creates side-by-side vendor comparisons with:
 * - Feature comparison (rating, experience, packages)
 * - Cost-per-unit analysis (per hour, per plate, per guest)
 * - Pricing breakdown
 * - Strengths/weaknesses analysis
 */

import type { DBVendor } from './aiPlannerTypes';

export interface ComparisonMetric {
  name: string;
  value: string | number;
  unit?: string;
  weight: number; // 1-5 stars for importance
}

export interface VendorComparisonCard {
  vendor: DBVendor;
  metrics: ComparisonMetric[];
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  bestFor: string;
}

export interface ComparisonTable {
  vendors: VendorComparisonCard[];
  title: string;
  recommendation: string;
}

/**
 * Calculate cost per unit for different vendor types
 */
export function calculateCostPerUnit(vendor: DBVendor): {
  perHour?: number;
  perPlate?: number;
  perGuest?: number;
  perEvent?: number;
} {
  const metrics: any = {};

  if (!vendor.pricing_packages || vendor.pricing_packages.length === 0) {
    // Use min/max price
    if (vendor.price_min) metrics.perEvent = vendor.price_min;
    return metrics;
  }

  // Get average package info
  const packages = vendor.pricing_packages;
  const avgPrice = packages.reduce((sum, p) => sum + (p.price || 0), 0) / packages.length;

  // Estimate based on profession
  const profession = (vendor.profession || '').toLowerCase();

  if (profession.includes('photographer') || profession.includes('videographer')) {
    // Photographers: estimate per hour
    // Average event: 8 hours, package ₹60K → ₹7.5K per hour
    const avgDuration = 8;
    metrics.perHour = Math.round(avgPrice / avgDuration);
    metrics.perEvent = avgPrice;
  } else if (profession.includes('cater') || profession.includes('food')) {
    // Caterers: per plate
    // Find menu items and calculate average
    if (vendor.menu_items && vendor.menu_items.length > 0) {
      const avgMenuPrice = vendor.menu_items.reduce((sum, item) => sum + (item.price_per_plate || 0), 0) / vendor.menu_items.length;
      metrics.perPlate = Math.round(avgMenuPrice);
      metrics.perGuest = metrics.perPlate; // Same as per plate
    } else {
      // Estimate from package
      // Assume 200 guests at package price
      metrics.perGuest = Math.round(avgPrice / 200);
    }
  } else if (profession.includes('decorator') || profession.includes('dj') || profession.includes('band')) {
    // Decorators/DJ: per event or per hour
    const avgDuration = 4; // Assume 4 hours typical
    metrics.perHour = Math.round(avgPrice / avgDuration);
    metrics.perEvent = avgPrice;
  } else {
    // Generic: per event
    metrics.perEvent = avgPrice;
  }

  return metrics;
}

/**
 * Extract comparison metrics from vendor
 */
function extractMetrics(vendor: DBVendor, profession: string): ComparisonMetric[] {
  const metrics: ComparisonMetric[] = [];

  // Rating
  metrics.push({
    name: 'Rating',
    value: vendor.average_rating ? `${vendor.average_rating.toFixed(1)}/5` : 'Not rated',
    weight: 5,
  });

  // Reviews
  metrics.push({
    name: 'Reviews',
    value: vendor.total_reviews || 0,
    unit: 'reviews',
    weight: 4,
  });

  // Experience
  if (vendor.experience_years) {
    metrics.push({
      name: 'Experience',
      value: vendor.experience_years,
      unit: 'years',
      weight: 3,
    });
  }

  // Price range
  if (vendor.price_min && vendor.price_max) {
    metrics.push({
      name: 'Price',
      value: `₹${(vendor.price_min / 1000).toFixed(0)}K - ₹${(vendor.price_max / 1000).toFixed(0)}K`,
      weight: 5,
    });
  } else if (vendor.price_min) {
    metrics.push({
      name: 'Starting Price',
      value: `₹${(vendor.price_min / 1000).toFixed(0)}K`,
      weight: 5,
    });
  }

  // Packages count
  if (vendor.pricing_packages && vendor.pricing_packages.length > 0) {
    metrics.push({
      name: 'Packages',
      value: vendor.pricing_packages.length,
      weight: 2,
    });
  }

  // Cost per unit
  const costMetrics = calculateCostPerUnit(vendor);
  if (costMetrics.perHour) {
    metrics.push({
      name: 'Per Hour',
      value: `₹${costMetrics.perHour.toLocaleString()}`,
      weight: 4,
    });
  }
  if (costMetrics.perPlate) {
    metrics.push({
      name: 'Per Plate',
      value: `₹${costMetrics.perPlate}`,
      weight: 4,
    });
  }
  if (costMetrics.perGuest) {
    metrics.push({
      name: 'Per Guest',
      value: `₹${costMetrics.perGuest}`,
      weight: 4,
    });
  }

  return metrics;
}

/**
 * Calculate comparison score for vendor
 */
function calculateComparisonScore(vendor: DBVendor): number {
  let score = 0;

  // Rating (max 40 points)
  if (vendor.average_rating) {
    score += (vendor.average_rating / 5) * 40;
  }

  // Reviews (max 30 points)
  if (vendor.total_reviews && vendor.total_reviews > 0) {
    // 1-50 reviews: 10 points, 51-100: 20 points, 101+: 30 points
    score += Math.min(30, Math.floor(vendor.total_reviews / 3));
  }

  // Experience (max 20 points)
  if (vendor.experience_years) {
    // 1-5 years: 5 pts, 6-10: 10 pts, 11+: 20 pts
    score += Math.min(20, Math.floor(vendor.experience_years * 1.5));
  }

  // Packages (max 10 points)
  if (vendor.pricing_packages && vendor.pricing_packages.length > 0) {
    score += Math.min(10, vendor.pricing_packages.length);
  }

  return Math.min(100, Math.round(score));
}

/**
 * Identify vendor strengths
 */
function identifyStrengths(vendor: DBVendor): string[] {
  const strengths: string[] = [];

  if (vendor.average_rating && vendor.average_rating >= 4.7) {
    strengths.push('Highly rated');
  }

  if (vendor.total_reviews && vendor.total_reviews >= 100) {
    strengths.push('Extensive reviews');
  }

  if (vendor.experience_years && vendor.experience_years >= 10) {
    strengths.push('Veteran professional');
  }

  if (vendor.pricing_packages && vendor.pricing_packages.length >= 3) {
    strengths.push('Flexible packages');
  }

  if (vendor.total_bookings && vendor.total_bookings >= 50) {
    strengths.push('Popular choice');
  }

  // Check for specialization
  if (vendor.bio && vendor.bio.toLowerCase().includes('speciali')) {
    strengths.push('Specialized expertise');
  }

  return strengths.length > 0 ? strengths : ['Verified professional'];
}

/**
 * Identify vendor weaknesses
 */
function identifyWeaknesses(vendor: DBVendor): string[] {
  const weaknesses: string[] = [];

  if (!vendor.average_rating || vendor.average_rating < 4.0) {
    weaknesses.push('Lower ratings');
  }

  if (!vendor.total_reviews || vendor.total_reviews < 10) {
    weaknesses.push('Few reviews');
  }

  if (!vendor.experience_years || vendor.experience_years < 3) {
    weaknesses.push('Limited experience');
  }

  if (!vendor.pricing_packages || vendor.pricing_packages.length < 2) {
    weaknesses.push('Limited package options');
  }

  if (vendor.price_max && vendor.price_max > 200000) {
    weaknesses.push('Premium pricing');
  }

  return weaknesses;
}

/**
 * Create vendor comparison card
 */
export function createComparisonCard(vendor: DBVendor): VendorComparisonCard {
  const profession = (vendor.profession || 'vendor').toLowerCase();
  const metrics = extractMetrics(vendor, profession);
  const score = calculateComparisonScore(vendor);
  const strengths = identifyStrengths(vendor);
  const weaknesses = identifyWeaknesses(vendor);

  // Determine what vendor is best for
  let bestFor = 'General events';
  if (profession.includes('photographer')) bestFor = 'Capturing moments';
  else if (profession.includes('decorator')) bestFor = 'Beautiful ambiance';
  else if (profession.includes('cater')) bestFor = 'Food experience';
  else if (profession.includes('dj')) bestFor = 'Entertainment';
  else if (profession.includes('makeup')) bestFor = 'Bridal makeup';

  return {
    vendor,
    metrics,
    score,
    strengths,
    weaknesses,
    bestFor,
  };
}

/**
 * Format vendor comparison as markdown table
 */
export function formatComparisonTable(vendors: DBVendor[]): string {
  if (vendors.length === 0) return '';

  const cards = vendors.map(createComparisonCard);

  // Find all unique metric names
  const allMetrics = new Set<string>();
  cards.forEach(card => {
    card.metrics.forEach(m => allMetrics.add(m.name));
  });

  // Build header
  let table = '| Vendor | ';
  Array.from(allMetrics).forEach(metric => {
    table += `${metric} | `;
  });
  table += 'Score | Best For |\n';

  // Build separator
  table += '|--------|';
  Array.from(allMetrics).forEach(() => {
    table += '--------|';
  });
  table += '-------|----------|\n';

  // Build rows
  cards.forEach(card => {
    const vendorName = `**${card.vendor.stage_name}**\n⭐ ${card.vendor.average_rating || 'N/A'}/5`;
    table += `| ${vendorName} | `;

    const metricMap = new Map(card.metrics.map(m => [m.name, m]));

    Array.from(allMetrics).forEach(metricName => {
      const metric = metricMap.get(metricName);
      if (metric) {
        table += `${metric.value}${metric.unit ? ' ' + metric.unit : ''} | `;
      } else {
        table += '— | ';
      }
    });

    // Score as visual bar
    const scoreBar = '█'.repeat(Math.round(card.score / 10)) + '░'.repeat(10 - Math.round(card.score / 10));
    table += `${card.score}/100\n${scoreBar} | ${card.bestFor} |\n`;
  });

  return table;
}

/**
 * Format detailed vendor comparison with insights
 */
export function formatDetailedComparison(vendors: DBVendor[]): string {
  if (vendors.length === 0) return '';

  const cards = vendors.map(createComparisonCard);

  // Sort by score descending
  cards.sort((a, b) => b.score - a.score);

  let comparison = '## 📊 Vendor Comparison\n\n';

  cards.forEach((card, index) => {
    const rank = index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '•';

    comparison += `### ${medal} #${rank}: ${card.vendor.stage_name}\n`;
    comparison += `**Score: ${card.score}/100** | `;
    comparison += `**Rating: ⭐ ${card.vendor.average_rating || 'N/A'}/5** (${card.vendor.total_reviews || 0} reviews)\n\n`;

    // Strengths
    if (card.strengths.length > 0) {
      comparison += `**✓ Strengths:**\n`;
      card.strengths.forEach(s => {
        comparison += `- ${s}\n`;
      });
      comparison += '\n';
    }

    // Weaknesses
    if (card.weaknesses.length > 0) {
      comparison += `**⚠ Considerations:**\n`;
      card.weaknesses.forEach(w => {
        comparison += `- ${w}\n`;
      });
      comparison += '\n';
    }

    // Best for
    comparison += `**Best For:** ${card.bestFor}\n`;

    // Price info
    if (card.vendor.price_min && card.vendor.price_max) {
      comparison += `**Price Range:** ₹${(card.vendor.price_min / 1000).toFixed(0)}K - ₹${(card.vendor.price_max / 1000).toFixed(0)}K\n`;
    }

    // Cost per unit
    const costMetrics = calculateCostPerUnit(card.vendor);
    if (Object.keys(costMetrics).length > 0) {
      comparison += `**Cost Breakdown:**\n`;
      if (costMetrics.perHour) comparison += `- Per Hour: ₹${costMetrics.perHour.toLocaleString()}\n`;
      if (costMetrics.perPlate) comparison += `- Per Plate: ₹${costMetrics.perPlate}\n`;
      if (costMetrics.perGuest) comparison += `- Per Guest: ₹${costMetrics.perGuest}\n`;
      if (costMetrics.perEvent) comparison += `- Per Event: ₹${(costMetrics.perEvent / 1000).toFixed(0)}K\n`;
    }

    comparison += '\n---\n\n';
  });

  // Add recommendation
  if (cards.length > 0) {
    const topVendor = cards[0];
    comparison += `### 💡 Recommendation\n`;
    comparison += `Based on ratings, reviews, and experience, **${topVendor.vendor.stage_name}** `;
    comparison += `offers the best value for your event. `;
    comparison += `Ready to book? Say "Book ${topVendor.vendor.stage_name}" or ask for more details.\n`;
  }

  return comparison;
}
