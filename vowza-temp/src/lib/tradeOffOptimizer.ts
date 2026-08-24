// ─── Trade-Off Optimizer — Generate Budget Optimization Alternatives ────────
// Purpose: When a plan exceeds budget, generate realistic trade-off options.
// Examples:
//   - User's requirements exceed budget
//   - AI suggests: "Option A: Reduce decoration", "Option B: Choose silver package"
//   - User chooses Option A
//   - AI applies it and shows new plan

import type { EventBudgetPlan, TradeOffOption, BudgetAllocation } from './aiPlannerTypes';

// ─── Trade-off strategy ──────────────────────────────────────────────────────
interface TradeOffStrategy {
  name: string;
  description: string;
  action: (plan: EventBudgetPlan) => EventBudgetPlan | null;
  savings: (plan: EventBudgetPlan) => number;
  reasoning: string;
}

// ─── Strategy: Reduce luxury/premium tier ────────────────────────────────────
function strategyReduceFromPremium(plan: EventBudgetPlan): EventBudgetPlan | null {
  // Find highest-value allocations and reduce by tier
  const sorted = [...plan.allocations].sort((a, b) => b.allocatedAmount - a.allocatedAmount);
  if (sorted.length === 0) return null;

  const targetAlloc = sorted[0];
  const reduction = Math.round(targetAlloc.allocatedAmount * 0.15); // 15% reduction

  const modified = plan.allocations.map(a =>
    a.category === targetAlloc.category
      ? { ...a, allocatedAmount: a.allocatedAmount - reduction }
      : a
  );

  return {
    ...plan,
    allocations: modified,
    totalAllocated: plan.totalAllocated - reduction,
    remaining: plan.totalBudget - (plan.totalAllocated - reduction),
  };
}

// ─── Strategy: Remove lowest-priority optional service ───────────────────────
function strategyRemoveOptional(plan: EventBudgetPlan): EventBudgetPlan | null {
  // Find services that could be optional (DJ, entertainment, etc.)
  const optionalCategories = ['DJ', 'Band', 'Entertainment', 'Extra Photography'];
  const optional = plan.allocations.find(a =>
    optionalCategories.some(cat => a.category.toLowerCase().includes(cat.toLowerCase()))
  );

  if (!optional) return null;

  const modified = plan.allocations.filter(a => a.category !== optional.category);

  return {
    ...plan,
    allocations: modified,
    totalAllocated: plan.totalAllocated - optional.allocatedAmount,
    remaining: plan.totalBudget - (plan.totalAllocated - optional.allocatedAmount),
  };
}

// ─── Strategy: Reduce non-essentials (decoration, makeup) ────────────────────
function strategyReduceNonEssentials(plan: EventBudgetPlan): EventBudgetPlan | null {
  const nonEssentials = ['Decoration', 'Makeup', 'Entertainment'];
  let totalSavings = 0;

  const modified = plan.allocations.map(a => {
    const isNonEssential = nonEssentials.some(cat => a.category.toLowerCase().includes(cat.toLowerCase()));

    if (isNonEssential) {
      const reduction = Math.round(a.allocatedAmount * 0.2); // 20% reduction
      totalSavings += reduction;
      return { ...a, allocatedAmount: a.allocatedAmount - reduction };
    }

    return a;
  });

  if (totalSavings === 0) return null;

  return {
    ...plan,
    allocations: modified,
    totalAllocated: plan.totalAllocated - totalSavings,
    remaining: plan.totalBudget - (plan.totalAllocated - totalSavings),
  };
}

