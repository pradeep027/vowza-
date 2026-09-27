import { describe, expect, it } from 'vitest';
import {
  buildRecallQuery,
  buildRetentionRecord,
  hindsightBankIdForUser,
  mergePlannerMemoryContext,
  plannerContextFromMetadata,
  sanitizeRecallQuery,
  summarizeRecallResults,
  shouldRecallPlannerMemory,
} from '../../../supabase/functions/_shared/plannerMemory';

const CONVERSATION_ID = '00000000-0000-4000-8000-000000000002';
const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000003';

function eventState(overrides: Record<string, unknown> = {}) {
  return {
    eventType: 'wedding',
    location: { city: 'Hyderabad', area: 'Banjara Hills' },
    schedule: { eventDate: '2027-02-21', durationDays: 2 },
    guests: { count: 500 },
    budget: { total: 700_000, luxuryLevel: 'standard' },
    style: {
      theme: 'traditional',
      colorPalette: 'sage and gold',
      vibe: 'traditional',
      foodPreference: 'veg',
      serviceStyle: 'buffet',
    },
    requirements: { specialRequirements: 'private phone 9876543210', excludedServices: ['fireworks'] },
    religion: 'must never be retained',
    updatedAt: '2026-09-27T12:00:00.000Z',
    ...overrides,
  };
}

