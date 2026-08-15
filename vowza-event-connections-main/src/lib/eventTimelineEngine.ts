// ─── Event Timeline Engine ────────────────────────────────────────────────────
// Generates dynamic, personalized planning timelines based on event details.
//
// Key Features:
// 1. Calculates milestones based on event date
// 2. Prioritizes services based on booking lead times
// 3. Identifies critical path tasks
// 4. Adapts to event type (wedding needs 6+ months, birthday needs 2-3 weeks)
// 5. Generates actionable checklists per phase
//
// Timeline phases for weddings (typical 6-month planning):
// - 6 months: Venue, Catering, Photography (long lead times)
// - 4 months: Decoration, Music, Videography
// - 2 months: Makeup, Invitations, Miscellaneous
// - 1 month: Final confirmations, payments, guest lists
// - 1 week: Final checks, vendor meetings, logistics
// - 1 day: Rehearsal, final setup

import type { EventPlan, TimelineItem } from '@/contexts/EventPlanContext';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TimelinePhase {
  name: string;
  daysBeforeEvent: number;
  duration: number; // days in this phase
  priority: 'critical' | 'high' | 'medium' | 'low';
  tasks: TimelineTask[];
  servicesToBook: string[];
}

export interface TimelineTask {
  id: string;
  action: string;
  daysBeforeEvent: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedDuration: number; // hours
  relatedServices: string[];
  completed: boolean;
}

// ─── Service Lead Times (days before event to book) ──────────────────────────
const BOOKING_LEAD_TIMES: Record<string, { min: number; ideal: number; max: number }> = {
  'Venue': { min: 90, ideal: 180, max: 365 },
  'Catering': { min: 60, ideal: 120, max: 180 },
  'Photography': { min: 45, ideal: 90, max: 180 },
  'Videography': { min: 45, ideal: 90, max: 180 },
  'Decoration': { min: 30, ideal: 60, max: 120 },
  'Music/DJ/Band': { min: 30, ideal: 60, max: 120 },
  'Makeup & Hair': { min: 7, ideal: 30, max: 60 },
  'Mehendi Artist': { min: 15, ideal: 45, max: 90 },
  'Haldi Artist': { min: 15, ideal: 45, max: 90 },
  'Flowers': { min: 7, ideal: 30, max: 60 },
  'Cake': { min: 7, ideal: 30, max: 60 },
  'Transportation': { min: 14, ideal: 45, max: 90 },
  'Pandit/Priest': { min: 14, ideal: 30, max: 60 },
  'default': { min: 14, ideal: 30, max: 60 },
};

