// ─── Event Budget Planner — Intelligent Budget Allocation Engine ──────────────
// Purpose: Converts a total budget into intelligent per-category allocations
// based on event type, guest count, and customer priorities.
//
// Smart Rules:
// - Wedding 300 guests ₹5L: Photography 14%, Catering 36%, Decoration 20%
// - Birthday 50 guests ₹2L: Entertainment 25%, Cake/Food 35%, Decoration 15%
// - Corporate 100 attendees ₹8L: Venue 30%, Catering 35%, AV/Staging 20%
//
// Output: BudgetAllocation[] with min/max ranges for rebalancing

import type { PlannerContext, EventCategory, LuxuryLevel } from './aiPlannerTypes';
import { generateEventAwareBudget } from './eventAwareBudgetEngine';

// ─── Budget allocation template per event type ────────────────────────────────
// Format: [{ category, basePercentage, minRange, maxRange, priority }, ...]
// minRange/maxRange allow rebalancing without going below/above
const BUDGET_TEMPLATES: Record<EventCategory, BudgetCategoryTemplate[]> = {
  wedding: [
    { category: 'Photography', basePercentage: 12, minRange: 10, maxRange: 15, priority: 'high', required: true },
    { category: 'Videography', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'high', required: false },
    { category: 'Catering', basePercentage: 32, minRange: 26, maxRange: 38, priority: 'high', required: true },
    { category: 'Decoration', basePercentage: 16, minRange: 12, maxRange: 21, priority: 'high', required: true },
    { category: 'Venue Rental', basePercentage: 12, minRange: 8, maxRange: 16, priority: 'high', required: true },
    { category: 'Makeup & Hair', basePercentage: 6, minRange: 4, maxRange: 9, priority: 'medium', required: true },
    { category: 'Music/DJ/Band', basePercentage: 5, minRange: 3, maxRange: 8, priority: 'medium', required: false },
    { category: 'Lighting & Sound', basePercentage: 4, minRange: 2, maxRange: 7, priority: 'medium', required: false },
    { category: 'Mehendi/Haldi Artists', basePercentage: 2, minRange: 1, maxRange: 4, priority: 'low', required: false },
    { category: 'Anchor/Host', basePercentage: 1, minRange: 0, maxRange: 2, priority: 'low', required: false },
    { category: 'Transportation', basePercentage: 1, minRange: 0, maxRange: 2, priority: 'low', required: false },
    { category: 'Contingency & Misc', basePercentage: 1, minRange: 1, maxRange: 3, priority: 'low', required: false },
  ],
  
  reception: [
    { category: 'Catering', basePercentage: 42, minRange: 35, maxRange: 50, priority: 'high', required: true },
    { category: 'Decoration', basePercentage: 18, minRange: 12, maxRange: 24, priority: 'medium', required: true },
    { category: 'Music/DJ/Band', basePercentage: 12, minRange: 8, maxRange: 16, priority: 'high', required: true },
    { category: 'Photography', basePercentage: 10, minRange: 7, maxRange: 14, priority: 'medium', required: true },
    { category: 'Lighting', basePercentage: 6, minRange: 4, maxRange: 9, priority: 'medium', required: false },
    { category: 'Venue Rental', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'high', required: true },
    { category: 'Contingency & Misc', basePercentage: 4, minRange: 2, maxRange: 6, priority: 'low', required: false },
  ],
  
  birthday: [
    { category: 'Catering', basePercentage: 35, minRange: 25, maxRange: 45, priority: 'high', required: true },
    { category: 'Decoration', basePercentage: 20, minRange: 14, maxRange: 28, priority: 'medium', required: true },
    { category: 'Entertainment/Music', basePercentage: 20, minRange: 15, maxRange: 28, priority: 'high', required: false },
    { category: 'Cake', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'medium', required: true },
    { category: 'Photography', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'low', required: false },
    { category: 'Venue Rental', basePercentage: 6, minRange: 3, maxRange: 10, priority: 'high', required: true },
    { category: 'Contingency & Misc', basePercentage: 3, minRange: 2, maxRange: 5, priority: 'low', required: false },
  ],
  
  corporate: [
    { category: 'Venue', basePercentage: 30, minRange: 22, maxRange: 40, priority: 'high', required: true },
    { category: 'Catering', basePercentage: 35, minRange: 28, maxRange: 45, priority: 'high', required: true },
    { category: 'AV/Staging/Lighting', basePercentage: 15, minRange: 10, maxRange: 22, priority: 'high', required: true },
    { category: 'Photography/Videography', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'medium', required: false },
    { category: 'Transportation', basePercentage: 6, minRange: 3, maxRange: 10, priority: 'low', required: false },
    { category: 'Contingency & Misc', basePercentage: 6, minRange: 3, maxRange: 10, priority: 'low', required: false },
  ],
  
  engagement: [
    { category: 'Catering', basePercentage: 40, minRange: 32, maxRange: 48, priority: 'high', required: true },
    { category: 'Decoration', basePercentage: 18, minRange: 12, maxRange: 24, priority: 'medium', required: true },
    { category: 'Photography', basePercentage: 10, minRange: 7, maxRange: 14, priority: 'medium', required: true },
    { category: 'Music/DJ', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'medium', required: false },
    { category: 'Makeup', basePercentage: 5, minRange: 3, maxRange: 8, priority: 'low', required: false },
    { category: 'Venue', basePercentage: 12, minRange: 8, maxRange: 16, priority: 'high', required: true },
    { category: 'Contingency & Misc', basePercentage: 7, minRange: 3, maxRange: 10, priority: 'low', required: false },
  ],
  
  haldi: [
    { category: 'Catering', basePercentage: 35, minRange: 28, maxRange: 45, priority: 'high', required: true },
    { category: 'Decoration', basePercentage: 25, minRange: 18, maxRange: 32, priority: 'medium', required: true },
    { category: 'Photography', basePercentage: 12, minRange: 8, maxRange: 16, priority: 'low', required: false },
    { category: 'Haldi Artist/Mehendi', basePercentage: 15, minRange: 10, maxRange: 20, priority: 'high', required: true },
    { category: 'Music/DJ', basePercentage: 5, minRange: 2, maxRange: 8, priority: 'low', required: false },
    { category: 'Contingency & Misc', basePercentage: 8, minRange: 4, maxRange: 12, priority: 'low', required: false },
  ],
  
  mehendi: [
    { category: 'Catering', basePercentage: 35, minRange: 28, maxRange: 45, priority: 'high', required: true },
    { category: 'Decoration', basePercentage: 20, minRange: 15, maxRange: 28, priority: 'medium', required: true },
    { category: 'Mehendi Artist', basePercentage: 20, minRange: 15, maxRange: 28, priority: 'high', required: true },
    { category: 'Music/Entertainment', basePercentage: 12, minRange: 8, maxRange: 16, priority: 'medium', required: false },
    { category: 'Photography', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'low', required: false },
    { category: 'Contingency & Misc', basePercentage: 5, minRange: 2, maxRange: 8, priority: 'low', required: false },
  ],
  
  sangeet: [
    { category: 'Catering', basePercentage: 25, minRange: 18, maxRange: 35, priority: 'high', required: true },
    { category: 'Decoration', basePercentage: 20, minRange: 14, maxRange: 28, priority: 'medium', required: true },
    { category: 'Musicians/Singers', basePercentage: 30, minRange: 22, maxRange: 40, priority: 'high', required: true },
    { category: 'Sound System', basePercentage: 10, minRange: 7, maxRange: 14, priority: 'high', required: true },
    { category: 'Photography', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'low', required: false },
    { category: 'Contingency & Misc', basePercentage: 7, minRange: 3, maxRange: 10, priority: 'low', required: false },
  ],
  
  festival: [
    { category: 'Catering', basePercentage: 40, minRange: 32, maxRange: 50, priority: 'high', required: true },
    { category: 'Decoration & Setup', basePercentage: 25, minRange: 18, maxRange: 35, priority: 'high', required: true },
    { category: 'Entertainment', basePercentage: 18, minRange: 12, maxRange: 25, priority: 'high', required: true },
    { category: 'Photography', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'low', required: false },
    { category: 'Permits & Logistics', basePercentage: 5, minRange: 3, maxRange: 8, priority: 'high', required: true },
    { category: 'Contingency & Misc', basePercentage: 4, minRange: 2, maxRange: 7, priority: 'low', required: false },
  ],
  
  anniversary: [
    { category: 'Catering', basePercentage: 38, minRange: 30, maxRange: 48, priority: 'high', required: true },
    { category: 'Decoration', basePercentage: 18, minRange: 12, maxRange: 25, priority: 'medium', required: true },
    { category: 'Photography', basePercentage: 12, minRange: 8, maxRange: 16, priority: 'medium', required: false },
    { category: 'Music/DJ', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'low', required: false },
    { category: 'Cake', basePercentage: 6, minRange: 4, maxRange: 10, priority: 'medium', required: true },
    { category: 'Venue', basePercentage: 12, minRange: 8, maxRange: 18, priority: 'high', required: true },
    { category: 'Contingency & Misc', basePercentage: 6, minRange: 3, maxRange: 10, priority: 'low', required: false },
  ],
  
  'religious-ceremony': [
    { category: 'Pandit/Priest', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'high', required: true },
    { category: 'Catering', basePercentage: 45, minRange: 38, maxRange: 55, priority: 'high', required: true },
    { category: 'Decoration', basePercentage: 15, minRange: 10, maxRange: 22, priority: 'medium', required: true },
    { category: 'Flowers & Pooja Items', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'medium', required: true },
    { category: 'Photography', basePercentage: 6, minRange: 3, maxRange: 10, priority: 'low', required: false },
    { category: 'Music (if applicable)', basePercentage: 5, minRange: 2, maxRange: 8, priority: 'low', required: false },
    { category: 'Contingency & Misc', basePercentage: 13, minRange: 8, maxRange: 18, priority: 'low', required: false },
  ],
  
  housewarming: [
    { category: 'Pandit/Priest', basePercentage: 6, minRange: 4, maxRange: 10, priority: 'high', required: true },
    { category: 'Catering', basePercentage: 40, minRange: 32, maxRange: 50, priority: 'high', required: true },
    { category: 'Decoration & Flowers', basePercentage: 18, minRange: 12, maxRange: 25, priority: 'high', required: true },
    { category: 'Pooja Items & Supplies', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'high', required: true },
    { category: 'Photography/Videography', basePercentage: 10, minRange: 6, maxRange: 15, priority: 'medium', required: false },
    { category: 'Cleaning & Setup', basePercentage: 6, minRange: 3, maxRange: 10, priority: 'medium', required: true },
    { category: 'Music/Entertainment (optional)', basePercentage: 4, minRange: 2, maxRange: 8, priority: 'low', required: false },
    { category: 'Contingency & Misc', basePercentage: 8, minRange: 4, maxRange: 12, priority: 'low', required: false },
  ],
  
  'babyshower': [
    { category: 'Catering', basePercentage: 35, minRange: 28, maxRange: 45, priority: 'high', required: true },
    { category: 'Decoration', basePercentage: 20, minRange: 14, maxRange: 28, priority: 'high', required: true },
    { category: 'Cake/Desserts', basePercentage: 12, minRange: 8, maxRange: 18, priority: 'high', required: true },
    { category: 'Games/Entertainment', basePercentage: 12, minRange: 8, maxRange: 18, priority: 'medium', required: false },
    { category: 'Photography', basePercentage: 10, minRange: 6, maxRange: 15, priority: 'medium', required: false },
    { category: 'Gifts/Favours for Guests', basePercentage: 6, minRange: 3, maxRange: 10, priority: 'low', required: false },
    { category: 'Contingency & Misc', basePercentage: 5, minRange: 2, maxRange: 8, priority: 'low', required: false },
  ],
  
  'college_event': [
    { category: 'Venue', basePercentage: 25, minRange: 18, maxRange: 35, priority: 'high', required: true },
    { category: 'AV/Sound/Lighting', basePercentage: 20, minRange: 14, maxRange: 28, priority: 'high', required: true },
    { category: 'Catering/Refreshments', basePercentage: 25, minRange: 18, maxRange: 35, priority: 'high', required: true },
    { category: 'Entertainment/Performers', basePercentage: 15, minRange: 10, maxRange: 22, priority: 'medium', required: false },
    { category: 'Decoration', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'low', required: false },
    { category: 'Photography/Videography', basePercentage: 4, minRange: 2, maxRange: 8, priority: 'low', required: false },
    { category: 'Contingency & Misc', basePercentage: 3, minRange: 2, maxRange: 5, priority: 'low', required: false },
  ],
  
  'college_fest': [
    { category: 'Venue', basePercentage: 20, minRange: 14, maxRange: 28, priority: 'high', required: true },
    { category: 'AV/Sound/Lighting', basePercentage: 18, minRange: 12, maxRange: 25, priority: 'high', required: true },
    { category: 'Catering', basePercentage: 25, minRange: 18, maxRange: 35, priority: 'high', required: true },
    { category: 'Entertainment/Performers', basePercentage: 20, minRange: 14, maxRange: 28, priority: 'high', required: true },
    { category: 'Decoration & Branding', basePercentage: 8, minRange: 5, maxRange: 12, priority: 'medium', required: false },
    { category: 'Contingency & Misc', basePercentage: 9, minRange: 5, maxRange: 12, priority: 'low', required: false },
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface BudgetCategoryTemplate {
  category: string;
  basePercentage: number;     // 14% for Photography in weddings
  minRange: number;           // Can't go below 10%
  maxRange: number;           // Can't go above 18%
  priority: 'high' | 'medium' | 'low';
  required: boolean;          // Must include in plan
}

export interface BudgetAllocation {
  category: string;
  basePercentage: number;
  minAmount: number;          // ₹min
  maxAmount: number;          // ₹max
  allocatedAmount: number;    // ₹current (starts at basePercentage)
  actualPercentage: number;   // 14.0 (of total)
  priority: 'high' | 'medium' | 'low';
  required: boolean;
  reasoning: string;          // Why this budget for this category
}

export interface EventBudgetPlan {
  eventType: EventCategory;
  city: string;
  totalBudget: number;
  guestCount: number;
  luxuryLevel: LuxuryLevel;
  allocations: BudgetAllocation[];
  totalAllocated: number;
  remaining: number;
  isFeasible: boolean;         // totalBudget covers all required categories
  feasibilityNotes: string[];
  recommendations: string[];   // "Photography is high priority for weddings"
}

// ─── City Price Multiplier ────────────────────────────────────────────────────
const CITY_MULTIPLIER: Record<string, number> = {
  'Mumbai': 1.55, 'Delhi': 1.45, 'Bangalore': 1.35, 'Pune': 1.12,
  'Chennai': 1.15, 'Hyderabad': 1.0, 'Kolkata': 0.95,
  'Ahmedabad': 1.08, 'Surat': 0.98, 'Jaipur': 1.02,
  'Lucknow': 0.92, 'Kochi': 1.18, 'Vizag': 0.88,
};

// ─── Luxury Level Budget Impact ────────────────────────────────────────────────
const LUXURY_MULTIPLIER: Record<LuxuryLevel, number> = {
  'budget': 0.58,
  'standard': 1.0,
  'premium': 1.65,
  'luxury': 2.6,
};

// ─── Per-Guest Cost Ranges (base, before luxury/city adjustment) ────────────────
const PER_GUEST_RANGES: Record<EventCategory, { min: number; max: number }> = {
  'wedding': { min: 1500, max: 2500 },
  'reception': { min: 1200, max: 2000 },
  'birthday': { min: 800, max: 1500 },
  'corporate': { min: 1000, max: 2000 },
  'engagement': { min: 1000, max: 1800 },
  'haldi': { min: 800, max: 1500 },
  'mehendi': { min: 900, max: 1600 },
  'sangeet': { min: 1100, max: 2000 },
  'festival': { min: 1200, max: 2200 },
  'anniversary': { min: 1000, max: 1800 },
  'religious-ceremony': { min: 1200, max: 2000 },
};

// ─── Reasoning messages ────────────────────────────────────────────────────────
const REASONING: Record<string, string> = {
  'Photography': 'Essential for capturing memories — high-priority investment',
  'Videography': 'Professional video preserves the entire event narrative',
  'Catering': 'Food quality directly impacts guest satisfaction — allocate proportionally',
  'Decoration': 'Sets the ambiance and theme — significant investment',
  'Venue Rental': 'Foundation of the event — must be booked early',
  'Makeup & Hair': 'Bride and key family members need professional styling',
  'Music/DJ/Band': 'Entertainment drives the event atmosphere',
  'Lighting & Sound': 'Professional lighting & sound enhance venue ambiance and ritual audibility',
  'Mehendi/Haldi Artists': 'Traditional ritual requiring experienced artist',
  'Anchor/Host': 'Professional emcee ensures smooth ceremony flow and guest engagement',
  'Transportation': 'Guest shuttles and logistics for seamless event coordination',
  'Contingency & Misc': 'Emergency buffer for unexpected costs',
};

// ─── Main Budget Planner Class ─────────────────────────────────────────────────
export class EventBudgetPlanner {
  /**
   * Generates intelligent budget allocation for an event
   * - Accounts for event type (wedding vs birthday vs corporate)
   * - Adjusts for city cost multiplier
   * - Adjusts for luxury level
   * - Validates feasibility against guest count & budget
   */
  static allocate(context: PlannerContext): EventBudgetPlan {
    const { eventType, budget, guestCount, city, luxuryLevel } = context;
    
    // Validate required event type — no silent fallback to wedding
    if (!eventType) {
      throw new Error(
        'Event type is required for budget planning. ' +
        'Received undefined eventType. Please specify the event type (wedding, housewarming, birthday, etc.).'
      );
    }
    
    const finalBudget = budget ?? 500000;
    const finalGuestCount = guestCount ?? 200;
    const finalCity = city ?? 'Hyderabad';
    const finalLuxury = luxuryLevel ?? 'standard';
    
    // Use event-aware budget engine for intelligent allocation
    const engineContext: PlannerContext = {
      eventType: eventType as EventCategory,
      budget: finalBudget,
      guestCount: finalGuestCount,
      city: finalCity,
      luxuryLevel: finalLuxury,
      userSelections: context.userSelections,
      durationDays: context.durationDays,
      venueType: context.venueType,
      hasVenue: context.hasVenue,
    };

    // Generate event-aware budget
    const engineResult = generateEventAwareBudget(engineContext, finalBudget);

    // Convert engine output to EventBudgetPlan format
    const allocations: BudgetAllocation[] = engineResult.allocations.map(a => ({
      category: a.category,
      basePercentage: a.percentage,
      minAmount: a.allocatedAmount * 0.85, // 85-115% range for flexibility
      maxAmount: a.allocatedAmount * 1.15,
      allocatedAmount: a.allocatedAmount,
      actualPercentage: a.percentage,
      priority: this.getPriority(a.category, eventType),
      required: this.isRequired(a.category, eventType),
      reasoning: REASONING[a.category] ?? `Essential component for your ${eventType}`,
    }));

    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const remaining = Math.max(0, finalBudget - totalAllocated);

    // Merge warnings from budget pressure checks
    const feasibilityNotes = [
      ...engineResult.warnings,
      ...this.generateFeasibilityNotes(eventType, finalBudget, finalGuestCount, finalCity),
    ];

    const isFeasible = feasibilityNotes.length === 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      eventType,
      finalGuestCount,
      remaining,
      engineResult.activatedCategories
    );

    return {
      eventType: eventType,
      city: finalCity,
      totalBudget: finalBudget,
      guestCount: finalGuestCount,
      luxuryLevel: finalLuxury,
      allocations,
      totalAllocated,
      remaining,
      isFeasible,
      feasibilityNotes,
      recommendations,
    };
  }

  /**
   * Determine priority level for a category based on event type
   */
  private static getPriority(category: string, eventType: string): 'critical' | 'high' | 'medium' | 'low' {
    const cat = category.toLowerCase();

    // High priority by event type
    if (eventType === 'wedding' && (cat.includes('photography') || cat.includes('catering'))) return 'high';
    if (eventType === 'corporate' && (cat.includes('venue') || cat.includes('av'))) return 'high';
    if (eventType === 'housewarming' && cat.includes('ritual')) return 'high';
    if ((eventType === 'haldi' || eventType === 'mehendi') && cat.includes('artist')) return 'high';
    if (eventType === 'sangeet' && (cat.includes('entertainment') || cat.includes('dj'))) return 'high';

    // Default hierarchy
    if (cat.includes('photography') || cat.includes('catering') || cat.includes('venue')) return 'high';
    if (cat.includes('videography') || cat.includes('decoration')) return 'medium';
    
    return 'low';
  }

  /**
   * Determine if category is required for event
   */
  private static isRequired(category: string, eventType: string): boolean {
    const cat = category.toLowerCase();

    // Always required
    if (cat.includes('catering') || cat.includes('decoration')) return true;

    // Event-specific required
    if (eventType === 'wedding' && cat.includes('photography')) return true;
    if (eventType === 'corporate' && (cat.includes('venue') || cat.includes('catering'))) return true;
    if (eventType === 'housewarming' && cat.includes('ritual')) return true;

    return false;
  }

  /**
   * Generate feasibility notes (legacy method for backward compat)
   */
  private static generateFeasibilityNotes(
    eventType: string,
    budget: number,
    guestCount: number,
    city: string
  ): string[] {
    const notes: string[] = [];

    // Validate budget against per-guest minimums (legacy)
    const perGuestRange = PER_GUEST_RANGES[eventType as EventCategory] ?? { min: 1000, max: 2000 };
    const cityMult = CITY_MULTIPLIER[city] ?? 1.0;
    const minBudgetNeeded = guestCount * perGuestRange.min * cityMult * 1.0; // standard luxury

    if (budget < minBudgetNeeded * 0.9) {
      notes.push(
        `Your budget of ₹${(budget / 100000).toFixed(1)}L is tight for ${guestCount} guests in ${city}. ` +
        `Realistic minimum: ₹${(minBudgetNeeded / 100000).toFixed(1)}L. ` +
        `Consider: reducing guest count, increasing budget, or choosing a budget tier.`
      );
    }

    return notes;
  }

  /**
   * Generate smart recommendations
   */
  private static generateRecommendations(
    eventType: string,
    guestCount: number,
    remaining: number,
    activatedCategories: number
  ): string[] {
    const recommendations: string[] = [];

    // Event-type specific
    if (eventType === 'wedding') {
      recommendations.push('Photography is the highest priority — invest here for lasting memories');
      recommendations.push('Catering quality directly impacts guest satisfaction and experience');
      recommendations.push('Decoration sets the mood and aesthetic — don\'t compromise on this');
    }

    if (eventType === 'corporate') {
      recommendations.push('Venue and catering are the foundation of a professional event');
      recommendations.push('AV/Staging is essential for polished, professional appearance');
    }

    if (eventType.includes('haldi') || eventType.includes('mehendi')) {
      recommendations.push('Photography is crucial — capture the pre-wedding excitement');
      recommendations.push('Decoration and comfort matter — guests will remember the ambiance');
    }

    if (eventType === 'housewarming') {
      recommendations.push('Don\'t overlook rituals and ceremony — they\'re the heart of housewarming');
      recommendations.push('Catering should be welcoming and abundant');
    }

    // Flexibility messaging
    if (remaining > 0) {
      const flexPercentage = (remaining / (remaining + activatedCategories * 1000)) * 100;
      if (flexPercentage > 10) {
        recommendations.push(
          `You have ₹${(remaining / 100000).toFixed(1)}L flexibility — consider upgrading key areas like photography or entertainment`
        );
      }
    }

    // Guest count specific
    if (guestCount > 500) {
      recommendations.push('With 500+ guests, ensure catering vendor can handle scale and logistics');
      recommendations.push('Large venue with clear flow is critical for guest experience');
    }

    return recommendations;
  }

  /**
   * Rebalances budget when a customer changes a requirement
   * Example: Customer increases photography priority from 14% to 18%
   * The engine reallocates from non-priority categories
   */
  static rebalance(
    currentPlan: EventBudgetPlan,
    changes: Record<string, number> // { 'Photography': 90000 } means set to ₹90K
  ): EventBudgetPlan {
    const allocations = [...currentPlan.allocations];
    let adjustedTotal = 0;
    
    // Apply explicit changes
    for (const [category, newAmount] of Object.entries(changes)) {
      const idx = allocations.findIndex(a => a.category === category);
      if (idx !== -1) {
        const alloc = allocations[idx];
        // Clamp within min/max range
        const clamped = Math.max(alloc.minAmount, Math.min(alloc.maxAmount, newAmount));
        allocations[idx] = {
          ...alloc,
          allocatedAmount: clamped,
          actualPercentage: (clamped / currentPlan.totalBudget) * 100,
        };
      }
    }
    
    // Recalculate totals
    adjustedTotal = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const remaining = Math.max(0, currentPlan.totalBudget - adjustedTotal);
    
    return {
      ...currentPlan,
      allocations,
      totalAllocated: adjustedTotal,
      remaining,
    };
  }

  /**
   * Prioritizes categories based on customer preferences
   * Reallocates budget to high-priority categories
   */
  static prioritize(
    plan: EventBudgetPlan,
    priorities: Record<string, 1 | 2 | 3> // 1=low, 2=medium, 3=high
  ): EventBudgetPlan {
    // Re-rank allocations based on priorities
    const reranked = plan.allocations.map(a => {
      const newPriority = priorities[a.category];
      if (newPriority === 3) return { ...a, priority: 'high' as const };
      if (newPriority === 1) return { ...a, priority: 'low' as const };
      return { ...a, priority: 'medium' as const };
    });
    
    // Reallocate: boost high-priority, reduce low-priority
    const highPriority = reranked.filter(a => a.priority === 'high' && a.allocatedAmount > a.minAmount);
    const lowPriority = reranked.filter(a => a.priority === 'low' && a.allocatedAmount > a.minAmount);
    
    // Calculate reallocation amount (move 5-10% from low to high)
    const totalReduction = lowPriority.reduce((sum, a) => sum + (a.maxAmount - a.minAmount) * 0.1, 0);
    const perHighPriority = totalReduction / Math.max(highPriority.length, 1);
    
    const reallocated = reranked.map(a => {
      if (a.priority === 'high' && highPriority.includes(a)) {
        return {
          ...a,
          allocatedAmount: Math.min(a.maxAmount, a.allocatedAmount + perHighPriority),
        };
      }
      if (a.priority === 'low' && lowPriority.includes(a)) {
        return {
          ...a,
          allocatedAmount: Math.max(a.minAmount, a.allocatedAmount - (totalReduction / lowPriority.length)),
        };
      }
      return a;
    });
    
    return {
      ...plan,
      allocations: reallocated,
      totalAllocated: reallocated.reduce((sum, a) => sum + a.allocatedAmount, 0),
    };
  }

  /**
   * Estimates feasibility and provides optimization suggestions
   */
  static validateAndSuggest(plan: EventBudgetPlan): {
    isFeasible: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check each required category
    plan.allocations.forEach(a => {
      if (a.required && a.allocatedAmount < a.minAmount * 0.95) {
        issues.push(`${a.category} budget is below minimum (allocated ₹${(a.allocatedAmount/100000).toFixed(1)}L, needs ₹${(a.minAmount/100000).toFixed(1)}L)`);
      }
    });
    
    // Suggest optimizations
    if (plan.remaining > 0) {
      suggestions.push(`You have ₹${(plan.remaining/100000).toFixed(1)}L unallocated. Consider: higher-end photographer, better catering, or enhanced decoration.`);
    }
    
    if (plan.remaining < 0) {
      suggestions.push(`You're ₹${(-plan.remaining/100000).toFixed(1)}L over budget. Options: reduce guest count, cut non-required services, or increase total budget.`);
    }
    
    return {
      isFeasible: issues.length === 0,
      issues,
      suggestions,
    };
  }
}

// ─── Format helper for display ────────────────────────────────────────────────
export function formatBudgetAllocation(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount}`;
}
