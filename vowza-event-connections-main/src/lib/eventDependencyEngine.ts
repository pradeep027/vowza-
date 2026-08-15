// ─── Event Dependency Engine ──────────────────────────────────────────────────
// Detects relationships between event planning decisions.
// Example: Changing venue affects catering, decoration, guest travel, setup time.
//
// Purpose:
// 1. Warn users about cascading impacts of decisions
// 2. Suggest related services to update
// 3. Prevent silent failures when dependencies break
// 4. Show the knock-on effect of budget changes
//
// This is part of the Event Intelligence Engine's "smart follow-ups" system.

import type { EventPlan, EventService } from '@/contexts/EventPlanContext';
import type { PlannerContext } from './aiPlannerTypes';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DependencyEdge {
  from: string;           // Service ID or field name (e.g., "venue", "date")
  to: string;             // Service ID or field name
  type: 'strong' | 'medium' | 'weak'; // Impact strength
  impact: string;         // Human-readable impact description
}

export interface DependencyImpact {
  id: string;
  sourceChange: string;   // What changed: "venue" or "service-xyz"
  affectedServices: string[];
  affectedFields: string[];
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestedActions: string[];
  estimatedBudgetImpact: number;
  estimatedTimelineShift: number; // days before/after
}

// ─── Dependency Graph ─────────────────────────────────────────────────────────
// Maps which services/fields depend on which others
const DEPENDENCY_MAP: Record<string, DependencyEdge[]> = {
  // Venue changes affect multiple areas
  'eventDate': [
    { from: 'eventDate', to: 'venue', type: 'strong', impact: 'Venue availability depends on date — may need to rebid' },
    { from: 'eventDate', to: 'catering', type: 'medium', impact: 'Catering capacity and menu availability changes with date' },
    { from: 'eventDate', to: 'Photography', type: 'weak', impact: 'Photographer availability changes' },
    { from: 'eventDate', to: 'Music/DJ/Band', type: 'weak', impact: 'Musician/DJ availability changes' },
    { from: 'eventDate', to: 'timeline', type: 'strong', impact: 'Planning timeline must be recalculated' },
  ],

  'location': [
    { from: 'location', to: 'venue', type: 'strong', impact: 'Venue availability and pricing depend on location' },
    { from: 'location', to: 'catering', type: 'strong', impact: 'Catering vendors and costs vary by location' },
    { from: 'location', to: 'Photography', type: 'medium', impact: 'Photographer availability depends on location' },
    { from: 'location', to: 'Decoration', type: 'medium', impact: 'Decoration vendors and costs vary by location' },
    { from: 'location', to: 'transportation', type: 'strong', impact: 'Guest transportation needs change with location' },
    { from: 'location', to: 'budget', type: 'medium', impact: 'City multiplier affects overall costs' },
  ],

  'guestCount': [
    { from: 'guestCount', to: 'venue', type: 'strong', impact: 'Venue capacity must be reconsidered' },
    { from: 'guestCount', to: 'catering', type: 'strong', impact: 'Per-person catering cost scales with guest count' },
    { from: 'guestCount', to: 'Decoration', type: 'medium', impact: 'Decoration size and quantity must scale' },
    { from: 'guestCount', to: 'Photography', type: 'weak', impact: 'Larger events may need additional photographers' },
    { from: 'guestCount', to: 'Music/DJ/Band', type: 'medium', impact: 'Sound system and spacing requirements change' },
    { from: 'guestCount', to: 'budget', type: 'strong', impact: 'Overall budget needs to be recalculated' },
  ],

  'totalBudget': [
    { from: 'totalBudget', to: 'allocations', type: 'strong', impact: 'All budget allocations must be recalculated' },
    { from: 'totalBudget', to: 'venue', type: 'medium', impact: 'Venue options change based on budget' },
    { from: 'totalBudget', to: 'catering', type: 'medium', impact: 'Catering package options change' },
  ],

  // Service-specific dependencies
  'Venue': [
    { from: 'Venue', to: 'Decoration', type: 'strong', impact: 'Venue aesthetics determine decoration scope' },
    { from: 'Venue', to: 'Photography', type: 'medium', impact: 'Venue lighting and space affect photography' },
    { from: 'Venue', to: 'Music/DJ/Band', type: 'medium', impact: 'Venue acoustics and setup affect sound needs' },
    { from: 'Venue', to: 'setup-time', type: 'medium', impact: 'Venue access time affects setup timeline' },
  ],

  'Catering': [
    { from: 'Catering', to: 'Decoration', type: 'weak', impact: 'Catering style affects decor theme' },
    { from: 'Catering', to: 'dietary-preferences', type: 'strong', impact: 'Catering must accommodate dietary restrictions' },
  ],

  'Decoration': [
    { from: 'Decoration', to: 'Photography', type: 'medium', impact: 'Decoration affects photo aesthetic' },
    { from: 'Decoration', to: 'theme', type: 'strong', impact: 'Decoration defines the event theme' },
  ],

  'Photography': [
    { from: 'Photography', to: 'Videography', type: 'medium', impact: 'Overlapping services should coordinate timing' },
  ],
};

