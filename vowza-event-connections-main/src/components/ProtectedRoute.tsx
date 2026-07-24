import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireEmailVerified?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  allowedRoles = [], 
  requireEmailVerified = false 
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [checkingRoles, setCheckingRoles] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkUserRoles = async () => {
      if (!user) return;

      setCheckingRoles(true);
      try {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        setUserRoles(roles?.map(r => r.role) || []);
      } catch (error) {
        console.error('Error checking user roles:', error);
      } finally {
        setCheckingRoles(false);
      }
    };

    checkUserRoles();
  }, [user]);

  // Show loading while checking auth
  if (loading || checkingRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    toast.error('Please login to access this page');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check email verification if required
  if (requireEmailVerified && !user.email_confirmed_at) {
    toast.error('Please verify your email to access this page');
    return <Navigate to="/auth" replace />;
  }

  // Check if user has required role
  if (allowedRoles.length > 0) {
    const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      toast.error('Access denied. You do not have permission to access this page.');
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
