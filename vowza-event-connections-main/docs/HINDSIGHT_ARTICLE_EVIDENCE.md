# Vowza Hindsight Article Evidence

## Evidence scope

This document contains only source-level findings and automated results observed in the current Sandbox checkout. Live Supabase, Hindsight, browser, cross-session, two-user, and production Edge Function results are explicitly marked **BLOCKED** because the required authenticated runtime was unavailable.

## 1. Problem

The Vowza AI Planner needs memory that survives a session boundary while remaining isolated by authenticated user and by stable event UUID. Event State remains the canonical source for current planning data; persistent memory must not become a second source of event identity or overwrite newer state.

## 2. Vowza Planner architecture

The implemented path is:

```text
User message
  -> useAIChat / event-scope resolution
  -> canonical Event State and PlannerContext
  -> planner-memory Edge Function
  -> authenticated user-scoped Hindsight bank
  -> exact vowza_event_id recall filtering
  -> Planner context merge with current state precedence
```

The event-scope architecture documentation describes the registry as `conversationId -> { eventId -> EventState }` with an explicit `activeEventId`.

## 3. Why persistent memory was needed

A conversational Planner may need to recall a user-provided preference after a fresh application session. The memory layer is additive: it stores an allow-listed event snapshot and bounded planning facts, while current Event State remains authoritative.

## 4. Hindsight integration

The browser calls the Supabase `planner-memory` Edge Function through `supabase.functions.invoke`. The Edge Function reads Hindsight credentials only from Edge Function secrets and derives the Hindsight bank ID from the authenticated Supabase user UUID.

### Repository evidence

- Client: `src/lib/plannerMemoryClient.ts`
- Shared adapter: `supabase/functions/_shared/plannerMemory.ts`
- Edge Function: `supabase/functions/planner-memory/index.ts`
- Event architecture: `docs/planner-event-scope-architecture.md`

## 5. Retain flow

1. A successful Event State turn provides the state snapshot and changed fields.
2. The client sends the allow-listed state, user message, changed field names, and conversation ID.
3. The Edge Function authenticates the bearer token.
4. It validates conversation ownership and event ownership.
5. `buildRetentionRecord()` produces event-scoped metadata, including `vowza_event_id`.
6. Hindsight receives a user-derived bank ID and event-specific tags.
7. Failure returns a safe result and leaves the Planner chat available.

## 6. Recall flow

1. The current event is resolved before recall.
2. The client sends the current event context and conversation ID.
3. The Edge Function validates the authenticated user, conversation, and event.
4. Hindsight recall uses strict event tags.
5. `summarizeRecallResults()` additionally requires exact `metadata.vowza_event_id` equality.
6. The current context is merged last, so current state wins over recalled state.
7. Failure, timeout, empty memory, or malformed output falls back to the existing Planner path.

## 7. User isolation

**Source-level verification:** the bank identifier is derived from the authenticated UUID, not from browser-supplied bank input. Conversation and event ownership are checked against the authenticated user.

**Live user A/B test:** **BLOCKED**. Two real authenticated accounts were not available in the active environment, so no isolation result is claimed.

## 8. Event isolation

**Source-level verification:** recall requires a resolved event UUID and filters event memories by exact `vowza_event_id`. Hindsight is not used to resolve event identity.

**Live Event A/Event B test:** **BLOCKED**. Real owned events and live Edge Function/Hindsight invocation were unavailable.

## 9. Current Event State precedence

The shared adapter merges recalled context first and current context last. This makes current Event State authoritative when both contain the same field.

**Live conflict test:** **BLOCKED**. No authenticated live Planner session was available to execute the 300-versus-200 guest-count conflict.

## 10. Graceful failure

The client catches recall and retain failures, logs only a generic developer-facing warning, and returns a fallback result. The Edge Function returns an empty recall/context result or `retained: false` when Hindsight is unavailable.

**Controlled live failure test:** **BLOCKED**. No safe test Hindsight configuration was available.

## 11. Actual automated test results

- Configured Vitest suite: **PASS**, 7 files and 65 tests.
- TypeScript typecheck: **PASS**, `npm run typecheck` exit code 0.
- Production build: **PASS**, `npm run build` exit code 0.
- `git diff --check`: **PASS**.
- Repository-wide lint: **FAIL / existing debt**, 1,946 reported problems.
- Targeted changed-file lint: **FAIL / existing debt**, 21 findings, primarily `no-explicit-any` and a React hook dependency warning.

## 12. Before/after demonstration

**BLOCKED.** A real before/after demonstration requires an authenticated Session A, a real retain operation, a fresh Session B, and a real recall response. No fabricated response, metric, or screenshot is included.

## 13. Actual limitations

- The active environment is Sandbox only.
- Required public Supabase Vite variables were not present in the checkout/environment.
- Hindsight endpoint and credential configuration were not available for a live test.
- The authorized Windows runtime was unavailable in this session.
- Supabase CLI authentication/project verification was unavailable.
- The production Edge Function was not deployed or independently verified by this run.
- No browser screenshots were captured.

## 14. Relevant file paths

- `src/components/ai/useAIChat.ts`
- `src/lib/eventScope.ts`
- `src/lib/eventStateBridge.ts`
- `src/lib/eventStateProjection.ts`
- `src/lib/plannerMemoryClient.ts`
- `src/lib/llm.ts`
- `supabase/functions/_shared/plannerMemory.ts`
- `supabase/functions/planner-memory/index.ts`
- `docs/planner-event-scope-architecture.md`
- `docs/HINDSIGHT_IMPLEMENTATION_REPORT.md`

## 15. Repository code snippets

These snippets are copied from the current repository rather than written as pseudocode.

### Event-scoped recall request

From `src/lib/plannerMemoryClient.ts`:

```ts
const { data, error } = await supabase.functions.invoke<PlannerMemoryRecall>('planner-memory', {
  body: { action: 'recall', message, context: toMemoryContext(context), conversationId },
  timeout: 6_000,
});
```

### Exact event UUID filtering

From `supabase/functions/_shared/plannerMemory.ts`:

```ts
const scopedVowzaItems = requestedEventId
  ? vowzaItems.filter((item) => item.metadata?.vowza_event_id === requestedEventId)
  : [];
```

### Server-derived user bank

From `supabase/functions/_shared/plannerMemory.ts`:

```ts
/** Stable Hindsight scope derived only from Supabase's authenticated UUID. */
export function hindsightBankIdForUser(userId: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return null;
  }
  return `vowza-user-${userId.toLowerCase()}`;
}
```

### Current-state precedence

From `supabase/functions/_shared/plannerMemory.ts`:

```ts
return { ...recalled, ...current };
```

## 16. Screenshot list

No screenshots were captured. The browser acceptance test was **BLOCKED** because the authenticated runtime was unavailable.

## 17. Architecture diagram description

A publishable diagram should show four boundaries:

1. **Browser/Vowza:** user message, event reference resolution, active event UUID, and PlannerContext.
2. **Supabase canonical state:** authenticated conversation and Event State ownership checks.
3. **Planner-memory Edge Function:** server-side authentication, event validation, allow-listing, and Hindsight adapter.
4. **Hindsight:** user-derived bank plus strict event tag and exact `vowza_event_id` filtering.

The return path should show recalled facts merging beneath current Event State, with current state remaining authoritative. The diagram must label live runtime evidence as pending until the blocked acceptance tests are executed.
