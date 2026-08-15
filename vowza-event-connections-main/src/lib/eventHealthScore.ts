// ─── Event Health Score Calculator ────────────────────────────────────────────
// Calculates transparent, factor-based health scores for event plans.
//
// Health Score (0-100):
// - 100: Perfect — all essentials planned, budget balanced, timeline comfortable
// - 80+: Excellent — minor gaps but feasible
// - 60-79: Good — moderate planning gaps, some timeline pressure
// - 40-59: Fair — significant gaps, tight timeline or budget concerns
// - <40: Poor — critical gaps, high risk
//
// Factors considered:
// 1. Planning Completeness (services, details filled in)
// 2. Budget Health (not exceeded, sufficient buffer, reasonable per-guest)
// 3. Vendor Coverage (critical services booked)
// 4. Timeline Readiness (sufficient days until event, key deadlines met)
// 5. Risk Management (contingency plans, backup vendors)

import type { EventPlan } from '@/contexts/EventPlanContext';
import type { EventBudgetPlan } from './eventBudgetPlanner';
import { EventRiskDetector } from './eventRiskDetector';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HealthFactor {
  name: string;
  score: number; // 0-100
  weight: number; // multiplier (e.g., 0.2 = 20% of total)
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  details: string;
  suggestions: string[];
}

export interface EventHealthReport {
  overallScore: number; // 0-100
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  completionPercentage: number;
  factors: HealthFactor[];
  riskLevel: string;
  summary: string;
  priorityActions: string[];
}

// ─── Health Calculator ────────────────────────────────────────────────────────
export class EventHealthScoreCalculator {
  /**
   * Calculates comprehensive health report for event plan
   */
  static calculateHealth(plan: EventPlan, budgetPlan?: EventBudgetPlan): EventHealthReport {
    const factors: HealthFactor[] = [];

    // Factor 1: Planning Completeness
    factors.push(this.calculateCompletenessScore(plan));

    // Factor 2: Budget Health
    factors.push(this.calculateBudgetHealthScore(plan, budgetPlan));

    // Factor 3: Vendor Coverage
    factors.push(this.calculateVendorCoverageScore(plan));

    // Factor 4: Timeline Readiness
    factors.push(this.calculateTimelineReadinessScore(plan));

    // Factor 5: Risk Management
    factors.push(this.calculateRiskManagementScore(plan, budgetPlan));

    // Calculate weighted overall score
    let overallScore = 0;
    for (const factor of factors) {
      overallScore += factor.score * factor.weight;
    }
    overallScore = Math.round(overallScore);

    // Determine status
    const status = overallScore >= 80 ? 'excellent'
      : overallScore >= 60 ? 'good'
      : overallScore >= 40 ? 'fair'
      : overallScore >= 20 ? 'poor'
      : 'critical';

    // Calculate completion percentage
    const completionPercentage = this.calculateCompletionPercentage(plan);

    // Get risk level
    const risks = EventRiskDetector.detectAllRisks(plan, budgetPlan);
    const riskSummary = EventRiskDetector.calculateRiskSummary(risks);

    // Generate priority actions
    const priorityActions = this.generatePriorityActions(factors, plan);

    // Generate summary
    const summary = this.generateSummary(overallScore, status, completionPercentage, plan);

    return {
      overallScore,
      status,
      completionPercentage,
      factors,
      riskLevel: riskSummary.riskLevel,
      summary,
      priorityActions,
    };
  }

