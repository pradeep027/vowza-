import {
  Music, Disc3, Camera, Video, Palette, Users, Mic2, Sparkles,
  Utensils, CalendarDays, Star, Heart, Plane
} from 'lucide-react';

// ─── All 34 profession types matching Supabase enum + V2 extension ────────────
export type ProfessionType =
  | 'normal_band'       // legacy
  | 'maharashtra_band'  // legacy
  | 'musician'          // legacy
  | 'decorator'         // legacy
  | 'event_support'     // legacy
  | 'music_band'
  | 'traditional_band'
  | 'dj'
  | 'singer'
  | 'instrumental_artist'
  | 'classical_musician'
  | 'photographer'
  | 'videographer'
  | 'cinematographer'
  | 'drone_operator'
  | 'dancer'
  | 'kuchipudi_dancer'
  | 'classical_dancer'
  | 'western_dancer'
  | 'event_decorator'
  | 'wedding_decorator'
  | 'stage_decorator'
  | 'makeup_artist'
  | 'mehendi_artist'
  | 'anchor'
  | 'host'
  | 'stand_up_comedian'
  | 'celebrity_artist'
  | 'live_performer'
  | 'folk_artist'
  | 'event_planner'
  | 'wedding_planner'
  | 'catering_services'
  | 'event_support_staff';

export interface CategoryField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'textarea';
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
}

export interface ArtistCategory {
  value: ProfessionType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  dynamicFields: CategoryField[];
}

// ─── Shared field sets ────────────────────────────────────────────────────────
const genreFields: CategoryField[] = [
  { name: 'music_genres', label: 'Music Genres', type: 'multiselect', options: [
    { value: 'bollywood', label: 'Bollywood' }, { value: 'folk', label: 'Folk' },
    { value: 'pop', label: 'Pop' }, { value: 'rock', label: 'Rock' },
    { value: 'jazz', label: 'Jazz' }, { value: 'classical', label: 'Classical' },
    { value: 'sufi', label: 'Sufi' }, { value: 'devotional', label: 'Devotional' },
  ]},
];

const eventTypeFields: CategoryField[] = [
  { name: 'event_types', label: 'Event Types', type: 'multiselect', options: [
    { value: 'wedding', label: 'Wedding' }, { value: 'reception', label: 'Reception' },
    { value: 'birthday', label: 'Birthday' }, { value: 'corporate', label: 'Corporate' },
    { value: 'sangeet', label: 'Sangeet' }, { value: 'engagement', label: 'Engagement' },
  ]},
];

