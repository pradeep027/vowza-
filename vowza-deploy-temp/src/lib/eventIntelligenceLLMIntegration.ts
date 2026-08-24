// ─── Event Intelligence LLM Integration Layer ────────────────────────────────
// Connects the Event Intelligence Engine (eventIntelligenceOrchestrator) to
// the LLM response pipeline (llm.ts).
//
// Responsibilities:
// 1. Intercept planning intents from orchestration
// 2. Generate or update EventPlan via orchestrator
// 3. Detect plan modifications and analyze impact
// 4. Integrate with vendor matching (ragRetriever)
// 5. Format rich responses with plan details
// 6. Persist plan to conversation context
//
// This is NOT a replacement for llm.ts — it's an enhancement layer
// that activates only for planning-related intents.

import { EventIntelligenceOrchestrator, type PlanGenerationResult } from './eventIntelligenceOrchestrator';
import type { EventBudgetPlan } from './eventBudgetPlanner';
import type { EventPlan } from '@/contexts/EventPlanContext';
import type { PlannerContext, AIResponse, ChatMessage } from './aiPlannerTypes';
import { retrieveVendors, buildRAGContext } from './ragRetriever';
import { dedupeVerifiedDBVendors } from './vendorTrust';
import { EventTimelineEngine, formatTimelineForDisplay } from './eventTimelineEngine';
import { EventRiskDetector, formatRiskSummaryForDisplay, formatRiskForDisplay } from './eventRiskDetector';
import { EventHealthScoreCalculator, formatHealthReportForDisplay } from './eventHealthScore';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EventPlanGenerationContext {
  context: PlannerContext;
  currentPlan: EventPlan | null;
  message: string;
  isModification: boolean; // User modifying existing plan
  isWhatIf: boolean; // User asking what-if question
}

export interface EnrichedPlanResponse {
  fullText: string;
  aiResponse: AIResponse;
  generatedPlan?: EventPlan;
  budget?: EventBudgetPlan;
  vendorSuggestions?: any[];
  riskSummary?: any;
  timelinePreview?: string;
}

