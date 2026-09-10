// ─── Event Memory Bridge (Phase 2) — persistence & isolation tests ──────────
// Uses a mocked Supabase client to verify:
//   • bridge outcome mapping (persisted / memory-only / skipped / failed)
//   • persistence failures never throw and are honestly reported
//   • conversation isolation (two threads never share Event State)
//   • repository version increment + version snapshot calls
//   • read-back validation of stored states
//
// vi.mock replaces '@/integrations/supabase/client' BEFORE the modules under
// test import it, so no real network or env vars are involved. The mock
// builder is fully chainable and thenable, mirroring the real PostgREST
// builder (await works at any point in the chain).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the Supabase client ─────────────────────────────────────────────────
type Row = Record<string, unknown>;
const tableData = new Map<string, Row[]>();
let failNextInsert = false;
let failNextSelect = false;
let rowCounter = 0;

interface OpState {
  op: 'select' | 'insert' | 'update' | 'delete';
  payload: any;
  filters: Array<[string, unknown]>;
  orderDesc: string | null;
  limitN: number | null;
  wantsSingle: boolean;
}

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([col, val]) => row[col] === val);
}

function makeBuilder(table: string) {
  const state: OpState = {
    op: 'select', payload: null, filters: [], orderDesc: null, limitN: null, wantsSingle: false,
  };

  function execute(): Promise<{ data: any; error: any }> {
    const rows = tableData.get(table) ?? [];
    if (state.op === 'select') {
      if (failNextSelect) return Promise.resolve({ data: null, error: { message: 'mock select failure' } });
      let out = rows.filter(r => matches(r, state.filters));
      if (state.orderDesc) {
        out = [...out].sort((a, b) => Number(b[state.orderDesc!]) - Number(a[state.orderDesc!]));
      }
      if (state.limitN !== null) out = out.slice(0, state.limitN);
      if (state.wantsSingle) return Promise.resolve({ data: out[0] ?? null, error: null });
      return Promise.resolve({ data: out, error: null });
    }
    if (state.op === 'insert') {
      if (failNextInsert) return Promise.resolve({ data: null, error: { message: 'mock insert failure' } });
      const arr = Array.isArray(state.payload) ? state.payload : [state.payload];
      const inserted = arr.map(p => ({ ...p, id: `row-${++rowCounter}` }));
      tableData.set(table, [...rows, ...inserted]);
      return Promise.resolve({ data: inserted, error: null });
    }
    if (state.op === 'update') {
      if (failNextInsert) return Promise.resolve({ data: null, error: { message: 'mock update failure' } });
      const next = rows.map(r => (matches(r, state.filters) ? { ...r, ...state.payload } : r));
      tableData.set(table, next);
      return Promise.resolve({ data: null, error: null });
    }
    // delete
    tableData.set(table, rows.filter(r => !matches(r, state.filters)));
    return Promise.resolve({ data: null, error: null });
  }

  const b: any = {
    select:  () => { state.op = 'select'; return b; },
    insert:  (p: any) => { state.op = 'insert'; state.payload = p; return b; },
    update:  (p: any) => { state.op = 'update'; state.payload = p; return b; },
    delete:  () => { state.op = 'delete'; return b; },
    eq:      (col: string, val: unknown) => { state.filters.push([col, val]); return b; },
    order:   (_col: string, opts?: { ascending?: boolean }) => {
      if (opts?.ascending === false) state.orderDesc = _col;
      return b;
    },
    limit:   (n: number) => { state.limitN = n; return b; },
    single:      () => { state.wantsSingle = true; return execute(); },
    maybeSingle: () => { state.wantsSingle = true; return execute(); },
    // Thenable: `await builder...` resolves through execute()
    then: (onFulfilled?: (v: any) => any, onRejected?: (e: any) => any) =>
      execute().then(onFulfilled, onRejected),
    catch: (onRejected?: (e: any) => any) => execute().catch(onRejected),
    finally: (cb: () => void) => execute().finally(cb),
    [Symbol.toStringTag]: 'Promise',
  };
  return b;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => makeBuilder(table)),
  },
}));

