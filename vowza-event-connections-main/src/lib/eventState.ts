// ─── Event State — canonical model (Phase 1) ─────────────────────────────────
//
// This is the single source of truth for what the planner knows about the
// user's event. It is deliberately SEPARATE from:
//   • PlannerContext (aiPlannerTypes) — the legacy regex-extraction context
//     that the current planning engine consumes. Event State is a superset;
//     PlannerContext remains the planner-facing projection for now.
//   • ai_conversations.context_summary — the persisted PlannerContext.
//     Event State is stored in its own table (event_states) so the two can
//     evolve independently.
//
// Core principles encoded here (from the approved architecture):
//   1. Never assume religion / community / culture / traditions. These fields
//      exist so later phases can FILL them from explicit user input or
//      verified cultural knowledge — they are never defaulted.
//   2. Preserve the user's own vocabulary (eventTypeRaw) alongside the
//      canonical event type, so "Kammari wedding" is not flattened to
//      "wedding" and lost.
//   3. Every merge produces a change log so version history and the future
//      conversation memory layer can show what changed and why.
//
// All functions in this file are PURE (no I/O) so they are trivially
// testable. Persistence lives in eventStateRepository.ts; orchestration in
// eventStateBridge.ts.

import type { PlannerContext, LuxuryLevel } from './aiPlannerTypes';

// ─── Canonical Event State document ──────────────────────────────────────────
export interface EventState {
  /** Bump when the shape changes; lets old stored states be migrated. */
  schemaVersion: 1;

  /** Owning conversation thread (null until persisted). */
  conversationId: string | null;

  // ── Event identity ─────────────────────────────────────────────────────────
  /** Canonical event category (PlannerContext vocabulary) or null. */
  eventType: string | null;
  /** The user's own words for the event, e.g. "Kammari wedding". NEVER overwritten. */
  eventTypeRaw: string | null;

  // ── Cultural dimensions — NEVER auto-assumed, never defaulted ───────────────
  religion: string | null;
  community: string | null;
  culture: string | null;
  /** Regional tradition noted by the user (e.g. "Telangana style"). */
  region: string | null;

  // ── Location ───────────────────────────────────────────────────────────────
  location: {
    city: string | null;
    /** Locality/area hint (e.g. "Banjara Hills") — not a city. */
    area: string | null;
    venueName: string | null;
    hasVenue: boolean | null;
  };

  // ── Schedule ───────────────────────────────────────────────────────────────
  schedule: {
    /** ISO date or free text ("next month") as provided by the user. */
    eventDate: string | null;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null;
    durationDays: number | null;
  };

  // ── Scale ──────────────────────────────────────────────────────────────────
  guests: { count: number | null };
  budget: {
    total: number | null;
    currency: 'INR';
    /** Canonical LuxuryLevel from aiPlannerTypes — one vocabulary, no drift. */
    luxuryLevel: LuxuryLevel | null;
  };

  // ── Style & preferences ────────────────────────────────────────────────────
  style: {
    theme: string | null;
    colorPalette: string | null;
    vibe: 'traditional' | 'modern' | null;
    foodPreference: 'veg' | 'non-veg' | 'both' | null;
    serviceStyle: 'buffet' | 'table_service' | null;
  };

  /** Multi-ceremony events (weddings): sub-ceremonies and their status. */
  ceremonies: Array<{ name: string; status: 'planned' | 'confirmed' | 'done'; date?: string }>;

  // ── Requirements ───────────────────────────────────────────────────────────
  requirements: {
    specialRequirements: string | null;
    /** Services the user explicitly does NOT want. */
    excludedServices: string[];
  };

  // ── Vendor engagement (provider_profiles.provider_id references) ───────────
  vendors: {
    /** Shortlisted vendor ids, in the order the user shortlisted them. */
    shortlisted: string[];
    selected: string[];
    /** Booking ids created through the existing booking flow. */
    bookings: string[];
  };

  /** Provenance: fields the user explicitly confirmed (not inferred). */
  confirmedFields: string[];

