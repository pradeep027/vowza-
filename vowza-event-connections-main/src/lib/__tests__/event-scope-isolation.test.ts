import { describe, expect, it } from 'vitest';
import { emptyEventState, mapContextToEventState } from '../eventState';
import { candidateFromEventState, resolveEventScope } from '../eventScope';
import { eventStateToPlannerContext } from '../eventStateProjection';
import { summarizeRecallResults } from '../../../supabase/functions/_shared/plannerMemory';

const EVENT_A = '00000000-0000-4000-8000-000000000010';
const EVENT_B = '00000000-0000-4000-8000-000000000011';

function state(eventId: string, label: string, eventType: 'wedding' | 'reception', budget: number, guests: number) {
  const base = emptyEventState('conversation-a', eventId);
  base.eventLabel = label;
  return mapContextToEventState({ eventId, eventLabel: label, eventType, budget, guestCount: guests, city: 'Hyderabad' }, base);
}

describe('explicit event-scope isolation', () => {
  it('keeps total budgets, guests, and services separate for two event identities', () => {
    const wedding = state(EVENT_A, "sister's wedding", 'wedding', 1_000_000, 500);
    const reception = state(EVENT_B, 'reception', 'reception', 400_000, 200);
    const weddingContext = eventStateToPlannerContext(wedding);
    const receptionContext = eventStateToPlannerContext(reception);
    expect(weddingContext.eventId).toBe(EVENT_A);
    expect(weddingContext.budget).toBe(1_000_000);
    expect(weddingContext.guestCount).toBe(500);
    expect(receptionContext.eventId).toBe(EVENT_B);
    expect(receptionContext.budget).toBe(400_000);
    expect(receptionContext.guestCount).toBe(200);
  });

  it('resolves an explicit event reference without treating the label as identity', () => {
    const wedding = state(EVENT_A, "sister's wedding", 'wedding', 1_000_000, 500);
    const reception = state(EVENT_B, 'reception', 'reception', 400_000, 200);
    const result = resolveEventScope(
      "What is my sister's wedding budget?",
      candidateFromEventState(reception),
      [candidateFromEventState(wedding)!, candidateFromEventState(reception)!],
    );
    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') expect(result.candidate.eventId).toBe(EVENT_A);
  });

  it('asks for clarification when a generic event reference is ambiguous', () => {
    const wedding = state(EVENT_A, 'wedding', 'wedding', 1_000_000, 500);
    const reception = state(EVENT_B, 'reception', 'reception', 400_000, 200);
    const result = resolveEventScope('What is my event budget?', null, [
      candidateFromEventState(wedding)!, candidateFromEventState(reception)!,
    ]);
    expect(result.kind).toBe('ambiguous');
  });

  it('filters Hindsight by event ID even when event types and cities match', () => {
    const result = summarizeRecallResults([
      { text: 'Reception total budget INR 400000.', metadata: {
        vowza_source: 'planner-event-state', vowza_event_id: EVENT_B,
        vowza_event_type: 'wedding', vowza_city: 'Hyderabad', vowza_budget_inr: '400000', vowza_updated_at: '2026-09-29T12:00:00Z',
      } },
      { text: 'Sister wedding total budget INR 1000000.', metadata: {
        vowza_source: 'planner-event-state', vowza_event_id: EVENT_A,
        vowza_event_type: 'wedding', vowza_city: 'Hyderabad', vowza_budget_inr: '1000000', vowza_updated_at: '2026-09-28T12:00:00Z',
      } },
    ], { eventId: EVENT_A, eventType: 'wedding', city: 'Hyderabad' });
    expect(result.context.budget).toBe(1_000_000);
    expect(result.memories).toEqual(['Sister wedding total budget INR 1000000.']);
  });

  it('does not use event-specific Hindsight data without a resolved event scope', () => {
    const result = summarizeRecallResults([
      { text: 'Reception total budget INR 400000.', metadata: {
        vowza_source: 'planner-event-state', vowza_event_id: EVENT_B,
        vowza_event_type: 'reception', vowza_updated_at: '2026-09-29T12:00:00Z',
      } },
    ], { eventType: 'reception' });
    expect(result.context.budget).toBeUndefined();
    expect(result.memories).toEqual([]);
  });
});
