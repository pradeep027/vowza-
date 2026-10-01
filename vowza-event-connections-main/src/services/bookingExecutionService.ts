/**
 * Vowza Booking Execution Service
 *
 * Service Start OTP is deliberately independent from Supabase Auth OTP. The
 * browser never generates, stores, displays, or looks up a Service Start OTP.
 * It calls the authenticated backend, which authorizes the vendor, creates the
 * hash server-side, and delivers the plaintext code only to the booking customer.
 */

import { supabase } from '@/integrations/supabase/client';

/* ─── Helper: get booking table from source ────────────────────────────────── */
function getBookingTable(source: string): string {
  const map: Record<string, string> = {
    generic: 'bookings', photography: 'photography_package_bookings',
    catering: 'catering_bookings', drone: 'drone_bookings',
    videography: 'videography_bookings', dj: 'dj_bookings',
    decorator: 'decorator_bookings', makeup: 'makeup_bookings',
    mehendi: 'mehendi_bookings', anchor: 'anchor_bookings',
    banquet: 'banquet_bookings', rental: 'rental_bookings',
    priest: 'priest_bookings', water: 'water_bookings',
    band: 'band_bookings', singer: 'singer_bookings', dancer: 'dancer_bookings',
  };
  return map[source] || 'bookings';
}

export interface StartServiceResult {
  success: boolean;
  code?: string;
  error?: string;
}

export interface VerifyOTPResult {
  success: boolean;
  code?: string;
  error?: string;
  startedAt?: string;
}

export interface CompleteServiceResult {
  success: boolean;
  error?: string;
  settlementId?: string;
}

type ServiceStartAction = 'send' | 'resend' | 'verify';

type ServiceStartResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  startedAt?: string;
};

type FunctionErrorContext = {
  clone: () => {
    json: () => Promise<unknown>;
  };
};

function messageForOtpCode(code?: string, fallback = 'Network or server failure. Please try again.'): string {
  const messages: Record<string, string> = {
    ACTIVE_OTP_EXISTS: 'A Service Start OTP is already active. Ask the customer for the code or resend it.',
    BOOKING_NOT_CONFIRMED: 'Only confirmed, advance-paid bookings can start service.',
    CUSTOMER_EMAIL_NOT_FOUND: 'The customer does not have a registered email address.',
    EMAIL_DELIVERY_FAILED: 'Email sending failure. Please resend the OTP.',
    EMAIL_NOT_CONFIGURED: 'Email sending is not configured. Please contact Vowza support.',
    EXPIRED: 'OTP expired. Please resend.',
    INVALID: 'Invalid OTP.',
    INVALID_BOOKING_SOURCE: 'This booking type cannot start service.',
    MAX_RESENDS_REACHED: 'Too many OTP resends. Please contact Vowza support.',
    NO_ACTIVE_OTP: 'No active OTP found. Please resend.',
    OTP_EXPIRED: 'OTP expired. Please resend.',
    RESEND_COOLDOWN: 'Please wait one minute before resending the OTP.',
    SERVICE_ALREADY_STARTED: 'Service has already started for this booking.',
    TOO_MANY_ATTEMPTS: 'Too many attempts. Please resend a new OTP.',
    UNAUTHORIZED_VENDOR: 'You are not authorized to start this service.',
    UNAUTHENTICATED: 'Please sign in again and retry.',
  };

  return (code && messages[code]) || fallback;
}

function isFunctionErrorContext(value: unknown): value is FunctionErrorContext {
  return typeof value === 'object'
    && value !== null
    && 'clone' in value
    && typeof (value as { clone?: unknown }).clone === 'function';
}