  /**
   * Phase 2: values the user EXPLICITLY corrected. Keyed by dotted field
   * path, ordered oldest → newest (history preserved in-document so no
   * extra table is needed — snapshots still go to event_state_versions).
   * Used to (a) mark stale values so they are never treated as current and
   * (b) let the memory context show "previously 400, now 500".
   */
  superseded: Partial<Record<string, unknown[]>>;

  /** ISO-8601 timestamp of the last merge. */
  updatedAt: string;
}

// ─── Change log entry ────────────────────────────────────────────────────────
export interface FieldChange {
  /** Dotted path into the Event State, e.g. "location.city". */
  field: string;
  previous: unknown;
  next: unknown;
  /** Where the change came from. */
  source: 'user_message' | 'system';
}

// ─── Factories ───────────────────────────────────────────────────────────────

/** A completely empty state — nothing is assumed. */
export function emptyEventState(conversationId: string | null = null): EventState {
  return {
    schemaVersion: 1,
    conversationId,
    eventType: null,
    eventTypeRaw: null,
    religion: null,
    community: null,
    culture: null,
    region: null,
    location: { city: null, area: null, venueName: null, hasVenue: null },
    schedule: { eventDate: null, timeOfDay: null, durationDays: null },
    guests: { count: null },
    budget: { total: null, currency: 'INR', luxuryLevel: null },
    style: { theme: null, colorPalette: null, vibe: null, foodPreference: null, serviceStyle: null },
    ceremonies: [],
    requirements: { specialRequirements: null, excludedServices: [] },
    vendors: { shortlisted: [], selected: [], bookings: [] },
    confirmedFields: [],
    superseded: {},
    updatedAt: new Date().toISOString(),
  };
}

// ─── Scalar comparison helper ────────────────────────────────────────────────
function sameScalar(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Treat empty string as null so "" never masquerades as new information.
  const norm = (v: unknown) => (v === '' ? null : v);
  return norm(a) === norm(b);
}

// ─── Projection: PlannerContext → Event State ────────────────────────────────
//
// Maps the legacy extraction context onto the canonical model. This is a
// PROJECTION, not an assumption engine: only what the user actually provided
// (present in PlannerContext) is written. Cultural fields stay null — they
// will be filled in later phases from explicit conversation, never guessed.
export function mapContextToEventState(
  ctx: PlannerContext,
  prev?: EventState | null,
  conversationId: string | null = null,
): EventState {
  const base = prev ? structuredCloneState(prev) : emptyEventState(conversationId);
  const changes: FieldChange[] = [];

  // Generic: callers pass the typed current field and the new value of the
  // same type, so the assignment sites keep full type safety. When a
  // previously-confirmed value is replaced, the old value moves to
  // `superseded[field]` (latest-value-wins with history — Phase 2).
  const set = <T>(field: string, current: T, next: T): T => {
    if (!sameScalar(current, next)) {
      if (current !== null && current !== undefined && current !== '') {
        const list = base.superseded[field] ?? [];
        list.push(current);
        base.superseded[field] = list;
      }
      changes.push({ field, previous: current, next, source: 'user_message' as const });
    }
    return next;
  };

  base.conversationId = base.conversationId ?? conversationId;

  if (ctx.eventType !== undefined) {
    base.eventType = set('eventType', base.eventType, ctx.eventType);
  }
  if (ctx.city !== undefined) {
    base.location.city = set('location.city', base.location.city, ctx.city);
  }
  if (ctx.locality !== undefined) {
    base.location.area = set('location.area', base.location.area, ctx.locality);
  }
  if (ctx.venueName !== undefined) {
    base.location.venueName = set('location.venueName', base.location.venueName, ctx.venueName);
  }
  if (ctx.hasVenue !== undefined) {
    base.location.hasVenue = set('location.hasVenue', base.location.hasVenue, ctx.hasVenue);
  }
  if (ctx.eventDate !== undefined) {
    base.schedule.eventDate = set('schedule.eventDate', base.schedule.eventDate, ctx.eventDate);
  }
  if (ctx.timeOfDay !== undefined) {
    base.schedule.timeOfDay = set('schedule.timeOfDay', base.schedule.timeOfDay, ctx.timeOfDay);
  }
  if (ctx.durationDays !== undefined) {
    base.schedule.durationDays = set('schedule.durationDays', base.schedule.durationDays, ctx.durationDays);
  }
  if (ctx.guestCount !== undefined) {
    base.guests.count = set('guests.count', base.guests.count, ctx.guestCount);
  }
  if (ctx.budget !== undefined) {
    base.budget.total = set('budget.total', base.budget.total, ctx.budget);
  }
  if (ctx.luxuryLevel !== undefined) {
    base.budget.luxuryLevel = set('budget.luxuryLevel', base.budget.luxuryLevel, ctx.luxuryLevel);
  }
  if (ctx.theme !== undefined) {
    base.style.theme = set('style.theme', base.style.theme, ctx.theme);
  }
  if (ctx.colorPalette !== undefined) {
    base.style.colorPalette = set('style.colorPalette', base.style.colorPalette, ctx.colorPalette);
  }
  if (ctx.styleVibe !== undefined) {
    base.style.vibe = set('style.vibe', base.style.vibe, ctx.styleVibe);
  }
  if (ctx.foodPreference !== undefined) {
    base.style.foodPreference = set('style.foodPreference', base.style.foodPreference, ctx.foodPreference);
  }
  if (ctx.serviceStyle !== undefined) {
    base.style.serviceStyle = set('style.serviceStyle', base.style.serviceStyle, ctx.serviceStyle);
  }
  if (ctx.specialRequirements !== undefined) {
    base.requirements.specialRequirements = set(
      'requirements.specialRequirements',
      base.requirements.specialRequirements,
      ctx.specialRequirements,
    );
  }

  // Track which canonical fields were explicitly present in the context.
  for (const change of changes) {
    if (!base.confirmedFields.includes(change.field)) {
      base.confirmedFields.push(change.field);
    }
  }

  if (changes.length > 0) base.updatedAt = new Date().toISOString();
  return base;
}