  /**
   * Calculates planning completeness score
   */
  private static calculateCompletenessScore(plan: EventPlan): HealthFactor {
    let completedItems = 0;
    let totalItems = 0;

    // Event details
    if (plan.eventType) completedItems++;
    if (plan.eventName) completedItems++;
    if (plan.location) completedItems++;
    if (plan.eventDate) completedItems++;
    if (plan.guestCount) completedItems++;
    totalItems += 5;

    // Budget
    if (plan.totalBudget > 0) completedItems++;
    if (plan.luxuryLevel) completedItems++;
    totalItems += 2;

    // Services
    const totalServices = plan.services.length;
    const confirmedServices = plan.services.filter(s => s.status === 'confirmed').length;
    completedItems += Math.round((confirmedServices / Math.max(totalServices, 1)) * 5);
    totalItems += 5;

    // Vendors booked
    const criticalServices = plan.services.filter(s => s.status === 'required').length;
    const bookedCritical = plan.selectedVendors.length;
    completedItems += Math.round((bookedCritical / Math.max(criticalServices, 1)) * 3);
    totalItems += 3;

    // Preferences
    if (plan.style) completedItems++;
    if (plan.theme) completedItems++;
    if (plan.preferences && plan.preferences.length > 0) completedItems++;
    totalItems += 3;

    const score = Math.round((completedItems / totalItems) * 100);
    const status = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';

    return {
      name: 'Planning Completeness',
      score,
      weight: 0.25,
      status,
      details: `${completedItems}/${totalItems} key details completed. Services: ${confirmedServices}/${totalServices} confirmed.`,
      suggestions: [
        ...(!plan.eventType ? ['Set event type'] : []),
        ...(!plan.location ? ['Set location'] : []),
        ...(!plan.eventDate ? ['Set event date'] : []),
        ...(plan.services.length < 3 ? ['Add more services to your plan'] : []),
        ...(bookedCritical < criticalServices * 0.8 ? ['Book more critical services'] : []),
      ],
    };
  }

  /**
   * Calculates budget health score
   */
  private static calculateBudgetHealthScore(plan: EventPlan, budgetPlan?: EventBudgetPlan): HealthFactor {
    let score = 100;
    const suggestions: string[] = [];

    if (!budgetPlan) {
      return {
        name: 'Budget Health',
        score: 50,
        weight: 0.25,
        status: 'fair',
        details: 'Budget plan not generated. Set event details to generate plan.',
        suggestions: ['Set event type, location, guests, and budget to generate plan'],
      };
    }

    // Deduct for budget exceeded
    if (plan.allocatedBudget > plan.totalBudget) {
      const excess = ((plan.allocatedBudget - plan.totalBudget) / plan.totalBudget) * 100;
      score -= Math.min(50, excess);
      suggestions.push(`Budget exceeded by ${excess.toFixed(1)}%`);
    }

    // Deduct for insufficient buffer
    const bufferPercentage = (plan.remainingBudget / plan.totalBudget) * 100;
    if (bufferPercentage < 5) {
      score -= 20;
      suggestions.push('Insufficient contingency buffer (<5%)');
    } else if (bufferPercentage < 10) {
      score -= 10;
      suggestions.push('Low contingency buffer (<10%)');
    }

    // Deduct for very tight per-guest budget
    const perGuestBudget = plan.totalBudget / plan.guestCount;
    if (perGuestBudget < 700) {
      score -= 15;
      suggestions.push(`Very tight per-guest budget (₹${perGuestBudget.toFixed(0)})`);
    } else if (perGuestBudget < 1000) {
      score -= 5;
      suggestions.push(`Tight per-guest budget (₹${perGuestBudget.toFixed(0)})`);
    }

    // Bonus for healthy budget
    if (plan.allocatedBudget <= plan.totalBudget && bufferPercentage >= 15) {
      score += 10;
    }

    score = Math.max(0, Math.min(100, score));
    const status = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';

    return {
      name: 'Budget Health',
      score,
      weight: 0.25,
      status,
      details: `Allocated: ₹${(plan.allocatedBudget/100000).toFixed(1)}L / ₹${(plan.totalBudget/100000).toFixed(1)}L | Buffer: ${bufferPercentage.toFixed(1)}% | Per-guest: ₹${perGuestBudget.toFixed(0)}`,
      suggestions,
    };
  }

