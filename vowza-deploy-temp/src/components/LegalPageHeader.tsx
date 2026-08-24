// ─── LegalPageHeader — Sticky contextual header for legal / standalone pages ──
// Used by Terms of Service and Privacy Policy (and any future legal page).
//
// • Sticky at the top while scrolling, premium glassmorphism white header,
//   consistent with the Vowza design system (matches ArtistOnboarding /
//   ProviderRegistration top bars).
// • Back button is ALWAYS visible and uses contextual navigation — it returns
//   to wherever the user actually came from (Artist Registration step, Home,
//   Footer's origin page, any Dashboard, or the exact previous route) and
//   NEVER hardcodes a redirect to Home unless Home is genuinely the previous
//   page. See useBackNavigation for the resolution logic.
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useBackNavigation, resolveRouteLabel, type BackNavigationState } from '@/hooks/useBackNavigation';

interface LegalPageHeaderProps {
  title: string;
  lastUpdated: Date;
}

export default function LegalPageHeader({ title, lastUpdated }: LegalPageHeaderProps) {
  const { goBack, fromLabel: explicitLabel } = useBackNavigation('/');
  const location = useLocation();
  const state = (location.state ?? {}) as BackNavigationState;
  const fromLabel = explicitLabel ?? (state.from ? resolveRouteLabel(state.from) : undefined);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-border/60 shadow-xs">
      <div className="container px-4 h-16 md:h-[4.5rem] flex items-center gap-4">
        <button
          type="button"
          onClick={goBack}
          aria-label={fromLabel ? `Back to ${fromLabel}` : 'Go back'}
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary hover:border-maroon/30 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{fromLabel ? `Back to ${fromLabel}` : 'Back'}</span>
          <span className="sm:hidden">Back</span>
        </button>

        <div className="min-w-0">
          <h1 className="text-base md:text-lg font-display font-bold text-foreground truncate">{title}</h1>
          <p className="text-[11px] md:text-xs text-muted-foreground">
            Last updated: {lastUpdated.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </header>
  );
}
