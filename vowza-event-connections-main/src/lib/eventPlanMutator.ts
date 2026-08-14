// ─── Event Plan Mutator — Modify Plans Based on User Input ────────────────────
// Purpose: Handle user requests to modify existing plans.
// Examples:
//   - "Remove DJ" → Remove DJ service, redistribute budget
//   - "Increase photography" → Increase photography allocation, decrease others
//   - "I have more budget now" → Rebalance allocations
//
// CRITICAL: Never fabricate data. Always use real vendor/package IDs.

import type { EventBudgetPlan, BudgetAllocation, Customization } from './eventBudgetPlanner';
import type { PlannerContext } from './aiPlannerTypes';

// ─── Modification types ───────────────────────────────────────────────────────
export type ModificationType =
  | 'add_service'
  | 'remove_service'
  | 'adjust_budget'
  | 'rebalance_budget'
  | 'change_priority'
  | 'update_preferences';

export interface ModificationRequest {
  type: ModificationType;
  target: string;              // Service name or 'budget'
  value?: number;              // New amount or value
  reason?: string;
}

// ─── Detect modification intent from user message ──────────────────────────────
export function detectModificationIntent(message: string, currentPlan: EventBudgetPlan): ModificationRequest | null {
  const msgLower = message.toLowerCase();

  // ─── Remove service ──────────────────────────────────────────────────────────
  const removeMatch = msgLower.match(/(?:remove|don't need|no|without|delete|exclude|skip)\s+(?:the\s+)?(\w+)/i);
  if (removeMatch) {
    const service = removeMatch[1];
    const found = currentPlan.allocations.find(a => a.category.toLowerCase().includes(service));
    if (found) {
      return { type: 'remove_service', target: found.category };
    }
  }

  // ─── Add service ─────────────────────────────────────────────────────────────
  const addMatch = msgLower.match(/(?:add|include|want|need)\s+(?:a\s+)?(\w+)/i);
  if (addMatch) {
    const service = addMatch[1];
    const exists = currentPlan.allocations.find(a => a.category.toLowerCase().includes(service));
    if (!exists) {
      return { type: 'add_service', target: service };
    }
  }

  // ─── Prioritize service ──────────────────────────────────────────────────────
  const priorityMatch = msgLower.match(/(?:important|priority|focus|prioritize)\s+(?:on\s+)?(\w+)/i);
  if (priorityMatch) {
    const service = priorityMatch[1];
    const found = currentPlan.allocations.find(a => a.category.toLowerCase().includes(service));
    if (found) {
      return { type: 'change_priority', target: found.category };
    }
  }

  // ─── Increase budget ─────────────────────────────────────────────────────────
  const increaseMatch = msgLower.match(/increase.*?(?:budget|spend)\s+to\s+[₹]?(\d+(?:[,.](\d+))*)\s*(?:lakh|lac|l)?/i);
  if (increaseMatch) {
    let amount = parseFloat(increaseMatch[1].replace(/,/g, ''));
    if (msgLower.includes('lakh') || msgLower.includes('lac')) {
      amount *= 100000;
    }
    return { type: 'rebalance_budget', target: 'budget', value: amount };
  }

  // ─── Reduce budget ───────────────────────────────────────────────────────────
  const reduceMatch = msgLower.match(/reduce.*?(?:budget|spend)\s+to\s+[₹]?(\d+(?:[,.](\d+))*)\s*(?:lakh|lac|l)?/i);
  if (reduceMatch) {
    let amount = parseFloat(reduceMatch[1].replace(/,/g, ''));
    if (msgLower.includes('lakh') || msgLower.includes('lac')) {
      amount *= 100000;
    }
    return { type: 'rebalance_budget', target: 'budget', value: amount };
  }

  return null;
}

// ─── Remove a service from plan ──────────────────────────────────────────────
export function removeService(
  plan: EventBudgetPlan,
  serviceCategory: string
): { success: boolean; modifiedPlan: EventBudgetPlan; change: Customization; message: string } {
  const allocationIdx = plan.allocations.findIndex(a => a.category.toLowerCase() === serviceCategory.toLowerCase());

  if (allocationIdx === -1) {
    return {
      success: false,
      modifiedPlan: plan,
      change: {} as any,
      message: `Could not find **${serviceCategory}** in your current plan.`,
    };
  }

  const removed = plan.allocations[allocationIdx];
  const freedBudget = removed.allocatedAmount;

  // Create new allocations without this service
  const newAllocations = plan.allocations.filter((_, i) => i !== allocationIdx);

  // Redistribute freed budget proportionally to remaining services
  let totalRemainingBudget = newAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  if (totalRemainingBudget === 0) {
    // Edge case: only one service. Don't redistribute.
    return {
      success: true,
      modifiedPlan: {
        ...plan,
        allocations: newAllocations,
        totalAllocated: totalRemainingBudget,
        remaining: plan.totalBudget,
      },
      change: {
        timestamp: new Date(),
        userMessage: `Removed ${serviceCategory}`,
        change: `Removed ${serviceCategory} (freed ₹${(freedBudget / 1000).toFixed(0)}K)`,
        oldValue: removed.allocatedAmount,
        newValue: 0,
        impactOnBudget: -freedBudget,
        reasoning: 'User requested service removal',
      },
      message: `✓ Removed **${serviceCategory}** from your plan. Freed up ₹${(freedBudget / 1000).toFixed(0)}K.`,
    };
  }

  // Rebalance: distribute freed budget proportionally
  const rebalancedAllocations = newAllocations.map(alloc => {
    const proportion = alloc.allocatedAmount / totalRemainingBudget;
    const additionalBudget = Math.round(freedBudget * proportion);

    return {
      ...alloc,
      allocatedAmount: alloc.allocatedAmount + additionalBudget,
      actualPercentage: ((alloc.allocatedAmount + additionalBudget) / plan.totalBudget) * 100,
    };
  });

  const newTotalAllocated = rebalancedAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);

  const modifiedPlan: EventBudgetPlan = {
    ...plan,
    allocations: rebalancedAllocations,
    totalAllocated: newTotalAllocated,
    remaining: plan.totalBudget - newTotalAllocated,
    versionNumber: plan.versionNumber + 1,
  };

  return {
    success: true,
    modifiedPlan,
    change: {
      timestamp: new Date(),
      userMessage: `Removed ${serviceCategory}`,
      change: `Removed ${serviceCategory} (freed ₹${(freedBudget / 1000).toFixed(0)}K)`,
      oldValue: removed.allocatedAmount,
      newValue: 0,
      impactOnBudget: -freedBudget,
      reasoning: 'User requested service removal. Budget redistributed to remaining services.',
    },
    message: `✓ Removed **${serviceCategory}**. Freed ₹${(freedBudget / 1000).toFixed(0)}K redistributed to other services.`,
  };
}

// ─── Increase budget for a service ───────────────────────────────────────────
export function adjustServiceBudget(
  plan: EventBudgetPlan,
  serviceCategory: string,
  newAmount: number
): { success: boolean; modifiedPlan: EventBudgetPlan; change: Customization; message: string } {
  const allocationIdx = plan.allocations.findIndex(a => a.category.toLowerCase() === serviceCategory.toLowerCase());

  if (allocationIdx === -1) {
    return {
      success: false,
      modifiedPlan: plan,
      change: {} as any,
      message: `Could not find **${serviceCategory}** in your plan.`,
    };
  }

  const oldAllocation = plan.allocations[allocationIdx];
  const difference = newAmount - oldAllocation.allocatedAmount;

  // Check if total budget would be exceeded
  const newTotalAllocated = plan.totalAllocated + difference;
  if (newTotalAllocated > plan.totalBudget) {
    const overage = newTotalAllocated - plan.totalBudget;
    return {
      success: false,
      modifiedPlan: plan,
      change: {} as any,
      message: `This would exceed your budget by ₹${(overage / 1000).toFixed(0)}K. Would you like me to reduce other categories?`,
    };
  }

  // Update this allocation
  const newAllocations = plan.allocations.map((alloc, i) => {
    if (i === allocationIdx) {
      return {
        ...alloc,
        allocatedAmount: newAmount,
        actualPercentage: (newAmount / plan.totalBudget) * 100,
      };
    }
    return alloc;
  });

  const modifiedPlan: EventBudgetPlan = {
    ...plan,
    allocations: newAllocations,
    totalAllocated: newTotalAllocated,
    remaining: plan.totalBudget - newTotalAllocated,
    versionNumber: plan.versionNumber + 1,
  };

  const delta = difference > 0 ? `+₹${(difference / 1000).toFixed(0)}K` : `-₹${(-difference / 1000).toFixed(0)}K`;

  return {
    success: true,
    modifiedPlan,
    change: {
      timestamp: new Date(),
      userMessage: `Adjusted ${serviceCategory} budget`,
      change: `${serviceCategory}: ₹${(oldAllocation.allocatedAmount / 1000).toFixed(0)}K → ₹${(newAmount / 1000).toFixed(0)}K (${delta})`,
      oldValue: oldAllocation.allocatedAmount,
      newValue: newAmount,
      impactOnBudget: difference,
      reasoning: 'User requested budget adjustment',
    },
    message: `✓ Updated **${serviceCategory}** to ₹${(newAmount / 1000).toFixed(0)}K (${delta}). New total: ₹${(modifiedPlan.totalAllocated / 100000).toFixed(1)}L.`,
  };
}

// ─── Rebalance entire plan to new total budget ───────────────────────────────
export function rebalancePlanBudget(
  plan: EventBudgetPlan,
  newTotalBudget: number
): { success: boolean; modifiedPlan: EventBudgetPlan; change: Customization; message: string } {
  if (newTotalBudget <= 0) {
    return {
      success: false,
      modifiedPlan: plan,
      change: {} as any,
      message: 'Budget must be greater than 0.',
    };
  }

  if (newTotalBudget === plan.totalBudget) {
    return {
      success: false,
      modifiedPlan: plan,
      change: {} as any,
      message: `Budget is already ₹${(plan.totalBudget / 100000).toFixed(1)}L.`,
    };
  }

  // Rebalance allocations proportionally
  const factor = newTotalBudget / plan.totalBudget;
  const rebalancedAllocations = plan.allocations.map(alloc => {
    const newAmount = Math.round(alloc.allocatedAmount * factor);
    return {
      ...alloc,
      allocatedAmount: newAmount,
      actualPercentage: (newAmount / newTotalBudget) * 100,
    };
  });

  const modifiedPlan: EventBudgetPlan = {
    ...plan,
    totalBudget: newTotalBudget,
    allocations: rebalancedAllocations,
    totalAllocated: rebalancedAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0),
    remaining: newTotalBudget - rebalancedAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0),
    versionNumber: plan.versionNumber + 1,
  };

  const oldBudgetStr = (plan.totalBudget / 100000).toFixed(1);
  const newBudgetStr = (newTotalBudget / 100000).toFixed(1);
  const delta = newTotalBudget > plan.totalBudget ? `+₹${((newTotalBudget - plan.totalBudget) / 100000).toFixed(1)}L` : `-₹${((plan.totalBudget - newTotalBudget) / 100000).toFixed(1)}L`;

  return {
    success: true,
    modifiedPlan,
    change: {
      timestamp: new Date(),
      userMessage: `Changed total budget`,
      change: `Total budget: ₹${oldBudgetStr}L → ₹${newBudgetStr}L (${delta})`,
      oldValue: plan.totalBudget,
      newValue: newTotalBudget,
      impactOnBudget: newTotalBudget - plan.totalBudget,
      reasoning: 'User requested budget adjustment. All allocations rebalanced proportionally.',
    },
    message: `✓ Updated total budget to **₹${newBudgetStr}L** (${delta}). All categories rebalanced proportionally.`,
  };
}

