/**
 * Event-Aware Dynamic Budget Engine
 * 
 * Transforms EventBudgetPlanner from fixed-percentage allocator to intelligent
 * event-aware engine that:
 * 1. Activates only relevant categories per event type
 * 2. Redistributes unused allocation weight dynamically
 * 3. Adjusts for guest count and selected services
 * 4. Validates budget feasibility with contextual warnings
 */

import type { PlannerContext, EventCategory } from './aiPlannerTypes';
import type { BudgetAllocation, EventBudgetPlan } from './eventBudgetPlanner';

// ─── Service Selection Tracking ───────────────────────────────────────────

export interface UserSelections {
  excludeVideography?: boolean;
  wantsBand?: boolean;
  wantsDJ?: boolean;
  wantsDancers?: boolean;
  priorityCategories?: string[];
  excludeCategories?: string[];
  photoPriority?: 'low' | 'medium' | 'high' | 'very_high';
  videoPriority?: 'low' | 'medium' | 'high' | 'very_high';
}

// Extend PlannerContext to track user selections (in practice, added to context)
declare global {
  interface PlannerContext {
    userSelections?: UserSelections;
  }
}

// ─── Event Category Activation Matrix ──────────────────────────────────────
// Maps event type to baseline category weights (before normalization)
// Excludes categories with 0 weight

