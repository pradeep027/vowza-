// ─── Event Risk Detector ──────────────────────────────────────────────────────
// Identifies planning risks and suggests mitigation strategies.
//
// Risk Categories:
// 1. Budget Risks: insufficient funds, high per-guest cost, tight allocations
// 2. Vendor Risks: not booked, unavailable, low ratings, last-minute bookings
// 3. Timeline Risks: approaching deadline, insufficient lead time, compressed phases
// 4. Operational Risks: missing critical services, dependency failures, conflicts
// 5. Quality Risks: low budget per guest, compromised priorities, budget cuts
//
// Each risk includes: severity, description, affected areas, mitigation strategy

import type { EventPlan, EventService } from '@/contexts/EventPlanContext';
import type { EventBudgetPlan } from './eventBudgetPlanner';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RiskAssessment {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'budget' | 'vendor' | 'timeline' | 'operational' | 'quality';
  title: string;
  description: string;
  affectedAreas: string[];
  probability: number; // 0-100
  impact: number; // 0-100 if realized
  mitigationStrategy: string;
  actionRequired: boolean;
}

export interface RiskSummary {
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  overallRiskScore: number; // 0-100, higher = riskier
  riskLevel: 'safe' | 'moderate' | 'elevated' | 'high' | 'critical';
}

// ─── Risk Detector ────────────────────────────────────────────────────────────
export class EventRiskDetector {
  /**
   * Comprehensive risk analysis for an event plan
   */
  static detectAllRisks(plan: EventPlan, budgetPlan?: EventBudgetPlan): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    // Budget risks
    risks.push(...this.detectBudgetRisks(plan, budgetPlan));

    // Vendor risks
    risks.push(...this.detectVendorRisks(plan));

    // Timeline risks
    risks.push(...this.detectTimelineRisks(plan));

    // Operational risks
    risks.push(...this.detectOperationalRisks(plan));

    // Quality risks
    risks.push(...this.detectQualityRisks(plan, budgetPlan));