import { syncEventStateFromTurn, restoreEventState, resetAllEventStateMemory } from '../eventStateBridge';
import {
  saveEventState, getEventState, listEventStateVersions, deleteEventState,
} from '../eventStateRepository';
import { isValidEventState } from '../eventState';

const USER = 'user-A';

beforeEach(() => {
  tableData.set('event_states', []);
  tableData.set('event_state_versions', []);
  failNextInsert = false;
  failNextSelect = false;
  resetAllEventStateMemory();
});

describe('Bridge (Phase 2) — persistence outcomes', () => {
  it('persists a turn with changes → outcome "persisted"', async () => {
    const r = await syncEventStateFromTurn('conv-1', USER, "I'm planning a wedding in Hyderabad", { eventType: 'wedding', city: 'Hyderabad' });
    expect(r.outcome).toBe('persisted');
    expect(r.persisted).toBe(true);
    expect(r.state?.eventType).toBe('wedding');
    expect(tableData.get('event_states')?.length).toBe(1);
    // First save inserts (no prior row) — no snapshot for v1
    expect(tableData.get('event_state_versions')?.length).toBe(0);
  });

  it('skips persistence when nothing changed → outcome "skipped"', async () => {
    await syncEventStateFromTurn('conv-1', USER, 'wedding in Hyderabad', { eventType: 'wedding', city: 'Hyderabad' });
    const r = await syncEventStateFromTurn('conv-1', USER, 'yes wedding in Hyderabad', { eventType: 'wedding', city: 'Hyderabad' });
    expect(r.outcome).toBe('skipped');
    expect(r.persisted).toBe(false);
    expect(tableData.get('event_states')?.length).toBe(1);
  });

  it('reports honestly when persistence fails (memory-only, no throw)', async () => {
    await syncEventStateFromTurn('conv-1', USER, 'wedding', { eventType: 'wedding' }); // create row first
    failNextInsert = true; // update path now fails
    const r = await syncEventStateFromTurn('conv-1', USER, '400 guests', { guestCount: 400 });
    expect(r.outcome).toBe('persistedToMemoryOnly');
    expect(r.persisted).toBe(false);
    expect(r.error).toBeTruthy();
    expect(r.state?.guests.count).toBe(400); // conversation continues in memory
  });

  it('anonymous sessions are memory-only, by design', async () => {
    const r = await syncEventStateFromTurn('conv-anon', null, 'birthday in Bengaluru', { eventType: 'birthday', city: 'Bengaluru' });
    expect(r.outcome).toBe('persistedToMemoryOnly');
    expect(r.persisted).toBe(false);
    expect(tableData.get('event_states')?.length).toBe(0);
    expect(r.state?.eventType).toBe('birthday');
  });
});

