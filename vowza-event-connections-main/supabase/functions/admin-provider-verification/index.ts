import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const allowedOrigins = new Set([
  Deno.env.get('SUPABASE_URL') || '',
  'https://vowza.co.in',
  'https://www.vowza.co.in',
  'http://localhost:5173',
  'http://localhost:8080',
]);

const corsHeaders = (req: Request) => {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://vowza.co.in',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Action = 'approved' | 'rejected';
type RequestBody = { providerId?: unknown; action?: unknown; rejectionReason?: unknown };

function isAction(value: unknown): value is Action {
  return value === 'approved' || value === 'rejected';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { success: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = req.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization?.startsWith('Bearer ')) {
    return json(req, { success: false, code: 'UNAUTHENTICATED' }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(req, { success: false, code: 'INVALID_REQUEST', message: 'Invalid request.' }, 400);
  }

  const providerId = typeof body.providerId === 'string' ? body.providerId : '';
  const action = body.action;
  const rejectionReason = typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : '';
  if (!UUID_RE.test(providerId) || !isAction(action) || (action === 'rejected' && !rejectionReason)) {
    return json(req, { success: false, code: 'INVALID_REQUEST', message: 'A provider id, valid action, and rejection reason when rejecting are required.' }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const caller = userData.user;
  if (userError || !caller) return json(req, { success: false, code: 'UNAUTHENTICATED' }, 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  try {
    const [{ data: isAdmin, error: adminError }, { data: provider, error: providerError }] = await Promise.all([
      serviceClient.rpc('has_role', { _user_id: caller.id, _role: 'admin' }),
      serviceClient.from('provider_profiles').select('id, user_id, verification_status').eq('id', providerId).maybeSingle(),
    ]);

    if (adminError) throw adminError;
    if (providerError) throw providerError;
    if (!isAdmin && caller.id) {
      const { data: isSuperAdmin, error: superAdminError } = await serviceClient.rpc('has_role', { _user_id: caller.id, _role: 'super_admin' });
      if (superAdminError) throw superAdminError;
      if (!isSuperAdmin) return json(req, { success: false, code: 'FORBIDDEN' }, 403);
    }
    if (!provider) return json(req, { success: false, code: 'PROVIDER_NOT_FOUND' }, 404);

    // Audit the attempted privileged action before invoking the mutating RPC.
    // The actor is always the verified JWT subject; no client actor field exists.
    const { error: auditError } = await serviceClient.from('audit_log').insert({
      user_id: caller.id,
      action: `PROVIDER_VERIFICATION_${action.toUpperCase()}_REQUESTED`,
      table_name: 'provider_profiles',
      record_id: providerId,
      new_values: {
        requested_action: action,
        rejection_reason: action === 'rejected' ? rejectionReason : null,
        previous_status: provider.verification_status,
      },
    });
    if (auditError) throw auditError;

    const rpc = action === 'approved'
      ? await serviceClient.rpc('approve_artist', { p_provider_id: providerId, p_admin_user_id: caller.id })
      : await serviceClient.rpc('reject_artist', { p_provider_id: providerId, p_admin_user_id: caller.id, p_reason: rejectionReason });
    if (rpc.error) throw rpc.error;

    const result = rpc.data as { success?: boolean; message?: string } | null;
    if (!result?.success) return json(req, { success: false, code: 'APPROVAL_NOT_COMPLETED', message: result?.message || 'Provider verification was not completed.' }, 409);
    return json(req, { success: true, action, providerId }, 200);
  } catch (error) {
    console.error('[admin-provider-verification] failed', error instanceof Error ? error.message : 'unknown error');
    return json(req, { success: false, code: 'SERVER_ERROR', message: 'Provider verification failed.' }, 500);
  }
});
