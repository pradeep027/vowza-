// ─── Event Intelligence Orchestrator ──────────────────────────────────────────
// Integrates all Event Intelligence Engine components into a cohesive system.
// Handles: plan generation, modification detection, what-if simulations,
// impact analysis, and comprehensive reporting.

import { EventBudgetPlanner, type EventBudgetPlan } from './eventBudgetPlanner';
import { BudgetConflictDetector, TradeOffOptimizer } from './budgetConflictEngine';
import { DependencyAnalyzer } from './eventDependencyEngine';
import { EventTimelineEngine } from './eventTimelineEngine';
import { EventRiskDetector } from './eventRiskDetector';
import { EventHealthScoreCalculator } from './eventHealthScore';
import type { EventPlan, WhatIfSimulation } from '@/contexts/EventPlanContext';
import type { PlannerContext } from './aiPlannerTypes';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PlanGenerationResult {
  plan: EventPlan;
  budget: EventBudgetPlan;
  timeline: any[];
  risks: any[];
  health: any;
  recommendations: string[];
}

export interface PlanModificationAnalysis {
  changes: Array<{ field: string; oldValue: any; newValue: any }>;
  dependencies: any[];
  conflicts: any[];
  budgetImpact: number;
  timelineImpact: number;
  requiresConfirmation: boolean;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────
export class EventIntelligenceOrchestrator {
  /**
   * Generates a comprehensive event plan from context
   */
  static generateFullPlan(context: PlannerContext): PlanGenerationResult | null {
    // Check minimum requirements
    if (!context.eventType || !context.budget || !context.guestCount) {
      return null; // Insufficient context
    }

    // 1. Generate budget allocation
    const budget = EventBudgetPlanner.allocate(context);

    // 2. Create event plan structure
    const plan: EventPlan = {
      id: `plan-${Date.now()}`,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      eventType: context.eventType,
      location: context.city,
      eventDate: context.eventDate ? new Date(context.eventDate) : undefined,
      guestCount: context.guestCount,
      totalBudget: context.budget,
      allocatedBudget: budget.totalAllocated,
      remainingBudget: budget.remaining,
      luxuryLevel: context.luxuryLevel || 'standard',
      services: budget.allocations.map(alloc => ({
        id: `svc-${alloc.category.replace(/\s+/g, '-').toLowerCase()}`,
        category: alloc.category,
        name: alloc.category,
        priority: alloc.priority,
        estimatedCost: alloc.allocatedAmount,
        allocatedBudget: alloc.allocatedAmount,
        status: alloc.required ? 'required' : 'optional',
      })),
      selectedVendors: [],
      excludedServices: [],
      priorities: new Map(),
      timeline: [],
      risks: [],
      riskScore: 0,
      healthScore: 0,
      completionPercentage: 0,
      planStatus: 'draft',
      modifications: [],
      recommendations: budget.recommendations,
    };

    // 3. Generate timeline
    const timeline = EventTimelineEngine.generateTimeline(plan);
    plan.timeline = timeline;

    // 4. Detect risks
    const risks = EventRiskDetector.detectAllRisks(plan, budget);
    plan.risks = risks.map(r => ({
      id: r.id,
      severity: r.severity,
      title: r.title,
      description: r.description,
      affectedServices: r.affectedAreas,
      mitigationStrategy: r.mitigationStrategy,
      detectedAt: new Date(),
    }));

    const riskSummary = EventRiskDetector.calculateRiskSummary(risks);
    plan.riskScore = riskSummary.overallRiskScore;

    // 5. Calculate health score
    const health = EventHealthScoreCalculator.calculateHealth(plan, budget);
    plan.healthScore = health.overallScore;
    plan.completionPercentage = health.completionPercentage;

    return {
      plan,
      budget,
      timeline,
      risks,
      health,
      recommendations: [
        ...budget.recommendations,
        ...health.priorityActions,
      ],
    };
  }

  /**
   * Analyzes impact of a planned modification before applying it
   */
  static analyzeModification(
    currentPlan: EventPlan,
    changes: Record<string, any>
  ): PlanModificationAnalysis {
    const changesList = Object.entries(changes).map(([field, newValue]) => ({
      field,
      oldValue: (currentPlan as any)[field],
      newValue,
    }));

    // Analyze dependencies
    const dependencies = changesList
      .map(change => DependencyAnalyzer.analyzeChange(change, currentPlan))
      .filter(Boolean);

    // Detect conflicts
    const conflicts = DependencyAnalyzer.detectConflicts(currentPlan);

    // Estimate budget impact
    let budgetImpact = 0;
    if ('totalBudget' in changes) {
      budgetImpact = changes.totalBudget - currentPlan.totalBudget;
    }

    // Estimate timeline impact
    let timelineImpact = 0;
    if ('eventDate' in changes && currentPlan.eventDate) {
      const oldDate = new Date(currentPlan.eventDate).getTime();
      const newDate = new Date(changes.eventDate).getTime();
      timelineImpact = Math.floor((newDate - oldDate) / (1000 * 60 * 60 * 24));
    }

    // Determine if confirmation needed
    const requiresConfirmation =
      dependencies.length > 0 &&
      dependencies.some(d => d && (d.severity === 'high' || d.affectedServices.length > 2));

    return {
      changes: changesList,
      dependencies,
      conflicts,
      budgetImpact,
      timelineImpact,
      requiresConfirmation,
    };
  }