    return risks;
  }

  /**
   * Detect budget-related risks
   */
  private static detectBudgetRisks(plan: EventPlan, budgetPlan?: EventBudgetPlan): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    if (!budgetPlan) return risks;

    // Risk 1: Budget exceeded
    if (plan.allocatedBudget > plan.totalBudget) {
      const excess = plan.allocatedBudget - plan.totalBudget;
      risks.push({
        id: `budget-exceeded-${Date.now()}`,
        severity: 'critical',
        category: 'budget',
        title: 'Budget Exceeded',
        description: `Total allocations (₹${(plan.allocatedBudget/100000).toFixed(1)}L) exceed budget (₹${(plan.totalBudget/100000).toFixed(1)}L) by ₹${(excess/100000).toFixed(1)}L.`,
        affectedAreas: budgetPlan.allocations.map(a => a.category),
        probability: 100,
        impact: 80,
        mitigationStrategy: 'Review budget allocations, reduce low-priority items, or increase total budget.',
        actionRequired: true,
      });
    }

    // Risk 2: Insufficient remaining buffer
    const bufferPercentage = (plan.remainingBudget / plan.totalBudget) * 100;
    if (bufferPercentage < 5) {
      risks.push({
        id: `low-buffer-${Date.now()}`,
        severity: 'high',
        category: 'budget',
        title: 'Insufficient Budget Buffer',
        description: `Only ${bufferPercentage.toFixed(1)}% of budget remains unallocated. No room for unexpected costs.`,
        affectedAreas: ['Contingency'],
        probability: 70,
        impact: 50,
        mitigationStrategy: 'Allocate 10-15% for contingencies. Reduce allocations to high-priority items only.',
        actionRequired: true,
      });
    }

    // Risk 3: High per-guest cost
    const perGuestSpending = plan.totalBudget / plan.guestCount;
    if (perGuestSpending > 5000) {
      risks.push({
        id: `high-per-guest-${Date.now()}`,
        severity: 'medium',
        category: 'quality',
        title: 'Premium Budget Tier',
        description: `Per-guest spending of ₹${perGuestSpending.toFixed(0)} is in the luxury tier. Vendor availability may be limited.`,
        affectedAreas: ['Vendor Selection'],
        probability: 40,
        impact: 30,
        mitigationStrategy: 'Start vendor bookings early. Have backup vendor lists ready.',
        actionRequired: false,
      });
    }

    // Risk 4: Very tight budget
    if (perGuestSpending < 700) {
      risks.push({
        id: `tight-budget-${Date.now()}`,
        severity: 'high',
        category: 'quality',
        title: 'Very Tight Per-Guest Budget',
        description: `Per-guest spending of ₹${perGuestSpending.toFixed(0)} limits quality. May struggle to find good vendors.`,
        affectedAreas: ['Vendor Selection', 'Quality Control'],
        probability: 85,
        impact: 70,
        mitigationStrategy: 'Consider reducing guest count or increasing budget. Focus on must-have services.',
        actionRequired: true,
      });
    }

    return risks;
  }

  /**
   * Detect vendor-related risks
   */
  private static detectVendorRisks(plan: EventPlan): RiskAssessment[] {
    const risks: RiskAssessment[] = [];
    const bookedServices = plan.selectedVendors.length;
    const requiredServices = plan.services.filter(s => s.status === 'required').length;

    // Risk 1: Critical services not booked
    const unbokedCritical = plan.services.filter(
      s => s.status === 'required' && s.status !== 'confirmed' && !plan.selectedVendors.find(v => v.serviceId === s.id)
    );

    if (unbookedCritical.length > 0) {
      risks.push({
        id: `unbooked-critical-${Date.now()}`,
        severity: 'high',
        category: 'vendor',
        title: 'Critical Services Not Booked',
        description: `${unbookedCritical.length} essential service(s) not yet booked: ${unbookedCritical.map(s => s.category).join(', ')}.`,
        affectedAreas: unbookedCritical.map(s => s.category),
        probability: 90,
        impact: 95,
        mitigationStrategy: 'Contact vendors immediately. Book backup options. Confirm availability.',
        actionRequired: true,
      });
    }

    // Risk 2: Last-minute vendor bookings
    if (plan.eventDate) {
      const daysUntilEvent = Math.floor(
        (new Date(plan.eventDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilEvent < 30 && bookedServices < requiredServices * 0.8) {
        risks.push({
          id: `lastminute-booking-${Date.now()}`,
          severity: 'critical',
          category: 'timeline',
          title: 'Last-Minute Vendor Bookings',
          description: `Only ${daysUntilEvent} days until event and ${requiredServices - bookedServices} services still unbooked. Vendors may not be available.`,
          affectedAreas: ['Vendor Availability', 'Timeline'],
          probability: 95,
          impact: 90,
          mitigationStrategy: 'Call vendors immediately. Accept less-ideal options if necessary. Have contingency vendors.',
          actionRequired: true,
        });
      }
    }

    // Risk 3: No backup vendors identified
    risks.push({
      id: `no-backup-vendors-${Date.now()}`,
      severity: 'medium',
      category: 'vendor',
      title: 'No Backup Vendors Identified',
      description: 'If a booked vendor cancels, no alternatives are lined up.',
      affectedAreas: plan.services.map(s => s.category),
      probability: 20,
      impact: 75,
      mitigationStrategy: 'Keep a list of 2-3 backup vendors per critical service. Maintain relationships.',
        actionRequired: false,
    });

    return risks;
  }

  /**
   * Detect timeline-related risks
   */
  private static detectTimelineRisks(plan: EventPlan): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    if (!plan.eventDate) {
      risks.push({
        id: `no-event-date-${Date.now()}`,
        severity: 'high',
        category: 'timeline',
        title: 'Event Date Not Set',
        description: 'Cannot generate timeline or assess booking lead times without an event date.',
        affectedAreas: ['Timeline', 'Vendor Booking'],
        probability: 100,
        impact: 60,
        mitigationStrategy: 'Set event date immediately to enable timeline planning.',
        actionRequired: true,
      });
      return risks;
    }

    const daysUntilEvent = Math.floor(
      (new Date(plan.eventDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    // Risk 1: Event too soon
    if (daysUntilEvent < 14) {
      risks.push({
        id: `event-too-soon-${Date.now()}`,
        severity: 'critical',
        category: 'timeline',
        title: 'Insufficient Planning Time',
        description: `Only ${daysUntilEvent} days until event. Most vendors need 30-90 days notice.`,
        affectedAreas: ['Vendor Booking', 'Planning', 'Logistics'],
        probability: 100,
        impact: 90,
        mitigationStrategy: 'Contact emergency vendors, accept limited options, simplify event scope.',
        actionRequired: true,
      });
    } else if (daysUntilEvent < 30) {
      risks.push({
        id: `compressed-timeline-${Date.now()}`,
        severity: 'high',
        category: 'timeline',
        title: 'Compressed Planning Timeline',
        description: `Only ${daysUntilEvent} days until event. Tight schedule for vendor bookings and confirmations.`,
        affectedAreas: ['Vendor Booking', 'Confirmation Calls'],
        probability: 80,
        impact: 60,
        mitigationStrategy: 'Prioritize critical vendor bookings. Streamline decision-making. Accept good-enough options.',
        actionRequired: true,
      });
    }

    // Risk 2: Multiple deadlines converging
    if (daysUntilEvent < 60 && plan.services.filter(s => s.status === 'required').length > 5) {
      risks.push({
        id: `converging-deadlines-${Date.now()}`,
        severity: 'high',
        category: 'timeline',
        title: 'Many Services to Book Simultaneously',
        description: `${plan.services.filter(s => s.status === 'required').length} critical services must be booked in ${daysUntilEvent} days.`,
        affectedAreas: ['Vendor Booking', 'Logistics'],
        probability: 70,
        impact: 50,
        mitigationStrategy: 'Create booking checklist with deadlines. Assign responsibilities to team members.',
        actionRequired: true,
      });
    }

    return risks;
  }

  /**
   * Detect operational/dependency risks
   */
  private static detectOperationalRisks(plan: EventPlan): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    // Risk 1: Missing critical services
    const criticalCategories = ['Venue', 'Catering', 'Photography'];
    const missingCritical = criticalCategories.filter(
      cat => !plan.services.some(s => s.category === cat && s.status !== 'excluded')
    );

    if (missingCritical.length > 0) {
      risks.push({
        id: `missing-critical-${Date.now()}`,
        severity: 'high',
        category: 'operational',
        title: 'Missing Critical Services',
        description: `${missingCritical.join(', ')} not included in plan. May be essential for your event.`,
        affectedAreas: missingCritical,
        probability: 80,
        impact: 85,
        mitigationStrategy: `Add ${missingCritical.join(' and ')} to your plan. Allocate budget for these.`,
        actionRequired: true,
      });
    }

    // Risk 2: Excluded but required services
    const excludedRequired = plan.services.filter(
      s => s.status === 'excluded' && s.status === 'required'
    );

    if (excludedRequired.length > 0) {
      risks.push({
        id: `excluded-required-${Date.now()}`,
        severity: 'critical',
        category: 'operational',
        title: 'Conflicting Service Status',
        description: `You've excluded services marked as required: ${excludedRequired.map(s => s.category).join(', ')}.`,
        affectedAreas: excludedRequired.map(s => s.category),
        probability: 100,
        impact: 80,
        mitigationStrategy: 'Clarify which services are actually required. Update service statuses.',
        actionRequired: true,
      });
    }

    // Risk 3: No contingency allocation
    if (plan.allocatedBudget > plan.totalBudget * 0.95) {
      risks.push({
        id: `no-contingency-${Date.now()}`,
        severity: 'high',
        category: 'operational',
        title: 'No Contingency Budget',
        description: 'Nearly 100% of budget allocated. No room for unexpected expenses or price changes.',
        affectedAreas: ['Budget', 'Risk Management'],
        probability: 75,
        impact: 70,
        mitigationStrategy: 'Reserve 5-10% for contingencies. Trim non-essential allocations.',
        actionRequired: true,
      });
    }

    return risks;
  }

  /**
   * Detect quality-related risks
   */
  private static detectQualityRisks(plan: EventPlan, budgetPlan?: EventBudgetPlan): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    if (!budgetPlan) return risks;

    // Risk 1: Quality compromised by budget cuts
    const highPriorityUnderfunded = budgetPlan.allocations.filter(
      a => a.priority === 'high' && a.allocatedAmount < a.minAmount
    );

    if (highPriorityUnderfunded.length > 0) {
      risks.push({
        id: `quality-compromised-${Date.now()}`,
        severity: 'high',
        category: 'quality',
        title: 'High-Priority Items Underfunded',
        description: `Key services (${highPriorityUnderfunded.map(a => a.category).join(', ')}) have below-minimum budgets.`,
        affectedAreas: highPriorityUnderfunded.map(a => a.category),
        probability: 85,
        impact: 75,
        mitigationStrategy: 'Increase allocations to high-priority items. Reduce low-priority spending.',
        actionRequired: true,
      });
    }

    return risks;
  }

  /**
   * Calculate overall risk summary
   */
  static calculateRiskSummary(risks: RiskAssessment[]): RiskSummary {
    const criticalRisks = risks.filter(r => r.severity === 'critical').length;
    const highRisks = risks.filter(r => r.severity === 'high').length;

    // Risk score: weighted average of severity and impact
    let totalScore = 0;
    for (const risk of risks) {
      const severityWeight = risk.severity === 'critical' ? 100 : risk.severity === 'high' ? 70 : risk.severity === 'medium' ? 40 : 10;
      const score = (severityWeight * risk.probability * risk.impact) / 10000;
      totalScore += score;
    }
    const overallRiskScore = Math.min(100, (totalScore / Math.max(risks.length, 1)) * 2);

    let riskLevel: 'safe' | 'moderate' | 'elevated' | 'high' | 'critical';
    if (criticalRisks > 0) {
      riskLevel = 'critical';
    } else if (highRisks >= 3 || overallRiskScore > 75) {
      riskLevel = 'high';
    } else if (highRisks >= 1 || overallRiskScore > 50) {
      riskLevel = 'elevated';
    } else if (risks.length > 3 || overallRiskScore > 25) {
      riskLevel = 'moderate';
    } else {
      riskLevel = 'safe';
    }

    return {
      totalRisks: risks.length,
      criticalRisks,
      highRisks,
      overallRiskScore: Math.round(overallRiskScore),
      riskLevel,
    };
  }
}

// ─── Format risk for display ───────────────────────────────────────────────────
export function formatRiskForDisplay(risk: RiskAssessment): string {
  const severity = risk.severity === 'critical' ? '🚨' : risk.severity === 'high' ? '⚠️' : risk.severity === 'medium' ? '⚡' : 'ℹ️';
  const header = `${severity} **${risk.title}** (${risk.category})\n`;
  const desc = `${risk.description}\n`;
  const affected = risk.affectedAreas.length > 0 ? `**Affects:** ${risk.affectedAreas.join(', ')}\n` : '';
  const mitigation = `**Mitigation:** ${risk.mitigationStrategy}`;
  return header + desc + affected + mitigation;
}

export function formatRiskSummaryForDisplay(summary: RiskSummary): string {
  const icon = summary.riskLevel === 'critical' ? '🚨' : summary.riskLevel === 'high' ? '⚠️' : summary.riskLevel === 'elevated' ? '⚡' : 'ℹ️';
  return `${icon} **Risk Level: ${summary.riskLevel.toUpperCase()}** (${summary.overallRiskScore}/100)\n${summary.criticalRisks} critical, ${summary.highRisks} high-priority issues detected.`;
}
