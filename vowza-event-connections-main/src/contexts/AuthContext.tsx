import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Prevent double-set on mount — onAuthStateChange fires after getSession
  const initialised = React.useRef(false);

  useEffect(() => {
    // 1. Subscribe to auth state changes first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        initialised.current = true;
      }
    );

    // 2. Hydrate immediately from existing session (no await needed —
    //    onAuthStateChange fires synchronously with the persisted session)
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!initialised.current) {
        // Only apply if the subscriber hasn't already done it
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        setLoading(false);
        initialised.current = true;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('[Auth] Attempting sign up for:', normalizedEmail);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName, phone: phone ?? '' },
      },
    });
    
    if (error) {
      console.error('[Auth] Sign up error:', error);
    } else {
      console.log('[Auth] Sign up successful:', data.user?.email);
    }
    
    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // Clear any stale inactivity flag from previous sessions
    localStorage.removeItem('inactivityLogout');
    
    // Normalize email to lowercase (Supabase is case-insensitive but this ensures consistency)
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('[Auth] Attempting sign in for:', normalizedEmail);
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: normalizedEmail, 
      password 
    });
    
    if (error) {
      console.error('[Auth] Sign in error:', error);
    } else {
      console.log('[Auth] Sign in successful:', data.user?.email);
    }
    
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem('inactivityLogout');
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