  /**
   * Calculates vendor coverage score
   */
  private static calculateVendorCoverageScore(plan: EventPlan): HealthFactor {
    let score = 100;
    const suggestions: string[] = [];

    const criticalServices = plan.services.filter(s => s.status === 'required').length;
    const bookedServices = plan.selectedVendors.length;
    const coverage = criticalServices > 0 ? (bookedServices / criticalServices) * 100 : 0;

    // Deduct based on booking rate
    if (coverage < 50) {
      score -= 40;
      suggestions.push('Less than 50% of critical services booked');
    } else if (coverage < 80) {
      score -= 20;
      suggestions.push('Less than 80% of critical services booked');
    } else if (coverage < 100) {
      score -= 5;
      suggestions.push('Not all critical services booked');
    }

    // Deduct for missing backup vendors
    const hasBackups = plan.selectedVendors.filter(v => v.vendorId.includes('-backup')).length > 0;
    if (!hasBackups) {
      score -= 10;
      suggestions.push('No backup vendors identified');
    }

    score = Math.max(0, Math.min(100, score));
    const status = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';

    return {
      name: 'Vendor Coverage',
      score,
      weight: 0.15,
      status,
      details: `${bookedServices}/${criticalServices} critical services booked (${coverage.toFixed(0)}%)`,
      suggestions,
    };
  }

