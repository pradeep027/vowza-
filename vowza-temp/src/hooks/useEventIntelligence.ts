// ─── useEventIntelligence Hook ────────────────────────────────────────────────
// Integrates Event Intelligence Engine into React components.
// Provides plan generation, modification detection, what-if simulations,
// and real-time health/risk/timeline calculations.
//
// Usage:
// const { plan, generatePlan, modifyPlan, simulateWhat If } = useEventIntelligence();

import { useState, useCallback, useRef, useEffect } from 'react';
import { EventIntelligenceOrchestrator } from '@/lib/eventIntelligenceOrchestrator';
import { EventTimelineEngine } from '@/lib/eventTimelineEngine';
import { EventRiskDetector } from '@/lib/eventRiskDetector';
import { EventHealthScoreCalculator } from '@/lib/eventHealthScore';
import {
  generateEventPlanWithVendors,
  handleWhatIfScenario,
  handlePlanModification,
  processPlanningIntent,
  serializePlanForContext,
  deserializePlanFromContext,
} from '@/lib/eventIntelligenceLLMIntegration';
import type { EventPlan, WhatIfSimulation } from '@/contexts/EventPlanContext';
import type { EventBudgetPlan } from '@/lib/eventBudgetPlanner';
import type { PlannerContext } from '@/lib/aiPlannerTypes';

