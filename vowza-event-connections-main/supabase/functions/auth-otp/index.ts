import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PURPOSES = new Set(['login', 'worker_onboarding', 'password_reset']);
const OTP_LENGTH = 6;
const DEFAULT_OTP_EXPIRY_SECONDS = 120;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RATE_WINDOW_SECONDS = 900;
const DEFAULT_MAX_PHONE_REQUESTS = 5;
const DEFAULT_MAX_IP_REQUESTS = 10;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const envInt = (name: string, fallback: number, min: number, max: number): number => {
  const value = Number.parseInt(Deno.env.get(name) ?? '', 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
};

function normalizePhone(value: unknown): string | null {
  const phone = String(value ?? '').replace(/\s+/g, '').replace(/^\+91/, '');
  return /^[6-9]\d{9}$/.test(phone) ? phone : null;
}

function getRequestIp(request: Request): string {
  // Only trust these headers when the function is deployed behind Supabase's
  // trusted ingress. Never accept an IP supplied in the JSON body.
  const direct = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip');
  if (direct?.trim()) return direct.trim();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'unknown';
}

function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent');
}

function generateOtp(): string {
  const digits = '0123456789';
  let result = '';
  const bytes = new Uint8Array(OTP_LENGTH * 2);
  while (result.length < OTP_LENGTH) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      // 250 is divisible by 10, avoiding modulo bias for decimal digits.
      if (byte >= 250) continue;
      result += digits[byte % 10];
      if (result.length === OTP_LENGTH) break;
    }
  }
  return result;
}

async function hmacOtp(phone: string, purpose: string, otp: string): Promise<string> {
  const secret = Deno.env.get('OTP_HMAC_SECRET');
  if (!secret) throw new Error('OTP_HMAC_SECRET is not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const message = `vowza-otp:v1:${purpose}:${phone}:${otp}`;
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

async function sendSms(phone: string, otp: string, purpose: string): Promise<void> {
  const sid = Deno.env.get('TWILIO_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE');
  if (!sid || !token || !from) throw new Error('SMS provider is not configured');

  const body = new URLSearchParams({
    To: `+91${phone}`,
    From: from,
    Body: `Your Vowza ${purpose} OTP is ${otp}. It expires in 2 minutes.`,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(sid, token),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!response.ok) throw new Error(`SMS provider returned ${response.status}`);
}

async function logAttempt(
  adminClient: ReturnType<typeof createClient>,
  phone: string,
  attemptType: 'otp_request' | 'otp_verify' | 'login',
  success: boolean,
  ipAddress: string,
  userAgent: string | null,
  failureReason?: string,
): Promise<void> {
  await adminClient.from('login_attempts').insert({
    phone,
    ip_address: ipAddress === 'unknown' ? null : ipAddress,
    user_agent: userAgent,
    attempt_type: attemptType,
    success,
    failure_reason: failureReason ?? null,
  });
}

async function currentLimit(
  adminClient: ReturnType<typeof createClient>,
  column: 'phone' | 'ip_address',
  value: string,
  windowStart: string,
): Promise<{ id: string; request_count: number; window_start: string } | null> {
  const { data, error } = await adminClient
    .from('otp_rate_limits')
    .select('id, request_count, window_start')
    .eq(column, value)
    .gte('window_start', windowStart)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; request_count: number; window_start: string } | null;
}

async function incrementLimit(
  adminClient: ReturnType<typeof createClient>,
  phone: string,
  ipAddress: string,
  windowStart: string,
): Promise<void> {
  const phoneRow = await currentLimit(adminClient, 'phone', phone, windowStart);
  if (phoneRow) {
    await adminClient.from('otp_rate_limits').update({
      request_count: (phoneRow.request_count ?? 0) + 1,
      window_start: windowStart,
    }).eq('id', phoneRow.id);
  } else {
    await adminClient.from('otp_rate_limits').insert({
      phone,
      ip_address: ipAddress === 'unknown' ? null : ipAddress,
      request_count: 1,
      window_start: windowStart,
    });
  }

  if (ipAddress === 'unknown') return;
  const ipRow = await currentLimit(adminClient, 'ip_address', ipAddress, windowStart);
  if (ipRow) {
    await adminClient.from('otp_rate_limits').update({
      request_count: (ipRow.request_count ?? 0) + 1,
      window_start: windowStart,
    }).eq('id', ipRow.id);
  } else {
    await adminClient.from('otp_rate_limits').insert({
      phone,
      ip_address: ipAddress,
      request_count: 1,
      window_start: windowStart,
    });
  }
}

async function requestOtp(
  adminClient: ReturnType<typeof createClient>,
  phone: string,
  purpose: string,
  ipAddress: string,
  userAgent: string | null,
): Promise<Response> {
  const windowSeconds = envInt('OTP_RATE_WINDOW_SECONDS', DEFAULT_RATE_WINDOW_SECONDS, 60, 86400);
  const phoneMax = envInt('OTP_MAX_PHONE_REQUESTS', DEFAULT_MAX_PHONE_REQUESTS, 1, 100);
  const ipMax = envInt('OTP_MAX_IP_REQUESTS', DEFAULT_MAX_IP_REQUESTS, 1, 200);
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000).toISOString();

  const phoneRow = await currentLimit(adminClient, 'phone', phone, windowStart);
  const ipRow = ipAddress === 'unknown' ? null : await currentLimit(adminClient, 'ip_address', ipAddress, windowStart);
  if ((phoneRow?.request_count ?? 0) >= phoneMax || (ipRow?.request_count ?? 0) >= ipMax) {
    await logAttempt(adminClient, phone, 'otp_request', false, ipAddress, userAgent, 'rate_limited');
    return json({ success: false, message: 'Too many requests. Please try again later.' }, 429);
  }

  const otp = generateOtp();
  const otpHash = await hmacOtp(phone, purpose, otp);
  const expirySeconds = envInt('OTP_EXPIRY_SECONDS', DEFAULT_OTP_EXPIRY_SECONDS, 30, 900);
  const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
  const { data: otpRow, error: insertError } = await adminClient
    .from('otp_verifications')
    .insert({ phone, otp_hash: otpHash, purpose, expires_at: expiresAt, attempts: 0, verified: false })
    .select('id, expires_at')
    .single();
  if (insertError || !otpRow) throw insertError ?? new Error('OTP insert failed');

  try {
    await sendSms(phone, otp, purpose);
  } catch (error) {
    await adminClient.from('otp_verifications').delete().eq('id', otpRow.id);
    await logAttempt(adminClient, phone, 'otp_request', false, ipAddress, userAgent, 'sms_failed');
    throw error;
  }

  await incrementLimit(adminClient, phone, ipAddress, windowStart);
  await logAttempt(adminClient, phone, 'otp_request', true, ipAddress, userAgent);
  return json({ success: true, message: 'OTP sent successfully.', otpId: otpRow.id, expiresAt: otpRow.expires_at });
}

async function findOrCreateUser(
  adminClient: ReturnType<typeof createClient>,
  phone: string,
): Promise<{ id: string; email: string; phone: string; full_name?: string | null }> {
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, phone, email, full_name')
    .eq('phone', phone)
    .limit(1)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile) {
    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(profile.id);
    if (authUserError || !authUserData.user?.email) throw authUserError ?? new Error('Existing Auth user has no email');
    return {
      id: profile.id,
      email: authUserData.user.email,
      phone: profile.phone,
      full_name: profile.full_name,
    };
  }

  const email = `${phone}@vowza.local`;
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    phone: `+91${phone}`,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { phone },
  });
  if (createError || !created.user) throw createError ?? new Error('User creation failed');

  const { error: profileInsertError } = await adminClient.from('profiles').insert({
    id: created.user.id,
    phone,
    email,
    full_name: '',
  });
  if (profileInsertError) throw profileInsertError;
  return { id: created.user.id, email, phone, full_name: '' };
}

