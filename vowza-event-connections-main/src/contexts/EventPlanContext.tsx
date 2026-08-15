// ─── Event Intelligence Engine: EventPlan Context Manager ──────────────────────
// Provides structured, type-safe event planning state with lifecycle management.
//
// This context maintains the live event plan as a user refines their event
// throughout a conversation with Vowza Planner. It is scoped to a single
// conversation and is cleared when a new chat begins.
//
// Key responsibilities:
// 1. Store structured EventPlan state (not just budget, but entire event)
// 2. Detect plan modifications (what-if vs confirmed changes)
// 3. Generate plan versions / snapshots
// 4. Calculate plan health metrics
// 5. Maintain audit trail of changes
//
// This integrates with:
// - llm.ts (sendMessage receives currentPlan, returns generatedPlan)
// - eventBudgetPlanner.ts (allocate, rebalance, prioritize methods)
// - eventDependencyEngine.ts (detect impact of changes)
// - eventTimelineEngine.ts (generate timelines from plan)
// - eventRiskDetector.ts (identify risks from current plan)
// - eventHealthScore.ts (calculate transparency score)

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ─── EventPlan Types (Digital Twin of the entire event) ──────────────────────
export interface EventService {
  id: string;
  category: string; // e.g., "Photography", "Catering", "Decoration"
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low'; // Priority level
  estimatedCost: number;
  allocatedBudget: number;
  status: 'required' | 'optional' | 'confirmed' | 'excluded';
  selectedVendor?: {
    id: string;
    name: string;
    price: number;
    rating: number;
    availability: boolean;
  };
  customizations?: {
    key: string;
    value: string;
  }[];
}

export interface TimelineItem {
  id: string;
  milestoneType: 'planning' | 'booking' | 'payment' | 'preparation' | 'event' | 'post-event';
  description: string;
  daysBeforeEvent: number;
  targetDate?: Date;
  actionRequired?: string[];
  completed: boolean;
  relatedServices: string[]; // Service IDs this milestone depends on
}

export interface RiskItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedServices: string[];
  mitigationStrategy?: string;
  detectedAt: Date;
}

export interface PlanModification {
  id: string;
  type: 'add_service' | 'remove_service' | 'adjust_budget' | 'change_priority' | 'rebalance_budget' | 'update_event_detail';
  target: string; // Service ID or field name
  previousValue?: any;
  newValue?: any;
  appliedAt: Date;
  isConfirmed: boolean;
}

export interface EventPlan {
  // ── Identification ────────────────────────────────────────────────────────
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  // ── Event Details (Digital Twin) ──────────────────────────────────────────
  eventType: string;
  eventName?: string;
  location?: string;
  eventDate?: Date;
  duration?: number; // in hours
  guestCount: number;

  // ── Style & Preferences ──────────────────────────────────────────────────
  style?: string; // e.g., "Traditional", "Modern", "Minimalist"
  theme?: string;
  preferences?: string[];

  // ── Budget State ──────────────────────────────────────────────────────────
  totalBudget: number;
  allocatedBudget: number;
  remainingBudget: number;
  luxuryLevel: 'economy' | 'standard' | 'premium' | 'luxury';

  // ── Service Planning ──────────────────────────────────────────────────────
  services: EventService[];
  selectedVendors: Array<{ serviceId: string; vendorId: string; vendorName: string; price: number }>;
  excludedServices: string[];
  priorities: Map<string, 'critical' | 'high' | 'medium' | 'low'>;

  // ── Timeline & Milestones ──────────────────────────────────────────────────
  timeline: TimelineItem[];

  // ── Risk Management ──────────────────────────────────────────────────────
  risks: RiskItem[];
  riskScore: number; // 0-100, lower is better

  // ── Plan Health ──────────────────────────────────────────────────────────
  healthScore: number; // 0-100, higher is better
  completionPercentage: number;
  planStatus: 'draft' | 'planning' | 'confirmed' | 'in_progress' | 'completed';

  // ── Audit Trail ───────────────────────────────────────────────────────────
  modifications: PlanModification[];

  // ── Recommendations ──────────────────────────────────────────────────────
  recommendations: string[];
  suggestedTradeOffs?: Array<{
    option: string;
    impact: string;
    savings: number;
  }>;

