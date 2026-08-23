// ─── Auth Promotion Category Mapping ─────────────────────────────────────────
// Maps all 34 profession_type enum values to their package tables and display names
// This is the authoritative source for Auth Promotion category → package table relationships

export interface AuthPromotionCategory {
  profession_type: string;  // Matches profession_type enum in Supabase
  display_name: string;     // Human-readable name for UI
  package_table: string | null;  // Supabase table name, or null if no packages
}

// Complete mapping of all 34 profession types to their package tables
// Derived from Supabase schema and categoryConfig.ts
export const AUTH_PROMOTION_CATEGORIES: AuthPromotionCategory[] = [
  // ─── Photography & Videography ─────────────────────────────────────────────
  { profession_type: 'photographer', display_name: 'Photographer', package_table: 'photography_packages' },
  { profession_type: 'videographer', display_name: 'Videographer', package_table: 'videography_packages' },
  { profession_type: 'cinematographer', display_name: 'Cinematographer', package_table: null }, // No dedicated table
  { profession_type: 'drone_operator', display_name: 'Drone Operator', package_table: 'drone_packages' },

  // ─── Music & Performance ───────────────────────────────────────────────────
  { profession_type: 'music_band', display_name: 'Music Band', package_table: 'band_packages' },
  { profession_type: 'traditional_band', display_name: 'Traditional Band', package_table: 'band_packages' },
  { profession_type: 'maharashtra_band', display_name: 'Maharashtra Band', package_table: 'band_packages' },
  { profession_type: 'dj', display_name: 'DJ', package_table: 'dj_packages' },
  { profession_type: 'singer', display_name: 'Singer', package_table: null }, // No dedicated table
  { profession_type: 'instrumental_artist', display_name: 'Instrumental Artist', package_table: null },
  { profession_type: 'classical_musician', display_name: 'Classical Musician', package_table: null },

  // ─── Dance & Movement ─────────────────────────────────────────────────────
  { profession_type: 'dancer', display_name: 'Dancer', package_table: 'dancer_packages' },
  { profession_type: 'choreographer', display_name: 'Choreographer', package_table: null },
  { profession_type: 'kuchipudi_dancer', display_name: 'Kuchipudi Dancer', package_table: null },
  { profession_type: 'classical_dancer', display_name: 'Classical Dancer', package_table: null },
  { profession_type: 'western_dancer', display_name: 'Western Dancer', package_table: null },

  // ─── Decoration & Design ──────────────────────────────────────────────────
  { profession_type: 'event_decorator', display_name: 'Event Decorator', package_table: 'decoration_packages' },
  { profession_type: 'wedding_decorator', display_name: 'Wedding Decorator', package_table: 'decoration_packages' },
  { profession_type: 'stage_decorator', display_name: 'Stage Decorator', package_table: 'decoration_packages' },

  // ─── Beauty & Makeup ──────────────────────────────────────────────────────
  { profession_type: 'makeup_artist', display_name: 'Makeup Artist', package_table: 'makeup_packages' },
  { profession_type: 'mehendi_artist', display_name: 'Mehendi Artist', package_table: 'mehendi_packages' },

  // ─── Events & Hosting ────────────────────────────────────────────────────
  { profession_type: 'anchor', display_name: 'Anchor', package_table: 'anchor_packages' },
  { profession_type: 'host', display_name: 'Host', package_table: null },
  { profession_type: 'magician', display_name: 'Magician', package_table: null },
  { profession_type: 'stand_up_comedian', display_name: 'Stand-up Comedian', package_table: null },
  { profession_type: 'celebrity_artist', display_name: 'Celebrity Artist', package_table: null },
  { profession_type: 'live_performer', display_name: 'Live Performer', package_table: null },
  { profession_type: 'folk_artist', display_name: 'Folk Artist', package_table: null },

  // ─── Technical Services ──────────────────────────────────────────────────
  { profession_type: 'lighting_services', display_name: 'Lighting Services', package_table: null },
  { profession_type: 'sound_services', display_name: 'Sound Services', package_table: null },

  // ─── Planning & Hospitality ─────────────────────────────────────────────
  { profession_type: 'event_planner', display_name: 'Event Planner', package_table: null },
  { profession_type: 'wedding_planner', display_name: 'Wedding Planner', package_table: null },
  { profession_type: 'catering_services', display_name: 'Catering', package_table: 'catering_packages' },
  { profession_type: 'event_support', display_name: 'Event Support', package_table: null },
];

/**
 * Get package table for a given profession type
 * @param profession_type - The profession type enum value
 * @returns Package table name or null if no packages
 */
export function getPackageTableForProfession(profession_type: string): string | null {
  const category = AUTH_PROMOTION_CATEGORIES.find(c => c.profession_type === profession_type);
  return category?.package_table ?? null;
}

/**
 * Get display name for a given profession type
 * @param profession_type - The profession type enum value
 * @returns Human-readable display name
 */
export function getDisplayNameForProfession(profession_type: string): string {
  const category = AUTH_PROMOTION_CATEGORIES.find(c => c.profession_type === profession_type);
  return category?.display_name ?? profession_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get all categories that have packages available for booking
 * @returns Array of categories with package tables
 */
export function getCategoriesWithPackages(): AuthPromotionCategory[] {
  return AUTH_PROMOTION_CATEGORIES.filter(c => c.package_table !== null);
}
