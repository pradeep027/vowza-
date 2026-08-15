// ─── Budget Conflict Detection & Trade-Off Engine ────────────────────────────
// Extends EventBudgetPlanner with:
// 1. Conflict Detection: Identifies budget exceedances and feasibility issues
// 2. Trade-Off Generation: Suggests actionable alternatives when conflicts occur
// 3. Constraint Satisfaction: Respects min/max ranges and priority constraints
//
// Integrates with EventPlan for detecting modifications that cause conflicts

import type { EventBudgetPlan, BudgetAllocation } from './eventBudgetPlanner';
import type { EventPlan, EventService } from '@/contexts/EventPlanContext';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface BudgetConflict {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affectedCategories: string[];
  detectedAt: Date;
  suggestedResolutions: BudgetTradeOff[];
}

export interface BudgetTradeOff {
  id: string;
  label: string;
  description: string;
  actions: TradeOffAction[];
  totalSavings: number;
  impact: {
    categories: string[];
    qualityDegradation: 'none' | 'minimal' | 'moderate' | 'significant';
    feasibilityScore: number; // 0-100, higher is better
  };
}

export interface TradeOffAction {
  type: 'reduce' | 'remove' | 'upgrade' | 'downgrade' | 'shift_budget';
  category: string;
  amount: number;
  reasoning: string;
}

export interface BudgetHealthMetrics {
  totalBudget: number;
  allocated: number;
  remaining: number;
  percentageAllocated: number;
  exceededAmount: number;
  hasConflicts: boolean;
  conflicts: BudgetConflict[];
  feasibilityScore: number; // 0-100
}

// ─── Priority-weighted categories (higher = more important to maintain) ────────
const CATEGORY_IMPORTANCE: Record<string, number> = {
  'Venue': 95,
  'Catering': 90,
  'Photography': 85,
  'Decoration': 75,
  'Music/DJ/Band': 65,
  'Videography': 60,
  'Makeup & Hair': 70,
  'Flowers': 50,
  'Cake': 55,
  'Contingency & Misc': 20,
};

// ─── Budget Conflict Detector ─────────────────────────────────────────────────
export class BudgetConflictDetector {
  /**
   * Analyzes a budget plan for conflicts
   * Returns: conflicts array, health metrics, feasibility score
   */
  static detectConflicts(plan: EventBudgetPlan): BudgetConflict[] {
    const conflicts: BudgetConflict[] = [];

    // ── Check 1: Total exceeds budget ──────────────────────────────────────
    if (plan.totalAllocated > plan.totalBudget) {
      const gap = plan.totalAllocated - plan.totalBudget;
      conflicts.push({
        id: `conflict-budget-exceeded-${Date.now()}`,
        severity: 'critical',
        title: 'Budget Exceeded',
        description: `Your allocations total ₹${(plan.totalAllocated/100000).toFixed(1)}L but your budget is ₹${(plan.totalBudget/100000).toFixed(1)}L. Difference: ₹${(gap/100000).toFixed(1)}L.`,
        affectedCategories: plan.allocations.map(a => a.category),
        detectedAt: new Date(),
        suggestedResolutions: [],
      });
    }

    // ── Check 2: Required categories below minimum ─────────────────────────
    const underfundedRequired = plan.allocations.filter(
      a => a.required && a.allocatedAmount < a.minAmount * 0.95
    );
    if (underfundedRequired.length > 0) {
      conflicts.push({
        id: `conflict-underfunded-${Date.now()}`,
        severity: 'warning',
        title: 'Critical Categories Underfunded',
        description: `${underfundedRequired.length} essential service(s) have insufficient budget: ${underfundedRequired.map(a => a.category).join(', ')}.`,
        affectedCategories: underfundedRequired.map(a => a.category),
        detectedAt: new Date(),
        suggestedResolutions: [],
      });
    }

    // ── Check 3: Excessive allocation to low-priority items ───────────────
    const excessLowPriority = plan.allocations.filter(
      a => a.priority === 'low' && a.allocatedAmount > a.maxAmount * 0.9
    );
    if (excessLowPriority.length > 0 && plan.remaining < 0) {
      conflicts.push({
        id: `conflict-excess-low-priority-${Date.now()}`,
        severity: 'warning',
        title: 'Over-allocation to Low-Priority Items',
        description: `Low-priority categories are consuming significant budget while you're over budget. Consider reallocating.`,
        affectedCategories: excessLowPriority.map(a => a.category),
        detectedAt: new Date(),
        suggestedResolutions: [],
      });
    }

    // ── Check 4: Feasibility based on guest count ─────────────────────────
    const perGuestSpending = plan.totalBudget / plan.guestCount;
    const reasonablePerGuest = 1500; // Rough base for standard event
    if (perGuestSpending < reasonablePerGuest * 0.7) {
      conflicts.push({
        id: `conflict-tight-per-guest-${Date.now()}`,
        severity: 'warning',
        title: 'Tight Per-Guest Budget',
        description: `Your per-guest spending is ₹${perGuestSpending.toFixed(0)} which may limit quality. Consider increasing budget or reducing guest count.`,
        affectedCategories: [],
        detectedAt: new Date(),
        suggestedResolutions: [],
      });
    }

    return conflicts;
  }