describe('Planner persistent memory adapter', () => {
  it('derives a distinct server-side Hindsight bank for each authenticated user', () => {
    expect(hindsightBankIdForUser(USER_A)).toBe(`vowza-user-${USER_A}`);
    expect(hindsightBankIdForUser(USER_A)).not.toBe(hindsightBankIdForUser(USER_B));
    expect(hindsightBankIdForUser('not-a-supabase-uuid')).toBeNull();
  });

  it('redacts contact and secret-like values from recall queries', () => {
    const sanitized = sanitizeRecallQuery('Plan my wedding; email a@example.com, phone +91 98765 43210, api key: abc123');
    expect(sanitized).toContain('[email]');
    expect(sanitized).toContain('[contact number]');
    expect(sanitized).toContain('[redacted]');
    expect(sanitized).not.toContain('api key');
    expect(sanitized).not.toContain('a@example.com');
    expect(sanitized).not.toContain('98765');
    expect(sanitized).not.toContain('abc123');
    expect(sanitizeRecallQuery('The event date is 2027-02-21.')).toContain('2027-02-21');
  });

  it('builds the recall query from the user request and relevant known event fields', () => {
    const query = buildRecallQuery('Find photographers for the event', {
      eventType: 'wedding', city: 'Hyderabad', guestCount: 500,
    });
    expect(query).toContain('Find photographers');
    expect(query).toContain('event type wedding');
    expect(query).toContain('city Hyderabad');
    expect(query).toContain('guest count 500');
  });

  it('extracts only Vowza-owned, typed metadata and rejects invalid values', () => {
    expect(plannerContextFromMetadata({
      vowza_source: 'planner-event-state',
      vowza_event_type: 'wedding',
      vowza_city: 'Hyderabad',
      vowza_guest_count: '500',
      vowza_budget_inr: '700000',
      vowza_religion: 'should not be read',
    })).toEqual({ eventType: 'wedding', city: 'Hyderabad', guestCount: 500, budget: 700_000 });
    expect(plannerContextFromMetadata({ vowza_source: 'other', vowza_city: 'Chennai' })).toEqual({});
    expect(plannerContextFromMetadata({ vowza_source: 'planner-event-state', vowza_event_type: 'unknown', vowza_guest_count: '-1' })).toEqual({});
  });

  it('uses the newest snapshot so older cross-conversation values do not resurface', () => {
    const result = summarizeRecallResults([
      { text: 'Older budget INR 500000.', metadata: {
        vowza_source: 'planner-event-state', vowza_event_type: 'wedding', vowza_city: 'Hyderabad',
        vowza_guest_count: '500', vowza_budget_inr: '500000', vowza_updated_at: '2026-09-01T12:00:00.000Z',
      } },
      { text: 'Current budget INR 700000.', metadata: {
        vowza_source: 'planner-event-state', vowza_event_type: 'wedding',
        vowza_budget_inr: '700000', vowza_updated_at: '2026-09-20T12:00:00.000Z',
      } },
    ]);
    expect(result.context).toEqual({ eventType: 'wedding', city: 'Hyderabad', guestCount: 500, budget: 700_000 });
    expect(result.memories).toEqual(['Current budget INR 700000.']);

    const scoped = summarizeRecallResults([
      { text: 'New birthday event in Mumbai.', metadata: {
        vowza_source: 'planner-event-state', vowza_event_type: 'birthday', vowza_city: 'Mumbai',
        vowza_updated_at: '2026-09-25T12:00:00.000Z',
      } },
      { text: 'Wedding in Hyderabad.', metadata: {
        vowza_source: 'planner-event-state', vowza_event_type: 'wedding', vowza_city: 'Hyderabad',
        vowza_updated_at: '2026-09-20T12:00:00.000Z',
      } },
    ], { eventType: 'wedding' });
    expect(scoped.context).toEqual({ eventType: 'wedding', city: 'Hyderabad' });
    expect(scoped.memories).toEqual(['Wedding in Hyderabad.']);
  });

  it('keeps the current conversation authoritative and suppresses a conflicting event type', () => {
    expect(mergePlannerMemoryContext(
      { eventType: 'wedding', city: 'Pune', budget: 900_000 },
      { eventType: 'wedding', city: 'Hyderabad', budget: 700_000, guestCount: 500 },
    )).toEqual({ eventType: 'wedding', city: 'Pune', budget: 900_000, guestCount: 500 });
    expect(mergePlannerMemoryContext(
      { eventType: 'birthday', city: 'Mumbai' },
      { eventType: 'wedding', city: 'Hyderabad', budget: 700_000 },
    )).toEqual({ eventType: 'birthday', city: 'Mumbai' });
  });

  it('retains a normalized allow-listed snapshot only after an explicit meaningful change', () => {
    const record = buildRetentionRecord(
      eventState(),
      ['budget.total', 'religion'],
      'My budget is ₹7 lakh for the wedding.',
      CONVERSATION_ID,
    );
    expect(record).not.toBeNull();
    expect(record?.content).toContain('Current total event budget: INR 700000');
    expect(record?.content).toContain('Event city: Hyderabad');
    expect(record?.content).not.toContain('religion');
    expect(record?.content).not.toContain('9876543210');
    expect(record?.content).not.toContain('private phone');
    expect(record?.metadata).toMatchObject({
      vowza_source: 'planner-event-state',
      vowza_budget_inr: '700000',
      vowza_city: 'Hyderabad',
    });
    expect(record?.documentId).toBe(CONVERSATION_ID);
    expect(record?.tags).toEqual(['vowza-planner']);
  });

  it('does not retain generic requests, memory-derived details, or sensitive-only changes', () => {
    expect(buildRetentionRecord(eventState(), ['budget.total'], 'Find photographers for me', CONVERSATION_ID)).toBeNull();
    expect(buildRetentionRecord(eventState(), ['religion', 'community'], 'I am Hindu', CONVERSATION_ID)).toBeNull();
    expect(buildRetentionRecord(eventState(), ['budget.total'], 'What do you remember about my event?', CONVERSATION_ID)).toBeNull();
  });

  it('scrubs sensitive substrings even when they appear inside allowed state fields', () => {
    const state = eventState({
      location: { city: 'Hyderabad +91 98765 43210', area: 'email a@example.com' },
      style: {
        theme: 'api key: leaked123', colorPalette: 'sage and gold', vibe: 'traditional',
        foodPreference: 'veg', serviceStyle: 'buffet',
      },
    });
    const record = buildRetentionRecord(state, ['style.theme'], 'Change the theme to something new.', CONVERSATION_ID);
    expect(record?.content).toContain('[contact number]');
    expect(record?.content).toContain('[email]');
    expect(record?.content).toContain('[redacted]');
    expect(record?.content).not.toContain('98765');
    expect(record?.content).not.toContain('a@example.com');
    expect(record?.content).not.toContain('leaked123');
  });

  it('retains the latest corrected value and does not re-emit superseded values', () => {
    const state = eventState({ budget: { total: 700_000, luxuryLevel: 'standard' } });
    const record = buildRetentionRecord(state, ['budget.total'], 'Actually, make the budget ₹7 lakh instead of ₹5 lakh.', CONVERSATION_ID);
    expect(record?.content).toContain('INR 700000');
    expect(record?.content).not.toContain('500000');
    expect(record?.metadata.vowza_budget_inr).toBe('700000');
  });

  it('refuses invalid conversation identifiers rather than creating an unscoped document', () => {
    expect(buildRetentionRecord(eventState(), ['location.city'], 'The event is in Hyderabad.', 'other')).toBeNull();
  });

  it('recalls only for memory questions or relevant planning turns missing core context', () => {
    expect(shouldRecallPlannerMemory('What do you remember about my event?', 'general_question', {})).toBe(true);
    expect(shouldRecallPlannerMemory('Find photographers', 'find_vendors', {})).toBe(true);
    expect(shouldRecallPlannerMemory('Find photographers', 'find_vendors', {
      eventType: 'wedding', city: 'Hyderabad', guestCount: 500, budget: 700_000,
    })).toBe(false);
    expect(shouldRecallPlannerMemory('Tell me a joke', 'general_question', {})).toBe(false);
  });
});