export const EVENT_CATEGORY_ACTIVATIONS: Record<EventCategory, Record<string, number>> = {
  // WEDDING/MARRIAGE: All 12 baseline categories
  wedding: {
    'Venue Rental': 16,
    'Catering': 30,
    'Decoration & Flowers': 14,
    'Photography': 9,
    'Videography': 8,
    'Makeup & Hair': 5,
    'Music/DJ/Band/Entertainment': 8,
    'Lighting & Sound': 3,
    'Mehendi/Haldi Artists': 2,
    'Anchor/Host': 1,
    'Invitations': 2,
    'Priest/Rituals/Ceremony': 2,
  },

  // ENGAGEMENT: Remove Mehendi/Haldi
  engagement: {
    'Venue Rental': 16,
    'Catering': 30,
    'Decoration & Flowers': 14,
    'Photography': 9,
    'Videography': 8,
    'Makeup & Hair': 5,
    'Music/DJ/Band/Entertainment': 8,
    'Lighting & Sound': 3,
    'Anchor/Host': 1,
    'Invitations': 3,
    'Priest/Rituals/Ceremony': 3,
  },

  // HALDI: Yellow oil ritual, female-focused, 2-4 hours
  haldi: {
    'Decoration & Flowers': 20,
    'Catering': 25,
    'Photography': 15,
    'Videography': 10,
    'Makeup & Hair': 15,
    'Lighting & Sound': 5,
    'Music/DJ/Band/Entertainment': 5,
    'Priest/Rituals/Ceremony': 5,
    // Venue: conditional (home=0%, external=10%)
  },

  // MEHENDI: Henna application, music/dance, 4-6 hours
  mehendi: {
    'Mehendi Artist': 25,
    'Decoration & Flowers': 18,
    'Catering': 22,
    'Photography': 12,
    'Videography': 8,
    'Music/DJ/Band/Entertainment': 10,
    'Makeup & Hair': 3,
    'Lighting & Sound': 3,
    'Invitations': 1,
    // Venue: conditional
  },

  // SANGEET: Music/dance performances, mixed audience
  sangeet: {
    'Music/DJ/Band/Entertainment': 20,
    'Entertainment/Dancers': 15,
    'Venue Rental': 15,
    'Catering': 20,
    'Decoration & Flowers': 12,
    'Lighting & Sound': 8,
    'Photography': 5,
    'Videography': 2,
    'Anchor/Host': 3,
  },

  // RECEPTION: Formal post-wedding celebration
  reception: {
    'Venue Rental': 16,
    'Catering': 35,
    'Decoration & Flowers': 12,
    'Photography': 9,
    'Videography': 8,
    'Music/DJ/Band/Entertainment': 12,
    'Lighting & Sound': 5,
    'Makeup & Hair': 2,
    'Anchor/Host': 2,
  },

  // HOUSEWARMING: Ceremony at home or venue
  housewarming: {
    'Decoration & Flowers': 12,
    'Catering': 28,
    'Photography': 8,
    'Videography': 5,
    'Priest/Rituals/Ceremony': 25,
    'Lighting & Sound': 0,
    'Music/DJ/Band/Entertainment': 0,
    'Makeup & Hair': 0,
    'Flowers': 10,
    'Invitations': 2,
    // Venue: conditional (home=0%, external=15%)
  },

  // CORPORATE: Professional events, AV essential
  corporate: {
    'Venue Rental': 20,
    'Catering': 30,
    'AV/Staging/Lighting': 20,
    'Photography': 12,
    'Videography': 8,
    'Anchor/Host': 5,
    'Music/Entertainment': 3,
    'Flowers': 2,
  },

  // BIRTHDAY: Variable (kids/adults, home/venue, simple/elaborate)
  birthday: {
    'Catering': 25,
    'Decoration & Flowers': 20,
    'Venue Rental': 15,
    'Entertainment': 18,
    'Photography': 10,
    'Videography': 5,
    'Lighting & Sound': 2,
  },

    // BABYSHOWER: Celebration for mom-to-be
  babyshower: {
    'Venue Rental': 15,
    'Catering': 25,
    'Decoration & Flowers': 20,
    'Photography': 10,
    'Videography': 5,
    'Cake': 8,
    'Entertainment': 12,
    'Gifts/Favors': 5,
  },

  // ANNIVERSARY: Celebration of marriage milestone
  anniversary: {
    'Venue Rental': 16,
    'Catering': 30,
    'Decoration & Flowers': 14,
    'Photography': 9,
    'Videography': 8,
    'Makeup': 5,
    'Music/DJ/Band/Entertainment': 8,
    'Lighting & Sound': 3,
    'Cake': 4,
    'Invitations': 3,
  },

  // PRODUCTLAUNCH: Professional product showcase
  productlaunch: {
    'Venue Rental': 20,
    'Catering': 20,
    'AV/Staging/Lighting': 30,
    'Photography': 12,
    'Videography': 10,
    'Anchor/Host': 5,
    'Decoration': 3,
  },

  // EXHIBITION: Trade/art exhibition
  exhibition: {
    'Venue Rental': 30,
    'Setup/Staging': 25,
    'Photography': 15,
    'Videography': 10,
    'Catering': 12,
    'Lighting': 8,
  },

  // COLLEGEFEST: Campus celebration
  collegefest: {
    'Venue Rental': 20,
    'Entertainment': 30,
    'Catering': 20,
    'Decoration': 15,
    'Lighting & Sound': 10,
    'Photography': 5,
  },

  // CONCERT: Live music performance
  concert: {
    'Artist/Performer': 35,
    'Venue Rental': 25,
    'Sound/AV': 20,
    'Lighting': 10,
    'Security': 5,
    'Promotion': 5,
  },

  // DJNIGHT: DJ dance event
  djnight: {
    'DJ & Sound': 40,
    'Venue Rental': 25,
    'Lighting': 15,
    'Catering': 12,
    'Security': 8,
  },

  // FASHIONSHOW: Fashion presentation
  fashionshow: {
    'Venue Rental': 20,
    'Staging/Runway': 25,
    'Lighting & AV': 20,
    'Photography': 15,
    'Videography': 10,
    'Catering': 5,
    'Makeup & Hair': 5,
  },

  // SPORTSEVENT: Sports competition/match
  sportsEvent: {
    'Venue Rental': 30,
    'Equipment': 20,
    'Catering': 20,
    'Lighting & Sound': 15,
    'Photography': 10,
    'Security': 5,
  },

  // TEMPLE/FESTIVAL: Religious celebration
  temple: {
    'Priest/Rituals': 25,
    'Decoration & Flowers': 15,
    'Catering': 30,
    'Photography': 8,
    'Videography': 5,
    'Music/Chanting': 10,
    'Lighting': 4,
    'Donations/Offerings': 3,
  },

  // FESTIVAL: Large community celebration
  festival: {
    'Venue/Permits': 20,
    'Entertainment': 25,
    'Catering': 25,
    'Decoration': 15,
    'Sound/Lighting': 10,
    'Photography': 5,
  },

  // CHARITY: Fundraising event
  charity: {
    'Venue Rental': 20,
    'Catering': 25,
    'Entertainment': 20,
    'Decoration': 12,
    'AV/Sound': 10,
    'Photography': 8,
    'Promotion': 5,
  },

  // PRIVATEPARTY: Private celebration
  privateparty: {
    'Venue Rental': 20,
    'Catering': 35,
    'Decoration': 15,
    'Entertainment/DJ': 15,
    'Photography': 8,
    'Videography': 4,
    'Lighting': 3,
  },
};