// ─── Plan Generation with Vendor Integration ───────────────────────────────
export async function generateEventPlanWithVendors(
  planContext: EventPlanGenerationContext,
  onChunk: (chunk: { delta: string; done: boolean }) => void
): Promise<EnrichedPlanResponse> {
  const { context, currentPlan, message, isModification, isWhatIf } = planContext;

  // Skip if insufficient context
  if (!context.eventType || !context.budget || !context.guestCount) {
    return {
      fullText: 'I need a few details to create your plan: event type, location, guest count, and budget.',
      aiResponse: { type: 'question', text: 'Missing essential planning details' },
    };
  }

  try {
    // 1. Generate full plan using orchestrator
    const planResult = EventIntelligenceOrchestrator.generateFullPlan(context);
    if (!planResult) {
      return {
        fullText: 'Unable to generate plan. Please provide: event type, budget, and guest count.',
        aiResponse: { type: 'error', text: 'Plan generation failed' },
      };
    }

    const { plan, budget, timeline, risks, health } = planResult;

    // 2. If modification, analyze impact
    let impactAnalysis = null;
    if (isModification && currentPlan) {
      // User made a change to existing plan
      // Detect what changed (stub for now - would be provided by user)
      impactAnalysis = EventIntelligenceOrchestrator.analyzeModification(currentPlan, {
        totalBudget: plan.totalBudget,
      });

      if (impactAnalysis.requiresConfirmation) {
        const warning = `⚠️ **Impact Alert**: This change affects ${impactAnalysis.dependencies.length} related services. Budget impact: ₹${(impactAnalysis.budgetImpact / 100000).toFixed(1)}L.`;
        await onChunk({ delta: warning, done: false });
      }
    }

    // 3. Retrieve matching vendors from marketplace (Phase 5 integration)
    let vendorSuggestions = [];
    try {
      for (const service of plan.services) {
        if (service.status === 'required') {
          const ragResult = await retrieveVendors(
            `${service.category} for ${plan.eventType} in ${plan.location}`,
            context,
            3, // Top 3 vendors per service
            { professions: [service.category], city: plan.location }
          );

          if (ragResult.vendors.length > 0) {
            const deduped = dedupeVerifiedDBVendors(ragResult.vendors);
            vendorSuggestions.push({
              service: service.category,
              vendors: deduped.slice(0, 2), // Top 2
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Event Intelligence] Vendor retrieval failed:', err);
      // Continue without vendors — plan is still valid
    }

    // 4. Format comprehensive response
    let fullText = EventIntelligenceOrchestrator.formatPlanReport(planResult);

    // Add timeline preview
    fullText += formatTimelineForDisplay(timeline);

    // Add risk summary if critical/high risks exist
    const criticalRisks = risks.filter((r: any) => r.severity === 'critical' || r.severity === 'high');
    if (criticalRisks.length > 0) {
      fullText += `\n\n### ⚠️ Important Risks\n`;
      for (const risk of criticalRisks.slice(0, 3)) {
        fullText += formatRiskForDisplay(risk) + '\n';
      }
    }

    // Add vendor suggestions
    if (vendorSuggestions.length > 0) {
      fullText += `\n\n### 🎯 Recommended Vendors\n`;
      for (const suggestion of vendorSuggestions) {
        fullText += `\n**${suggestion.service}**\n`;
        for (const vendor of suggestion.vendors) {
          fullText += `- ${vendor.name} (₹${vendor.price_range_min}-${vendor.price_range_max}, ${vendor.ratings || 4.5}★)\n`;
        }
      }
    }

    // Add follow-up prompt
    fullText += `\n\n**Next steps:** Would you like me to refine the budget, adjust services, or explore vendor options?`;

    // 5. Return enriched response
    return {
      fullText,
      aiResponse: {
        type: 'budget_plan',
        text: fullText,
        data: { plan, budget, vendors: vendorSuggestions },
      },
      generatedPlan: plan,
      budget,
      vendorSuggestions,
      riskSummary: EventRiskDetector.calculateRiskSummary(risks),
      timelinePreview: formatTimelineForDisplay(timeline),
    };
  } catch (err) {
    console.error('[Event Intelligence] Plan generation error:', err);
    return {
      fullText: `Sorry, I encountered an issue generating your plan. ${(err as any)?.message || 'Please try again.'}`,
      aiResponse: { type: 'error', text: 'Plan generation error' },
    };
  }
}

// ─── What-If Scenario Handling ─────────────────────────────────────────────
export async function handleWhatIfScenario(
  scenario: string,
  plan: EventPlan,
  budget: EventBudgetPlan,
  onChunk: (chunk: { delta: string; done: boolean }) => void
): Promise<EnrichedPlanResponse> {
  try {
    const simulation = EventIntelligenceOrchestrator.generateWhatIfSimulation(plan, budget, scenario);
    if (!simulation) {
      return {
        fullText: `I don't recognize that scenario. Try: "What if guests increase to 500?" or "What if budget becomes ₹6 lakh?"`,
        aiResponse: { type: 'text', text: 'Scenario not recognized' },
      };
    }

    let fullText = `\n## 🔮 What-If Scenario: ${simulation.label}\n\n`;
    fullText += `**Base Plan:** ${plan.guestCount} guests, ₹${(plan.totalBudget / 100000).toFixed(1)}L\n`;

    // Estimate impacts
    if (simulation.estimatedImpact.costDifference !== 0) {
      fullText += `**Cost Impact:** ${simulation.estimatedImpact.costDifference > 0 ? '+' : ''}₹${(simulation.estimatedImpact.costDifference / 100000).toFixed(1)}L\n`;
    }

    if (simulation.estimatedImpact.timelineShift !== 0) {
      fullText += `**Timeline Impact:** ${simulation.estimatedImpact.timelineShift > 0 ? '+' : ''}${simulation.estimatedImpact.timelineShift} days\n`;
    }

    if (simulation.estimatedImpact.affectedServices.length > 0) {
      fullText += `**Affected Services:** ${simulation.estimatedImpact.affectedServices.slice(0, 3).join(', ')}\n`;
    }

    fullText += `\n**Note:** This is a simulation. Your confirmed plan remains unchanged until you apply this scenario.`;

    return {
      fullText,
      aiResponse: {
        type: 'text',
        text: fullText,
        data: { simulation },
      },
    };
  } catch (err) {
    console.error('[Event Intelligence] What-If error:', err);
    return {
      fullText: 'I encountered an issue with that scenario. Please try again.',
      aiResponse: { type: 'error', text: 'What-If scenario error' },
    };
  }
}

// ─── Plan Modification Handling ────────────────────────────────────────────
export async function handlePlanModification(
  modificationMessage: string,
  currentPlan: EventPlan,
  currentBudget: EventBudgetPlan,
  onChunk: (chunk: { delta: string; done: boolean }) => void
): Promise<EnrichedPlanResponse> {
  // Stub: In real implementation, parse modification intent from message
  // Examples: "Remove DJ", "Increase photography budget", "Change to premium tier"
  
  try {
    // This would be filled in by parsing the modification intent
    // For now, return a helpful prompt
    return {
      fullText: `I understand you want to modify your plan. Please be specific:\n- "Remove DJ" or "Add videography"\n- "Increase photography budget to ₹1 lakh"\n- "Change luxury level to premium"`,
      aiResponse: { type: 'text', text: 'Plan modification requested' },
    };
  } catch (err) {
    console.error('[Event Intelligence] Modification error:', err);
    return {
      fullText: 'I encountered an issue processing that modification.',
      aiResponse: { type: 'error', text: 'Modification error' },
    };
  }
}

// ─── Persistence Helper: Save Plan to Conversation Context ──────────────────
export function serializePlanForContext(plan: EventPlan): Record<string, any> {
  return {
    planId: plan.id,
    planVersion: plan.version,
    eventType: plan.eventType,
    location: plan.location,
    eventDate: plan.eventDate?.toISOString(),
    guestCount: plan.guestCount,
    totalBudget: plan.totalBudget,
    allocatedBudget: plan.allocatedBudget,
    remainingBudget: plan.remainingBudget,
    luxuryLevel: plan.luxuryLevel,
    healthScore: plan.healthScore,
    completionPercentage: plan.completionPercentage,
    planStatus: plan.planStatus,
    riskScore: plan.riskScore,
    serviceCount: plan.services.length,
    bookedVendors: plan.selectedVendors.length,
    modificationCount: plan.modifications.length,
  };
}

export function deserializePlanFromContext(context: any): Partial<EventPlan> | null {
  if (!context?.planId) return null;

  return {
    id: context.planId,
    version: context.planVersion,
    eventType: context.eventType,
    location: context.location,
    eventDate: context.eventDate ? new Date(context.eventDate) : undefined,
    guestCount: context.guestCount,
    totalBudget: context.totalBudget,
    luxuryLevel: context.luxuryLevel,
  };
}

// ─── Integration with useAIChat (exported for hook) ────────────────────────
export async function processPlanningIntent(
  message: string,
  plannerContext: PlannerContext,
  currentPlan: EventPlan | null,
  onChunk: (chunk: { delta: string; done: boolean }) => void
): Promise<EnrichedPlanResponse> {
  const isWhatIf = /what if|what happens if|suppose|imagine/i.test(message);
  const isModification = /remove|add|increase|decrease|change|upgrade|downgrade/i.test(message) && currentPlan;

  const context: EventPlanGenerationContext = {
    context: plannerContext,
    currentPlan,
    message,
    isModification,
    isWhatIf,
  };

  if (isWhatIf && currentPlan) {
    // Extract scenario type from message
    const scenario = extractScenarioType(message);
    return handleWhatIfScenario(scenario, currentPlan, {} as EventBudgetPlan, onChunk);
  }

  if (isModification && currentPlan) {
    return handlePlanModification(message, currentPlan, {} as EventBudgetPlan, onChunk);
  }

  // Default: generate new plan or update existing
  return generateEventPlanWithVendors(context, onChunk);
}

// ─── Helper: Extract scenario type from what-if question ────────────────────
function extractScenarioType(message: string): string {
  const lower = message.toLowerCase();

  if (/guest.*increase|guest.*500|guest.*become/i.test(lower)) {
    return lower.includes('reduce') ? 'reduce_guests_25' : 'increase_guests_25';
  }
  if (/budget.*increase|budget.*6|budget.*become/i.test(lower)) {
    return lower.includes('reduce') ? 'reduce_budget_20' : 'increase_budget_20';
  }
  if (/premium|upgrade|luxury/i.test(lower)) {
    return 'premium_tier';
  }
  if (/photography|photographer/i.test(lower)) {
    return 'upgrade_photography';
  }

  return 'increase_budget_20'; // Default scenario
}

export default {
  generateEventPlanWithVendors,
  handleWhatIfScenario,
  handlePlanModification,
  serializePlanForContext,
  deserializePlanFromContext,
  processPlanningIntent,
};
