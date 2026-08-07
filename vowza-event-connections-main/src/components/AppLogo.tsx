// ─── AppLogo — Universal role-aware Home navigation ───────────────────────────
// Single reusable branding component used across every dashboard and auth page.
//
// Behaviour (matches Airbnb / Stripe / Notion / GitHub / Linear):
//   • Entire branding block is one clickable target (icon + text + padding)
//   • Destination is resolved from the authenticated user's role
//   • Already on Home → no navigation, no reload
//   • Keyboard accessible: it is a real <button>, so Enter and Space work
//   • aria-label="Go to Home", aria-current="page" when already home
//   • Uses useNavigate() — never window.location

import { memo, useCallback } from 'react';
import VowzaIcon from '@/components/VowzaIcon';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ── Role → Home route ─────────────────────────────────────────────────────────
// Pure function so it can be reused and unit-tested independently of React.
// Accepts both naming conventions ('provider'/'vendor', 'super_admin'/'superadmin').
export function resolveHome(roles: string[] = []): string {
  if (roles.includes('super_admin') || roles.includes('superadmin')) return '/super-admin/dashboard';
  if (roles.includes('admin'))                                        return '/admin/dashboard';
  if (roles.includes('provider') || roles.includes('vendor'))         return '/vendor/dashboard';
  if (roles.length > 0) return '/dashboard'; // authenticated customer
  return '/'; // unauthenticated
}

type Theme = 'light' | 'dark';
type Size  = 'sm' | 'md' | 'lg';

export interface AppLogoProps {
  /** Text beside the mark. Pass "" or use `collapsed` to hide it. */
  label?: string;
  /** Icon-only mode for collapsed sidebars. */
  collapsed?: boolean;
  /** `dark` renders white text for dark sidebars. */
  theme?: Theme;
  /** Controls mark + text scale. */
  size?: Size;
  /** Extra classes on the button wrapper. */
  className?: string;
  /** Override the destination (rarely needed — role routing is the default). */
  to?: string;
  /** Render as static branding with no click behaviour. */
  static?: boolean;
}

const MARK_SIZE: Record<Size, string> = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-8 h-8 md:w-9 md:h-9',
};

const ICON_SIZE: Record<Size, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-4 h-4 md:w-[18px] md:h-[18px]',
};

const TEXT_SIZE: Record<Size, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
};

const AppLogo = memo(function AppLogo({
  label = 'Vowza',
  collapsed = false,
  theme = 'light',
  size = 'md',
  className,
  to,
  static: isStatic = false,
}: AppLogoProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { roles } = useAuth();

  const target = to ?? resolveHome(roles);
  const isHome = location.pathname === target;

  const handleClick = useCallback(() => {
    if (isStatic) return;
    // Recompute fresh at click-time (never trust closed-over state) and always
    // navigate — react-router no-ops a navigate() to the current path anyway,
    // so this is safe and guarantees the click is never silently swallowed.
    const dest = to ?? resolveHome(roles);
    console.log('[AppLogo] click — roles:', roles, 'destination:', dest);
    navigate(dest);
  }, [isStatic, to, roles, navigate]);

  const showText = !collapsed && !!label;

  const content = (
    <>
      {/* Mark */}
      <span
        className={cn(
          'rounded-xl bg-gradient-to-br from-[#8B1538] to-[#D4AF37]',
          'flex items-center justify-center flex-shrink-0',
          'shadow-sm transition-shadow duration-[250ms]',
          !isStatic && 'group-hover:shadow-md',
          MARK_SIZE[size],
        )}
      >
        <VowzaIcon className={cn('text-white', ICON_SIZE[size])} aria-hidden="true" />
      </span>

      {/* Wordmark */}
      {showText && (
        <span
          className={cn(
            'font-display font-bold tracking-tight whitespace-nowrap',
            TEXT_SIZE[size],
            theme === 'dark' ? 'text-white' : 'text-foreground',
          )}
        >
          {label}
        </span>
      )}
    </>
  );

  // Static mode — plain branding, not interactive
  if (isStatic) {
    return (
      <span className={cn('inline-flex items-center gap-2.5', className)}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Go to Home"
      aria-current={isHome ? 'page' : undefined}
      title={isHome ? label : `Go to Home`}
      className={cn(
        // Layout — generous padding so surrounding space is clickable too
        'group inline-flex items-center gap-2.5 rounded-xl',
        collapsed ? 'p-1.5' : 'px-2 py-1.5 -mx-2',
        // Interaction
        'cursor-pointer select-none',
        'transition-all duration-[250ms] ease-out',
        'hover:scale-[1.03] active:scale-[0.98]',
        theme === 'dark' ? 'hover:bg-white/8' : 'hover:bg-black/[0.04]',
        // Focus ring — visible for keyboard users only
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538]/40 focus-visible:ring-offset-2',
        theme === 'dark' && 'focus-visible:ring-offset-transparent',
        className,
      )}
    >
      {content}
    </button>
  );
});

export default AppLogo;
