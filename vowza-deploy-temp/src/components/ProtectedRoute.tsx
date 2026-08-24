/**
 * ProtectedRoute — Role-based route guard with soft auth modal
 * 
 * Features:
 * - Shows AuthModal instead of blank redirect for unauthenticated users
 * - Preserves intended action and returns after authentication
 * - Role-based access control
 * - Email verification optional
 * - Premium loading screens
 */

import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import VowzaIcon from '@/components/VowzaIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import AuthModal from './AuthModal';
import useAuthRedirect from '@/hooks/useAuthRedirect';

// Re-export for backward compatibility with approvalService
export { invalidateRoleCache, _roleCache as roleCache } from '@/contexts/AuthContext';

interface Props {
  children:              React.ReactNode;
  allowedRoles?:         string[];
  requireEmailVerified?: boolean;
  showAuthModal?:        boolean; // If true, show modal instead of redirect
}

// ── Premium loading screen — shown while auth/roles are being resolved ─────────
function AdminLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f14]">
      <div className="flex flex-col items-center gap-4">
        <VowzaIcon className="w-12 h-12 animate-pulse" />
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/30 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-sm text-white/40 font-medium">Verifying permissions…</p>
      </div>
    </div>
  );
}

function GeneralLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <VowzaIcon className="w-10 h-10 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requireEmailVerified = false,
  showAuthModal = true,
}: Props) => {
  const { user, loading, roles, rolesLoaded } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setReturnTo, clearReturnTo } = useAuthRedirect();

  const isAdminRoute = location.pathname.startsWith('/admin');

  // Persist the intended destination outside render so React can safely re-render
  // the guard while auth state is being restored.
  useEffect(() => {
    if (!loading && rolesLoaded && !user && showAuthModal) {
      setReturnTo(location.pathname, {
        state: location.state,
        query: Object.fromEntries(new URLSearchParams(location.search)),
      });
    }
  }, [loading, location.pathname, location.search, location.state, rolesLoaded, setReturnTo, showAuthModal, user]);

  // ── Still resolving auth or roles ────────────────────────────────────────────
  if (loading || !rolesLoaded) {
    return isAdminRoute ? <AdminLoadingScreen /> : <GeneralLoadingScreen />;
  }

  // ── Not authenticated ─────────────────────────────────────────────────────────
  if (!user) {
    if (showAuthModal) {
      return (
        <>
          <AuthModal
            isOpen
            onClose={() => {
              clearReturnTo();
              navigate('/', { replace: true });
            }}
          />
          <div className="min-h-screen flex items-center justify-center bg-background/50" aria-hidden="true">
            <div className="text-center">
              <VowzaIcon className="w-12 h-12 animate-pulse mx-auto mb-4" />
              <p className="text-muted-foreground">Sign in to continue</p>
            </div>
          </div>
        </>
      );
    }

    // Fallback to the standalone auth route for routes that intentionally opt out.
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // ── Email verification (optional) ────────────────────────────────────────────
  if (requireEmailVerified && !user.email_confirmed_at) {
    return <Navigate to="/auth" replace />;
  }

  // ── Role check ────────────────────────────────────────────────────────────────
  if (allowedRoles.length > 0) {
    const hasRole = allowedRoles.some(r => roles.includes(r));
    if (!hasRole) {
      // Redirect to appropriate page based on their actual roles
      if (roles.includes('admin'))    return <Navigate to="/admin/dashboard" replace />;
      if (roles.includes('provider')) return <Navigate to="/vendor/dashboard" replace />;
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