  /**
   * Calculates timeline readiness score
   */
  private static calculateTimelineReadinessScore(plan: EventPlan): HealthFactor {
    let score = 100;
    const suggestions: string[] = [];

    if (!plan.eventDate) {
      return {
        name: 'Timeline Readiness',
        score: 0,
        weight: 0.15,
        status: 'critical',
        details: 'Event date not set',
        suggestions: ['Set event date to enable timeline planning'],
      };
    }

    const daysUntilEvent = Math.floor(
      (new Date(plan.eventDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    // Deduct based on time remaining
    if (daysUntilEvent < 7) {
      score = 0;
      suggestions.push('Event is in less than 7 days — critical time crunch');
    } else if (daysUntilEvent < 14) {
      score -= 50;
      suggestions.push('Event is in less than 14 days — very tight timeline');
    } else if (daysUntilEvent < 30) {
      score -= 25;
      suggestions.push('Event is in less than 30 days — compressed timeline');
    } else if (daysUntilEvent < 60) {
      score -= 10;
      suggestions.push('Event is in less than 60 days — moderate timeline pressure');
    } else if (daysUntilEvent < 90) {
      // Good
    } else {
      score += 10; // Bonus for plenty of time
    }

    // Deduct if timeline phases incomplete
    if (plan.timeline.length === 0) {
      score -= 5;
      suggestions.push('Timeline not generated');
    }

    score = Math.max(0, Math.min(100, score));
    const status = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';

    return {
      name: 'Timeline Readiness',
      score,
      weight: 0.15,
      status,
      details: `${daysUntilEvent} days until event | ${plan.timeline.length} timeline milestones`,
      suggestions,
    };
  }

  /**
   * Calculates risk management score
   */
  private static calculateRiskManagementScore(plan: EventPlan, budgetPlan?: EventBudgetPlan): HealthFactor {
    let score = 100;
    const suggestions: string[] = [];

    const risks = EventRiskDetector.detectAllRisks(plan, budgetPlan);
    const riskSummary = EventRiskDetector.calculateRiskSummary(risks);

    // Deduct based on risk level
    if (riskSummary.riskLevel === 'critical') {
      score -= 50;
    } else if (riskSummary.riskLevel === 'high') {
      score -= 30;
    } else if (riskSummary.riskLevel === 'elevated') {
      score -= 15;
    } else if (riskSummary.riskLevel === 'moderate') {
      score -= 5;
    }

    // Suggest addressing top risks
    if (riskSummary.criticalRisks > 0) {
      suggestions.push(`${riskSummary.criticalRisks} critical risk(s) detected`);
    }
    if (riskSummary.highRisks > 0) {
      suggestions.push(`${riskSummary.highRisks} high-priority risk(s) detected`);
    }

    score = Math.max(0, Math.min(100, score));
    const status = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';

    return {
      name: 'Risk Management',
      score,
      weight: 0.2,
      status,
      details: `Risk Level: ${riskSummary.riskLevel} | ${riskSummary.totalRisks} total risks, ${riskSummary.criticalRisks} critical`,
      suggestions,
    };
  }

  /**
   * Calculate overall completion percentage
   */
  private static calculateCompletionPercentage(plan: EventPlan): number {
    let completed = 0;
    let total = 0;

    // Event details
    if (plan.eventType) completed++;
    if (plan.eventName) completed++;
    if (plan.location) completed++;
    if (plan.eventDate) completed++;
    if (plan.guestCount > 0) completed++;
    if (plan.totalBudget > 0) completed++;
    total += 6;

    // Services
    const confirmedServices = plan.services.filter(s => s.status === 'confirmed').length;
    const requiredServices = plan.services.filter(s => s.status === 'required').length;
    if (requiredServices > 0) {
      completed += Math.round((confirmedServices / requiredServices) * 5);
    }
    total += 5;

    // Vendors
    if (plan.selectedVendors.length > 0) completed++;
    total += 1;

    return Math.round((completed / total) * 100);
  }

  /**
   * Generate priority actions based on health factors
   */
  private static generatePriorityActions(factors: HealthFactor[], plan: EventPlan): string[] {
    const actions: string[] = [];

    // Get factors sorted by urgency (worst first)
    const sortedFactors = [...factors].sort((a, b) => {
      const severityMap = { critical: 4, poor: 3, fair: 2, good: 1, excellent: 0 };
      return severityMap[b.status] - severityMap[a.status];
    });

    // Add top 3 suggestions
    for (const factor of sortedFactors.slice(0, 2)) {
      actions.push(...factor.suggestions.slice(0, 2));
    }

    return actions.slice(0, 5); // Top 5 actions
  }

  /**
   * Generate summary text
   */
  private static generateSummary(score: number, status: string, completion: number, plan: EventPlan): string {
    const statusEmoji = status === 'excellent' ? '✅' : status === 'good' ? '👍' : status === 'fair' ? '⚠️' : '🚨';
    const baseSummary = `${statusEmoji} **Event Plan Health: ${score}/100 (${status.toUpperCase()})**`;

    if (!plan.eventDate) {
      return `${baseSummary} — Set event date to enable planning.`;
    }

    const daysUntilEvent = Math.floor(
      (new Date(plan.eventDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    let timeContext = '';
    if (daysUntilEvent < 7) {
      timeContext = ' Event is in a few days.';
    } else if (daysUntilEvent < 30) {
      timeContext = ` Event is in ${daysUntilEvent} days.`;
    } else if (daysUntilEvent < 90) {
      timeContext = ` You have ${daysUntilEvent} days to prepare.`;
    } else {
      timeContext = ' You have plenty of time to plan.';
    }

    return `${baseSummary} — ${completion}% complete.${timeContext}`;
  }
}

// ─── Format health report for display ──────────────────────────────────────────
export function formatHealthReportForDisplay(report: EventHealthReport): string {
  let output = `\n## 💚 Event Plan Health\n\n`;
  output += `**Score: ${report.overallScore}/100** (${report.status.toUpperCase()})\n`;
  output += `**Completion: ${report.completionPercentage}%**\n`;
  output += `**Risk Level: ${report.riskLevel}**\n\n`;

  output += `${report.summary}\n\n`;

  // Factor scores
  output += `### Health Factors\n\n`;
  for (const factor of report.factors) {
    const statusIcon = factor.status === 'excellent' ? '✅' : factor.status === 'good' ? '👍' : factor.status === 'fair' ? '⚠️' : '🚨';
    output += `${statusIcon} **${factor.name}**: ${factor.score}/100\n`;
    output += `   ${factor.details}\n`;
  }

  // Priority actions
  if (report.priorityActions.length > 0) {
    output += `\n### Priority Actions\n\n`;
    for (const action of report.priorityActions) {
      output += `- ${action}\n`;
    }
  }

  return output;
}
