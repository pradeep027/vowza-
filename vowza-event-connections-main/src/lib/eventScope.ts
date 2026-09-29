import type { EventState } from './eventState';

export interface EventScopeCandidate {
  eventId: string;
  conversationId: string | null;
  label: string;
  aliases: string[];
  state: EventState;
}

export type EventScopeResolution =
  | { kind: 'none'; reason: 'no_reference' | 'no_candidates' }
  | { kind: 'resolved'; candidate: EventScopeCandidate }
  | { kind: 'ambiguous'; candidates: EventScopeCandidate[]; question: string };

const REFERENCE_RE = /\b(?:my|our|the|this|that|another|other|sister's|brother's|friend's|parents'?)\s+(?:\w+\s+){0,2}(?:wedding|reception|engagement|birthday|anniversary|event|function|party)\b|\b(?:wedding|reception|engagement|birthday|anniversary|housewarming|corporate event|conference|event|function|party)\b/i;
const GENERIC_RE = /\b(?:another|other|that|this|my|our)\s+event\b|\b(?:my|our)\s+event\b/i;

export function extractEventLabel(message: string): string | undefined {
  const match = message.match(/\b((?:my|our|the|this|that|sister's|brother's|friend's|parents'?)\s+(?:[a-z]+\s+){0,2}(?:wedding|reception|engagement|birthday|anniversary|event|function|party))\b/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim();
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value: string): string[] {
  return normalize(value).split(/\s+/).filter((token) => token.length > 2);
}

export function candidateFromEventState(state: EventState): EventScopeCandidate | null {
  if (!state.eventId) return null;
  const label = state.eventLabel ?? state.eventTypeRaw ?? state.eventType ?? 'event';
  const aliases = [label, state.eventType ?? '', state.location.city ?? '', state.eventTypeRaw ?? '']
    .filter(Boolean)
    .map(normalize);
  return {
    eventId: state.eventId,
    conversationId: state.conversationId,
    label,
    aliases: [...new Set(aliases)],
    state,
  };
}

export function resolveEventScope(
  message: string,
  current: EventScopeCandidate | null,
  candidates: EventScopeCandidate[],
): EventScopeResolution {
  const text = normalize(message);
  if (!REFERENCE_RE.test(message)) return current
    ? { kind: 'resolved', candidate: current }
    : { kind: 'none', reason: 'no_reference' };
  if (!candidates.length) return { kind: 'none', reason: 'no_candidates' };

  if (GENERIC_RE.test(message)) {
    return candidates.length === 1
      ? { kind: 'resolved', candidate: candidates[0] }
      : { kind: 'ambiguous', candidates, question: 'Which event would you like to update or ask about?' };
  }

  const scored = candidates.map((candidate) => {
    let score = 0;
    for (const alias of candidate.aliases) {
      if (alias && (text === alias || text.includes(alias))) score += alias.split(' ').length + 2;
    }
    const messageTokens = new Set(tokens(text));
    score += candidate.aliases.reduce((sum, alias) => sum + tokens(alias).filter((token) => messageTokens.has(token)).length, 0);
    return { candidate, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);

  if (!scored.length) return { kind: 'ambiguous', candidates, question: 'Which event are you referring to?' };
  const top = scored[0];
  const tied = scored.filter((item) => item.score === top.score).map((item) => item.candidate);
  if (tied.length > 1) {
    return { kind: 'ambiguous', candidates: tied, question: `Which event do you mean: ${tied.map((item) => item.label).join(' or ')}?` };
  }
  return { kind: 'resolved', candidate: top.candidate };
}