// ─── Strategy: Reduce guest-count-dependent costs ───────────────────────────
function strategyReduceCateringPerPlate(plan: EventBudgetPlan): EventBudgetPlan | null {
  const catering = plan.allocations.find(a => a.category.toLowerCase().includes('catering'));
  if (!catering) return null;

  // Assume 20% reduction in catering (cheaper per-plate option)
  const reduction = Math.round(catering.allocatedAmount * 0.2);

  const modified = plan.allocations.map(a =>
    a.category === catering.category
      ? { ...a, allocatedAmount: a.allocatedAmount - reduction }
      : a
  );

  return {
    ...plan,
    allocations: modified,
    totalAllocated: plan.totalAllocated - reduction,
    remaining: plan.totalBudget - (plan.totalAllocated - reduction),
  };
}

// ─── Strategy: Combine multiple small reductions ────────────────────────────
function strategyCombinedSmallReductions(plan: EventBudgetPlan): EventBudgetPlan | null {
  const nonEssentials = ['Decoration', 'DJ', 'Entertainment'];
  let totalSavings = 0;

  const modified = plan.allocations.map(a => {
    const isNonEssential = nonEssentials.some(cat => a.category.toLowerCase().includes(cat.toLowerCase()));

    if (isNonEssential && a.allocatedAmount > 20000) {
      const reduction = Math.round(a.allocatedAmount * 0.15); // 15% from each
      totalSavings += reduction;
      return { ...a, allocatedAmount: a.allocatedAmount - reduction };
    }

    return a;
  });

  if (totalSavings === 0) return null;

  return {
    ...plan,
    allocations: modified,
    totalAllocated: plan.totalAllocated - totalSavings,
    remaining: plan.totalBudget - (plan.totalAllocated - totalSavings),
  };
}

// ─── Generate trade-off options ───────────────────────────────────────────────
export function generateTradeOffOptions(plan: EventBudgetPlan, targetBudget?: number): TradeOffOption[] {
  const neededReduction = targetBudget ? plan.totalAllocated - targetBudget : plan.totalAllocated - plan.totalBudget;

  if (neededReduction <= 0) {
    return []; // No trade-offs needed
  }

  const strategies: TradeOffStrategy[] = [
    {
      name: 'Option A',
      description: 'Reduce premium tier selections',
      action: strategyReduceFromPremium,
      savings: plan => {
        const result = strategyReduceFromPremium(plan);
        return result ? plan.totalAllocated - result.totalAllocated : 0;
      },
      reasoning: 'Choose standard tier packages instead of premium',
    },
    {
      name: 'Option B',
      description: 'Skip optional services',
      action: strategyRemoveOptional,
      savings: plan => {
        const result = strategyRemoveOptional(plan);
        return result ? plan.totalAllocated - result.totalAllocated : 0;
      },
      reasoning: 'Remove non-essential services like DJ or extra photography',
    },
    {
      name: 'Option C',
      description: 'Reduce decoration & entertainment',
      action: strategyReduceNonEssentials,
      savings: plan => {
        const result = strategyReduceNonEssentials(plan);
        return result ? plan.totalAllocated - result.totalAllocated : 0;
      },
      reasoning: 'Cut back on decoration, makeup, and entertainment costs',
    },
    {
      name: 'Option D',
      description: 'Reduce catering per-plate',
      action: strategyReduceCateringPerPlate,
      savings: plan => {
        const result = strategyReduceCateringPerPlate(plan);
        return result ? plan.totalAllocated - result.totalAllocated : 0;
      },
      reasoning: 'Choose a more economical catering package',
    },
    {
      name: 'Option E',
      description: 'Combination: multiple small cuts',
      action: strategyCombinedSmallReductions,
      savings: plan => {
        const result = strategyCombinedSmallReductions(plan);
        return result ? plan.totalAllocated - result.totalAllocated : 0;
      },
      reasoning: 'Reduce multiple non-essential services by 15% each',
    },
  ];

  const results: TradeOffOption[] = [];

  for (const strategy of strategies) {
    const modified = strategy.action(plan);
    if (!modified) continue;

    const savings = strategy.savings(plan);
    if (savings <= 0) continue; // Skip if no savings

    results.push({
      label: strategy.name,
      description: strategy.description,
      changes: strategy.description.split('\n').filter(c => c.length > 0),
      savingsAmount: savings,
      newTotalBudget: plan.totalAllocated - savings,
      reasoning: strategy.reasoning,
    });
  }

  // Sort by savings (descending)
  results.sort((a, b) => b.savingsAmount - a.savingsAmount);

  // Return top 3 options
  return results.slice(0, 3);
}