// ─── Merge: apply a PlannerContext-shaped update onto an existing state ──────
// Returns the new state plus the change log. `changes.length === 0` means the
// update was a no-op (callers can skip persistence).
export function applyContextUpdate(
  prev: EventState,
  updates: PlannerContext,
): { state: EventState; changes: FieldChange[] } {
  const next = mapContextToEventState(updates, prev);
  return { state: next, changes: diffEventStates(prev, next) };
}

// ─── Diff between two states ─────────────────────────────────────────────────
export function diffEventStates(a: EventState, b: EventState): FieldChange[] {
  const changes: FieldChange[] = [];
  const paths: Array<[string, unknown, unknown]> = [
    ['eventType', a.eventType, b.eventType],
    ['religion', a.religion, b.religion],
    ['community', a.community, b.community],
    ['culture', a.culture, b.culture],
    ['region', a.region, b.region],
    ['location.city', a.location.city, b.location.city],
    ['location.area', a.location.area, b.location.area],
    ['location.venueName', a.location.venueName, b.location.venueName],
    ['location.hasVenue', a.location.hasVenue, b.location.hasVenue],
    ['schedule.eventDate', a.schedule.eventDate, b.schedule.eventDate],
    ['schedule.timeOfDay', a.schedule.timeOfDay, b.schedule.timeOfDay],
    ['schedule.durationDays', a.schedule.durationDays, b.schedule.durationDays],
    ['guests.count', a.guests.count, b.guests.count],
    ['budget.total', a.budget.total, b.budget.total],
    ['budget.luxuryLevel', a.budget.luxuryLevel, b.budget.luxuryLevel],
    ['style.theme', a.style.theme, b.style.theme],
    ['style.colorPalette', a.style.colorPalette, b.style.colorPalette],
    ['style.vibe', a.style.vibe, b.style.vibe],
    ['style.foodPreference', a.style.foodPreference, b.style.foodPreference],
    ['style.serviceStyle', a.style.serviceStyle, b.style.serviceStyle],
    ['requirements.specialRequirements', a.requirements.specialRequirements, b.requirements.specialRequirements],
  ];
  for (const [field, prevVal, nextVal] of paths) {
    if (!sameScalar(prevVal, nextVal)) {
      changes.push({ field, previous: prevVal, next: nextVal, source: 'user_message' });
    }
  }
  return changes;
}

