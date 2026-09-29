// ─── Event State Bridge — event-scoped orchestration ─────────────────────────
import type { PlannerContext } from './aiPlannerTypes';
import type { EventState, FieldChange } from './eventState';
import { emptyEventState, diffEventStates, structuredCloneState } from './eventState';
import { applyTurnToEventState } from './eventMemory';
import { extractEventLabel } from './eventScope';
import {
  getEventState,
  listEventStatesForConversation as loadEventStatesForConversation,
  listEventStatesForUser,
  saveEventState,
} from './eventStateRepository';

// Each conversation owns independent event documents. activeEventIds is the
// conversational focus; switching it never mutates another event document.
const eventStateCache = new Map<string, Map<string, EventState>>();
const activeEventIds = new Map<string, string>();
const CACHE_LIMIT = 20;

function cacheSet(conversationId: string, state: EventState, activate = true): void {
  if (!state.eventId) return;
  const events = eventStateCache.get(conversationId) ?? new Map<string, EventState>();
  events.set(state.eventId, state);
  eventStateCache.set(conversationId, events);
  if (activate) activeEventIds.set(conversationId, state.eventId);
  if (eventStateCache.size > CACHE_LIMIT) {
    const oldest = eventStateCache.keys().next().value;
    if (oldest && oldest !== conversationId) {
      eventStateCache.delete(oldest);
      activeEventIds.delete(oldest);
    }
  }
}

export function getCachedEventState(conversationId: string | null, eventId?: string | null): EventState | null {
  if (!conversationId) return null;
  const events = eventStateCache.get(conversationId);
  const id = eventId ?? activeEventIds.get(conversationId);
  return id ? events?.get(id) ?? null : events?.values().next().value ?? null;
}

export function getActiveEventId(conversationId: string | null): string | null {
  return conversationId ? activeEventIds.get(conversationId) ?? null : null;
}

export async function restoreEventState(
  conversationId: string,
  userId: string | null,
  eventId?: string,
): Promise<EventState> {
  const cached = getCachedEventState(conversationId, eventId);
  if (cached && (!eventId || cached.eventId === eventId)) return cached;
  if (!userId) {
    const fresh = emptyEventState(conversationId, eventId ?? crypto.randomUUID());
    cacheSet(conversationId, fresh);
    return fresh;
  }

  if (!eventId) {
    const persistedStates = await loadEventStatesForConversation(conversationId, userId);
    persistedStates.forEach((state) => cacheSet(conversationId, state, false));
    const activeId = activeEventIds.get(conversationId);
    const state = (activeId && getCachedEventState(conversationId, activeId))
      ?? [...persistedStates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      ?? emptyEventState(conversationId, crypto.randomUUID());
    cacheSet(conversationId, state);
    return state;
  }

  const persisted = await getEventState(conversationId, userId, eventId);
  const state = persisted ?? emptyEventState(conversationId, eventId);
  cacheSet(conversationId, state);
  return state;
}

export async function listEventStatesForConversation(conversationId: string, userId: string): Promise<EventState[]> {
  const states = await loadEventStatesForConversation(conversationId, userId);
  states.forEach((state) => cacheSet(conversationId, state, false));
  return states;
}

/** Load event scopes for explicit cross-conversation resolution. */
export async function listUserEventStates(userId: string): Promise<EventState[]> {
  return listEventStatesForUser(userId);
}

export function activateEventStateForConversation(conversationId: string, state: EventState): EventState {
  const active = { ...structuredCloneState(state), conversationId };
  cacheSet(conversationId, active, true);
  return active;
}

export interface EventStateSyncResult {
  state: EventState | null;
  changes: FieldChange[];
  persisted: boolean;
  persistedToMemoryOnly: boolean;
  outcome: 'persisted' | 'persistedToMemoryOnly' | 'skipped' | 'failed';
  error?: string;
}

export async function syncEventStateFromContext(
  conversationId: string,
  userId: string | null,
  context: PlannerContext,
): Promise<EventState | null> {
  const result = await syncEventStateFromTurn(conversationId, userId, '', context);
  return result.state;
}

export async function syncEventStateFromTurn(
  conversationId: string,
  userId: string | null,
  userMessage: string,
  updates: PlannerContext,
): Promise<EventStateSyncResult> {
  try {
    const requestedEventId = updates.eventId ?? getActiveEventId(conversationId) ?? undefined;
    const prev = (requestedEventId && getCachedEventState(conversationId, requestedEventId))
      ?? await restoreEventState(conversationId, userId, requestedEventId);
    const scopedUpdates: PlannerContext = {
      ...updates,
      eventId: updates.eventId ?? prev.eventId ?? crypto.randomUUID(),
      eventLabel: extractEventLabel(userMessage) ?? updates.eventLabel ?? prev.eventLabel ?? updates.eventType,
    };
    const { state: next, changes } = applyTurnToEventState(prev, userMessage, scopedUpdates);

    if (changes.length === 0) {
      cacheSet(conversationId, next);
      return { state: next, changes, persisted: false, persistedToMemoryOnly: false, outcome: 'skipped' };
    }

    if (userId) {
      const version = await saveEventState(conversationId, userId, next);
      if (version === null) {
        cacheSet(conversationId, next);
        return {
          state: next, changes, persisted: false, persistedToMemoryOnly: true,
          outcome: 'persistedToMemoryOnly',
          error: 'Event State persistence failed — kept in session memory only.',
        };
      }
      cacheSet(conversationId, next);
      return { state: next, changes, persisted: true, persistedToMemoryOnly: false, outcome: 'persisted' };
    }

    cacheSet(conversationId, next);
    return { state: next, changes, persisted: false, persistedToMemoryOnly: true, outcome: 'persistedToMemoryOnly' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[EventStateBridge] sync failed (chat continues normally):', msg);
    return { state: null, changes: [], persisted: false, persistedToMemoryOnly: false, outcome: 'failed', error: msg };
  }
}

export function describeStateChanges(before: EventState, after: EventState): string[] {
  return diffEventStates(before, after).map(c => `${c.field}: ${String(c.previous ?? '—')} → ${String(c.next ?? '—')}`);
}

export function resetEventStateForConversation(conversationId: string | null): void {
  if (conversationId) {
    eventStateCache.delete(conversationId);
    activeEventIds.delete(conversationId);
  }
}

export function resetAllEventStateMemory(): void {
  eventStateCache.clear();
  activeEventIds.clear();
}