// ─── Hook State ────────────────────────────────────────────────────────────
interface UseEventIntelligenceState {
  plan: EventPlan | null;
  budget: EventBudgetPlan | null;
  timeline: any[];
  risks: any[];
  health: any;
  simulation: WhatIfSimulation | null;
  isGenerating: boolean;
  error: string | null;
  lastGenerated: Date | null;
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useEventIntelligence() {
  const [state, setState] = useState<UseEventIntelligenceState>({
    plan: null,
    budget: null,
    timeline: [],
    risks: [],
    health: null,
    simulation: null,
    isGenerating: false,
    error: null,
    lastGenerated: null,
  });

  const planRef = useRef<EventPlan | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    planRef.current = state.plan;
  }, [state.plan]);

  // ── Generate a new plan from context ───────────────────────────────────────
  const generatePlan = useCallback(
    async (context: PlannerContext, onProgress?: (message: string) => void) => {
      setState(prev => ({ ...prev, isGenerating: true, error: null }));

      try {
        const result = EventIntelligenceOrchestrator.generateFullPlan(context);
        if (!result) {
          throw new Error('Insufficient context for plan generation');
        }

        setState(prev => ({
          ...prev,
          plan: result.plan,
          budget: result.budget,
          timeline: result.timeline,
          risks: result.risks,
          health: result.health,
          isGenerating: false,
          lastGenerated: new Date(),
        }));

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setState(prev => ({ ...prev, isGenerating: false, error: errorMsg }));
        throw err;
      }
    },
    []
  );

  // ── Modify the current plan ─────────────────────────────────────────────────
  const modifyPlan = useCallback(
    async (changes: Record<string, any>) => {
      if (!state.plan || !state.budget) {
        throw new Error('No plan to modify');
      }

      setState(prev => ({ ...prev, isGenerating: true, error: null }));

      try {
        // Analyze impact before applying
        const analysis = EventIntelligenceOrchestrator.analyzeModification(state.plan, changes);

        // Apply modification
        const result = EventIntelligenceOrchestrator.applyModification(
          state.plan,
          changes,
          state.budget
        );

        // Regenerate dependent metrics
        const timeline = EventTimelineEngine.generateTimeline(result.plan);
        const risks = EventRiskDetector.detectAllRisks(result.plan, result.budget);
        const health = EventHealthScoreCalculator.calculateHealth(result.plan, result.budget);

        setState(prev => ({
          ...prev,
          plan: result.plan,
          budget: result.budget,
          timeline,
          risks,
          health,
          isGenerating: false,
          lastGenerated: new Date(),
        }));

        return { plan: result.plan, analysis };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Modification failed';
        setState(prev => ({ ...prev, isGenerating: false, error: errorMsg }));
        throw err;
      }
    },
    [state.plan, state.budget]
  );

  // ── Create a what-if simulation ────────────────────────────────────────────
  const createSimulation = useCallback(
    async (scenario: string) => {
      if (!state.plan || !state.budget) {
        throw new Error('No plan to simulate');
      }

      try {
        const simulation = EventIntelligenceOrchestrator.generateWhatIfSimulation(
          state.plan,
          state.budget,
          scenario
        );

        if (!simulation) {
          throw new Error('Invalid scenario');
        }

        setState(prev => ({ ...prev, simulation }));
        return simulation;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Simulation failed';
        setState(prev => ({ ...prev, error: errorMsg }));
        throw err;
      }
    },
    [state.plan, state.budget]
  );

  // ── Apply a what-if simulation as the new plan ──────────────────────────────
  const applySimulation = useCallback(async () => {
    if (!state.simulation || !state.plan) {
      throw new Error('No simulation to apply');
    }

    try {
      // Apply simulation changes
      const result = EventIntelligenceOrchestrator.applyModification(
        state.plan,
        state.simulation.change,
        state.budget || ({} as EventBudgetPlan)
      );

      setState(prev => ({
        ...prev,
        plan: result.plan,
        budget: result.budget,
        simulation: null,
      }));

      return result.plan;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Apply simulation failed';
      setState(prev => ({ ...prev, error: errorMsg }));
      throw err;
    }
  }, [state.simulation, state.plan, state.budget]);

  // ── Cancel simulation without applying ───────────────────────────────────────
  const cancelSimulation = useCallback(() => {
    setState(prev => ({ ...prev, simulation: null }));
  }, []);

  // ── Recalculate all metrics (health, risks, timeline) ──────────────────────
  const recalculateMetrics = useCallback(async () => {
    if (!state.plan) return;

    try {
      const timeline = EventTimelineEngine.generateTimeline(state.plan);
      const risks = EventRiskDetector.detectAllRisks(state.plan, state.budget || undefined);
      const health = EventHealthScoreCalculator.calculateHealth(state.plan, state.budget || undefined);

      setState(prev => ({ ...prev, timeline, risks, health }));
    } catch (err) {
      console.error('[useEventIntelligence] Recalculation error:', err);
    }
  }, [state.plan, state.budget]);

  // ── Process a planning intent (from Planner chat) ────────────────────────────
  const processPlanningIntent = useCallback(
    async (message: string, plannerContext: PlannerContext) => {
      setState(prev => ({ ...prev, isGenerating: true, error: null }));

      try {
        const result = await processPlanningIntent(
          message,
          plannerContext,
          state.plan,
          () => {} // No-op onChunk (real implementation would stream)
        );

        if (result.generatedPlan) {
          setState(prev => ({
            ...prev,
            plan: result.generatedPlan,
            budget: result.budget,
            isGenerating: false,
            lastGenerated: new Date(),
          }));
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Intent processing failed';
        setState(prev => ({ ...prev, isGenerating: false, error: errorMsg }));
        throw err;
      }
    },
    [state.plan]
  );

  // ── Get plan serialized for persistence ──────────────────────────────────────
  const serializePlan = useCallback(() => {
    if (!state.plan) return null;
    return serializePlanForContext(state.plan);
  }, [state.plan]);

  // ── Restore plan from serialized context ─────────────────────────────────────
  const restorePlan = useCallback((context: any) => {
    const partial = deserializePlanFromContext(context);
    if (partial) {
      // In real implementation, would fully restore plan with all data
      console.log('[useEventIntelligence] Restoring plan:', partial);
    }
  }, []);

  // ── Clear all state ────────────────────────────────────────────────────────
  const clearPlan = useCallback(() => {
    setState({
      plan: null,
      budget: null,
      timeline: [],
      risks: [],
      health: null,
      simulation: null,
      isGenerating: false,
      error: null,
      lastGenerated: null,
    });
  }, []);

  return {
    // State
    plan: state.plan,
    budget: state.budget,
    timeline: state.timeline,
    risks: state.risks,
    health: state.health,
    simulation: state.simulation,
    isGenerating: state.isGenerating,
    error: state.error,
    lastGenerated: state.lastGenerated,

    // Methods
    generatePlan,
    modifyPlan,
    createSimulation,
    applySimulation,
    cancelSimulation,
    recalculateMetrics,
    processPlanningIntent,
    serializePlan,
    restorePlan,
    clearPlan,
  };
}

export default useEventIntelligence;