describe('Bridge (Phase 2) — conversation isolation', () => {
  it('two conversations never share Event State', async () => {
    await syncEventStateFromTurn('conv-A', USER, 'wedding in Hyderabad', { eventType: 'wedding', city: 'Hyderabad' });
    await syncEventStateFromTurn('conv-B', USER, 'birthday in Bengaluru', { eventType: 'birthday', city: 'Bengaluru' });

    const a = await restoreEventState('conv-A', USER);
    const b = await restoreEventState('conv-B', USER);
    expect(a.eventType).toBe('wedding');
    expect(a.location.city).toBe('Hyderabad');
    expect(b.eventType).toBe('birthday');
    expect(b.location.city).toBe('Bengaluru');
  });

  it('a new conversation starts empty (no inheritance)', async () => {
    await syncEventStateFromTurn('conv-A', USER, 'wedding in Hyderabad', { eventType: 'wedding', city: 'Hyderabad' });
    const fresh = await restoreEventState('conv-NEW', USER);
    expect(fresh.eventType).toBeNull();
    expect(fresh.location.city).toBeNull();
    expect(fresh.guests.count).toBeNull();
  });

  it('corrections in one thread never leak into another', async () => {
    await syncEventStateFromTurn('conv-A', USER, 'wedding, 400 guests', { eventType: 'wedding', guestCount: 400 });
    await syncEventStateFromTurn('conv-B', USER, 'birthday, 50 guests', { eventType: 'birthday', guestCount: 50 });
    await syncEventStateFromTurn('conv-A', USER, 'make it 500 guests', { guestCount: 500 });

    const a = await restoreEventState('conv-A', USER);
    const b = await restoreEventState('conv-B', USER);
    expect(a.guests.count).toBe(500);
    expect(b.guests.count).toBe(50);
  });

  it('one row per conversation (UNIQUE conversation_id respected)', async () => {
    await syncEventStateFromTurn('conv-A', USER, 'wedding', { eventType: 'wedding' });
    await syncEventStateFromTurn('conv-A', USER, '300 guests', { guestCount: 300 });
    await syncEventStateFromTurn('conv-A', USER, 'change city to Warangal', { city: 'Warangal' });
    const rows = (tableData.get('event_states') ?? []).filter(r => r.conversation_id === 'conv-A');
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(3);
  });
});

describe('Repository (Phase 2) — versioning', () => {
  it('bumps version on each real change and appends snapshots after updates', async () => {
    await syncEventStateFromTurn('conv-V', USER, 'wedding', { eventType: 'wedding' });   // v1 (insert)
    await syncEventStateFromTurn('conv-V', USER, '400 guests', { guestCount: 400 });     // v2
    await syncEventStateFromTurn('conv-V', USER, '500 guests', { guestCount: 500 });     // v3

    const states = tableData.get('event_states') ?? [];
    expect(states).toHaveLength(1);
    expect(states[0].version).toBe(3);
    const versions = tableData.get('event_state_versions') ?? [];
    expect(versions.map(v => v.version)).toEqual([2, 3]);
  });

  it('read-back validates the stored document', async () => {
    await syncEventStateFromTurn('conv-R', USER, 'wedding in Hyderabad', { eventType: 'wedding', city: 'Hyderabad' });
    const stored = (tableData.get('event_states') ?? [])[0];
    expect(isValidEventState(stored.state)).toBe(true);
    const loaded = await getEventState('conv-R', USER);
    expect(loaded?.eventType).toBe('wedding');
    expect(loaded?.location.city).toBe('Hyderabad');
  });

  it('listEventStateVersions returns snapshots newest-first', async () => {
    await syncEventStateFromTurn('conv-L', USER, 'wedding', { eventType: 'wedding' });
    await syncEventStateFromTurn('conv-L', USER, '300 guests', { guestCount: 300 });
    await syncEventStateFromTurn('conv-L', USER, '400 guests', { guestCount: 400 });
    const history = await listEventStateVersions('conv-L', USER);
    expect(history.map(h => h.version)).toEqual([3, 2]);
    expect(isValidEventState(history[0].state)).toBe(true);
  });

  it('select failures degrade to memory and are visible to the caller', async () => {
    failNextSelect = true;
    const r = await syncEventStateFromTurn('conv-S', USER, 'wedding', { eventType: 'wedding' });
    expect(r.outcome).toBe('persistedToMemoryOnly');
    expect(r.persisted).toBe(false);
    expect(r.state?.eventType).toBe('wedding');
  });

  it('deleteEventState clears a thread without touching others', async () => {
    await syncEventStateFromTurn('conv-D1', USER, 'wedding', { eventType: 'wedding' });
    await syncEventStateFromTurn('conv-D2', USER, 'birthday', { eventType: 'birthday' });
    await deleteEventState('conv-D1', USER);
    expect(await getEventState('conv-D1', USER)).toBeNull();
    expect((await getEventState('conv-D2', USER))?.eventType).toBe('birthday');
  });
});