// ─── Impact Severity Definitions ──────────────────────────────────────────────
const SEVERITY_RULES: Record<string, { budget: number; days: number }> = {
  'strong': { budget: 0.15, days: 7 },      // ±15% budget impact, ±7 days timeline
  'medium': { budget: 0.08, days: 3 },      // ±8% budget impact, ±3 days timeline
  'weak': { budget: 0.03, days: 1 },        // ±3% budget impact, ±1 day timeline
};

// ─── Dependency Analyzer ──────────────────────────────────────────────────────
export class DependencyAnalyzer {
  /**
   * Analyzes the impact of a change to the event plan
   * Returns: list of affected services/fields and suggested actions
   */
  static analyzeChange(
    change: { field: string; oldValue: any; newValue: any },
    currentPlan: EventPlan
  ): DependencyImpact | null {
    const { field, oldValue, newValue } = change;

    // If no actual change, return null
    if (oldValue === newValue) return null;

    // Get dependencies for this field
    const edges = DEPENDENCY_MAP[field] || [];
    if (edges.length === 0) {
      return null; // No known dependencies
    }

    // Calculate impacts
    const affectedServices: Set<string> = new Set();
    const affectedFields: Set<string> = new Set();
    const impacts: string[] = [];
    let maxSeverity: 'strong' | 'medium' | 'weak' = 'weak';
    let estimatedBudgetImpact = 0;
    let estimatedTimelineShift = 0;

    for (const edge of edges) {
      // Track affected services and fields
      if (currentPlan.services.find(s => s.id === edge.to)) {
        affectedServices.add(edge.to);
      } else {
        affectedFields.add(edge.to);
      }

      impacts.push(edge.impact);

      // Update severity
      if (edge.type === 'strong' && maxSeverity !== 'strong') {
        maxSeverity = 'strong';
      } else if (edge.type === 'medium' && maxSeverity === 'weak') {
        maxSeverity = 'medium';
      }

      // Estimate impacts
      const rules = SEVERITY_RULES[edge.type];
      estimatedBudgetImpact += currentPlan.totalBudget * rules.budget;
      estimatedTimelineShift += rules.days;
    }

    // Generate suggested actions
    const suggestedActions: string[] = [];

    if (affectedServices.size > 0) {
      suggestedActions.push(
        `Review ${Array.from(affectedServices).join(', ')} to ensure they align with your new ${field}`
      );
    }

    if (field === 'eventDate') {
      suggestedActions.push('Check vendor availability for the new date');
      suggestedActions.push('Recalculate your planning timeline');
    }

    if (field === 'location') {
      suggestedActions.push('Update your budget — different cities have different vendor costs');
      suggestedActions.push('Search for new vendors in this location');
    }

    if (field === 'guestCount') {
      suggestedActions.push('Adjust your budget for the new guest count');
      suggestedActions.push('Confirm venue capacity for the new headcount');
    }

    if (field === 'totalBudget') {
      suggestedActions.push('Rebalance budget allocations across categories');
      suggestedActions.push('Check if all critical services can still be covered');
    }

    const severity = maxSeverity === 'strong' ? 'high' : maxSeverity === 'medium' ? 'medium' : 'low';

    return {
      id: `impact-${Date.now()}`,
      sourceChange: field,
      affectedServices: Array.from(affectedServices),
      affectedFields: Array.from(affectedFields),
      description: `Changing **${field}** from "${oldValue}" to "${newValue}" may affect: ${Array.from(affectedServices).concat(Array.from(affectedFields)).join(', ')}.`,
      severity,
      suggestedActions,
      estimatedBudgetImpact,
      estimatedTimelineShift,
    };
  }

