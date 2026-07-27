// ─── useDashboardLink ─────────────────────────────────────────────────────────
// Single source of truth for role-based dashboard routing.
// Returns the correct dashboard URL based on the current user's roles:
//   admin    → /admin/dashboard
//   provider → /provider/dashboard
//   customer → /browse
//   none     → /browse
//
// Uses the same in-memory cache as ProtectedRoute to avoid redundant DB calls.

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Shared in-memory cache (same session, same roles)
const roleCache = new Map<string, string[]>();

export function useDashboardLink(): { dashboardLink: string; roles: string[]; loading: boolean } {
  const { user } = useAuth();
  const [dashboardLink, setDashboardLink] = useState('/browse');
  const [roles, setRoles]                 = useState<string[]>([]);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    if (!user) {
      setDashboardLink('/browse');
      setRoles([]);
      return;
    }

    // Use cache if available
    if (roleCache.has(user.id)) {
      const cached = roleCache.get(user.id)!;
      setRoles(cached);
      setDashboardLink(resolveDashboard(cached));
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error || !data || data.length === 0) {
          const fallback = ['customer'];
          setRoles(fallback);
          setDashboardLink('/browse');
          roleCache.set(user.id, fallback);
          return;
        }

        const r = data.map(d => d.role as string);
        roleCache.set(user.id, r);
        setRoles(r);
        setDashboardLink(resolveDashboard(r));
      } catch {
        setDashboardLink('/browse');
        setRoles(['customer']);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear cache on logout
  useEffect(() => {
    if (!user) {
      roleCache.clear();
      setDashboardLink('/browse');
      setRoles([]);
    }
  }, [user]);

  return { dashboardLink, roles, loading };
}

/** Pure function — convert a roles array to the correct dashboard URL */
export function resolveDashboard(roles: string[]): string {
  if (roles.includes('admin'))    return '/admin/dashboard';
  if (roles.includes('provider')) return '/provider/dashboard';
  return '/browse';
}
