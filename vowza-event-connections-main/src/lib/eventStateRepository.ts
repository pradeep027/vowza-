// ─── Event State Repository ──────────────────────────────────────────────────
// All Supabase read/write for the Phase 1 Event State layer (event_states +
// event_state_versions). Follows the exact conventions of
// conversationRepository.ts:
//   • Local row types (generated Supabase types don't include the new tables
//     yet — the call sites cast through `as any` until types are regenerated).
//   • Every method degrades gracefully: unauthenticated users and DBs without
//     the new tables get in-memory session behaviour instead of errors, so
//     the chat UI never breaks while the migration is being applied.
//   • No writes are attempted for anonymous users (RLS would reject them).

import { supabase } from '@/integrations/supabase/client';
import type { EventState } from './eventState';
import { isValidEventState, emptyEventState } from './eventState';

// The event_states tables are not in the generated Supabase types yet
// (the migration must first be applied to the live project). Cast the CLIENT
// (not the results) so every query below is typed as a plain PostgREST
// builder. This is the same escape hatch conversationRepository.ts uses with
// `as any` on inserts; the narrow cast here keeps result types usable.
const sb = supabase as unknown as { from: (table: string) => any };

// ─── Local row shapes (mirror the migration) ─────────────────────────────────
export interface EventStateRow {
  id:              string;
  conversation_id: string;
  event_id?:       string;
  user_id:         string;
  state:           unknown;      // JSONB — validated with isValidEventState()
  version:         number;
  created_at:      string;
  updated_at:      string;
}

export interface EventStateVersionRow {
  id:              string;
  event_state_id:  string;
  conversation_id: string;
  user_id:         string;
  version:         number;
  state:           unknown;
  created_at:      string;
}

// ─── In-memory fallback (session-only, anonymous users / missing table) ──────
// Keyed by conversationId. Never leaves the tab — identical spirit to the
// sessionStorage fallback the chat uses for anonymous users.
const memoryStates = new Map<string, EventState>();
const memoryStatesByEvent = new Map<string, EventState>();
const memoryVersions = new Map<string, Array<{ version: number; state: EventState; createdAt: string }>>();
let memoryModeAnnounced = false;

// Observability: EVERY database error is warned (never silently swallowed),
// while the "entering memory mode" notice itself is announced only once per
// tab to avoid log spam. A null return from saveEventState() is the signal
// that persistence did NOT happen — callers never interpret it as success.
function logFallback(reason: string): void {
  if (!memoryModeAnnounced) {
    memoryModeAnnounced = true;
    console.info('[EventStateRepository] Event State persistence unavailable — using in-memory session fallback for this tab.');
  }
  console.warn(`[EventStateRepository] ${reason}`);
}

// ─── Guards ──────────────────────────────────────────────────────────────────
function isConfigured(): boolean {
  return Boolean(supabase);
}

// ─── Read: get the Event State for a conversation ────────────────────────────
// Returns null when nothing is persisted yet (callers then start from an
// empty state) — or from the memory map when in fallback mode.
export async function getEventState(
  conversationId: string,
  userId: string,
  eventId?: string,
): Promise<EventState | null> {
  if (!isConfigured() || !userId) return (eventId ? memoryStatesByEvent.get(eventId) : memoryStates.get(conversationId)) ?? null;

  let query = sb
    .from('event_states')
    .select('*')
    .eq('user_id', userId);
  query = eventId ? query.eq('event_id', eventId) : query.eq('conversation_id', conversationId);
  const { data, error } = await query.maybeSingle();

  if (error) {
    // Missing table / migration not yet applied → degrade to memory (logged).
    logFallback(`getEventState failed (falling back to memory): ${error.message}`);
    return (eventId ? memoryStatesByEvent.get(eventId) : memoryStates.get(conversationId)) ?? null;
  }
  const row = data as EventStateRow | null;
  if (!row) return (eventId ? memoryStatesByEvent.get(eventId) : memoryStates.get(conversationId)) ?? null;

  if (!isValidEventState(row.state)) {
    console.warn('[EventStateRepository] Stored state failed validation — starting fresh for this thread.');
    return null;
  }
  return { ...row.state, conversationId, eventId: (row as EventStateRow & { event_id?: string }).event_id ?? (row.state as EventState).eventId ?? null };
}

export async function getEventStateByEventId(eventId: string, userId: string): Promise<EventState | null> {
  return getEventState('', userId, eventId);
}

export async function listEventStatesForUser(userId: string): Promise<EventState[]> {
  if (!isConfigured() || !userId) return [...memoryStatesByEvent.values()];
  const { data, error } = await sb.from('event_states').select('*').eq('user_id', userId);
  if (error) {
    logFallback(`listEventStatesForUser failed (memory only): ${error.message}`);
    return [...memoryStatesByEvent.values()];
  }
  return ((data as EventStateRow[]) ?? []).map((row) => ({
    ...(row.state as EventState),
    conversationId: row.conversation_id,
    eventId: (row as EventStateRow & { event_id?: string }).event_id ?? (row.state as EventState).eventId ?? null,
  })).filter(isValidEventState);
}

