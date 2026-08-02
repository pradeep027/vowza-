// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Protects pages behind authentication and optional role checks.
//
// How roles work:
//   1. On signup → handle_new_user() trigger inserts user_id + 'customer' into user_roles
//   2. On provider registration → provider role added via make_provider()
//   3. Admin promotion → run in Supabase SQL Editor:
//        SELECT public.make_admin('your-user-uuid');
//      OR: INSERT INTO public.user_roles (user_id, role) VALUES ('<uuid>', 'admin');

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children:              React.ReactNode;
  allowedRoles?:         string[];
  requireEmailVerified?: boolean;
}

// Cache roles in memory for the session so every route doesn't re-query
// Export so approval service can invalidate it
export const roleCache = new Map<string, string[]>();
export function invalidateRoleCache(userId?: string) {
  if (userId) roleCache.delete(userId);
  else roleCache.clear();
}

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requireEmailVerified = false,
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const [userRoles, setUserRoles]       = useState<string[]>([]);
  const [checkingRoles, setCheckingRoles] = useState(false);
  const [rolesLoaded, setRolesLoaded]   = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      setUserRoles([]);
      setRolesLoaded(true);
      return;
    }

    // Use cache to avoid repeated DB round-trips
    if (roleCache.has(user.id)) {
      setUserRoles(roleCache.get(user.id)!);
      setRolesLoaded(true);
      return;
    }

    const fetchRoles = async () => {
      setCheckingRoles(true);
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          // Table may not exist yet in some environments — fail open with 'customer'
          console.error('[ProtectedRoute] user_roles query error:', error.message);
          const fallback = ['customer'];
          setUserRoles(fallback);
          roleCache.set(user.id, fallback);
          return;
        }

        if (!data || data.length === 0) {
          // No rows yet — user exists but role not seeded.
          // Insert the default customer role and proceed.
          await supabase
            .from('user_roles')
            .insert({ user_id: user.id, role: 'customer' })
            .select()
            .maybeSingle();

          const fallback = ['customer'];
          setUserRoles(fallback);
          roleCache.set(user.id, fallback);
          return;
        }

        const roles = data.map(r => r.role as string);
        setUserRoles(roles);
        roleCache.set(user.id, roles);
      } catch (err) {
        // Network/unexpected error — fail open with customer
        const fallback = ['customer'];
        setUserRoles(fallback);
        roleCache.set(user.id, fallback);
      } finally {
        setCheckingRoles(false);
        setRolesLoaded(true);
      }
    };

    fetchRoles();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear cache when user changes (logout/login)
  useEffect(() => {
    if (!user) {
      roleCache.clear();
      setRolesLoaded(false);
    }
  }, [user]);

  // ── Loading states ────────────────────────────────────────────────────────
  if (loading || checkingRoles || !rolesLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!user) {
    toast.error('Please login to access this page');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // ── Email verification check ──────────────────────────────────────────────
  if (requireEmailVerified && !user.email_confirmed_at) {
    toast.error('Please verify your email to access this page');
    return <Navigate to="/auth" replace />;
  }

  // ── Role check ────────────────────────────────────────────────────────────
  if (allowedRoles.length > 0) {
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    if (!hasRole) {
      toast.error('Access denied. You do not have permission to access this page.');
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