  /**
   * Calculates comprehensive budget health metrics
   */
  static calculateHealth(plan: EventBudgetPlan): BudgetHealthMetrics {
    const conflicts = this.detectConflicts(plan);
    const exceededAmount = Math.max(0, plan.totalAllocated - plan.totalBudget);
    const percentageAllocated = (plan.totalAllocated / plan.totalBudget) * 100;

    // Feasibility score: 100 = perfect, 0 = infeasible
    let feasibilityScore = 100;
    if (exceededAmount > 0) feasibilityScore -= Math.min(50, (exceededAmount / plan.totalBudget) * 100);
    const underfundedRequired = plan.allocations.filter(a => a.required && a.allocatedAmount < a.minAmount * 0.95).length;
    feasibilityScore -= underfundedRequired * 10;

    return {
      totalBudget: plan.totalBudget,
      allocated: plan.totalAllocated,
      remaining: plan.remaining,
      percentageAllocated,
      exceededAmount,
      hasConflicts: conflicts.length > 0,
      conflicts,
      feasibilityScore: Math.max(0, feasibilityScore),
    };
  }
}

// ─── Trade-Off Optimizer (generates alternatives for conflicts) ──────────────
export class TradeOffOptimizer {
  /**
   * Generates trade-off options when budget is exceeded
   * Returns: ranked list of alternatives
   */
  static generateTradeOffs(
    plan: EventBudgetPlan,
    targetAmount?: number // If not provided, use zero remaining
  ): BudgetTradeOff[] {
    const target = targetAmount ?? plan.totalBudget;
    const gap = plan.totalAllocated - target;

    if (gap <= 0) {
      return []; // No need for trade-offs
    }

    const tradeOffs: BudgetTradeOff[] = [];

    // ── Option 1: Reduce low-priority optional categories ────────────────
    {
      const lowPriorityOptional = plan.allocations.filter(
        a => (a.priority === 'low' || !a.required) && a.allocatedAmount > a.minAmount
      );

      let totalReduction = 0;
      const actions: TradeOffAction[] = [];

      for (const alloc of lowPriorityOptional) {
        if (totalReduction >= gap * 0.95) break;
        const maxReduction = alloc.allocatedAmount - alloc.minAmount;
        const reduction = Math.min(maxReduction, gap - totalReduction);
        if (reduction > 100) {
          actions.push({
            type: 'reduce',
            category: alloc.category,
            amount: reduction,
            reasoning: `Reduce ${alloc.category} from ₹${(alloc.allocatedAmount/100000).toFixed(1)}L to ₹${((alloc.allocatedAmount - reduction)/100000).toFixed(1)}L`,
          });
          totalReduction += reduction;
        }
      }

      if (totalReduction > 0) {
        tradeOffs.push({
          id: `tradeoff-reduce-low-priority-${Date.now()}`,
          label: 'Reduce Low-Priority Items',
          description: `Trim non-essential spending on decorative and entertainment elements while maintaining core services.`,
          actions,
          totalSavings: totalReduction,
          impact: {
            categories: actions.map(a => a.category),
            qualityDegradation: totalReduction > gap * 1.2 ? 'moderate' : 'minimal',
            feasibilityScore: 85,
          },
        });
      }
    }

    // ── Option 2: Reduce medium-priority items ────────────────────────────
    {
      const mediumPriority = plan.allocations.filter(
        a => a.priority === 'medium' && a.allocatedAmount > a.minAmount * 1.1
      );

      let totalReduction = 0;
      const actions: TradeOffAction[] = [];

      for (const alloc of mediumPriority) {
        if (totalReduction >= gap * 0.9) break;
        const maxReduction = alloc.allocatedAmount - alloc.minAmount;
        const reduction = Math.min(maxReduction, (gap - totalReduction) / 2);
        if (reduction > 100) {
          actions.push({
            type: 'downgrade',
            category: alloc.category,
            amount: reduction,
            reasoning: `Choose mid-tier ${alloc.category} instead of premium option`,
          });
          totalReduction += reduction;
        }
      }

      if (totalReduction > 0) {
        tradeOffs.push({
          id: `tradeoff-downgrade-medium-${Date.now()}`,
          label: 'Downgrade Medium-Priority Services',
          description: `Choose mid-tier options for services like photography and decoration instead of premium packages.`,
          actions,
          totalSavings: totalReduction,
          impact: {
            categories: actions.map(a => a.category),
            qualityDegradation: 'moderate',
            feasibilityScore: 70,
          },
        });
      }
    }

    // ── Option 3: Remove optional services entirely ───────────────────────
    {
      const optionalServices = plan.allocations.filter(a => !a.required && a.minAmount === 0);

      let totalReduction = 0;
      const actions: TradeOffAction[] = [];

      for (const alloc of optionalServices) {
        if (totalReduction >= gap) break;
        actions.push({
          type: 'remove',
          category: alloc.category,
          amount: alloc.allocatedAmount,
          reasoning: `Skip ${alloc.category} entirely — it's optional for your event`,
        });
        totalReduction += alloc.allocatedAmount;
      }

      if (totalReduction > 0) {
        tradeOffs.push({
          id: `tradeoff-remove-optional-${Date.now()}`,
          label: 'Remove Optional Services',
          description: `Cut videography, DJ, or other non-essential services to fit budget.`,
          actions,
          totalSavings: totalReduction,
          impact: {
            categories: actions.map(a => a.category),
            qualityDegradation: totalReduction >= gap ? 'significant' : 'moderate',
            feasibilityScore: 65,
          },
        });
      }
    }

    // ── Option 4: Increase total budget ──────────────────────────────────
    if (gap > 0) {
      tradeOffs.push({
        id: `tradeoff-increase-budget-${Date.now()}`,
        label: 'Increase Total Budget',
        description: `Allocate an additional ₹${(gap/100000).toFixed(1)}L to accommodate all services at planned levels.`,
        actions: [
          {
            type: 'upgrade',
            category: 'Total Budget',
            amount: gap,
            reasoning: `Increase from ₹${(target/100000).toFixed(1)}L to ₹${(plan.totalBudget/100000).toFixed(1)}L`,
          },
        ],
        totalSavings: 0, // No savings, but feasibility improves
        impact: {
          categories: [],
          qualityDegradation: 'none',
          feasibilityScore: 95,
        },
      });
    }

    // ── Option 5: Reduce guest count ──────────────────────────────────────
    {
      const perGuestCost = plan.totalAllocated / plan.guestCount;
      const newGuestCount = Math.floor((plan.totalBudget / perGuestCost) * 0.95); // 95% to maintain quality
      if (newGuestCount < plan.guestCount * 0.8) {
        // Only suggest if reducing by <20%
        const savings = (plan.guestCount - newGuestCount) * perGuestCost;
        tradeOffs.push({
          id: `tradeoff-reduce-guests-${Date.now()}`,
          label: 'Reduce Guest Count',
          description: `Reduce from ${plan.guestCount} to ~${newGuestCount} guests to fit budget while maintaining quality.`,
          actions: [
            {
              type: 'shift_budget',
              category: 'Guest Count',
              amount: newGuestCount,
              reasoning: `Smaller, more intimate event reduces per-category costs`,
            },
          ],
          totalSavings: savings,
          impact: {
            categories: plan.allocations.map(a => a.category),
            qualityDegradation: 'none',
            feasibilityScore: 80,
          },
        });
      }
    }

    // Sort by feasibility score (best first)
    return tradeOffs.sort((a, b) => b.impact.feasibilityScore - a.impact.feasibilityScore);
  }

