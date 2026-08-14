/**
 * Dietary Preference Filterer — Phase 7C
 *
 * Filters caterers based on dietary preferences and menu availability
 * Integrates with vendor search and package recommendation
 */

import { 
  DietaryPreference, 
  extractDietaryPreferencesFromText,
  filterCaterersByDietaryPreferences,
  isMenuItemSuitableForDiet,
  getDietaryPreferenceBadge,
} from './eventContextCapturer';
import type { DBVendor, PlannerContext } from './aiPlannerTypes';

export interface DietaryFilterResult {
  preferences: DietaryPreference[];
  filteredVendors: DBVendor[];
  excludedVendors: DBVendor[];
  matchMetrics: {
    totalVendors: number;
    matchingVendors: number;
    matchPercentage: number;
  };
}

/**
 * Extract dietary preferences from message and filter vendors
 */
export function filterVendorsByDietaryPreference(
  message: string,
  vendors: DBVendor[],
  context: PlannerContext
): DietaryFilterResult {
  // Extract dietary preferences from message
  const preferences = extractDietaryPreferencesFromText(message);

  if (preferences.length === 0) {
    // No dietary restrictions, return all vendors
    return {
      preferences: [],
      filteredVendors: vendors,
      excludedVendors: [],
      matchMetrics: {
        totalVendors: vendors.length,
        matchingVendors: vendors.length,
        matchPercentage: 100,
      },
    };
  }

  // Categorize vendors as caterers or others
  const caterers = vendors.filter(v => 
    v.profession?.toLowerCase().includes('cater') || 
    v.profession?.toLowerCase().includes('food')
  );
  
  const nonCaterers = vendors.filter(v => 
    !v.profession?.toLowerCase().includes('cater') && 
    !v.profession?.toLowerCase().includes('food')
  );

  // Filter caterers by dietary preferences
  const filteredCaterers = filterCaterersByDietaryPreferences(caterers, preferences);

  // Combine filtered caterers with non-caterers (non-food vendors unaffected)
  const filteredVendors = [...filteredCaterers, ...nonCaterers];

  const excludedVendors = caterers.filter(
    v => !filteredCaterers.find(fc => fc.id === v.id)
  );

  return {
    preferences,
    filteredVendors,
    excludedVendors,
    matchMetrics: {
      totalVendors: vendors.length,
      matchingVendors: filteredVendors.length,
      matchPercentage: vendors.length > 0 ? Math.round((filteredVendors.length / vendors.length) * 100) : 100,
    },
  };
}

/**
 * Format dietary filter results for display
 */
export function formatDietaryFilterMessage(result: DietaryFilterResult): string {
  if (result.preferences.length === 0) {
    return '';
  }

  const badges = result.preferences.map(p => getDietaryPreferenceBadge(p));
  const badgeText = badges.join(' • ');

  if (result.matchMetrics.matchPercentage === 100) {
    return `**Dietary Preferences:** ${badgeText}\n✓ All vendors support your dietary preferences\n`;
  }

  if (result.matchMetrics.matchPercentage === 0) {
    return `**Dietary Preferences:** ${badgeText}\n⚠️ No caterers found matching your dietary preferences. Showing alternatives.\n`;
  }

  const matchCount = result.matchMetrics.matchingVendors;
  const totalCount = result.matchMetrics.totalVendors;
  return `**Dietary Preferences:** ${badgeText}\n✓ ${matchCount} of ${totalCount} vendors match your preferences\n`;
}

/**
 * Get menu items suitable for dietary preferences
 * Used to display recommended dishes
 */
export function getRecommendedMenuItems(
  vendor: DBVendor,
  preferences: DietaryPreference[],
  limit: number = 3
): any[] {
  if (!vendor.menu_items || vendor.menu_items.length === 0) {
    return [];
  }

  const suitableItems = vendor.menu_items.filter(item =>
    isMenuItemSuitableForDiet(item, preferences)
  );

  return suitableItems.slice(0, limit);
}

/**
 * Get dietary preference support info for vendor card
 */
export function getDietaryPreferenceSupportInfo(
  vendor: DBVendor,
  preferences: DietaryPreference[]
): { isSupported: boolean; reason: string } {
  if (preferences.length === 0) {
    return { isSupported: true, reason: 'No dietary restrictions' };
  }

  // Check if vendor is a caterer
  if (!vendor.profession?.toLowerCase().includes('cater') && !vendor.profession?.toLowerCase().includes('food')) {
    return { isSupported: true, reason: 'Not a food vendor' };
  }

  // Check if has menu data
  if (!vendor.menu_items || vendor.menu_items.length === 0) {
    return { 
      isSupported: true, 
      reason: 'Menu details not available yet - contact vendor to confirm' 
    };
  }

  // Check if has suitable items
  const hasSuitableItems = vendor.menu_items.some(item =>
    isMenuItemSuitableForDiet(item, preferences)
  );

  if (hasSuitableItems) {
    return { 
      isSupported: true, 
      reason: `Offers ${preferences.map(p => p).join(', ')} options` 
    };
  }

  return { 
    isSupported: false, 
    reason: `Does not offer ${preferences.map(p => p).join(', ')} options` 
  };
}

/**
 * Add dietary filter note to vendor context
 */
export function buildDietaryFilterContext(
  preferences: DietaryPreference[],
  vendors: DBVendor[]
): string {
  if (preferences.length === 0) return '';

  const badges = preferences.map(p => getDietaryPreferenceBadge(p));
  const catering = vendors.filter(v => 
    v.profession?.toLowerCase().includes('cater') || 
    v.profession?.toLowerCase().includes('food')
  );

  if (catering.length === 0) return '';

  let context = `\n**Dietary Preferences Applied:** ${badges.join(' • ')}\n`;
  
  const supportingCaterers = catering.filter(v => {
    const support = getDietaryPreferenceSupportInfo(v, preferences);
    return support.isSupported;
  });

  context += `✓ ${supportingCaterers.length} of ${catering.length} caterers support your dietary preferences.\n`;

  return context;
}
