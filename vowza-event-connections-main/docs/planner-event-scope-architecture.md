# Vowza Planner Event-Scope Architecture Audit

## Current architecture

```text
User message
  -> useAIChat.send()
  -> eventScope resolution against user event_states
  -> one per-conversation Event State cache entry
  -> llm.sendMessage()
       -> aiOrchestrator extracts intent/context updates
       -> canonical Event State projection becomes planner context
       -> planner-memory recall using eventId
       -> budget planner / vendor retrieval / response generation
  -> syncEventStateFromTurn()
  -> event_states persistence
  -> Hindsight retain using the persisted eventId
  -> conversation context_summary + sessionStorage context
```

## For the intended multi-event architecture

```text
Conversation
  -> event reference resolution
  -> activeEventId selection
  -> event registry: conversationId -> { eventId -> EventState }
  -> canonical Event State for activeEventId
  -> Hindsight recall filtered by resolved eventId
  -> event-scoped PlannerContext
  -> event-scoped plan/recommendations
  -> response generation
  -> persist only the active Event State and its eventId
```

## Forensic root cause

The database migration allows multiple `event_states` rows per conversation, but the runtime still models one state per conversation:

- `eventStateCache` is `Map<conversationId, EventState>`.
- `restoreEventState(conversationId)` loads one row with `maybeSingle()`.
- `syncEventStateFromTurn()` always starts from the one cached conversation state.
- `context_summary`, `sessionStorage`, `currentPlan`, and `planRef` are single active-context stores.

After Event B is introduced, switching back to Event A changes the visible context, but the next sync can still merge through the single conversation cache. A persisted row lookup can also fail once multiple rows exist because the conversation query still expects one row. This occurs before Hindsight recall; Hindsight then correctly scopes whatever eventId it receives, but it cannot repair a wrong active state.

`llm.ts` also accepts `currentPlan` without checking its eventId, so an old wedding plan can be applied to a reception turn after a scope switch.

## Required invariants

1. Every Event State has a stable `eventId`.
2. A conversation holds a registry of independent Event States.
3. `activeEventId` is explicit and changes do not mutate other states.
4. Explicit event references resolve before Hindsight recall.
5. Recall receives only the resolved event's context and eventId.
6. Follow-ups inherit `activeEventId`.
7. Plans are accepted only when `plan.eventId === activeEventId`.
8. Persistence and restore operate on eventId or a multi-row conversation list, never an assumed single row.
9. Hindsight remains an event-scoped memory layer, not the canonical source of identity.