// ─── Category definitions ─────────────────────────────────────────────────────
export const artistCategories: ArtistCategory[] = [
  {
    value: 'music_band', label: 'Music Band', description: 'Live bands for weddings and events',
    icon: Music, color: 'from-purple-500 to-indigo-600',
    dynamicFields: [
      { name: 'band_members', label: 'Number of Members', type: 'number', placeholder: '5', required: true },
      { name: 'instruments', label: 'Instruments', type: 'text', placeholder: 'Drums, Guitar, Keyboard...' },
      ...genreFields, ...eventTypeFields,
    ],
  },
  {
    value: 'traditional_band', label: 'Traditional Band', description: 'Traditional Indian bands with dhol and folk instruments',
    icon: Music, color: 'from-orange-500 to-red-600',
    dynamicFields: [
      { name: 'band_members', label: 'Number of Members', type: 'number', placeholder: '8', required: true },
      { name: 'instruments', label: 'Instruments', type: 'text', placeholder: 'Dhol, Tasha, Shehnai...' },
      ...eventTypeFields,
    ],
  },
  {
    value: 'maharashtra_band', label: 'Maharashtra Band', description: 'Regional Maharashtra bands for traditional celebrations',
    icon: Music, color: 'from-amber-500 to-orange-600',
    dynamicFields: [
      { name: 'band_members', label: 'Number of Members', type: 'number', placeholder: '10', required: true },
      { name: 'specialization', label: 'Specialization', type: 'text', placeholder: 'Dhol-Tasha, Lezim...' },
    ],
  },
  {
    value: 'dj', label: 'DJ', description: 'Professional DJs for all event types',
    icon: Disc3, color: 'from-pink-500 to-rose-600',
    dynamicFields: [
      { name: 'dj_style', label: 'DJ Style', type: 'select', required: true, options: [
        { value: 'bollywood', label: 'Bollywood' }, { value: 'edm', label: 'EDM' },
        { value: 'commercial', label: 'Commercial' }, { value: 'hip_hop', label: 'Hip Hop' },
        { value: 'multi_genre', label: 'Multi-Genre' },
      ]},
      { name: 'sound_system', label: 'Own Sound System?', type: 'select', options: [
        { value: 'yes', label: 'Yes — included in package' }, { value: 'no', label: 'No — venue provides' },
      ]},
      ...eventTypeFields,
    ],
  },
  {
    value: 'singer', label: 'Singer', description: 'Vocal artists and singers for all occasions',
    icon: Mic2, color: 'from-rose-500 to-pink-600',
    dynamicFields: [
      { name: 'vocal_range', label: 'Vocal Range', type: 'text', placeholder: 'e.g., Baritone, Soprano' },
      ...genreFields, ...eventTypeFields,
    ],
  },
  {
    value: 'photographer', label: 'Photographer', description: 'Professional photography services',
    icon: Camera, color: 'from-blue-500 to-cyan-600',
    dynamicFields: [
      { name: 'photography_style', label: 'Photography Style', type: 'multiselect', required: true, options: [
        { value: 'candid', label: 'Candid' }, { value: 'traditional', label: 'Traditional' },
        { value: 'pre_wedding', label: 'Pre-Wedding' }, { value: 'cinematic', label: 'Cinematic' },
        { value: 'documentary', label: 'Documentary' },
      ]},
      { name: 'camera_equipment', label: 'Camera Equipment', type: 'text', placeholder: 'Canon R5, Sony A7...' },
      { name: 'delivery_days', label: 'Photo Delivery (days)', type: 'number', placeholder: '30' },
      ...eventTypeFields,
    ],
  },
  {
    value: 'videographer', label: 'Videographer', description: 'Video recording and editing services',
    icon: Video, color: 'from-violet-500 to-purple-600',
    dynamicFields: [
      { name: 'video_style', label: 'Video Style', type: 'multiselect', required: true, options: [
        { value: 'cinematic', label: 'Cinematic' }, { value: 'documentary', label: 'Documentary' },
        { value: 'highlight_reel', label: 'Highlight Reel' }, { value: 'full_coverage', label: 'Full Coverage' },
      ]},
      { name: 'drone_available', label: 'Drone Available?', type: 'select', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
      ...eventTypeFields,
    ],
  },
  {
    value: 'cinematographer', label: 'Cinematographer', description: 'Cinematic video production for premium events',
    icon: Video, color: 'from-slate-500 to-slate-700',
    dynamicFields: [
      { name: 'camera_equipment', label: 'Camera Equipment', type: 'text', placeholder: 'RED, ARRI, Sony...' },
      ...eventTypeFields,
    ],
  },
  {
    value: 'drone_operator', label: 'Drone Operator', description: 'Aerial photography and videography',
    icon: Plane, color: 'from-sky-500 to-blue-600',
    dynamicFields: [
      { name: 'drone_model', label: 'Drone Model', type: 'text', placeholder: 'DJI Mavic 3, Inspire 2...' },
      { name: 'licensed', label: 'DGCA Licensed?', type: 'select', required: true, options: [
        { value: 'yes', label: 'Yes — DGCA licensed' }, { value: 'no', label: 'No' },
      ]},
    ],
  },
  {
    value: 'dancer', label: 'Dancer', description: 'Professional dance performers',
    icon: Users, color: 'from-emerald-500 to-teal-600',
    dynamicFields: [
      { name: 'dance_styles', label: 'Dance Styles', type: 'multiselect', required: true, options: [
        { value: 'bollywood', label: 'Bollywood' }, { value: 'folk', label: 'Folk' },
        { value: 'western', label: 'Western' }, { value: 'fusion', label: 'Fusion' },
        { value: 'semi_classical', label: 'Semi-Classical' },
      ]},
      { name: 'group_size', label: 'Group Size', type: 'number', placeholder: '4' },
      ...eventTypeFields,
    ],
  },
  {
    value: 'kuchipudi_dancer', label: 'Kuchipudi Dancer', description: 'Traditional Kuchipudi classical dance',
    icon: Users, color: 'from-amber-500 to-yellow-600',
    dynamicFields: [
      { name: 'training_years', label: 'Years of Training', type: 'number', required: true, placeholder: '10' },
      { name: 'performance_duration', label: 'Performance Duration (mins)', type: 'number', placeholder: '45' },
    ],
  },
  {
    value: 'classical_dancer', label: 'Classical Dancer', description: 'Indian classical dance forms',
    icon: Users, color: 'from-rose-400 to-red-600',
    dynamicFields: [
      { name: 'dance_form', label: 'Dance Form', type: 'select', required: true, options: [
        { value: 'bharatanatyam', label: 'Bharatanatyam' }, { value: 'kathak', label: 'Kathak' },
        { value: 'odissi', label: 'Odissi' }, { value: 'mohiniyattam', label: 'Mohiniyattam' },
        { value: 'manipuri', label: 'Manipuri' },
      ]},
    ],
  },
  {
    value: 'western_dancer', label: 'Western Dancer', description: 'Western and contemporary dance styles',
    icon: Users, color: 'from-indigo-500 to-blue-600',
    dynamicFields: [
      { name: 'dance_styles', label: 'Dance Styles', type: 'text', placeholder: 'Hip Hop, Contemporary, Salsa...' },
    ],
  },
  {
    value: 'event_decorator', label: 'Event Decorator', description: 'Event decoration and setup services',
    icon: Palette, color: 'from-pink-400 to-fuchsia-600',
    dynamicFields: [
      { name: 'decoration_styles', label: 'Decoration Styles', type: 'multiselect', required: true, options: [
        { value: 'floral', label: 'Floral' }, { value: 'modern', label: 'Modern' },
        { value: 'traditional', label: 'Traditional' }, { value: 'luxury', label: 'Luxury' },
        { value: 'budget', label: 'Budget-Friendly' },
      ]},
      { name: 'team_size', label: 'Team Size', type: 'number', placeholder: '5' },
      ...eventTypeFields,
    ],
  },
  {
    value: 'wedding_decorator', label: 'Wedding Decorator', description: 'Specialist wedding decoration',
    icon: Palette, color: 'from-rose-400 to-maroon',
    dynamicFields: [
      { name: 'specialties', label: 'Specialties', type: 'text', placeholder: 'Mandap, Stage, Entry arch...' },
      ...eventTypeFields,
    ],
  },
  {
    value: 'stage_decorator', label: 'Stage Decorator', description: 'Stage and set decoration for events',
    icon: Palette, color: 'from-violet-400 to-purple-600',
    dynamicFields: [
      { name: 'stage_types', label: 'Stage Types', type: 'text', placeholder: 'Proscenium, Thrust, Runway...' },
    ],
  },
  {
    value: 'makeup_artist', label: 'Makeup Artist', description: 'Professional makeup and styling services',
    icon: Sparkles, color: 'from-pink-500 to-rose-500',
    dynamicFields: [
      { name: 'makeup_type', label: 'Makeup Type', type: 'multiselect', required: true, options: [
        { value: 'bridal', label: 'Bridal' }, { value: 'airbrush', label: 'Airbrush' },
        { value: 'hd', label: 'HD Makeup' }, { value: 'party', label: 'Party' },
        { value: 'editorial', label: 'Editorial' },
      ]},
      { name: 'trial_available', label: 'Trial Session Available?', type: 'select', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
      ]},
    ],
  },
  {
    value: 'mehendi_artist', label: 'Mehendi Artist', description: 'Mehendi design specialists',
    icon: Sparkles, color: 'from-amber-400 to-orange-500',
    dynamicFields: [
      { name: 'mehendi_styles', label: 'Mehendi Styles', type: 'multiselect', required: true, options: [
        { value: 'bridal', label: 'Bridal Mehendi' }, { value: 'arabic', label: 'Arabic' },
        { value: 'rajasthani', label: 'Rajasthani' }, { value: 'indo_arabic', label: 'Indo-Arabic' },
      ]},
    ],
  },
  {
    value: 'anchor', label: 'Anchor / Emcee', description: 'Professional event anchors',
    icon: Mic2, color: 'from-cyan-500 to-blue-500',
    dynamicFields: [
      { name: 'languages', label: 'Languages', type: 'text', required: true, placeholder: 'Hindi, English, Telugu...' },
      { name: 'event_types_handled', label: 'Events Handled', type: 'text', placeholder: 'Wedding, Corporate, Birthday...' },
    ],
  },
  {
    value: 'host', label: 'Host / Presenter', description: 'Event hosts and presenters',
    icon: Mic2, color: 'from-sky-500 to-indigo-500',
    dynamicFields: [
      { name: 'languages', label: 'Languages', type: 'text', required: true, placeholder: 'Hindi, English...' },
    ],
  },
  {
    value: 'stand_up_comedian', label: 'Stand-up Comedian', description: 'Comedy entertainers',
    icon: Mic2, color: 'from-yellow-500 to-amber-500',
    dynamicFields: [
      { name: 'set_duration', label: 'Set Duration (mins)', type: 'number', placeholder: '45' },
      { name: 'languages', label: 'Languages', type: 'text', required: true, placeholder: 'Hindi, English...' },
    ],
  },
  {
    value: 'celebrity_artist', label: 'Celebrity Artist', description: 'Celebrity performers for premium events',
    icon: Star, color: 'from-gold-dark to-amber-600',
    dynamicFields: [
      { name: 'genre', label: 'Genre / Specialty', type: 'text', required: true, placeholder: 'Bollywood singer, Actor...' },
      { name: 'min_audience', label: 'Minimum Audience Size', type: 'number', placeholder: '500' },
    ],
  },
  {
    value: 'live_performer', label: 'Live Performer', description: 'Various live performance artists',
    icon: Music, color: 'from-teal-500 to-green-600',
    dynamicFields: [
      { name: 'performance_type', label: 'Performance Type', type: 'text', required: true, placeholder: 'Juggling, Acrobatics, Fire show...' },
    ],
  },
  {
    value: 'folk_artist', label: 'Folk Artist', description: 'Traditional folk performers',
    icon: Music, color: 'from-orange-400 to-amber-500',
    dynamicFields: [
      { name: 'folk_form', label: 'Folk Art Form', type: 'text', required: true, placeholder: 'Lavani, Bhangra, Garba...' },
      { name: 'group_size', label: 'Group Size', type: 'number', placeholder: '6' },
    ],
  },
  {
    value: 'event_planner', label: 'Event Planner', description: 'Complete event planning and coordination',
    icon: CalendarDays, color: 'from-blue-500 to-indigo-600',
    dynamicFields: [
      { name: 'events_managed', label: 'Events Managed Per Year', type: 'number', placeholder: '25' },
      { name: 'team_size', label: 'Team Size', type: 'number', placeholder: '8' },
      ...eventTypeFields,
    ],
  },
  {
    value: 'wedding_planner', label: 'Wedding Planner', description: 'End-to-end wedding planning services',
    icon: Heart, color: 'from-rose-500 to-maroon',
    dynamicFields: [
      { name: 'weddings_planned', label: 'Weddings Planned', type: 'number', placeholder: '50', required: true },
      { name: 'min_budget', label: 'Minimum Wedding Budget (₹)', type: 'number', placeholder: '500000' },
    ],
  },
  {
    value: 'catering_services', label: 'Catering Services', description: 'Food and catering for events',
    icon: Utensils, color: 'from-green-500 to-emerald-600',
    dynamicFields: [
      { name: 'cuisine_types', label: 'Cuisine Types', type: 'multiselect', required: true, options: [
        { value: 'north_indian', label: 'North Indian' }, { value: 'south_indian', label: 'South Indian' },
        { value: 'continental', label: 'Continental' }, { value: 'chinese', label: 'Chinese' },
        { value: 'live_counters', label: 'Live Counters' },
      ]},
      { name: 'min_pax', label: 'Minimum Guests', type: 'number', placeholder: '100', required: true },
      { name: 'max_pax', label: 'Maximum Guests', type: 'number', placeholder: '1000' },
    ],
  },
  // ─── Legacy values for backward compatibility ─────────────────────────────
  {
    value: 'normal_band', label: 'Music Band', description: 'Live bands for all events',
    icon: Music, color: 'from-purple-500 to-indigo-600',
    dynamicFields: [...genreFields, ...eventTypeFields],
  },
  {
    value: 'musician', label: 'Musician', description: 'Solo musician / instrumentalist',
    icon: Music, color: 'from-teal-500 to-cyan-600',
    dynamicFields: [
      { name: 'instrument', label: 'Primary Instrument', type: 'text', required: true, placeholder: 'Sitar, Flute, Violin...' },
      ...genreFields,
    ],
  },
  {
    value: 'decorator', label: 'Decorator', description: 'Event decoration services',
    icon: Palette, color: 'from-pink-400 to-fuchsia-600',
    dynamicFields: [...eventTypeFields],
  },
  {
    value: 'event_support', label: 'Event Support', description: 'General event support staff',
    icon: Users, color: 'from-slate-400 to-slate-600',
    dynamicFields: [],
  },
  {
    value: 'event_support_staff', label: 'Event Support Staff', description: 'General event support staff',
    icon: Users, color: 'from-slate-400 to-slate-600',
    dynamicFields: [],
  },
];

