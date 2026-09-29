// ─── Event State Bridge — Phase 1 orchestration ──────────────────────────────
//
// Connects the chat pipeline to the Event State layer WITHOUT changing any
// existing behaviour:
//   • The regex extraction system (aiOrchestrator) stays the sole source of
//     structured updates — the bridge only PROJECTS its output into Event
//     State. No prompts or extraction logic are modified.
//   • context_summary persistence (PlannerContext on ai_conversations) is
//     untouched and continues to drive the current planning engine.
//   • Event State sync is fire-and-forget from the chat's perspective: any
//     failure is logged and swallowed so the conversation never breaks.
//
// Concurrency model: a per-tab cache holds the latest known state per
// conversation, so merges always build on the newest state without a read
// round-trip per message. The repository is the durability layer.

import type { PlannerContext } from './aiPlannerTypes';
import type { EventState, FieldChange } from './eventState';
import {
  applyContextUpdate,
  emptyEventState,
  diffEventStates,
  structuredCloneState,
} from './eventState';
import { applyTurnToEventState } from './eventMemory';
import { extractEventLabel } from './eventScope';
import {
  getEventState,
  listEventStatesForUser,
  saveEventState,
} from './eventStateRepository';

// ─── Per-tab cache of latest Event State per conversation ────────────────────
const eventStateCache = new Map<string, EventState>();
const CACHE_LIMIT = 20;

function cacheSet(conversationId: string, state: EventState): void {
  eventStateCache.set(conversationId, state);
  if (eventStateCache.size > CACHE_LIMIT) {
    const oldest = eventStateCache.keys().next().value;
    if (oldest) eventStateCache.delete(oldest);
  }
}

/** Synchronously read the cached state (no I/O). Used by UI affordances. */
export function getCachedEventState(conversationId: string | null): EventState | null {
  if (!conversationId) return null;
  return eventStateCache.get(conversationId) ?? null;
}

// ─── Restore: load Event State when a conversation is opened ─────────────────
export async function restoreEventState(
  conversationId: string,
  userId: string | null,
  eventId?: string,
): Promise<EventState> {
  const cached = eventStateCache.get(conversationId);
  if (cached && (!eventId || cached.eventId === eventId)) return cached;
  if (!userId) {
    const fresh = emptyEventState(conversationId);
    cacheSet(conversationId, fresh);
    return fresh;
  }
  const persisted = await getEventState(conversationId, userId, eventId);
  const state = persisted ?? emptyEventState(conversationId);
  cacheSet(conversationId, state);
  return state;
}

/** Load canonical event scopes for explicit cross-conversation resolution. */
export async function listUserEventStates(userId: string): Promise<EventState[]> {
  return listEventStatesForUser(userId);
}

/** Activate a resolved event in the current conversation cache. */
export function activateEventStateForConversation(conversationId: string, state: EventState): EventState {
  const active = { ...structuredCloneState(state), conversationId };
  cacheSet(conversationId, active);
  return active;
}

// ─── Sync: project a PlannerContext update into Event State and persist ──────
// Legacy entry point kept for compatibility — callers who only have the
// merged PlannerContext. Persistence failures are OBSERVABLE (see
// EventStateSyncResult.persisted) but never break the chat.
export async function syncEventStateFromContext(
  conversationId: string,
  userId: string | null,
  context: PlannerContext,
): Promise<EventState | null> {
  const result = await syncEventStateFromTurn(conversationId, userId, '', context);
  return result.state;
}

// ─── Sync: apply a full conversation turn (Phase 2) ──────────────────────────
// Flow: user message + orchestrator updates → Event State merge (latest-wins,
// vocabulary + explicit cultural facts) → persist via repository.
//
// Reliability contract:
//   • The outcome is RETURNED (persisted / memory-only / skipped / failed)
//     so callers know — and can surface — what actually happened.
//   • Persistence failures never throw into the chat; they are logged and
//     reported in the result. The UI must not claim "saved" on failure.
export interface EventStateSyncResult {
  state: EventState | null;
  changes: FieldChange[];
  /** Did the new state reach the event_states table? */
  persisted: boolean;
  /** true → memory-only fallback (anonymous or persistence failed). */
  persistedToMemoryOnly: boolean;
  /** 'skipped' = nothing changed this turn (nothing to persist). */
  outcome: 'persisted' | 'persistedToMemoryOnly' | 'skipped' | 'failed';
  error?: string;
}

export async function syncEventStateFromTurn(
  conversationId: string,
  userId: string | null,
  userMessage: string,
  updates: PlannerContext,
): Promise<EventStateSyncResult> {
  try {
    const prev = eventStateCache.get(conversationId) ?? await restoreEventState(conversationId, userId);

    // Empty message → no vocabulary, no cultural facts, pure context merge.
    const scopedUpdates: PlannerContext = {
      ...updates,
      eventId: updates.eventId ?? prev.eventId ?? crypto.randomUUID(),
      eventLabel: extractEventLabel(userMessage) ?? updates.eventLabel ?? prev.eventLabel ?? updates.eventType,
    };
    const { state: next, changes } = applyTurnToEventState(prev, userMessage, scopedUpdates);

    // `changes` is the authoritative no-op signal: every real modification
    // (context merge, vocabulary, cultural facts) records a change entry, so
    // an empty log means nothing actually changed — skip persistence.
    if (changes.length === 0) {
      cacheSet(conversationId, next);
      return { state: next, changes, persisted: false, persistedToMemoryOnly: false, outcome: 'skipped' };
    }

    if (userId) {
      const version = await saveEventState(conversationId, userId, next);
      if (version === null) {
        // Repository already logged the specific reason. The state lives on
        // in the per-tab cache so the conversation continues seamlessly.
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

    // Anonymous session: in-tab memory only (by design — RLS requires a user).
    cacheSet(conversationId, next);
    return { state: next, changes, persisted: false, persistedToMemoryOnly: true, outcome: 'persistedToMemoryOnly' };
  } catch (err) {
    // Never let Event State issues break the chat — but make them observable.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[EventStateBridge] sync failed (chat continues normally):', msg);
    return { state: null, changes: [], persisted: false, persistedToMemoryOnly: false, outcome: 'failed', error: msg };
  }
}

// ─── Diff helper for future UI (Phase 2 memory panel) ────────────────────────
export function describeStateChanges(before: EventState, after: EventState): string[] {
  return diffEventStates(before, after).map(
    c => `${c.field}: ${String(c.previous ?? '—')} → ${String(c.next ?? '—')}`,
  );
}

// ─── Teardown: clear per-tab state (New Chat) ────────────────────────────────
export function resetEventStateForConversation(conversationId: string | null): void {
  if (conversationId) eventStateCache.delete(conversationId);
}

export function resetAllEventStateMemory(): void {
  eventStateCache.clear();
}
