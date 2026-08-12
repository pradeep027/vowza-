// ─── Event → Category Mapping ─────────────────────────────────────────────────
// Maps each event type to the artist categories commonly required for that event.
// Used by the Artists page sidebar to show only relevant categories when an
// event filter is active.

export interface EventCategoryMapping {
  eventId: string;
  eventName: string;
  categories: string[]; // profession slugs from provider_profiles.profession
}

export const EVENT_CATEGORY_MAP: EventCategoryMapping[] = [
  {
    eventId: 'wedding',
    eventName: 'Wedding',
    categories: [
      'photographer', 'videographer', 'cinematographer', 'drone_operator',
      'wedding_decorator', 'stage_decorator', 'event_decorator',
      'makeup_artist', 'mehendi_artist', 'wedding_planner', 'event_planner',
      'music_band', 'normal_band', 'maharashtra_band', 'traditional_band',
      'dj', 'singer', 'classical_musician', 'instrumental_artist',
      'catering_services', 'banquet_hall', 'anchor', 'host',
      'pandit',
    ],
  },
  {
    eventId: 'reception',
    eventName: 'Reception',
    categories: [
      'photographer', 'videographer', 'cinematographer', 'drone_operator',
      'wedding_decorator', 'stage_decorator', 'event_decorator',
      'music_band', 'normal_band', 'dj', 'singer', 'instrumental_artist',
      'anchor', 'host',
      'catering_services', 'banquet_hall',
    ],
  },
  {
    eventId: 'birthday',
    eventName: 'Birthday',
    categories: [
      'photographer', 'videographer',
      'event_decorator', 'dj', 'anchor', 'host',
      'catering_services', 'singer', 'dancer',
    ],
  },
  {
    eventId: 'corporate',
    eventName: 'Corporate',
    categories: [
      'photographer', 'videographer', 'cinematographer',
      'anchor', 'host', 'music_band', 'instrumental_artist',
      'stage_decorator',
      'event_planner', 'catering_services', 'banquet_hall',
    ],
  },
  {
    eventId: 'haldi',
    eventName: 'Haldi Ceremony',
    categories: [
      'photographer', 'videographer', 'event_decorator', 'wedding_decorator',
      'mehendi_artist', 'makeup_artist', 'traditional_band', 'maharashtra_band',
      'classical_musician', 'catering_services',
    ],
  },
  {
    eventId: 'sangeet',
    eventName: 'Sangeet Night',
    categories: [
      'dancer', 'kuchipudi_dancer', 'classical_dancer', 'western_dancer',
      'dj', 'music_band', 'singer', 'normal_band',
      'photographer', 'videographer',
      'event_decorator', 'stage_decorator',
    ],
  },
  {
    eventId: 'engagement',
    eventName: 'Engagement',
    categories: [
      'photographer', 'videographer', 'drone_operator',
      'event_decorator', 'wedding_decorator',
      'music_band', 'dj', 'singer', 'makeup_artist',
      'catering_services', 'anchor', 'host',
    ],
  },
  {
    eventId: 'housewarming',
    eventName: 'House Warming',
    categories: [
      'pandit', 'event_decorator', 'photographer',
      'catering_services', 'traditional_band', 'classical_musician',
    ],
  },
  {
    eventId: 'babyshower',
    eventName: 'Baby Shower',
    categories: [
      'photographer', 'event_decorator', 'makeup_artist',
      'catering_services', 'anchor',
    ],
  },
  {
    eventId: 'collegefest',
    eventName: 'College Fest',
    categories: [
      'music_band', 'normal_band', 'dj', 'singer',
      'dancer', 'anchor', 'host',
      'photographer', 'videographer',
    ],
  },
  {
    eventId: 'temple',
    eventName: 'Temple Events',
    categories: [
      'pandit', 'classical_musician', 'traditional_band',
      'event_decorator', 'photographer',
    ],
  },
  {
    eventId: 'private',
    eventName: 'Private Party',
    categories: [
      'dj', 'music_band', 'singer', 'photographer', 'videographer',
      'event_decorator',
      'catering_services', 'anchor',
    ],
  },
  {
    eventId: 'anniversary',
    eventName: 'Anniversary',
    categories: [
      'photographer', 'videographer', 'cinematographer',
      'wedding_decorator', 'event_decorator',
      'dj', 'singer', 'music_band',
      'catering_services', 'anchor', 'makeup_artist',
    ],
  },
];

/** Get the categories for a given event ID or event name (case-insensitive, fuzzy) */
export function getCategoriesForEvent(eventId: string): string[] | null {
  if (!eventId) return null;
  const lower = eventId.toLowerCase().trim();
  const normalized = lower.replace(/[^a-z0-9]/g, '');

  // Exact match first
  let mapping = EVENT_CATEGORY_MAP.find(m => m.eventId === lower || m.eventId === normalized);
  if (mapping) return mapping.categories;

  // Match by eventName (case-insensitive)
  mapping = EVENT_CATEGORY_MAP.find(m => m.eventName.toLowerCase() === lower);
  if (mapping) return mapping.categories;

  // Fuzzy: normalized input starts with eventId or eventId starts with normalized
  mapping = EVENT_CATEGORY_MAP.find(m =>
    normalized.startsWith(m.eventId) || m.eventId.startsWith(normalized)
  );
  if (mapping) return mapping.categories;

  // Fuzzy: normalized eventName matches
  mapping = EVENT_CATEGORY_MAP.find(m =>
    m.eventName.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(normalized) ||
    normalized.startsWith(m.eventName.toLowerCase().replace(/[^a-z0-9]/g, ''))
  );
  return mapping ? mapping.categories : null;
}

/** Get the event name for display */
export function getEventName(eventId: string): string | null {
  const mapping = EVENT_CATEGORY_MAP.find(m => m.eventId === eventId);
  return mapping ? mapping.eventName : null;
}