// ─── Event-Type-Specific Timeline Phases ─────────────────────────────────────
const TIMELINE_PHASES: Record<string, TimelinePhase[]> = {
  'wedding': [
    {
      name: 'Vision & Planning',
      daysBeforeEvent: 180,
      duration: 60,
      priority: 'critical',
      tasks: [
        { id: 'plan-1', action: 'Decide on wedding date and location', daysBeforeEvent: 180, priority: 'critical', estimatedDuration: 2, relatedServices: [], completed: false },
        { id: 'plan-2', action: 'Set initial budget and guest count', daysBeforeEvent: 180, priority: 'critical', estimatedDuration: 1, relatedServices: [], completed: false },
        { id: 'plan-3', action: 'Choose wedding style and theme', daysBeforeEvent: 175, priority: 'high', estimatedDuration: 4, relatedServices: ['Decoration'], completed: false },
      ],
      servicesToBook: ['Venue'],
    },
    {
      name: 'Vendor Booking (Core Services)',
      daysBeforeEvent: 120,
      duration: 90,
      priority: 'critical',
      tasks: [
        { id: 'vendor-1', action: 'Book venue', daysBeforeEvent: 150, priority: 'critical', estimatedDuration: 3, relatedServices: ['Venue'], completed: false },
        { id: 'vendor-2', action: 'Select and finalize caterer', daysBeforeEvent: 120, priority: 'critical', estimatedDuration: 2, relatedServices: ['Catering'], completed: false },
        { id: 'vendor-3', action: 'Hire photographer', daysBeforeEvent: 120, priority: 'high', estimatedDuration: 2, relatedServices: ['Photography'], completed: false },
        { id: 'vendor-4', action: 'Hire videographer (optional)', daysBeforeEvent: 120, priority: 'medium', estimatedDuration: 2, relatedServices: ['Videography'], completed: false },
        { id: 'vendor-5', action: 'Book decoration artist', daysBeforeEvent: 90, priority: 'high', estimatedDuration: 2, relatedServices: ['Decoration'], completed: false },
        { id: 'vendor-6', action: 'Hire music/DJ/band', daysBeforeEvent: 90, priority: 'medium', estimatedDuration: 2, relatedServices: ['Music/DJ/Band'], completed: false },
      ],
      servicesToBook: ['Catering', 'Photography', 'Videography', 'Decoration', 'Music/DJ/Band'],
    },
    {
      name: 'Refinement & Details',
      daysBeforeEvent: 60,
      duration: 50,
      priority: 'high',
      tasks: [
        { id: 'refine-1', action: 'Finalize menu with caterer', daysBeforeEvent: 60, priority: 'high', estimatedDuration: 1.5, relatedServices: ['Catering'], completed: false },
        { id: 'refine-2', action: 'Confirm shot list with photographer', daysBeforeEvent: 60, priority: 'medium', estimatedDuration: 1, relatedServices: ['Photography'], completed: false },
        { id: 'refine-3', action: 'Book makeup and hair services', daysBeforeEvent: 45, priority: 'high', estimatedDuration: 1, relatedServices: ['Makeup & Hair'], completed: false },
        { id: 'refine-4', action: 'Finalize decoration design with artist', daysBeforeEvent: 45, priority: 'high', estimatedDuration: 2, relatedServices: ['Decoration'], completed: false },
        { id: 'refine-5', action: 'Arrange guest transportation (if needed)', daysBeforeEvent: 45, priority: 'medium', estimatedDuration: 1, relatedServices: ['Transportation'], completed: false },
      ],
      servicesToBook: ['Makeup & Hair', 'Flowers'],
    },
    {
      name: 'Pre-Event Logistics',
      daysBeforeEvent: 14,
      duration: 13,
      priority: 'high',
      tasks: [
        { id: 'logistics-1', action: 'Confirm final headcount with all vendors', daysBeforeEvent: 14, priority: 'critical', estimatedDuration: 2, relatedServices: ['Catering', 'Venue'], completed: false },
        { id: 'logistics-2', action: 'Make final payments or installments', daysBeforeEvent: 10, priority: 'critical', estimatedDuration: 2, relatedServices: [], completed: false },
        { id: 'logistics-3', action: 'Confirm all vendor arrival times', daysBeforeEvent: 7, priority: 'critical', estimatedDuration: 2, relatedServices: [], completed: false },
        { id: 'logistics-4', action: 'Create detailed day-of timeline and responsibilities', daysBeforeEvent: 7, priority: 'high', estimatedDuration: 3, relatedServices: [], completed: false },
        { id: 'logistics-5', action: 'Prepare invitations and guest arrangements', daysBeforeEvent: 14, priority: 'medium', estimatedDuration: 3, relatedServices: [], completed: false },
      ],
      servicesToBook: [],
    },
    {
      name: 'Final Checks',
      daysBeforeEvent: 3,
      duration: 2,
      priority: 'critical',
      tasks: [
        { id: 'final-1', action: 'Venue walk-through', daysBeforeEvent: 2, priority: 'critical', estimatedDuration: 1.5, relatedServices: ['Venue'], completed: false },
        { id: 'final-2', action: 'Rehearsal with key vendors', daysBeforeEvent: 1, priority: 'high', estimatedDuration: 3, relatedServices: ['Catering', 'Photography'], completed: false },
        { id: 'final-3', action: 'Weather contingency check', daysBeforeEvent: 1, priority: 'high', estimatedDuration: 1, relatedServices: ['Decoration'], completed: false },
      ],
      servicesToBook: [],
    },
  ],

  'birthday': [
    {
      name: 'Quick Planning',
      daysBeforeEvent: 21,
      duration: 7,
      priority: 'high',
      tasks: [
        { id: 'plan-1', action: 'Set date and guest list', daysBeforeEvent: 21, priority: 'critical', estimatedDuration: 1, relatedServices: [], completed: false },
        { id: 'plan-2', action: 'Determine budget', daysBeforeEvent: 21, priority: 'critical', estimatedDuration: 0.5, relatedServices: [], completed: false },
        { id: 'plan-3', action: 'Choose theme and decoration style', daysBeforeEvent: 20, priority: 'medium', estimatedDuration: 1, relatedServices: ['Decoration'], completed: false },
      ],
      servicesToBook: [],
    },
    {
      name: 'Vendor Booking',
      daysBeforeEvent: 14,
      duration: 10,
      priority: 'critical',
      tasks: [
        { id: 'vendor-1', action: 'Book venue', daysBeforeEvent: 14, priority: 'critical', estimatedDuration: 1.5, relatedServices: ['Venue'], completed: false },
        { id: 'vendor-2', action: 'Order cake or catering', daysBeforeEvent: 10, priority: 'critical', estimatedDuration: 1, relatedServices: ['Cake', 'Catering'], completed: false },
        { id: 'vendor-3', action: 'Book photographer (optional)', daysBeforeEvent: 10, priority: 'medium', estimatedDuration: 1, relatedServices: ['Photography'], completed: false },
        { id: 'vendor-4', action: 'Book entertainment/DJ', daysBeforeEvent: 10, priority: 'high', estimatedDuration: 1, relatedServices: ['Music/DJ/Band'], completed: false },
      ],
      servicesToBook: ['Catering', 'Cake', 'Music/DJ/Band'],
    },
    {
      name: 'Final Preparations',
      daysBeforeEvent: 4,
      duration: 3,
      priority: 'high',
      tasks: [
        { id: 'prep-1', action: 'Confirm all vendor details', daysBeforeEvent: 4, priority: 'critical', estimatedDuration: 1, relatedServices: [], completed: false },
        { id: 'prep-2', action: 'Buy decorations and setup items', daysBeforeEvent: 3, priority: 'medium', estimatedDuration: 2, relatedServices: ['Decoration'], completed: false },
        { id: 'prep-3', action: 'Final confirmation calls', daysBeforeEvent: 1, priority: 'critical', estimatedDuration: 1, relatedServices: [], completed: false },
      ],
      servicesToBook: [],
    },
  ],

  'corporate': [
    {
      name: 'Planning & Budget',
      daysBeforeEvent: 60,
      duration: 14,
      priority: 'high',
      tasks: [
        { id: 'plan-1', action: 'Define event objectives and attendee count', daysBeforeEvent: 60, priority: 'critical', estimatedDuration: 2, relatedServices: [], completed: false },
        { id: 'plan-2', action: 'Approve budget and allocations', daysBeforeEvent: 60, priority: 'critical', estimatedDuration: 1, relatedServices: [], completed: false },
        { id: 'plan-3', action: 'Identify required services (AV, catering, etc.)', daysBeforeEvent: 55, priority: 'high', estimatedDuration: 1.5, relatedServices: [], completed: false },
      ],
      servicesToBook: [],
    },
    {
      name: 'Vendor Selection',
      daysBeforeEvent: 45,
      duration: 20,
      priority: 'critical',
      tasks: [
        { id: 'vendor-1', action: 'Book venue', daysBeforeEvent: 45, priority: 'critical', estimatedDuration: 2, relatedServices: ['Venue'], completed: false },
        { id: 'vendor-2', action: 'Select catering vendor', daysBeforeEvent: 40, priority: 'critical', estimatedDuration: 2, relatedServices: ['Catering'], completed: false },
        { id: 'vendor-3', action: 'Book AV/Staging vendor', daysBeforeEvent: 40, priority: 'critical', estimatedDuration: 2, relatedServices: ['AV/Staging/Lighting'], completed: false },
        { id: 'vendor-4', action: 'Hire photographer/videographer', daysBeforeEvent: 35, priority: 'medium', estimatedDuration: 1.5, relatedServices: ['Photography/Videography'], completed: false },
      ],
      servicesToBook: ['Catering', 'AV/Staging/Lighting'],
    },
    {
      name: 'Finalizations',
      daysBeforeEvent: 14,
      duration: 13,
      priority: 'high',
      tasks: [
        { id: 'final-1', action: 'Finalize speaker/agenda with vendors', daysBeforeEvent: 14, priority: 'high', estimatedDuration: 2, relatedServices: [], completed: false },
        { id: 'final-2', action: 'Confirm final headcount', daysBeforeEvent: 7, priority: 'critical', estimatedDuration: 1, relatedServices: ['Catering'], completed: false },
        { id: 'final-3', action: 'Arrange transportation/logistics', daysBeforeEvent: 7, priority: 'medium', estimatedDuration: 2, relatedServices: ['Transportation'], completed: false },
        { id: 'final-4', action: 'Final vendor briefing', daysBeforeEvent: 2, priority: 'critical', estimatedDuration: 2, relatedServices: [], completed: false },
      ],
      servicesToBook: [],
    },
  ],

  'default': [
    {
      name: 'Planning',
      daysBeforeEvent: 30,
      duration: 10,
      priority: 'high',
      tasks: [
        { id: 'plan-1', action: 'Finalize event details', daysBeforeEvent: 30, priority: 'critical', estimatedDuration: 1, relatedServices: [], completed: false },
        { id: 'plan-2', action: 'Set budget', daysBeforeEvent: 30, priority: 'critical', estimatedDuration: 0.5, relatedServices: [], completed: false },
      ],
      servicesToBook: [],
    },
    {
      name: 'Vendor Booking',
      daysBeforeEvent: 20,
      duration: 15,
      priority: 'critical',
      tasks: [
        { id: 'vendor-1', action: 'Book venue', daysBeforeEvent: 20, priority: 'critical', estimatedDuration: 1.5, relatedServices: ['Venue'], completed: false },
        { id: 'vendor-2', action: 'Book catering', daysBeforeEvent: 15, priority: 'high', estimatedDuration: 1, relatedServices: ['Catering'], completed: false },
      ],
      servicesToBook: [],
    },
    {
      name: 'Final Preparations',
      daysBeforeEvent: 5,
      duration: 4,
      priority: 'high',
      tasks: [
        { id: 'prep-1', action: 'Confirm all vendor arrangements', daysBeforeEvent: 5, priority: 'critical', estimatedDuration: 1, relatedServices: [], completed: false },
        { id: 'prep-2', action: 'Final checks', daysBeforeEvent: 1, priority: 'critical', estimatedDuration: 1, relatedServices: [], completed: false },
      ],
      servicesToBook: [],
    },
  ],
};

