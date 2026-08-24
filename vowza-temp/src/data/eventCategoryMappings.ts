// Event to required artist categories mapping
export interface EventCategoryMapping {
  eventId: string;
  eventName: string;
  requiredCategories: {
    category: string;
    priority: 'essential' | 'recommended' | 'optional';
    budgetPercentage: number; // % of total budget
  }[];
}

export const eventCategoryMappings: EventCategoryMapping[] = [
  {
    eventId: 'wedding',
    eventName: 'Wedding',
    requiredCategories: [
      { category: 'photographer', priority: 'essential', budgetPercentage: 15 },
      { category: 'videographer', priority: 'essential', budgetPercentage: 15 },
      { category: 'decorator', priority: 'essential', budgetPercentage: 20 },
      { category: 'dj', priority: 'essential', budgetPercentage: 10 },
      { category: 'normal_band', priority: 'recommended', budgetPercentage: 15 },
      { category: 'makeup_artist', priority: 'recommended', budgetPercentage: 8 },
      { category: 'mehendi_artist', priority: 'recommended', budgetPercentage: 5 },
      { category: 'anchor', priority: 'recommended', budgetPercentage: 5 },
      { category: 'lighting_services', priority: 'optional', budgetPercentage: 4 },
      { category: 'sound_services', priority: 'optional', budgetPercentage: 3 },
    ],
  },
  {
    eventId: 'reception',
    eventName: 'Reception',
    requiredCategories: [
      { category: 'photographer', priority: 'essential', budgetPercentage: 15 },
      { category: 'videographer', priority: 'essential', budgetPercentage: 15 },
      { category: 'decorator', priority: 'essential', budgetPercentage: 20 },
      { category: 'dj', priority: 'essential', budgetPercentage: 15 },
      { category: 'normal_band', priority: 'recommended', budgetPercentage: 20 },
      { category: 'anchor', priority: 'recommended', budgetPercentage: 8 },
      { category: 'lighting_services', priority: 'optional', budgetPercentage: 5 },
      { category: 'sound_services', priority: 'optional', budgetPercentage: 2 },
    ],
  },
  {
    eventId: 'birthday',
    eventName: 'Birthday',
    requiredCategories: [
      { category: 'decorator', priority: 'essential', budgetPercentage: 25 },
      { category: 'dj', priority: 'essential', budgetPercentage: 20 },
      { category: 'photographer', priority: 'recommended', budgetPercentage: 20 },
      { category: 'anchor', priority: 'recommended', budgetPercentage: 15 },
      { category: 'normal_band', priority: 'optional', budgetPercentage: 15 },
      { category: 'magician', priority: 'optional', budgetPercentage: 5 },
    ],
  },
  {
    eventId: 'corporate',
    eventName: 'Corporate',
    requiredCategories: [
      { category: 'event_planner', priority: 'essential', budgetPercentage: 20 },
      { category: 'photographer', priority: 'essential', budgetPercentage: 15 },
      { category: 'videographer', priority: 'essential', budgetPercentage: 15 },
      { category: 'anchor', priority: 'essential', budgetPercentage: 15 },
      { category: 'decorator', priority: 'recommended', budgetPercentage: 15 },
      { category: 'dj', priority: 'recommended', budgetPercentage: 10 },
      { category: 'sound_services', priority: 'optional', budgetPercentage: 5 },
      { category: 'lighting_services', priority: 'optional', budgetPercentage: 5 },
    ],
  },
  {
    eventId: 'haldi',
    eventName: 'Haldi Ceremony',
    requiredCategories: [
      { category: 'photographer', priority: 'essential', budgetPercentage: 25 },
      { category: 'decorator', priority: 'essential', budgetPercentage: 25 },
      { category: 'dj', priority: 'recommended', budgetPercentage: 20 },
      { category: 'normal_band', priority: 'recommended', budgetPercentage: 20 },
      { category: 'mehendi_artist', priority: 'optional', budgetPercentage: 10 },
    ],
  },
  {
    eventId: 'engagement',
    eventName: 'Engagement',
    requiredCategories: [
      { category: 'photographer', priority: 'essential', budgetPercentage: 20 },
      { category: 'videographer', priority: 'essential', budgetPercentage: 20 },
      { category: 'decorator', priority: 'essential', budgetPercentage: 25 },
      { category: 'dj', priority: 'recommended', budgetPercentage: 15 },
      { category: 'normal_band', priority: 'recommended', budgetPercentage: 15 },
      { category: 'anchor', priority: 'optional', budgetPercentage: 5 },
    ],
  },
  {
    eventId: 'babyshower',
    eventName: 'Baby Shower',
    requiredCategories: [
      { category: 'decorator', priority: 'essential', budgetPercentage: 30 },
      { category: 'photographer', priority: 'essential', budgetPercentage: 25 },
      { category: 'anchor', priority: 'recommended', budgetPercentage: 20 },
      { category: 'normal_band', priority: 'optional', budgetPercentage: 15 },
      { category: 'magician', priority: 'optional', budgetPercentage: 10 },
    ],
  },
  {
    eventId: 'housewarming',
    eventName: 'House Warming',
    requiredCategories: [
      { category: 'decorator', priority: 'essential', budgetPercentage: 25 },
      { category: 'photographer', priority: 'essential', budgetPercentage: 20 },
      { category: 'catering_services', priority: 'essential', budgetPercentage: 25 },
      { category: 'anchor', priority: 'recommended', budgetPercentage: 15 },
      { category: 'normal_band', priority: 'optional', budgetPercentage: 15 },
    ],
  },
  {
    eventId: 'temple',
    eventName: 'Temple Events',
    requiredCategories: [
      { category: 'photographer', priority: 'essential', budgetPercentage: 30 },
      { category: 'traditional_band', priority: 'essential', budgetPercentage: 25 },
      { category: 'classical_musician', priority: 'recommended', budgetPercentage: 20 },
      { category: 'decorator', priority: 'optional', budgetPercentage: 15 },
      { category: 'classical_dancer', priority: 'optional', budgetPercentage: 10 },
    ],
  },
  {
    eventId: 'collegefest',
    eventName: 'College Fest',
    requiredCategories: [
      { category: 'event_planner', priority: 'essential', budgetPercentage: 20 },
      { category: 'dj', priority: 'essential', budgetPercentage: 20 },
      { category: 'sound_services', priority: 'essential', budgetPercentage: 15 },
      { category: 'lighting_services', priority: 'essential', budgetPercentage: 15 },
      { category: 'photographer', priority: 'recommended', budgetPercentage: 10 },
      { category: 'normal_band', priority: 'recommended', budgetPercentage: 15 },
      { category: 'anchor', priority: 'optional', budgetPercentage: 5 },
    ],
  },
  {
    eventId: 'private',
    eventName: 'Private Party',
    requiredCategories: [
      { category: 'dj', priority: 'essential', budgetPercentage: 25 },
      { category: 'photographer', priority: 'essential', budgetPercentage: 20 },
      { category: 'decorator', priority: 'recommended', budgetPercentage: 20 },
      { category: 'normal_band', priority: 'recommended', budgetPercentage: 20 },
      { category: 'anchor', priority: 'optional', budgetPercentage: 10 },
      { category: 'catering_services', priority: 'optional', budgetPercentage: 5 },
    ],
  },
];

// Helper function to get categories for an event
export function getCategoriesForEvent(eventId: string) {
  return eventCategoryMappings.find(e => e.eventId === eventId)?.requiredCategories || [];
}

// Helper function to get budget distribution for an event
export function getBudgetDistribution(eventId: string, totalBudget: number) {
  const categories = getCategoriesForEvent(eventId);
  return categories.map(cat => ({
    category: cat.category,
    priority: cat.priority,
    budget: Math.round(totalBudget * (cat.budgetPercentage / 100)),
    budgetPercentage: cat.budgetPercentage,
  }));
}
