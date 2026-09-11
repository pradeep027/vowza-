// ─── Event Memory (Phase 2) — unit tests ────────────────────────────────────
// Covers: initial capture, later-turn updates, corrections (latest-wins),
// vocabulary preservation, no cultural inference, field preservation,
// unknown-stays-unknown, and the compact memory context rendering.

import { describe, it, expect } from 'vitest';
import {
  extractUserEventVocabulary,
  extractExplicitCulturalFacts,
  applyTurnToEventState,
  buildMemoryContext,
  describeSupersessions,
} from '../eventMemory';
import { emptyEventState, applyContextUpdate } from '../eventState';

describe('Event Memory (Phase 2) — vocabulary', () => {
  it('captures "Kammari wedding" as raw wording', () => {
    expect(extractUserEventVocabulary("I'm planning a Kammari wedding in Telangana")).toBe('Kammari wedding');
  });

  it('keeps the canonical eventType separate from raw wording', () => {
    const { state } = applyTurnToEventState(
      emptyEventState(),
      "I'm planning a Kammari wedding in Telangana",
      { eventType: 'wedding', city: 'Hyderabad' },
    );
    expect(state.eventType).toBe('wedding');
    expect(state.eventTypeRaw).toBe('Kammari wedding');
  });

  it('plain messages do not invent vocabulary', () => {
    expect(extractUserEventVocabulary('Around 400 guests')).toBeNull();
  });

  it('does not label the event with a community from an identity clause', () => {
    // The vocabulary must be "wedding" — never "Kammari wedding" — because
    // "We are Kammari" is an identity statement, not an event description.
    expect(extractUserEventVocabulary("We are Kammari, planning a wedding")).toBe('wedding');
  });

  it('filler words never churn an existing vocabulary', () => {
    // "yes, wedding" must NOT replace "Kammari wedding" with plain "wedding".
    expect(extractUserEventVocabulary('yes wedding')).toBe('wedding');
  });
});

describe('Event Memory (Phase 2) — cultural facts are explicit-only', () => {
  it('"Kammari wedding" does NOT populate religion/community/region', () => {
    const facts = extractExplicitCulturalFacts("I'm planning a Kammari wedding in Telangana");
    expect(facts).toEqual({});
    const { state } = applyTurnToEventState(
      emptyEventState(),
      "I'm planning a Kammari wedding in Telangana",
      { eventType: 'wedding' },
    );
    expect(state.religion).toBeNull();
    expect(state.community).toBeNull();
    expect(state.region).toBeNull();
  });

  it('captures religion/community/region only when the user states them', () => {
    const facts = extractExplicitCulturalFacts("I'm a Hindu Kammari family from Telangana");
    expect(facts.religion?.toLowerCase()).toBe('hindu');
    expect(facts.community?.toLowerCase()).toBe('kammari');
    expect(facts.region).toBe('Telangana');
  });

  it('does not treat a religion word as a community', () => {
    const facts = extractExplicitCulturalFacts("I'm a Hindu family from Karnataka");
    expect(facts.religion).toBeDefined();
    expect(facts.community).toBeUndefined();
  });
});

