import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 min
const WARNING_TIMEOUT    = 25 * 60 * 1000; // warn at 25 min

// Shared setter — populated by InactivityWarning banner component
let _setWarning: ((v: boolean) => void) | null = null;
export const _registerInactivityWarning = (fn: (v: boolean) => void) => { _setWarning = fn; };
export const _unregisterInactivityWarning = () => { _setWarning = null; };

// Called by the warning banner's "Stay Logged In" button
let _resetTimerFn: (() => void) | null = null;
export const _registerResetTimer = (fn: () => void) => { _resetTimerFn = fn; };
export const stayLoggedIn = () => { _setWarning?.(false); _resetTimerFn?.(); };

export const useInactivityLogout = () => {
  const { signOut, user } = useAuth();
  const logoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (logoutRef.current)  clearTimeout(logoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  const reset = useCallback(() => {
    clear();
    if (!user) return;

    warningRef.current = setTimeout(() => {
      _setWarning?.(true);
    }, WARNING_TIMEOUT);

    logoutRef.current = setTimeout(async () => {
      _setWarning?.(false);
      localStorage.setItem('inactivityLogout', 'true');
      await signOut();
    }, INACTIVITY_TIMEOUT);
  }, [user, signOut, clear]);

  // Register reset so the banner can call it
  useEffect(() => {
    _registerResetTimer(reset);
    return () => _registerResetTimer(() => {});
  }, [reset]);

  useEffect(() => {
    if (!user) { clear(); return; }
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const handler = () => reset();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    reset();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      clear();
    };
  }, [user, reset, clear]);
};
