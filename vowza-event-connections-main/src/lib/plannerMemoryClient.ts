import type { EventState, FieldChange } from './eventState';
import type { PlannerContext } from './aiPlannerTypes';
import { supabase } from '@/integrations/supabase/client';
import type { PlannerMemoryContext } from '../../supabase/functions/_shared/plannerMemory';

export interface PlannerMemoryRecall {
  success: boolean;
  memories: string[];
  context: PlannerMemoryContext;
}

function toMemoryContext(context: PlannerContext): PlannerMemoryContext {
  return {
    eventId: context.eventId,
    eventLabel: context.eventLabel,
    eventType: context.eventType,
    city: context.city,
    locality: context.locality,
    budget: context.budget,
    guestCount: context.guestCount,
    eventDate: context.eventDate,
    durationDays: context.durationDays,
    luxuryLevel: context.luxuryLevel,
    theme: context.theme,
    colorPalette: context.colorPalette,
    styleVibe: context.styleVibe,
    foodPreference: context.foodPreference,
    serviceStyle: context.serviceStyle,
    requestedServices: context.requestedServices,
  };
}

function safeEventStateSnapshot(state: EventState): Record<string, unknown> {
  // Only send the fields the memory adapter is allowed to persist. Cultural
  // details, special requirements, vendor IDs, and the state change history
  // never leave the existing Vowza Event State store.
  return {
    eventId: state.eventId,
    eventLabel: state.eventLabel,
    eventType: state.eventType,
    location: { city: state.location.city, area: state.location.area },
    schedule: { eventDate: state.schedule.eventDate, durationDays: state.schedule.durationDays },
    guests: { count: state.guests.count },
    budget: { total: state.budget.total, luxuryLevel: state.budget.luxuryLevel },
    style: {
      theme: state.style.theme,
      colorPalette: state.style.colorPalette,
      vibe: state.style.vibe,
      foodPreference: state.style.foodPreference,
      serviceStyle: state.style.serviceStyle,
    },
    requirements: { serviceBudgets: state.requirements.serviceBudgets },
    requestedServices: state.requestedServices,
    updatedAt: state.updatedAt,
  };
}

export async function recallPlannerMemory(
  message: string,
  context: PlannerContext,
  conversationId: string,
): Promise<PlannerMemoryRecall | null> {
  try {
    const { data, error } = await supabase.functions.invoke<PlannerMemoryRecall>('planner-memory', {
      body: { action: 'recall', message, context: toMemoryContext(context), conversationId },
      timeout: 6_000,
    });
    if (error || !data || !Array.isArray(data.memories) || !data.context || typeof data.context !== 'object') {
      console.warn('[PlannerMemory] Recall request failed; using the existing Planner path.');
      return null;
    }
    return {
      success: data.success === true,
      memories: data.memories.filter((item): item is string => typeof item === 'string').slice(0, 5),
      context: data.context,
    };
  } catch {
    console.warn('[PlannerMemory] Recall request failed; using the existing Planner path.');
    return null;
  }
}

export async function retainPlannerMemory(
  userMessage: string,
  state: EventState,
  changes: FieldChange[],
  conversationId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke<{ success: boolean; retained: boolean }>('planner-memory', {
      body: {
        action: 'retain',
        userMessage,
        state: safeEventStateSnapshot(state),
        changedFields: changes.map((change) => change.field),
        conversationId,
      },
      timeout: 8_000,
    });
    if (error) {
      console.warn('[PlannerMemory] Retention request failed; the chat remains available.');
      return false;
    }
    return data?.success === true && data.retained === true;
  } catch {
    console.warn('[PlannerMemory] Retention request failed; the chat remains available.');
    return false;
  }
}