  /**
   * Applies a trade-off option to a budget plan
   */
  static applyTradeOff(plan: EventBudgetPlan, tradeOff: BudgetTradeOff): EventBudgetPlan {
    const newAllocations = [...plan.allocations];

    for (const action of tradeOff.actions) {
      if (action.type === 'remove') {
        // Find and remove the allocation
        const idx = newAllocations.findIndex(a => a.category === action.category);
        if (idx !== -1) {
          newAllocations[idx] = {
            ...newAllocations[idx],
            allocatedAmount: 0,
            actualPercentage: 0,
          };
        }
      } else if (action.type === 'reduce') {
        const idx = newAllocations.findIndex(a => a.category === action.category);
        if (idx !== -1) {
          const newAmount = Math.max(newAllocations[idx].minAmount, newAllocations[idx].allocatedAmount - action.amount);
          newAllocations[idx] = {
            ...newAllocations[idx],
            allocatedAmount: newAmount,
            actualPercentage: (newAmount / plan.totalBudget) * 100,
          };
        }
      } else if (action.type === 'downgrade') {
        const idx = newAllocations.findIndex(a => a.category === action.category);
        if (idx !== -1) {
          newAllocations[idx] = {
            ...newAllocations[idx],
            allocatedAmount: newAllocations[idx].allocatedAmount - action.amount,
            actualPercentage: ((newAllocations[idx].allocatedAmount - action.amount) / plan.totalBudget) * 100,
          };
        }
      }
    }

    const totalAllocated = newAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);