  /**
   * Detects circular dependencies or conflicts
   * Example: Reducing budget might require reducing guests, which requires rethinking venue
   */
  static detectConflicts(plan: EventPlan): string[] {
    const conflicts: string[] = [];

    // Check: Venue capacity vs guest count
    if (plan.services.find(s => s.category === 'Venue')?.estimatedCost) {
      const venueService = plan.services.find(s => s.category === 'Venue');
      if (venueService && plan.guestCount > 500) {
        conflicts.push('⚠️ Large guest count (>500) may exceed most venue capacities — confirm before booking');
      }
    }

    // Check: Budget vs guest count feasibility
    const perGuestBudget = plan.totalBudget / plan.guestCount;
    if (perGuestBudget < 600) {
      conflicts.push('⚠️ Per-guest budget is very tight — may struggle to book quality vendors');
    }

    // Check: Timeline feasibility
    if (plan.eventDate) {
      const daysUntilEvent = Math.floor(
        (new Date(plan.eventDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilEvent < 30) {
        conflicts.push('⚠️ Event is within 30 days — vendor availability may be limited');
      }
    }

    // Check: Excluded vs required services
    const excludedRequired = plan.services.filter(
      s => s.status === 'excluded' && s.status === 'required'
    );
    if (excludedRequired.length > 0) {
      conflicts.push(
        `🚨 You've excluded required services: ${excludedRequired.map(s => s.category).join(', ')}`
      );
    }

    return conflicts;
  }

  /**
   * Gets the full dependency tree for a service
   * Shows all direct and transitive dependencies
   */
  static getDependencyTree(
    serviceId: string,
    plan: EventPlan,
    depth: number = 0,
    visited: Set<string> = new Set()
  ): DependencyEdge[] {
    if (depth > 3 || visited.has(serviceId)) {
      return []; // Prevent infinite recursion
    }

    visited.add(serviceId);
    const service = plan.services.find(s => s.id === serviceId);
    if (!service) return [];

    const edges = DEPENDENCY_MAP[service.category] || [];
    let allDeps = [...edges];

    // Recursively add transitive dependencies
    for (const edge of edges) {
      const transitive = this.getDependencyTree(edge.to, plan, depth + 1, visited);
      allDeps = allDeps.concat(transitive);
    }

    return allDeps;
  }

  /**
   * Suggests related services based on event type and dependencies
   */
  static suggestRelatedServices(plan: EventPlan): string[] {
    const suggestions: string[] = [];
    const existingCategories = new Set(plan.services.map(s => s.category));

    // Based on event type
    const eventSpecificServices: Record<string, string[]> = {
      'wedding': ['Photography', 'Videography', 'Decoration', 'Catering', 'Music/DJ/Band', 'Makeup & Hair'],
      'birthday': ['Catering', 'Decoration', 'Entertainment/Music', 'Cake', 'Photography'],
      'corporate': ['Venue', 'Catering', 'AV/Staging/Lighting', 'Photography/Videography'],
      'engagement': ['Catering', 'Decoration', 'Photography', 'Music/DJ'],
    };

    const suggestedByType = eventSpecificServices[plan.eventType] || [];
    for (const service of suggestedByType) {
      if (!existingCategories.has(service)) {
        suggestions.push(service);
      }
    }

    // Based on existing services (transitive)
    for (const service of plan.services) {
      const deps = DEPENDENCY_MAP[service.category] || [];
      for (const dep of deps) {
        if (!existingCategories.has(dep.to) && dep.type === 'strong') {
          if (!suggestions.includes(dep.to)) {
            suggestions.push(dep.to);
          }
        }
      }
    }

    return suggestions;
  }
}

// ─── Format dependency impact for display ──────────────────────────────────────
export function formatDependencyImpactForDisplay(impact: DependencyImpact): string {
  const severity = impact.severity === 'high' ? '🚨' : impact.severity === 'medium' ? '⚠️' : 'ℹ️';
  const header = `\n${severity} **Cascading Impact Detected**\n${impact.description}\n`;

  const affected = impact.affectedServices.length > 0 || impact.affectedFields.length > 0
    ? `**Affected Areas:** ${[...impact.affectedServices, ...impact.affectedFields].join(', ')}\n`
    : '';

  const actions = impact.suggestedActions.length > 0
    ? `**Suggested Actions:**\n${impact.suggestedActions.map(a => `- ${a}`).join('\n')}\n`
    : '';

  const budgetNote = impact.estimatedBudgetImpact > 0
    ? `**Estimated Budget Impact:** ±₹${(impact.estimatedBudgetImpact/100000).toFixed(1)}L\n`
    : '';

  const timelineNote = impact.estimatedTimelineShift > 0
    ? `**Estimated Timeline Shift:** ±${impact.estimatedTimelineShift} days\n`
    : '';

  return header + affected + actions + budgetNote + timelineNote;
}

export function formatConflictsForDisplay(conflicts: string[]): string {
  if (conflicts.length === 0) return '';
  return `\n### Planning Conflicts Detected\n${conflicts.join('\n')}\n`;
}
