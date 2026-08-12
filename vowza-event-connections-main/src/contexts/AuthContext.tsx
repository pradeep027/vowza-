// ─── AuthContext — Single source of truth for auth, roles, and profile ────────
// • Roles are fetched from public.user_roles (NEVER hardcoded)
// • Exposes: user, session, profile, roles, isAdmin, isProvider, isCustomer
// • Real-time subscription: role changes take effect without logout
// • Session is persisted by Supabase — restored on page refresh
// • All consuming components use useAuth() — no duplication

import React, {
  createContext, useContext, useEffect, useState,
  useCallback, useRef, useMemo,
} from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface UserProfile {
  id:         string;
  full_name:  string | null;
  email:      string | null;
  phone:      string | null;
  avatar_url: string | null;
  city:       string | null;
  state:      string | null;
  area:       string | null;
}

export interface AuthContextType {
  // Auth state
  user:         User | null;
  session:      Session | null;
  profile:      UserProfile | null;
  loading:      boolean;
  authenticated: boolean;

  // Role state — derived from public.user_roles, never hardcoded
  roles:        string[];
  isAdmin:      boolean;
  isSuperAdmin: boolean;
  isProvider:   boolean;
  isCustomer:   boolean;
  rolesLoaded:  boolean;

  // Actions
  signUp:   (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: AuthError | null }>;
  signIn:   (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | Error | null }>;
  signOut:  () => Promise<void>;
  refreshRoles: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Global role cache — shared across all hooks, cleared on logout ────────────
export const _roleCache = new Map<string, string[]>();

export function invalidateRoleCache(userId?: string) {
  if (userId) _roleCache.delete(userId);
  else _roleCache.clear();
}

// ── AuthProvider ───────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,        setUser]        = useState<User | null>(null);
  const [session,     setSession]     = useState<Session | null>(null);
  const [profile,     setProfile]     = useState<UserProfile | null>(null);
  const [roles,       setRoles]       = useState<string[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const initialised = useRef(false);
  const rolesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch profile from public.profiles ──────────────────────────────────────
  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url, city, state, area')
        .eq('id', uid)
        .maybeSingle();
      if (data) setProfile(data as UserProfile);
    } catch { /* non-critical */ }
  }, []);

  // ── Fetch roles from public.user_roles ───────────────────────────────────────
  const fetchRoles = useCallback(async (uid: string): Promise<string[]> => {
    // Return from cache if available
    if (_roleCache.has(uid)) {
      const cached = _roleCache.get(uid)!;
      setRoles(cached);
      setRolesLoaded(true);
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', uid);

      if (error) {
        console.error('[AuthContext] fetchRoles error:', error.message, error.code);
        // Do NOT retry — avoids making the recursion loop worse
        // The fix is in the database: run FIX_INFINITE_RECURSION.sql
        const fallback = ['customer'];
        _roleCache.set(uid, fallback);
        setRoles(fallback);
        setRolesLoaded(true);
        return fallback;
      }

      console.log('[AuthContext] roles fetched for', uid, ':', data);

      if (!data || data.length === 0) {
        console.warn('[AuthContext] No roles found for user', uid, '— seeding customer role');
        // Seed default customer role silently
        await supabase.from('user_roles').insert({ user_id: uid, role: 'customer' });
        const fallback = ['customer'];
        _roleCache.set(uid, fallback);
        setRoles(fallback);
        setRolesLoaded(true);
        return fallback;
      }

      const r = data.map(d => d.role as string);
      console.log('[AuthContext] resolved roles:', r, '— isAdmin:', r.includes('admin'));
      _roleCache.set(uid, r);
      setRoles(r);
      setRolesLoaded(true);
      return r;
    } catch (e) {
      console.error('[AuthContext] fetchRoles exception:', e);
      const fallback = ['customer'];
      setRoles(fallback);
      setRolesLoaded(true);
      return fallback;
    }
  }, []);

  // ── Refresh roles (called externally after approval etc.) ────────────────────
  const refreshRoles = useCallback(async () => {
    if (!user) return;
    _roleCache.delete(user.id);
    await fetchRoles(user.id);
  }, [user, fetchRoles]);

  // ── Refresh profile (called externally after My Profile edits) ───────────────
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ── Subscribe to real-time role changes ──────────────────────────────────────
  const subscribeToRoles = useCallback((uid: string) => {
    // Unsubscribe from previous channel if any
    if (rolesChannelRef.current) {
      supabase.removeChannel(rolesChannelRef.current);
    }

    const ch = supabase.channel(`user-roles-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${uid}` },
        async () => {
          // Role changed — invalidate cache and re-fetch
          _roleCache.delete(uid);
          await fetchRoles(uid);
        }
      )
      .subscribe();

    rolesChannelRef.current = ch;
  }, [fetchRoles]);

  // ── Handle auth state ─────────────────────────────────────────────────────────
  const handleAuthChange = useCallback(async (newSession: Session | null) => {
    setSession(newSession);
    const u = newSession?.user ?? null;
    setUser(u);

    if (u) {
      // Fetch profile and roles in parallel
      await Promise.all([
        fetchProfile(u.id),
        fetchRoles(u.id),
      ]);
      subscribeToRoles(u.id);
    } else {
      // Logged out — clear everything
      setProfile(null);
      setRoles([]);
      setRolesLoaded(false);
      _roleCache.clear();
      if (rolesChannelRef.current) {
        supabase.removeChannel(rolesChannelRef.current);
        rolesChannelRef.current = null;
      }
    }

    setLoading(false);
    initialised.current = true;
  }, [fetchProfile, fetchRoles, subscribeToRoles]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Subscribe to future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        handleAuthChange(newSession);
      }
    );

    // Hydrate from persisted session immediately
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!initialised.current) {
        handleAuthChange(existing);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (rolesChannelRef.current) {
        supabase.removeChannel(rolesChannelRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────────
  const signUp = useCallback(async (
    email: string, password: string, fullName: string, phone?: string
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName, phone: phone ?? '' },
      },
    });
    if (!error && data?.user) {
      console.log('[Auth] signUp success:', {
        userId: data.user.id,
        email: data.user.email,
        emailConfirmedAt: data.user.email_confirmed_at,
        hasSession: !!data.session,
        identities: data.user.identities?.length,
      });
    }
    return { data, error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    localStorage.removeItem('inactivityLogout');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem('inactivityLogout');
      // Clear all session/cache data before signOut
      _roleCache.clear();
      sessionStorage.clear();
      // Clear every localStorage key that Supabase uses
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('[AuthContext] signOut error:', e);
    } finally {
      // Hard redirect — works from any context (no useNavigate needed)
      // Forces React Query cache to be reset because the page reloads
      window.location.href = '/';
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ error: AuthError | Error | null }> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { error };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Google sign-in could not be started.'),
      };
    }
  }, []);

  // ── Derived values (memoised to avoid unnecessary re-renders) ─────────────────
  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    profile,
    loading,
    authenticated: !!user,
    roles,
    isAdmin:    roles.includes('admin') || roles.includes('super_admin'),
    isSuperAdmin: roles.includes('super_admin'),
    isProvider: roles.includes('provider'),
    isCustomer: roles.includes('customer'),
    rolesLoaded,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    refreshRoles,
    refreshProfile,
  }), [user, session, profile, loading, roles, rolesLoaded, signUp, signIn, signInWithGoogle, signOut, refreshRoles, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ── Hooks ──────────────────────────────────────────────────────────────────────

/** Primary auth hook — use everywhere */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/** Role-focused hook */
export const useRole = () => {
  const { roles, isAdmin, isProvider, isCustomer, rolesLoaded } = useAuth();
  return { roles, isAdmin, isProvider, isCustomer, rolesLoaded };
};

/** Admin-only hook — returns isAdmin + guard helper */
export const useAdmin = () => {
  const { isAdmin, rolesLoaded, user } = useAuth();
  return {
    isAdmin,
    rolesLoaded,
    userId: user?.id,
    /** Returns true if the current user has admin role */
    checkAdmin: () => isAdmin,
  };
};