  /**
   * Applies a modification to the plan after analysis
   */
  static applyModification(
    plan: EventPlan,
    changes: Record<string, any>,
    budget: EventBudgetPlan
  ): { plan: EventPlan; budget: EventBudgetPlan; health: any } {
    const updatedPlan = { ...plan, ...changes, updatedAt: new Date() };

    // If budget changed, rebalance
    let updatedBudget = budget;
    if ('totalBudget' in changes) {
      updatedBudget = {
        ...budget,
        totalBudget: changes.totalBudget,
        remaining: changes.totalBudget - budget.totalAllocated,
      };
    }

    // Regenerate timeline if date changed
    if ('eventDate' in changes) {
      updatedPlan.timeline = EventTimelineEngine.generateTimeline(updatedPlan);
    }

    // Recalculate risks
    const risks = EventRiskDetector.detectAllRisks(updatedPlan, updatedBudget);
    updatedPlan.risks = risks.map(r => ({
      id: r.id,
      severity: r.severity,
      title: r.title,
      description: r.description,
      affectedServices: r.affectedAreas,
      mitigationStrategy: r.mitigationStrategy,
      detectedAt: new Date(),
    }));

    const riskSummary = EventRiskDetector.calculateRiskSummary(risks);
    updatedPlan.riskScore = riskSummary.overallRiskScore;

    // Recalculate health
    const health = EventHealthScoreCalculator.calculateHealth(updatedPlan, updatedBudget);
    updatedPlan.healthScore = health.overallScore;
    updatedPlan.completionPercentage = health.completionPercentage;

    return { plan: updatedPlan, budget: updatedBudget, health };
  }

  /**
   * Generates what-if simulation scenarios
   */
  static generateWhatIfSimulation(
    plan: EventPlan,
    budget: EventBudgetPlan,
    scenario: string
  ): WhatIfSimulation | null {
    const changeMap: Record<string, Record<string, any>> = {
      'increase_guests_25': { guestCount: Math.round(plan.guestCount * 1.25) },
      'reduce_guests_25': { guestCount: Math.round(plan.guestCount * 0.75) },
      'increase_budget_20': { totalBudget: Math.round(plan.totalBudget * 1.2) },
      'reduce_budget_20': { totalBudget: Math.round(plan.totalBudget * 0.8) },
      'upgrade_photography': { 'Photography': Math.round(plan.totalBudget * 0.18) },
      'premium_tier': { luxuryLevel: 'premium' },
    };

    const changes = changeMap[scenario];
    if (!changes) return null;

    const analysis = this.analyzeModification(plan, changes);

    return {
      id: `sim-${Date.now()}`,
      basePlanId: plan.id,
      label: scenario,
      change: changes,
      estimatedImpact: {
        costDifference: analysis.budgetImpact,
        affectedServices: analysis.dependencies.flatMap(d => d?.affectedServices || []),
        timelineShift: analysis.timelineImpact,
        riskChange: 0, // To be calculated
      },
      createdAt: new Date(),
    };
  }

  /**
   * Formats comprehensive plan report for display
   */
  static formatPlanReport(result: PlanGenerationResult): string {
    let output = `\n# 📋 Event Plan Generated\n\n`;

    // Event basics
    output += `## Event Details\n`;
    output += `- **Type:** ${result.plan.eventType}\n`;
    output += `- **Location:** ${result.plan.location || 'Not set'}\n`;
    output += `- **Date:** ${result.plan.eventDate ? new Date(result.plan.eventDate).toDateString() : 'Not set'}\n`;
    output += `- **Guests:** ${result.plan.guestCount}\n\n`;

    // Budget section
    output += `## 💰 Budget\n`;
    output += `- **Total:** ₹${(result.plan.totalBudget / 100000).toFixed(1)}L\n`;
    output += `- **Allocated:** ₹${(result.plan.allocatedBudget / 100000).toFixed(1)}L\n`;
    output += `- **Remaining:** ₹${(result.plan.remainingBudget / 100000).toFixed(1)}L\n`;
    output += `- **Per Guest:** ₹${(result.plan.totalBudget / result.plan.guestCount).toFixed(0)}\n\n`;

    // Services overview
    output += `## 🎯 Services\n`;
    output += `- **Total:** ${result.plan.services.length} categories\n`;
    output += `- **Required:** ${result.plan.services.filter(s => s.status === 'required').length}\n`;
    output += `- **Booked:** ${result.plan.selectedVendors.length}\n\n`;

    // Health score
    output += `## 💚 Plan Health\n`;
    output += `- **Score:** ${result.health.overallScore}/100 (${result.health.status.toUpperCase()})\n`;
    output += `- **Completion:** ${result.health.completionPercentage}%\n`;
    output += `- **Risk Level:** ${result.health.riskLevel}\n\n`;

    // Recommendations
    if (result.recommendations.length > 0) {
      output += `## ✨ Recommendations\n`;
      for (const rec of result.recommendations.slice(0, 5)) {
        output += `- ${rec}\n`;
      }
    }

    return output;
  }
}

export default EventIntelligenceOrchestrator;
