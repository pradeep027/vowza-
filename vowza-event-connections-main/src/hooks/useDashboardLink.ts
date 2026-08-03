// ─── useDashboardLink — Derives dashboard URL from AuthContext roles ───────────
// Reads roles from AuthContext — NO separate DB call.
// Roles are already fetched at login and cached for the session.

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useDashboardLink(): {
  dashboardLink: string;
  roles:         string[];
  loading:       boolean;
} {
  const { roles, loading, rolesLoaded } = useAuth();

  const dashboardLink = useMemo(() => resolveDashboard(roles), [roles]);

  return {
    dashboardLink,
    roles,
    loading: loading || !rolesLoaded,
  };
}

/** Pure function — role array → dashboard URL. No hardcoded emails or UUIDs. */
export function resolveDashboard(roles: string[]): string {
  if (roles.includes('admin'))    return '/admin/dashboard';
  if (roles.includes('provider')) return '/provider/dashboard';
  return '/browse';
}