async function mintSession(
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string,
  email: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number; user: unknown }> {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = (linkData as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
  if (linkError || !tokenHash) throw linkError ?? new Error('Supabase did not return a magic-link token hash');

  const sessionClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: sessionData, error: sessionError } = await sessionClient.auth.verifyOtp({
    email,
    token_hash: tokenHash,
    type: 'email',
  });
  if (sessionError || !sessionData.session || !sessionData.user) throw sessionError ?? new Error('Supabase session issuance failed');
  return {
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    expires_in: sessionData.session.expires_in ?? 3600,
    user: sessionData.user,
  };
}

async function verifyOtpAndMintSession(
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string,
  phone: string,
  purpose: string,
  otp: string,
  ipAddress: string,
  userAgent: string | null,
): Promise<Response> {
  const maxAttempts = envInt('OTP_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS, 1, 10);
  const otpHash = await hmacOtp(phone, purpose, otp);
  const { data: verified, error: verifyError } = await adminClient.rpc('verify_otp', {
    p_phone: phone,
    p_purpose: purpose,
    p_otp_hash: otpHash,
    p_max_attempts: maxAttempts,
  });
  if (verifyError) throw verifyError;
  if (!verified) {
    await logAttempt(adminClient, phone, 'otp_verify', false, ipAddress, userAgent, 'invalid_or_expired');
    return json({ success: false, message: 'Invalid or expired OTP.' }, 401);
  }

  const user = await findOrCreateUser(adminClient, phone);
  if (purpose === 'worker_onboarding') {
    const { data: workerProfile, error: workerError } = await adminClient
      .from('worker_profiles')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (workerError) throw workerError;
    if (workerProfile) return json({ success: false, message: 'Worker onboarding has already started.' }, 409);
  }

  const session = await mintSession(supabaseUrl, anonKey, serviceRoleKey, user.email);
  await logAttempt(adminClient, phone, 'otp_verify', true, ipAddress, userAgent);
  return json({
    success: true,
    message: 'Authentication successful.',
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    user: session.user,
    requiresOnboarding: purpose === 'worker_onboarding',
  });
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, message: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !Deno.env.get('OTP_HMAC_SECRET')) {
    return json({ success: false, message: 'Auth service is not configured.' }, 500);
  }

  let body: { phone?: unknown; purpose?: unknown; otp?: unknown };
  try { body = await request.json(); } catch { return json({ success: false, message: 'Invalid JSON.' }, 400); }
  const phone = normalizePhone(body.phone);
  const purpose = String(body.purpose ?? '');
  const pathname = new URL(request.url).pathname;
  const action = pathname.endsWith('/request') ? 'request' : pathname.endsWith('/verify') ? 'verify' : null;
  if (!action) return json({ success: false, message: 'Not found.' }, 404);
  const ipAddress = getRequestIp(request);
  const userAgent = getUserAgent(request);
  if (!phone || !PURPOSES.has(purpose)) return json({ success: false, message: 'Invalid request.' }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    if (action === 'request') return await requestOtp(adminClient, phone, purpose, ipAddress, userAgent);
    if (!/^[0-9]{6}$/.test(String(body.otp ?? ''))) return json({ success: false, message: 'Invalid request.' }, 400);
    return await verifyOtpAndMintSession(adminClient, supabaseUrl, anonKey, serviceRoleKey, phone, purpose, String(body.otp), ipAddress, userAgent);
  } catch (error) {
    console.error('[auth-otp] request failed', error instanceof Error ? error.message : 'unknown');
    return json({ success: false, message: 'Authentication service unavailable.' }, 503);
  }
});