async function responseFromFunctionError(error: unknown): Promise<ServiceStartResponse | null> {
  const context = typeof error === 'object' && error !== null
    ? (error as { context?: unknown }).context
    : undefined;

  if (!isFunctionErrorContext(context)) return null;

  try {
    const payload = await context.clone().json();
    if (typeof payload !== 'object' || payload === null) return null;

    const response = payload as Record<string, unknown>;
    return {
      success: response.success === true,
      code: typeof response.code === 'string' ? response.code : undefined,
      message: typeof response.message === 'string' ? response.message : undefined,
      startedAt: typeof response.startedAt === 'string' ? response.startedAt : undefined,
    };
  } catch {
    return null;
  }
}

async function callServiceStartOtp(
  action: ServiceStartAction,
  bookingId: string,
  bookingSource: string,
  otp?: string,
): Promise<ServiceStartResponse> {
  try {
    const functionName = action === 'verify'
      ? 'verify-service-start-otp'
      : 'send-service-start-otp';
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: {
        bookingId,
        bookingSource,
        ...(action === 'resend' ? { resend: true } : {}),
        ...(action === 'verify' && otp ? { otp } : {}),
      },
    });

    if (error) {
      return (await responseFromFunctionError(error)) ?? {
        success: false,
        code: 'NETWORK_OR_SERVER_FAILURE',
        message: 'Network or server failure. Please try again.',
      };
    }

    return (data ?? { success: false, code: 'NETWORK_OR_SERVER_FAILURE' }) as ServiceStartResponse;
  } catch (error) {
    console.error('[BookingExecution] Service Start OTP request failed:', error);
    return {
      success: false,
      code: 'NETWORK_OR_SERVER_FAILURE',
      message: 'Network or server failure. Please try again.',
    };
  }
}

/** Request a new customer-email Service Start OTP for a confirmed booking. */
export async function requestStartService(
  bookingId: string,
  bookingSource: string,
): Promise<StartServiceResult> {
  const result = await callServiceStartOtp('send', bookingId, bookingSource);
  return {
    success: result.success === true,
    code: result.code,
    error: result.success ? undefined : (result.message || messageForOtpCode(result.code)),
  };
}

/** Verify the customer-provided Service Start OTP and start work atomically. */
export async function verifyStartOTP(
  bookingId: string,
  bookingSource: string,
  enteredOtp: string,
): Promise<VerifyOTPResult> {
  const result = await callServiceStartOtp('verify', bookingId, bookingSource, enteredOtp);
  return {
    success: result.success === true,
    code: result.code,
    startedAt: result.startedAt,
    error: result.success ? undefined : (result.message || messageForOtpCode(result.code)),
  };
}

/** Resend replaces the active OTP with a new code and invalidates the old code. */
export async function resendStartOTP(
  bookingId: string,
  bookingSource: string,
): Promise<StartServiceResult> {
  const result = await callServiceStartOtp('resend', bookingId, bookingSource);
  return {
    success: result.success === true,
    code: result.code,
    error: result.success ? undefined : (result.message || messageForOtpCode(result.code)),
  };
}

/* ─── 3. COMPLETE SERVICE ──────────────────────────────────────────────────── */
/**
 * Server-authoritative completion. The browser passes ONLY the booking id and
 * its source. The SECURITY DEFINER RPC public.complete_booking_service reads the
 * authoritative amount from the stored row, derives the platform fee from
 * platform_settings, authorizes the caller as the booking's provider, and writes
 * the status + settlement + audit + notification atomically and idempotently.
 * No amount, fee, earnings, or ownership value is accepted from the client.
 */
export async function completeService(
  bookingId: string,
  bookingSource: string,
): Promise<CompleteServiceResult> {
  try {
    const { data, error } = await supabase.rpc('complete_booking_service' as any, {
      p_booking_id: bookingId,
      p_booking_source: bookingSource,
    });

    if (error) {
      console.error('[BookingExecution] completeService RPC error:', error);
      return { success: false, error: error.message || 'Failed to complete service' };
    }

    return { success: true, settlementId: (data as string) ?? undefined };
  } catch (err: any) {
    console.error('[BookingExecution] completeService error:', err);
    return { success: false, error: err.message || 'Failed to complete service' };
  }
}

export { getBookingTable };