  // ── Metadata ──────────────────────────────────────────────────────────────
  conversationId?: string;
  userId?: string;
}

// ─── What-If Simulation (Temporary, not persisted) ──────────────────────────
export interface WhatIfSimulation {
  id: string;
  basePlanId: string;
  label: string;
  change: Partial<EventPlan>;
  estimatedImpact: {
    costDifference: number;
    affectedServices: string[];
    timelineShift: number; // days
    riskChange: number; // -10 to +10
  };
  createdAt: Date;
}

// ─── Context Type ────────────────────────────────────────────────────────────
interface EventPlanContextType {
  // State
  currentPlan: EventPlan | null;
  simulationMode: boolean;
  activeSimulation: WhatIfSimulation | null;

  // Plan lifecycle
  initializePlan: (eventDetails: Partial<EventPlan>) => void;
  updatePlan: (updates: Partial<EventPlan>) => void;
  confirmPlanChanges: () => void;

  // Service management
  addService: (service: EventService) => void;
  removeService: (serviceId: string) => void;
  updateService: (serviceId: string, updates: Partial<EventService>) => void;
  setPriority: (serviceId: string, priority: 'critical' | 'high' | 'medium' | 'low') => void;

  // Budget operations
  rebalanceBudget: (totalBudget: number) => void;
  adjustServiceBudget: (serviceId: string, newBudget: number) => void;
  detectBudgetConflict: () => { exceeded: boolean; gap: number };

  // Timeline operations
  regenerateTimeline: () => void;
  updateTimeline: (items: TimelineItem[]) => void;

  // Risk management
  recalculateRisks: () => void;
  acknowledgeRisk: (riskId: string) => void;

  // What-if simulations
  startSimulation: (label: string, change: Partial<EventPlan>) => void;
  cancelSimulation: () => void;
  applySimulation: () => void;

  // Versioning & audit
  getPlanVersion: (version: number) => EventPlan | null;
  getModificationHistory: () => PlanModification[];
  revertToVersion: (version: number) => void;

  // Health & metrics
  recalculateHealth: () => void;
  getHealthReport: () => { score: number; factors: Record<string, number> };

  // Lifecycle
  clearPlan: () => void;
}

// ─── Context Creation ─────────────────────────────────────────────────────────
const EventPlanContext = createContext<EventPlanContextType | undefined>(undefined);