// ─── Change priority of a service ────────────────────────────────────────────
export function setPriority(
  plan: EventBudgetPlan,
  serviceCategory: string,
  priority: 'high' | 'medium' | 'low'
): { success: boolean; modifiedPlan: EventBudgetPlan; change: Customization; message: string } {
  const allocationIdx = plan.allocations.findIndex(a => a.category.toLowerCase() === serviceCategory.toLowerCase());

  if (allocationIdx === -1) {
    return {
      success: false,
      modifiedPlan: plan,
      change: {} as any,
      message: `Could not find **${serviceCategory}** in your plan.`,
    };
  }

  const oldAllocation = plan.allocations[allocationIdx];
  const oldPriority = oldAllocation.priority;

  // Adjust budget based on priority
  let newAmount = oldAllocation.allocatedAmount;

  if (priority === 'high' && oldPriority !== 'high') {
    // Increase by 15%
    newAmount = Math.round(oldAllocation.allocatedAmount * 1.15);
  } else if (priority === 'low' && oldPriority !== 'low') {
    // Decrease by 15%
    newAmount = Math.round(oldAllocation.allocatedAmount * 0.85);
  }

  // Update allocation
  const newAllocations = plan.allocations.map((alloc, i) => {
    if (i === allocationIdx) {
      return {
        ...alloc,
        priority,
        allocatedAmount: newAmount,
        actualPercentage: (newAmount / plan.totalBudget) * 100,
      };
    }
    return alloc;
  });

  const totalAllocated = newAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);

  // Check if exceeded budget
  if (totalAllocated > plan.totalBudget) {
    return {
      success: false,
      modifiedPlan: plan,
      change: {} as any,
      message: `Making **${serviceCategory}** ${priority} would exceed your budget. Would you like me to reduce other services?`,
    };
  }

  const modifiedPlan: EventBudgetPlan = {
    ...plan,
    allocations: newAllocations,
    totalAllocated,
    remaining: plan.totalBudget - totalAllocated,
    versionNumber: plan.versionNumber + 1,
  };

  const delta = newAmount > oldAllocation.allocatedAmount ? `+₹${((newAmount - oldAllocation.allocatedAmount) / 1000).toFixed(0)}K` : `-₹${((oldAllocation.allocatedAmount - newAmount) / 1000).toFixed(0)}K`;

  return {
    success: true,
    modifiedPlan,
    change: {
      timestamp: new Date(),
      userMessage: `Set ${serviceCategory} priority to ${priority}`,
      change: `${serviceCategory} priority: ${oldPriority} → ${priority}`,
      oldValue: oldAllocation.allocatedAmount,
      newValue: newAmount,
      impactOnBudget: newAmount - oldAllocation.allocatedAmount,
      reasoning: `User prioritized ${serviceCategory}. Budget adjusted ${delta}.`,
    },
    message: `✓ **${serviceCategory}** is now **${priority} priority**. Budget adjusted to ₹${(newAmount / 1000).toFixed(0)}K (${delta}).`,
  };
}

