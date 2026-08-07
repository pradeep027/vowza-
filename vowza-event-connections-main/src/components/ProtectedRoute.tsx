// ─── ProtectedRoute — Role-based route guard ──────────────────────────────────
// Uses roles from AuthContext (fetched once at login, cached for session).
// Never duplicates role-fetching logic.
// Never hardcodes emails or UUIDs.
// Supports: no role check (just auth), single role, multiple roles.

import { Navigate, useLocation } from 'react-router-dom';
import VowzaIcon from '@/components/VowzaIcon';
import { useAuth } from '@/contexts/AuthContext';

// Re-export for backward compatibility with approvalService
export { invalidateRoleCache, _roleCache as roleCache } from '@/contexts/AuthContext';

interface Props {
  children:              React.ReactNode;
  allowedRoles?:         string[];
  requireEmailVerified?: boolean;
}

// ── Premium loading screen — shown while auth/roles are being resolved ─────────
function AdminLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f14]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-maroon flex items-center justify-center shadow-maroon animate-pulse">
          <VowzaIcon className="w-7 h-7 text-white" />
        </div>
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
        <div className="w-10 h-10 rounded-2xl bg-gradient-gold animate-pulse flex items-center justify-center">
          <VowzaIcon className="w-5 h-5 text-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requireEmailVerified = false,
}: Props) => {
  const { user, loading, roles, rolesLoaded } = useAuth();
  const location = useLocation();

  const isAdminRoute = location.pathname.startsWith('/admin');

  // ── Still resolving auth or roles ────────────────────────────────────────────
  if (loading || !rolesLoaded) {
    return isAdminRoute ? <AdminLoadingScreen /> : <GeneralLoadingScreen />;
  }

  // ── Not authenticated ─────────────────────────────────────────────────────────
  if (!user) {
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
      if (roles.includes('provider')) return <Navigate to="/provider/dashboard" replace />;
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