// ─── Timeline Generator ────────────────────────────────────────────────────────
export class EventTimelineEngine {
  /**
   * Generates a personalized timeline for the event
   */
  static generateTimeline(plan: EventPlan): TimelineItem[] {
    if (!plan.eventDate) {
      return []; // Can't generate timeline without event date
    }

    const eventType = plan.eventType || 'default';
    const phases = TIMELINE_PHASES[eventType] || TIMELINE_PHASES.default;
    const timeline: TimelineItem[] = [];

    const eventDateTime = new Date(plan.eventDate).getTime();
    const now = new Date().getTime();

    for (const phase of phases) {
      for (const task of phase.tasks) {
        const targetDate = new Date(eventDateTime - task.daysBeforeEvent * 24 * 60 * 60 * 1000);

        // Only include tasks that haven't passed
        if (targetDate.getTime() > now) {
          timeline.push({
            id: task.id,
            milestoneType: this.categorizeTask(task.action),
            description: task.action,
            daysBeforeEvent: task.daysBeforeEvent,
            targetDate,
            actionRequired: [task.action],
            completed: false,
            relatedServices: task.relatedServices,
          });
        }
      }
    }

    return timeline.sort((a, b) => (b.daysBeforeEvent || 0) - (a.daysBeforeEvent || 0));
  }

