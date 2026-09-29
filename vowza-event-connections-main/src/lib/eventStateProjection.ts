import type { PlannerContext } from './aiPlannerTypes';
import type { EventState } from './eventState';

/**
 * The only projection used when restoring an active event into the planner.
 * Event State is canonical; conversation context_summary and Hindsight are not.
 */
export function eventStateToPlannerContext(state: EventState | null | undefined): PlannerContext {
  if (!state) return {};
  return {
    eventId: state.eventId ?? undefined,
    eventLabel: state.eventLabel ?? state.eventTypeRaw ?? undefined,
    eventType: (state.eventType ?? undefined) as PlannerContext['eventType'],
    city: state.location.city ?? undefined,
    locality: state.location.area ?? undefined,
    venueName: state.location.venueName ?? undefined,
    hasVenue: state.location.hasVenue ?? undefined,
    eventDate: state.schedule.eventDate ?? undefined,
    timeOfDay: state.schedule.timeOfDay ?? undefined,
    durationDays: state.schedule.durationDays ?? undefined,
    guestCount: state.guests.count ?? undefined,
    budget: state.budget.total ?? undefined,
    luxuryLevel: state.budget.luxuryLevel ?? undefined,
    theme: state.style.theme ?? undefined,
    colorPalette: state.style.colorPalette ?? undefined,
    styleVibe: state.style.vibe ?? undefined,
    foodPreference: state.style.foodPreference ?? undefined,
    serviceStyle: state.style.serviceStyle ?? undefined,
    specialRequirements: state.requirements.specialRequirements ?? undefined,
    serviceBudgets: { ...state.requirements.serviceBudgets },
    requestedServices: undefined,
    confirmedFields: [...state.confirmedFields],
  };
}

export function emptyPlannerContext(): PlannerContext {
  return {};
}