// ─── Provider Component ───────────────────────────────────────────────────────
export function EventPlanProvider({ children }: { children: ReactNode }) {
  const [currentPlan, setCurrentPlan] = useState<EventPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<EventPlan[]>([]);
  const [simulationMode, setSimulationMode] = useState(false);
  const [activeSimulation, setActiveSimulation] = useState<WhatIfSimulation | null>(null);

  // ── Initialize a new plan ──────────────────────────────────────────────────
  const initializePlan = useCallback((eventDetails: Partial<EventPlan>) => {
    const newPlan: EventPlan = {
      id: `plan-${Date.now()}`,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      eventType: eventDetails.eventType || '',
      guestCount: eventDetails.guestCount || 0,
      totalBudget: eventDetails.totalBudget || 0,
      allocatedBudget: 0,
      remainingBudget: eventDetails.totalBudget || 0,
      luxuryLevel: eventDetails.luxuryLevel || 'standard',
      services: eventDetails.services || [],
      selectedVendors: eventDetails.selectedVendors || [],
      excludedServices: eventDetails.excludedServices || [],
      priorities: new Map(eventDetails.priorities ? Array.from(eventDetails.priorities.entries()) : []),
      timeline: eventDetails.timeline || [],
      risks: eventDetails.risks || [],
      riskScore: 0,
      healthScore: 0,
      completionPercentage: 0,
      planStatus: 'draft',
      modifications: [],
      recommendations: eventDetails.recommendations || [],
      conversationId: eventDetails.conversationId,
      userId: eventDetails.userId,
      ...eventDetails,
    };
    setCurrentPlan(newPlan);
    setPlanHistory([]);
  }, []);

  // ── Update plan (tracked as modification) ──────────────────────────────────
  const updatePlan = useCallback((updates: Partial<EventPlan>) => {
    if (!currentPlan) return;

    const previousPlan = { ...currentPlan };
    const updatedPlan: EventPlan = {
      ...currentPlan,
      ...updates,
      version: currentPlan.version + 1,
      updatedAt: new Date(),
    };

    // Record modification
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'version' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'modifications') {
        updatedPlan.modifications.push({
          id: `mod-${Date.now()}-${Math.random()}`,
          type: 'update_event_detail',
          target: key,
          previousValue: (previousPlan as any)[key],
          newValue: (updates as any)[key],
          appliedAt: new Date(),
          isConfirmed: !simulationMode,
        });
      }
    });

    setCurrentPlan(updatedPlan);
  }, [currentPlan, simulationMode]);

  // ── Confirm all pending changes in the plan ─────────────────────────────────
  const confirmPlanChanges = useCallback(() => {
    if (!currentPlan) return;

    const confirmedPlan = {
      ...currentPlan,
      modifications: currentPlan.modifications.map(m => ({ ...m, isConfirmed: true })),
      planStatus: 'planning' as const,
    };

    setCurrentPlan(confirmedPlan);
  }, [currentPlan]);

  // ── Service management ───────────────────────────────────────────────────────
  const addService = useCallback((service: EventService) => {
    if (!currentPlan) return;

    updatePlan({
      services: [...currentPlan.services, service],
    });
  }, [currentPlan, updatePlan]);

  const removeService = useCallback((serviceId: string) => {
    if (!currentPlan) return;

    updatePlan({
      services: currentPlan.services.filter(s => s.id !== serviceId),
      excludedServices: [...currentPlan.excludedServices, serviceId],
    });
  }, [currentPlan, updatePlan]);

  const updateService = useCallback((serviceId: string, updates: Partial<EventService>) => {
    if (!currentPlan) return;

    updatePlan({
      services: currentPlan.services.map(s => s.id === serviceId ? { ...s, ...updates } : s),
    });
  }, [currentPlan, updatePlan]);

  const setPriority = useCallback((serviceId: string, priority: 'critical' | 'high' | 'medium' | 'low') => {
    if (!currentPlan) return;

    const newPriorities = new Map(currentPlan.priorities);
    newPriorities.set(serviceId, priority);

    updatePlan({
      priorities: newPriorities,
    });
  }, [currentPlan, updatePlan]);

  // ── Budget operations ──────────────────────────────────────────────────────
  const rebalanceBudget = useCallback((totalBudget: number) => {
    if (!currentPlan) return;

    const allocated = currentPlan.services.reduce((sum, s) => sum + s.allocatedBudget, 0);
    const remaining = Math.max(0, totalBudget - allocated);

    updatePlan({
      totalBudget,
      allocatedBudget: allocated,
      remainingBudget: remaining,
    });
  }, [currentPlan, updatePlan]);

  const adjustServiceBudget = useCallback((serviceId: string, newBudget: number) => {
    if (!currentPlan) return;

    const service = currentPlan.services.find(s => s.id === serviceId);
    if (!service) return;

    const oldBudget = service.allocatedBudget;
    const budgetDifference = newBudget - oldBudget;

    updateService(serviceId, { allocatedBudget: newBudget });

    const newAllocated = currentPlan.services.reduce((sum, s) =>
      sum + (s.id === serviceId ? newBudget : s.allocatedBudget), 0
    );

    updatePlan({
      allocatedBudget: newAllocated,
      remainingBudget: currentPlan.totalBudget - newAllocated,
    });
  }, [currentPlan, updatePlan, updateService]);

  const detectBudgetConflict = useCallback(() => {
    if (!currentPlan) return { exceeded: false, gap: 0 };

    const gap = currentPlan.allocatedBudget - currentPlan.totalBudget;
    return {
      exceeded: gap > 0,
      gap: Math.max(0, gap),
    };
  }, [currentPlan]);

  // ── Timeline operations ───────────────────────────────────────────────────
  const regenerateTimeline = useCallback(() => {
    if (!currentPlan) return;
    // This will be called by eventTimelineEngine
    // For now, just mark as needing update
    updatePlan({ timeline: currentPlan.timeline });
  }, [currentPlan, updatePlan]);

  const updateTimeline = useCallback((items: TimelineItem[]) => {
    if (!currentPlan) return;
    updatePlan({ timeline: items });
  }, [currentPlan, updatePlan]);

  // ── Risk management ───────────────────────────────────────────────────────
  const recalculateRisks = useCallback(() => {
    if (!currentPlan) return;
    // This will be called by eventRiskDetector
    // For now, just mark as needing update
    updatePlan({ risks: currentPlan.risks });
  }, [currentPlan, updatePlan]);

  const acknowledgeRisk = useCallback((riskId: string) => {
    if (!currentPlan) return;

    // Mark risk as acknowledged by user (could add an 'acknowledged' field if needed)
    console.log('[EventPlan] Risk acknowledged:', riskId);
  }, [currentPlan]);

  // ── What-if simulations ───────────────────────────────────────────────────
  const startSimulation = useCallback((label: string, change: Partial<EventPlan>) => {
    if (!currentPlan) return;

    const sim: WhatIfSimulation = {
      id: `sim-${Date.now()}`,
      basePlanId: currentPlan.id,
      label,
      change,
      estimatedImpact: {
        costDifference: (change.totalBudget || 0) - currentPlan.totalBudget,
        affectedServices: change.services?.map(s => s.id) || [],
        timelineShift: 0,
        riskChange: 0,
      },
      createdAt: new Date(),
    };

    setActiveSimulation(sim);
    setSimulationMode(true);
  }, [currentPlan]);

  const cancelSimulation = useCallback(() => {
    setActiveSimulation(null);
    setSimulationMode(false);
  }, []);

  const applySimulation = useCallback(() => {
    if (!activeSimulation || !currentPlan) return;

    // Apply the simulation changes to the actual plan
    updatePlan(activeSimulation.change);
    confirmPlanChanges();
    setActiveSimulation(null);
    setSimulationMode(false);
  }, [activeSimulation, currentPlan, updatePlan, confirmPlanChanges]);

  // ── Versioning & audit ────────────────────────────────────────────────────
  const getPlanVersion = useCallback((version: number) => {
    return planHistory.find(p => p.version === version) || null;
  }, [planHistory]);

  const getModificationHistory = useCallback(() => {
    return currentPlan?.modifications || [];
  }, [currentPlan]);

  const revertToVersion = useCallback((version: number) => {
    const previousPlan = getPlanVersion(version);
    if (previousPlan) {
      setCurrentPlan(previousPlan);
    }
  }, [getPlanVersion]);

  // ── Health & metrics ──────────────────────────────────────────────────────
  const recalculateHealth = useCallback(() => {
    if (!currentPlan) return;
    // This will be called by eventHealthScore
    // For now, just mark as needing update
    updatePlan({ healthScore: currentPlan.healthScore });
  }, [currentPlan, updatePlan]);

  const getHealthReport = useCallback(() => {
    if (!currentPlan) return { score: 0, factors: {} };

    return {
      score: currentPlan.healthScore,
      factors: {
        budgetHealth: currentPlan.remainingBudget > 0 ? 100 : 0,
        vendorCoverage: currentPlan.selectedVendors.length > 0 ? 100 : 0,
        timelineReadiness: currentPlan.timeline.length > 0 ? 50 : 0,
        riskManagement: 100 - currentPlan.riskScore,
      },
    };
  }, [currentPlan]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  const clearPlan = useCallback(() => {
    setCurrentPlan(null);
    setPlanHistory([]);
    setActiveSimulation(null);
    setSimulationMode(false);
  }, []);

  const value: EventPlanContextType = {
    currentPlan,
    simulationMode,
    activeSimulation,
    initializePlan,
    updatePlan,
    confirmPlanChanges,
    addService,
    removeService,
    updateService,
    setPriority,
    rebalanceBudget,
    adjustServiceBudget,
    detectBudgetConflict,
    regenerateTimeline,
    updateTimeline,
    recalculateRisks,
    acknowledgeRisk,
    startSimulation,
    cancelSimulation,
    applySimulation,
    getPlanVersion,
    getModificationHistory,
    revertToVersion,
    recalculateHealth,
    getHealthReport,
    clearPlan,
  };

  return (
    <EventPlanContext.Provider value={value}>
      {children}
    </EventPlanContext.Provider>
  );
}

// ─── Hook to use the context ──────────────────────────────────────────────────
export function useEventPlan(): EventPlanContextType {
  const context = useContext(EventPlanContext);
  if (!context) {
    throw new Error('useEventPlan must be used within EventPlanProvider');
  }
  return context;
}

export default EventPlanContext;
