// Application-level Service Start OTP sender.
// This is independent from Supabase Auth signup/login/confirmation emails.
// Required server-only secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME.

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
  ACTIVE_OTP_EXISTS: 'A Service Start OTP is already active. Ask the customer for the code or resend it.',
  BOOKING_NOT_CONFIRMED: 'Only confirmed, advance-paid bookings can start service.',
  CUSTOMER_EMAIL_NOT_FOUND: 'The customer does not have a registered email address.',
  EMAIL_DELIVERY_FAILED: 'Email sending failure. Please resend the OTP.',
  EMAIL_NOT_CONFIGURED: 'Email sending is not configured. Please contact Vowza support.',
  EVENT_TIME_INVALID: 'The booking has an invalid event time. Please contact Vowza support.',
  EVENT_TIME_REQUIRED: 'A scheduled event time is required before service can start.',
  INVALID_BOOKING_SOURCE: 'This booking type cannot start service.',
  MAX_RESENDS_REACHED: 'Too many OTP resends. Please contact Vowza support.',
  NETWORK_OR_SERVER_FAILURE: 'Network or server failure. Please try again.',
  RESEND_COOLDOWN: 'Please wait one minute before resending the OTP.',
  SERVICE_ALREADY_STARTED: 'Service has already started for this booking.',
  SERVICE_START_NOT_DUE: 'Service can start only at or after the scheduled event time (IST).',
  UNAUTHENTICATED: 'Please sign in again and retry.',
  UNAUTHORIZED_VENDOR: 'You are not authorized to start this service.',
};

async function notifyServiceStartParticipants(
  adminClient: any,
  otpId: string,
  bookingId: string,
  bookingSource: string,
  isResend: boolean,
): Promise<'sent' | 'no_admins' | 'failed'> {
  try {
    const { data: otpRecord, error: otpError } = await adminClient
      .from('booking_start_otps')
      .select('customer_id')
      .eq('id', otpId)
      .single();
    if (otpError || !otpRecord?.customer_id) throw otpError || new Error('OTP_NOT_FOUND');

    const { data: admins, error: adminsError } = await adminClient
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'super_admin']);
    if (adminsError) throw adminsError;

    const action = isResend ? 'resent' : 'generated';
    const notifications = [{
      user_id: otpRecord.customer_id,
      title: 'Service Start Verification Requested',
      message: `Your service provider is ready to start your ${bookingSource} booking. A verification code was sent to your registered email. SMS delivery is unavailable because no SMS provider is configured.`,
      type: 'booking_confirmed',
      reference_id: bookingId,
      is_read: false,
    }, ...(admins ?? []).map((admin: { user_id: string }) => ({
      user_id: admin.user_id,
      title: `Service Start OTP ${isResend ? 'Resent' : 'Generated'}`,
      message: `Service Start OTP ${action} for booking ${bookingId} (${bookingSource}). Customer email delivery: sent. SMS delivery: unavailable because no SMS provider is configured.`,
      type: 'booking_confirmed',
      reference_id: bookingId,
      is_read: false,
    }))];

    const { error: notificationError } = await adminClient.from('notifications').insert(notifications);
    if (notificationError) throw notificationError;
    return admins?.length ? 'sent' : 'no_admins';
  } catch (error) {
    console.error('[send-service-start-otp] In-app notification failed', bookingId, error);
    return 'failed';
  }
}

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

function emailText(otp: string): string {
  return [
    'Your Vowza Service Start Verification Code is:',
    '',
    otp,
    '',
    'Give this 6-digit code to your vendor to authorize the start of your service.',
    '',
    'This code expires in 10 minutes.',
    '',
    'If you did not request this, please contact Vowza support.',
  ].join('\n');
}

