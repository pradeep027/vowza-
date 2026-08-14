// Application-level Service Start OTP verifier.
// The customer only receives the code by email; the authenticated assigned vendor
// submits it here. Supabase Auth OTP and SMTP configuration are not used or changed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const sourceToTable: Record<string, string> = {
  generic: 'bookings', photography: 'photography_package_bookings',
  catering: 'catering_bookings', drone: 'drone_bookings',
  videography: 'videography_bookings', dj: 'dj_bookings',
  decorator: 'decorator_bookings', makeup: 'makeup_bookings',
  mehendi: 'mehendi_bookings', anchor: 'anchor_bookings',
  banquet: 'banquet_bookings', rental: 'rental_bookings',
  priest: 'priest_bookings', water: 'water_bookings', band: 'band_bookings',
  singer: 'singer_bookings', dancer: 'dancer_bookings',
};

const messages: Record<string, string> = {
  BOOKING_NOT_CONFIRMED: 'Only confirmed, advance-paid bookings can start service.',
  EMAIL_DELIVERY_FAILED: 'Email sending failure. Please resend the OTP.',
  EVENT_TIME_INVALID: 'The booking has an invalid event time. Please contact Vowza support.',
  EVENT_TIME_REQUIRED: 'A scheduled event time is required before service can start.',
  INVALID: 'Invalid OTP.',
  INVALID_BOOKING_SOURCE: 'This booking type cannot start service.',
  NETWORK_OR_SERVER_FAILURE: 'Network or server failure. Please try again.',
  NO_ACTIVE_OTP: 'No active OTP found. Please resend.',
  OTP_EXPIRED: 'OTP expired. Please resend.',
  SERVICE_ALREADY_STARTED: 'Service has already started for this booking.',
  SERVICE_START_NOT_DUE: 'Service can start only at or after the scheduled event time (IST).',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Please resend a new OTP.',
  UNAUTHENTICATED: 'Please sign in again and retry.',
  UNAUTHORIZED_VENDOR: 'You are not authorized to start this service.',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function toCode(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '');
  return Object.prototype.hasOwnProperty.call(messages, message) ? message : 'NETWORK_OR_SERVER_FAILURE';
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ success: false, code: 'NETWORK_OR_SERVER_FAILURE', message: messages.NETWORK_OR_SERVER_FAILURE }, 500);
  if (!authorization?.startsWith('Bearer ')) return json({ success: false, code: 'UNAUTHENTICATED', message: messages.UNAUTHENTICATED }, 401);

  let body: { bookingId?: string; bookingSource?: string; otp?: string };
  try { body = await request.json(); } catch { return json({ success: false, code: 'INVALID_REQUEST', message: 'Invalid request.' }, 400); }

  const bookingTable = body.bookingSource ? sourceToTable[body.bookingSource] : undefined;
  if (!body.bookingId || !bookingTable || !/^[0-9]{6}$/.test(body.otp || '')) {
    return json({ success: false, code: 'INVALID', message: messages.INVALID }, 400);
  }

  // Authentication is explicit even if the platform JWT gateway is enabled.
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ success: false, code: 'UNAUTHENTICATED', message: messages.UNAUTHENTICATED }, 401);

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await adminClient.rpc('verify_service_start_otp', {
      p_booking_table: bookingTable,
      p_booking_id: body.bookingId,
      p_vendor_user_id: userData.user.id,
      p_otp: body.otp,
    });
    if (error) throw error;

    const result = data as { status?: string; started_at?: string } | null;
    const codeMap: Record<string, string> = {
      started: 'SERVICE_STARTED',
      invalid: 'INVALID',
      expired: 'OTP_EXPIRED',
      too_many_attempts: 'TOO_MANY_ATTEMPTS',
      no_active_otp: 'NO_ACTIVE_OTP',
      email_delivery_failed: 'EMAIL_DELIVERY_FAILED',
      already_started: 'SERVICE_ALREADY_STARTED',
    };
    const code = codeMap[result?.status || ''] || 'NETWORK_OR_SERVER_FAILURE';

    return json({
      success: code === 'SERVICE_STARTED',
      code,
      message: code === 'SERVICE_STARTED' ? 'Service Started Successfully' : messages[code],
      startedAt: result?.started_at,
    }, code === 'SERVICE_STARTED' ? 200 : 400);
  } catch (error) {
    const code = toCode(error);
    console.error('[verify-service-start-otp] Verification failed', code);
    return json({ success: false, code, message: messages[code] }, 400);
  }
});