    return {
      ...plan,
      allocations: newAllocations,
      totalAllocated,
      remaining: plan.totalBudget - totalAllocated,
    };
  }

  /**
   * Estimates the budget gap in a plan
   */
  static estimateBudgetGap(plan: EventBudgetPlan): { gap: number; message: string } {
    const gap = Math.max(0, plan.totalAllocated - plan.totalBudget);

    if (gap === 0) {
      return {
        gap: 0,
        message: '✅ **Budget Balanced** — Your allocations fit within budget.',
      };
    }

    return {
      gap,
      message: `⚠️ **Budget Exceeded by ₹${(gap/100000).toFixed(1)}L** — Total allocations (₹${(plan.totalAllocated/100000).toFixed(1)}L) exceed your budget (₹${(plan.totalBudget/100000).toFixed(1)}L).`,
    };
  }
}

// ─── Format trade-off for display ──────────────────────────────────────────
export function formatTradeOffForDisplay(tradeOff: BudgetTradeOff): string {
  const header = `\n### 🔄 ${tradeOff.label}\n${tradeOff.description}\n`;
  const actions = tradeOff.actions
    .map(a => `- **${a.type === 'remove' ? 'Remove' : a.type === 'reduce' ? 'Reduce' : 'Downgrade'} ${a.category}**: ₹${(a.amount/100000).toFixed(1)}L — ${a.reasoning}`)
    .join('\n');
  const savings = tradeOff.totalSavings > 0 ? `\n**Total Savings: ₹${(tradeOff.totalSavings/100000).toFixed(1)}L**` : '';
  const impact = `\n**Impact**: ${tradeOff.impact.qualityDegradation} quality degradation | Feasibility: ${tradeOff.impact.feasibilityScore}%`;

  return header + actions + savings + impact;
}

export function formatConflictForDisplay(conflict: BudgetConflict): string {
  const severity = conflict.severity === 'critical' ? '🚨' : '⚠️';
  return `${severity} **${conflict.title}** — ${conflict.description}`;
}