// ─── Format modification response for display ────────────────────────────────
export function formatModificationResponse(
  originalPlan: EventBudgetPlan,
  modifiedPlan: EventBudgetPlan,
  message: string
): string {
  let response = `${message}\n`;

  // Show before/after summary if feasibility changed
  if (originalPlan.isFeasible !== modifiedPlan.isFeasible) {
    if (modifiedPlan.isFeasible) {
      response += `\n✅ **Plan is now feasible** within your ₹${(modifiedPlan.totalBudget / 100000).toFixed(1)}L budget.\n`;
    } else {
      const overage = modifiedPlan.totalAllocated - modifiedPlan.totalBudget;
      response += `\n⚠️ **Budget exceeded by ₹${(overage / 1000).toFixed(0)}K**. Would you like me to suggest trade-offs?\n`;
    }
  }

  // Show allocation changes
  if (modifiedPlan.allocations.length > 0) {
    response += '\n### Updated Allocation\n\n';
    response += '| Category | Budget | % |\n|----------|--------|---|\n';

    for (const alloc of modifiedPlan.allocations) {
      response += `| ${alloc.category} | ₹${(alloc.allocatedAmount / 1000).toFixed(0)}K | ${alloc.actualPercentage.toFixed(1)}% |\n`;
    }

    response += `\n**Total:** ₹${(modifiedPlan.totalAllocated / 100000).toFixed(1)}L / ₹${(modifiedPlan.totalBudget / 100000).toFixed(1)}L | **Remaining:** ₹${(modifiedPlan.remaining / 1000).toFixed(0)}K\n`;
  }

  return response;
}

