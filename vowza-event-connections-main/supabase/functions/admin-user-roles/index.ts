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

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json(request, { success: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(request, { success: false, code: 'SERVER_MISCONFIGURED' }, 500);
  }
  if (!authorization?.startsWith('Bearer ')) {
    return json(request, { success: false, code: 'UNAUTHENTICATED' }, 401);
  }

  let body: { operation?: string; targetId?: unknown; targetEmail?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(request, { success: false, code: 'INVALID_REQUEST' }, 400);
  }

  if (!body.operation || !['list', 'grant', 'revoke'].includes(body.operation)) {
    return json(request, { success: false, code: 'INVALID_OPERATION' }, 400);
  }
  if (body.operation !== 'list' && body.targetId !== undefined && body.targetId !== null && !isUuid(body.targetId)) {
    return json(request, { success: false, code: 'INVALID_TARGET' }, 400);
  }
  if (body.operation !== 'list' && body.targetEmail !== undefined && body.targetEmail !== null &&
      (typeof body.targetEmail !== 'string' || body.targetEmail.length > 320)) {
    return json(request, { success: false, code: 'INVALID_TARGET' }, 400);
  }

  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json(request, { success: false, code: 'UNAUTHENTICATED' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  try {
    if (body.operation === 'list') {
      const { data, error } = await admin.rpc('admin_list_admins');
      if (error) throw error;
      return json(request, { success: true, admins: data ?? [] });
    }

    const { data, error } = await admin.rpc('admin_set_user_role', {
      p_actor_id: userData.user.id,
      p_action: body.operation,
      p_role: 'admin',
      p_target_id: body.targetId ?? null,
      p_target_email: typeof body.targetEmail === 'string' ? body.targetEmail : null,
    });
    if (error) throw error;

    const result = data as { success?: boolean; code?: string; message?: string } | null;
    return json(request, result ?? { success: false, code: 'EMPTY_RESULT' }, result?.success ? 200 : 403);
  } catch (error) {
    console.error('[admin-user-roles] request failed', error instanceof Error ? error.message : String(error));
    return json(request, { success: false, code: 'SERVER_ERROR' }, 500);
  }
});
