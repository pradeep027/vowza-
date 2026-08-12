// VendorBookings — 100% real data from Supabase. Zero mock values.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CalendarDays, Clock, MapPin, Users, CheckCircle, XCircle,
  MessageSquare, Eye, Search, Inbox, IndianRupee, RefreshCw, Loader2,
  Play, ShieldCheck, CheckCircle2,
} from 'lucide-react';
import { useVendorId, useVendorRealtime, useVendorBookings } from '@/hooks/useVendorData';
import { requestStartService, verifyStartOTP, completeService, resendStartOTP } from '@/services/bookingExecutionService';

type Tab = 'requested' | 'accepted' | 'confirmed' | 'completed' | 'cancelled';

const TAB_CFG: Record<Tab, { label: string; color: string; bg: string }> = {
  requested: { label: 'Pending',            color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  accepted:  { label: 'Awaiting Payment',   color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  confirmed: { label: 'Confirmed',          color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  completed: { label: 'Completed',          color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200' },
  cancelled: { label: 'Cancelled/Declined', color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
};

const TABS: Tab[] = ['requested', 'accepted', 'confirmed', 'completed', 'cancelled'];

export default function VendorBookings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('requested');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rescheduleRequests, setRescheduleRequests] = useState<any[]>([]);
  const [reschedBusy, setReschedBusy] = useState<string | null>(null);

  // Acceptance confirmation dialog
  const [acceptTarget, setAcceptTarget] = useState<any>(null);
  // Vendor cancellation dialog
  const [vendorCancelTarget, setVendorCancelTarget] = useState<any>(null);
  const [vendorCancelling, setVendorCancelling] = useState(false);

  // Booking execution: Start Service + OTP + Complete
  const [startTarget, setStartTarget] = useState<any>(null);
  const [startingService, setStartingService] = useState(false);
  const [otpTarget, setOtpTarget] = useState<any>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [otpFeedback, setOtpFeedback] = useState<{ type: 'info' | 'error'; message: string } | null>(null);
  const [completeTarget, setCompleteTarget] = useState<any>(null);
  const [completing, setCompleting] = useState(false);

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);

  const { data: bookings = [], isLoading } = useVendorBookings(vendorId, tab);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendCooldownSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldownSeconds]);

  // Fetch pending reschedule requests for this vendor
  useEffect(() => {
    if (!vendorId) return;
    (async () => {
      const { data } = await supabase
        .from('reschedule_requests' as any)
        .select('*')
        .eq('provider_id', vendorId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (data) setRescheduleRequests(data);
    })();
  }, [vendorId, bookings]);

  // Realtime for reschedule requests
  useEffect(() => {
    if (!vendorId) return;
    const ch = supabase.channel(`vendor-reschedule-${vendorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reschedule_requests' }, () => {
        supabase.from('reschedule_requests' as any).select('*').eq('provider_id', vendorId).eq('status', 'pending').order('created_at', { ascending: false }).then(({ data }) => { if (data) setRescheduleRequests(data); });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [vendorId]);

  // Accept reschedule: update booking date, mark request approved
  const handleAcceptReschedule = async (req: any) => {
    if (reschedBusy) return;
    setReschedBusy(req.id);
    try {
      // 1. Update the booking date/time
      const updateData: any = { event_date: req.requested_date };
      if (req.requested_time) updateData.event_time = req.requested_time;
      const { error: bookErr } = await supabase.from(req.booking_table as any).update(updateData).eq('id', req.booking_id);
      if (bookErr) throw bookErr;

      // 2. Mark reschedule request as approved
      const { error: reqErr } = await supabase.from('reschedule_requests' as any).update({
        status: 'approved',
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', req.id);
      if (reqErr) throw reqErr;

      // 3. Notify customer
      await supabase.from('notifications' as any).insert({
        user_id: req.customer_id,
        title: 'Reschedule Approved',
        message: `Your reschedule request was approved! New date: ${new Date(req.requested_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}${req.requested_time ? ` at ${req.requested_time}` : ''}.`,
        type: 'booking_accepted',
        reference_id: req.booking_id,
        is_read: false,
      });

      toast.success('Reschedule approved! Booking date updated.');
      setRescheduleRequests(prev => prev.filter(r => r.id !== req.id));
      qc.invalidateQueries({ queryKey: ['vendor-bookings'], refetchType: 'all' });
    } catch (err: any) { toast.error(err.message || 'Failed to approve reschedule'); }
    finally { setReschedBusy(null); }
  };

  // Decline reschedule: mark declined, process 80% refund if eligible
  const handleDeclineReschedule = async (req: any) => {
    if (reschedBusy) return;
    setReschedBusy(req.id);
    try {
      const refundAmt = req.refund_eligible ? Math.round(Number(req.original_amount_paid) * 0.8) : 0;

      // Mark request as declined + process refund
      const { error: reqErr } = await supabase.from('reschedule_requests' as any).update({
        status: 'declined',
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
        refund_amount: refundAmt,
        refund_status: refundAmt > 0 ? 'completed' : 'none',
        refund_initiated_at: refundAmt > 0 ? new Date().toISOString() : null,
        refund_completed_at: refundAmt > 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', req.id);
      if (reqErr) throw reqErr;

      // Notify customer
      const refundMsg = refundAmt > 0
        ? ` A refund of ₹${refundAmt.toLocaleString('en-IN')} (80%) has been processed.`
        : '';
      await supabase.from('notifications' as any).insert({
        user_id: req.customer_id,
        title: 'Reschedule Declined',
        message: `Your reschedule request was declined by the artist. The original booking date remains.${refundMsg}`,
        type: 'booking_rejected',
        reference_id: req.booking_id,
        is_read: false,
      });

      toast.success(`Reschedule declined.${refundAmt > 0 ? ` ₹${refundAmt.toLocaleString()} refund processed.` : ''}`);
      setRescheduleRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (err: any) { toast.error(err.message || 'Failed to decline reschedule'); }
    finally { setReschedBusy(null); }
  };

  // ── Vendor Cancel Accepted Booking (30% penalty) ─────────────────────────
  const handleVendorCancel = async () => {
    if (!vendorCancelTarget || !user || vendorCancelling) return;
    setVendorCancelling(true);
    try {
      const b = vendorCancelTarget;
      const table = b._source === 'photography' ? 'photography_package_bookings'
        : b._source === 'catering' ? 'catering_bookings'
        : b._source === 'drone' ? 'drone_bookings'
        : b._source === 'videography' ? 'videography_bookings'
        : b._source === 'dj' ? 'dj_bookings'
        : b._source === 'decorator' ? 'decorator_bookings'
        : b._source === 'makeup' ? 'makeup_bookings'
        : b._source === 'mehendi' ? 'mehendi_bookings'
        : b._source === 'anchor' ? 'anchor_bookings'
        : b._source === 'banquet' ? 'banquet_bookings'
        : b._source === 'rental' ? 'rental_bookings'
        : b._source === 'priest' ? 'priest_bookings'
        : b._source === 'water' ? 'water_bookings'
        : b._source === 'band' ? 'band_bookings'
        : b._source === 'singer' ? 'singer_bookings'
        : b._source === 'dancer' ? 'dancer_bookings'
        : 'bookings';

      const total = Number(b.amount ?? b.total_amount ?? 0);
      const penaltyAmount = Math.round(total * 0.3);
      const advancePaid = Number(b.advance_amount ?? Math.round(total * 0.2));
      const customerRefund = b.advance_paid_at ? advancePaid : 0;

      // 1. Cancel the booking
      const { error: cancelErr } = await supabase.from(table as any).update({
        status: 'cancelled', calendar_locked: false,
      }).eq('id', b.id);
      if (cancelErr) throw cancelErr;

      // 2. Record vendor cancellation with penalty
      await supabase.from('vendor_cancellations' as any).insert({
        booking_id: b.id,
        booking_table: table,
        vendor_id: vendorId,
        vendor_user_id: user.id,
        customer_id: b.customer_id,
        total_booking_cost: total,
        penalty_percentage: 30,
        penalty_amount: penaltyAmount,
        customer_advance_paid: customerRefund,
        customer_refund_amount: customerRefund,
        customer_refund_status: customerRefund > 0 ? 'completed' : 'none',
      });

      // 3. Notify customer
      await supabase.from('notifications' as any).insert({
        user_id: b.customer_id,
        title: 'Booking Cancelled by Artist',
        message: `Your booking has been cancelled by the artist. ${customerRefund > 0 ? `Full refund of ₹${customerRefund.toLocaleString('en-IN')} has been processed.` : 'No advance was paid.'}`,
        type: 'booking_cancelled',
        reference_id: b.id,
        is_read: false,
      });

      toast.success(`Booking cancelled. 30% penalty (₹${penaltyAmount.toLocaleString()}) recorded.${customerRefund > 0 ? ` Customer refund: ₹${customerRefund.toLocaleString()}.` : ''}`);
      setVendorCancelTarget(null);
      await qc.invalidateQueries({ queryKey: ['vendor-bookings'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['vendor-kpis'] });
      qc.invalidateQueries({ queryKey: ['vendor-badges'] });
    } catch (err: any) { toast.error(err.message || 'Failed to cancel booking'); }
    finally { setVendorCancelling(false); }
  };

  // ── Start Service: send the customer-only OTP ───────────────────────────────
  const handleStartService = async (b: any) => {
    if (startingService) return;
    setStartingService(true);
    const result = await requestStartService(b.id, b._source || 'generic');
    setStartingService(false);

    if (result.success) {
      setStartTarget(null);
      setOtpTarget(b);
      setOtpInput('');
      setResendCooldownSeconds(60);
      setOtpFeedback({ type: 'info', message: 'A verification code has been sent to the customer\'s registered email.' });
      toast.success('OTP sent to the customer\'s registered email.');
      qc.invalidateQueries({ queryKey: ['vendor-bookings'], refetchType: 'all' });
      return;
    }

    if (result.code === 'ACTIVE_OTP_EXISTS') {
      setStartTarget(null);
      setOtpTarget(b);
      setOtpInput('');
      setOtpFeedback({ type: 'info', message: 'An active OTP already exists. Ask the customer for the code or resend it.' });
    }
    toast.error(result.error || 'Email sending failure. Please try again.');
  };

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    if (!otpTarget || otpInput.length !== 6 || otpVerifying) return;
    setOtpVerifying(true);
    setOtpFeedback(null);
    const result = await verifyStartOTP(otpTarget.id, otpTarget._source || 'generic', otpInput);
    setOtpVerifying(false);

    if (result.success) {
      toast.success('Service Started Successfully');
      setOtpTarget(null);
      setOtpInput('');
      setOtpFeedback(null);
      qc.invalidateQueries({ queryKey: ['vendor-bookings'], refetchType: 'all' });
      return;
    }

    setOtpFeedback({ type: 'error', message: result.error || 'Verification failed. Please try again.' });
    toast.error(result.error || 'Verification failed');
  };

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  const handleResendOTP = async () => {
    if (!otpTarget || resendingOtp) return;
    setResendingOtp(true);
    setOtpFeedback(null);
    const result = await resendStartOTP(otpTarget.id, otpTarget._source || 'generic');
    setResendingOtp(false);

    if (result.success) {
      setOtpInput('');
      setResendCooldownSeconds(60);
      setOtpFeedback({ type: 'info', message: 'A new verification code has been sent to the customer\'s registered email. The previous code is invalid.' });
      toast.success('New OTP sent to the customer\'s registered email.');
    } else {
      setOtpFeedback({ type: 'error', message: result.error || 'Email sending failure. Please try again.' });
      toast.error(result.error || 'Failed to resend OTP');
    }
  };

  // ── Complete Service ────────────────────────────────────────────────────────
  const handleCompleteService = async () => {
    if (!completeTarget || completing) return;
    setCompleting(true);
    const total = Number(completeTarget.amount ?? completeTarget.total_amount ?? 0);
    const result = await completeService(
      completeTarget.id, completeTarget._source || 'generic',
      vendorId!, user!.id, completeTarget.customer_id, total, 5 // 5% platform fee
    );
    setCompleting(false);
    if (result.success) {
      toast.success('Service completed! Settlement is being processed.');
      setCompleteTarget(null);
      qc.invalidateQueries({ queryKey: ['vendor-bookings'], refetchType: 'all' });
    } else {
      toast.error(result.error || 'Failed to complete');
    }
  };


  const filtered = bookings.filter((b: any) =>
    !search ||
    b.customer?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.venue_city?.toLowerCase().includes(search.toLowerCase()) ||
    b.venue_address?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Accept / Reject ────────────────────────────────────────────────────────
  const updateStatus = async (booking: any, newStatus: 'confirmed' | 'cancelled') => {
    setBusy(booking.id);

    // Determine which table to update based on booking source
    const table = booking._source === 'photography' ? 'photography_package_bookings'
      : booking._source === 'catering' ? 'catering_bookings'
      : booking._source === 'drone' ? 'drone_bookings'
      : booking._source === 'videography' ? 'videography_bookings'
      : booking._source === 'dj' ? 'dj_bookings'
      : booking._source === 'decorator' ? 'decorator_bookings'
      : booking._source === 'makeup' ? 'makeup_bookings'
      : booking._source === 'mehendi' ? 'mehendi_bookings'
      : booking._source === 'anchor' ? 'anchor_bookings'
      : booking._source === 'banquet' ? 'banquet_bookings'
      : booking._source === 'rental' ? 'rental_bookings'
      : booking._source === 'priest' ? 'priest_bookings'
      : booking._source === 'water' ? 'water_bookings'
      : booking._source === 'band' ? 'band_bookings'
      : booking._source === 'singer' ? 'singer_bookings'
      : booking._source === 'dancer' ? 'dancer_bookings'
      : 'bookings';
    const total = Number(booking.amount ?? booking.total_amount ?? 0);
    const advanceAmount = Math.round(total * 0.2);
    const remainingAmount = total - advanceAmount;

    if (newStatus === 'confirmed') {
      // ACCEPT: set status to 'accepted' uniformly across all tables
      const dbStatus = 'accepted';
      const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const updatePayload: any = {
        status: dbStatus,
        accepted_at: new Date().toISOString(),
        advance_amount: advanceAmount,
        remaining_amount: remainingAmount,
        payment_deadline: deadline,
        calendar_locked: false, // Not locked until advance paid
      };
      if (table === 'bookings') updatePayload.updated_at = new Date().toISOString();

      const { error } = await supabase.from(table as any).update(updatePayload).eq('id', booking.id);
      if (error) { toast.error(`Failed: ${error.message}`); setBusy(null); return; }

      // Notify customer: booking accepted, pay advance
      if (booking.customer_id) {
        await supabase.from('notifications' as any).insert({
          user_id: booking.customer_id,
          title: 'Booking Accepted — Pay Advance',
          message: `Your booking has been accepted! Please pay the 20% advance (₹${advanceAmount.toLocaleString('en-IN')}) within 24 hours to confirm. Your payment will be securely held by Vowza until the service is completed.`,
          type: 'booking_accepted',
          reference_id: booking.id,
          is_read: false,
        });
      }
      toast.success('Booking accepted! Customer will be asked to pay 20% advance.');
    } else {
      // DECLINE — move booking out of Pending immediately
      const dbStatus = table === 'bookings' ? 'rejected' : 'cancelled';
      const updatePayload: any = { status: dbStatus, calendar_locked: false };
      if (table === 'bookings') updatePayload.updated_at = new Date().toISOString();

      const { error } = await supabase.from(table as any).update(updatePayload).eq('id', booking.id);
      if (error) { toast.error(`Failed: ${error.message}`); setBusy(null); return; }

      if (booking.customer_id) {
        await supabase.from('notifications' as any).insert({
          user_id: booking.customer_id,
          title: 'Booking Declined',
          message: 'Your booking request could not be accepted. Please explore other artists.',
          type: 'booking_rejected',
          reference_id: booking.id,
          is_read: false,
        });
      }
      toast.success('Booking declined');
    }

    await qc.invalidateQueries({ queryKey: ['vendor-bookings'], refetchType: 'all' });
    qc.invalidateQueries({ queryKey: ['vendor-kpis'] });
    qc.invalidateQueries({ queryKey: ['vendor-badges'] });
    setBusy(null);
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Bookings</h1>
        <p className="text-sm text-muted-foreground">Manage all your event bookings</p>
      </div>

      {/* ── Pending Reschedule Requests ─────────────────────────────────── */}
      {rescheduleRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-indigo-700 flex items-center gap-1.5"><RefreshCw className="w-4 h-4" />Reschedule Requests ({rescheduleRequests.length})</h2>
          {rescheduleRequests.map((req: any) => (
            <div key={req.id} className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-indigo-900">Reschedule Request</p>
                  <p className="text-xs text-indigo-700">
                    Current: <span className="font-medium">{new Date(req.original_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {req.original_time && <span> at {req.original_time}</span>}
                  </p>
                  <p className="text-xs text-indigo-700">
                    Requested: <span className="font-bold">{new Date(req.requested_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {req.requested_time && <span> at {req.requested_time}</span>}
                  </p>
                  {req.reason && <p className="text-[11px] text-indigo-600 italic">"{req.reason}"</p>}
                  {req.refund_eligible && <p className="text-[10px] text-orange-600">If declined: 80% refund (₹{Math.round(Number(req.original_amount_paid) * 0.8).toLocaleString()}) will be processed</p>}
                </div>
                <span className="text-[10px] text-indigo-500 flex-shrink-0">{new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleAcceptReschedule(req)} disabled={reschedBusy === req.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50">
                  {reschedBusy === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Accept
                </button>
                <button onClick={() => handleDeclineReschedule(req)} disabled={reschedBusy === req.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50">
                  <XCircle className="w-3.5 h-3.5" /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit border border-border/50 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
              tab === t ? 'bg-white shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {TAB_CFG[t].label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by customer or venue..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
      </div>

      {/* List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border/60 p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-3" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border/60 p-16 text-center">
            <Inbox className="w-14 h-14 text-muted-foreground/20 mx-auto mb-5" />
            <h3 className="text-base font-semibold text-foreground mb-2">
              No {TAB_CFG[tab].label} Bookings
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {tab === 'requested'
                ? 'New booking requests from customers will appear here.'
                : `You have no ${TAB_CFG[tab].label.toLowerCase()} bookings yet.`}
            </p>
          </div>
        ) : filtered.map((b: any) => {
          const advance   = Number(b.advance_amount ?? 0);
          const total     = Number(b.amount ?? b.total_amount ?? 0);
          const remaining = Number(b.remaining_amount ?? Math.max(0, total - advance));
          const name      = b.customer?.full_name ?? 'Customer';
          const isPaid    = !!b.advance_paid_at;
          const isExpired = b.payment_deadline && !isPaid && new Date(b.payment_deadline) < new Date();

          return (
            <div key={b.id} className="bg-white rounded-2xl border border-border/60 p-5 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  {b.customer?.avatar_url ? (
                    <img src={b.customer.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {b.customer?.email ?? b.customer?.phone ?? '—'}
                    </p>
                    {b._source && <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-maroon/8 text-maroon text-[10px] font-bold capitalize">{b._source === 'photography' ? 'Photography' : b._source === 'videography' ? 'Videography' : b._source === 'dj' ? 'DJ & Music' : b._source === 'decorator' ? 'Decoration' : b._source === 'makeup' ? 'Makeup' : b._source === 'mehendi' ? 'Mehendi' : b._source === 'drone' ? 'Drone' : b._source === 'band' ? 'Band' : b._source === 'singer' ? 'Singer' : b._source === 'dancer' ? 'Dance' : b._source === 'anchor' ? 'Anchor' : b._source === 'catering' ? 'Catering' : b._source === 'priest' ? 'Priest' : b._source === 'banquet' ? 'Banquet' : b._source === 'rental' ? 'Rentals' : b._source === 'water' ? 'Water' : b._source}</span>}
                  </div>
                </div>
                <span className={cn('text-[10px] font-bold border px-2.5 py-1 rounded-full capitalize flex-shrink-0',
                  TAB_CFG[tab].bg, TAB_CFG[tab].color)}>
                  {b.status === 'accepted' ? (isPaid ? 'Advance Paid' : isExpired ? 'Payment Expired' : 'Awaiting Payment') : b.status}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {b.venue_address || b.venue_city || b.venue_area || 'Venue not set'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                  {b.event_date
                    ? new Date(b.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Date TBD'}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  {b.event_time || 'Time TBD'}
                  {b.event_duration_hours ? ` · ${b.event_duration_hours}h` : ''}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5 flex-shrink-0" />
                  {b.guest_count ? `${b.guest_count} guests` : 'Guests TBD'}
                </div>
              </div>

              {/* Requirements */}
              {b.requirements && (
                <p className="text-xs text-muted-foreground bg-[#FAFAFA] rounded-xl p-3 mb-4 leading-relaxed">
                  {b.requirements}
                </p>
              )}

              {b.work_started_at && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <div className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Service Started</div>
                  <p className="mt-1 text-emerald-700">Started at: {new Date(b.work_started_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
              )}

              {/* Money + actions */}
              <div className="flex items-end justify-between gap-4 pt-4 border-t border-border/40 flex-wrap">
                <div className="flex items-center gap-5">
                  {b.package_name && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Package</p>
                      <p className="text-xs font-semibold text-foreground">{b.package_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground">Advance</p>
                    <p className="text-xs font-semibold text-emerald-600">
                      {advance > 0 ? `₹${advance.toLocaleString('en-IN')}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Remaining</p>
                    <p className="text-xs font-semibold text-foreground">
                      {remaining > 0 ? `₹${remaining.toLocaleString('en-IN')}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-xs font-bold text-foreground">
                      {total > 0 ? `₹${total.toLocaleString('en-IN')}` : 'Quote pending'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {tab === 'requested' && (
                    <>
                      <button onClick={() => setAcceptTarget(b)} disabled={busy === b.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50">
                        <CheckCircle className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button onClick={() => updateStatus(b, 'cancelled')} disabled={busy === b.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50">
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </button>
                    </>
                  )}
                  {tab === 'confirmed' && (
                    <>
                      {/* Only a confirmed booking without an active request can start. The backend repeats this check. */}
                      {!b.work_started_at && b.status === 'confirmed' && !b.start_requested_at && (
                        <button onClick={() => { setStartTarget(b); }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors">
                          <Play className="w-3.5 h-3.5" /> Start Work
                        </button>
                      )}
                      {b.start_requested_at && !b.work_started_at && (
                        <button onClick={() => { setOtpTarget(b); setOtpInput(''); setOtpFeedback(null); }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors">
                          <ShieldCheck className="w-3.5 h-3.5" /> Enter OTP
                        </button>
                      )}
                      {b.work_started_at && !b.work_completed_at && (
                        <button onClick={() => setCompleteTarget(b)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Complete Service
                        </button>
                      )}
                      <button onClick={() => setVendorCancelTarget(b)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> Cancel Booking
                      </button>
                    </>
                  )}
                  <button onClick={() => navigate(`/chat/${b.id}`)}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors" title="Chat">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Start Service Confirmation ──────────────────────────────── */}
      {startTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="font-bold text-foreground text-lg">Start Service</h2>
            <p className="text-sm text-muted-foreground">A verification code will be sent to the customer’s registered email. They must share it with you to start the service.</p>
            <div className="rounded-xl bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{startTarget.customer?.full_name || 'Customer'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Event</span><span className="font-medium">{startTarget.event_date ? new Date(startTarget.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-medium">{startTarget.package_name || 'Service'}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStartTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary">Cancel</button>
              <button onClick={() => handleStartService(startTarget)} disabled={startingService}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50">
                {startingService ? <><Loader2 className="w-4 h-4 inline mr-1 animate-spin" />Sending OTP...</> : 'Send Start OTP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Service Start Verification Dialog ─────────────────────────── */}
      {otpTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h2 className="font-bold text-foreground text-lg text-center">Service Start Verification</h2>
            <p className="text-xs text-muted-foreground text-center">A verification code has been sent to the customer's registered email.</p>
            {otpFeedback && (
              <div className={cn('rounded-lg px-3 py-2 text-xs', otpFeedback.type === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-blue-200 bg-blue-50 text-blue-700')}>
                {otpFeedback.message}
              </div>
            )}
            <label htmlFor="service-start-otp" className="block text-sm font-semibold text-foreground">Enter Customer Service Start OTP</label>
            <input
              id="service-start-otp"
              type="text" inputMode="numeric" maxLength={6}
              value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full text-center text-3xl font-bold tracking-[0.5em] py-4 rounded-xl border-2 border-border focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              placeholder="______"
              autoComplete="one-time-code"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => { setOtpTarget(null); setOtpInput(''); setOtpFeedback(null); }} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary">Cancel</button>
              <button onClick={handleVerifyOTP} disabled={otpInput.length !== 6 || otpVerifying || resendingOtp}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50">
                {otpVerifying ? <><Loader2 className="w-4 h-4 inline mr-1 animate-spin" />Verifying...</> : 'Verify & Start Service'}
              </button>
            </div>
            <button onClick={handleResendOTP} disabled={resendingOtp || otpVerifying || resendCooldownSeconds > 0} className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1 disabled:opacity-50">
              {resendingOtp ? <><Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />Resending OTP...</> : resendCooldownSeconds > 0 ? `Resend OTP in ${resendCooldownSeconds}s` : 'Resend OTP'}
            </button>
          </div>
        </div>
      )}

      {/* ── Complete Service Confirmation ──────────────────────────────── */}
      {completeTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="font-bold text-foreground text-lg">Complete Service</h2>
            <p className="text-sm text-muted-foreground">Confirm that you have finished providing the service.</p>
            <div className="rounded-xl bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{completeTarget.customer?.full_name || 'Customer'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-medium">{completeTarget.package_name || 'Service'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">₹{Number(completeTarget.amount ?? completeTarget.total_amount ?? 0).toLocaleString('en-IN')}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCompleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary">Cancel</button>
              <button onClick={handleCompleteService} disabled={completing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                {completing ? <><Loader2 className="w-4 h-4 inline mr-1 animate-spin" />Processing...</> : 'Confirm Completion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Acceptance Confirmation Dialog (30% penalty warning) ────────── */}
      {acceptTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="font-bold text-foreground text-lg">Confirm Booking Acceptance</h2>
            <div className="rounded-xl bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{acceptTarget.customer?.full_name || 'Customer'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Event Date</span><span className="font-medium">{acceptTarget.event_date ? new Date(acceptTarget.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Booking Cost</span><span className="font-bold">₹{Number(acceptTarget.amount ?? acceptTarget.total_amount ?? 0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Customer Advance (20%)</span><span>₹{Math.round(Number(acceptTarget.amount ?? acceptTarget.total_amount ?? 0) * 0.2).toLocaleString('en-IN')}</span></div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1.5">
              <p className="text-xs font-bold text-amber-800">⚠ Vendor Cancellation Policy</p>
              <p className="text-[11px] text-amber-700">If you accept this booking and later cancel, a <span className="font-bold">30% penalty</span> based on the total booking cost will apply.</p>
              <p className="text-xs font-semibold text-amber-900">Potential penalty: ₹{Math.round(Number(acceptTarget.amount ?? acceptTarget.total_amount ?? 0) * 0.3).toLocaleString('en-IN')}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAcceptTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary">Go Back</button>
              <button onClick={() => { updateStatus(acceptTarget, 'confirmed'); setAcceptTarget(null); }} disabled={busy === acceptTarget.id}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50">
                Accept Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Vendor Cancel Confirmation Dialog ──────────────────────────── */}
      {vendorCancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="font-bold text-red-700 text-lg">Cancel Accepted Booking</h2>
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1">
              <p className="text-xs font-bold text-red-800">⚠ Warning: This booking has been accepted.</p>
              <p className="text-[11px] text-red-700">Cancelling will incur a 30% penalty based on the total booking cost.</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{vendorCancelTarget.customer?.full_name || 'Customer'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Booking Cost</span><span className="font-bold">₹{Number(vendorCancelTarget.amount ?? vendorCancelTarget.total_amount ?? 0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vendor Penalty (30%)</span><span className="font-bold text-red-600">₹{Math.round(Number(vendorCancelTarget.amount ?? vendorCancelTarget.total_amount ?? 0) * 0.3).toLocaleString('en-IN')}</span></div>
              {vendorCancelTarget.advance_paid_at && <div className="flex justify-between"><span className="text-muted-foreground">Customer Refund</span><span className="font-bold text-emerald-600">₹{Number(vendorCancelTarget.advance_amount ?? Math.round(Number(vendorCancelTarget.amount ?? vendorCancelTarget.total_amount ?? 0) * 0.2)).toLocaleString('en-IN')}</span></div>}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setVendorCancelTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary">Keep Booking</button>
              <button onClick={handleVendorCancel} disabled={vendorCancelling}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                {vendorCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