  /**
   * Categorizes a task into milestone type
   */
  private static categorizeTask(action: string): 'planning' | 'booking' | 'payment' | 'preparation' | 'event' | 'post-event' {
    const lower = action.toLowerCase();
    if (lower.includes('plan') || lower.includes('decide') || lower.includes('finalize') || lower.includes('confirm')) {
      return 'planning';
    }
    if (lower.includes('book') || lower.includes('hire') || lower.includes('select')) {
      return 'booking';
    }
    if (lower.includes('payment') || lower.includes('pay')) {
      return 'payment';
    }
    if (lower.includes('prepare') || lower.includes('setup') || lower.includes('final')) {
      return 'preparation';
    }
    if (lower.includes('event') || lower.includes('day')) {
      return 'event';
    }
    return 'preparation';
  }

  /**
   * Identifies critical path tasks (must-do items)
   */
  static identifyCriticalPath(plan: EventPlan): TimelineItem[] {
    const timeline = this.generateTimeline(plan);
    return timeline.filter(t => {
      const action = t.description?.toLowerCase() || '';
      return action.includes('venue') ||
        action.includes('catering') ||
        action.includes('photographer') ||
        action.includes('confirm') ||
        action.includes('payment');
    });
  }

  /**
   * Gets booking deadline for a specific service
   */
  static getBookingDeadline(serviceCategory: string, eventDate: Date): Date {
    const leadTime = BOOKING_LEAD_TIMES[serviceCategory] || BOOKING_LEAD_TIMES.default;
    const deadline = new Date(eventDate.getTime() - leadTime.ideal * 24 * 60 * 60 * 1000);
    return deadline;
  }

