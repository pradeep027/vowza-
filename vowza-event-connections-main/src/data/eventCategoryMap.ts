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
      'lighting_services', 'sound_services', 'pandit',
    ],
  },
  {
    eventId: 'reception',
    eventName: 'Reception',
    categories: [
      'photographer', 'videographer', 'cinematographer', 'drone_operator',
      'wedding_decorator', 'stage_decorator', 'event_decorator',
      'music_band', 'normal_band', 'dj', 'singer', 'instrumental_artist',
      'anchor', 'host', 'lighting_services', 'sound_services',
      'catering_services', 'banquet_hall',
    ],
  },
  {
    eventId: 'birthday',
    eventName: 'Birthday',
    categories: [
      'magician', 'photographer', 'videographer',
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
      'lighting_services', 'sound_services', 'stage_decorator',
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
      'choreographer', 'dancer', 'kuchipudi_dancer', 'classical_dancer', 'western_dancer',
      'dj', 'music_band', 'singer', 'normal_band',
      'photographer', 'videographer', 'lighting_services', 'sound_services',
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
      'dancer', 'choreographer', 'anchor', 'host',
      'photographer', 'videographer', 'lighting_services', 'sound_services',
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
      'event_decorator', 'lighting_services', 'sound_services',
      'catering_services', 'anchor', 'magician',
    ],
  },
];

/** Get the categories for a given event ID */
export function getCategoriesForEvent(eventId: string): string[] | null {
  const mapping = EVENT_CATEGORY_MAP.find(m => m.eventId === eventId);
  return mapping ? mapping.categories : null;
}

/** Get the event name for display */
export function getEventName(eventId: string): string | null {
  const mapping = EVENT_CATEGORY_MAP.find(m => m.eventId === eventId);
  return mapping ? mapping.eventName : null;
}
