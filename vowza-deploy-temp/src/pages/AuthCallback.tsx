import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import useAuthRedirect from '@/hooks/useAuthRedirect';

/**
 * Completes provider sign-in after Supabase returns the user to the SPA.
 * AuthProvider exchanges/rehydrates the session; useAuthRedirect returns the
 * user to the protected action they originally requested.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { hasReturnTo } = useAuthRedirect();

  useEffect(() => {
    if (loading) return;

    if (user && !hasReturnTo) {
      navigate('/', { replace: true });
      return;
    }

    if (!user) {
      navigate('/auth', { replace: true });
    }
  }, [hasReturnTo, loading, navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-maroon" />
        <h1 className="text-lg font-semibold text-foreground">Completing sign in</h1>
        <p className="text-sm text-muted-foreground">Please wait while we securely return you to Vowza.</p>
      </div>
    </div>
  );
}
