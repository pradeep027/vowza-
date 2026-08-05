// ─── useBackNavigation — Intelligent contextual "Back" navigation ─────────────
// Never hardcodes to "/". Resolution order:
//   1. Explicit `location.state.from` (set by the page that linked here — used
//      by Artist Registration Step 5 so Terms/Privacy always know exactly
//      where to return, even across full navigations).
//   2. Real browser/router history — if this SPA session has a previous
//      entry (react-router's internal history index > 0), use navigate(-1).
//      This makes the in-page Back button and the actual browser Back button
//      behave identically, and correctly returns to Home, Footer's origin
//      page, any Dashboard, or "any other page" without per-case logic.
//   3. Fallback route (defaults to "/") — only reached when the page was
//      opened directly (e.g. a shared URL, or a new tab with no history).
import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface BackNavigationState {
  /** Path to return to, set by the linking page for guaranteed contextual return. */
  from?: string;
  /** Optional human label for the origin, e.g. "Artist Registration". */
  fromLabel?: string;
}

// ── Friendly label lookup for common routes — used when the linking page ──────
// didn't supply an explicit `fromLabel` (e.g. Footer links, which only know
// the raw pathname of wherever they were clicked from).
const ROUTE_LABELS: Array<[RegExp, string]> = [
  [/^\/$/,                       'Home'],
  [/^\/dashboard\/?$/,           'Customer Dashboard'],
  [/^\/dashboard\//,             'Customer Dashboard'],
  [/^\/vendor\/dashboard\/?$/,   'Vendor Dashboard'],
  [/^\/vendor\//,                'Vendor Dashboard'],
  [/^\/provider\/dashboard\/?$/, 'Artist Dashboard'],
  [/^\/provider\/register\/?$/,  'Artist Registration'],
  [/^\/artist\/onboarding\/?$/,  'Artist Registration'],
  [/^\/admin\//,                 'Admin Dashboard'],
  [/^\/browse\/?$/,               'Browse'],
  [/^\/artists\/?$/,              'Artists'],
];

export function resolveRouteLabel(path: string): string {
  for (const [pattern, label] of ROUTE_LABELS) {
    if (pattern.test(path)) return label;
  }
  return 'Previous Page';
}

function hasInAppHistory(): boolean {
  if (typeof window === 'undefined') return false;
  const idx = (window.history.state as any)?.idx;
  return typeof idx === 'number' && idx > 0;
}

export function useBackNavigation(fallback: string = '/') {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as BackNavigationState;

  const goBack = useCallback(() => {
    if (state.from) {
      navigate(state.from, { replace: true });
      return;
    }
    if (hasInAppHistory()) {
      navigate(-1);
      return;
    }
    navigate(fallback, { replace: true });
  }, [navigate, state.from, fallback]);

  return { goBack, fromLabel: state.fromLabel, canGoBack: !!state.from || hasInAppHistory() };
}