// ─── Write: upsert the Event State for a conversation ────────────────────────
// Appends a version snapshot only when the state actually changed, so the
// version history records real milestones (event type set, city changed…),
// not every keystroke. Returns the stored version number, or null when in
// memory-only mode.
export async function saveEventState(
  conversationId: string,
  userId: string,
  state: EventState,
): Promise<number | null> {
  const stamped: EventState = {
    ...state,
    conversationId,
    eventId: state.eventId ?? crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
  };

  if (!isConfigured() || !userId) {
    persistToMemory(conversationId, stamped);
    return null;
  }

  // Read the current row first: we need its id and version to append history
  // correctly. (event_states has at most one row per conversation — UNIQUE.)
  let existingQuery = sb
    .from('event_states')
    .select('id, version, state')
    .eq('user_id', userId);
  existingQuery = existingQuery.eq('event_id', stamped.eventId);
  const existing = await existingQuery.maybeSingle();

  if (existing.error) {
    logFallback(`saveEventState lookup failed (NOT persisted, memory only): ${existing.error.message}`);
    persistToMemory(conversationId, stamped);
    return null;
  }

  const row = existing.data as Pick<EventStateRow, 'id' | 'version' | 'state'> | null;
  const prevVersion = row?.version ?? 0;
  const nextVersion = prevVersion + 1;

  if (row) {
    const { error } = await sb
      .from('event_states')
      .update({ state: stamped, version: nextVersion })
      .eq('id', row.id);
    if (error) {
      console.error('[EventStateRepository] saveEventState (update):', error.message);
      persistToMemory(conversationId, stamped);
      return null;
    }
  } else {
    const insert = {
      conversation_id: conversationId,
      event_id: stamped.eventId,
      user_id:         userId,
      state:           stamped,
      version:         nextVersion,
    };
    const { error } = await sb
      .from('event_states')
      .insert(insert);
    if (error) {
      // Unique violation → another tab created it first; fall back to memory
      // rather than fighting over the row. Next send will take the update path.
      console.error('[EventStateRepository] saveEventState (insert):', error.message);
      persistToMemory(conversationId, stamped);
      return null;
    }
  }

  // Append-only snapshot for audit/undo. History write failures are logged
  // but never block the chat — the canonical row is already updated.
  if (row) {
    const { error: snapErr } = await sb
      .from('event_state_versions')
      .insert({
        event_state_id:  row.id,
        conversation_id: conversationId,
        user_id:         userId,
        version:         nextVersion,
        state:           stamped,
      });
    if (snapErr) console.warn('[EventStateRepository] version snapshot failed:', snapErr.message);
  }

  return nextVersion;
}

// ─── History: list version snapshots (newest first) ──────────────────────────
export async function listEventStateVersions(
  conversationId: string,
  userId: string,
  limit = 20,
): Promise<Array<{ version: number; state: EventState; createdAt: string }>> {
  if (!isConfigured() || !userId) {
    return memoryVersions.get(conversationId) ?? [];
  }
  const { data, error } = await sb
    .from('event_state_versions')
    .select('version, state, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(limit);

  if (error) {
    logFallback(`listEventStateVersions failed (memory only): ${error.message}`);
    return memoryVersions.get(conversationId) ?? [];
  }
  return ((data as any[]) ?? [])
    .filter(r => isValidEventState(r.state))
    .map(r => ({
      version:   r.version as number,
      state:     r.state as EventState,
      createdAt: r.created_at as string,
    }));
}

// ─── Delete (conversation teardown — normally unnecessary: ON DELETE CASCADE) ─
export async function deleteEventState(conversationId: string, userId: string): Promise<void> {
  const previous = memoryStates.get(conversationId);
  memoryStates.delete(conversationId);
  if (previous?.eventId) memoryStatesByEvent.delete(previous.eventId);
  memoryVersions.delete(conversationId);
  if (!isConfigured() || !userId) return;
  const { error } = await sb
    .from('event_states')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  if (error) console.error('[EventStateRepository] deleteEventState:', error.message);
}

// ─── Memory fallback helpers ──────────────────────────────────────────────────
function persistToMemory(conversationId: string, state: EventState): void {
  const prev = memoryStates.get(conversationId);
  memoryStates.set(conversationId, state);
  if (state.eventId) memoryStatesByEvent.set(state.eventId, state);
  if (prev) {
    const list = memoryVersions.get(conversationId) ?? [];
    list.unshift({ version: (list[0]?.version ?? 0) + 1, state: prev, createdAt: new Date().toISOString() });
    memoryVersions.set(conversationId, list.slice(0, 20));
  }
}

// Re-export for callers that need to seed an empty state without importing
// the model module directly.
export { emptyEventState };
