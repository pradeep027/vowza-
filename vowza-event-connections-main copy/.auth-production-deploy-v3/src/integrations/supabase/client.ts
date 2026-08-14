import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Key resolution priority:
//  1. VITE_SUPABASE_ANON_KEY  — the real anon/public JWT from Supabase dashboard
//  2. VITE_SUPABASE_PUBLISHABLE_KEY — legacy name kept for compatibility
// If ANON_KEY is empty, fall through to the publishable key automatically.
const SUPABASE_ANON_KEY: string =
  ((import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '').trim() ||
  ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || '').trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Supabase] MISSING ENV VARS!\n' +
    '  Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.\n' +
    '  Get the anon key from: Supabase Dashboard → Project Settings → API → anon public\n' +
    '  Project: https://supabase.com/dashboard/project/vavfeataqwwbpjonknne/settings/api'
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