// ─── Category Activation ────────────────────────────────────────────────────

export interface CategoryActivation {
  category: string;
  baseWeight: number; // 0-100, may not sum to 100 before normalization
  isConditional?: boolean; // true if depends on context (venue type, etc.)
}

/**
 * Get active categories for an event based on event type and context
 * Filters out categories with 0 weight and handles conditional categories
 */
export function getActiveCategoriesForEvent(
  eventType: EventCategory,
  context: Partial<PlannerContext>
): CategoryActivation[] {
  // Get baseline activations for this event
  let activations = EVENT_CATEGORY_ACTIVATIONS[eventType] || EVENT_CATEGORY_ACTIVATIONS.wedding;

  // Start with all non-zero categories
  let active: CategoryActivation[] = Object.entries(activations)
    .filter(([_, weight]) => weight > 0)
    .map(([category, weight]) => ({
      category,
      baseWeight: weight,
      isConditional: false,
    }));

  // Handle conditional categories based on context
  
  // VENUE: Only relevant if external venue (not home/user's space)
  if ((eventType === 'housewarming' || eventType === 'haldi' || eventType === 'mehendi') && 
      (context.venueType === 'external' || context.hasVenue)) {
    const existingVenue = active.find(a => a.category.includes('Venue'));
    if (!existingVenue) {
      active.push({
        category: 'Venue Rental',
        baseWeight: 10,
        isConditional: true,
      });
    }
  } else if (eventType === 'housewarming' && !context.venueType && !context.hasVenue) {
    // Home event: remove venue if present
    active = active.filter(a => !a.category.includes('Venue'));
  }

  // VIDEOGRAPHY: User can remove it
  if (context.userSelections?.excludeVideography) {
    active = active.filter(a => !a.category.includes('Videography'));
  }

  // BAND vs DJ: Handle explicitly
  const hasBand = context.userSelections?.wantsBand;
  const hasDJ = context.userSelections?.wantsDJ;
  const musicEntry = active.find(a => 
    a.category.includes('Music') || a.category.includes('DJ') || a.category.includes('Band') ||
    a.category.includes('Entertainment')
  );

  if (hasBand || hasDJ) {
    if (hasBand && hasDJ && musicEntry) {
      // Both: split the weight 50-50
      const halfWeight = musicEntry.baseWeight / 2;
      musicEntry.category = 'DJ';
      musicEntry.baseWeight = halfWeight;
      active.push({
        category: 'Band',
        baseWeight: halfWeight,
        isConditional: false,
      });
    } else if (hasBand && musicEntry) {
      musicEntry.category = 'Band';
    } else if (hasDJ && musicEntry) {
      musicEntry.category = 'DJ';
    }
  }

  // DANCERS: For Sangeet and similar events
  if (context.userSelections?.wantsDancers && eventType === 'sangeet') {
    const existingDancers = active.find(a => a.category.includes('Dancer'));
    if (!existingDancers) {
      active.push({
        category: 'Dancers/Choreography',
        baseWeight: 8,
        isConditional: true,
      });
    }
  }

  // USER PRIORITY: Increase photography weight if high priority
  if (context.userSelections?.photoPriority === 'very_high') {
    const photoEntry = active.find(a => a.category.includes('Photography'));
    if (photoEntry) {
      photoEntry.baseWeight = Math.min(photoEntry.baseWeight * 1.5, 20); // Cap at 20%
    }
  }

  // USER PRIORITY: Increase videography weight if high priority
  if (context.userSelections?.videoPriority === 'very_high') {
    const videoEntry = active.find(a => a.category.includes('Videography'));
    if (videoEntry) {
      videoEntry.baseWeight = Math.min(videoEntry.baseWeight * 1.5, 18); // Cap at 18%
    }
  }

  // USER EXCLUSIONS: Remove explicitly excluded categories
  if (context.userSelections?.excludeCategories) {
    active = active.filter(a => !context.userSelections!.excludeCategories!.some(
      exc => a.category.toLowerCase().includes(exc.toLowerCase())
    ));
  }

  return active;
}

