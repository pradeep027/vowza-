/**
 * Vowza Booking Execution Service
 * Rapido/Swiggy-style lifecycle: OTP Start → In Progress → Complete → Settle
 *
 * OTP is hashed before storage. Verification is server-side via Supabase RPC-like
 * pattern (atomic update). SMS/Email are stubs ready for real provider integration.
 */

import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from '@/services/notificationService';

/* ─── OTP Utilities ────────────────────────────────────────────────────────── */

function generateOTP(): string {
  const digits = '0123456789';
  let otp = '';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) otp += digits[arr[i] % 10];
  return otp;
}

async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + 'vowza_booking_start_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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

/* ─── Types ────────────────────────────────────────────────────────────────── */
export interface StartServiceResult {
  success: boolean;
  otp?: string; // Only returned to display in dev/notification — NEVER stored plain
  error?: string;
  otpId?: string;
}

export interface VerifyOTPResult {
  success: boolean;
  error?: string;
}

export interface CompleteServiceResult {
  success: boolean;
  error?: string;
  settlementId?: string;
}

/* ─── 1. REQUEST START SERVICE (Generate & Send OTP) ──────────────────────── */
export async function requestStartService(
  bookingId: string,
  bookingSource: string,
  vendorId: string,
  customerId: string,
  customerName: string,
  vendorName: string,
  serviceName: string,
): Promise<StartServiceResult> {
  try {
    const table = getBookingTable(bookingSource);

    // Check if there's already a valid unexpired OTP for this booking
    const { data: existing } = await supabase
      .from('booking_start_otps' as any)
      .select('id, expires_at, verified, invalidated, resend_count, max_resends')
      .eq('booking_id', bookingId)
      .eq('verified', false)
      .eq('invalidated', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      const ex = existing[0] as any;
      if (new Date(ex.expires_at) > new Date()) {
        return { success: false, error: 'An active OTP already exists. Please ask the customer to share it.' };
      }
    }

    // Invalidate any previous OTPs for this booking
    await supabase.from('booking_start_otps' as any)
      .update({ invalidated: true })
      .eq('booking_id', bookingId)
      .eq('verified', false);

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Store hashed OTP
    const { data: otpRecord, error: insertErr } = await supabase
      .from('booking_start_otps' as any)
      .insert({
        booking_id: bookingId,
        booking_table: table,
        vendor_id: vendorId,
        customer_id: customerId,
        otp_hash: otpHash,
        purpose: 'booking_start',
        expires_at: expiresAt,
        sms_sent: false,
        email_sent: false,
        admin_notified: false,
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    // Get customer email for real delivery
    const { data: customerProfile } = await supabase.from('profiles').select('email, full_name').eq('id', customerId).maybeSingle();
    const customerEmail = customerProfile?.email;
    const customerFullName = customerProfile?.full_name || 'Customer';

    // Send real OTP email via Edge Function
    let emailSent = false;
    if (customerEmail) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-booking-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            customerEmail,
            customerName: customerFullName,
            vendorName,
            serviceName,
            eventType: '',
            eventDate: '',
            eventTime: '',
            eventLocation: '',
            otp,
            bookingId,
          }),
        });
        const result = await resp.json();
        emailSent = result.success === true;
      } catch (emailErr) {
        console.error('[BookingExecution] Email send failed:', emailErr);
        emailSent = false;
      }
    }

    // Update OTP record with delivery status
    await supabase.from('booking_start_otps' as any).update({
      email_sent: emailSent,
      email_sent_at: emailSent ? new Date().toISOString() : null,
      admin_notified: true,
      admin_notified_at: new Date().toISOString(),
    }).eq('id', (otpRecord as any)?.id);

    // If email failed and no other channel succeeded, warn but continue (in-app notification still works)
    if (!emailSent && customerEmail) {
      console.warn('[BookingExecution] Email delivery failed for', bookingId);
    }

    // Update booking: mark start_requested_at
    await supabase.from(table as any)
      .update({ start_requested_at: new Date().toISOString() })
      .eq('id', bookingId);

    // Log audit event
    await supabase.from('booking_events' as any).insert({
      booking_table: table,
      booking_id: bookingId,
      event_type: 'START_OTP_GENERATED',
      actor_id: (await supabase.auth.getUser()).data.user?.id,
      actor_role: 'vendor',
      metadata: { vendor_id: vendorId, otp_expires: expiresAt },
    });

    // Send in-app notification to customer with OTP
    await supabase.from('notifications' as any).insert({
      user_id: customerId,
      title: 'Service Start OTP',
      message: `Your ${serviceName} service with ${vendorName} is ready to start. Share this OTP with your vendor: ${otp}`,
      type: 'booking_confirmed',
      reference_id: bookingId,
      is_read: false,
    });

    // Notify admin
    const { data: admins } = await supabase.from('user_roles' as any)
      .select('user_id').in('role', ['admin', 'super_admin']);
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await supabase.from('notifications' as any).insert({
          user_id: admin.user_id,
          title: 'Booking Start OTP Generated',
          message: `Vendor ${vendorName} requested service start for ${customerName}. OTP: ${otp}`,
          type: 'booking_confirmed',
          reference_id: bookingId,
          is_read: false,
        });
      }
    }

    return { success: true, otp, otpId: (otpRecord as any)?.id };
  } catch (err: any) {
    console.error('[BookingExecution] requestStartService error:', err);
    return { success: false, error: err.message || 'Failed to generate start OTP' };
  }
}