function emailHtml(otp: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111827;">
    <h1 style="color:#8B1538;font-size:24px;margin:0 0 24px;">Vowza</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Your Vowza Service Start Verification Code is:</p>
    <p style="font-size:34px;font-weight:700;letter-spacing:8px;color:#8B1538;margin:0 0 20px;">${otp}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Give this 6-digit code to your vendor to authorize the start of your service.</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">This code expires in 10 minutes.</p>
    <p style="font-size:15px;line-height:1.6;margin:0;">If you did not request this, please contact Vowza support.</p>
  </div>`;
}

async function sendBrevo(customerEmail: string, otp: string): Promise<void> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
  const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'Vowza';
  if (!apiKey || !senderEmail) throw new Error('EMAIL_NOT_CONFIGURED');

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey, Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: customerEmail }],
      subject: 'Your Vowza Service Start Verification Code',
      textContent: emailText(otp),
      htmlContent: emailHtml(otp),
    }),
  });

  if (!response.ok) {
    console.error('[send-service-start-otp] Brevo rejected delivery', response.status);
    throw new Error('EMAIL_DELIVERY_FAILED');
  }
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

  let body: { bookingId?: string; bookingSource?: string; resend?: boolean };
  try { body = await request.json(); } catch { return json({ success: false, code: 'INVALID_REQUEST', message: 'Invalid request.' }, 400); }

  const bookingTable = body.bookingSource ? sourceToTable[body.bookingSource] : undefined;
  if (!body.bookingId || !bookingTable) return json({ success: false, code: 'INVALID_REQUEST', message: 'Invalid booking request.' }, 400);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ success: false, code: 'UNAUTHENTICATED', message: messages.UNAUTHENTICATED }, 401);
  if (!Deno.env.get('BREVO_API_KEY') || !Deno.env.get('BREVO_SENDER_EMAIL')) return json({ success: false, code: 'EMAIL_NOT_CONFIGURED', message: messages.EMAIL_NOT_CONFIGURED }, 503);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  let otpRecord: { otp_id?: string; otp_code?: string; customer_email?: string } | undefined;
  try {
    const { data, error } = await adminClient.rpc('create_service_start_otp', {
      p_booking_table: bookingTable,
      p_booking_id: body.bookingId,
      p_vendor_user_id: userData.user.id,
      p_is_resend: body.resend === true,
    });
    if (error) throw error;
    otpRecord = Array.isArray(data) ? data[0] : data;
    if (!otpRecord?.otp_id || !otpRecord.otp_code || !otpRecord.customer_email) throw new Error('NETWORK_OR_SERVER_FAILURE');
  } catch (error) {
    const code = toCode(error);
    console.error('[send-service-start-otp] OTP creation failed', code);
    return json({ success: false, code, message: messages[code] }, 400);
  }

  let adminNotificationStatus: 'sent' | 'no_admins' | 'failed' = 'no_admins';
  let deliveryIsCurrent = false;
  try {
    await sendBrevo(otpRecord.customer_email, otpRecord.otp_code);
    const { error: deliveryError } = await adminClient.rpc('record_service_start_otp_delivery', {
      p_otp_id: otpRecord.otp_id,
      p_delivered: true,
      p_error: null,
    });
    if (deliveryError) throw deliveryError;

    const { data: currentDelivery, error: currentDeliveryError } = await adminClient.rpc('is_current_service_start_otp', {
      p_otp_id: otpRecord.otp_id,
    });
    if (currentDeliveryError) throw currentDeliveryError;
    deliveryIsCurrent = currentDelivery === true;

    if (deliveryIsCurrent) {
      adminNotificationStatus = await notifyServiceStartParticipants(
        adminClient,
        otpRecord.otp_id,
        body.bookingId,
        body.bookingSource!,
        body.resend === true,
      );
    }
  } catch (error) {
    const code = toCode(error);
    await adminClient.rpc('record_service_start_otp_delivery', {
      p_otp_id: otpRecord.otp_id,
      p_delivered: false,
      p_error: code,
    });
    console.error('[send-service-start-otp] OTP delivery failed', code);
    return json({ success: false, code, message: messages[code] }, 502);
  }

  if (!deliveryIsCurrent) {
    return json({
      success: false,
      code: 'ACTIVE_OTP_EXISTS',
      message: 'A newer Service Start OTP is already active. Ask the customer for the newest code.',
    }, 409);
  }

  return json({
    success: true,
    code: body.resend ? 'OTP_RESENT' : 'OTP_SENT',
    message: 'Verification code sent to the customer\'s registered email. SMS delivery is unavailable because no SMS provider is configured.',
    resendCooldownSeconds: 60,
    delivery: {
      email: 'sent',
      sms: 'unavailable',
      adminNotification: adminNotificationStatus,
    },
  });
});
