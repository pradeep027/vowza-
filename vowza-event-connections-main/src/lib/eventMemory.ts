// ─── Event Memory — Phase 2 conversation memory (pure) ──────────────────────
//
// Sits BETWEEN the existing regex extraction and the Event State:
//
//   user message → aiOrchestrator (existing, untouched) → PlannerContext
//        ↓
//   eventMemory.applyTurnToEventState(userMessage, updates, prevEventState)
//        ↓
//   Event State (canonical, versioned) → compact memory block for the LLM
//
// Responsibilities (and non-responsibilities):
//   • Preserves the user's own event wording (eventTypeRaw) — "Kammari
//     wedding" is kept as the user said it, while the canonical eventType
//     stays "wedding".
//   • Captures cultural facts ONLY when the user states them about
//     themselves ("I'm a Hindu Kammari family from Telangana"). An event
//     name alone ("Kammari wedding") NEVER populates religion/community/
//     culture/region. Unknown remains unknown.
//   • Applies latest-value-wins corrections through the Event State merge
//     (superseded values are recorded, never treated as current).
//   • Renders a COMPACT memory context for the LLM — confirmed facts, user
//     wording, corrected/stale values, and explicitly unknown fields.
//     Never a giant JSON dump.
//
// This module is PURE: no I/O, no Supabase. The bridge (eventStateBridge.ts)
// handles persistence; llm.ts only consumes the rendered memory block.

import type { PlannerContext } from './aiPlannerTypes';
import type { EventState, FieldChange } from './eventState';
import {
  applyContextUpdate,
  setRawEventType,
  setExplicitCulturalFacts,
} from './eventState';

// ─── Event keyword vocabulary ────────────────────────────────────────────────
// Matches the canonical categories the orchestrator already understands.
const EVENT_KEYWORDS = [
  'wedding', 'marriage', 'reception', 'engagement', 'birthday',
  'baby shower', 'babyshower', 'naming ceremony', 'housewarming',
  'griha pravesham', 'griha pravesh', 'gruhapravesam', 'gruhapravesam',
  'graha pravesham', 'anniversary', 'haldi', 'mehendi', 'mehndi', 'sangeet',
  'corporate event', 'conference', 'seminar', 'product launch', 'exhibition',
  'college fest', 'concert', 'dj night', 'fashion show', 'festival',
  'family function', 'private party', 'charity event', 'charity',
  'pooja', 'puja', 'upanayanam', 'thread ceremony', 'mundan', 'namkaran',
];

const EVENT_KEYWORD_RE = new RegExp(
  `\\b(${EVENT_KEYWORDS.map(k => k.replace(/ /g, '\\s+')).join('|')})\\b`,
  'i',
);

// Words that never belong in the user's event vocabulary.
const VOCAB_STOPWORDS = new Set([
  'i', "i'm", 'im', 'am', 'is', 'are', 'was', 'were', 'a', 'an', 'the',
  'my', 'our', 'me', 'we', 'us', 'you', 'your', 'it', "it's", 'its',
  'this', 'that', 'want', 'wants', 'plan', 'planning', 'planned', 'to',
  'for', 'of', 'in', 'at', 'on', 'with', 'have', 'has', 'had', 'need',
  'organize', 'organizing', 'organise', 'arrange', 'arranging', 'host',
  'hosting', 'celebrate', 'celebrating', 'about', 'doing', 'make', 'making',
  'there', 'here', 'some', 'event', 'events', 'function', 'ceremony',
  'please', 'can', 'could', 'would', 'like', 'help', 'and', 'also',
  // Conversation fillers — "yes wedding" must never churn the vocabulary.
  'yes', 'yeah', 'ok', 'okay', 'so', 'actually', 'well', 'just', 'now',
  'really', 'basically', 'maybe', 'probably', 'thinking', 'thought',
]);

