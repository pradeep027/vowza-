import { describe, expect, it } from 'vitest';
import { extractContextUpdates, orchestrate } from '../aiOrchestrator';
import type { PlannerContext } from '../aiPlannerTypes';

describe('conversational vendor planning', () => {
  it('keeps a photography request isolated to photography', () => {
    const result = orchestrate('I need photography', {}, []);
    expect(result.intent).toBe('find_vendors');
    expect(result.professions).toEqual(['photographer']);
    expect(result.updatedContext.requestedServices).toEqual(['photographer']);
    expect(result.shouldAskNext).toContain('event');
  });

  it('asks for only the next missing vendor-search detail', () => {
    const context: PlannerContext = { eventType: 'wedding' };
    expect(orchestrate('I need photography', context, []).shouldAskNext).toContain('city');
    expect(orchestrate('I need photography', { ...context, city: 'Hyderabad' }, []).shouldAskNext).toContain('guests');
    expect(orchestrate('I need photography', { ...context, city: 'Hyderabad', guestCount: 500 }, []).shouldAskNext).toContain('budget');
  });

  it('supports multiple explicitly requested services without adding others', () => {
    const result = orchestrate('I need photography and catering', {
      eventType: 'wedding', city: 'Hyderabad', guestCount: 500,
    }, []);
    expect(result.professions).toEqual(['photographer', 'catering_services']);
    expect(result.updatedContext.requestedServices).toEqual(['photographer', 'catering_services']);
  });

  it('stores a service budget without overwriting the total event budget', () => {
    const updates = extractContextUpdates('Photography budget should be 80k', {
      eventType: 'wedding', budget: 1_000_000,
    });
    expect(updates.budget).toBeUndefined();
    expect(updates.serviceBudgets).toEqual({ photographer: 80_000 });
  });

  it('does not broaden a general event plan into marketplace services', () => {
    const result = orchestrate('plan my wedding', {}, []);
    expect(result.intent).toBe('plan_event');
    expect(result.updatedContext.requestedServices).toBeUndefined();
  });
});