// ─── Explicit vocabulary capture (no regex inference) ────────────────────────
// Later phases call this with text the user ACTUALLY typed for their event.
// It never rewrites the canonical eventType — both are kept.
export function setRawEventType(state: EventState, raw: string): EventState {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === state.eventTypeRaw) return state;
  const next = structuredCloneState(state);
  next.eventTypeRaw = trimmed;
  if (state.eventTypeRaw === null) {
    // First time the user names the event — record it as confirmed.
    if (!next.confirmedFields.includes('eventTypeRaw')) next.confirmedFields.push('eventTypeRaw');
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

// ─── Explicit cultural facts (Phase 2) ──────────────────────────────────────
// Called ONLY with values the user stated about themselves ("I'm a Hindu
// Kammari family from Telangana") — never with values inferred from an event
// name. Corrections are recorded as supersessions like every other field.
export function setExplicitCulturalFacts(
  state: EventState,
  facts: { religion?: string; community?: string; culture?: string; region?: string },
): { state: EventState; changes: FieldChange[] } {
  const next = structuredCloneState(state);
  const changes: FieldChange[] = [];

  const apply = (field: keyof Pick<EventState, 'religion' | 'community' | 'culture' | 'region'>, value: string | undefined) => {
    if (value === undefined) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!sameScalar(next[field], trimmed)) {
      if (next[field] !== null && next[field] !== '') {
        const list = next.superseded[field] ?? [];
        list.push(next[field]);
        next.superseded[field] = list;
      }
      changes.push({ field, previous: next[field], next: trimmed, source: 'user_message' });
      next[field] = trimmed;
    }
    if (!next.confirmedFields.includes(field)) next.confirmedFields.push(field);
  };

  apply('religion', facts.religion);
  apply('community', facts.community);
  apply('culture', facts.culture);
  apply('region', facts.region);

  if (changes.length > 0) next.updatedAt = new Date().toISOString();
  return { state: next, changes };
}

// ─── Vendor shortlist helpers (provider_ids from the trusted retriever) ──────
export function addToShortlist(state: EventState, providerId: string): EventState {
  if (!providerId || state.vendors.shortlisted.includes(providerId)) return state;
  const next = structuredCloneState(state);
  next.vendors.shortlisted.push(providerId);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function removeFromShortlist(state: EventState, providerId: string): EventState {
  if (!state.vendors.shortlisted.includes(providerId)) return state;
  const next = structuredCloneState(state);
  next.vendors.shortlisted = next.vendors.shortlisted.filter(id => id !== providerId);
  next.updatedAt = new Date().toISOString();
  return next;
}

// ─── Validation for states read back from persistence ────────────────────────
// Fail-closed: anything that doesn't look like an Event State returns null so
// callers fall back to an empty state instead of crashing the chat.
// Tolerates Phase 1 documents (no `superseded` yet): a normalized copy is
// returned through the type predicate path so old rows keep loading.
export function isValidEventState(value: unknown): value is EventState {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (
    v.schemaVersion === 1 &&
    typeof v.location === 'object' && v.location !== null &&
    typeof v.schedule === 'object' && v.schedule !== null &&
    typeof v.guests === 'object' && v.guests !== null &&
    typeof v.budget === 'object' && v.budget !== null &&
    typeof v.style === 'object' && v.style !== null &&
    typeof v.requirements === 'object' && v.requirements !== null &&
    typeof v.vendors === 'object' && v.vendors !== null &&
    Array.isArray(v.confirmedFields)
  ) {
    // Backfill Phase 2 field in place for legacy documents.
    if (!v.superseded || typeof v.superseded !== 'object') v.superseded = {};
    return true;
  }
  return false;
}

// ─── Deep clone (JSON-safe: the state only holds JSON values) ────────────────
export function structuredCloneState(state: EventState): EventState {
  return JSON.parse(JSON.stringify(state)) as EventState;
}
