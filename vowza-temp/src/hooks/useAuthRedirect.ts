/**
 * useAuthRedirect — Manage return-to-action after authentication
 * 
 * Usage:
 * 1. User clicks "Book Artist" (protected action)
 * 2. Check if authenticated
 * 3. If not, save intended action via setReturnTo()
 * 4. Show auth modal
 * 5. User authenticates
 * 6. useAuthRedirect automatically returns to saved action
 * 
 * Example:
 * 
 * const { returnTo, setReturnTo, clearReturnTo } = useAuthRedirect();
 * 
 * const handleBookArtist = () => {
 *   if (!user) {
 *     setReturnTo('/booking/artist/123', { date: '2025-01-15' });
 *     setAuthModalOpen(true);
 *     return;
 *   }
 *   // Proceed with booking
 * }
 */

import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ReturnToAction {
  path: string;
  query?: Record<string, any>;
  state?: Record<string, any>;
}

const RETURN_TO_KEY = 'vowza_return_to_action';

export const useAuthRedirect = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Save the intended action to return to after auth
  const setReturnTo = useCallback(
    (path: string, options?: { query?: Record<string, any>; state?: Record<string, any> }) => {
      const action: ReturnToAction = {
        path,
        query: options?.query,
        state: options?.state,
      };
      sessionStorage.setItem(RETURN_TO_KEY, JSON.stringify(action));
    },
    []
  );

  // Get the saved return action
  const getReturnTo = useCallback((): ReturnToAction | null => {
    const stored = sessionStorage.getItem(RETURN_TO_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }, []);

  // Clear the saved return action
  const clearReturnTo = useCallback(() => {
    sessionStorage.removeItem(RETURN_TO_KEY);
  }, []);

  // Auto-redirect to saved action when user authenticates
  useEffect(() => {
    if (!user) return;

    const returnAction = getReturnTo();
    if (!returnAction) return;

    // Clear before navigating (prevent infinite loops)
    clearReturnTo();

    // Build URL with query params if provided
    let url = returnAction.path;
    if (returnAction.query) {
      const params = new URLSearchParams();
      Object.entries(returnAction.query).forEach(([key, value]) => {
        params.set(key, String(value));
      });
      url += `?${params.toString()}`;
    }

    // Navigate with state if provided
    navigate(url, { state: returnAction.state, replace: true });
  }, [user, getReturnTo, clearReturnTo, navigate]);

  const returnTo = getReturnTo();

  return {
    returnTo,
    setReturnTo,
    clearReturnTo,
    hasReturnTo: !!returnTo,
  };
};

export default useAuthRedirect;