// ─── Dynamic Normalization ──────────────────────────────────────────────────

export interface NormalizedAllocation {
  category: string;
  normalizedWeight: number; // 0-100, always sums to 100
}

/**
 * Normalize active categories so they sum to exactly 100%
 * Removes unused allocation weight
 */
export function normalizeAllocationWeights(
  activations: CategoryActivation[]
): NormalizedAllocation[] {
  const totalWeight = activations.reduce((sum, a) => sum + a.baseWeight, 0);

  if (totalWeight === 0) {
    // Fallback: if somehow no categories, return empty
    return [];
  }

  return activations.map(a => ({
    category: a.category,
    normalizedWeight: (a.baseWeight / totalWeight) * 100,
  }));
}

// ─── Guest Count Sensitivity ────────────────────────────────────────────────

export interface SensitivityAdjustment {
  category: string;
  adjustedWeight: number;
  warningMessage?: string;
}

/**
 * Apply guest count sensitivity and multi-function adjustments
 * Warns if catering/venue will exceed budget
 */
export function applySensitivity(
  normalized: NormalizedAllocation[],
  context: Partial<PlannerContext>
): { adjustments: SensitivityAdjustment[]; warnings: string[] } {
  const warnings: string[] = [];
  let adjustments: SensitivityAdjustment[] = normalized.map(n => ({
    category: n.category,
    adjustedWeight: n.normalizedWeight,
  }));

  if (!context.guestCount || !context.budget || !context.city || !context.eventType) {
    return { adjustments, warnings };
  }

  const minPerGuest = PER_GUEST_COST_MIN[context.eventType as EventCategory] || 1000;
  const cityMultiplier = CITY_MULTIPLIER[context.city] || 1.0;
  
  // Multi-function adjustment: if multiple functions, increase catering/decoration/photo
  let functionMultiplier = 1.0;
  if (context.durationDays && context.durationDays > 1) {
    functionMultiplier = Math.min(1 + (context.durationDays - 1) * 0.15, 1.4); // Max 40% increase
    
    // Apply multiplier to catering, decoration, photography
    const cateringIdx = adjustments.findIndex(a => a.category.includes('Catering'));
    const decorationIdx = adjustments.findIndex(a => a.category.includes('Decoration'));
    const photoIdx = adjustments.findIndex(a => a.category.includes('Photography'));
    
    if (cateringIdx !== -1) adjustments[cateringIdx].adjustedWeight *= functionMultiplier;
    if (decorationIdx !== -1) adjustments[decorationIdx].adjustedWeight *= functionMultiplier;
    if (photoIdx !== -1) adjustments[photoIdx].adjustedWeight *= functionMultiplier;
    
    // Re-normalize after multi-function boost
    const total = adjustments.reduce((sum, a) => sum + a.adjustedWeight, 0);
    adjustments = adjustments.map(a => ({
      ...a,
      adjustedWeight: (a.adjustedWeight / total) * 100,
    }));
  }

  // Guest count sensitivity: adjust catering and venue based on guest count
  const estimatedCateringNeeded = context.guestCount * minPerGuest * cityMultiplier;
  const cateringAllocation = adjustments.find(a => a.category.includes('Catering'));

  if (cateringAllocation) {
    const cateringAllocated = context.budget * (cateringAllocation.adjustedWeight / 100);

    // Check if catering budget is realistic
    if (estimatedCateringNeeded > cateringAllocated * 1.2) {
      warnings.push(
        `⚠️ Budget Reality Check: With ${context.guestCount} guests and ₹${(context.budget / 100000).toFixed(1)}L total budget, ` +
        `catering alone will likely need ₹${(estimatedCateringNeeded / 100000).toFixed(1)}L ` +
        `(currently allocated ₹${(cateringAllocated / 100000).toFixed(1)}L). ` +
        `Consider: reducing guest count, increasing budget, or simplifying the menu.`
      );
    }
  }

  // Venue scalability: large venues for 500+ guests may need higher allocation
  if (context.guestCount >= 500) {
    const venueAllocation = adjustments.find(a => a.category.includes('Venue'));
    if (venueAllocation && venueAllocation.adjustedWeight < 18) {
      // Suggest venue budget increase
      warnings.push(
        `💡 Venue Consideration: For ${context.guestCount} guests, venue rental may need higher budget. ` +
        `Large venues/outdoor setups may require additional investment for logistics and parking.`
      );
    }
  }

  return { adjustments, warnings };
}