  /**
   * Calculates progress through the planning timeline
   */
  static calculateProgress(plan: EventPlan): { completed: number; total: number; percentage: number } {
    const timeline = this.generateTimeline(plan);
    const completed = timeline.filter(t => t.completed).length;
    const total = timeline.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }
}

// ─── Format timeline for display ───────────────────────────────────────────────
export function formatTimelineForDisplay(timeline: TimelineItem[]): string {
  if (timeline.length === 0) {
    return '📅 **Timeline** — Event date required to generate timeline';
  }

  let output = '\n## 📅 Planning Timeline\n\n';

  const byPhase = timeline.reduce((acc, item) => {
    const phase = item.milestoneType;
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(item);
    return acc;
  }, {} as Record<string, TimelineItem[]>);

  const phaseOrder = ['planning', 'booking', 'payment', 'preparation', 'event', 'post-event'];
  for (const phase of phaseOrder) {
    const items = byPhase[phase];
    if (!items) continue;

    const icon = phase === 'planning' ? '🎯'
      : phase === 'booking' ? '📞'
      : phase === 'payment' ? '💳'
      : phase === 'preparation' ? '⚙️'
      : phase === 'event' ? '🎉'
      : '✨';

    output += `\n### ${icon} ${phase.charAt(0).toUpperCase() + phase.slice(1)}\n`;
    for (const item of items) {
      const days = item.daysBeforeEvent || 0;
      const status = item.completed ? '✅' : '⭕';
      output += `- ${status} **${item.description}** (${days} days before event)\n`;
    }
  }

  return output;
}