// ─── Helper maps ──────────────────────────────────────────────────────────────
export const professionLabelMap: Record<string, string> = Object.fromEntries(
  artistCategories.map(c => [c.value, c.label])
);

export const getCategoryByValue = (value: string): ArtistCategory | undefined =>
  artistCategories.find(c => c.value === value);

// ─── Language options (used by BasicInfoStep) ─────────────────────────────────
export const languageOptions = [
  { value: "hindi",     label: "Hindi" },
  { value: "english",   label: "English" },
  { value: "marathi",   label: "Marathi" },
  { value: "telugu",    label: "Telugu" },
  { value: "tamil",     label: "Tamil" },
  { value: "kannada",   label: "Kannada" },
  { value: "malayalam", label: "Malayalam" },
  { value: "gujarati",  label: "Gujarati" },
  { value: "punjabi",   label: "Punjabi" },
  { value: "bengali",   label: "Bengali" },
  { value: "odia",      label: "Odia" },
  { value: "urdu",      label: "Urdu" },
];

// ─── Pricing type options (used by PricingStep) ───────────────────────────────
export const pricingTypeOptions = [
  { value: "per_event",   label: "Per Event" },
  { value: "per_day",     label: "Per Day" },
  { value: "per_hour",    label: "Per Hour" },
  { value: "per_person",  label: "Per Person" },
  { value: "negotiable",  label: "Negotiable" },
  { value: "custom",      label: "Custom Package" },
];
