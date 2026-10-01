import { describe, expect, it } from 'vitest';
import { emptyEventState, mapContextToEventState } from '../eventState';
import { candidateFromEventState, resolveEventScope, shouldCreateNewEventScope } from '../eventScope';
import { eventStateToPlannerContext } from '../eventStateProjection';
import { EventBudgetPlanner } from '../eventBudgetPlanner';
import { summarizeRecallResults } from '../../../supabase/functions/_shared/plannerMemory';

const EVENT_A = '00000000-0000-4000-8000-000000000010';
const EVENT_B = '00000000-0000-4000-8000-000000000011';

function state(eventId: string, label: string, eventType: 'wedding' | 'reception', budget: number, guests: number) {
  const base = emptyEventState('conversation-a', eventId);
  base.eventLabel = label;
  return mapContextToEventState({ eventId, eventLabel: label, eventType, budget, guestCount: guests, city: 'Hyderabad' }, base);
}

describe('explicit event-scope isolation', () => {
  it('creates a fresh scope for the real same-city separate-event sequence', () => {
    const wedding = state(EVENT_A, "sister's wedding", 'wedding', 1_000_000, 500);
    const weddingCandidate = candidateFromEventState(wedding)!;
    const messageB = 'I am also planning a separate reception in Hyderabad with 200 guests and a total budget of ₹4 lakh.';

    expect(shouldCreateNewEventScope(messageB, [weddingCandidate])).toBe(true);

    const reception = mapContextToEventState({
      eventId: EVENT_B,
      eventLabel: 'reception',
      eventType: 'reception',
      city: 'Hyderabad',
      guestCount: 200,
      budget: 400_000,
    }, emptyEventState('conversation-a', EVENT_B));

    expect(reception.eventId).toBe(EVENT_B);
    expect(reception.eventId).not.toBe(wedding.eventId);
    expect(wedding.eventType).toBe('wedding');
    expect(wedding.guests.count).toBe(500);
    expect(wedding.budget.total).toBe(1_000_000);
    expect(reception.eventType).toBe('reception');
    expect(reception.guests.count).toBe(200);
    expect(reception.budget.total).toBe(400_000);
  });

  it('does not treat an explicit existing label as a new event declaration', () => {
    const wedding = state(EVENT_A, "sister's wedding", 'wedding', 1_000_000, 500);
    expect(shouldCreateNewEventScope("What is my sister's wedding budget?", [candidateFromEventState(wedding)!])).toBe(false);
  });

  it('does not resolve a new different event by shared city alone', () => {
    const wedding = state(EVENT_A, "sister's wedding", 'wedding', 1_000_000, 500);
    const result = resolveEventScope(
      'I am also planning a separate reception in Hyderabad',
      candidateFromEventState(wedding),
      [candidateFromEventState(wedding)!],
    );
    expect(result.kind).toBe('ambiguous');
  });

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

  it('keeps the complete wedding/reception reference sequence and services isolated', () => {
    const wedding = mapContextToEventState({
      eventId: EVENT_A, eventLabel: "sister's wedding", eventType: 'wedding', city: 'Hyderabad',
      guestCount: 500, budget: 1_000_000, requestedServices: ['photographer', 'wedding_decorator'],
    }, emptyEventState('conversation-a', EVENT_A));
    const reception = mapContextToEventState({
      eventId: EVENT_B, eventLabel: 'reception', eventType: 'reception', city: 'Hyderabad',
      guestCount: 200, budget: 400_000, requestedServices: ['catering_services'],
    }, emptyEventState('conversation-a', EVENT_B));
    const candidates = [candidateFromEventState(wedding)!, candidateFromEventState(reception)!];

    const weddingResult = resolveEventScope('What is my sister wedding budget?', candidates[1], candidates);
    const receptionResult = resolveEventScope('What is my reception budget?', candidates[0], candidates);
    const backToWedding = resolveEventScope('Going back to my wedding, what services did we discuss?', candidates[1], candidates);
    const followUp = resolveEventScope('What about photography?', candidates[0], candidates);

    expect(weddingResult.kind === 'resolved' && weddingResult.candidate.eventId).toBe(EVENT_A);
    expect(receptionResult.kind === 'resolved' && receptionResult.candidate.eventId).toBe(EVENT_B);
    expect(backToWedding.kind === 'resolved' && backToWedding.candidate.eventId).toBe(EVENT_A);
    expect(followUp.kind === 'resolved' && followUp.candidate.eventId).toBe(EVENT_A);

    const weddingContext = eventStateToPlannerContext(wedding);
    const receptionContext = eventStateToPlannerContext(reception);
    expect(EventBudgetPlanner.allocate(weddingContext).eventId).toBe(EVENT_A);
    expect(EventBudgetPlanner.allocate(receptionContext).eventId).toBe(EVENT_B);
    expect(weddingContext.requestedServices).toEqual(['photographer', 'wedding_decorator']);
    expect(receptionContext.requestedServices).toEqual(['catering_services']);
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