describe('Event Memory (Phase 2) — multi-turn state', () => {
  it('scenario: wedding → guests 400 → guests 500 → engagement', () => {
    let s = emptyEventState();
    ({ state: s } = applyTurnToEventState(s, "I'm planning a wedding in Hyderabad", { eventType: 'wedding', city: 'Hyderabad' }));
    ({ state: s } = applyTurnToEventState(s, 'Around 400 guests', { guestCount: 400 }));
    expect(s.guests.count).toBe(400);
    expect(s.eventType).toBe('wedding'); // preserved
    expect(s.location.city).toBe('Hyderabad'); // preserved

    ({ state: s } = applyTurnToEventState(s, 'Actually, make that 500 guests', { guestCount: 500 }));
    expect(s.guests.count).toBe(500);
    expect(s.superseded['guests.count']).toEqual([400]);

    ({ state: s } = applyTurnToEventState(s, "It's actually an engagement, not a wedding", { eventType: 'engagement' }));
    expect(s.eventType).toBe('engagement');
    expect(s.superseded['eventType']).toEqual(['wedding']);
    expect(s.location.city).toBe('Hyderabad'); // untouched by the correction
  });

  it('later message without city does not erase the city', () => {
    let s = emptyEventState();
    ({ state: s } = applyTurnToEventState(s, 'Wedding in Hyderabad', { eventType: 'wedding', city: 'Hyderabad' }));
    ({ state: s } = applyTurnToEventState(s, 'I need photography', {}));
    expect(s.location.city).toBe('Hyderabad');
    expect(s.eventType).toBe('wedding');
  });

  it('budget and date corrections use latest-value-wins', () => {
    let s = emptyEventState();
    ({ state: s } = applyTurnToEventState(s, 'wedding, budget 5 lakh, June 10', { eventType: 'wedding', budget: 500000, eventDate: 'June 10' }));
    ({ state: s } = applyTurnToEventState(s, 'make it 7 lakh and June 25', { budget: 700000, eventDate: 'June 25' }));
    expect(s.budget.total).toBe(700000);
    expect(s.schedule.eventDate).toBe('June 25');
    expect(s.superseded['budget.total']).toEqual([500000]);
    expect(s.superseded['schedule.eventDate']).toEqual(['June 10']);
  });

  it('identical re-statements are no-ops (no duplicate history)', () => {
    let s = emptyEventState();
    ({ state: s } = applyTurnToEventState(s, 'Kammari wedding in Hyderabad', { eventType: 'wedding', city: 'Hyderabad' }));
    const before = JSON.stringify(s.superseded);
    ({ state: s } = applyTurnToEventState(s, 'yes, wedding in Hyderabad', { eventType: 'wedding', city: 'Hyderabad' }));
    expect(s.eventTypeRaw).toBe('Kammari wedding'); // not degraded
    expect(JSON.stringify(s.superseded)).toBe(before);
  });
});

describe('Event Memory (Phase 2) — compact memory context', () => {
  it('renders confirmed facts, user wording, stale values and unknowns', () => {
    let s = emptyEventState();
    ({ state: s } = applyTurnToEventState(s, "I'm planning a Kammari wedding in Hyderabad", { eventType: 'wedding', city: 'Hyderabad' }));
    ({ state: s } = applyTurnToEventState(s, '400 guests', { guestCount: 400 }));
    ({ state: s } = applyTurnToEventState(s, 'make that 500', { guestCount: 500 }));

    const ctx = buildMemoryContext(s);
    expect(ctx).toContain('Event: wedding (user said: "Kammari wedding")');
    expect(ctx).toContain('Location: Hyderabad');
    expect(ctx).toContain('Guests: 500');
    expect(ctx).toContain('guests.count (previously 400)');
    expect(ctx).toContain('NEVER assume');
    expect(ctx).not.toContain('"eventType":'); // no JSON dumps
  });

  it('empty state renders nothing assumed', () => {
    const ctx = buildMemoryContext(emptyEventState());
    expect(ctx).toContain('(nothing yet)');
    expect(ctx).toContain('event type');
  });
});

describe('Event Memory (Phase 2) — supersession descriptions', () => {
  it('lists correction history in order', () => {
    let s = emptyEventState();
    ({ state: s } = applyTurnToEventState(s, '400 guests', { guestCount: 400 }));
    ({ state: s } = applyTurnToEventState(s, '500 guests', { guestCount: 500 }));
    ({ state: s } = applyTurnToEventState(s, '600 guests', { guestCount: 600 }));
    const lines = describeSupersessions(s);
    expect(lines).toEqual(['guests.count: 400 → 500 (current: 600)']);
  });

  it('applyContextUpdate still works standalone (compat)', () => {
    const s = emptyEventState();
    const { state } = applyContextUpdate(s, { city: 'Warangal' });
    expect(state.location.city).toBe('Warangal');
  });
});
