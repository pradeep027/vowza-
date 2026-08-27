import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const ALLOWED_ORIGINS = new Set([
  'https://vowza.co.in',
  'https://www.vowza.co.in',
  'http://localhost:5173',
  'http://localhost:8080',
]);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}

serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json(request, { success: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(request, { success: false, code: 'SERVER_MISCONFIGURED' }, 500);
  if (!authorization?.startsWith('Bearer ')) return json(request, { success: false, code: 'UNAUTHENTICATED' }, 401);

  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json(request, { success: false, code: 'UNAUTHENTICATED' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  try {
    const { data: provider, error: providerError } = await admin
      .from('provider_profiles')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('onboarding_completed', true)
      .limit(1)
      .maybeSingle();

    if (providerError) {
      console.error('[complete-provider-onboarding] provider lookup failed');
      return json(request, { success: false, code: 'SERVER_ERROR' }, 500);
    }
    if (!provider) return json(request, { success: false, code: 'PROVIDER_PROFILE_REQUIRED' }, 403);

    const { error: roleError } = await admin
      .from('user_roles')
      .upsert({ user_id: userData.user.id, role: 'provider' }, { onConflict: 'user_id,role', ignoreDuplicates: true });
    if (roleError) {
      console.error('[complete-provider-onboarding] role assignment failed');
      return json(request, { success: false, code: 'SERVER_ERROR' }, 500);
    }

    return json(request, { success: true });
  } catch (error) {
    console.error('[complete-provider-onboarding] unexpected error', error instanceof Error ? error.message : 'unknown');
    return json(request, { success: false, code: 'SERVER_ERROR' }, 500);
  }
});