// ─── Venue Multiplier (City Cost) ────────────────────────────────────────────

const CITY_MULTIPLIER: Record<string, number> = {
  'Mumbai': 1.55,
  'Delhi': 1.45,
  'Bangalore': 1.35,
  'Pune': 1.12,
  'Chennai': 1.15,
  'Hyderabad': 1.0,
  'Kolkata': 0.95,
  'Ahmedabad': 1.08,
  'Surat': 0.98,
  'Jaipur': 1.02,
  'Lucknow': 0.92,
  'Kochi': 1.18,
  'Vizag': 0.88,
};

// ─── Per-Guest Cost Minimums ────────────────────────────────────────────────
// Minimum catering cost per guest (before city multiplier)
const PER_GUEST_COST_MIN: Record<EventCategory, number> = {
  'wedding': 1000,  // ₹1000/guest for decent catering
  'marriage': 1000,
  'haldi': 600,
  'mehendi': 600,
  'sangeet': 800,
  'reception': 1000,
  'housewarming': 500,
  'engagement': 800,
  'birthday': 300,
  'babyshower': 400,
  'anniversary': 900,
  'corporate': 400,
  'conference': 300,
  'productlaunch': 200,
  'exhibition': 150,
  'collegefest': 250,
  'concert': 150,
  'djnight': 250,
  'fashionshow': 300,
  'sportsEvent': 250,
  'temple': 400,
  'festival': 300,
  'charity': 400,
  'privateparty': 700,
};

// ─── Main Orchestration ─────────────────────────────────────────────────────

/**
 * Complete event-aware budget generation pipeline
 */
export function generateEventAwareBudget(
  context: PlannerContext,
  totalBudget: number
): {
  allocations: BudgetAllocation[];
  normalizedWeights: NormalizedAllocation[];
  activatedCategories: number;
  warnings: string[];
} {
  // Step 1: Get active categories for this event
  const activations = getActiveCategoriesForEvent(
    (context.eventType as EventCategory) || 'wedding',
    context
  );

  // Step 2: Normalize so they sum to 100%
  const normalized = normalizeAllocationWeights(activations);

  // Step 3: Apply sensitivity checks (guest count, etc.)
  const { adjustments, warnings } = applySensitivity(normalized, context);

  // Step 4: Convert to monetary amounts
  const allocations: BudgetAllocation[] = adjustments.map(adj => {
    const amount = (totalBudget * adj.adjustedWeight) / 100;
    return {
      category: adj.category,
      allocatedAmount: Math.round(amount),
      actualPercentage: adj.adjustedWeight,
      minAmount: Math.round(amount * 0.8),
      maxAmount: Math.round(amount * 1.25),
      priority: 'medium',
      required: true,
      reasoning: `Allocated for ${context.eventType} event with ${context.guestCount} guests`,
    };
  });

  return {
    allocations,
    normalizedWeights: normalized,
    activatedCategories: allocations.length,
    warnings,
  };
}

// ─── Export for integration ─────────────────────────────────────────────────

export type { CategoryActivation, NormalizedAllocation, SensitivityAdjustment };