// ─── Format trade-off options for display ────────────────────────────────────
export function formatTradeOffResponse(options: TradeOffOption[], currentPlan: EventBudgetPlan): string {
  if (options.length === 0) {
    return '';
  }

  const shortage = currentPlan.totalAllocated - currentPlan.totalBudget;

  let response = `\n⚠️ **Budget Challenge**: Your current plan exceeds budget by **₹${(shortage / 1000).toFixed(0)}K**.\n\n`;
  response += `### 💡 Budget Optimization Options\n\n`;

  for (const option of options) {
    const newTotal = currentPlan.totalBudget; // All bring back to target
    response += `**${option.label}** — ${option.description}\n`;
    response += `💰 Saves: **₹${(option.savingsAmount / 1000).toFixed(0)}K** (${((option.savingsAmount / shortage) * 100).toFixed(0)}% of gap)\n`;
    response += `📋 Action: ${option.reasoning}\n`;
    response += `📊 New Total: **₹${(newTotal / 100000).toFixed(1)}L**\n\n`;
  }

  response += `Which option would you prefer? (Say "Option A", "Option B", etc., or I can suggest combinations)\n`;

  return response;
}

// ─── Apply a specific trade-off option ────────────────────────────────────────
export function applyTradeOff(plan: EventBudgetPlan, optionLabel: string): { success: boolean; modifiedPlan: EventBudgetPlan | null; message: string } {
  const strategies: Record<string, (p: EventBudgetPlan) => EventBudgetPlan | null> = {
    'Option A': strategyReduceFromPremium,
    'Option B': strategyRemoveOptional,
    'Option C': strategyReduceNonEssentials,
    'Option D': strategyReduceCateringPerPlate,
    'Option E': strategyCombinedSmallReductions,
  };

  const strategy = strategies[optionLabel];
  if (!strategy) {
    return {
      success: false,
      modifiedPlan: null,
      message: `Unknown option: ${optionLabel}. Please choose from A, B, C, D, or E.`,
    };
  }

  const modified = strategy(plan);
  if (!modified) {
    return {
      success: false,
      modifiedPlan: null,
      message: `Could not apply ${optionLabel} to this plan.`,
    };
  }

  const savings = plan.totalAllocated - modified.totalAllocated;

  return {
    success: true,
    modifiedPlan: {
      ...modified,
      versionNumber: plan.versionNumber + 1,
    },
    message: `✓ Applied **${optionLabel}**. Saved **₹${(savings / 1000).toFixed(0)}K**. New total: **₹${(modified.totalAllocated / 100000).toFixed(1)}L**.`,
  };
}

// ─── Estimate what budget reduction a customer might want ────────────────────
export function estimateBudgetGap(plan: EventBudgetPlan): { gap: number; percentage: number; message: string } {
  const gap = plan.totalAllocated - plan.totalBudget;
  const percentage = (gap / plan.totalBudget) * 100;

  let message = '';
  if (percentage <= 5) {
    message = 'Very close to budget. Minor adjustments might bring it in line.';
  } else if (percentage <= 15) {
    message = `Over budget by about ${percentage.toFixed(0)}%. A few small reductions would help.`;
  } else if (percentage <= 30) {
    message = `Over budget by about ${percentage.toFixed(0)}%. Moderate adjustments recommended.`;
  } else {
    message = `Significantly over budget (${percentage.toFixed(0)}%). Consider major changes or increasing budget.`;
  }

  return { gap, percentage, message };
}

