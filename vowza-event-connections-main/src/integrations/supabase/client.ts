import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Prefer VITE_SUPABASE_ANON_KEY; fall back to VITE_SUPABASE_PUBLISHABLE_KEY for backwards compatibility.
// ACTION REQUIRED: Set VITE_SUPABASE_ANON_KEY in your .env file.
// Get it from: Supabase Dashboard → Project Settings → API → anon public
const SUPABASE_ANON_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Supabase] Missing environment variables. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            localStorage,
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,   // picks up the reset token / magic link from the URL hash
    // flowType: 'pkce' is more secure but requires the Supabase project to have PKCE enabled.
    // Using 'implicit' (default) for compatibility with existing projects.
  },
});