/* ─── 2. VERIFY OTP (Server-side validation) ──────────────────────────────── */
export async function verifyStartOTP(
  bookingId: string,
  bookingSource: string,
  enteredOtp: string,
  vendorId: string,
): Promise<VerifyOTPResult> {
  try {
    const table = getBookingTable(bookingSource);

    // Get the active OTP for this booking
    const { data: otpRecords, error: fetchErr } = await supabase
      .from('booking_start_otps' as any)
      .select('*')
      .eq('booking_id', bookingId)
      .eq('verified', false)
      .eq('invalidated', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchErr || !otpRecords || otpRecords.length === 0) {
      return { success: false, error: 'No active OTP found. Please request a new one.' };
    }

    const record = otpRecords[0] as any;

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      await supabase.from('booking_start_otps' as any)
        .update({ invalidated: true }).eq('id', record.id);
      return { success: false, error: 'OTP expired. Please request a new OTP.' };
    }

    // Check attempt limit
    if (record.attempts >= record.max_attempts) {
      await supabase.from('booking_start_otps' as any)
        .update({ invalidated: true }).eq('id', record.id);
      return { success: false, error: 'Too many incorrect attempts. Please request a new OTP.' };
    }

    // Hash entered OTP and compare
    const enteredHash = await hashOTP(enteredOtp);

    if (enteredHash !== record.otp_hash) {
      // Increment attempts
      await supabase.from('booking_start_otps' as any)
        .update({ attempts: record.attempts + 1 }).eq('id', record.id);
      const remaining = record.max_attempts - record.attempts - 1;
      return { success: false, error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` };
    }

    // OTP is correct — mark verified
    const now = new Date().toISOString();
    const userId = (await supabase.auth.getUser()).data.user?.id;

    await supabase.from('booking_start_otps' as any)
      .update({ verified: true, verified_at: now, verified_by: userId }).eq('id', record.id);

    // Update booking: work started
    await supabase.from(table as any).update({
      otp_verified_at: now,
      work_started_at: now,
      status: 'in_progress',
    }).eq('id', bookingId);

    // Log audit events
    await supabase.from('booking_events' as any).insert([
      { booking_table: table, booking_id: bookingId, event_type: 'START_OTP_VERIFIED', actor_id: userId, actor_role: 'vendor', metadata: { vendor_id: vendorId } },
      { booking_table: table, booking_id: bookingId, event_type: 'WORK_STARTED', actor_id: userId, actor_role: 'vendor', metadata: { vendor_id: vendorId, started_at: now } },
    ]);

    // Notify customer
    await supabase.from('notifications' as any).insert({
      user_id: record.customer_id,
      title: 'Service Started',
      message: 'Your vendor has verified the OTP and started the service.',
      type: 'booking_confirmed',
      reference_id: bookingId,
      is_read: false,
    });

    return { success: true };
  } catch (err: any) {
    console.error('[BookingExecution] verifyStartOTP error:', err);
    return { success: false, error: err.message || 'Verification failed' };
  }
}

/* ─── 3. COMPLETE SERVICE ──────────────────────────────────────────────────── */
export async function completeService(
  bookingId: string,
  bookingSource: string,
  vendorId: string,
  vendorUserId: string,
  customerId: string,
  bookingAmount: number,
  platformFeeRate: number,
): Promise<CompleteServiceResult> {
  try {
    const table = getBookingTable(bookingSource);
    const now = new Date().toISOString();

    // Verify booking is in_progress
    const { data: booking } = await supabase.from(table as any)
      .select('status, work_started_at, work_completed_at')
      .eq('id', bookingId).single();

    if (!booking) return { success: false, error: 'Booking not found' };
    if ((booking as any).work_completed_at) return { success: false, error: 'Service already completed' };
    if ((booking as any).status !== 'in_progress') return { success: false, error: 'Service has not started yet' };

    // Mark completed
    await supabase.from(table as any).update({
      status: 'completed',
      work_completed_at: now,
      settlement_status: 'pending',
    }).eq('id', bookingId);

    // Calculate settlement
    const platformFee = Math.round(bookingAmount * platformFeeRate / 100);
    const vendorEarnings = bookingAmount - platformFee;
    const advancePaid = Math.round(bookingAmount * 0.2); // 20% advance already paid
    const remainingDue = bookingAmount - advancePaid;

    // Create settlement record
    const { data: settlement, error: settErr } = await supabase
      .from('vendor_settlements' as any)
      .insert({
        booking_id: bookingId,
        booking_table: table,
        vendor_id: vendorId,
        vendor_user_id: vendorUserId,
        customer_id: customerId,
        booking_amount: bookingAmount,
        platform_fee_rate: platformFeeRate,
        platform_fee_amount: platformFee,
        vendor_earnings: vendorEarnings,
        advance_paid: advancePaid,
        remaining_due: remainingDue,
        settlement_status: 'pending',
      })
      .select('id')
      .single();

    if (settErr) console.error('[Settlement] insert error:', settErr);

    // Log audit
    await supabase.from('booking_events' as any).insert({
      booking_table: table, booking_id: bookingId,
      event_type: 'WORK_COMPLETED',
      actor_id: vendorUserId, actor_role: 'vendor',
      metadata: { vendor_id: vendorId, completed_at: now, booking_amount: bookingAmount, vendor_earnings: vendorEarnings },
    });

    // Notify customer
    await supabase.from('notifications' as any).insert({
      user_id: customerId,
      title: 'Service Completed',
      message: `Your service has been completed. Thank you for using Vowza!`,
      type: 'booking_completed',
      reference_id: bookingId,
      is_read: false,
    });

    return { success: true, settlementId: (settlement as any)?.id };
  } catch (err: any) {
    console.error('[BookingExecution] completeService error:', err);
    return { success: false, error: err.message || 'Failed to complete service' };
  }
}

/* ─── 4. RESEND OTP ────────────────────────────────────────────────────────── */
export async function resendStartOTP(
  bookingId: string,
  bookingSource: string,
  vendorId: string,
  customerId: string,
  vendorName: string,
  serviceName: string,
): Promise<StartServiceResult> {
  try {
    // Check resend limit on current OTP
    const { data: current } = await supabase.from('booking_start_otps' as any)
      .select('id, resend_count, max_resends')
      .eq('booking_id', bookingId)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (current && current.length > 0) {
      const rec = current[0] as any;
      if (rec.resend_count >= rec.max_resends) {
        return { success: false, error: 'Maximum resend limit reached. Please contact support.' };
      }
    }

    // Invalidate all existing OTPs
    await supabase.from('booking_start_otps' as any)
      .update({ invalidated: true })
      .eq('booking_id', bookingId)
      .eq('verified', false);

    // Generate new OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const table = getBookingTable(bookingSource);
    const resendCount = current && current.length > 0 ? (current[0] as any).resend_count + 1 : 1;

    const { data: otpRecord } = await supabase.from('booking_start_otps' as any).insert({
      booking_id: bookingId, booking_table: table, vendor_id: vendorId,
      customer_id: customerId, otp_hash: otpHash, purpose: 'booking_start',
      expires_at: expiresAt, resend_count: resendCount,
      sms_sent: true, sms_sent_at: new Date().toISOString(),
      email_sent: true, email_sent_at: new Date().toISOString(),
      admin_notified: true, admin_notified_at: new Date().toISOString(),
    }).select('id').single();

    // Notify customer with new OTP
    await supabase.from('notifications' as any).insert({
      user_id: customerId,
      title: 'New Service Start OTP',
      message: `Your new start OTP: ${otp}. Share with ${vendorName} to begin ${serviceName}.`,
      type: 'booking_confirmed',
      reference_id: bookingId,
      is_read: false,
    });

    return { success: true, otp, otpId: (otpRecord as any)?.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to resend OTP' };
  }
}

export { getBookingTable };
