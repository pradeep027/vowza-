// ─── Event State (Phase 1) — unit tests ─────────────────────────────────────
// Covers the pure model: projection from PlannerContext, merge/change log,
// no-assumption guarantees for cultural fields, and fail-closed validation.
// The repository/bridge are I/O layers covered by typechecking and the
// graceful-fallback design (they never throw into the chat path).

import { describe, it, expect } from 'vitest';
import {
  emptyEventState,
  mapContextToEventState,
  applyContextUpdate,
  diffEventStates,
  setRawEventType,
  addToShortlist,
  removeFromShortlist,
  isValidEventState,
  structuredCloneState,
} from '../eventState';
import type { PlannerContext } from '../aiPlannerTypes';

describe('Event State (Phase 1) — canonical model', () => {
  it('empty state assumes NOTHING (cultural fields stay null)', () => {
    const s = emptyEventState();
    expect(s.eventType).toBeNull();
    expect(s.religion).toBeNull();
    expect(s.community).toBeNull();
    expect(s.culture).toBeNull();
    expect(s.region).toBeNull();
    expect(s.location.city).toBeNull();
    expect(s.guests.count).toBeNull();
    expect(s.confirmedFields).toEqual([]);
  });

  it('projects a PlannerContext into Event State', () => {
    const ctx: PlannerContext = {
      eventType: 'wedding',
      city: 'Hyderabad',
      budget: 500000,
      guestCount: 300,
    };
    const s = mapContextToEventState(ctx);
    expect(s.eventType).toBe('wedding');
    expect(s.location.city).toBe('Hyderabad');
    expect(s.budget.total).toBe(500000);
    expect(s.guests.count).toBe(300);
    // Nothing assumed beyond what the user gave:
    expect(s.religion).toBeNull();
    expect(s.community).toBeNull();
    expect(s.schedule.eventDate).toBeNull();
  });

  it('merges a correction and produces a change log ("actually it is an engagement")', () => {
    const first = mapContextToEventState({ eventType: 'wedding', city: 'Hyderabad' });
    const { state, changes } = applyContextUpdate(first, { eventType: 'engagement' });
    expect(state.eventType).toBe('engagement');
    expect(state.location.city).toBe('Hyderabad'); // preserved
    const eventTypeChange = changes.find(c => c.field === 'eventType');
    expect(eventTypeChange).toBeDefined();
    expect(eventTypeChange!.previous).toBe('wedding');
    expect(eventTypeChange!.next).toBe('engagement');
  });

  it('returns an empty change log for no-op updates', () => {
    const first = mapContextToEventState({ eventType: 'wedding', city: 'Hyderabad', guestCount: 300 });
    const { changes } = applyContextUpdate(first, { eventType: 'wedding', city: 'Hyderabad', guestCount: 300 });
    expect(changes).toEqual([]);
  });

  it('keeps user vocabulary via setRawEventType without touching the canonical type', () => {
    let s = mapContextToEventState({ eventType: 'wedding' });
    s = setRawEventType(s, "My sister's Kammari wedding");
    expect(s.eventTypeRaw).toBe("My sister's Kammari wedding");
    expect(s.eventType).toBe('wedding'); // canonical unchanged
    expect(s.confirmedFields).toContain('eventTypeRaw');
  });

  it('never defaults religion/community when planning a wedding', () => {
    const s = mapContextToEventState({ eventType: 'wedding', city: 'Warangal', guestCount: 500 });
    expect(s.religion).toBeNull();
    expect(s.community).toBeNull();
    expect(s.culture).toBeNull();
  });

  it('shortlist add/remove is idempotent and ordered', () => {
    let s = emptyEventState();
    s = addToShortlist(s, 'p-1');
    s = addToShortlist(s, 'p-2');
    s = addToShortlist(s, 'p-1'); // duplicate ignored
    expect(s.vendors.shortlisted).toEqual(['p-1', 'p-2']);
    s = removeFromShortlist(s, 'p-1');
    expect(s.vendors.shortlisted).toEqual(['p-2']);
    s = removeFromShortlist(s, 'p-1'); // no-op
    expect(s.vendors.shortlisted).toEqual(['p-2']);
  });

  it('diffEventStates reports only real changes', () => {
    const a = mapContextToEventState({ eventType: 'birthday', city: 'Hyderabad' });
    const b = structuredCloneState(a);
    b.location.city = 'Warangal';
    b.guests.count = 500;
    const changes = diffEventStates(a, b);
    const fields = changes.map(c => c.field);
    expect(fields).toContain('location.city');
    expect(fields).toContain('guests.count');
    expect(fields).not.toContain('eventType');
  });

  it('area/locality maps to location.area (never treated as city)', () => {
    const s = mapContextToEventState({ eventType: 'wedding', city: 'Hyderabad', locality: 'Banjara Hills' });
    expect(s.location.area).toBe('Banjara Hills');
    expect(s.location.city).toBe('Hyderabad');
  });

  it('isValidEventState fails closed on garbage', () => {
    expect(isValidEventState(null)).toBe(false);
    expect(isValidEventState('wedding')).toBe(false);
    expect(isValidEventState({})).toBe(false);
    expect(isValidEventState({ schemaVersion: 2 })).toBe(false);
    const real = emptyEventState();
    expect(isValidEventState(real)).toBe(true);
  });

  it('projection onto a previous state preserves unchanged fields and history', () => {
    const first = mapContextToEventState({ eventType: 'wedding', city: 'Hyderabad' });
    const second = mapContextToEventState({ guestCount: 500 }, first);
    expect(second.eventType).toBe('wedding');
    expect(second.location.city).toBe('Hyderabad');
    expect(second.guests.count).toBe(500);
    expect(second.confirmedFields).toContain('eventType');
    expect(second.confirmedFields).toContain('guests.count');
  });
});