// Self-identity cues — cultural facts are captured ONLY in these sentences.
const SELF_IDENTITY_RE =
  /\b(i|i'm|im|i am|we|we're|we are|my family|our family|our's|ours|our)\b/i;

const RELIGIONS = [
  'hindu', 'hindus', 'muslim', 'muslims', 'islam', 'christian', 'christians',
  'sikh', 'sikhs', 'jain', 'jains', 'buddhist', 'buddhists', 'jewish', 'jew',
  'parsi', 'parsee', 'bahai',
];

const REGIONS = [
  'telangana', 'andhra pradesh', 'andhra', 'karnataka', 'tamil nadu',
  'tamilnadu', 'kerala', 'maharashtra', 'gujarat', 'rajasthan', 'punjab',
  'west bengal', 'bengal', 'odisha', 'orissa', 'bihar', 'jharkhand',
  'chhattisgarh', 'uttarakhand', 'uttaranchal', 'himachal', 'assam', 'goa',
  'delhi', 'uttar pradesh', 'madhya pradesh',
];

const RELIGION_RE = new RegExp(`\\b(${RELIGIONS.join('|')})\\b`, 'i');
const REGION_RE = new RegExp(`\\b((?:${REGIONS.join('|')}))\\b`, 'i');

// ─── User event vocabulary extraction ────────────────────────────────────────
//
// Finds the event keyword and keeps up to two preceding words that are not
// stopwords — "a Kammari wedding" → "Kammari wedding"; "my sister's
// Kammari wedding" → "sister's Kammari wedding".
//
// NEVER extracts from self-identity sentences ("I'm a Hindu Kammari
// family…") — those carry identity facts, not event names. That sentence has
// no event keyword anyway, but the guard also blocks cases like "we are
// Kammari, planning a wedding" from labelling the WEDDING "Kammari
// Kammari"-style wrong vocabulary.
export function extractUserEventVocabulary(message: string): string | null {
  const match = EVENT_KEYWORD_RE.exec(message);
  if (!match) return null;

  const before = message.slice(0, match.index).trim();
  if (SELF_IDENTITY_RE.test(before) && !/\b(planning|plan|hosting|host|arranging|arrange|organizing|organising|celebrating)\b/i.test(before)) {
    // Pure self-identity sentence — not an event description.
    return null;
  }

  const words = before.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (let i = words.length - 1; i >= 0 && kept.length < 2; i--) {
    const w = words[i].replace(/^[^\w']+/, '').replace(/[^\w']+$/, '');
    if (!w) continue;
    if (VOCAB_STOPWORDS.has(w.toLowerCase())) break;
    kept.unshift(w);
  }
  const raw = [...kept, match[0].replace(/\s+/g, ' ')].join(' ').trim();
  return raw || match[0].toLowerCase();
}

// ─── Explicit cultural facts extraction (opt-in only) ────────────────────────
//
// Returns {} unless the message is a self-identification. Nothing here
// infers from event names, surnames, or cities. If the user explicitly says
// "I'm a Hindu Kammari family from Telangana", religion/community/region are
// captured; anything not stated stays unknown.
export interface ExplicitCulturalFacts {
  religion?: string;
  community?: string;
  culture?: string;
  region?: string;
}

export function extractExplicitCulturalFacts(message: string): ExplicitCulturalFacts {
  const facts: ExplicitCulturalFacts = {};

  if (!SELF_IDENTITY_RE.test(message)) return facts;

  const religionMatch = RELIGION_RE.exec(message);
  if (religionMatch) {
    facts.religion = religionMatch[0];
  }

  // "<Name> family/community/caste" in a self-identification sentence.
  // Religion AND region words are excluded so "Hindu family" doesn't set
  // community=Hindu and "Telangana family" is treated as a regional identity.
  const communityMatch = /\b([a-z]{3,20})\s+(family|community|caste|kulam|samajam)\b/i.exec(message);
  if (communityMatch) {
    const word = communityMatch[1].toLowerCase();
    if (!RELIGIONS.includes(word) && !REGIONS.includes(word)) {
      facts.community = communityMatch[1];
    } else if (REGIONS.includes(word)) {
      // "We are a Telangana family" — an explicit regional identity.
      facts.region = communityMatch[1];
    }
  }

  // Region is captured ONLY from explicit origin phrasing ("from Telangana",
  // "based in Telangana"). A plain "in Telangana" is an event LOCATION —
  // the orchestrator's city extraction handles that; it is never a cultural
  // fact. This is what keeps "Kammari wedding in Telangana" from inventing
  // a regional identity for the user.
  const regionMatch = new RegExp(`\\b(?:from|based\\s+in|settled\\s+in)\\s+(${REGIONS.join('|')})\\b`, 'i').exec(message);
  if (regionMatch) {
    facts.region = regionMatch[1];
  }

  return facts;
}

// ─── Apply one conversation turn to the Event State ─────────────────────────
//
// 1. Structured updates from the existing orchestrator merge (latest wins).
// 2. User event vocabulary captured (raw wording preserved).
// 3. Explicit cultural facts captured (only if user-stated).
//
// Returns the new state, the full change log, and what memory captured this
// turn (for tests/UI). Pure — persistence is the bridge's job.
export interface TurnResult {
  state: EventState;
  changes: FieldChange[];
  vocabulary: string | null;
  culturalFacts: ExplicitCulturalFacts;
}

export function applyTurnToEventState(
  prev: EventState,
  userMessage: string,
  updates: PlannerContext,
): TurnResult {
  // 1. Structured updates via the existing merge (records supersessions).
  const { state: afterUpdates, changes: updateChanges } = applyContextUpdate(prev, updates);

  // 2. User's own event wording — grow-only: a less specific re-statement
  // ("yes wedding" after "Kammari wedding") never shrinks the vocabulary;
  // only a genuinely different or more specific wording replaces it (with
  // the old one recorded as superseded).
  const vocabulary = extractUserEventVocabulary(userMessage);
  let state = afterUpdates;
  if (vocabulary) {
    const prevRaw = state.eventTypeRaw;
    const isSubset =
      prevRaw !== null &&
      prevRaw.toLowerCase() !== vocabulary.toLowerCase() &&
      prevRaw.toLowerCase().includes(vocabulary.toLowerCase());
    if (!isSubset) {
      state = setRawEventType(state, vocabulary);
      if (state !== afterUpdates) {
        updateChanges.push({ field: 'eventTypeRaw', previous: prevRaw, next: vocabulary, source: 'user_message' });
        if (prevRaw && prevRaw.toLowerCase() !== vocabulary.toLowerCase()) {
          const list = state.superseded['eventTypeRaw'] ?? [];
          list.push(prevRaw);
          state.superseded['eventTypeRaw'] = list;
        }
      }
    }
  }

  // 3. Explicit cultural facts (never inferred).
  const culturalFacts = extractExplicitCulturalFacts(userMessage);
  if (Object.keys(culturalFacts).length > 0) {
    const res = setExplicitCulturalFacts(state, culturalFacts);
    state = res.state;
    updateChanges.push(...res.changes);
  }

  return { state, changes: updateChanges, vocabulary, culturalFacts };
}

// ─── Compact memory context for the LLM ──────────────────────────────────────
//
// Clearly separates CONFIRMED / USER WORDING / STALE (corrected) / UNKNOWN.
// Deliberately compact — a handful of lines, never a JSON dump.
export function buildMemoryContext(state: EventState | null | undefined): string {
  if (!state) return '';

  const confirmed: string[] = [];

  if (state.eventType) {
    const wording = state.eventTypeRaw && state.eventTypeRaw.toLowerCase() !== state.eventType
      ? ` (user said: "${state.eventTypeRaw}")`
      : '';
    confirmed.push(`- Event: ${state.eventType}${wording}`);
  }
  const loc: string[] = [];
  if (state.location.city) loc.push(state.location.city);
  if (state.location.area) loc.push(state.location.area);
  if (loc.length) confirmed.push(`- Location: ${loc.join(', ')}`);
  if (state.schedule.eventDate) confirmed.push(`- Date: ${state.schedule.eventDate}`);
  if (state.guests.count) confirmed.push(`- Guests: ${state.guests.count}`);
  if (state.budget.total) {
    confirmed.push(`- Budget: ₹${state.budget.total.toLocaleString('en-IN')}`);
  }
  if (state.style.foodPreference) confirmed.push(`- Food: ${state.style.foodPreference}`);
  if (state.style.theme) confirmed.push(`- Theme: ${state.style.theme}`);
  const identity: string[] = [];
  if (state.religion) identity.push(`Religion: ${state.religion}`);
  if (state.community) identity.push(`Community: ${state.community}`);
  if (state.region) identity.push(`Region: ${state.region}`);
  if (identity.length) confirmed.push(`- Stated by user: ${identity.join(' · ')}`);

  // Stale values (explicitly corrected) — the AI must not treat them as current.
  const stale: string[] = [];
  for (const [field, olds] of Object.entries(state.superseded ?? {})) {
    const latest = olds[olds.length - 1];
    stale.push(`${field} (previously ${String(latest)})`);
  }

  // Unknowns the planner may still need — phrased as "never assume".
  const unknown: string[] = [];
  if (!state.eventType) unknown.push('event type');
  if (!state.location.city) unknown.push('city');
  if (!state.guests.count) unknown.push('guest count');
  if (!state.budget.total) unknown.push('budget');
  if (!state.religion && !state.community) unknown.push('religion/community (never assume from event names — only what the user states)');
  if (!state.schedule.eventDate) unknown.push('date');

  const lines: string[] = ['### Conversation memory (auto-maintained)'];
  lines.push('Use this to remember earlier details; never contradict it.');
  if (confirmed.length) {
    lines.push('Confirmed by user:');
    lines.push(...confirmed);
  } else {
    lines.push('Confirmed by user: (nothing yet)');
  }
  if (stale.length) {
    lines.push(`Corrected earlier — NOT current: ${stale.join('; ')}`);
  }
  if (unknown.length) {
    lines.push(`Still unknown (ask naturally when needed; NEVER assume): ${unknown.join(', ')}.`);
  }
  return lines.join('\n');
}

// ─── Latest supersessions summary (for UI/tests) ─────────────────────────────
export function describeSupersessions(state: EventState): string[] {
  return Object.entries(state.superseded ?? {}).map(
    ([field, olds]) => `${field}: ${olds.map(o => String(o)).join(' → ')} (current: ${String(currentValue(state, field))})`,
  );
}

function currentValue(state: EventState, field: string): unknown {
  switch (field) {
    case 'eventType': return state.eventType;
    case 'religion': return state.religion;
    case 'community': return state.community;
    case 'culture': return state.culture;
    case 'region': return state.region;
    case 'location.city': return state.location.city;
    case 'location.area': return state.location.area;
    case 'guests.count': return state.guests.count;
    case 'budget.total': return state.budget.total;
    case 'schedule.eventDate': return state.schedule.eventDate;
    default: return '?';
  }
}
